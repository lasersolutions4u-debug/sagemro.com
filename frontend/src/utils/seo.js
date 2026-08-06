const SEO_JSON_LD_ID = 'sagemro-seo-jsonld';

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (content == null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setMetaProperty(property, content) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (content == null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(canonical) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (canonical == null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', canonical);
}

function setAlternate(hreflang, href) {
  let tag = document.querySelector(`link[hreflang="${hreflang}"]`);
  if (href == null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'alternate');
    tag.setAttribute('hreflang', hreflang);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function deriveAlternates(canonical) {
  if (!canonical) return null;

  try {
    const url = new URL(canonical);
    const hosts = url.hostname.startsWith('engineer.')
      ? { en: 'https://engineer.sagemro.com', 'zh-CN': 'https://engineer.sagemro.cn' }
      : { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };
    const path = `${url.pathname}${url.search}`;
    return {
      en: `${hosts.en}${path}`,
      'zh-CN': `${hosts['zh-CN']}${path}`,
      'x-default': `${hosts.en}${path}`,
    };
  } catch {
    return null;
  }
}

function setAlternates(alternates, canonical) {
  const resolvedAlternates = alternates === undefined ? deriveAlternates(canonical) : alternates;
  const entries = Object.entries(resolvedAlternates ?? {});
  const activeHreflangs = new Set(entries.map(([hreflang]) => hreflang));
  document.querySelectorAll('link[hreflang]').forEach((tag) => {
    if (!activeHreflangs.has(tag.getAttribute('hreflang'))) tag.remove();
  });
  entries.forEach(([hreflang, href]) => setAlternate(hreflang, href));
}

function deriveImage(canonical) {
  if (!canonical) return null;

  try {
    return new URL('/sagemro-logo.png', canonical).href;
  } catch {
    return null;
  }
}

function containsArticle(structuredData) {
  if (Array.isArray(structuredData)) return structuredData.some(containsArticle);
  if (!structuredData || typeof structuredData !== 'object') return false;
  if (structuredData['@type'] === 'Article') return true;
  return Array.isArray(structuredData['@graph']) && structuredData['@graph'].some(containsArticle);
}

function setStructuredData(structuredData) {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  if (structuredData == null) {
    scripts.forEach((script) => script.remove());
    return;
  }

  let script = scripts.shift();
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.id = SEO_JSON_LD_ID;
  script.textContent = JSON.stringify(structuredData);
  scripts.forEach((duplicate) => duplicate.remove());
}

export function setSeoMetadata({
  title,
  description,
  canonical,
  robots = 'index,follow',
  lang,
  structuredData,
  alternates,
  image,
}) {
  document.title = title;
  document.documentElement.lang = lang;
  setMeta('description', description);
  setMeta('robots', robots);
  setCanonical(canonical);
  setAlternates(alternates, canonical);
  setMetaProperty('og:type', containsArticle(structuredData) ? 'article' : 'website');
  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:url', canonical);
  const resolvedImage = image === undefined ? deriveImage(canonical) : image;
  setMetaProperty('og:image', resolvedImage);
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', resolvedImage);
  setStructuredData(structuredData);
}
