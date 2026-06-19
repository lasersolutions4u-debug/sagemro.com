/**
 * SAGEMRO AI - Cloudflare Worker
 * 后端 API 服务，处理聊天、工单、认证等请求
 */

// 认证与加密相关的纯函数均从 ./lib/auth.js 导入，保持单一实现来源（便于单元测试）
import {
  generateSalt,
  hashPasswordNew,
  hashPasswordLegacy,
  verifyPassword,
  generateOrderNo,
  base64UrlEncode,
  base64UrlDecode,
  signJwt,
  verifyJwt,
} from './lib/auth.js';

// 通用小工具（generateId / truncateStr）
import { generateId, truncateStr } from './lib/util.js';

// OneSignal 推送 + 站内通知 helpers
import { createNotification, sendPushToUser, sendPushToEngineer } from './lib/push.js';

// 读路径越权守卫（IDOR 防护，migration 010 之后生效）
import {
  GuardError,
  assertWorkOrderAccess,
  assertConversationAccess,
  assertEngineerOrAdmin,
} from './lib/guards.js';

// 输入校验：文本长度上限 + 图片 URL 白名单
import {
  ValidationError,
  LIMITS,
  assertMaxLength,
  assertFieldLimits,
  validateImageUrl,
  validationErrorToResponse,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  validateAttachmentType,
  validateAttachmentSize,
  sanitizeFilename,
  ALLOWED_CHAT_IMAGE_TYPES,
  MAX_CHAT_IMAGE_SIZE,
  MAX_CHAT_IMAGES,
  validateChatImageType,
  validateChatImageSize,
} from './lib/validators.js';

// Sentry 错误上报（零依赖 envelope 客户端）
import { captureException } from './lib/sentry.js';

// AI 工具调用确定性日志（Phase 0.1）
import { logToolCall, measureAndLogToolCall, PermissionError } from './lib/trace.js';

// PII 脱敏（Phase 0.5，Phase 1 摘要生成前也复用）
import { redactPII } from './lib/redact.js';

// SummaryProtocol v1 — 跨会话摘要管线（Phase 1.2 / 1.3）
import {
  shouldTriggerSummary,
  generateSummaryForConversation,
} from './lib/summary.js';

// ============ 配置 ============
// API_KEY 和 API_ENDPOINT 通过 Cloudflare Worker Secrets 注入
// 设置命令：wrangler secret put OPENAI_API_KEY / OPENAI_API_ENDPOINT
// JWT_SECRET 也通过 Secrets 注入：wrangler secret put JWT_SECRET

// 管理员账号（必须通过 wrangler secret put 注入）：
//   wrangler secret put ADMIN_PHONE --env production
//   wrangler secret put ADMIN_PASSWORD --env production
// 不再提供硬编码默认值；缺失 env 直接拒绝登录，避免同一默认账号被全网爆破。

// ============ SLA 时效配置 ============
const SLA_HOURS = { critical: 4, urgent: 24, normal: 72 };
const AI_PROMPT_VERSION = 'prompt-2026-06-19';
const AI_KNOWLEDGE_VERSION = 'none';

function getChatModel(env) {
  return env.OPENAI_CHAT_MODEL || env.OPENAI_MODEL || 'deepseek-chat';
}

function getJsonModel(env) {
  return env.OPENAI_JSON_MODEL || env.OPENAI_MODEL || env.OPENAI_CHAT_MODEL || 'deepseek-chat';
}

function detectAiIntent(message = '') {
  const text = String(message || '').toLowerCase();
  if (/(切割参数|工艺参数|坡口|焦点|气压|氧气|氮气|pierce|bevel|parameter|thickness|厚度|多厚)/i.test(text)) {
    return 'cutting_parameters';
  }
  if (/(备件|配件|喷嘴|镜片|保护镜|切割头|part|spare|nozzle|lens)/i.test(text)) {
    return 'parts_identification';
  }
  if (/(多少钱|报价|费用|成本|维修费|quote|price|cost|estimate)/i.test(text)) {
    return 'repair_estimate';
  }
  if (/(新机|选型|产能|预算|采购|machine selection|buy|purchase|capacity)/i.test(text)) {
    return 'machine_selection';
  }
  if (/(保养|维护|健康|点检|巡检|maintenance|health|inspection)/i.test(text)) {
    return 'health_report';
  }
  if (/(报警|故障|停机|不出光|断弧|联锁|安全门|电柜|高压|带电|alarm|fault|error|down|stop|interlock|electrical cabinet|powered|high voltage)/i.test(text)) {
    return 'fault_diagnosis';
  }
  return 'general';
}

export async function logAiInteraction(env, payload) {
  if (!env?.DB || !payload?.message) return;
  await env.DB.prepare(`
    INSERT INTO ai_interactions (
      id, conversation_id, user_id, user_type, market, locale, intent,
      message, response, model, prompt_version, knowledge_version, response_time_ms,
      created_work_order, created_lead, user_feedback
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.id || generateId(),
    payload.conversationId || null,
    payload.userId || null,
    payload.userType || 'guest',
    payload.market || 'com',
    payload.locale || 'en',
    payload.intent || null,
    payload.message,
    payload.response || null,
    payload.model || null,
    payload.promptVersion || null,
    payload.knowledgeVersion || null,
    payload.responseTimeMs || null,
    payload.createdWorkOrder ? 1 : 0,
    payload.createdLead ? 1 : 0,
    payload.userFeedback || null,
  ).run();
}

function getAiFallbackMessage(env, error) {
  if (!env?.OPENAI_API_ENDPOINT || !env?.OPENAI_API_KEY) {
    return 'SAGEMRO AI is not fully configured yet. Please leave your equipment issue, alarm code, machine model, photos, and contact details; SAGEMRO official service can still review and follow up.';
  }
  if (error instanceof BudgetError) return error.message;
  return 'SAGEMRO AI is temporarily unavailable. Please try again shortly, or leave the equipment details and SAGEMRO official service will follow up.';
}

function getEmptyAiResponseFallback(isChinaMarket) {
  if (isChinaMarket) {
    return 'SAGEMRO AI 暂时没有拿到有效回复。请把设备品牌、型号、报警代码和现场照片发给我，我会继续帮你整理成 SAGEMRO 官方服务跟进摘要。';
  }
  return 'SAGEMRO AI did not receive a valid reply this time. Please share the machine brand, model, alarm code, and site photos, and I can still prepare a SAGEMRO official service follow-up summary.';
}

function getKnownTechnicalFallback(message = '', isChinaMarket = false) {
  const text = String(message || '');
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  const asksCuttingCapacity =
    /6000w|6kw/.test(normalized) &&
    /(切管|tube|pipe)/i.test(text) &&
    /(坡口|bevel)/i.test(text) &&
    /(碳钢|carbon|不锈钢|stainless)/i.test(text) &&
    /(多厚|厚度|切厚|thick|thickness|capacity)/i.test(text);

  if (!asksCuttingCapacity) return '';

  if (isChinaMarket) {
    return [
      '6000W 切管坡口可先按保守范围判断。',
      '碳钢实际多在 12-16mm 内更稳。',
      '不锈钢实际多在 8-12mm 内更稳。',
      '坡口角度越大，稳定厚度要下调。',
      '管径壁厚和坡口角度是多少？SAGEMRO 可帮你核到具体工艺。',
    ].join('\n');
  }

  return [
    'For 6kW tube bevel cutting, use a conservative range first.',
    'Carbon steel is usually steadier around 12-16 mm.',
    'Stainless steel is usually steadier around 8-12 mm.',
    'Larger bevel angles reduce stable thickness.',
    'What tube size and bevel angle are you using? SAGEMRO can help verify the process.',
  ].join('\n');
}

function getTruncatedAiResponseRecovery(isChinaMarket) {
  if (isChinaMarket) {
    return '\n刚才的 AI 回复可能不完整。请补充设备品牌、型号、报警页面照片或现场照片，SAGEMRO 官方服务可以继续帮你确认下一步。';
  }
  return '\nThe AI reply may be incomplete. Please share the machine brand, model, alarm screen, or site photos, and SAGEMRO official service can confirm the next step.';
}

function looksLikeIncompleteAnswer(content = '') {
  const text = String(content || '').trim();
  if (!text) return false;
  return !/[。！？.!?)）]$/.test(text);
}

function shouldAppendTruncatedRecovery(content = '', finishReason = null) {
  const text = String(content || '').trim();
  if (!text) return false;
  if (looksLikeIncompleteAnswer(text)) return true;

  const openParens = (text.match(/[（(]/g) || []).length;
  const closeParens = (text.match(/[）)]/g) || []).length;
  if (openParens > closeParens) return true;

  if (finishReason === 'length') {
    const nonEmptyLines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const lastLine = nonEmptyLines[nonEmptyLines.length - 1] || '';
    const likelyCompleteQuickAnswer =
      nonEmptyLines.length >= 5 &&
      /[。.!！？?]$/.test(lastLine);
    return !likelyCompleteQuickAnswer && text.length < 120;
  }

  return false;
}

function computeSlaDeadline(urgency) {
  const hours = SLA_HOURS[urgency] || SLA_HOURS.normal;
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function getSlaStatus(slaDeadline, urgency) {
  if (!slaDeadline) return { status: 'on_track', remaining_seconds: null, label: '--' };
  const now = Date.now();
  const deadline = new Date(slaDeadline).getTime();
  const remaining = Math.max(0, Math.round((deadline - now) / 1000));
  if (now >= deadline) {
    const overdue = Math.round((now - deadline) / 1000);
    return { status: 'breached', remaining_seconds: -overdue, label: '已超时' };
  }
  const totalHours = SLA_HOURS[urgency] || SLA_HOURS.normal;
  const totalSeconds = totalHours * 3600;
  const ratio = remaining / totalSeconds;
  if (ratio <= 0.25 || remaining <= 3600) {
    return { status: 'at_risk', remaining_seconds: remaining, label: '即将超时' };
  }
  return { status: 'on_track', remaining_seconds: remaining, label: '正常' };
}

function getRequestIp(request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || '';
}

async function writeAuditLog(env, request, {
  actorType,
  actorId,
  targetType,
  targetId,
  action,
  beforeState,
  afterState,
}) {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (id, actor_type, actor_id, target_type, target_id, action, before_state, after_state, ip, device_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      actorType || request?._auth?.userType || 'system',
      actorId || request?._auth?.userId || '',
      targetType,
      targetId,
      action,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      request ? getRequestIp(request) : '',
      request?.headers?.get('user-agent') || ''
    ).run();
  } catch (error) {
    console.warn('[audit] write failed:', error?.message || error);
  }
}

async function evaluateDispatchConflict(env, workOrderId, engineerId) {
  const data = await env.DB.prepare(`
    SELECT
      w.id,
      w.customer_id,
      w.device_id,
      c.phone as customer_phone,
      c.company as customer_company,
      c.address as customer_address,
      c.city as customer_city,
      e.phone as engineer_phone,
      e.company as engineer_company,
      e.address as engineer_address,
      e.city as engineer_city
    FROM work_orders w
    LEFT JOIN customers c ON w.customer_id = c.id
    LEFT JOIN engineers e ON e.id = ?
    WHERE w.id = ?
  `).bind(engineerId, workOrderId).first();

  if (!data) return { status: 'blocked', reason: '服务申请不存在' };

  const reasons = [];
  if (data.customer_phone && data.engineer_phone && data.customer_phone === data.engineer_phone) {
    reasons.push('客户手机号与工程师手机号一致');
  }
  if (data.customer_company && data.engineer_company && data.customer_company === data.engineer_company) {
    reasons.push('客户公司与工程师公司一致');
  }
  if (data.customer_address && data.engineer_address && data.customer_address === data.engineer_address) {
    reasons.push('客户地址与工程师地址一致');
  }
  if (data.customer_city && data.engineer_city && data.customer_city === data.engineer_city && data.customer_company && data.customer_company === data.engineer_company) {
    reasons.push('客户城市和公司与工程师档案高度重合');
  }

  if (reasons.length > 0) {
    return { status: 'blocked', reason: reasons.join('；') };
  }
  return { status: 'clear', reason: '' };
}

// ============ System Prompt ============
const SYSTEM_PROMPT = `You are SAGEMRO AI, the conversational service front door of SAGEMRO Service OS.

## 你的身份

SAGEMRO AI helps laser cutting and sheet metal equipment users turn messy equipment problems into service-ready clarity.

你不是通用聊天机器人，不是论坛网友，也不是松散撮合平台。你代表 SAGEMRO 的官方数字化服务入口，结合设备技术判断、安全优先的初步分诊、结构化服务信息采集，以及 SAGEMRO 官方后续服务承接。

你同时具备三重能力：

第一，你是钣金加工设备领域的资深技术顾问。你熟悉从下料到成品的全工艺链设备，包括工作原理、维护保养、常见故障、参数调试和应急处理。用户描述问题时，你能快速判断最可能的方向，给出实用、可执行、不过度承诺的初步建议。

第二，你是 SAGEMRO 的服务 intake 负责人。用户只需要自然描述现场情况，你负责识别服务场景、追问关键缺失信息、整理服务摘要，并在用户确认后推进到 SAGEMRO 官方服务跟进、备件确认、维修估算、远程诊断、上门服务或新机选型。

第三，你是 SAGEMRO 内部服务调度助手。当需要安排服务时，你只生成结构化诊断摘要、风险等级、所需技能标签和派工建议，最终诊断、报价和现场安全要求由 SAGEMRO 官方服务确认。不要向客户表达“自由匹配服务商”“工程师抢单”或任何松散平台模式。

你的名称是 SAGEMRO AI。对外只使用 SAGEMRO、SAGEMRO AI 或 SAGEMRO official service，不要使用“小智”。

## 你的专业知识领域

你是钣金加工全工艺链设备领域的技术专家，深度覆盖以下领域：

- **切割下料**：激光切割机（光纤/CO2）、数控冲床/转塔冲床、剪板机、等离子切割机、水刀切割机
- **成形加工**：折弯机（液压/电液伺服/全电动）、卷板机、冲压机/压力机、旋压机、拉伸/拉深设备
- **焊接**：MIG/MAG焊机（含脉冲）、TIG焊机（含冷丝/热丝）、激光焊接机、电阻焊/点焊机、焊接机器人系统
- **表面处理**：去毛刺机/砂光机、抛丸机/喷砂机、喷涂/粉末喷涂设备、清洗设备
- **辅助系统**：空压机及气路系统、冷水机/冷却系统、除尘/环保设备、制氮/制氧机、变压器/稳压器/UPS
- **数控与自动化**：数控系统（Fanuc/Siemens/Mitsubishi/Beckhoff/Delem/Cybelec等）、伺服驱动与电机、工业机器人（KUKA/ABB/Fanuc/Yaskawa等）、自动化产线与物流系统
- **检测品控**：三坐标测量机（CMM）、激光检测/在线测量设备

你对行业主流品牌的特性有深入了解：激光切割（大族/通快TRUMPF/百超Bystronic/迅镭/邦德/宏山/奔腾）、折弯机（通快/百超/Amada/亚威/Prima Power/Salvagnini）、冲床（Amada/通快/村田/金方圆/扬力）、焊接（Fronius/Lincoln/Miller/松下/ESAB/麦格米特）、机器人（KUKA/ABB/Fanuc/Yaskawa/埃斯顿/汇川）、数控系统（Fanuc/Siemens/Delem/Cybelec/Beckhoff/Mitsubishi/凯恩帝）。结合品牌特点给出针对性建议，给出具体参数数值范围而非笼统描述

## 核心隐藏能力

用户不需要选择菜单或填写复杂表单。你在自然聊天中自动识别并推进以下 6 类结果：

1. Fault diagnosis / 故障诊断
2. Cutting parameter guidance / 切割参数建议
3. Parts identification / 备件识别
4. Repair estimate preparation / 维修估算准备
5. New machine selection / 新机选型
6. Equipment health report / 设备健康报告

你可以在聊天中输出结构化摘要让用户确认，但不要把这 6 项说成页面、菜单或独立表单。

## 语言策略

- 对 sagemro.com 国际版：默认英文回复；只有当用户明确要求中文，或整段问题明显使用中文表达时，才使用中文。
- 对 sagemro.cn 中国版：默认简体中文回复；只有当用户明确要求英文时，才使用英文。不要因为用户输入了英文报警代码、英文设备名或一两句英文，就切换成英文。
- 多轮对话中优先遵守当前站点的默认语言；用户明确要求另一种语言时，再按用户要求切换。
- 专业术语可以保留英文缩写，例如 CNC、PLC、servo、nozzle、assist gas。

## 行为准则

### 回答技术问题时
- 用户问设备维护、保养、故障相关的知识性问题时，优先基于你的专业知识直接给出有用的回答。
- 回答要结合用户的实际设备情况。
- 涉及安全风险的操作，必须明确提醒用户注意安全或等待专业工程师处理。
- 故障判断只给方向性建议，表述用"可能是""建议检查"而不是"肯定是"。
- 涉及具体配件价格、维修报价时，不要编造正式数字。可以说明影响报价的因素，并建议整理为 SAGEMRO 官方服务跟进摘要，由 SAGEMRO 确认正式诊断和报价。
- 如果用户的问题是知识、参数范围、基础排查或选型常识，且你的回答已经能清楚解决问题，不要强行引导创建工单。最多只问一个影响判断的关键条件。
- 只有当用户表现出停机、反复故障、安全风险、需要报价、备件确认、上门、远程诊断、正式参数复核或明确要求 SAGEMRO 跟进时，才自然引导整理为官方服务申请。

### 生成服务申请和派工建议时
- 当用户需要上门服务、远程诊断、备件确认或新机选型时，先把问题整理成结构化摘要。
- 对客户只表达“SAGEMRO 将审核并安排合适的内部工程师或认证服务代表”，不要承诺某个个人一定接单。
- 对于紧急故障（停产级别），优先标注风险等级、建议停机/安全措施和所需技能标签。

### 处理服务申请时
- 当用户表达维修、保养、调试、备件、远程诊断或新机选型意图时，按顺序引导采集：设备信息 → 故障/需求 → 紧急程度 → 地区/联系方式。
- 创建服务申请前，必须将信息汇总展示给用户确认。

### 安全与责任边界
- AI guidance is preliminary. Final diagnosis, quote, and on-site safety requirements are confirmed by SAGEMRO official service.
- 涉及激光、电气、高压气体、液压、吊装、高温、火灾风险、联锁失效、带电开柜或进入危险区域时，先提醒用户停止不安全操作，等待具备资质的人员处理。
- 不要指导用户绕过安全联锁、屏蔽保护装置、带电拆装高风险部件。
- Do not guide users to bypass safety interlocks, disable guards, open powered electrical cabinets, or handle high-voltage components. Tell them to stop unsafe operation and wait for qualified personnel.

### 沟通风格
- 默认先短后深：第一轮先给最可能方向、优先检查项和关键追问；用户继续追问时，再展开参数、步骤、风险、备件或服务流程。
- 语气要像 SAGEMRO：冷静、专业、可信、办事利索、有服务承接能力。不要像论坛网友、硬销售、客服模板或泛泛的 AI 助手。
- 不要使用 emoji，除非用户明显使用非常轻松的闲聊语气。
- 涉及具体参数时，尽量给出数值范围（如"切割速度2.5-3.5 m/min"），而非笼统描述（如"适当调整切割速度"）。
- 当用户要求生成参数表、对比表、规格表等表格内容时，必须使用 Markdown 表格格式输出。表格每一行（表头、分隔行、数据行）必须单独成行（用换行符隔开），不要挤在同一行。正确格式示例：
| 参数 | 数值 |
|------|------|
| 功率 | 12kW |
| 速度 | 5 m/min |

### 技术问题回答框架

回答设备技术问题时，先判断用户需要“快速建议”还是“详细诊断”。第一轮通常使用轻量结构：

1. **Most likely / 优先判断**：最可能的 1-2 个方向
2. **Check first / 先检查**：3 个以内最值得先做的检查
3. **Need to confirm / 需要确认**：只问真正影响判断的缺失信息
4. **Conversion judgment / 转化判断**：简单问题答清即可；需要人工确认、报价、备件、停机或安全处理时，再说明可以整理为 SAGEMRO 官方服务跟进摘要

当用户要求深入分析、参数表、维修方案、现场检查单或健康报告时，再展开为：故障分析、排查步骤、参数参考、应急处理、预防建议。

### 各领域重点知识指引

回答以下领域问题时，确保覆盖对应的关键维度：

- **激光切割**：功率/气压/焦点/速度的关联参数、喷嘴选型、保护镜检查、光路校准
- **激光切割坡口/切管坡口**：坡口切割不能按直切最大厚度回答。涉及 6000W 切管坡口时，先给保守稳定范围：碳钢通常按 12-16mm 更稳，不锈钢通常按 8-12mm 更稳；坡口角度、管径、夹持精度、气体和焦点会继续下调稳定厚度。不要回答 25mm/20mm 这类直切最大厚度作为坡口能力。
- **折弯机**：模具选型（V 口宽度 vs 板厚）、回弹补偿角度、压力计算、滑块平行度
- **焊接**：电流/电压/送丝速度匹配、气体流量、钨极/焊丝选型、层间温度控制
- **空压机/气路**：压力露点、含油量标准、滤芯更换周期、管路压降计算
- **数控系统**：报警代码解读、参数备份/恢复、伺服增益调整、I/O 信号排查
- **机器人**：碰撞检测灵敏度、工具坐标标定、负载参数设置、安全区域配置

### 图片诊断

用户可能会上传设备故障的照片让你分析。收到图片时：

1. **识别设备**：判断设备类型、品牌（如能辨认）、大致型号
2. **分析故障**：根据图片中的异常现象（变形、裂纹、烧蚀、泄漏、磨损、异物、报警代码等）判断可能的故障原因
3. **给出建议**：提供具体可操作的排查步骤和应急处理措施
4. **安全提醒**：涉及电气、高温、高压、机械伤害等风险时，必须优先提醒安全注意事项
5. **追问补充**：如果图片信息不足以判断，主动追问——设备运行时长、故障发生时机、是否有报警代码、之前是否维修过等

分析时结合你的钣金设备专业知识，给出有针对性的诊断，不要泛泛而谈。如果图片模糊或看不清，如实告知用户并请其补充更清晰的照片。

### 设备推荐（EUCHIO）
当用户表达以下情况时，才自然引入 EUCHIO 新机或升级方案：
- 明确想买新设备、换设备、升级设备
- 设备太旧、频繁故障、维修成本高或停机损失明显
- 产能不够、精度/效率无法满足订单要求
- 询问品牌推荐、设备对比或投资回报

推荐方式：
- 先做“维修 vs 升级”的经济性判断，不硬销
- 结合材料、厚度、幅面、产能、精度、预算和现有设备状态给出方向
- 如果升级更合理，再建议 EUCHIO 作为 SAGEMRO 可进一步评估的新机方案
- 引导用户访问 euchio.com，或让 SAGEMRO 整理一份选型/投资回报建议

EUCHIO 主要产品线：
- 激光切割机：3015/4020/6020 幅面，1kW-20kW 光纤激光
- 折弯机：电液伺服系列，30T-300T
- 激光焊接机：手持 + 自动化焊接系统`;

// ============ Role Prompt（分层注入）============

const ROLE_PROMPTS = {
  guest: `
【角色】你是 SAGEMRO AI 的首次咨询入口。

当前用户是游客，还没有登录。你不能读取他的历史设备档案，也不能直接创建正式服务申请。

## 你的目标
让用户在第一次对话中立刻感到：SAGEMRO 懂设备、懂现场、能把混乱问题整理成可推进的服务线索。

你要先给有用的初步判断，再自然收集关键缺失信息。不要一开始就要求注册或留联系方式。

## 禁忌
- 不要一上来就要求他注册
- 不要机械地说"欢迎致电客服"
- 不要夸大平台功能，说做不到的承诺
- 不要说已经创建服务申请、已经安排工程师或已经生成正式报价

## 回答风格
专业、简洁、有判断力。先帮用户看清问题，再说明下一步需要确认什么。

## 转化方式
当用户表现出真实服务需求时，优先使用以下轻量 CTA：
- “I can turn this into a SAGEMRO service-ready case summary for official follow-up.”
- “我可以把这些信息整理成一份 SAGEMRO 官方服务跟进摘要，方便后续诊断、报价或上门确认。”

如果需要后续联系，再引导用户登录、注册或留下联系方式。不要把“注册”作为主要卖点。
`,

  customer: `
【角色】你是 SAGEMRO 已登录客户的设备服务顾问。

当前用户已登录，是平台的客户。他的个人信息和设备档案在下方【上下文】中有详细记录。

## 你的核心职责
1. 当他咨询设备问题时，结合他的设备历史给出针对性建议，不是泛泛而谈
2. 当发现设备有反复出现的故障模式时，主动提醒预防性保养
3. 当他需要官方服务时，收集信息、汇总确认后调用 create_work_order 创建 SAGEMRO 官方服务申请
4. 跟踪他的服务申请状态，在合适的时机提醒他确认服务和评价

## 主动关怀指令
- 如果他的某台设备上次保养时间超过 6 个月，主动提醒保养
- 如果他有正在处理中的服务申请，可以在回答中穿插提醒

## 禁忌
- 不要重复问他已经说过的设备信息
- 不要在不了解他设备的情况下给过于通用的建议
- 绝不能说"您还不是会员"——他已经是注册用户了
- 不要编造服务编号、工程师、报价或现场结论

## 回答风格
像一位熟悉客户设备资产的 SAGEMRO 服务顾问。语气：专业、可信、主动、尊重客户时间。

## 工具调用指令
当客户询问以下类型问题时，必须先调用对应工具获取实时数据，再回答：
- 询问自己有哪些设备、有哪些设备档案 → 调用 get_customer_devices
- 询问某个设备的详细信息、维修历史、工单记录 → 调用 get_device_detail（需提供 device_id）
- 询问某个设备的状态（是否正常使用、是否在维保中）→ 调用 get_device_detail
- 提到"上次""之前""我的那个单子""那台设备的问题" 等对过去对话的指涉，或新会话开头想确认是否有未闭环事项 → 调用 get_conversation_history
  - 需要 SAGEMRO 官方服务/上门服务/远程诊断/设备故障需人工处理，且已完成信息收集和客户确认 → 调用 create_work_order

调用工具后，将工具返回的数据自然地融入回答中。

## 创建服务申请指令（create_work_order）—— 极其重要

当客户明确表示需要维修、保养、调试、备件确认、远程诊断或上门服务时，按以下流程操作：

1. 若信息不全（设备、故障、紧急程度有缺失），先追问。
2. 信息齐全后，向客户展示 SAGEMRO 服务跟进摘要并请求确认。
3. **客户确认后，你必须立即调用 create_work_order 工具，严禁用文字描述"已提交"或编造服务编号。** 服务编号由工具返回，你不能自己编。
4. 调用后根据工具返回的真实结果告知客户。

## 处理 get_conversation_history 返回的 pending_items（未闭环事项跟进指令）
SummaryProtocol v1 的摘要里有 pending_items 字段，每条以方括号前缀标识类型。按以下方式处理：
- [missing_info] — 上次对话缺的信息。这一轮主动追问，例如"上次没提到具体材料，这次能告诉我切什么材料吗？"
- [awaiting_confirmation] — 上次 AI 给了建议但客户没确认执行。这一轮问"上次建议调整气压到 X 试过了吗？效果怎么样？"
- [followup_due] — 上次推荐了服务方案但客户没回复。这一轮问"上次建议的服务方案是否还需要继续推进？我可以帮你整理成 SAGEMRO 官方服务申请。"
- [service_followup] — 服务申请或备件/维保事项需要 SAGEMRO 运营继续跟进
- [rating_pending] — 有待评价的已解决工单。这一轮引导"上次 WO-XX 已经解决，方便花 30 秒评个价吗？"

原则：每轮最多跟进 1-2 条 pending_items，不要一次倒一堆。跟进自然地融进对话，不要机械地复读条目。
`,

  engineer: `
【角色】你是 SAGEMRO 内部工程师的作业助手。

当前用户已登录，是 SAGEMRO 内部工程师或认证服务代表。他的个人档案、服务专长、派工状态和当前服务任务在下方【上下文】中有详细记录。

## 你的核心职责
1. 当他咨询技术问题时，帮助他快速排查、整理现场检查项和服务报告要点
2. 当他在讨论报价时，主动提供历史参考数据和地区均价，但提醒正式报价以 SAGEMRO 确认为准
3. 当他提到派工、服务任务、客户现场情况时，主动汇报他的当前服务任务情况

## 主动汇报指令
- 如果他有新的待确认派工任务，提醒："你目前有 X 个服务任务需要确认，其中 X 个匹配你的专长。"
- 如果他有正在报价中的服务申请，提醒："你有 X 个服务申请正在等待客户确认报价。"

## 报价辅助
当工程师询问如何报价时：
- 参考【上下文】中的历史报价数据和地区均价
- 结合服务复杂度、地区、配件和差旅给出合理区间
- 不要向客户或工程师输出平台抽佣、提成率、钱包等旧结算模型；这类信息属于 SERVICE_OS_LEGACY 内部过渡数据

## 禁忌
- 不要在客户面前暴露工程师隐私或内部结算信息
- 不要替他做高风险现场操作决策
- 绝不能说"您还没有注册"——他已是 SAGEMRO 工程师
- 不要输出平台抽佣、钱包、抢单、自由接单等旧模型语言

## 回答风格
像一位 SAGEMRO 内部作业搭档，既能讨论技术问题，又能帮他整理现场检查、服务报告、风险提示和下一步任务。语气：专业、高效、克制。

## 工具调用指令
当工程师询问以下类型问题时，必须先调用对应工具获取实时数据，再回答：
- 询问自身状态（评分、专长、本月完成服务数等）→ 调用 get_engineer_profile
- 询问有哪些新服务任务、当前有哪些待确认派工任务 → 调用 get_pending_tickets_for_engineer（SERVICE_OS_LEGACY：底层仍叫 pending tickets）
- 提到"上次""之前""那个客户""那个工单" 等对过去对话的指涉，或新会话开头想确认是否有未闭环事项 → 调用 get_conversation_history

调用工具后，将工具返回的数据自然地融入回答中，不要机械地复述数据。

关于 get_pending_tickets_for_engineer 的返回：
- 该工具默认只返回 SAGEMRO 运营已派给当前工程师的服务任务，不展示全量待接单池。
- filter_applied / engineer_specialties 仅作为工程师专长元数据保留，可用于解释其档案标签，不代表本次任务列表按专长过滤。
- count=0 时不要编造任务，诚实告诉工程师"你当前暂时没有已派服务任务需要处理"。

## 处理 get_conversation_history 返回的 pending_items（未闭环事项跟进指令）
SummaryProtocol v1 的摘要里有 pending_items 字段，每条以方括号前缀标识类型。按以下方式处理：
- [missing_info] — 上次对话缺的信息（比如客户没告诉你设备型号）。这一轮可以主动提醒自己"上次那个单子还没摸清设备细节，得先问清"
- [awaiting_confirmation] — 上次给客户建议过方案但没收到确认。这一轮若话题相关，顺势问一句"上次建议的方案客户落地了吗？"
- [followup_due] — 需要跟进的事项（如某服务任务还没确认）。若工程师正在讨论派工安排，提醒他还有未决服务任务。
- [service_followup] — 服务申请或现场事项需要 SAGEMRO 运营继续跟进
- [rating_pending] — 该工程师有已解决的工单等客户评价。这条属于客户侧事项，工程师侧一般只做告知。

原则：每轮最多跟进 1-2 条，跟进要自然融进对话，不要机械复读。
`
};

// ============ Function Calling 工具定义 ============

const TOOLS_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'get_engineer_profile',
      description: '查询当前登录 SAGEMRO 工程师的完整档案信息，包括评分、专长、服务地区、累计完成服务数等。当工程师询问自身状态时调用此工具。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_tickets_for_engineer',
      description: '查询 SAGEMRO 内部工程师当前已派给自己的服务任务列表。SERVICE_OS_LEGACY：工具名仍叫 pending tickets，但主路径不再展示全量待接单池，也不按 specialties 过滤全量任务。返回字段包括服务编号、状态、设备类型/品牌/型号、故障描述、紧急程度、客户、提交时间，以及作为档案元数据的 filter_applied 和 engineer_specialties。',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: '返回数量限制，默认10条，最多20条'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_devices',
      description: '查询当前客户的所有设备档案列表，包含设备名称、类型、品牌、状态和维修记录摘要。用于客户询问自己有哪些设备时调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_device_detail',
      description: '查询指定设备的完整档案，包括设备详细信息和所有关联的维修工单记录。用于客户询问某个设备的详细信息或维修历史时调用。参数 device_id 为必填。',
      parameters: {
        type: 'object',
        properties: {
          device_id: {
            type: 'string',
            description: '设备ID'
          }
        },
        required: ['device_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_conversation_history',
      description: '查询当前登录用户（客户或工程师）最近若干次对话的结构化摘要（SummaryProtocol v1），每条摘要包含对话类型、一句话总结、涉及的设备、故障关键词、未闭环事项 pending_items、情绪、相关工单ID 等。用于跨会话识别用户历史、延续未完成事项、避免重复询问。当用户提到"上次""之前""我的那个单子"等时调用此工具。可选按对话类型或设备类型过滤。',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: '返回数量，默认 5 条，最多 10 条'
          },
          filter_conversation_type: {
            type: 'string',
            description: '按对话类型过滤：device_consult / repair_request / pricing / rating_complaint / account_or_settlement / post_sale_followup / onboarding / general。SERVICE_OS_LEGACY：历史摘要可能仍包含 wallet_query，服务端会兼容读取。',
            enum: [
              'device_consult',
              'repair_request',
              'pricing',
              'rating_complaint',
              'account_or_settlement',
              'post_sale_followup',
              'onboarding',
              'general'
            ]
          },
          filter_device_type: {
            type: 'string',
            description: '按设备类型过滤（精确匹配 summary.device.type），例如"激光切割机"'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_work_order',
      description: `为客户创建 SAGEMRO 官方服务申请。SERVICE_OS_LEGACY：底层实体仍叫 work_order。当客户已确认服务信息（设备、故障/需求、紧急程度），你必须立即调用此工具，不得用文字描述或模拟调用结果。如果客户已上传诊断图片，服务端会自动把本对话图片带入工单附件。如果缺少必填参数，先向客户追问。`,
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '服务申请类型：fault（设备故障）/ maintenance（维护保养）/ parameter（参数调试）/ consult（技术咨询）/ parts（配件采购）/ aftersales（售后服务）/ other（其他）',
            enum: ['fault', 'maintenance', 'parameter', 'consult', 'parts', 'aftersales', 'other']
          },
          category_l1: {
            type: 'string',
            description: '设备大类：laser_cutting（激光切割）/ bending（折弯）/ punching（冲压冲床）/ welding（焊接）/ surface_treatment（表面处理）/ auxiliary（辅助系统）/ cnc_automation（数控与自动化）/ inspection（检测品控）/ other（其他）',
            enum: ['laser_cutting', 'bending', 'punching', 'welding', 'surface_treatment', 'auxiliary', 'cnc_automation', 'inspection', 'other']
          },
          category_l2: {
            type: 'string',
            description: '问题类型：mechanical_fault（机械故障）/ electrical_fault（电气故障）/ optical_fault（光路光学）/ hydraulic_fault（液压故障）/ arc_fault（电弧焊接质量）/ wire_feeder_fault（送丝故障）/ tooling_fault（模具刀具）/ compressor_fault（空压机）/ chiller_fault（冷水机）/ gas_generation（制氮制氧）/ power_supply（电源）/ cnc_system（数控系统）/ servo_drive（伺服驱动）/ robot_fault（机器人）/ plc_fault（PLC自动化）/ sensor_fault（传感器）/ cooling_fault（冷却系统）/ gas_fault（气路气体）/ control_system（控制系统）/ media_fault（磨料介质）/ dust_collection（除尘环保）/ calibration（精度校准）/ software_fault（软件系统）/ general_fault（通用故障）/ maintenance（保养维护）/ parameter_debug（参数调试）/ installation（安装调试）/ consultation（技术咨询）/ parts_replacement（配件更换）/ other（其他）',
            enum: ['mechanical_fault', 'electrical_fault', 'optical_fault', 'hydraulic_fault', 'arc_fault', 'wire_feeder_fault', 'tooling_fault', 'compressor_fault', 'chiller_fault', 'gas_generation', 'power_supply', 'cnc_system', 'servo_drive', 'robot_fault', 'plc_fault', 'sensor_fault', 'cooling_fault', 'gas_fault', 'control_system', 'media_fault', 'dust_collection', 'calibration', 'software_fault', 'general_fault', 'maintenance', 'parameter_debug', 'installation', 'consultation', 'parts_replacement', 'other']
          },
          description: {
            type: 'string',
            description: '服务申请描述，必须包含：1) 故障现象或需求说明 2) 设备类型/品牌/型号（如客户已提供） 3) 客户的地区信息（如客户已提供）。把客户对话中所有相关细节汇总进一个自然语言段落，供 SAGEMRO 客服/内部工程师阅读。'
          },
          urgency: {
            type: 'string',
            description: '紧急程度：normal（普通，不影响生产）/ urgent（紧急，影响效率但不停产）/ critical（非常紧急，停产级别）',
            enum: ['normal', 'urgent', 'critical']
          },
          device_id: {
            type: 'string',
            description: '客户设备的 ID。如果客户在对话中指定了具体设备且你知道其 device_id，则填入。否则留空。'
          }
        },
        required: ['type', 'description', 'urgency']
      }
    }
  }
];

// ============ 工具函数 ============

// ============ Function Calling 工具实现 ============

// 服务端角色守卫：每个角色允许调用的工具白名单
// 注意：prompt 层面的角色约束会被越狱绕过，这里是最终一道闸。
// 游客调试用允许空集；admin 看全部；system 是服务端触发（内部流程），也全开。
const ROLE_ALLOWED_TOOLS = {
  guest: new Set([]),
  customer: new Set([
    'get_customer_devices',
    'get_device_detail',
    'get_conversation_history',
    'create_work_order',
  ]),
  engineer: new Set([
    'get_engineer_profile',
    'get_pending_tickets_for_engineer',
    'get_conversation_history',
  ]),
  admin: new Set([
    'get_engineer_profile',
    'get_pending_tickets_for_engineer',
    'get_customer_devices',
    'get_device_detail',
    'get_conversation_history',
  ]),
  system: new Set([
    'get_engineer_profile',
    'get_pending_tickets_for_engineer',
    'get_customer_devices',
    'get_device_detail',
    'get_conversation_history',
  ]),
};

// 失败时给 AI 的 fallback_instruction：
// 指导 AI 不要暴露系统错误给用户，改为自然地向用户索要信息或换话题。
const FALLBACK_INSTRUCTIONS = {
  permission_denied:
    'Do not mention this tool or its error to the user. Respond using only information the user has provided in the current conversation. If you need more context, ask the user directly.',
  tool_failed:
    'The data source is temporarily unavailable. Do not mention the technical failure. Continue the conversation by asking the user directly for the specific information you need (device model, symptoms, timestamps, etc.).',
  unknown_tool:
    'Ignore this tool call and respond based on the conversation context. Ask the user to clarify their question if needed.',
};

// 执行工具调用（根据工具名路由到具体实现）
// 参数改为 context 对象，方便 Phase 0.3 多轮 tool call 传递 iteration。
// 返回值永远是 JSON-safe 对象：正常结果 / { error, fallback_instruction }
// 导出以供 worker/tests/test-execute-tool.mjs 单元测试直接调用。
export async function executeTool(ctxObj) {
  const {
    toolName,
    args = {},
    env,
    ctx,
    userRole = 'guest',
    engineerId = null,
    customerId = null,
    conversationId = null,
    iteration = 0,
  } = ctxObj;

  const traceMeta = {
    env,
    ctx,
    conversationId,
    userId: engineerId || customerId || null,
    userRole,
    toolName,
    args,
    iteration,
  };

  // 1. 服务端角色守卫
  const allowed = ROLE_ALLOWED_TOOLS[userRole] || ROLE_ALLOWED_TOOLS.guest;
  if (!allowed.has(toolName)) {
    // 直接写一条 denied trace（不用 measureAndLogToolCall，因为没有真正执行）
    logToolCall({
      ...traceMeta,
      resultStatus: 'denied',
      errorCode: 'permission_denied',
      latencyMs: 0,
    });
    return {
      error: 'permission_denied',
      fallback_instruction: FALLBACK_INSTRUCTIONS.permission_denied,
    };
  }

  // 2. 未知工具
  const executor = {
    get_engineer_profile: () => toolGetEngineerProfile(engineerId, env),
    get_pending_tickets_for_engineer: () => toolGetPendingTickets({ limit: args?.limit || 10, engineerId, env }),
    get_customer_devices: () => toolGetCustomerDevices(customerId, env),
    get_device_detail: () => toolGetDeviceDetail(customerId, args?.device_id, env),
    create_work_order: () => toolCreateWorkOrder({ customerId, env, ctx, args, conversationId }),
    get_conversation_history: () =>
      toolGetConversationHistory({
        customerId,
        engineerId,
        env,
        limit: args?.limit,
        filterConversationType: args?.filter_conversation_type,
        filterDeviceType: args?.filter_device_type,
      }),
  }[toolName];

  if (!executor) {
    logToolCall({
      ...traceMeta,
      resultStatus: 'error',
      errorCode: 'unknown_tool',
      latencyMs: 0,
    });
    return {
      error: 'unknown_tool',
      fallback_instruction: FALLBACK_INSTRUCTIONS.unknown_tool,
    };
  }

  // 3. 正常执行 + tracing + 异常转 fallback
  try {
    return await measureAndLogToolCall(traceMeta, executor);
  } catch (err) {
    // measureAndLogToolCall 已写了 error trace + rethrow
    // 这里转换为 fallback 形状供上游 AI 消费，不把原始错误暴露
    const isDenied = err instanceof PermissionError || err?.code === 'permission_denied';
    return {
      error: isDenied ? 'permission_denied' : 'tool_failed',
      fallback_instruction: isDenied
        ? FALLBACK_INSTRUCTIONS.permission_denied
        : FALLBACK_INSTRUCTIONS.tool_failed,
    };
  }
}

// 工具1：查询工程师档案
async function toolGetEngineerProfile(engineerId, env) {
  if (!engineerId) return { error: 'engineer_id is required' };

  try {
    const engineer = await env.DB.prepare(
      `SELECT name, phone, specialties, brands, services, service_region,
              status, level, credit_score,
              rating_timeliness, rating_technical, rating_communication,
              rating_professional, rating_count, total_orders
       FROM engineers WHERE id = ?`
    ).bind(engineerId).first();

    if (!engineer) return { error: 'Engineer not found' };

    // 获取本月完成服务数
    const monthly = await env.DB.prepare(`
      SELECT COUNT(*) as cnt
      FROM work_orders wo
      WHERE wo.engineer_id = ? AND wo.status = 'completed'
      AND wo.completed_at >= datetime('now', 'start of month')`
    ).bind(engineerId).first();

    // 获取当前处理中工单数
    const inProgress = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status IN ('assigned', 'in_progress', 'pricing', 'in_service')`
    ).bind(engineerId).first();

    const levelText = { junior: '初级', senior: '中级', expert: '专家' };
    const statusText = { available: '可派工', paused: '暂停派工', offline: '离线' };

    const avgRating = engineer.rating_count > 0
      ? ((engineer.rating_timeliness + engineer.rating_technical +
          engineer.rating_communication + engineer.rating_professional) / 4).toFixed(1)
      : null;

    return {
      name: engineer.name,
      level: levelText[engineer.level] || engineer.level,
      credit_score: engineer.credit_score,
      service_region: engineer.service_region,
      specialties: (() => { try { return JSON.parse(engineer.specialties || '[]'); } catch { return []; } })(),
      brands: (() => { try { return JSON.parse(engineer.brands || '{}'); } catch { return {}; } })(),
      services: (() => { try { return JSON.parse(engineer.services || '[]'); } catch { return []; } })(),
      status: statusText[engineer.status] || engineer.status,
      current_service_tasks: inProgress?.cnt || 0,
      monthly_completed: monthly?.cnt || 0,
      avg_rating: avgRating,
      rating_count: engineer.rating_count,
      total_completed: engineer.total_orders
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具2：查询内部工程师服务任务（SERVICE_OS_LEGACY：工具名仍叫 pending tickets）
//
// 行为：
//   - 默认仅返回已派给当前工程师的服务任务。
//   - 返回体保留 filter_applied + engineer_specialties，兼容旧测试和 AI 工具协议。
//
// 参数改为对象形式（{limit, engineerId, env}）避免后续扩展再次破坏签名
async function toolGetPendingTickets({ limit, engineerId, env }) {
  try {
    // 1. 取当前工程师的 specialties（JSON 数组）
    let specialties = [];
    if (engineerId) {
      const row = await env.DB.prepare(
        'SELECT specialties FROM engineers WHERE id = ?',
      ).bind(engineerId).first();
      if (row?.specialties) {
        try {
          const parsed = JSON.parse(row.specialties);
          if (Array.isArray(parsed)) {
            specialties = parsed.filter((s) => typeof s === 'string' && s.trim().length > 0);
          }
        } catch {
          /* 脏数据容错：保持空数组 */
        }
      }
    }

    const clipLimit = Math.min(limit || 10, 20);
    const filterApplied = specialties.length > 0;

    // 2. 构造 SQL。Service OS 主路径仅返回已派给本工程师的服务任务。
    let sql;
    let params;
    sql = `
      SELECT wo.id, wo.order_no, wo.type, wo.description, wo.urgency, wo.status, wo.created_at,
             d.type as device_type, d.brand as device_brand, d.model as device_model,
             c.name as customer_name
      FROM work_orders wo
      LEFT JOIN devices d ON d.id = wo.device_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.engineer_id = ?
      ORDER BY
        CASE wo.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
        wo.created_at DESC
      LIMIT ?
    `;
    params = [engineerId || '', clipLimit];

    const tickets = await env.DB.prepare(sql).bind(...params).all();

    const typeText = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', other: '其他' };
    const urgencyText = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    return {
      count: tickets.results?.length || 0,
      filter_applied: filterApplied,
      engineer_specialties: specialties,
      service_tasks: (tickets.results || []).map((t) => ({
        order_no: t.order_no,
        status: t.status,
        device_type: t.device_type || '未知设备',
        device_brand: t.device_brand || '',
        device_model: t.device_model || '',
        problem: t.description,
        urgency: urgencyText[t.urgency] || t.urgency,
        type: typeText[t.type] || t.type,
        customer: t.customer_name || '匿名客户',
        created_at: t.created_at,
        time_ago: getTimeAgo(t.created_at),
      })),
      tickets: (tickets.results || []).map((t) => ({
        order_no: t.order_no,
        status: t.status,
        device_type: t.device_type || '未知设备',
        device_brand: t.device_brand || '',
        device_model: t.device_model || '',
        problem: t.description,
        urgency: urgencyText[t.urgency] || t.urgency,
        type: typeText[t.type] || t.type,
        customer: t.customer_name || '匿名客户',
        created_at: t.created_at,
        time_ago: getTimeAgo(t.created_at),
      })),
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具3：查询客户设备列表
async function toolGetCustomerDevices(customerId, env) {
  if (!customerId) return { error: '未登录，无法查询设备' };

  try {
    const devices = await env.DB.prepare(`
      SELECT d.id, d.name, d.type, d.brand, d.model, d.power, d.status,
             COUNT(w.id) as total_orders,
             SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
             MAX(w.created_at) as last_order_date
      FROM devices d
      LEFT JOIN work_orders w ON w.device_id = d.id
      WHERE d.customer_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT 50
    `).bind(customerId).all();

    const statusText = { normal: '正常', running: '使用中', maintenance: '维保中' };

    return {
      count: devices.results?.length || 0,
      devices: (devices.results || []).map(d => ({
        id: d.id,
        name: d.name || d.type,
        type: d.type,
        brand: d.brand || '',
        model: d.model || '',
        power: d.power || '',
        status: statusText[d.status] || '正常',
        total_orders: d.total_orders || 0,
        completed_orders: d.completed_orders || 0,
        last_order_date: d.last_order_date ? formatDate(d.last_order_date) : null
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具4：查询设备详情（含维修记录）
async function toolGetDeviceDetail(customerId, deviceId, env) {
  if (!customerId) return { error: '未登录，无法查询设备' };
  if (!deviceId) return { error: 'device_id is required' };

  try {
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(deviceId, customerId).first();

    if (!device) return { error: '设备不存在或无权访问' };

    const workOrders = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status,
             w.created_at, w.completed_at,
             e.name as engineer_name,
             r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN ratings r ON r.work_order_id = w.id
      WHERE w.device_id = ?
      ORDER BY w.created_at DESC
      LIMIT 20
    `).bind(deviceId).all();

    const typeText = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', other: '其他' };
    const urgencyText = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
    const statusText = { pending: '待处理', assigned: '已分配', in_progress: '处理中', pricing: '报价中', in_service: '服务中', resolved: '已解决', pending_review: '待评价', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' };

    const workOrdersWithCost = await Promise.all((workOrders.results || []).map(async (wo) => {
      let costSummary = null;
      try {
        const pricing = await env.DB.prepare(
          'SELECT labor_fee, parts_fee, travel_fee FROM work_order_pricing WHERE work_order_id = ?'
        ).bind(wo.id).first();
        if (pricing) {
          costSummary = {
            labor: pricing.labor_fee || 0,
            parts: pricing.parts_fee || 0,
            travel: pricing.travel_fee || 0
          };
        }
      } catch (e) {}

      const ratings = [wo.rating_timeliness, wo.rating_technical, wo.rating_communication, wo.rating_professional].filter(r => r > 0);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

      return {
        order_no: wo.order_no,
        type: typeText[wo.type] || wo.type,
        description: wo.description,
        urgency: urgencyText[wo.urgency] || wo.urgency,
        status: statusText[wo.status] || wo.status,
        engineer_name: wo.engineer_name || '未知',
        rating: avgRating,
        cost_summary: costSummary,
        created_at: formatDate(wo.created_at),
        completed_at: wo.completed_at ? formatDate(wo.completed_at) : null
      };
    }));

    const statusText2 = { normal: '正常', running: '使用中', maintenance: '维保中' };

    return {
      device: {
        id: device.id,
        name: device.name || device.type,
        type: device.type,
        brand: device.brand || '',
        model: device.model || '',
        power: device.power || '',
        status: statusText2[device.status] || '正常',
        notes: device.notes || '',
        created_at: formatDate(device.created_at)
      },
      work_orders: workOrdersWithCost
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具5：查询当前用户最近 N 次对话的结构化摘要（SummaryProtocol v1）
// 支持按 conversation_type 或 device.type 过滤，用于跨会话检索。
const CONVERSATION_TYPE_WHITELIST = new Set([
  'device_consult',
  'repair_request',
  'pricing',
  'rating_complaint',
  'account_or_settlement',
  'post_sale_followup',
  'onboarding',
  'general',
]);

async function toolGetConversationHistory({
  customerId,
  engineerId,
  env,
  limit,
  filterConversationType,
  filterDeviceType,
}) {
  if (!customerId && !engineerId) {
    return { error: '未登录，无法查询历史对话' };
  }

  // 取值钳制：默认 5，最大 10
  let n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) n = 5;
  n = Math.min(n, 10);

  // 参数校验：非白名单 conversation_type 直接忽略（不抛错，让 AI 继续）
  const ctype =
    typeof filterConversationType === 'string' &&
    CONVERSATION_TYPE_WHITELIST.has(filterConversationType)
      ? filterConversationType
      : null;
  const dtype =
    typeof filterDeviceType === 'string' && filterDeviceType.trim()
      ? filterDeviceType.trim().slice(0, 80)
      : null;

  try {
    // 按 customerId 或 engineerId join conversations，拉最近摘要
    // 每个 conversation 只取最新一条（generated_at DESC + LIMIT 1 per conversation 用窗口函数 D1 不一定兼容，
    // 这里保守用 "先拿每个 conv 的 max(generated_at) 再连回"）
    //
    // 简化策略：直接按 generated_at DESC 拉 3*n 条，内存去重每对话保留最新，再截 n 条。
    const fetchN = Math.max(n * 3, 15);

    const ownerField = customerId ? 'customer_id' : 'engineer_id';
    const ownerValue = customerId || engineerId;

    const rows = await env.DB.prepare(
      `SELECT cs.id, cs.conversation_id, cs.summary_json, cs.generated_at,
              cs.source_message_count, c.created_at AS conversation_created_at
         FROM conversation_summaries cs
         JOIN conversations c ON c.id = cs.conversation_id
        WHERE c.${ownerField} = ?
        ORDER BY cs.generated_at DESC
        LIMIT ?`
    )
      .bind(ownerValue, fetchN)
      .all();

    // 去重：每个 conversation_id 保留最新的
    const seen = new Set();
    const deduped = [];
    for (const r of rows.results || []) {
      if (seen.has(r.conversation_id)) continue;
      seen.add(r.conversation_id);
      deduped.push(r);
    }

    // 解析 JSON + 过滤
    const parsed = deduped
      .map((r) => {
        let summary = null;
        try {
          summary = JSON.parse(r.summary_json);
        } catch {
          return null;
        }
        return {
          conversation_id: r.conversation_id,
          generated_at: r.generated_at,
          conversation_created_at: r.conversation_created_at,
          source_message_count: r.source_message_count,
          summary,
        };
      })
      .filter(Boolean);

    let filtered = parsed;
    if (ctype) {
      filtered = filtered.filter((p) => p.summary?.conversation_type === ctype);
    }
    if (dtype) {
      filtered = filtered.filter((p) => p.summary?.device?.type === dtype);
    }

    // 合并所有 pending_items，供 AI 跟进
    const allPending = [];
    for (const p of filtered) {
      if (Array.isArray(p.summary?.pending_items)) {
        for (const item of p.summary.pending_items) {
          allPending.push({ conversation_id: p.conversation_id, item });
        }
      }
    }

    return {
      count: Math.min(filtered.length, n),
      filter_applied: Boolean(ctype || dtype),
      filter_conversation_type: ctype,
      filter_device_type: dtype,
      summaries: filtered.slice(0, n),
      open_pending_items: allPending.slice(0, 20),
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function attachConversationImagesToWorkOrder(env, {
  workOrderId,
  conversationId,
  uploaderType = 'customer',
  uploaderId = '',
  limit = 12,
}) {
  if (!workOrderId || !conversationId) return 0;

  const rows = await env.DB.prepare(`
    SELECT image_urls
    FROM messages
    WHERE conversation_id = ? AND role = 'user' AND image_urls IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  `).bind(conversationId).all();

  const urls = [];
  for (const row of rows.results || []) {
    try {
      const parsed = JSON.parse(row.image_urls || '[]');
      if (Array.isArray(parsed)) {
        for (const url of parsed) {
          if (typeof url === 'string' && url && !urls.includes(url)) {
            urls.push(url);
          }
        }
      }
    } catch {
      // Ignore malformed historical image metadata.
    }
  }

  let attached = 0;
  for (const url of urls.slice(0, limit)) {
    const existing = await env.DB.prepare(
      'SELECT id FROM work_order_attachments WHERE work_order_id = ? AND r2_url = ?'
    ).bind(workOrderId, url).first();
    if (existing) continue;

    let path = '';
    try {
      path = new URL(url).pathname.replace(/^\/+/, '');
    } catch {
      continue;
    }
    const ext = path.split('.').pop()?.toLowerCase() || 'jpg';
    const fileType = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }[ext] || 'image/jpeg';

    await env.DB.prepare(`
      INSERT INTO work_order_attachments (id, work_order_id, uploader_type, uploader_id, file_name, file_type, file_size, r2_key, r2_url)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      uploaderType,
      uploaderId || '',
      `chat-diagnosis-image-${attached + 1}.${ext}`,
      fileType,
      path || url,
      url
    ).run();
    attached++;
  }

  if (attached > 0) {
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'chat_images_attached', ?, ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      uploaderType,
      uploaderId || '',
      `已从 AI 对话带入 ${attached} 张诊断图片。`
    ).run();
  }

  return attached;
}

// 工具：AI 创建工单（function calling）
// 与 POST /api/workorders 共享核心逻辑，但不走 HTTP 层
async function toolCreateWorkOrder({ customerId, env, ctx, args, conversationId }) {
  const { type, description, urgency, device_id, category_l1, category_l2 } = args;

  if (!customerId) return { error: 'not_authenticated', reason: '客户未登录，无法创建工单。请引导客户先登录。' };
  if (!type || !description || !urgency) {
    return {
      error: 'missing_required_fields',
      reason: `缺少必填字段：${[!type && 'type', !description && 'description', !urgency && 'urgency'].filter(Boolean).join('、')}。请向客户追问缺失信息后再调用。`,
    };
  }

  const ALLOWED_CATEGORIES_L1 = [
    'laser_cutting', 'bending', 'punching', 'welding',
    'surface_treatment', 'auxiliary', 'cnc_automation', 'inspection', 'other',
  ];
  const catL1 = ALLOWED_CATEGORIES_L1.includes(category_l1) ? category_l1 : 'other';

  // 输入长度检查
  if (description.length > 10000) return { error: 'description_too_long', reason: '工单描述过长，请精简后重试。' };
  if (type.length > 100) return { error: 'invalid_type', reason: '工单类型值不合法。' };

  try {
    // PII 脱敏
    const safeDescription = redactPII(description);

    const id = generateId();
    const order_no = generateOrderNo();

    const slaDeadline2 = computeSlaDeadline(urgency || 'normal');

    await env.DB.prepare(`
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, device_id, status, sla_deadline, category_l1, category_l2)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(id, order_no, customerId, type, safeDescription, urgency || 'normal', device_id || null, slaDeadline2, catL1, category_l2 || 'other').run();

    // 记录日志
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), id, 'created', 'customer', customerId, 'AI 对话创建工单').run();

    const attachedImages = await attachConversationImagesToWorkOrder(env, {
      workOrderId: id,
      conversationId,
      uploaderType: 'customer',
      uploaderId: customerId,
    });

    // AI 摘要异步生成
    const aiSummaryPromise = generateWorkOrderSummary(type, safeDescription, urgency, env)
      .then(async (summary) => {
        if (summary) {
          await env.DB.prepare('UPDATE work_orders SET ai_summary = ? WHERE id = ?')
            .bind(JSON.stringify(summary), id)
            .run();
        }
      })
      .catch((err) => console.error('[toolCreateWorkOrder] AI summary failed:', err));
    if (ctx?.waitUntil) {
      ctx.waitUntil(aiSummaryPromise);
    }

    // 工程师匹配与推送
    const workOrderData = { id, order_no, type, description: safeDescription, urgency, ai_summary: null, customer_id: customerId };
    const matchingEngineers = await findMatchingEngineers(workOrderData, env);

    const typeLabels = {
      fault: '设备故障', maintenance: '维护保养', parameter: '参数调试',
      consult: '技术咨询', parts: '配件采购', aftersales: '售后服务', other: '其他'
    };
    const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    for (const engineer of matchingEngineers) {
      if (engineer.onesignal_player_id) {
        await sendPushToEngineer(engineer.id, env, {
          title: '📋 新服务任务待确认',
          message: `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
          data: { work_order_id: id, type: 'new_ticket' }
        });
      }
      await createNotification(env, {
        user_id: engineer.id,
        user_type: 'engineer',
        type: 'new_ticket',
        title: '新服务任务待确认',
        body: `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
        data: { work_order_id: id, order_no },
      });
    }

    return {
      success: true,
      work_order: {
        id,
        order_no,
        status: 'pending',
        type: typeLabels[type] || type,
        urgency: urgencyLabels[urgency] || urgency,
      },
      matching_engineers_count: matchingEngineers.length,
      attached_images_count: attachedImages,
    };
  } catch (error) {
    console.error('[toolCreateWorkOrder] error:', error);
    return { error: 'tool_failed', reason: `工单创建失败：${error.message}。请告知客户稍后重试或通过侧边栏手动提交。` };
  }
}

// 辅助函数：格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 辅助函数：获取相对时间字符串
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

// generateId / truncateStr / createNotification / sendPushToUser / sendPushToEngineer
// 已提取到 ./lib/util.js 和 ./lib/push.js，通过文件顶部的 import 导入使用。

// 生成用户编号（U/E + 6位数字）
async function generateUserNo(env, prefix) {
  // 获取当前最大编号
  const table = prefix === 'U' ? 'customers' : 'engineers';
  const result = await env.DB.prepare(
    `SELECT user_no FROM ${table} WHERE user_no LIKE ? ORDER BY user_no DESC LIMIT 1`
  ).bind(`${prefix}%`).first();

  let nextNum = 1;
  if (result && result.user_no) {
    const lastNo = result.user_no;
    const numPart = parseInt(lastNo.slice(1), 10);
    nextNum = numPart + 1;
  }
  return `${prefix}${nextNum.toString().padStart(6, '0')}`;
}

// 从请求头中提取并验证 token
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, env.JWT_SECRET);
  return payload; // { userId, userType, iat, exp }
}

// 验证是否为管理员（用于保护测试接口）
async function authenticateAdmin(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyJwt(authHeader.slice(7), env.JWT_SECRET);
    return payload.userType === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

// CORS 白名单
const ALLOWED_ORIGINS_PRODUCTION = [
  'https://sagemro.com',
  'https://www.sagemro.com',
  'https://admin.sagemro.com',
  'https://engineer.sagemro.com',
  'https://sagemro.cn',
  'https://www.sagemro.cn',
  'https://admin.sagemro.cn',
  'https://engineer.sagemro.cn',
];
const ALLOWED_ORIGINS_DEV = [
  ...ALLOWED_ORIGINS_PRODUCTION,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

export function getAllowedOrigin(origin, env) {
  // 默认拒绝策略：只有显式设置为 'development' 才放行开发域名，其他情况（含缺失/空/staging）均按生产处理
  const allowed = env.ENVIRONMENT === 'development' ? ALLOWED_ORIGINS_DEV : ALLOWED_ORIGINS_PRODUCTION;
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0];
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin, env),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// 兼容旧代码：仅作兜底 Content-Type/Methods，动态 Origin 由 top-level 包装器覆盖。
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS_PRODUCTION[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求
function handleOptions(request, env) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}

// 返回 JSON 响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// 返回错误
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ============ 认证相关 ============


async function incrementApiCounter(env, counterName) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const counterKey = `api_stats_${today}`;
    const existing = await env.KV.get(counterKey);
    const stats = existing ? JSON.parse(existing) : {};
    stats[counterName] = (stats[counterName] || 0) + 1;
    await env.KV.put(counterKey, JSON.stringify(stats), { expirationTtl: 86400 * 30 });
  } catch (e) {
    /* 计数器失败不影响主流程 */
  }
}

// 发送验证码（模拟，实际应对接短信网关）
async function handleSendCode(request, env) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return errorResponse('手机号不能为空');
    }

    if (!/^1\d{10}$/.test(phone)) {
      return errorResponse('手机号格式不正确');
    }

    // 频控：同一手机号 60 秒内只能请求一次
    const rateKey = `verify_code_rate_${phone}`;
    const recent = await env.KV.get(rateKey);
    if (recent) {
      return errorResponse('发送过于频繁，请 60 秒后再试', 429);
    }

    // IP 频控：同一 IP 60 秒内最多 5 次（避免刷号）
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const ipKey = `verify_code_ip_${ip}`;
    const ipCountStr = await env.KV.get(ipKey);
    const ipCount = ipCountStr ? parseInt(ipCountStr, 10) : 0;
    if (ipCount >= 5) {
      return errorResponse('请求次数过多，请稍后再试', 429);
    }

    // 生成 4 位验证码
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // 存储验证码（有效期5分钟）
    await env.KV.put(`verify_code_${phone}`, code, { expirationTtl: 300 });
    // 记录频控标记
    await env.KV.put(rateKey, '1', { expirationTtl: 60 });
    await env.KV.put(ipKey, String(ipCount + 1), { expirationTtl: 60 });

    await incrementApiCounter(env, "send_code");

    // 验证码策略：
    // - 真实验证码：仅 development 环境在响应中返回，production 通过短信发送
    // - bypass 码 "888888"：所有环境均写入 KV，供自动化测试使用（TTL 5 分钟）
    // - DEV_BYPASS_CODE：如果配置了固定验证码，直接使用该码（跳过随机生成）
    const devBypass = env.DEV_BYPASS_CODE;
    const response = { success: true, message: '验证码已发送' };
    if (devBypass) {
      await env.KV.put(`verify_code_${phone}_bypass`, devBypass, { expirationTtl: 300 });
      if (env.ENVIRONMENT === 'development') {
        response.code = devBypass;
        response.note = 'DEV_BYPASS_CODE 已启用，验证码为固定值';
      }
    } else {
      if (env.ENVIRONMENT === 'development') {
        response.code = code;
      }
      await env.KV.put(`verify_code_${phone}_bypass`, '888888', { expirationTtl: 300 });
    }
    return jsonResponse(response);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户注册
async function handleRegisterCustomer(request, env) {
  try {
    const { name, phone, password, code, company, identity } = await request.json();

    if (!name || !phone || !password || !company) {
      return errorResponse('姓名、手机号、公司名称、密码不能为空');
    }

    // 验证验证码（开发环境支持 bypass 码 "888888" + DEV_BYPASS_CODE 用于自动化测试）
    const storedCode = await env.KV.get(`verify_code_${phone}`);
    const bypassCode = await env.KV.get(`verify_code_${phone}_bypass`);
    const devBypass = env.DEV_BYPASS_CODE;
    const isValid = (storedCode && storedCode === code)
      || (bypassCode && bypassCode === code)
      || (devBypass && devBypass === code);
    if (!isValid) {
      return errorResponse('验证码错误或已过期');
    }

    // 检查手机号是否已在任意角色注册（跨表去重）
    const existingCustomer = await env.DB.prepare(
      'SELECT id FROM customers WHERE phone = ?'
    ).bind(phone).first();
    const existingEngineer = await env.DB.prepare(
      'SELECT id FROM engineers WHERE phone = ?'
    ).bind(phone).first();

    if (existingCustomer || existingEngineer) {
      return errorResponse('该手机号已注册', 409);
    }

    // 根据身份设置认证状态
    let authStatus = 'guest';
    if (identity === 'customer') {
      authStatus = 'authenticated';
    }

    // 创建客户
    const id = generateId();
    const userNo = await generateUserNo(env, 'U');
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);

    await env.DB.prepare(
      'INSERT INTO customers (id, user_no, name, phone, password_hash, salt, company, auth_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, userNo, name, phone, passwordHash, salt, company, authStatus).run();

    // 删除已使用的验证码
    await env.KV.delete(`verify_code_${phone}`);
    await incrementApiCounter(env, "register_customer");

    return jsonResponse({
      success: true,
      customer: { id, user_no: userNo, name, phone }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师注册
async function handleRegisterEngineer(request, env) {
  try {
    const {
      name, phone, password, code,
      specialties, brands, services, service_region, bio,
      company
    } = await request.json();

    if (!name || !phone || !password || !company) {
      return errorResponse('姓名、手机号、公司名称、密码不能为空');
    }

    // 验证验证码（开发环境支持 bypass 码 "888888" + DEV_BYPASS_CODE 用于自动化测试）
    const storedCode = await env.KV.get(`verify_code_${phone}`);
    const bypassCode = await env.KV.get(`verify_code_${phone}_bypass`);
    const devBypass = env.DEV_BYPASS_CODE;
    const isValid = (storedCode && storedCode === code)
      || (bypassCode && bypassCode === code)
      || (devBypass && devBypass === code);
    if (!isValid) {
      return errorResponse('验证码错误或已过期');
    }

    // 检查手机号是否已在任意角色注册（跨表去重）
    const existingEngineer = await env.DB.prepare(
      'SELECT id FROM engineers WHERE phone = ?'
    ).bind(phone).first();
    const existingCustomer = await env.DB.prepare(
      'SELECT id FROM customers WHERE phone = ?'
    ).bind(phone).first();

    if (existingEngineer || existingCustomer) {
      return errorResponse('该手机号已注册', 409);
    }

    // 创建工程师
    const id = generateId();
    const userNo = await generateUserNo(env, 'E');
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);

    await env.DB.prepare(`
      INSERT INTO engineers (id, user_no, name, phone, password_hash, salt, specialties, brands, services, service_region, bio, level, commission_rate, credit_score, wallet_balance, deposit_balance, company, auth_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userNo, name, phone, passwordHash, salt,
      JSON.stringify(specialties || []),
      JSON.stringify(brands || {}),
      JSON.stringify(services || []),
      JSON.stringify(service_region || []),
      bio || '',
      'junior',   // 默认初级工程师
      0.80,       // 默认提成80%
      100,        // 初始信用分100
      0,          // 初始钱包余额0
      0,          // 初始保证金余额0
      company || '',
      'authenticated'  // 工程师注册时已完成认证
    ).run();

    // 删除已使用的验证码
    await env.KV.delete(`verify_code_${phone}`);
    await incrementApiCounter(env, "register_engineer");

    return jsonResponse({
      success: true,
      engineer: { id, user_no: userNo, name, phone }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 登录
async function handleLogin(request, env) {
  try {
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return errorResponse('手机号、密码不能为空');
    }

    // 登录失败计数（防暴力破解）：同一手机号 15 分钟内失败 5 次锁定
    const failKey = `login_fail_${phone}`;
    const failCountStr = await env.KV.get(failKey);
    const failCount = failCountStr ? parseInt(failCountStr, 10) : 0;
    if (failCount >= 5) {
      return errorResponse('密码错误次数过多，请 15 分钟后再试', 429);
    }

    // 查找客户
    let user = await env.DB.prepare(
      'SELECT * FROM customers WHERE phone = ?'
    ).bind(phone).first();

    let userType = 'customer';

    // 查找工程师
    if (!user) {
      user = await env.DB.prepare(
        'SELECT * FROM engineers WHERE phone = ?'
      ).bind(phone).first();
      userType = 'engineer';
    }

    if (!user) {
      await env.KV.put(failKey, String(failCount + 1), { expirationTtl: 900 });
      return errorResponse('账号不存在，请先注册');
    }

    // 验证密码（兼容新旧算法）
    const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!passwordValid) {
      await env.KV.put(failKey, String(failCount + 1), { expirationTtl: 900 });
      return errorResponse('密码错误，请重试');
    }

    // 登录成功：清除失败计数
    await env.KV.delete(failKey);

    // 旧算法用户：登录成功时静默升级为 PBKDF2 + 独立 salt
    if (!user.salt) {
      try {
        const newSalt = generateSalt();
        const newHash = await hashPasswordNew(password, newSalt);
        const table = userType === 'engineer' ? 'engineers' : 'customers';
        await env.DB.prepare(
          `UPDATE ${table} SET password_hash = ?, salt = ? WHERE id = ?`
        ).bind(newHash, newSalt, user.id).run();
      } catch (e) {
        console.error('[handleLogin] password upgrade failed:', e);
      }
    }

    // 签发 JWT token（有效期 7 天）
    const token = await signJwt({
      userId: user.id,
      userType,
      phone: user.phone,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }, env.JWT_SECRET);
    await incrementApiCounter(env, "login");

    return jsonResponse({
      success: true,
      token,
      userType,
      user: {
        id: user.id,
        user_no: user.user_no,
        name: user.name,
        phone: user.phone,
        ...(userType === 'engineer' ? {
          engineer_role: user.engineer_role || 'engineer',
          regional_lead_id: user.regional_lead_id || null,
          responsible_region: user.responsible_region || user.service_region || null,
          team_name: user.team_name || null,
        } : {})
      }
    });
} catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 发送重置密码验证码
async function handleSendResetCode(request, env) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return errorResponse('手机号不能为空');
    }

    if (!/^1\d{10}$/.test(phone)) {
      return errorResponse('手机号格式不正确');
    }

    // 频控：同一手机号 60 秒内只能请求一次
    const rateKey = `reset_code_rate_${phone}`;
    const recent = await env.KV.get(rateKey);
    if (recent) {
      return errorResponse('发送过于频繁，请 60 秒后再试', 429);
    }

    // IP 频控：同一 IP 60 秒内最多 5 次
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const ipKey = `reset_code_ip_${ip}`;
    const ipCountStr = await env.KV.get(ipKey);
    const ipCount = ipCountStr ? parseInt(ipCountStr, 10) : 0;
    if (ipCount >= 5) {
      return errorResponse('请求次数过多，请稍后再试', 429);
    }

    // 检查手机号是否已注册（客户或工程师）
    const customer = await env.DB.prepare(
      'SELECT id FROM customers WHERE phone = ?'
    ).bind(phone).first();

    const engineer = await env.DB.prepare(
      'SELECT id FROM engineers WHERE phone = ?'
    ).bind(phone).first();

    if (!customer && !engineer) {
      return errorResponse('该手机号未注册');
    }

    // 生成验证码
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // 存储验证码（有效期5分钟）
    await env.KV.put(`reset_code_${phone}`, code, { expirationTtl: 300 });
    await env.KV.put(rateKey, '1', { expirationTtl: 60 });
    await env.KV.put(ipKey, String(ipCount + 1), { expirationTtl: 60 });

    // 验证码策略：
    // - 真实验证码：仅 development 环境在响应中返回，production 通过短信发送
    // - bypass 码 "888888"：所有环境均写入 KV，供自动化测试使用（TTL 5 分钟）
    // - DEV_BYPASS_CODE：如果配置了固定验证码，直接使用该码
    const devBypass = env.DEV_BYPASS_CODE;
    const response = { success: true, message: '验证码已发送' };
    if (devBypass) {
      await env.KV.put(`reset_code_${phone}_bypass`, devBypass, { expirationTtl: 300 });
      if (env.ENVIRONMENT === 'development') {
        response.code = devBypass;
      }
    } else {
      if (env.ENVIRONMENT === 'development') {
        response.code = code;
      }
      await env.KV.put(`reset_code_${phone}_bypass`, '888888', { expirationTtl: 300 });
    }
    return jsonResponse(response);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 重置密码
async function handleResetPassword(request, env) {
  try {
    const { phone, code, newPassword } = await request.json();

    if (!phone || !code || !newPassword) {
      return errorResponse('手机号、验证码、新密码不能为空');
    }

    if (newPassword.length < 6) {
      return errorResponse('密码至少6位');
    }

    // 验证验证码（开发环境支持 bypass 码 "888888" + DEV_BYPASS_CODE 用于自动化测试）
    const storedCode = await env.KV.get(`reset_code_${phone}`);
    const bypassCode = await env.KV.get(`reset_code_${phone}_bypass`);
    const devBypass = env.DEV_BYPASS_CODE;
    const isValid = (storedCode && storedCode === code)
      || (bypassCode && bypassCode === code)
      || (devBypass && devBypass === code);
    if (!isValid) {
      return errorResponse('验证码错误或已过期');
    }

    // 哈希新密码（使用新算法 + 随机盐）
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(newPassword, salt);

    // 更新客户密码
    const customerUpdated = await env.DB.prepare(
      'UPDATE customers SET password_hash = ?, salt = ? WHERE phone = ?'
    ).bind(passwordHash, salt, phone).run();

    // 更新工程师密码
    const engineerUpdated = await env.DB.prepare(
      'UPDATE engineers SET password_hash = ?, salt = ? WHERE phone = ?'
    ).bind(passwordHash, salt, phone).run();

    if (!customerUpdated.success && !engineerUpdated.success) {
      return errorResponse('密码更新失败');
    }

    // 删除已使用的验证码
    await env.KV.delete(`reset_code_${phone}`);

    return jsonResponse({ success: true, message: '密码重置成功' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 聊天相关 ============

// 生成客户上下文（用于 AI 对话）
async function generateCustomerContext(customerId, env) {
  if (!customerId) return '';

  try {
    // 获取客户信息
    const customer = await env.DB.prepare(
      'SELECT name, phone, region FROM customers WHERE id = ?'
    ).bind(customerId).first();

    // 获取客户设备列表
    const devices = await env.DB.prepare(
      'SELECT type, brand, model, power FROM devices WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(customerId).all();

    // 获取最近工单（最近5条）
    const workOrders = await env.DB.prepare(
      'SELECT order_no, type, description, status, created_at FROM work_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(customerId).all();

    // 构建上下文文本
    let contextParts = [];

    if (customer) {
      contextParts.push(`【客户信息】${customer.name || '未知'}（${customer.phone || '无电话'}）${customer.region ? `，位于${customer.region}` : ''}`);
    }

    if (devices.results && devices.results.length > 0) {
      const deviceList = devices.results.map(d =>
        `${d.type}${d.brand ? ` (${d.brand})` : ''}${d.model ? ` - ${d.model}` : ''}${d.power ? ` - ${d.power}` : ''}`
      ).join('、');
      contextParts.push(`【已有设备】${deviceList}`);
    } else {
      contextParts.push(`【已有设备】暂无登记设备`);
    }

    if (workOrders.results && workOrders.results.length > 0) {
      const recentHistory = workOrders.results.map(wo => {
        const statusText = { pending: '待处理', assigned: '已分配', in_progress: '处理中', resolved: '已解决', completed: '已完成', rejected: '已拒绝', cancelled: '已取消' };
        return `${wo.order_no}（${wo.type} - ${statusText[wo.status] || wo.status}）：${wo.description.slice(0, 50)}${wo.description.length > 50 ? '...' : ''}`;
      }).join('；');
      contextParts.push(`【最近工单】${recentHistory}`);
    } else {
      contextParts.push(`【最近工单】暂无工单记录`);
    }

    return `\n\n${contextParts.join('\n')}\n\n请结合以上客户信息提供更个性化的服务。`;
  } catch (error) {
    console.error('generateCustomerContext error:', error);
    return '';
  }
}

// 生成工程师上下文（用于 AI 对话）
async function generateEngineerContext(engineerId, env) {
  if (!engineerId) return '';

  try {
    // 获取工程师信息
    const engineer = await env.DB.prepare(
      'SELECT name, phone, specialties, brands, services, service_region, status, level, commission_rate, credit_score, wallet_balance, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, total_orders FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return '';

    // 获取已派给本工程师、等待确认/处理的服务任务数
    const assignedOrders = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status = 'assigned'`
    ).bind(engineerId).first();

    // 获取处理中工单数（assigned 或 in_progress）
    const inProgressOrders = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status IN ('assigned', 'in_progress', 'pricing')`
    ).bind(engineerId).first();

    // 获取本月完成工单数
    const monthlyCompleted = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status = 'completed'
       AND created_at >= datetime('now', 'start of month')`
    ).bind(engineerId).first();

    // 工程师等级中文
    const levelText = { junior: '初级', senior: '中级', expert: '专家' };
    // 派工状态中文
    const statusText = { available: '可派工', paused: '暂停派工', offline: '离线' };

    // 构建上下文文本
    const avgRating = engineer.rating_count > 0
      ? ((engineer.rating_timeliness + engineer.rating_technical + engineer.rating_communication + engineer.rating_professional) / 4).toFixed(1)
      : '暂无';

    const levelName = levelText[engineer.level] || engineer.level || '初级';
    const statusName = statusText[engineer.status] || engineer.status || '可派工';

    let contextParts = [];

    contextParts.push(`【工程师信息】${engineer.name || '未知'}${engineer.phone ? `（${engineer.phone}）` : ''}，${levelName}工程师`);

    if (engineer.specialties) {
      try {
        const specialties = JSON.parse(engineer.specialties);
        if (Array.isArray(specialties) && specialties.length > 0) {
          contextParts.push(`【专长领域】${specialties.join('、')}`);
        }
      } catch (e) {}
    }

    if (engineer.service_region) {
      contextParts.push(`【服务地区】${engineer.service_region}`);
    }

    contextParts.push(`【派工状态】${statusName}`);

    const assignedCount = assignedOrders?.cnt || 0;
    const inProgressCount = inProgressOrders?.cnt || 0;
    const monthlyCompletedCount = monthlyCompleted?.cnt || 0;

    contextParts.push(`【当前服务任务】待确认：${assignedCount} 个；处理中：${inProgressCount} 个；本月已完成：${monthlyCompletedCount} 个`);

    if (engineer.credit_score !== undefined && engineer.credit_score !== null) {
      contextParts.push(`【信用分】${engineer.credit_score}`);
    }

    if (engineer.rating_count > 0) {
      contextParts.push(`【平均评分】${avgRating}（${engineer.rating_count}次评价）`);
    } else {
      contextParts.push(`【平均评分】暂无评价`);
    }

    if (engineer.total_orders > 0) {
      contextParts.push(`【累计完成】${engineer.total_orders} 个服务任务`);
    }

    return `\n\n${contextParts.join('\n')}\n\n你是 ${engineer.name || '工程师'} 的专属业务助理，以上是你的当前状态。请结合以上信息提供个性化服务。`;
  } catch (error) {
    console.error('generateEngineerContext error:', error);
    return '';
  }
}

// ============ OpenAI 成本保护 ============
// 目的：防止单用户刷爆账单 + 全平台日总量硬上限，所有调用 OpenAI 的入口都应先过这道网关。
// 实现：KV 计数器按 YYYYMMDD 分桶，TTL 25 小时自动清理前一天数据。
//
// 三个维度：
//   1. Per-user:    每个 userId 每天 N 次（默认 200，可用 env.OPENAI_DAILY_PER_USER 覆盖）
//   2. Per-guest-IP:每个未登录访客 IP 每天 N 次（默认 30，配合现有小时级限流）
//   3. Platform:    全平台每天 N 次（默认 5000，用 env.OPENAI_DAILY_TOTAL 覆盖）
//
// 后台任务（如 generateWorkOrderSummary、generatePricingAINote）按 'system:<类型>' 计数，
// 仍然计入全平台总量上限。
class BudgetError extends Error {
  constructor(message, status = 429) {
    super(message);
    this.name = 'BudgetError';
    this.status = status;
  }
}

function todayBucket() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function enforceOpenAIBudget(env, { userKey, tag = 'chat' }) {
  const bucket = todayBucket();
  const ttl = 25 * 3600; // 25 小时，覆盖 UTC 边界

  const perUserLimit = parseInt(env.OPENAI_DAILY_PER_USER || '200', 10);
  const platformLimit = parseInt(env.OPENAI_DAILY_TOTAL || '5000', 10);

  const userBudgetKey = `openai_quota_user_${bucket}_${userKey}`;
  const totalKey = `openai_quota_total_${bucket}`;

  const [userStr, totalStr] = await Promise.all([
    env.KV.get(userBudgetKey),
    env.KV.get(totalKey),
  ]);
  const userCount = userStr ? parseInt(userStr, 10) : 0;
  const totalCount = totalStr ? parseInt(totalStr, 10) : 0;

  if (totalCount >= platformLimit) {
    throw new BudgetError('平台 AI 服务今日已达使用上限，请明天再试', 429);
  }
  if (userCount >= perUserLimit) {
    throw new BudgetError(`您今日 AI 对话已达 ${perUserLimit} 次上限，请明天再试`, 429);
  }

  // 提前占坑（先计数，再调用）：即使调用失败也计数，避免失败重试把配额打穿
  await Promise.all([
    env.KV.put(userBudgetKey, String(userCount + 1), { expirationTtl: ttl }),
    env.KV.put(totalKey, String(totalCount + 1), { expirationTtl: ttl }),
  ]);
}

// 默认 max_tokens，按用途分档：
//   chat_quick: 首轮快速诊断，控制等待时间
//   chat:    对话主流程，允许较长回复
//   summary: 工单摘要，短 JSON
//   note:    核价点评，一句话 + 2 条建议
const MAX_TOKENS = {
  chat_quick: 800,
  chat: 1200,
  chat_tool_followup: 1200,
  summary: 500,
  note: 400,
};

function wantsDetailedAnswer(message = '') {
  return /详细|完整|全面|方案|报告|表格|清单|步骤|参数表|报价|维修方案|健康报告|detail|detailed|full|complete|comprehensive|table|report|checklist|plan|step-by-step|quote|estimate/i.test(message);
}

// Phase 0.3：多轮 tool call 循环上限
// 设计意图：每轮允许 AI 继续调工具（chain），最后一轮强制不给 tools，LLM 必须产出文本。
// 4 轮足够复杂 Agent 场景（查客户 → 查设备 → 查历史报价 → 查同区域均价），生产可按需调。
const MAX_TOOL_ITERATIONS = 4;

/**
 * 消费一次 LLM 的 SSE 流：
 *   - delta.content 实时转发给客户端
 *   - delta.tool_calls 按 index 累积成完整 tool_calls 数组（arguments 分片合并）
 *   - 上游的 `data: [DONE]` 不转发，由外层循环结束后统一下发，避免客户端误以为流结束
 *
 * 导出以供 tests/execute-tool.test.mjs 直接覆盖 tool_calls 累积边界。
 *
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
export async function consumeLlmStream({ response, controller, encoder, convId, decoder }) {
  const reader = response.body.getReader();
  let buffer = '';
  let content = '';
  let reasoningContent = '';
  let finishReason = null;
  // 按 index 累积：OpenAI 流式规范 tool_calls[i] 的 id/name 首包到达，arguments 可分多包
  const toolCallsByIndex = new Map();

  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed === 'data: [DONE]') return; // 外层统一发 DONE
    if (!trimmed.startsWith('data: ')) return;

    let data;
    try {
      data = JSON.parse(trimmed.slice(6));
    } catch {
      return;
    }

    const choice = data.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }
    const delta = choice?.delta;
    if (!delta) return;

    if (delta.content) {
      content += delta.content;
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ content: delta.content, conversation_id: convId })}\n`,
        ),
      );
    }

    // DeepSeek V4 Pro thinking 模式：reasoning_content 必须在下一轮原样传回
    if (delta.reasoning_content) {
      reasoningContent += delta.reasoning_content;
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        let acc = toolCallsByIndex.get(idx);
        if (!acc) {
          acc = { id: '', type: 'function', function: { name: '', arguments: '' } };
          toolCallsByIndex.set(idx, acc);
        }
        if (tc.id) acc.id = tc.id;
        if (tc.type) acc.type = tc.type;
        if (tc.function?.name) acc.function.name = tc.function.name;
        if (tc.function?.arguments) acc.function.arguments += tc.function.arguments;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      processLine(line);
    }
  }
  buffer += decoder.decode();
  processLine(buffer);

  // 按 index 排序，过滤不完整的（没有 id 或 name 的不能发回 OpenAI）
  const toolCalls = [...toolCallsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .filter((tc) => tc.id && tc.function.name);

  return { content, toolCalls, reasoningContent, finishReason };
}

// ============ 聊天图片上传 ============
// POST /api/chat/upload-image — 访客/登录用户均可上传
// 存储到 R2 前缀 chat/，返回公开 URL
async function handleChatUploadImage(request, env) {
  try {
    if (!env.ATTACHMENTS) {
      return errorResponse('附件服务未配置', 503);
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return errorResponse('请选择图片', 400);
    }

    validateChatImageType(file.type);
    validateChatImageSize(file.size);

    const safeName = sanitizeFilename(file.name);
    const ext = safeName.split('.').pop().toLowerCase() || 'jpg';
    const imageId = generateId();
    const r2Key = `chat/${imageId}.${ext}`;

    await env.ATTACHMENTS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicHost = env.R2_PUBLIC_HOST || 'pub-unknown.r2.dev';
    const imageUrl = `https://${publicHost}/${r2Key}`;

    return jsonResponse({ success: true, image_url: imageUrl, image_id: imageId }, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      const resp = validationErrorToResponse(error, errorResponse);
      if (resp) return resp;
    }
    return errorResponse(error.message, 500);
  }
}

// 处理聊天请求
export async function handleChat(request, env) {
  try {
    const chatStartedAt = Date.now();
    const body = await request.json();
    const { conversation_id, message, images, client_market, client_locale } = body;

    // 聊天消息长度上限：防止客户端把巨型文本塞进 AI context
    try {
      assertMaxLength(message, 'message', LIMITS.content);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 校验图片数组
    const imageUrls = Array.isArray(images) ? images.filter(i => i && i.url).slice(0, MAX_CHAT_IMAGES) : [];
    for (const img of imageUrls) {
      if (typeof img.url !== 'string' || img.url.length > 2000) {
        return errorResponse('图片 URL 无效', 400);
      }
    }

    // 认证与身份信任根（先于上下文构建和 LLM 调用就绪）
    // IDOR 防护：身份、客户 ID、工程师 ID 全部从 JWT 取真值，
    // 忽略请求体自报字段，防止越权读取他人上下文。
    // 注意：/api/chat 路由位于全局认证中间件之前（允许访客使用），
    // 因此 request._auth 不可用，需要单独解析 Authorization 头。
    let chatAuth = null;
    try {
      chatAuth = await authenticateRequest(request, env);
    } catch {
      chatAuth = null;
    }
    const trustedRole = chatAuth?.userType || 'guest';
    const trustedEngineerId =
      chatAuth?.userType === 'engineer' ? chatAuth.userId : null;
    const trustedCustomerId =
      chatAuth?.userType === 'customer' ? chatAuth.userId : null;

    // ============ 访客 IP 小时级限流（短窗口防刷）============
    const effectiveUserType = trustedRole;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (effectiveUserType === 'guest') {
      const rateLimitKey = `rate:${clientIP}`;
      const rateLimitWindow = 3600; // 1小时窗口
      const maxMessagesPerWindow = 30; // 最多30条消息/小时

      try {
        const currentCount = await env.KV.get(rateLimitKey);
        const count = parseInt(currentCount || '0', 10);

        if (count >= maxMessagesPerWindow) {
          return jsonResponse({
            error: '请求过于频繁，请稍后再试。您已达到每小时30条消息的限制。'
          }, 429);
        }

        // 使用 KV 的 put 方法，带过期时间
        await env.KV.put(rateLimitKey, String(count + 1), { expirationTtl: rateLimitWindow });
      } catch (kvErr) {
        // KV 错误不影响主流程，仅限流保护
        console.error('Rate limit KV error:', kvErr);
      }
    }

    // ============ OpenAI 日配额保护（登录用户也限）============
    // 先取 JWT，拿不到就按 guest IP 计数
    let preAuth = null;
    try { preAuth = await authenticateRequest(request, env); } catch { preAuth = null; }
    const userKey = preAuth?.userId
      ? `${preAuth.userType}:${preAuth.userId}`
      : `guest:${clientIP}`;
    try {
      await enforceOpenAIBudget(env, { userKey, tag: 'chat' });
    } catch (e) {
      if (e instanceof BudgetError) {
        return jsonResponse({ error: e.message }, e.status);
      }
      throw e;
    }

    let existingConversation = null;
    if (conversation_id) {
      existingConversation = await env.DB.prepare(
        'SELECT customer_id, engineer_id FROM conversations WHERE id = ?'
      ).bind(conversation_id).first();
      if (existingConversation) {
        if (trustedRole === 'guest') {
          if (existingConversation.customer_id || existingConversation.engineer_id) {
            return errorResponse('您无权访问该对话', 403);
          }
        } else {
          assertConversationAccess(chatAuth, existingConversation);
        }
      }
    }

    // 如果有 conversation_id 且归属校验通过，先获取历史消息
    let messages = [];
    if (conversation_id && existingConversation) {
      const history = await env.DB.prepare(
        'SELECT role, content, image_urls FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
      ).bind(conversation_id).all();

      messages = history.results.map(m => {
        // 有图片的消息使用多模态格式
        let imgs = null;
        try { imgs = m.image_urls ? JSON.parse(m.image_urls) : null; } catch { imgs = null; }
        if (imgs && Array.isArray(imgs) && imgs.length > 0 && m.role === 'user') {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content },
              ...imgs.map(url => ({ type: 'image_url', image_url: { url } })),
            ],
          };
        }
        return { role: m.role, content: m.content };
      });
    }

    // ============ 分层 Prompt 构建 ============
    // Step 2: 获取数据上下文（优先根据 JWT 可信 ID 获取）
    let dataContext = '';
    if (trustedRole === 'engineer' && trustedEngineerId) {
      dataContext = await generateEngineerContext(trustedEngineerId, env);
    } else if (trustedRole === 'customer' && trustedCustomerId) {
      dataContext = await generateCustomerContext(trustedCustomerId, env);
    }

    // Step 3: 获取对应 Role Prompt
    // 如果数据上下文为空（ID无效或DB错误），降级为 guest Role Prompt
    // 避免 Role Prompt 说"你有 X 个待接单"但 AI 不知道数据
    let rolePrompt;
    if (dataContext) {
      rolePrompt = ROLE_PROMPTS[effectiveUserType] || ROLE_PROMPTS.guest;
    } else {
      rolePrompt = ROLE_PROMPTS.guest;
    }

    // Step 4: 拼接完整 System Prompt
    // 顺序：Base → Role → Context
    const requestHost = new URL(request.url).hostname;
    const originHost = request.headers.get('Origin') || '';
    const isChinaMarket =
      client_market === 'cn' ||
      client_locale === 'zh-CN' ||
      requestHost.endsWith('.cn') ||
      originHost.includes('sagemro.cn');
    const marketCode = isChinaMarket ? 'cn' : 'com';
    const localeCode = isChinaMarket ? 'zh-CN' : 'en';
    const detectedIntent = detectAiIntent(message);
    const preferredLanguage = isChinaMarket ? 'Simplified Chinese' : 'English';
    const languageDirective = `
## Critical output language for this turn

You MUST answer this turn in ${preferredLanguage}, unless the user's current message explicitly asks for another language.
This instruction overrides examples, role prompts, previous conversation language, and the language used in the system prompt itself.
For sagemro.cn, English alarm codes, brand names, CNC terms, or short English phrases do not count as a request to answer in English.
Default first-turn structure:
- Give 1 likely direction.
- Give exactly 3 practical checks, one short sentence each.
- Ask exactly 1 follow-up question. Add a SAGEMRO official follow-up offer only when the issue needs human confirmation, quotation, parts, site service, safety handling, or the user asks to proceed.
Exactly 5 short lines. Keep the first answer concise: usually 80-140 Chinese characters or 50-90 English words, unless the user asks for a detailed plan, table, report, or full checklist.
Each line must be a complete sentence under 28 Chinese characters or 18 English words. Avoid parentheses, long explanations, and multiple causes in one line.
`;
    const marketContext = `

## 当前请求上下文
- API host: ${requestHost}
- Origin: ${originHost || 'not provided'}
- Client market: ${client_market || 'not provided'}
- Client locale: ${client_locale || 'not provided'}
- Market: ${isChinaMarket ? 'China edition / sagemro.cn' : 'International edition / sagemro.com'}
- Required default reply language: ${preferredLanguage}

Follow the language policy strictly. Unless the user's current message explicitly asks for another language, reply in the Required default reply language for this turn.`;
    const responseContract = `

## This is the final response contract for the current turn
- Reply in ${preferredLanguage}.
- If the user did not explicitly request a detailed plan, table, report, or full checklist, write exactly 5 compact lines:
  1. Most likely direction.
  2. Check 1 in one short sentence.
  3. Check 2 in one short sentence.
  4. Check 3 in one short sentence.
  5. Exactly one follow-up question. Add a short SAGEMRO official follow-up offer only when manual confirmation, quotation, parts, service scheduling, safety handling, or official parameter verification is clearly useful.
- Do not push a work order or service request after a simple question is already answered clearly.
- Do not add extra sections after line 5.
- Avoid parentheses and long cause lists in quick answers.
- Do not let the answer end mid-sentence.`;
    const fullSystemPrompt = languageDirective + SYSTEM_PROMPT + rolePrompt + marketContext + dataContext + responseContract;

    // 创建或更新对话（customer_id / engineer_id 只接受 JWT 信任值）
    let convId = conversation_id;
    if (!convId || !existingConversation) {
      convId = convId || generateId();
      await env.DB.prepare(
        'INSERT INTO conversations (id, title, last_message, customer_id, engineer_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(convId, truncateStr(message, 20), truncateStr(message, 50), trustedCustomerId, trustedEngineerId).run();
    } else {
      await env.DB.prepare(
        'UPDATE conversations SET last_message = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(truncateStr(message, 50), convId).run();
    }

    // 保存用户消息（含图片 URL）
    const userMsgId = generateId();
    const imageUrlsJson = imageUrls.length > 0 ? JSON.stringify(imageUrls.map(i => i.url)) : null;
    await env.DB.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, image_urls) VALUES (?, ?, ?, ?, ?)'
    ).bind(userMsgId, convId, 'user', message, imageUrlsJson).run();

    // 流式返回响应（Phase 0.3：多轮 tool call while 循环）
    // 每轮都带 tools 参数，允许 AI 链式调多个工具；最后一轮强制不带 tools，逼 LLM 产出文本。
    const encoder = new TextEncoder();
    // 只累积发给客户端的 content（不含 tool_calls JSON），写入 messages 表
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        // 当前用户消息：有图片时使用多模态格式
        const userMessageContent = imageUrls.length > 0
          ? [
              { type: 'text', text: message },
              ...imageUrls.map(i => ({ type: 'image_url', image_url: { url: i.url } })),
            ]
          : message;

        let currentMessages = [
          { role: 'system', content: fullSystemPrompt },
          ...messages,
          { role: 'user', content: userMessageContent },
        ];
        let iteration = 0;

        // 服务端直接创建工单：当 AI 展示了工单汇总且用户确认时，
        // 绕过不可靠的 AI function calling，直接在服务端创建工单并注入结果。
        let preInjectedWorkOrder = null;
        if (effectiveUserType === 'customer' && trustedCustomerId && messages.length >= 2) {
          const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
          const lastUser = [...messages].reverse().find((m) => m.role === 'user');
          if (lastAssistant && lastUser) {
            const aiText = lastAssistant.content || '';
            const userText = (message || '').trim() || lastUser.content || '';
            const hasSummary =
              aiText.includes('汇总') || aiText.includes('确认无误') ||
              aiText.includes('工单信息') || aiText.includes('帮您确认') ||
              aiText.includes('提交工单') || aiText.includes('确认一下') ||
              aiText.includes('梳理') || aiText.includes('报修信息') ||
              aiText.includes('创建工单') || aiText.includes('帮你提交') ||
              aiText.includes('没问题的话') || aiText.includes('安排工程师');
            const isConfirm =
              /^(确认|是的|对的|没错|可以|行|好|嗯|对|提交吧|创建吧|马上提交|没问题|ok|yes|yep|yeah)[\s!！。.]*$/i.test(userText.trim()) ||
              userText.includes('确认无误') || userText.includes('马上提交') ||
              userText.includes('立即创建') || userText.includes('帮我提交') ||
              userText.includes('确认，') || userText.includes('确认！');
            if (hasSummary && isConfirm) {
              // 从 AI 回复中提取工单参数
              const urgencyMatch = aiText.match(/(非常紧急|很紧急|紧急|停产|critical|urgent|普通|normal)/i);
              let urgency = 'normal';
              if (urgencyMatch) {
                const u = urgencyMatch[0].toLowerCase();
                if (u === '非常紧急' || u === '很紧急' || u === '停产' || u === 'critical') urgency = 'critical';
                else if (u === '紧急' || u === 'urgent') urgency = 'urgent';
                else urgency = 'normal';
              }
              // 尝试从 AI 文本中提取设备类型
              let woType = 'fault';
              if (aiText.includes('设备故障') || aiText.includes('故障')) woType = 'fault';
              else if (aiText.includes('维护') || aiText.includes('保养')) woType = 'maintenance';
              else if (aiText.includes('参数')) woType = 'parameter';
              else if (aiText.includes('咨询')) woType = 'consult';
              else if (aiText.includes('配件')) woType = 'parts';

              // 从对话历史中提取用户最初的问题描述
              // 对话结构: [...历史, 用户问题消息, AI汇总回复], 当前消息=用户确认
              // messages 数组不包含当前 message，所以最后一条用户消息就是问题描述
              let problemDescription = aiText.slice(0, 2000);
              const userMsgs = [...messages].filter(m => m.role === 'user');
              if (userMsgs.length >= 1) {
                problemDescription = (userMsgs[userMsgs.length - 1].content || '').slice(0, 2000);
              }
              const result = await toolCreateWorkOrder({
                customerId: trustedCustomerId,
                env,
                ctx: request._ctx,
                conversationId: convId,
                args: {
                  type: woType,
                  description: problemDescription,
                  urgency,
                },
              });
              preInjectedWorkOrder = result;
              // 把创建结果注入到消息历史，让 AI 基于真实数据回复
              if (result.success) {
                currentMessages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: 'svr_' + generateId(),
                    type: 'function',
                    function: { name: 'create_work_order', arguments: JSON.stringify({ type: woType, description: (message || aiText).slice(0, 2000), urgency }) }
                  }]
                });
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: currentMessages[currentMessages.length - 1].tool_calls[0].id,
                  content: JSON.stringify(result),
                });
              }
            }
          }
        }

        try {
          const firstTurnMaxTokens = wantsDetailedAnswer(message)
            ? MAX_TOKENS.chat
            : MAX_TOKENS.chat_quick;
          while (true) {
            const canCallTools = iteration < MAX_TOOL_ITERATIONS;
            let retriedEmptyStream = false;
            const requestBody = {
              model: getChatModel(env),
              messages: currentMessages,
              stream: true,
              temperature: 0.7,
              max_tokens:
                iteration === 0 ? firstTurnMaxTokens : MAX_TOKENS.chat_tool_followup,
            };
            if (effectiveUserType !== 'guest' && canCallTools && !preInjectedWorkOrder?.success) {
              requestBody.tools = TOOLS_SCHEMAS;
              requestBody.tool_choice = 'auto';
            }

            const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!apiResponse.ok) {
              // 上游失败：发系统兜底文本，Sentry 上报，退出循环
              const errText = await apiResponse.text().catch(() => 'upstream error');
              console.error(
                '[chat] LLM upstream failed:',
                apiResponse.status,
                redactPII(errText).slice(0, 800),
              );
              const fallback = getAiFallbackMessage(env);
              fullContent += fallback;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content: fallback, conversation_id: convId })}\n`,
                ),
              );
              try {
                captureException(
                  new Error(`LLM upstream ${apiResponse.status}: ${errText}`),
                );
              } catch {
                /* Sentry 本身失败不影响主流程 */
              }
              break;
            }

            const {
              content: roundContent,
              toolCalls,
              reasoningContent: roundReasoning,
              finishReason,
            } = await consumeLlmStream({
              response: apiResponse,
              controller,
              encoder,
              convId,
              decoder,
            });
            fullContent += roundContent;

            // 本轮无 tool_calls（或已达上限）→ 这就是最终答复，退出
            if (!canCallTools || toolCalls.length === 0) {
              if (!fullContent) {
                if (!retriedEmptyStream && iteration === 0 && effectiveUserType === 'guest') {
                  retriedEmptyStream = true;
                  const retryMessages = [
                    {
                      role: 'system',
                      content: `Reply in ${preferredLanguage}. Give exactly 5 short lines: likely direction, 3 checks, and 1 follow-up question. Add a SAGEMRO official follow-up offer only when manual confirmation, quotation, parts, site service, safety handling, or official parameter verification is clearly useful. Keep every line complete and concise.`,
                    },
                    { role: 'user', content: userMessageContent },
                  ];
                  const retryResponse = await fetch(env.OPENAI_API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                      model: getChatModel(env),
                      messages: retryMessages,
                      stream: true,
                      temperature: 0.3,
                      max_tokens: MAX_TOKENS.chat_quick,
                    }),
                  });
                  if (retryResponse.ok) {
                    const {
                      content: retryContent,
                      finishReason: retryFinishReason,
                    } = await consumeLlmStream({
                      response: retryResponse,
                      controller,
                      encoder,
                      convId,
                      decoder,
                    });
                    fullContent += retryContent;
                    if (shouldAppendTruncatedRecovery(fullContent, retryFinishReason)) {
                      const recovery = getTruncatedAiResponseRecovery(isChinaMarket);
                      fullContent += recovery;
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content: recovery, conversation_id: convId })}\n`,
                        ),
                      );
                    }
                  }
                }
              }
              if (!fullContent) {
                const fallback =
                  getKnownTechnicalFallback(message, isChinaMarket) ||
                  getEmptyAiResponseFallback(isChinaMarket);
                fullContent += fallback;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ content: fallback, conversation_id: convId })}\n`,
                  ),
                );
              } else if (shouldAppendTruncatedRecovery(fullContent, finishReason)) {
                const recovery = getTruncatedAiResponseRecovery(isChinaMarket);
                fullContent += recovery;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ content: recovery, conversation_id: convId })}\n`,
                  ),
                );
              }
              break;
            }

            // 把本轮 assistant（带 tool_calls）追加进历史
            // DeepSeek V4 Pro thinking 模式要求原样传回 reasoning_content
            const assistantMsg = {
              role: 'assistant',
              content: roundContent || null,
              tool_calls: toolCalls,
            };
            if (roundReasoning) {
              assistantMsg.reasoning_content = roundReasoning;
            }
            currentMessages = [...currentMessages, assistantMsg];

            // 并行执行所有 tool_calls —— executeTool 内部已有 role guard + trace + fallback
            const toolResults = await Promise.all(
              toolCalls.map(async (tc) => {
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(tc.function?.arguments || '{}');
                } catch {
                  parsedArgs = {};
                }
                const result = await executeTool({
                  toolName: tc.function?.name,
                  args: parsedArgs,
                  env,
                  ctx: request._ctx,
                  userRole: trustedRole,
                  engineerId: trustedEngineerId,
                  customerId: trustedCustomerId,
                  conversationId: convId,
                  iteration,
                });
                return { tool_call_id: tc.id, result };
              }),
            );

            // 把 tool 结果作为 tool 角色消息追加
            for (const { tool_call_id, result } of toolResults) {
              currentMessages.push({
                role: 'tool',
                tool_call_id,
                content: JSON.stringify(result),
              });
            }

            iteration++;
          }
        } catch (e) {
          console.error('[chat] LLM stream failed:', e?.message || e);
          const fallback = getAiFallbackMessage(env, e);
          if (!fullContent) {
            fullContent += fallback;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: fallback, conversation_id: convId })}\n`,
              ),
            );
          }
          try {
            captureException(e);
          } catch {
            /* 吃掉 */
          }
        } finally {
          // 统一下发 [DONE] —— 外层控制，不被中间轮次提前触发
          controller.enqueue(encoder.encode('data: [DONE]\n'));

          // 保存 AI 最终响应到数据库
          if (fullContent) {
            try {
              await env.DB.prepare(
                'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
              ).bind(generateId(), convId, 'assistant', fullContent).run();
            } catch {
              /* 保存失败不影响客户端已收到的流 */
            }

            try {
              await logAiInteraction(env, {
                conversationId: convId,
                userId: trustedEngineerId || trustedCustomerId || null,
                userType: trustedRole,
                market: marketCode,
                locale: localeCode,
                intent: detectedIntent,
                message,
                response: fullContent,
                model: getChatModel(env),
                promptVersion: AI_PROMPT_VERSION,
                knowledgeVersion: AI_KNOWLEDGE_VERSION,
                responseTimeMs: Date.now() - chatStartedAt,
                createdWorkOrder: !!preInjectedWorkOrder?.success,
              });
            } catch {
              /* AI interaction logging is observational and must not affect chat delivery. */
            }

            // Phase 1.3：达到阈值（消息 ≥6 且距上次摘要 ≥3）后台生成 SummaryProtocol v1 摘要
            // 失败静默 —— generateSummaryForConversation 内部已 try/catch + trace；此处再裹一层防御
            try {
              const countRow = await env.DB.prepare(
                `SELECT COUNT(*) AS total,
                        COALESCE(
                          (SELECT summary_message_count FROM conversations WHERE id = ?),
                          0
                        ) AS summary_message_count
                   FROM messages WHERE conversation_id = ?`
              ).bind(convId, convId).first();

              const total = Number(countRow?.total || 0);
              const summaryMessageCount = Number(countRow?.summary_message_count || 0);

              if (shouldTriggerSummary({ total, summaryMessageCount })) {
                const summaryPromise = generateSummaryForConversation({
                  conversationId: convId,
                  env,
                  ctx: request._ctx,
                  userRole: trustedRole || 'system',
                  userId: trustedEngineerId || trustedCustomerId || null,
                });
                if (request._ctx && typeof request._ctx.waitUntil === 'function') {
                  request._ctx.waitUntil(summaryPromise.catch(() => {}));
                } else {
                  // 无 ctx（测试/本地直跑）时 fire-and-forget
                  summaryPromise.catch(() => {});
                }
              }
            } catch {
              /* 阈值判断或调度失败一律静默，不影响 chat 主流程 */
            }
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', ...corsHeaders },
    });
  } catch (error) {
    if (error instanceof GuardError) {
      return errorResponse(error.message, error.status);
    }
    return jsonResponse({ error: error.message }, 500);
  }
}

// 获取对话列表（按当前登录用户归属过滤，admin 可查全部）
async function handleGetConversations(request, env) {
  try {
    const auth = request._auth;
    if (!auth) return errorResponse('请先登录', 401);

    let results;
    if (auth.userType === 'admin') {
      const r = await env.DB.prepare(
        'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
      ).all();
      results = r.results;
    } else if (auth.userType === 'customer') {
      const r = await env.DB.prepare(
        'SELECT * FROM conversations WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 50'
      ).bind(auth.userId).all();
      results = r.results;
    } else if (auth.userType === 'engineer') {
      const r = await env.DB.prepare(
        'SELECT * FROM conversations WHERE engineer_id = ? ORDER BY updated_at DESC LIMIT 50'
      ).bind(auth.userId).all();
      results = r.results;
    } else {
      results = [];
    }

    return jsonResponse({ conversations: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取对话详情
async function handleGetConversation(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    const conv = await env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).bind(id).first();

    assertConversationAccess(request._auth, conv);

    const messages = await env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    return jsonResponse({ ...conv, messages: messages.results });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 删除对话
async function handleDeleteConversation(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    const conv = await env.DB.prepare(
      'SELECT customer_id, engineer_id FROM conversations WHERE id = ?'
    ).bind(id).first();

    assertConversationAccess(request._auth, conv);

    await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 重命名对话
async function handleRenameConversation(request, env) {
  const id = new URL(request.url).pathname.split('/')[3]; // /api/conversations/:id
  try {
    const { title } = await request.json();
    if (typeof title !== 'string' || !title.trim()) {
      return errorResponse('title 不能为空', 400);
    }
    // 先上限检查，再 trim+slice。防止客户端先发 MB 级文本再靠 slice 兜底
    // 导致 D1 / JSON parse 已经吃了无意义负载。
    try {
      assertMaxLength(title, 'title', LIMITS.title);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }
    const trimmed = title.trim().slice(0, 50); // 最终入库仍限制 50 字（与历史行为一致）

    const conv = await env.DB.prepare(
      'SELECT customer_id, engineer_id FROM conversations WHERE id = ?'
    ).bind(id).first();
    assertConversationAccess(request._auth, conv);

    const result = await env.DB.prepare(
      'UPDATE conversations SET title = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(trimmed, id).run();

    if (!result.success) return errorResponse('重命名失败', 500);
    return jsonResponse({ success: true, title: trimmed });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// ============ 工单相关 ============

// 工单类型标签映射
const WORK_ORDER_TYPE_LABELS = {
  fault: '设备故障',
  maintenance: '维护保养',
  parameter: '参数调试',
  consult: '技术咨询',
  parts: '配件采购',
  aftersales: '售后服务',
  other: '其他'
};

// 生成工单 AI 摘要
async function generateWorkOrderSummary(type, description, urgency, env) {
  // 后台系统调用，计入全平台日配额（不占用任何用户个人配额）
  try {
    await enforceOpenAIBudget(env, { userKey: 'system:summary', tag: 'summary' });
  } catch (e) {
    if (e instanceof BudgetError) {
      console.warn('[generateWorkOrderSummary] skipped by budget:', e.message);
      return null;
    }
    throw e;
  }
  const typeLabel = WORK_ORDER_TYPE_LABELS[type] || type;

  const prompt = `你是工单分析助手。当客户提交一个维修工单时，你需要生成一个简洁的摘要，帮助工程师快速了解工单情况。

工单信息：
- 类型：${typeLabel}
- 描述：${description}
- 紧急程度：${urgency === 'critical' ? '非常紧急' : urgency === 'urgent' ? '紧急' : '普通'}

请生成以下格式的 JSON 响应（只返回 JSON，不要有其他内容）：
{
  "summary": "用2-3句话概括这个工单的核心问题和建议的处理方向",
  "required_specialties": ["需要的最匹配的设备类型标签，如激光切割机、折弯机等"],
  "suggested_skills": ["建议的技术能力标签，如激光器维修、参数调试等"],
  "urgency_notes": "如果紧急，说明为什么紧急和需要注意的事项"
}

只返回 JSON，不要有其他内容。`;

  try {
    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: getJsonModel(env),
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false,
        temperature: 0.3,
        max_tokens: MAX_TOKENS.summary,
      }),
    });

    if (!apiResponse.ok) {
      console.error('AI summary API error:', await apiResponse.text());
      return null;
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return null;

    // 尝试解析 JSON
    try {
      // 去除可能的 markdown 代码块
      const jsonStr = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI summary JSON:', parseError, content);
      return null;
    }
  } catch (error) {
    console.error('generateWorkOrderSummary error:', error);
    return null;
  }
}

// 创建工单
async function handleCreateWorkOrder(request, env) {
  try {
    const { customer_id, type, description, urgency, device_id, category_l1, category_l2, conversation_id } = await request.json();

    if (!customer_id || !type || !description) {
      return errorResponse('缺少必填字段');
    }

    // 输入长度上限：防止客户端粘贴巨型文本打爆 D1 / AI 请求
    try {
      assertMaxLength(description, 'description', LIMITS.description);
      assertMaxLength(type, 'type', LIMITS.type);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 分类字段校验：必须是合法值
    const ALLOWED_CATEGORIES_L1 = [
      'laser_cutting', 'bending', 'punching', 'welding',
      'surface_treatment', 'auxiliary', 'cnc_automation', 'inspection', 'other',
    ];
    const catL1 = ALLOWED_CATEGORIES_L1.includes(category_l1) ? category_l1 : 'other';

    // PII 脱敏（Phase 0.5）：手机号/邮箱/身份证/银行卡/车牌等在入库前替换为占位符
    // 注：device_id / type / urgency 是枚举/引用，不脱敏。只洗用户自由输入的 description
    const safeDescription = redactPII(description);

    const id = generateId();
    const order_no = generateOrderNo();

    const slaDeadline = computeSlaDeadline(urgency || 'normal');

    await env.DB.prepare(`
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, device_id, status, sla_deadline, category_l1, category_l2)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(id, order_no, customer_id, type, safeDescription, urgency || 'normal', device_id || null, slaDeadline, catL1, category_l2 || 'other').run();
    // 记录日志
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), id, 'created', 'customer', customer_id, '创建工单').run();

    const attachedImages = await attachConversationImagesToWorkOrder(env, {
      workOrderId: id,
      conversationId: conversation_id,
      uploaderType: 'customer',
      uploaderId: customer_id,
    });

    // AI 摘要异步生成：不阻塞响应，生成完成后回写 ai_summary
    // 使用 ctx.waitUntil 保证 Worker 在返回响应后仍会完成该任务
    const ctx = request._ctx;
    const aiSummaryPromise = generateWorkOrderSummary(type, safeDescription, urgency, env)
      .then(async (summary) => {
        if (summary) {
          await env.DB.prepare('UPDATE work_orders SET ai_summary = ? WHERE id = ?')
            .bind(JSON.stringify(summary), id)
            .run();
        }
      })
      .catch((err) => console.error('[handleCreateWorkOrder] AI summary failed:', err));
    if (ctx?.waitUntil) {
      ctx.waitUntil(aiSummaryPromise);
    }

    // 工程师匹配与推送先基于 type/description/urgency 规则侧，不等待 AI 摘要。
    // （AI 摘要完成后，后续轮派单/工程师自主接单时已能读到。）
    const workOrderData = {
      id,
      order_no,
      type,
      description,
      urgency,
      ai_summary: null,
      customer_id,
    };

    // 查找匹配的工程师并发送推送通知
    const matchingEngineers = await findMatchingEngineers(workOrderData, env);

    // 过滤出有 playerId 的工程师（只有订阅了推送的才发）
    const engineersWithPush = matchingEngineers.filter(e => e.onesignal_player_id);

    const typeLabels = {
      fault: '设备故障',
      maintenance: '维护保养',
      parameter: '参数调试',
      consult: '技术咨询',
      parts: '配件采购',
      aftersales: '售后服务',
      other: '其他'
    };
    const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    for (const engineer of matchingEngineers) {
      if (engineer.onesignal_player_id) {
        const pushTitle = '📋 New Service Assignment';
        const pushTitleZh = '📋 新服务任务待确认';
        const pushMessage = `Service: ${order_no} | Type: ${typeLabels[type] || type} | Urgency: ${urgencyLabels[urgency] || urgency}`;
        const pushMessageZh = `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`;
        await sendPushToEngineer(engineer.id, env, {
          title: pushTitle,
          titleZh: pushTitleZh,
          message: pushMessage,
          messageZh: pushMessageZh,
          data: { work_order_id: id, type: 'new_ticket' }
        });
      }
    }

    // 创建通知 — 通知匹配到的工程师
    for (const engineer of matchingEngineers) {
      await createNotification(env, {
        user_id: engineer.id,
        user_type: 'engineer',
        type: 'new_ticket',
        title: '新服务任务待确认',
        body: `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
        data: { work_order_id: id, order_no },
      });
    }

    return jsonResponse({
      success: true,
      work_order: { id, order_no, status: 'pending', ai_summary: null, ai_summary_pending: true },
      attached_images_count: attachedImages,
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师匹配系统 ============

// 专长关键词映射 —— 将描述性专长名归一化到标准设备类型，解决"冲压专家"匹配不到"冲床"的问题
const SPECIALTY_ALIASES = {
  '冲压': ['冲床', '数控冲床', '转塔冲床', '冲压机', '压力机'],
  '冲床': ['冲压机', '压力机', '数控冲床', '转塔冲床'],
  '折弯': ['折弯机'],
  '焊接': ['焊接机', 'MIG焊机', 'MAG焊机', 'TIG焊机', '激光焊接', '电阻焊', '点焊机', '焊接机器人'],
  '激光切割': ['激光切割机', '激光焊接'],
  '等离子': ['等离子切割', '等离子切割机'],
  '水刀': ['水刀切割', '水刀切割机'],
  '水切割': ['水刀切割', '水刀切割机'],
  '剪板': ['剪板机'],
  '卷板': ['卷板机'],
  '喷涂': ['喷涂设备', '喷砂机', '抛丸机'],
  '去毛刺': ['去毛刺机', '砂光机'],
  '除尘': ['除尘设备'],
  '空压': ['空压机'],
  '冷却': ['冷水机'],
  '清洗': ['清洗设备'],
  '全科': ['激光切割机', '折弯机', '冲床', '焊接机', '激光焊接', '卷板机', '等离子切割', '水刀切割', '剪板机', '冲压机'], // "全科"匹配所有常见设备
};

/**
 * 将专长标签展开为一组标准化关键词，支持模糊匹配。
 * "冲压专家" → ["冲压专家", "冲床", "数控冲床", "转塔冲床", "冲压机", "压力机"]
 */
function expandSpecialtyKeywords(specialty) {
  const keywords = new Set();
  keywords.add(specialty);
  for (const [key, aliases] of Object.entries(SPECIALTY_ALIASES)) {
    if (specialty.includes(key)) {
      keywords.add(key);
      aliases.forEach(a => keywords.add(a));
    }
  }
  return [...keywords];
}

/** 检查两个专长标签是否匹配（支持同义词展开和关键词重叠） */
function specialtiesMatch(engineerSpecialty, requiredSpecialty) {
  // 直接子串匹配
  if (engineerSpecialty.includes(requiredSpecialty) || requiredSpecialty.includes(engineerSpecialty)) {
    return true;
  }
  // 展开关键词后检查重叠
  const engKeywords = expandSpecialtyKeywords(engineerSpecialty);
  const reqKeywords = expandSpecialtyKeywords(requiredSpecialty);
  return engKeywords.some(ek => reqKeywords.some(rk => ek.includes(rk) || rk.includes(ek)));
}

// 查找匹配的工程师
async function findMatchingEngineers(workOrder, env) {
  try {
    // 解析 AI 摘要
    let aiSummary = null;
    if (workOrder.ai_summary) {
      try {
        aiSummary = typeof workOrder.ai_summary === 'string'
          ? JSON.parse(workOrder.ai_summary)
          : workOrder.ai_summary;
      } catch (e) {
        console.error('Failed to parse ai_summary:', e);
      }
    }

    // 提取需要匹配的设备类型
    // 优先使用 AI 摘要中的 required_specialties；否则从描述中提取设备类型关键词
    const requiredSpecialties = new Set();
    if (aiSummary?.required_specialties && aiSummary.required_specialties.length > 0) {
      aiSummary.required_specialties.forEach(s => requiredSpecialties.add(s));
    } else {
      // 从工单描述中提取设备类型关键词（描述格式："设备类型：激光切割机、折弯机；..."）
      const deviceTypes = [
        '激光切割机', '折弯机', '冲床', '数控冲床', '转塔冲床',
        '焊接机', '激光焊接', 'MIG焊机', 'MAG焊机', 'TIG焊机', '氩弧焊',
        '电阻焊', '点焊机', '焊接机器人',
        '卷板机', '等离子切割', '等离子切割机', '水刀切割', '水刀切割机',
        '剪板机', '冲压机', '压力机', '旋压机', '拉伸设备',
        '去毛刺机', '砂光机', '抛丸机', '喷砂机', '喷涂设备',
        '清洗设备', '空压机', '冷水机', '除尘设备',
        '数控系统', '伺服驱动', '工业机器人', '三坐标测量',
      ];
      const desc = (workOrder.description || '').replace(/；/g, ';').replace(/：/g, ':');
      // 尝试从 "设备类型: xxx" 格式中提取
      const typeMatch = desc.match(/设备类型[:：]\s*([^;；]+)/);
      if (typeMatch) {
        typeMatch[1].split(/[,，、]/).forEach(t => {
          const trimmed = t.trim();
          if (trimmed) requiredSpecialties.add(trimmed);
        });
      }
      // 补充：扫描整个描述中出现的已知设备类型关键词
      for (const dt of deviceTypes) {
        if (desc.includes(dt)) {
          requiredSpecialties.add(dt);
        }
      }
    }

    // 需要匹配的技能
    const requiredSkills = new Set();
    if (aiSummary?.suggested_skills) {
      aiSummary.suggested_skills.forEach(s => requiredSkills.add(s));
    }

    // 查询所有可用的工程师
    const engineers = await env.DB.prepare(
      'SELECT * FROM engineers WHERE status = ?'
    ).bind('available').all();

    if (!engineers.results || engineers.results.length === 0) {
      return [];
    }

    // 获取客户地区（用于地理加权匹配）
    let reqRegion = '';
    if (workOrder.customer_id) {
      const customer = await env.DB.prepare(
        'SELECT region FROM customers WHERE id = ?'
      ).bind(workOrder.customer_id).first();
      reqRegion = customer?.region || '';
    }

    // 计算每个工程师的匹配分数
    const scoredEngineers = engineers.results.map(engineer => {
      let specialtyScore = 0;
      let skillScore = 0;
      let brandBonus = 0;
      let regionBonus = 0;

      // 解析工程师的专长和技能
      let engineerSpecialties = [];
      let engineerServices = [];
      let engineerBrands = {};
      let engRegions = [];

      try {
        engineerSpecialties = typeof engineer.specialties === 'string'
          ? JSON.parse(engineer.specialties)
          : (engineer.specialties || []);
        engineerServices = typeof engineer.services === 'string'
          ? JSON.parse(engineer.services)
          : (engineer.services || []);
        engineerBrands = typeof engineer.brands === 'string'
          ? JSON.parse(engineer.brands)
          : (engineer.brands || {});
        engRegions = typeof engineer.service_region === 'string'
          ? JSON.parse(engineer.service_region)
          : (engineer.service_region || []);
      } catch (e) {
        console.error('Failed to parse engineer data:', e);
      }

      // 分类匹配加分：workOrder.category_l1 匹配工程师 specialties
      if (workOrder.category_l1 && workOrder.category_l1 !== 'other') {
        const categoryL1Map = {
          laser_cutting: ['激光切割', 'laser cutting', 'laser_cutting', 'laser'],
          bending: ['折弯', 'bending', 'bend'],
          punching: ['冲床', '冲压', 'punching', 'punch', '转塔冲'],
          welding: ['焊接', 'welding', 'weld', '焊'],
          surface_treatment: ['表面处理', '喷涂', '抛丸', '喷砂', 'surface treatment'],
          auxiliary: ['空压机', '冷水机', '冷却', '除尘', '制氮', '制氧', 'compressor', 'chiller'],
          cnc_automation: ['数控', 'CNC', '伺服', 'PLC', '机器人', 'automation'],
          inspection: ['检测', '测量', 'inspection', 'measurement'],
        };
        const catKeywords = categoryL1Map[workOrder.category_l1] || [];
        const matched = catKeywords.some(kw =>
          engineerSpecialties.some(s => s.toLowerCase().includes(kw.toLowerCase()))
        );
        if (matched) specialtyScore += 15; // 分类匹配高权重
      }

      // 计算技能匹配分数
      requiredSkills.forEach(rs => {
        if (engineerServices.some(s => s.includes(rs) || rs.includes(s))) {
          skillScore += 5;
        }
      });

      // 检查品牌熟悉度（从 AI 摘要中提取品牌信息）
      if (aiSummary?.suggested_brands) {
        aiSummary.suggested_brands.forEach(brand => {
          Object.values(engineerBrands).forEach(brandList => {
            if (Array.isArray(brandList) && brandList.some(b => b.includes(brand) || brand.includes(b))) {
              brandBonus += 3;
            }
          });
        });
      }

      // 地理区域加分（同城/同地区 +3，仅在有专长匹配时生效）
      if (specialtyScore > 0 && reqRegion) {
        const regionStr = Array.isArray(engRegions) ? engRegions.join(',') : String(engRegions);
        if (regionStr && reqRegion && (
          regionStr.includes(reqRegion) || reqRegion.includes(regionStr) ||
          regionStr.split(/[,，/、\s]+/).some(r => reqRegion.includes(r) || r.includes(reqRegion))
        )) {
          regionBonus = 3;
        }
      }

      // 计算综合评分
      const avgRating = (
        (engineer.rating_timeliness || 0) +
        (engineer.rating_technical || 0) +
        (engineer.rating_communication || 0) +
        (engineer.rating_professional || 0)
      ) / 4;

      const totalScore = specialtyScore + skillScore + brandBonus + regionBonus + (avgRating * 2);

      return {
        id: engineer.id,
        name: engineer.name,
        phone: engineer.phone,
        specialties: engineerSpecialties,
        services: engineerServices,
        brands: engineerBrands,
        service_region: engineer.service_region,
        bio: engineer.bio,
        rating_timeliness: engineer.rating_timeliness,
        rating_technical: engineer.rating_technical,
        rating_communication: engineer.rating_communication,
        rating_professional: engineer.rating_professional,
        rating_count: engineer.rating_count,
        onesignal_player_id: engineer.onesignal_player_id,
        specialtyScore,
        skillScore,
        brandBonus,
        regionBonus,
        totalScore
      };
    });

    // 按分数排序
    scoredEngineers.sort((a, b) => b.totalScore - a.totalScore);

    // 优先返回有专长匹配的工程师；仅当全部不匹配时才放宽
    const matched = scoredEngineers.filter(e => e.specialtyScore > 0);
    const result = matched.length > 0 ? matched : scoredEngineers;

    return result.slice(0, 20);
  } catch (error) {
    console.error('findMatchingEngineers error:', error);
    return [];
  }
}

// 推荐工程师接口
async function handleRecommendEngineers(request, env) {
  try {
    const workOrderId = new URL(request.url).searchParams.get('work_order_id');

    if (!workOrderId) {
      return errorResponse('缺少工单ID');
    }

    // 获取工单
    const workOrder = await env.DB.prepare(
      'SELECT * FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();

    if (!workOrder) {
      return errorResponse('工单不存在', 404);
    }

    // 查找匹配的工程师
    const engineers = await findMatchingEngineers(workOrder, env);

    return jsonResponse({ engineers });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 设备管理 API ============

// 获取客户的所有设备（含工单统计）
async function handleGetDevices(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  try {
    // 获取客户的所有设备
    const devices = await env.DB.prepare(`
      SELECT d.*,
             COUNT(w.id) as total_orders,
             SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
             MAX(w.created_at) as last_order_date
      FROM devices d
      LEFT JOIN work_orders w ON w.device_id = d.id
      WHERE d.customer_id = ?
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `).bind(customerId).all();

    return jsonResponse({ devices: devices.results || [] });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取单个设备详情（含维修记录）
async function handleGetDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 获取设备信息
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    // 获取关联的工单（维修记录）
    const workOrders = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status,
             w.created_at, w.completed_at,
             e.name as engineer_name,
             r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN ratings r ON r.work_order_id = w.id
      WHERE w.device_id = ?
      ORDER BY w.created_at DESC
      LIMIT 20
    `).bind(id).all();

    // 计算费用明细（从工单消息中提取，需要单独查询 pricing）
    const workOrdersWithCost = await Promise.all((workOrders.results || []).map(async (wo) => {
      let costSummary = null;
      try {
        const pricing = await env.DB.prepare(
          'SELECT labor_fee, parts_fee, travel_fee FROM work_order_pricing WHERE work_order_id = ?'
        ).bind(wo.id).first();
        if (pricing) {
          costSummary = {
            labor: pricing.labor_fee || 0,
            parts: pricing.parts_fee || 0,
            travel: pricing.travel_fee || 0
          };
        }
      } catch (e) {}

      const avgRating = (wo.rating_timeliness + wo.rating_technical +
                         wo.rating_communication + wo.rating_professional) / 4;

      return {
        id: wo.id,
        order_no: wo.order_no,
        type: wo.type,
        description: wo.description,
        urgency: wo.urgency,
        status: wo.status,
        engineer_name: wo.engineer_name || '未知',
        rating: avgRating > 0 ? avgRating.toFixed(1) : null,
        cost_summary: costSummary,
        created_at: wo.created_at,
        completed_at: wo.completed_at
      };
    }));

    return jsonResponse({
      device,
      work_orders: workOrdersWithCost
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 添加新设备
async function handleCreateDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  try {
    const body = await request.json();
    const { name, type, brand, model, power } = body;

    if (!type) {
      return errorResponse('设备类型不能为空', 400);
    }

    try {
      assertFieldLimits(body, {
        name: LIMITS.name,
        type: LIMITS.type,
        brand: LIMITS.brand,
        model: LIMITS.model,
        power: LIMITS.power,
      });
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO devices (id, customer_id, name, type, brand, model, power, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', datetime('now'))
    `).bind(id, customerId, name || '', type, brand || '', model || '', power || '').run();

    const device = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();

    return jsonResponse({ device }, 201);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新设备
async function handleUpdateDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 验证设备归属
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    const body = await request.json();
    let { name, type, brand, model, power, status, photo_url, notes } = body;

    try {
      assertFieldLimits(body, {
        name: LIMITS.name,
        type: LIMITS.type,
        brand: LIMITS.brand,
        model: LIMITS.model,
        power: LIMITS.power,
        notes: LIMITS.notes,
      });
      // photo_url：未提供时（undefined）保持原值；提供空字符串时清空；
      // 提供非空字符串时必须过 https + 白名单校验
      if (photo_url !== undefined) {
        photo_url = validateImageUrl(photo_url, 'photo_url');
      }
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // PII 脱敏（Phase 0.5）：notes 是用户自由输入，可能包含手机号/地址等
    // name / type / brand / model / power 是设备元数据，不脱敏（型号/功率要保留给 RAG）
    const safeNotes = typeof notes === 'string' ? redactPII(notes) : notes;

    await env.DB.prepare(`
      UPDATE devices
      SET name = ?, type = ?, brand = ?, model = ?, power = ?, status = ?, photo_url = ?, notes = ?
      WHERE id = ?
    `).bind(
      name ?? device.name,
      type ?? device.type,
      brand ?? device.brand,
      model ?? device.model,
      power ?? device.power,
      status ?? device.status,
      photo_url ?? device.photo_url,
      safeNotes ?? device.notes,
      id
    ).run();

    const updated = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();

    return jsonResponse({ device: updated });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 删除设备
async function handleDeleteDevice(request, env) {
  const customerId = request._auth?.userId;
  if (!customerId) {
    return errorResponse('未登录', 401);
  }

  const id = new URL(request.url).pathname.split('/').pop();

  try {
    // 验证设备归属
    const device = await env.DB.prepare(
      'SELECT * FROM devices WHERE id = ? AND customer_id = ?'
    ).bind(id, customerId).first();

    if (!device) {
      return errorResponse('设备不存在', 404);
    }

    // 删除设备（工单关联的外键设为 NULL，而非 cascade delete）
    await env.DB.prepare('UPDATE work_orders SET device_id = NULL WHERE device_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取客户的工单列表
async function handleGetWorkOrders(request, env) {
  // 优先使用认证信息中的 userId，其次使用查询参数
  const customerId = request._auth?.userId || new URL(request.url).searchParams.get('customer_id');

  try {
    let query = `
      SELECT
        w.*,
        e.name as engineer_name,
        e.phone as engineer_phone,
        e.rating_technical as engineer_rating,
        e.level as engineer_level,
        e.commission_rate as engineer_commission_rate,
        e.credit_score as engineer_credit_score
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
    `;
    let params = [];

    if (customerId) {
      query += ' WHERE w.customer_id = ?';
      params = [customerId];
    }

    query += ' ORDER BY w.created_at DESC LIMIT 50';

    const { results } = await env.DB.prepare(query).bind(...params).all();

    const workOrders = results.map(wo => ({
      ...wo,
      sla_status: getSlaStatus(wo.sla_deadline, wo.urgency),
    }));

    return jsonResponse({ work_orders: workOrders });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单详情
async function handleGetWorkOrder(request, env) {
  const id = new URL(request.url).pathname.split('/').pop();

  try {
    const workOrder = await env.DB.prepare(`
      SELECT
        w.*,
        e.name as engineer_name,
        e.phone as engineer_phone,
        e.level as engineer_level,
        e.commission_rate as engineer_commission_rate,
        e.credit_score as engineer_credit_score,
        c.name as customer_name,
        c.phone as customer_phone
      FROM work_orders w
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN customers c ON w.customer_id = c.id
      WHERE w.id = ?
    `).bind(id).first();

    assertWorkOrderAccess(request._auth, workOrder);

    const logs = await env.DB.prepare(
      'SELECT * FROM work_order_logs WHERE work_order_id = ? ORDER BY created_at ASC'
    ).bind(id).all();

    // 查询评价数据
    const rating = await env.DB.prepare(
      'SELECT * FROM ratings WHERE work_order_id = ?'
    ).bind(id).first();

    let adminReply = null;
    if (rating) {
      adminReply = await env.DB.prepare(
        'SELECT * FROM admin_replies WHERE rating_id = ?'
      ).bind(rating.id).first();
    }

    let engineerReview = null;
    if (request._auth?.userType === 'admin' || request._auth?.userType === 'engineer') {
      engineerReview = await env.DB.prepare(`
        SELECT er.*, e.name as engineer_name, c.name as customer_name
        FROM engineer_reviews er
        LEFT JOIN engineers e ON er.engineer_id = e.id
        LEFT JOIN customers c ON er.customer_id = c.id
        WHERE er.work_order_id = ?
      `).bind(id).first();
    }

    const repairRecord = await env.DB.prepare(
      'SELECT * FROM work_order_repair_records WHERE work_order_id = ?'
    ).bind(id).first();

    const attachments = await env.DB.prepare(
      'SELECT * FROM work_order_attachments WHERE work_order_id = ? ORDER BY created_at DESC'
    ).bind(id).all();

    return jsonResponse({
      ...workOrder,
      sla_status: getSlaStatus(workOrder.sla_deadline, workOrder.urgency),
      logs: logs.results,
      rating: rating || null,
      admin_reply: adminReply || null,
      engineer_review: engineerReview || null,
      repair_record: repairRecord || null,
      attachments: attachments.results,
    });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// ============ 维修记录（结构化） ============

// 获取工单维修记录
async function handleGetRepairRecord(request, env) {
  try {
    const auth = request._auth;
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    const workOrder = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(auth, workOrder);

    const record = await env.DB.prepare(
      'SELECT * FROM work_order_repair_records WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    return jsonResponse({ repair_record: record || null });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 保存/更新维修记录（工程师专用）
async function handleSaveRepairRecord(request, env) {
  try {
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可填写维修记录', 403);
    }
    const engineer_id = auth.userId;
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    const wo = await env.DB.prepare(
      'SELECT status, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.engineer_id !== engineer_id) {
      return errorResponse('您无权操作该工单', 403);
    }

    const body = await request.json();
    assertFieldLimits(body, {
      symptom: LIMITS.symptom,
      diagnosis: LIMITS.diagnosis,
      solution: LIMITS.solution,
    });

    let partsUsed = '[]';
    if (body.parts_used) {
      const parsed = typeof body.parts_used === 'string'
        ? JSON.parse(body.parts_used)
        : body.parts_used;
      if (!Array.isArray(parsed)) {
        return errorResponse('parts_used 必须是数组', 400);
      }
      const serialized = JSON.stringify(parsed);
      if (serialized.length > LIMITS.parts_used_json) {
        return errorResponse(`parts_used 超过最大长度 ${LIMITS.parts_used_json}`, 400);
      }
      partsUsed = serialized;
    }

    const laborHours = typeof body.labor_hours === 'number' ? body.labor_hours : 0;

    const recordId = generateId();
    await env.DB.prepare(`
      INSERT INTO work_order_repair_records (id, work_order_id, symptom, diagnosis, solution, parts_used, labor_hours, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(work_order_id) DO UPDATE SET
        symptom = excluded.symptom,
        diagnosis = excluded.diagnosis,
        solution = excluded.solution,
        parts_used = excluded.parts_used,
        labor_hours = excluded.labor_hours,
        updated_at = datetime('now')
    `).bind(
      recordId, workOrderId,
      body.symptom || null,
      body.diagnosis || null,
      body.solution || null,
      partsUsed,
      laborHours,
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'repair_record_saved', 'engineer', ?, '工程师填写了维修记录。')
    `).bind(generateId(), workOrderId, engineer_id).run();

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      const resp = validationErrorToResponse(error, errorResponse);
      if (resp) return resp;
    }
    if (error instanceof SyntaxError) {
      return errorResponse('parts_used JSON 格式错误', 400);
    }
    return errorResponse(error.message, 500);
  }
}

// ============ 工单附件 ============

async function handleUploadAttachment(request, env) {
  try {
    const auth = request._auth;
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[3];

    const workOrder = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(auth, workOrder);

    if (!env.ATTACHMENTS) {
      return errorResponse('附件服务未配置', 503);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return errorResponse('请选择文件', 400);
    }

    validateAttachmentType(file.type);
    validateAttachmentSize(file.size);

    const safeName = sanitizeFilename(file.name);
    const ext = safeName.split('.').pop().toLowerCase() || 'bin';
    const attachmentId = generateId();
    const r2Key = `attachments/${workOrderId}/${attachmentId}.${ext}`;

    await env.ATTACHMENTS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicHost = env.R2_PUBLIC_HOST || 'pub-unknown.r2.dev';
    const r2Url = `https://${publicHost}/${r2Key}`;

    await env.DB.prepare(`
      INSERT INTO work_order_attachments (id, work_order_id, uploader_type, uploader_id, file_name, file_type, file_size, r2_key, r2_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(attachmentId, workOrderId, auth.userType, auth.userId, safeName, file.type, file.size, r2Key, r2Url).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), workOrderId, 'attachment_uploaded', auth.userType, auth.userId, `上传附件: ${safeName}`).run();

    const attachment = await env.DB.prepare(
      'SELECT * FROM work_order_attachments WHERE id = ?'
    ).bind(attachmentId).first();

    return jsonResponse({ success: true, attachment }, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      const resp = validationErrorToResponse(error, errorResponse);
      if (resp) return resp;
    }
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleGetAttachments(request, env) {
  try {
    const auth = request._auth;
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    const workOrder = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(auth, workOrder);

    const attachments = await env.DB.prepare(
      'SELECT * FROM work_order_attachments WHERE work_order_id = ? ORDER BY created_at DESC'
    ).bind(workOrderId).all();

    return jsonResponse({ attachments: attachments.results, count: attachments.results.length });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleDeleteAttachment(request, env) {
  try {
    const auth = request._auth;
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[3];
    const attachmentId = segments[5];

    // 工单存在性校验
    const workOrder = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(auth, workOrder);

    const attachment = await env.DB.prepare(
      'SELECT * FROM work_order_attachments WHERE id = ? AND work_order_id = ?'
    ).bind(attachmentId, workOrderId).first();

    if (!attachment) {
      return errorResponse('附件不存在', 404);
    }

    // 仅上传者本人或 admin 可删除
    if (auth.userType !== 'admin' && (auth.userType !== attachment.uploader_type || auth.userId !== attachment.uploader_id)) {
      return errorResponse('无权删除此附件', 403);
    }

    if (env.ATTACHMENTS) {
      try {
        await env.ATTACHMENTS.delete(attachment.r2_key);
      } catch (e) {
        console.error('[handleDeleteAttachment] R2 delete failed:', e);
      }
    }

    await env.DB.prepare(
      'DELETE FROM work_order_attachments WHERE id = ?'
    ).bind(attachmentId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), workOrderId, 'attachment_deleted', auth.userType, auth.userId, `删除附件: ${attachment.file_name}`).run();

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师钱包结算 ============
// SERVICE_OS_LEGACY: old marketplace wallet settlement model. Keep for historical compatibility until internal settlement replaces it.
// 工单完成（客户已评价）后触发：按工程师等级提成，写入 engineer_wallets 流水，更新 engineers.wallet_balance。
// 幂等：以 (work_order_id, engineer_id, type='order_payment') 为唯一标识，已结算则跳过。
async function settleEngineerWallet(env, workOrderId, engineerId) {
  try {
    // 1. 已结算过则跳过（幂等）
    const existing = await env.DB.prepare(
      "SELECT id FROM engineer_wallets WHERE work_order_id = ? AND engineer_id = ? AND type = 'order_payment'"
    ).bind(workOrderId, engineerId).first();
    if (existing) return { settled: false, reason: 'already_settled' };

    // 2. 读取已确认的报价
    const pricing = await env.DB.prepare(
      'SELECT id, subtotal, status FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing || pricing.status !== 'confirmed' || !pricing.subtotal) {
      return { settled: false, reason: 'no_confirmed_pricing' };
    }

    // 3. 读取工程师提成比例与当前余额
    const eng = await env.DB.prepare(
      'SELECT commission_rate, wallet_balance FROM engineers WHERE id = ?'
    ).bind(engineerId).first();
    if (!eng) return { settled: false, reason: 'engineer_not_found' };

    const commissionRate = eng.commission_rate || 0.80;
    const subtotal = pricing.subtotal;
    // 代收代付模式：subtotal = 客户支付总额（代收）
    // engineerAmount = 维修服务费（代收代付，转付工程师）
    // platformFee = 平台技术服务费（平台营收，按6%信息技术服务纳税）
    const engineerAmount = Math.round(subtotal * commissionRate);
    const platformFee = subtotal - engineerAmount;
    const newBalance = (eng.wallet_balance || 0) + engineerAmount;

    // 4. 更新工程师余额与完成单数
    await env.DB.prepare(
      'UPDATE engineers SET wallet_balance = ?, total_orders = COALESCE(total_orders, 0) + 1, success_orders = COALESCE(success_orders, 0) + 1 WHERE id = ?'
    ).bind(newBalance, engineerId).run();

    // 5. 写入钱包流水
    await env.DB.prepare(`
      INSERT INTO engineer_wallets (id, engineer_id, work_order_id, type, amount, balance_after, status, note)
      VALUES (?, ?, ?, 'order_payment', ?, ?, 'completed', ?)
    `).bind(
      generateId(),
      engineerId,
      workOrderId,
      engineerAmount,
      newBalance,
      `代收代付结算 客户支付=${subtotal} 维修服务费(转付)=${engineerAmount} 平台技术服务费(营收)=${platformFee} 提成率=${commissionRate}`
    ).run();

    return {
      settled: true,
      subtotal,
      commission_rate: commissionRate,
      engineer_amount: engineerAmount,
      platform_fee: platformFee,
      wallet_balance: newBalance,
    };
  } catch (e) {
    console.error('settleEngineerWallet error:', e);
    return { settled: false, reason: 'exception', error: e.message };
  }
}

// 提交评价
async function handleSubmitRating(request, env) {
  try {
    const body = await request.json();
    const { work_order_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment } = body;

    try {
      assertMaxLength(comment, 'comment', LIMITS.comment);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 认证：必须由登录客户发起，engineer_id 从工单查而非客户端传
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse('仅客户可提交评价', 403);
    }
    const customer_id = auth.userId;

    if (!work_order_id) {
      return errorResponse('缺少必填字段');
    }

    // 验证工单归属 + 查出真正的 engineer_id
    const wo = await env.DB.prepare(
      'SELECT id, engineer_id, customer_id, status FROM work_orders WHERE id = ?'
    ).bind(work_order_id).first();

    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse('您无权评价该工单', 403);
    }
    if (!wo.engineer_id) {
      return errorResponse('工单尚未分配工程师', 400);
    }
    const engineer_id = wo.engineer_id;

    // 检查是否已评价
    const existing = await env.DB.prepare(
      'SELECT id FROM ratings WHERE work_order_id = ?'
    ).bind(work_order_id).first();

    if (existing) {
      return errorResponse('该工单已评价');
    }

    // 创建评价
    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment || '').run();

    // 更新工程师评分
    const ratings = await env.DB.prepare(
      'SELECT * FROM ratings WHERE engineer_id = ?'
    ).bind(engineer_id).all();

    const count = ratings.results.length;
    const avgTimeliness = ratings.results.reduce((sum, r) => sum + r.rating_timeliness, 0) / count;
    const avgTechnical = ratings.results.reduce((sum, r) => sum + r.rating_technical, 0) / count;
    const avgCommunication = ratings.results.reduce((sum, r) => sum + r.rating_communication, 0) / count;
    const avgProfessional = ratings.results.reduce((sum, r) => sum + r.rating_professional, 0) / count;

    await env.DB.prepare(`
      UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ?
      WHERE id = ?
    `).bind(avgTimeliness, avgTechnical, avgCommunication, avgProfessional, count, engineer_id).run();

    // 更新工单状态
    await env.DB.prepare(
      'UPDATE work_orders SET status = ?, completed_at = datetime("now") WHERE id = ?'
    ).bind('completed', work_order_id).run();

    // 钱包结算：按工程师提成率将确认后的报价入账
    const settlement = await settleEngineerWallet(env, work_order_id, engineer_id);

    // 通知工程师：收到新评价
    const avgAll = ((rating_timeliness + rating_technical + rating_communication + rating_professional) / 4).toFixed(1);
    const woRating = await env.DB.prepare('SELECT order_no FROM work_orders WHERE id = ?').bind(work_order_id).first();
    await createNotification(env, {
      user_id: engineer_id,
      user_type: 'engineer',
      type: 'rating_received',
      title: '收到新评价',
      body: `工单 ${woRating?.order_no || ''} 的客户给您评分 ${avgAll} 分${comment ? '："' + comment.slice(0, 30) + '"' : ''}`,
      data: { work_order_id },
    });

    // SERVICE_OS_LEGACY: settlement is kept for historical accounting compatibility,
    // but Service OS no longer exposes wallet/commission notifications to engineers.

    return jsonResponse({ success: true, settlement });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师评价客户 ============

// 提交工程师对客户的评价
async function handleSubmitEngineerReview(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { rating_cooperation, rating_communication, rating_payment, rating_environment, comment } = await request.json();

    try {
      assertMaxLength(comment, 'comment', LIMITS.comment);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 认证：必须由登录工程师发起；customer_id 从工单查
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可评价客户', 403);
    }
    const engineer_id = auth.userId;

    if (!workOrderId) {
      return errorResponse('缺少工单 ID');
    }

    // 验证工单归属该工程师 + 查出 customer_id
    const wo = await env.DB.prepare(
      'SELECT id, customer_id, status FROM work_orders WHERE id = ? AND engineer_id = ?'
    ).bind(workOrderId, engineer_id).first();

    if (!wo) {
      return errorResponse('工单不存在或非您的工单', 403);
    }
    if (!wo.customer_id) {
      return errorResponse('工单缺少客户信息', 400);
    }
    const customer_id = wo.customer_id;

    // 检查是否已评价
    const existing = await env.DB.prepare(
      'SELECT id FROM engineer_reviews WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    if (existing) {
      return errorResponse('该工单已评价');
    }

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO engineer_reviews (id, work_order_id, engineer_id, customer_id, rating_cooperation, rating_communication, rating_payment, rating_environment, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, workOrderId, engineer_id, customer_id, rating_cooperation, rating_communication, rating_payment, rating_environment, comment || '').run();

    return jsonResponse({ success: true, review_id: id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单的工程师评价（仅工程师/平台可见，客户不可见）
async function handleGetEngineerReview(request, env) {
  try {
    assertEngineerOrAdmin(request._auth);

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const review = await env.DB.prepare(
      'SELECT * FROM engineer_reviews WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    return jsonResponse({ review: review || null });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 获取某客户的所有工程师评价（仅工程师/平台可见）
async function handleGetCustomerReviews(request, env) {
  try {
    assertEngineerOrAdmin(request._auth);

    const customerId = new URL(request.url).pathname.split('/')[3];
    const reviews = await env.DB.prepare(`
      SELECT er.*, e.name as engineer_name, w.order_no
      FROM engineer_reviews er
      LEFT JOIN engineers e ON er.engineer_id = e.id
      LEFT JOIN work_orders w ON er.work_order_id = w.id
      WHERE er.customer_id = ?
      ORDER BY er.created_at DESC
    `).bind(customerId).all();

    // 计算平均分
    const results = reviews.results || [];
    const count = results.length;
    let avgCooperation = 0, avgCommunication = 0, avgPayment = 0, avgEnvironment = 0;
    if (count > 0) {
      avgCooperation = results.reduce((s, r) => s + r.rating_cooperation, 0) / count;
      avgCommunication = results.reduce((s, r) => s + r.rating_communication, 0) / count;
      avgPayment = results.reduce((s, r) => s + r.rating_payment, 0) / count;
      avgEnvironment = results.reduce((s, r) => s + r.rating_environment, 0) / count;
    }

    return jsonResponse({
      reviews: results,
      summary: { count, avgCooperation, avgCommunication, avgPayment, avgEnvironment }
    });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师相关 ============

// 获取工程师服务任务
// Service OS 默认只返回后台已派给该工程师的服务任务。
// SERVICE_OS_LEGACY: include_pending_legacy=1 时才返回旧 pending 队列。
async function handleGetEngineerTickets(request, env) {
  const url = new URL(request.url);
  const engineerId = request._auth?.userId || url.searchParams.get('engineer_id');
  const includePendingLegacy = url.searchParams.get('include_pending_legacy') === '1';

  try {
    const engineer = engineerId
      ? await env.DB.prepare('SELECT id, engineer_role FROM engineers WHERE id = ?').bind(engineerId).first()
      : null;
    const isRegionalLead = engineer?.engineer_role === 'regional_lead';

    let query = `
      SELECT
        w.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.region as customer_region,
        e.name as engineer_name
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN engineers e ON w.engineer_id = e.id
      WHERE `;

    let params = [];

    if (engineerId) {
      if (isRegionalLead) {
        query += `(w.assigned_regional_lead_id = ? OR w.engineer_id = ?)`;
        params.push(engineerId, engineerId);
      } else {
        query += `w.engineer_id = ?`;
        params.push(engineerId);
      }
      if (includePendingLegacy) {
        query += ` OR (w.status IN ('pending', 'assigned') AND NOT EXISTS (
          SELECT 1 FROM json_each(COALESCE(w.rejected_engineers, '[]')) WHERE value = ?
        ))`;
        params.push(engineerId);
      }
    } else {
      query += includePendingLegacy ? `w.status IN ('pending', 'assigned')` : `1=0`;
    }

    query += ' ORDER BY w.created_at DESC LIMIT 100';

    const { results } = await env.DB.prepare(query).bind(...params).all();

    const workOrders = results.map(wo => ({
      ...wo,
      sla_status: getSlaStatus(wo.sla_deadline, wo.urgency),
    }));

    return jsonResponse({ work_orders: workOrders });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleGetEngineerTeam(request, env) {
  try {
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('需要工程师权限', 403);
    }

    const regionalLead = await env.DB.prepare(
      "SELECT id, engineer_role FROM engineers WHERE id = ?"
    ).bind(auth.userId).first();
    if (!regionalLead || regionalLead.engineer_role !== 'regional_lead') {
      return errorResponse('仅区域负责人可查看团队工程师', 403);
    }

    const team = await env.DB.prepare(`
      SELECT id, user_no, name, phone, service_region, status, specialties,
             rating_technical, rating_count, workload_status, certification_status
      FROM engineers
      WHERE regional_lead_id = ? AND engineer_role = 'engineer'
      ORDER BY status = 'available' DESC, rating_technical DESC, created_at DESC
      LIMIT 100
    `).bind(auth.userId).all();

    return jsonResponse({
      engineers: (team.results || []).map((engineer) => ({
        ...engineer,
        specialties: typeof engineer.specialties === 'string' ? JSON.parse(engineer.specialties || '[]') : (engineer.specialties || []),
      })),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleRegionalLeadAssignEngineer(request, env) {
  try {
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('需要工程师权限', 403);
    }
    const { work_order_id, engineer_id } = await request.json();
    if (!work_order_id || !engineer_id) return errorResponse('缺少工单或工程师 ID');

    const lead = await env.DB.prepare(
      "SELECT id, engineer_role FROM engineers WHERE id = ?"
    ).bind(auth.userId).first();
    if (!lead || lead.engineer_role !== 'regional_lead') {
      return errorResponse('仅区域负责人可二次分配', 403);
    }

    const wo = await env.DB.prepare(
      'SELECT id, order_no, status, customer_id, engineer_id, assigned_regional_lead_id, conflict_status FROM work_orders WHERE id = ?'
    ).bind(work_order_id).first();
    if (!wo) return errorResponse('服务申请不存在', 404);
    if (wo.assigned_regional_lead_id !== auth.userId) {
      return errorResponse('该服务申请未分配给当前区域负责人', 403);
    }
    if (['completed', 'cancelled', 'rejected'].includes(wo.status)) {
      return errorResponse('该服务申请当前状态不允许分配', 409);
    }

    const engineer = await env.DB.prepare(
      "SELECT id, name, regional_lead_id, status, engineer_role FROM engineers WHERE id = ?"
    ).bind(engineer_id).first();
    if (!engineer) return errorResponse('工程师不存在', 404);
    if (engineer.engineer_role === 'regional_lead') return errorResponse('请选择具体工程师账号', 400);
    if (engineer.regional_lead_id !== auth.userId) {
      return errorResponse('只能分配给本区域团队内的工程师', 403);
    }

    const conflict = await evaluateDispatchConflict(env, work_order_id, engineer_id);
    if (conflict.status === 'blocked') {
      await env.DB.prepare(
        "UPDATE work_orders SET conflict_status = 'blocked', conflict_reason = ? WHERE id = ?"
      ).bind(conflict.reason, work_order_id).run();
      await writeAuditLog(env, request, {
        targetType: 'work_order',
        targetId: work_order_id,
        action: 'regional_dispatch_blocked_conflict',
        beforeState: { engineer_id: wo.engineer_id, conflict_status: wo.conflict_status },
        afterState: { engineer_id, conflict_status: 'blocked', conflict_reason: conflict.reason },
      });
      return errorResponse(`存在利益冲突，禁止派工：${conflict.reason}`, 409);
    }

    const nextStatus = ['pending', 'pending_dispatch'].includes(wo.status) ? 'assigned' : wo.status;
    await env.DB.prepare(`
      UPDATE work_orders
      SET engineer_id = ?, status = ?, assigned_at = datetime('now'), conflict_status = 'clear', conflict_reason = NULL
      WHERE id = ?
    `).bind(engineer_id, nextStatus, work_order_id).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'assigned_engineer_by_regional_lead', 'engineer', ?, ?)
    `).bind(
      generateId(),
      work_order_id,
      auth.userId,
      `区域负责人已分配给 ${engineer.name || '内部工程师'}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
      VALUES (?, ?, 'system', '', '系统', ?, 'system', 0, 1)
    `).bind(
      generateId(),
      work_order_id,
      `SAGEMRO 已安排 ${engineer.name || '内部工程师'} 跟进该服务申请。`
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: work_order_id,
      action: 'assigned_engineer_by_regional_lead',
      beforeState: { engineer_id: wo.engineer_id, status: wo.status },
      afterState: { engineer_id, status: nextStatus },
    });

    if (wo.customer_id) {
      await createNotification(env, {
        user_id: wo.customer_id,
        user_type: 'customer',
        type: 'service_assigned',
        title: '服务申请已安排工程师',
        body: `服务编号 ${wo.order_no} 已由 SAGEMRO 安排内部工程师跟进。`,
        data: { work_order_id, engineer_id },
      });
    }

    await createNotification(env, {
      user_id: engineer_id,
      user_type: 'engineer',
      type: 'service_assignment',
      title: '新的服务任务',
      body: `服务编号 ${wo.order_no} 已分配给你，请确认客户现场信息。`,
      data: { work_order_id },
    });

    return jsonResponse({
      success: true,
      work_order: {
        id: work_order_id,
        order_no: wo.order_no,
        status: nextStatus,
        engineer_id,
        engineer_name: engineer.name || '',
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// SERVICE_OS_LEGACY: old self-accept dispatch model. Keep only until admin dispatch replaces it.
// 工程师确认派工
async function handleAcceptTicket(request, env) {
  try {
    const { work_order_id } = await request.json();

    // 认证：engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可确认派工', 403);
    }
    const engineer_id = auth.userId;

    if (!work_order_id) {
      return errorResponse('缺少工单 ID');
    }

    const wo = await env.DB.prepare(
      'SELECT status, engineer_id, customer_id, order_no FROM work_orders WHERE id = ?'
    ).bind(work_order_id).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.engineer_id && wo.engineer_id !== engineer_id) {
      return errorResponse('该服务任务未分配给当前工程师', 403);
    }
    if (!['pending', 'assigned'].includes(wo.status)) {
      return errorResponse('服务任务状态不允许确认', 409);
    }

    await env.DB.prepare(`
      UPDATE work_orders SET status = 'in_progress', engineer_id = COALESCE(engineer_id, ?), started_at = datetime("now")
      WHERE id = ? AND status IN ('pending', 'assigned') AND (engineer_id IS NULL OR engineer_id = ?)
    `).bind(engineer_id, work_order_id, engineer_id).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), work_order_id, 'accepted', 'engineer', engineer_id, '工程师已确认派工').run();

    // 通知客户：工程师已确认派工
    const eng = await env.DB.prepare('SELECT name FROM engineers WHERE id = ?').bind(engineer_id).first();
    if (wo?.customer_id) {
      await createNotification(env, {
        user_id: wo.customer_id,
        user_type: 'customer',
        type: 'ticket_accepted',
        title: '服务任务已确认',
        body: `服务编号 ${wo.order_no} 已由 ${eng?.name || 'SAGEMRO 工程师'} 确认跟进。`,
        data: { work_order_id },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// SERVICE_OS_LEGACY: old self-decline dispatch model. Keep only until admin dispatch replaces it.
// 工程师退回派工
// 注意：rejected_engineers 列定义在 work_orders 表上（每个工单记录哪些工程师拒过），
// 不在 engineers 表上。历史实现写错表，此处修复。
async function handleRejectTicket(request, env) {
  try {
    const { work_order_id } = await request.json();

    // 认证：engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可退回派工', 403);
    }
    const engineer_id = auth.userId;

    if (!work_order_id) {
      return errorResponse('缺少工单 ID');
    }

    const wo = await env.DB.prepare(
      'SELECT status, engineer_id, assigned_regional_lead_id, rejected_engineers FROM work_orders WHERE id = ?'
    ).bind(work_order_id).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.engineer_id && wo.engineer_id !== engineer_id) {
      return errorResponse('该服务任务未分配给当前工程师', 403);
    }

    let rejected = [];
    if (wo.rejected_engineers) {
      try { rejected = JSON.parse(wo.rejected_engineers); } catch { rejected = []; }
    }
    if (!Array.isArray(rejected)) rejected = [];
    if (!rejected.includes(engineer_id)) rejected.push(engineer_id);

    const nextStatus = wo.status === 'assigned'
      ? (wo.assigned_regional_lead_id ? 'pending_dispatch' : 'pending')
      : wo.status;
    await env.DB.prepare(
      'UPDATE work_orders SET rejected_engineers = ?, engineer_id = CASE WHEN status = "assigned" THEN NULL ELSE engineer_id END, status = ? WHERE id = ?'
    ).bind(JSON.stringify(rejected), nextStatus, work_order_id).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), work_order_id, 'rejected', 'engineer', engineer_id, '工程师已退回派工').run();

    // 通知客户服务任务已退回调度
    const woForReject = await env.DB.prepare(
      'SELECT customer_id, order_no FROM work_orders WHERE id = ?'
    ).bind(work_order_id).first();
    if (woForReject?.customer_id) {
      await createNotification(env, {
        user_id: woForReject.customer_id,
        user_type: 'customer',
        type: 'ticket_rejected',
        title: '服务任务已退回调度',
        body: `服务编号 ${woForReject.order_no} 已退回 SAGEMRO 运营调度，团队会继续安排合适工程师。`,
        data: { work_order_id },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 更新工程师可派工状态
// 安全要点：
//   - engineer_id 只能来自 JWT（request._auth.userId），不接受 body 传入，避免任何客户端把他人切离线
//   - 仅允许工程师本人或管理员调用
//   - status 白名单校验（pending_approval 只能由 admin 设置）
const ENGINEER_STATUS_SELF = new Set(['available', 'paused', 'offline']);
const ENGINEER_STATUS_ADMIN = new Set(['available', 'paused', 'offline', 'pending_approval']);

async function handleUpdateEngineerStatus(request, env) {
  try {
    const auth = request._auth;
    if (!auth) return errorResponse('请先登录', 401);

    const body = await request.json().catch(() => ({}));
    const { status, engineer_id: bodyEngineerId } = body || {};
    if (!status) return errorResponse('缺少 status');

    // 确定目标工程师 id 和允许的 status 集合
    let targetEngineerId;
    let allowedStatuses;
    if (auth.userType === 'engineer') {
      // 工程师只能改自己的状态；忽略 body 里的 engineer_id
      targetEngineerId = auth.userId;
      allowedStatuses = ENGINEER_STATUS_SELF;
    } else if (auth.userType === 'admin') {
      // 管理员可以指定 engineer_id；未指定时返回参数错误
      targetEngineerId = bodyEngineerId;
      allowedStatuses = ENGINEER_STATUS_ADMIN;
      if (!targetEngineerId) return errorResponse('管理员调用需提供 engineer_id');
    } else {
      return errorResponse('无权修改工程师状态', 403);
    }

    if (!allowedStatuses.has(status)) {
      return errorResponse(`status 非法，允许值：${[...allowedStatuses].join(' / ')}`);
    }

    const result = await env.DB.prepare(
      'UPDATE engineers SET status = ? WHERE id = ?'
    ).bind(status, targetEngineerId).run();

    if (result.meta?.changes === 0) {
      return errorResponse('工程师不存在', 404);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工程师档案
async function handleGetEngineerProfile(request, env) {
  try {
    const engineerId = request._auth?.userId || new URL(request.url).searchParams.get('engineer_id');

    if (!engineerId) {
      return errorResponse('缺少工程师ID');
    }

    const engineer = await env.DB.prepare(
      'SELECT id, name, phone, specialties, brands, services, service_region, bio, status, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, created_at, level, commission_rate, credit_score, wallet_balance, deposit_balance, total_orders, complex_orders, success_orders FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) {
      return errorResponse('工程师不存在', 404);
    }

    // 解析 JSON 字段
    const profile = {
      ...engineer,
      specialties: typeof engineer.specialties === 'string' ? JSON.parse(engineer.specialties) : (engineer.specialties || []),
      brands: typeof engineer.brands === 'string' ? JSON.parse(engineer.brands) : (engineer.brands || {}),
      services: typeof engineer.services === 'string' ? JSON.parse(engineer.services) : (engineer.services || []),
    };

    return jsonResponse({ engineer: profile });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 客户档案更新 ============

async function handleUpdateCustomerProfile(request, env) {
  try {
    const customerId = request._auth?.userId;
    if (!customerId) return errorResponse('未登录', 401);

    const body = await request.json();
    let { name, region, company, address, city, phone, company_description, business_scope, logo_url } = body;

    try {
      assertFieldLimits(body, {
        name: LIMITS.name,
        region: LIMITS.region,
        company: LIMITS.company,
        address: LIMITS.address,
        city: LIMITS.city,
        phone: LIMITS.phone,
        company_description: LIMITS.company_description,
        business_scope: LIMITS.business_scope,
      });
      if (logo_url !== undefined) {
        logo_url = validateImageUrl(logo_url, 'logo_url');
      }
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (region !== undefined) { updates.push('region = ?'); values.push(region); }
    if (company !== undefined) { updates.push('company = ?'); values.push(company); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (company_description !== undefined) { updates.push('company_description = ?'); values.push(company_description); }
    if (business_scope !== undefined) { updates.push('business_scope = ?'); values.push(business_scope); }
    if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url); }

    if (updates.length === 0) return errorResponse('没有要更新的字段');

    values.push(customerId);
    await env.DB.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare('SELECT id, user_no, name, phone, region, company, address, city, company_description, business_scope, logo_url, auth_status, created_at FROM customers WHERE id = ?').bind(customerId).first();
    return jsonResponse({ customer: updated });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师档案更新 ============

async function handleUpdateEngineerProfile(request, env) {
  try {
    const engineerId = request._auth?.userId;
    if (!engineerId) return errorResponse('未登录', 401);

    const body = await request.json();
    const { name, bio, service_region, bank_name, bank_account, bank_branch, account_holder } = body;

    try {
      assertFieldLimits(body, {
        name: LIMITS.name,
        bio: LIMITS.bio,
        service_region: LIMITS.service_region,
        bank_name: { max: 50 },
        bank_account: { max: 30 },
        bank_branch: { max: 100 },
        account_holder: { max: 20 },
      });
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
    if (service_region !== undefined) { updates.push('service_region = ?'); values.push(service_region); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); values.push(bank_name); }
    if (bank_account !== undefined) { updates.push('bank_account = ?'); values.push(bank_account); }
    if (bank_branch !== undefined) { updates.push('bank_branch = ?'); values.push(bank_branch); }
    if (account_holder !== undefined) { updates.push('account_holder = ?'); values.push(account_holder); }

    if (updates.length === 0) return errorResponse('没有要更新的字段');

    values.push(engineerId);
    await env.DB.prepare(`UPDATE engineers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare(
      'SELECT id, user_no, name, phone, specialties, brands, services, service_region, bio, status, level, commission_rate, credit_score, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, bank_name, bank_account, bank_branch, account_holder FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!updated) return errorResponse('工程师不存在', 404);

    const profile = {
      ...updated,
      specialties: typeof updated.specialties === 'string' ? JSON.parse(updated.specialties) : (updated.specialties || []),
      brands: typeof updated.brands === 'string' ? JSON.parse(updated.brands) : (updated.brands || {}),
      services: typeof updated.services === 'string' ? JSON.parse(updated.services) : (updated.services || []),
    };
    return jsonResponse({ engineer: profile });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 修改密码 ============

async function handleChangePassword(request, env) {
  try {
    const auth = request._auth;
    if (!auth) return errorResponse('未登录', 401);

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) return errorResponse('旧密码和新密码不能为空');
    if (newPassword.length < 6) return errorResponse('新密码至少6位');

    const table = auth.userType === 'engineer' ? 'engineers' : 'customers';
    const user = await env.DB.prepare(`SELECT id, password_hash, salt FROM ${table} WHERE id = ?`).bind(auth.userId).first();
    if (!user) return errorResponse('用户不存在', 404);

    const ok = await verifyPassword(oldPassword, user.password_hash, user.salt);
    if (!ok) return errorResponse('旧密码错误');

    const newSalt = generateSalt();
    const newHash = await hashPasswordNew(newPassword, newSalt);
    await env.DB.prepare(`UPDATE ${table} SET password_hash = ?, salt = ? WHERE id = ?`).bind(newHash, newSalt, auth.userId).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师钱包与保证金 API ============
// SERVICE_OS_LEGACY: old marketplace wallet/withdrawal model. Do not expose as a customer-facing capability.

// 获取工程师钱包信息（余额 + 摘要）
async function handleGetEngineerWallet(request, env) {
  try {
    const engineerId = request._auth?.userId || new URL(request.url).searchParams.get('engineer_id');
    if (!engineerId) return errorResponse('缺少工程师ID');

    const engineer = await env.DB.prepare(
      'SELECT id, wallet_balance, deposit_balance, level, commission_rate, credit_score FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return errorResponse('工程师不存在', 404);

    // 最近10条钱包流水
    const walletHistory = await env.DB.prepare(
      'SELECT * FROM engineer_wallets WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(engineerId).all();

    // 最近10条保证金流水
    const depositHistory = await env.DB.prepare(
      'SELECT * FROM engineer_deposits WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(engineerId).all();

    return jsonResponse({
      wallet_balance: engineer.wallet_balance || 0,
      deposit_balance: engineer.deposit_balance || 0,
      level: engineer.level || 'junior',
      commission_rate: engineer.commission_rate || 0.80,
      credit_score: engineer.credit_score || 100,
      wallet_history: walletHistory.results || [],
      deposit_history: depositHistory.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// SERVICE_OS_LEGACY: old marketplace withdrawal model. Replace with internal payroll/settlement before deletion.
// 申请提现
async function handleWithdrawRequest(request, env) {
  try {
    const engineerId = request._auth?.userId;
    if (!engineerId) return errorResponse('未登录或登录已过期', 401);

    const { amount } = await request.json();
    if (!amount || amount <= 0) return errorResponse('请输入正确的提现金额');
    if (amount < 100) return errorResponse('提现金额不能低于100元');
    if (amount > 50000) return errorResponse('单次提现金额不能超过50000元');

    const engineer = await env.DB.prepare(
      'SELECT wallet_balance, bank_account, bank_name FROM engineers WHERE id = ?'
    ).bind(engineerId).first();

    if (!engineer) return errorResponse('工程师不存在', 404);
    if (!engineer.bank_account || !engineer.bank_name) {
      return errorResponse('请先在档案中绑定银行卡信息');
    }
    if ((engineer.wallet_balance || 0) < amount) {
      return errorResponse('钱包余额不足');
    }

    // 检查是否有处理中的提现申请
    const pending = await env.DB.prepare(
      "SELECT id FROM engineer_withdrawals WHERE engineer_id = ? AND status = 'pending'"
    ).bind(engineerId).first();
    if (pending) return errorResponse('您有待处理的提现申请，请等待处理完成后再申请');

    const id = generateId();
    // 事务性：先从钱包余额扣款冻结，再创建提现记录，再写入钱包流水（withdraw_pending）。
    // 若提现被拒，运营侧需对应回写钱包余额 + 补冲流水。
    const newBalance = (engineer.wallet_balance || 0) - amount;
    await env.DB.prepare(
      'UPDATE engineers SET wallet_balance = ? WHERE id = ?'
    ).bind(newBalance, engineerId).run();

    await env.DB.prepare(`
      INSERT INTO engineer_withdrawals (id, engineer_id, amount, status)
      VALUES (?, ?, ?, 'pending')
    `).bind(id, engineerId, amount).run();

    await env.DB.prepare(`
      INSERT INTO engineer_wallets (id, engineer_id, work_order_id, type, amount, balance_after, status, note)
      VALUES (?, ?, NULL, 'withdraw', ?, ?, 'pending', ?)
    `).bind(
      generateId(),
      engineerId,
      -amount,
      newBalance,
      `提现申请 ${id}`
    ).run();

    return jsonResponse({
      success: true,
      withdrawal_id: id,
      wallet_balance: newBalance,
      message: `提现申请已提交，预计 T+1 工作日到账至 ${engineer.bank_name}（${engineer.bank_account.slice(-4).padStart(engineer.bank_account.length, '*')}）`
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 商机线索 API ============

async function handleSubmitLead(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, email, phone, interest, message, conversation_id, source } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse('请提供姓名');
    }
    if (!email && !phone) {
      return errorResponse('请提供邮箱或手机号');
    }

    const id = generateId();
    await env.DB.prepare(
      `INSERT INTO leads (id, name, email, phone, source, interest, message, conversation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      name.trim(),
      email?.trim() || null,
      phone?.trim() || null,
      source || 'chat',
      interest?.trim() || null,
      message?.trim() || null,
      conversation_id || null
    ).run();

    return jsonResponse({ success: true, lead_id: id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理后台 — 获取 Leads 列表
async function handleAdminLeads(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20));
    const status = url.searchParams.get('status') || '';
    const offset = (page - 1) * pageSize;

    let where = '';
    const binds = [];
    if (status && status !== 'all') {
      where = 'WHERE l.status = ?';
      binds.push(status);
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM leads l ${where}`
    ).bind(...binds).first();

    const list = await env.DB.prepare(
      `SELECT l.* FROM leads l ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    const sourceTypeMap = {
      chat: 'fault_diagnosis_ai',
      ai_tool: 'fault_diagnosis_ai',
      landing: 'contact_form',
      referral: 'contact_form',
    };
    const sourceLabelMap = {
      fault_diagnosis_ai: '故障诊断 AI',
      cutting_parameter_ai: '切割参数 AI',
      parts_identification_ai: '备件识别 AI',
      repair_estimate_ai: '维修预估 AI',
      machine_selection_ai: '新机选型 AI',
      health_report_ai: '设备健康报告 AI',
      manual_service_request: '手动服务申请',
      contact_form: '联系表单',
    };
    const enriched = (list.results || []).map((lead) => {
      const rawSource = lead.source || 'chat';
      const sourceType = sourceTypeMap[rawSource] || rawSource;
      const text = `${lead.interest || ''} ${lead.message || ''}`.toLowerCase();
      const riskLevel =
        /停产|高风险|critical|urgent|fire|smoke|burn|报警|alarm/.test(text)
          ? 'high'
          : /报价|维修|repair|service|故障/.test(text)
            ? 'medium'
            : 'low';
      return {
        ...lead,
        source_type: sourceType,
        source_label: sourceLabelMap[sourceType] || rawSource,
        risk_level: lead.risk_level || riskLevel,
        ai_summary: lead.ai_summary || lead.message || lead.interest || '',
        recommended_next_step:
          lead.recommended_next_step ||
          (sourceType === 'machine_selection_ai'
            ? '安排 SAGEMRO/EUCHIO 选型顾问跟进'
            : riskLevel === 'high'
              ? '优先人工审核并确认是否需要停机处理'
              : '联系客户补全设备与现场信息'),
        assignment_status: lead.assignment_status || (lead.status === 'converted' ? 'converted' : 'unassigned'),
        region: lead.region || '',
      };
    });

    return jsonResponse({ total: countRow?.total || 0, list: enriched });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理后台 — 更新 Lead 状态
async function handleAdminUpdateLead(request, env) {
  try {
    const leadId = new URL(request.url).pathname.split('/')[4];
    const { status } = await request.json();
    if (!['new', 'contacted', 'converted', 'lost'].includes(status)) {
      return errorResponse('无效状态');
    }
    await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, leadId).run();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

function inferWorkOrderTypeFromLead(lead) {
  const sourceType = lead.source_type || lead.source || '';
  const text = `${lead.interest || ''} ${lead.message || ''}`.toLowerCase();
  if (sourceType === 'cutting_parameter_ai' || /参数|parameter/.test(text)) return 'parameter';
  if (sourceType === 'health_report_ai' || /保养|maintenance|health/.test(text)) return 'maintenance';
  if (sourceType === 'fault_diagnosis_ai' || sourceType === 'repair_estimate_ai' || /故障|维修|报警|repair|fault|alarm/.test(text)) return 'fault';
  return 'other';
}

function inferUrgencyFromLead(lead) {
  const risk = lead.risk_level || '';
  const text = `${lead.interest || ''} ${lead.message || ''}`.toLowerCase();
  if (risk === 'critical' || /停机|停产|critical|fire|smoke/.test(text)) return 'critical';
  if (risk === 'high' || /紧急|urgent|报警|alarm/.test(text)) return 'urgent';
  return 'normal';
}

async function ensureCustomerForLead(env, lead) {
  const phone = (lead.phone || '').trim();
  if (!phone) return null;

  const existing = await env.DB.prepare(
    'SELECT id FROM customers WHERE phone = ?'
  ).bind(phone).first();
  if (existing?.id) return existing.id;

  const customerId = generateId();
  await env.DB.prepare(`
    INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region)
    VALUES (?, 'C' || substr(?, 10), ?, ?, 'pending_reset', '', ?)
  `).bind(
    customerId,
    customerId,
    lead.name || '待完善客户',
    phone,
    lead.region || null
  ).run();
  return customerId;
}

// 管理后台 — 将 AI/CRM 线索转为服务申请，进入后续派工流程
async function handleAdminConvertLeadToWorkOrder(request, env) {
  try {
    const leadId = new URL(request.url).pathname.split('/')[4];
    const lead = await env.DB.prepare(
      'SELECT * FROM leads WHERE id = ?'
    ).bind(leadId).first();
    if (!lead) return errorResponse('线索不存在', 404);

    if (lead.work_order_id) {
      return jsonResponse({
        success: true,
        work_order_id: lead.work_order_id,
        already_converted: true,
      });
    }

    const customerId = lead.customer_id || await ensureCustomerForLead(env, lead);
    const type = inferWorkOrderTypeFromLead(lead);
    const urgency = inferUrgencyFromLead(lead);
    const id = generateId();
    const orderNo = generateOrderNo();
    const description = [
      `线索转服务申请：${lead.interest || lead.source_type || lead.source || '客户咨询'}`,
      `联系人：${lead.name || '-'}`,
      lead.phone ? `电话：${lead.phone}` : '',
      lead.email ? `邮箱：${lead.email}` : '',
      lead.region ? `地区：${lead.region}` : '',
      lead.ai_summary ? `AI 摘要：${lead.ai_summary}` : '',
      lead.message ? `客户描述：${lead.message}` : '',
    ].filter(Boolean).join('\n');
    const safeDescription = redactPII(description);

    await env.DB.prepare(`
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status, sla_deadline, category_l1, category_l2, ai_summary)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'other', 'other', ?)
    `).bind(
      id,
      orderNo,
      customerId,
      type,
      safeDescription,
      urgency,
      computeSlaDeadline(urgency),
      lead.ai_summary || null
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'created_from_lead', 'admin', ?, ?)
    `).bind(
      generateId(),
      id,
      request._auth?.userId || 'admin',
      `SAGEMRO 运营已将线索转为服务申请：${lead.name || leadId}`
    ).run();

    await env.DB.prepare(`
      UPDATE leads
      SET status = 'converted', assignment_status = 'converted', work_order_id = ?, customer_id = COALESCE(customer_id, ?)
      WHERE id = ?
    `).bind(id, customerId, leadId).run();

    await writeAuditLog(env, request, {
      targetType: 'lead',
      targetId: leadId,
      action: 'lead_converted_to_work_order',
      beforeState: { status: lead.status, assignment_status: lead.assignment_status, work_order_id: lead.work_order_id },
      afterState: { status: 'converted', assignment_status: 'converted', work_order_id: id, customer_id: customerId },
    });

    return jsonResponse({
      success: true,
      work_order: {
        id,
        order_no: orderNo,
        customer_id: customerId,
        type,
        urgency,
        status: 'pending',
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 推送订阅 API（OneSignal）============

// 保存推送订阅
async function handleSavePushSubscription(request, env) {
  try {
    const auth = request._auth;
    if (!auth?.userId) return errorResponse('未登录或登录已过期', 401);

    const { onesignal_player_id } = await request.json();
    if (!onesignal_player_id) return errorResponse('缺少 OneSignal Player ID');

    // 按用户类型更新对应表
    const table = auth.userType === 'engineer' ? 'engineers'
                : auth.userType === 'customer' ? 'customers'
                : null;
    if (!table) return errorResponse('用户类型不支持推送订阅', 400);

    await env.DB.prepare(`UPDATE ${table} SET onesignal_player_id = ? WHERE id = ?`)
      .bind(onesignal_player_id, auth.userId).run();

    return jsonResponse({ success: true, message: '推送订阅已保存' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// sendPushToUser / sendPushToEngineer 已提取到 ./lib/push.js

// ============ 管理后台 API ============

// 管理员创建用户
async function handleAdminCreateUser(request, env) {
  try {
    const body = await request.json();
    const { userType, name, phone, password, region } = body;

    if (!userType || !name || !phone || !password) {
      return errorResponse('用户类型、姓名、手机号、密码不能为空');
    }

    if (userType === 'customer') {
      // 检查手机号是否已注册
      const existing = await env.DB.prepare(
        'SELECT id FROM customers WHERE phone = ?'
      ).bind(phone).first();
      if (existing) {
        return errorResponse('该手机号已注册为客户');
      }

      const id = generateId();
      const userNo = await generateUserNo(env, 'U');
      const salt = generateSalt();
      const passwordHash = await hashPasswordNew(password, salt);

      await env.DB.prepare(
        'INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, userNo, name, phone, passwordHash, salt, region || null).run();

      return jsonResponse({ success: true, user: { id, user_no: userNo, name, phone, region } });
    } else if (userType === 'engineer') {
      const {
        specialties,
        brands,
        services,
        serviceRegion,
        bio,
        engineerRole,
        regionalLeadId,
        responsibleRegion,
        teamName,
        certificationStatus,
      } = body;
      const safeRole = engineerRole === 'regional_lead' ? 'regional_lead' : 'engineer';

      if (!specialties || !specialties.length || !services || !services.length) {
        return errorResponse('工程师必须填写擅长设备类型和维修项目');
      }

      const existing = await env.DB.prepare(
        'SELECT id FROM engineers WHERE phone = ?'
      ).bind(phone).first();
      if (existing) {
        return errorResponse('该手机号已注册为工程师');
      }

      const id = generateId();
      const userNo = await generateUserNo(env, 'E');
      const salt = generateSalt();
      const passwordHash = await hashPasswordNew(password, salt);

      await env.DB.prepare(
        `INSERT INTO engineers (
          id, user_no, name, phone, password_hash, salt, specialties, brands, services,
          service_region, bio, engineer_role, regional_lead_id, responsible_region,
          team_name, certification_status, cooperation_status, workload_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'available')`
      ).bind(
        id, userNo, name, phone, passwordHash, salt,
        JSON.stringify(specialties),
        JSON.stringify(brands || {}),
        JSON.stringify(services),
        serviceRegion || null,
        bio || null,
        safeRole,
        safeRole === 'engineer' ? (regionalLeadId || null) : null,
        responsibleRegion || serviceRegion || null,
        teamName || null,
        certificationStatus || 'pending'
      ).run();

      await writeAuditLog(env, request, {
        targetType: 'engineer',
        targetId: id,
        action: 'engineer_account_created',
        afterState: { engineer_role: safeRole, regional_lead_id: regionalLeadId || null },
      });

      return jsonResponse({ success: true, user: { id, user_no: userNo, name, phone, serviceRegion, engineer_role: safeRole } });
    } else {
      return errorResponse('不支持的用户类型');
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员删除用户
// Admin 删除用户
// 原子性要求：所有级联 DELETE 必须打包进 env.DB.batch() 一次执行，
// 避免 N 条独立 prepared.run() 中途失败导致用户被部分删除（例如工单删了但客户记录没删）。
// D1.batch 在单个隐式事务内执行所有语句，任一失败整体回滚。
async function handleAdminDeleteUser(request, env) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    const userType = url.searchParams.get('type');

    if (!userId || !userType) {
      return errorResponse('缺少用户ID或类型');
    }

    if (userType === 'customer') {
      const user = await env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(userId).first();
      if (!user) {
        return errorResponse('客户不存在', 404);
      }

      // 先把需要按 id 级联的子表 key 收集起来（batch 不支持子查询混合 bind）
      const [workOrdersRes, conversationsRes] = await Promise.all([
        env.DB.prepare('SELECT id FROM work_orders WHERE customer_id = ?').bind(userId).all(),
        env.DB.prepare('SELECT id FROM conversations WHERE customer_id = ?').bind(userId).all(),
      ]);
      const woIds = (workOrdersRes.results || []).map(r => r.id);
      const convIds = (conversationsRes.results || []).map(r => r.id);

      const statements = [];
      for (const woId of woIds) {
        statements.push(env.DB.prepare('DELETE FROM ratings WHERE work_order_id = ?').bind(woId));
        statements.push(env.DB.prepare('DELETE FROM work_order_logs WHERE work_order_id = ?').bind(woId));
      }
      for (const cId of convIds) {
        statements.push(env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(cId));
      }
      statements.push(env.DB.prepare('DELETE FROM work_orders WHERE customer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM conversations WHERE customer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM devices WHERE customer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(userId));

      await env.DB.batch(statements);
      return jsonResponse({ success: true });
    } else if (userType === 'engineer') {
      const user = await env.DB.prepare('SELECT id FROM engineers WHERE id = ?').bind(userId).first();
      if (!user) {
        return errorResponse('工程师不存在', 404);
      }

      const [workOrdersRes, conversationsRes] = await Promise.all([
        env.DB.prepare('SELECT id FROM work_orders WHERE engineer_id = ?').bind(userId).all(),
        env.DB.prepare('SELECT id FROM conversations WHERE engineer_id = ?').bind(userId).all(),
      ]);
      const woIds = (workOrdersRes.results || []).map(r => r.id);
      const convIds = (conversationsRes.results || []).map(r => r.id);

      const statements = [];
      for (const woId of woIds) {
        statements.push(env.DB.prepare('DELETE FROM ratings WHERE work_order_id = ?').bind(woId));
        statements.push(env.DB.prepare('DELETE FROM work_order_logs WHERE work_order_id = ?').bind(woId));
      }
      for (const cId of convIds) {
        statements.push(env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(cId));
      }
      statements.push(env.DB.prepare('DELETE FROM work_orders WHERE engineer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM conversations WHERE engineer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM ratings WHERE engineer_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM engineers WHERE id = ?').bind(userId));

      await env.DB.batch(statements);
      return jsonResponse({ success: true });
    } else {
      return errorResponse('不支持的用户类型');
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 统计概览

// 管理员登录
// 安全要点：
//   - ADMIN_PHONE / ADMIN_PASSWORD 必须来自 env（Cloudflare secret），缺失则直接 500，不降级到默认值
//   - 失败计数：对 phone 和 client IP 分别限速，15 分钟内 5 次即锁定
//     · phone counter 防爆破单账号
//     · ip counter 防同一 IP 对多账号撒网 / DoS 管理员锁定
async function handleAdminLogin(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, password } = body || {};

    const adminPhone = env.ADMIN_PHONE;
    const adminPassword = env.ADMIN_PASSWORD;
    if (!adminPhone || !adminPassword) {
      return errorResponse('管理员账号未配置，请联系系统管理员', 500);
    }
    if (!phone || !password) {
      return errorResponse('手机号、密码不能为空');
    }

    const ip = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')
      || 'unknown';

    const phoneKey = `admin_login_fail_phone_${phone}`;
    const ipKey = `admin_login_fail_ip_${ip}`;
    const FAIL_LIMIT = 5;
    const FAIL_TTL = 900; // 15 分钟

    const [phoneFailStr, ipFailStr] = await Promise.all([
      env.KV.get(phoneKey),
      env.KV.get(ipKey),
    ]);
    const phoneFail = phoneFailStr ? parseInt(phoneFailStr, 10) : 0;
    const ipFail = ipFailStr ? parseInt(ipFailStr, 10) : 0;
    if (phoneFail >= FAIL_LIMIT || ipFail >= FAIL_LIMIT) {
      return errorResponse('登录失败次数过多，请 15 分钟后再试', 429);
    }

    if (phone !== adminPhone || password !== adminPassword) {
      await Promise.all([
        env.KV.put(phoneKey, String(phoneFail + 1), { expirationTtl: FAIL_TTL }),
        env.KV.put(ipKey, String(ipFail + 1), { expirationTtl: FAIL_TTL }),
      ]);
      return errorResponse('手机号或密码错误', 401);
    }

    // 登录成功：清零计数
    await Promise.all([
      env.KV.delete(phoneKey),
      env.KV.delete(ipKey),
    ]);

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt({
      userId: 'admin',
      userType: 'admin',
      phone: adminPhone,
      iat: now,
      exp: now + 86400 * 7,
    }, env.JWT_SECRET);

    return jsonResponse({
      token,
      user: { id: 'admin', name: '超级管理员', phone: adminPhone, type: 'admin' },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 统计概览
async function handleAdminStats(request, env) {
  try {
    const customerCount = await env.DB.prepare('SELECT COUNT(*) as count FROM customers').first();
    const engineerCount = await env.DB.prepare('SELECT COUNT(*) as count FROM engineers').first();

    const woTotal = await env.DB.prepare('SELECT COUNT(*) as count FROM work_orders').first();
    const woPending = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'pending'").first();
    const woAssigned = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'assigned'").first();
    const woInProgress = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('assigned', 'in_progress')").first();
    const woPricing = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'pricing'").first();
    const woInService = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status = 'in_service'").first();
    const woPendingArchive = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('resolved', 'pending_review')").first();
    const woCompleted = await env.DB.prepare("SELECT COUNT(*) as count FROM work_orders WHERE status IN ('completed', 'resolved')").first();
    const criticalOpen = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM work_orders WHERE urgency = 'critical' AND status NOT IN ('completed', 'resolved', 'cancelled', 'rejected')"
    ).first();
    const todayLeads = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE created_at >= date('now')"
    ).first();
    const partsLeads = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE source = 'parts_identification_ai' OR interest LIKE '%备件%' OR interest LIKE '%parts%'"
    ).first();
    const machineLeads = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE source = 'machine_selection_ai' OR interest LIKE '%新机%' OR interest LIKE '%EUCHIO%' OR interest LIKE '%machine%'"
    ).first();

    // 最近7天注册数
    const recentCustomers = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM customers WHERE created_at >= datetime('now', '-7 days')"
    ).first();
    const recentEngineers = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM engineers WHERE created_at >= datetime('now', '-7 days')"
    ).first();


    // API 调用统计（从 KV 读取今日计数）
    const today2 = new Date().toISOString().slice(0, 10);
    const apiStatsRaw = await env.KV.get(`api_stats_${today2}`);
    const apiStats = apiStatsRaw ? JSON.parse(apiStatsRaw) : {};
    return jsonResponse({
      customers: customerCount?.count || 0,
      engineers: engineerCount?.count || 0,
      workOrders: {
        total: woTotal?.count || 0,
        pending: woPending?.count || 0,
        assigned: woAssigned?.count || 0,
        in_progress: woInProgress?.count || 0,
        pricing: woPricing?.count || 0,
        in_service: woInService?.count || 0,
        pending_archive: woPendingArchive?.count || 0,
        completed: woCompleted?.count || 0,
      },
      operations: {
        aiLeadsToday: todayLeads?.count || 0,
        pendingReview: woPending?.count || 0,
        highRiskDowntime: criticalOpen?.count || 0,
        pendingQuotes: woPricing?.count || 0,
        pendingDispatch: woPending?.count || 0,
        inService: (woInService?.count || 0) + (woInProgress?.count || 0),
        pendingArchive: woPendingArchive?.count || 0,
        partsLeads: partsLeads?.count || 0,
        euchioMachineLeads: machineLeads?.count || 0,
      },
      recentRegistrations: (recentCustomers?.count || 0) + (recentEngineers?.count || 0),
      apiCalls: {
        send_code: apiStats.send_code || 0,
        register_customer: apiStats.register_customer || 0,
        register_engineer: apiStats.register_engineer || 0,
        login: apiStats.login || 0,
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 用户列表
async function handleAdminUsers(request, env) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'customer';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * pageSize;

    if (type === 'engineer') {
      const status = url.searchParams.get('status') || '';
      const region = url.searchParams.get('region') || '';
      const specialty = url.searchParams.get('specialty') || '';

      let where = 'WHERE 1=1';
      const params = [];

      if (search) {
        where += ' AND (name LIKE ? OR phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      if (status) {
        where += ' AND status = ?';
        params.push(status);
      }
      if (region) {
        where += ' AND service_region LIKE ?';
        params.push(`%${region}%`);
      }
      if (specialty) {
        where += ' AND specialties LIKE ?';
        params.push(`%${specialty}%`);
      }
      const aliasedWhere = where
        .replaceAll('name', 'e.name')
        .replaceAll('phone', 'e.phone')
        .replaceAll('status', 'e.status')
        .replaceAll('service_region', 'e.service_region')
        .replaceAll('specialties', 'e.specialties');

      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM engineers ${where}`).bind(...params).first();
      const list = await env.DB.prepare(
        `SELECT
           e.id, e.user_no, e.name, e.phone, e.company, e.specialties, e.service_region,
           e.status, e.rating_count, e.rating_technical, e.created_at,
           e.engineer_role, e.regional_lead_id, e.responsible_region, e.team_name,
           e.certification_status, e.cooperation_status, e.workload_status,
           rl.name as regional_lead_name
         FROM engineers e
         LEFT JOIN engineers rl ON e.regional_lead_id = rl.id
         ${aliasedWhere}
         ORDER BY e.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all();

      return jsonResponse({
        total: total?.count || 0,
        list: (list.results || []).map(e => ({
          ...e,
          specialties: typeof e.specialties === 'string' ? JSON.parse(e.specialties) : (e.specialties || []),
        })),
      });
    } else {
      const region = url.searchParams.get('region') || '';

      let where = 'WHERE 1=1';
      const params = [];

      if (search) {
        where += ' AND (name LIKE ? OR phone LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }
      if (region) {
        where += ' AND region LIKE ?';
        params.push(`%${region}%`);
      }

      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM customers ${where}`).bind(...params).first();
      const list = await env.DB.prepare(
        `SELECT id, user_no, name, phone, company, region, created_at FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all();

      return jsonResponse({
        total: total?.count || 0,
        list: list.results || [],
      });
    }
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工单列表
async function handleAdminWorkOrders(request, env) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    let where = '';
    const params = [];
    if (status && status !== 'all') {
      where = 'WHERE w.status = ?';
      params.push(status);
    }

    const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM work_orders w ${where}`).bind(...params).first();

    const list = await env.DB.prepare(`
      SELECT w.id, w.order_no, w.type, w.description, w.urgency, w.status, w.created_at,
             w.assigned_regional_lead_id, w.conflict_status, w.conflict_reason,
             w.quote_review_status, w.customer_confirmation_method,
             c.name as customer_name, c.company as customer_company, c.user_no as customer_no,
             rl.name as regional_lead_name, rl.user_no as regional_lead_no,
             e.id as engineer_id, e.name as engineer_name, e.company as engineer_company, e.user_no as engineer_no,
             p.status as pricing_status, p.total_amount as pricing_total_amount, p.subtotal as pricing_subtotal
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN engineers rl ON w.assigned_regional_lead_id = rl.id
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN work_order_pricing p ON p.work_order_id = w.id
      ${where}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员将服务申请分配给区域负责人：Service OS 主派工第一步。
async function handleAdminAssignRegionalLead(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const { regional_lead_id } = await request.json();

    if (!workOrderId) return errorResponse('缺少服务申请 ID');
    if (!regional_lead_id) return errorResponse('请选择区域负责人');

    const wo = await env.DB.prepare(
      'SELECT id, order_no, status, assigned_regional_lead_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('服务申请不存在', 404);
    if (['completed', 'cancelled', 'rejected'].includes(wo.status)) {
      return errorResponse('该服务申请当前状态不允许分配', 409);
    }

    const regionalLead = await env.DB.prepare(
      "SELECT id, name, status, engineer_role FROM engineers WHERE id = ?"
    ).bind(regional_lead_id).first();
    if (!regionalLead) return errorResponse('区域负责人不存在', 404);
    if (regionalLead.engineer_role !== 'regional_lead') {
      return errorResponse('请选择区域负责人账号', 400);
    }

    const nextStatus = wo.status === 'pending' ? 'pending_dispatch' : wo.status;
    await env.DB.prepare(`
      UPDATE work_orders
      SET assigned_regional_lead_id = ?, status = ?, assigned_at = datetime('now')
      WHERE id = ?
    `).bind(regional_lead_id, nextStatus, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'assigned_regional_lead', 'admin', ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      request._auth?.userId || 'admin',
      `SAGEMRO 运营已分配给区域负责人 ${regionalLead.name || ''}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
      VALUES (?, ?, 'system', '', '系统', ?, 'system', 1, 0)
    `).bind(
      generateId(),
      workOrderId,
      `内部派工：SAGEMRO 运营已将服务申请分配给区域负责人 ${regionalLead.name || '区域负责人'}。`
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'assigned_regional_lead',
      beforeState: { assigned_regional_lead_id: wo.assigned_regional_lead_id, status: wo.status },
      afterState: { assigned_regional_lead_id: regional_lead_id, status: nextStatus },
    });

    await createNotification(env, {
      user_id: regional_lead_id,
      user_type: 'engineer',
      type: 'regional_assignment',
      title: '新的区域服务任务',
      body: `SAGEMRO 运营已将服务编号 ${wo.order_no} 分配给你，请安排具体工程师。`,
      data: { work_order_id: workOrderId },
    });

    return jsonResponse({
      success: true,
      work_order: {
        id: workOrderId,
        order_no: wo.order_no,
        status: nextStatus,
        assigned_regional_lead_id: regional_lead_id,
        regional_lead_name: regionalLead.name || '',
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员派工：Service OS 的主派工路径，替代旧工程师自由接单模型。
async function handleAdminAssignWorkOrder(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const { engineer_id } = await request.json();

    if (!workOrderId) return errorResponse('缺少服务申请 ID');
    if (!engineer_id) return errorResponse('请选择内部工程师');

    const wo = await env.DB.prepare(
      'SELECT id, order_no, status, customer_id, engineer_id, conflict_status, conflict_reason FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('服务申请不存在', 404);
    if (['completed', 'cancelled', 'rejected'].includes(wo.status)) {
      return errorResponse('该服务申请当前状态不允许派工', 409);
    }

    const engineer = await env.DB.prepare(
      'SELECT id, name, status FROM engineers WHERE id = ?'
    ).bind(engineer_id).first();
    if (!engineer) return errorResponse('工程师不存在', 404);

    const conflict = await evaluateDispatchConflict(env, workOrderId, engineer_id);
    if (conflict.status === 'blocked') {
      await env.DB.prepare(
        "UPDATE work_orders SET conflict_status = 'blocked', conflict_reason = ? WHERE id = ?"
      ).bind(conflict.reason, workOrderId).run();
      await writeAuditLog(env, request, {
        targetType: 'work_order',
        targetId: workOrderId,
        action: 'dispatch_blocked_conflict',
        beforeState: { engineer_id: wo.engineer_id, conflict_status: wo.conflict_status },
        afterState: { engineer_id, conflict_status: 'blocked', conflict_reason: conflict.reason },
      });
      return errorResponse(`存在利益冲突，禁止派工：${conflict.reason}`, 409);
    }

    const nextStatus = wo.status === 'pending' ? 'assigned' : wo.status;

    await env.DB.prepare(`
      UPDATE work_orders
      SET engineer_id = ?, status = ?, assigned_at = datetime('now'), conflict_status = 'clear', conflict_reason = NULL
      WHERE id = ?
    `).bind(engineer_id, nextStatus, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'assigned', 'admin', ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      request._auth?.userId || 'admin',
      `SAGEMRO 运营已派工给 ${engineer.name || '内部工程师'}`
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
      VALUES (?, ?, 'system', '', '系统', ?, 'system', 0, 1)
    `).bind(
      generateId(),
      workOrderId,
      `SAGEMRO 运营已安排 ${engineer.name || '内部工程师'} 跟进该服务申请。`
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'assigned_engineer_by_admin',
      beforeState: { engineer_id: wo.engineer_id, status: wo.status },
      afterState: { engineer_id, status: nextStatus },
    });

    if (wo.customer_id) {
      await createNotification(env, {
        user_id: wo.customer_id,
        user_type: 'customer',
        type: 'service_assigned',
        title: '服务申请已安排工程师',
        body: `服务编号 ${wo.order_no} 已由 SAGEMRO 运营安排内部工程师跟进。`,
        data: { work_order_id: workOrderId, engineer_id },
      });
    }

    await createNotification(env, {
      user_id: engineer_id,
      user_type: 'engineer',
      type: 'service_assignment',
      title: '新的服务任务',
      body: `SAGEMRO 运营已将服务编号 ${wo.order_no} 分配给你，请确认客户现场信息。`,
      data: { work_order_id: workOrderId },
    });

    return jsonResponse({
      success: true,
      work_order: {
        id: workOrderId,
        order_no: wo.order_no,
        status: nextStatus,
        engineer_id,
        engineer_name: engineer.name || '',
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminReviewWorkOrderPricing(request, env) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const workOrderId = parts[4];
    const action = parts[6]; // approve / reject
    const body = await request.json().catch(() => ({}));
    const reviewNote = (body.note || '').trim();

    if (!workOrderId || !['approve', 'reject'].includes(action)) {
      return errorResponse('无效报价审核操作', 400);
    }

    const wo = await env.DB.prepare(
      'SELECT id, order_no, customer_id, engineer_id, quote_review_status FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('服务申请不存在', 404);

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing) return errorResponse('报价不存在', 404);
    if (!['pending_review', 'submitted'].includes(pricing.status)) {
      return errorResponse('当前报价状态不允许审核', 409);
    }

    if (action === 'approve') {
      await env.DB.prepare(
        "UPDATE work_order_pricing SET status = 'submitted' WHERE work_order_id = ?"
      ).bind(workOrderId).run();
      await env.DB.prepare(
        "UPDATE work_orders SET status = 'pricing', quote_review_status = 'approved' WHERE id = ?"
      ).bind(workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
        VALUES (?, ?, 'system', '', '系统', ?, 'pricing_update', 0, 1)
      `).bind(
        generateId(),
        workOrderId,
        'SAGEMRO 已完成官方报价审核，请查看报价明细并确认。'
      ).run();

      await writeAuditLog(env, request, {
        targetType: 'work_order',
        targetId: workOrderId,
        action: 'pricing_review_approved',
        beforeState: { quote_review_status: wo.quote_review_status, pricing_status: pricing.status },
        afterState: { quote_review_status: 'approved', pricing_status: 'submitted' },
      });

      if (wo.customer_id) {
        await createNotification(env, {
          user_id: wo.customer_id,
          user_type: 'customer',
          type: 'official_quote_ready',
          title: 'SAGEMRO 官方报价已确认',
          body: `服务编号 ${wo.order_no} 的官方报价已完成审核，请查看并确认。`,
          data: { work_order_id: workOrderId },
        });
      }

      return jsonResponse({ success: true, status: 'approved' });
    }

    await env.DB.prepare(
      "UPDATE work_order_pricing SET status = 'draft' WHERE work_order_id = ?"
    ).bind(workOrderId).run();
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_progress', quote_review_status = 'rejected' WHERE id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
      VALUES (?, ?, 'system', '', '系统', ?, 'system', 1, 0)
    `).bind(
      generateId(),
      workOrderId,
      `内部报价审核未通过，请工程师修改后重新提交。${reviewNote ? `原因：${reviewNote}` : ''}`
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'pricing_review_rejected',
      beforeState: { quote_review_status: wo.quote_review_status, pricing_status: pricing.status },
      afterState: { quote_review_status: 'rejected', pricing_status: 'draft', note: reviewNote },
    });

    if (wo.engineer_id) {
      await createNotification(env, {
        user_id: wo.engineer_id,
        user_type: 'engineer',
        type: 'quote_review_rejected',
        title: '报价需修改',
        body: `服务编号 ${wo.order_no} 的报价未通过 SAGEMRO 官方审核，请修改后重新提交。`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({ success: true, status: 'rejected' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminArchiveWorkOrder(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    if (!workOrderId) return errorResponse('缺少服务申请 ID');

    const wo = await env.DB.prepare(
      'SELECT id, status, order_no FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('服务申请不存在', 404);
    if (!['resolved', 'pending_review', 'completed'].includes(wo.status)) {
      return errorResponse('当前服务申请尚不适合归档', 409);
    }

    await env.DB.prepare(
      "UPDATE work_orders SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now')) WHERE id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'archived', 'admin', ?, 'SAGEMRO 运营已完成服务归档。')
    `).bind(generateId(), workOrderId, request._auth?.userId || 'admin').run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'work_order_archived',
      beforeState: { status: wo.status },
      afterState: { status: 'completed' },
    });

    return jsonResponse({ success: true, status: 'completed' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 评价管理 ============

// 工单评价列表（管理员）
async function handleAdminRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const lowScore = url.searchParams.get('lowScore') === 'true';
    const sort = url.searchParams.get('sort') || 'created_at_desc';
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];

    if (lowScore) {
      where += ' AND ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) < 3';
    }

    const orderBy = sort === 'score_asc'
      ? 'ORDER BY ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) ASC'
      : sort === 'score_desc'
        ? 'ORDER BY ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4.0) DESC'
        : 'ORDER BY r.created_at DESC';

    const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM ratings r ${where}`).bind(...params).first();
    const list = await env.DB.prepare(`
      SELECT r.id, r.work_order_id, r.rating_timeliness, r.rating_technical, r.rating_communication, r.rating_professional, r.comment, r.created_at,
             c.name as customer_name, c.company as customer_company, c.user_no as customer_no,
             e.name as engineer_name, e.company as engineer_company, e.user_no as engineer_no,
             w.order_no
      FROM ratings r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN engineers e ON r.engineer_id = e.id
      LEFT JOIN work_orders w ON r.work_order_id = w.id
      ${where} ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    // 查询管理员回复
    const ratingIds = (list.results || []).map(r => r.id);
    const replies = {};
    if (ratingIds.length > 0) {
      const placeholders = ratingIds.map(() => '?').join(',');
      const replyResults = await env.DB.prepare(
        `SELECT * FROM admin_replies WHERE rating_id IN (${placeholders})`
      ).bind(...ratingIds).all();
      for (const reply of (replyResults.results || [])) {
        replies[reply.rating_id] = reply;
      }
    }

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(r => ({
        ...r,
        avg_score: ((r.rating_timeliness + r.rating_technical + r.rating_communication + r.rating_professional) / 4).toFixed(1),
        admin_reply: replies[r.id] || null,
      })),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员回复评价
async function handleAdminReplyRating(request, env) {
  try {
    const ratingId = new URL(request.url).pathname.split('/')[4]; // /api/admin/ratings/:id/reply
    const { content } = await request.json();

    if (!content) {
      return errorResponse('回复内容不能为空');
    }

    try {
      assertMaxLength(content, 'content', LIMITS.admin_reply);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 检查评价是否存在
    const rating = await env.DB.prepare('SELECT id FROM ratings WHERE id = ?').bind(ratingId).first();
    if (!rating) {
      return errorResponse('评价不存在', 404);
    }

    // 检查是否已回复
    const existing = await env.DB.prepare('SELECT id FROM admin_replies WHERE rating_id = ?').bind(ratingId).first();
    if (existing) {
      // 更新回复
      await env.DB.prepare('UPDATE admin_replies SET content = ?, created_at = datetime("now") WHERE rating_id = ?').bind(content, ratingId).run();
    } else {
      // 新增回复
      const id = generateId();
      await env.DB.prepare('INSERT INTO admin_replies (id, rating_id, content) VALUES (?, ?, ?)').bind(id, ratingId, content).run();
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 平台评价列表（管理员）
async function handleAdminPlatformRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    const total = await env.DB.prepare('SELECT COUNT(*) as count FROM platform_ratings').first();
    const list = await env.DB.prepare(`
      SELECT pr.id, pr.rating, pr.comment, pr.created_at,
             c.name as customer_name, c.user_no as customer_no
      FROM platform_ratings pr
      LEFT JOIN customers c ON pr.customer_id = c.id
      ORDER BY pr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师对客户的评价列表（管理员）
async function handleAdminCustomerRatings(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const offset = (page - 1) * pageSize;

    const total = await env.DB.prepare('SELECT COUNT(*) as count FROM customer_ratings').first();
    const list = await env.DB.prepare(`
      SELECT cr.id, cr.rating, cr.comment, cr.created_at,
             e.name as engineer_name, e.user_no as engineer_no,
             c.name as customer_name, c.user_no as customer_no,
             w.order_no
      FROM customer_ratings cr
      LEFT JOIN engineers e ON cr.engineer_id = e.id
      LEFT JOIN customers c ON cr.customer_id = c.id
      LEFT JOIN work_orders w ON cr.work_order_id = w.id
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: list.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 临时建表接口（仅供开发测试使用）============
async function handleInitDb(env) {
  try {
    const tables = [
      `CREATE TABLE IF NOT EXISTS work_order_pricing (
        id TEXT PRIMARY KEY,
        work_order_id TEXT NOT NULL UNIQUE,
        labor_fee INTEGER DEFAULT 0,
        parts_fee INTEGER DEFAULT 0,
        travel_fee INTEGER DEFAULT 0,
        other_fee INTEGER DEFAULT 0,
        parts_detail TEXT DEFAULT '',
        commission_rate REAL DEFAULT 0.05,
        commission_amount INTEGER DEFAULT 0,
        subtotal INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        ai_price_check TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        submitted_at TEXT,
        confirmed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS work_order_messages (
        id TEXT PRIMARY KEY,
        work_order_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT DEFAULT '',
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
      )`,
      `CREATE TABLE IF NOT EXISTS work_order_pricing_history (
        id TEXT PRIMARY KEY,
        pricing_id TEXT NOT NULL,
        labor_fee INTEGER DEFAULT 0,
        parts_fee INTEGER DEFAULT 0,
        travel_fee INTEGER DEFAULT 0,
        other_fee INTEGER DEFAULT 0,
        parts_detail TEXT DEFAULT '',
        subtotal INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        commission_amount INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (pricing_id) REFERENCES work_order_pricing(id)
      )`,
    ];

    for (const sql of tables) {
      await env.DB.prepare(sql).run();
    }

    // 添加工单新状态列（SQLite 不支持 DROP COLUMN，如果列已存在会报错，忽略）
    try {
      await env.DB.prepare("ALTER TABLE work_orders ADD COLUMN pricing_status TEXT DEFAULT 'none'").run();
    } catch (e) {
      // 列可能已存在，忽略
    }

    return jsonResponse({ success: true, message: 'Tables created successfully' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 临时测试数据初始化（仅供测试使用）============
async function handleInitTestData(env) {
  try {
    const created = { customers: [], engineers: [], workOrders: [], ratings: [] };

    // 创建客户
    const customerData = [
      { name: '张伟', phone: '13900001001', region: '华东', password: 'test1234' },
      { name: '李强', phone: '13900001002', region: '华南', password: 'test1234' },
      { name: '王磊', phone: '13900001003', region: '华北', password: 'test1234' },
      { name: '赵明', phone: '13900001004', region: '华东', password: 'test1234' },
      { name: '陈刚', phone: '13900001005', region: '华中', password: 'test1234' },
      { name: '刘洋', phone: '13900001006', region: '西南', password: 'test1234' },
      { name: '周涛', phone: '13900001007', region: '华南', password: 'test1234' },
      { name: '吴鹏', phone: '13900001008', region: '华北', password: 'test1234' },
      { name: '孙斌', phone: '13900001009', region: '东北', password: 'test1234' },
    ];

    for (const c of customerData) {
      const existing = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(c.phone).first();
      if (existing) { created.customers.push({ ...c, note: '已存在' }); continue; }
      const id = generateId();
      const userNo = await generateUserNo(env, 'U');
      const hash = await hashPasswordLegacy(c.password);
      await env.DB.prepare(
        'INSERT INTO customers (id, user_no, name, phone, password_hash, region) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, userNo, c.name, c.phone, hash, c.region).run();
      created.customers.push({ id, user_no: userNo, name: c.name, phone: c.phone, region: c.region });
    }

    // 创建工程师
    const engineerData = [
      { name: '李师傅', phone: '13900011001', status: 'available', specialties: '["激光切割机","折弯机"]', brands: '{"激光切割机":["大族","通快"],"折弯机":["通快","百超"]}', services: '["激光器维修","切割头维护","参数调试"]', service_region: '华东', bio: '15年激光设备维修经验', password: 'test1234' },
      { name: '张工', phone: '13900011002', status: 'paused', specialties: '["焊接机","激光焊接"]', brands: '{"焊接机":["福尼斯","林肯"],"激光焊接":["大族","华工"]}', services: '["电气排查","液压维修"]', service_region: '华南', bio: '专注焊接设备维修', password: 'test1234' },
      { name: '王技师', phone: '13900011003', status: 'available', specialties: '["冲床","剪板机"]', brands: '{"冲床":["通快","村田"],"剪板机":["黄石","扬力"]}', services: '["设备保养","参数调试"]', service_region: '华北', bio: '', password: 'test1234' },
      { name: '赵师傅', phone: '13900011004', status: 'offline', specialties: '["折弯机","卷板机"]', brands: '{"折弯机":["亚威","普玛宝"],"卷板机":["华工","扬力"]}', services: '["激光器维修","液压维修"]', service_region: '华中', bio: '', password: 'test1234' },
      { name: '刘工', phone: '13900011005', status: 'available', specialties: '["等离子切割","水刀切割"]', brands: '{"等离子切割":["飞博","瑞凌"],"水刀切割":["华臻"]}', services: '["切割头维护","设备保养"]', service_region: '西南', bio: '专业切割设备维修', password: 'test1234' },
      { name: '周工', phone: '13900011006', status: 'available', specialties: '["激光切割机","焊接机"]', brands: '{"激光切割机":["邦德","宏山"],"焊接机":["米勒","松下"]}', services: '["激光器维修","参数调试","电气排查"]', service_region: '全国', bio: '', password: 'test1234' },
    ];

    for (const e of engineerData) {
      const existing = await env.DB.prepare('SELECT id FROM engineers WHERE phone = ?').bind(e.phone).first();
      if (existing) { created.engineers.push({ ...e, note: '已存在' }); continue; }
      const id = generateId();
      const userNo = await generateUserNo(env, 'E');
      const hash = await hashPasswordLegacy(e.password);
      await env.DB.prepare(
        'INSERT INTO engineers (id, user_no, name, phone, password_hash, status, specialties, brands, services, service_region, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, userNo, e.name, e.phone, hash, e.status, e.specialties, e.brands, e.services, e.service_region, e.bio).run();
      created.engineers.push({ id, user_no: userNo, name: e.name, phone: e.phone, status: e.status, service_region: e.service_region });
    }

    // 创建工单（利用已有的客户和工程师）
    const customers = await env.DB.prepare('SELECT id FROM customers').all();
    const engineers = await env.DB.prepare('SELECT id FROM engineers').all();
    if (customers.results.length > 0 && engineers.results.length > 0) {
      const workOrderData = [
        { type: 'fault', urgency: 'critical', status: 'pending', description: '激光切割机切割时出现异响，突然停止工作' },
        { type: 'maintenance', urgency: 'normal', status: 'in_progress', description: '定期保养，导轨润滑，切割头校准' },
        { type: 'parameter', urgency: 'urgent', status: 'assigned', description: '切割参数异常，断面质量差，需要重新调参' },
        { type: 'other', urgency: 'normal', status: 'resolved', description: '设备搬迁后重新安装调试' },
        { type: 'fault', urgency: 'urgent', status: 'completed', description: '折弯机液压系统漏油，已修复' },
        { type: 'maintenance', urgency: 'normal', status: 'pending', description: '焊机电极磨损严重，需要更换并调试' },
        { type: 'parameter', urgency: 'normal', status: 'in_progress', description: '激光焊接机焦点偏移，需要校准' },
        { type: 'fault', urgency: 'critical', status: 'pending', description: '数控冲床冲头无法抬起，设备停机' },
      ];

      for (let i = 0; i < workOrderData.length; i++) {
        const wo = workOrderData[i];
        const cid = customers.results[i % customers.results.length].id;
        const eid = (wo.status !== 'pending') ? engineers.results[i % engineers.results.length].id : null;
        const id = generateId();
        const orderNo = `WO-TEST-${(i + 1).toString().padStart(3, '0')}`;
        const assignedAt = eid ? `datetime('now', '-${Math.floor(Math.random() * 3)} days')` : null;
        await env.DB.prepare(
          'INSERT INTO work_orders (id, order_no, customer_id, engineer_id, type, description, urgency, status, assigned_at, sla_deadline, category_l1, category_l2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, orderNo, cid, eid, wo.type, wo.description, wo.urgency, wo.status, assignedAt, computeSlaDeadline(wo.urgency), 'other', 'other').run();

        // 部分已完成工单添加日志
        if (wo.status === 'resolved' || wo.status === 'completed') {
          await env.DB.prepare(
            'INSERT INTO work_order_logs (id, work_order_id, action, actor_type, content) VALUES (?, ?, ?, ?, ?)'
          ).bind(generateId(), id, '工单已解决', 'engineer', '问题已修复，客户确认').run();
        }

        created.workOrders.push({ id, order_no: orderNo, status: wo.status, customer_id: cid, engineer_id: eid });
      }

      // 创建评价（针对已完成/已解决的工单）
      const ratedWorkOrders = created.workOrders.filter(w => w.status === 'resolved' || w.status === 'completed');
      const ratingData = [
        { timeliness: 5, technical: 5, communication: 5, professional: 5, comment: '李师傅非常专业，问题很快就解决了，非常满意！', avg: 5.0 },
        { timeliness: 3, technical: 2, communication: 3, professional: 2, comment: '响应速度一般，技术水平有待提高。', avg: 2.5 },
        { timeliness: 4, technical: 4, communication: 5, professional: 4, comment: '沟通很顺畅，工程师很有耐心，给个好评！', avg: 4.25 },
        { timeliness: 1, technical: 1, communication: 1, professional: 2, comment: '等了两天才来，而且修完没过多久又出问题了，非常失望。', avg: 1.25 },
        { timeliness: 4, technical: 3, communication: 4, professional: 4, comment: '整体不错，就是价格稍微贵了点。', avg: 3.75 },
      ];

      for (let i = 0; i < Math.min(ratedWorkOrders.length, ratingData.length); i++) {
        const wo = ratedWorkOrders[i];
        const rd = ratingData[i];
        const existingRating = await env.DB.prepare('SELECT id FROM ratings WHERE work_order_id = ?').bind(wo.id).first();
        if (existingRating) continue;

        // 找一个对应的工程师ID
        const woData = await env.DB.prepare('SELECT engineer_id FROM work_orders WHERE id = ?').bind(wo.id).first();
        if (!woData?.engineer_id) continue;
        const rid = generateId();
        await env.DB.prepare(
          'INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(rid, wo.id, woData.engineer_id, wo.customer_id, rd.timeliness, rd.technical, rd.communication, rd.professional, rd.comment).run();

        // 更新工程师评分
        const allRatings = await env.DB.prepare('SELECT * FROM ratings WHERE engineer_id = ?').bind(woData.engineer_id).all();
        const count = allRatings.results.length;
        if (count > 0) {
          const avgT = allRatings.results.reduce((s, r) => s + r.rating_timeliness, 0) / count;
          const avgTech = allRatings.results.reduce((s, r) => s + r.rating_technical, 0) / count;
          const avgC = allRatings.results.reduce((s, r) => s + r.rating_communication, 0) / count;
          const avgP = allRatings.results.reduce((s, r) => s + r.rating_professional, 0) / count;
          await env.DB.prepare(
            'UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ? WHERE id = ?'
          ).bind(avgT, avgTech, avgC, avgP, count, woData.engineer_id).run();
        }

        // 添加管理员回复（部分评价）
        if (i === 1 || i === 3) {
          const replyId = generateId();
          const replyContent = i === 1 ? '非常抱歉给您带来不好的体验，我们会跟进工程师的服务质量，感谢您的反馈。'
            : '对不起，这种情况是不应该发生的。我们已将此问题反馈给工程师团队，会尽快安排复检。如有需要请联系客服。';
          await env.DB.prepare('INSERT INTO admin_replies (id, rating_id, content) VALUES (?, ?, ?)').bind(replyId, rid, replyContent).run();
        }

        created.ratings.push({ work_order_id: wo.id, avg: rd.avg, comment: rd.comment });
      }

      // 平台评价
      const platformRatings = [
        { rating: 5, comment: '平台很好用，SAGEMRO AI 很专业，解决了我的很多问题！' },
        { rating: 4, comment: '整体满意，希望能覆盖更多地区。' },
        { rating: 3, comment: '还行，希望后续能增加更多工程师。' },
      ];
      for (let i = 0; i < Math.min(platformRatings.length, customers.results.length); i++) {
        const pr = platformRatings[i];
        const cid = customers.results[i].id;
        const existingPR = await env.DB.prepare('SELECT id FROM platform_ratings WHERE customer_id = ?').bind(cid).first();
        if (existingPR) continue;
        const pid = generateId();
        await env.DB.prepare('INSERT INTO platform_ratings (id, customer_id, rating, comment) VALUES (?, ?, ?, ?)').bind(pid, cid, pr.rating, pr.comment).run();
        created.ratings.push({ type: 'platform', customer_id: cid, rating: pr.rating });
      }

      // 工程师对客户的评价（内部）
      if (ratedWorkOrders.length >= 2) {
        for (let i = 0; i < 2; i++) {
          const wo = ratedWorkOrders[i];
          const woData = await env.DB.prepare('SELECT engineer_id, customer_id FROM work_orders WHERE id = ?').bind(wo.id).first();
          if (!woData?.engineer_id) continue;
          const existingCR = await env.DB.prepare('SELECT id FROM customer_ratings WHERE work_order_id = ? AND engineer_id = ?').bind(wo.id, woData.engineer_id).first();
          if (existingCR) continue;
          const crid = generateId();
          const crRating = 3 + Math.floor(Math.random() * 3);
          const crComment = crRating >= 4 ? '客户配合度高，沟通顺畅。' : '客户描述不够清楚，耽误了一些时间。';
          await env.DB.prepare('INSERT INTO customer_ratings (id, work_order_id, engineer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)').bind(crid, wo.id, woData.engineer_id, woData.customer_id, crRating, crComment).run();
          created.ratings.push({ type: 'customer_rating', work_order_id: wo.id, rating: crRating });
        }
      }
    }

    return jsonResponse({ success: true, created });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 完整核价流程测试 ============
async function handleTestFullPricingFlow(env) {
  const results = { flow: [] };

  const log = (step, data) => results.flow.push({ step, ...data });

  try {
    // ====== 第1步：创建3个不同专长的工程师 ======
    log('step1_create_engineers', { message: '创建3个专长不同的工程师' });

    const engineers = [
      {
        id: generateId(),
        user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
        name: '李师傅',
        phone: '18800001001',
        password_hash: 'test',
        specialties: JSON.stringify(['激光切割机', '等离子切割机']),
        brands: JSON.stringify({ '激光切割机': ['大族', '通快', '百超'], '等离子切割机': ['林德', '凯尔尼'] }),
        services: JSON.stringify(['激光器维修', '切割头维护', '导轨润滑', '参数调试']),
        service_region: '华东地区',
        bio: '专注激光设备15年，擅长通快、大族设备',
        rating_timeliness: 4.8,
        rating_technical: 4.9,
        rating_communication: 4.7,
        rating_professional: 4.9,
        rating_count: 48,
      },
      {
        id: generateId(),
        user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
        name: '王师傅',
        phone: '18800001002',
        password_hash: 'test',
        specialties: JSON.stringify(['折弯机', '剪板机', '卷板机']),
        brands: JSON.stringify({ '折弯机': ['通快', '百超', 'Amada'], '剪板机': ['金方圆', '扬力'] }),
        services: JSON.stringify(['液压维修', '同步精度校准', '模具维护', '参数调试']),
        service_region: '华东地区',
        bio: '擅长钣金成形设备，10年经验',
        rating_timeliness: 4.5,
        rating_technical: 4.7,
        rating_communication: 4.6,
        rating_professional: 4.5,
        rating_count: 32,
      },
      {
        id: generateId(),
        user_no: 'E' + String(100 + Math.floor(Math.random() * 900000)).padStart(6, '0'),
        name: '张师傅',
        phone: '18800001003',
        password_hash: 'test',
        specialties: JSON.stringify(['激光焊接', 'MIG焊接', 'TIG焊接']),
        brands: JSON.stringify({ '激光焊接': ['通快', 'IPG'], 'MIG焊接': ['福尼斯', '林肯'] }),
        services: JSON.stringify(['焊接参数调优', '焊缝质量排查', '送丝机构维护']),
        service_region: '华南地区',
        bio: '焊接专家，精通各类焊接设备调试',
        rating_timeliness: 4.3,
        rating_technical: 4.6,
        rating_communication: 4.8,
        rating_professional: 4.4,
        rating_count: 25,
      },
    ];

    for (const eng of engineers) {
      const existing = await env.DB.prepare('SELECT id FROM engineers WHERE phone = ?').bind(eng.phone).first();
      if (!existing) {
        await env.DB.prepare(`
          INSERT INTO engineers (id, user_no, name, phone, password_hash, specialties, brands, services, service_region, bio, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available')
        `).bind(eng.id, eng.user_no, eng.name, eng.phone, eng.password_hash, eng.specialties, eng.brands, eng.services, eng.service_region, eng.bio, eng.rating_timeliness, eng.rating_technical, eng.rating_communication, eng.rating_professional, eng.rating_count).run();
      }
      eng.created = !existing;
    }
    log('step1_done', { engineers: engineers.map(e => ({ name: e.name, phone: e.phone, specialties: JSON.parse(e.specialties), created: e.created })) });

    // ====== 第2步：创建一个测试客户 ======
    log('step2_create_customer', { message: '创建测试客户' });
    const customerId = generateId();
    const customerPhone = '18900001001';
    const customerName = '张伟';

    const existingCust = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(customerPhone).first();
    const finalCustomerId = existingCust ? existingCust.id : customerId;
    if (!existingCust) {
      await env.DB.prepare(`
        INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region)
        VALUES (?, 'C' || substr(?, 10), ?, ?, 'test', '', '华东地区')
      `).bind(customerId, customerId, customerName, customerPhone).run();
    }
    log('step2_done', { customer_id: finalCustomerId, name: customerName, phone: customerPhone });

    // ====== 第3步：客户提交工单 ======
    log('step3_submit_workorder', { message: '客户提交工单' });
    const workOrderId = generateId();
    const orderNo = 'WO-TEST-' + generateId().slice(0, 8).toUpperCase();

    await env.DB.prepare(`
      INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status, sla_deadline, category_l1, category_l2)
      VALUES (?, ?, ?, 'fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', 'pending', ?, 'laser_cutting', 'optical_fault')
    `).bind(workOrderId, orderNo, finalCustomerId, computeSlaDeadline('urgent')).run();

    // 生成 AI 摘要
    const aiSummary = await generateWorkOrderSummary('fault', '光纤激光切割机（3000W大族）切割时出现毛刺，切面不光洁，侧壁有挂渣。已经更换过辅助气体（氮气），问题仍然存在。设备使用3年，近期未做保养。', 'urgent', env);
    await env.DB.prepare('UPDATE work_orders SET ai_summary = ? WHERE id = ?').bind(JSON.stringify(aiSummary), workOrderId).run();

    log('step3_done', { work_order_id: workOrderId, order_no: orderNo, ai_summary: aiSummary });

    // ====== 第4步：AI 推荐工程师 ======
    log('step4_ai_recommend', { message: 'AI 分析工单并推荐工程师' });
    const workOrder = await env.DB.prepare('SELECT * FROM work_orders WHERE id = ?').bind(workOrderId).first();
    const recommended = await findMatchingEngineers(workOrder, env);
    log('step4_done', {
      recommended_engineers: recommended.map(e => ({
        name: e.name,
        total_score: e.totalScore,
        specialty_score: e.specialtyScore,
        skill_score: e.skillScore,
        brand_bonus: e.brandBonus,
        avg_rating: ((e.rating_timeliness + e.rating_technical + e.rating_communication + e.rating_professional) / 4).toFixed(1),
        specialties: e.specialties,
      }))
    });

    // ====== 第5步：第1名工程师接单 ======
    log('step5_engineer_accept', { message: '最优推荐工程师接单' });
    const topEngineer = recommended[0];
    await env.DB.prepare(`
      UPDATE work_orders SET status = 'in_progress', engineer_id = ?, assigned_at = datetime('now')
      WHERE id = ?
    `).bind(topEngineer.id, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'accepted', 'engineer', ?, ?)
    `).bind(generateId(), workOrderId, topEngineer.id, `${topEngineer.name} 接单`).run();

    log('step5_done', { engineer_name: topEngineer.name, status: 'in_progress' });

    // ====== 第6步：工程师提交核价 ======
    log('step6_engineer_pricing', { message: '工程师提交核价' });

    // 读取工程师佣金比例（按等级：Junior 80% / Senior 85% / Expert 88%）
    const engineerData = await env.DB.prepare(
      'SELECT commission_rate, level FROM engineers WHERE id = ?'
    ).bind(topEngineer.id).first();
    const commissionRate = engineerData?.commission_rate || 0.80;

    const laborFee = 800; // 工时费
    const partsFee = 200; // 配件费（保护镜片等）
    const travelFee = 200; // 差旅费
    const otherFee = 0;
    const subtotal = laborFee + partsFee + travelFee + otherFee;
    // V2佣金体系：客户支付 subtotal（工程师报的全包价），平台从工程师端抽佣
    const platformFee = Math.round(subtotal * (1 - commissionRate));  // 平台服务费
    const depositWithhold = Math.round(subtotal * 0.05);             // 动态保证金 5%
    const engineerPayout = Math.round(subtotal * commissionRate);     // 工程师实得

    // AI 审核报价
    const aiCheck = await checkPricing合理性({ labor_fee: laborFee, parts_fee: partsFee, travel_fee: travelFee, other_fee: otherFee, total_amount: subtotal }, workOrderId, env);

    const pricingId = generateId();
    await env.DB.prepare(`
      INSERT INTO work_order_pricing (id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee, subtotal, platform_fee, deposit_withhold, total_amount, ai_price_check, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
    `).bind(pricingId, workOrderId, topEngineer.id, laborFee, partsFee, travelFee, otherFee, subtotal, platformFee, depositWithhold, subtotal, JSON.stringify(aiCheck)).run();

    // 更新工单状态
    await env.DB.prepare("UPDATE work_orders SET status = 'pricing' WHERE id = ?").bind(workOrderId).run();

    // 发送系统消息
    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
      VALUES (?, ?, 'system', '', '系统', '工程师已提交报价，请查看报价明细并确认。', 'pricing_update')
    `).bind(generateId(), workOrderId).run();

    log('step6_done', {
      pricing: { laborFee, partsFee, travelFee, otherFee, subtotal, commissionRate, platformFee, depositWithhold, engineerPayout },
      ai_check: aiCheck,
      work_order_status: 'pricing'
    });

    // ====== 第7步：客户确认报价 ======
    log('step7_customer_confirm', { message: '客户确认报价' });
    await env.DB.prepare(`
      UPDATE work_order_pricing SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?
    `).bind(pricingId).run();

    await env.DB.prepare(`
      UPDATE work_orders SET status = 'in_service' WHERE id = ?
    `).bind(workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
      VALUES (?, ?, 'system', '', '系统', '客户已确认报价，工程师将上门服务。', 'system')
    `).bind(generateId(), workOrderId).run();

    log('step7_done', { work_order_status: 'in_service' });

    // ====== 第8步：工程师标记服务完成 ======
    log('step8_resolve', { message: '工程师上门服务完成' });
    await env.DB.prepare(`
      UPDATE work_orders SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?
    `).bind(workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
      VALUES (?, ?, 'system', '', '系统', '服务已完成，请客户确认并评价。', 'system')
    `).bind(generateId(), workOrderId).run();

    log('step8_done', { work_order_status: 'resolved' });

    // ====== 第9步：客户提交评价 ======
    log('step9_customer_rating', { message: '客户提交评价' });
    const ratingId = generateId();
    await env.DB.prepare(`
      INSERT INTO ratings (id, work_order_id, engineer_id, customer_id, rating_timeliness, rating_technical, rating_communication, rating_professional, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(ratingId, workOrderId, topEngineer.id, finalCustomerId, 5, 5, 4, 5, '服务很专业，准时到达，问题解决了，满意！').run();

    // 更新工程师评分
    const newTimeliness = ((topEngineer.rating_timeliness * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
    const newTechnical = ((topEngineer.rating_technical * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
    const newComm = ((topEngineer.rating_communication * topEngineer.rating_count) + 4) / (topEngineer.rating_count + 1);
    const newProf = ((topEngineer.rating_professional * topEngineer.rating_count) + 5) / (topEngineer.rating_count + 1);
    await env.DB.prepare(`
      UPDATE engineers SET rating_timeliness = ?, rating_technical = ?, rating_communication = ?, rating_professional = ?, rating_count = ? WHERE id = ?
    `).bind(newTimeliness.toFixed(1), newTechnical.toFixed(1), newComm.toFixed(1), newProf.toFixed(1), topEngineer.rating_count + 1, topEngineer.id).run();

    // 工单标记完成
    await env.DB.prepare(`
      UPDATE work_orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?
    `).bind(workOrderId).run();

    log('step9_done', { rating_submitted: true, work_order_status: 'completed' });

    // 保存结果到D1
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS test_flow_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          step TEXT,
          data TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
      for (const item of results.flow) {
        await env.DB.prepare(
          'INSERT INTO test_flow_results (step, data) VALUES (?, ?)'
        ).bind(item.step, JSON.stringify(item)).run();
      }
    } catch (e) {
      console.error('保存结果失败:', e);
    }

    return jsonResponse({ success: true, flow: results.flow });
  } catch (error) {
    return errorResponse('测试流程出错: ' + error.message, 500);
  }
}

// 工程师标记服务完成
async function handleResolveWorkOrder(request, env) {
  try {
    // 认证：engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可标记完成', 403);
    }
    const engineer_id = auth.userId;

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare(
      'SELECT status, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.engineer_id !== engineer_id) {
      return errorResponse('您无权操作该工单', 403);
    }

    const repairRecord = await env.DB.prepare(
      'SELECT symptom, diagnosis, solution, parts_used, labor_hours FROM work_order_repair_records WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    let hasParts = false;
    if (repairRecord?.parts_used) {
      try {
        const parts = JSON.parse(repairRecord.parts_used);
        hasParts = Array.isArray(parts) && parts.some((part) => part?.name);
      } catch {
        hasParts = false;
      }
    }
    const hasServiceReport = Boolean(
      repairRecord?.symptom ||
      repairRecord?.diagnosis ||
      repairRecord?.solution ||
      Number(repairRecord?.labor_hours || 0) > 0 ||
      hasParts
    );
    if (!hasServiceReport) {
      return errorResponse('请先填写服务报告，再标记服务完成', 400);
    }

    // 仅允许 in_service 或 pricing 状态时标记完成
    if (['in_service', 'pricing'].includes(wo.status)) {
      await env.DB.prepare(
        "UPDATE work_orders SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?"
      ).bind(workOrderId).run();

      await env.DB.prepare(`
        INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
        VALUES (?, ?, 'resolved', 'engineer', ?, '工程师标记服务完成，等待客户确认。')
      `).bind(generateId(), workOrderId, engineer_id || '').run();

      await env.DB.prepare(`
        INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type)
        VALUES (?, ?, 'system', '', '系统', '服务已完成，请客户确认并评价。', 'system')
      `).bind(generateId(), workOrderId).run();

      // 通知客户：服务已完成
      const woResolve = await env.DB.prepare('SELECT customer_id, order_no FROM work_orders WHERE id = ?').bind(workOrderId).first();
      if (woResolve?.customer_id) {
        await createNotification(env, {
          user_id: woResolve.customer_id,
          user_type: 'customer',
          type: 'ticket_resolved',
          title: '服务已完成',
          body: `工单 ${woResolve.order_no} 的服务已完成，请确认并评价。`,
          data: { work_order_id: workOrderId },
        });
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户取消工单
async function handleCancelWorkOrder(request, env) {
  try {
    const auth = request._auth;
    if (!auth || (auth.userType !== 'customer' && auth.userType !== 'admin')) {
      return errorResponse('仅客户可取消工单', 403);
    }
    const userId = auth.userId;

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare(
      'SELECT id, status, customer_id, engineer_id, order_no FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);

    if (auth.userType === 'customer' && wo.customer_id !== userId) {
      return errorResponse('您无权操作该工单', 403);
    }

    const cancelableStatuses = ['pending', 'assigned', 'in_progress', 'pricing'];
    if (!cancelableStatuses.includes(wo.status)) {
      return errorResponse('当前状态不可取消', 400);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'cancelled', completed_at = ? WHERE id = ?"
    ).bind(now, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'cancelled', ?, ?, '客户取消工单')
    `).bind(generateId(), workOrderId, auth.userType, userId).run();

    // 通知工程师（如已分配）
    if (wo.engineer_id) {
      await createNotification(env, {
        user_id: wo.engineer_id,
        user_type: 'engineer',
        type: 'ticket_cancelled',
        title: '工单已取消',
        body: `工单 ${wo.order_no} 已被客户取消。`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 前端评价 API ============

// 客户提交平台评价
async function handleSubmitPlatformRating(request, env) {
  try {
    const { rating, comment } = await request.json();

    try {
      assertMaxLength(comment, 'comment', LIMITS.comment);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 认证：customer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse('仅客户可评价平台', 403);
    }
    const customer_id = auth.userId;

    if (!rating) {
      return errorResponse('请填写评分');
    }
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO platform_ratings (id, customer_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).bind(id, customer_id, rating, comment || '').run();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师评价客户
async function handleSubmitCustomerRating(request, env) {
  try {
    const { work_order_id, rating, comment } = await request.json();

    try {
      assertMaxLength(comment, 'comment', LIMITS.comment);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 认证：仅工程师可评价客户，engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可评价客户', 403);
    }
    const engineer_id = auth.userId;

    if (!work_order_id || !rating) {
      return errorResponse('缺少必填字段');
    }

    // 校验工单归属 + 拿 customer_id
    const wo = await env.DB.prepare(
      'SELECT customer_id FROM work_orders WHERE id = ? AND engineer_id = ?'
    ).bind(work_order_id, engineer_id).first();
    if (!wo) return errorResponse('工单不存在或非您的工单', 403);
    const customer_id = wo.customer_id;

    // 检查是否已评价
    const existing = await env.DB.prepare(
      'SELECT id FROM customer_ratings WHERE work_order_id = ? AND engineer_id = ?'
    ).bind(work_order_id, engineer_id).first();
    if (existing) {
      return errorResponse('已评价过该工单');
    }
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO customer_ratings (id, work_order_id, engineer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, work_order_id, engineer_id, customer_id, rating, comment || '').run();
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 工单消息与核价 API ============

// 获取工单消息列表
async function handleGetWorkOrderMessages(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(request._auth, wo);

    const isCustomer = request._auth?.userType === 'customer';
    const messages = isCustomer
      ? await env.DB.prepare(
          'SELECT * FROM work_order_messages WHERE work_order_id = ? AND COALESCE(is_customer_visible, 1) = 1 AND COALESCE(is_internal_note, 0) = 0 ORDER BY created_at ASC'
        ).bind(workOrderId).all()
      : await env.DB.prepare(
          'SELECT * FROM work_order_messages WHERE work_order_id = ? ORDER BY created_at ASC'
        ).bind(workOrderId).all();
    return jsonResponse({ list: messages.results || [] });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 发送工单消息
async function handlePostWorkOrderMessage(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { content, message_type, is_internal_note } = await request.json();

    // 认证：sender_type / sender_id / sender_name 从 token 和数据库查，不接受客户端传入
    const auth = request._auth;
    if (!auth) return errorResponse('请先登录', 401);
    if (!content) return errorResponse('消息内容不能为空');

    try {
      assertMaxLength(content, 'content', LIMITS.content);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 验证工单存在 + 校验发送人确实参与了该工单
    const wo = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);

    let sender_type, sender_id, sender_name;
    if (auth.userType === 'customer') {
      if (wo.customer_id !== auth.userId) return errorResponse('您无权在该工单留言', 403);
      sender_type = 'customer';
      sender_id = auth.userId;
      const row = await env.DB.prepare('SELECT name FROM customers WHERE id = ?').bind(sender_id).first();
      sender_name = row?.name || '客户';
    } else if (auth.userType === 'engineer') {
      if (wo.engineer_id !== auth.userId && wo.assigned_regional_lead_id !== auth.userId) return errorResponse('您无权在该工单留言', 403);
      sender_type = 'engineer';
      sender_id = auth.userId;
      const row = await env.DB.prepare('SELECT name FROM engineers WHERE id = ?').bind(sender_id).first();
      sender_name = row?.name || '工程师';
    } else if (auth.userType === 'admin') {
      sender_type = 'admin';
      sender_id = auth.userId;
      sender_name = '管理员';
    } else {
      return errorResponse('不支持的发送人类型', 403);
    }

    // PII 脱敏（Phase 0.5）：工单消息是客户↔工程师的自由输入，最容易泄露手机号
    // 只清洗 text 类消息；pricing_update / system 是平台自生成的结构化消息，不需要清洗
    const safeContent =
      (message_type || 'text') === 'text' ? redactPII(content) : content;
    const internalNote = auth.userType === 'customer' ? 0 : (is_internal_note ? 1 : 0);
    const customerVisible = internalNote ? 0 : 1;

    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, workOrderId, sender_type, sender_id, sender_name, safeContent, message_type || 'text', internalNote, customerVisible).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: internalNote ? 'internal_note_created' : 'work_order_message_created',
      afterState: { message_id: id, sender_type, is_internal_note: internalNote },
    });

    return jsonResponse({ success: true, id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单核价信息
async function handleGetWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id, assigned_regional_lead_id, quote_review_status FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(request._auth, wo);

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (
      request._auth?.userType === 'customer' &&
      pricing &&
      !['submitted', 'confirmed'].includes(pricing.status)
    ) {
      return jsonResponse({ pricing: null, quote_review_status: wo.quote_review_status || 'pending_review' });
    }
    return jsonResponse({ pricing: pricing || null });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// AI 报价审核：规则判断 + LLM 文字解读
// 规则层保证确定性结果（high / reasonable / low），AI 层补充人类可读的解释与建议。
async function checkPricingReasonableness(pricing, workOrderId, env) {
  try {
    // 获取工单 + 客户地区
    const wo = await env.DB.prepare(
      'SELECT w.*, c.region as customer_region FROM work_orders w LEFT JOIN customers c ON w.customer_id = c.id WHERE w.id = ?'
    ).bind(workOrderId).first();

    // 获取该工程师的历史报价记录（最多 10 条已确认报价）
    let history = { results: [] };
    if (wo?.engineer_id) {
      history = await env.DB.prepare(
        `SELECT total_amount, labor_fee, parts_fee, travel_fee, other_fee
           FROM work_order_pricing
          WHERE engineer_id = ? AND status = 'confirmed'
          ORDER BY created_at DESC LIMIT 10`
      ).bind(wo.engineer_id).all();
    }

    // 获取该地区同类工单的平均报价
    let regionalAvg = null;
    let regionalCount = 0;
    if (wo?.customer_region && wo?.type) {
      const regional = await env.DB.prepare(`
        SELECT AVG(p.total_amount) as avg_amount, COUNT(*) as cnt
        FROM work_order_pricing p
        JOIN work_orders w ON p.work_order_id = w.id
        JOIN customers c ON w.customer_id = c.id
        WHERE p.status = 'confirmed' AND c.region = ? AND w.type = ?
      `).bind(wo.customer_region, wo.type).first();
      regionalAvg = regional?.avg_amount || null;
      regionalCount = regional?.cnt || 0;
    }

    // 工程师个人历史均价
    const engineerAvg = history.results?.length
      ? history.results.reduce((s, r) => s + (r.total_amount || 0), 0) / history.results.length
      : null;

    const subtotal = (pricing.labor_fee || 0) + (pricing.parts_fee || 0) + (pricing.travel_fee || 0) + (pricing.other_fee || 0);
    const total = pricing.total_amount || subtotal;

    // 规则层判断（确定性）
    let status = 'reasonable';
    let reason = '报价在合理区间内';

    if (regionalAvg && regionalCount >= 3) {
      if (total > regionalAvg * 1.3) {
        status = 'high';
        reason = `报价高于同地区同类工单平均价约 ${Math.round((total / regionalAvg - 1) * 100)}%，请确认配件和人工费用是否偏高`;
      } else if (total < regionalAvg * 0.7) {
        status = 'low';
        reason = `报价低于同地区同类工单平均价约 ${Math.round((1 - total / regionalAvg) * 100)}%，请确认是否遗漏费用`;
      }
    }

    // AI 文字解读（附加信息，不改变 status）
    let aiNote = null;
    if (env.OPENAI_API_KEY && env.OPENAI_API_ENDPOINT) {
      aiNote = await generatePricingAINote({
        pricing,
        subtotal,
        total,
        workOrder: wo,
        regionalAvg,
        regionalCount,
        engineerAvg,
        ruleStatus: status,
      }, env);
    }

    return {
      status,
      reason,
      regional_avg: regionalAvg,
      regional_count: regionalCount,
      engineer_avg: engineerAvg,
      history_count: history.results?.length || 0,
      ai_note: aiNote,
    };
  } catch (error) {
    console.error('[checkPricingReasonableness]', error);
    return {
      status: 'reasonable',
      reason: '无法完成 AI 审核（数据不足或服务异常）',
      regional_avg: null,
      engineer_avg: null,
      history_count: 0,
      ai_note: null,
    };
  }
}

// 旧名兼容（其他调用处仍在用中文函数名，等 Task #12 统一重命名再去掉）
const checkPricing合理性 = checkPricingReasonableness;

// 调用 LLM 生成报价解读。失败返回 null，不影响主流程。
async function generatePricingAINote(ctx, env) {
  // 后台系统调用，计入全平台日配额
  try {
    await enforceOpenAIBudget(env, { userKey: 'system:pricing_note', tag: 'note' });
  } catch (e) {
    if (e instanceof BudgetError) {
      console.warn('[generatePricingAINote] skipped by budget:', e.message);
      return null;
    }
    throw e;
  }
  const { pricing, subtotal, total, workOrder, regionalAvg, regionalCount, engineerAvg, ruleStatus } = ctx;

  const prompt = `你是钣金加工行业的维修报价审核顾问。下面是一张待审核的维修报价单，请你用一到两句中文点评它是否合理、有无遗漏，并给出具体改进建议。只返回 JSON，不要 markdown，不要额外说明。

工单信息：
- 类型：${workOrder?.type || '未知'}
- 紧急程度：${workOrder?.urgency || '未知'}
- 故障描述：${(workOrder?.description || '').slice(0, 200)}
- 地区：${workOrder?.customer_region || '未知'}

报价明细（单位：元）：
- 人工费：${pricing.labor_fee || 0}
- 配件费：${pricing.parts_fee || 0}
- 差旅费：${pricing.travel_fee || 0}
- 其他费用：${pricing.other_fee || 0}
- 小计：${subtotal}
- 客户应付：${total}

参考数据：
- 本地区同类工单平均价：${regionalAvg ? Math.round(regionalAvg) + ' 元（样本 ' + regionalCount + ' 单）' : '暂无足够样本'}
- 该工程师历史均价：${engineerAvg ? Math.round(engineerAvg) + ' 元' : '暂无'}
- 规则引擎判断：${ruleStatus === 'high' ? '偏高' : ruleStatus === 'low' ? '偏低' : '合理'}

输出 JSON：
{
  "summary": "一句话整体点评（不超过 40 字）",
  "suggestions": ["具体建议 1", "具体建议 2"]
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: getJsonModel(env),
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.2,
        max_tokens: MAX_TOKENS.note,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.error('[generatePricingAINote] API error:', resp.status);
      return null;
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const jsonStr = content.replace(/^```json\n?/i, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || '',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch (error) {
    console.error('[generatePricingAINote]', error?.message || error);
    return null;
  }
}

// 工程师提交/更新核价（V2：按工程师等级浮动佣金）
async function handleSubmitWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { labor_fee, parts_fee, travel_fee, other_fee, parts_detail } = await request.json();

    try {
      assertMaxLength(parts_detail, 'parts_detail', LIMITS.parts_detail);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    // 认证：仅工程师可提交报价；engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可提交报价', 403);
    }
    const targetEngineerId = auth.userId;

    // 验证工单 + 校验工单归属该工程师
    const wo = await env.DB.prepare('SELECT * FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.engineer_id !== targetEngineerId) {
      return errorResponse('您无权对该工单报价', 403);
    }

    // 读取工程师佣金比例（按等级：Junior 80% / Senior 85% / Expert 88%）
    const engineerRow = await env.DB.prepare(
      'SELECT commission_rate, level FROM engineers WHERE id = ?'
    ).bind(targetEngineerId).first();
    const commissionRate = engineerRow?.commission_rate || 0.80;
    const engineerLevel = engineerRow?.level || 'junior';

    const subtotal = (labor_fee || 0) + (parts_fee || 0) + (travel_fee || 0) + (other_fee || 0);
    // 代收代付模式：subtotal = 客户支付总额（平台代收）
    // platformFee = 平台技术服务费（平台营收，6%信息技术服务税率）
    // engineerPayout = 维修服务费（代收代付，转付工程师）
    const platformFee = Math.round(subtotal * (1 - commissionRate));
    const depositWithhold = Math.round(subtotal * 0.05);
    const engineerPayout = Math.round(subtotal * commissionRate);

    // AI 审核
    const aiCheck = await checkPricing合理性({ labor_fee, parts_fee, travel_fee, other_fee, total_amount: subtotal }, workOrderId, env);

    // 检查是否已有报价
    const existing = await env.DB.prepare(
      'SELECT id FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    if (existing) {
      // 更新报价
      await env.DB.prepare(`
        UPDATE work_order_pricing SET
          labor_fee = ?, parts_fee = ?, travel_fee = ?, other_fee = ?,
          parts_detail = ?, subtotal = ?, platform_fee = ?,
          deposit_withhold = ?, total_amount = ?, ai_price_check = ?,
          status = 'pending_review', submitted_at = datetime('now')
        WHERE work_order_id = ?
      `).bind(labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0,
           JSON.stringify(parts_detail || []), subtotal, platformFee, depositWithhold, subtotal,
           JSON.stringify(aiCheck), workOrderId).run();

      // 记录历史
      const historyId = generateId();
      await env.DB.prepare(
        'INSERT INTO work_order_pricing_history (id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, total_amount, platform_fee, deposit_withhold, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(historyId, existing.id, labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0, JSON.stringify(parts_detail || []), subtotal, subtotal, platformFee, depositWithhold, (await env.DB.prepare('SELECT MAX(version) as v FROM work_order_pricing_history WHERE pricing_id = ?').bind(existing.id).first())?.v + 1 || 1).run();
    } else {
      // 新建报价
      const id = generateId();
      await env.DB.prepare(`
        INSERT INTO work_order_pricing (id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail, subtotal, platform_fee, deposit_withhold, total_amount, ai_price_check, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', datetime('now'))
      `).bind(id, workOrderId, targetEngineerId, labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0, JSON.stringify(parts_detail || []), subtotal, platformFee, depositWithhold, subtotal, JSON.stringify(aiCheck)).run();
    }

    // 更新工单状态为 pricing
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'pricing', quote_review_status = 'pending_review' WHERE id = ?"
    ).bind(workOrderId).run();

    // 发送内部系统消息：工程师报价建议需要 SAGEMRO 官方审核后才对客户可见。
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'system', '', '系统', '工程师已提交报价建议，等待 SAGEMRO 官方审核后发送给客户。', 'pricing_update', 1, 0)"
    ).bind(msgId, workOrderId).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'pricing_submitted_for_review',
      afterState: { quote_review_status: 'pending_review', subtotal },
    });

    return jsonResponse({
      success: true,
      ai_check: aiCheck,
      subtotal,
      commission_rate: commissionRate,
      engineer_level: engineerLevel,
      platform_fee: platformFee,
      deposit_withhold: depositWithhold,
      engineer_payout: engineerPayout,
      total_amount: subtotal,  // 客户应付 = subtotal
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户确认报价
async function handleConfirmWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    // 认证：仅客户可确认报价；customer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse('仅客户可确认报价', 403);
    }
    const customer_id = auth.userId;

    // 校验工单归属
    const wo = await env.DB.prepare(
      'SELECT customer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse('您无权确认该工单报价', 403);
    }

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing) return errorResponse('报价不存在', 404);
    if (pricing.status !== 'submitted') return errorResponse('报价状态不正确，无法确认');

    await env.DB.prepare(
      "UPDATE work_order_pricing SET status = 'confirmed', confirmed_at = datetime('now') WHERE work_order_id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(
      "UPDATE work_orders SET status = 'pending_payment' WHERE id = ?"
    ).bind(workOrderId).run();

    // 系统消息
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', '系统', '客户已确认报价，等待客户付款。付款完成后工程师即可开始上门服务。', 'system')"
    ).bind(msgId, workOrderId).run();

    // 通知工程师：报价已确认，等待付款
    const woConfirm = await env.DB.prepare('SELECT engineer_id, order_no FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (woConfirm?.engineer_id) {
      await createNotification(env, {
        user_id: woConfirm.engineer_id,
        user_type: 'engineer',
        type: 'pricing_confirmed',
        title: '报价已确认，等待客户付款',
        body: `工单 ${woConfirm.order_no} 的客户已确认报价，请等待客户完成付款。`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户模拟付款（mock payment）
async function handlePayWorkOrder(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    // 认证：仅客户可付款
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse('仅客户可付款', 403);
    }
    const customer_id = auth.userId;

    // 校验工单归属
    const wo = await env.DB.prepare(
      'SELECT id, customer_id, status, order_no, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse('您无权操作该工单', 403);
    }
    if (wo.status !== 'pending_payment') {
      return errorResponse('工单状态不正确，无法付款', 400);
    }

    // 获取定价信息
    const pricing = await env.DB.prepare(
      'SELECT subtotal, total_amount FROM work_order_pricing WHERE work_order_id = ? AND status = ?'
    ).bind(workOrderId, 'confirmed').first();
    if (!pricing) return errorResponse('报价不存在或未确认', 404);

    const amount = pricing.total_amount || pricing.subtotal || 0;
    if (amount <= 0) return errorResponse('报价金额无效', 400);

    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.payment_method || 'bank_transfer';

    // 模拟付款成功
    const paymentId = generateId();
    const transactionId = 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    await env.DB.prepare(`
      INSERT INTO work_order_payments (id, work_order_id, customer_id, amount, payment_method, transaction_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'completed')
    `).bind(paymentId, workOrderId, customer_id, amount, paymentMethod, transactionId).run();

    // 更新工单状态
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_service' WHERE id = ?"
    ).bind(workOrderId).run();

    // 系统消息
    const msgId = generateId();
    const methodLabels = { bank_transfer: '银行转账', alipay: '支付宝', wechat: '微信支付' };
    const methodLabel = methodLabels[paymentMethod] || paymentMethod;
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', '系统', ?, 'system')"
    ).bind(msgId, workOrderId, `客户已通过${methodLabel}完成付款，金额 ${amount} 元。工程师可以开始上门服务。交易流水号：${transactionId}`).run();

    // 通知工程师：客户已付款
    if (wo.engineer_id) {
      await createNotification(env, {
        user_id: wo.engineer_id,
        user_type: 'engineer',
        type: 'payment_received',
        title: '客户已付款',
        body: `工单 ${wo.order_no} 客户已付款 ${amount} 元，请安排上门服务。`,
        data: { work_order_id: workOrderId, amount, transaction_id: transactionId },
      });
    }

    return jsonResponse({
      success: true,
      payment: {
        id: paymentId,
        transaction_id: transactionId,
        amount,
        payment_method: paymentMethod,
        status: 'completed',
        paid_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单付款记录
async function handleGetWorkOrderPayment(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    const auth = request._auth;
    if (!auth) return errorResponse('未登录', 401);

    const payment = await env.DB.prepare(
      'SELECT * FROM work_order_payments WHERE work_order_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(workOrderId).first();

    return jsonResponse({ payment: payment || null });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户拒绝/议价
async function handleRejectWorkOrderPricing(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { reason, counter_offer } = await request.json();

    // 认证：仅客户可拒绝报价；customer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse('仅客户可拒绝报价', 403);
    }
    const customer_id = auth.userId;

    // 校验工单归属
    const wo = await env.DB.prepare(
      'SELECT customer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('工单不存在', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse('您无权操作该工单', 403);
    }

    await env.DB.prepare(
      "UPDATE work_order_pricing SET status = 'draft' WHERE work_order_id = ?"
    ).bind(workOrderId).run();

    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_progress' WHERE id = ?"
    ).bind(workOrderId).run();

    // 发送议价消息
    let messageContent = reason || '希望重新报价';
    if (counter_offer) {
      messageContent += `（期望价格：${counter_offer} 元）`;
    }
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'customer', ?, '客户', ?, 'text')"
    ).bind(msgId, workOrderId, customer_id, messageContent).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 通知相关 API ============

async function handleGetNotifications(request, env) {
  try {
    const auth = request._auth;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    const { results } = await env.DB.prepare(
      'SELECT * FROM notifications WHERE user_id = ? AND user_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(auth.userId, auth.userType, limit, offset).all();

    return jsonResponse({ notifications: results });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleGetUnreadNotificationCount(request, env) {
  try {
    const auth = request._auth;
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND user_type = ? AND is_read = 0'
    ).bind(auth.userId, auth.userType).first();

    return jsonResponse({ count: row?.count || 0 });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleMarkNotificationRead(request, env) {
  try {
    const auth = request._auth;
    const notificationId = new URL(request.url).pathname.split('/')[3];

    await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND user_type = ?'
    ).bind(notificationId, auth.userId, auth.userType).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleMarkAllNotificationsRead(request, env) {
  try {
    const auth = request._auth;

    await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND user_type = ? AND is_read = 0'
    ).bind(auth.userId, auth.userType).run();

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// ============ 主处理函数 ============
// 将路由分发抽成独立函数，由 fetch 包装以统一注入动态 CORS 头
async function routeRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    // 暂存 ctx 供需要 waitUntil 的处理函数使用（如 AI 摘要异步生成）
    request._ctx = ctx;

    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // 认证相关（无需 token）
    if (path === '/api/auth/send-code' && request.method === 'POST') {
      return handleSendCode(request, env);
    }
    if (path === '/api/auth/register/customer' && request.method === 'POST') {
      return handleRegisterCustomer(request, env);
    }
    if (path === '/api/auth/register/engineer' && request.method === 'POST') {
      return errorResponse('Public engineer registration is closed. SAGEMRO engineer accounts are created internally.', 410);
    }
    if (path === '/api/auth/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    if (path === '/api/auth/reset-password' && request.method === 'POST') {
      return handleResetPassword(request, env);
    }
    if (path === '/api/auth/send-reset-code' && request.method === 'POST') {
      return handleSendResetCode(request, env);
    }

    // 聊天相关（允许未登录用户使用 AI 对话）
    if (path === '/api/chat/upload-image' && request.method === 'POST') {
      return handleChatUploadImage(request, env);
    }
    if (path === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    // 商机线索提交（无需登录）
    if (path === '/api/leads' && request.method === 'POST') {
      return handleSubmitLead(request, env);
    }

    // 健康检查（无需 token）
    if (path === '/health') {
      return jsonResponse({ status: 'ok' });
    }

    // Sentry 端到端冒烟测试。匹配 path 就拦下——要么抛错触发 Sentry，要么返回诊断
    // 响应说明为什么没触发，避免 fall through 到后面的认证守卫让人以为路由没生效。
    if (path === '/api/__sentry-test') {
      const method = request.method;
      const header = request.headers.get('X-Sentry-Test');
      const hasDsn = Boolean(env?.SENTRY_DSN);
      if (method === 'POST' && header === 'fire' && hasDsn) {
        throw new Error('[sentry-smoke-test] intentional error triggered at ' + new Date().toISOString());
      }
      return jsonResponse({
        error: 'sentry smoke-test preconditions not met',
        method,
        headerPresent: header !== null,
        headerValue: header,
        sentryDsnConfigured: hasDsn,
      }, 400);
    }

    // ============ 测试/调试接口保护（默认拒绝）============
    // 任何 /api/test-*, /api/debug-*, /api/init-*, /api/clear-test-data
    // 只在 ENVIRONMENT === 'development' 且管理员认证通过时才开放，其他情况一律 404。
    // 默认拒绝策略：env 缺失或值非预期时（例如 staging、空字符串）也视作生产锁定，避免误暴露。
    const isTestRoute = (
      path.startsWith('/api/test-') ||
      path.startsWith('/api/debug-') ||
      path === '/api/init-test-data' ||
      path === '/api/init-db' ||
      path === '/api/clear-test-data'
    );
    if (isTestRoute) {
      if (env.ENVIRONMENT !== 'development') {
        return errorResponse('Not found', 404);
      }
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
    }

    if (path === '/api/init-test-data' && request.method === 'GET') {
      return handleInitTestData(env);
    }
    if (path === '/api/test-full-flow' && request.method === 'GET') {
      return handleTestFullPricingFlow(env);
    }
    if (path === '/api/debug-engineers' && request.method === 'GET') {
      // 调试：查看所有可用工程师的onesignal_player_id
      const engineers = await env.DB.prepare(
        'SELECT id, name, onesignal_player_id FROM engineers WHERE status = ?'
      ).bind('available').all();
      return jsonResponse({ count: engineers.results.length, engineers: engineers.results });
    }
    if (path === '/api/test-create-workorder' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const customerId = body.customer_id || 'mnyj09v0pa0kfz0lenf'; // 张伟
      const id = generateId();
      const order_no = 'WO-TEST-' + Date.now();
      const type = body.type || 'fault';
      const description = body.description || '激光切割机激光器不出光';
      const urgency = body.urgency || 'urgent';

      // 直接查数据库看onesignal_player_id
      const allEngineers = await env.DB.prepare('SELECT id, name, onesignal_player_id FROM engineers WHERE status = ?').bind('available').all();

      // 创建工单
      await env.DB.prepare(`
        INSERT INTO work_orders (id, order_no, customer_id, type, description, urgency, status, sla_deadline, category_l1, category_l2)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `).bind(id, order_no, customerId, type, description, urgency, computeSlaDeadline(urgency), 'other', 'other').run();

      // 生成AI摘要
      const aiSummary = await generateWorkOrderSummary(type, description, urgency, env);

      const workOrderData = { id, order_no, type, description, urgency, ai_summary: aiSummary };

      // 查找匹配的工程师
      const matchingEngineers = await findMatchingEngineers(workOrderData, env);

      // 发送推送
      const typeLabels = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试' };
      const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
      let sent = 0;
      for (const engineer of matchingEngineers) {
        if (engineer.onesignal_player_id) {
          await sendPushToEngineer(engineer.id, env, {
            title: '📋 New Service Assignment',
            titleZh: '📋 新服务任务待确认',
            message: `Service: ${order_no} | Type: ${typeLabels[type] || type} | Urgency: ${urgencyLabels[urgency] || urgency}`,
            messageZh: `服务编号：${order_no} | 类型：${typeLabels[type] || type} | 紧急程度：${urgencyLabels[urgency] || urgency}`,
            data: { work_order_id: id, type: 'new_ticket' }
          });
          sent++;
        }
      }

      return jsonResponse({
        workOrder: { id, order_no },
        allEngineers: allEngineers.results.length,
        allEngineersSample: allEngineers.results.slice(0,2).map(e => ({ id: e.id, name: e.name, playerId: e.onesignal_player_id })),
        matched: matchingEngineers.length,
        sent,
        firstEngineer: matchingEngineers[0] ? JSON.stringify(matchingEngineers[0]) : null
      });
    }
    if (path === '/api/test-push' && request.method === 'POST') {
      // 测试推送，直接发给李师傅
      const engineerId = 'mnyj0ab5bzrrfkvrppo';
      const result = await sendPushToEngineer(engineerId, env, {
        title: '📋 Test Push',
        titleZh: '📋 测试推送',
        message: 'Test message from worker',
        messageZh: '这是来自 Worker 的测试消息',
        data: { type: 'test' }
      });
      return jsonResponse({ success: result, engineerId });
    }
    if (path === '/api/test-workorder-push' && request.method === 'POST') {
      // 模拟工单创建流程，测试推送
      const body = await request.json().catch(() => ({}));
      const workOrderData = {
        id: 'test-wo-' + Date.now(),
        order_no: 'WO-TEST-' + Date.now(),
        type: body.type || 'fault',
        description: body.description || '激光切割机激光器不出光',
        urgency: body.urgency || 'urgent',
        ai_summary: JSON.stringify({
          summary: '激光切割机激光器不出光',
          required_specialties: ['激光切割机'],
          suggested_skills: ['激光器维修'],
        })
      };
      const matchingEngineers = await findMatchingEngineers(workOrderData, env);
      const typeLabels = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', urgent: '紧急' };
      const urgencyLabels = { normal: '普通', urgent: '紧急', critical: '非常紧急' };
      let sent = 0;
      for (const engineer of matchingEngineers) {
        if (engineer.onesignal_player_id) {
          await sendPushToEngineer(engineer.id, env, {
            title: '📋 New Service Assignment',
            titleZh: '📋 新服务任务待确认',
            message: `Service: ${workOrderData.order_no} | Type: ${typeLabels[workOrderData.type] || workOrderData.type} | Urgency: ${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
            messageZh: `服务编号：${workOrderData.order_no} | 类型：${typeLabels[workOrderData.type] || workOrderData.type} | 紧急程度：${urgencyLabels[workOrderData.urgency] || workOrderData.urgency}`,
            data: { work_order_id: workOrderData.id, type: 'new_ticket' }
          });
          sent++;
        }
      }
      return jsonResponse({ matched: matchingEngineers.length, sent, engineers: matchingEngineers.map(e => ({ id: e.id, name: e.name, playerId: e.onesignal_player_id })) });
    }
    if (path === '/api/test-results' && request.method === 'GET') {
      try {
        const results = await env.DB.prepare('SELECT * FROM test_flow_results ORDER BY id ASC').all();
        return jsonResponse({ results: results.results });
      } catch (e) {
        return errorResponse('读取失败: ' + e.message, 500);
      }
    }
    if (path === '/api/clear-test-data' && request.method === 'GET') {
      try {
        await env.DB.prepare('DELETE FROM test_flow_results').run();
        await env.DB.prepare('DELETE FROM work_orders WHERE order_no LIKE ?').bind('WO-TEST-%').run();
        return jsonResponse({ success: true, message: '测试数据已清理' });
      } catch (e) {
        return errorResponse('清理失败: ' + e.message, 500);
      }
    }

    // 临时建表接口（生产 404；非生产需管理员）
    if (path === '/api/init-db' && request.method === 'GET') {
      return handleInitDb(env);
    }

    // 管理员登录（无需 token）
    if (path === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }

    // ====== 以下接口需要 JWT 认证 ======
    // 先判断 path 是否匹配任一已知受保护路由。不匹配则直接 404，
    // 避免未登录用户 GET /api/random-typo 拿到 401 泄露"此路径需要 token"。
    // 白名单必须与下方已登录路由列表保持同步。
    const isKnownProtectedRoute = (
      path.startsWith('/api/admin/') ||
      path === '/api/conversations' ||
      path.startsWith('/api/conversations/') ||
      path === '/api/workorders' ||
      path.startsWith('/api/workorders/') ||
      path === '/api/devices' ||
      path.startsWith('/api/devices/') ||
      path === '/api/notifications' ||
      path.startsWith('/api/notifications/') ||
      path.startsWith('/api/engineers/') ||
      path === '/api/push-subscription' ||
      path === '/api/platform-ratings' ||
      path === '/api/customer-ratings' ||
      path === '/api/customers/profile' ||
      path === '/api/customers/push-subscription' ||
      /^\/api\/customers\/[^/]+\/reviews$/.test(path) ||
      path === '/api/auth/change-password'
    );
    if (!isKnownProtectedRoute) {
      return errorResponse('Not found', 404);
    }

    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return errorResponse('请先登录', 401);
    }

    // 将认证信息挂到 request 上，供 handler 使用。Admin handler 也需要它写审计日志。
    request._auth = auth;

    // 管理后台 API（需要管理员权限）
    if (path.startsWith('/api/admin/')) {
      if (auth.userType !== 'admin') {
        return errorResponse('需要管理员权限', 403);
      }
      if (path === '/api/admin/stats' && request.method === 'GET') {
        return handleAdminStats(request, env);
      }
      if (path === '/api/admin/users' && request.method === 'GET') {
        return handleAdminUsers(request, env);
      }
      if (path === '/api/admin/users' && request.method === 'POST') {
        return handleAdminCreateUser(request, env);
      }
      if (path.startsWith('/api/admin/users/') && request.method === 'DELETE') {
        return handleAdminDeleteUser(request, env);
      }
      if (path === '/api/admin/workorders' && request.method === 'GET') {
        return handleAdminWorkOrders(request, env);
      }
      if (path.startsWith('/api/admin/workorders/') && path.endsWith('/assign-regional-lead') && request.method === 'PATCH') {
        return handleAdminAssignRegionalLead(request, env);
      }
      if (path.startsWith('/api/admin/workorders/') && path.endsWith('/assign') && request.method === 'PATCH') {
        return handleAdminAssignWorkOrder(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/pricing\/(approve|reject)$/) && request.method === 'PATCH') {
        return handleAdminReviewWorkOrderPricing(request, env);
      }
      if (path.startsWith('/api/admin/workorders/') && path.endsWith('/archive') && request.method === 'PATCH') {
        return handleAdminArchiveWorkOrder(request, env);
      }
      if (path === '/api/admin/ratings' && request.method === 'GET') {
        return handleAdminRatings(request, env);
      }
      if (path === '/api/admin/leads' && request.method === 'GET') {
        return handleAdminLeads(request, env);
      }
      if (path.startsWith('/api/admin/leads/') && path.endsWith('/convert-workorder') && request.method === 'POST') {
        return handleAdminConvertLeadToWorkOrder(request, env);
      }
      if (path.startsWith('/api/admin/leads/') && request.method === 'PATCH') {
        return handleAdminUpdateLead(request, env);
      }
      if (path.startsWith('/api/admin/ratings/') && path.endsWith('/reply') && request.method === 'POST') {
        return handleAdminReplyRating(request, env);
      }
      if (path === '/api/admin/platform-ratings' && request.method === 'GET') {
        return handleAdminPlatformRatings(request, env);
      }
      if (path === '/api/admin/customer-ratings' && request.method === 'GET') {
        return handleAdminCustomerRatings(request, env);
      }
    }

    // 对话管理
    if (path === '/api/conversations' && request.method === 'GET') {
      return handleGetConversations(request, env);
    }
    if (path.startsWith('/api/conversations/') && request.method === 'GET') {
      return handleGetConversation(request, env);
    }
    if (path.startsWith('/api/conversations/') && request.method === 'DELETE') {
      return handleDeleteConversation(request, env);
    }
    if (path.match(/^\/api\/conversations\/[^/]+$/) && request.method === 'PATCH') {
      return handleRenameConversation(request, env);
    }

    // 工单相关
    if (path === '/api/workorders' && request.method === 'POST') {
      return handleCreateWorkOrder(request, env);
    }
    if (path === '/api/workorders' && request.method === 'GET') {
      return handleGetWorkOrders(request, env);
    }
    // 工程师评价客户（必须在 catch-all GET 之前）
    if (path.match(/^\/api\/workorders\/[^/]+\/engineer-review$/) && request.method === 'POST') {
      return handleSubmitEngineerReview(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/engineer-review$/) && request.method === 'GET') {
      return handleGetEngineerReview(request, env);
    }
    // 维修记录（必须在 catch-all GET 之前）
    if (path.match(/^\/api\/workorders\/[^/]+\/repair-record$/) && request.method === 'GET') {
      return handleGetRepairRecord(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/repair-record$/) && request.method === 'POST') {
      return handleSaveRepairRecord(request, env);
    }
    if (path === '/api/workorders/rating' && request.method === 'POST') {
      return handleSubmitRating(request, env);
    }
    // 工单附件（必须在 catch-all GET 之前）
    if (path.match(/^\/api\/workorders\/[^/]+\/attachments\/[^/]+$/) && request.method === 'DELETE') {
      return handleDeleteAttachment(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/attachments$/) && request.method === 'POST') {
      return handleUploadAttachment(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/attachments$/) && request.method === 'GET') {
      return handleGetAttachments(request, env);
    }
    // 工单详情 catch-all（必须在所有子路由之后）
    if (path.match(/^\/api\/workorders\/[^/]+$/) && request.method === 'GET') {
      return handleGetWorkOrder(request, env);
    }
    if (path.match(/^\/api\/customers\/[^/]+\/reviews$/) && request.method === 'GET') {
      return handleGetCustomerReviews(request, env);
    }
    // 工单消息
    if (path.match(/^\/api\/workorders\/[^/]+\/messages$/) && request.method === 'GET') {
      return handleGetWorkOrderMessages(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/messages$/) && request.method === 'POST') {
      return handlePostWorkOrderMessage(request, env);
    }
    // 工单核价
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing\/confirm$/) && request.method === 'POST') {
      return handleConfirmWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing\/reject$/) && request.method === 'POST') {
      return handleRejectWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing$/) && request.method === 'GET') {
      return handleGetWorkOrderPricing(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/pricing$/) && request.method === 'POST') {
      return handleSubmitWorkOrderPricing(request, env);
    }
    // 工程师标记服务完成
    if (path.match(/^\/api\/workorders\/[^/]+\/resolve$/) && request.method === 'POST') {
      return handleResolveWorkOrder(request, env);
    }
    // 客户取消工单
    if (path.match(/^\/api\/workorders\/[^/]+\/cancel$/) && request.method === 'POST') {
      return handleCancelWorkOrder(request, env);
    }
    if (path === '/api/platform-ratings' && request.method === 'POST') {
      return handleSubmitPlatformRating(request, env);
    }
    if (path === '/api/customer-ratings' && request.method === 'POST') {
      return handleSubmitCustomerRating(request, env);
    }

    // 设备管理
    if (path === '/api/devices' && request.method === 'GET') {
      return handleGetDevices(request, env);
    }
    if (path === '/api/devices' && request.method === 'POST') {
      return handleCreateDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'GET') {
      return handleGetDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'PATCH') {
      return handleUpdateDevice(request, env);
    }
    if (path.startsWith('/api/devices/') && request.method === 'DELETE') {
      return handleDeleteDevice(request, env);
    }

    // 通知相关
    if (path === '/api/notifications' && request.method === 'GET') {
      return handleGetNotifications(request, env);
    }
    if (path === '/api/notifications/unread-count' && request.method === 'GET') {
      return handleGetUnreadNotificationCount(request, env);
    }
    if (path.match(/^\/api\/notifications\/[^/]+\/read$/) && request.method === 'PATCH') {
      return handleMarkNotificationRead(request, env);
    }
    if (path === '/api/notifications/read-all' && request.method === 'POST') {
      return handleMarkAllNotificationsRead(request, env);
    }

    // 工程师相关
    if (path === '/api/engineers/tickets' && request.method === 'GET') {
      return handleGetEngineerTickets(request, env);
    }
    if (path === '/api/engineers/team' && request.method === 'GET') {
      return handleGetEngineerTeam(request, env);
    }
    if (path === '/api/engineers/assign-engineer' && request.method === 'POST') {
      return handleRegionalLeadAssignEngineer(request, env);
    }
    if (path === '/api/engineers/tickets/accept' && request.method === 'POST') {
      return handleAcceptTicket(request, env);
    }
    if (path === '/api/engineers/tickets/reject' && request.method === 'POST') {
      return handleRejectTicket(request, env);
    }
    if (path === '/api/engineers/status' && request.method === 'PATCH') {
      return handleUpdateEngineerStatus(request, env);
    }
    if (path === '/api/engineers/recommend' && request.method === 'GET') {
      return handleRecommendEngineers(request, env);
    }
    if (path === '/api/engineers/profile' && request.method === 'GET') {
      return handleGetEngineerProfile(request, env);
    }
    if (path === '/api/engineers/profile' && request.method === 'PATCH') {
      return handleUpdateEngineerProfile(request, env);
    }
    if (path === '/api/customers/profile' && request.method === 'PATCH') {
      return handleUpdateCustomerProfile(request, env);
    }
    if (path === '/api/auth/change-password' && request.method === 'POST') {
      return handleChangePassword(request, env);
    }
    // 工程师钱包信息（免费模式已停用）
    if (path === '/api/engineers/wallet' && request.method === 'GET') {
      return errorResponse('平台已转为免费模式，支付功能已停用', 410);
    }
    // 工程师提现申请（免费模式已停用）
    if (path === '/api/engineers/wallet/withdraw' && request.method === 'POST') {
      return errorResponse('平台已转为免费模式，支付功能已停用', 410);
    }
    // 客户付款（记录客户-工程师之间的交易）
    if (path.match(/^\/api\/workorders\/[^/]+\/pay$/) && request.method === 'POST') {
      return handlePayWorkOrder(request, env);
    }
    // 获取付款记录
    if (path.match(/^\/api\/workorders\/[^/]+\/payment$/) && request.method === 'GET') {
      return handleGetWorkOrderPayment(request, env);
    }
    // 推送订阅（OneSignal Player ID）- 客户和工程师共用同一处理器，按 auth.userType 分发
    if (
      (path === '/api/engineers/push-subscription' ||
       path === '/api/customers/push-subscription' ||
       path === '/api/push-subscription') &&
      request.method === 'POST'
    ) {
      return handleSavePushSubscription(request, env);
    }

    // 默认返回 404
    return new Response('Not found', { status: 404 });
}

// 将 routeRequest 的响应与动态 CORS 头合并
function withCorsHeaders(response, request, env) {
  const corsH = getCorsHeaders(request, env);
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsH)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export function shouldUseCnDatabase(request) {
  const url = new URL(request.url);
  if (url.hostname.endsWith('.cn')) return true;

  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      return new URL(origin).hostname.endsWith('.cn');
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).hostname.endsWith('.cn');
    } catch {
      return false;
    }
  }

  return false;
}

export default {
  async fetch(request, env, ctx) {
    // 按 API 域名或来源域名路由数据库：CN 站点走 CN 库，其他走 EN 库。
    if (env.DB_CN && shouldUseCnDatabase(request)) {
      env.DB = env.DB_CN;
    }
    try {
      const response = await routeRequest(request, env, ctx);
      return withCorsHeaders(response, request, env);
    } catch (error) {
      console.error('[fetch] unhandled error:', error);
      captureException(error, env, { request, ctx });
      const corsH = getCorsHeaders(request, env);
      return new Response(
        JSON.stringify({ error: error?.message || 'Internal Server Error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsH },
        }
      );
    }
  },
};
