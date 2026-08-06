export function getServicePageRoute(pathname = '/services') {
  if (pathname === '/services' || pathname === '/services/') {
    return { type: 'hub', slug: '' };
  }

  if (!pathname.startsWith('/services/')) return null;

  const detailMatch = pathname.match(/^\/services\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return detailMatch
    ? { type: 'detail', slug: detailMatch[1] }
    : { type: 'not-found', slug: '' };
}
