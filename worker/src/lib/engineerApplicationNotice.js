// 工程师申请表提交后的内部通知邮件。
//
// 触发点：POST /api/engineer-applications（worker/src/index.js -> handleSubmitEngineerApplication）。
// 收件人：默认 support@sagemro.com，可用 env.ENGINEER_APPLICATION_NOTIFY_TO 覆盖（逗号分隔多个）。
// 发件人：沿用已验证的发信域名，默认取 VERIFICATION_EMAIL_FROM（verify@sagemro.com）。
// 附件：把整份申请表渲染成一份自包含 HTML（浏览器打开即可阅读 / 打印为 PDF），base64 内联。
//
// 设计取舍：
// - 通知失败绝不影响申请人：所有出口都是返回值，不抛异常。
// - 优先 EMAIL 绑定（与工程师激活邮件一致，MIME 头由我们自己按 RFC 2047 编码）；
//   未配置 binding 时退回 Resend（原生支持 attachments）。

const DEFAULT_NOTIFY_TO = 'support@sagemro.com';
const DEFAULT_FROM = 'SAGEMRO <verify@sagemro.com>';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function foldBase64(encoded) {
  return encoded.replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/, '');
}

function base64Body(text) {
  return foldBase64(toBase64(text));
}

// 邮件头只允许 ASCII，非 ASCII 必须写成 RFC 2047 的 =?UTF-8?B?...?=。
// 直接把 UTF-8 字节写进 Subject 时，收件端会按 US-ASCII 解码，把每个非 ASCII 字节
// 替换成 "?"——这就是「主题里中文全变问号」的根因。正文不受影响，因为正文有 charset。
function encodeHeaderValue(value) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!/[^\x20-\x7E]/.test(text)) return text;

  const words = [];
  let chunk = '';
  let size = 0;
  for (const character of text) {
    const characterBytes = new TextEncoder().encode(character).length;
    // 单个 encoded-word 不超过 75 字符：=?UTF-8?B?(10) + base64 + ?=(2)，载荷上限约 45 字节。
    if (size + characterBytes > 45) {
      words.push(chunk);
      chunk = '';
      size = 0;
    }
    chunk += character;
    size += characterBytes;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${toBase64(word)}?=`).join('\r\n ');
}

function encodeDisplayName(value) {
  const match = String(value || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return encodeHeaderValue(value);
  const name = match[1].replace(/^"|"$/g, '').trim();
  const address = match[2];
  return name ? `${encodeHeaderValue(name)} <${address}>` : address;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length ? value.join('、') : '—';
  if (typeof value === 'boolean') return value ? '是 / Yes' : '否 / No';
  const text = String(value ?? '').trim();
  return text || '—';
}

function slug(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 24);
}

function attachmentFilename(application) {
  const stamp = String(application.submittedAt || '').slice(0, 10).replace(/-/g, '') || 'undated';
  const who = slug(application.name) || 'applicant';
  const id = String(application.id || '').slice(0, 8) || 'unknown';
  return `sagemro-engineer-application-${stamp}-${who}-${id}.html`;
}

function rows(application) {
  return [
    {
      section: '联系方式 / Contact',
      items: [
        ['姓名 / Name', displayValue(application.name)],
        ['电话 / Phone', displayValue(application.phone)],
        ['邮箱 / Email', displayValue(application.email)],
        ['WhatsApp', displayValue(application.whatsapp)],
        ['国家·省·城市 / Country · Province · City', [application.country, application.province, application.city].filter(Boolean).join(' / ') || '—'],
      ],
    },
    {
      section: '服务范围 / Service scope',
      items: [
        ['常驻区域 / Base region', displayValue(application.baseRegion)],
        ['可服务区域 / Service regions', displayValue(application.serviceRegions)],
        ['可出差 / Can travel', displayValue(Boolean(application.canTravel))],
        ['可周末 / Weekend', displayValue(Boolean(application.canWeekend))],
        ['可夜间 / Night shift', displayValue(Boolean(application.canNight))],
      ],
    },
    {
      section: '能力画像 / Capability',
      items: [
        ['从业年限 / Years of experience', displayValue(application.yearsExperience)],
        ['设备类型 / Equipment', displayValue(application.equipmentTypes)],
        ['品牌经验 / Brands', displayValue(application.brandExperience)],
        ['技能标签 / Skills', displayValue(application.skillTags)],
        ['语言 / Languages', displayValue(application.languages)],
        ['自带工具 / Own tools', displayValue(Boolean(application.hasTools))],
      ],
    },
    {
      section: '经历自述 / Experience summary',
      items: [['自述 / Summary', displayValue(application.experienceSummary)]],
    },
  ];
}

export function buildEngineerApplicationSheet(application) {
  const sectionHtml = rows(application).map(({ section, items }) => `
      <h2>${escapeHtml(section)}</h2>
      <table>
        ${items.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('\n        ')}
      </table>`).join('');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>SAGEMRO 工程师申请 - ${escapeHtml(application.name || application.id)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; font: 13px/1.6 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; color: #183b32; background: #faf7ef; }
  .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e2dccd; padding: 32px 36px 40px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #183b32; padding-bottom: 14px; }
  .brand { font: 700 15px/1.2 ui-monospace, monospace; letter-spacing: .12em; color: #183b32; }
  .brand small { display: block; margin-top: 4px; font: 400 10px/1.4 -apple-system, "Microsoft YaHei", sans-serif; letter-spacing: .06em; color: #6b645b; }
  header .doc { text-align: right; }
  header .doc b { display: block; font-size: 17px; letter-spacing: -.01em; }
  header .doc span { color: #6b645b; font-size: 11px; }
  .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 18px 0 8px; padding: 12px 14px; border-left: 4px solid #bd4c20; background: #f6f2e8; }
  .meta div { font-size: 11px; color: #6b645b; }
  .meta strong { display: block; margin-top: 3px; font: 600 12px/1.4 ui-monospace, monospace; color: #183b32; word-break: break-all; }
  h2 { margin: 22px 0 8px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #bd4c20; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e6e0d2; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12.5px; }
  th { width: 38%; background: #faf8f2; font-weight: 600; color: #4f5e57; }
  td { white-space: pre-wrap; word-break: break-word; }
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e6e0d2; font-size: 10.5px; color: #8a857c; }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">SAGEMRO<small>ENGINEER APPLICATION / 工程师申请表</small></div>
      <div class="doc"><b>${escapeHtml(application.name || '未填写姓名')}</b><span>${escapeHtml(application.market === 'cn' ? '中国版 · sagemro.cn' : 'International · sagemro.com')}</span></div>
    </header>
    <div class="meta">
      <div>申请编号<strong>${escapeHtml(application.id)}</strong></div>
      <div>提交时间 (UTC)<strong>${escapeHtml(application.submittedAt)}</strong></div>
      <div>来源页面<strong>${escapeHtml(application.sourceUrl || '—')}</strong></div>
    </div>${sectionHtml}
    <footer>SAGEMRO 工程师招募 · 本表由 engineer.sagemro.${application.market === 'cn' ? 'cn' : 'com'} 申请表单自动生成，可直接打印为 PDF 归档。</footer>
  </div>
</body>
</html>`;

  return { html, filename: attachmentFilename(application) };
}

function summaryTextLines(application) {
  const lines = rows(application).flatMap(({ section, items }) => [
    `[${section}]`,
    ...items.map(([label, value]) => `  ${label}: ${value}`),
  ]);
  return lines.join('\n');
}

export function buildEngineerApplicationNotice(application) {
  const marketTag = application.market === 'cn' ? 'CN' : 'COM';
  const place = application.city || application.country || (application.market === 'cn' ? '地区未填' : 'region not set');
  const subject = `[SAGEMRO·${marketTag}] 新工程师申请：${application.name || application.id}（${place}）`;
  const text = [
    `收到一份新的工程师申请（${application.market === 'cn' ? '中国版' : '国际版'}）。`,
    '',
    `申请人：${application.name || '—'}`,
    `电话：${application.phone || '—'}`,
    `邮箱：${application.email || '—'}`,
    `地区：${[application.country, application.province, application.city].filter(Boolean).join(' / ') || '—'}`,
    `可服务区域：${displayValue(application.serviceRegions)}`,
    `技能标签：${displayValue(application.skillTags)}`,
    `申请编号：${application.id}`,
    '',
    '完整申请表格见附件（HTML，浏览器打开后可打印为 PDF）。',
    '',
    summaryTextLines(application),
  ].join('\n');

  const html = `<div style="font:14px/1.7 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;color:#183b32">
  <p style="margin:0 0 12px">收到一份新的工程师申请（<strong>${application.market === 'cn' ? '中国版 sagemro.cn' : '国际版 sagemro.com'}</strong>）。</p>
  <table style="border-collapse:collapse;width:100%;max-width:640px">
    ${[
      ['申请人', application.name],
      ['电话', application.phone],
      ['邮箱', application.email],
      ['地区', [application.country, application.province, application.city].filter(Boolean).join(' / ')],
      ['可服务区域', displayValue(application.serviceRegions)],
      ['技能标签', displayValue(application.skillTags)],
      ['从业年限', application.yearsExperience],
      ['申请编号', application.id],
    ].map(([label, value]) => `<tr><td style="padding:6px 10px;border:1px solid #e6e0d2;background:#faf8f2;font-weight:600;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 10px;border:1px solid #e6e0d2">${escapeHtml(displayValue(value))}</td></tr>`).join('')}
  </table>
  <p style="margin:16px 0 0;color:#6b645b">完整申请表格见附件（HTML，浏览器打开后可打印为 PDF）。</p>
  <p style="margin:6px 0 0;color:#6b645b">直接回复本邮件即可联系申请人。</p>
</div>`;

  return { subject, text, html };
}

function notifyRecipients(env) {
  return String(env.ENGINEER_APPLICATION_NOTIFY_TO || DEFAULT_NOTIFY_TO)
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function mimeWithAttachment({ from, to, subject, text, html, attachment, replyTo }) {
  const boundary = `sagemro-notice-${crypto.randomUUID()}`;
  const lines = [
    `From: ${encodeDisplayName(from)}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: multipart/alternative; boundary="alt"',
    '',
    '--alt',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    '--alt',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(html),
    '--alt--',
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8; name="${attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    '',
    foldBase64(attachment.content),
    `--${boundary}--`,
    '',
  ];
  return lines.join('\r\n');
}

export async function sendEngineerApplicationNotice(env, application) {
  const notice = buildEngineerApplicationNotice(application);
  const sheet = buildEngineerApplicationSheet(application);
  const attachment = { filename: sheet.filename, content: toBase64(sheet.html) };
  const to = notifyRecipients(env);
  const from = env.ENGINEER_APPLICATION_NOTIFY_FROM || env.VERIFICATION_EMAIL_FROM || DEFAULT_FROM;
  const replyTo = application.email || undefined;

  if (!to.length) {
    console.warn('[engineer-notice] skipped: no recipient configured');
    return { error: 'no_recipient' };
  }

  // 与工程师激活邮件保持一致：Cloudflare Email binding 优先（我们自己写 MIME 头，编码可控），
  // 未配置该 binding 时才走 Resend。
  if (env.EMAIL?.send) {
    try {
      const EmailMessage = env.__EmailMessage || (await import('cloudflare:email')).EmailMessage;
      const raw = mimeWithAttachment({
        from,
        to: to.join(', '),
        subject: notice.subject,
        text: notice.text,
        html: notice.html,
        attachment,
        replyTo: application.email,
      });
      await env.EMAIL.send(new EmailMessage(from, to.join(', '), raw));
      return { sent: true, provider: 'cloudflare' };
    } catch (error) {
      console.warn('[engineer-notice] Cloudflare email send failed', { reason: error?.message || 'provider_error' });
    }
  }

  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject: notice.subject,
          text: notice.text,
          html: notice.html,
          ...(replyTo ? { reply_to: replyTo } : {}),
          attachments: [attachment],
        }),
      });
      if (!response.ok) {
        console.warn('[engineer-notice] Resend send failed', { status: response.status });
      } else {
        return { sent: true, provider: 'resend' };
      }
    } catch (error) {
      console.warn('[engineer-notice] Resend send error', { reason: error?.message || 'network' });
    }
  }

  console.warn('[engineer-notice] skipped: no email provider configured');
  return { error: 'no_provider' };
}

export const ENGINEER_APPLICATION_NOTIFY_TO = DEFAULT_NOTIFY_TO;
