// 极简 Sentry envelope 客户端（零依赖，为 Cloudflare Worker 定制）
//
// 不用 @sentry/cloudflare：它要求 nodejs_compat + AsyncLocalStorage，增加部署复杂度。
// 我们走 fetch → Sentry envelope ingest endpoint 的直接上报路径，功能够覆盖 99% 场景。
//
// DSN 由 env.SENTRY_DSN 注入（wrangler secret put SENTRY_DSN --env production）。
// DSN 缺失 / 解析失败 / 上报失败：全部静默回退，不抛错，不影响主请求返回。

function parseDsn(dsn) {
  // 格式：https://<public_key>@<host>/<project_id>
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    return {
      host: url.host,
      publicKey,
      projectId,
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

function randomEventId() {
  // Sentry event_id 是 32 位 hex，crypto 在 Workers runtime 可用
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function safeHeaders(request) {
  const out = {};
  const allowed = ['user-agent', 'referer', 'cf-ray', 'cf-ipcountry', 'accept-language'];
  for (const h of allowed) {
    const v = request.headers.get(h);
    if (v) out[h] = v;
  }
  return out;
}

// captureException(error, env, { request, ctx, extra })
// - error: Error 实例（推荐）或任意值
// - env:   Workers env，用于取 SENTRY_DSN + ENVIRONMENT
// - meta:  { request?, ctx?, extra? }
//          request 用于上报 URL + method + 安全 headers
//          ctx 用于 ctx.waitUntil() 让上报异步不阻塞响应
//          extra 是任意 JSON-safe 附加信息
export function captureException(error, env, meta = {}) {
  const dsn = env?.SENTRY_DSN;
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn('[sentry] invalid SENTRY_DSN, dropping event');
    return;
  }

  const eventId = randomEventId();
  const now = Date.now() / 1000;
  const environment = env?.ENVIRONMENT || 'unknown';

  const errorName = error?.name || 'Error';
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || null;

  const event = {
    event_id: eventId,
    timestamp: now,
    platform: 'javascript',
    level: 'error',
    environment,
    logger: 'worker',
    server_name: 'sagemro-worker',
    exception: {
      values: [{
        type: errorName,
        value: errorMessage,
        stacktrace: errorStack ? { frames: [{ filename: '<worker>', function: errorStack }] } : undefined,
      }],
    },
  };

  if (meta.request) {
    event.request = {
      url: meta.request.url,
      method: meta.request.method,
      headers: safeHeaders(meta.request),
    };
    try {
      const u = new URL(meta.request.url);
      event.tags = { ...(event.tags || {}), route: u.pathname, method: meta.request.method };
    } catch { /* ignore */ }
  }

  if (meta.extra) {
    event.extra = meta.extra;
  }

  // envelope = 头 + 条目头 + 条目体，三行 NDJSON
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  const send = fetch(parsed.envelopeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=sagemro-worker/1.0`,
    },
    body: envelope,
  }).catch(err => {
    console.warn('[sentry] upload failed:', err?.message || err);
  });

  // 如果调用方传了 ctx，让上报在响应返回后继续执行，不阻塞用户
  if (meta.ctx?.waitUntil) {
    meta.ctx.waitUntil(send);
  }
}
