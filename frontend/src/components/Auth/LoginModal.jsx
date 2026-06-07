import { useState } from 'react';
import { Modal } from '../common/Modal';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';

export function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenLegal }) {
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
    if (!phone) { setError('Please enter your phone number'); return; }
    if (phone.length !== 11) { setError('Please enter a valid phone number'); return; }

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
      setError('Failed to send: ' + e.message);
    } finally {
      setCodeSending(false);
    }
  };

  // 客户注册（含公司名）
  const handleRegisterCustomer = async () => {
    if (!name || !password || !confirmPassword || !companyName) {
      setError('Please fill in all required fields'); return;
    }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

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
        toastError('This phone number is already registered. Please sign in.');
        setStep('login');
        setError('');
      } else {
        setError(e.message);
        toastError(e.message || 'Registration failed. Please try again.');
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
    if (!companyName.trim()) { setError('Please enter your company name'); return; }
    if (!phone || phone.length !== 11) { setError('Please enter a valid phone number'); return; }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!agreedToTerms) { setError('Please read and agree to the Terms of Service, Privacy Policy, and AI Service Notice'); return; }
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Sign In / Register" size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step choice: 身份分流 ========== */}
        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-base font-medium">Which best describes your situation?</h3>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">I need equipment service, spare parts, or machine selection help</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Tell SAGEMRO about your equipment. Our official service team will review the request and follow up.</p>
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
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">I'm just exploring</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Browse SAGEMRO's features at your own pace. No registration required.</p>
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
              <button onClick={goToChoice} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← Back</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">First, tell us about your company</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 公司名称（必填） */}
            <div>
              <label className="block text-sm font-medium mb-1">Company name *</label>
              <input
                type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., ABC Metal Products Co., Ltd."
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 真实姓名 */}
            <div>
              <label className="block text-sm font-medium mb-1">Full name *</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Enter your real name for identity verification"
                maxLength={20}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">Set password *</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a password (min. 6 characters)"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">Confirm password *</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">Phone number *</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">Verification code</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter verification code" maxLength={6}
                  className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[var(--color-surface-elevated)] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : 'Send code'}
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
                I have read and agree to the{' '}
                <button type="button" onClick={() => onOpenLegal?.('agreement')} className="text-[var(--color-primary)] hover:underline">Terms of Service</button>
                ,{' '}
                <button type="button" onClick={() => onOpenLegal?.('privacy')} className="text-[var(--color-primary)] hover:underline">Privacy Policy</button>
                {' '}and{' '}
                <button type="button" onClick={() => onOpenLegal?.('ai')} className="text-[var(--color-primary)] hover:underline">AI Service Notice</button>
              </span>
            </label>

            <button
              onClick={handleCompanySubmit}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              Next: Choose your role
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              Already have an account?{' '}
              <button onClick={goToLogin} className="text-[var(--color-primary)] hover:underline font-medium">Sign in</button>
            </div>
          </div>
        )}

        {/* ========== Step register-auth: 身份选择 ========== */}
        {step === 'register-auth' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-company')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← Back</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">How would you like to use SAGEMRO Service OS?</p>
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
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">I'm a Customer</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Get AI diagnostics, official service requests, equipment records, spare parts, and maintenance follow-up.</p>
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
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">I'm just browsing (Guest)</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Explore SAGEMRO's features without verification. Limited functionality, upgrade anytime.</p>
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
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← Back</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-base font-medium mb-1">Identity Verification</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                You selected "Customer". After verification, you'll have full access to AI diagnostics, official service requests, and equipment records.
              </p>
            </div>

            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl text-[13px] text-[var(--color-text-secondary)]">
              {selectedIdentity === 'customer' ? (
                <p>After verification, you can: request SAGEMRO official service, view equipment records, track service progress, and receive personalized recommendations.</p>
              ) : null}
            </div>

            <button
              data-testid="auth-confirm-button"
              onClick={handleAuthConfirm}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              Complete verification and start
            </button>
          </div>
        )}

        {/* ========== Step register-visitor-complete: 访客完成 ========== */}
        {step === 'register-visitor-complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← Back</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-text-muted)]/10 flex items-center justify-center">
                <span className="text-2xl">👁</span>
              </div>
              <p className="text-base font-medium mb-1">Guest Access</p>
              <p className="text-sm text-[var(--color-text-secondary)]">Browse SAGEMRO's features with limited access. Upgrade to full access anytime in settings.</p>
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
              {submitting ? 'Registering...' : 'Continue as Guest'}
            </button>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Have questions about sheet metal equipment? Ask SAGEMRO AI anytime</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Phone number</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <button
              onClick={async () => {
                if (!phone || !password) { setError('Please enter your phone number and password'); return; }
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
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              Don't have an account?{' '}
              <button onClick={goToRegisterCompany} className="text-[var(--color-primary)] hover:underline font-medium">Register</button>
              {' or '}
              <button onClick={goToForgotPassword} className="text-[var(--color-primary)] hover:underline font-medium">Forgot password</button>
            </div>
          </div>
        )}

        {/* ========== 忘记密码页 ========== */}
        {step === 'forgot-password' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToLogin} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← Back to sign in</button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Enter your phone number and we'll send a verification code to reset your password</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Phone number</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your registered phone number" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">Verification code</label>
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter verification code" maxLength={6}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">Set new password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set new password (min. 6 characters)"
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            <button
              onClick={async () => {
                if (forgotStep === 'phone') {
                  if (!phone) { setError('Please enter your phone number'); return; }
                  try {
                    await sendResetCode(phone);
                    setForgotStep('code-sent');
                    setError('');
                  } catch (e) {
                    setError(e.message);
                  }
                } else {
                  if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
                  if (!code) { setError('Please enter the verification code'); return; }
                  setSubmitting(true);
                  try {
                    await resetPassword({ phone, code, newPassword: password });
                    toastSuccess('Password reset successfully. Please sign in with your new password.');
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
              {submitting ? 'Processing...' : forgotStep === 'code-sent' ? 'Reset Password' : 'Send Code'}
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
