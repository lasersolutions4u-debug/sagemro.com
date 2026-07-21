import { useLayoutEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { activateEngineerAccount } from '../../services/api';
import { isCnLocale } from '../../utils/locale';
import { BrandMark } from '../common/BrandMark';

const COPY = {
  cn: {
    portal: '工程师工作台',
    eyebrow: '账号激活',
    title: '设置你的登录密码',
    intro: '此密码将用于登录工程师工作台。激活完成后，你可以使用申请邮箱或手机号登录。',
    securityTitle: '仅由你设置和保管',
    securityText: 'SAGEMRO 不会查看或通过邮件发送你的密码。',
    password: '设置密码',
    passwordPlaceholder: '至少 10 位',
    confirmPassword: '确认密码',
    confirmPlaceholder: '再次输入密码',
    passwordHint: '密码至少 10 位，请勿使用容易猜到的个人信息。',
    passwordShort: '密码至少需要 10 位',
    passwordMismatch: '两次输入的密码不一致',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    activate: '激活账号',
    activating: '正在激活...',
    invalidTitle: '激活链接无效',
    invalidText: '链接可能不完整、已过期或已被使用。请联系 SAGEMRO 运营团队重新发送激活邮件。',
    successTitle: '账号激活成功',
    successText: '密码已设置。现在可以使用申请邮箱或手机号登录工程师工作台。',
    signIn: '登录工程师工作台',
  },
  en: {
    portal: 'Engineer Workspace',
    eyebrow: 'Account activation',
    title: 'Set your sign-in password',
    intro: 'Use this password to access the Engineer Workspace. After activation, you can sign in with your application email or phone number.',
    securityTitle: 'Set and kept only by you',
    securityText: 'SAGEMRO never views or sends your password by email.',
    password: 'Set password',
    passwordPlaceholder: 'At least 10 characters',
    confirmPassword: 'Confirm password',
    confirmPlaceholder: 'Enter the password again',
    passwordHint: 'Use at least 10 characters and avoid easily guessed personal details.',
    passwordShort: 'Password must be at least 10 characters',
    passwordMismatch: 'Passwords do not match',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    activate: 'Activate account',
    activating: 'Activating...',
    invalidTitle: 'Activation link is invalid',
    invalidText: 'The link may be incomplete, expired, or already used. Contact SAGEMRO operations for a new activation email.',
    successTitle: 'Account activated',
    successText: 'Your password is set. You can now sign in to the Engineer Workspace with your application email or phone number.',
    signIn: 'Sign in to Engineer Workspace',
  },
};

function readActivationToken() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get('token') || '';
}

function PasswordField({ label, placeholder, value, onChange, visible, onToggle, autoComplete, showLabel, hideLabel }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#2d2116]">{label}</span>
      <span className="relative mt-2 block">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-lg border border-[#d8c9b5] bg-white px-3 pr-12 text-base text-[#21160c] outline-none transition placeholder:text-[#9a8c7b] focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#756552] transition hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export function EngineerActivationPage({ onOpenLogin }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [token] = useState(() => readActivationToken());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [status, setStatus] = useState(token ? 'form' : 'invalid');
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    window.history.replaceState({}, '', '/activate');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 10) {
      setError(copy.passwordShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setStatus('submitting');
    setError('');
    try {
      await activateEngineerAccount({ token, password });
      setPassword('');
      setConfirmPassword('');
      setStatus('success');
    } catch (activationError) {
      setError(activationError.message);
      setStatus('form');
    }
  };

  const isSubmitting = status === 'submitting';

  return (
    <main className="min-h-dvh bg-[#f5efe5] text-[#21160c]">
      <header className="border-b border-white/10 bg-[#111722] px-5 py-4 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <BrandMark variant="logo" className="h-9 w-9 object-contain" />
          <div>
            <div className="text-sm font-semibold">SAGEMRO</div>
            <div className="text-xs text-white/55">{copy.portal}</div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-73px)] max-w-5xl items-center gap-8 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section className="max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-700">
            <KeyRound size={16} />
            {copy.eyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#6a5844] sm:text-base">{copy.intro}</p>
          <div className="mt-7 border-l-2 border-amber-500 pl-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={18} className="text-amber-700" />
              {copy.securityTitle}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#756552]">{copy.securityText}</p>
          </div>
        </section>

        <section className="border border-[#dfd2c0] bg-[#fffdf8] p-5 shadow-[0_20px_60px_rgba(43,31,20,0.10)] sm:p-8">
          {status === 'invalid' && (
            <div className="py-5 text-center">
              <AlertTriangle size={34} className="mx-auto text-amber-700" />
              <h2 className="mt-5 text-xl font-semibold">{copy.invalidTitle}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#756552]">{copy.invalidText}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-5 text-center">
              <CheckCircle2 size={38} className="mx-auto text-emerald-600" />
              <h2 className="mt-5 text-xl font-semibold">{copy.successTitle}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#756552]">{copy.successText}</p>
              <button
                type="button"
                onClick={onOpenLogin}
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#111722] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#263143] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                <LogIn size={18} />
                {copy.signIn}
              </button>
            </div>
          )}

          {(status === 'form' || status === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                label={copy.password}
                placeholder={copy.passwordPlaceholder}
                value={password}
                onChange={setPassword}
                visible={passwordVisible}
                onToggle={() => setPasswordVisible((value) => !value)}
                autoComplete="new-password"
                showLabel={copy.showPassword}
                hideLabel={copy.hidePassword}
              />
              <PasswordField
                label={copy.confirmPassword}
                placeholder={copy.confirmPlaceholder}
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={confirmVisible}
                onToggle={() => setConfirmVisible((value) => !value)}
                autoComplete="new-password"
                showLabel={copy.showPassword}
                hideLabel={copy.hidePassword}
              />
              <p className="text-xs leading-5 text-[#7c6b58]">{copy.passwordHint}</p>
              {error && (
                <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-wait disabled:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {isSubmitting ? copy.activating : copy.activate}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
