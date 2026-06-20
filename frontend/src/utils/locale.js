export function isCnLocale() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.cn');
}

export function pickLocaleText(cnText, enText) {
  return isCnLocale() ? cnText : enText;
}
