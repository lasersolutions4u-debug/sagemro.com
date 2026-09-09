import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';
import { getAdminLocale } from './config/locale';
import { LanguageSwitch } from './components/LanguageSwitch';
import { runtimeConfig } from './config/runtime';

document.documentElement.lang = getAdminLocale();
document.title = getAdminLocale() === 'zh-CN' ? 'SAGEMRO 运营中枢' : 'SAGEMRO Operations Console';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {runtimeConfig.market === 'com' && <div className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-end border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4"><LanguageSwitch /></div>}
    <div className={runtimeConfig.market === 'com' ? 'pt-14 [&_.fixed.inset-0]:top-14' : ''}><App /></div>
  </React.StrictMode>
);
