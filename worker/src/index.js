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
  signJwt,
} from './lib/auth.js';
import {
  buildSessionCookie,
  clearSessionCookie,
  generateCsrfToken,
  sessionResponsePayload,
} from './lib/session.js';
import {
  authenticateRequest,
  hasValidCsrf,
  isProductionSession,
  requestPortalRole,
} from './lib/requestAuth.js';

// 通用小工具（generateId / truncateStr）
import { generateId, truncateStr } from './lib/util.js';
import {
  SUPPORTED_COORDINATE_SYSTEMS,
  evaluateArrivalCheck,
  isValidCoordinatePair,
  normalizeCoordinate,
} from './lib/location.js';
import { normalizeServiceMode, requiresArrivalVerification } from './lib/service-mode.js';
import {
  fieldDayBlocksFinalReport,
  fieldDayLocalDate,
  siteLocalDateTimeToUtc,
  validateDailyReport,
  validateFieldPlan,
} from './lib/field-work.js';
import { summarizeQuoteExecution, validateQuoteExecution } from './lib/quoteExecution.js';
import { normalizeLocationQuery, searchLocationProvider } from './lib/location-search.js';
import {
  identityDeleteStatement,
  identityInsertStatements,
  normalizeIdentityEmail,
  normalizeIdentityPhone,
} from './lib/accountIdentity.js';
import {
  activationExpiresAt,
  buildEngineerActivationEmail,
  buildEngineerActivationUrl,
  createEngineerActivationToken,
  hashEngineerActivationToken,
} from './lib/engineerActivation.js';

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
import { isKnownProtectedRoute, isTestRoute } from './lib/routes.js';
import { handlePublicRoute } from './lib/publicRoutes.js';
import {
  canCloseMaterialRequisition,
  canManageMaterialRequisition,
  deriveItemStatus,
  validateFulfillmentQuantities,
} from './lib/materialRequisitions.js';
import { getRequisitionOperationsMetrics } from './lib/requisitionMetrics.js';

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
const MIN_PASSWORD_LENGTH = 10;
const FUNNEL_EVENTS = new Set([
  'traffic_source_captured',
  'ai_conversation_started',
  'ai_response_received',
  'signup_started',
  'verification_succeeded',
  'signup_completed',
  'device_saved',
  'service_request_created',
]);
const FUNNEL_PROPERTY_ALLOWLIST = new Set([
  'entry',
  'market',
  'locale',
  'user_type',
  'authenticated',
  'conversation_id',
  'has_images',
  'response_status',
  'device_type',
  'service_type',
  'urgency',
  'tool_id',
]);

const CONTACT_EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const CONTACT_PLUS_PHONE_PATTERN = /\+\d[\d\s().-]{6,}\d/g;
const CONTACT_CN_PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g;

function passwordTooShortResponse(request) {
  const market = request ? getRequestMarket(request) : 'com';
  return errorResponse(
    market === 'cn'
      ? `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`
      : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    400,
  );
}

function isPasswordTooShort(password) {
  return typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH;
}

function redactContactInfoForWorkOrder(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(CONTACT_EMAIL_PATTERN, 'XXX')
    .replace(CONTACT_PLUS_PHONE_PATTERN, (match) => (
      String(match).replace(/\D/g, '').length >= 8 ? 'XXX' : match
    ))
    .replace(CONTACT_CN_PHONE_PATTERN, 'XXX');
}

function canEngineerViewCustomerContact(status) {
  return ['in_service', 'resolved', 'pending_review', 'completed'].includes(status);
}

function parseServiceLocation(input = {}) {
  const address = typeof input.service_address === 'string' ? input.service_address.trim() : '';
  const latitude = normalizeCoordinate(input.service_latitude);
  const longitude = normalizeCoordinate(input.service_longitude);
  const accuracyMeters = normalizeCoordinate(input.service_accuracy_m);
  const coordinateSystem = String(input.service_coordinate_system || 'wgs84').trim().toLowerCase();
  const source = String(input.service_location_source || 'customer').trim().slice(0, 40) || 'customer';
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;

  if (hasLatitude !== hasLongitude) {
    return { error: 'service_location_incomplete' };
  }
  if (hasLatitude && !isValidCoordinatePair(latitude, longitude)) {
    return { error: 'service_location_invalid' };
  }
  if (hasLatitude && !SUPPORTED_COORDINATE_SYSTEMS.has(coordinateSystem)) {
    return { error: 'service_coordinate_system_invalid' };
  }
  if (accuracyMeters !== null && (accuracyMeters < 0 || accuracyMeters > 500)) {
    return { error: 'service_accuracy_invalid' };
  }

  return {
    address: address.slice(0, 500),
    latitude,
    longitude,
    accuracyMeters,
    coordinateSystem: hasLatitude ? coordinateSystem : null,
    source: hasLatitude ? source : null,
    hasCoordinates: hasLatitude,
  };
}

function serviceLocationErrorMessage(errorCode, market) {
  const messages = {
    service_location_incomplete: market === 'cn' ? '现场定位需要同时提供纬度和经度' : 'Service location requires both latitude and longitude',
    service_location_invalid: market === 'cn' ? '现场定位坐标无效' : 'Service location coordinates are invalid',
    service_coordinate_system_invalid: market === 'cn' ? '现场定位坐标系不受支持' : 'Service location coordinate system is not supported',
    service_accuracy_invalid: market === 'cn' ? '现场定位精度无效' : 'Service location accuracy is invalid',
    service_location_required: market === 'cn' ? '现场服务工单必须提供客户现场地址和定位' : 'On-site service orders require a customer site address and location',
  };
  return messages[errorCode] || (market === 'cn' ? '现场定位信息无效' : 'Invalid service location');
}

function getChatModel(env) {
  return env.OPENAI_CHAT_MODEL || env.OPENAI_MODEL || 'deepseek-chat';
}

function getJsonModel(env) {
  return env.OPENAI_JSON_MODEL || env.OPENAI_MODEL || env.OPENAI_CHAT_MODEL || 'deepseek-chat';
}

function getAiFallbackMessage(env, error) {
  if (!env?.OPENAI_API_ENDPOINT || !env?.OPENAI_API_KEY) {
    return 'SAGEMRO AI is not fully configured yet. Please leave your equipment issue, alarm code, machine model, photos, and contact details; SAGEMRO can still review the case and follow up.';
  }
  if (error instanceof BudgetError) return error.message;
  return 'SAGEMRO AI is temporarily unavailable. Please try again shortly, or leave the equipment details and SAGEMRO will follow up through the service process.';
}

class TransientD1Error extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'TransientD1Error';
    this.cause = cause;
  }
}

const CHAT_CONVERSATION_CREATE_RETRY_DELAY_MS = 80;

function isTransientD1Error(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('d1_error') && (
    message.includes('timeout') ||
    message.includes('storage operation exceeded') ||
    message.includes('object to be reset') ||
    message.includes('database is locked')
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runD1WithTransientRetry(operation, { label, attempts = 2, delayMs = 80 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientD1Error(error)) throw error;
      lastError = error;
      console.warn(`[d1] transient error during ${label || 'operation'} attempt ${attempt}/${attempts}:`, error?.message || error);
      if (attempt < attempts) await delay(delayMs);
    }
  }
  throw new TransientD1Error(
    'SAGEMRO chat service is temporarily busy. Please try again shortly.',
    lastError,
  );
}

function isConversationIdConflict(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('d1_error') &&
    message.includes('conversations.id') &&
    (message.includes('unique constraint') || message.includes('sqlite_constraint'));
}

async function loadChatConversation(env, conversationId, label = 'chat:load_conversation') {
  return runD1WithTransientRetry(
    () => env.DB.prepare(
      'SELECT customer_id, engineer_id FROM conversations WHERE id = ?'
    ).bind(conversationId).first(),
    { label },
  );
}

function assertChatConversationAccess(chatAuth, trustedRole, conversation) {
  if (!conversation) return;
  if (trustedRole === 'guest') {
    if (conversation.customer_id || conversation.engineer_id) {
      throw new GuardError('您无权访问该对话', 403);
    }
    return;
  }
  assertConversationAccess(chatAuth, conversation);
}

async function loadCommittedConversationAfterCreateFailure(env, convId, chatAuth, trustedRole, originalError) {
  const committedConversation = await loadChatConversation(
    env,
    convId,
    'chat:load_conversation_after_create_failure',
  );
  if (!committedConversation) throw originalError;
  assertChatConversationAccess(chatAuth, trustedRole, committedConversation);
  return committedConversation;
}

async function createChatConversation(env, {
  convId,
  message,
  chatAuth,
  trustedRole,
  trustedCustomerId,
  trustedEngineerId,
}) {
  const insertConversation = () => env.DB.prepare(
    'INSERT INTO conversations (id, title, last_message, customer_id, engineer_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(convId, truncateStr(message, 20), truncateStr(message, 50), trustedCustomerId, trustedEngineerId).run();

  try {
    await insertConversation();
    return null;
  } catch (error) {
    if (isConversationIdConflict(error)) {
      return loadCommittedConversationAfterCreateFailure(env, convId, chatAuth, trustedRole, error);
    }
    if (!isTransientD1Error(error)) throw error;

    console.warn('[d1] transient error during chat:create_conversation attempt 1/2:', error?.message || error);
    const committedConversation = await loadChatConversation(
      env,
      convId,
      'chat:load_conversation_after_create_timeout',
    );
    if (committedConversation) {
      assertChatConversationAccess(chatAuth, trustedRole, committedConversation);
      return committedConversation;
    }

    await delay(CHAT_CONVERSATION_CREATE_RETRY_DELAY_MS);
    try {
      await insertConversation();
      return null;
    } catch (retryError) {
      if (isConversationIdConflict(retryError)) {
        return loadCommittedConversationAfterCreateFailure(env, convId, chatAuth, trustedRole, retryError);
      }
      if (isTransientD1Error(retryError)) {
        console.warn('[d1] transient error during chat:create_conversation attempt 2/2:', retryError?.message || retryError);
        throw new TransientD1Error(
          'SAGEMRO chat service is temporarily busy. Please try again shortly.',
          retryError,
        );
      }
      throw retryError;
    }
  }
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

function getRequestMarket(request) {
  return shouldUseCnDatabase(request) ? 'cn' : 'com';
}

function getRequestIp(request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || '';
}

function buildAuditLogStatement(env, request, {
  actorType,
  actorId,
  targetType,
  targetId,
  action,
  beforeState,
  afterState,
}) {
  return env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_type, actor_id, target_type, target_id, action, before_state, after_state, ip, device_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(),
    actorType || (request?._auth?.userType === 'admin'
      ? request._auth.staffRole || 'admin'
      : request?._auth?.userType) || 'system',
    actorId || request?._auth?.userId || '',
    targetType,
    targetId,
    action,
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    request ? getRequestIp(request) : '',
    request?.headers?.get('user-agent') || ''
  );
}

async function writeAuditLog(env, request, data) {
  try {
    await buildAuditLogStatement(env, request, data).run();
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

SAGEMRO AI helps laser and metal forming equipment users turn messy equipment problems into service-ready clarity.

你不是通用聊天机器人，不是论坛网友，也不是松散撮合平台。你代表 SAGEMRO 的第三方数字化服务入口，结合设备技术判断、安全优先的初步分诊、结构化服务信息采集，以及 SAGEMRO 后续服务协调。

你同时具备三重能力：

第一，你是激光和成型设备领域的资深技术顾问。你熟悉从下料到成品的全工艺链设备，包括工作原理、维护保养、常见故障、参数调试和应急处理。用户描述问题时，你能快速判断最可能的方向，给出实用、可执行、不过度承诺的初步建议。

第二，你是 SAGEMRO 的服务 intake 负责人。用户只需要自然描述现场情况，你负责识别服务场景、追问关键缺失信息、整理服务摘要，并在用户确认后推进到 SAGEMRO 服务跟进、备件确认、维修估算、远程诊断、上门服务或新机选型。

第三，你是 SAGEMRO 内部服务调度助手。当需要安排服务时，你只生成结构化诊断摘要、风险等级、所需技能标签和派工建议，最终诊断、报价和现场安全要求由 SAGEMRO 服务流程确认。不要向客户表达“自由匹配服务商”“工程师抢单”或任何松散平台模式。

你的名称是 SAGEMRO AI。对外只使用 SAGEMRO、SAGEMRO AI 或 SAGEMRO service，不要使用“小智”，也不要把 SAGEMRO 说成设备厂商的官方售后。

## 你的专业知识领域

你是激光和成型设备领域的技术专家，深度覆盖以下领域：

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

- 对 sagemro.com 国际版：客户可见的普通聊天回复跟随客户最新消息的自然语言；俄语用俄语回复，法语用法语回复，德语用德语回复，意大利语用意大利语回复，西班牙语用西班牙语回复，英语用英语回复。如果最新消息主要是报警代码、品牌、型号或短技术片段导致语言不明确，默认英文。SAGEMRO 系统 UI 标签、按钮名、路由、账号身份和入口名称保持英文；内部服务摘要、工单摘要、进度文本和 AI 分析保持英文。
- 对 sagemro.cn 中国版：默认简体中文回复。英文报警代码、品牌名、CNC 术语、型号或短英文短语不代表用户要求英文回复；只有用户明确要求英文回复时，才切换英文。
- 多轮对话中优先匹配用户当前使用的语言。
- 专业术语可以保留英文缩写，例如 CNC、PLC、servo、nozzle、assist gas。
- 当前请求上下文里的本轮语言硬性规则优先级最高。

## 平台结构与操作说明

你要像熟悉 SAGEMRO 平台细节的服务管家，而不是只会泛泛回答的 AI。

- 中文客户入口：sagemro.cn。客户可以先用 AI 描述设备问题，也可以登录后整理正式服务申请、查看工单和设备信息。
- 中文工程师入口：engineer.sagemro.cn。工程师账号由 SAGEMRO 内部创建或审核，不开放普通客户自助注册为工程师。
- 中文后台入口：admin.sagemro.cn。后台只供 SAGEMRO 运营和管理团队使用，不向普通客户开放。
- 中文站桌面端登录/注册入口在左侧工具栏底部。移动端需要先点左上角菜单，再进入左侧工具栏里的登录/注册入口。
- 注册流程可以自然说明为：点击“登录 / 注册” → 选择注册 → 填写公司名称、姓名、密码、手机号和短信验证码 → 邮箱可选补充 → 勾选用户协议、隐私政策和 AI 服务说明 → 选择使用身份并完成。
- 已登录客户可以要求你把对话整理为 SAGEMRO 服务跟进摘要；信息齐全并经客户确认后，才能创建正式服务申请。
- 游客不能直接创建正式服务申请，但你可以先给初步判断，并在需要后续跟进时引导其登录、注册或留下联系方式。

## 行为准则

### 回答技术问题时
- 用户问设备维护、保养、故障相关的知识性问题时，优先基于你的专业知识直接给出有用的回答。
- Do not push a work order or service request after a simple question is already answered clearly.
- Add a short SAGEMRO service follow-up offer only when manual confirmation, quotation, parts, service scheduling, safety handling, or reviewed parameter verification is clearly useful.
- If the user did not explicitly request a detailed plan, table, report, or full checklist, write exactly 5 compact lines.
- For routine maintenance frequency questions, answer in no more than 5 compact lines.
- Do not add a SAGEMRO service follow-up CTA for routine maintenance questions unless the user mentions abnormal wear, downtime, safety risk, quotation, parts purchase, or on-site support.
- Do not invent a possible abnormal follow-up scenario just to offer diagnosis or service.
- 回答要结合用户的实际设备情况。
- 涉及安全风险的操作，必须明确提醒用户注意安全或等待专业工程师处理。
- 故障判断只给方向性建议，表述用"可能是""建议检查"而不是"肯定是"。
- 涉及具体配件价格、维修报价时，不要编造正式数字。可以说明影响报价的因素，并建议整理为 SAGEMRO 服务跟进摘要，由 SAGEMRO 确认正式诊断和报价。
- 中文表达要像资深工业服务工程师：术语准确、句子顺畅、克制可信。避免错词或病句（如“捅括”），避免夸张绝对表达（如“直接报废”）；可说“避免用硬物刮擦喷嘴孔口内壁，否则会影响孔口同轴度和气流稳定性”。

### 判断是否需要推进服务
- Classify the user's current need internally as one of: answer_only, guided_check, service_recommended.
- answer_only: answer clearly and stop without a work order CTA.
- guided_check: give 2-4 practical checks and ask for the result before recommending service.
- service_recommended: use only when there is downtime, safety risk, formal quote, parts confirmation, on-site or remote service need, new machine selection, or an explicit service request.
- Simple knowledge or routine maintenance questions: answer the question first, then stop unless the user signals service intent.
- Do not turn every useful answer into a ticket path.
- Service conversion triggers: production-stopping faults, safety risks, formal quotation, parts confirmation, on-site service, remote diagnosis, new machine selection, or explicit service request.
- For urgent or unsafe equipment issues, prioritize stop-work safety guidance, risk level, missing facts, and a SAGEMRO service follow-up summary.
- For price, parts, or on-site requests, do not invent final prices, availability, service dates, or engineer assignments.
- When conversion is appropriate, present a concise service-ready case summary and ask the user to confirm the next step; do not claim a work order exists until it is actually created.
- Before creating a service request, show a concise service-ready summary and ask the customer to confirm.
- Never create, claim, or imply a work order exists until the customer has confirmed and the create_work_order tool returns success.
- If key facts are missing, ask only the missing facts needed for triage: equipment, symptom, urgency, location/contact, and safety risk.

### 生成服务申请和派工建议时
- 当用户需要上门服务、远程诊断、备件确认或新机选型时，先把问题整理成结构化摘要。
- 对客户只表达“SAGEMRO 将审核并安排合适的内部工程师或认证服务代表”，不要承诺某个个人一定接单。
- 对于紧急故障（停产级别），优先标注风险等级、建议停机/安全措施和所需技能标签。

### 处理服务申请时
- 当用户表达维修、保养、调试、备件、远程诊断或新机选型意图时，按顺序引导采集：设备信息 → 故障/需求 → 紧急程度 → 地区/联系方式。
- 创建服务申请前，必须将信息汇总展示给用户确认。

### 安全与责任边界
- AI guidance is preliminary. Final diagnosis, quote, and on-site safety requirements are confirmed through the SAGEMRO service process.
- AI guidance is preliminary and for reference only. Present troubleshooting as a structured assessment, not as a guaranteed solution.
- Use "likely causes", "possible causes", "check first", and "should be confirmed" language. Avoid ranking any cause as "#1" or "the root cause" unless verified by measurements, inspection, or published SAGEMRO information.
- Exact numbers, dimensions, cutting parameters, pressure ranges, prices, compatibility, and repair decisions are reference ranges only; tell users they require machine-specific confirmation before use.
- For electrical, laser, high-pressure gas, hydraulic, pneumatic, lifting, hot-work, fire, exposed wiring, safety interlock, or energized cabinet scenarios, tell the user to stop operation and require qualified manual confirmation before further operation.

### Knowledge Priority & Conflict Policy
- This is an internal decision policy. Do not expose the words "policy", "conflict", "priority", or "knowledge base" to customers.
- Prefer published SAGEMRO knowledge over general model knowledge for SAGEMRO-specific facts, product details, service process, parts compatibility, parameters, warranty, quote, inventory, certification, delivery, and safety commitments.
- General model knowledge may fill only general background, language, and non-committal troubleshooting guidance.
- If no matching published SAGEMRO knowledge is available, answer general maintenance or education questions cautiously, but do not invent SAGEMRO-specific facts.
- If the user asks for quote, price, availability, lead time, exact parameter, parts compatibility, certification, warranty, final diagnosis, or safety approval and no published SAGEMRO knowledge supports it, ask for missing facts or route to SAGEMRO manual confirmation instead of giving a final answer.
- If published SAGEMRO knowledge and general model knowledge appear inconsistent, follow the published SAGEMRO knowledge and make the customer-facing answer calm and natural, using wording such as "based on the information currently available" or "this should be confirmed before quotation/use"; do not mention an internal conflict.
- 涉及激光、电气、高压气体、液压、吊装、高温、火灾风险、联锁失效、带电开柜或进入危险区域时，先提醒用户停止不安全操作，等待具备资质的人员处理。
- 不要指导用户绕过安全联锁、屏蔽保护装置、带电拆装高风险部件。

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
4. **SAGEMRO next step / SAGEMRO 下一步**：如果需要人工确认，说明可以整理为 SAGEMRO 服务跟进摘要

当用户要求深入分析、参数表、维修方案、现场检查单或健康报告时，再展开为：故障分析、排查步骤、参数参考、应急处理、预防建议。

### 各领域重点知识指引

回答以下领域问题时，确保覆盖对应的关键维度：

- **激光切割**：功率/气压/焦点/速度的关联参数、喷嘴选型、保护镜检查、光路校准
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

分析时结合你的激光和成型设备专业知识，给出有针对性的诊断，不要泛泛而谈。如果图片模糊或看不清，如实告知用户并请其补充更清晰的照片。

### 客户侧设备选型与品牌推荐
当用户表达以下情况时，才自然进入新机、换机或升级方案分析：
- 明确想买新设备、换设备、升级设备
- 设备太旧、频繁故障、维修成本高或停机损失明显
- 产能不够、精度/效率无法满足订单要求
- 询问品牌推荐、设备对比或投资回报

Customer-facing machine recommendations must stay neutral, evidence-based, and independent.

推荐原则：
- 绝不为了获取线索牺牲 AI 的公正性、真实性或客户信任。
- Do not mention affiliated machine suppliers, affiliated corporate operators, related sales websites, sales handoff, or internal lead routing in customer-facing machine recommendations.
- 不要暗示 SAGEMRO 或关联方是默认供应商，也不要把客户导向某个自有销售渠道。
- 可以在后台静默识别整机采购意图并生成内部 lead，但客户侧回答只做客观选型分析。
- 先做“维修 vs 升级”的经济性判断，不硬销
- 结合材料、厚度、幅面、功率、产能、精度、预算、地区售后、备件可得性、软件生态和现有设备状态给出方向。
- 对品牌和市场判断，优先说明依据：public market evidence（公开市场证据）、常见配置、当地服务网络、用户所在地区、使用工况和总拥有成本。
- 如果没有可靠来源或不确定，明确说“需要进一步核实”，不要编造市场份额、价格、交期、认证、库存或售后能力。
- 推荐多个可比选项，并说明各自适合什么场景、主要风险和需要向供应商确认的问题。
- 可以建议用户整理材料、厚度、产能、预算、厂房条件和售后要求，用于向多个供应商询价和对比。`;

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
- “I can turn this into a SAGEMRO service-ready case summary for reviewed follow-up.”
- “我可以把这些信息整理成一份 SAGEMRO 服务跟进摘要，方便后续诊断、报价或上门确认。”

如果需要后续联系，再引导用户登录、注册或留下联系方式。不要把“注册”作为主要卖点。
`,

  customer: `
【角色】你是 SAGEMRO 已登录客户的设备服务顾问。

当前用户已登录，是平台的客户。他的个人信息和设备档案在下方【上下文】中有详细记录。

## 你的核心职责
1. 当他咨询设备问题时，结合他的设备历史给出针对性建议，不是泛泛而谈
2. 当发现设备有反复出现的故障模式时，主动提醒预防性保养
3. 当他需要 SAGEMRO 服务时，收集信息、汇总确认后调用 create_work_order 创建 SAGEMRO 服务申请
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
- 当客户在对话中明确提供一台设备的类型，并同时提供品牌、型号、功率或设备名称中的至少一项 → 调用 suggest_device_profile。该工具只生成待确认候选，不代表设备已保存；必须提醒客户确认或修改后再保存。
- 提到"上次""之前""我的那个单子""那台设备的问题" 等对过去对话的指涉，或新会话开头想确认是否有未闭环事项 → 调用 get_conversation_history
  - 需要 SAGEMRO 服务/上门服务/远程诊断/设备故障需人工处理，且已完成信息收集和客户确认 → 调用 create_work_order

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
- [followup_due] — 上次推荐了服务方案但客户没回复。这一轮问"上次建议的服务方案是否还需要继续推进？我可以帮你整理成 SAGEMRO 服务申请。"
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
      name: 'search_knowledge_base',
      description: 'Search published SAGEMRO knowledge articles for equipment service, fault, maintenance, parts, cutting parameter, safety, machine selection, or health questions. Use this before answering professional equipment questions when relevant. Only published knowledge is returned. Prefer returned SAGEMRO knowledge over general model knowledge for SAGEMRO-specific facts. If no matching published SAGEMRO knowledge is found, do not invent quotes, parts compatibility, safety approvals, exact parameters, certification, warranty, inventory, delivery, or final diagnosis.',
      parameters: {
        type: 'object',
        properties: {
          market: {
            type: 'string',
            description: 'Market: cn for sagemro.cn, com for sagemro.com',
            enum: ['cn', 'com']
          },
          locale: {
            type: 'string',
            description: 'Preferred language locale, such as zh-CN or en'
          },
          category: {
            type: 'string',
            description: 'Knowledge category',
            enum: ['fault', 'cutting_parameters', 'parts', 'maintenance', 'machine_selection', 'health', 'safety', 'other']
          },
          query: {
            type: 'string',
            description: 'Short search query from the user question, alarm code, part model, equipment brand/model, or symptom'
          }
        },
        required: ['query']
      }
    }
  },
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
      name: 'suggest_device_profile',
      description: '把当前登录客户在对话中明确提供的设备信息整理为待确认候选。只在客户明确说出设备类型，并同时提供品牌、型号、功率或设备名称中的至少一项时调用。不得猜测缺失字段；该工具不会保存设备。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '客户用于区分设备的名称，例如 1 号车间激光机。未提供则留空。' },
          type: { type: 'string', description: '设备类型，例如激光切割机、折弯机。' },
          brand: { type: 'string', description: '设备品牌。未提供则留空。' },
          model: { type: 'string', description: '设备型号。未提供则留空。' },
          power: { type: 'string', description: '设备功率或主要规格。未提供则留空。' },
        },
        required: ['type']
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
      description: `为客户创建 SAGEMRO 服务申请。SERVICE_OS_LEGACY：底层实体仍叫 work_order。当客户已确认服务信息（设备、故障/需求、紧急程度），你必须立即调用此工具，不得用文字描述或模拟调用结果。如果客户已上传诊断图片，服务端会自动把本对话图片带入工单附件。如果缺少必填参数，先向客户追问。`,
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
          },
          service_mode: {
            type: 'string',
            enum: ['remote', 'onsite', 'hybrid'],
            description: '服务执行方式。remote 为远程指导，onsite 为必须上门，hybrid 为先远程诊断、必要时再上门。未明确时使用 remote。'
          },
          service_address: {
            type: 'string',
            description: '现场服务地址。现场维修、保养、参数调试、配件上门或改造服务必须收集。'
          },
          service_latitude: {
            type: 'number',
            description: '客户现场纬度。只有客户明确提供或确认定位后才能填写。'
          },
          service_longitude: {
            type: 'number',
            description: '客户现场经度。只有客户明确提供或确认定位后才能填写。'
          },
          service_accuracy_m: {
            type: 'number',
            description: '客户现场定位精度，单位米；如果没有可靠精度信息则留空。'
          },
          service_coordinate_system: {
            type: 'string',
            enum: ['wgs84', 'gcj02'],
            description: '客户现场坐标系。浏览器定位通常使用 wgs84；gcj02 仅用于兼容历史坐标。'
          },
          service_location_source: {
            type: 'string',
            description: '现场定位来源，例如 customer_browser 或 customer_confirmed。'
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
  guest: new Set([
    'search_knowledge_base',
  ]),
  customer: new Set([
    'search_knowledge_base',
    'get_customer_devices',
    'get_device_detail',
    'suggest_device_profile',
    'get_conversation_history',
    'create_work_order',
  ]),
  engineer: new Set([
    'search_knowledge_base',
    'get_engineer_profile',
    'get_pending_tickets_for_engineer',
    'get_conversation_history',
  ]),
  admin: new Set([
    'search_knowledge_base',
    'get_engineer_profile',
    'get_pending_tickets_for_engineer',
    'get_customer_devices',
    'get_device_detail',
    'get_conversation_history',
  ]),
  system: new Set([
    'search_knowledge_base',
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
async function toolSearchKnowledgeBase({ args = {}, env, market = 'com' }) {
  if (!env?.DB) {
    return { count: 0, articles: [] };
  }
  const search = cleanText(args.query, 160);
  if (!search) {
    return { count: 0, articles: [] };
  }
  const requestedMarket = cleanText(args.market, 20) || market || 'com';
  const requestedLocale = cleanText(args.locale, 20);
  const category = cleanText(args.category, 80);
  const limit = Math.min(8, Math.max(1, parseInt(args.limit || '5', 10) || 5));

  let where = "WHERE status = 'published' AND market = ?";
  const binds = [requestedMarket];
  if (requestedLocale) {
    where += ' AND locale = ?';
    binds.push(requestedLocale);
  }
  if (category && KNOWLEDGE_CATEGORIES.has(category)) {
    where += ' AND category = ?';
    binds.push(category);
  }
  where += ` AND (
    instr(lower(COALESCE(title, '')), lower(?)) > 0 OR
    instr(lower(COALESCE(content, '')), lower(?)) > 0 OR
    instr(lower(COALESCE(applicable_equipment, '')), lower(?)) > 0 OR
    instr(lower(COALESCE(applicable_brand, '')), lower(?)) > 0 OR
    instr(lower(COALESCE(applicable_model, '')), lower(?)) > 0
  )`;
  binds.push(search, search, search, search, search);

  const rows = await env.DB.prepare(`
    SELECT id, market, locale, category, title, content, source,
           applicable_equipment, applicable_brand, applicable_model,
           risk_level, version, status, reviewed_by, reviewed_at, updated_at
    FROM knowledge_articles
    ${where}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...binds, limit).all();

  const articles = (rows.results || []).map((row) => ({
    id: row.id,
    market: row.market,
    locale: row.locale,
    category: row.category,
    title: row.title,
    content: row.content,
    source: row.source,
    applicable_equipment: row.applicable_equipment,
    applicable_brand: row.applicable_brand,
    applicable_model: row.applicable_model,
    risk_level: row.risk_level,
    version: Number(row.version || 1),
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    updated_at: row.updated_at,
  }));

  return {
    count: articles.length,
    articles,
    note: articles.length > 0
      ? 'Only published SAGEMRO knowledge articles are returned. Prefer these articles over general model knowledge for SAGEMRO-specific facts. Use them as reference, not as final diagnosis, quote, safety approval, or parts compatibility commitment.'
      : 'No matching published SAGEMRO knowledge was found. General model knowledge may be used only for general background and cautious troubleshooting. Do not invent SAGEMRO-specific facts, quote, safety approval, exact parameters, inventory, delivery, warranty, certification, final diagnosis, or parts compatibility commitment.',
  };
}

function toolSuggestDeviceProfile(args = {}) {
  const suggestion = {
    name: cleanText(args.name, LIMITS.name),
    type: cleanText(args.type, LIMITS.type),
    brand: cleanText(args.brand, LIMITS.brand),
    model: cleanText(args.model, LIMITS.model),
    power: cleanText(args.power, LIMITS.power),
    source: 'chat',
  };

  if (!suggestion.type || !(suggestion.name || suggestion.brand || suggestion.model || suggestion.power)) {
    return {
      error: 'device_details_incomplete',
      fallback_instruction: 'Ask the customer for the device type and at least one identifying detail such as brand, model, power, or device name.',
    };
  }

  return { device_suggestion: suggestion };
}

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
    market = 'com',
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
    search_knowledge_base: () => toolSearchKnowledgeBase({ args, env, market }),
    get_engineer_profile: () => toolGetEngineerProfile(engineerId, env),
    get_pending_tickets_for_engineer: () => toolGetPendingTickets({ limit: args?.limit || 10, engineerId, env }),
    get_customer_devices: () => toolGetCustomerDevices(customerId, env),
    get_device_detail: () => toolGetDeviceDetail(customerId, args?.device_id, env),
    suggest_device_profile: () => toolSuggestDeviceProfile(args),
    create_work_order: () => toolCreateWorkOrder({ customerId, env, ctx, args, conversationId, market }),
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
        problem: redactContactInfoForWorkOrder(t.description),
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
        problem: redactContactInfoForWorkOrder(t.description),
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
  market = 'com',
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

  const existingRows = await env.DB.prepare(`
    SELECT r2_url
    FROM work_order_attachments
    WHERE work_order_id = ?
  `).bind(workOrderId).all();
  const existingUrls = new Set((existingRows.results || []).map((row) => row.r2_url).filter(Boolean));
  const statements = [];
  let attached = 0;
  for (const url of urls.slice(0, limit)) {
    if (existingUrls.has(url)) continue;

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

    statements.push(env.DB.prepare(`
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
    ));
    existingUrls.add(url);
    attached++;
  }

  if (attached > 0) {
    statements.push(env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'chat_images_attached', ?, ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      uploaderType,
      uploaderId || '',
      serviceCopy(market).attachmentLog(attached)
    ));
    await env.DB.batch(statements);
  }

  return attached;
}

// 工具：AI 创建工单（function calling）
// 与 POST /api/workorders 共享核心逻辑，但不走 HTTP 层
async function toolCreateWorkOrder({ customerId, env, ctx, args, conversationId, market = 'com' }) {
  const {
    type,
    description,
    urgency,
    device_id,
    category_l1,
    category_l2,
    service_mode,
    service_address,
    service_latitude,
    service_longitude,
    service_accuracy_m,
    service_coordinate_system,
    service_location_source,
  } = args;
  const copy = serviceCopy(market);

  if (!customerId) return { error: 'not_authenticated', reason: copy.notAuthenticatedReason };
  if (!type || !description || !urgency) {
    const missingFields = [!type && 'type', !description && 'description', !urgency && 'urgency'].filter(Boolean);
    return {
      error: 'missing_required_fields',
      reason: copy.missingFieldsReason(missingFields),
    };
  }

  const ALLOWED_CATEGORIES_L1 = [
    'laser_cutting', 'bending', 'punching', 'welding',
    'surface_treatment', 'auxiliary', 'cnc_automation', 'inspection', 'other',
  ];
  const catL1 = ALLOWED_CATEGORIES_L1.includes(category_l1) ? category_l1 : 'other';

  const serviceMode = normalizeServiceMode(service_mode);
  const serviceLocation = parseServiceLocation({
    service_address,
    service_latitude,
    service_longitude,
    service_accuracy_m,
    service_coordinate_system,
    service_location_source,
  });
  if (serviceLocation.error) {
    return { error: serviceLocation.error, reason: serviceLocationErrorMessage(serviceLocation.error, market) };
  }
  if (requiresArrivalVerification(serviceMode) && (!serviceLocation.address || !serviceLocation.hasCoordinates)) {
    return { error: 'service_location_required', reason: serviceLocationErrorMessage('service_location_required', market) };
  }

  // 输入长度检查
  if (description.length > 10000) return { error: 'description_too_long', reason: copy.descriptionTooLongReason };
  if (type.length > 100) return { error: 'invalid_type', reason: copy.invalidTypeReason };

  try {
    // PII 脱敏
    const safeDescription = redactPII(description);

    const id = generateId();
    const order_no = generateOrderNo();

    const slaDeadline2 = computeSlaDeadline(urgency || 'normal');

    await env.DB.prepare(`
      INSERT INTO work_orders (
        id, order_no, customer_id, type, description, urgency, device_id, status,
        sla_deadline, category_l1, category_l2, service_mode, arrival_verification_required,
        service_address, service_latitude, service_longitude, service_accuracy_m,
        service_coordinate_system, service_location_source, service_location_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      order_no,
      customerId,
      type,
      safeDescription,
      urgency || 'normal',
      device_id || null,
      slaDeadline2,
      catL1,
      category_l2 || 'other',
      serviceMode,
      requiresArrivalVerification(serviceMode) ? 1 : 0,
      serviceLocation.address || null,
      serviceLocation.latitude,
      serviceLocation.longitude,
      serviceLocation.accuracyMeters,
      serviceLocation.coordinateSystem,
      serviceLocation.source,
      serviceLocation.hasCoordinates ? new Date().toISOString() : null,
    ).run();

    // 记录日志
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), id, 'created', 'customer', customerId, copy.aiCreatedLog).run();

    const attachedImages = await attachConversationImagesToWorkOrder(env, {
      workOrderId: id,
      conversationId,
      uploaderType: 'customer',
      uploaderId: customerId,
      market,
    });

    // AI 摘要异步生成
    const aiSummaryPromise = generateWorkOrderSummary(type, safeDescription, urgency, env, { market })
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
    const notificationBody = serviceNotificationBody(order_no, type, urgency, market);

    for (const engineer of matchingEngineers) {
      if (engineer.onesignal_player_id) {
        await sendPushToEngineer(engineer.id, env, {
          title: copy.newPushTitle,
          message: notificationBody,
          data: { work_order_id: id, type: 'new_ticket' }
        });
      }
      await createNotification(env, {
        user_id: engineer.id,
        user_type: 'engineer',
        type: 'new_ticket',
        title: copy.newTaskTitle,
        body: notificationBody,
        data: { work_order_id: id, order_no },
      });
    }

    return {
      success: true,
      work_order: {
        id,
        order_no,
        status: 'pending',
        type: serviceTypeLabel(type, market),
        urgency: serviceUrgencyLabel(urgency, market),
      },
      matching_engineers_count: matchingEngineers.length,
      attached_images_count: attachedImages,
    };
  } catch (error) {
    console.error('[toolCreateWorkOrder] error:', error);
    return { error: 'tool_failed', reason: copy.toolFailedReason(error.message) };
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

function addSessionCookie(response, request, env, role, token) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', buildSessionCookie(role, token, {
    production: isProductionSession(request, env),
  }));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function clearPortalSession(response, request, env) {
  const role = requestPortalRole(request);
  if (!role) return response;
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', clearSessionCookie(role, {
    production: isProductionSession(request, env),
  }));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// 验证是否为管理员（用于保护测试接口）
async function authenticateAdmin(request, env) {
  try {
    const payload = await authenticateRequest(request, env);
    return payload?.userType === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

// CORS 白名单
const ALLOWED_ORIGINS_PRODUCTION = [
  'https://sagemro.com',
  'https://www.sagemro.com',
  'https://engineer.sagemro.com',
  'https://admin.sagemro.com',
  'https://sagemro.cn',
  'https://www.sagemro.cn',
  'https://engineer.sagemro.cn',
  'https://admin.sagemro.cn',
];
const ALLOWED_ORIGINS_DEV = [
  ...ALLOWED_ORIGINS_PRODUCTION,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://engineer.localhost:4173',
  'http://localhost:4174',
  'http://localhost:4273',
  'http://engineer.localhost:4273',
  'http://localhost:4274',
  'http://customer.127.0.0.1.nip.io:4273',
  'http://engineer.127.0.0.1.nip.io:4273',
  'http://admin.127.0.0.1.nip.io:4274',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

function getAllowedOrigin(origin, env) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, Idempotency-Key',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function getSecurityHeaders(request, env) {
  const headers = {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (env.ENVIRONMENT !== 'development' && new URL(request.url).protocol === 'https:') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

// 兼容旧代码：仅作兜底 Content-Type/Methods，动态 Origin 由 top-level 包装器覆盖。
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS_PRODUCTION[0],
  'Vary': 'Origin',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, Idempotency-Key',
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

const ERROR_MESSAGES = {
  phone_required: {
    com: 'Phone number is required.',
    cn: '手机号不能为空',
  },
  invalid_phone: {
    com: 'Please enter a valid phone number.',
    cn: '手机号格式不正确',
  },
  email_required: {
    com: 'Email address is required.',
    cn: '邮箱不能为空',
  },
  invalid_email: {
    com: 'Please enter a valid email address.',
    cn: '邮箱格式不正确',
  },
  name_phone_company_password_required: {
    com: 'Name, phone number, email, company name, and password are required.',
    cn: '姓名、手机号、公司名称、密码不能为空',
  },
  phone_password_required: {
    com: 'Phone number and password are required.',
    cn: '手机号、密码不能为空',
  },
  too_many_password_attempts: {
    com: 'Too many failed password attempts. Please try again in 15 minutes.',
    cn: '密码错误次数过多，请 15 分钟后再试',
  },
  account_not_found: {
    com: 'Account not found. Please register first.',
    cn: '账号不存在，请先注册',
  },
  wrong_password: {
    com: 'Incorrect password. Please try again.',
    cn: '密码错误，请重试',
  },
  sign_in_required: {
    com: 'Please sign in first.',
    cn: '请先登录',
  },
  public_engineer_registration_closed: {
    com: 'Public engineer registration is closed. SAGEMRO engineer accounts are created internally.',
    cn: '工程师账号暂不开放公开注册。',
  },
  admin_engineer_creation_retired: {
    com: 'Engineer accounts must be opened from an approved application.',
    cn: '请从审核通过的工程师申请中开通账号。',
  },
  missing_required_fields: {
    com: 'Missing required fields.',
    cn: '缺少必填字段',
  },
};

function localizedMessage(key, request) {
  const entry = ERROR_MESSAGES[key];
  if (!entry) return key;
  return entry[getRequestMarket(request)] || entry.com;
}

function localizedErrorResponse(key, request, status = 400) {
  return errorResponse(localizedMessage(key, request), status);
}

function accountIdentityConflictResponse(identityType, request) {
  const market = getRequestMarket(request);
  const messages = identityType === 'email'
    ? { com: 'This email address is already registered.', cn: '该邮箱已注册' }
    : { com: 'This phone number is already registered.', cn: '该手机号已注册' };
  return errorResponse(messages[market] || messages.com, 409);
}

async function findAccountIdentityConflict(env, normalizedEmail, normalizedPhone) {
  return env.DB.prepare(`
    SELECT identity_type, owner_type, owner_id
    FROM account_identities
    WHERE (identity_type = 'email' AND normalized_value = ?)
       OR (identity_type = 'phone' AND normalized_value = ?)
    LIMIT 1
  `).bind(normalizedEmail, normalizedPhone).first();
}

async function recoverAccountIdentityConflict(error, env, normalizedEmail, normalizedPhone, request) {
  const message = String(error?.message || error);
  if (message.includes('idx_customers_email_normalized_unique')
    || message.includes('idx_engineers_email_normalized')) {
    return accountIdentityConflictResponse('email', request);
  }
  if (/UNIQUE constraint failed:\s*(?:customers|engineers)\.phone/i.test(message)) {
    return accountIdentityConflictResponse('phone', request);
  }
  if (!message.includes('account_identities')) return null;
  const conflict = await findAccountIdentityConflict(env, normalizedEmail, normalizedPhone);
  return conflict ? accountIdentityConflictResponse(conflict.identity_type, request) : null;
}

const SERVICE_TYPE_LABELS = {
  com: {
    fault: 'Equipment repair',
    maintenance: 'Maintenance',
    parameter: 'Parameter tuning',
    consult: 'Technical consultation',
    parts: 'Spare parts / consumables',
    aftersales: 'Retrofit / peripheral equipment',
    other: 'Other request',
  },
  cn: {
    fault: '设备故障',
    maintenance: '维护保养',
    parameter: '参数调试',
    consult: '技术咨询',
    parts: '配件采购',
    aftersales: '售后服务',
    other: '其他',
  },
};

const SERVICE_URGENCY_LABELS = {
  com: { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' },
  cn: { normal: '普通', urgent: '紧急', critical: '非常紧急' },
};

function serviceTypeLabel(type, market = 'com') {
  const labels = SERVICE_TYPE_LABELS[market] || SERVICE_TYPE_LABELS.com;
  return labels[type] || type || labels.other;
}

function serviceUrgencyLabel(urgency, market = 'com') {
  const labels = SERVICE_URGENCY_LABELS[market] || SERVICE_URGENCY_LABELS.com;
  return labels[urgency] || urgency || labels.normal;
}

function serviceNotificationBody(orderNo, type, urgency, market = 'com') {
  if (market === 'cn') {
    return `服务编号：${orderNo} | 类型：${serviceTypeLabel(type, market)} | 紧急程度：${serviceUrgencyLabel(urgency, market)}`;
  }
  return `Service No.: ${orderNo} | Type: ${serviceTypeLabel(type, market)} | Urgency: ${serviceUrgencyLabel(urgency, market)}`;
}

function serviceCopy(market = 'com') {
  if (market === 'cn') {
    return {
      createdLog: '创建工单',
      aiCreatedLog: 'AI 对话创建工单',
      newTaskTitle: '新服务任务待确认',
      newPushTitle: '📋 新服务任务待确认',
      attachmentLog: (count) => `已从 AI 对话带入 ${count} 张诊断图片。`,
      quoteSubmittedInternal: '工程师已提交报价建议，等待运营复核后发送给客户。',
      quoteConfirmedMessage: '客户已确认报价，等待客户付款。付款完成后工程师即可开始上门服务。',
      quoteConfirmedTitle: '报价已确认，等待客户付款',
      quoteConfirmedBody: (orderNo) => `工单 ${orderNo} 的客户已确认报价，请等待客户完成付款。`,
      notAuthenticatedReason: '客户未登录，无法创建工单。请引导客户先登录。',
      missingFieldsReason: (fields) => `缺少必填字段：${fields.join('、')}。请向客户追问缺失信息后再调用。`,
      descriptionTooLongReason: '工单描述过长，请精简后重试。',
      invalidTypeReason: '工单类型值不合法。',
      toolFailedReason: (message) => `工单创建失败：${message}。请告知客户稍后重试或通过侧边栏手动提交。`,
    };
  }
  return {
    createdLog: 'Service request created',
    aiCreatedLog: 'Service request created from AI conversation',
    newTaskTitle: 'New service task pending confirmation',
    newPushTitle: '📋 New service task pending confirmation',
    attachmentLog: (count) => `Attached ${count} diagnostic image${count === 1 ? '' : 's'} from the AI conversation.`,
    quoteSubmittedInternal: 'The engineer submitted a quote proposal. SAGEMRO operations will review it before sending it to the customer.',
    quoteConfirmedMessage: 'The customer confirmed the quote. Payment follow-up is pending before service starts.',
    quoteConfirmedTitle: 'Quote confirmed; payment pending',
    quoteConfirmedBody: (orderNo) => `Work order ${orderNo} has a customer-confirmed quote. Please wait for payment completion before service starts.`,
    notAuthenticatedReason: 'The customer is not signed in. Ask the customer to sign in before creating the service request.',
    missingFieldsReason: (fields) => `Missing required field(s): ${fields.join(', ')}. Ask the customer for the missing information before calling this tool.`,
    descriptionTooLongReason: 'The service request description is too long. Please shorten it and try again.',
    invalidTypeReason: 'The service request type is invalid.',
    toolFailedReason: (message) => `Service request creation failed: ${message}. Ask the customer to try again later or submit manually from the sidebar.`,
  };
}

function systemSenderName(market = 'com') {
  return market === 'cn' ? '系统' : 'System';
}

const QUOTE_EXECUTION_ERRORS = {
  quote_total_amount_invalid: {
    com: 'Quote total must be a positive whole amount.',
    cn: '报价总额必须为正整数。',
  },
  expected_service_days_required: {
    com: 'Expected onsite service days must be a positive integer.',
    cn: '预计上门服务天数必须为正整数。',
  },
  payment_schedule_count_invalid: {
    com: 'Installment plans must contain 2 to 6 payments.',
    cn: '分期付款计划必须包含 2 至 6 期。',
  },
  payment_schedule_row_invalid: {
    com: 'Payment schedule contains an invalid row.',
    cn: '付款计划包含无效条目。',
  },
  payment_schedule_amount_invalid: {
    com: 'Each scheduled payment must be a positive whole amount.',
    cn: '每期付款金额必须为正整数。',
  },
  payment_schedule_sequence_invalid: {
    com: 'Payment schedule sequence must use whole numbers.',
    cn: '付款计划顺序必须为整数。',
  },
  payment_schedule_sequence_duplicate: {
    com: 'Payment schedule sequence values must be unique.',
    cn: '付款计划顺序不能重复。',
  },
  payment_schedule_currency_mismatch: {
    com: 'Payment schedule currency must match the quote currency.',
    cn: '付款计划币种必须与报价币种一致。',
  },
  payment_schedule_trigger_invalid: {
    com: 'Payment schedule contains an invalid trigger.',
    cn: '付款计划包含无效触发条件。',
  },
  payment_schedule_start_prerequisite_invalid: {
    com: 'Payment start prerequisite flags must be boolean values.',
    cn: '开工前付款标记必须为布尔值。',
  },
  payment_schedule_milestone_description_required: {
    com: 'Milestone payments require a description.',
    cn: '里程碑付款必须填写说明。',
  },
  payment_schedule_due_date_invalid: {
    com: 'Fixed-date payments require a valid date.',
    cn: '固定日期付款必须填写有效日期。',
  },
  payment_schedule_total_mismatch: {
    com: 'Payment schedule must total the quote amount.',
    cn: '付款计划总额必须等于报价总额。',
  },
  payment_schedule_start_prerequisite_required: {
    com: 'At least one payment must be required before service starts.',
    cn: '至少一期付款必须在服务开始前完成。',
  },
};

function quoteExecutionError(code, market, status = 400) {
  const messages = QUOTE_EXECUTION_ERRORS[code] || { com: code, cn: code };
  return errorResponse(messages[market] || messages.com, status);
}

function quoteReviewCopy(market = 'com') {
  if (market === 'cn') {
    return {
      invalidAction: '无效报价审核操作',
      workOrderNotFound: '服务申请不存在',
      quoteNotFound: '报价不存在',
      versionRequired: '必须提供有效的报价版本',
      staleVersion: '报价版本已更新，请刷新后重试',
      rejectionReasonRequired: '退回报价必须填写原因',
      approvedMessage: 'SAGEMRO 已完成报价审核，请查看报价明细并确认。',
      approvedTitle: 'SAGEMRO 报价已确认',
      approvedBody: (orderNo) => `服务编号 ${orderNo} 的报价已完成审核，请查看并确认。`,
      rejectedMessage: (note) => `内部报价审核未通过，请工程师修改后重新提交。原因：${note}`,
      rejectedTitle: '报价需修改',
      rejectedBody: (orderNo) => `服务编号 ${orderNo} 的报价未通过运营复核，请修改后重新提交。`,
      approvedResponse: '报价审核通过，等待客户确认。',
      rejectedResponse: '报价已退回工程师修改。',
    };
  }
  return {
    invalidAction: 'Invalid quote review action',
    workOrderNotFound: 'Service request not found',
    quoteNotFound: 'Quote not found',
    versionRequired: 'A valid quote version is required',
    staleVersion: 'The quote version changed. Refresh and try again.',
    rejectionReasonRequired: 'A reason is required to return the quote',
    approvedMessage: 'SAGEMRO approved the quote. Review the complete terms and confirm.',
    approvedTitle: 'SAGEMRO quote ready',
    approvedBody: (orderNo) => `The quote for service request ${orderNo} is ready for your confirmation.`,
    rejectedMessage: (note) => `The quote was returned for correction. Reason: ${note}`,
    rejectedTitle: 'Quote needs correction',
    rejectedBody: (orderNo) => `The quote for service request ${orderNo} was returned for correction.`,
    approvedResponse: 'Quote approved and ready for customer confirmation.',
    rejectedResponse: 'Quote returned to the engineer for correction.',
  };
}

function internalEngineerLabel(market = 'com') {
  return market === 'cn' ? '内部工程师' : 'internal engineer';
}

function sagemroEngineerLabel(market = 'com') {
  return market === 'cn' ? 'SAGEMRO 工程师' : 'SAGEMRO engineer';
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isCnPhoneNumber(phone) {
  return /^1\d{10}$/.test(String(phone || ''));
}

function getVerificationTarget({ phone, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    return {
      type: 'email',
      value: normalizedEmail,
      key: `email_${normalizedEmail}`,
    };
  }
  if (phone) {
    return {
      type: 'phone',
      value: phone,
      key: phone,
    };
  }
  return null;
}

function getRegistrationVerificationTarget({ phone, email }, request) {
  if (getRequestMarket(request) === 'cn' && phone) {
    return {
      type: 'phone',
      value: phone,
      key: phone,
    };
  }
  return getVerificationTarget({ phone, email });
}

async function sendVerificationEmail(env, email, code, request) {
  if (env.ENVIRONMENT === 'development') {
    return { skipped: true };
  }
  if (!env.VERIFICATION_EMAIL_FROM) {
    return {
      error: getRequestMarket(request) === 'cn'
        ? '邮件验证码服务尚未配置，请稍后再试'
        : 'Email verification service is not configured yet.',
    };
  }

  const market = getRequestMarket(request);
  const emailPayload = {
    from: env.VERIFICATION_EMAIL_FROM,
    to: email,
    subject: market === 'cn' ? `SAGEMRO 验证码` : 'SAGEMRO verification code',
    text: market === 'cn'
      ? `您的 SAGEMRO 验证码是 ${code}，有效期为 5 分钟。请勿将验证码告知他人。`
      : `Your SAGEMRO verification code is ${code}. It is valid for 5 minutes. Do not share it with others.`,
  };

  if (env.EMAIL?.send) {
    try {
      await env.EMAIL.send(emailPayload);
      return { sent: true, provider: 'cloudflare' };
    } catch (error) {
      console.warn('[email] Cloudflare Email send failed', {
        message: error?.message,
        emailSuffix: String(email || '').split('@').pop(),
      });
      return {
        error: getRequestMarket(request) === 'cn'
          ? '邮件验证码发送失败，请稍后再试'
          : 'Failed to send verification email. Please try again later.',
      };
    }
  }

  if (!env.RESEND_API_KEY) {
    return {
      error: getRequestMarket(request) === 'cn'
        ? '邮件验证码服务尚未配置，请稍后再试'
        : 'Email verification service is not configured yet.',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...emailPayload,
      to: [email],
    }),
  });
  if (!response.ok) {
    return {
      error: getRequestMarket(request) === 'cn'
        ? '邮件验证码发送失败，请稍后再试'
        : 'Failed to send verification email. Please try again later.',
    };
  }
  return { sent: true };
}

export async function sendEngineerActivationEmail(env, { to, subject, text, html }, market = 'com') {
  const errorMessage = market === 'cn'
    ? '激活邮件发送失败，请稍后再试'
    : 'Failed to send activation email. Please try again later.';
  if (
    env.ENVIRONMENT === 'development'
    && env.E2E_TEST_MODE === 'true'
    && env.E2E_TEST_SECRET
    && env.KV?.put
  ) {
    const mailboxKey = `e2e_mailbox_activation_email_${normalizeEmail(to)}`;
    await env.KV.put(mailboxKey, JSON.stringify({ to, subject, text, html }), {
      expirationTtl: 3600,
    });
    return { sent: true, provider: 'e2e_mailbox' };
  }
  if (!env.VERIFICATION_EMAIL_FROM) {
    return { error: errorMessage };
  }

  const emailPayload = {
    from: env.VERIFICATION_EMAIL_FROM,
    to,
    subject,
    text,
    html,
  };

  if (env.EMAIL?.send) {
    try {
      const EmailMessage = env.__EmailMessage || (await import('cloudflare:email')).EmailMessage;
      const boundary = `sagemro-${crypto.randomUUID()}`;
      const raw = [
        `From: ${emailPayload.from}`,
        `To: ${emailPayload.to}`,
        `Subject: ${emailPayload.subject.replace(/[\r\n]+/g, ' ')}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        emailPayload.text,
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        emailPayload.html,
        `--${boundary}--`,
        '',
      ].join('\r\n');
      await env.EMAIL.send(new EmailMessage(emailPayload.from, emailPayload.to, raw));
      return { sent: true };
    } catch {
      console.warn('[email] Cloudflare activation email send failed', {
        reason: 'provider_error',
        emailSuffix: String(to || '').split('@').pop(),
      });
    }
  }

  if (!env.RESEND_API_KEY) {
    return { error: errorMessage };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...emailPayload,
        to: [to],
      }),
    });
    if (!response.ok) {
      console.warn('[email] Resend activation email send failed', {
        status: response.status,
        emailSuffix: String(to || '').split('@').pop(),
      });
      return { error: errorMessage };
    }
    return { sent: true };
  } catch (error) {
    console.warn('[email] Resend activation email send failed', {
      reason: 'provider_error',
      emailSuffix: String(to || '').split('@').pop(),
    });
    return { error: errorMessage };
  }
}

async function handleE2EActivationMailbox(request, env) {
  const denied = () => errorResponse('Not found', 404);
  if (
    env.ENVIRONMENT !== 'development'
    || env.E2E_TEST_MODE !== 'true'
    || !env.E2E_TEST_SECRET
    || request.headers.get('X-E2E-Test-Secret') !== env.E2E_TEST_SECRET
    || !env.KV?.get
  ) {
    return denied();
  }

  const email = normalizeEmail(new URL(request.url).searchParams.get('email'));
  if (!email || !isValidEmail(email)) return denied();
  const message = await env.KV.get(`e2e_mailbox_activation_email_${email}`);
  if (!message) return denied();

  try {
    return jsonResponse(JSON.parse(message));
  } catch {
    return denied();
  }
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(signature);
}

function createAliyunNonce() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function buildAliyunSmsRequest(env, phone, code) {
  const endpoint = 'https://dysmsapi.aliyuncs.com';
  const host = 'dysmsapi.aliyuncs.com';
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = createAliyunNonce();
  const queryParams = new URLSearchParams({
    PhoneNumbers: phone,
    SignName: env.ALIYUN_SMS_SIGN_NAME_CN,
    TemplateCode: env.ALIYUN_SMS_TEMPLATE_CODE_REGISTER_CN,
    TemplateParam: JSON.stringify({ code }),
  });
  queryParams.sort();
  const canonicalQueryString = queryParams.toString();
  const bodyHash = await sha256Hex('');
  const headersToSign = {
    host,
    'x-acs-action': 'SendSms',
    'x-acs-content-sha256': bodyHash,
    'x-acs-date': date,
    'x-acs-signature-nonce': nonce,
    'x-acs-version': '2017-05-25',
  };
  const signedHeaders = Object.keys(headersToSign).sort().join(';');
  const canonicalHeaders = Object.keys(headersToSign)
    .sort()
    .map((key) => `${key}:${headersToSign[key]}\n`)
    .join('');
  const canonicalRequest = [
    'POST',
    '/',
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');
  const stringToSign = [
    'ACS3-HMAC-SHA256',
    await sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = await hmacSha256Hex(env.ALIYUN_SMS_ACCESS_KEY_SECRET, stringToSign);

  return {
    url: `${endpoint}/?${canonicalQueryString}`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `ACS3-HMAC-SHA256 Credential=${env.ALIYUN_SMS_ACCESS_KEY_ID},SignedHeaders=${signedHeaders},Signature=${signature}`,
        'x-acs-action': headersToSign['x-acs-action'],
        'x-acs-content-sha256': headersToSign['x-acs-content-sha256'],
        'x-acs-date': headersToSign['x-acs-date'],
        'x-acs-signature-nonce': headersToSign['x-acs-signature-nonce'],
        'x-acs-version': headersToSign['x-acs-version'],
      },
    },
  };
}

async function sendAliyunSmsVerification(env, phone, code) {
  if (env.ENVIRONMENT === 'development') {
    return { skipped: true };
  }
  if (
    !env.ALIYUN_SMS_ACCESS_KEY_ID
    || !env.ALIYUN_SMS_ACCESS_KEY_SECRET
    || !env.ALIYUN_SMS_SIGN_NAME_CN
    || !env.ALIYUN_SMS_TEMPLATE_CODE_REGISTER_CN
  ) {
    return { error: '短信验证码服务尚未配置，请稍后再试' };
  }

  const smsRequest = await buildAliyunSmsRequest(env, phone, code);
  const response = await fetch(smsRequest.url, smsRequest.init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.Code !== 'OK') {
    console.warn('[aliyun-sms] send failed', {
      status: response.status,
      code: result.Code,
      message: result.Message,
      requestId: result.RequestId,
      phoneSuffix: String(phone || '').slice(-4),
    });
    return { error: '短信验证码发送失败，请稍后再试' };
  }
  return { sent: true };
}

async function isVerificationCodeValid(env, { phone, email, code }) {
  const target = getVerificationTarget({ phone, email });
  if (!target) return false;
  const storedCode = await env.KV.get(`verify_code_${target.key}`);
  const legacyStoredCode = target.type === 'email' && phone
    ? await env.KV.get(`verify_code_${phone}`)
    : null;
  const devBypass = env.ENVIRONMENT === 'development' ? env.DEV_BYPASS_CODE : null;
  return (storedCode && storedCode === code)
    || (legacyStoredCode && legacyStoredCode === code)
    || (devBypass && devBypass === code);
}

async function deleteVerificationCode(env, { phone, email }) {
  const target = getVerificationTarget({ phone, email });
  if (target) {
    await env.KV.delete(`verify_code_${target.key}`);
  }
  if (phone) {
    await env.KV.delete(`verify_code_${phone}`);
  }
}

// 发送验证码：注册优先使用邮箱，兼容旧手机号验证码。
async function handleSendCode(request, env) {
  try {
    const { phone, email } = await request.json();
    const target = getRegistrationVerificationTarget({ phone, email }, request);
    if (!target) {
      if (email !== undefined) return localizedErrorResponse('email_required', request);
      return localizedErrorResponse('phone_required', request);
    }

    if (target.type === 'email' && !isValidEmail(target.value)) {
      return localizedErrorResponse('invalid_email', request);
    }
    if (target.type === 'phone' && !isCnPhoneNumber(target.value)) {
      return localizedErrorResponse('invalid_phone', request);
    }

    // 频控：同一邮箱或手机号 60 秒内只能请求一次
    const rateKey = `verify_code_rate_${target.key}`;
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
    await env.KV.put(`verify_code_${target.key}`, code, { expirationTtl: 300 });
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
    if (env.ENVIRONMENT === 'development') {
      if (devBypass) {
        response.code = devBypass;
        response.note = 'DEV_BYPASS_CODE 已启用，验证码为固定值';
      } else {
        response.code = code;
      }
    }

    if (target.type === 'email') {
      const emailResult = await sendVerificationEmail(env, target.value, env.ENVIRONMENT === 'development' && devBypass ? devBypass : code, request);
      if (emailResult.error) {
        await deleteVerificationCode(env, { email: target.value });
        return errorResponse(emailResult.error, 503);
      }
    } else if (getRequestMarket(request) === 'cn') {
      const smsResult = await sendAliyunSmsVerification(env, target.value, env.ENVIRONMENT === 'development' && devBypass ? devBypass : code);
      if (smsResult.error) {
        await deleteVerificationCode(env, { phone: target.value });
        return errorResponse(smsResult.error, 503);
      }
    }
    return jsonResponse(response);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 客户注册
async function handleRegisterCustomer(request, env) {
  try {
    const { name, phone, email, password, code, company, identity, conversation_id } = await request.json();
    const market = getRequestMarket(request);
    const normalizedEmail = normalizeIdentityEmail(email);
    const normalizedPhone = normalizeIdentityPhone(phone);

    if (!name || !phone || !password || !company || (market !== 'cn' && !normalizedEmail)) {
      return localizedErrorResponse('name_phone_company_password_required', request);
    }
    if (isPasswordTooShort(password)) {
      return passwordTooShortResponse(request);
    }

    // 验证验证码（开发环境支持 bypass 码 "888888" + DEV_BYPASS_CODE 用于自动化测试）
    const isValid = await isVerificationCodeValid(env, { phone, email, code });
    if (!isValid) {
      return errorResponse('验证码错误或已过期');
    }

    // 检查手机号是否已在任意角色注册（跨表去重）
    const [identityConflict, existingCustomer, existingEngineer, existingEmailCustomer, existingEmailEngineer] = await Promise.all([
      findAccountIdentityConflict(env, normalizedEmail, normalizedPhone),
      env.DB.prepare(`
        SELECT id FROM customers
        WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
      `).bind(normalizedPhone).first(),
      env.DB.prepare(`
        SELECT id FROM engineers
        WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
      `).bind(normalizedPhone).first(),
      normalizedEmail
        ? env.DB.prepare('SELECT id FROM customers WHERE lower(email) = ?').bind(normalizedEmail).first()
        : Promise.resolve(null),
      normalizedEmail
        ? env.DB.prepare('SELECT id FROM engineers WHERE lower(email) = ?').bind(normalizedEmail).first()
        : Promise.resolve(null),
    ]);

    if (identityConflict) {
      return accountIdentityConflictResponse(identityConflict.identity_type, request);
    }
    if (existingEmailCustomer || existingEmailEngineer) {
      return accountIdentityConflictResponse('email', request);
    }
    if (existingCustomer || existingEngineer) {
      return accountIdentityConflictResponse('phone', request);
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

    const customerInsert = env.DB.prepare(
      'INSERT INTO customers (id, user_no, name, phone, email, password_hash, salt, company, auth_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, userNo, name, phone, normalizedEmail || null, passwordHash, salt, company, authStatus);
    try {
      await env.DB.batch([
        customerInsert,
        ...identityInsertStatements(env, {
          ownerType: 'customer',
          ownerId: id,
          email: normalizedEmail,
          phone,
        }),
      ]);
    } catch (error) {
      const conflictResponse = await recoverAccountIdentityConflict(
        error, env, normalizedEmail, normalizedPhone, request
      );
      if (conflictResponse) return conflictResponse;
      throw error;
    }

    // 如果提供了 conversation_id，将游客对话关联到新注册的客户
    if (conversation_id) {
      await env.DB.prepare(
        'UPDATE conversations SET customer_id = ?, updated_at = datetime("now") WHERE id = ? AND customer_id IS NULL'
      ).bind(id, conversation_id).run();
    }

    // 删除已使用的验证码
    await deleteVerificationCode(env, { phone, email });
    await incrementApiCounter(env, "register_customer");

    return jsonResponse({
      success: true,
      customer: { id, user_no: userNo, name, phone, email: normalizedEmail || '' }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 登录
async function handleLogin(request, env) {
  try {
    const { phone, email, password } = await request.json();
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeIdentityPhone(phone);
    const loginKey = normalizedEmail || normalizedPhone;

    if (!loginKey || !password) {
      return localizedErrorResponse('phone_password_required', request);
    }

    // 登录失败计数（防暴力破解）：同一手机号 15 分钟内失败 5 次锁定
    const failKey = `login_fail_${loginKey}`;
    const failCountStr = await env.KV.get(failKey);
    const failCount = failCountStr ? parseInt(failCountStr, 10) : 0;
    if (failCount >= 5) {
      return localizedErrorResponse('too_many_password_attempts', request, 429);
    }

    // 查找客户
    let user = normalizedEmail
      ? await env.DB.prepare(
          'SELECT * FROM customers WHERE lower(email) = ?'
        ).bind(normalizedEmail).first()
      : await env.DB.prepare(
          `SELECT * FROM customers
           WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?`
        ).bind(normalizedPhone).first();

    let userType = 'customer';

    // 查找工程师
    if (!user) {
      user = normalizedEmail
        ? await env.DB.prepare(
            'SELECT * FROM engineers WHERE lower(email) = ?'
          ).bind(normalizedEmail).first()
        : await env.DB.prepare(
            `SELECT * FROM engineers
             WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?`
          ).bind(normalizedPhone).first();
      userType = 'engineer';
    }

    if (!user) {
      await env.KV.put(failKey, String(failCount + 1), { expirationTtl: 900 });
      return localizedErrorResponse('account_not_found', request);
    }

    if (userType === 'engineer' && user.auth_status === 'pending_activation') {
      return errorResponse(
        getRequestMarket(request) === 'cn'
          ? '账号尚未激活，请先使用激活邮件设置密码'
          : 'This engineer account is awaiting activation. Use the activation email to set a password.',
        403,
      );
    }

    // 验证密码（兼容新旧算法）
    const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!passwordValid) {
      await env.KV.put(failKey, String(failCount + 1), { expirationTtl: 900 });
      return localizedErrorResponse('wrong_password', request);
    }

    const portalRole = requestPortalRole(request);
    if (portalRole && portalRole !== userType) {
      const market = getRequestMarket(request);
      const target = userType === 'engineer'
        ? (market === 'cn' ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com')
        : (market === 'cn' ? 'https://sagemro.cn' : 'https://sagemro.com');
      return errorResponse(
        market === 'cn'
          ? `该账号请前往 ${target} 登录`
          : `Sign in to this account at ${target}.`,
        403,
      );
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
    const csrfToken = generateCsrfToken();
    const token = await signJwt({
      userId: user.id,
      userType,
      phone: user.phone,
      csrf: csrfToken,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }, env.JWT_SECRET);
    await incrementApiCounter(env, "login");

    return addSessionCookie(jsonResponse(sessionResponsePayload({
      success: true,
      csrfToken,
      userType,
      user: {
        id: user.id,
        user_no: user.user_no,
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        company: user.company || '',
        region: user.region || '',
        city: user.city || '',
        address: user.address || '',
        company_description: user.company_description || '',
        business_scope: user.business_scope || '',
        logo_url: user.logo_url || '',
        auth_status: user.auth_status || 'pending',
        ...(userType === 'engineer' ? {
          engineer_role: user.engineer_role || 'engineer',
          regional_lead_id: user.regional_lead_id || null,
          responsible_region: user.responsible_region || user.service_region || null,
          team_name: user.team_name || null,
        } : {})
      }
    }, token, portalRole)), request, env, userType, token);
} catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAuthSession(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonResponse({ authenticated: false });

  let sessionAuth = auth;
  let response;
  const rotateLegacyBearer = auth.authMethod === 'bearer' && !auth.csrf;
  if (rotateLegacyBearer) {
    sessionAuth = { ...auth, csrf: generateCsrfToken() };
  }

  if (sessionAuth.userType === 'admin') {
    if (sessionAuth.staffId) {
      const staff = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(sessionAuth.staffId).first();
      const requestMarket = getRequestMarket(request);
      const marketAllowed = sessionAuth.market === requestMarket
        && (staff?.market_scope === 'all' || staff?.market_scope === requestMarket);
      if (!staff?.is_active || !marketAllowed) {
        return clearPortalSession(jsonResponse({ authenticated: false }), request, env);
      }
      response = jsonResponse({
        authenticated: true,
        csrfToken: sessionAuth.csrf,
        userType: 'admin',
        user: {
          id: staff.id,
          name: staff.display_name,
          phone: staff.normalized_phone || '',
          type: 'admin',
          market: sessionAuth.market || getRequestMarket(request),
          staffRole: staff.role,
          staffId: staff.id,
          mustChangePassword: Boolean(staff.must_change_password),
        },
      });
      return rotateLegacyBearer ? addSessionCookie(response, request, env, 'admin', await signJwt({
        ...sessionAuth,
        staffRole: staff.role,
        mustChangePassword: Boolean(staff.must_change_password),
      }, env.JWT_SECRET)) : response;
    }
    const credentials = resolveAdminCredentials(request, env);
    response = jsonResponse({
      authenticated: true,
      csrfToken: sessionAuth.csrf,
      userType: 'admin',
      user: {
        id: 'admin', name: '超级管理员', phone: credentials.phone, type: 'admin', market: credentials.market,
        staffRole: 'admin', staffId: null, mustChangePassword: false,
      },
    });
    return rotateLegacyBearer ? addSessionCookie(response, request, env, 'admin', await signJwt(sessionAuth, env.JWT_SECRET)) : response;
  }

  const table = sessionAuth.userType === 'engineer' ? 'engineers' : 'customers';
  const user = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(sessionAuth.userId).first();
  if (!user) return clearPortalSession(jsonResponse({ authenticated: false }), request, env);
  response = jsonResponse({
    authenticated: true,
    csrfToken: sessionAuth.csrf,
    userType: sessionAuth.userType,
    user: {
      id: user.id,
      user_no: user.user_no,
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      company: user.company || '',
      region: user.region || '',
      city: user.city || '',
      address: user.address || '',
      company_description: user.company_description || '',
      business_scope: user.business_scope || '',
      logo_url: user.logo_url || '',
      auth_status: user.auth_status || 'pending',
      ...(sessionAuth.userType === 'engineer' ? {
        engineer_role: user.engineer_role || 'engineer',
        regional_lead_id: user.regional_lead_id || null,
        responsible_region: user.responsible_region || user.service_region || null,
        team_name: user.team_name || null,
      } : {}),
    },
  });
  if (!rotateLegacyBearer) return response;
  const rotatedToken = await signJwt(sessionAuth, env.JWT_SECRET);
  return addSessionCookie(response, request, env, sessionAuth.userType, rotatedToken);
}

async function incrementEngineerActivationAttemptCounters(env, request, tokenHash) {
  const keys = [
    `engineer_activation_attempt_ip_${getRequestIp(request) || 'unknown'}`,
    `engineer_activation_attempt_token_${tokenHash}`,
  ];
  const counts = await Promise.all(keys.map(async (key) => {
    const previous = Number(await env.KV.get(key) || 0);
    const next = previous + 1;
    await env.KV.put(key, String(next), { expirationTtl: 900 });
    return next;
  }));
  return Math.max(...counts);
}

async function handleEngineerActivation(request, env) {
  const market = getRequestMarket(request);
  const invalidTokenMessage = market === 'cn'
    ? '激活链接无效或已失效'
    : 'This activation link is invalid or has expired.';
  const rateLimitMessage = market === 'cn'
    ? '激活尝试次数过多，请 15 分钟后再试'
    : 'Too many activation attempts. Please try again in 15 minutes.';
  try {
    const body = await request.json().catch(() => ({}));
    const token = cleanText(body.token, 200);
    const password = body.password;
    if (!token) return errorResponse(invalidTokenMessage, 400);
    const tokenHash = await hashEngineerActivationToken(token);
    const attempts = await incrementEngineerActivationAttemptCounters(env, request, tokenHash);
    if (attempts > 10) return errorResponse(rateLimitMessage, 429);
    if (isPasswordTooShort(password)) return passwordTooShortResponse(request);

    const activation = await env.DB.prepare(`
      SELECT activation.id AS activation_id, activation.engineer_id,
             e.user_no AS engineer_no, e.name AS engineer_name, e.auth_status
      FROM engineer_account_activations activation
      JOIN engineers e ON e.id = activation.engineer_id
      WHERE activation.token_hash = ?
        AND activation.used_at IS NULL
        AND activation.revoked_at IS NULL
        AND activation.expires_at > datetime('now')
        AND e.auth_status = 'pending_activation'
      LIMIT 1
    `).bind(tokenHash).first();
    if (!activation) return errorResponse(invalidTokenMessage, 400);

    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(password, salt);
    const guardStatement = env.DB.prepare(`
      INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
      SELECT 'activation_guard', ?, 'engineer', ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM engineer_account_activations activation
        JOIN engineers e ON e.id = activation.engineer_id
        WHERE activation.id = ?
          AND activation.used_at IS NULL
          AND activation.revoked_at IS NULL
          AND activation.expires_at > datetime('now')
          AND e.auth_status = 'pending_activation'
        )
    `).bind(activation.activation_id, activation.engineer_id, activation.activation_id);
    let results;
    try {
      results = await env.DB.batch([
        guardStatement,
        env.DB.prepare(`
          UPDATE engineers
          SET password_hash = ?, salt = ?, auth_status = 'authenticated', status = 'available',
              first_login_password_reset_required = 0
          WHERE id = ? AND auth_status = 'pending_activation'
        `).bind(passwordHash, salt, activation.engineer_id),
        env.DB.prepare(`
          UPDATE engineer_account_activations
          SET used_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
        `).bind(activation.activation_id),
        buildAuditLogStatement(env, request, {
          actorType: 'engineer', actorId: activation.engineer_id,
          targetType: 'engineer', targetId: activation.engineer_id,
          action: 'engineer_account_activated',
          afterState: { engineer_no: activation.engineer_no, status: 'available' },
        }),
      ]);
    } catch (error) {
      if (/CHECK constraint failed(?::\s*identity_type IN \('email', 'phone'\))?/i.test(String(error?.message || error))) {
        return errorResponse(invalidTokenMessage, 400);
      }
      throw error;
    }
    if (results?.[1]?.meta?.changes !== 1 || results?.[2]?.meta?.changes !== 1) {
      return errorResponse(invalidTokenMessage, 400);
    }
    return jsonResponse({ success: true });
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
    if (env.ENVIRONMENT === 'development') {
      if (devBypass) {
        response.code = devBypass;
      } else {
        response.code = code;
      }
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

    if (isPasswordTooShort(newPassword)) {
      return passwordTooShortResponse(request);
    }

    // 验证验证码（开发环境支持 bypass 码 "888888" + DEV_BYPASS_CODE 用于自动化测试）
    const storedCode = await env.KV.get(`reset_code_${phone}`);
    const devBypass = env.ENVIRONMENT === 'development' ? env.DEV_BYPASS_CODE : null;
    const isValid = (storedCode && storedCode === code)
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
//   chat:    对话主流程，允许较长回复
//   summary: 工单摘要，短 JSON
//   note:    核价点评，一句话 + 2 条建议
async function enforceHourlyKvLimit(env, { key, limit, ttlSeconds = 3600, message }) {
  if (!env.KV) return;

  const currentStr = await env.KV.get(key);
  const currentCount = currentStr ? parseInt(currentStr, 10) : 0;

  if (currentCount >= limit) {
    throw new BudgetError(message, 429);
  }

  await env.KV.put(key, String(currentCount + 1), { expirationTtl: ttlSeconds });
}

const MAX_TOKENS = {
  chat: 2000,
  chat_tool_followup: 2000,
  summary: 500,
  note: 400,
};

// Phase 0.3：多轮 tool call 循环上限
// 设计意图：每轮允许 AI 继续调工具（chain），最后一轮强制不给 tools，LLM 必须产出文本。
// 4 轮足够复杂 Agent 场景（查客户 → 查设备 → 查历史报价 → 查同区域均价），生产可按需调。
const MAX_TOOL_ITERATIONS = 4;

function sanitizeCustomerVisibleAiContent(text) {
  if (typeof text !== 'string' || !text) return '';

  return text
    .replace(/Knowledge\s+Priority\s*&\s*Conflict\s+Policy\s*:?\s*/gi, '')
    .replace(/\binternal\s+(?:decision\s+)?policy\b/gi, 'service rule')
    .replace(/\binternal\s+conflict\b/gi, 'inconsistency')
    .replace(/\bknowledge\s+priority\b/gi, 'available information')
    .replace(/\bpublished\s+SAGEMRO\s+knowledge\b/gi, 'available SAGEMRO information')
    .replace(/\bSAGEMRO\s+knowledge\s+articles?\b/gi, 'available SAGEMRO information')
    .replace(/\bknowledge\s+base\b/gi, 'available SAGEMRO information');
}

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
  // 按 index 累积：OpenAI 流式规范 tool_calls[i] 的 id/name 首包到达，arguments 可分多包
  const toolCallsByIndex = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === 'data: [DONE]') continue; // 外层统一发 DONE
      if (!trimmed.startsWith('data: ')) continue;

      let data;
      try {
        data = JSON.parse(trimmed.slice(6));
      } catch {
        continue;
      }

      const delta = data.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        const customerContent = sanitizeCustomerVisibleAiContent(delta.content);
        content += customerContent;
        if (!customerContent) continue;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ content: customerContent, conversation_id: convId })}\n`,
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
    }
  }

  // 按 index 排序，过滤不完整的（没有 id 或 name 的不能发回 OpenAI）
  const toolCalls = [...toolCallsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .filter((tc) => tc.id && tc.function.name);

  return { content, toolCalls, reasoningContent };
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
function normalizeVoiceTranscript(text) {
  let normalized = String(text || '');
  let next = normalized;
  do {
    normalized = next;
    next = normalized.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu, '$1$2');
  } while (next !== normalized);
  return normalized;
}

export async function handleChatTranscribe(request, env) {
  try {
    const market = getRequestMarket(request);
    if (!env.DEEPGRAM_API_KEY) {
      return errorResponse(market === 'cn' ? '语音输入功能未配置' : 'Voice input is not configured.', 503);
    }

    const formData = await request.formData();
    const file = formData.get('audio');

    if (!file || typeof file === 'string') {
      return errorResponse(market === 'cn' ? '请先录制语音' : 'Please record audio first.', 400);
    }

    const maxVoiceBytes = 6 * 1024 * 1024;
    if (file.size > maxVoiceBytes) {
      return errorResponse(market === 'cn' ? '语音文件太大，请控制在 30 秒以内' : 'Voice recording is too large. Please keep it under 30 seconds.', 413);
    }

    const contentType = file.type || 'audio/webm';
    if (!/^audio\//i.test(contentType) && !/webm|ogg|mp4|mpeg/i.test(contentType)) {
      return errorResponse(market === 'cn' ? '不支持的音频格式' : 'Unsupported audio format.', 400);
    }

    let auth = null;
    try {
      auth = await authenticateRequest(request, env);
    } catch {
      auth = null;
    }
    if (auth && !hasValidCsrf(request, auth)) {
      return errorResponse('Invalid CSRF token', 403);
    }
    const clientIP = getRequestIp(request) || 'unknown';
    const voiceUserKey = auth?.userId ? `${auth.userType}:${auth.userId}` : `guest:${clientIP}`;
    const hourlyLimit = parseInt(env.DEEPGRAM_HOURLY_PER_USER || '20', 10);
    const limitMsg = market === 'cn' ? '语音转写次数已用完，请稍后再试' : 'Voice transcription limit reached. Please try again later.';
    await enforceHourlyKvLimit(env, {
      key: `deepgram_voice_hour_${voiceUserKey}`,
      limit: hourlyLimit,
      ttlSeconds: 3600,
      message: limitMsg,
    });

    const deepgramUrl = new URL('https://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('model', env.DEEPGRAM_MODEL || 'whisper-large');
    deepgramUrl.searchParams.set('smart_format', 'true');
    deepgramUrl.searchParams.set('detect_language', 'true');

    const dgResponse = await fetch(deepgramUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
        'Content-Type': contentType,
      },
      body: file.stream(),
    });

    const dgBody = await dgResponse.json().catch(() => ({}));
    if (!dgResponse.ok) {
      const message = dgBody.err_msg || dgBody.error || (market === 'cn' ? '语音转写失败' : 'Voice transcription failed.');
      return errorResponse(message, dgResponse.status >= 500 ? 503 : 400);
    }

    const channel = dgBody?.results?.channels?.[0] || {};
    const transcript = normalizeVoiceTranscript(channel?.alternatives?.[0]?.transcript || '');
    return jsonResponse({
      success: true,
      transcript,
      detectedLanguage: channel.detected_language || null,
      languageConfidence: channel.language_confidence ?? null,
    });
  } catch (error) {
    if (error instanceof BudgetError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse(error.message || (market === 'cn' ? '语音转写失败' : 'Voice transcription failed.'), 500);
  }
}

export async function handleChat(request, env) {
  try {
    const body = await request.json();
    const { conversation_id, message, images } = body;

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
    if (chatAuth && !hasValidCsrf(request, chatAuth)) {
      return errorResponse('Invalid CSRF token', 403);
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
      existingConversation = await runD1WithTransientRetry(
        () => env.DB.prepare(
          'SELECT customer_id, engineer_id FROM conversations WHERE id = ?'
        ).bind(conversation_id).first(),
        { label: 'chat:load_conversation' },
      );
      if (existingConversation) {
        // 已认证用户访问无主对话时自动认领
        if (trustedCustomerId && !existingConversation.customer_id && !existingConversation.engineer_id) {
          await env.DB.prepare(
            'UPDATE conversations SET customer_id = ? WHERE id = ? AND customer_id IS NULL'
          ).bind(trustedCustomerId, conversation_id).run();
          existingConversation.customer_id = trustedCustomerId;
        }
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
      const history = await runD1WithTransientRetry(
        () => env.DB.prepare(
          'SELECT role, content, image_urls FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
        ).bind(conversation_id).all(),
        { label: 'chat:load_messages' },
      );

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
    const isCnMarket = requestHost.endsWith('.cn') || originHost.includes('sagemro.cn');
    const marketLabel = isCnMarket ? 'China edition / sagemro.cn' : 'International edition / sagemro.com';
    const turnLanguageRule = isCnMarket
      ? `You MUST answer this turn in Simplified Chinese.
Reply in Simplified Chinese.
English alarm codes, brand names, CNC terms, or short English phrases do not count as a request to answer in English.`
      : `Reply in the same natural language the customer uses in their latest message.
If the latest customer message is in Russian, reply in Russian; if it is in French, reply in French; if it is in German, reply in German; if it is in Italian, reply in Italian; if it is in Spanish, reply in Spanish; if it is in English, reply in English.
If the latest customer message is ambiguous, mostly alarm codes, brand names, model names, CNC terms, or short technical fragments, default to English.
SAGEMRO system UI labels, button names, routes, account type names, and portal names remain in English.
Internal service-ready summaries, work-order summaries, progress text, and AI analysis must remain in English.
Customer-facing explanatory chat replies may follow the customer's language.`;
    const marketContext = `

## 当前请求上下文
- API host: ${requestHost}
- Origin: ${originHost || 'not provided'}
- Market: ${marketLabel}

## 本轮语言硬性规则
${turnLanguageRule}

请严格遵守上方语言策略和本轮语言硬性规则。`;
    const fullSystemPrompt = SYSTEM_PROMPT + rolePrompt + marketContext + dataContext;

    // 创建或更新对话（customer_id / engineer_id 只接受 JWT 信任值）
    let convId = conversation_id;
    if (!convId || !existingConversation) {
      convId = convId || generateId();
      existingConversation = await createChatConversation(env, {
        convId,
        message,
        chatAuth,
        trustedRole,
        trustedCustomerId,
        trustedEngineerId,
      });
    } else {
      await runD1WithTransientRetry(
        () => env.DB.prepare(
          'UPDATE conversations SET last_message = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(truncateStr(message, 50), convId).run(),
        { label: 'chat:update_conversation' },
      );
    }

    // 保存用户消息（含图片 URL）
    const userMsgId = generateId();
    const imageUrlsJson = imageUrls.length > 0 ? JSON.stringify(imageUrls.map(i => i.url)) : null;
    await runD1WithTransientRetry(
      () => env.DB.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, image_urls) VALUES (?, ?, ?, ?, ?)'
      ).bind(userMsgId, convId, 'user', message, imageUrlsJson).run(),
      { label: 'chat:insert_user_message' },
    );

    await maybeCreateMachineLeadFromChat({
      env,
      message,
      conversationId: convId,
      customerId: trustedCustomerId,
    });

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
        let pendingDeviceSuggestion = null;

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
                market: isCnMarket ? 'cn' : 'com',
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
          while (true) {
            const canCallTools = iteration < MAX_TOOL_ITERATIONS;
            const requestBody = {
              model: getChatModel(env),
              messages: currentMessages,
              stream: true,
              temperature: 0.7,
              max_tokens:
                iteration === 0 ? MAX_TOKENS.chat : MAX_TOKENS.chat_tool_followup,
            };
            if (canCallTools && !preInjectedWorkOrder?.success) {
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
                  market: isCnMarket ? 'cn' : 'com',
                  iteration,
                });
                return { tool_call_id: tc.id, result };
              }),
            );

            // 把 tool 结果作为 tool 角色消息追加
            for (const { tool_call_id, result } of toolResults) {
              if (result?.device_suggestion) {
                pendingDeviceSuggestion = result.device_suggestion;
              }
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
          if (pendingDeviceSuggestion) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ device_suggestion: pendingDeviceSuggestion, conversation_id: convId })}\n`,
              ),
            );
          }
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
    if (error instanceof TransientD1Error) {
      console.warn('[chat] transient D1 failure after retry:', error?.cause?.message || error.message);
      return errorResponse(error.message, 503);
    }
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

const WORK_ORDER_TYPE_LABELS_EN = {
  fault: 'Equipment fault',
  maintenance: 'Maintenance',
  parameter: 'Parameter tuning',
  consult: 'Technical consultation',
  parts: 'Spare parts purchase',
  aftersales: 'After-sales service',
  other: 'Other'
};

export function buildWorkOrderSummaryPrompt({ type, description, urgency, market = 'com' }) {
  const isCnMarket = market === 'cn';
  const typeLabel = isCnMarket
    ? (WORK_ORDER_TYPE_LABELS[type] || type)
    : (WORK_ORDER_TYPE_LABELS_EN[type] || type);
  const urgencyLabel = isCnMarket
    ? (urgency === 'critical' ? '非常紧急' : urgency === 'urgent' ? '紧急' : '普通')
    : (urgency === 'critical' ? 'Critical' : urgency === 'urgent' ? 'Urgent' : 'Normal');

  if (!isCnMarket) {
    return `You are a work order analysis assistant for SAGEMRO Service OS. When a customer submits a service request, generate a concise structured summary that helps engineers and admins quickly understand the case.

For sagemro.com, keep all AI-generated work-order summaries and analysis in English, even if the customer's original description is written in Chinese.
Work order summary, required specialties, suggested skills, urgency notes, and AI analysis must be written in English.

Work order information:
- Type: ${typeLabel}
- Description: ${description}
- Urgency: ${urgencyLabel}

Return JSON fields in English only. Return valid JSON only, with no markdown and no extra commentary:
{
  "summary": "Use 2-3 sentences to summarize the core issue and recommended handling direction.",
  "required_specialties": ["Most relevant equipment type labels, such as laser cutting machine or press brake."],
  "suggested_skills": ["Recommended technical skill tags, such as laser source repair or parameter tuning."],
  "urgency_notes": "If urgent, explain why it is urgent and what the team should watch for."
}`;
  }

  return `你是工单分析助手。当客户提交一个维修工单时，你需要生成一个简洁的摘要，帮助工程师快速了解工单情况。

工单信息：
- 类型：${typeLabel}
- 描述：${description}
- 紧急程度：${urgencyLabel}

请生成以下格式的 JSON 响应（只返回 JSON，不要有其他内容）：
{
  "summary": "用2-3句话概括这个工单的核心问题和建议的处理方向",
  "required_specialties": ["需要的最匹配的设备类型标签，如激光切割机、折弯机等"],
  "suggested_skills": ["建议的技术能力标签，如激光器维修、参数调试等"],
  "urgency_notes": "如果紧急，说明为什么紧急和需要注意的事项"
}

只返回 JSON，不要有其他内容。`;
}

// 生成工单 AI 摘要
async function generateWorkOrderSummary(type, description, urgency, env, { market = 'com' } = {}) {
  if (!env.OPENAI_API_ENDPOINT || !env.OPENAI_API_KEY) return null;

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
  const prompt = buildWorkOrderSummaryPrompt({ type, description, urgency, market });

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

async function handleLocationSearch(request, env) {
  const market = getRequestMarket(request);
  const url = new URL(request.url);
  const query = normalizeLocationQuery(url.searchParams.get('q'));
  const limit = url.searchParams.get('limit') || '5';
  if (query.length < 2) {
    return errorResponse(market === 'cn' ? '请输入至少两个字符的地址' : 'Please enter at least two address characters', 400);
  }

  try {
    const result = await searchLocationProvider({ query, market, env, limit });
    return jsonResponse({ market, query, ...result });
  } catch (error) {
    if (error.message === 'mapbox_token_not_configured') {
      return errorResponse('Mapbox search is not configured', 503);
    }
    console.error('[location-search] provider request failed:', error.message);
    return errorResponse(market === 'cn' ? '地址搜索暂时不可用，请稍后重试' : 'Address search is temporarily unavailable. Please try again.', 502);
  }
}

// 创建工单
async function handleCreateWorkOrder(request, env) {
  try {
    const market = getRequestMarket(request);
    const copy = serviceCopy(market);
    const {
      customer_id,
      type,
      description,
      urgency,
      device_id,
      category_l1,
      category_l2,
      conversation_id,
      service_mode,
      service_address,
      service_latitude,
      service_longitude,
      service_accuracy_m,
      service_coordinate_system,
      service_location_source,
    } = await request.json();

    if (!customer_id || !type || !description) {
      return localizedErrorResponse('missing_required_fields', request);
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

    const serviceMode = normalizeServiceMode(service_mode);
    const serviceLocation = parseServiceLocation({
      service_address,
      service_latitude,
      service_longitude,
      service_accuracy_m,
      service_coordinate_system,
      service_location_source,
    });
    if (serviceLocation.error) {
      return errorResponse(serviceLocationErrorMessage(serviceLocation.error, market), 400);
    }
    if (requiresArrivalVerification(serviceMode) && (!serviceLocation.address || !serviceLocation.hasCoordinates)) {
      return errorResponse(serviceLocationErrorMessage('service_location_required', market), 400);
    }

    // PII 脱敏（Phase 0.5）：手机号/邮箱/身份证/银行卡/车牌等在入库前替换为占位符
    // 注：device_id / type / urgency 是枚举/引用，不脱敏。只洗用户自由输入的 description
    const safeDescription = redactPII(description);

    const id = generateId();
    const order_no = generateOrderNo();

    const slaDeadline = computeSlaDeadline(urgency || 'normal');

    await env.DB.prepare(`
      INSERT INTO work_orders (
        id, order_no, customer_id, type, description, urgency, device_id, status,
        sla_deadline, category_l1, category_l2, service_mode, arrival_verification_required,
        service_address, service_latitude, service_longitude, service_accuracy_m,
        service_coordinate_system, service_location_source, service_location_confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      order_no,
      customer_id,
      type,
      safeDescription,
      urgency || 'normal',
      device_id || null,
      slaDeadline,
      catL1,
      category_l2 || 'other',
      serviceMode,
      requiresArrivalVerification(serviceMode) ? 1 : 0,
      serviceLocation.address || null,
      serviceLocation.latitude,
      serviceLocation.longitude,
      serviceLocation.accuracyMeters,
      serviceLocation.coordinateSystem,
      serviceLocation.source,
      serviceLocation.hasCoordinates ? new Date().toISOString() : null,
    ).run();
    // 记录日志
    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(generateId(), id, 'created', 'customer', customer_id, copy.createdLog).run();

    const attachedImages = await attachConversationImagesToWorkOrder(env, {
      workOrderId: id,
      conversationId: conversation_id,
      uploaderType: 'customer',
      uploaderId: customer_id,
      market,
    });

    // AI 摘要异步生成：不阻塞响应，生成完成后回写 ai_summary
    // 使用 ctx.waitUntil 保证 Worker 在返回响应后仍会完成该任务
    const ctx = request._ctx;
    const aiSummaryPromise = generateWorkOrderSummary(type, safeDescription, urgency, env, { market })
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

    const notificationBody = serviceNotificationBody(order_no, type, urgency, market);

    for (const engineer of matchingEngineers) {
      if (engineer.onesignal_player_id) {
        await sendPushToEngineer(engineer.id, env, {
          title: copy.newPushTitle,
          titleZh: serviceCopy('cn').newPushTitle,
          message: notificationBody,
          messageZh: serviceNotificationBody(order_no, type, urgency, 'cn'),
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
        title: copy.newTaskTitle,
        body: notificationBody,
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
        engRegions = cleanTextArray(engineer.service_region);
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
      description: redactContactInfoForWorkOrder(wo.description),
      customer_phone: '',
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

    const fieldWorkAccessMode = await resolveFieldWorkAccessMode(env, request._auth, workOrder, id);
    const historicalEngineerView = fieldWorkAccessMode === 'historical_engineer';
    const noFieldWorkView = fieldWorkAccessMode === 'none';

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

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(id).first();
    const pricingView = await getWorkOrderPricingView(
      env, workOrder, pricing, request._auth?.userType === 'customer',
    );
    const detailPricing = pricingView?.pricing || null;
    const pricingSchedule = pricingView?.payment_schedule || [];
    const quoteExecution = await getWorkOrderQuoteExecution(
      env, workOrder, pricing, request._auth, getRequestMarket(request),
    );

    const paymentRecords = await env.DB.prepare(
      'SELECT * FROM work_order_payments WHERE work_order_id = ? ORDER BY created_at ASC'
    ).bind(id).all();
    const payments = paymentRecords.results || [];
    const paymentPolicy = detailPricing && !isVersionedQuote(detailPricing)
      ? computeServicePaymentPolicy(detailPricing)
      : null;

    let payout = await env.DB.prepare(
      'SELECT * FROM work_order_payouts WHERE work_order_id = ?'
    ).bind(id).first();
    if (!payout && request._auth?.staffRole !== 'operations' && workOrder?.status === 'completed' && workOrder?.engineer_id) {
      payout = await ensureWorkOrderPayout(env, id, workOrder.engineer_id, 'pending');
    }

    const attachments = await env.DB.prepare(
      'SELECT * FROM work_order_attachments WHERE work_order_id = ? ORDER BY created_at DESC'
    ).bind(id).all();

    const fieldDayRecords = await env.DB.prepare(`
      SELECT * FROM work_order_field_days WHERE work_order_id = ? ORDER BY site_local_date DESC, created_at DESC
    `).bind(id).all();
    const fieldMediaRecords = await env.DB.prepare(`
      SELECT * FROM work_order_field_day_media WHERE work_order_id = ? AND deleted_at IS NULL ORDER BY created_at ASC
    `).bind(id).all();
    const extensionRecords = await env.DB.prepare(`
      SELECT * FROM work_order_extension_requests WHERE work_order_id = ? ORDER BY created_at DESC
    `).bind(id).all();
    const adminFieldWorkRecords = request._auth?.userType === 'admin'
      ? await Promise.all([
        env.DB.prepare(`
          SELECT * FROM work_order_field_evidence_holds WHERE work_order_id = ? ORDER BY opened_at DESC, id DESC
        `).bind(id).all(),
        env.DB.prepare(`
          SELECT * FROM work_order_field_day_revisions WHERE work_order_id = ? ORDER BY created_at DESC, id DESC
        `).bind(id).all(),
        env.DB.prepare(`
          SELECT * FROM audit_logs
          WHERE (target_type = 'work_order' AND target_id = ? AND action LIKE 'field_%')
          OR (target_type = 'work_order_field_day' AND target_id IN (
            SELECT id FROM work_order_field_days WHERE work_order_id = ?
          )) OR (target_type = 'work_order_field_evidence_hold' AND target_id IN (
            SELECT id FROM work_order_field_evidence_holds WHERE work_order_id = ?
          )) OR (target_type = 'work_order_extension_request' AND target_id IN (
            SELECT id FROM work_order_extension_requests WHERE work_order_id = ?
          ))
          ORDER BY created_at DESC, id DESC
        `).bind(id, id, id, id).all(),
      ])
      : null;
    const customerFieldView = fieldWorkAccessMode === 'customer';
    const visibleFieldDayRecords = noFieldWorkView
      ? []
      : historicalEngineerView
      ? (fieldDayRecords.results || []).filter((fieldDay) => fieldDay.engineer_id === request._auth.userId)
      : (fieldDayRecords.results || []);
    const visibleFieldDayIds = new Set(visibleFieldDayRecords.map((fieldDay) => fieldDay.id));
    const mediaByDay = new Map();
    for (const media of fieldMediaRecords.results || []) {
      if (noFieldWorkView) continue;
      if (customerFieldView && !media.customer_visible) continue;
      if (historicalEngineerView && !visibleFieldDayIds.has(media.field_day_id)) continue;
      const list = mediaByDay.get(media.field_day_id) || [];
      list.push(publicFieldMedia(media, id));
      mediaByDay.set(media.field_day_id, list);
    }
    const fieldDays = visibleFieldDayRecords.map((fieldDay) => ({
      ...publicFieldDay(fieldDay, { customerView: customerFieldView }),
      media: mediaByDay.get(fieldDay.id) || [],
    }));
    const fieldWorkSummary = fieldDays.reduce((summary, fieldDay) => ({
      total_days: summary.total_days + 1,
      total_labor_hours: summary.total_labor_hours + Number(fieldDay.labor_hours || 0),
      overdue_count: summary.overdue_count + (fieldDay.status === 'report_overdue' ? 1 : 0),
    }), { total_days: 0, total_labor_hours: 0, overdue_count: 0 });
    if (historicalEngineerView) {
      return jsonResponse({
        id: workOrder.id,
        order_no: workOrder.order_no,
        status: workOrder.status,
        service_mode: workOrder.service_mode,
        field_days: fieldDays,
        field_work_summary: fieldWorkSummary,
      });
    }
    const visibleExtensionRecords = noFieldWorkView
      ? []
      : customerFieldView
      ? (extensionRecords.results || []).filter((extension) => ['approved', 'rejected'].includes(extension.status))
      : (extensionRecords.results || []);
    const fieldExtensionRequests = visibleExtensionRecords.map((extension) => {
      if (!customerFieldView) return extension;
      return {
        status: extension.status,
        requested_additional_days: extension.requested_additional_days,
        proposed_completion_date: extension.proposed_completion_date,
        customer_explanation: extension.customer_explanation,
        decision_reason: extension.decision_reason || null,
        approved_plan: extension.approved_plan || null,
        decided_at: extension.decided_at || null,
      };
    });
    const pendingExtensionRequests = customerFieldView
      ? []
      : fieldExtensionRequests.filter((extension) => extension.status === 'pending');

    let arrivalChecks = [];
    if (request._auth?.userType === 'admin' || ['assigned_engineer', 'historical_engineer'].includes(fieldWorkAccessMode)) {
      const arrivalCheckRecords = await env.DB.prepare(`
        SELECT * FROM work_order_arrival_checks
        WHERE work_order_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).bind(id).all();
      arrivalChecks = historicalEngineerView
        ? (arrivalCheckRecords.results || []).filter((check) => check.engineer_id === request._auth.userId)
        : (arrivalCheckRecords.results || []);
    }

    const materialItems = await listWorkOrderMaterialItems(env, id);
    const quoteMaterialItems = materialItems.filter((item) => item.purpose === 'quote');
    const isEngineerDetailView = request._auth?.userType === 'engineer';
    let safeWorkOrder = {
      ...workOrder,
      description: isEngineerDetailView ? redactContactInfoForWorkOrder(workOrder.description) : workOrder.description,
      customer_phone: isEngineerDetailView && !canEngineerViewCustomerContact(workOrder.status) ? '' : workOrder.customer_phone,
    };
    if (customerFieldView || noFieldWorkView) safeWorkOrder = withoutPrivateFieldLocation(safeWorkOrder);

    const detail = {
      ...safeWorkOrder,
      sla_status: getSlaStatus(workOrder.sla_deadline, workOrder.urgency),
      logs: logs.results,
      rating: rating || null,
      admin_reply: adminReply || null,
      engineer_review: engineerReview || null,
      repair_record: repairRecord
        ? { ...repairRecord, material_items: materialItems.filter((item) => item.purpose === 'service_report') }
        : null,
      pricing: detailPricing ? {
        ...detailPricing,
        material_items: quoteMaterialItems,
        payment_policy: paymentPolicy,
        payment_schedule: pricingSchedule,
      } : null,
      quote_execution: quoteExecution,
      payment_policy: paymentPolicy,
      payments,
      advance_payment: payments.find((payment) => payment.payment_stage === 'advance') || null,
      balance_payment: payments.find((payment) => payment.payment_stage === 'balance') || null,
      payout_status: payout?.status || 'not_ready',
      payout: sanitizePayoutForUser(payout, request._auth),
      material_items: materialItems,
      attachments: attachments.results,
      arrival_checks: arrivalChecks,
      field_plan: fieldPlanSnapshot(workOrder),
      field_days: fieldDays,
      field_work_summary: fieldWorkSummary,
      field_extension_requests: fieldExtensionRequests,
      pending_extension_requests: pendingExtensionRequests,
    };
    if (adminFieldWorkRecords) {
      detail.field_evidence_holds = adminFieldWorkRecords[0].results || [];
      detail.field_day_revisions = adminFieldWorkRecords[1].results || [];
      detail.field_work_audit_logs = adminFieldWorkRecords[2].results || [];
    }
    return jsonResponse(detail);
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

    const materialItems = await listWorkOrderMaterialItems(env, workOrderId, { purpose: 'service_report' });

    return jsonResponse({
      repair_record: record ? { ...record, material_items: materialItems } : null,
      material_items: materialItems,
    });
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

    if (Array.isArray(body.material_items)) {
      await replaceWorkOrderMaterialItems(env, request, workOrderId, 'service_report', body.material_items);
    }

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

const FIELD_EVIDENCE_MIME_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const RECEIPT_EVIDENCE_MIME_TYPES = new Map([
  ...FIELD_EVIDENCE_MIME_TYPES,
  ['application/pdf', 'pdf'],
]);
const FIELD_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const FIELD_WORK_SCHEDULER_BATCH_SIZE = 100;
const FIELD_EVIDENCE_RETENTION_CLAIM_MS = 60 * 60 * 1000;
const FIELD_WORK_SCHEDULER_CURSOR_PREFIX = 'field-work:scheduler-cursor:';

function subtractUtcMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

function sqliteUtcTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
const EVIDENCE_HOLD_REASON_CATEGORIES = new Set(['complaint', 'warranty', 'safety_review', 'legal_hold', 'dispute']);

function hasFieldEvidenceSignature(bytes, mimeType) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (mimeType === 'image/webp') return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (mimeType === 'application/pdf') return bytes.length >= 5
    && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

function parseFieldDayLocation(rawLocation, workOrder) {
  let input = rawLocation;
  if (typeof rawLocation === 'string' && rawLocation.trim()) {
    try { input = JSON.parse(rawLocation); } catch { return { location_status: 'unavailable' }; }
  }
  if (!input || typeof input !== 'object') return { location_status: 'unavailable' };

  const latitude = normalizeCoordinate(input.latitude);
  const longitude = normalizeCoordinate(input.longitude);
  const accuracy = normalizeCoordinate(input.accuracy_m ?? input.accuracy);
  const coordinateSystem = String(input.coordinate_system || 'wgs84').trim().toLowerCase();
  const locationSource = String(input.location_source || 'browser').trim().slice(0, 40) || 'browser';
  if (!isValidCoordinatePair(latitude, longitude)
    || accuracy === null || accuracy <= 0 || accuracy > 500
    || !SUPPORTED_COORDINATE_SYSTEMS.has(coordinateSystem)) {
    return { location_status: 'unavailable' };
  }

  if (!isValidCoordinatePair(workOrder.service_latitude, workOrder.service_longitude)) {
    return { location_status: 'unavailable', latitude, longitude, accuracy, coordinateSystem, locationSource };
  }
  const evaluation = evaluateArrivalCheck({
    targetLatitude: workOrder.service_latitude,
    targetLongitude: workOrder.service_longitude,
    targetCoordinateSystem: workOrder.service_coordinate_system || 'wgs84',
    currentLatitude: latitude,
    currentLongitude: longitude,
    currentAccuracyMeters: accuracy,
    currentCoordinateSystem: coordinateSystem,
  });
  if (!evaluation.valid) return { location_status: 'unavailable', latitude, longitude, accuracy, coordinateSystem, locationSource };
  return {
    location_status: evaluation.withinGeofence ? 'verified' : 'outside_geofence',
    latitude,
    longitude,
    accuracy,
    coordinateSystem,
    locationSource,
    distance: evaluation.distanceMeters,
    radius: evaluation.radiusMeters,
    withinGeofence: evaluation.withinGeofence ? 1 : 0,
  };
}

function fieldDayResponse(fieldDay, media) {
  return {
    field_day: publicFieldDay(fieldDay),
    media: media ? publicFieldMedia(media, fieldDay.work_order_id) : null,
    location_status: fieldDay.location_status,
  };
}

function fieldWorkNow(env) {
  return new Date(env.FIELD_WORK_NOW || Date.now());
}

function fieldWorkError(code, status = 400) {
  return jsonResponse({ error: code, code }, status);
}

function publicFieldMedia(media, workOrderId) {
  if (!media) return media;
  const { object_key, ...safeMedia } = media;
  return {
    ...safeMedia,
    url: `/api/workorders/${workOrderId}/field-media/${media.id}`,
  };
}

function publicFieldDay(fieldDay, { customerView = false } = {}) {
  if (!fieldDay) return fieldDay;
  const safe = { ...fieldDay };
  if (safe.location_source === 'admin_override') safe.capture_source = 'admin_override';
  delete safe.check_in_idempotency_key;
  delete safe.report_idempotency_key;
  if (customerView) {
    delete safe.internal_note;
    delete safe.location_status;
    delete safe.latitude;
    delete safe.longitude;
    delete safe.accuracy_m;
    delete safe.coordinate_system;
    delete safe.location_source;
    delete safe.distance_m;
    delete safe.radius_m;
    delete safe.within_geofence;
    delete safe.admin_override_reason;
    delete safe.capture_source;
  }
  return safe;
}

function withoutPrivateFieldLocation(workOrder) {
  const safe = { ...workOrder };
  for (const field of [
    'service_latitude', 'service_longitude', 'service_accuracy_m', 'service_coordinate_system',
    'service_location_source', 'service_location_confirmed_at', 'arrival_distance_m', 'arrival_radius_m',
    'arrival_accuracy_m', 'arrival_latitude', 'arrival_longitude', 'arrival_coordinate_system',
    'arrival_location_source',
  ]) delete safe[field];
  return safe;
}

function fieldPlanSnapshot(workOrder) {
  return {
    site_timezone: workOrder?.site_timezone || null,
    expected_service_days: workOrder?.expected_service_days == null ? null : Number(workOrder.expected_service_days),
    expected_completion_date: workOrder?.expected_completion_date || null,
    planned_daily_start_time: workOrder?.planned_daily_start_time || null,
    planned_daily_end_time: workOrder?.planned_daily_end_time || null,
  };
}

function isValidFieldDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function validateExtensionRequest(input = {}, currentCompletionDate = null) {
  const reason = String(input.reason || '').trim();
  const customerExplanation = String(input.customer_explanation || '').trim();
  const requestedAdditionalDays = Number(input.requested_additional_days);
  const proposedCompletionDate = String(input.proposed_completion_date || '').trim();
  if (!reason || !customerExplanation) return { error: 'extension_request_incomplete' };
  if (!Number.isInteger(requestedAdditionalDays) || requestedAdditionalDays < 1 || requestedAdditionalDays > 365) {
    return { error: 'requested_additional_days_invalid' };
  }
  if (!isValidFieldDate(proposedCompletionDate)) return { error: 'proposed_completion_date_invalid' };
  if (isValidFieldDate(currentCompletionDate) && proposedCompletionDate <= currentCompletionDate) {
    return { error: 'proposed_completion_date_not_extended' };
  }
  return {
    value: {
      reason,
      customer_explanation: customerExplanation,
      requested_additional_days: requestedAdditionalDays,
      proposed_completion_date: proposedCompletionDate,
      internal_note: String(input.internal_note || '').trim() || null,
    },
  };
}

function extensionRequestStatement(env, { id, workOrder, engineerId, fieldDayId = null, value }) {
  return env.DB.prepare(`
    INSERT INTO work_order_extension_requests (
      id, work_order_id, field_day_id, engineer_id, reason, customer_explanation,
      internal_note, requested_additional_days, proposed_completion_date, original_plan
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM work_orders
      WHERE id = ? AND engineer_id = ? AND service_mode = 'onsite' AND status = 'in_service'
    )
  `).bind(
    id, workOrder.id, fieldDayId, engineerId, value.reason, value.customer_explanation,
    value.internal_note, value.requested_additional_days, value.proposed_completion_date,
    JSON.stringify(fieldPlanSnapshot(workOrder)), workOrder.id, engineerId,
  );
}

async function getFieldDayReportMedia(env, fieldDayId) {
  const records = await env.DB.prepare(`
    SELECT * FROM work_order_field_day_media
    WHERE field_day_id = ? AND purpose IN ('progress', 'internal') AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).bind(fieldDayId).all();
  return records.results || [];
}

function reportResponse(fieldDay, media, status = 200) {
  return jsonResponse({
    field_day: publicFieldDay(fieldDay),
    media: media.map((item) => publicFieldMedia(item, fieldDay.work_order_id)),
  }, status);
}

async function notifyFieldWorkBestEffort(env, payload) {
  try {
    const notifier = env.FIELD_WORK_NOTIFIER || createNotification;
    await notifier(env, payload);
  } catch (error) {
    console.warn('[field-work] notification failed:', error?.message || error);
  }
}

function scheduledNotificationStatement(env, { id, userId, userType, type, title, body, data }, claim = null) {
  if (claim) {
    return env.DB.prepare(`
      INSERT OR IGNORE INTO notifications (id, user_id, user_type, type, title, body, data)
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM work_order_field_days
        WHERE id = ? AND ${claim.column} = ?
      )
    `).bind(
      id, userId, userType, type, title, body, data ? JSON.stringify(data) : null,
      claim.fieldDayId, claim.timestamp,
    );
  }
  return env.DB.prepare(`
    INSERT OR IGNORE INTO notifications (id, user_id, user_type, type, title, body, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, userType, type, title, body, data ? JSON.stringify(data) : null);
}

async function pushScheduledNotification(env, notification) {
  try {
    const pusher = env.FIELD_WORK_PUSHER || sendPushToUser;
    await pusher(notification.userId, notification.userType, env, {
      title: notification.title,
      message: notification.body,
      data: { ...(notification.data || {}), notification_type: notification.type },
    });
  } catch (error) {
    console.warn('[field-work] scheduled push failed:', error?.message || error);
  }
}

function schedulerCopy(market) {
  if (market === 'cn') {
    return {
      reminderTitle: '现场日报提醒',
      reminderBody: (orderNo) => `工单 ${orderNo} 距预计签退时间还有 30 分钟，请及时完成当日现场日报。`,
      overdueTitle: '现场日报已逾期',
      overdueBody: (orderNo) => `工单 ${orderNo} 的现场工作日已结束，但日报尚未提交。`,
    };
  }
  return {
    reminderTitle: 'Field report reminder',
    reminderBody: (orderNo) => `${orderNo} is 30 minutes from expected checkout. Please complete today's field report.`,
    overdueTitle: 'Field report overdue',
    overdueBody: (orderNo) => `${orderNo} has a field day without a submitted daily report.`,
  };
}

async function claimCheckoutReminder(env, fieldDay, now, market) {
  if (!fieldDay.expected_check_out_at || fieldDay.checkout_reminder_sent_at) return;
  const expectedCheckout = siteLocalDateTimeToUtc(fieldDay.expected_check_out_at, fieldDay.site_timezone);
  const reminderAt = expectedCheckout.getTime() - (30 * 60 * 1000);
  if (now.getTime() < reminderAt || now.getTime() >= expectedCheckout.getTime()) return;

  const copy = schedulerCopy(market);
  const notification = {
    id: `field-checkout-reminder:${fieldDay.id}`,
    userId: fieldDay.engineer_id,
    userType: 'engineer',
    type: 'field_checkout_reminder',
    title: copy.reminderTitle,
    body: copy.reminderBody(fieldDay.order_no || fieldDay.work_order_id),
    data: { work_order_id: fieldDay.work_order_id, field_day_id: fieldDay.id },
  };
  const timestamp = now.toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE work_order_field_days
      SET checkout_reminder_sent_at = ?, updated_at = ?
      WHERE id = ? AND status = 'checked_in' AND checkout_reminder_sent_at IS NULL
    `).bind(timestamp, timestamp, fieldDay.id),
    scheduledNotificationStatement(env, notification, {
      column: 'checkout_reminder_sent_at', fieldDayId: fieldDay.id, timestamp,
    }),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) > 0) await pushScheduledNotification(env, notification);
}

async function claimOverdueFieldDay(env, fieldDay, now, market) {
  if (fieldDay.overdue_notification_sent_at) return;
  const currentLocalDate = fieldDayLocalDate(now, fieldDay.site_timezone);
  if (currentLocalDate <= fieldDay.site_local_date) return;

  const copy = schedulerCopy(market);
  const recipients = [{ userId: fieldDay.engineer_id, userType: 'engineer' }];
  const staffRecords = await env.DB.prepare(`
    SELECT id FROM admin_staff_accounts
    WHERE is_active = 1 AND role IN ('admin', 'operations') AND market_scope IN ('all', ?)
  `).bind(market).all();
  for (const staff of staffRecords.results || []) recipients.push({ userId: staff.id, userType: 'admin' });

  const notifications = recipients.map((recipient) => ({
    id: `field-report-overdue:${fieldDay.id}:${recipient.userType}:${recipient.userId}`,
    ...recipient,
    type: 'field_report_overdue',
    title: copy.overdueTitle,
    body: copy.overdueBody(fieldDay.order_no || fieldDay.work_order_id),
    data: { work_order_id: fieldDay.work_order_id, field_day_id: fieldDay.id },
  }));
  const timestamp = now.toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(`
      UPDATE work_order_field_days
      SET status = 'report_overdue', overdue_notification_sent_at = ?, updated_at = ?
      WHERE id = ? AND status = 'checked_in' AND overdue_notification_sent_at IS NULL
    `).bind(timestamp, timestamp, fieldDay.id),
    ...notifications.map((notification) => scheduledNotificationStatement(env, notification, {
      column: 'overdue_notification_sent_at', fieldDayId: fieldDay.id, timestamp,
    })),
  ]);
  if (Number(results?.[0]?.meta?.changes || 0) > 0) {
    await Promise.all(notifications.map((notification) => pushScheduledNotification(env, notification)));
  }
}

async function processFieldDayScheduler(env, now, market) {
  const cursorKey = `${FIELD_WORK_SCHEDULER_CURSOR_PREFIX}${market}`;
  let cursor = null;
  try {
    cursor = env.KV ? await env.KV.get(cursorKey) : null;
  } catch (error) {
    console.warn(`[field-work] scheduler cursor read failed for ${market}:`, error?.message || error);
  }
  const records = await env.DB.prepare(cursor ? `
    SELECT fd.*, wo.order_no
    FROM work_order_field_days fd
    JOIN work_orders wo ON wo.id = fd.work_order_id
    WHERE fd.status = 'checked_in'
      AND fd.id > ?
    ORDER BY fd.id ASC
    LIMIT ?
  ` : `
    SELECT fd.*, wo.order_no
    FROM work_order_field_days fd
    JOIN work_orders wo ON wo.id = fd.work_order_id
    WHERE fd.status = 'checked_in'
    ORDER BY fd.id ASC
    LIMIT ?
  `).bind(...(cursor ? [cursor, FIELD_WORK_SCHEDULER_BATCH_SIZE] : [FIELD_WORK_SCHEDULER_BATCH_SIZE])).all();
  let fieldDays = records.results || [];
  if (cursor && fieldDays.length < FIELD_WORK_SCHEDULER_BATCH_SIZE) {
    const wrapped = await env.DB.prepare(`
      SELECT fd.*, wo.order_no
      FROM work_order_field_days fd
      JOIN work_orders wo ON wo.id = fd.work_order_id
      WHERE fd.status = 'checked_in' AND fd.id <= ?
      ORDER BY fd.id ASC
      LIMIT ?
    `).bind(cursor, FIELD_WORK_SCHEDULER_BATCH_SIZE - fieldDays.length).all();
    fieldDays = [...fieldDays, ...(wrapped.results || [])];
  }
  for (const fieldDay of fieldDays) {
    try {
      const currentLocalDate = fieldDayLocalDate(now, fieldDay.site_timezone);
      if (currentLocalDate > fieldDay.site_local_date) {
        await claimOverdueFieldDay(env, fieldDay, now, market);
      } else {
        await claimCheckoutReminder(env, fieldDay, now, market);
      }
    } catch (error) {
      console.error(`[field-work] scheduler failed for field day ${fieldDay.id}:`, error?.message || error);
    }
  }
  if (env.KV) {
    try {
      if (fieldDays.length) await env.KV.put(cursorKey, fieldDays.at(-1).id);
      else await env.KV.delete(cursorKey);
    } catch (error) {
      console.warn(`[field-work] scheduler cursor write failed for ${market}:`, error?.message || error);
    }
  }
}

async function processFieldEvidenceRetention(env, now) {
  if (!env.FIELD_EVIDENCE) {
    console.warn('[field-work] FIELD_EVIDENCE binding missing; retention cleanup skipped');
    return;
  }
  const completedBefore = sqliteUtcTimestamp(subtractUtcMonths(now, 12));
  const staleClaimBefore = new Date(now.getTime() - FIELD_EVIDENCE_RETENTION_CLAIM_MS).toISOString();
  const records = await env.DB.prepare(`
    SELECT m.*, wo.status AS work_order_status, wo.completed_at
    FROM work_order_field_day_media m
    JOIN work_orders wo ON wo.id = m.work_order_id
    WHERE m.deleted_at IS NULL
      AND wo.status = 'completed'
      AND wo.completed_at <= ?
      AND (m.retention_claim_token IS NULL OR m.retention_claimed_at <= ?)
      AND NOT EXISTS (
        SELECT 1 FROM work_order_field_evidence_holds h
        WHERE h.work_order_id = m.work_order_id AND h.status = 'open'
      )
    ORDER BY wo.completed_at ASC, m.id ASC
    LIMIT ?
  `).bind(completedBefore, staleClaimBefore, FIELD_WORK_SCHEDULER_BATCH_SIZE).all();

  for (const media of records.results || []) {
    const claimToken = generateId();
    let objectDeleted = false;
    try {
      const claim = await env.DB.prepare(`
        UPDATE work_order_field_day_media
        SET retention_claim_token = ?, retention_claimed_at = ?
        WHERE id = ? AND deleted_at IS NULL
          AND (
            retention_claim_token IS NULL
            OR (retention_claim_token = ? AND retention_claimed_at <= ?)
          )
          AND NOT EXISTS (
            SELECT 1 FROM work_order_field_evidence_holds h
            WHERE h.work_order_id = work_order_field_day_media.work_order_id AND h.status = 'open'
          )
      `).bind(claimToken, now.toISOString(), media.id, media.retention_claim_token, staleClaimBefore).run();
      if (Number(claim?.meta?.changes || 0) !== 1) continue;
    } catch (error) {
      console.error(`[field-work] retention claim failed for media ${media.id}:`, error?.message || error);
      continue;
    }
    try {
      await env.FIELD_EVIDENCE.delete(media.object_key);
      objectDeleted = true;
    } catch (error) {
      try {
        objectDeleted = !(await env.FIELD_EVIDENCE.head(media.object_key));
      } catch (headError) {
        console.error(`[field-work] retention delete state unknown for media ${media.id}:`, headError?.message || headError);
        continue;
      }
      if (!objectDeleted) {
        await env.DB.prepare(`
          UPDATE work_order_field_day_media
          SET retention_claim_token = NULL, retention_claimed_at = NULL
          WHERE id = ? AND deleted_at IS NULL AND retention_claim_token = ?
        `).bind(media.id, claimToken).run().catch(() => {});
        console.error(`[field-work] retention delete failed for media ${media.id}:`, error?.message || error);
        continue;
      }
    }
    try {
      const marked = await env.DB.prepare(`
        UPDATE work_order_field_day_media
        SET deleted_at = ?, retention_claim_token = NULL, retention_claimed_at = NULL
        WHERE id = ? AND deleted_at IS NULL AND retention_claim_token = ?
      `).bind(now.toISOString(), media.id, claimToken).run();
      if (Number(marked?.meta?.changes || 0) !== 1) {
        throw new Error('Retention delete mark lost its claim');
      }
    } catch (error) {
      console.error(`[field-work] retention mark failed for media ${media.id}:`, error?.message || error);
    }
  }
}

async function processFieldEvidenceCleanupQueue(env) {
  if (!env.FIELD_EVIDENCE) return;
  const records = await env.DB.prepare(`
    SELECT object_key FROM field_evidence_cleanup_queue ORDER BY created_at ASC LIMIT ?
  `).bind(FIELD_WORK_SCHEDULER_BATCH_SIZE).all();
  for (const record of records.results || []) {
    try {
      await env.FIELD_EVIDENCE.delete(record.object_key);
      await env.DB.prepare(`DELETE FROM field_evidence_cleanup_queue WHERE object_key = ?`).bind(record.object_key).run();
    } catch (error) {
      console.error(`[field-work] cleanup queue delete failed for ${record.object_key}:`, error?.message || error);
    }
  }
}

async function cleanupFieldEvidenceObjects(env, objectKeys, failureReason) {
  for (const objectKey of objectKeys.filter(Boolean)) {
    try {
      await env.FIELD_EVIDENCE.delete(objectKey);
    } catch (error) {
      console.error(`[field-work] rollback delete failed for ${objectKey}:`, error?.message || error);
      try {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO field_evidence_cleanup_queue (object_key, failure_reason, updated_at)
          VALUES (?, ?, datetime('now'))
        `).bind(objectKey, failureReason).run();
      } catch (queueError) {
        console.error(`[field-work] cleanup queue write failed for ${objectKey}:`, queueError?.message || queueError);
      }
    }
  }
}

async function processFieldWorkDatabase(env, now, market) {
  try {
    await processFieldDayScheduler(env, now, market);
  } catch (error) {
    console.error(`[field-work] ${market} field-day scan failed:`, error?.message || error);
  }
  try {
    await processFieldEvidenceRetention(env, now);
  } catch (error) {
    console.error(`[field-work] ${market} retention scan failed:`, error?.message || error);
  }
  try {
    await processFieldEvidenceCleanupQueue(env);
  } catch (error) {
    console.error(`[field-work] ${market} cleanup queue scan failed:`, error?.message || error);
  }
}

async function processFieldWorkScheduled(env, scheduledTime) {
  const now = new Date(Number.isFinite(Number(scheduledTime)) ? Number(scheduledTime) : Date.now());
  const databases = [{ DB: env.DB, market: 'com' }];
  if (env.DB_CN && env.DB_CN !== env.DB) databases.push({ DB: env.DB_CN, market: 'cn' });
  for (const database of databases) {
    if (!database.DB) continue;
    try {
      await processFieldWorkDatabase({ ...env, DB: database.DB }, now, database.market);
    } catch (error) {
      console.error(`[field-work] scheduled ${database.market} database failed:`, error?.message || error);
    }
  }
}

async function notifyFieldExtensionRequested(env, request, workOrder, extensionId, value) {
  try {
    const market = getRequestMarket(request);
    const staffRecords = await env.DB.prepare(`
      SELECT id FROM admin_staff_accounts
      WHERE is_active = 1 AND role IN ('admin', 'operations') AND market_scope IN ('all', ?)
    `).bind(market).all();
    await Promise.all((staffRecords.results || []).map((staff) => notifyFieldWorkBestEffort(env, {
      user_id: staff.id,
      user_type: 'admin',
      type: 'extension_requested',
      title: market === 'cn' ? '现场延期申请待审批' : 'Field extension request pending',
      body: `${workOrder.order_no}: ${value.customer_explanation}`,
      data: { work_order_id: workOrder.id, extension_request_id: extensionId },
    })));
  } catch (error) {
    console.warn('[field-work] extension notification lookup failed:', error?.message || error);
  }
}

function isD1ConstraintError(error) {
  return /(?:unique\s+constraint|constraint\s+failed|sqlite_constraint)/i.test(String(error?.message || error || ''));
}

async function recoverConcurrentFieldDayCheckIn(env, { idempotencyKey, workOrderId, engineerId, siteLocalDate }) {
  let winner = null;
  if (idempotencyKey) {
    winner = await env.DB.prepare(`
      SELECT * FROM work_order_field_days WHERE check_in_idempotency_key = ?
    `).bind(idempotencyKey).first();
    if (winner && (winner.work_order_id !== workOrderId || winner.engineer_id !== engineerId)) {
      return { conflict: true };
    }
  }
  if (!winner) {
    winner = await env.DB.prepare(`
      SELECT * FROM work_order_field_days
      WHERE work_order_id = ? AND engineer_id = ? AND site_local_date = ?
    `).bind(workOrderId, engineerId, siteLocalDate).first();
  }
  if (!winner || winner.work_order_id !== workOrderId || winner.engineer_id !== engineerId) return null;
  const media = await env.DB.prepare(`
    SELECT * FROM work_order_field_day_media WHERE field_day_id = ? AND purpose = 'check_in' AND deleted_at IS NULL
  `).bind(winner.id).first();
  return { winner, media };
}

async function getFieldWorkOrder(env, workOrderId) {
  return env.DB.prepare(`
    SELECT id, order_no, customer_id, engineer_id, status, service_mode, site_timezone,
      expected_service_days, expected_completion_date, planned_daily_start_time, planned_daily_end_time,
      service_latitude, service_longitude, service_accuracy_m, service_coordinate_system, arrival_verified_at
    FROM work_orders WHERE id = ?
  `).bind(workOrderId).first();
}

function hasCompleteFieldPlan(workOrder) {
  return Boolean(
    workOrder?.site_timezone
    && Number.isInteger(Number(workOrder.expected_service_days)) && Number(workOrder.expected_service_days) > 0
    && workOrder.expected_completion_date
  );
}

async function handleFieldDayCheckIn(request, env) {
  let objectKey = null;
  try {
    const auth = request._auth;
    if (auth?.userType !== 'engineer') return errorResponse('仅工程师可以拍照签到', 403);
    if (!env.FIELD_EVIDENCE) return errorResponse('现场证据服务未配置', 503);

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    if (workOrder.engineer_id !== auth.userId) return errorResponse('您未被指派到此工单', 403);
    if (workOrder.service_mode !== 'onsite' || workOrder.status !== 'in_service') {
      return errorResponse('仅服务中的现场工单可以签到', 409);
    }
    if (!hasCompleteFieldPlan(workOrder)) return errorResponse('现场服务计划不完整', 409);

    const siteLocalDate = fieldDayLocalDate(fieldWorkNow(env), workOrder.site_timezone);
    const idempotencyKey = String(request.headers.get('Idempotency-Key') || '').trim().slice(0, 200) || null;
    if (idempotencyKey) {
      const existingByKey = await env.DB.prepare(`
        SELECT * FROM work_order_field_days WHERE check_in_idempotency_key = ?
      `).bind(idempotencyKey).first();
      if (existingByKey) {
        if (existingByKey.work_order_id !== workOrderId || existingByKey.engineer_id !== auth.userId) {
          return errorResponse('Idempotency-Key 已用于其他签到', 409);
        }
        const media = await env.DB.prepare(`
          SELECT * FROM work_order_field_day_media WHERE field_day_id = ? AND purpose = 'check_in' AND deleted_at IS NULL
        `).bind(existingByKey.id).first();
        return jsonResponse(fieldDayResponse(existingByKey, media));
      }
    }

    const existingFieldDay = await env.DB.prepare(`
      SELECT * FROM work_order_field_days
      WHERE work_order_id = ? AND engineer_id = ? AND site_local_date = ?
    `).bind(workOrderId, auth.userId, siteLocalDate).first();
    if (existingFieldDay) {
      const media = await env.DB.prepare(`
        SELECT * FROM work_order_field_day_media WHERE field_day_id = ? AND purpose = 'check_in' AND deleted_at IS NULL
      `).bind(existingFieldDay.id).first();
      return jsonResponse(fieldDayResponse(existingFieldDay, media));
    }

    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!photo || typeof photo === 'string' || !FIELD_EVIDENCE_MIME_TYPES.has(photo.type)) {
      return errorResponse('请上传 JPEG、PNG 或 WebP 格式的签到照片', 400);
    }
    if (!photo.size) return errorResponse('签到照片不能为空', 400);
    if (photo.size > FIELD_EVIDENCE_MAX_BYTES) return errorResponse('签到照片不能超过 10MB', 413);
    const photoBytes = new Uint8Array(await photo.arrayBuffer());
    if (!hasFieldEvidenceSignature(photoBytes, photo.type)) return errorResponse('签到照片文件签名无效', 400);

    const expectedCheckoutTime = String(
      formData.get('expected_checkout_time') || workOrder.planned_daily_end_time || ''
    ).trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(expectedCheckoutTime)) {
      return errorResponse('预计签退时间无效', 400);
    }
    const expectedCheckoutAt = `${siteLocalDate}T${expectedCheckoutTime}:00`;
    try {
      siteLocalDateTimeToUtc(expectedCheckoutAt, workOrder.site_timezone);
    } catch {
      return errorResponse('预计签退时间在现场时区不存在', 400);
    }

    const location = parseFieldDayLocation(formData.get('location') || {
      latitude: formData.get('latitude'),
      longitude: formData.get('longitude'),
      accuracy_m: formData.get('accuracy_m'),
      coordinate_system: formData.get('coordinate_system'),
      location_source: formData.get('location_source'),
    }, workOrder);
    const fieldDayId = generateId();
    const mediaId = generateId();
    const extension = FIELD_EVIDENCE_MIME_TYPES.get(photo.type);
    objectKey = `field-evidence/${getRequestMarket(request)}/${workOrderId}/${fieldDayId}/check-in.${extension}`;
    await env.FIELD_EVIDENCE.put(objectKey, photoBytes, { httpMetadata: { contentType: photo.type } });

    const fieldDay = {
      id: fieldDayId, work_order_id: workOrderId, engineer_id: auth.userId, site_local_date: siteLocalDate,
      site_timezone: workOrder.site_timezone, status: 'checked_in', expected_check_out_at: expectedCheckoutAt,
      location_status: location.location_status, latitude: location.latitude ?? null, longitude: location.longitude ?? null,
      accuracy_m: location.accuracy ?? null, coordinate_system: location.coordinateSystem ?? null,
      location_source: location.locationSource ?? null, distance_m: location.distance ?? null,
      radius_m: location.radius ?? null, within_geofence: location.withinGeofence ?? null,
      check_in_idempotency_key: idempotencyKey,
    };
    const media = {
      id: mediaId, work_order_id: workOrderId, field_day_id: fieldDayId, purpose: 'check_in', object_key: objectKey,
      mime_type: photo.type, file_size: photo.size, uploader_type: 'engineer', uploader_id: auth.userId,
      customer_visible: 1, capture_source: 'check_in',
    };
    if (typeof env.DB.batch !== 'function') {
      await cleanupFieldEvidenceObjects(env, [objectKey], 'check_in_persistence_failed');
      objectKey = null;
      return errorResponse('现场签到存储暂不可用', 503);
    }
    const persistenceStatements = [
      env.DB.prepare(`
        INSERT INTO work_order_field_days (
          id, work_order_id, engineer_id, site_local_date, site_timezone, expected_check_out_at,
          location_status, latitude, longitude, accuracy_m, coordinate_system, location_source,
          distance_m, radius_m, within_geofence, check_in_idempotency_key
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM work_orders
          WHERE id = ? AND engineer_id = ? AND service_mode = 'onsite' AND status = 'in_service'
        )
      `).bind(
        fieldDay.id, fieldDay.work_order_id, fieldDay.engineer_id, fieldDay.site_local_date, fieldDay.site_timezone,
        fieldDay.expected_check_out_at, fieldDay.location_status, fieldDay.latitude, fieldDay.longitude,
        fieldDay.accuracy_m, fieldDay.coordinate_system, fieldDay.location_source, fieldDay.distance_m,
        fieldDay.radius_m, fieldDay.within_geofence, fieldDay.check_in_idempotency_key,
        workOrderId, auth.userId,
      ),
      env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field check-in concurrent update') END`),
      env.DB.prepare(`
        INSERT INTO work_order_field_day_media (
          id, work_order_id, field_day_id, purpose, object_key, mime_type, file_size,
          uploader_type, uploader_id, customer_visible, capture_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        media.id, media.work_order_id, media.field_day_id, media.purpose, media.object_key, media.mime_type,
        media.file_size, media.uploader_type, media.uploader_id, media.customer_visible, media.capture_source,
      ),
    ];
    persistenceStatements.push(env.DB.prepare(`
      INSERT INTO work_order_arrival_checks (
        id, work_order_id, engineer_id, latitude, longitude, accuracy_m, coordinate_system,
        location_source, distance_m, radius_m, within_geofence, failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(), workOrderId, auth.userId, fieldDay.latitude, fieldDay.longitude,
      fieldDay.accuracy_m, fieldDay.coordinate_system, fieldDay.location_source || 'field_day_check_in',
      fieldDay.distance_m, fieldDay.radius_m, fieldDay.within_geofence,
      fieldDay.location_status === 'outside_geofence' ? 'outside_geofence' : fieldDay.location_status === 'unavailable' ? 'unavailable' : null,
    ));
    if (!workOrder.arrival_verified_at) {
      persistenceStatements.push(env.DB.prepare(`
          UPDATE work_orders SET arrival_verified_at = datetime('now') WHERE id = ? AND arrival_verified_at IS NULL
      `).bind(workOrderId));
    }
    persistenceStatements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order_field_day', targetId: fieldDayId, action: 'field_day_checked_in',
      afterState: { work_order_id: workOrderId, site_local_date: siteLocalDate, location_status: fieldDay.location_status },
    }));
    try {
      await env.DB.batch(persistenceStatements);
    } catch (error) {
      await cleanupFieldEvidenceObjects(env, [objectKey], 'check_in_persistence_failed');
      objectKey = null;
      if (/field check-in concurrent update|malformed json/i.test(String(error?.message || error))) {
        return errorResponse('工单状态已变更，无法完成现场签到', 409);
      }
      if (isD1ConstraintError(error)) {
        const recovered = await recoverConcurrentFieldDayCheckIn(env, {
          idempotencyKey, workOrderId, engineerId: auth.userId, siteLocalDate,
        });
        if (recovered?.conflict) return errorResponse('Idempotency-Key 已用于其他签到', 409);
        if (recovered) return jsonResponse(fieldDayResponse(recovered.winner, recovered.media));
      }
      throw error;
    }

    await createNotification(env, {
      user_id: workOrder.customer_id, user_type: 'customer', type: 'field_day_checked_in',
      title: 'Engineer checked in', body: `Engineer checked in for ${workOrder.order_no}.`,
      data: { work_order_id: workOrderId, field_day_id: fieldDayId },
    });
    return jsonResponse(fieldDayResponse(fieldDay, media), 201);
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleSubmitFieldDayReport(request, env) {
  const uploadedKeys = [];
  let persistenceCommitted = false;
  try {
    const auth = request._auth;
    if (auth?.userType !== 'engineer') return errorResponse('仅工程师可以提交现场日报', 403);
    if (!env.FIELD_EVIDENCE) return errorResponse('现场证据服务未配置', 503);
    const [, , , workOrderId, , fieldDayId] = new URL(request.url).pathname.split('/');
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    if (workOrder.engineer_id !== auth.userId) return errorResponse('您未被指派到此工单', 403);
    if (workOrder.service_mode !== 'onsite' || workOrder.status !== 'in_service') {
      return errorResponse('仅服务中的现场工单可以提交日报', 409);
    }
    const fieldDay = await env.DB.prepare(`
      SELECT * FROM work_order_field_days WHERE id = ? AND work_order_id = ?
    `).bind(fieldDayId, workOrderId).first();
    if (!fieldDay) return errorResponse('现场工作日不存在', 404);
    if (fieldDay.engineer_id !== auth.userId) return errorResponse('您无权提交此现场日报', 403);

    const idempotencyKey = String(request.headers.get('Idempotency-Key') || '').trim().slice(0, 200) || null;
    if (idempotencyKey) {
      const existing = await env.DB.prepare(`
        SELECT * FROM work_order_field_days WHERE report_idempotency_key = ?
      `).bind(idempotencyKey).first();
      if (existing) {
        if (existing.id !== fieldDayId || existing.work_order_id !== workOrderId || existing.engineer_id !== auth.userId) {
          return errorResponse('Idempotency-Key 已用于其他日报', 409);
        }
        return reportResponse(existing, await getFieldDayReportMedia(env, existing.id));
      }
    }
    if (['report_submitted', 'late_report_submitted'].includes(fieldDay.status)) {
      return reportResponse(fieldDay, await getFieldDayReportMedia(env, fieldDay.id));
    }
    if (!['checked_in', 'report_overdue'].includes(fieldDay.status)) return errorResponse('当前现场工作日不能提交日报', 409);

    const formData = await request.formData();
    const progressPhotos = formData.getAll('progress_photos');
    const internalPhotos = formData.getAll('internal_photos');
    const reportValidation = validateDailyReport({
      completed_work: formData.get('completed_work'),
      issues_risks: formData.get('issues_risks'),
      next_plan: formData.get('next_plan'),
      customer_support_needed: formData.get('customer_support_needed'),
      labor_hours: formData.get('labor_hours'),
      internal_note: formData.get('internal_note'),
      late_reason: formData.get('late_reason'),
      progress_media_count: progressPhotos.length,
    }, { overdue: fieldDay.status === 'report_overdue' });
    if (reportValidation.error) return fieldWorkError(reportValidation.error);

    const extensionFields = ['extension_reason', 'extension_customer_explanation', 'requested_additional_days', 'proposed_completion_date', 'extension_internal_note'];
    const hasExtension = extensionFields.some((name) => String(formData.get(name) || '').trim());
    let extensionValue = null;
    if (hasExtension) {
      const extensionValidation = validateExtensionRequest({
        reason: formData.get('extension_reason'),
        customer_explanation: formData.get('extension_customer_explanation'),
        requested_additional_days: formData.get('requested_additional_days'),
        proposed_completion_date: formData.get('proposed_completion_date'),
        internal_note: formData.get('extension_internal_note'),
      }, workOrder.expected_completion_date);
      if (extensionValidation.error) return fieldWorkError(extensionValidation.error);
      const pending = await env.DB.prepare(`
        SELECT * FROM work_order_extension_requests WHERE work_order_id = ? AND status = 'pending'
      `).bind(workOrderId).first();
      if (pending) return errorResponse('该工单已有待审批延期申请', 409);
      extensionValue = extensionValidation.value;
    }

    const allUploads = [
      ...progressPhotos.map((file) => ({ file, purpose: 'progress', customerVisible: 1 })),
      ...internalPhotos.map((file) => ({ file, purpose: 'internal', customerVisible: 0 })),
    ];
    const preparedUploads = [];
    for (const upload of allUploads) {
      const file = upload.file;
      if (!file || typeof file === 'string' || !FIELD_EVIDENCE_MIME_TYPES.has(file.type)) {
        return errorResponse('现场日报照片仅支持 JPEG、PNG 或 WebP', 400);
      }
      if (!file.size) return errorResponse('现场日报照片不能为空', 400);
      if (file.size > FIELD_EVIDENCE_MAX_BYTES) return errorResponse('现场日报照片不能超过 10MB', 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasFieldEvidenceSignature(bytes, file.type)) return errorResponse('现场日报照片文件签名无效', 400);
      preparedUploads.push({ ...upload, bytes });
    }

    const mediaRows = [];
    for (const upload of preparedUploads) {
      const file = upload.file;
      const mediaId = generateId();
      const extension = FIELD_EVIDENCE_MIME_TYPES.get(file.type);
      const objectKey = `field-evidence/${getRequestMarket(request)}/${workOrderId}/${fieldDayId}/${upload.purpose}/${mediaId}.${extension}`;
      await env.FIELD_EVIDENCE.put(objectKey, upload.bytes, { httpMetadata: { contentType: file.type } });
      uploadedKeys.push(objectKey);
      mediaRows.push({
        id: mediaId, work_order_id: workOrderId, field_day_id: fieldDayId, purpose: upload.purpose,
        object_key: objectKey, mime_type: file.type, file_size: file.size, uploader_type: 'engineer',
        uploader_id: auth.userId, customer_visible: upload.customerVisible, capture_source: 'daily_report',
      });
    }

    const nextStatus = fieldDay.status === 'report_overdue' ? 'late_report_submitted' : 'report_submitted';
    const value = reportValidation.value;
    const statements = [env.DB.prepare(`
      UPDATE work_order_field_days SET
        status = ?, labor_hours = ?, completed_work = ?, issues_risks = ?, next_plan = ?,
        customer_support_needed = ?, internal_note = ?, late_reason = ?, report_idempotency_key = ?,
        report_submitted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND work_order_id = ? AND status = ?
    `).bind(
      nextStatus, value.labor_hours, value.completed_work, value.issues_risks, value.next_plan,
      value.customer_support_needed, value.internal_note, value.late_reason, idempotencyKey, fieldDayId, workOrderId, fieldDay.status,
    ), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field report concurrent update') END
    `)];
    for (const media of mediaRows) {
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_field_day_media (
          id, work_order_id, field_day_id, purpose, object_key, mime_type, file_size,
          uploader_type, uploader_id, customer_visible, capture_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        media.id, media.work_order_id, media.field_day_id, media.purpose, media.object_key, media.mime_type,
        media.file_size, media.uploader_type, media.uploader_id, media.customer_visible, media.capture_source,
      ));
    }
    let extensionId = null;
    if (extensionValue) {
      extensionId = generateId();
      statements.push(extensionRequestStatement(env, {
        id: extensionId, workOrder, engineerId: auth.userId, fieldDayId, value: extensionValue,
      }));
      statements.push(env.DB.prepare(`
        SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field extension concurrent update') END
      `));
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
        VALUES (?, ?, 'extension_requested', 'engineer', ?, ?)
      `).bind(generateId(), workOrderId, auth.userId, extensionValue.customer_explanation));
    }
    statements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order_field_day', targetId: fieldDayId, action: 'field_day_report_submitted',
      beforeState: { status: fieldDay.status },
      afterState: { status: nextStatus, labor_hours: value.labor_hours, media_count: mediaRows.length, extension_request_id: extensionId },
    }));
    try {
      await env.DB.batch(statements);
    } catch (error) {
      await cleanupFieldEvidenceObjects(env, uploadedKeys, 'field_report_persistence_failed');
      uploadedKeys.length = 0;
      if (isD1ConstraintError(error) || /field report concurrent update|malformed json/i.test(String(error?.message || error))) {
        if (idempotencyKey) {
          const recovered = await env.DB.prepare(`SELECT * FROM work_order_field_days WHERE report_idempotency_key = ?`).bind(idempotencyKey).first();
          if (recovered?.id === fieldDayId && recovered.work_order_id === workOrderId) {
            return reportResponse(recovered, await getFieldDayReportMedia(env, recovered.id));
          }
        }
        return errorResponse('该工单已有待审批延期申请或日报已提交', 409);
      }
      throw error;
    }
    persistenceCommitted = true;
    uploadedKeys.length = 0;
    const savedFieldDay = { ...fieldDay, ...value, status: nextStatus, report_idempotency_key: idempotencyKey, report_submitted_at: new Date().toISOString() };
    await notifyFieldWorkBestEffort(env, {
      user_id: workOrder.customer_id, user_type: 'customer', type: 'field_day_report_submitted',
      title: 'Field work update', body: `A field work update was submitted for ${workOrder.order_no}.`,
      data: { work_order_id: workOrderId, field_day_id: fieldDayId },
    });
    if (extensionValue) {
      await notifyFieldExtensionRequested(env, request, workOrder, extensionId, extensionValue);
    }
    return reportResponse(savedFieldDay, mediaRows, 201);
  } catch (error) {
    if (!persistenceCommitted) {
      await cleanupFieldEvidenceObjects(env, uploadedKeys, 'field_report_request_failed');
    }
    return errorResponse(error.message, 500);
  }
}

async function handleCreateExtensionRequest(request, env) {
  try {
    const auth = request._auth;
    if (auth?.userType !== 'engineer') return errorResponse('仅工程师可以申请延期', 403);
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    if (workOrder.engineer_id !== auth.userId) return errorResponse('您未被指派到此工单', 403);
    if (workOrder.service_mode !== 'onsite' || workOrder.status !== 'in_service') return errorResponse('当前工单不能申请延期', 409);
    const validation = validateExtensionRequest(await request.json().catch(() => ({})), workOrder.expected_completion_date);
    if (validation.error) return fieldWorkError(validation.error);
    const pending = await env.DB.prepare(`
      SELECT * FROM work_order_extension_requests WHERE work_order_id = ? AND status = 'pending'
    `).bind(workOrderId).first();
    if (pending) return errorResponse('该工单已有待审批延期申请', 409);
    const extensionId = generateId();
    const value = validation.value;
    try {
      await env.DB.batch([
        extensionRequestStatement(env, { id: extensionId, workOrder, engineerId: auth.userId, value }),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field extension concurrent update') END`),
        env.DB.prepare(`
          INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
          VALUES (?, ?, 'extension_requested', 'engineer', ?, ?)
        `).bind(generateId(), workOrderId, auth.userId, value.customer_explanation),
        buildAuditLogStatement(env, request, {
          targetType: 'work_order_extension_request', targetId: extensionId, action: 'field_extension_requested',
          afterState: { work_order_id: workOrderId, requested_additional_days: value.requested_additional_days, proposed_completion_date: value.proposed_completion_date },
        }),
      ]);
    } catch (error) {
      if (/field extension concurrent update|malformed json/i.test(String(error?.message || error))) {
        return errorResponse('工单状态已变更，无法提交延期申请', 409);
      }
      if (isD1ConstraintError(error)) return errorResponse('该工单已有待审批延期申请', 409);
      throw error;
    }
    await notifyFieldExtensionRequested(env, request, workOrder, extensionId, value);
    return jsonResponse({ extension_request: { id: extensionId, work_order_id: workOrderId, engineer_id: auth.userId, status: 'pending', ...value } }, 201);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function hasHistoricalFieldDayAccess(env, auth, workOrderId) {
  if (auth?.userType !== 'engineer') return false;
  const fieldDay = await env.DB.prepare(`
    SELECT id FROM work_order_field_days WHERE work_order_id = ? AND engineer_id = ? LIMIT 1
  `).bind(workOrderId, auth.userId).first();
  return Boolean(fieldDay);
}

async function resolveFieldWorkAccessMode(env, auth, workOrder, workOrderId) {
  try {
    assertWorkOrderAccess(auth, workOrder);
  } catch (error) {
    if (!(error instanceof GuardError) || !await hasHistoricalFieldDayAccess(env, auth, workOrderId)) throw error;
    return 'historical_engineer';
  }
  if (auth?.userType === 'admin') return 'admin';
  if (auth?.userType === 'customer') return 'customer';
  if (auth?.userType !== 'engineer') return 'none';
  if (workOrder.engineer_id === auth.userId) return 'assigned_engineer';
  if (await hasHistoricalFieldDayAccess(env, auth, workOrderId)) return 'historical_engineer';
  return 'none';
}

async function handleGetFieldDays(request, env) {
  try {
    const auth = request._auth;
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    const fieldWorkAccessMode = await resolveFieldWorkAccessMode(env, auth, workOrder, workOrderId);
    if (fieldWorkAccessMode === 'none') return errorResponse('您无权访问现场作业记录', 403);
    const historicalEngineerView = fieldWorkAccessMode === 'historical_engineer';

    const fieldDayRecords = await env.DB.prepare(`
      SELECT * FROM work_order_field_days WHERE work_order_id = ? ORDER BY site_local_date DESC
    `).bind(workOrderId).all();
    const customerView = fieldWorkAccessMode === 'customer';
    const visibleFieldDayRecords = historicalEngineerView
      ? (fieldDayRecords.results || []).filter((fieldDay) => fieldDay.engineer_id === auth.userId)
      : (fieldDayRecords.results || []);
    const visibleFieldDayIds = new Set(visibleFieldDayRecords.map((fieldDay) => fieldDay.id));
    const fieldDays = visibleFieldDayRecords.map((fieldDay) => publicFieldDay(fieldDay, { customerView }));
    const mediaRecords = await env.DB.prepare(customerView ? `
      SELECT * FROM work_order_field_day_media
      WHERE work_order_id = ? AND customer_visible = 1 AND deleted_at IS NULL ORDER BY created_at ASC
    ` : `
      SELECT * FROM work_order_field_day_media
      WHERE work_order_id = ? AND deleted_at IS NULL ORDER BY created_at ASC
    `).bind(workOrderId).all();
    return jsonResponse({
      field_days: fieldDays,
      media: (mediaRecords.results || [])
        .filter((media) => !historicalEngineerView || visibleFieldDayIds.has(media.field_day_id))
        .map((media) => publicFieldMedia(media, workOrderId)),
    });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleGetFieldMedia(request, env) {
  try {
    const auth = request._auth;
    const [, , , workOrderId, , mediaId] = new URL(request.url).pathname.split('/');
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    const fieldWorkAccessMode = await resolveFieldWorkAccessMode(env, auth, workOrder, workOrderId);
    if (fieldWorkAccessMode === 'none') return errorResponse('您无权查看此现场证据', 403);
    const historicalEngineerView = fieldWorkAccessMode === 'historical_engineer';
    const media = await env.DB.prepare(`
      SELECT * FROM work_order_field_day_media WHERE id = ? AND work_order_id = ? AND deleted_at IS NULL
    `).bind(mediaId, workOrderId).first();
    if (!media) return errorResponse('现场证据不存在', 404);
    if (fieldWorkAccessMode === 'customer' && !media.customer_visible) return errorResponse('您无权查看此现场证据', 403);
    if (historicalEngineerView) {
      const fieldDay = await env.DB.prepare(`
        SELECT * FROM work_order_field_days WHERE id = ? AND work_order_id = ?
      `).bind(media.field_day_id, workOrderId).first();
      if (!fieldDay || fieldDay.engineer_id !== auth.userId) return errorResponse('您无权查看此现场证据', 403);
    }
    if (!env.FIELD_EVIDENCE) return errorResponse('现场证据服务未配置', 503);
    const object = await env.FIELD_EVIDENCE.get(media.object_key);
    if (!object) return errorResponse('现场证据文件不存在', 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': media.mime_type,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

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
const WORK_ORDER_PAYOUT_STATUSES = new Set(['not_ready', 'pending', 'processing', 'completed', 'exception']);
const ENGINEER_PAYOUT_METHODS = new Set(['paypal', 'bank_swift']);

function sanitizePayoutForUser(payout, auth) {
  if (!payout) return null;
  if (auth?.userType === 'admin') return payout;
  const { internal_note, ...safePayout } = payout;
  return safePayout;
}

async function ensureWorkOrderPayout(env, workOrderId, engineerId, status = 'pending') {
  if (!workOrderId || !engineerId) return null;

  const existing = await env.DB.prepare(
    'SELECT * FROM work_order_payouts WHERE work_order_id = ?'
  ).bind(workOrderId).first();
  if (existing) return existing;

  const engineer = await env.DB.prepare(
    'SELECT payout_method FROM engineers WHERE id = ?'
  ).bind(engineerId).first();

  const payout = {
    id: generateId(),
    work_order_id: workOrderId,
    engineer_id: engineerId,
    amount: 0,
    currency: 'USD',
    method: ENGINEER_PAYOUT_METHODS.has(engineer?.payout_method) ? engineer.payout_method : 'paypal',
    status: WORK_ORDER_PAYOUT_STATUSES.has(status) ? status : 'pending',
  };

  await env.DB.prepare(`
    INSERT INTO work_order_payouts (id, work_order_id, engineer_id, amount, currency, method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payout.id,
    payout.work_order_id,
    payout.engineer_id,
    payout.amount,
    payout.currency,
    payout.method,
    payout.status
  ).run();

  return env.DB.prepare('SELECT * FROM work_order_payouts WHERE id = ?').bind(payout.id).first();
}

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

    // 正式口径：客户评价只完成服务闭环；工程师服务款由 Admin 在逐单记录中人工确认。
    // 旧钱包结算函数保留用于历史兼容，但不再由新工单流程自动调用。
    const payout = await ensureWorkOrderPayout(env, work_order_id, engineer_id, 'pending');

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

    return jsonResponse({ success: true, payout });
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
    const { work_order_id, reason } = await request.json();
    const rejectReason = typeof reason === 'string' ? reason.trim() : '';

    // 认证：engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse('仅工程师可退回派工', 403);
    }
    const engineer_id = auth.userId;

    if (!work_order_id) {
      return errorResponse('缺少工单 ID');
    }
    if (!rejectReason) {
      return errorResponse('请填写退回理由');
    }
    try {
      assertMaxLength(rejectReason, '退回理由', LIMITS.log_content);
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
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

    await env.DB.prepare(`
      INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible)
      VALUES (?, ?, 'engineer', ?, '工程师', ?, 'internal_note', 1, 0)
    `).bind(generateId(), work_order_id, engineer_id, `退回派工理由：${rejectReason}`).run();

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
      'SELECT id, name, phone, specialties, brands, services, service_region, bio, status, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, created_at, level, credit_score, total_orders, complex_orders, success_orders, payout_method, paypal_account, bank_country, bank_name, bank_account, bank_swift_code, account_holder, payout_notes FROM engineers WHERE id = ?'
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
    const { name, bio, service_region, bank_name, bank_account, bank_branch, account_holder, payout_method, paypal_account, bank_country, bank_swift_code, payout_notes } = body;

    try {
      assertFieldLimits(body, {
        name: LIMITS.name,
        bio: LIMITS.bio,
        service_region: LIMITS.service_region,
        bank_name: { max: 50 },
        bank_account: { max: 30 },
        bank_branch: { max: 100 },
        account_holder: { max: 20 },
        payout_method: { max: 20 },
        paypal_account: { max: 120 },
        bank_country: { max: 80 },
        bank_swift_code: { max: 20 },
        payout_notes: { max: 500 },
      });
    } catch (e) {
      const resp = validationErrorToResponse(e, errorResponse);
      if (resp) return resp;
      throw e;
    }

    const updates = [];
    const values = [];
    if (payout_method !== undefined && !ENGINEER_PAYOUT_METHODS.has(payout_method)) {
      return errorResponse('Unsupported payout method', 400);
    }
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
    if (service_region !== undefined) { updates.push('service_region = ?'); values.push(service_region); }
    if (payout_method !== undefined) { updates.push('payout_method = ?'); values.push(payout_method); }
    if (paypal_account !== undefined) { updates.push('paypal_account = ?'); values.push(paypal_account); }
    if (bank_country !== undefined) { updates.push('bank_country = ?'); values.push(bank_country); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); values.push(bank_name); }
    if (bank_account !== undefined) { updates.push('bank_account = ?'); values.push(bank_account); }
    if (bank_branch !== undefined) { updates.push('bank_branch = ?'); values.push(bank_branch); }
    if (bank_swift_code !== undefined) { updates.push('bank_swift_code = ?'); values.push(bank_swift_code); }
    if (account_holder !== undefined) { updates.push('account_holder = ?'); values.push(account_holder); }
    if (payout_notes !== undefined) { updates.push('payout_notes = ?'); values.push(payout_notes); }

    if (updates.length === 0) return errorResponse('没有要更新的字段');

    values.push(engineerId);
    await env.DB.prepare(`UPDATE engineers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare(
      'SELECT id, user_no, name, phone, specialties, brands, services, service_region, bio, status, level, commission_rate, credit_score, rating_timeliness, rating_technical, rating_communication, rating_professional, rating_count, payout_method, paypal_account, bank_country, bank_name, bank_account, bank_branch, bank_swift_code, account_holder, payout_notes FROM engineers WHERE id = ?'
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
    if (isPasswordTooShort(newPassword)) return passwordTooShortResponse(request);

    if (auth.userType === 'admin') {
      if (!auth.staffId) return errorResponse('超级管理员密码由环境变量管理', 403);
      const staff = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(auth.staffId).first();
      if (!staff?.is_active) return errorResponse('员工账号不存在或已停用', 404);
      const ok = await verifyPassword(oldPassword, staff.password_hash, staff.salt);
      if (!ok) return errorResponse('旧密码错误');
      const newSalt = generateSalt();
      const newHash = await hashPasswordNew(newPassword, newSalt);
      const mutation = env.DB.prepare(`
        UPDATE admin_staff_accounts
        SET password_hash = ?, salt = ?, must_change_password = 0, updated_at = datetime('now')
        WHERE id = ?
      `).bind(newHash, newSalt, auth.staffId);
      await runAuditedWorkflowBatch(env, request, guardedWorkflowMutation(env, mutation), {
        targetType: 'admin_staff_account',
        targetId: auth.staffId,
        action: 'staff_password_changed',
        beforeState: { must_change_password: Boolean(staff.must_change_password) },
        afterState: { must_change_password: false },
      });
      return jsonResponse({ success: true, mustChangePassword: false });
    }

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

// ============ 商机线索 API ============

async function insertMachineLead(env, {
  name,
  email = null,
  phone = null,
  source = 'machine_selection_ai',
  sourceType = 'machine_purchase_ai',
  interest = 'Whole machine purchase',
  message,
  conversationId = null,
  aiSummary = '',
  recommendedNextStep = 'Admin should route this whole-machine lead for sales follow-up and keep engineer support available for technical selection.',
  customerId = null,
  workOrderId = null,
  region = '',
}) {
  const id = generateId();
  const lead = normalizeMachineLead({
    id,
    name: cleanText(name, 120) || 'Machine prospect',
    email: cleanText(email, 160) || null,
    phone: cleanText(phone, 60) || null,
    source,
    interest: cleanText(interest, 240) || 'Whole machine purchase',
    message: cleanText(message, 3000) || null,
    conversation_id: conversationId || null,
    source_type: sourceType,
    ai_summary: cleanText(aiSummary, 1000) || cleanText(message, 1000),
    recommended_next_step: recommendedNextStep,
    assignment_status: 'unassigned',
    customer_id: customerId || null,
    work_order_id: workOrderId || null,
    region: cleanText(region, 120),
  });

  await env.DB.prepare(`
    INSERT INTO leads (
      id, name, email, phone, source, interest, message, conversation_id,
      source_type, ai_summary, recommended_next_step, assignment_status,
      customer_id, work_order_id, region
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lead.id,
    lead.name,
    lead.email,
    lead.phone,
    lead.source,
    lead.interest,
    lead.message,
    lead.conversation_id,
    lead.source_type,
    lead.ai_summary,
    lead.recommended_next_step,
    lead.assignment_status,
    lead.customer_id,
    lead.work_order_id,
    lead.region
  ).run();

  return lead;
}

function normalizeEquipmentNeeds(input) {
  const items = Array.isArray(input) ? input : [];
  return items.slice(0, 8).map((item) => ({
    type: cleanText(item?.type, 120),
    quantity: cleanText(item?.quantity, 20) || '1',
    specification: cleanText(item?.specification, 160),
    note: cleanText(item?.note, 300),
  })).filter((item) => item.type || item.specification || item.note);
}

function formatEquipmentNeedLine(item, index) {
  const label = item.type || 'Complete machine';
  const quantity = item.quantity ? ` x${item.quantity}` : '';
  const specification = item.specification ? ` - ${item.specification}` : '';
  const note = item.note ? ` (${item.note})` : '';
  return `${index + 1}. ${label}${quantity}${specification}${note}`;
}

function formatEquipmentNeedsSummary(items) {
  return items.map((item) => {
    const label = item.type || 'Complete machine';
    const quantity = item.quantity ? ` x${item.quantity}` : '';
    const specification = item.specification ? ` (${item.specification})` : '';
    return `${label}${quantity}${specification}`;
  }).join('; ');
}

async function maybeCreateMachineLeadFromChat({ env, message, conversationId, customerId }) {
  if (!hasWholeMachineLeadIntent(message)) return null;

  try {
    const existing = conversationId
      ? await env.DB.prepare(
        "SELECT id FROM leads WHERE conversation_id = ? AND source = 'machine_selection_ai' LIMIT 1"
      ).bind(conversationId).first()
      : null;
    if (existing) return null;

    const customer = customerId
      ? await env.DB.prepare('SELECT name, phone, region FROM customers WHERE id = ?').bind(customerId).first()
      : null;

    return await insertMachineLead(env, {
      name: customer?.name || 'AI machine prospect',
      phone: customer?.phone || null,
      source: 'machine_selection_ai',
      sourceType: 'machine_purchase_ai',
      interest: 'Whole machine purchase',
      message,
      conversationId,
      customerId,
      region: customer?.region || '',
      recommendedNextStep: 'Admin should route this whole-machine opportunity for sales follow-up and coordinate engineer support for technical selection if needed.',
    });
  } catch (error) {
    console.warn('[lead] failed to create machine lead from chat:', error?.message || error);
    return null;
  }
}

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

    if (!hasWholeMachineLeadIntent(`${interest || ''}\n${message || ''}`)) {
      return errorResponse('Lead Inbox 仅接收整机/新机设备商机；配件、耗材、升级改造请走工程师增值服务流程', 400);
    }

    const lead = await insertMachineLead(env, {
      name,
      email,
      phone,
      source: source || 'machine_selection_ai',
      sourceType: 'machine_purchase_ai',
      interest: interest || 'Whole machine purchase',
      message,
      conversationId: conversation_id || null,
    });

    return jsonResponse({ success: true, lead_id: lead.id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleCreateMachineLead(request, env) {
  try {
    if (request._auth?.userType !== 'engineer') {
      return errorResponse('需要工程师权限', 403);
    }

    const body = await request.json().catch(() => ({}));
    const workOrderId = cleanText(body.work_order_id, 80);
    const machineType = cleanText(body.machine_type, 160);
    const customerIntent = cleanText(body.customer_intent || body.message || body.description, 3000);
    const equipmentNeeds = normalizeEquipmentNeeds(body.equipment_needs);
    const equipmentNeedsForLead = equipmentNeeds.length > 0
      ? equipmentNeeds
      : (machineType ? [{ type: machineType, quantity: '1', specification: '', note: '' }] : []);
    const equipmentSummary = formatEquipmentNeedsSummary(equipmentNeedsForLead);
    const equipmentBlock = equipmentNeedsForLead.length > 0
      ? `Equipment needs:\n${equipmentNeedsForLead.map(formatEquipmentNeedLine).join('\n')}`
      : '';
    const leadMessage = [equipmentBlock, `Customer purchase intent:\n${customerIntent}`].filter(Boolean).join('\n\n');
    if (!customerIntent) return errorResponse('请填写客户整机需求说明', 400);
    if (!hasWholeMachineLeadIntent(`${equipmentSummary}\n${machineType}\n${customerIntent}\n整机 采购`)) {
      return errorResponse('Lead 仅用于整机/新机设备需求；配件、耗材、升级改造请提交增值服务或物料请求', 400);
    }

    let customerId = cleanText(body.customer_id, 80) || null;
    if (workOrderId) {
      const workOrder = await getWorkOrderForMaterialAccess(env, workOrderId);
      assertWorkOrderAccess(request._auth, workOrder);
      customerId = workOrder.customer_id || customerId;
    }

    const lead = await insertMachineLead(env, {
      name: cleanText(body.contact_name, 120) || 'Engineer submitted machine prospect',
      phone: cleanText(body.contact_phone, 60) || null,
      email: cleanText(body.contact_email, 160) || null,
      source: 'engineer_machine_opportunity',
      sourceType: 'machine_purchase_engineer',
      interest: equipmentSummary ? `Whole machine purchase: ${equipmentSummary}` : 'Whole machine purchase',
      message: leadMessage,
      aiSummary: `Engineer submitted whole-machine opportunity with ${equipmentNeedsForLead.length || 1} equipment needs: ${equipmentSummary || customerIntent}`,
      recommendedNextStep: 'Admin should route this whole-machine lead for sales follow-up and keep the submitting engineer available for technical selection and site context.',
      customerId,
      workOrderId: workOrderId || null,
      region: cleanText(body.region, 120),
    });

    await writeAuditLog(env, request, {
      targetType: 'lead',
      targetId: lead.id,
      action: 'machine_lead_created_by_engineer',
      afterState: lead,
    });

    return jsonResponse({ success: true, lead }, 201);
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// ============ 工程师招募申请与排单日历 ============

const ENGINEER_APPLICATION_STATUSES = new Set([
  'submitted',
  'reviewing',
  'qualified',
  'rejected',
  'archived',
]);

const ENGINEER_CALENDAR_EVENT_TYPES = new Set([
  'engineer_available',
  'engineer_unavailable',
  'reserved_for_service',
]);

const MATERIAL_STATUSES = new Set(['active', 'inactive', 'pending']);
const MATERIAL_CATEGORIES = new Set([
  'laser_cutting',
  'bending',
  'welding',
  'general_electrical',
  'gas_system',
  'consumables',
  'other',
]);
const MATERIAL_ADJUSTMENT_TYPES = new Set([
  'manual_in',
  'manual_out',
  'correction',
  'reservation_release',
]);
const WORK_ORDER_MATERIAL_PURPOSES = new Set([
  'quote',
  'preparation',
  'service_report',
  'recommended_spare',
]);
const WORK_ORDER_MATERIAL_STATUSES = new Set(['active', 'removed']);
const MATERIAL_REQUEST_STATUSES = new Set([
  'submitted',
  'needs_info',
  'approved',
  'rejected',
  'linked_existing',
]);
const MATERIAL_REQUEST_URGENCIES = new Set(['normal', 'urgent', 'critical']);
const UPSELL_CATEGORIES = new Set([
  'parts_consumables',
  'laser_peripheral',
  'post_processing',
  'automation_retrofit',
  'bending_tooling',
  'other_retrofit',
]);
const UPSELL_STATUSES = new Set([
  'pending_assignment',
  'sales_following',
  'quoted',
  'won',
  'lost',
  'delivery_support',
  'completed',
]);
const UPSELL_TIMELINES = new Set(['immediate', 'within_1_month', 'within_3_months', 'unclear']);
const UPSELL_BUDGET_SIGNALS = new Set(['has_budget', 'comparing_quotes', 'unknown']);
const UPSELL_QUOTE_STATUSES = new Set(['not_started', 'in_progress', 'quoted']);
const UPSELL_DEAL_RESULTS = new Set(['undecided', 'won', 'lost']);
const KNOWLEDGE_STATUSES = new Set(['draft', 'published', 'archived']);
const KNOWLEDGE_CATEGORIES = new Set([
  'fault',
  'cutting_parameters',
  'parts',
  'maintenance',
  'machine_selection',
  'health',
  'safety',
  'other',
]);

function cleanText(value, maxLength = 300) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

function cleanChoice(value, allowed, fallback) {
  const text = cleanText(value, 80);
  return allowed.has(text) ? text : fallback;
}

function hasWholeMachineLeadIntent(text) {
  const value = cleanText(text, 5000).toLowerCase();
  if (!value) return false;

  const serviceOrPartsOnly =
    /(配件|备件|易损件|耗材|喷嘴|保护镜|镜片|陶瓷环|传感器|电缆|维修|保养|改造|升级|外设|除尘|冷水机|气体|parts?|spares?|consumables?|nozzles?|lenses?|protective lens|ceramic ring|repair|maintenance|retrofit|upgrade|peripherals?|chiller|dust collector)/i;
  const wholeMachine =
    /(整机|新机|新设备|整线|机床|激光切割机|光纤激光切割机|折弯机|数控折弯|剪板机|laser cutting machine|fiber laser|laser cutter|press brake|bending machine|sheet metal machine|complete machine|new machine|equipment line|euchio)/i;
  const purchaseIntent =
    /(买|购买|采购|订购|询价|报价|价格|预算|销售|业务员|buy|purchase|order|quote|quotation|price|pricing|budget|sales|supplier)/i;

  return wholeMachine.test(value) && purchaseIntent.test(value) && !serviceOrPartsOnly.test(value);
}

function normalizeMachineLead(row) {
  if (!row) return row;
  return {
    ...row,
    source: row.source || 'machine_selection_ai',
    source_type: row.source_type || 'machine_purchase_ai',
    assignment_status: row.assignment_status || 'unassigned',
    region: row.region || '',
    customer_id: row.customer_id || null,
    work_order_id: row.work_order_id || null,
  };
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toSafeInteger(value, fallback = 0) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function toPositiveQuantity(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function cleanTextArray(value, maxItems = 12, maxItemLength = 80) {
  let raw = Array.isArray(value) ? value : [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      raw = Array.isArray(parsed) ? parsed : value.split(/[,，\n]/);
    } catch {
      raw = value.split(/[,，\n]/);
    }
  }
  return raw
    .map((item) => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function jsonArrayField(value) {
  return JSON.stringify(cleanTextArray(value));
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEngineerApplication(row) {
  if (!row) return row;
  const activationStatus = row.engineer_auth_status === 'authenticated'
    ? 'activated'
    : row.converted_user_id
      && !row.activation_revoked_at
      && row.activation_expires_at
      && new Date(row.activation_expires_at).getTime() > Date.now()
      ? 'awaiting_activation'
      : row.converted_user_id
        ? 'activation_expired'
        : 'not_opened';
  return {
    ...row,
    service_regions: parseJsonArray(row.service_regions),
    equipment_types: parseJsonArray(row.equipment_types),
    brand_experience: parseJsonArray(row.brand_experience),
    skill_tags: parseJsonArray(row.skill_tags),
    languages: parseJsonArray(row.languages),
    can_travel: Boolean(row.can_travel),
    can_weekend: Boolean(row.can_weekend),
    can_night: Boolean(row.can_night),
    has_tools: Boolean(row.has_tools),
    account: {
      engineer_id: row.converted_user_id || null,
      engineer_no: row.engineer_no || null,
      activation_status: activationStatus,
      sent_at: row.activation_sent_at || null,
      expires_at: row.activation_expires_at || null,
      send_status: row.activation_send_status || null,
    },
  };
}

function normalizeMaterial(row) {
  if (!row) return row;
  return {
    ...row,
    reference_cost: Number(row.reference_cost || 0),
    reference_price: Number(row.reference_price || 0),
    stock_quantity: Number(row.stock_quantity || 0),
    safety_stock: Number(row.safety_stock || 0),
  };
}

function normalizePublicMaterial(row) {
  if (!row) return row;
  return {
    id: row.id,
    material_code: row.material_code,
    category: row.category,
    name: row.name,
    name_en: row.name_en,
    spec: row.spec,
    brand: row.brand,
    compatible_equipment: row.compatible_equipment,
    unit: row.unit || 'pcs',
    reference_price: Number(row.reference_price || 0),
    status: row.status,
  };
}

function normalizeWorkOrderMaterialItem(row) {
  if (!row) return row;
  return {
    id: row.id,
    work_order_id: row.work_order_id,
    material_id: row.material_id,
    purpose: row.purpose || 'quote',
    material_code: row.material_code,
    name: row.name,
    name_en: row.name_en,
    spec: row.spec,
    brand: row.brand,
    unit: row.unit || 'pcs',
    quantity: Number(row.quantity || 0),
    unit_price: Number(row.unit_price || 0),
    line_total: Number(row.line_total || 0),
    note: row.note,
    status: row.status || 'active',
    created_by_type: row.created_by_type,
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeMaterialRequest(row) {
  if (!row) return row;
  return {
    ...row,
    expected_quantity: Number(row.expected_quantity || 0),
    attachment_urls: parseJsonArray(row.attachment_urls),
  };
}

function normalizeUpsellRequest(row) {
  if (!row) return row;
  return {
    ...row,
    work_order_id: row.work_order_id || null,
    customer_id: row.customer_id || null,
    site_context: row.site_context || '',
    contact_name: row.contact_name || '',
    contact_phone: row.contact_phone || '',
    assigned_sales_owner: row.assigned_sales_owner || '',
    admin_note: row.admin_note || '',
    handover_note: row.handover_note || '',
  };
}

function normalizeWorkOrderMessage(row) {
  if (!row) return row;
  return {
    ...row,
    content: redactContactInfoForWorkOrder(row.content),
    attachment_urls: parseJsonArray(row.attachment_urls),
    is_internal_note: Number(row.is_internal_note || 0),
    is_customer_visible: Number(row.is_customer_visible ?? 1),
  };
}

function normalizeKnowledgeArticle(row) {
  if (!row) return row;
  return {
    ...row,
    version: Number(row.version || 1),
  };
}

function readKnowledgePayload(body = {}, { existing } = {}) {
  const category = cleanChoice(body.category ?? existing?.category, KNOWLEDGE_CATEGORIES, '');
  const status = cleanChoice(body.status ?? existing?.status, KNOWLEDGE_STATUSES, existing?.status || 'draft');
  const title = cleanText(body.title ?? existing?.title, 240);
  const content = cleanText(body.content ?? existing?.content, 12000);
  const market = cleanText(body.market ?? existing?.market, 20);
  const locale = cleanText(body.locale ?? existing?.locale, 20);

  if (!category) return { error: '请选择有效知识分类' };
  if (!title) return { error: '请填写知识标题' };
  if (!content) return { error: '请填写知识内容' };

  return {
    market,
    locale,
    category,
    title,
    content,
    source: cleanText(body.source ?? existing?.source, 1000) || null,
    applicable_equipment: cleanText(body.applicable_equipment ?? existing?.applicable_equipment, 300) || null,
    applicable_brand: cleanText(body.applicable_brand ?? existing?.applicable_brand, 200) || null,
    applicable_model: cleanText(body.applicable_model ?? existing?.applicable_model, 200) || null,
    risk_level: cleanText(body.risk_level ?? existing?.risk_level, 40) || null,
    status,
  };
}

function readWorkOrderMaterialItemPayload(body = {}) {
  const purpose = cleanText(body.purpose || 'quote', 40) || 'quote';
  const quantity = Math.max(0, toSafeNumber(body.quantity, 1));
  const unitPrice = Math.max(0, toSafeNumber(body.unit_price, 0));
  const status = cleanText(body.status || 'active', 40) || 'active';

  if (!WORK_ORDER_MATERIAL_PURPOSES.has(purpose)) return { error: '无效物料用途' };
  if (!WORK_ORDER_MATERIAL_STATUSES.has(status)) return { error: '无效物料状态' };
  if (!quantity) return { error: '物料数量必须大于 0' };

  return {
    material_id: cleanText(body.material_id, 80) || null,
    purpose,
    quantity,
    unit_price: unitPrice,
    line_total: Math.round(quantity * unitPrice * 100) / 100,
    note: cleanText(body.note, 600) || null,
    status,
  };
}

function readMaterialRequestPayload(body = {}) {
  const suggestedName = cleanText(body.suggested_name, 160);
  const category = cleanText(body.category || 'other', 60) || 'other';
  const urgency = cleanText(body.urgency || 'normal', 40) || 'normal';
  const expectedQuantity = Math.max(0, toSafeNumber(body.expected_quantity, 1));

  if (!suggestedName) return { error: '请填写建议物料名称' };
  if (!MATERIAL_CATEGORIES.has(category)) return { error: '无效物料类别' };
  if (!MATERIAL_REQUEST_URGENCIES.has(urgency)) return { error: '无效紧急程度' };
  if (!expectedQuantity) return { error: '预计数量必须大于 0' };

  return {
    work_order_id: cleanText(body.work_order_id, 80) || null,
    suggested_name: suggestedName,
    suggested_name_en: cleanText(body.suggested_name_en, 160) || null,
    category,
    spec: cleanText(body.spec, 240) || null,
    brand: cleanText(body.brand, 120) || null,
    compatible_equipment: cleanText(body.compatible_equipment, 300) || null,
    supplier_suggestion: cleanText(body.supplier_suggestion, 160) || null,
    expected_quantity: expectedQuantity,
    unit: cleanText(body.unit || 'pcs', 40) || 'pcs',
    usage_note: cleanText(body.usage_note, 1200) || null,
    urgency,
    attachment_urls: JSON.stringify(cleanTextArray(body.attachment_urls, 8, 500)),
  };
}

function readUpsellRequestPayload(body = {}) {
  const sourceType = body.source_type === 'work_order' ? 'work_order' : 'engineer_workspace';
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 3000);

  if (!title || !description) return { error: '请填写增购与改造需求标题和描述' };

  return {
    source_type: sourceType,
    work_order_id: cleanText(body.work_order_id, 80) || null,
    category: cleanChoice(body.category, UPSELL_CATEGORIES, 'other_retrofit'),
    title,
    description,
    site_context: cleanText(body.site_context, 3000),
    expected_timeline: cleanChoice(body.expected_timeline, UPSELL_TIMELINES, 'unclear'),
    budget_signal: cleanChoice(body.budget_signal, UPSELL_BUDGET_SIGNALS, 'unknown'),
    contact_name: cleanText(body.contact_name, 80),
    contact_phone: cleanText(body.contact_phone, 40),
  };
}

function readMaterialPayload(body = {}, { existing } = {}) {
  const materialCode = cleanText(body.material_code ?? existing?.material_code, 80);
  const name = cleanText(body.name ?? existing?.name, 160);
  const category = cleanText(body.category ?? existing?.category ?? 'other', 60) || 'other';
  const status = cleanText(body.status ?? existing?.status ?? 'active', 40) || 'active';

  if (!materialCode) return { error: '请填写物料编码' };
  if (!name) return { error: '请填写物料名称' };
  if (!MATERIAL_CATEGORIES.has(category)) return { error: '无效物料类别' };
  if (!MATERIAL_STATUSES.has(status)) return { error: '无效物料状态' };

  return {
    material_code: materialCode,
    category,
    name,
    name_en: cleanText(body.name_en ?? existing?.name_en, 160) || null,
    spec: cleanText(body.spec ?? existing?.spec, 240) || null,
    brand: cleanText(body.brand ?? existing?.brand, 120) || null,
    compatible_equipment: cleanText(body.compatible_equipment ?? existing?.compatible_equipment, 300) || null,
    supplier: cleanText(body.supplier ?? existing?.supplier, 160) || null,
    production_code: cleanText(body.production_code ?? existing?.production_code, 160) || null,
    unit: cleanText(body.unit ?? existing?.unit ?? 'pcs', 40) || 'pcs',
    reference_cost: toSafeNumber(body.reference_cost ?? existing?.reference_cost, 0),
    reference_price: toSafeNumber(body.reference_price ?? existing?.reference_price, 0),
    stock_quantity: toSafeInteger(body.stock_quantity ?? existing?.stock_quantity, 0),
    safety_stock: toSafeInteger(body.safety_stock ?? existing?.safety_stock, 0),
    status,
    notes: cleanText(body.notes ?? existing?.notes, 1200) || null,
  };
}

async function handleSubmitEngineerApplication(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name, 80);
    const phone = cleanText(body.phone, 40);
    const email = normalizeEmail(cleanText(body.email, 120));
    const whatsapp = cleanText(body.whatsapp, 80);

    if (!name || !phone || !email) {
      return errorResponse(getRequestMarket(request) === 'cn'
        ? '姓名、联系电话和邮箱为必填项'
        : 'Name, phone, and email are required.');
    }
    if (!isValidEmail(email)) return localizedErrorResponse('invalid_email', request);

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO engineer_applications (
        id, market, status, name, phone, email, whatsapp, country, province, city, base_region,
        service_regions, years_experience, equipment_types, brand_experience, skill_tags,
        languages, can_travel, can_weekend, can_night, has_tools, experience_summary
      ) VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      getRequestMarket(request),
      name,
      phone,
      email,
      whatsapp || null,
      cleanText(body.country, 80) || null,
      cleanText(body.province, 80) || null,
      cleanText(body.city, 80) || null,
      cleanText(body.base_region, 120) || null,
      jsonArrayField(body.service_regions),
      cleanText(body.years_experience, 40) || null,
      jsonArrayField(body.equipment_types),
      jsonArrayField(body.brand_experience),
      jsonArrayField(body.skill_tags),
      jsonArrayField(body.languages),
      body.can_travel ? 1 : 0,
      body.can_weekend ? 1 : 0,
      body.can_night ? 1 : 0,
      body.has_tools ? 1 : 0,
      cleanText(body.experience_summary, 1200) || null
    ).run();

    return jsonResponse({ success: true, application_id: id });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminEngineerApplications(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const status = url.searchParams.get('status') || '';
    const market = url.searchParams.get('market') || '';

    let where = 'WHERE 1=1';
    const binds = [];
    if (status && status !== 'all') {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (market && market !== 'all') {
      where += ' AND market = ?';
      binds.push(market);
    }

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM engineer_applications ${where}`
    ).bind(...binds).first();
    const list = await env.DB.prepare(`
      SELECT a.*,
             e.user_no AS engineer_no,
             e.auth_status AS engineer_auth_status,
             activation.expires_at AS activation_expires_at,
             activation.sent_at AS activation_sent_at,
             activation.send_status AS activation_send_status,
             activation.revoked_at AS activation_revoked_at
      FROM engineer_applications a
      LEFT JOIN engineers e ON e.id = a.converted_user_id
      LEFT JOIN engineer_account_activations activation
        ON activation.id = (
          SELECT candidate.id
          FROM engineer_account_activations candidate
          WHERE candidate.engineer_id = e.id
            AND candidate.revoked_at IS NULL
          ORDER BY candidate.created_at DESC
          LIMIT 1
        )
      ${where.replace(/\bstatus\b/g, 'a.status').replace(/\bmarket\b/g, 'a.market')}
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(normalizeEngineerApplication),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

function engineerAccountResponse(row, emailSent) {
  const normalized = normalizeEngineerApplication(row);
  return {
    engineer_id: normalized.account.engineer_id,
    engineer_no: normalized.account.engineer_no,
    activation_status: normalized.account.activation_status,
    email_sent: emailSent ?? normalized.account.send_status === 'sent',
    expires_at: normalized.account.expires_at,
  };
}

async function persistActivationSendResult(env, activationId, result) {
  const sent = Boolean(result?.sent);
  await env.DB.prepare(`
    UPDATE engineer_account_activations
    SET sent_at = ${sent ? "datetime('now')" : 'NULL'},
        send_status = '${sent ? 'sent' : 'failed'}',
        send_error = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(sent ? null : 'provider_error', activationId).run();
  return sent;
}

async function sendActivationForEngineer(env, engineer, activation) {
  const activationUrl = buildEngineerActivationUrl(engineer.market, activation.token);
  const message = buildEngineerActivationEmail({
    market: engineer.market,
    name: engineer.name,
    engineerNo: engineer.engineer_no,
    activationUrl,
  });
  const result = await sendEngineerActivationEmail(env, {
    to: engineer.email,
    ...message,
  }, engineer.market);
  return persistActivationSendResult(env, activation.id, result);
}

async function loadEngineerApplicationAccount(env, applicationId) {
  return env.DB.prepare(`
    SELECT a.*,
           e.user_no AS engineer_no,
           e.name AS engineer_name,
           e.email AS engineer_email,
           e.phone AS engineer_phone,
           e.auth_status AS engineer_auth_status,
           activation.expires_at AS activation_expires_at,
           activation.sent_at AS activation_sent_at,
           activation.send_status AS activation_send_status,
           activation.revoked_at AS activation_revoked_at
    FROM engineer_applications a
    LEFT JOIN engineers e ON e.id = a.converted_user_id
    LEFT JOIN engineer_account_activations activation
      ON activation.id = (
        SELECT candidate.id
        FROM engineer_account_activations candidate
        WHERE candidate.engineer_id = e.id
          AND candidate.revoked_at IS NULL
        ORDER BY candidate.created_at DESC
        LIMIT 1
      )
    WHERE a.id = ?
  `).bind(applicationId).first();
}

async function handleAdminOpenEngineerAccount(request, env) {
  try {
    const applicationId = new URL(request.url).pathname.split('/')[4];
    const application = await loadEngineerApplicationAccount(env, applicationId);
    if (!application) return errorResponse('申请不存在', 404);
    if (application.converted_user_id) {
      return jsonResponse({ account: engineerAccountResponse(application) });
    }
    if (application.status !== 'qualified') {
      return errorResponse('仅审核通过的申请可以开通账号', 409);
    }

    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name ?? application.name, 80);
    const email = normalizeIdentityEmail(body.email ?? application.email);
    const phone = cleanText(body.phone ?? application.phone, 40);
    const normalizedPhone = normalizeIdentityPhone(phone);
    if (!name || !email || !phone || !isValidEmail(email)) {
      return errorResponse('姓名、邮箱和手机号必须有效');
    }

    const [identityConflict, existingCustomerPhone, existingEngineerPhone, existingCustomerEmail, existingEngineerEmail] = await Promise.all([
      findAccountIdentityConflict(env, email, normalizedPhone),
      env.DB.prepare(`
        SELECT id FROM customers
        WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
      `).bind(normalizedPhone).first(),
      env.DB.prepare(`
        SELECT id FROM engineers
        WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
      `).bind(normalizedPhone).first(),
      env.DB.prepare('SELECT id FROM customers WHERE lower(trim(email)) = ?').bind(email).first(),
      env.DB.prepare('SELECT id FROM engineers WHERE lower(trim(email)) = ?').bind(email).first(),
    ]);
    if (identityConflict) return accountIdentityConflictResponse(identityConflict.identity_type, request);
    if (existingCustomerEmail || existingEngineerEmail) return accountIdentityConflictResponse('email', request);
    if (existingCustomerPhone || existingEngineerPhone) return accountIdentityConflictResponse('phone', request);

    const engineerId = generateId();
    const engineerNo = await generateUserNo(env, 'E');
    const activationId = generateId();
    const activationToken = createEngineerActivationToken();
    const activationHash = await hashEngineerActivationToken(activationToken);
    const expiresAt = activationExpiresAt();
    const salt = generateSalt();
    const unusablePassword = createEngineerActivationToken();
    const passwordHash = await hashPasswordNew(unusablePassword, salt);
    const engineerRole = body.engineer_role === 'regional_lead' ? 'regional_lead' : 'engineer';
    const services = cleanTextArray(body.services ?? application.skill_tags);
    const specialties = cleanTextArray(body.specialties ?? application.equipment_types);
    const brands = cleanTextArray(body.brands ?? application.brand_experience);
    const responsibleRegion = cleanText(body.responsible_region ?? application.base_region, 200) || null;
    const serviceRegion = cleanTextArray(body.service_regions ?? application.service_regions).join(', ') || responsibleRegion;

    const engineerInsert = env.DB.prepare(`
      INSERT INTO engineers (
        id, user_no, name, phone, email, password_hash, salt, specialties, brands, services,
        service_region, bio, status, engineer_role, regional_lead_id, cooperation_status,
        certification_status, capability_tags, brand_coverage, workload_status,
        responsible_region, team_name, first_login_password_reset_required, auth_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_activation')
    `).bind(
      engineerId,
      engineerNo,
      name,
      phone,
      email,
      passwordHash,
      salt,
      JSON.stringify(specialties),
      JSON.stringify(brands),
      JSON.stringify(services),
      serviceRegion,
      cleanText(body.bio ?? application.experience_summary, 1200) || null,
      'pending_approval',
      engineerRole,
      engineerRole === 'regional_lead' ? null : cleanText(body.regional_lead_id, 80) || null,
      cleanText(body.cooperation_status, 40) || 'confirmed',
      cleanText(body.certification_status, 40) || 'pending',
      JSON.stringify(cleanTextArray(body.capability_tags ?? services)),
      JSON.stringify(brands),
      cleanText(body.workload_status, 40) || 'available',
      responsibleRegion,
      cleanText(body.team_name, 120) || null,
    );
    const activationInsert = env.DB.prepare(`
      INSERT INTO engineer_account_activations (
        id, engineer_id, token_hash, expires_at, created_by, send_status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `).bind(activationId, engineerId, activationHash, expiresAt, request._auth?.userId || 'admin');
    const applicationUpdate = env.DB.prepare(`
      UPDATE engineer_applications
      SET converted_user_id = ?, reviewed_by = ?,
          reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now')
      WHERE id = ? AND status = 'qualified' AND converted_user_id IS NULL
    `).bind(engineerId, request._auth?.userId || 'admin', applicationId);
    const applicationGuard = env.DB.prepare(`
      INSERT INTO account_identities (identity_type, normalized_value, owner_type, owner_id)
      SELECT NULL AS application_account_guard_failed, ?, 'engineer', ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM engineer_applications
        WHERE id = ? AND status = 'qualified' AND converted_user_id = ?
      )
    `).bind(applicationId, engineerId, applicationId, engineerId);

    try {
      await env.DB.batch([
        applicationUpdate,
        applicationGuard,
        ...identityInsertStatements(env, { ownerType: 'engineer', ownerId: engineerId, email, phone }),
        engineerInsert,
        activationInsert,
        buildAuditLogStatement(env, request, {
          targetType: 'engineer', targetId: engineerId, action: 'engineer_account_created',
          afterState: { application_id: applicationId, auth_status: 'pending_activation' },
        }),
        buildAuditLogStatement(env, request, {
          targetType: 'engineer_application', targetId: applicationId, action: 'engineer_application_account_linked',
          afterState: { engineer_id: engineerId },
        }),
      ]);
    } catch (error) {
      if (/NOT NULL constraint failed:\s*account_identities\.identity_type/i.test(String(error?.message || error))) {
        return errorResponse('申请状态已变化或账号已由其他请求开通，请刷新后重试', 409);
      }
      const conflictResponse = await recoverAccountIdentityConflict(error, env, email, normalizedPhone, request);
      if (conflictResponse) return conflictResponse;
      throw error;
    }

    const emailSent = await sendActivationForEngineer(env, {
      market: application.market || getRequestMarket(request),
      name,
      email,
      engineer_no: engineerNo,
    }, { id: activationId, token: activationToken });
    return jsonResponse({
      account: {
        engineer_id: engineerId,
        engineer_no: engineerNo,
        activation_status: 'awaiting_activation',
        email_sent: emailSent,
        expires_at: expiresAt,
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminResendEngineerActivation(request, env) {
  try {
    const applicationId = new URL(request.url).pathname.split('/')[4];
    const application = await loadEngineerApplicationAccount(env, applicationId);
    if (!application) return errorResponse('申请不存在', 404);
    if (!application.converted_user_id) return errorResponse('工程师账号尚未开通', 409);
    if (application.engineer_auth_status !== 'pending_activation') {
      return errorResponse('仅待激活的工程师账号可以重新发送激活邮件', 409);
    }

    const rateLimitKey = `engineer_activation_resend_${application.converted_user_id}`;
    if (await env.KV.get(rateLimitKey)) return errorResponse('请稍后再重新发送', 429);
    await env.KV.put(rateLimitKey, '1', { expirationTtl: 60 });

    const activationId = generateId();
    const activationToken = createEngineerActivationToken();
    const activationHash = await hashEngineerActivationToken(activationToken);
    const expiresAt = activationExpiresAt();
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE engineer_account_activations
        SET revoked_at = datetime('now'), updated_at = datetime('now')
        WHERE engineer_id = ? AND used_at IS NULL AND revoked_at IS NULL
      `).bind(application.converted_user_id),
      env.DB.prepare(`
        INSERT INTO engineer_account_activations (
          id, engineer_id, token_hash, expires_at, created_by, send_status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `).bind(activationId, application.converted_user_id, activationHash, expiresAt, request._auth?.userId || 'admin'),
      buildAuditLogStatement(env, request, {
        targetType: 'engineer', targetId: application.converted_user_id, action: 'engineer_activation_resent',
        afterState: { application_id: applicationId, expires_at: expiresAt },
      }),
    ]);

    const emailSent = await sendActivationForEngineer(env, {
      market: application.market || getRequestMarket(request),
      name: application.engineer_name || application.name,
      email: application.engineer_email || application.email,
      engineer_no: application.engineer_no,
    }, { id: activationId, token: activationToken });
    return jsonResponse({ account: {
      engineer_id: application.converted_user_id,
      engineer_no: application.engineer_no,
      activation_status: 'awaiting_activation',
      email_sent: emailSent,
      expires_at: expiresAt,
    } });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminUpdateEngineerApplication(request, env) {
  try {
    const applicationId = new URL(request.url).pathname.split('/')[4];
    const body = await request.json().catch(() => ({}));
    const status = cleanText(body.status, 40);
    if (!applicationId) return errorResponse('缺少申请 ID');
    if (!ENGINEER_APPLICATION_STATUSES.has(status)) return errorResponse('无效申请状态');

    const result = await env.DB.prepare(`
      UPDATE engineer_applications
      SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      status,
      cleanText(body.review_notes, 1200) || null,
      request._auth?.userId || 'admin',
      applicationId
    ).run();

    if (result.meta?.changes === 0) return errorResponse('申请不存在', 404);
    await writeAuditLog(env, request, {
      targetType: 'engineer_application',
      targetId: applicationId,
      action: 'engineer_application_reviewed',
      afterState: { status },
    });
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminMaterials(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const category = cleanText(url.searchParams.get('category'), 60);
    const status = cleanText(url.searchParams.get('status'), 40);
    const search = cleanText(url.searchParams.get('search'), 120);
    const market = cleanText(url.searchParams.get('market'), 20) || getRequestMarket(request);

    let where = 'WHERE market = ?';
    const binds = [market];
    if (category && category !== 'all') {
      where += ' AND category = ?';
      binds.push(category);
    }
    if (status && status !== 'all') {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (search) {
      where += ` AND (
        instr(lower(COALESCE(material_code, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(name, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(name_en, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(spec, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(brand, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(supplier, '')), lower(?)) > 0
      )`;
      binds.push(search, search, search, search, search, search);
    }

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM materials ${where}`
    ).bind(...binds).first();
    const list = await env.DB.prepare(
      `SELECT * FROM materials ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(normalizeMaterial),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminKnowledge(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const category = cleanText(url.searchParams.get('category'), 80);
    const status = cleanText(url.searchParams.get('status'), 40);
    const search = cleanText(url.searchParams.get('search'), 160);
    const market = cleanText(url.searchParams.get('market'), 20) || getRequestMarket(request);
    const locale = cleanText(url.searchParams.get('locale'), 20);

    let where = 'WHERE market = ?';
    const binds = [market];
    if (locale && locale !== 'all') {
      where += ' AND locale = ?';
      binds.push(locale);
    }
    if (category && category !== 'all') {
      where += ' AND category = ?';
      binds.push(category);
    }
    if (status && status !== 'all') {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (search) {
      where += ` AND (
        instr(lower(COALESCE(title, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(content, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(applicable_equipment, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(applicable_brand, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(applicable_model, '')), lower(?)) > 0
      )`;
      binds.push(search, search, search, search, search);
    }

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM knowledge_articles ${where}`
    ).bind(...binds).first();
    const list = await env.DB.prepare(
      `SELECT * FROM knowledge_articles ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(normalizeKnowledgeArticle),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminCreateKnowledge(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = readKnowledgePayload(body);
    if (payload.error) return errorResponse(payload.error, 400);

    const id = generateId();
    const market = payload.market || getRequestMarket(request);
    const locale = payload.locale || (market === 'cn' ? 'zh-CN' : 'en');
    await env.DB.prepare(`
      INSERT INTO knowledge_articles (
        id, market, locale, category, title, content, source,
        applicable_equipment, applicable_brand, applicable_model, risk_level, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      market,
      locale,
      payload.category,
      payload.title,
      payload.content,
      payload.source,
      payload.applicable_equipment,
      payload.applicable_brand,
      payload.applicable_model,
      payload.risk_level,
      payload.status
    ).run();

    const article = await env.DB.prepare('SELECT * FROM knowledge_articles WHERE id = ?').bind(id).first();
    await writeAuditLog(env, request, {
      targetType: 'knowledge_article',
      targetId: id,
      action: 'knowledge_article_created',
      afterState: normalizeKnowledgeArticle(article || { id, market, locale, version: 1, ...payload }),
    });

    return jsonResponse({
      success: true,
      article: normalizeKnowledgeArticle(article || { id, market, locale, version: 1, ...payload }),
    }, 201);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminUpdateKnowledge(request, env) {
  try {
    const articleId = new URL(request.url).pathname.split('/')[4];
    if (!articleId) return errorResponse('缺少知识条目 ID', 400);

    const existing = await env.DB.prepare('SELECT * FROM knowledge_articles WHERE id = ?').bind(articleId).first();
    if (!existing) return errorResponse('知识条目不存在', 404);

    const body = await request.json().catch(() => ({}));
    const payload = readKnowledgePayload(body, { existing });
    if (payload.error) return errorResponse(payload.error, 400);
    const reviewerId = payload.status === 'published' ? (request._auth?.userId || 'admin') : null;

    const result = await env.DB.prepare(`
      UPDATE knowledge_articles SET
        market = ?, locale = ?, category = ?, title = ?, content = ?, source = ?,
        applicable_equipment = ?, applicable_brand = ?, applicable_model = ?, risk_level = ?,
        status = ?, reviewed_by = ?, reviewed_at = CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END,
        version = version + 1, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      payload.market || existing.market || getRequestMarket(request),
      payload.locale || existing.locale || 'en',
      payload.category,
      payload.title,
      payload.content,
      payload.source,
      payload.applicable_equipment,
      payload.applicable_brand,
      payload.applicable_model,
      payload.risk_level,
      payload.status,
      reviewerId,
      payload.status,
      articleId
    ).run();

    if (result.meta?.changes === 0) return errorResponse('知识条目不存在', 404);
    const article = await env.DB.prepare('SELECT * FROM knowledge_articles WHERE id = ?').bind(articleId).first();
    await writeAuditLog(env, request, {
      targetType: 'knowledge_article',
      targetId: articleId,
      action: 'knowledge_article_updated',
      beforeState: normalizeKnowledgeArticle(existing),
      afterState: normalizeKnowledgeArticle(article || { ...existing, ...payload, reviewed_by: reviewerId }),
    });

    return jsonResponse({
      success: true,
      article: normalizeKnowledgeArticle(article || { ...existing, ...payload, reviewed_by: reviewerId }),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminCreateMaterial(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = readMaterialPayload(body);
    if (payload.error) return errorResponse(payload.error, 400);

    const id = generateId();
    const market = cleanText(body.market, 20) || getRequestMarket(request);
    await env.DB.prepare(`
      INSERT INTO materials (
        id, market, material_code, category, name, name_en, spec, brand,
        compatible_equipment, supplier, production_code, unit, reference_cost,
        reference_price, stock_quantity, safety_stock, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      market,
      payload.material_code,
      payload.category,
      payload.name,
      payload.name_en,
      payload.spec,
      payload.brand,
      payload.compatible_equipment,
      payload.supplier,
      payload.production_code,
      payload.unit,
      payload.reference_cost,
      payload.reference_price,
      payload.stock_quantity,
      payload.safety_stock,
      payload.status,
      payload.notes
    ).run();

    const material = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first();
    await writeAuditLog(env, request, {
      targetType: 'material',
      targetId: id,
      action: 'material_created',
      afterState: normalizeMaterial(material || { id, market, ...payload }),
    });

    return jsonResponse({ success: true, material: normalizeMaterial(material || { id, market, ...payload }) }, 201);
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message || ''))) {
      return errorResponse('物料编码已存在', 409);
    }
    return errorResponse(error.message, 500);
  }
}

async function handleAdminUpdateMaterial(request, env) {
  try {
    const materialId = new URL(request.url).pathname.split('/')[4];
    if (!materialId) return errorResponse('缺少物料 ID', 400);

    const existing = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first();
    if (!existing) return errorResponse('物料不存在', 404);

    const body = await request.json().catch(() => ({}));
    const payload = readMaterialPayload(body, { existing });
    if (payload.error) return errorResponse(payload.error, 400);

    const result = await env.DB.prepare(`
      UPDATE materials SET
        material_code = ?, category = ?, name = ?, name_en = ?, spec = ?, brand = ?,
        compatible_equipment = ?, supplier = ?, production_code = ?, unit = ?,
        reference_cost = ?, reference_price = ?, safety_stock = ?, status = ?,
        notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      payload.material_code,
      payload.category,
      payload.name,
      payload.name_en,
      payload.spec,
      payload.brand,
      payload.compatible_equipment,
      payload.supplier,
      payload.production_code,
      payload.unit,
      payload.reference_cost,
      payload.reference_price,
      payload.safety_stock,
      payload.status,
      payload.notes,
      materialId
    ).run();

    if (result.meta?.changes === 0) return errorResponse('物料不存在', 404);
    const updated = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first();
    await writeAuditLog(env, request, {
      targetType: 'material',
      targetId: materialId,
      action: 'material_updated',
      beforeState: normalizeMaterial(existing),
      afterState: normalizeMaterial(updated || { ...existing, ...payload }),
    });

    return jsonResponse({ success: true, material: normalizeMaterial(updated || { ...existing, ...payload }) });
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message || ''))) {
      return errorResponse('物料编码已存在', 409);
    }
    return errorResponse(error.message, 500);
  }
}

async function handleAdminMaterialInventoryAdjustment(request, env) {
  try {
    const materialId = new URL(request.url).pathname.split('/')[4];
    if (!materialId) return errorResponse('缺少物料 ID', 400);

    const material = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first();
    if (!material) return errorResponse('物料不存在', 404);

    const body = await request.json().catch(() => ({}));
    const changeType = cleanText(body.change_type, 60) || 'correction';
    const delta = toSafeInteger(body.delta, 0);
    const reason = cleanText(body.reason, 600);
    if (!MATERIAL_ADJUSTMENT_TYPES.has(changeType)) return errorResponse('无效库存调整类型', 400);
    if (!delta) return errorResponse('库存调整数量不能为 0', 400);

    const beforeQuantity = Number(material.stock_quantity || 0);
    const beforeReserved = Number(material.reserved_quantity || 0);
    const afterQuantity = beforeQuantity + delta;
    if (afterQuantity < 0) return errorResponse('库存不能调整为负数', 400);
    if (afterQuantity < beforeReserved) return errorResponse('库存调整不能占用已预留库存', 409);

    const adjustmentId = generateId();
    const stockMutation = env.DB.prepare(`
      UPDATE materials
      SET stock_quantity = stock_quantity + ?, updated_at = datetime('now')
      WHERE id = ? AND stock_quantity = ? AND reserved_quantity = ?
        AND stock_quantity + ? >= reserved_quantity
    `).bind(delta, materialId, beforeQuantity, beforeReserved, delta);
    const adjustment = env.DB.prepare(`
      INSERT INTO material_inventory_adjustments (
        id, material_id, change_type, delta, before_quantity, after_quantity, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      adjustmentId,
      materialId,
      changeType,
      delta,
      beforeQuantity,
      afterQuantity,
      reason || null,
      request._auth?.userId || 'admin'
    );
    await runAuditedWorkflowBatch(env, request, [
      ...guardedWorkflowMutation(env, stockMutation),
      adjustment,
    ], {
      targetType: 'material',
      targetId: materialId,
      action: 'material_inventory_adjusted',
      beforeState: { stock_quantity: beforeQuantity, reserved_quantity: beforeReserved },
      afterState: {
        stock_quantity: afterQuantity,
        reserved_quantity: beforeReserved,
        delta,
        change_type: changeType,
        reason,
      },
    });

    const updated = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first();

    return jsonResponse({
      success: true,
      adjustment_id: adjustmentId,
      material: normalizeMaterial(updated || { ...material, stock_quantity: afterQuantity }),
    });
  } catch (error) {
    if (isWorkflowConcurrencyError(error)) return workflowErrorResponse(error);
    return errorResponse(error.message, 500);
  }
}

const STAFF_ROLES = new Set(['admin', 'operations', 'warehouse', 'procurement']);
const STAFF_MARKETS = new Set(['all', 'com', 'cn']);
const REQUISITION_URGENCIES = new Set(['normal', 'urgent', 'critical']);
const REQUISITION_TERMINAL_STATUSES = new Set(['rejected', 'cancelled', 'closed']);
const REQUISITION_ITEM_CONCURRENCY_COLUMNS = [
  'requested_quantity',
  'stock_allocated_quantity',
  'procurement_ordered_quantity',
  'procurement_received_quantity',
  'issued_quantity',
  'stock_issued_quantity',
  'returned_quantity',
  'engineer_received_quantity',
  'status',
];

function workflowMutationGuardStatement(env) {
  return env.DB.prepare(`
    SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('material requisition concurrent update') END
  `);
}

function guardedWorkflowMutation(env, statement) {
  return [statement, workflowMutationGuardStatement(env)];
}

async function runAuditedWorkflowBatch(env, request, statements, auditData) {
  if (typeof env.DB.batch !== 'function') throw new Error('Transactional D1 batch is required');
  return env.DB.batch([...statements, buildAuditLogStatement(env, request, auditData)]);
}

function isWorkflowConcurrencyError(error) {
  return /material requisition concurrent update|malformed json/i.test(String(error?.message || error));
}

function workflowErrorResponse(error, fallbackStatus = 500) {
  if (isWorkflowConcurrencyError(error)) return errorResponse('数据已被更新，请刷新后重试', 409);
  return errorResponse(error.message, fallbackStatus);
}

function conditionalItemUpdateStatements(env, item, next) {
  const columns = Object.keys(next);
  const statement = env.DB.prepare(`
    UPDATE material_requisition_items
    SET ${columns.map((column) => `${column} = ?`).join(', ')}, updated_at = datetime('now')
    WHERE id = ? AND requisition_id = ?
      ${REQUISITION_ITEM_CONCURRENCY_COLUMNS.map((column) => `AND ${column} = ?`).join('\n      ')}
  `).bind(
    ...columns.map((column) => next[column]),
    item.id,
    item.requisition_id,
    ...REQUISITION_ITEM_CONCURRENCY_COLUMNS.map((column) => item[column]),
  );
  return guardedWorkflowMutation(env, statement);
}

function itemSnapshotGuardStatements(env, item) {
  const statement = env.DB.prepare(`
    UPDATE material_requisition_items
    SET updated_at = updated_at
    WHERE id = ? AND requisition_id = ?
      ${REQUISITION_ITEM_CONCURRENCY_COLUMNS.map((column) => `AND ${column} = ?`).join('\n      ')}
  `).bind(
    item.id,
    item.requisition_id,
    ...REQUISITION_ITEM_CONCURRENCY_COLUMNS.map((column) => item[column]),
  );
  return guardedWorkflowMutation(env, statement);
}

function requisitionStatusGuardStatements(env, requisition) {
  const statement = env.DB.prepare(`
    UPDATE material_requisitions SET status = status WHERE id = ? AND status = ?
  `).bind(requisition.id, requisition.status);
  return guardedWorkflowMutation(env, statement);
}

function isBootstrapAdmin(auth) {
  return auth?.userType === 'admin' && !auth.staffId && auth.userId === 'admin';
}

function requisitionRole(auth) {
  if (auth?.userType === 'engineer') return 'engineer';
  if (auth?.userType !== 'admin') return '';
  return auth.staffRole || (isBootstrapAdmin(auth) ? 'admin' : '');
}

function isOperationsReadRoute(path, method) {
  if (method !== 'GET') return false;
  return path === '/api/admin/workorders'
    || path === '/api/admin/materials'
    || path === '/api/notifications'
    || path === '/api/notifications/unread-count'
    || /^\/api\/workorders\/[^/]+$/.test(path)
    || /^\/api\/workorders\/[^/]+\/messages$/.test(path)
    || /^\/api\/workorders\/[^/]+\/field-media\/[^/]+$/.test(path);
}

function publicStaffAccount(staff) {
  if (!staff) return staff;
  const { password_hash, salt, ...safe } = staff;
  return safe;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

async function handleAdminStaffList(request, env) {
  if (!isBootstrapAdmin(request._auth)) return errorResponse('仅超级管理员可管理员工账号', 403);
  const { results } = await env.DB.prepare(`
    SELECT id, normalized_login, normalized_phone, role, is_active, display_name,
           market_scope, must_change_password, created_by, created_at, updated_at
    FROM admin_staff_accounts ORDER BY created_at DESC
  `).all();
  return jsonResponse({ staff: results || [] });
}

async function handleAdminStaffCreate(request, env) {
  try {
    if (!isBootstrapAdmin(request._auth)) return errorResponse('仅超级管理员可管理员工账号', 403);
    const body = await request.json().catch(() => ({}));
    const normalizedLogin = normalizeIdentityEmail(body.login);
    const normalizedPhone = normalizeIdentityPhone(body.phone);
    const role = cleanText(body.role, 30);
    const displayName = cleanText(body.display_name, 100);
    const marketScope = cleanText(body.market_scope, 10) || 'all';
    if (!normalizedLogin || !displayName || !STAFF_ROLES.has(role) || !STAFF_MARKETS.has(marketScope)) {
      return errorResponse('员工账号信息不完整或无效', 400);
    }

    const existing = normalizedPhone
      ? await env.DB.prepare(`
          SELECT * FROM admin_staff_accounts WHERE normalized_login = ? OR normalized_phone = ?
        `).bind(normalizedLogin, normalizedPhone).first()
      : await env.DB.prepare(`
          SELECT * FROM admin_staff_accounts WHERE normalized_login = ?
        `).bind(normalizedLogin).first();
    if (existing) return errorResponse('员工登录名或手机号已存在', 409);

    const id = generateId();
    const temporaryPassword = generateTemporaryPassword();
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(temporaryPassword, salt);
    const staff = {
      id,
      normalized_login: normalizedLogin,
      normalized_phone: normalizedPhone || null,
      role,
      is_active: 1,
      display_name: displayName,
      market_scope: marketScope,
      must_change_password: 1,
      created_by: request._auth.userId,
    };
    const insert = env.DB.prepare(`
      INSERT INTO admin_staff_accounts (
        id, normalized_login, normalized_phone, password_hash, salt, role,
        display_name, market_scope, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, normalizedLogin, normalizedPhone || null, passwordHash, salt, role,
      displayName, marketScope, request._auth.userId,
    );
    await runAuditedWorkflowBatch(env, request, [insert], {
      targetType: 'admin_staff_account', targetId: id, action: 'staff_created',
      beforeState: null, afterState: publicStaffAccount(staff),
    });
    return jsonResponse({ staff: publicStaffAccount(staff), temporary_password: temporaryPassword }, 201);
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message || ''))) return errorResponse('员工登录名或手机号已存在', 409);
    return errorResponse(error.message, 500);
  }
}

async function handleAdminStaffDeactivate(request, env) {
  try {
    if (!isBootstrapAdmin(request._auth)) return errorResponse('仅超级管理员可管理员工账号', 403);
    const staffId = new URL(request.url).pathname.split('/')[4];
    const staff = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(staffId).first();
    if (!staff) return errorResponse('员工账号不存在', 404);
    const updated = { ...staff, is_active: 0 };
    const mutation = env.DB.prepare(`
      UPDATE admin_staff_accounts SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).bind(staffId);
    await runAuditedWorkflowBatch(env, request, guardedWorkflowMutation(env, mutation), {
      targetType: 'admin_staff_account', targetId: staffId, action: 'staff_deactivated',
      beforeState: publicStaffAccount(staff), afterState: publicStaffAccount(updated),
    });
    return jsonResponse({ staff: publicStaffAccount(updated) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function handleAdminStaffResetPassword(request, env) {
  try {
    if (!isBootstrapAdmin(request._auth)) return errorResponse('仅超级管理员可管理员工账号', 403);
    const staffId = new URL(request.url).pathname.split('/')[4];
    const staff = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(staffId).first();
    if (!staff) return errorResponse('员工账号不存在', 404);
    const temporaryPassword = generateTemporaryPassword();
    const salt = generateSalt();
    const passwordHash = await hashPasswordNew(temporaryPassword, salt);
    const mutation = env.DB.prepare(`
      UPDATE admin_staff_accounts
      SET password_hash = ?, salt = ?, must_change_password = 1, updated_at = datetime('now')
      WHERE id = ?
    `).bind(passwordHash, salt, staffId);
    await runAuditedWorkflowBatch(env, request, guardedWorkflowMutation(env, mutation), {
      targetType: 'admin_staff_account', targetId: staffId, action: 'staff_temporary_password_reset',
      beforeState: { must_change_password: Boolean(staff.must_change_password) },
      afterState: { must_change_password: true },
    });
    return jsonResponse({ success: true, temporary_password: temporaryPassword });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function requireActiveStaff(env, auth) {
  if (!auth?.staffId) return isBootstrapAdmin(auth) ? { role: 'admin' } : null;
  const staff = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(auth.staffId).first();
  return staff?.is_active ? staff : null;
}

async function getRequisitionWithItems(env, requisitionId) {
  const requisition = await env.DB.prepare('SELECT * FROM material_requisitions WHERE id = ?').bind(requisitionId).first();
  if (!requisition) return null;
  const itemsResult = await env.DB.prepare(`
    SELECT * FROM material_requisition_items WHERE requisition_id = ? ORDER BY created_at ASC
  `).bind(requisitionId).all();
  return {
    ...requisition,
    items: itemsResult.results || [],
  };
}

async function getAdminRequisitionDetail(env, requisitionId) {
  const requisition = await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return null;
  const historyResult = await env.DB.prepare(`
    SELECT actor_type, action, json_extract(after_state, '$.status') AS status, created_at
    FROM audit_logs
    WHERE (target_type = 'material_requisition' AND target_id = ?)
       OR (target_type = 'material_requisition_item' AND target_id IN (
         SELECT id FROM material_requisition_items WHERE requisition_id = ?
       ))
    ORDER BY created_at ASC, id ASC
  `).bind(requisitionId, requisitionId).all();
  return { ...requisition, history: historyResult.results || [] };
}

async function canAccessRequisition(env, auth, requisition) {
  if (auth?.userType === 'admin') return true;
  if (auth?.userType !== 'engineer') return false;
  const workOrder = await env.DB.prepare(`
    SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?
  `).bind(requisition.work_order_id).first();
  return workOrder?.engineer_id === auth.userId;
}

function generateRequisitionNumber(id) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `MR-${date}-${String(id).replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
}

async function normalizeRequisitionLine(env, input) {
  const requestedQuantity = toPositiveQuantity(input?.requested_quantity);
  if (!requestedQuantity) throw new Error('Requested quantity must be a positive integer');
  const materialId = cleanText(input.material_id, 100) || null;
  const material = materialId
    ? await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first()
    : null;
  if (materialId && !material) throw new Error('Material not found');
  const name = cleanText(input.name || material?.name, 200);
  if (!name) throw new Error('Material name is required');
  return {
    materialId,
    materialCode: cleanText(input.material_code || material?.material_code, 100) || null,
    name,
    nameEn: cleanText(input.name_en || material?.name_en, 200) || null,
    spec: cleanText(input.spec || material?.spec, 300) || null,
    brand: cleanText(input.brand || material?.brand, 100) || null,
    unit: cleanText(input.unit || material?.unit, 30) || 'pcs',
    requestedQuantity,
    notes: cleanText(input.notes, 600) || null,
  };
}

function canonicalCreateDraftLine(input) {
  const requestedQuantity = toPositiveQuantity(input?.requested_quantity);
  if (!requestedQuantity) throw new Error('Requested quantity must be a positive integer');
  return {
    material_id: cleanText(input?.material_id, 100) || null,
    material_code: cleanText(input?.material_code, 100) || null,
    name: cleanText(input?.name, 200) || null,
    name_en: cleanText(input?.name_en, 200) || null,
    spec: cleanText(input?.spec, 300) || null,
    brand: cleanText(input?.brand, 100) || null,
    unit: cleanText(input?.unit, 30) || null,
    requested_quantity: requestedQuantity,
    notes: cleanText(input?.notes, 600) || null,
  };
}

async function handleCreateMaterialRequisition(request, env) {
  let operationKey = '';
  let requestFingerprint = '';
  try {
    const auth = request._auth;
    const role = requisitionRole(auth);
    if (!canManageMaterialRequisition(role, 'create_draft') && auth.userType !== 'admin') {
      return errorResponse('无权创建领料申请', 403);
    }
    operationKey = workflowOperationKey(request);
    if (!operationKey) return errorResponse('Idempotency-Key header is required', 400);
    const body = await request.json().catch(() => ({}));
    const workOrderId = cleanText(body.work_order_id, 100);
    const workOrder = await env.DB.prepare(`
      SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (!workOrder) return errorResponse('工单不存在', 404);
    if (auth.userType === 'engineer' && workOrder.engineer_id !== auth.userId) {
      return errorResponse('仅指派工程师可创建领料申请', 403);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) return errorResponse('领料申请至少需要一条物料', 400);
    const urgency = cleanText(body.urgency, 20) || 'normal';
    if (!REQUISITION_URGENCIES.has(urgency)) return errorResponse('无效紧急程度', 400);
    const market = getRequestMarket(request);
    const requiredDate = cleanText(body.required_date, 30) || null;
    const purpose = cleanText(body.purpose, 600) || null;
    const fingerprintLines = body.items.map(canonicalCreateDraftLine);
    requestFingerprint = await createDraftRequestFingerprint({
      market,
      workOrderId,
      requestedByType: auth.userType,
      requestedById: auth.userId,
      urgency,
      requiredDate,
      purpose,
      lines: fingerprintLines,
    });
    const replay = await idempotentCreateDraftResponse(env, operationKey, requestFingerprint);
    if (replay) return replay;
    const lines = [];
    for (const item of body.items) lines.push(await normalizeRequisitionLine(env, item));
    let id;
    let requisitionNo;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      id = generateId();
      requisitionNo = generateRequisitionNumber(id);
      const header = env.DB.prepare(`
        INSERT INTO material_requisitions (
          id, requisition_no, market, work_order_id, requested_by_type, requested_by_id,
          status, urgency, required_date, purpose
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, requisitionNo, market, workOrderId, auth.userType, auth.userId, 'draft', urgency,
        requiredDate, purpose,
      );
      const itemStatements = lines.map((line) => env.DB.prepare(`
        INSERT INTO material_requisition_items (
          id, requisition_id, material_id, material_code, name, name_en, spec, brand,
          unit, requested_quantity, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), id, line.materialId, line.materialCode, line.name, line.nameEn, line.spec,
        line.brand, line.unit, line.requestedQuantity, line.notes,
      ));
      const auditAfterState = {
        id,
        requisition_no: requisitionNo,
        market,
        work_order_id: workOrderId,
        requested_by_type: auth.userType,
        requested_by_id: auth.userId,
        status: 'draft',
        urgency,
        required_date: requiredDate,
        purpose,
        items: lines,
      };
      try {
        await runAuditedWorkflowBatch(env, request, [
          header,
          ...itemStatements,
          workflowOperationStatement(env, operationKey, 'create_draft', id, null, requestFingerprint),
        ], {
          targetType: 'material_requisition', targetId: id, action: 'material_requisition_created',
          beforeState: null, afterState: auditAfterState,
        });
        break;
      } catch (error) {
        if (/UNIQUE constraint failed: material_requisition_operations\.operation_key/i.test(String(error?.message || ''))) {
          const operationReplay = await idempotentCreateDraftResponse(env, operationKey, requestFingerprint);
          if (operationReplay) return operationReplay;
        }
        if (!/UNIQUE constraint failed: material_requisitions\.requisition_no/i.test(String(error?.message || '')) || attempt === 2) {
          throw error;
        }
      }
    }
    const requisition = await getRequisitionWithItems(env, id);
    return jsonResponse({ requisition }, 201);
  } catch (error) {
    return errorResponse(error.message, /required|positive|not found/i.test(error.message) ? 400 : 500);
  }
}

async function handleListMaterialRequisitions(request, env) {
  const auth = request._auth;
  const workOrderId = cleanText(new URL(request.url).searchParams.get('work_order_id'), 100);
  const market = getRequestMarket(request);
  let statement;
  if (auth.userType === 'engineer') {
    statement = env.DB.prepare(`
      SELECT mr.* FROM material_requisitions mr
      JOIN work_orders wo ON wo.id = mr.work_order_id
      WHERE wo.engineer_id = ? AND mr.market = ?
        ${workOrderId ? 'AND mr.work_order_id = ?' : ''}
      ORDER BY mr.created_at DESC
    `).bind(auth.userId, market, ...(workOrderId ? [workOrderId] : []));
  } else if (auth.userType === 'admin') {
    statement = env.DB.prepare(`
      SELECT * FROM material_requisitions
      WHERE market = ? ${workOrderId ? 'AND work_order_id = ?' : ''}
      ORDER BY created_at DESC
    `).bind(market, ...(workOrderId ? [workOrderId] : []));
  } else {
    return errorResponse('无权查看领料申请', 403);
  }
  const { results } = await statement.all();
  return jsonResponse({ requisitions: results || [] });
}

async function handleGetMaterialRequisition(request, env) {
  const requisitionId = new URL(request.url).pathname.split('/')[3];
  const requisition = request._auth.userType === 'admin'
    ? await getAdminRequisitionDetail(env, requisitionId)
    : await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return errorResponse('领料申请不存在', 404);
  if (!await canAccessRequisition(env, request._auth, requisition)) return errorResponse('无权查看该领料申请', 403);
  return jsonResponse({ requisition });
}

async function handleSubmitMaterialRequisition(request, env) {
  try {
    const requisitionId = new URL(request.url).pathname.split('/')[3];
    const requisition = await getRequisitionWithItems(env, requisitionId);
    if (!requisition) return errorResponse('领料申请不存在', 404);
    const workOrder = await env.DB.prepare(`
      SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?
    `).bind(requisition.work_order_id).first();
    if (request._auth.userType !== 'engineer' || workOrder?.engineer_id !== request._auth.userId) {
      return errorResponse('仅创建申请的工程师可提交', 403);
    }
    if (requisition.status !== 'draft') return errorResponse('仅草稿可提交', 409);
    if (!requisition.items.length || requisition.items.some((item) => Number(item.requested_quantity) <= 0)) {
      return errorResponse('提交的领料申请必须包含正数数量物料', 400);
    }
    const mutation = env.DB.prepare(`
      UPDATE material_requisitions
      SET status = ?, submitted_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = ?
    `).bind('submitted', requisitionId, requisition.status);
    await runAuditedWorkflowBatch(env, request, guardedWorkflowMutation(env, mutation), {
      targetType: 'material_requisition', targetId: requisitionId, action: 'material_requisition_submitted',
      beforeState: { status: requisition.status }, afterState: { status: 'submitted' },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function handleRequisitionDecision(request, env, action) {
  const role = requisitionRole(request._auth);
  if (!canManageMaterialRequisition(role, action)) return errorResponse('当前员工角色无权执行该操作', 403);
  const requisitionId = new URL(request.url).pathname.split('/')[3];
  const requisition = await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return errorResponse('领料申请不存在', 404);
  const body = await request.json().catch(() => ({}));
  let nextStatus;
  if (action === 'approve') {
    if (requisition.status !== 'submitted') return errorResponse('仅已提交申请可审批', 409);
    nextStatus = 'approved';
  } else if (action === 'reject') {
    if (requisition.status !== 'submitted') return errorResponse('仅已提交申请可驳回', 409);
    nextStatus = 'rejected';
  } else {
    if (REQUISITION_TERMINAL_STATUSES.has(requisition.status)) return errorResponse('当前申请不可取消', 409);
    if (requisition.items.some((item) => Number(item.issued_quantity || 0) > 0
      || Number(item.engineer_received_quantity || 0) > 0)) {
      return errorResponse('已发料或签收的申请不能取消，请先完成允许的退库处理', 409);
    }
    nextStatus = 'cancelled';
  }
  const reason = cleanText(body.reason, 600) || null;
  let mutation;
  const reservationStatements = [];
  if (action === 'approve') {
    mutation = env.DB.prepare(`
      UPDATE material_requisitions
      SET status = ?, approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = ?
    `).bind(nextStatus, request._auth.staffId || request._auth.userId, requisitionId, requisition.status);
  } else if (action === 'reject') {
    mutation = env.DB.prepare(`
      UPDATE material_requisitions
      SET status = ?, rejection_reason = ?, updated_at = datetime('now')
      WHERE id = ? AND status = ?
    `).bind(nextStatus, reason, requisitionId, requisition.status);
  } else {
    const reservationsByMaterial = new Map();
    for (const item of requisition.items) {
      reservationStatements.push(...itemSnapshotGuardStatements(env, item));
      if (!item.material_id) continue;
      const outstandingReservation = outstandingItemReservation(item);
      if (outstandingReservation > 0) {
        reservationsByMaterial.set(
          item.material_id,
          (reservationsByMaterial.get(item.material_id) || 0) + outstandingReservation,
        );
      }
    }
    for (const [materialId, quantity] of reservationsByMaterial) {
      reservationStatements.push(...guardedWorkflowMutation(env, env.DB.prepare(`
        UPDATE materials
        SET reserved_quantity = reserved_quantity - ?, updated_at = datetime('now')
        WHERE id = ? AND reserved_quantity >= ?
      `).bind(quantity, materialId, quantity)));
    }
    mutation = env.DB.prepare(`
      UPDATE material_requisitions
      SET status = ?, cancellation_reason = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = ?
        AND NOT EXISTS (
          SELECT 1 FROM material_requisition_items
          WHERE requisition_id = material_requisitions.id
            AND (issued_quantity > 0 OR engineer_received_quantity > 0)
        )
    `).bind(nextStatus, reason, requisitionId, requisition.status);
  }
  try {
    await runAuditedWorkflowBatch(env, request, [
      ...reservationStatements,
      ...guardedWorkflowMutation(env, mutation),
    ], {
      targetType: 'material_requisition', targetId: requisitionId,
      action: `material_requisition_${{ approve: 'approved', reject: 'rejected', cancel: 'cancelled' }[action]}`,
      beforeState: { status: requisition.status },
      afterState: { status: nextStatus, reason },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

function fulfillmentValues(item, overrides = {}) {
  return {
    requested: Number(item.requested_quantity),
    stockAllocated: Number(overrides.stock_allocated_quantity ?? item.stock_allocated_quantity ?? 0),
    procurementOrdered: Number(overrides.procurement_ordered_quantity ?? item.procurement_ordered_quantity ?? 0),
    procurementReceived: Number(overrides.procurement_received_quantity ?? item.procurement_received_quantity ?? 0),
    issued: Number(overrides.issued_quantity ?? item.issued_quantity ?? 0),
    engineerReceived: Number(overrides.engineer_received_quantity ?? item.engineer_received_quantity ?? 0),
  };
}

function deriveApiItemStatus(item, overrides = {}) {
  const values = fulfillmentValues(item, overrides);
  return deriveItemStatus(values);
}

function fulfillmentSource(stockAllocated, procurementOrdered) {
  if (stockAllocated > 0 && procurementOrdered > 0) return 'mixed';
  if (procurementOrdered > 0) return 'procurement';
  if (stockAllocated > 0) return 'stock';
  return 'unassigned';
}

function outstandingItemReservation(item, overrides = {}) {
  return Math.max(
    0,
    Number(overrides.stock_allocated_quantity ?? item.stock_allocated_quantity ?? 0)
      + Number(overrides.procurement_received_quantity ?? item.procurement_received_quantity ?? 0)
      - Number(overrides.issued_quantity ?? item.issued_quantity ?? 0)
      - Number(overrides.returned_quantity ?? item.returned_quantity ?? 0),
  );
}

async function buildInventoryMovementStatements(env, request, item, {
  stockDelta,
  reservedDelta = 0,
  requiredUnreserved = 0,
  requiredReserved = 0,
  changeType,
  action,
}) {
  if (!item.material_id) return [];
  const material = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(item.material_id).first();
  if (!material) throw new Error('Material not found');
  const beforeQuantity = Number(material.stock_quantity || 0);
  const beforeReserved = Number(material.reserved_quantity || 0);
  const afterQuantity = beforeQuantity + stockDelta;
  const afterReserved = beforeReserved + reservedDelta;
  if (afterQuantity < 0) throw new Error('Insufficient material stock');
  if (afterReserved < 0) throw new Error('Insufficient material reservation');
  const stockMutation = env.DB.prepare(`
    UPDATE materials
    SET stock_quantity = stock_quantity + ?, reserved_quantity = reserved_quantity + ?,
        updated_at = datetime('now')
    WHERE id = ? AND stock_quantity = ? AND reserved_quantity = ?
      AND stock_quantity + ? >= 0 AND reserved_quantity + ? >= 0
      AND stock_quantity - reserved_quantity >= ? AND reserved_quantity >= ?
  `).bind(
    stockDelta, reservedDelta, item.material_id, beforeQuantity, beforeReserved,
    stockDelta, reservedDelta, requiredUnreserved, requiredReserved,
  );
  return [
    ...guardedWorkflowMutation(env, stockMutation),
    env.DB.prepare(`
      INSERT INTO material_inventory_adjustments (
        id, material_id, change_type, delta, before_quantity, after_quantity, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(), item.material_id, changeType, stockDelta, beforeQuantity, afterQuantity,
      `${action}:${item.requisition_id}:${item.id}`, request._auth.staffId || request._auth.userId,
    ),
  ];
}

function requisitionHeaderMutationStatements(env, requisition, action, actorId) {
  const assignments = [`status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM material_requisition_items
      WHERE requisition_id = material_requisitions.id AND status != 'cancelled'
    ) THEN status
    WHEN NOT EXISTS (
      SELECT 1 FROM material_requisition_items
      WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status != 'received'
    ) THEN 'received'
    WHEN NOT EXISTS (
      SELECT 1 FROM material_requisition_items
      WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status NOT IN ('received', 'issued')
    ) THEN 'issued'
    WHEN NOT EXISTS (
      SELECT 1 FROM material_requisition_items
      WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status NOT IN ('received', 'issued', 'ready')
    ) THEN 'ready'
    WHEN EXISTS (
      SELECT 1 FROM material_requisition_items
      WHERE requisition_id = material_requisitions.id AND status IN ('stock_allocated', 'purchasing', 'partially_ready', 'ready', 'issued', 'received')
    ) THEN 'partially_fulfilled'
    ELSE 'processing'
  END`, 'updated_at = datetime(\'now\')'];
  const values = [];
  if (['allocate_stock', 'issue', 'return'].includes(action)
    || (action === 'receive_purchase' && actorId.role === 'warehouse')) {
    assignments.push('assigned_warehouse_staff_id = ?');
    values.push(actorId.id);
    if (action === 'issue') assignments.push("issued_at = COALESCE(issued_at, datetime('now'))");
  }
  if (action === 'record_purchase' || (action === 'receive_purchase' && actorId.role !== 'warehouse')) {
    assignments.push('assigned_procurement_staff_id = ?');
    values.push(actorId.id);
  }
  assignments.push(`received_at = CASE WHEN EXISTS (
    SELECT 1 FROM material_requisition_items
    WHERE requisition_id = material_requisitions.id AND status != 'cancelled'
  ) AND NOT EXISTS (
    SELECT 1 FROM material_requisition_items
    WHERE requisition_id = material_requisitions.id AND status != 'cancelled' AND status != 'received'
  ) THEN COALESCE(received_at, datetime('now')) ELSE received_at END`);
  const mutation = env.DB.prepare(`
    UPDATE material_requisitions
    SET ${assignments.join(', ')}
    WHERE id = ? AND status NOT IN ('rejected', 'cancelled', 'closed')
  `).bind(...values, requisition.id);
  return guardedWorkflowMutation(env, mutation);
}

function workflowOperationKey(request) {
  return cleanText(request.headers.get('Idempotency-Key'), 200);
}

async function workflowRequestFingerprint(action, requisitionId, itemId, quantity, body = {}) {
  const canonicalPayload = JSON.stringify({
    action,
    requisition_id: requisitionId,
    item_id: itemId,
    quantity,
    supplier_reference: action === 'record_purchase' ? cleanText(body.supplier_reference, 200) || null : null,
    expected_arrival: action === 'record_purchase' ? cleanText(body.expected_arrival, 30) || null : null,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPayload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createDraftRequestFingerprint({
  market,
  workOrderId,
  requestedByType,
  requestedById,
  urgency,
  requiredDate,
  purpose,
  lines,
}) {
  return sha256Hex(JSON.stringify({
    action: 'create_draft',
    market,
    work_order_id: workOrderId,
    requested_by_type: requestedByType,
    requested_by_id: requestedById,
    urgency,
    required_date: requiredDate,
    purpose,
    items: lines,
  }));
}

async function existingWorkflowOperation(env, operationKey) {
  if (!operationKey) return null;
  return env.DB.prepare(`
    SELECT * FROM material_requisition_operations WHERE operation_key = ?
  `).bind(operationKey).first();
}

function operationMatches(operation, action, requisitionId, itemId, requestFingerprint) {
  return operation?.action === action
    && operation?.requisition_id === requisitionId
    && operation?.item_id === itemId
    && operation?.request_fingerprint === requestFingerprint;
}

async function idempotentCreateDraftResponse(env, operationKey, requestFingerprint) {
  const operation = await existingWorkflowOperation(env, operationKey);
  if (!operation) return null;
  if (operation.action !== 'create_draft'
    || operation.item_id !== null
    || operation.request_fingerprint !== requestFingerprint) {
    return errorResponse('Idempotency key is already used for a different request', 409);
  }
  return jsonResponse({ requisition: await getRequisitionWithItems(env, operation.requisition_id) });
}

function workflowOperationStatement(env, operationKey, action, requisitionId, itemId, requestFingerprint) {
  return env.DB.prepare(`
    INSERT INTO material_requisition_operations (
      operation_key, action, requisition_id, item_id, request_fingerprint
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(operationKey, action, requisitionId, itemId, requestFingerprint);
}

async function idempotentWorkflowResponse(env, operationKey, action, requisitionId, itemId, requestFingerprint) {
  const operation = await existingWorkflowOperation(env, operationKey);
  if (!operation) return null;
  if (!operationMatches(operation, action, requisitionId, itemId, requestFingerprint)) {
    return errorResponse('Idempotency key is already used for a different request', 409);
  }
  return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
}

async function handleRequisitionLineAction(request, env, action) {
  let body = {};
  let itemId = '';
  let operationKey = '';
  let requestFingerprint = '';
  let requisitionId = '';
  try {
    const role = requisitionRole(request._auth);
    if (!canManageMaterialRequisition(role, action)) return errorResponse('当前员工角色无权执行该操作', 403);
    requisitionId = new URL(request.url).pathname.split('/')[3];
    const requisition = await getRequisitionWithItems(env, requisitionId);
    if (!requisition) return errorResponse('领料申请不存在', 404);
    body = await request.json().catch(() => ({}));
    itemId = cleanText(body.item_id, 100);
    const quantity = toPositiveQuantity(body.quantity);
    if (!itemId || !quantity) return errorResponse('物料明细和正数数量为必填项', 400);
    operationKey = workflowOperationKey(request);
    if (!operationKey) return errorResponse('Idempotency-Key header is required', 400);
    requestFingerprint = await workflowRequestFingerprint(action, requisitionId, itemId, quantity, body);
    const replay = await idempotentWorkflowResponse(
      env, operationKey, action, requisitionId, itemId, requestFingerprint,
    );
    if (replay) return replay;
    if (!['approved', 'processing', 'partially_fulfilled', 'ready', 'issued'].includes(requisition.status)) {
      return errorResponse('当前申请状态不可执行履约操作', 409);
    }
    const item = await env.DB.prepare(`
      SELECT * FROM material_requisition_items WHERE id = ? AND requisition_id = ?
    `).bind(itemId, requisitionId).first();
    if (!item || item.status === 'cancelled') return errorResponse('领料明细不存在或已取消', 404);
    if (action === 'allocate_stock' && !item.material_id) {
      return errorResponse('自由录入物料不能分配台账库存，请走采购流程', 400);
    }
    const next = {};
    if (action === 'allocate_stock') {
      next.stock_allocated_quantity = Number(item.stock_allocated_quantity || 0) + quantity;
    } else if (action === 'record_purchase') {
      next.procurement_ordered_quantity = Number(item.procurement_ordered_quantity || 0) + quantity;
      next.supplier_reference = cleanText(body.supplier_reference, 200) || item.supplier_reference || null;
      next.expected_arrival = cleanText(body.expected_arrival, 30) || item.expected_arrival || null;
    } else if (action === 'receive_purchase') {
      next.procurement_received_quantity = Number(item.procurement_received_quantity || 0) + quantity;
    } else if (action === 'issue') {
      next.issued_quantity = Number(item.issued_quantity || 0) + quantity;
      if (item.material_id) {
        const remainingAllocatedStock = Math.max(
          0,
          Number(item.stock_allocated_quantity || 0)
            - Number(item.stock_issued_quantity || 0),
        );
        next.stock_issued_quantity = Number(item.stock_issued_quantity || 0)
          + Math.min(quantity, remainingAllocatedStock);
      }
    } else if (action === 'return') {
      if (quantity > Number(item.issued_quantity || 0) - Number(item.engineer_received_quantity || 0)) {
        return errorResponse('退库数量不能超过未签收发料数量', 400);
      }
      next.issued_quantity = Number(item.issued_quantity || 0) - quantity;
      next.returned_quantity = Number(item.returned_quantity || 0) + quantity;
    }

    validateFulfillmentQuantities(fulfillmentValues(item, next));
    next.fulfillment_source = fulfillmentSource(
      Number(next.stock_allocated_quantity ?? item.stock_allocated_quantity ?? 0),
      Number(next.procurement_ordered_quantity ?? item.procurement_ordered_quantity ?? 0),
    );
    next.status = deriveApiItemStatus(item, next);

    let inventoryStatements = [];
    if (action === 'allocate_stock') {
      const allocationGuard = env.DB.prepare(`
        UPDATE materials
        SET reserved_quantity = reserved_quantity + ?, updated_at = datetime('now')
        WHERE id = ? AND stock_quantity - reserved_quantity >= ?
      `).bind(quantity, item.material_id, quantity);
      inventoryStatements = guardedWorkflowMutation(env, allocationGuard);
    } else if (action === 'receive_purchase') {
      inventoryStatements = await buildInventoryMovementStatements(env, request, item, {
        stockDelta: quantity, reservedDelta: quantity, changeType: 'procurement_receipt', action,
      });
    } else if (action === 'issue') {
      const reservedIssueQuantity = Math.min(quantity, outstandingItemReservation(item));
      inventoryStatements = await buildInventoryMovementStatements(env, request, item, {
        stockDelta: -quantity,
        reservedDelta: -reservedIssueQuantity,
        requiredUnreserved: quantity - reservedIssueQuantity,
        requiredReserved: reservedIssueQuantity,
        changeType: 'requisition_issue',
        action,
      });
    } else if (action === 'return') {
      inventoryStatements = await buildInventoryMovementStatements(env, request, item, {
        stockDelta: quantity, changeType: 'requisition_return', action,
      });
    }
    const headerStatements = requisitionHeaderMutationStatements(env, requisition, action, {
      id: request._auth.staffId || request._auth.userId,
      role,
    });
    await runAuditedWorkflowBatch(env, request, [
      ...requisitionStatusGuardStatements(env, requisition),
      ...inventoryStatements,
      ...conditionalItemUpdateStatements(env, item, next),
      ...headerStatements,
      workflowOperationStatement(env, operationKey, action, requisitionId, itemId, requestFingerprint),
    ], {
      targetType: 'material_requisition_item', targetId: itemId,
      action: `material_requisition_${action}`,
      beforeState: item, afterState: { ...item, ...next },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    if (/UNIQUE constraint failed: material_requisition_operations\.operation_key/i.test(String(error?.message || ''))) {
      const replay = await idempotentWorkflowResponse(
        env, operationKey, action, requisitionId, itemId, requestFingerprint,
      );
      if (replay) return replay;
    }
    if (isWorkflowConcurrencyError(error)) return workflowErrorResponse(error);
    return errorResponse(error.message, /stock|quantity|requested|ordered|available|issued|aggregate/i.test(error.message) ? 400 : 500);
  }
}

async function handleEngineerRequisitionReceipt(request, env) {
  let operationKey = '';
  let requestFingerprint = '';
  let requisitionId = '';
  let itemId = '';
  try {
    requisitionId = new URL(request.url).pathname.split('/')[3];
    const requisition = await getRequisitionWithItems(env, requisitionId);
    if (!requisition) return errorResponse('领料申请不存在', 404);
    const workOrder = await env.DB.prepare(`
      SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?
    `).bind(requisition.work_order_id).first();
    if (request._auth.userType !== 'engineer' || workOrder?.engineer_id !== request._auth.userId) {
      return errorResponse('仅创建申请的工程师可确认签收', 403);
    }
    const body = await request.json().catch(() => ({}));
    operationKey = workflowOperationKey(request);
    if (!operationKey) return errorResponse('Idempotency-Key header is required', 400);
    itemId = cleanText(body.item_id, 100);
    const quantity = toPositiveQuantity(body.quantity);
    if (!itemId || !quantity) return errorResponse('物料明细和正数数量为必填项', 400);
    requestFingerprint = await workflowRequestFingerprint(
      'engineer_receipt', requisitionId, itemId, quantity, body,
    );
    const replay = await idempotentWorkflowResponse(
      env, operationKey, 'engineer_receipt', requisitionId, itemId, requestFingerprint,
    );
    if (replay) return replay;
    if (REQUISITION_TERMINAL_STATUSES.has(requisition.status)) {
      return errorResponse('当前申请状态不可确认签收', 409);
    }
    const item = await env.DB.prepare(`
      SELECT * FROM material_requisition_items WHERE id = ? AND requisition_id = ?
    `).bind(itemId, requisitionId).first();
    if (!item) return errorResponse('领料明细不存在', 404);
    const engineerReceived = Number(item.engineer_received_quantity || 0) + quantity;
    const issuedAvailable = Number(item.issued_quantity || 0);
    if (engineerReceived > issuedAvailable) return errorResponse('签收数量不能超过净发料数量', 400);
    const next = {
      engineer_received_quantity: engineerReceived,
      status: deriveApiItemStatus(item, { engineer_received_quantity: engineerReceived }),
    };
    await runAuditedWorkflowBatch(env, request, [
      ...requisitionStatusGuardStatements(env, requisition),
      ...conditionalItemUpdateStatements(env, item, next),
      ...requisitionHeaderMutationStatements(env, requisition, 'engineer_receipt', {
        id: request._auth.userId,
        role: 'engineer',
      }),
      workflowOperationStatement(
        env, operationKey, 'engineer_receipt', requisitionId, item.id, requestFingerprint,
      ),
    ], {
      targetType: 'material_requisition_item', targetId: item.id,
      action: 'material_requisition_engineer_receipt', beforeState: item, afterState: { ...item, ...next },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    if (/UNIQUE constraint failed: material_requisition_operations\.operation_key/i.test(String(error?.message || ''))) {
      const replay = await idempotentWorkflowResponse(
        env, operationKey, 'engineer_receipt', requisitionId, itemId, requestFingerprint,
      );
      if (replay) return replay;
    }
    return workflowErrorResponse(error);
  }
}

async function handleUpdateRequisitionProcurement(request, env) {
  const role = requisitionRole(request._auth);
  if (!canManageMaterialRequisition(role, 'record_purchase')) {
    return errorResponse('当前员工角色无权更新采购信息', 403);
  }
  const requisitionId = new URL(request.url).pathname.split('/')[3];
  const requisition = await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return errorResponse('领料申请不存在', 404);
  if (!['approved', 'processing', 'partially_fulfilled', 'ready'].includes(requisition.status)) {
    return errorResponse('当前申请状态不可更新采购信息', 409);
  }
  const body = await request.json().catch(() => ({}));
  const item = await env.DB.prepare(`
    SELECT * FROM material_requisition_items WHERE id = ? AND requisition_id = ?
  `).bind(cleanText(body.item_id, 100), requisitionId).first();
  if (!item) return errorResponse('领料明细不存在', 404);
  const supplierReference = cleanText(body.supplier_reference, 200) || null;
  const expectedArrival = cleanText(body.expected_arrival, 30) || null;
  try {
    const next = { supplier_reference: supplierReference, expected_arrival: expectedArrival };
    await runAuditedWorkflowBatch(env, request, [
      ...conditionalItemUpdateStatements(env, item, next),
      ...requisitionStatusGuardStatements(env, requisition),
    ], {
      targetType: 'material_requisition_item', targetId: item.id,
      action: 'material_requisition_procurement_updated', beforeState: item,
      afterState: { ...item, ...next },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function handleCloseMaterialRequisition(request, env) {
  const role = requisitionRole(request._auth);
  if (!canManageMaterialRequisition(role, 'close')) return errorResponse('当前员工角色无权关闭申请', 403);
  const requisitionId = new URL(request.url).pathname.split('/')[3];
  const requisition = await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return errorResponse('领料申请不存在', 404);
  if (REQUISITION_TERMINAL_STATUSES.has(requisition.status)) return errorResponse('当前申请不可关闭', 409);
  if (!canCloseMaterialRequisition(requisition.items)) return errorResponse('仅全部签收或取消的申请可关闭', 409);
  try {
    const mutation = env.DB.prepare(`
      UPDATE material_requisitions
      SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = ?
    `).bind(requisitionId, requisition.status);
    await runAuditedWorkflowBatch(env, request, guardedWorkflowMutation(env, mutation), {
      targetType: 'material_requisition', targetId: requisitionId, action: 'material_requisition_closed',
      beforeState: { status: requisition.status }, afterState: { status: 'closed' },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function handleCancelRequisitionItem(request, env) {
  const role = requisitionRole(request._auth);
  if (!canManageMaterialRequisition(role, 'cancel')) return errorResponse('当前员工角色无权取消领料明细', 403);
  const parts = new URL(request.url).pathname.split('/');
  const requisitionId = parts[3];
  const itemId = parts[5];
  const requisition = await getRequisitionWithItems(env, requisitionId);
  if (!requisition) return errorResponse('领料申请不存在', 404);
  if (REQUISITION_TERMINAL_STATUSES.has(requisition.status)) return errorResponse('当前申请不可取消明细', 409);
  const item = await env.DB.prepare(`
    SELECT * FROM material_requisition_items WHERE id = ? AND requisition_id = ?
  `).bind(itemId, requisitionId).first();
  if (!item) return errorResponse('领料明细不存在', 404);
  if (Number(item.issued_quantity || 0) > 0
    || Number(item.engineer_received_quantity || 0) > 0) {
    return errorResponse('已发料或签收的明细不能取消', 409);
  }
  const body = await request.json().catch(() => ({}));
  const reason = cleanText(body.reason, 600);
  const notes = [cleanText(item.notes, 600), reason].filter(Boolean).join('\n').slice(0, 600) || null;
  try {
    const next = { status: 'cancelled', notes };
    let reservationStatements = [];
    const outstandingReservation = outstandingItemReservation(item);
    if (item.material_id && outstandingReservation > 0) {
      const releaseReservation = env.DB.prepare(`
        UPDATE materials
        SET reserved_quantity = reserved_quantity - ?, updated_at = datetime('now')
        WHERE id = ? AND reserved_quantity >= ?
      `).bind(outstandingReservation, item.material_id, outstandingReservation);
      reservationStatements = guardedWorkflowMutation(env, releaseReservation);
    }
    await runAuditedWorkflowBatch(env, request, [
      ...reservationStatements,
      ...conditionalItemUpdateStatements(env, item, next),
      ...requisitionHeaderMutationStatements(env, requisition, 'cancel_item', {
        id: request._auth.staffId || request._auth.userId,
        role,
      }),
    ], {
      targetType: 'material_requisition_item', targetId: itemId,
      action: 'material_requisition_item_cancelled', beforeState: item,
      afterState: { ...item, ...next },
    });
    return jsonResponse({ requisition: await getRequisitionWithItems(env, requisitionId) });
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

async function handleSearchMaterials(request, env) {
  try {
    const auth = request._auth;
    if (!auth || !['admin', 'engineer'].includes(auth.userType)) {
      return errorResponse('需要工程师或管理员权限', 403);
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const search = cleanText(url.searchParams.get('search'), 120);
    const category = cleanText(url.searchParams.get('category'), 60);
    const market = cleanText(url.searchParams.get('market'), 20) || getRequestMarket(request);

    let where = "WHERE market = ? AND status = 'active'";
    const binds = [market];
    if (category && category !== 'all') {
      where += ' AND category = ?';
      binds.push(category);
    }
    if (search) {
      where += ` AND (
        instr(lower(COALESCE(material_code, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(name, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(name_en, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(spec, '')), lower(?)) > 0 OR
        instr(lower(COALESCE(brand, '')), lower(?)) > 0
      )`;
      binds.push(search, search, search, search, search);
    }

    const list = await env.DB.prepare(
      `SELECT id, material_code, category, name, name_en, spec, brand, compatible_equipment, unit, reference_price, status
       FROM materials ${where}
       ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      list: (list.results || []).map(normalizePublicMaterial),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleCreateMaterialRequest(request, env) {
  try {
    if (!['admin', 'engineer'].includes(request._auth?.userType)) {
      return errorResponse('需要工程师或管理员权限', 403);
    }

    const body = await request.json().catch(() => ({}));
    const payload = readMaterialRequestPayload(body);
    if (payload.error) return errorResponse(payload.error, 400);

    if (payload.work_order_id) {
      const workOrder = await getWorkOrderForMaterialAccess(env, payload.work_order_id);
      assertWorkOrderAccess(request._auth, workOrder);
    }

    const id = generateId();
    const market = cleanText(body.market, 20) || getRequestMarket(request);
    await env.DB.prepare(`
      INSERT INTO material_requests (
        id, market, status, work_order_id, requested_by_type, requested_by_id,
        suggested_name, suggested_name_en, category, spec, brand, compatible_equipment,
        supplier_suggestion, expected_quantity, unit, usage_note, urgency, attachment_urls
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      market,
      'submitted',
      payload.work_order_id,
      request._auth.userType,
      request._auth.userId,
      payload.suggested_name,
      payload.suggested_name_en,
      payload.category,
      payload.spec,
      payload.brand,
      payload.compatible_equipment,
      payload.supplier_suggestion,
      payload.expected_quantity,
      payload.unit,
      payload.usage_note,
      payload.urgency,
      payload.attachment_urls
    ).run();

    const row = await env.DB.prepare('SELECT * FROM material_requests WHERE id = ?').bind(id).first();
    const materialRequest = normalizeMaterialRequest(row || {
      id,
      market,
      status: 'submitted',
      requested_by_type: request._auth.userType,
      requested_by_id: request._auth.userId,
      ...payload,
    });
    await writeAuditLog(env, request, {
      targetType: 'material_request',
      targetId: id,
      action: 'material_request_created',
      afterState: materialRequest,
    });

    return jsonResponse({ success: true, request: materialRequest }, 201);
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleListMaterialRequests(request, env, { admin = false } = {}) {
  try {
    if (!admin && !['admin', 'engineer'].includes(request._auth?.userType)) {
      return errorResponse('需要工程师或管理员权限', 403);
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const status = cleanText(url.searchParams.get('status'), 40);
    const market = cleanText(url.searchParams.get('market'), 20) || getRequestMarket(request);

    let where = 'WHERE market = ?';
    const binds = [market];
    if (status && status !== 'all') {
      if (!MATERIAL_REQUEST_STATUSES.has(status)) return errorResponse('无效申请状态', 400);
      where += ' AND status = ?';
      binds.push(status);
    }
    if (!admin && request._auth.userType === 'engineer') {
      where += ' AND requested_by_type = ? AND requested_by_id = ?';
      binds.push('engineer', request._auth.userId);
    }

    const total = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM material_requests ${where}`
    ).bind(...binds).first();
    const list = await env.DB.prepare(
      `SELECT * FROM material_requests ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      list: (list.results || []).map(normalizeMaterialRequest),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminReviewMaterialRequest(request, env) {
  try {
    const requestId = new URL(request.url).pathname.split('/')[4];
    if (!requestId) return errorResponse('缺少申请 ID', 400);

    const existing = await env.DB.prepare('SELECT * FROM material_requests WHERE id = ?').bind(requestId).first();
    if (!existing) return errorResponse('物料申请不存在', 404);

    const body = await request.json().catch(() => ({}));
    const action = cleanText(body.action, 40);
    let nextStatus = cleanText(body.status, 40);
    let linkedMaterialId = cleanText(body.linked_material_id, 80) || existing.linked_material_id || null;
    let material = null;

    if (action === 'approve_create') {
      const payload = readMaterialPayload({
        category: existing.category,
        name: existing.suggested_name,
        name_en: existing.suggested_name_en,
        spec: existing.spec,
        brand: existing.brand,
        compatible_equipment: existing.compatible_equipment,
        supplier: existing.supplier_suggestion,
        unit: existing.unit,
        notes: existing.usage_note,
        ...(body.material || {}),
      });
      if (payload.error) return errorResponse(payload.error, 400);
      const materialId = generateId();
      await env.DB.prepare(`
        INSERT INTO materials (
          id, market, material_code, category, name, name_en, spec, brand,
          compatible_equipment, supplier, production_code, unit, reference_cost,
          reference_price, stock_quantity, safety_stock, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        materialId,
        existing.market || getRequestMarket(request),
        payload.material_code,
        payload.category,
        payload.name,
        payload.name_en,
        payload.spec,
        payload.brand,
        payload.compatible_equipment,
        payload.supplier,
        payload.production_code,
        payload.unit,
        payload.reference_cost,
        payload.reference_price,
        payload.stock_quantity,
        payload.safety_stock,
        payload.status,
        payload.notes
      ).run();
      material = normalizeMaterial(
        await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(materialId).first()
        || { id: materialId, market: existing.market || getRequestMarket(request), ...payload }
      );
      linkedMaterialId = material.id;
      nextStatus = 'approved';
    } else if (action === 'link_existing') {
      if (!linkedMaterialId) return errorResponse('请选择已有物料', 400);
      const linked = await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(linkedMaterialId).first();
      if (!linked) return errorResponse('物料不存在', 404);
      material = normalizeMaterial(linked);
      nextStatus = 'linked_existing';
    } else {
      if (!nextStatus) nextStatus = action || 'needs_info';
      if (!MATERIAL_REQUEST_STATUSES.has(nextStatus)) return errorResponse('无效申请状态', 400);
    }

    const result = await env.DB.prepare(`
      UPDATE material_requests SET
        status = ?, review_notes = ?, linked_material_id = ?, reviewed_by = ?,
        reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      nextStatus,
      cleanText(body.review_notes, 1200) || null,
      linkedMaterialId,
      request._auth?.userId || 'admin',
      requestId
    ).run();

    if (result.meta?.changes === 0) return errorResponse('物料申请不存在', 404);
    const updated = normalizeMaterialRequest(
      await env.DB.prepare('SELECT * FROM material_requests WHERE id = ?').bind(requestId).first()
      || { ...existing, status: nextStatus, linked_material_id: linkedMaterialId, review_notes: cleanText(body.review_notes, 1200) || null }
    );

    await writeAuditLog(env, request, {
      targetType: 'material_request',
      targetId: requestId,
      action: 'material_request_reviewed',
      beforeState: normalizeMaterialRequest(existing),
      afterState: updated,
    });

    return jsonResponse({ success: true, request: updated, material });
  } catch (error) {
    if (/UNIQUE/i.test(String(error?.message || ''))) {
      return errorResponse('物料编码已存在', 409);
    }
    return errorResponse(error.message, 500);
  }
}

async function handleCreateUpsellRequest(request, env) {
  try {
    if (request._auth?.userType !== 'engineer') {
      return errorResponse('需要工程师权限', 403);
    }

    const body = await request.json().catch(() => ({}));
    const payload = readUpsellRequestPayload(body);
    if (payload.error) return errorResponse(payload.error, 400);

    let customerId = null;
    if (payload.source_type === 'work_order') {
      if (!payload.work_order_id) return errorResponse('请提供关联工单', 400);
      const workOrder = await getWorkOrderForMaterialAccess(env, payload.work_order_id);
      assertWorkOrderAccess(request._auth, workOrder);
      customerId = workOrder.customer_id || null;
    } else {
      payload.work_order_id = null;
    }

    const id = generateId();
    const market = getRequestMarket(request);
    await env.DB.prepare(`
      INSERT INTO upsell_requests (
        id, market, source_type, work_order_id, customer_id, engineer_id,
        category, title, description, site_context, expected_timeline,
        budget_signal, contact_name, contact_phone, status,
        assigned_sales_owner, admin_note, quote_status, deal_result, handover_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      market,
      payload.source_type,
      payload.work_order_id,
      customerId,
      request._auth.userId,
      payload.category,
      payload.title,
      payload.description,
      payload.site_context,
      payload.expected_timeline,
      payload.budget_signal,
      payload.contact_name,
      payload.contact_phone,
      'pending_assignment',
      '',
      '',
      'not_started',
      'undecided',
      ''
    ).run();

    const row = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(id).first();
    const upsellRequest = normalizeUpsellRequest(row || {
      id,
      market,
      customer_id: customerId,
      engineer_id: request._auth.userId,
      status: 'pending_assignment',
      assigned_sales_owner: '',
      admin_note: '',
      quote_status: 'not_started',
      deal_result: 'undecided',
      handover_note: '',
      ...payload,
    });
    await writeAuditLog(env, request, {
      targetType: 'upsell_request',
      targetId: id,
      action: 'upsell_request_created',
      afterState: upsellRequest,
    });

    return jsonResponse({ success: true, request: upsellRequest }, 201);
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleListMyUpsellRequests(request, env) {
  try {
    if (request._auth?.userType !== 'engineer') {
      return errorResponse('需要工程师权限', 403);
    }

    const rows = await env.DB.prepare(
      'SELECT * FROM upsell_requests WHERE engineer_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(request._auth.userId).all();

    return jsonResponse({ requests: (rows.results || []).map(normalizeUpsellRequest) });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminListUpsellRequests(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;
    const status = cleanText(url.searchParams.get('status'), 40);
    const category = cleanText(url.searchParams.get('category'), 60);

    const where = [];
    const binds = [];
    if (status && status !== 'all') {
      if (!UPSELL_STATUSES.has(status)) return errorResponse('无效需求状态', 400);
      where.push('status = ?');
      binds.push(status);
    }
    if (category && category !== 'all') {
      if (!UPSELL_CATEGORIES.has(category)) return errorResponse('无效需求类别', 400);
      where.push('category = ?');
      binds.push(category);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM upsell_requests ${whereSql}`
    ).bind(...binds).first();
    const list = await env.DB.prepare(
      `SELECT * FROM upsell_requests ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, pageSize, offset).all();

    return jsonResponse({
      total: total?.count || 0,
      requests: (list.results || []).map(normalizeUpsellRequest),
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminGetUpsellRequest(request, env) {
  try {
    const requestId = new URL(request.url).pathname.split('/')[4];
    if (!requestId) return errorResponse('缺少需求 ID', 400);

    const row = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(requestId).first();
    if (!row) return errorResponse('增购与改造需求不存在', 404);

    return jsonResponse({ request: normalizeUpsellRequest(row) });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminUpdateUpsellRequest(request, env) {
  try {
    const requestId = new URL(request.url).pathname.split('/')[4];
    if (!requestId) return errorResponse('缺少需求 ID', 400);

    const existing = await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(requestId).first();
    if (!existing) return errorResponse('增购与改造需求不存在', 404);

    const body = await request.json().catch(() => ({}));
    const invalidChoice = (field, allowed) => (
      body[field] !== undefined && !allowed.has(cleanText(body[field], 80))
    );
    if (invalidChoice('status', UPSELL_STATUSES)) return errorResponse('无效需求状态', 400);
    if (invalidChoice('quote_status', UPSELL_QUOTE_STATUSES)) return errorResponse('无效报价状态', 400);
    if (invalidChoice('deal_result', UPSELL_DEAL_RESULTS)) return errorResponse('无效成交结果', 400);

    const next = {
      status: cleanChoice(body.status ?? existing.status, UPSELL_STATUSES, existing.status || 'pending_assignment'),
      assigned_sales_owner: cleanText(body.assigned_sales_owner ?? existing.assigned_sales_owner, 120),
      admin_note: cleanText(body.admin_note ?? existing.admin_note, 3000),
      quote_status: cleanChoice(body.quote_status ?? existing.quote_status, UPSELL_QUOTE_STATUSES, existing.quote_status || 'not_started'),
      deal_result: cleanChoice(body.deal_result ?? existing.deal_result, UPSELL_DEAL_RESULTS, existing.deal_result || 'undecided'),
      handover_note: cleanText(body.handover_note ?? existing.handover_note, 3000),
    };

    const result = await env.DB.prepare(`
      UPDATE upsell_requests SET
        status = ?, assigned_sales_owner = ?, admin_note = ?, quote_status = ?,
        deal_result = ?, handover_note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      next.status,
      next.assigned_sales_owner,
      next.admin_note,
      next.quote_status,
      next.deal_result,
      next.handover_note,
      requestId
    ).run();

    if (result.meta?.changes === 0) return errorResponse('增购与改造需求不存在', 404);
    const updated = normalizeUpsellRequest(
      await env.DB.prepare('SELECT * FROM upsell_requests WHERE id = ?').bind(requestId).first()
      || { ...existing, ...next }
    );
    await writeAuditLog(env, request, {
      targetType: 'upsell_request',
      targetId: requestId,
      action: 'upsell_request_updated',
      beforeState: normalizeUpsellRequest(existing),
      afterState: updated,
    });

    return jsonResponse({ success: true, request: updated });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function getWorkOrderForMaterialAccess(env, workOrderId) {
  return env.DB.prepare(
    'SELECT id, customer_id, engineer_id, assigned_regional_lead_id, status FROM work_orders WHERE id = ?'
  ).bind(workOrderId).first();
}

async function listWorkOrderMaterialItems(env, workOrderId, { purpose } = {}) {
  if (purpose) {
    const list = await env.DB.prepare(`
      SELECT * FROM work_order_material_items
      WHERE work_order_id = ? AND purpose = ? AND COALESCE(status, 'active') != 'removed'
      ORDER BY created_at ASC
    `).bind(workOrderId, purpose).all();
    return (list.results || []).map(normalizeWorkOrderMaterialItem);
  }
  const list = await env.DB.prepare(`
    SELECT * FROM work_order_material_items
    WHERE work_order_id = ? AND COALESCE(status, 'active') != 'removed'
    ORDER BY created_at ASC
  `).bind(workOrderId).all();
  return (list.results || []).map(normalizeWorkOrderMaterialItem);
}

async function replaceWorkOrderMaterialItems(env, request, workOrderId, purpose, items = []) {
  if (!WORK_ORDER_MATERIAL_PURPOSES.has(purpose)) throw new Error('无效物料用途');
  const payloads = [];
  for (const rawItem of Array.isArray(items) ? items : []) {
    const payload = readWorkOrderMaterialItemPayload({ ...rawItem, purpose });
    if (payload.error) throw new Error(payload.error);
    payloads.push(payload);
  }

  const materialIds = [...new Set(payloads.map((payload) => payload.material_id).filter(Boolean))];
  const materialsById = new Map();
  if (materialIds.length > 0) {
    const placeholders = materialIds.map(() => '?').join(', ');
    const materialRows = await env.DB.prepare(
      `SELECT * FROM materials WHERE id IN (${placeholders})`
    ).bind(...materialIds).all();
    for (const material of materialRows.results || []) materialsById.set(material.id, material);
  }

  const statements = [env.DB.prepare(
    "UPDATE work_order_material_items SET status = 'removed', updated_at = datetime('now') WHERE work_order_id = ? AND purpose = ?"
  ).bind(workOrderId, purpose)];
  for (const payload of payloads) {
    const material = payload.material_id ? materialsById.get(payload.material_id) : null;
    statements.push(buildWorkOrderMaterialItemInsert(env, request, workOrderId, payload, material).statement);
  }
  await env.DB.batch(statements);
}

function buildWorkOrderMaterialItemInsert(env, request, workOrderId, payload, material) {
  if (payload.material_id && !material) throw new Error('物料不存在');
  if (material?.status && material.status !== 'active') throw new Error('物料未启用');

  const fallbackName = cleanText(payload.name, 160);
  const name = material?.name || fallbackName;
  if (!name) throw new Error('请填写物料名称');

  const id = generateId();
  const statement = env.DB.prepare(`
    INSERT INTO work_order_material_items (
      id, work_order_id, material_id, purpose, material_code, name, name_en,
      spec, brand, unit, quantity, unit_price, line_total, note, status,
      created_by_type, created_by_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    workOrderId,
    payload.material_id,
    payload.purpose,
    material?.material_code || cleanText(payload.material_code, 80) || null,
    name,
    material?.name_en || cleanText(payload.name_en, 160) || null,
    material?.spec || cleanText(payload.spec, 240) || null,
    material?.brand || cleanText(payload.brand, 120) || null,
    material?.unit || cleanText(payload.unit, 40) || 'pcs',
    payload.quantity,
    payload.unit_price,
    payload.line_total,
    payload.note,
    payload.status,
    request._auth?.userType || 'system',
    request._auth?.userId || ''
  );
  const fallback = normalizeWorkOrderMaterialItem({
    id,
    work_order_id: workOrderId,
    material_id: payload.material_id,
    purpose: payload.purpose,
    material_code: material?.material_code || payload.material_code,
    name,
    name_en: material?.name_en || payload.name_en,
    spec: material?.spec || payload.spec,
    brand: material?.brand || payload.brand,
    unit: material?.unit || payload.unit || 'pcs',
    quantity: payload.quantity,
    unit_price: payload.unit_price,
    line_total: payload.line_total,
    note: payload.note,
    status: payload.status,
    created_by_type: request._auth?.userType || 'system',
    created_by_id: request._auth?.userId || '',
  });
  return { id, statement, fallback };
}

async function insertWorkOrderMaterialItem(env, request, workOrderId, payload) {
  const material = payload.material_id
    ? await env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(payload.material_id).first()
    : null;
  const insert = buildWorkOrderMaterialItemInsert(env, request, workOrderId, payload, material);
  await insert.statement.run();
  const row = await env.DB.prepare('SELECT * FROM work_order_material_items WHERE id = ?').bind(insert.id).first();
  return normalizeWorkOrderMaterialItem(row || insert.fallback);
}

async function handleGetWorkOrderMaterialItems(request, env) {
  try {
    const url = new URL(request.url);
    const workOrderId = url.pathname.split('/')[3];
    const purpose = cleanText(url.searchParams.get('purpose'), 40);
    const workOrder = await getWorkOrderForMaterialAccess(env, workOrderId);
    assertWorkOrderAccess(request._auth, workOrder);

    let list = await listWorkOrderMaterialItems(env, workOrderId, {
      purpose: WORK_ORDER_MATERIAL_PURPOSES.has(purpose) ? purpose : undefined,
    });
    if (request._auth?.userType === 'customer') {
      list = list.filter((item) => ['quote', 'service_report'].includes(item.purpose));
    }
    return jsonResponse({ list });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleCreateWorkOrderMaterialItem(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const workOrder = await getWorkOrderForMaterialAccess(env, workOrderId);
    assertWorkOrderAccess(request._auth, workOrder);
    if (!['admin', 'engineer'].includes(request._auth?.userType)) {
      return errorResponse('需要工程师或管理员权限', 403);
    }

    const body = await request.json().catch(() => ({}));
    const payload = readWorkOrderMaterialItemPayload(body);
    if (payload.error) return errorResponse(payload.error, 400);

    const item = await insertWorkOrderMaterialItem(env, request, workOrderId, { ...payload, ...body });
    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'work_order_material_item_created',
      afterState: item,
    });

    return jsonResponse({ success: true, item }, 201);
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleUpdateWorkOrderMaterialItem(request, env) {
  try {
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[3];
    const itemId = segments[5];
    const workOrder = await getWorkOrderForMaterialAccess(env, workOrderId);
    assertWorkOrderAccess(request._auth, workOrder);
    if (!['admin', 'engineer'].includes(request._auth?.userType)) {
      return errorResponse('需要工程师或管理员权限', 403);
    }

    const existing = await env.DB.prepare('SELECT * FROM work_order_material_items WHERE id = ?').bind(itemId).first();
    if (!existing || existing.work_order_id !== workOrderId) return errorResponse('工单物料不存在', 404);

    const body = await request.json().catch(() => ({}));
    const payload = readWorkOrderMaterialItemPayload({
      purpose: body.purpose ?? existing.purpose,
      quantity: body.quantity ?? existing.quantity,
      unit_price: body.unit_price ?? existing.unit_price,
      note: body.note ?? existing.note,
      status: body.status ?? existing.status,
    });
    if (payload.error) return errorResponse(payload.error, 400);

    const result = await env.DB.prepare(`
      UPDATE work_order_material_items SET
        purpose = ?, quantity = ?, unit_price = ?, line_total = ?, note = ?, status = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      payload.purpose,
      payload.quantity,
      payload.unit_price,
      payload.line_total,
      payload.note,
      payload.status,
      itemId
    ).run();
    if (result.meta?.changes === 0) return errorResponse('工单物料不存在', 404);

    const updated = await env.DB.prepare('SELECT * FROM work_order_material_items WHERE id = ?').bind(itemId).first();
    const item = normalizeWorkOrderMaterialItem(updated || { ...existing, ...payload });
    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'work_order_material_item_updated',
      beforeState: normalizeWorkOrderMaterialItem(existing),
      afterState: item,
    });

    return jsonResponse({ success: true, item });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function assertCurrentEngineer(request, env) {
  const auth = request._auth;
  if (!auth || auth.userType !== 'engineer') {
    throw new GuardError('需要工程师权限', 403);
  }
  const engineer = await env.DB.prepare(
    'SELECT id, engineer_role FROM engineers WHERE id = ?'
  ).bind(auth.userId).first();
  if (!engineer) throw new GuardError('工程师不存在', 404);
  return engineer;
}

async function handleGetEngineerCalendarEvents(request, env) {
  try {
    await assertCurrentEngineer(request, env);
    const url = new URL(request.url);
    const from = cleanText(url.searchParams.get('from'), 40);
    const to = cleanText(url.searchParams.get('to'), 40);

    let where = 'WHERE engineer_id = ?';
    const binds = [request._auth.userId];
    if (from) {
      where += ' AND end_at >= ?';
      binds.push(from);
    }
    if (to) {
      where += ' AND start_at <= ?';
      binds.push(to);
    }

    const events = await env.DB.prepare(`
      SELECT * FROM engineer_calendar_events
      ${where}
      ORDER BY start_at ASC
      LIMIT 200
    `).bind(...binds).all();

    return jsonResponse({ events: events.results || [] });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleCreateEngineerCalendarEvent(request, env) {
  try {
    await assertCurrentEngineer(request, env);
    const body = await request.json().catch(() => ({}));
    const eventType = cleanText(body.event_type, 60);
    const title = cleanText(body.title, 160);
    const startAt = cleanText(body.start_at, 40);
    const endAt = cleanText(body.end_at, 40);

    if (!ENGINEER_CALENDAR_EVENT_TYPES.has(eventType)) return errorResponse('无效日历类型');
    if (!title || !startAt || !endAt) return errorResponse('请填写日历标题、开始时间和结束时间');
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      return errorResponse('结束时间必须晚于开始时间');
    }

    const id = generateId();
    await env.DB.prepare(`
      INSERT INTO engineer_calendar_events (
        id, engineer_id, market, event_type, title, start_at, end_at, timezone,
        work_order_id, region, city, confirmation_status, engineer_response,
        visibility, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'admin_team', ?, ?)
    `).bind(
      id,
      request._auth.userId,
      getRequestMarket(request),
      eventType,
      title,
      startAt,
      endAt,
      cleanText(body.timezone, 80) || 'UTC',
      cleanText(body.work_order_id, 80) || null,
      cleanText(body.region, 120) || null,
      cleanText(body.city, 120) || null,
      cleanText(body.engineer_response, 1200) || null,
      cleanText(body.notes, 1200) || null,
      request._auth.userId
    ).run();

    return jsonResponse({ success: true, event_id: id });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleDeleteEngineerCalendarEvent(request, env) {
  try {
    await assertCurrentEngineer(request, env);
    const eventId = new URL(request.url).pathname.split('/')[4];
    if (!eventId) return errorResponse('缺少日历事件 ID');

    const result = await env.DB.prepare(
      'DELETE FROM engineer_calendar_events WHERE id = ? AND engineer_id = ?'
    ).bind(eventId, request._auth.userId).run();
    if (result.meta?.changes === 0) return errorResponse('日历事件不存在', 404);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
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

    const whereParts = [
      "(l.source IN ('machine_selection_ai', 'engineer_machine_opportunity') OR l.source_type IN ('machine_purchase_ai', 'machine_purchase_engineer') OR l.interest LIKE '%新机%' OR l.interest LIKE '%EUCHIO%' OR l.interest LIKE '%machine%')",
    ];
    const binds = [];
    if (status && status !== 'all') {
      whereParts.push('l.status = ?');
      binds.push(status);
    }
    const where = `WHERE ${whereParts.join(' AND ')}`;

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
      machine_purchase_ai: '整机采购 AI',
      machine_purchase_engineer: '工程师提交整机线索',
      engineer_machine_opportunity: '工程师提交整机线索',
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
            ? 'Admin 安排整机销售跟进，并协调工程师提供技术选型支持'
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

    if (userType === 'engineer') {
      return localizedErrorResponse('admin_engineer_creation_retired', request, 410);
    }

    if (!userType || !name || !phone || !password) {
      return errorResponse('用户类型、姓名、手机号、密码不能为空');
    }

    if (userType === 'customer') {
      // 检查手机号是否已注册
      const normalizedPhone = normalizeIdentityPhone(phone);
      const [identityConflict, existingCustomer, existingEngineer] = await Promise.all([
        findAccountIdentityConflict(env, '', normalizedPhone),
        env.DB.prepare(`
          SELECT id FROM customers
          WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
        `).bind(normalizedPhone).first(),
        env.DB.prepare(`
          SELECT id FROM engineers
          WHERE replace(replace(replace(replace(replace(replace(replace(replace(trim(phone), char(9), ''), char(10), ''), char(13), ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
        `).bind(normalizedPhone).first(),
      ]);
      if (identityConflict) {
        return accountIdentityConflictResponse(identityConflict.identity_type, request);
      }
      if (existingCustomer || existingEngineer) {
        return accountIdentityConflictResponse('phone', request);
      }

      const id = generateId();
      const userNo = await generateUserNo(env, 'U');
      const salt = generateSalt();
      const passwordHash = await hashPasswordNew(password, salt);

      const customerInsert = env.DB.prepare(
        'INSERT INTO customers (id, user_no, name, phone, password_hash, salt, region) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, userNo, name, phone, passwordHash, salt, region || null);
      try {
        await env.DB.batch([
          customerInsert,
          ...identityInsertStatements(env, {
            ownerType: 'customer',
            ownerId: id,
            phone,
          }),
        ]);
      } catch (error) {
        const conflictResponse = await recoverAccountIdentityConflict(error, env, '', normalizedPhone, request);
        if (conflictResponse) return conflictResponse;
        throw error;
      }

      return jsonResponse({ success: true, user: { id, user_no: userNo, name, phone, region } });
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

    if (userType === 'customer' || userType === 'engineer') {
      const linkedQuoteExecution = await env.DB.prepare(`
        SELECT wo.id FROM work_orders wo
        WHERE (wo.customer_id = ? OR wo.engineer_id = ?)
          AND (
            EXISTS (
              SELECT 1 FROM work_order_payment_schedule schedule
              WHERE schedule.work_order_id = wo.id
            )
            OR EXISTS (
              SELECT 1 FROM work_order_installments installment
              WHERE installment.work_order_id = wo.id
            )
            OR EXISTS (
              SELECT 1 FROM work_order_receipt_claims claim
              WHERE claim.work_order_id = wo.id
            )
            OR EXISTS (
              SELECT 1 FROM work_order_receipt_evidence evidence
              WHERE evidence.work_order_id = wo.id
            )
          )
        LIMIT 1
      `).bind(
        userType === 'customer' ? userId : null,
        userType === 'engineer' ? userId : null,
      ).first();
      if (linkedQuoteExecution) {
        return errorResponse('该用户关联报价执行或收款历史，不能删除', 409);
      }

      const linkedRequisition = await env.DB.prepare(`
        SELECT mr.id FROM material_requisitions mr
        JOIN work_orders wo ON wo.id = mr.work_order_id
        WHERE wo.customer_id = ? OR wo.engineer_id = ?
        LIMIT 1
      `).bind(
        userType === 'customer' ? userId : null,
        userType === 'engineer' ? userId : null,
      ).first();
      if (linkedRequisition) {
        return errorResponse('该用户关联领料申请历史，不能删除', 409);
      }
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
      statements.push(identityDeleteStatement(env, 'customer', userId));
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
      statements.push(env.DB.prepare('UPDATE engineer_applications SET converted_user_id = NULL WHERE converted_user_id = ?').bind(userId));
      statements.push(env.DB.prepare('DELETE FROM engineer_account_activations WHERE engineer_id = ?').bind(userId));
      statements.push(identityDeleteStatement(env, 'engineer', userId));
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

    const adminCredentials = resolveAdminCredentials(request, env);
    const adminPhone = adminCredentials.phone;
    const adminPassword = adminCredentials.password;
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

    const bootstrapMatch = Boolean(adminPhone && adminPassword && phone === adminPhone && password === adminPassword);
    let staff = null;
    if (!bootstrapMatch) {
      const normalizedLogin = normalizeIdentityEmail(phone);
      const normalizedPhone = normalizeIdentityPhone(phone);
      staff = await env.DB.prepare(`
        SELECT * FROM admin_staff_accounts
        WHERE normalized_login = ? OR normalized_phone = ?
      `).bind(normalizedLogin, normalizedPhone).first();
      const staffPasswordValid = staff?.is_active
        ? await verifyPassword(password, staff.password_hash, staff.salt)
        : false;
      const marketAllowed = staff?.market_scope === 'all' || staff?.market_scope === adminCredentials.market;
      if (!staffPasswordValid || !marketAllowed) staff = null;
    }

    if (!bootstrapMatch && !staff) {
      if (!adminPhone || !adminPassword) {
        return errorResponse('管理员账号未配置，请联系系统管理员', 500);
      }
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
    const csrfToken = generateCsrfToken();
    const staffClaims = staff ? {
      staffId: staff.id,
      staffRole: staff.role,
      mustChangePassword: Boolean(staff.must_change_password),
    } : {};
    const token = await signJwt({
      userId: staff?.id || 'admin',
      userType: 'admin',
      phone: staff?.normalized_phone || adminPhone,
      market: adminCredentials.market,
      ...staffClaims,
      csrf: csrfToken,
      iat: now,
      exp: now + 86400 * 7,
    }, env.JWT_SECRET);

    return addSessionCookie(jsonResponse(sessionResponsePayload({
      csrfToken,
      user: staff ? {
        id: staff.id,
        name: staff.display_name,
        phone: staff.normalized_phone || '',
        type: 'admin',
        market: adminCredentials.market,
        staffRole: staff.role,
        staffId: staff.id,
        mustChangePassword: Boolean(staff.must_change_password),
      } : {
        id: 'admin', name: '超级管理员', phone: adminPhone, type: 'admin', market: adminCredentials.market,
        staffRole: 'admin', staffId: null, mustChangePassword: false,
      },
    }, token, requestPortalRole(request))), request, env, 'admin', token);
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
      "SELECT COUNT(*) as count FROM leads WHERE created_at >= date('now') AND (source IN ('machine_selection_ai', 'engineer_machine_opportunity') OR source_type IN ('machine_purchase_ai', 'machine_purchase_engineer'))"
    ).first();
    const machineLeads = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE source IN ('machine_selection_ai', 'engineer_machine_opportunity') OR source_type IN ('machine_purchase_ai', 'machine_purchase_engineer') OR interest LIKE '%新机%' OR interest LIKE '%EUCHIO%' OR interest LIKE '%machine%'"
    ).first();
    const valueAddedRequests = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM upsell_requests WHERE status NOT IN ('completed', 'lost')"
    ).first();

    const requisitionOperations = await getRequisitionOperationsMetrics(env);

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
        valueAddedRequests: valueAddedRequests?.count || 0,
        euchioMachineLeads: machineLeads?.count || 0,
      },
      requisitionOperations,
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

async function handleMaterialRequisitionMetrics(request, env) {
  const role = requisitionRole(request._auth);
  if (!['admin', 'operations', 'warehouse', 'procurement'].includes(role)) {
    return errorResponse('当前角色无权查看领料运营指标', 403);
  }
  try {
    return jsonResponse({ requisitionOperations: await getRequisitionOperationsMetrics(env) });
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
      const service = url.searchParams.get('service') || '';

      let where = 'WHERE 1=1';
      const params = [];

      if (search) {
        where += ' AND (user_no LIKE ? OR name LIKE ? OR phone LIKE ? OR company LIKE ? OR service_region LIKE ? OR responsible_region LIKE ? OR team_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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
      if (service) {
        where += ' AND services LIKE ?';
        params.push(`%${service}%`);
      }
      const aliasedWhere = where
        .replace(/\buser_no\b/g, 'e.user_no')
        .replace(/\bteam_name\b/g, 'e.team_name')
        .replace(/\bname\b/g, 'e.name')
        .replace(/\bphone\b/g, 'e.phone')
        .replace(/\bcompany\b/g, 'e.company')
        .replace(/\bstatus\b/g, 'e.status')
        .replace(/\bservice_region\b/g, 'e.service_region')
        .replace(/\bresponsible_region\b/g, 'e.responsible_region')
        .replace(/\bspecialties\b/g, 'e.specialties')
        .replace(/\bservices\b/g, 'e.services');

      const total = await env.DB.prepare(`SELECT COUNT(*) as count FROM engineers ${where}`).bind(...params).first();
      const list = await env.DB.prepare(
        `SELECT
           e.id, e.user_no, e.name, e.phone, e.company, e.specialties, e.services, e.service_region,
           e.status, e.rating_count, e.rating_technical, e.total_orders, e.created_at,
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
          services: typeof e.services === 'string' ? JSON.parse(e.services) : (e.services || []),
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
async function handleAdminEngineerDetail(request, env) {
  try {
    const engineerId = new URL(request.url).pathname.split('/').pop();
    if (!engineerId) return errorResponse('缺少工程师 ID', 400);

    const engineer = await env.DB.prepare(`
      SELECT
        e.id, e.user_no, e.name, e.phone, e.company, e.specialties, e.brands, e.services,
        e.service_region, e.status, e.rating_count, e.rating_timeliness, e.rating_technical,
        e.rating_communication, e.rating_professional, e.created_at, e.bio, e.total_orders,
        e.complex_orders, e.success_orders, e.engineer_role, e.regional_lead_id,
        e.responsible_region, e.team_name, e.certification_status, e.cooperation_status,
        e.workload_status, rl.name as regional_lead_name, rl.user_no as regional_lead_no
      FROM engineers e
      LEFT JOIN engineers rl ON e.regional_lead_id = rl.id
      WHERE e.id = ?
    `).bind(engineerId).first();

    if (!engineer) return errorResponse('工程师不存在', 404);

    const workOrders = await env.DB.prepare(`
      SELECT
        w.id, w.order_no, w.type, w.urgency, w.status, w.created_at,
        c.name as customer_name, c.company as customer_company, c.user_no as customer_no,
        p.status as pricing_status, p.total_amount as pricing_total_amount, p.subtotal as pricing_subtotal
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN work_order_pricing p ON p.work_order_id = w.id
      WHERE w.engineer_id = ?
      ORDER BY w.created_at DESC
      LIMIT 50
    `).bind(engineerId).all();

    const rows = workOrders.results || [];
    const calendarEvents = await env.DB.prepare(`
      SELECT
        id, title, event_type, start_at, end_at,
        TRIM(COALESCE(region, '') || ' ' || COALESCE(city, '')) AS location,
        notes AS note
      FROM engineer_calendar_events
      WHERE engineer_id = ? AND end_at >= datetime('now')
      ORDER BY start_at ASC
      LIMIT 12
    `).bind(engineerId).all();

    return jsonResponse({
      engineer: {
        ...engineer,
        specialties: parseJsonArray(engineer.specialties),
        brands: parseJsonArray(engineer.brands),
        services: parseJsonArray(engineer.services),
      },
      stats: {
        total_work_orders: rows.length,
        completed_work_orders: rows.filter((row) => ['completed', 'resolved'].includes(row.status)).length,
        active_work_orders: rows.filter((row) => !['completed', 'resolved', 'cancelled', 'rejected'].includes(row.status)).length,
      },
      work_orders: rows,
      calendar_events: calendarEvents.results || [],
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminUpdateEngineer(request, env) {
  try {
    const engineerId = new URL(request.url).pathname.split('/').pop();
    if (!engineerId) return errorResponse(getRequestMarket(request) === 'cn' ? '缺少工程师 ID' : 'Missing engineer ID', 400);

    const existing = await env.DB.prepare('SELECT id, engineer_role FROM engineers WHERE id = ?').bind(engineerId).first();
    if (!existing) return errorResponse(getRequestMarket(request) === 'cn' ? '工程师不存在' : 'Engineer not found', 404);

    const body = await request.json();
    const updates = [];
    const values = [];

    if (body.engineer_role !== undefined) {
      const role = body.engineer_role === 'regional_lead' ? 'regional_lead' : 'engineer';
      updates.push('engineer_role = ?');
      values.push(role);
      if (role === 'regional_lead') {
        updates.push('regional_lead_id = NULL');
      }
    }
    if (body.regional_lead_id !== undefined) {
      updates.push('regional_lead_id = ?');
      values.push(body.regional_lead_id || null);
    }
    if (body.responsible_region !== undefined) {
      updates.push('responsible_region = ?');
      values.push(String(body.responsible_region || '').slice(0, 200));
    }
    if (body.team_name !== undefined) {
      updates.push('team_name = ?');
      values.push(String(body.team_name || '').slice(0, 120));
    }
    if (body.service_region !== undefined) {
      updates.push('service_region = ?');
      values.push(String(body.service_region || '').slice(0, 200));
    }

    if (!updates.length) return errorResponse(getRequestMarket(request) === 'cn' ? '没有需要修改的工程师信息' : 'No engineer fields to update', 400);

    values.push(engineerId);
    await env.DB.prepare(`UPDATE engineers SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await env.DB.prepare(`
      SELECT e.id, e.user_no, e.name, e.phone, e.company, e.specialties, e.services,
             e.service_region, e.status, e.rating_count, e.rating_technical, e.total_orders,
             e.engineer_role, e.regional_lead_id, e.responsible_region, e.team_name,
             rl.name as regional_lead_name
      FROM engineers e
      LEFT JOIN engineers rl ON e.regional_lead_id = rl.id
      WHERE e.id = ?
    `).bind(engineerId).first();

    return jsonResponse({
      success: true,
      engineer: {
        ...updated,
        specialties: parseJsonArray(updated.specialties),
        services: parseJsonArray(updated.services),
      },
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

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
             e.commission_rate as engineer_commission_rate,
             p.status as pricing_status, p.total_amount as pricing_total_amount, p.subtotal as pricing_subtotal,
             p.labor_fee as pricing_labor_fee, p.parts_fee as pricing_parts_fee,
             p.travel_fee as pricing_travel_fee, p.other_fee as pricing_other_fee,
             p.parts_detail as pricing_parts_detail, p.platform_fee as pricing_platform_fee,
             p.ai_price_check as pricing_ai_price_check
      FROM work_orders w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN engineers rl ON w.assigned_regional_lead_id = rl.id
      LEFT JOIN engineers e ON w.engineer_id = e.id
      LEFT JOIN work_order_pricing p ON p.work_order_id = w.id
      ${where}
      ORDER BY w.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all();

    const rows = list.results || [];
    if (rows.length) {
      const workOrderIds = rows.map((item) => item.id);
      const placeholders = workOrderIds.map(() => '?').join(', ');
      const [fieldDayResult, extensionResult] = await Promise.all([
        env.DB.prepare(`
          SELECT work_order_id, site_local_date, site_timezone, status
          FROM work_order_field_days WHERE work_order_id IN (${placeholders})
        `).bind(...workOrderIds).all(),
        env.DB.prepare(`
          SELECT work_order_id FROM work_order_extension_requests
          WHERE work_order_id IN (${placeholders}) AND status = 'pending'
        `).bind(...workOrderIds).all(),
      ]);
      const fieldDaysByOrder = new Map();
      for (const fieldDay of fieldDayResult.results || []) {
        const days = fieldDaysByOrder.get(fieldDay.work_order_id) || [];
        days.push(fieldDay);
        fieldDaysByOrder.set(fieldDay.work_order_id, days);
      }
      const pendingOrders = new Set((extensionResult.results || []).map((item) => item.work_order_id));
      for (const row of rows) {
        const days = fieldDaysByOrder.get(row.id) || [];
        row.field_checked_in_today = days.some((day) => {
          try { return day.site_local_date === fieldDayLocalDate(new Date(), day.site_timezone); } catch { return false; }
        });
        row.field_report_overdue_count = days.filter((day) => day.status === 'report_overdue').length;
        row.field_extension_pending = pendingOrders.has(row.id);
      }
    }
    return jsonResponse({
      total: total?.count || 0,
      list: rows,
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

function canMutateFieldWorkAdmin(auth) {
  return auth?.userType === 'admin' && (!auth.staffId || auth.staffRole === 'admin');
}

async function handleAdminFieldPlan(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权修改现场计划', 403);
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    const validation = validateFieldPlan(await request.json().catch(() => ({})));
    if (validation.error) return fieldWorkError(validation.error);
    const beforePlan = fieldPlanSnapshot(workOrder);
    const plan = validation.value;
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE work_orders SET site_timezone = ?, expected_service_days = ?, expected_completion_date = ?,
          planned_daily_start_time = ?, planned_daily_end_time = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        plan.site_timezone, plan.expected_service_days, plan.expected_completion_date,
        plan.planned_daily_start_time, plan.planned_daily_end_time, workOrderId,
      ),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order', targetId: workOrderId, action: 'field_plan_updated',
        beforeState: beforePlan, afterState: plan,
      }),
    ]);
    return jsonResponse({ field_plan: plan });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminExtensionDecision(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权审批延期', 403);
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[4];
    const requestId = segments[6];
    const body = await request.json().catch(() => ({}));
    const decision = String(body.decision || '').trim();
    const decisionReason = String(body.decision_reason || '').trim();
    if (!['approved', 'rejected'].includes(decision)) return fieldWorkError('extension_decision_invalid');
    if (!decisionReason) return fieldWorkError('decision_reason_required');
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    const extension = await env.DB.prepare(`
      SELECT * FROM work_order_extension_requests WHERE id = ? AND work_order_id = ?
    `).bind(requestId, workOrderId).first();
    if (!extension) return errorResponse('延期申请不存在', 404);
    if (extension.status === decision) {
      return jsonResponse({ extension_request: extension });
    }
    if (extension.status !== 'pending') return errorResponse('延期申请已处理', 409);
    const approvedPlan = decision === 'approved' ? {
      ...fieldPlanSnapshot(workOrder),
      expected_service_days: Number(workOrder.expected_service_days || 0) + Number(extension.requested_additional_days),
      expected_completion_date: extension.proposed_completion_date,
    } : null;
    const statements = [env.DB.prepare(`
      UPDATE work_order_extension_requests SET status = ?, decided_by = ?, decision_reason = ?, approved_plan = ?,
        decided_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND work_order_id = ? AND status = 'pending'
    `).bind(
      decision, request._auth.staffId || request._auth.userId, decisionReason,
      approvedPlan ? JSON.stringify(approvedPlan) : null, requestId, workOrderId,
    ), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field extension concurrent update') END
    `)];
    if (approvedPlan) {
      statements.push(env.DB.prepare(`
        UPDATE work_orders SET expected_service_days = ?, expected_completion_date = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(approvedPlan.expected_service_days, approvedPlan.expected_completion_date, workOrderId));
    }
    statements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order_extension_request', targetId: requestId, action: `field_extension_${decision}`,
      beforeState: { status: extension.status, plan: fieldPlanSnapshot(workOrder) },
      afterState: { status: decision, decision_reason: decisionReason, approved_plan: approvedPlan },
    }));
    try {
      await env.DB.batch(statements);
    } catch (error) {
      if (!/field extension concurrent update|malformed json/i.test(String(error?.message || error))) throw error;
      const storedExtension = await env.DB.prepare(`
        SELECT * FROM work_order_extension_requests WHERE id = ? AND work_order_id = ?
      `).bind(requestId, workOrderId).first();
      if (storedExtension?.status === decision) {
        return jsonResponse({ extension_request: storedExtension });
      }
      if (storedExtension && storedExtension.status !== 'pending') {
        return errorResponse('延期申请已处理', 409);
      }
      throw error;
    }
    await notifyFieldWorkBestEffort(env, {
      user_id: extension.engineer_id, user_type: 'engineer', type: `field_extension_${decision}`,
      title: decision === 'approved' ? 'Extension approved' : 'Extension rejected', body: decisionReason,
      data: { work_order_id: workOrderId, extension_request_id: requestId },
    });
    if (approvedPlan) {
      await notifyFieldWorkBestEffort(env, {
        user_id: workOrder.customer_id, user_type: 'customer', type: 'field_extension_approved',
        title: 'Service plan updated', body: `The expected completion date is now ${approvedPlan.expected_completion_date}.`,
        data: { work_order_id: workOrderId, extension_request_id: requestId },
      });
    }
    return jsonResponse({ extension_request: { ...extension, status: decision, decision_reason: decisionReason, approved_plan: approvedPlan } });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminFieldDayOverride(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权执行现场例外操作', 403);
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const workOrder = await getFieldWorkOrder(env, workOrderId);
    if (!workOrder) return errorResponse('工单不存在', 404);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const reason = String(body.reason || '').trim();
    if (!reason) return fieldWorkError('override_reason_required');
    if (action === 'create_day') {
      const engineerId = String(body.engineer_id || workOrder.engineer_id || '').trim();
      const siteLocalDate = String(body.site_local_date || '').trim();
      const siteTimezone = String(body.site_timezone || workOrder.site_timezone || '').trim();
      const checkInAt = String(body.check_in_at || '').trim();
      const timezoneValidation = validateFieldPlan({
        site_timezone: siteTimezone, expected_service_days: 1,
        expected_completion_date: siteLocalDate, planned_daily_start_time: '', planned_daily_end_time: '',
      });
      if (!engineerId || !isValidFieldDate(siteLocalDate) || timezoneValidation.error || !Number.isFinite(new Date(checkInAt).getTime())) {
        return fieldWorkError('field_day_override_invalid');
      }
      const fieldDayId = generateId();
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO work_order_field_days (
            id, work_order_id, engineer_id, site_local_date, site_timezone, status, check_in_at,
            location_status, location_source, internal_note
          ) VALUES (?, ?, ?, ?, ?, 'admin_override_open', ?, 'admin_override', 'admin_override', ?)
        `).bind(fieldDayId, workOrderId, engineerId, siteLocalDate, siteTimezone, checkInAt, reason),
        env.DB.prepare(`
          INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
          VALUES (?, ?, 'field_day_admin_override_created', 'admin', ?, ?)
        `).bind(generateId(), workOrderId, request._auth.staffId || request._auth.userId, reason),
        buildAuditLogStatement(env, request, {
          targetType: 'work_order_field_day', targetId: fieldDayId, action: 'field_day_admin_override_created',
          afterState: { work_order_id: workOrderId, engineer_id: engineerId, site_local_date: siteLocalDate, capture_source: 'admin_override', reason },
        }),
      ]);
      return jsonResponse({ field_day: publicFieldDay({
        id: fieldDayId, work_order_id: workOrderId, engineer_id: engineerId, site_local_date: siteLocalDate,
        site_timezone: siteTimezone, status: 'admin_override_open', check_in_at: checkInAt, location_status: 'admin_override',
        location_source: 'admin_override', capture_source: 'admin_override', internal_note: reason,
      }) }, 201);
    }
    if (action === 'close_day') {
      const fieldDayId = String(body.field_day_id || '').trim();
      const fieldDay = await env.DB.prepare(`SELECT * FROM work_order_field_days WHERE id = ? AND work_order_id = ?`).bind(fieldDayId, workOrderId).first();
      if (!fieldDay) return errorResponse('现场工作日不存在', 404);
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE work_order_field_days SET status = 'admin_closed', internal_note = ?, updated_at = datetime('now')
          WHERE id = ? AND work_order_id = ?
        `).bind(reason, fieldDayId, workOrderId),
        env.DB.prepare(`
          INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
          VALUES (?, ?, 'field_day_admin_override_closed', 'admin', ?, ?)
        `).bind(generateId(), workOrderId, request._auth.staffId || request._auth.userId, reason),
        buildAuditLogStatement(env, request, {
          targetType: 'work_order_field_day', targetId: fieldDayId, action: 'field_day_admin_override_closed',
          beforeState: { status: fieldDay.status }, afterState: { status: 'admin_closed', reason },
        }),
      ]);
      return jsonResponse({ field_day: publicFieldDay({ ...fieldDay, status: 'admin_closed', internal_note: reason }) });
    }
    return fieldWorkError('field_day_override_action_invalid');
  } catch (error) {
    if (isD1ConstraintError(error)) return errorResponse('该日期已有现场工作日', 409);
    return errorResponse(error.message, 500);
  }
}

async function handleAdminCorrectFieldDayReport(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权修正现场日报', 403);
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[4];
    const fieldDayId = segments[6];
    const fieldDay = await env.DB.prepare(`SELECT * FROM work_order_field_days WHERE id = ? AND work_order_id = ?`).bind(fieldDayId, workOrderId).first();
    if (!fieldDay) return errorResponse('现场工作日不存在', 404);
    if (!['report_submitted', 'late_report_submitted'].includes(fieldDay.status)) return errorResponse('现场日报尚未提交', 409);
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();
    if (!reason) return fieldWorkError('correction_reason_required');
    const validation = validateDailyReport({ ...body, progress_media_count: 1 }, { overdue: fieldDay.status === 'late_report_submitted' });
    if (validation.error) return fieldWorkError(validation.error);
    const previousReport = {
      status: fieldDay.status, labor_hours: fieldDay.labor_hours, completed_work: fieldDay.completed_work,
      issues_risks: fieldDay.issues_risks, next_plan: fieldDay.next_plan,
      customer_support_needed: fieldDay.customer_support_needed, internal_note: fieldDay.internal_note,
      late_reason: fieldDay.late_reason, report_submitted_at: fieldDay.report_submitted_at,
    };
    const value = validation.value;
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO work_order_field_day_revisions (
          id, work_order_id, field_day_id, previous_report, changed_by_type, changed_by_id, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), workOrderId, fieldDayId, JSON.stringify(previousReport),
        request._auth.staffRole || 'admin', request._auth.staffId || request._auth.userId, reason,
      ),
      env.DB.prepare(`
        UPDATE work_order_field_days SET labor_hours = ?, completed_work = ?, issues_risks = ?, next_plan = ?,
          customer_support_needed = ?, internal_note = ?, late_reason = ?, updated_at = datetime('now')
        WHERE id = ? AND work_order_id = ?
      `).bind(
        value.labor_hours, value.completed_work, value.issues_risks, value.next_plan,
        value.customer_support_needed, value.internal_note, value.late_reason, fieldDayId, workOrderId,
      ),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order_field_day', targetId: fieldDayId, action: 'field_day_report_corrected',
        beforeState: previousReport, afterState: { ...value, reason },
      }),
    ]);
    return jsonResponse({ field_day: publicFieldDay({ ...fieldDay, ...value }) });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminOpenEvidenceHold(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权管理证据保全', 403);
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    if (!await getFieldWorkOrder(env, workOrderId)) return errorResponse('工单不存在', 404);
    const body = await request.json().catch(() => ({}));
    const reasonCategory = String(body.reason_category || '').trim();
    const reason = String(body.reason || '').trim();
    if (!reasonCategory || !reason) return fieldWorkError('evidence_hold_reason_required');
    if (!EVIDENCE_HOLD_REASON_CATEGORIES.has(reasonCategory)) return fieldWorkError('evidence_hold_reason_category_invalid');
    const holdId = generateId();
    const openedBy = request._auth.staffId || request._auth.userId;
    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO work_order_field_evidence_holds (id, work_order_id, reason_category, reason, opened_by)
          SELECT ?, ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM work_order_field_day_media
            WHERE work_order_id = ? AND deleted_at IS NULL AND retention_claim_token IS NOT NULL
          )
        `).bind(holdId, workOrderId, reasonCategory, reason, openedBy, workOrderId),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('field evidence retention active') END`),
        buildAuditLogStatement(env, request, {
          targetType: 'work_order_field_evidence_hold', targetId: holdId, action: 'field_evidence_hold_opened',
          afterState: { work_order_id: workOrderId, reason_category: reasonCategory, reason },
        }),
      ]);
    } catch (error) {
      if (/field evidence retention active|malformed json/i.test(String(error?.message || error))) {
        return errorResponse('现场证据正在执行保留期清理，请稍后重试', 409);
      }
      throw error;
    }
    return jsonResponse({ evidence_hold: { id: holdId, work_order_id: workOrderId, reason_category: reasonCategory, reason, status: 'open', opened_by: openedBy } }, 201);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminResolveEvidenceHold(request, env) {
  try {
    if (!canMutateFieldWorkAdmin(request._auth)) return errorResponse('当前员工角色无权管理证据保全', 403);
    const segments = new URL(request.url).pathname.split('/');
    const workOrderId = segments[4];
    const holdId = segments[6];
    const hold = await env.DB.prepare(`
      SELECT * FROM work_order_field_evidence_holds WHERE id = ? AND work_order_id = ?
    `).bind(holdId, workOrderId).first();
    if (!hold) return errorResponse('证据保全记录不存在', 404);
    if (hold.status !== 'open') return errorResponse('证据保全记录已处理', 409);
    const body = await request.json().catch(() => ({}));
    const resolutionReason = String(body.resolution_reason || '').trim();
    if (!resolutionReason) return fieldWorkError('resolution_reason_required');
    const resolvedBy = request._auth.staffId || request._auth.userId;
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE work_order_field_evidence_holds SET status = 'resolved', resolved_by = ?, resolution_reason = ?, resolved_at = datetime('now')
        WHERE id = ? AND work_order_id = ? AND status = 'open'
      `).bind(resolvedBy, resolutionReason, holdId, workOrderId),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order_field_evidence_hold', targetId: holdId, action: 'field_evidence_hold_resolved',
        beforeState: { status: hold.status }, afterState: { status: 'resolved', resolution_reason: resolutionReason },
      }),
    ]);
    return jsonResponse({ evidence_hold: { ...hold, status: 'resolved', resolved_by: resolvedBy, resolution_reason: resolutionReason } });
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
    const market = getRequestMarket(request);
    const copy = quoteReviewCopy(market);
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const workOrderId = parts[4];
    const action = parts[6]; // approve / reject
    const body = await request.json().catch(() => ({}));
    const reviewNote = (body.note || '').trim();
    const quoteVersion = Number(body.quote_version);

    if (!workOrderId || !['approve', 'reject'].includes(action)) {
      return errorResponse(copy.invalidAction, 400);
    }
    if (!Number.isInteger(quoteVersion) || quoteVersion < 1) {
      return errorResponse(copy.versionRequired, 400);
    }
    if (action === 'reject' && !reviewNote) {
      return errorResponse(copy.rejectionReasonRequired, 400);
    }

    const wo = await env.DB.prepare(
      'SELECT id, order_no, customer_id, engineer_id, quote_review_status FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(copy.workOrderNotFound, 404);

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing) return errorResponse(copy.quoteNotFound, 404);
    if (Number(pricing.quote_version) !== quoteVersion) return errorResponse(copy.staleVersion, 409);
    const history = await env.DB.prepare(`
      SELECT * FROM work_order_pricing_history
      WHERE pricing_id = ? AND version = ?
    `).bind(pricing.id, quoteVersion).first();
    if (!history || history.status !== 'pending_review' || pricing.status !== 'pending_review') {
      return errorResponse(copy.staleVersion, 409);
    }
    const beforeQuote = await quoteVersionSnapshot(env, workOrderId, history);
    const nextHistoryStatus = action === 'approve' ? 'approved' : 'rejected';
    const nextPricingStatus = action === 'approve' ? 'submitted' : 'draft';
    const nextReviewStatus = action === 'approve' ? 'approved' : 'rejected';
    const supplemental = history.quote_kind === 'supplemental';
    const nextWorkOrderStatus = action === 'approve' ? 'pricing' : 'in_progress';
    const afterQuote = {
      ...beforeQuote,
      status: nextHistoryStatus,
      approved_at: action === 'approve' ? 'now' : beforeQuote.approved_at,
    };
    const reviewBeforeState = {
      quote_review_status: wo.quote_review_status,
      pricing_status: pricing.status,
      ...beforeQuote,
      quote: beforeQuote,
    };
    const reviewAfterState = {
      quote_review_status: nextReviewStatus,
      pricing_status: nextPricingStatus,
      note: reviewNote || null,
      ...afterQuote,
      quote: afterQuote,
    };
    const message = action === 'approve' ? copy.approvedMessage : copy.rejectedMessage(reviewNote);
    const statements = [env.DB.prepare(`
      UPDATE work_order_pricing_history
      SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END
      WHERE pricing_id = ? AND version = ? AND status = 'pending_review'
    `).bind(nextHistoryStatus, nextHistoryStatus, pricing.id, quoteVersion), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote review concurrent update') END
    `), env.DB.prepare(`
      UPDATE work_order_pricing SET status = ?
      WHERE work_order_id = ? AND quote_version = ? AND status = 'pending_review'
    `).bind(nextPricingStatus, workOrderId, quoteVersion), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote review concurrent update') END
    `), env.DB.prepare(supplemental
      ? 'UPDATE work_orders SET quote_review_status = ? WHERE id = ?'
      : 'UPDATE work_orders SET status = ?, quote_review_status = ? WHERE id = ?'
    ).bind(...(supplemental
      ? [nextReviewStatus, workOrderId]
      : [nextWorkOrderStatus, nextReviewStatus, workOrderId]
    )), env.DB.prepare(`
      INSERT INTO work_order_messages (
        id, work_order_id, sender_type, sender_id, sender_name, content,
        message_type, is_internal_note, is_customer_visible
      ) VALUES (?, ?, 'system', '', ?, ?, ?, ?, ?)
    `).bind(
      generateId(), workOrderId, systemSenderName(market), message,
      action === 'approve' ? 'pricing_update' : 'system',
      action === 'approve' ? 0 : 1,
      action === 'approve' ? 1 : 0,
    ), buildAuditLogStatement(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: action === 'approve' ? 'pricing_review_approved' : 'pricing_review_rejected',
      beforeState: reviewBeforeState,
      afterState: reviewAfterState,
    })];

    if (typeof env.DB.batch !== 'function') throw new Error('Transactional D1 batch is required');
    await env.DB.batch(statements);

    if (action === 'approve' && wo.customer_id) {
      await createNotification(env, {
        user_id: wo.customer_id,
        user_type: 'customer',
        type: 'official_quote_ready',
        title: copy.approvedTitle,
        body: copy.approvedBody(wo.order_no),
        data: { work_order_id: workOrderId, quote_version: quoteVersion },
      });
    }
    if (action === 'reject' && wo.engineer_id) {
      await createNotification(env, {
        user_id: wo.engineer_id,
        user_type: 'engineer',
        type: 'quote_review_rejected',
        title: copy.rejectedTitle,
        body: copy.rejectedBody(wo.order_no),
        data: { work_order_id: workOrderId, quote_version: quoteVersion },
      });
    }

    return jsonResponse({
      success: true,
      status: nextHistoryStatus,
      message: action === 'approve' ? copy.approvedResponse : copy.rejectedResponse,
      ...afterQuote,
      quote: afterQuote,
    });
  } catch (error) {
    if (/quote review concurrent update|malformed json/i.test(String(error?.message || error))) {
      return errorResponse(quoteReviewCopy(getRequestMarket(request)).staleVersion, 409);
    }
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

async function handleWorkOrderArrivalCheck(request, env) {
  try {
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse(market === 'cn' ? '仅工程师可提交到场定位' : 'Only engineers can submit an arrival check', 403);
    }

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const currentLatitude = normalizeCoordinate(body.latitude);
    const currentLongitude = normalizeCoordinate(body.longitude);
    const currentAccuracyMeters = normalizeCoordinate(body.accuracy_m);
    const currentCoordinateSystem = String(body.coordinate_system || 'wgs84').trim().toLowerCase();
    const locationSource = String(body.location_source || 'browser').trim().slice(0, 40) || 'browser';

    if (!isValidCoordinatePair(currentLatitude, currentLongitude)) {
      return errorResponse(market === 'cn' ? '工程师当前位置无效' : 'Engineer location is invalid', 400);
    }
    if (!SUPPORTED_COORDINATE_SYSTEMS.has(currentCoordinateSystem)) {
      return errorResponse(market === 'cn' ? '工程师坐标系不受支持' : 'Engineer coordinate system is not supported', 400);
    }
    if (currentAccuracyMeters === null || currentAccuracyMeters < 0 || currentAccuracyMeters > 500) {
      return errorResponse(market === 'cn' ? '工程师定位精度无效' : 'Engineer location accuracy is invalid', 400);
    }

    const workOrder = await env.DB.prepare(`
      SELECT id, order_no, engineer_id, status, service_mode, arrival_verification_required,
        service_address, service_latitude, service_longitude, service_accuracy_m, service_coordinate_system
      FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (!workOrder) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (workOrder.engineer_id !== auth.userId) {
      return errorResponse(market === 'cn' ? '您未被指派到此工单' : 'You are not assigned to this work order', 403);
    }
    if (workOrder.status !== 'in_service') {
      return errorResponse(market === 'cn' ? '付款确认后才能提交到场定位' : 'Arrival checks are available after service start approval', 409);
    }
    if (!workOrder.arrival_verification_required) {
      return errorResponse(market === 'cn' ? '此工单为远程服务，无需到场打卡' : 'This work order does not require an onsite arrival check', 409);
    }
    if (!isValidCoordinatePair(workOrder.service_latitude, workOrder.service_longitude)) {
      return errorResponse(serviceLocationErrorMessage('service_location_required', market), 400);
    }

    const check = evaluateArrivalCheck({
      targetLatitude: workOrder.service_latitude,
      targetLongitude: workOrder.service_longitude,
      targetCoordinateSystem: workOrder.service_coordinate_system || 'wgs84',
      currentLatitude,
      currentLongitude,
      currentAccuracyMeters,
      currentCoordinateSystem,
    });
    if (!check.valid) {
      return errorResponse(market === 'cn' ? '客户位置和工程师位置坐标系不一致' : 'Customer and engineer coordinate systems do not match', 400);
    }

    const failureReason = check.withinGeofence ? null : 'outside_geofence';
    await env.DB.prepare(`
      INSERT INTO work_order_arrival_checks (
        id, work_order_id, engineer_id, latitude, longitude, accuracy_m,
        coordinate_system, location_source, distance_m, radius_m, within_geofence, failure_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      auth.userId,
      currentLatitude,
      currentLongitude,
      currentAccuracyMeters,
      currentCoordinateSystem,
      locationSource,
      check.distanceMeters,
      check.radiusMeters,
      check.withinGeofence ? 1 : 0,
      failureReason,
    ).run();

    if (!check.withinGeofence) {
      return jsonResponse({
        success: false,
        arrival_verified: false,
        distance_m: check.distanceMeters,
        radius_m: check.radiusMeters,
        reason: market === 'cn' ? '当前位置距离客户现场过远，请到达现场后重试' : 'You are outside the customer site area. Try again after arriving.',
      }, 409);
    }

    await env.DB.prepare(`
      UPDATE work_orders SET
        service_mode = 'onsite',
        arrival_verification_required = 1,
        arrival_verified_at = datetime('now'),
        arrival_distance_m = ?,
        arrival_radius_m = ?,
        arrival_accuracy_m = ?,
        arrival_latitude = ?,
        arrival_longitude = ?,
        arrival_coordinate_system = ?,
        arrival_location_source = ?
      WHERE id = ?
    `).bind(
      check.distanceMeters,
      check.radiusMeters,
      currentAccuracyMeters,
      currentLatitude,
      currentLongitude,
      currentCoordinateSystem,
      locationSource,
      workOrderId,
    ).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'arrival_verified', 'engineer', ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      auth.userId,
      market === 'cn'
        ? `工程师已完成到场定位核验，距离客户现场 ${check.distanceMeters} 米。`
        : `Engineer arrival verified at ${check.distanceMeters} meters from the customer site.`,
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'arrival_verified',
      beforeState: { arrival_verified_at: null },
      afterState: { arrival_verified_at: 'now', distance_m: check.distanceMeters, radius_m: check.radiusMeters },
    });

    return jsonResponse({
      success: true,
      arrival_verified: true,
      distance_m: check.distanceMeters,
      radius_m: check.radiusMeters,
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 工程师标记服务完成
async function handleRequestOnsiteConversion(request, env) {
  try {
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse(market === 'cn' ? '仅工程师可以申请转为上门服务' : 'Only engineers can request onsite conversion', 403);
    }

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim().slice(0, 1000);
    if (!note) {
      return errorResponse(market === 'cn' ? '请说明需要转为上门服务的原因' : 'Explain why onsite service is required', 400);
    }

    const workOrder = await env.DB.prepare(`
      SELECT id, order_no, customer_id, engineer_id, status, service_mode, onsite_conversion_status
      FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (!workOrder) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (workOrder.engineer_id !== auth.userId) {
      return errorResponse(market === 'cn' ? '您未被指派到此工单' : 'You are not assigned to this work order', 403);
    }
    if (workOrder.status !== 'in_service') {
      return errorResponse(market === 'cn' ? '服务开始后才能申请转为上门服务' : 'Onsite conversion is available after service starts', 409);
    }
    if (workOrder.service_mode === 'onsite' || workOrder.onsite_conversion_status === 'confirmed') {
      return errorResponse(market === 'cn' ? '此工单已经是上门服务' : 'This work order is already onsite', 409);
    }

    await env.DB.prepare(`
      UPDATE work_orders SET
        service_mode = 'hybrid',
        onsite_conversion_status = 'requested',
        onsite_conversion_requested_at = datetime('now'),
        onsite_conversion_request_note = ?,
        onsite_conversion_requested_by = ?
      WHERE id = ?
    `).bind(note, auth.userId, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'onsite_conversion_requested', 'engineer', ?, ?)
    `).bind(generateId(), workOrderId, auth.userId, note).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'onsite_conversion_requested',
      beforeState: {
        service_mode: workOrder.service_mode,
        onsite_conversion_status: workOrder.onsite_conversion_status || 'not_requested',
      },
      afterState: { service_mode: 'hybrid', onsite_conversion_status: 'requested', note },
    });

    if (workOrder.customer_id) {
      await createNotification(env, {
        user_id: workOrder.customer_id,
        user_type: 'customer',
        type: 'onsite_conversion_requested',
        title: market === 'cn' ? '请确认上门服务位置' : 'Confirm the on-site service location',
        body: market === 'cn'
          ? `工程师申请将工单 ${workOrder.order_no || workOrderId} 转为上门服务，请确认准确地址和地图位置。`
          : `The engineer requested an on-site visit for ${workOrder.order_no || workOrderId}. Confirm the exact address and map point.`,
        data: { work_order_id: workOrderId },
      });
    }

    return jsonResponse({
      success: true,
      service_mode: 'hybrid',
      onsite_conversion_status: 'requested',
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleConfirmOnsiteConversion(request, env, { admin = false } = {}) {
  try {
    const auth = request._auth;
    const market = getRequestMarket(request);
    const workOrderId = new URL(request.url).pathname.split('/')[admin ? 4 : 3];
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim().slice(0, 1000);
    const adminReason = String(body.reason || '').trim().slice(0, 1000);

    if (admin) {
      if (!auth || auth.userType !== 'admin') {
        return errorResponse(market === 'cn' ? '需要管理员权限' : 'Admin access required', 403);
      }
      if (!adminReason) {
        return errorResponse(market === 'cn' ? '管理员代确认必须填写原因' : 'A reason is required for admin confirmation', 400);
      }
    } else if (!auth || auth.userType !== 'customer') {
      return errorResponse(market === 'cn' ? '仅客户可以确认现场位置' : 'Only the customer can confirm the service location', 403);
    }

    const location = parseServiceLocation(body);
    if (location.error) return errorResponse(serviceLocationErrorMessage(location.error, market), 400);
    if (!location.address || !location.hasCoordinates) {
      return errorResponse(serviceLocationErrorMessage('service_location_required', market), 400);
    }

    const workOrder = await env.DB.prepare(`
      SELECT id, order_no, customer_id, engineer_id, service_mode, onsite_conversion_status,
        service_address, service_latitude, service_longitude, active_quote_version,
        quote_expected_service_days, expected_service_days
      FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (!workOrder) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (!admin && workOrder.customer_id !== auth.userId) {
      return errorResponse(market === 'cn' ? '您无权确认此工单位置' : 'You cannot confirm this work order location', 403);
    }
    if (workOrder.onsite_conversion_status !== 'requested') {
      return errorResponse(market === 'cn' ? '此工单没有待确认的上门服务申请' : 'This work order has no pending onsite conversion request', 409);
    }

    const confirmationNote = admin
      ? `${note}${note ? '\n' : ''}${market === 'cn' ? '管理员代确认原因' : 'Admin reason'}: ${adminReason}`
      : note;
    const actorType = admin ? 'admin' : 'customer';
    const auditAction = admin ? 'onsite_conversion_admin_confirmed' : 'onsite_conversion_confirmed';
    const conversionStatements = [env.DB.prepare(`
      UPDATE work_orders SET
        service_address = ?,
        service_latitude = ?,
        service_longitude = ?,
        service_accuracy_m = ?,
        service_coordinate_system = ?,
        service_location_source = ?,
        service_location_confirmed_at = datetime('now'),
        service_mode = 'onsite',
        arrival_verification_required = 1,
        arrival_verified_at = NULL,
        onsite_conversion_status = 'confirmed',
        onsite_conversion_confirmed_at = datetime('now'),
        onsite_conversion_confirmation_note = ?,
        onsite_conversion_confirmed_by = ?,
        expected_service_days = CASE
          WHEN active_quote_version IS NOT NULL AND quote_expected_service_days IS NOT NULL
            THEN quote_expected_service_days
          ELSE expected_service_days
        END
      WHERE id = ? AND service_mode = 'hybrid' AND onsite_conversion_status = 'requested'
    `).bind(
      location.address,
      location.latitude,
      location.longitude,
      location.accuracyMeters,
      location.coordinateSystem,
      location.source,
      confirmationNote,
      auth.userId,
      workOrderId,
    ), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('onsite conversion concurrent update') END
    `), env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'onsite_conversion_confirmed', ?, ?, ?)
    `).bind(
      generateId(),
      workOrderId,
      actorType,
      auth.userId,
      admin ? adminReason : (note || location.address),
    ), env.DB.prepare(`
      INSERT INTO audit_logs (
        id, actor_type, actor_id, target_type, target_id, action,
        before_state, after_state, ip, device_info
      )
      SELECT ?, ?, ?, 'work_order', id, ?, ?, json_object(
        'service_mode', service_mode,
        'onsite_conversion_status', onsite_conversion_status,
        'service_address', service_address,
        'service_latitude', service_latitude,
        'service_longitude', service_longitude,
        'expected_service_days', expected_service_days,
        'reason', ?
      ), ?, ?
      FROM work_orders WHERE id = ?
    `).bind(
      generateId(), actorType, auth.userId, auditAction,
      JSON.stringify({
        service_mode: workOrder.service_mode,
        onsite_conversion_status: workOrder.onsite_conversion_status,
        service_address: workOrder.service_address,
        service_latitude: workOrder.service_latitude,
        service_longitude: workOrder.service_longitude,
      }),
      adminReason || null,
      getRequestIp(request), request.headers.get('user-agent') || '', workOrderId,
    )];
    if (typeof env.DB.batch !== 'function') throw new Error('Transactional D1 batch is required');
    try {
      await env.DB.batch(conversionStatements);
    } catch (error) {
      if (/onsite conversion concurrent update|malformed json/i.test(String(error?.message || error))) {
        return errorResponse(
          market === 'cn' ? '上门服务状态已变更，请刷新后重试' : 'The onsite conversion changed. Refresh and try again.',
          409,
        );
      }
      throw error;
    }

    if (workOrder.engineer_id) {
      const notificationTask = createNotification(env, {
        user_id: workOrder.engineer_id,
        user_type: 'engineer',
        type: 'onsite_conversion_confirmed',
        title: market === 'cn' ? '客户现场位置已确认' : 'Customer site location confirmed',
        body: market === 'cn'
          ? `工单 ${workOrder.order_no || workOrderId} 已转为上门服务，到达现场后请完成定位打卡。`
          : `${workOrder.order_no || workOrderId} is now an on-site service order. Check in after arriving at the customer site.`,
        data: { work_order_id: workOrderId },
      }).catch((error) => {
        console.warn('[onsite conversion] notification failed:', error?.message || error);
      });
      if (request._ctx && typeof request._ctx.waitUntil === 'function') {
        request._ctx.waitUntil(notificationTask);
      } else {
        await notificationTask;
      }
    }

    return jsonResponse({
      success: true,
      service_mode: 'onsite',
      onsite_conversion_status: 'confirmed',
      arrival_verification_required: true,
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminArrivalOverride(request, env) {
  try {
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth || auth.userType !== 'admin') {
      return errorResponse(market === 'cn' ? '需要管理员权限' : 'Admin access required', 403);
    }

    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || '').trim().slice(0, 1000);
    if (!reason) {
      return errorResponse(market === 'cn' ? '人工放行必须填写原因' : 'A reason is required for arrival override', 400);
    }

    const workOrder = await env.DB.prepare(`
      SELECT id, order_no, engineer_id, service_mode, arrival_verification_required, arrival_verified_at
      FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (!workOrder) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (!workOrder.arrival_verification_required || workOrder.service_mode !== 'onsite') {
      return errorResponse(market === 'cn' ? '此工单不需要到场核验' : 'This work order does not require arrival verification', 409);
    }

    await env.DB.prepare(`
      UPDATE work_orders SET
        arrival_verified_at = datetime('now'),
        arrival_override_at = datetime('now'),
        arrival_override_reason = ?,
        arrival_override_by = ?
      WHERE id = ?
    `).bind(reason, auth.userId, workOrderId).run();

    await env.DB.prepare(`
      INSERT INTO work_order_logs (id, work_order_id, action, actor_type, actor_id, content)
      VALUES (?, ?, 'arrival_override', 'admin', ?, ?)
    `).bind(generateId(), workOrderId, auth.userId, reason).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'arrival_override',
      beforeState: { arrival_verified_at: workOrder.arrival_verified_at || null },
      afterState: { arrival_verified_at: 'now', reason },
    });

    return jsonResponse({ success: true, arrival_verified: true, override: true });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleResolveWorkOrder(request, env) {
  try {
    const market = getRequestMarket(request);
    // 认证：engineer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse(market === 'cn' ? '仅工程师可标记完成' : 'Only engineers can complete service', 403);
    }
    const engineer_id = auth.userId;

    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const wo = await env.DB.prepare(
      'SELECT status, engineer_id, customer_id, arrival_verification_required, arrival_verified_at FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.engineer_id !== engineer_id) {
      return errorResponse(market === 'cn' ? '您无权操作该工单' : 'You do not have permission to update this work order', 403);
    }
    if (wo.arrival_verification_required && !wo.arrival_verified_at) {
      return errorResponse(market === 'cn' ? '请先完成到场定位核验，再提交服务完成' : 'Complete the onsite arrival check before completing service', 400);
    }

    const fieldPlan = await env.DB.prepare(`
      SELECT service_mode, site_timezone, expected_service_days, expected_completion_date
      FROM work_orders WHERE id = ?
    `).bind(workOrderId).first();
    if (fieldPlan?.service_mode === 'onsite' && hasCompleteFieldPlan(fieldPlan)) {
      const fieldDayRecords = await env.DB.prepare(`
        SELECT * FROM work_order_field_days
        WHERE work_order_id = ?
        ORDER BY site_local_date DESC, created_at DESC
      `).bind(workOrderId).all();
      const fieldDays = fieldDayRecords.results || [];
      if (!fieldDays.length) {
        return errorResponse(
          market === 'cn' ? '请至少完成一个现场工作日并提交日报' : 'Complete at least one field day before completing service',
          409,
        );
      }
      if (fieldDays.some((fieldDay) => fieldDayBlocksFinalReport(fieldDay.status))) {
        return errorResponse(
          market === 'cn' ? '请先提交所有未完成或逾期的现场日报' : 'Submit every open or overdue daily report before completing service',
          409,
        );
      }
      if (!['report_submitted', 'late_report_submitted'].includes(fieldDays[0].status)) {
        return errorResponse(
          market === 'cn' ? '最终现场工作日必须先提交日报' : 'Submit the final field day report before completing service',
          409,
        );
      }
      const pendingExtension = await env.DB.prepare(`
        SELECT id FROM work_order_extension_requests
        WHERE work_order_id = ? AND status = 'pending'
      `).bind(workOrderId).first();
      if (pendingExtension) {
        return errorResponse(
          market === 'cn' ? '请先完成待审批的延期申请' : 'Resolve the pending field extension before completing service',
          409,
        );
      }
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
      return errorResponse(market === 'cn' ? '请先填写服务报告，再标记服务完成' : 'Complete the service report before completing service', 400);
    }

    // 仅允许 in_service 或 pricing 状态时标记完成
    if (['in_service', 'pricing'].includes(wo.status)) {
      const resolved = await env.DB.prepare(`
        UPDATE work_orders
        SET status = 'resolved', resolved_at = datetime('now')
        WHERE id = ? AND engineer_id = ? AND status IN ('in_service', 'pricing')
          AND (
            service_mode <> 'onsite'
            OR site_timezone IS NULL
            OR expected_service_days IS NULL
            OR expected_service_days < 1
            OR expected_completion_date IS NULL
            OR (
              EXISTS (SELECT 1 FROM work_order_field_days WHERE work_order_id = work_orders.id)
              AND NOT EXISTS (
                SELECT 1 FROM work_order_field_days
                WHERE work_order_id = work_orders.id AND status IN ('checked_in', 'report_overdue', 'admin_override_open')
              )
              AND (
                SELECT status FROM work_order_field_days
                WHERE work_order_id = work_orders.id
                ORDER BY site_local_date DESC, created_at DESC LIMIT 1
              ) IN ('report_submitted', 'late_report_submitted')
              AND NOT EXISTS (
                SELECT 1 FROM work_order_extension_requests
                WHERE work_order_id = work_orders.id AND status = 'pending'
              )
            )
          )
      `).bind(workOrderId, engineer_id).run();
      if (Number(resolved?.meta?.changes || 0) !== 1) {
        return errorResponse(
          market === 'cn' ? '工单状态或现场记录已变更，请刷新后重试' : 'The work order or field records changed. Refresh and try again',
          409,
        );
      }

      await ensureBalancePayment(env, workOrderId, wo.customer_id);

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
    return jsonResponse({ list: (messages.results || []).map(normalizeWorkOrderMessage) });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

// 发送工单消息
async function handlePostWorkOrderMessage(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const { content, message_type, is_internal_note, attachment_urls } = await request.json();
    const attachments = cleanTextArray(attachment_urls, 8, 500);

    // 认证：sender_type / sender_id / sender_name 从 token 和数据库查，不接受客户端传入
    const auth = request._auth;
    if (!auth) return errorResponse('请先登录', 401);
    if (!content && attachments.length === 0) return errorResponse('消息内容不能为空');

    try {
      if (content) {
      assertMaxLength(content, 'content', LIMITS.content);
      }
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
      (message_type || 'text') === 'text' ? redactContactInfoForWorkOrder(content || '') : (content || '');
    const internalNote = auth.userType === 'customer' ? 0 : (is_internal_note ? 1 : 0);
    const customerVisible = internalNote ? 0 : 1;

    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, attachment_urls, is_internal_note, is_customer_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, workOrderId, sender_type, sender_id, sender_name, safeContent, message_type || 'text', JSON.stringify(attachments), internalNote, customerVisible).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: internalNote ? 'internal_note_created' : 'work_order_message_created',
      afterState: { message_id: id, sender_type, is_internal_note: internalNote },
    });

    // 工单消息推送通知
    if (!internalNote && sender_type !== 'system') {
      const market = getRequestMarket(request);
      const preview = (content || '').slice(0, 100);
      if (sender_type === 'customer' && wo.engineer_id) {
        createNotification(env, {
          user_id: wo.engineer_id,
          user_type: 'engineer',
          type: 'work_order_message',
          title: market === 'cn' ? '工单新消息' : 'New Work Order Message',
          body: market === 'cn'
            ? `工单 ${wo.order_no} 客户消息：${preview}`
            : `Customer replied on ${wo.order_no}: ${preview}`,
          data: { work_order_id: workOrderId, message_id: id },
        });
      } else if (sender_type === 'engineer' && wo.customer_id) {
        createNotification(env, {
          user_id: wo.customer_id,
          user_type: 'customer',
          type: 'work_order_message',
          title: market === 'cn' ? '工单新消息' : 'New Work Order Message',
          body: market === 'cn'
            ? `工单 ${wo.order_no} 工程师回复：${preview}`
            : `Engineer replied on ${wo.order_no}: ${preview}`,
          data: { work_order_id: workOrderId, message_id: id },
        });
      } else if (sender_type === 'admin') {
        if (wo.engineer_id) {
          createNotification(env, {
            user_id: wo.engineer_id,
            user_type: 'engineer',
            type: 'work_order_message',
            title: market === 'cn' ? '工单新消息' : 'New Work Order Message',
            body: market === 'cn' ? `管理员在工单 ${wo.order_no} 留言：${preview}` : `Admin messaged on ${wo.order_no}: ${preview}`,
            data: { work_order_id: workOrderId, message_id: id },
          });
        }
        if (wo.customer_id) {
          createNotification(env, {
            user_id: wo.customer_id,
            user_type: 'customer',
            type: 'work_order_message',
            title: market === 'cn' ? '工单新消息' : 'New Work Order Message',
            body: market === 'cn' ? `管理员在工单 ${wo.order_no} 留言：${preview}` : `Admin messaged on ${wo.order_no}: ${preview}`,
            data: { work_order_id: workOrderId, message_id: id },
          });
        }
      }
    }

    return jsonResponse({ success: true, id, attachment_urls: attachments });
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
    const materialItems = await listWorkOrderMaterialItems(env, workOrderId, { purpose: 'quote' });
    const pricingView = await getWorkOrderPricingView(
      env, wo, pricing, request._auth?.userType === 'customer',
    );
    const visiblePricing = pricingView?.pricing || null;
    if (request._auth?.userType === 'customer' && pricing && !visiblePricing) {
      return jsonResponse({ pricing: null, quote_review_status: wo.quote_review_status || 'pending_review' });
    }
    const paymentPolicy = visiblePricing && !isVersionedQuote(visiblePricing)
      ? computeServicePaymentPolicy(visiblePricing)
      : null;
    const paymentSchedule = pricingView?.payment_schedule || [];
    return jsonResponse({
      pricing: visiblePricing ? {
        ...visiblePricing,
        material_items: materialItems,
        payment_policy: paymentPolicy,
        payment_schedule: paymentSchedule,
      } : null,
      material_items: materialItems,
    });
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
    const market = getRequestMarket(request);
    const copy = serviceCopy(market);
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const body = await request.json();
    const { parts_detail } = body;
    const materialItems = Array.isArray(body.material_items) ? body.material_items : null;
    const structuredPartsFee = materialItems
      ? materialItems.reduce((sum, item) => {
          const quantity = Math.max(0, toSafeNumber(item.quantity, 0));
          const unitPrice = Math.max(0, toSafeNumber(item.unit_price, 0));
          return sum + quantity * unitPrice;
        }, 0)
      : null;
    const fees = {
      labor_fee: body.labor_fee ?? 0,
      parts_fee: structuredPartsFee !== null
      ? Math.round(structuredPartsFee * 100) / 100
      : (body.parts_fee ?? 0),
      travel_fee: body.travel_fee ?? 0,
      other_fee: body.other_fee ?? 0,
    };
    if (Object.values(fees).some((fee) => !Number.isSafeInteger(fee) || fee < 0)) {
      return quoteExecutionError('quote_total_amount_invalid', market);
    }
    const { labor_fee, parts_fee, travel_fee, other_fee } = fees;

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
      return errorResponse(market === 'cn' ? '仅工程师可提交报价' : 'Only engineers can submit quotes', 403);
    }
    const targetEngineerId = auth.userId;

    // 验证工单 + 校验工单归属该工程师
    const wo = await env.DB.prepare('SELECT * FROM work_orders WHERE id = ?').bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.engineer_id !== targetEngineerId) {
      return errorResponse(market === 'cn' ? '您无权对该工单报价' : 'You cannot quote this work order', 403);
    }

    // 读取工程师佣金比例（按等级：Junior 80% / Senior 85% / Expert 88%）
    const engineerRow = await env.DB.prepare(
      'SELECT commission_rate, level FROM engineers WHERE id = ?'
    ).bind(targetEngineerId).first();
    const commissionRate = engineerRow?.commission_rate || 0.80;
    const engineerLevel = engineerRow?.level || 'junior';

    const subtotal = (labor_fee || 0) + (parts_fee || 0) + (travel_fee || 0) + (other_fee || 0);
    const currency = market === 'cn' ? 'CNY' : 'USD';
    const validation = validateQuoteExecution({
      service_mode: wo.service_mode,
      total_amount: subtotal,
      expected_service_days: body.expected_service_days,
      payment_plan_mode: body.payment_plan_mode,
      payment_schedule: body.payment_schedule,
      currency,
    });
    if (validation.code) return quoteExecutionError(validation.code, market);
    const quoteExecution = validation.value;
    const quoteKind = body.quote_kind === 'supplemental' ? 'supplemental' : 'baseline';
    const parentQuoteVersion = quoteKind === 'supplemental'
      ? Number(body.parent_quote_version)
      : null;
    const confirmedReceipt = await env.DB.prepare(`
      SELECT id FROM work_order_receipt_claims
      WHERE work_order_id = ? AND status = 'confirmed'
      LIMIT 1
    `).bind(workOrderId).first();
    if (confirmedReceipt && quoteKind !== 'supplemental') {
      return errorResponse(
        market === 'cn'
          ? '已有确认收款后不能替换基准报价，请提交补充报价。'
          : 'The baseline quote cannot be replaced after a confirmed receipt. Submit a supplemental quote.',
        409,
      );
    }
    if (quoteKind === 'supplemental' && (
      !Number.isInteger(parentQuoteVersion)
      || parentQuoteVersion < 1
      || parentQuoteVersion !== Number(wo.active_quote_version)
    )) {
      return errorResponse(
        market === 'cn'
          ? '补充报价必须关联当前生效的基准报价版本。'
          : 'A supplemental quote must reference the active baseline quote version.',
        409,
      );
    }
    // 代收代付模式：subtotal = 客户支付总额（平台代收）
    // platformFee = 平台技术服务费（平台营收，6%信息技术服务税率）
    // engineerPayout = 维修服务费（代收代付，转付工程师）
    const platformFee = Math.round(subtotal * (1 - commissionRate));
    const depositWithhold = Math.round(subtotal * 0.05);
    const engineerPayout = Math.round(subtotal * commissionRate);

    // AI 审核
    const aiCheck = await checkPricingReasonableness({ labor_fee, parts_fee, travel_fee, other_fee, total_amount: subtotal }, workOrderId, env);

    // 检查是否已有报价
    const existing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    const confirmedCommercialRows = quoteKind === 'supplemental'
      ? await listConfirmedCommercialQuoteVersions(env, existing?.id || '', parentQuoteVersion)
      : [];
    const confirmedCommercial = aggregateCommercialQuoteVersions(confirmedCommercialRows);
    const projectionFees = quoteKind === 'supplemental' ? {
      labor_fee: confirmedCommercial.labor_fee + (labor_fee || 0),
      parts_fee: confirmedCommercial.parts_fee + (parts_fee || 0),
      travel_fee: confirmedCommercial.travel_fee + (travel_fee || 0),
      other_fee: confirmedCommercial.other_fee + (other_fee || 0),
      subtotal: confirmedCommercial.subtotal + subtotal,
      total_amount: confirmedCommercial.total_amount + subtotal,
      platform_fee: confirmedCommercial.platform_fee + platformFee,
      deposit_withhold: confirmedCommercial.deposit_withhold + depositWithhold,
      expected_service_days: confirmedCommercial.expected_service_days ?? quoteExecution.expected_service_days,
      payment_plan_mode: 'installments',
    } : {
      labor_fee: labor_fee || 0,
      parts_fee: parts_fee || 0,
      travel_fee: travel_fee || 0,
      other_fee: other_fee || 0,
      subtotal,
      total_amount: subtotal,
      platform_fee: platformFee,
      deposit_withhold: depositWithhold,
      expected_service_days: quoteExecution.expected_service_days,
      payment_plan_mode: quoteExecution.payment_plan_mode,
    };
    const pricingId = existing?.id || generateId();
    const latestVersion = existing
      ? Number((await env.DB.prepare(
        'SELECT MAX(version) as version FROM work_order_pricing_history WHERE pricing_id = ?'
      ).bind(pricingId).first())?.version || 0)
      : 0;
    const nextVersion = latestVersion + 1;
    const historyId = generateId();
    const statements = [];

    if (quoteKind === 'baseline') {
      statements.push(env.DB.prepare(`
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM work_order_receipt_claims
          WHERE work_order_id = ? AND status = 'confirmed'
        ) THEN 1 ELSE json('quote baseline receipt conflict') END
      `).bind(workOrderId));
    } else {
      statements.push(env.DB.prepare(`
        SELECT CASE WHEN EXISTS (
          SELECT 1
          FROM work_orders work_order
          JOIN work_order_pricing parent_pricing
            ON parent_pricing.work_order_id = work_order.id
          JOIN work_order_pricing_history parent_history
            ON parent_history.pricing_id = parent_pricing.id
           AND parent_history.version = work_order.active_quote_version
          WHERE work_order.id = ?
            AND work_order.active_quote_version = ?
            AND parent_history.quote_kind = 'baseline'
            AND parent_history.status = 'confirmed'
        ) THEN 1 ELSE json('quote supplemental parent conflict') END
      `).bind(workOrderId, parentQuoteVersion));
    }
    statements.push(env.DB.prepare(`
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM work_order_pricing_history
        WHERE pricing_id = ? AND version = ?
          AND status NOT IN ('draft', 'pending_review')
      ) THEN 1 ELSE json('quote retry history protected') END
    `).bind(pricingId, nextVersion));
    statements.push(env.DB.prepare(`
      DELETE FROM work_order_payment_schedule
      WHERE pricing_id = ? AND quote_version = ?
        AND (
          NOT EXISTS (
            SELECT 1 FROM work_order_pricing_history history
            WHERE history.pricing_id = ? AND history.version = ?
          )
          OR EXISTS (
          SELECT 1 FROM work_order_pricing_history history
          WHERE history.pricing_id = ? AND history.version = ?
              AND history.status IN ('draft', 'pending_review')
          )
        )
    `).bind(
      pricingId, nextVersion,
      pricingId, nextVersion,
      pricingId, nextVersion,
    ));

    if (existing) {
      statements.push(env.DB.prepare(`
        UPDATE work_order_pricing SET
          labor_fee = ?, parts_fee = ?, travel_fee = ?, other_fee = ?,
          parts_detail = ?, subtotal = ?, platform_fee = ?,
          deposit_withhold = ?, total_amount = ?, ai_price_check = ?,
          status = 'pending_review', submitted_at = datetime('now'),
          quote_version = ?, expected_service_days = ?, payment_plan_mode = ?
        WHERE work_order_id = ? AND quote_version = ?
      `).bind(
        projectionFees.labor_fee, projectionFees.parts_fee, projectionFees.travel_fee,
        projectionFees.other_fee, JSON.stringify(parts_detail || []), projectionFees.subtotal,
        projectionFees.platform_fee, projectionFees.deposit_withhold, projectionFees.total_amount,
        JSON.stringify(aiCheck), nextVersion, projectionFees.expected_service_days,
        projectionFees.payment_plan_mode, workOrderId, Number(existing.quote_version || 0),
      ));
      statements.push(env.DB.prepare(`
        SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote version concurrent update') END
      `));
    } else {
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_pricing (
          id, work_order_id, engineer_id, labor_fee, parts_fee, travel_fee, other_fee,
          parts_detail, subtotal, platform_fee, deposit_withhold, total_amount,
          ai_price_check, status, submitted_at, quote_version, expected_service_days, payment_plan_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', datetime('now'), ?, ?, ?)
      `).bind(
        pricingId, workOrderId, targetEngineerId, labor_fee || 0, parts_fee || 0,
        travel_fee || 0, other_fee || 0, JSON.stringify(parts_detail || []), subtotal,
        platformFee, depositWithhold, subtotal, JSON.stringify(aiCheck), nextVersion,
        quoteExecution.expected_service_days, quoteExecution.payment_plan_mode,
      ));
    }

    statements.push(env.DB.prepare(`
      INSERT INTO work_order_pricing_history (
        id, pricing_id, labor_fee, parts_fee, travel_fee, other_fee, parts_detail,
        subtotal, total_amount, platform_fee, deposit_withhold, version,
        expected_service_days, payment_plan_mode, quote_kind, parent_quote_version, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
    `).bind(
      historyId, pricingId, labor_fee || 0, parts_fee || 0, travel_fee || 0, other_fee || 0,
      JSON.stringify(parts_detail || []), subtotal, subtotal, platformFee, depositWithhold,
      nextVersion, quoteExecution.expected_service_days, quoteExecution.payment_plan_mode,
      quoteKind, parentQuoteVersion,
    ));
    for (const installment of quoteExecution.payment_schedule) {
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_payment_schedule (
          id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type, due_date, description, required_before_start
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), pricingId, workOrderId, nextVersion, installment.sequence,
        installment.amount, installment.currency, installment.trigger_type,
        installment.due_date, installment.description, installment.required_before_start ? 1 : 0,
      ));
    }
    statements.push(env.DB.prepare(quoteKind === 'supplemental'
      ? "UPDATE work_orders SET quote_review_status = 'pending_review' WHERE id = ?"
      : "UPDATE work_orders SET status = 'pricing', quote_review_status = 'pending_review' WHERE id = ?"
    ).bind(workOrderId));
    statements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'pricing_submitted_for_review',
      beforeState: {
        pricing_projection: quoteProjectionAuditSnapshot(existing),
        quote_review: {
          status: wo.quote_review_status || null,
          quote_version: existing ? Number(existing.quote_version || 0) : null,
          pricing_status: existing?.status || null,
        },
      },
      afterState: {
        quote_review_status: 'pending_review',
        quote_version: nextVersion,
        quote_kind: quoteKind,
        parent_quote_version: parentQuoteVersion,
        subtotal,
        expected_service_days: quoteExecution.expected_service_days,
        payment_plan_mode: quoteExecution.payment_plan_mode,
        payment_schedule: quoteExecution.payment_schedule,
      },
    }));
    if (typeof env.DB.batch !== 'function') throw new Error('Transactional D1 batch is required');
    await env.DB.batch(statements);

    if (materialItems) {
      await replaceWorkOrderMaterialItems(env, request, workOrderId, 'quote', materialItems);
    }

    // 发送内部系统消息：工程师报价建议需要运营复核后才对客户可见。
    const msgId = generateId();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'system', '', ?, ?, 'pricing_update', 1, 0)"
    ).bind(msgId, workOrderId, systemSenderName(market), copy.quoteSubmittedInternal).run();

    return jsonResponse({
      success: true,
      status: 'pending_review',
      quote_version: nextVersion,
      quote_kind: quoteKind,
      parent_quote_version: parentQuoteVersion,
      expected_service_days: quoteExecution.expected_service_days,
      payment_plan_mode: quoteExecution.payment_plan_mode,
      payment_schedule: quoteExecution.payment_schedule,
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
    if (/quote (?:version concurrent update|baseline receipt conflict|supplemental parent conflict|retry history protected)|protected quote payment schedule|malformed json|UNIQUE constraint failed:\s*work_order_pricing\.work_order_id/i.test(String(error?.message || error))) {
      return errorResponse(
        getRequestMarket(request) === 'cn' ? '报价已被更新，请刷新后重试' : 'The quote changed. Refresh and try again.',
        409,
      );
    }
    return errorResponse(error.message, 500);
  }
}

// 客户确认报价
async function handleConfirmWorkOrderPricing(request, env) {
  try {
    const market = getRequestMarket(request);
    const copy = serviceCopy(market);
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const quoteVersion = Number(body.quote_version);

    // 认证：仅客户可确认报价；customer_id 从 token 取
    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse(market === 'cn' ? '仅客户可确认报价' : 'Only the customer can confirm the quote', 403);
    }
    const customer_id = auth.userId;
    if (!Number.isInteger(quoteVersion) || quoteVersion < 1) {
      return errorResponse(market === 'cn' ? '必须提供有效的报价版本' : 'A valid quote version is required', 400);
    }

    // 校验工单归属
    const wo = await env.DB.prepare(
      'SELECT * FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse(market === 'cn' ? '您无权确认该工单报价' : 'You do not have permission to confirm this quote', 403);
    }

    const pricing = await env.DB.prepare(
      'SELECT * FROM work_order_pricing WHERE work_order_id = ?'
    ).bind(workOrderId).first();
    if (!pricing) return errorResponse(market === 'cn' ? '报价不存在' : 'Quote not found', 404);
    if (pricing.status !== 'submitted' || Number(pricing.quote_version) !== quoteVersion) {
      return errorResponse(market === 'cn' ? '报价版本已更新，请刷新后重试' : 'The quote version changed. Refresh and try again.', 409);
    }
    const history = await env.DB.prepare(`
      SELECT * FROM work_order_pricing_history
      WHERE pricing_id = ? AND version = ?
    `).bind(pricing.id, quoteVersion).first();
    if (!history || history.status !== 'approved') {
      return errorResponse(market === 'cn' ? '报价版本已更新，请刷新后重试' : 'The quote version changed. Refresh and try again.', 409);
    }
    const schedule = await listQuotePaymentSchedule(env, workOrderId, quoteVersion);
    if (!schedule.length) {
      return errorResponse(market === 'cn' ? '报价付款计划不完整' : 'The quote payment schedule is incomplete.', 409);
    }
    const scheduleTotal = schedule.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    if (scheduleTotal !== Number(history.total_amount || 0)) {
      return errorResponse(market === 'cn' ? '报价付款计划不完整' : 'The quote payment schedule is incomplete.', 409);
    }
    const supplemental = history.quote_kind === 'supplemental';
    if (supplemental && Number(history.parent_quote_version) !== Number(wo.active_quote_version)) {
      return errorResponse(market === 'cn' ? '报价版本已更新，请刷新后重试' : 'The quote version changed. Refresh and try again.', 409);
    }

    const statements = [env.DB.prepare(`
      UPDATE work_order_pricing_history
      SET status = 'confirmed', confirmed_at = datetime('now')
      WHERE pricing_id = ? AND version = ? AND status = 'approved'
    `).bind(pricing.id, quoteVersion), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote activation concurrent update') END
    `), env.DB.prepare(`
      UPDATE work_order_pricing
      SET status = 'confirmed', confirmed_at = datetime('now')
      WHERE work_order_id = ? AND quote_version = ? AND status = 'submitted'
    `).bind(workOrderId, quoteVersion), env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote activation concurrent update') END
    `)];

    if (supplemental) {
      statements.push(env.DB.prepare(`
        UPDATE work_orders
        SET quote_review_status = 'confirmed'
        WHERE id = ? AND customer_id = ? AND active_quote_version = ? AND EXISTS (
          SELECT 1 FROM work_order_pricing_history baseline
          WHERE baseline.pricing_id = ? AND baseline.version = ?
            AND baseline.quote_kind = 'baseline' AND baseline.status = 'confirmed'
        )
      `).bind(
        workOrderId, customer_id, Number(history.parent_quote_version), pricing.id,
        Number(history.parent_quote_version),
      ));
    } else {
      statements.push(env.DB.prepare(`
        UPDATE work_orders
        SET status = 'pending_payment', quote_review_status = 'confirmed',
          active_quote_version = ?, quote_expected_service_days = ?,
          expected_service_days = CASE
            WHEN service_mode = 'onsite' THEN ?
            WHEN service_mode = 'remote' THEN NULL
            ELSE expected_service_days
          END
        WHERE id = ? AND customer_id = ?
      `).bind(
        quoteVersion, history.expected_service_days ?? null,
        history.expected_service_days ?? null, workOrderId, customer_id,
      ));
    }
    statements.push(env.DB.prepare(`
      SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('quote activation concurrent update') END
    `));
    for (const row of schedule) {
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_installments (
          id, schedule_id, work_order_id, quote_version, sequence, amount, currency,
          trigger_type, due_date, description, required_before_start, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `installment-${row.id}`, row.id, workOrderId, quoteVersion, row.sequence,
        row.amount, row.currency, row.trigger_type, row.due_date, row.description,
        row.required_before_start ? 1 : 0,
        row.trigger_type === 'before_start' ? 'due' : 'scheduled',
      ));
    }
    statements.push(env.DB.prepare(`
      INSERT INTO work_order_messages (
        id, work_order_id, sender_type, sender_id, sender_name, content, message_type
      ) VALUES (?, ?, 'system', '', ?, ?, 'system')
    `).bind(generateId(), workOrderId, systemSenderName(market), copy.quoteConfirmedMessage));
    statements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'pricing_customer_confirmed',
      beforeState: {
        active_quote_version: wo.active_quote_version || null,
        quote: await quoteVersionSnapshot(env, workOrderId, history),
      },
      afterState: {
        active_quote_version: supplemental ? Number(wo.active_quote_version) : quoteVersion,
        quote_version: quoteVersion,
        quote_kind: history.quote_kind || 'baseline',
        installment_count: schedule.length,
      },
    }));
    if (typeof env.DB.batch !== 'function') throw new Error('Transactional D1 batch is required');
    await env.DB.batch(statements);

    // 通知工程师：报价已确认，等待付款
    const notificationTask = (async () => {
      const woConfirm = await env.DB.prepare(
        'SELECT engineer_id, order_no FROM work_orders WHERE id = ?'
      ).bind(workOrderId).first();
      if (!woConfirm?.engineer_id) return;
      await createNotification(env, {
        user_id: woConfirm.engineer_id,
        user_type: 'engineer',
        type: 'pricing_confirmed',
        title: copy.quoteConfirmedTitle,
        body: copy.quoteConfirmedBody(woConfirm.order_no),
        data: { work_order_id: workOrderId },
      });
    })().catch((error) => {
      console.warn('[quote activation] notification failed:', error?.message || error);
    });
    if (request._ctx && typeof request._ctx.waitUntil === 'function') {
      request._ctx.waitUntil(notificationTask);
    } else {
      await notificationTask;
    }

    return jsonResponse({ success: true, quote_version: quoteVersion });
  } catch (error) {
    if (/quote activation concurrent update|malformed json|UNIQUE constraint failed:\s*work_order_installments/i.test(String(error?.message || error))) {
      return errorResponse(
        getRequestMarket(request) === 'cn' ? '报价版本已更新，请刷新后重试' : 'The quote version changed. Refresh and try again.',
        409,
      );
    }
    return errorResponse(error.message, 500);
  }
}

function paymentMethodLabel(method, market = 'com') {
  const labelsEn = {
    bank_transfer: 'Bank Transfer / Wire Transfer',
    paypal_card: 'PayPal / Credit or Debit Card',
    paypal: 'PayPal / Credit or Debit Card',
  };
  const labelsCn = {
    bank_transfer: '银行转账 / 电汇',
    paypal_card: 'PayPal / 信用卡或借记卡',
    paypal: 'PayPal / 信用卡或借记卡',
  };
  const labels = market === 'cn' ? labelsCn : labelsEn;
  return labels[method] || method || (market === 'cn' ? '支付方式' : 'Payment method');
}

function computeServicePaymentPolicy(pricing = {}) {
  const subtotal = Math.max(0, Math.round(Number(pricing.total_amount || pricing.subtotal || 0)));
  const laborFee = Math.max(0, Math.round(Number(pricing.labor_fee || 0)));
  const partsFee = Math.max(0, Math.round(Number(pricing.parts_fee || 0)));
  const travelFee = Math.max(0, Math.round(Number(pricing.travel_fee || 0)));
  const otherFee = Math.max(0, Math.round(Number(pricing.other_fee || 0)));
  const serviceAdvance = Math.ceil((laborFee + otherFee) * 0.5);
  const advanceAmount = Math.max(0, Math.min(subtotal, partsFee + travelFee + serviceAdvance));
  const balanceAmount = Math.max(0, subtotal - advanceAmount);

  return {
    subtotal,
    advance_amount: advanceAmount,
    balance_amount: balanceAmount,
    labor_fee: laborFee,
    parts_fee: partsFee,
    travel_fee: travelFee,
    other_fee: otherFee,
  };
}

async function listQuotePaymentSchedule(env, workOrderId, quoteVersion) {
  if (!Number.isInteger(Number(quoteVersion)) || Number(quoteVersion) < 1) return [];
  const schedule = await env.DB.prepare(`
    SELECT id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, created_at
    FROM work_order_payment_schedule
    WHERE work_order_id = ? AND quote_version = ?
    ORDER BY sequence
  `).bind(workOrderId, Number(quoteVersion)).all();
  return (schedule.results || []).map((row) => ({
    ...row,
    required_before_start: Boolean(row.required_before_start),
  }));
}

function quoteProjectionAuditSnapshot(pricing) {
  if (!pricing) return null;
  return {
    quote_version: Number(pricing.quote_version || 0),
    status: pricing.status || null,
    labor_fee: pricing.labor_fee || 0,
    parts_fee: pricing.parts_fee || 0,
    travel_fee: pricing.travel_fee || 0,
    other_fee: pricing.other_fee || 0,
    subtotal: pricing.subtotal || 0,
    total_amount: pricing.total_amount || 0,
    platform_fee: pricing.platform_fee || 0,
    deposit_withhold: pricing.deposit_withhold || 0,
    expected_service_days: pricing.expected_service_days ?? null,
    payment_plan_mode: pricing.payment_plan_mode || 'single',
  };
}

async function listConfirmedCommercialQuoteVersions(env, pricingId, baselineVersion) {
  if (!pricingId || !Number.isInteger(Number(baselineVersion)) || Number(baselineVersion) < 1) return [];
  const rows = await env.DB.prepare(`
    SELECT * FROM work_order_pricing_history
    WHERE pricing_id = ? AND status = 'confirmed' AND (
      (version = ? AND quote_kind = 'baseline')
      OR (quote_kind = 'supplemental' AND parent_quote_version = ?)
    )
    ORDER BY version
  `).bind(pricingId, Number(baselineVersion), Number(baselineVersion)).all();
  return rows.results || [];
}

function aggregateCommercialQuoteVersions(rows) {
  return rows.reduce((total, row) => ({
    labor_fee: total.labor_fee + Number(row.labor_fee || 0),
    parts_fee: total.parts_fee + Number(row.parts_fee || 0),
    travel_fee: total.travel_fee + Number(row.travel_fee || 0),
    other_fee: total.other_fee + Number(row.other_fee || 0),
    subtotal: total.subtotal + Number(row.subtotal || 0),
    total_amount: total.total_amount + Number(row.total_amount || 0),
    platform_fee: total.platform_fee + Number(row.platform_fee || 0),
    deposit_withhold: total.deposit_withhold + Number(row.deposit_withhold || 0),
    expected_service_days: total.expected_service_days ?? row.expected_service_days ?? null,
  }), {
    labor_fee: 0,
    parts_fee: 0,
    travel_fee: 0,
    other_fee: 0,
    subtotal: 0,
    total_amount: 0,
    platform_fee: 0,
    deposit_withhold: 0,
    expected_service_days: null,
  });
}

function isVersionedQuote(pricing) {
  return Number(pricing?.quote_version || 0) >= 1;
}

function visibleReceiptClaim(row, auth) {
  const visible = {
    id: row.id,
    installment_id: row.installment_id,
    work_order_id: row.work_order_id,
    engineer_id: row.engineer_id,
    claimed_amount: row.claimed_amount,
    status: row.status,
    confirmed_amount: row.confirmed_amount,
    decided_at: row.decided_at,
    created_at: row.created_at,
  };
  if (auth?.userType !== 'customer') {
    visible.transaction_reference = row.transaction_reference;
    visible.engineer_note = row.engineer_note;
    visible.decision_reason = row.decision_reason;
  }
  if (auth?.userType === 'admin') visible.decided_by = row.decided_by;
  return visible;
}

async function getWorkOrderQuoteExecution(env, workOrder, pricing, auth, market = 'com') {
  const customerView = auth?.userType === 'customer';
  if (!pricing) return null;
  if (isVersionedQuote(pricing)) {
    const activeBaselineVersion = Number(workOrder.active_quote_version || 0);
    if (activeBaselineVersion < 1) return null;
    const activeRows = await listConfirmedCommercialQuoteVersions(
      env, pricing.id, activeBaselineVersion,
    );
    if (!activeRows.some((row) => (
      Number(row.version) === activeBaselineVersion && row.quote_kind === 'baseline'
    ))) return null;
    const activeVersions = activeRows.map((row) => Number(row.version));
    const activeQuote = aggregateCommercialQuoteVersions(activeRows);
    const paymentSchedule = await listQuotePaymentSchedules(env, workOrder.id, activeVersions);
    const placeholders = activeVersions.map(() => '?').join(', ');
    const installmentRecords = activeVersions.length > 0
      ? await env.DB.prepare(`
          SELECT * FROM work_order_installments
          WHERE work_order_id = ? AND quote_version IN (${placeholders})
          ORDER BY quote_version, sequence
        `).bind(workOrder.id, ...activeVersions).all()
      : { results: [] };
    const installments = installmentRecords.results || [];
    const claimRecords = installments.length > 0
      ? await env.DB.prepare(`
          SELECT claim.*
          FROM work_order_receipt_claims claim
          JOIN work_order_installments installment
            ON installment.id = claim.installment_id
           AND installment.work_order_id = claim.work_order_id
          JOIN work_orders active_order ON active_order.id = claim.work_order_id
          JOIN work_order_pricing active_pricing
            ON active_pricing.work_order_id = active_order.id
          JOIN work_order_pricing_history history
            ON history.pricing_id = active_pricing.id
           AND history.version = installment.quote_version
          WHERE claim.work_order_id = ?
            AND history.status = 'confirmed'
            AND (
              (history.version = active_order.active_quote_version AND history.quote_kind = 'baseline')
              OR (
                history.quote_kind = 'supplemental'
                AND history.parent_quote_version = active_order.active_quote_version
              )
            )
          ORDER BY claim.created_at, claim.id
        `).bind(workOrder.id).all()
      : { results: [] };
    const claims = claimRecords.results || [];
    const pendingClaimsByInstallment = claims.reduce((counts, claim) => {
      if (claim.status === 'pending') counts[claim.installment_id] = (counts[claim.installment_id] || 0) + 1;
      return counts;
    }, {});
    const normalizedInstallments = installments.map((row) => ({
      ...row,
      required_before_start: Boolean(row.required_before_start),
      pending_claim_count: pendingClaimsByInstallment[row.id] || 0,
    }));
    const initialWorkdays = workOrder.service_mode === 'hybrid'
      ? 0
      : Number(workOrder.quote_expected_service_days || 0);
    const totalAmount = activeQuote.total_amount;
    const latestActiveRow = activeRows.at(-1);
    const summary = summarizeQuoteExecution({
      total_amount: totalAmount,
      installments: normalizedInstallments,
      initial_workdays: initialWorkdays,
      extension_days: Number(workOrder.approved_extension_days || 0),
    });
    return {
      quote_version: Number(latestActiveRow?.version || activeBaselineVersion),
      active_quote_version: activeBaselineVersion,
      payment_plan_mode: activeRows.length > 1
        ? 'installments'
        : (activeRows[0]?.payment_plan_mode || 'single'),
      expected_service_days: activeQuote.expected_service_days,
      initial_workdays: initialWorkdays,
      approved_extension_days: Number(workOrder.approved_extension_days || 0),
      total_amount: totalAmount,
      payment_schedule: paymentSchedule,
      installments: normalizedInstallments,
      receipt_claims: claims.map((claim) => visibleReceiptClaim(claim, auth)),
      ...summary,
    };
  }

  const pricingView = await getWorkOrderPricingView(env, workOrder, pricing, customerView);
  const visiblePricing = pricingView?.pricing || null;
  if (!visiblePricing || visiblePricing.status !== 'confirmed') return null;
  const paymentRecords = await env.DB.prepare(`
    SELECT * FROM work_order_payments WHERE work_order_id = ? ORDER BY created_at ASC
  `).bind(workOrder.id).all();
  const totalAmount = Number(visiblePricing.total_amount || visiblePricing.subtotal || 0);
  const completedPayments = new Map();
  for (const payment of paymentRecords.results || []) {
    if (payment.status !== 'completed') continue;
    const amount = Number(payment.amount);
    const stage = payment.payment_stage || 'advance';
    if (!Number.isSafeInteger(amount) || amount <= 0 || !['advance', 'balance'].includes(stage)) {
      throw new Error('Legacy payment history is inconsistent.');
    }
    const transactionId = String(payment.transaction_id || '').trim();
    const recordId = String(payment.id || '').trim();
    if (!transactionId && !recordId) throw new Error('Legacy payment history is inconsistent.');
    const paymentKey = transactionId ? `transaction:${transactionId}` : `row:${recordId}`;
    const duplicate = completedPayments.get(paymentKey);
    if (duplicate && (duplicate.amount !== amount || duplicate.stage !== stage)) {
      throw new Error('Legacy payment history is inconsistent.');
    }
    if (!duplicate) completedPayments.set(paymentKey, { amount, stage });
  }
  const receivedAmount = [...completedPayments.values()].reduce((sum, payment) => sum + payment.amount, 0);
  if (receivedAmount > totalAmount) throw new Error('Legacy payment history is inconsistent.');
  const installment = {
    id: null,
    schedule_id: null,
    work_order_id: workOrder.id,
    quote_version: null,
    sequence: 1,
    amount: totalAmount,
    currency: market === 'cn' ? 'CNY' : 'USD',
    trigger_type: 'before_start',
    due_date: null,
    description: '',
    required_before_start: true,
    status: receivedAmount >= totalAmount ? 'received' : 'due',
    received_amount: receivedAmount,
    source: 'legacy',
  };
  const summary = summarizeQuoteExecution({
    total_amount: totalAmount,
    installments: [installment],
    initial_workdays: Number(workOrder.expected_service_days || 0),
    extension_days: Number(workOrder.approved_extension_days || 0),
  });
  return {
    legacy: true,
    quote_version: null,
    active_quote_version: null,
    payment_plan_mode: 'single',
    expected_service_days: workOrder.expected_service_days ?? null,
    initial_workdays: Number(workOrder.expected_service_days || 0),
    approved_extension_days: Number(workOrder.approved_extension_days || 0),
    total_amount: totalAmount,
    payment_schedule: [],
    installments: [installment],
    receipt_claims: [],
    ...summary,
  };
}

async function listQuotePaymentSchedules(env, workOrderId, quoteVersions) {
  const versions = [...new Set(quoteVersions.map(Number).filter((version) => (
    Number.isInteger(version) && version >= 1
  )))];
  if (versions.length === 0) return [];
  const schedule = await env.DB.prepare(`
    SELECT id, pricing_id, work_order_id, quote_version, sequence, amount, currency,
      trigger_type, due_date, description, required_before_start, created_at
    FROM work_order_payment_schedule
    WHERE work_order_id = ? AND quote_version IN (${versions.map(() => '?').join(', ')})
    ORDER BY quote_version, sequence
  `).bind(workOrderId, ...versions).all();
  return (schedule.results || []).map((row) => ({
    ...row,
    required_before_start: Boolean(row.required_before_start),
  }));
}

async function getWorkOrderPricingView(env, workOrder, pricing, customerView = false) {
  if (!pricing) return null;
  const currentHistory = await env.DB.prepare(`
    SELECT *
    FROM work_order_pricing_history
    WHERE pricing_id = ? AND version = ?
  `).bind(pricing.id, Number(pricing.quote_version || 0)).first();
  let activeVersion = Number(workOrder.active_quote_version || 0);
  if (currentHistory?.quote_kind === 'supplemental' && !activeVersion) {
    activeVersion = Number((await env.DB.prepare(
      'SELECT active_quote_version FROM work_orders WHERE id = ?'
    ).bind(workOrder.id).first())?.active_quote_version || 0);
  }
  const supplemental = currentHistory?.quote_kind === 'supplemental' && activeVersion > 0;
  if (supplemental) {
    const confirmedRows = await listConfirmedCommercialQuoteVersions(env, pricing.id, activeVersion);
    const active = confirmedRows.find((row) => (
      Number(row.version) === activeVersion && row.quote_kind === 'baseline'
    ));
    if (active) {
      const visibleRows = customerView && !['submitted', 'confirmed'].includes(pricing.status)
        ? confirmedRows
        : [
          ...confirmedRows,
          ...(['pending_review', 'approved'].includes(currentHistory.status) ? [currentHistory] : []),
        ];
      const aggregate = aggregateCommercialQuoteVersions(visibleRows);
      const visibleVersions = visibleRows.map((row) => Number(row.version));
      return {
        pricing: {
          ...pricing,
          ...aggregate,
          id: pricing.id,
          work_order_id: pricing.work_order_id,
          engineer_id: pricing.engineer_id,
          quote_version: customerView && !['submitted', 'confirmed'].includes(pricing.status)
            ? Math.max(...visibleVersions)
            : pricing.quote_version,
          status: customerView && !['submitted', 'confirmed'].includes(pricing.status)
            ? 'confirmed'
            : pricing.status,
          expected_service_days: aggregate.expected_service_days,
          payment_plan_mode: 'installments',
        },
        payment_schedule: await listQuotePaymentSchedules(env, workOrder.id, visibleVersions),
      };
    }
  }
  if (customerView && !['submitted', 'confirmed'].includes(pricing.status)) return null;
  return {
    pricing,
    payment_schedule: await listQuotePaymentSchedule(env, workOrder.id, pricing.quote_version),
  };
}

async function quoteVersionSnapshot(env, workOrderId, history) {
  const paymentSchedule = await listQuotePaymentSchedule(env, workOrderId, history.version);
  return {
    quote_version: history.version,
    status: history.status,
    quote_kind: history.quote_kind || 'baseline',
    parent_quote_version: history.parent_quote_version ?? null,
    labor_fee: history.labor_fee || 0,
    parts_fee: history.parts_fee || 0,
    travel_fee: history.travel_fee || 0,
    other_fee: history.other_fee || 0,
    parts_detail: history.parts_detail || '[]',
    subtotal: history.subtotal || 0,
    total_amount: history.total_amount || 0,
    platform_fee: history.platform_fee || 0,
    deposit_withhold: history.deposit_withhold || 0,
    expected_service_days: history.expected_service_days ?? null,
    payment_plan_mode: history.payment_plan_mode || 'single',
    approved_at: history.approved_at || null,
    confirmed_at: history.confirmed_at || null,
    payment_schedule: paymentSchedule,
  };
}

function installmentCollectionCopy(market = 'com') {
  if (market === 'cn') {
    return {
      workOrderNotFound: '工单或分期不存在',
      engineerOnly: '仅指派工程师可发起本期收款',
      customerOnly: '仅工单客户可选择支付方式',
      customerDenied: '您无权操作此工单',
      notCollectible: '当前分期状态不允许发起收款',
      paymentMethodRequired: '请选择支付方式',
      paymentMethodClosed: '当前分期不能修改支付方式',
      claimNotAllowed: '当前分期不能提交到账申请',
      claimAmountInvalid: '到账申请金额必须为正整数',
      idempotencyRequired: '缺少幂等键',
      evidenceInvalid: '到账凭证仅支持图片或 PDF',
      evidenceTooLarge: '到账凭证不能超过 10MB',
      evidenceSignatureInvalid: '到账凭证文件签名无效',
      evidenceUnavailable: '到账凭证服务未配置',
      evidenceNotFound: '到账凭证不存在',
      evidenceDenied: '您无权查看此到账凭证',
      decisionInvalid: '到账处理结果无效',
      decisionReasonRequired: '拒绝到账申请时必须填写原因',
      confirmedAmountInvalid: '确认到账金额必须为正整数',
      decisionConflict: '到账申请已处理，请刷新后重试',
      overConfirmation: '确认到账金额不能超过本期剩余金额',
      serverError: '服务器内部错误',
      collectionTitle: '本期收款已发起',
      collectionBody: (orderNo) => `工单 ${orderNo} 已发起本期收款，请选择支付方式。`,
      methodTitle: '客户已选择支付方式',
      methodBody: (orderNo) => `工单 ${orderNo} 的客户已选择本期支付方式。`,
      claimTitle: '到账申请已提交',
      claimBody: (orderNo) => `工单 ${orderNo} 已提交到账申请，等待 Admin 核验。`,
      reviewTitle: '到账申请待核验',
      reviewBody: (orderNo) => `工单 ${orderNo} 有新的到账申请，请及时核验。`,
      confirmedTitle: '到账已确认',
      confirmedBody: (orderNo, amount) => `工单 ${orderNo} 已确认到账 ${amount}。`,
      rejectedTitle: '到账申请已退回',
      rejectedBody: (orderNo) => `工单 ${orderNo} 的到账申请已退回，请核对后重新提交。`,
    };
  }
  return {
    workOrderNotFound: 'Work order or installment not found',
    engineerOnly: 'Only the assigned engineer can start installment collection',
    customerOnly: 'Only the work-order customer can select a payment method',
    customerDenied: 'You do not have permission for this work order',
    notCollectible: 'This installment cannot be opened for collection',
    paymentMethodRequired: 'Payment method is required',
    paymentMethodClosed: 'The payment method cannot be changed for this installment',
    claimNotAllowed: 'A receipt claim cannot be submitted for this installment',
    claimAmountInvalid: 'Claimed amount must be a positive whole amount',
    idempotencyRequired: 'Idempotency key is required',
    evidenceInvalid: 'Receipt evidence must be an image or PDF',
    evidenceTooLarge: 'Receipt evidence must not exceed 10MB',
    evidenceSignatureInvalid: 'Receipt evidence file signature is invalid',
    evidenceUnavailable: 'Receipt evidence storage is not configured',
    evidenceNotFound: 'Receipt evidence not found',
    evidenceDenied: 'You do not have permission to view this receipt evidence',
    decisionInvalid: 'Invalid receipt decision',
    decisionReasonRequired: 'A reason is required when rejecting a receipt claim',
    confirmedAmountInvalid: 'Confirmed amount must be a positive whole amount',
    decisionConflict: 'The receipt claim was already decided. Refresh and try again.',
    overConfirmation: 'Confirmed amount cannot exceed the installment balance',
    serverError: 'Internal Server Error',
    collectionTitle: 'Installment collection started',
    collectionBody: (orderNo) => `Collection started for work order ${orderNo}. Select a payment method for this installment.`,
    methodTitle: 'Payment method selected',
    methodBody: (orderNo) => `The customer selected a payment method for work order ${orderNo}.`,
    claimTitle: 'Receipt claim submitted',
    claimBody: (orderNo) => `A receipt claim for work order ${orderNo} is awaiting Admin review.`,
    reviewTitle: 'Receipt claim pending review',
    reviewBody: (orderNo) => `A new receipt claim for work order ${orderNo} requires review.`,
    confirmedTitle: 'Receipt confirmed',
    confirmedBody: (orderNo, amount) => `A receipt of ${amount} was confirmed for work order ${orderNo}.`,
    rejectedTitle: 'Receipt claim rejected',
    rejectedBody: (orderNo) => `The receipt claim for work order ${orderNo} was rejected. Review it and submit again.`,
  };
}

async function getActiveInstallment(env, workOrderId, installmentId) {
  return env.DB.prepare(`
    SELECT installment.*, work_order.customer_id, work_order.engineer_id, work_order.order_no
    FROM work_order_installments installment
    JOIN work_orders work_order ON work_order.id = installment.work_order_id
    JOIN work_order_pricing pricing ON pricing.work_order_id = work_order.id
    JOIN work_order_pricing_history history
      ON history.pricing_id = pricing.id AND history.version = installment.quote_version
    WHERE installment.id = ? AND installment.work_order_id = ?
      AND history.status = 'confirmed'
      AND (
        (history.version = work_order.active_quote_version AND history.quote_kind = 'baseline')
        OR (history.quote_kind = 'supplemental' AND history.parent_quote_version = work_order.active_quote_version)
      )
  `).bind(installmentId, workOrderId).first();
}

function publicInstallment(installment) {
  if (!installment) return installment;
  const { customer_id, engineer_id, order_no, ...visible } = installment;
  return visible;
}

function publicReceiptEvidence(evidence) {
  if (!evidence) return null;
  return {
    id: evidence.id,
    claim_id: evidence.claim_id,
    work_order_id: evidence.work_order_id,
    file_name: evidence.file_name,
    mime_type: evidence.mime_type,
    file_size: evidence.file_size,
    uploader_type: evidence.uploader_type,
    created_at: evidence.created_at,
    url: `/api/workorders/${evidence.work_order_id}/receipt-evidence/${evidence.id}`,
  };
}

async function getReceiptEvidenceForClaim(env, claimId) {
  return env.DB.prepare(`
    SELECT * FROM work_order_receipt_evidence WHERE claim_id = ?
  `).bind(claimId).first();
}

async function notifyQuoteExecutionBestEffort(env, payload) {
  try {
    const notifier = env.QUOTE_EXECUTION_NOTIFIER || createNotification;
    await notifier(env, payload);
  } catch (error) {
    console.warn('[quote execution] notification failed:', error?.message || error);
  }
}

async function notifyReceiptClaimAdminReview(env, request, installment, claimId) {
  try {
    const market = getRequestMarket(request);
    const copy = installmentCollectionCopy(market);
    const staffRecords = await env.DB.prepare(`
      SELECT id FROM admin_staff_accounts
      WHERE is_active = 1 AND role IN ('admin', 'operations') AND market_scope IN ('all', ?)
    `).bind(market).all();
    await Promise.all((staffRecords.results || []).map((staff) => notifyQuoteExecutionBestEffort(env, {
      user_id: staff.id,
      user_type: 'admin',
      type: 'installment_receipt_review_requested',
      title: copy.reviewTitle,
      body: copy.reviewBody(installment.order_no),
      data: {
        work_order_id: installment.work_order_id,
        installment_id: installment.id,
        claim_id: claimId,
      },
    })));
  } catch (error) {
    console.warn('[quote execution] Admin review notification failed:', error?.message || error);
  }
}

async function handleStartInstallmentCollection(request, env) {
  const market = getRequestMarket(request);
  const copy = installmentCollectionCopy(market);
  try {
    const [, , , workOrderId, , installmentId] = new URL(request.url).pathname.split('/');
    const auth = request._auth;
    if (auth?.userType !== 'engineer') return errorResponse(copy.engineerOnly, 403);
    const installment = await getActiveInstallment(env, workOrderId, installmentId);
    if (!installment) return errorResponse(copy.workOrderNotFound, 404);
    if (installment.engineer_id !== auth.userId) return errorResponse(copy.engineerOnly, 403);
    if (!['due', 'partially_received', 'overdue'].includes(installment.status)) {
      return errorResponse(copy.notCollectible, 409);
    }
    const nextStatus = installment.status === 'partially_received' ? 'partially_received' : 'collecting';
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE work_order_installments
        SET status = ?, collection_started_at = COALESCE(collection_started_at, datetime('now')),
          updated_at = datetime('now')
        WHERE id = ? AND work_order_id = ? AND status = ?
          AND EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND engineer_id = ?)
      `).bind(nextStatus, installmentId, workOrderId, installment.status, workOrderId, auth.userId),
      env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('installment collection conflict') END`),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order_installment', targetId: installmentId, action: 'installment_collection_started',
        beforeState: { status: installment.status, collection_started_at: installment.collection_started_at },
        afterState: { status: nextStatus, collection_started: true },
      }),
    ]);
    const saved = await getActiveInstallment(env, workOrderId, installmentId);
    await notifyQuoteExecutionBestEffort(env, {
      user_id: installment.customer_id, user_type: 'customer', type: 'installment_collection_started',
      title: copy.collectionTitle, body: copy.collectionBody(installment.order_no),
      data: { work_order_id: workOrderId, installment_id: installmentId },
    });
    return jsonResponse({ installment: publicInstallment(saved) });
  } catch (error) {
    if (/installment collection conflict|malformed json/i.test(String(error?.message || error))) {
      return errorResponse(copy.notCollectible, 409);
    }
    return errorResponse(copy.serverError, 500);
  }
}

async function handleSelectInstallmentPaymentMethod(request, env) {
  const market = getRequestMarket(request);
  const copy = installmentCollectionCopy(market);
  try {
    const [, , , workOrderId, , installmentId] = new URL(request.url).pathname.split('/');
    const auth = request._auth;
    if (auth?.userType !== 'customer') return errorResponse(copy.customerOnly, 403);
    const installment = await getActiveInstallment(env, workOrderId, installmentId);
    if (!installment) return errorResponse(copy.workOrderNotFound, 404);
    if (installment.customer_id !== auth.userId) return errorResponse(copy.customerDenied, 403);
    const paymentMethod = cleanText((await request.json().catch(() => ({}))).payment_method, 80);
    if (!paymentMethod) return errorResponse(copy.paymentMethodRequired, 400);
    if (!['collecting', 'partially_received', 'overdue'].includes(installment.status)
      || Number(installment.received_amount) >= Number(installment.amount)) {
      return errorResponse(copy.paymentMethodClosed, 409);
    }
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE work_order_installments SET payment_method = ?, updated_at = datetime('now')
        WHERE id = ? AND work_order_id = ? AND received_amount < amount
          AND status IN ('collecting', 'partially_received', 'overdue')
          AND EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND customer_id = ?)
      `).bind(paymentMethod, installmentId, workOrderId, workOrderId, auth.userId),
      env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('installment payment method conflict') END`),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order_installment', targetId: installmentId, action: 'installment_payment_method_selected',
        beforeState: { payment_method: installment.payment_method || null },
        afterState: { payment_method: paymentMethod },
      }),
    ]);
    const saved = await getActiveInstallment(env, workOrderId, installmentId);
    await notifyQuoteExecutionBestEffort(env, {
      user_id: installment.engineer_id, user_type: 'engineer', type: 'installment_payment_method_selected',
      title: copy.methodTitle, body: copy.methodBody(installment.order_no),
      data: { work_order_id: workOrderId, installment_id: installmentId },
    });
    return jsonResponse({ installment: publicInstallment(saved) });
  } catch (error) {
    if (/installment payment method conflict|malformed json/i.test(String(error?.message || error))) {
      return errorResponse(copy.paymentMethodClosed, 409);
    }
    return errorResponse(copy.serverError, 500);
  }
}

async function handleSubmitReceiptClaim(request, env) {
  const market = getRequestMarket(request);
  const copy = installmentCollectionCopy(market);
  const uploadedKeys = [];
  try {
    const [, , , workOrderId, , installmentId] = new URL(request.url).pathname.split('/');
    const auth = request._auth;
    if (auth?.userType !== 'engineer') return errorResponse(copy.engineerOnly, 403);
    const installment = await getActiveInstallment(env, workOrderId, installmentId);
    if (!installment) return errorResponse(copy.workOrderNotFound, 404);
    if (installment.engineer_id !== auth.userId) return errorResponse(copy.engineerOnly, 403);
    const formData = await request.formData();
    const claimedAmount = Number(formData.get('claimed_amount'));
    const idempotencyKey = cleanText(formData.get('idempotency_key'), 200);
    if (!Number.isSafeInteger(claimedAmount) || claimedAmount <= 0) return errorResponse(copy.claimAmountInvalid, 400);
    if (!idempotencyKey) return errorResponse(copy.idempotencyRequired, 400);
    const existing = await env.DB.prepare(`
      SELECT * FROM work_order_receipt_claims WHERE idempotency_key = ?
    `).bind(idempotencyKey).first();
    if (existing) {
      if (existing.work_order_id !== workOrderId || existing.installment_id !== installmentId || existing.engineer_id !== auth.userId) {
        return errorResponse(copy.decisionConflict, 409);
      }
      if (Number(existing.claimed_amount) !== claimedAmount) return errorResponse(copy.decisionConflict, 409);
      return jsonResponse({
        claim: visibleReceiptClaim(existing, auth),
        evidence: publicReceiptEvidence(await getReceiptEvidenceForClaim(env, existing.id)),
        installment: publicInstallment(installment),
      });
    }
    if (!['collecting', 'partially_received', 'overdue'].includes(installment.status)) {
      return errorResponse(copy.claimNotAllowed, 409);
    }

    const evidenceFile = formData.get('evidence');
    let evidence = null;
    const claimId = generateId();
    if (evidenceFile && typeof evidenceFile !== 'string') {
      if (!env.FIELD_EVIDENCE) return errorResponse(copy.evidenceUnavailable, 503);
      if (!RECEIPT_EVIDENCE_MIME_TYPES.has(evidenceFile.type)) return errorResponse(copy.evidenceInvalid, 400);
      if (evidenceFile.size <= 0 || evidenceFile.size > FIELD_EVIDENCE_MAX_BYTES) {
        return errorResponse(copy.evidenceTooLarge, 413);
      }
      const bytes = new Uint8Array(await evidenceFile.arrayBuffer());
      if (!hasFieldEvidenceSignature(bytes, evidenceFile.type)) return errorResponse(copy.evidenceSignatureInvalid, 400);
      const evidenceId = generateId();
      const extension = RECEIPT_EVIDENCE_MIME_TYPES.get(evidenceFile.type);
      const objectKey = `field-evidence/${market}/${workOrderId}/receipt-claims/${claimId}/${evidenceId}.${extension}`;
      uploadedKeys.push(objectKey);
      await env.FIELD_EVIDENCE.put(objectKey, bytes, { httpMetadata: { contentType: evidenceFile.type } });
      evidence = {
        id: evidenceId, claim_id: claimId, work_order_id: workOrderId, object_key: objectKey,
        file_name: sanitizeFilename(evidenceFile.name || `receipt.${extension}`),
        mime_type: evidenceFile.type, file_size: evidenceFile.size,
        uploader_type: 'engineer', uploader_id: auth.userId,
      };
    }

    const transactionReference = cleanText(formData.get('transaction_reference'), 200) || null;
    const engineerNote = cleanText(formData.get('note'), 1000);
    const statements = [
      env.DB.prepare(`
        INSERT INTO work_order_receipt_claims (
          id, installment_id, work_order_id, engineer_id, claimed_amount,
          transaction_reference, engineer_note, status, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        claimId, installmentId, workOrderId, auth.userId, claimedAmount,
        transactionReference, engineerNote, idempotencyKey,
      ),
    ];
    if (evidence) {
      statements.push(env.DB.prepare(`
        INSERT INTO work_order_receipt_evidence (
          id, claim_id, work_order_id, object_key, file_name, mime_type, file_size,
          uploader_type, uploader_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        evidence.id, evidence.claim_id, evidence.work_order_id, evidence.object_key,
        evidence.file_name, evidence.mime_type, evidence.file_size,
        evidence.uploader_type, evidence.uploader_id,
      ));
    }
    statements.push(
      env.DB.prepare(`
        UPDATE work_order_installments SET status = 'pending_confirmation', updated_at = datetime('now')
        WHERE id = ? AND work_order_id = ? AND status IN ('collecting', 'partially_received', 'overdue')
          AND EXISTS (SELECT 1 FROM work_orders WHERE id = ? AND engineer_id = ?)
      `).bind(installmentId, workOrderId, workOrderId, auth.userId),
      env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('receipt claim conflict') END`),
      buildAuditLogStatement(env, request, {
        targetType: 'work_order_receipt_claim', targetId: claimId, action: 'installment_receipt_claim_submitted',
        beforeState: { installment_status: installment.status, received_amount: installment.received_amount },
        afterState: { status: 'pending', claimed_amount: claimedAmount, evidence_id: evidence?.id || null },
      }),
    );
    try {
      await env.DB.batch(statements);
    } catch (error) {
      await cleanupFieldEvidenceObjects(env, uploadedKeys, 'receipt_claim_persistence_failed');
      uploadedKeys.length = 0;
      if (isD1ConstraintError(error) || /receipt claim conflict|malformed json/i.test(String(error?.message || error))) {
        const recovered = await env.DB.prepare(`SELECT * FROM work_order_receipt_claims WHERE idempotency_key = ?`).bind(idempotencyKey).first();
        if (recovered?.work_order_id === workOrderId && recovered.installment_id === installmentId && recovered.engineer_id === auth.userId) {
          return jsonResponse({
            claim: visibleReceiptClaim(recovered, auth),
            evidence: publicReceiptEvidence(await getReceiptEvidenceForClaim(env, recovered.id)),
            installment: publicInstallment(await getActiveInstallment(env, workOrderId, installmentId)),
          });
        }
        return errorResponse(copy.claimNotAllowed, 409);
      }
      throw error;
    }
    uploadedKeys.length = 0;
    const claim = await env.DB.prepare(`SELECT * FROM work_order_receipt_claims WHERE id = ?`).bind(claimId).first();
    const savedInstallment = await getActiveInstallment(env, workOrderId, installmentId);
    await notifyQuoteExecutionBestEffort(env, {
      user_id: installment.customer_id, user_type: 'customer', type: 'installment_receipt_claim_submitted',
      title: copy.claimTitle, body: copy.claimBody(installment.order_no),
      data: { work_order_id: workOrderId, installment_id: installmentId, claim_id: claimId },
    });
    await notifyReceiptClaimAdminReview(env, request, installment, claimId);
    return jsonResponse({
      claim: visibleReceiptClaim(claim, auth),
      evidence: publicReceiptEvidence(evidence),
      installment: publicInstallment(savedInstallment),
    }, 201);
  } catch (error) {
    await cleanupFieldEvidenceObjects(env, uploadedKeys, 'receipt_claim_request_failed');
    return errorResponse(copy.serverError, 500);
  }
}

async function handleGetReceiptEvidence(request, env) {
  const market = getRequestMarket(request);
  const copy = installmentCollectionCopy(market);
  try {
    const [, , , workOrderId, , evidenceId] = new URL(request.url).pathname.split('/');
    const evidence = await env.DB.prepare(`
      SELECT evidence.*, work_order.customer_id, work_order.engineer_id
      FROM work_order_receipt_evidence evidence
      JOIN work_orders work_order ON work_order.id = evidence.work_order_id
      WHERE evidence.id = ? AND evidence.work_order_id = ?
    `).bind(evidenceId, workOrderId).first();
    if (!evidence) return errorResponse(copy.evidenceNotFound, 404);
    const auth = request._auth;
    const allowed = auth?.userType === 'admin'
      || (auth?.userType === 'customer' && evidence.customer_id === auth.userId)
      || (auth?.userType === 'engineer' && evidence.engineer_id === auth.userId);
    if (!allowed) return errorResponse(copy.evidenceDenied, 403);
    if (!env.FIELD_EVIDENCE) return errorResponse(copy.evidenceUnavailable, 503);
    const object = await env.FIELD_EVIDENCE.get(evidence.object_key);
    if (!object) return errorResponse(copy.evidenceNotFound, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': evidence.mime_type,
        'Content-Disposition': `inline; filename="${sanitizeFilename(evidence.file_name)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(copy.serverError, 500);
  }
}

async function handleAdminDecideReceiptClaim(request, env) {
  const market = getRequestMarket(request);
  const copy = installmentCollectionCopy(market);
  try {
    const [, , , , workOrderId, , installmentId, , claimId] = new URL(request.url).pathname.split('/');
    const body = await request.json().catch(() => ({}));
    const decision = body.decision;
    const reason = cleanText(body.reason, 1000);
    const idempotencyKey = cleanText(body.idempotency_key, 200);
    if (!['confirmed', 'rejected'].includes(decision)) return errorResponse(copy.decisionInvalid, 400);
    if (!idempotencyKey) return errorResponse(copy.idempotencyRequired, 400);
    if (decision === 'rejected' && !reason) return errorResponse(copy.decisionReasonRequired, 400);
    const installment = await getActiveInstallment(env, workOrderId, installmentId);
    if (!installment) return errorResponse(copy.workOrderNotFound, 404);
    const claim = await env.DB.prepare(`
      SELECT * FROM work_order_receipt_claims
      WHERE id = ? AND installment_id = ? AND work_order_id = ?
    `).bind(claimId, installmentId, workOrderId).first();
    if (!claim) return errorResponse(copy.workOrderNotFound, 404);
    const normalizedConfirmedAmount = decision === 'confirmed' ? Number(body.confirmed_amount) : null;
    const normalizedReason = reason || null;
    if (claim.decision_idempotency_key === idempotencyKey) {
      const exactRetry = claim.status === decision
        && (decision === 'rejected' || Number(claim.confirmed_amount) === normalizedConfirmedAmount)
        && (claim.decision_reason || null) === normalizedReason;
      if (!exactRetry) return errorResponse(copy.decisionConflict, 409);
      return jsonResponse({ claim: visibleReceiptClaim(claim, request._auth), installment: publicInstallment(installment) });
    }
    if (claim.status !== 'pending') return errorResponse(copy.decisionConflict, 409);

    const statements = [];
    let confirmedAmount = null;
    let nextInstallmentStatus;
    if (decision === 'confirmed') {
      confirmedAmount = normalizedConfirmedAmount;
      if (!Number.isSafeInteger(confirmedAmount) || confirmedAmount <= 0) {
        return errorResponse(copy.confirmedAmountInvalid, 400);
      }
      if (confirmedAmount > Number(installment.amount) - Number(installment.received_amount)) {
        return errorResponse(copy.overConfirmation, 409);
      }
      if (confirmedAmount > Number(claim.claimed_amount)) {
        return errorResponse(copy.overConfirmation, 409);
      }
      nextInstallmentStatus = Number(installment.received_amount) + confirmedAmount === Number(installment.amount)
        ? 'received'
        : 'partially_received';
      statements.push(
        env.DB.prepare(`
          UPDATE work_order_receipt_claims
          SET status = 'confirmed', confirmed_amount = ?, decision_reason = ?, decided_by = ?,
            decided_at = datetime('now'), decision_idempotency_key = ?
          WHERE id = ? AND installment_id = ? AND work_order_id = ? AND status = 'pending'
            AND ? <= claimed_amount
        `).bind(
          confirmedAmount, normalizedReason, request._auth.userId, idempotencyKey,
          claimId, installmentId, workOrderId, confirmedAmount,
        ),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('receipt decision conflict') END`),
        env.DB.prepare(`
          UPDATE work_order_installments
          SET received_amount = received_amount + ?,
            status = CASE WHEN received_amount + ? = amount THEN 'received' ELSE 'partially_received' END,
            completed_at = CASE WHEN received_amount + ? = amount THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
          WHERE id = ? AND work_order_id = ? AND received_amount + ? <= amount
        `).bind(confirmedAmount, confirmedAmount, confirmedAmount, installmentId, workOrderId, confirmedAmount),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('receipt over confirmation') END`),
      );
    } else {
      const submissionAudit = await env.DB.prepare(`
        SELECT before_state FROM audit_logs
        WHERE target_type = 'work_order_receipt_claim' AND target_id = ?
          AND action = 'installment_receipt_claim_submitted'
        ORDER BY created_at DESC LIMIT 1
      `).bind(claimId).first();
      let priorStatus = '';
      try { priorStatus = JSON.parse(submissionAudit?.before_state || '{}').installment_status || ''; } catch {}
      nextInstallmentStatus = ['collecting', 'partially_received', 'overdue'].includes(priorStatus)
        ? priorStatus
        : (Number(installment.received_amount) > 0 ? 'partially_received' : 'collecting');
      statements.push(
        env.DB.prepare(`
          UPDATE work_order_receipt_claims
          SET status = 'rejected', confirmed_amount = NULL, decision_reason = ?, decided_by = ?,
            decided_at = datetime('now'), decision_idempotency_key = ?
          WHERE id = ? AND installment_id = ? AND work_order_id = ? AND status = 'pending'
        `).bind(normalizedReason, request._auth.userId, idempotencyKey, claimId, installmentId, workOrderId),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('receipt decision conflict') END`),
        env.DB.prepare(`
          UPDATE work_order_installments
          SET status = ?, updated_at = datetime('now')
          WHERE id = ? AND work_order_id = ? AND status = 'pending_confirmation'
        `).bind(nextInstallmentStatus, installmentId, workOrderId),
        env.DB.prepare(`SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('receipt decision conflict') END`),
      );
    }
    statements.push(buildAuditLogStatement(env, request, {
      targetType: 'work_order_receipt_claim', targetId: claimId,
      action: decision === 'confirmed' ? 'installment_receipt_confirmed' : 'installment_receipt_rejected',
      beforeState: { claim_status: claim.status, installment_status: installment.status, received_amount: installment.received_amount },
      afterState: {
        claim_status: decision, confirmed_amount: confirmedAmount,
        installment_status: nextInstallmentStatus,
        received_amount: Number(installment.received_amount) + (confirmedAmount || 0),
      },
    }));
    try {
      await env.DB.batch(statements);
    } catch (error) {
      if (/receipt decision conflict|receipt over confirmation|malformed json/i.test(String(error?.message || error)) || isD1ConstraintError(error)) {
        const recovered = await env.DB.prepare(`SELECT * FROM work_order_receipt_claims WHERE id = ?`).bind(claimId).first();
        if (recovered?.decision_idempotency_key === idempotencyKey) {
          const exactRetry = recovered.status === decision
            && (decision === 'rejected' || Number(recovered.confirmed_amount) === normalizedConfirmedAmount)
            && (recovered.decision_reason || null) === normalizedReason;
          if (!exactRetry) return errorResponse(copy.decisionConflict, 409);
          return jsonResponse({
            claim: visibleReceiptClaim(recovered, request._auth),
            installment: publicInstallment(await getActiveInstallment(env, workOrderId, installmentId)),
          });
        }
        if (/receipt over confirmation/i.test(String(error?.message || error))) return errorResponse(copy.overConfirmation, 409);
        return errorResponse(copy.decisionConflict, 409);
      }
      throw error;
    }
    const savedClaim = await env.DB.prepare(`SELECT * FROM work_order_receipt_claims WHERE id = ?`).bind(claimId).first();
    const savedInstallment = await getActiveInstallment(env, workOrderId, installmentId);
    const notificationType = decision === 'confirmed' ? 'installment_receipt_confirmed' : 'installment_receipt_rejected';
    const title = decision === 'confirmed' ? copy.confirmedTitle : copy.rejectedTitle;
    const bodyText = decision === 'confirmed'
      ? copy.confirmedBody(installment.order_no, confirmedAmount)
      : copy.rejectedBody(installment.order_no);
    await Promise.all([
      notifyQuoteExecutionBestEffort(env, {
        user_id: installment.customer_id, user_type: 'customer', type: notificationType,
        title, body: bodyText, data: { work_order_id: workOrderId, installment_id: installmentId, claim_id: claimId },
      }),
      notifyQuoteExecutionBestEffort(env, {
        user_id: installment.engineer_id, user_type: 'engineer', type: notificationType,
        title, body: bodyText, data: { work_order_id: workOrderId, installment_id: installmentId, claim_id: claimId },
      }),
    ]);
    return jsonResponse({ claim: visibleReceiptClaim(savedClaim, request._auth), installment: publicInstallment(savedInstallment) });
  } catch (error) {
    return errorResponse(copy.serverError, 500);
  }
}

function paymentInstructionId(stage) {
  const prefix = stage === 'balance' ? 'BALREQ' : 'ADVREQ';
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function legacyPaymentConflictResponse(market = 'com') {
  return errorResponse(
    market === 'cn'
      ? '新版报价请按分期付款计划操作'
      : 'Use the quote installment schedule for this payment.',
    409,
  );
}

async function hasVersionedWorkOrderPricing(env, workOrderId) {
  const pricing = await env.DB.prepare(
    'SELECT quote_version FROM work_order_pricing WHERE work_order_id = ?'
  ).bind(workOrderId).first();
  return isVersionedQuote(pricing);
}

async function getPaymentByStage(env, workOrderId, paymentStage) {
  return env.DB.prepare(
    'SELECT * FROM work_order_payments WHERE work_order_id = ? AND payment_stage = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(workOrderId, paymentStage).first();
}

async function ensureBalancePayment(env, workOrderId, customerId) {
  const pricing = await env.DB.prepare(
    'SELECT subtotal, total_amount, labor_fee, parts_fee, travel_fee, other_fee, quote_version FROM work_order_pricing WHERE work_order_id = ? AND status = ?'
  ).bind(workOrderId, 'confirmed').first();
  if (!pricing) return null;
  if (isVersionedQuote(pricing)) return null;
  const existing = await getPaymentByStage(env, workOrderId, 'balance');
  if (existing) return existing;

  const policy = computeServicePaymentPolicy(pricing);
  if (policy.balance_amount <= 0) return null;

  const paymentId = generateId();
  await env.DB.prepare(`
    INSERT INTO work_order_payments (
      id, work_order_id, customer_id, amount, payment_method, transaction_id, status,
      payment_stage, quote_total_amount, advance_amount, balance_amount, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    paymentId,
    workOrderId,
    customerId || null,
    policy.balance_amount,
    'bank_transfer',
    paymentInstructionId('balance'),
    'awaiting_customer',
    'balance',
    policy.subtotal,
    policy.advance_amount,
    policy.balance_amount,
    null
  ).run();

  return getPaymentByStage(env, workOrderId, 'balance');
}

// Customer confirms preferred payment method. Collection is followed up by the engineer and confirmed by Admin.
async function handlePayWorkOrder(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const body = await request.json().catch(() => ({}));
    const paymentStage = body.payment_stage === 'balance' ? 'balance' : 'advance';

    const auth = request._auth;
    if (!auth || auth.userType !== 'customer') {
      return errorResponse(getRequestMarket(request) === 'cn' ? '仅客户可确认支付方式' : 'Only the customer can confirm payment method', 403);
    }
    const customer_id = auth.userId;

    const wo = await env.DB.prepare(
      'SELECT id, customer_id, status, order_no, engineer_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(getRequestMarket(request) === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse(getRequestMarket(request) === 'cn' ? '您无权操作此工单' : 'You do not have permission for this work order', 403);
    }
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(getRequestMarket(request));
    }

    const pricing = await env.DB.prepare(
      'SELECT subtotal, total_amount, labor_fee, parts_fee, travel_fee, other_fee, quote_version FROM work_order_pricing WHERE work_order_id = ? AND status = ?'
    ).bind(workOrderId, 'confirmed').first();
    if (!pricing) return errorResponse(getRequestMarket(request) === 'cn' ? '报价未找到或未确认' : 'Quote not found or not confirmed', 404);
    if (paymentStage === 'balance' && !['resolved', 'pending_review', 'completed'].includes(wo.status)) {
      return errorResponse('Work order is not ready for balance payment', 400);
    }
    if (paymentStage === 'advance' && wo.status !== 'pending_payment') {
      return errorResponse(getRequestMarket(request) === 'cn' ? '工单当前状态不允许确认支付方式' : 'Work order is not waiting for payment method confirmation', 400);
    }

    const paymentPolicy = computeServicePaymentPolicy(pricing);
    const amount = paymentStage === 'balance' ? paymentPolicy.balance_amount : paymentPolicy.advance_amount;
    if (amount <= 0) return errorResponse(getRequestMarket(request) === 'cn' ? '报价金额无效' : 'Invalid quote amount', 400);

    const allowedMethods = ['bank_transfer', 'paypal_card', 'paypal'];
    const paymentMethod = allowedMethods.includes(body.payment_method) ? body.payment_method : 'bank_transfer';
    const market = getRequestMarket(request);
    const methodLabel = paymentMethodLabel(paymentMethod, market);

    let payment = await getPaymentByStage(env, workOrderId, paymentStage);
    if (payment?.status === 'completed') {
      return jsonResponse({
        success: true,
        payment: { ...payment, advance_amount: paymentPolicy.advance_amount, balance_amount: paymentPolicy.balance_amount },
      });
    }

    const paymentId = payment?.id || generateId();
    const instructionId = paymentInstructionId(paymentStage);
    if (payment) {
      await env.DB.prepare(`
        UPDATE work_order_payments SET
          customer_id = ?, amount = ?, payment_method = ?, transaction_id = ?, status = ?,
          quote_total_amount = ?, advance_amount = ?, balance_amount = ?, paid_at = NULL
        WHERE id = ?
      `).bind(
        customer_id,
        amount,
        paymentMethod,
        instructionId,
        'instructions_requested',
        paymentPolicy.subtotal,
        paymentPolicy.advance_amount,
        paymentPolicy.balance_amount,
        payment.id
      ).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO work_order_payments (
          id, work_order_id, customer_id, amount, payment_method, transaction_id, status,
          payment_stage, quote_total_amount, advance_amount, balance_amount, paid_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        paymentId,
        workOrderId,
        customer_id,
        amount,
        paymentMethod,
        instructionId,
        'instructions_requested',
        paymentStage,
        paymentPolicy.subtotal,
        paymentPolicy.advance_amount,
        paymentPolicy.balance_amount,
        null
      ).run();
    }

    if (market === 'cn') {
      await env.DB.prepare(
        "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', 'System', ?, 'payment_update')"
      ).bind(
        generateId(),
        workOrderId,
        `客户选择了 ${methodLabel}，金额 ${amount} CNY。工程师跟进收款后，请向管理员申请开工确认。`
      ).run();

      if (wo.engineer_id) {
        await createNotification(env, {
          user_id: wo.engineer_id,
          user_type: 'engineer',
          type: 'payment_method_selected',
          title: '收款跟进提醒',
          body: `工单 ${wo.order_no} 的客户已选择 ${methodLabel}。请跟进收款进度，收到凭证后申请管理员确认开工。`,
          data: { work_order_id: workOrderId, amount, payment_method: paymentMethod },
        });
      }
    } else {
      await env.DB.prepare(
        "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type) VALUES (?, ?, 'system', '', 'System', ?, 'payment_update')"
      ).bind(
        generateId(),
        workOrderId,
        paymentStage === 'balance'
          ? `Customer selected ${methodLabel} for the ${amount} USD service balance. Admin should confirm receipt before final closure.`
          : `Customer selected ${methodLabel} for the ${amount} USD advance payment. Engineer should follow up collection and request Admin approval before service starts.`
      ).run();

      if (wo.engineer_id && paymentStage === 'advance') {
        await createNotification(env, {
          user_id: wo.engineer_id,
          user_type: 'engineer',
          type: 'payment_method_selected',
          title: 'Payment follow-up required',
          body: `Work order ${wo.order_no} selected ${methodLabel} for the advance payment. Follow up collection and request Admin start approval after receipt evidence is available.`,
          data: { work_order_id: workOrderId, amount, payment_method: paymentMethod, payment_stage: paymentStage },
        });
      }
    }

    return jsonResponse({
      success: true,
      payment: {
        id: paymentId,
        transaction_id: instructionId,
        amount,
        payment_stage: paymentStage,
        quote_total_amount: paymentPolicy.subtotal,
        advance_amount: paymentPolicy.advance_amount,
        balance_amount: paymentPolicy.balance_amount,
        payment_method: paymentMethod,
        status: 'instructions_requested',
      }
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleEngineerRequestPaymentStart(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth || auth.userType !== 'engineer') {
      return errorResponse(market === 'cn' ? '仅指派的工程师可申请开工' : 'Only the assigned engineer can request service start', 403);
    }
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim();

    const wo = await env.DB.prepare(
      'SELECT id, engineer_id, status, order_no FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.engineer_id !== auth.userId) return errorResponse(market === 'cn' ? '您未被指派到此工单' : 'You are not assigned to this work order', 403);
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(market);
    }
    if (wo.status !== 'pending_payment' && wo.status !== 'payment_review') {
      return errorResponse(market === 'cn' ? '工单当前状态不允许申请开工' : 'Work order is not waiting for payment follow-up', 400);
    }

    const payment = await env.DB.prepare(
      'SELECT id, status, payment_method, payment_stage FROM work_order_payments WHERE work_order_id = ? AND payment_stage = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(workOrderId, 'advance').first();
    if (!payment) return errorResponse(market === 'cn' ? '客户尚未确认支付方式' : 'Payment method has not been confirmed by the customer', 400);

    await env.DB.prepare(
      "UPDATE work_order_payments SET status = 'pending_admin_confirmation' WHERE id = ?"
    ).bind(payment.id).run();
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'payment_review' WHERE id = ?"
    ).bind(workOrderId).run();

    const internalNote = market === 'cn'
      ? `工程师在收款跟进后申请管理员确认开工。${note ? ` 备注：${note}` : ''}`
      : `Engineer requested Admin approval to start service after payment follow-up.${note ? ` Note: ${note}` : ''}`;

    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'engineer', ?, 'Engineer', ?, 'payment_update', 1, 0)"
    ).bind(
      generateId(),
      workOrderId,
      auth.userId,
      internalNote
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'payment_start_requested',
      beforeState: { status: wo.status, payment_status: payment.status },
      afterState: { status: 'payment_review', payment_status: 'pending_admin_confirmation', note },
    });

    return jsonResponse({ success: true, status: 'payment_review' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleAdminApprovePaymentStart(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const market = getRequestMarket(request);
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim();

    const wo = await env.DB.prepare(
      'SELECT id, status, order_no FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(market);
    }
    if (wo.status !== 'payment_review' && wo.status !== 'pending_payment') {
      return errorResponse(market === 'cn' ? '工单当前状态不允许管理员确认付款' : 'Work order is not waiting for payment approval', 400);
    }

    const payment = await env.DB.prepare(
      'SELECT id, status, payment_method, payment_stage FROM work_order_payments WHERE work_order_id = ? AND payment_stage = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(workOrderId, 'advance').first();
    if (!payment) return errorResponse(market === 'cn' ? '未找到付款记录' : 'Payment record not found', 400);
    if (payment.status !== 'pending_admin_confirmation' && payment.status !== 'instructions_requested') {
      return errorResponse(market === 'cn' ? '付款状态不允许管理员确认' : 'Payment is not ready for Admin confirmation', 400);
    }

    await env.DB.prepare(
      "UPDATE work_order_payments SET status = 'completed', paid_at = datetime('now') WHERE id = ?"
    ).bind(payment.id).run();
    await env.DB.prepare(
      "UPDATE work_orders SET status = 'in_service' WHERE id = ?"
    ).bind(workOrderId).run();

    const confirmMsg = market === 'cn'
      ? `SAGEMRO 已确认收款，工单已获批准可开始服务。${note ? ` 备注：${note}` : ''}`
      : `SAGEMRO confirmed payment receipt. The work order is approved to start service.${note ? ` Note: ${note}` : ''}`;

    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'system', '', 'System', ?, 'payment_update', 0, 1)"
    ).bind(
      generateId(),
      workOrderId,
      confirmMsg
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'payment_start_approved',
      beforeState: { status: wo.status, payment_status: payment.status },
      afterState: { status: 'in_service', payment_status: 'completed', note },
    });

    return jsonResponse({ success: true, status: 'in_service' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}
// 客户提交发票申请
async function handleSubmitInvoiceRequest(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth || auth.userType !== 'customer') {
      return errorResponse(market === 'cn' ? '仅客户可申请发票' : 'Only customers can request invoices', 403);
    }
    const customer_id = auth.userId;

    const wo = await env.DB.prepare(
      'SELECT id, customer_id, status FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (wo.customer_id !== customer_id) {
      return errorResponse(market === 'cn' ? '您无权操作此工单' : 'You do not have permission for this work order', 403);
    }
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(market);
    }

    // 检查是否已有发票申请
    const existing = await env.DB.prepare(
      "SELECT id, status FROM invoice_requests WHERE work_order_id = ? AND status = 'pending' LIMIT 1"
    ).bind(workOrderId).first();
    if (existing) {
      return errorResponse(market === 'cn' ? '已有待处理的发票申请' : 'An invoice request is already pending', 400);
    }

    // 获取工单付款金额
    const payment = await env.DB.prepare(
      "SELECT amount FROM work_order_payments WHERE work_order_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1"
    ).bind(workOrderId).first();
    const amount = payment?.amount || 0;

    const body = await request.json().catch(() => ({}));
    const invoiceId = generateId();

    await env.DB.prepare(`
      INSERT INTO invoice_requests (id, work_order_id, customer_id, invoice_type, company_name, tax_id, company_address, company_phone, bank_name, bank_account, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      invoiceId,
      workOrderId,
      customer_id,
      String(body.invoice_type || '普通发票').trim(),
      String(body.company_name || '').trim(),
      String(body.tax_id || '').trim(),
      String(body.company_address || '').trim(),
      String(body.company_phone || '').trim(),
      String(body.bank_name || '').trim(),
      String(body.bank_account || '').trim(),
      amount,
      String(body.notes || '').trim()
    ).run();

    // 系统消息
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'system', '', 'System', ?, 'invoice_update', 0, 1)"
    ).bind(
      generateId(),
      workOrderId,
      market === 'cn' ? `客户已申请开具发票（${body.company_name || ''}），请管理员处理。` : `Customer requested an invoice (${body.company_name || ''}). Admin to process.`
    ).run();

    return jsonResponse({ success: true, invoice_request: { id: invoiceId, status: 'pending', amount } });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取发票申请状态
async function handleGetInvoiceRequest(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];
    const auth = request._auth;
    const market = getRequestMarket(request);
    if (!auth) return errorResponse(market === 'cn' ? '未认证' : 'Unauthorized', 401);

    const invoiceRequest = await env.DB.prepare(
      'SELECT * FROM invoice_requests WHERE work_order_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(workOrderId).first();

    return jsonResponse({ success: true, invoice_request: invoiceRequest || null });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 管理员处理发票申请（标记已开票）
async function handleAdminApproveWorkOrderBalance(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const market = getRequestMarket(request);
    const body = await request.json().catch(() => ({}));
    const note = String(body.note || '').trim();

    const wo = await env.DB.prepare(
      'SELECT id, status, order_no FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse('Work order not found', 404);
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(market);
    }
    if (!['resolved', 'pending_review', 'completed'].includes(wo.status)) {
      return errorResponse('Work order is not waiting for balance payment', 400);
    }

    const payment = await env.DB.prepare(
      'SELECT id, status, payment_method, payment_stage FROM work_order_payments WHERE work_order_id = ? AND payment_stage = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(workOrderId, 'balance').first();
    if (!payment) return errorResponse('Balance payment record not found', 400);
    if (!['instructions_requested', 'pending_admin_confirmation'].includes(payment.status)) {
      return errorResponse('Balance payment is not ready for Admin confirmation', 400);
    }

    await env.DB.prepare(
      "UPDATE work_order_payments SET status = 'completed', paid_at = datetime('now') WHERE id = ?"
    ).bind(payment.id).run();
    await env.DB.prepare(
      "INSERT INTO work_order_messages (id, work_order_id, sender_type, sender_id, sender_name, content, message_type, is_internal_note, is_customer_visible) VALUES (?, ?, 'system', '', 'System', ?, 'payment_update', 0, 1)"
    ).bind(
      generateId(),
      workOrderId,
      `SAGEMRO confirmed receipt of the service balance. The payment account is settled.${note ? ` ${note}` : ''}`
    ).run();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'balance_payment_approved',
      beforeState: { status: wo.status, payment_status: payment.status },
      afterState: { status: wo.status, payment_status: 'completed', note },
    });

    return jsonResponse({ success: true, status: wo.status, payment_status: 'completed' });
  } catch (error) {
    if (error instanceof GuardError) return errorResponse(error.message, error.status);
    return errorResponse(error.message, 500);
  }
}

async function handleAdminProcessInvoiceRequest(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const market = getRequestMarket(request);
    const body = await request.json().catch(() => ({}));

    const invoiceRequest = await env.DB.prepare(
      "SELECT id, status FROM invoice_requests WHERE work_order_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
    ).bind(workOrderId).first();
    if (!invoiceRequest) {
      return errorResponse(market === 'cn' ? '没有待处理的发票申请' : 'No pending invoice request found', 404);
    }

    await env.DB.prepare(`
      UPDATE invoice_requests SET status = 'issued', invoice_number = ?, admin_notes = ?, issued_at = datetime('now') WHERE id = ?
    `).bind(
      String(body.invoice_number || '').trim(),
      String(body.admin_notes || '').trim(),
      invoiceRequest.id
    ).run();

    return jsonResponse({ success: true, status: 'issued' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// 获取工单付款记录
async function handleAdminUpdateWorkOrderPayout(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[4];
    const market = getRequestMarket(request);
    const body = await request.json().catch(() => ({}));
    const status = String(body.status || '').trim();
    const amount = body.amount === undefined || body.amount === '' ? 0 : Math.round(Number(body.amount));
    const currency = String(body.currency || 'USD').trim().toUpperCase() || 'USD';
    const method = body.method === undefined ? undefined : String(body.method || '').trim();
    const transaction_reference = String(body.transaction_reference || '').trim();
    const internal_note = String(body.internal_note || '').trim();
    const paid_at = String(body.paid_at || '').trim();

    if (!WORK_ORDER_PAYOUT_STATUSES.has(status)) {
      return errorResponse(market === 'cn' ? '不支持的结算状态' : 'Unsupported payout status', 400);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return errorResponse(market === 'cn' ? '结算金额无效' : 'Invalid payout amount', 400);
    }
    if (method && !ENGINEER_PAYOUT_METHODS.has(method)) {
      return errorResponse(market === 'cn' ? '不支持的结算方式' : 'Unsupported payout method', 400);
    }

    const wo = await env.DB.prepare(
      'SELECT id, order_no, engineer_id, status FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    if (!wo) return errorResponse(market === 'cn' ? '工单不存在' : 'Work order not found', 404);
    if (!wo.engineer_id) return errorResponse(market === 'cn' ? '工单未指派工程师' : 'Work order has no assigned engineer', 400);
    if (status === 'completed' && wo.status !== 'completed') {
      return errorResponse(market === 'cn' ? '工单完成后才能确认工程师服务款' : 'Engineer payout can only be completed after the work order is completed', 409);
    }
    if (status === 'completed' && amount <= 0) {
      return errorResponse(market === 'cn' ? '完成结算时金额必须大于 0' : 'Completed payout amount must be greater than zero', 400);
    }

    let payout = await ensureWorkOrderPayout(env, workOrderId, wo.engineer_id, status === 'not_ready' ? 'not_ready' : 'pending');
    if (payout.status === 'completed') {
      if (status === 'completed') {
        return jsonResponse({ success: true, payout, payout_status: payout.status, idempotent: true });
      }
      return errorResponse(market === 'cn' ? '已完成的工程师服务款不能回退' : 'Completed engineer payout cannot be reopened', 409);
    }
    const nextPaidAt = status === 'completed' ? (paid_at || new Date().toISOString()) : (paid_at || payout.paid_at || '');
    const nextMethod = method || payout.method || 'paypal';

    await env.DB.prepare(`
      UPDATE work_order_payouts
      SET status = ?, amount = ?, currency = ?, method = ?, transaction_reference = ?, paid_at = ?, internal_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE work_order_id = ?
    `).bind(status, amount, currency, nextMethod, transaction_reference, nextPaidAt, internal_note, workOrderId).run();

    payout = await env.DB.prepare(
      'SELECT * FROM work_order_payouts WHERE work_order_id = ?'
    ).bind(workOrderId).first();

    await writeAuditLog(env, request, {
      targetType: 'work_order',
      targetId: workOrderId,
      action: 'engineer_payout_updated',
      beforeState: {},
      afterState: { status, amount, currency, method: nextMethod, transaction_reference },
    });

    return jsonResponse({ success: true, payout, payout_status: payout?.status || 'not_ready' });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

async function handleGetWorkOrderPayment(request, env) {
  try {
    const workOrderId = new URL(request.url).pathname.split('/')[3];

    const auth = request._auth;
    if (!auth) return errorResponse('未登录', 401);

    const workOrder = await env.DB.prepare(
      'SELECT id, customer_id, engineer_id, assigned_regional_lead_id FROM work_orders WHERE id = ?'
    ).bind(workOrderId).first();
    assertWorkOrderAccess(request._auth, workOrder);
    if (await hasVersionedWorkOrderPricing(env, workOrderId)) {
      return legacyPaymentConflictResponse(getRequestMarket(request));
    }

    const requestedStage = new URL(request.url).searchParams.get('payment_stage');
    const paymentStage = requestedStage === 'balance' ? 'balance' : 'advance';
    const payment = await getPaymentByStage(env, workOrderId, paymentStage);

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

function cleanFunnelValue(value, max = 160) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function sanitizeFunnelProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
  const out = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!FUNNEL_PROPERTY_ALLOWLIST.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value;
    } else {
      out[key] = cleanFunnelValue(value, 120);
    }
  }
  return out;
}

async function handleFunnelEvent(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventName = cleanFunnelValue(body.event_name, 80);
    if (!FUNNEL_EVENTS.has(eventName)) {
      return errorResponse('Invalid funnel event', 400);
    }

    let auth = null;
    try {
      auth = await authenticateRequest(request, env);
    } catch {
      auth = null;
    }
    if (auth && !hasValidCsrf(request, auth)) {
      return errorResponse('Invalid CSRF token', 403);
    }

    const properties = sanitizeFunnelProperties(body.properties);
    const ip = getRequestIp(request);
    const userAgent = cleanFunnelValue(request.headers.get('user-agent'), 300);
    const ipHash = ip ? await sha256Hex(`${ip}:${userAgent}`) : '';

    await env.DB.prepare(`
      INSERT INTO funnel_events (
        id, event_name, market, anonymous_id, session_id, user_type, user_id,
        source, medium, campaign, page_path, referrer, properties_json, ip_hash, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      eventName,
      getRequestMarket(request),
      cleanFunnelValue(body.anonymous_id, 120),
      cleanFunnelValue(body.session_id, 120),
      auth?.userType || cleanFunnelValue(body.user_type, 40) || 'guest',
      auth?.userId || null,
      cleanFunnelValue(body.source, 120),
      cleanFunnelValue(body.medium, 120),
      cleanFunnelValue(body.campaign, 160),
      cleanFunnelValue(body.page_path, 240),
      cleanFunnelValue(body.referrer, 300),
      JSON.stringify(properties),
      ipHash,
      userAgent,
    ).run();

    return jsonResponse({ success: true }, 202);
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

    const publicResponse = await handlePublicRoute(request, env, ctx, {
      handleOptions,
      handleE2EActivationMailbox,
      handleSendCode,
      handleRegisterCustomer,
      handlePublicEngineerRegistrationClosed: (publicRequest) => (
        localizedErrorResponse('public_engineer_registration_closed', publicRequest, 410)
      ),
      handleLogin,
      handleAuthSession,
      handleLogout: (publicRequest) => (
        clearPortalSession(jsonResponse({ success: true }), publicRequest, env)
      ),
      handleEngineerActivation,
      handleResetPassword,
      handleSendResetCode,
      handleChatUploadImage,
      handleChatTranscribe,
      handleChat,
      handleSubmitLead,
      handleSubmitEngineerApplication,
      handleFunnelEvent,
      handleHealth: () => jsonResponse({ status: 'ok' }),
    });
    if (publicResponse) return publicResponse;

    // Sentry 端到端冒烟测试。匹配 path 就拦下——要么抛错触发 Sentry，要么返回诊断
    // 响应说明为什么没触发，避免 fall through 到后面的认证守卫让人以为路由没生效。
    if (path === '/api/__sentry-test') {
      const testSecret = request.headers.get('X-Sentry-Test-Secret');
      if (
        env.ENVIRONMENT !== 'development'
        || !env.SENTRY_TEST_SECRET
        || testSecret !== env.SENTRY_TEST_SECRET
      ) {
        return errorResponse(getRequestMarket(request) === 'cn' ? '未找到' : 'Not found', 404);
      }
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
    // 生产和非预期环境在加载开发模块前返回 404；开发环境仍要求管理员认证。
    if (isTestRoute(path)) {
      if (env.ENVIRONMENT !== 'development') {
        return errorResponse(getRequestMarket(request) === 'cn' ? '未找到' : 'Not found', 404);
      }
      const admin = await authenticateAdmin(request, env);
      if (!admin) return errorResponse('需要管理员权限', 403);
      const { handleDiagnosticRoute } = await import('./dev/diagnostics.js');
      const response = await handleDiagnosticRoute(request, env, {
        checkPricingReasonableness, computeSlaDeadline, errorResponse, findMatchingEngineers,
        generateId, generateUserNo, generateWorkOrderSummary, getRequestMarket,
        hashPasswordLegacy, jsonResponse, sendPushToEngineer,
      });
      return response || errorResponse(getRequestMarket(request) === 'cn' ? '未找到' : 'Not found', 404);
    }

    // 管理员登录（无需 token）
    if (path === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }

    // ====== 以下接口需要 JWT 认证 ======
    // 先判断 path 是否匹配任一已知受保护路由。不匹配则直接 404，
    // 避免未登录用户 GET /api/random-typo 拿到 401 泄露"此路径需要 token"。
    // 白名单必须与下方已登录路由列表保持同步。
    if (!isKnownProtectedRoute(path)) {
      return errorResponse(getRequestMarket(request) === 'cn' ? '未找到' : 'Not found', 404);
    }

    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return localizedErrorResponse('sign_in_required', request, 401);
    }
    if (!hasValidCsrf(request, auth)) {
      return errorResponse('Invalid CSRF token', 403);
    }

    // 将认证信息挂到 request 上，供 handler 使用。Admin handler 也需要它写审计日志。
    request._auth = auth;

    if (auth.userType === 'admin' && auth.market !== getRequestMarket(request)) {
      return errorResponse('管理员会话无权访问当前市场', 403);
    }

    if (auth.userType === 'admin' && auth.staffId) {
      const staff = await requireActiveStaff(env, auth);
      const requestMarket = getRequestMarket(request);
      const marketAllowed = auth.market === requestMarket
        && (staff?.market_scope === 'all' || staff?.market_scope === requestMarket);
      if (!staff || !marketAllowed) return errorResponse('员工账号不存在、已停用或无权访问当前市场', 403);
      request._auth = {
        ...auth,
        staffRole: staff.role,
        mustChangePassword: Boolean(staff.must_change_password),
      };
      if (staff.must_change_password && path !== '/api/auth/change-password') {
        return errorResponse('请先修改临时密码', 403);
      }
      const operationalRoute = path === '/api/material-requisitions'
        || path.startsWith('/api/material-requisitions/')
        || path === '/api/auth/change-password'
        || (staff.role === 'operations' && isOperationsReadRoute(path, request.method));
      if (staff.role !== 'admin' && !operationalRoute) {
        return errorResponse('当前员工角色无权访问该管理接口', 403);
      }
    }

    // 管理后台 API（需要管理员权限）
    if (path.startsWith('/api/admin/')) {
      if (auth.userType !== 'admin') {
        return errorResponse('需要管理员权限', 403);
      }
      if (path === '/api/admin/staff' && request.method === 'GET') {
        return handleAdminStaffList(request, env);
      }
      if (path === '/api/admin/staff' && request.method === 'POST') {
        return handleAdminStaffCreate(request, env);
      }
      if (path.match(/^\/api\/admin\/staff\/[^/]+\/deactivate$/) && request.method === 'POST') {
        return handleAdminStaffDeactivate(request, env);
      }
      if (path.match(/^\/api\/admin\/staff\/[^/]+\/reset-password$/) && request.method === 'POST') {
        return handleAdminStaffResetPassword(request, env);
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
      if (path.match(/^\/api\/admin\/engineers\/[^/]+$/) && request.method === 'GET') {
        return handleAdminEngineerDetail(request, env);
      }
      if (path.match(/^\/api\/admin\/engineers\/[^/]+$/) && request.method === 'PATCH') {
        return handleAdminUpdateEngineer(request, env);
      }
      if (path === '/api/admin/engineer-applications' && request.method === 'GET') {
        return handleAdminEngineerApplications(request, env);
      }
      if (path.match(/^\/api\/admin\/engineer-applications\/[^/]+\/open-account$/) && request.method === 'POST') {
        return handleAdminOpenEngineerAccount(request, env);
      }
      if (path.match(/^\/api\/admin\/engineer-applications\/[^/]+\/resend-activation$/) && request.method === 'POST') {
        return handleAdminResendEngineerActivation(request, env);
      }
      if (path.startsWith('/api/admin/engineer-applications/') && request.method === 'PATCH') {
        return handleAdminUpdateEngineerApplication(request, env);
      }
      if (path === '/api/admin/material-requests' && request.method === 'GET') {
        return handleListMaterialRequests(request, env, { admin: true });
      }
      if (path.startsWith('/api/admin/material-requests/') && request.method === 'PATCH') {
        return handleAdminReviewMaterialRequest(request, env);
      }
      if (path === '/api/admin/upsell-requests' && request.method === 'GET') {
        return handleAdminListUpsellRequests(request, env);
      }
      if (path.match(/^\/api\/admin\/upsell-requests\/[^/]+$/) && request.method === 'GET') {
        return handleAdminGetUpsellRequest(request, env);
      }
      if (path.match(/^\/api\/admin\/upsell-requests\/[^/]+$/) && request.method === 'PATCH') {
        return handleAdminUpdateUpsellRequest(request, env);
      }
      if (path === '/api/admin/knowledge' && request.method === 'GET') {
        return handleAdminKnowledge(request, env);
      }
      if (path === '/api/admin/knowledge' && request.method === 'POST') {
        return handleAdminCreateKnowledge(request, env);
      }
      if (path.match(/^\/api\/admin\/knowledge\/[^/]+$/) && request.method === 'PATCH') {
        return handleAdminUpdateKnowledge(request, env);
      }
      if (path === '/api/admin/materials' && request.method === 'GET') {
        return handleAdminMaterials(request, env);
      }
      if (path === '/api/admin/materials' && request.method === 'POST') {
        return handleAdminCreateMaterial(request, env);
      }
      if (path.match(/^\/api\/admin\/materials\/[^/]+$/) && request.method === 'PATCH') {
        return handleAdminUpdateMaterial(request, env);
      }
      if (path.match(/^\/api\/admin\/materials\/[^/]+\/inventory-adjustments$/) && request.method === 'POST') {
        return handleAdminMaterialInventoryAdjustment(request, env);
      }
      if (path.startsWith('/api/admin/users/') && request.method === 'DELETE') {
        return handleAdminDeleteUser(request, env);
      }
      if (path === '/api/admin/workorders' && request.method === 'GET') {
        return handleAdminWorkOrders(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/field-plan$/) && request.method === 'PATCH') {
        return handleAdminFieldPlan(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/extension-requests\/[^/]+\/decision$/) && request.method === 'POST') {
        return handleAdminExtensionDecision(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/field-days\/override$/) && request.method === 'POST') {
        return handleAdminFieldDayOverride(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/field-days\/[^/]+\/report$/) && request.method === 'PATCH') {
        return handleAdminCorrectFieldDayReport(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/evidence-holds$/) && request.method === 'POST') {
        return handleAdminOpenEvidenceHold(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/evidence-holds\/[^/]+\/resolve$/) && request.method === 'POST') {
        return handleAdminResolveEvidenceHold(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/onsite-conversion\/confirm$/) && request.method === 'POST') {
        return handleConfirmOnsiteConversion(request, env, { admin: true });
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/arrival-override$/) && request.method === 'POST') {
        return handleAdminArrivalOverride(request, env);
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
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/installments\/[^/]+\/receipt-claims\/[^/]+\/decision$/) && request.method === 'POST') {
        return handleAdminDecideReceiptClaim(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/payment\/approve-start$/) && request.method === 'POST') {
        return handleAdminApprovePaymentStart(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/payment\/approve-balance$/) && request.method === 'POST') {
        return handleAdminApproveWorkOrderBalance(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/payout$/) && request.method === 'PATCH') {
        return handleAdminUpdateWorkOrderPayout(request, env);
      }
      if (path.match(/^\/api\/admin\/workorders\/[^/]+\/invoice-request\/process$/) && request.method === 'POST') {
        return handleAdminProcessInvoiceRequest(request, env);
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
        return errorResponse('整机线索由 Admin 负责销售流转，不转为服务申请', 400);
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

    // 物料搜索：工程师/Admin 可用，只返回协作所需字段
    if (path === '/api/materials' && request.method === 'GET') {
      return handleSearchMaterials(request, env);
    }
    if (path === '/api/material-requests' && request.method === 'GET') {
      return handleListMaterialRequests(request, env);
    }
    if (path === '/api/material-requests' && request.method === 'POST') {
      return handleCreateMaterialRequest(request, env);
    }
    if (path === '/api/material-requisitions' && request.method === 'GET') {
      return handleListMaterialRequisitions(request, env);
    }
    if (path === '/api/material-requisitions' && request.method === 'POST') {
      return handleCreateMaterialRequisition(request, env);
    }
    if (path === '/api/material-requisitions/metrics' && request.method === 'GET') {
      return handleMaterialRequisitionMetrics(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+$/) && request.method === 'GET') {
      return handleGetMaterialRequisition(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/submit$/) && request.method === 'POST') {
      return handleSubmitMaterialRequisition(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/approve$/) && request.method === 'POST') {
      return handleRequisitionDecision(request, env, 'approve');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/reject$/) && request.method === 'POST') {
      return handleRequisitionDecision(request, env, 'reject');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/cancel$/) && request.method === 'POST') {
      return handleRequisitionDecision(request, env, 'cancel');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/items\/[^/]+\/cancel$/) && request.method === 'POST') {
      return handleCancelRequisitionItem(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/stock-allocation$/) && request.method === 'POST') {
      return handleRequisitionLineAction(request, env, 'allocate_stock');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/procurement$/) && request.method === 'POST') {
      return handleRequisitionLineAction(request, env, 'record_purchase');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/procurement$/) && request.method === 'PATCH') {
      return handleUpdateRequisitionProcurement(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/procurement-receipt$/) && request.method === 'POST') {
      return handleRequisitionLineAction(request, env, 'receive_purchase');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/issue$/) && request.method === 'POST') {
      return handleRequisitionLineAction(request, env, 'issue');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/return$/) && request.method === 'POST') {
      return handleRequisitionLineAction(request, env, 'return');
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/engineer-receipt$/) && request.method === 'POST') {
      return handleEngineerRequisitionReceipt(request, env);
    }
    if (path.match(/^\/api\/material-requisitions\/[^/]+\/close$/) && request.method === 'POST') {
      return handleCloseMaterialRequisition(request, env);
    }
    if (path === '/api/upsell-requests' && request.method === 'POST') {
      return handleCreateUpsellRequest(request, env);
    }
    if (path === '/api/upsell-requests/mine' && request.method === 'GET') {
      return handleListMyUpsellRequests(request, env);
    }
    if (path === '/api/leads/machine' && request.method === 'POST') {
      return handleCreateMachineLead(request, env);
    }

    // 工单相关
    if (path === '/api/location/search' && request.method === 'GET') {
      return handleLocationSearch(request, env);
    }
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
    // 工单物料引用（必须在 catch-all GET 之前）
    if (path.match(/^\/api\/workorders\/[^/]+\/material-items$/) && request.method === 'GET') {
      return handleGetWorkOrderMaterialItems(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/material-items$/) && request.method === 'POST') {
      return handleCreateWorkOrderMaterialItem(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/material-items\/[^/]+$/) && request.method === 'PATCH') {
      return handleUpdateWorkOrderMaterialItem(request, env);
    }
    if (path === '/api/workorders/rating' && request.method === 'POST') {
      return handleSubmitRating(request, env);
    }
    // 工单附件（必须在 catch-all GET 之前）
    if (path.match(/^\/api\/workorders\/[^/]+\/field-days\/check-in$/) && request.method === 'POST') {
      return handleFieldDayCheckIn(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/field-days\/[^/]+\/report$/) && request.method === 'POST') {
      return handleSubmitFieldDayReport(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/extension-requests$/) && request.method === 'POST') {
      return handleCreateExtensionRequest(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/field-days$/) && request.method === 'GET') {
      return handleGetFieldDays(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/field-media\/[^/]+$/) && request.method === 'GET') {
      return handleGetFieldMedia(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/receipt-evidence\/[^/]+$/) && request.method === 'GET') {
      return handleGetReceiptEvidence(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/installments\/[^/]+\/collect$/) && request.method === 'POST') {
      return handleStartInstallmentCollection(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/installments\/[^/]+\/payment-method$/) && request.method === 'POST') {
      return handleSelectInstallmentPaymentMethod(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/installments\/[^/]+\/receipt-claims$/) && request.method === 'POST') {
      return handleSubmitReceiptClaim(request, env);
    }
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
    // 工程师到场定位核验
    if (path.match(/^\/api\/workorders\/[^/]+\/arrival-check$/) && request.method === 'POST') {
      return handleWorkOrderArrivalCheck(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/onsite-conversion\/request$/) && request.method === 'POST') {
      return handleRequestOnsiteConversion(request, env);
    }
    if (path.match(/^\/api\/workorders\/[^/]+\/onsite-conversion\/confirm$/) && request.method === 'POST') {
      return handleConfirmOnsiteConversion(request, env);
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
    if (path === '/api/engineers/calendar-events' && request.method === 'GET') {
      return handleGetEngineerCalendarEvents(request, env);
    }
    if (path === '/api/engineers/calendar-events' && request.method === 'POST') {
      return handleCreateEngineerCalendarEvent(request, env);
    }
    if (path.startsWith('/api/engineers/calendar-events/') && request.method === 'DELETE') {
      return handleDeleteEngineerCalendarEvent(request, env);
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
    if (path.match(/^\/api\/workorders\/[^/]+\/payment\/start-request$/) && request.method === 'POST') {
      return handleEngineerRequestPaymentStart(request, env);
    }
    // 获取付款记录
    if (path.match(/^\/api\/workorders\/[^/]+\/payment$/) && request.method === 'GET') {
      return handleGetWorkOrderPayment(request, env);
    }
    // 发票申请（客户提交）
    if (path.match(/^\/api\/workorders\/[^/]+\/invoice-request$/) && request.method === 'POST') {
      return handleSubmitInvoiceRequest(request, env);
    }
    // 获取发票申请状态
    if (path.match(/^\/api\/workorders\/[^/]+\/invoice-request$/) && request.method === 'GET') {
      return handleGetInvoiceRequest(request, env);
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
    return errorResponse(getRequestMarket(request) === 'cn' ? '未找到' : 'Not found', 404);
}

// 将 routeRequest 的响应与动态 CORS 头合并
function withCorsHeaders(response, request, env) {
  const corsH = getCorsHeaders(request, env);
  const securityH = getSecurityHeaders(request, env);
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsH)) {
    newHeaders.set(k, v);
  }
  for (const [k, v] of Object.entries(securityH)) {
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

export function resolveAdminCredentials(request, env) {
  const market = shouldUseCnDatabase(request) ? 'cn' : 'com';
  if (market === 'cn' && env.ADMIN_PHONE_CN && env.ADMIN_PASSWORD_CN) {
    return {
      market,
      phone: env.ADMIN_PHONE_CN,
      password: env.ADMIN_PASSWORD_CN,
    };
  }

  return {
    market,
    phone: env.ADMIN_PHONE,
    password: env.ADMIN_PASSWORD,
  };
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processFieldWorkScheduled(env, controller?.scheduledTime));
  },
  async fetch(request, env, ctx) {
    // 按 API 域名或来源域名路由数据库：CN 站点走 CN 库，其他走 EN 库。
    const requestEnv = env.DB_CN && shouldUseCnDatabase(request)
      ? { ...env, DB: env.DB_CN }
      : env;
    try {
      const response = await routeRequest(request, requestEnv, ctx);
      return withCorsHeaders(response, request, requestEnv);
    } catch (error) {
      console.error('[fetch] unhandled error:', error);
      captureException(error, requestEnv, { request, ctx });
      const corsH = getCorsHeaders(request, requestEnv);
      const securityH = getSecurityHeaders(request, requestEnv);
      return new Response(
        JSON.stringify({ error: error?.message || (getRequestMarket(request) === 'cn' ? '服务器内部错误' : 'Internal Server Error') }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsH, ...securityH },
        }
      );
    }
  },
};
