import { e2eRuntime } from './runtime.mjs';

export function activationTokenFromMessage(message) {
  const content = `${message?.text || ''}\n${message?.html || ''}`;
  const match = content.match(/\/activate#token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('Activation token was not found in the mailbox message');
  return match[1];
}

export async function getActivationEmail(email, options = {}) {
  const runtime = options.runtime || e2eRuntime();
  const timeoutMs = options.timeoutMs || 10_000;
  const deadline = Date.now() + timeoutMs;
  const url = new URL('/api/_e2e/mailbox/activation', runtime.apiBase);
  url.searchParams.set('email', email);

  while (Date.now() < deadline) {
    const response = await fetch(url, {
      headers: { 'X-E2E-Test-Secret': runtime.testSecret },
    });
    if (response.ok) return response.json();
    if (response.status !== 404) {
      throw new Error(`Activation mailbox returned HTTP ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Activation email for ${email} was not received within ${timeoutMs}ms`);
}
