import { useEffect } from 'react';
import { runtimeConfig } from '../config/runtime';
import { setAdminLocale, useAdminLocale } from '../config/locale';

export function LanguageSwitch({ className = '' }) {
  const locale = useAdminLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'zh-CN' ? 'SAGEMRO 运营中枢' : 'SAGEMRO Operations Console';
  }, [locale]);
  if (runtimeConfig.market !== 'com') return null;
  const target = locale === 'en' ? 'zh-CN' : 'en';
  return <button type="button" lang={target} onClick={() => setAdminLocale(target)} className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${className}`}>
    {target === 'zh-CN' ? '中文' : 'English'}
  </button>;
}
