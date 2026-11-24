/**
 * Site-wide maintenance gate.
 *
 * Cloudflare Pages direct uploads honour a pre-bundled `_worker.js` at the root of
 * the uploaded directory (Pages "advanced mode"): the Worker owns every request for
 * that Pages project. Writing that file into a build artifact is therefore the whole
 * shutdown — no workflow change, no DNS change, no Cloudflare dashboard action, and
 * removing the file restores the previous behaviour on the next deployment.
 *
 * The toggle lives in `ops/maintenance/mode.json` and is read at build time by
 * `frontend/scripts/runBuild.mjs` and by the Admin build. One file decides all three
 * international Pages projects. China edition pages are served by nginx on the ECS
 * and are not affected by this file — see ops/maintenance/README.md.
 *
 * The Worker source is generated rather than hand-written into the artifact so the
 * page copy stays in one place and can be unit-tested outside Cloudflare.
 */

import { existsSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAINTENANCE_DIR = fileURLToPath(new URL('.', import.meta.url));
export const MODE_FILE = join(MAINTENANCE_DIR, 'mode.json');
/** Pages reserves leading-underscore files; `_worker.js` is the advanced-mode entry. */
export const WORKER_FILE = '_worker.js';

export const SUPPORT_EMAIL = 'support@sagemro.com';
export const SUPPORT_PHONE_DISPLAY = '+86 186 1558 4520';
export const SUPPORT_PHONE_TEL = '+8618615584520';

/**
 * The zone's email obfuscation rewrites every literal `mailto:` anchor into
 * `/cdn-cgi/l/email-protection#…` and prints `[email protected]` instead — and the
 * Worker answers that path with 503, so the only human contact on the maintenance
 * page would be dead. The `email_off` markers are not preserved through this zone,
 * so the address is entity-encoded instead: browsers decode `&#109;ailto:…&#64;…`
 * into a working link, while the rewriter, which matches the raw markup, sees
 * neither a `mailto:` scheme nor an `address@domain` token.
 */
export const SUPPORT_EMAIL_HTML = SUPPORT_EMAIL.replace('@', '&#64;');
const MAILTO_SCHEME_HTML = '&#109;ailto';

/**
 * @typedef {{ enabled: boolean, updatedAt?: string, reason?: string }} MaintenanceMode
 */

/**
 * Read and validate the toggle.
 *
 * A malformed toggle throws instead of defaulting: a build that cannot prove the
 * intended state must not deploy, because silently publishing an open site during a
 * planned pause is worse than failing the pipeline.
 *
 * @param {string} [modeFile]
 * @returns {MaintenanceMode}
 */
export function readMaintenanceMode(modeFile = MODE_FILE) {
  let raw;
  try {
    raw = readFileSync(modeFile, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read the maintenance toggle at ${modeFile}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`The maintenance toggle at ${modeFile} is not valid JSON: ${error.message}`);
  }
  if (typeof parsed?.enabled !== 'boolean') {
    throw new Error(`The maintenance toggle at ${modeFile} must contain a boolean "enabled" field.`);
  }
  return {
    enabled: parsed.enabled,
    ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    ...(typeof parsed.reason === 'string' ? { reason: parsed.reason } : {}),
  };
}

const COPY = {
  en: {
    lang: 'en',
    title: 'Scheduled maintenance | SAGEMRO',
    heading: 'The site is temporarily paused',
    lead: 'SAGEMRO websites and the AI assistant are offline for planned maintenance. We are working to restore service as quickly as possible, and no data has been lost.',
    urgentLabel: 'Need to reach us now?',
    note: 'This is a temporary maintenance page. Please try again later.',
  },
  'zh-CN': {
    lang: 'zh-CN',
    title: '系统维护中 | SAGEMRO',
    heading: '站点正在临时维护',
    lead: 'SAGEMRO 网站与 AI 助手正在进行计划内维护，暂时无法访问。我们正在尽快恢复服务，数据不受影响。',
    urgentLabel: '需要立即联系？',
    note: '这是临时维护页面，请稍后再来。',
  },
};

const PAGE_STYLE = `:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px 20px;
background:#f4f5f7;color:#17191f;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,"Noto Sans SC",sans-serif;
font-size:16px;line-height:1.65}
main{width:100%;max-width:34rem;margin:0 auto;background:#fff;border:1px solid #e3e6eb;border-radius:14px;padding:36px 32px}
.brand{margin:0 0 18px;font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#6b7280}
h1{margin:0 0 14px;font-size:clamp(22px,4vw,27px);line-height:1.3;font-weight:650;letter-spacing:-.01em}
p{margin:0 0 16px;color:#3d424c}
.urgent{margin:24px 0 0;padding:18px 20px;background:#f7f8fa;border:1px solid #e3e6eb;border-radius:10px}
.urgent p{margin:0 0 8px;font-size:14px;font-weight:600;color:#17191f}
.urgent p:last-child{margin:0;font-weight:400;color:#3d424c}
.urgent a{display:inline-block}
a{color:#0b4fd1;text-decoration:none;border-bottom:1px solid rgba(11,79,209,.3)}
a:hover{border-bottom-color:currentColor}
a:focus-visible{outline:2px solid #0b4fd1;outline-offset:3px;border-radius:3px}
footer{margin:18px 0 0;font-size:13px;color:#6b7280}
@media (max-width:420px){body{padding:20px 14px}main{padding:28px 20px}}`;

/**
 * @param {'en' | 'zh-CN'} lang
 * @returns {string} a complete, dependency-free maintenance document
 */
export function renderMaintenancePage(lang = 'en') {
  const copy = COPY[lang] ?? COPY.en;
  return `<!doctype html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="light">
<title>${copy.title}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
<p class="brand">SAGEMRO</p>
<h1>${copy.heading}</h1>
<p>${copy.lead}</p>
<div class="urgent">
<p>${copy.urgentLabel}</p>
<!--email_off-->
<p><a href="${MAILTO_SCHEME_HTML}:${SUPPORT_EMAIL_HTML}">${SUPPORT_EMAIL_HTML}</a><br><a href="tel:${SUPPORT_PHONE_TEL}">${SUPPORT_PHONE_DISPLAY}</a></p>
<!--/email_off-->
</div>
<footer>${copy.note}</footer>
</main>
</body>
</html>
`;
}

/**
 * The `_worker.js` source deployed into a Pages artifact.
 *
 * It must stay a single self-contained ES module: Pages direct upload does not bundle
 * `_worker.js`, so any import would fail at deploy time. The two documents are
 * embedded as JSON string literals to keep the file syntactically trivial.
 *
 * @returns {string}
 */
export function renderMaintenanceWorkerSource() {
  const pages = {
    en: renderMaintenancePage('en'),
    'zh-CN': renderMaintenancePage('zh-CN'),
  };
  return `// Generated by ops/maintenance/render.mjs from ops/maintenance/mode.json.
// Site-wide temporary pause. Do not edit inside a deployed artifact.
const PAGE_EN = ${JSON.stringify(pages.en)};
const PAGE_ZH = ${JSON.stringify(pages['zh-CN'])};
const CN_HOST = /(^|\\.)sagemro\\.cn$/;
const BASE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'retry-after': '3600',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
export default {
  async fetch(request) {
    const hostname = new URL(request.url).hostname;
    const body = CN_HOST.test(hostname) ? PAGE_ZH : PAGE_EN;
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: BASE_HEADERS });
    }
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: BASE_HEADERS,
    });
  },
};
`;
}

/**
 * Ensure a build artifact matches the toggle: write `_worker.js` when paused, and
 * remove any stale copy when open, so a previously paused artifact can never be
 * published by a later build.
 *
 * @param {string} distDir
 * @param {{ mode?: MaintenanceMode }} [options]
 * @returns {Promise<{ enabled: boolean, path: string }>}
 */
export async function applyMaintenanceArtifact(distDir, options = {}) {
  if (!distDir) throw new Error('applyMaintenanceArtifact requires a build output directory.');
  if (!existsSync(distDir)) {
    throw new Error(`Cannot apply the maintenance artifact: ${distDir} does not exist.`);
  }
  const mode = options.mode ?? readMaintenanceMode();
  const target = join(distDir, WORKER_FILE);
  if (mode.enabled) {
    await writeFile(target, renderMaintenanceWorkerSource(), 'utf8');
    return { enabled: true, path: target };
  }
  await rm(target, { force: true });
  return { enabled: false, path: target };
}
