import { useState } from 'react';
import { Modal } from '../common/Modal';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { getCurrentUiText } from '../../i18n/uiText';

export function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenLegal }) {
  const text = getCurrentUiText();
  const t = text.auth;
  // step flow:
  // choice -> register-company -> register-auth -> customer / visitor completion / login
  const [step, setStep] = useState('login');
  const [phone, setPhone] = useState('');
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

  // 身份选择
  const [selectedIdentity, setSelectedIdentity] = useState(null); // 'customer' | 'engineer' | 'visitor'

  // 协议勾选
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone) { setError(t.enterPhone); return; }
    if (phone.length !== 11) { setError(t.validPhone); return; }

    setCodeSending(true);
    setError('');
    try {
      const data = await sendVerifyCode(phone);
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
      setError(t.sendFailed(e.message));
    } finally {
      setCodeSending(false);
    }
  };

  // 客户注册（含公司名）
  const handleRegisterCustomer = async () => {
    if (!name || !password || !confirmPassword || !companyName) {
      setError(t.requiredFields); return;
    }
    if (password !== confirmPassword) { setError(t.passwordMismatch); return; }
    if (password.length < 6) { setError(t.passwordShort); return; }

    setSubmitting(true);
    setError('');
    try {
      // 注册时传递 company 和 identity
      await registerCustomer({ name, phone, password, code, company: companyName, identity: selectedIdentity });
      const result = await login({ phone, password });
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
        toastError(t.registered);
        setStep('login');
        setError('');
      } else {
        setError(e.message);
        toastError(e.message || t.registrationFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setCode('');
    setError('');
    setCompanyName('');
    setSelectedIdentity(null);
    setAgreedToTerms(false);
    setStep('login');
    onClose();
  };

    // ===== 步骤导航 =====
  const goToChoice = () => { setStep('choice'); setError(''); };
  const goToRegisterCompany = () => {
    setStep('register-company');
    setError('');
  };
  const goToLogin = () => { setStep('login'); setError(''); };
  const goToForgotPassword = () => { setStep('forgot-password'); setError(''); };

  // 第1步：公司名 + 基本信息
  const handleCompanySubmit = () => {
    if (!companyName.trim()) { setError(t.companyRequired); return; }
    if (!phone || phone.length !== 11) { setError(t.validPhone); return; }
    if (!password || password.length < 6) { setError(t.passwordShort); return; }
    if (password !== confirmPassword) { setError(t.passwordMismatch); return; }
    if (!agreedToTerms) { setError(t.termsRequired); return; }
    setError('');
    setStep('register-auth');
  };

  // 第2步：身份选择
  const handleIdentitySelect = (identity) => {
    setSelectedIdentity(identity);
    if (identity === 'visitor') {
      // 访客直接完成注册（模拟认证）
      setStep('register-visitor-complete');
    } else {
      // 客户或工程师进入认证提示
      setStep('register-auth-prompt');
    }
  };

  // 认证提示后
  const handleAuthConfirm = () => {
    handleRegisterCustomer();
  };

  // 访客完成
  const handleVisitorComplete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await registerCustomer({ name: name || 'Guest', phone, password, code, company: companyName, identity: 'visitor' });
      const result = await login({ phone, password });
      localStorage.setItem('sagemro_token', result.token);
      localStorage.setItem('sagemro_user', JSON.stringify(result.user));
      localStorage.setItem('sagemro_user_type', result.userType);
      if (result.userType === 'customer') {
        localStorage.setItem('sagemro_customer_id', result.user.id);
      }
      onLoginSuccess?.(result);
      handleClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getModalSize = () => {
    if (step === 'choice') return 'md';
    if (step === 'register-company') return 'lg';
    return 'md';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t.title} size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step choice: 身份分流 ========== */}
        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-base font-medium">{t.choiceTitle}</h3>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">{t.serviceNeed}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t.serviceNeedDesc}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-text-muted)] text-white text-sm flex items-center justify-center font-medium">B</span>
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">{t.exploring}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t.exploringDesc}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========== Step register-company: 公司名 + 基本信息 ========== */}
        {step === 'register-company' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToChoice} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{t.back}</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t.companyIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 公司名称（必填） */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.companyName}</label>
              <input
                type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t.companyPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 真实姓名 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.fullName}</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t.fullNamePlaceholder}
                maxLength={20}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.setPassword}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.setPasswordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.confirmPassword}</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPasswordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.phone}</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder} maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{t.code}</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder={t.codePlaceholder} maxLength={6}
                  className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[var(--color-surface-elevated)] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : t.sendCode}
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
                {t.agreePrefix}{' '}
                <button type="button" onClick={() => onOpenLegal?.('agreement')} className="text-[var(--color-primary)] hover:underline">{text.footer.termsFull}</button>
                ,{' '}
                <button type="button" onClick={() => onOpenLegal?.('privacy')} className="text-[var(--color-primary)] hover:underline">{text.footer.privacyFull}</button>
                {' '}{t.and}{' '}
                <button type="button" onClick={() => onOpenLegal?.('ai')} className="text-[var(--color-primary)] hover:underline">{text.footer.aiNoticeFull}</button>
              </span>
            </label>

            <button
              onClick={handleCompanySubmit}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              {t.nextRole}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              {t.alreadyAccount}{' '}
              <button onClick={goToLogin} className="text-[var(--color-primary)] hover:underline font-medium">{t.signIn}</button>
            </div>
          </div>
        )}

        {/* ========== Step register-auth: 身份选择 ========== */}
        {step === 'register-auth' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-company')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{t.back}</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t.useTitle}</p>
            </div>

            <div className="space-y-2.5">
              <button
                data-testid="identity-select-customer"
                onClick={() => handleIdentitySelect('customer')}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">{t.customer}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t.customerDesc}</p>
                  </div>
                </div>
              </button>

              <button
                data-testid="identity-select-visitor"
                onClick={() => handleIdentitySelect('visitor')}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-text-muted)] text-white text-sm flex items-center justify-center font-medium">B</span>
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">{t.guest}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t.guestDesc}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========== Step register-auth-prompt: 认证提示 ========== */}
        {step === 'register-auth-prompt' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{t.back}</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-base font-medium mb-1">{t.verification}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t.verificationDesc}
              </p>
            </div>

            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl text-[13px] text-[var(--color-text-secondary)]">
              {selectedIdentity === 'customer' ? (
                <p>{t.verificationBenefits}</p>
              ) : null}
            </div>

            <button
              data-testid="auth-confirm-button"
              onClick={handleAuthConfirm}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              {t.completeVerification}
            </button>
          </div>
        )}

        {/* ========== Step register-visitor-complete: 访客完成 ========== */}
        {step === 'register-visitor-complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{t.back}</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-text-muted)]/10 flex items-center justify-center">
                <span className="text-2xl">👁</span>
              </div>
              <p className="text-base font-medium mb-1">{t.guestAccess}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t.guestAccessDesc}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              data-testid="visitor-start-button"
              onClick={handleVisitorComplete}
              disabled={submitting}
              className="w-full py-3 bg-[var(--color-text-muted)] hover:bg-[var(--color-text-secondary)] disabled:bg-[var(--color-text-muted)]/50 text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? t.registering : t.continueGuest}
            </button>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t.loginIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">{t.phoneLabel}</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder} maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.password}</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <button
              onClick={async () => {
                if (!phone || !password) { setError(t.phonePasswordRequired); return; }
                setSubmitting(true);
                setError('');
                try {
                  const result = await login({ phone, password });
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
              {submitting ? t.signingIn : t.signInButton}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              {t.noAccount}{' '}
              <button onClick={goToRegisterCompany} className="text-[var(--color-primary)] hover:underline font-medium">{t.register}</button>
              {' '}{t.or}{' '}
              <button onClick={goToForgotPassword} className="text-[var(--color-primary)] hover:underline font-medium">{t.forgotPassword}</button>
            </div>
          </div>
        )}

        {/* ========== 忘记密码页 ========== */}
        {step === 'forgot-password' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToLogin} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">{t.backToSignIn}</button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t.resetIntro}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">{t.phoneLabel}</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={t.registeredPhonePlaceholder} maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t.code}</label>
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder={t.codePlaceholder} maxLength={6}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t.newPassword}</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.newPasswordPlaceholder}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            <button
              onClick={async () => {
                if (forgotStep === 'phone') {
                  if (!phone) { setError(t.enterPhone); return; }
                  try {
                    await sendResetCode(phone);
                    setForgotStep('code-sent');
                    setError('');
                  } catch (e) {
                    setError(e.message);
                  }
                } else {
                  if (!password || password.length < 6) { setError(t.passwordShort); return; }
                  if (!code) { setError(t.codeRequired); return; }
                  setSubmitting(true);
                  try {
                    await resetPassword({ phone, code, newPassword: password });
                    toastSuccess(t.resetSuccess);
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
              {submitting ? t.processing : forgotStep === 'code-sent' ? t.resetPassword : t.sendCodeAction}
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
