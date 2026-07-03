#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 20000;

function normalizeCliPath(value) {
  const normalized = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/([A-Za-z]:\/)/, '$1');
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isCliEntry(importMetaUrl, argvPath) {
  if (!argvPath) return false;
  return normalizeCliPath(fileURLToPath(importMetaUrl)) === normalizeCliPath(argvPath);
}

export function buildSmokeTargets() {
  return [
    { key: 'com-home', url: 'https://sagemro.com/', thresholdMs: 5000 },
    { key: 'cn-home', url: 'https://sagemro.cn/', thresholdMs: 6000 },
    { key: 'admin-com', url: 'https://admin.sagemro.com/', thresholdMs: 6000 },
    { key: 'admin-cn', url: 'https://admin.sagemro.cn/', thresholdMs: 7000 },
    { key: 'engineer-com', url: 'https://engineer.sagemro.com/', thresholdMs: 6000 },
    { key: 'engineer-cn', url: 'https://engineer.sagemro.cn/', thresholdMs: 7000 },
    { key: 'api-com-health', url: 'https://api.sagemro.com/health', thresholdMs: 3000 },
    { key: 'api-cn-health', url: 'https://api.sagemro.cn/health', thresholdMs: 5000 },
  ];
}

export function classifyMarket(url) {
  return new URL(url).hostname.endsWith('.cn') ? 'cn' : 'com';
}

export function parseSmokeArgs(argv = []) {
  const args = new Set(argv);
  const chat = args.has('--chat');
  const allowWrite = args.has('--allow-write');
  if (chat && !allowWrite) {
    throw new Error('--chat requires --allow-write because /api/chat creates production conversation/message rows.');
  }
  return {
    chat,
    allowWrite,
    json: args.has('--json'),
  };
}

export function summarizeResult({ key, url, status, elapsedMs, ok, error, thresholdMs }) {
  const result = {
    key,
    market: classifyMarket(url),
    url,
    status,
    elapsedMs,
    ok,
  };
  if (error) result.error = error;
  if (ok && thresholdMs && elapsedMs > thresholdMs) {
    result.warning = `slow: ${elapsedMs}ms > ${thresholdMs}ms`;
  }
  return result;
}

export function buildChatSmokePayload(market, stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)) {
  const isCn = market === 'cn';
  return {
    conversationId: `smoke-${market}-${stamp}`,
    message: isCn
      ? `SAGEMRO_SMOKE_${stamp}: E012 报警，请用中文简短说明可能原因。`
      : `SAGEMRO_SMOKE_${stamp}: What is the protective lens used for? Answer briefly.`,
  };
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return {
      status: response.status,
      elapsedMs: Date.now() - started,
      text,
      ok: response.status >= 200 && response.status < 400,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function smokeTarget(target) {
  try {
    const result = await fetchWithTimeout(target.url, {
      headers: { 'User-Agent': 'SAGEMRO production-smoke/1.0' },
    });
    const looksValid = target.key.includes('health')
      ? result.text.includes('"status":"ok"')
      : /<html|SAGEMRO/i.test(result.text);
    return summarizeResult({
      ...target,
      status: result.status,
      elapsedMs: result.elapsedMs,
      ok: result.ok && looksValid,
      error: looksValid ? '' : 'unexpected response body',
    });
  } catch (error) {
    return summarizeResult({
      ...target,
      status: 0,
      elapsedMs: 0,
      ok: false,
      error: error?.message || String(error),
    });
  }
}

async function smokeChat(market) {
  const isCn = market === 'cn';
  const url = isCn ? 'https://api.sagemro.cn/api/chat' : 'https://api.sagemro.com/api/chat';
  const origin = isCn ? 'https://sagemro.cn' : 'https://sagemro.com';
  const { conversationId, message } = buildChatSmokePayload(market);

  try {
    const result = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
      }),
    }, 30000);
    const summary = summarizeResult({
      key: `api-${market}-chat`,
      url,
      status: result.status,
      elapsedMs: result.elapsedMs,
      ok: result.ok && result.text.length > 0,
      thresholdMs: isCn ? 15000 : 10000,
      error: result.ok ? '' : result.text.slice(0, 200),
    });
    summary.conversationId = conversationId;
    summary.cleanupHint = `Delete conversation/messages by exact conversation_id: ${conversationId}`;
    return summary;
  } catch (error) {
    const summary = summarizeResult({
      key: `api-${market}-chat`,
      url,
      status: 0,
      elapsedMs: 0,
      ok: false,
      error: error?.message || String(error),
    });
    summary.conversationId = conversationId;
    summary.cleanupHint = `Delete conversation/messages by exact conversation_id: ${conversationId}`;
    return summary;
  }
}

async function main() {
  const opts = parseSmokeArgs(process.argv.slice(2));
  const results = [];

  for (const target of buildSmokeTargets()) {
    results.push(await smokeTarget(target));
  }
  if (opts.chat) {
    results.push(await smokeChat('com'));
    results.push(await smokeChat('cn'));
  }

  const summary = {
    createdAt: new Date().toISOString(),
    writeMode: opts.allowWrite ? 'allowed' : 'read-only',
    total: results.length,
    failed: results.filter((result) => !result.ok).length,
    warnings: results.filter((result) => result.warning).length,
    results,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`SAGEMRO production smoke (${summary.writeMode})`);
    for (const result of results) {
      const status = result.ok ? 'PASS' : 'FAIL';
      const warning = result.warning ? ` (${result.warning})` : '';
      const error = result.error ? ` - ${result.error}` : '';
      console.log(`${status} ${result.key} ${result.status} ${result.elapsedMs}ms${warning}${error}`);
    }
    console.log(`Summary: ${summary.total - summary.failed}/${summary.total} passed, warnings=${summary.warnings}`);
  }

  if (summary.failed > 0) process.exitCode = 1;
}

if (isCliEntry(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
