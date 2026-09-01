import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROBOTS_META = '<meta name="robots" content="noindex,nofollow,noarchive">';

function renderPortalIndex(template) {
  let html = template.replace(
    /<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>/i,
    ROBOTS_META,
  );

  if (!html.includes(ROBOTS_META)) {
    html = html.replace(/<\/head>/i, `  ${ROBOTS_META}\n  </head>`);
  }

  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    const isCanonical = /\brel\s*=\s*["']canonical["']/i.test(tag);
    const isMainDomain = /\bhref\s*=\s*["']https:\/\/sagemro\.(?:com|cn)(?:\/[^"']*)?["']/i.test(tag);
    return isCanonical && isMainDomain ? '' : tag;
  });
}

function renderRedirects() {
  return [
    '/work-orders/* /index.html 200',
    '/activate /index.html 200',
    '/engineer /index.html 200',
    '',
  ].join('\n');
}

export async function buildPortalPages({ distDir }) {
  const indexPath = join(distDir, 'index.html');
  const template = await readFile(indexPath, 'utf8');

  await Promise.all([
    writeFile(indexPath, renderPortalIndex(template)),
    writeFile(join(distDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n'),
    writeFile(join(distDir, '_redirects'), renderRedirects()),
    rm(join(distDir, 'sitemap.xml'), { force: true }),
    rm(join(distDir, 'llms.txt'), { force: true }),
  ]);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await buildPortalPages({ distDir: resolve('dist-portal') });
}
