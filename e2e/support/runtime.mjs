import { randomBytes } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dns from 'node:dns';

export function installLocalDnsMapping() {
  const original = dns.lookup;
  const originalAsync = dns.promises.lookup;
  const isLocalHost = hostname => /^(api|customer|engineer|admin)\.127\.0\.0\.1\.nip\.io$/i.test(hostname);
  dns.lookup = (hostname, options, callback) => {
    if (!isLocalHost(hostname)) return original(hostname, options, callback);
    const done = typeof options === 'function' ? options : callback;
    process.nextTick(() => options?.all ? done(null, [{ address: '127.0.0.1', family: 4 }]) : done(null, '127.0.0.1', 4));
  };
  dns.promises.lookup = async (hostname, options) => {
    if (!isLocalHost(hostname)) return originalAsync(hostname, options);
    if (options?.all && options.family === 6) return [];
    const record = { address: '127.0.0.1', family: 4 };
    return options?.all ? [record] : record;
  };
  return () => { dns.lookup = original; dns.promises.lookup = originalAsync; };
}

export function assertLoopbackUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const isLoopback = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname.endsWith('.127.0.0.1.nip.io')
    || hostname === '::1'
    || hostname === '[::1]';
  if (!isLoopback || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`E2E service URL must use a loopback host: ${url.origin}`);
  }
  return url;
}

export function e2eRuntime(env = process.env) {
  const runtime = {
    apiBase: env.E2E_API_BASE || 'http://api.127.0.0.1.nip.io:8878',
    customerBase: env.E2E_CUSTOMER_BASE || 'http://customer.127.0.0.1.nip.io:4273',
    engineerBase: env.E2E_ENGINEER_BASE || 'http://engineer.127.0.0.1.nip.io:4273',
    adminBase: env.E2E_ADMIN_BASE || 'http://admin.127.0.0.1.nip.io:4274',
    testSecret: env.E2E_TEST_SECRET || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    engineerPassword: env.E2E_ENGINEER_PASSWORD || '',
    customerPassword: env.E2E_CUSTOMER_PASSWORD || '',
  };
  assertLoopbackUrl(runtime.apiBase);
  assertLoopbackUrl(runtime.customerBase);
  assertLoopbackUrl(runtime.engineerBase);
  assertLoopbackUrl(runtime.adminBase);
  if (runtime.testSecret.length < 20) {
    throw new Error('E2E_TEST_SECRET must contain at least 20 characters');
  }
  return runtime;
}

export function localRunPaths(env = process.env) {
  if (!env.E2E_RUN_DIR) throw new Error('E2E_RUN_DIR is required; use the local E2E runner');
  const runDir = path.resolve(env.E2E_RUN_DIR);
  if (!/^sagemro-e2e-/.test(path.basename(runDir))
    || realpathSync(path.dirname(runDir)) !== realpathSync(tmpdir())
    || !lstatSync(runDir).isDirectory() || lstatSync(runDir).isSymbolicLink()) {
    throw new Error('E2E requires an isolated directory directly inside the system temp directory');
  }
  return { runDir, stateDir: path.join(runDir, 'state'), configPath: path.join(runDir, 'wrangler.json') };
}

export function createLocalEnvironment(inherited, runDir) {
  localRunPaths({ E2E_RUN_DIR: runDir });
  for (const key of ['E2E_API_BASE', 'E2E_CUSTOMER_BASE', 'E2E_ENGINEER_BASE', 'E2E_ADMIN_BASE']) {
    if (inherited[key]) assertLoopbackUrl(inherited[key]);
  }
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'CI', 'TERM']);
  const env = Object.fromEntries(Object.entries(inherited).filter(([key, value]) => allowed.has(key.toUpperCase()) && typeof value === 'string'));
  const secret = () => `E2e-${randomBytes(24).toString('hex')}!`;
  return { ...env, E2E_RUN_DIR: runDir, ENVIRONMENT: 'development', E2E_TEST_MODE: 'true',
    E2E_TEST_SECRET: secret(), JWT_SECRET: secret(), ADMIN_PASSWORD: secret(), ADMIN_PASSWORD_CN: secret(),
    E2E_ENGINEER_PASSWORD: secret(), E2E_CUSTOMER_PASSWORD: secret(),
    ADMIN_PHONE: '19900000001', ADMIN_PHONE_CN: '19900000002', DEV_BYPASS_CODE: '246810',
    VERIFICATION_EMAIL_FROM: 'SAGEMRO E2E <e2e@localhost.test>',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', WRANGLER_SEND_METRICS: 'false',
    NO_PROXY: 'localhost,127.0.0.1,.127.0.0.1.nip.io',
  };
}
