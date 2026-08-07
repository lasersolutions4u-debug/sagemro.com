import { getLocalizedTool, getToolBySlug } from '../data/industryTools.js';
import { getRuntimeSeoRoute } from '../data/publicSeoRoutes.js';

export function getIndustryToolsPageState(pathname = '/tools', locale = 'en') {
  const isHub = pathname === '/tools' || pathname === '/tools/';
  const detailMatch = pathname.match(/^\/tools\/([^/]+)\/?$/);
  const slug = detailMatch?.[1] ?? '';
  const selectedTool = getLocalizedTool(getToolBySlug(slug), locale);
  const isMalformed = !isHub && !detailMatch;
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';

  return {
    slug,
    selectedTool,
    page: isMalformed || (slug && !selectedTool) ? 'not-found' : !selectedTool ? 'hub' : selectedTool.id === 'bend-simulator' ? 'bend-simulator' : 'tool-detail',
    canonicalHost,
    canonical: `${canonicalHost}${selectedTool ? `/tools/${selectedTool.slug}` : slug ? `/tools/${slug}` : isMalformed ? pathname : '/tools'}`,
  };
}

function requestedPathAlternates(canonical) {
  const path = canonical.replace(/^https:\/\/sagemro\.(?:com|cn)/, '');
  return {
    en: `https://sagemro.com${path}`,
    'zh-CN': `https://sagemro.cn${path}`,
    'x-default': `https://sagemro.com${path}`,
  };
}

export function getIndustryToolsSeoMetadata(route, locale = 'en') {
  const isMissing = route.page === 'not-found';
  const seoRoute = isMissing
    ? null
    : getRuntimeSeoRoute(route.selectedTool ? `/tools/${route.selectedTool.slug}` : '/tools', locale);
  const isPaused = route.page === 'bend-simulator';

  return {
    canonical: seoRoute?.canonical ?? route.canonical,
    alternates: seoRoute?.alternates ?? requestedPathAlternates(route.canonical),
    robots: isMissing || isPaused ? 'noindex,nofollow,noarchive' : seoRoute?.robots ?? 'index,follow',
    structuredData: isMissing ? null : seoRoute?.structuredData ?? null,
  };
}
