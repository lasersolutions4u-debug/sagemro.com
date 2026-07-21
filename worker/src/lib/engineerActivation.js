function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function createEngineerActivationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function hashEngineerActivationToken(token) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function activationExpiresAt(now = Date.now()) {
  return new Date(now + 48 * 60 * 60 * 1000).toISOString();
}

export function buildEngineerActivationUrl(market, token) {
  const host = market === 'cn'
    ? 'https://engineer.sagemro.cn'
    : 'https://engineer.sagemro.com';
  return `${host}/activate#token=${encodeURIComponent(token)}`;
}

export function buildEngineerActivationEmail({ market, name, engineerNo, activationUrl }) {
  const safeName = escapeHtml(name);
  const safeEngineerNo = escapeHtml(engineerNo);
  const safeActivationUrl = escapeHtml(activationUrl);

  if (market === 'cn') {
    return {
      subject: '激活你的 SAGEMRO 工程师账号',
      text: `${name}，你的工程师编号是 ${engineerNo}。请在 48 小时内打开以下链接设置密码：\n${activationUrl}\n如非本人申请，请忽略本邮件。`,
      html: `<p>${safeName}，你的工程师编号是 <strong>${safeEngineerNo}</strong>。</p><p><a href="${safeActivationUrl}">激活工程师账号</a></p><p>如按钮无法打开，请复制以下完整链接：</p><p>${safeActivationUrl}</p><p>链接将在 48 小时后失效。如非本人申请，请忽略本邮件。</p>`,
    };
  }

  return {
    subject: 'Activate your SAGEMRO engineer account',
    text: `${name}, your engineer number is ${engineerNo}. Set your password within 48 hours:\n${activationUrl}\nIgnore this email if you did not apply.`,
    html: `<p>${safeName}, your engineer number is <strong>${safeEngineerNo}</strong>.</p><p><a href="${safeActivationUrl}">Activate engineer account</a></p><p>If the button does not open, copy this full link:</p><p>${safeActivationUrl}</p><p>This link expires in 48 hours. Ignore this email if you did not apply.</p>`,
  };
}
