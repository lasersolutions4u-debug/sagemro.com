// AI 工具调用确定性日志（ai_trace_logs 表）
//
// 设计目标：
//   - 给 Phase 0 的多轮 tool call 修复 + role guard + specialties 过滤 提供可验证证据
//   - Phase 3 (RAG) / 未来 Agent 化 依赖的链路追溯起点
//
// 使用约定：
//   - 所有 tool call 的执行入口（worker/src/index.js 的 executeTool）调用 logToolCall
//   - 被 role guard 拒绝的调用也要记（resultStatus = 'denied'），否则审计无意义
//   - 失败的调用同样记（resultStatus = 'error' + errorCode）
//   - 全部走 ctx.waitUntil() 异步写入，不阻塞主响应
//   - 写入失败静默 console.warn，不抛错（trace 不能让主流程挂）
//
// 留存策略：60 天（由独立 cron/脚本处理；本文件只负责写入）

// 单条 args_json 的最大字节数。超过则只存 {hash, size}，避免单条日志撑爆 D1
const ARGS_MAX_BYTES = 4096;

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function trimArgs(args) {
  const full = safeStringify(args);
  if (full == null) return { json: null, oversized: false };
  if (full.length <= ARGS_MAX_BYTES) return { json: full, oversized: false };

  // 超大参数：保留 size + 前 512 字符预览，足够调试又不撑爆表
  const preview = full.slice(0, 512);
  return {
    json: JSON.stringify({ _oversized: true, size: full.length, preview }),
    oversized: true,
  };
}

function newId() {
  // D1 主键用 UUID，worker runtime 有 crypto.randomUUID()
  try {
    return crypto.randomUUID();
  } catch {
    // 极端情况下的 fallback，拼时间戳+随机
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * 异步写入一条 trace 日志。调用方保证传入的 env.DB 是 D1 binding。
 *
 * @param {object} params
 * @param {object} params.env              - Workers env（需含 DB）
 * @param {object} [params.ctx]            - Workers ctx（有则走 waitUntil 异步）
 * @param {string} [params.conversationId] - 关联对话 ID（允许 null）
 * @param {string} [params.userId]         - 用户 ID（allow null for guest）
 * @param {string} params.userRole         - 'guest' | 'customer' | 'engineer' | 'admin' | 'system'
 * @param {string} params.toolName         - 例：get_customer_devices
 * @param {any}    [params.args]           - 入参，会被 stringify + 裁剪
 * @param {string} params.resultStatus     - 'ok' | 'denied' | 'error'
 * @param {string} [params.errorCode]      - 失败/拒绝时的错误码，例：permission_denied
 * @param {number} [params.latencyMs]      - 执行耗时（毫秒）
 * @param {number} [params.iteration]      - 多轮 tool call 里的第几轮（0=首轮）
 * @param {number} [params.resultSize]     - 返回体字节数（用于监控预算）
 */
export function logToolCall(params) {
  const {
    env,
    ctx,
    conversationId = null,
    userId = null,
    userRole,
    toolName,
    args,
    resultStatus,
    errorCode = null,
    latencyMs = null,
    iteration = 0,
    resultSize = null,
  } = params;

  if (!env?.DB) {
    console.warn('[trace] env.DB missing, dropping log entry');
    return;
  }

  if (!toolName || !resultStatus || !userRole) {
    console.warn('[trace] missing required field(s):', { toolName, resultStatus, userRole });
    return;
  }

  const { json: argsJson } = trimArgs(args);

  const id = newId();
  const stmt = env.DB.prepare(
    `INSERT INTO ai_trace_logs
       (id, conversation_id, user_id, user_role, tool_name, args_json,
        result_status, error_code, latency_ms, iteration, result_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    conversationId,
    userId,
    userRole,
    toolName,
    argsJson,
    resultStatus,
    errorCode,
    latencyMs,
    iteration,
    resultSize
  );

  const run = stmt.run().catch(err => {
    console.warn('[trace] insert failed:', err?.message || err, { toolName, resultStatus });
  });

  if (ctx?.waitUntil) {
    ctx.waitUntil(run);
  }
  // 没有 ctx 时也不 await，让它在后台 fire-and-forget
  // Workers runtime 在请求返回后可能会回收，但 trace 丢失可接受
}

/**
 * 包装一个异步工具执行函数：自动测量耗时并写日志。
 * 用法：
 *   const result = await measureAndLogToolCall(
 *     { env, ctx, conversationId, userId, userRole, toolName, args, iteration },
 *     () => actualToolExecutor(args)
 *   );
 *
 * 正常返回 -> resultStatus='ok'
 * 抛 PermissionError 或 err.code='permission_denied' -> resultStatus='denied'
 * 其他异常 -> resultStatus='error'
 */
export async function measureAndLogToolCall(meta, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - start;
    const resultSize = safeStringify(result)?.length ?? null;
    logToolCall({
      ...meta,
      resultStatus: 'ok',
      latencyMs,
      resultSize,
    });
    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const isDenied =
      err?.code === 'permission_denied' ||
      err?.name === 'PermissionError';
    logToolCall({
      ...meta,
      resultStatus: isDenied ? 'denied' : 'error',
      errorCode: err?.code || err?.name || 'unknown_error',
      latencyMs,
    });
    throw err;
  }
}

/**
 * PermissionError：服务端 role guard 拒绝工具调用时抛出。
 * executeTool 调用方捕获后应返回 fallback_instruction，不暴露给用户。
 */
export class PermissionError extends Error {
  constructor(message, { toolName, userRole } = {}) {
    super(message);
    this.name = 'PermissionError';
    this.code = 'permission_denied';
    this.toolName = toolName;
    this.userRole = userRole;
  }
}
