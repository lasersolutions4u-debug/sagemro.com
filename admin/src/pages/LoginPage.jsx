import { useState } from 'react';
import { adminLogin } from '../services/api';
import { runtimeConfig } from '../config/runtime';
import { BrandMark } from '../components/BrandMark';

const TEXT = {
  en: {
    title: 'SAGEMRO Operations Console',
    eyebrow: 'Service Operations',
    subtitle: 'Review leads, assign engineers, approve quotes, and archive completed service records.',
    panelTitle: 'Sign in to continue',
    phonePlaceholder: 'Admin phone number',
    passwordPlaceholder: 'Password',
    submit: 'Sign In',
    loading: 'Signing in...',
    points: ['Service request intake', 'Dispatch control', 'Quote review', 'Service archive'],
  },
  'zh-CN': {
    title: 'SAGEMRO 运营中枢',
    eyebrow: '服务运营控制台',
    subtitle: '用于线索审核、派工、报价和服务归档，便于团队跟进每项客户服务。',
    panelTitle: '管理员登录',
    phonePlaceholder: '管理员手机号',
    passwordPlaceholder: '密码',
    submit: '登录',
    loading: '登录中...',
    points: ['线索审核', '派工协同', '报价确认', '服务归档'],
  },
};

const t = TEXT[runtimeConfig.locale] || TEXT.en;

export function LoginPage({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminLogin(phone, password);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.18),transparent_32%),linear-gradient(135deg,#fff7e8_0%,#f5ead8_45%,#fcfaf6_100%)] px-4 text-[#21160c]">
      <div className="pointer-events-none absolute -right-20 top-16 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-5xl items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="text-center lg:text-left">
          <BrandMark variant="logo" className="mx-auto mb-5 h-24 w-24 object-contain drop-shadow-[0_18px_36px_rgba(245,158,11,0.24)] lg:mx-0" />
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b66a05]">{t.eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#21160c] sm:text-4xl">{t.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#6f5a40] lg:text-base">{t.subtitle}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {t.points.map((point) => (
              <div key={point} className="rounded-2xl border border-white/75 bg-white/75 px-4 py-3 text-sm font-medium text-[#2f2114] shadow-sm backdrop-blur">
                {point}
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(48,31,12,0.16)] backdrop-blur-xl sm:p-7">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#9a7a52]">SAGEMRO</div>
            <h2 className="mt-1 text-xl font-semibold text-[#21160c]">{t.panelTitle}</h2>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <input
              type="tel"
              autoComplete="username"
              placeholder={t.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#fffdf8] border border-[#eadfce] text-[#21160c] placeholder:text-[#9a7a52] focus:outline-none focus:border-[#d97706] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.14)]"
              required
            />
          </div>

          <div>
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#fffdf8] border border-[#eadfce] text-[#21160c] placeholder:text-[#9a7a52] focus:outline-none focus:border-[#d97706] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.14)]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#21160c] text-white font-medium shadow-[0_14px_30px_rgba(33,22,12,0.22)] transition-colors hover:bg-[#3b2612] disabled:opacity-50"
          >
            {loading ? t.loading : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
