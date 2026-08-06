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

function setAlternates(alternates) {
  const entries = Object.entries(alternates ?? {});
  const activeHreflangs = new Set(entries.map(([hreflang]) => hreflang));
  document.querySelectorAll('link[hreflang]').forEach((tag) => {
    if (!activeHreflangs.has(tag.getAttribute('hreflang'))) tag.remove();
  });
  entries.forEach(([hreflang, href]) => setAlternate(hreflang, href));
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
  setAlternates(alternates);
  setMetaProperty('og:type', 'website');
  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:url', canonical);
  setMetaProperty('og:image', image);
  setMeta('twitter:card', 'summary');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', image);

  let script = document.getElementById(SEO_JSON_LD_ID);
  if (structuredData == null) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = SEO_JSON_LD_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(structuredData);
}
