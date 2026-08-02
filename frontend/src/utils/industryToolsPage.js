import { getLocalizedTool, getToolBySlug } from '../data/industryTools.js';

export function getIndustryToolsPageState(pathname = '/tools', locale = 'en') {
  const slug = pathname.startsWith('/tools/')
    ? pathname.slice('/tools/'.length).replace(/\/$/, '')
    : '';
  const selectedTool = getLocalizedTool(getToolBySlug(slug), locale);
  const canonicalHost = locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com';

  return {
    slug,
    selectedTool,
    page: slug && !selectedTool ? 'not-found' : !selectedTool ? 'hub' : selectedTool.id === 'bend-simulator' ? 'bend-simulator' : 'tool-detail',
    canonicalHost,
    canonical: `${canonicalHost}${selectedTool ? `/tools/${selectedTool.slug}` : slug ? `/tools/${slug}` : '/tools'}`,
  };
}
