import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { getDirectAccessNoindexToolRoutes, getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import { renderNotFoundDocument, renderPublicDocument, renderSitemap } from './publicPageRenderer.mjs';

const hosts = { en: 'https://sagemro.com', 'zh-CN': 'https://sagemro.cn' };

function localeFromTemplate(template) {
  return /<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i.test(template) ? 'zh-CN' : 'en';
}

function validateRoutes(routes) {
  const paths = new Set();

  for (const route of routes) {
    const { path } = route;
    if (typeof path !== 'string' || !path.startsWith('/') || (path !== '/' && path.endsWith('/'))
      || path.includes('..') || /[?#]/.test(path) || paths.has(path)) {
      throw new Error(`Unsafe or duplicate public route path: ${path}`);
    }
    paths.add(path);
  }
}

function renderSitemapWithDates(routes) {
  let sitemap = renderSitemap(routes);
  for (const route of routes) {
    sitemap = sitemap.replace(`<loc>${route.canonical}</loc>`, `<loc>${route.canonical}</loc>\n    <lastmod>${route.modified}</lastmod>`);
  }
  return sitemap;
}

function renderRedirects() {
  return [
    '/activate / 200',
    '/engineer / 200',
    '/work-orders/* / 200',
    '',
  ].join('\n');
}

function renderRobots(locale) {
  const host = hosts[locale];
  const publicSearchAgents = ['Googlebot', 'Bingbot', 'OAI-SearchBot'];
  const trainingOnlyAgents = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'CCBot'];
  const privatePaths = ['/api/', '/admin/'];
  const searchPolicy = (agent) => [`User-agent: ${agent}`, 'Allow: /', ...privatePaths.map((path) => `Disallow: ${path}`)].join('\n');
  const baiduPolicy = locale === 'zh-CN'
    ? searchPolicy('Baiduspider')
    : 'User-agent: Baiduspider\nDisallow: /';

  return [
    ...publicSearchAgents.map(searchPolicy),
    baiduPolicy,
    searchPolicy('*'),
    ...trainingOnlyAgents.map((agent) => `User-agent: ${agent}\nDisallow: /`),
    `Sitemap: ${host}/sitemap.xml`,
    '',
  ].join('\n\n');
}

function renderLlms(locale) {
  const host = hosts[locale];
  return `# SAGEMRO\n\nSAGEMRO provides practical planning references for industrial equipment users. Tool results are planning references, not final engineering, safety, purchasing, or service decisions.\n\n## Current hubs\n\n- ${host}/\n- ${host}/services/\n- ${host}/tools/\n- ${host}/insights/\n\nContact: support@sagemro.com\n`;
}

async function writeRoute(distDir, route, template, locale) {
  const target = route.path === '/' ? join(distDir, 'index.html') : join(distDir, route.path.slice(1), 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, renderPublicDocument(template, route, locale));
}

export async function buildPublicPages({ distDir }) {
  const template = await readFile(join(distDir, 'index.html'), 'utf8');
  const locale = localeFromTemplate(template);
  const routes = getPublicSeoRoutes(locale);
  const noindexToolRoutes = getDirectAccessNoindexToolRoutes(locale);
  validateRoutes([...routes, ...noindexToolRoutes]);

  await Promise.all([...routes, ...noindexToolRoutes].map((route) => writeRoute(distDir, route, template, locale)));
  await Promise.all([
    writeFile(join(distDir, '404.html'), renderNotFoundDocument(template, locale)),
    writeFile(join(distDir, 'sitemap.xml'), renderSitemapWithDates(routes)),
    writeFile(join(distDir, 'robots.txt'), renderRobots(locale)),
    writeFile(join(distDir, '_redirects'), renderRedirects()),
    writeFile(join(distDir, 'llms.txt'), renderLlms(locale)),
  ]);

  return { locale, routeCount: routes.length };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  await buildPublicPages({ distDir: resolve('dist') });
}
