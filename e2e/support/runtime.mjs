export function assertLoopbackUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const isLoopback = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname.endsWith('.127.0.0.1.nip.io')
    || hostname === '::1'
    || hostname === '[::1]';
  if (!isLoopback) {
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
