#!/usr/bin/env node
// Phase 1.6 — SummaryProtocol v1 存量回填脚本
//
// 用途：
//   对 Phase 1 上线前已经积累的历史对话一次性生成摘要，让 get_conversation_history
//   从 Day 1 就有数据可查。
//
// 使用：
//   cd worker
//   node scripts/migrate_summaries.mjs --env local --dry-run --limit 20
//   node scripts/migrate_summaries.mjs --env production --limit 200
//
// 必填环境变量（非 dry-run 模式下）：
//   OPENAI_API_ENDPOINT   OpenAI 兼容接口
//   OPENAI_API_KEY        API key
//
// 过滤条件：
//   - 消息数 >= 6（与 shouldTriggerSummary 阈值一致）
//   - 当前无 conversation_summaries 记录
//   - conversations.updated_at 在最近 90 天内
//
// 并发：≤ 3，避免打爆 OpenAI 限流。
// 每条摘要估算 600 输出 tokens + 2000 输入 tokens ≈ $0.001，200 条约 $0.2。

import { spawnSync } from 'node:child_process';
import { redactPII } from '../src/lib/redact.js';
import { __internals, SUMMARY_PROTOCOL_VERSION } from '../src/lib/summary.js';

const {
  buildSystemPrompt,
  buildUserPrompt,
  sanitizeSummary,
  tryParseJson,
  buildFallbackSummary,
  MAX_MESSAGES_FOR_SUMMARY,
} = __internals;

// ============ CLI 解析 ============

function parseArgs(argv) {
  const out = { env: 'local', dryRun: false, limit: 100, concurrency: 3 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') out.env = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/migrate_summaries.mjs [options]

  --env         <local|production>  wrangler D1 目标（默认 local）
  --dry-run                         只列出待回填对话，不调用 OpenAI，不写库
  --limit       <N>                 最多处理 N 个对话（默认 100）
  --concurrency <N>                 并行生成数（默认 3，上限建议 5）
  -h, --help                        显示本帮助`);
      process.exit(0);
    }
  }
  if (!['local', 'production'].includes(out.env)) {
    console.error(`--env must be 'local' or 'production' (got: ${out.env})`);
    process.exit(1);
  }
  if (!Number.isFinite(out.limit) || out.limit <= 0) {
    console.error('--limit must be a positive integer');
    process.exit(1);
  }
  if (!Number.isFinite(out.concurrency) || out.concurrency <= 0 || out.concurrency > 10) {
    console.error('--concurrency must be in 1..10');
    process.exit(1);
  }
  return out;
}

// ============ wrangler D1 桥接 ============

// 通过 spawn `wrangler d1 execute` + --json 解析结果
// D1 binding 名称取自 worker/wrangler.toml 的 [[d1_databases]] binding
const D1_BINDING = 'DB';

function runD1(sql, { env, bindings = [] }) {
  const args = [
    'd1',
    'execute',
    D1_BINDING,
    env === 'production' ? '--remote' : '--local',
    '--json',
    '--command',
    sql,
  ];
  // 注意：--param 绑定 wrangler 目前不支持 D1 prepare 参数传递。
  // 当前方案是把 SQL 拼好（所有绑定点都是我们内部构造的安全值，非用户输入）。
  if (bindings.length > 0) {
    throw new Error('bindings not supported; inline values into SQL string');
  }
  const res = spawnSync('npx', ['wrangler', ...args], {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    throw new Error(
      `wrangler failed (status ${res.status}): ${res.stderr || res.stdout}`
    );
  }
  const stdout = res.stdout || '';
  // wrangler 输出有时带前缀文字，取最后一个合法 JSON array / object 块
  const jsonStart = stdout.indexOf('[');
  if (jsonStart < 0) {
    throw new Error(`wrangler output missing JSON: ${stdout.slice(0, 400)}`);
  }
  const parsed = JSON.parse(stdout.slice(jsonStart));
  // parsed 形如 [{results: [...], success: true, meta: {...}}]
  return parsed[0]?.results || [];
}

function escapeSql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

// ============ 主流程 ============

async function callLlmJsonMode({ systemPrompt, userPrompt }) {
  const endpoint = process.env.OPENAI_API_ENDPOINT;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!endpoint || !apiKey) {
    return { ok: false, error: 'missing_api_config' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
    if (!resp.ok) return { ok: false, error: `api_${resp.status}` };
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

function generateSummaryId() {
  return `sum_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function processOne(conv, { env, dryRun }) {
  const convId = conv.id;

  // 拉消息
  const messages = runD1(
    `SELECT id, role, content, created_at FROM messages
      WHERE conversation_id = ${escapeSql(convId)}
      ORDER BY created_at ASC
      LIMIT ${MAX_MESSAGES_FOR_SUMMARY}`,
    { env }
  );

  if (messages.length === 0) {
    return { convId, status: 'skipped', reason: 'no_messages' };
  }

  const userRoleLabel = conv.engineer_id ? '合伙人' : conv.customer_id ? '客户' : '访客';
  const convMeta = {
    id: convId,
    created_at: conv.created_at,
    updated_at: conv.updated_at,
    user_role_label: userRoleLabel,
  };

  const safeMessages = messages.map((m) => ({
    ...m,
    content: redactPII(m.content || ''),
  }));

  if (dryRun) {
    return {
      convId,
      status: 'dry_run',
      messageCount: messages.length,
      userRole: userRoleLabel,
    };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ convMeta, messages: safeMessages });

  let llm = await callLlmJsonMode({ systemPrompt, userPrompt });
  let parsed = llm.ok ? tryParseJson(llm.content) : null;
  let validation = parsed ? sanitizeSummary(parsed) : { valid: false };

  if (!validation.valid) {
    llm = await callLlmJsonMode({ systemPrompt, userPrompt });
    parsed = llm.ok ? tryParseJson(llm.content) : null;
    validation = parsed ? sanitizeSummary(parsed) : { valid: false };
  }

  let finalSummary;
  let errorCode = null;
  if (validation.valid) {
    finalSummary = {
      ...validation.sanitized,
      generated_at: new Date().toISOString(),
      source_message_count: messages.length,
    };
  } else {
    errorCode = llm.ok ? 'json_parse_failed' : llm.error;
    const previewText = safeMessages.slice(-6).map((m) => m.content).join(' | ');
    finalSummary = buildFallbackSummary({
      previewText,
      errorCode,
      sourceMessageCount: messages.length,
    });
  }

  // 写入
  const summaryId = generateSummaryId();
  const summaryJson = JSON.stringify(finalSummary);

  runD1(
    `INSERT INTO conversation_summaries
       (id, conversation_id, protocol_version, summary_json, source_message_count)
     VALUES (
       ${escapeSql(summaryId)},
       ${escapeSql(convId)},
       ${SUMMARY_PROTOCOL_VERSION},
       ${escapeSql(summaryJson)},
       ${messages.length}
     )`,
    { env }
  );

  runD1(
    `UPDATE conversations SET summary_message_count = ${messages.length}
      WHERE id = ${escapeSql(convId)}`,
    { env }
  );

  return {
    convId,
    status: 'ok',
    fallback: !validation.valid,
    errorCode,
    summaryId,
    messageCount: messages.length,
  };
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await worker(items[i]);
      } catch (err) {
        results[i] = { convId: items[i]?.id, status: 'crash', reason: err?.message || String(err) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const opts = parseArgs(process.argv);

  console.log(`[migrate_summaries] env=${opts.env} dry_run=${opts.dryRun} limit=${opts.limit} concurrency=${opts.concurrency}`);

  if (!opts.dryRun && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_ENDPOINT)) {
    console.error('OPENAI_API_ENDPOINT 和 OPENAI_API_KEY 必须在非 dry-run 模式下设置');
    process.exit(1);
  }

  // Step 1: 查候选对话
  //   - 消息数 >= 6
  //   - 无现有 conversation_summaries
  //   - conversations.updated_at >= 90 天内
  const candidatesSql = `
    SELECT c.id, c.customer_id, c.engineer_id, c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS msg_count
      FROM conversations c
     WHERE NOT EXISTS (SELECT 1 FROM conversation_summaries s WHERE s.conversation_id = c.id)
       AND c.updated_at >= datetime('now', '-90 days')
       AND (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) >= 6
     ORDER BY c.updated_at DESC
     LIMIT ${opts.limit}
  `.replace(/\s+/g, ' ').trim();

  console.log('[migrate_summaries] querying candidates...');
  const candidates = runD1(candidatesSql, { env: opts.env });
  console.log(`[migrate_summaries] found ${candidates.length} candidates`);

  if (candidates.length === 0) {
    console.log('[migrate_summaries] nothing to do');
    return;
  }

  // 成本粗估：每个对话一次 LLM 调用 + 一次 retry 最坏情况 = 2 calls
  // gpt-4o-mini 输入 $0.15/M token，输出 $0.60/M token
  // 每次 ≈ 2000 input + 600 output ≈ $0.00066
  const estCostUsd = (candidates.length * 0.00066).toFixed(3);
  console.log(`[migrate_summaries] estimated cost (best-case, no retries): ~$${estCostUsd}`);

  if (opts.dryRun) {
    console.log('[migrate_summaries] DRY RUN — listing candidates only:');
    for (const c of candidates.slice(0, 20)) {
      console.log(
        `  - ${c.id} | ${c.customer_id ? 'customer' : c.engineer_id ? 'engineer' : 'guest'} | msgs=${c.msg_count} | updated=${c.updated_at}`
      );
    }
    if (candidates.length > 20) console.log(`  ... (${candidates.length - 20} more)`);
    return;
  }

  // Step 2: 并发处理
  console.log(`[migrate_summaries] processing ${candidates.length} conversations with concurrency=${opts.concurrency}...`);

  const started = Date.now();
  const results = await runPool(candidates, opts.concurrency, (conv) =>
    processOne(conv, { env: opts.env, dryRun: false })
  );

  // Step 3: 汇总
  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    if (r.fallback) acc.fallback = (acc.fallback || 0) + 1;
    return acc;
  }, {});

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log(`[migrate_summaries] done in ${elapsed}s`);
  console.log('  by status:', summary);

  const errors = results.filter((r) => r.status === 'crash');
  if (errors.length > 0) {
    console.log('  crashes:');
    for (const e of errors.slice(0, 10)) {
      console.log(`    ${e.convId}: ${e.reason}`);
    }
  }
}

main().catch((err) => {
  console.error('[migrate_summaries] fatal:', err);
  process.exit(2);
});
