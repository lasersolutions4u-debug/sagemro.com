export function isCnLocale() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.cn');
}
