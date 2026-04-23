// SummaryProtocol v1 摘要生成管线
//
// 设计依据：docs/summary-protocol-v1-proposal.md
//
// 调用方（handleChat 或 migrate_summaries.mjs）在满足阈值时触发：
//   ctx.waitUntil(generateSummaryForConversation({
//     conversationId, env, ctx, userRole, userId,
//   }));
//
// 管线：
//   1. 拉对话 + 最近 ≤20 条消息
//   2. 脱敏消息内容（调 redactPII）
//   3. 组装 SummaryProtocol v1 生成 prompt
//   4. 调 gpt-4o-mini JSON mode（response_format: json_object）
//   5. 解析 + 轻量校验。失败则重试 1 次；仍失败写 fallback schema
//   6. 写 conversation_summaries + 回写 conversations.summary_message_count
//   7. logToolCall 写 ai_trace_logs（tool_name='generate_summary', user_role='system'）
//
// 设计约束：
//   - 纯后台系统调用，永不抛错到主流程
//   - 失败全部静默 console.warn，trace 记录 resultStatus='error'
//   - 不修改已存摘要（in-place 修改违反协议 §7.3），每次都 INSERT 新记录

import { redactPII } from './redact.js';
import { logToolCall } from './trace.js';

export const SUMMARY_PROTOCOL_VERSION = 1;

// 最多拉多少条消息喂给摘要器
const MAX_MESSAGES_FOR_SUMMARY = 20;
// 单条消息原文最长字符数（超出截断，避免整张表的极端 outlier 撑爆 prompt）
const MAX_MSG_CHARS = 400;
// LLM 超时
const LLM_TIMEOUT_MS = 12_000;

const CONVERSATION_TYPES = [
  'device_consult',
  'repair_request',
  'pricing',
  'rating_complaint',
  'wallet_query',
  'post_sale_followup',
  'onboarding',
  'general',
];

const PENDING_ITEM_PREFIXES = [
  '[missing_info]',
  '[awaiting_confirmation]',
  '[followup_due]',
  '[payment_pending]',
  '[rating_pending]',
];

// ============ 生成 prompt ============

function buildSystemPrompt() {
  return `你是 B2B 工业设备售后场景的对话摘要生成器。任务是把一段客户/合伙人与 AI 助手"小智"的对话，压缩成一份结构化 JSON，用于跨会话的 AI 上下文检索和业务流跟进。

必须严格按 SummaryProtocol v1 返回 JSON（不要 markdown，不要解释）：

{
  "protocol_version": 1,
  "conversation_type": "device_consult | repair_request | pricing | rating_complaint | wallet_query | post_sale_followup | onboarding | general",
  "summary_text": "一句话总结（≤120 字，具体不空泛）",
  "device": {
    "type": "激光切割机 / 折弯机 / 焊接机 / ... 空串代表对话没提到具体设备",
    "brand": "大族 / 通快 / 百超 / ...",
    "model": "如 G3015H",
    "power": "如 3000W",
    "material": "如 6mm碳钢"
  },
  "fault_keywords": ["挂渣", "毛刺"],
  "intent": "咨询 | 报修 | 议价 | 评价 | 投诉 | 其他",
  "pending_items": [
    "[missing_info] 客户未提供材料牌号",
    "[awaiting_confirmation] AI 建议调整气压但未确认执行",
    "[followup_due] 推荐了张工程师但客户未回复",
    "[payment_pending] 合伙人提现申请处理中",
    "[rating_pending] WO-... 已解决待评价"
  ],
  "sentiment": "neutral | satisfied | complaint | urgent",
  "referenced_ids": {
    "work_order_ids": ["WO-20260415-001"],
    "engineer_ids": [],
    "device_ids": []
  }
}

生成规则：
1. 非设备/维修场景（钱包查询、闲聊）允许省略 device / fault_keywords / referenced_ids 字段或置空
2. pending_items 每条必须以方括号前缀标签打头（missing_info / awaiting_confirmation / followup_due / payment_pending / rating_pending），只写真实未闭环的事项，宁缺毋滥
3. 不要虚构信息；对话里没出现的字段宁可不填
4. summary_text 要具体（型号、参数、症状三元组是黄金信号），不要写"客户咨询了设备问题"这种废话
5. conversation_type 从 8 个枚举值里选最贴切的，全无法匹配选 general`;
}

function buildUserPrompt({ convMeta, messages }) {
  const transcriptLines = messages.map((m) => {
    const role =
      m.role === 'user'
        ? convMeta.user_role_label
        : m.role === 'assistant'
          ? '小智'
          : m.role === 'system'
            ? '系统'
            : m.role;
    const content = (m.content || '').slice(0, MAX_MSG_CHARS);
    return `[${role}] ${content}`;
  });
  const header = [
    `对话元数据：`,
    `- 对话ID：${convMeta.id}`,
    `- 用户类型：${convMeta.user_role_label}`,
    `- 对话创建时间：${convMeta.created_at || '未知'}`,
    `- 本次摘要基于 ${messages.length} 条消息`,
  ].join('\n');

  return `${header}

对话内容：
${transcriptLines.join('\n')}

请按 SummaryProtocol v1 返回 JSON。`;
}

// ============ 解析 + 校验 ============

/**
 * 尝试提取 JSON（兼容 LLM 偶尔带 markdown 代码块的情况）。
 * 不抛错，失败返回 null。
 */
function tryParseJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * 轻量校验摘要 schema：
 *   - 必须有 protocol_version / conversation_type / summary_text
 *   - conversation_type 必须在枚举值内（否则兜底成 general）
 *   - pending_items 前缀不对的条目过滤掉（不是整体拒绝，只清洗）
 *
 * 返回 { valid: boolean, sanitized: object }
 */
function sanitizeSummary(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, sanitized: null };
  }

  const out = { ...raw };

  // 强制版本号
  out.protocol_version = SUMMARY_PROTOCOL_VERSION;

  // 必填字段
  if (typeof out.summary_text !== 'string' || out.summary_text.trim().length === 0) {
    return { valid: false, sanitized: null };
  }
  // 截断 summary_text 到 240 字符硬上限（协议 §3.1 规定 ≤120 字，留一倍缓冲）
  out.summary_text = out.summary_text.slice(0, 240);

  // 枚举兜底
  if (!CONVERSATION_TYPES.includes(out.conversation_type)) {
    out.conversation_type = 'general';
  }

  // pending_items：只保留带合法前缀的字符串
  if (Array.isArray(out.pending_items)) {
    out.pending_items = out.pending_items
      .filter((s) => typeof s === 'string' && s.length > 0)
      .filter((s) => PENDING_ITEM_PREFIXES.some((p) => s.startsWith(p)))
      .slice(0, 10);
  } else {
    delete out.pending_items;
  }

  // fault_keywords：字符串数组
  if (Array.isArray(out.fault_keywords)) {
    out.fault_keywords = out.fault_keywords
      .filter((s) => typeof s === 'string' && s.length > 0)
      .slice(0, 10);
  } else {
    delete out.fault_keywords;
  }

  // device / referenced_ids：保留结构但过滤非法值
  if (out.device && typeof out.device === 'object') {
    const d = {};
    for (const k of ['type', 'brand', 'model', 'power', 'material']) {
      if (typeof out.device[k] === 'string' && out.device[k].trim()) {
        d[k] = out.device[k].trim().slice(0, 80);
      }
    }
    if (Object.keys(d).length > 0) out.device = d;
    else delete out.device;
  } else {
    delete out.device;
  }

  if (out.referenced_ids && typeof out.referenced_ids === 'object') {
    const r = {};
    for (const k of ['work_order_ids', 'engineer_ids', 'device_ids']) {
      if (Array.isArray(out.referenced_ids[k])) {
        r[k] = out.referenced_ids[k]
          .filter((s) => typeof s === 'string' && s.length > 0)
          .slice(0, 20);
      }
    }
    if (Object.keys(r).length > 0) out.referenced_ids = r;
    else delete out.referenced_ids;
  } else {
    delete out.referenced_ids;
  }

  return { valid: true, sanitized: out };
}

function buildFallbackSummary({ previewText, errorCode, sourceMessageCount }) {
  return {
    protocol_version: SUMMARY_PROTOCOL_VERSION,
    conversation_type: 'general',
    summary_text: '[自动摘要失败，已保留原文前500字]',
    raw_text_preview: (previewText || '').slice(0, 500),
    generation_error: errorCode || 'unknown',
    generated_at: new Date().toISOString(),
    source_message_count: sourceMessageCount,
  };
}

// ============ LLM 调用 ============

async function callLlmJsonMode({ env, systemPrompt, userPrompt }) {
  if (!env?.OPENAI_API_ENDPOINT || !env?.OPENAI_API_KEY) {
    return { ok: false, error: 'missing_api_config' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const resp = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      return { ok: false, error: `api_${resp.status}` };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'empty_content' };
    return { ok: true, content };
  } catch (err) {
    if (err?.name === 'AbortError') return { ok: false, error: 'timeout' };
    return { ok: false, error: err?.message || 'fetch_error' };
  } finally {
    clearTimeout(timer);
  }
}

// ============ 主入口 ============

/**
 * 给一个对话生成 SummaryProtocol v1 摘要并持久化。
 *
 * @param {object} p
 * @param {string} p.conversationId
 * @param {object} p.env                - Workers env（DB + OPENAI_API_*）
 * @param {object} [p.ctx]              - ctx.waitUntil 用（trace 写入走它）
 * @param {string} [p.userRole='system']- 记入 ai_trace_logs
 * @param {string} [p.userId]           - 触发人 id（可选）
 *
 * @returns {Promise<{ok:boolean, summary_id?:string, error?:string}>}
 */
export async function generateSummaryForConversation({
  conversationId,
  env,
  ctx,
  userRole = 'system',
  userId = null,
}) {
  const started = Date.now();
  if (!conversationId || !env?.DB) {
    return { ok: false, error: 'invalid_input' };
  }

  // ------- 1. 读对话 + 消息 -------
  let convMeta;
  let messages;
  try {
    const conv = await env.DB.prepare(
      `SELECT id, customer_id, engineer_id, created_at, updated_at,
              COALESCE(summary_message_count, 0) AS summary_message_count
         FROM conversations WHERE id = ?`
    )
      .bind(conversationId)
      .first();

    if (!conv) {
      return { ok: false, error: 'conversation_not_found' };
    }

    const userRoleLabel = conv.engineer_id ? '合伙人' : conv.customer_id ? '客户' : '访客';
    convMeta = {
      id: conv.id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      user_role_label: userRoleLabel,
      prev_summary_count: conv.summary_message_count,
    };

    const msgRes = await env.DB.prepare(
      `SELECT id, role, content, created_at
         FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        LIMIT ?`
    )
      .bind(conversationId, MAX_MESSAGES_FOR_SUMMARY)
      .all();
    messages = msgRes?.results || [];
  } catch (err) {
    console.warn('[summary] load conversation failed:', err?.message || err);
    logToolCall({
      env,
      ctx,
      conversationId,
      userId,
      userRole,
      toolName: 'generate_summary',
      args: { conversationId },
      resultStatus: 'error',
      errorCode: 'db_load_failed',
      latencyMs: Date.now() - started,
    });
    return { ok: false, error: 'db_load_failed' };
  }

  if (messages.length === 0) {
    return { ok: false, error: 'no_messages' };
  }

  const sourceMessageCount = messages.length;

  // ------- 2. 脱敏（决议 4：生成前清洗）-------
  const safeMessages = messages.map((m) => ({
    ...m,
    content: redactPII(m.content || ''),
  }));

  // ------- 3. 生成 prompt -------
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ convMeta, messages: safeMessages });

  // ------- 4. 调 LLM（失败重试 1 次）-------
  let llmResult = await callLlmJsonMode({ env, systemPrompt, userPrompt });
  let parsed = llmResult.ok ? tryParseJson(llmResult.content) : null;
  let validation = parsed ? sanitizeSummary(parsed) : { valid: false };

  if (!validation.valid) {
    // 重试一次
    llmResult = await callLlmJsonMode({ env, systemPrompt, userPrompt });
    parsed = llmResult.ok ? tryParseJson(llmResult.content) : null;
    validation = parsed ? sanitizeSummary(parsed) : { valid: false };
  }

  // ------- 5. 构造最终 summary（合法 or fallback）-------
  let finalSummary;
  let errorCode = null;
  if (validation.valid) {
    finalSummary = {
      ...validation.sanitized,
      generated_at: new Date().toISOString(),
      source_message_count: sourceMessageCount,
    };
  } else {
    errorCode = llmResult.ok ? 'json_parse_failed' : llmResult.error;
    const previewText = safeMessages
      .slice(-6)
      .map((m) => m.content)
      .join(' | ');
    finalSummary = buildFallbackSummary({
      previewText,
      errorCode,
      sourceMessageCount,
    });
  }

  // ------- 6. 写 conversation_summaries + 更新 counter -------
  const summaryId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sum_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const stmt1 = env.DB.prepare(
      `INSERT INTO conversation_summaries
         (id, conversation_id, protocol_version, summary_json, source_message_count)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      summaryId,
      conversationId,
      SUMMARY_PROTOCOL_VERSION,
      JSON.stringify(finalSummary),
      sourceMessageCount
    );
    const stmt2 = env.DB.prepare(
      `UPDATE conversations SET summary_message_count = ? WHERE id = ?`
    ).bind(sourceMessageCount, conversationId);

    // 尽量走 batch 减少 D1 往返
    if (typeof env.DB.batch === 'function') {
      await env.DB.batch([stmt1, stmt2]);
    } else {
      await stmt1.run();
      await stmt2.run();
    }
  } catch (err) {
    console.warn('[summary] persist failed:', err?.message || err);
    logToolCall({
      env,
      ctx,
      conversationId,
      userId,
      userRole,
      toolName: 'generate_summary',
      args: { conversationId, source_message_count: sourceMessageCount },
      resultStatus: 'error',
      errorCode: 'db_write_failed',
      latencyMs: Date.now() - started,
    });
    return { ok: false, error: 'db_write_failed' };
  }

  // ------- 7. trace -------
  logToolCall({
    env,
    ctx,
    conversationId,
    userId,
    userRole,
    toolName: 'generate_summary',
    args: {
      conversationId,
      source_message_count: sourceMessageCount,
      fallback: !validation.valid,
    },
    resultStatus: validation.valid ? 'ok' : 'error',
    errorCode: errorCode,
    latencyMs: Date.now() - started,
    resultSize: JSON.stringify(finalSummary).length,
  });

  return {
    ok: true,
    summary_id: summaryId,
    fallback: !validation.valid,
    source_message_count: sourceMessageCount,
  };
}

// ============ 阈值判断（供 handleChat 使用）============

/**
 * 判断是否达到阈值触发摘要（决议 2：策略 B）：
 *   - messages.total >= 6
 *   - 且 messages.total - summary_message_count >= 3
 *
 * @param {{total: number, summaryMessageCount: number}} p
 * @returns {boolean}
 */
export function shouldTriggerSummary({ total, summaryMessageCount }) {
  if (typeof total !== 'number' || total < 6) return false;
  const delta = total - (summaryMessageCount || 0);
  return delta >= 3;
}

// ============ 测试辅助导出（供单元测试使用，非公开 API）============

export const __internals = {
  tryParseJson,
  sanitizeSummary,
  buildFallbackSummary,
  buildSystemPrompt,
  buildUserPrompt,
  CONVERSATION_TYPES,
  PENDING_ITEM_PREFIXES,
  MAX_MESSAGES_FOR_SUMMARY,
};
