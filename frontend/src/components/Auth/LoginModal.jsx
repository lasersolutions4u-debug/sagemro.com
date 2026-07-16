import { useState } from 'react';
import { Modal } from '../common/Modal';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

const LOGIN_COPY = {
  cn: {
    modalTitle: '登录 / 注册',
    phoneRequired: '请输入手机号',
    phoneInvalid: '请输入有效手机号',
    emailRequired: '请输入邮箱',
    emailInvalid: '请输入有效邮箱',
    phonePasswordRequired: '请输入手机号和密码',
    sendFailed: '发送失败',
    requiredFields: '请填写所有必填项',
    passwordMismatch: '两次输入的密码不一致',
    passwordMin: '密码至少需要 6 位',
    registeredPhone: '该手机号已注册，请直接登录。',
    registerFailed: '注册失败，请稍后重试。',
    companyRequired: '请输入公司名称',
    termsRequired: '请阅读并同意服务协议、隐私政策和 AI 服务说明',
    resetSuccess: '密码已重置，请使用新密码登录。',
    codeRequired: '请输入验证码',
    back: '← 返回',
    companyIntro: '创建 SAGEMRO 账号，用于保存对话、设备信息和服务记录。',
    companyName: '公司名称 *',
    companyPlaceholder: '例如：济南某某钣金制造有限公司',
    fullName: '姓名 *',
    fullNamePlaceholder: '请输入姓名',
    setPassword: '设置密码 *',
    setPasswordPlaceholder: '设置密码（至少 6 位）',
    confirmPassword: '确认密码 *',
    confirmPasswordPlaceholder: '再次输入密码',
    phoneNumber: '手机号 *',
    phoneNumberLabel: '手机号',
    phonePlaceholder: '请输入手机号',
    registeredPhonePlaceholder: '请输入已注册手机号',
    verificationCode: '验证码',
    smsVerificationCode: '短信验证码',
    codePlaceholder: '请输入验证码',
    sendCode: '发送验证码',
    termsPrefix: '我已阅读并同意',
    terms: '服务协议',
    privacy: '隐私政策',
    aiNotice: 'AI 服务说明',
    termsAnd: '和',
    createAccount: '创建账号',
    alreadyAccount: '已有账号？',
    signIn: '登录',
    registering: '正在注册...',
    loginIntro: '有钣金设备问题？请描述现场情况或提交服务请求',
    password: '密码',
    passwordPlaceholder: '请输入密码',
    signingIn: '正在登录...',
    noAccount: '还没有账号？',
    register: '注册',
    or: ' 或 ',
    forgotPassword: '忘记密码',
    backToSignIn: '← 返回登录',
    forgotIntro: '请输入手机号，我们会发送验证码用于重置密码',
    newPassword: '设置新密码',
    newPasswordPlaceholder: '设置新密码（至少 6 位）',
    processing: '处理中...',
    resetPassword: '重置密码',
  },
  en: {
    modalTitle: 'Sign In / Register',
    phoneRequired: 'Please enter your phone number',
    phoneInvalid: 'Please enter a valid phone number',
    emailRequired: 'Please enter your email address',
    emailInvalid: 'Please enter a valid email address',
    phonePasswordRequired: 'Please enter your email/phone and password',
    accountLabel: 'Email or phone',
    accountPlaceholder: 'Email or phone number',
    sendFailed: 'Failed to send',
    requiredFields: 'Please fill in all required fields',
    passwordMismatch: 'Passwords do not match',
    passwordMin: 'Password must be at least 6 characters',
    registeredPhone: 'This phone number is already registered. Please sign in.',
    registerFailed: 'Registration failed. Please try again.',
    companyRequired: 'Please enter your company name',
    termsRequired: 'Please read and agree to the Terms of Service, Privacy Policy, and AI Service Notice',
    resetSuccess: 'Password reset successfully. Please sign in with your new password.',
    codeRequired: 'Please enter the verification code',
    back: '← Back',
    companyIntro: 'Create your SAGEMRO account to save conversations, equipment records, and service requests.',
    companyName: 'Company name *',
    companyPlaceholder: 'e.g., ABC Metal Products Co., Ltd.',
    fullName: 'Full name *',
    fullNamePlaceholder: 'Enter your name',
    setPassword: 'Set password *',
    setPasswordPlaceholder: 'Set a password (min. 6 characters)',
    confirmPassword: 'Confirm password *',
    confirmPasswordPlaceholder: 'Re-enter your password',
    phoneNumber: 'Phone number *',
    phoneNumberLabel: 'Phone number',
    phonePlaceholder: 'Enter your phone number',
    registeredPhonePlaceholder: 'Enter your registered phone number',
    emailAddress: 'Email *',
    emailPlaceholder: 'Enter your email address',
    verificationCode: 'Verification code',
    emailVerificationCode: 'Email verification code',
    codePlaceholder: 'Enter verification code',
    sendCode: 'Send code',
    termsPrefix: 'I have read and agree to the',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    aiNotice: 'AI Service Notice',
    termsAnd: 'and',
    createAccount: 'Create account',
    alreadyAccount: 'Already have an account?',
    signIn: 'Sign in',
    registering: 'Registering...',
    loginIntro: 'Have a sheet metal equipment issue? Describe the situation or submit a service request',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    signingIn: 'Signing in...',
    noAccount: "Don't have an account?",
    register: 'Register',
    or: ' or ',
    forgotPassword: 'Forgot password',
    backToSignIn: '← Back to sign in',
    forgotIntro: "Enter your phone number and we'll send a verification code to reset your password",
    newPassword: 'Set new password',
    newPasswordPlaceholder: 'Set new password (min. 6 characters)',
    processing: 'Processing...',
    resetPassword: 'Reset Password',
  },
};

const normalizePhone = (value) => String(value || '').trim();
const isInternationalPhone = (value) => /^\+?[0-9\s().-]{6,24}$/.test(normalizePhone(value));
const isEmailAddress = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim());

export function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenLegal }) {
  const isCn = isCnLocale();
  const copy = isCn ? LOGIN_COPY.cn : LOGIN_COPY.en;
  // step flow:
  // login -> register-company -> login / authenticated customer account
  const [step, setStep] = useState('login');
  const [loginAccount, setLoginAccount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [forgotStep, setForgotStep] = useState('phone');

  // 公司名（必填）
  const [companyName, setCompanyName] = useState('');

  // 协议勾选
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 发送验证码
  const handleSendCode = async () => {
    if (isCn) {
      if (!phone) { setError(copy.phoneRequired); return; }
      if (!/^1\d{10}$/.test(phone.trim())) { setError(copy.phoneInvalid); return; }
    } else {
      if (!email) { setError(copy.emailRequired); return; }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(copy.emailInvalid); return; }
    }

    setCodeSending(true);
    setError('');
    try {
      const data = isCn
        ? await sendVerifyCode({ phone })
        : await sendVerifyCode({ email });
      // 纵深防御：仅在 Vite 开发构建下显示回传的验证码
      if (import.meta.env.DEV && data.code) {
        setError('[DEV] Verification code: ' + data.code);
      }
      setCodeCooldown(60);
      const timer = setInterval(() => {
        setCodeCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setError(`${copy.sendFailed}: ${e.message}`);
    } finally {
      setCodeSending(false);
    }
  };

  // 客户注册（含公司名）
  const handleRegisterCustomer = async () => {
    if (!name || !phone || !password || !confirmPassword || !companyName || (!isCn && !email)) {
      setError(copy.requiredFields); return;
    }
    if (password !== confirmPassword) { setError(copy.passwordMismatch); return; }
    if (password.length < 6) { setError(copy.passwordMin); return; }

    setSubmitting(true);
    setError('');
    try {
      await registerCustomer({ name, phone, email, password, code, company: companyName, identity: 'customer' });
      const result = await login(isCn ? { phone, password } : { email, password });
      localStorage.setItem('sagemro_token', result.token);
      localStorage.setItem('sagemro_user', JSON.stringify(result.user));
      localStorage.setItem('sagemro_user_type', result.userType);
      if (result.userType === 'customer') {
        localStorage.setItem('sagemro_customer_id', result.user.id);
      } else {
        localStorage.setItem('sagemro_engineer_id', result.user.id);
      }
      onLoginSuccess?.(result);
      handleClose();
    } catch (e) {
      if (e.status === 409) {
        toastError(copy.registeredPhone);
        setStep('login');
        setError('');
      } else {
        setError(e.message);
        toastError(e.message || copy.registerFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setLoginAccount('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setCode('');
    setError('');
    setCompanyName('');
    setAgreedToTerms(false);
    setStep('login');
    onClose();
  };

  // ===== 步骤导航 =====
  const goToRegisterCompany = () => {
    setStep('register-company');
    setError('');
  };
  const goToLogin = () => { setStep('login'); setError(''); };
  const goToForgotPassword = () => { setStep('forgot-password'); setError(''); };

  // 第1步：公司名 + 基本信息
  const handleCompanySubmit = () => {
    if (!companyName.trim()) { setError(copy.companyRequired); return; }
    if (isCn) {
      if (!/^1\d{10}$/.test(normalizePhone(phone))) { setError(copy.phoneInvalid); return; }
    } else if (!isInternationalPhone(phone)) {
      setError(copy.phoneInvalid); return;
    }
    if (!isCn && (!email || !isEmailAddress(email))) { setError(copy.emailInvalid); return; }
    if (isCn && email && !isEmailAddress(email)) { setError(copy.emailInvalid); return; }
    if (!password || password.length < 6) { setError(copy.passwordMin); return; }
    if (password !== confirmPassword) { setError(copy.passwordMismatch); return; }
    if (!agreedToTerms) { setError(copy.termsRequired); return; }
    setError('');
    handleRegisterCustomer();
  };

  const getModalSize = () => {
    if (step === 'register-company') return 'lg';
    return 'md';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={copy.modalTitle} size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step register-company: 公司名 + 基本信息 ========== */}
        {step === 'register-company' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToLogin} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{copy.back}</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{copy.companyIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 公司名称（必填） */}
            <div>
              <label className="block text-sm font-medium mb-1">{copy.companyName}</label>
              <input
                type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder={copy.companyPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium mb-1">{copy.fullName}</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={copy.fullNamePlaceholder}
                maxLength={20}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{copy.setPassword}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={copy.setPasswordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{copy.confirmPassword}</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={copy.confirmPasswordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">{copy.phoneNumber}</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={copy.phonePlaceholder} maxLength={24}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {!isCn && (
              <div>
                <label className="block text-sm font-medium mb-1">{copy.emailAddress}</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.emailPlaceholder}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{isCn ? copy.smsVerificationCode : copy.emailVerificationCode}</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder={copy.codePlaceholder} maxLength={6}
                  className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[var(--color-surface-elevated)] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : copy.sendCode}
                </button>
              </div>
            </div>

            {error && error.includes('测试模式') && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-600 dark:text-amber-400 text-sm">
                {error}
              </div>
            )}

            {/* 协议勾选 */}
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {copy.termsPrefix}{' '}
                <button type="button" onClick={() => onOpenLegal?.('agreement')} className="text-[var(--color-primary)] hover:underline">{copy.terms}</button>
                ,{' '}
                <button type="button" onClick={() => onOpenLegal?.('privacy')} className="text-[var(--color-primary)] hover:underline">{copy.privacy}</button>
                {' '}{copy.termsAnd}{' '}
                <button type="button" onClick={() => onOpenLegal?.('ai')} className="text-[var(--color-primary)] hover:underline">{copy.aiNotice}</button>
              </span>
            </label>

            <button
              onClick={handleCompanySubmit}
              disabled={submitting}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? copy.registering : copy.createAccount}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              {copy.alreadyAccount}{' '}
              <button onClick={goToLogin} className="text-[var(--color-primary)] hover:underline font-medium">{copy.signIn}</button>
            </div>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{copy.loginIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">{isCn ? copy.phoneNumberLabel : copy.accountLabel}</label>
              <input
                type={isCn ? 'tel' : 'text'} value={isCn ? phone : loginAccount} onChange={(e) => { isCn ? setPhone(e.target.value) : setLoginAccount(e.target.value); }}
                placeholder={isCn ? copy.phonePlaceholder : copy.accountPlaceholder} maxLength={24}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{copy.password}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={copy.passwordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <button
              onClick={async () => {
                const credential = (isCn ? phone : loginAccount).trim();
                if (!credential || !password) { setError(copy.phonePasswordRequired); return; }
                setSubmitting(true);
                setError('');
                try {
                  const result = isCn
                    ? await login({ phone: credential, password })
                    : credential.includes('@')
                      ? await login({ email: credential, password })
                      : await login({ phone: credential, password });
                  localStorage.setItem('sagemro_token', result.token);
                  localStorage.setItem('sagemro_user', JSON.stringify(result.user));
                  localStorage.setItem('sagemro_user_type', result.userType);
                  if (result.userType === 'customer') {
                    localStorage.setItem('sagemro_customer_id', result.user.id);
                  } else {
                    localStorage.setItem('sagemro_engineer_id', result.user.id);
                  }
                  onLoginSuccess?.(result);
                  handleClose();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setSubmitting(false);
                }
              }} disabled={submitting}
              data-testid="login-submit-button"
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? copy.signingIn : copy.signIn}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              {copy.noAccount}{' '}
              <button onClick={goToRegisterCompany} className="text-[var(--color-primary)] hover:underline font-medium">{copy.register}</button>
              {copy.or}
              <button onClick={goToForgotPassword} className="text-[var(--color-primary)] hover:underline font-medium">{copy.forgotPassword}</button>
            </div>
          </div>
        )}

        {/* ========== 忘记密码页 ========== */}
        {step === 'forgot-password' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToLogin} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{copy.backToSignIn}</button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{copy.forgotIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">{copy.phoneNumberLabel}</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={copy.registeredPhonePlaceholder} maxLength={24}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">{copy.verificationCode}</label>
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder={copy.codePlaceholder} maxLength={6}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">{copy.newPassword}</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={copy.newPasswordPlaceholder}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            <button
              onClick={async () => {
                if (forgotStep === 'phone') {
                  if (!phone) { setError(copy.phoneRequired); return; }
                  try {
                    await sendResetCode(phone);
                    setForgotStep('code-sent');
                    setError('');
                  } catch (e) {
                    setError(e.message);
                  }
                } else {
                  if (!password || password.length < 6) { setError(copy.passwordMin); return; }
                  if (!code) { setError(copy.codeRequired); return; }
                  setSubmitting(true);
                  try {
                    await resetPassword({ phone, code, newPassword: password });
                    toastSuccess(copy.resetSuccess);
                    setForgotStep('phone');
                    setStep('login');
                    setError('');
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setSubmitting(false);
                  }
                }
              }} disabled={submitting}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? copy.processing : forgotStep === 'code-sent' ? copy.resetPassword : copy.sendCode}
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
