import { useState } from 'react';
import { Modal } from '../common/Modal';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer } from '../../services/api';
import { toastSuccess, toastError } from '../../utils/feedback';
import { isCnLocale } from '../../utils/locale';

export function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenLegal }) {
  const isCn = isCnLocale();
  const serviceName = isCn ? 'SAGEMRO 智能服务系统' : 'SAGEMRO Service OS';

  // step flow:
  // choice -> register-company -> register-auth -> customer / visitor completion / login
  const [step, setStep] = useState('login');
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

  // 身份选择
  const [selectedIdentity, setSelectedIdentity] = useState(null); // 'customer' | 'engineer' | 'visitor'

  // 协议勾选
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 发送验证码
  const handleSendCode = async () => {
    if (isCn) {
      if (!phone) { setError('请输入手机号'); return; }
      if (!/^1\d{10}$/.test(phone.trim())) { setError('请输入有效的手机号'); return; }
    } else {
      if (!email) { setError('请输入邮箱'); return; }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('请输入有效的邮箱'); return; }
    }

    setCodeSending(true);
    setError('');
    try {
      const data = isCn
        ? await sendVerifyCode({ phone })
        : await sendVerifyCode({ email });
      // 纵深防御：仅在 Vite 开发构建下显示回传的验证码
      if (import.meta.env.DEV && data.code) {
        setError('[DEV] 验证码：' + data.code);
      }
      setCodeCooldown(60);
      const timer = setInterval(() => {
        setCodeCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setError('发送失败：' + e.message);
    } finally {
      setCodeSending(false);
    }
  };

  // 客户注册（含公司名）
  const handleRegisterCustomer = async () => {
    if (!name || !phone || !password || !confirmPassword || !companyName || (!isCn && !email)) {
      setError('请填写所有必填信息'); return;
    }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    if (password.length < 6) { setError('密码至少需要 6 位'); return; }

    setSubmitting(true);
    setError('');
    try {
      // 注册时传递 company 和 identity
      await registerCustomer({ name, phone, email, password, code, company: companyName, identity: selectedIdentity });
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
        toastError('该手机号已注册，请直接登录。');
        setStep('login');
        setError('');
      } else {
        setError(e.message);
        toastError(e.message || '注册失败，请稍后重试。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPhone('');
    setEmail('');
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
    if (!companyName.trim()) { setError('请输入公司名称'); return; }
    if (!phone || phone.length !== 11) { setError('请输入有效的手机号'); return; }
    if (!isCn && (!email || !/^\S+@\S+\.\S+$/.test(email.trim()))) { setError('请输入有效的邮箱'); return; }
    if (isCn && email && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('请输入有效的邮箱'); return; }
    if (!password || password.length < 6) { setError('密码至少需要 6 位'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    if (!agreedToTerms) { setError('请阅读并同意用户协议、隐私政策和 AI 服务说明'); return; }
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
      await registerCustomer({ name: name || '访客', phone, email, password, code, company: companyName, identity: 'visitor' });
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
    <Modal isOpen={isOpen} onClose={handleClose} title="登录 / 注册" size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step choice: 身份分流 ========== */}
        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-base font-medium">请选择更符合你当前需求的入口</h3>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我需要设备服务、备件支持或新机选型建议</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">向 SAGEMRO 说明设备情况，官方服务团队会审核需求并跟进。</p>
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
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">我先了解一下</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">可以先体验 SAGEMRO 的核心能力，后续再完善账号信息。</p>
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
              <button onClick={goToChoice} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">先完善你的公司与账号信息</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 公司名称（必填） */}
            <div>
              <label className="block text-sm font-medium mb-1">公司名称 *</label>
              <input
                type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例如：某某钣金设备有限公司"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium mb-1">姓名 *</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                maxLength={20}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">设置密码 *</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请设置至少 6 位密码"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">确认密码 *</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">手机号 *</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {!isCn && (
              <div>
                <label className="block text-sm font-medium mb-1">邮箱 *</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">{isCn ? '短信验证码' : '邮箱验证码'}</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={6}
                  className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[var(--color-surface-elevated)] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : '发送验证码'}
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
                我已阅读并同意{' '}
                <button type="button" onClick={() => onOpenLegal?.('agreement')} className="text-[var(--color-primary)] hover:underline">用户协议</button>
                ,{' '}
                <button type="button" onClick={() => onOpenLegal?.('privacy')} className="text-[var(--color-primary)] hover:underline">隐私政策</button>
                {' '}和{' '}
                <button type="button" onClick={() => onOpenLegal?.('ai')} className="text-[var(--color-primary)] hover:underline">AI 服务说明</button>
              </span>
            </label>

            <button
              onClick={handleCompanySubmit}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              下一步：选择使用身份
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              已有账号？{' '}
              <button onClick={goToLogin} className="text-[var(--color-primary)] hover:underline font-medium">登录</button>
            </div>
          </div>
        )}

        {/* ========== Step register-auth: 身份选择 ========== */}
        {step === 'register-auth' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-company')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">你希望如何使用 {serviceName}？</p>
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
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我是设备客户</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">获取 AI 初诊、官方服务申请、设备档案、备件支持和维护跟进。</p>
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
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">我先以访客身份浏览</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">先了解 SAGEMRO 的服务能力，后续可随时完善为正式账号。</p>
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
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-base font-medium mb-1">身份确认</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                你选择了“设备客户”。完成确认后，可使用 AI 初诊、官方服务申请和设备档案等核心能力。
              </p>
            </div>

            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl text-[13px] text-[var(--color-text-secondary)]">
              {selectedIdentity === 'customer' ? (
                <p>完成确认后，你可以提交 SAGEMRO 官方服务申请、查看设备档案、跟踪服务进度，并获得更贴合设备情况的建议。</p>
              ) : null}
            </div>

            <button
              data-testid="auth-confirm-button"
              onClick={handleAuthConfirm}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              完成确认并开始使用
            </button>
          </div>
        )}

        {/* ========== Step register-visitor-complete: 访客完成 ========== */}
        {step === 'register-visitor-complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-auth')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回</button>
            </div>

            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-text-muted)]/10 flex items-center justify-center">
                <span className="text-2xl">👁</span>
              </div>
              <p className="text-base font-medium mb-1">访客体验</p>
              <p className="text-sm text-[var(--color-text-secondary)]">先体验 SAGEMRO 的核心能力，后续可随时完善为正式账号。</p>
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
              {submitting ? '注册中...' : '以访客身份继续'}
            </button>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">需要钣金设备服务支持？登录后继续使用 {serviceName}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <button
              onClick={async () => {
                if (!phone || !password) { setError('请输入手机号和密码'); return; }
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
              {submitting ? '登录中...' : '登录'}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              还没有账号？{' '}
              <button onClick={goToRegisterCompany} className="text-[var(--color-primary)] hover:underline font-medium">注册</button>
              {' 或 '}
              <button onClick={goToForgotPassword} className="text-[var(--color-primary)] hover:underline font-medium">忘记密码</button>
            </div>
          </div>
        )}

        {/* ========== 忘记密码页 ========== */}
        {step === 'forgot-password' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={goToLogin} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回登录</button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">输入手机号，我们会发送验证码用于重置密码</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入注册手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">验证码</label>
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={6}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">设置新密码</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="请设置至少 6 位新密码"
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            )}

            <button
              onClick={async () => {
                if (forgotStep === 'phone') {
                  if (!phone) { setError('请输入手机号'); return; }
                  try {
                    await sendResetCode(phone);
                    setForgotStep('code-sent');
                    setError('');
                  } catch (e) {
                    setError(e.message);
                  }
                } else {
                  if (!password || password.length < 6) { setError('密码至少需要 6 位'); return; }
                  if (!code) { setError('请输入验证码'); return; }
                  setSubmitting(true);
                  try {
                    await resetPassword({ phone, code, newPassword: password });
                    toastSuccess('密码已重置，请使用新密码登录。');
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
              {submitting ? '处理中...' : forgotStep === 'code-sent' ? '重置密码' : '发送验证码'}
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
