import { useState } from 'react';
import { Shield } from 'lucide-react';
import { adminLogin } from '../services/api';
import { runtimeConfig } from '../config/runtime';

const TEXT = {
  en: {
    title: 'SAGEMRO Operations Console',
    subtitle: 'Internal operations login',
    phonePlaceholder: 'Admin phone number',
    passwordPlaceholder: 'Password',
    submit: 'Sign In',
    loading: 'Signing in...',
  },
  'zh-CN': {
    title: 'SAGEMRO 运营管理后台',
    subtitle: '运营管理员登录',
    phonePlaceholder: '管理员手机号',
    passwordPlaceholder: '密码',
    submit: '登录',
    loading: '登录中...',
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{t.title}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm">
              {error}
            </div>
          )}

          <div>
            <input
              type="tel"
              placeholder={t.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? t.loading : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
