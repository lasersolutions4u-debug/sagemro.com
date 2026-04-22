import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Sentry: DSN 通过 VITE_SENTRY_DSN 注入（公开 key，Sentry 设计允许前端暴露）
// 没配 DSN 就跳过初始化，不影响开发和 CI 环境
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // 只抓错误，不开 tracing（省额度，起步阶段够用）
    tracesSampleRate: 0,
    // 过滤掉浏览器扩展、第三方脚本等噪声
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
