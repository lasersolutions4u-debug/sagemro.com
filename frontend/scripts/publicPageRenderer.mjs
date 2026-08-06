const HOSTS = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderBody(route) {
  const body = route.body || {};
  const paragraphs = body.paragraphs || [];
  const detail = [
    ...paragraphs.slice(1).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(body.sections || []).map((section) => typeof section === 'string'
      ? `<p>${escapeHtml(section)}</p>`
      : `<h2>${escapeHtml(section.heading || section.title)}</h2><p>${escapeHtml(section.body)}</p>`),
    ...(body.resources || []).map((resource) => `<p>${escapeHtml(typeof resource === 'string' ? resource : resource.title || resource.label)}</p>`),
    ...(body.list || []).map((item) => `<p>${escapeHtml(item)}</p>`),
    ...(body.faqs || []).map((faq) => {
      const [question, answer] = Array.isArray(faq) ? faq : [faq.question, faq.answer];
      return `<p>${escapeHtml(question)} ${escapeHtml(answer)}</p>`;
    }),
  ].join('');

  return `<div id="root" data-prerendered="true">\n  <main class="seo-static-shell">\n    <a href="/">SAGEMRO</a>\n    <h1>${escapeHtml(body.h1)}</h1>\n    <p>${escapeHtml(paragraphs[0])}</p>\n    <section>${detail}</section>\n  </main>\n</div>`;
}

function publisher(route, locale) {
  return {
    '@type': 'Organization',
    name: 'SAGEMRO',
    url: route.alternates[locale],
    logo: `${HOSTS[locale]}/sagemro-logo.png`,
  };
}

function breadcrumb(route) {
  const parts = route.path.split('/').filter(Boolean);
  const origin = new URL(route.canonical).origin;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: parts.map((part, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: part,
      item: `${origin}/${parts.slice(0, index + 1).join('/')}`,
    })),
  };
}

function structuredData(route, locale) {
  const commonPublisher = publisher(route, locale);
  let primary;

  if (route.type === 'home') {
    return {
      '@graph': [
        commonPublisher,
        { '@type': 'WebSite', name: 'SAGEMRO', url: route.canonical },
      ],
    };
  }

  if (route.type === 'tool') {
    primary = {
      '@type': 'WebApplication',
      name: route.body?.h1 || route.title,
      description: route.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: locale === 'zh-CN' ? 'CNY' : 'USD' },
      publisher: commonPublisher,
    };
  } else if (route.type === 'insight') {
    const source = route.structuredData?.['@graph']?.[0] || route.structuredData || {};
    primary = {
      '@type': 'Article',
      headline: route.title,
      description: route.description,
      author: source.author || commonPublisher,
      publisher: commonPublisher,
      datePublished: source.datePublished || route.modified,
      dateModified: source.dateModified || route.modified,
      image: source.image || `${HOSTS[locale]}/sagemro-logo.png`,
      mainEntityOfPage: source.mainEntityOfPage || route.canonical,
    };
  } else {
    primary = {
      '@type': 'CollectionPage',
      name: route.title,
      description: route.description,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: (route.children || []).map((child, index) => ({
          '@type': 'ListItem', position: index + 1, url: child.canonical,
        })),
      },
    };
  }

  return { '@graph': [primary, breadcrumb(route)] };
}

function headTags(route, locale) {
  const alternates = Object.entries(route.alternates)
    .map(([language, href]) => `<link rel="alternate" hreflang="${escapeHtml(language)}" href="${escapeHtml(href)}" />`)
    .join('\n    ');
  const image = `${HOSTS[locale]}/sagemro-logo.png`;
  return [
    `<link rel="canonical" href="${escapeHtml(route.canonical)}" />`,
    alternates,
    `<meta property="og:type" content="${route.type === 'insight' ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(route.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta name="twitter:card" content="summary" />',
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

  return html.replace('</head>', `    ${headTags(route, normalizedLocale)}\n  </head>`);
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
  return routes
    .filter((route) => route.path !== '/')
    .map((route) => `${route.path}/  ${route.path}  301`)
    .join('\n') + '\n';
}

export function renderRobots(locale = 'en') {
  const host = HOSTS[locale === 'zh-CN' ? 'zh-CN' : 'en'];
  return `User-agent: *\nAllow: /\n\nDisallow: /engineer\nDisallow: /activate\nDisallow: /login\n\nSitemap: ${host}/sitemap.xml\n`;
}
