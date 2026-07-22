const SEO_JSON_LD_ID = 'sagemro-seo-jsonld';

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(canonical) {
  let tag = document.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', canonical);
}

export function setSeoMetadata({ title, description, canonical, robots = 'index,follow', lang, structuredData }) {
  document.title = title;
  document.documentElement.lang = lang;
  setMeta('description', description);
  setMeta('robots', robots);
  setCanonical(canonical);

  let script = document.getElementById(SEO_JSON_LD_ID);
  if (!structuredData) {
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
