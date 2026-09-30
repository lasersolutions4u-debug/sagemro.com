import { OG_LOCALES, SOCIAL_IMAGE_PATH } from '../src/data/companyProfile.js';

const HOSTS = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };

const CRITICAL_SHELL_STYLES = `<style data-seo-shell-critical>
  .seo-static-shell, .seo-static-shell * { box-sizing: border-box; }
  .seo-static-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr);
    margin: 0;
    background: #ffffff;
    color: #171721;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .seo-static-shell__brand {
    padding: 2rem 1.5rem;
    background: #171717;
    border-right: 1px solid #2c2c2c;
  }
  .seo-static-shell__brand a {
    display: inline-flex;
    align-items: center;
    gap: 0.85rem;
    color: #ffffff;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-decoration: none;
  }
  .seo-static-shell__brand img {
    width: 3.75rem;
    height: 3.75rem;
    border-radius: 50%;
    object-fit: cover;
  }
  .seo-static-shell__content {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: clamp(3rem, 7vw, 6.5rem);
  }
  .seo-static-shell__frame { width: min(100%, 74rem); margin: 0 auto; }
  .seo-static-shell h1 {
    max-width: 62rem;
    margin: 0;
    font-size: clamp(2.4rem, 5vw, 4.6rem);
    /*
     * 行高取 1.25，与 App 里标题所用的最大行高比一致（text-3xl / text-5xl 的默认行高即 1.25；
     * 个别页面显式用 leading-[1.12]，仍低于此值）。
     * 与 __intro 同一个道理：React 会用 createRoot() 丢弃重建壳，同一块内容被画两次，
     * 面积更大的那次会反超成为新的 LCP 候选。实测（390px）壳 h1 原为 1.04（41.6px）、
     * React 为 1.25（46.875px），于是 h1 成为决定元素的那几页
     * （CN /services/、CN /insights/、EN /insights/）移动端全部被反超。
     * 取 1.25 保证壳的 h1 在两端都不小于 React，同时这是单向改动：只需更大，
     * 不会让任何本来由壳胜出的页面反过来被反超。
     */
    line-height: 1.25;
    letter-spacing: -0.045em;
  }
  /*
   * line-height 刻意取 2，与 App 里导读的 leading-8（根字号 20px → 40px）一致。
   *
   * 为什么这一条是关键：React 用 createRoot().render() 会把整个壳丢弃重建（不是 hydrate），
   * 所以同一段导读会被画两次，而**更大**的那次会反超成为新的 LCP 候选。
   * 实测（移动端 390px，两侧同文案）：壳 34px 行高 → 面积比 React 小 17.6%，
   * 于是 LCP 从 1.48s 被推到 2.94s。改成 40px 后两边面积相等，先画出的壳保持为 LCP 候选
   * （等大不替换），交接时也不再有多余的排版跳动。
   *
   * 字号与 max-width 保持原样不动：clamp 让壳在桌面端比 App 更大，本来就安全；
   * 上一版把它们一起调小，反而让 React 在桌面端反超（0.656 → 1.045），所以撤回那部分。
   */
  .seo-static-shell__intro {
    max-width: 58rem;
    margin: 1.5rem 0 0;
    color: #66616f;
    font-size: clamp(1rem, 1.8vw, 1.25rem);
    line-height: 2;
  }
  .seo-static-shell__details {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.875rem;
    margin-top: 2.5rem;
  }
  .seo-static-shell__details > * {
    min-width: 0;
    margin: 0;
    padding: 1rem;
    border: 1px solid #e8e5eb;
    border-radius: 1rem;
    background: #faf9fb;
    color: #35313b;
    line-height: 1.45;
  }
  .seo-static-shell__details a { color: inherit; text-decoration: none; }
  @media (max-width: 980px) {
    .seo-static-shell__details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .seo-static-shell { display: block; }
    .seo-static-shell__brand { padding: 0.875rem 1.25rem; border-right: 0; }
    .seo-static-shell__brand img { width: 2.75rem; height: 2.75rem; }
    .seo-static-shell__content { align-items: flex-start; padding: 2.5rem 1.25rem 3rem; }
    .seo-static-shell h1 { font-size: clamp(2rem, 10vw, 3rem); }
    .seo-static-shell__details { grid-template-columns: 1fr; margin-top: 2rem; }
  }
</style>`;

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * 壳里的条目列表。
 *
 * 枢纽页（/services/、/tools/、/insights/）以前把子页标题当纯文本 <p> 输出，
 * 整个壳里一个指向详情页的 <a> 都没有——爬虫读壳时跟不下去，只能靠 sitemap 兜底发现，
 * 内链权重与锚文本全部丢掉。带 href 的条目现在渲染成真正的链接。
 */
function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const entries = items.map((item) => {
    const label = typeof item === 'string' ? item : String(item.label ?? '');
    const href = typeof item === 'string' ? null : item.href;
    return `<li>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label)}</li>`;
  }).join('');
  return [`<ul>${entries}</ul>`];
}

function renderSection(section) {
  if (typeof section === 'string') return `<p>${escapeHtml(section)}</p>`;
  const heading = escapeHtml(section.heading || section.title || '');
  // 带 anchor 的小节渲染出 id，页面内的 #锚点 才能落到壳里的同一位置。
  const id = section.anchor ? ` id="${escapeHtml(section.anchor)}"` : '';
  // 小节也可以带一个链接列表（主题聚合页靠它把子页串起来），此时不输出正文段落。
  if (Array.isArray(section.items)) return `<h2${id}>${heading}</h2>${renderList(section.items).join('')}`;
  return `<h2${id}>${heading}</h2><p>${escapeHtml(section.body)}</p>`;
}

function renderBody(route) {
  const body = route.body || {};
  const paragraphs = body.paragraphs || [];
  const detail = [
    ...paragraphs.slice(1).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(body.sections || []).map(renderSection),
    ...(body.resources || []).map((resource) => `<p>${escapeHtml(typeof resource === 'string' ? resource : resource.title || resource.label)}</p>`),
    ...renderList(body.list),
    ...(body.faqs || []).map((faq) => {
      const [question, answer] = Array.isArray(faq) ? faq : [faq.question, faq.answer];
      return `<h2>${escapeHtml(question)}</h2><p>${escapeHtml(answer)}</p>`;
    }),
    ...(body.links || []).map((link) => `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`),
    ...(body.emptyState ? [`<p>${escapeHtml(body.emptyState)}</p>`] : []),
  ].join('');

  return `<div id="root" data-prerendered="true">
  <main class="seo-static-shell">
    <aside class="seo-static-shell__brand">
      <a href="/"><img src="/sagemro-logo-192.png" alt="" width="60" height="60" /><span>SAGEMRO</span></a>
    </aside>
    <div class="seo-static-shell__content">
      <div class="seo-static-shell__frame">
        <h1>${escapeHtml(body.h1)}</h1>
        <p class="seo-static-shell__intro">${escapeHtml(paragraphs[0])}</p>
        <section class="seo-static-shell__details">${detail}</section>
      </div>
    </div>
  </main>
</div>`;
}

function structuredData(route, locale) {
  if (route.structuredData) return route.structuredData;
  return {
    '@type': route.type === 'tool' ? 'WebApplication' : 'WebPage',
    name: route.body?.h1 || route.title,
    description: route.description,
    url: route.canonical,
    inLanguage: locale,
  };
}

function containsSchemaType(value, type) {
  if (Array.isArray(value)) return value.some((item) => containsSchemaType(item, type));
  if (!value || typeof value !== 'object') return false;
  if (value['@type'] === type) return true;
  return Object.values(value).some((item) => containsSchemaType(item, type));
}

function headTags(route, locale) {
  const alternates = Object.entries(route.alternates)
    .map(([language, href]) => `<link rel="alternate" hreflang="${escapeHtml(language)}" href="${escapeHtml(href)}" />`)
    .join('\n    ');
  const image = `${HOSTS[locale]}${SOCIAL_IMAGE_PATH}`;
  return [
    `<link rel="canonical" href="${escapeHtml(route.canonical)}" />`,
    alternates,
    `<meta property="og:type" content="${containsSchemaType(route.structuredData, 'Article') ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(route.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:locale" content="${escapeHtml(OG_LOCALES[locale] ?? OG_LOCALES.en)}" />`,
    // 分享卡是 1200×630 横幅，用 summary 会被平台裁成小方图。
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<script type="application/ld+json">${safeJson(structuredData(route, locale))}</script>`,
  ].join('\n    ');
}

export function renderPublicDocument(template, route, locale = 'en') {
  const normalizedLocale = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const title = `${route.title} | SAGEMRO`;
  let html = String(template)
    .replace(/<html\s+lang=(['"]).*?\1>/i, `<html lang="${normalizedLocale}">`)
    .replace(/<meta\s+name=(['"])description\1\s+content=(['"]).*?\2\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta\s+name=(['"])robots\1\s+content=(['"]).*?\2\s*\/?\s*>/i, `<meta name="robots" content="${escapeHtml(route.robots)}" />`)
    .replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(title)}</title>`)
    .replace(/<div\s+id=(['"])root\1><\/div>/i, renderBody(route));

  return html.replace('</head>', `    ${CRITICAL_SHELL_STYLES}\n    ${headTags(route, normalizedLocale)}\n  </head>`);
}

export function renderNotFoundDocument(template, locale = 'en') {
  const normalizedLocale = locale === 'zh-CN' ? 'zh-CN' : 'en';
  const copy = normalizedLocale === 'zh-CN'
    ? { title: '页面不存在', body: '你访问的页面不存在，或者链接已经失效。' }
    : { title: "This page doesn't exist", body: 'The link may have expired, or the page may have moved.' };
  const route = { body: { h1: `404 — ${copy.title}`, paragraphs: [copy.body] } };

  return String(template)
    .replace(/<html\s+lang=(['"]).*?\1>/i, `<html lang="${normalizedLocale}">`)
    .replace(/<meta\s+name=(['"])description\1\s+content=(['"]).*?\2\s*\/?\s*>/i, `<meta name="description" content="${escapeHtml(copy.body)}" />`)
    .replace(/<meta\s+name=(['"])robots\1\s+content=(['"]).*?\2\s*\/?\s*>/i, '<meta name="robots" content="noindex,nofollow,noarchive" />')
    .replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(copy.title)} | SAGEMRO</title>`)
    .replace('</head>', `    ${CRITICAL_SHELL_STYLES}\n  </head>`)
    .replace(/<div\s+id=(['"])root\1><\/div>/i, renderBody(route));
}

export function renderSitemap(routes) {
  const entries = routes.map((route) => {
    const alternates = Object.entries(route.alternates)
      .map(([language, href]) => `    <xhtml:link rel="alternate" hreflang="${escapeHtml(language)}" href="${escapeHtml(href)}" />`)
      .join('\n');
    return `  <url>\n    <loc>${escapeHtml(route.canonical)}</loc>\n${alternates}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
}

export function renderRedirects(routes) {
  void routes;
  return '';
}

export function renderRobots(locale = 'en') {
  const host = HOSTS[locale === 'zh-CN' ? 'zh-CN' : 'en'];
  return `User-agent: *\nAllow: /\n\nDisallow: /engineer\nDisallow: /activate\nDisallow: /login\n\nSitemap: ${host}/sitemap.xml\n`;
}
