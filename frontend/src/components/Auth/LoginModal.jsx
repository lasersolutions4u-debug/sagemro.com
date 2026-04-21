import { useState } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer, registerEngineer } from '../../services/api';
import { toastSuccess } from '../../utils/feedback';
import { deviceTypes, commonBrands, commonServices, generateRandomName } from '../../data/loginPresets.js';

export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  // step flow:
  // choice -> register-company -> register-auth -> register-customer-info / register-engineer-2 / login
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

  // 合伙人背景调查
  const [specialties, setSpecialties] = useState([]);
  const [brands, setBrands] = useState({});
  const [services, setServices] = useState([]);
  const [serviceRegion, setServiceRegion] = useState([]);
  const [bio, setBio] = useState('');

  const toggleBrand = (deviceType, brand) => {
    setBrands(prev => {
      const current = prev[deviceType] || [];
      const updated = current.includes(brand)
        ? current.filter(b => b !== brand)
        : [...current, brand];
      return { ...prev, [deviceType]: updated };
    });
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone) { setError('请输入手机号'); return; }
    if (phone.length !== 11) { setError('请输入正确的手机号'); return; }

    setCodeSending(true);
    setError('');
    try {
      const data = await sendVerifyCode(phone);
      // 纵深防御：仅在 Vite 开发构建下显示回传的验证码
      if (import.meta.env.DEV && data.code) {
        setError('[DEV] 验证码为 ' + data.code);
      }
      setCodeCooldown(60);
      const timer = setInterval(() => {
        setCodeCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e) {
      setError('发送失败: ' + e.message);
    } finally {
      setCodeSending(false);
    }
  };

  // 客户注册（含公司名）
  const handleRegisterCustomer = async () => {
    if (!name || !password || !confirmPassword || !companyName) {
      setError('请填写所有必填项'); return;
    }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }

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
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 合伙人注册（含公司名+背景调查）
  const handleRegisterEngineer = async () => {
    if (!name || !password || !confirmPassword || !companyName) {
      setError('请填写所有必填项'); return;
    }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }
    if (specialties.length === 0) { setError('请选择擅长的设备类型'); return; }
    if (services.length === 0) { setError('请选择擅长的维修项目'); return; }

    setSubmitting(true);
    setError('');
    try {
      await registerEngineer({
        name, phone, password, code,
        specialties,
        brands,
        services,
        service_region: serviceRegion,
        bio,
        company: companyName,
      });
      const result = await login({ phone, password });
      localStorage.setItem('sagemro_token', result.token);
      localStorage.setItem('sagemro_user', JSON.stringify(result.user));
      localStorage.setItem('sagemro_user_type', result.userType);
      localStorage.setItem('sagemro_engineer_id', result.user.id);
      onLoginSuccess?.(result);
      handleClose();
    } catch (e) {
      setError(e.message || '注册失败，请重试');
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
    setSpecialties([]);
    setBrands({});
    setServices([]);
    setServiceRegion([]);
    setBio('');
    setCompanyName('');
    setSelectedIdentity(null);
    setStep('login');
    onClose();
  };

  const handleRandomName = () => {
    setName(generateRandomName());
  };

  // ===== 步骤导航 =====
  const goToChoice = () => { setStep('choice'); setError(''); };
  const goToRegisterCompany = () => {
    setName(generateRandomName());
    setStep('register-company');
    setError('');
  };
  const goToLogin = () => { setStep('login'); setError(''); };
  const goToForgotPassword = () => { setStep('forgot-password'); setError(''); };

  // 第1步：公司名 + 基本信息
  const handleCompanySubmit = () => {
    if (!companyName.trim()) { setError('请输入公司名称'); return; }
    if (!phone || phone.length !== 11) { setError('请输入正确的手机号'); return; }
    if (!password || password.length < 6) { setError('密码至少6位'); return; }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
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
      // 客户或合伙人进入认证提示
      setStep('register-auth-prompt');
    }
  };

  // 认证提示后
  const handleAuthConfirm = () => {
    if (selectedIdentity === 'engineer') {
      setStep('register-engineer-2');
    } else {
      // 客户 - 完成注册
      handleRegisterCustomer();
    }
  };

  // 访客完成
  const handleVisitorComplete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await registerCustomer({ name: name || generateRandomName(), phone, password, code, company: companyName, identity: 'visitor' });
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
    if (step === 'register-engineer-2') return 'xl';
    if (step === 'choice') return 'md';
    if (step === 'register-company') return 'lg';
    return 'md';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="登录/注册" size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step choice: 身份分流 ========== */}
        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-base font-medium">下面哪一项比较符合我的情况？</h3>
            </div>

            <div className="space-y-2.5">
              {/* A. 我需要服务 */}
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我需要或将来可能需要设备维修保养服务</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">有任何问题就跟小智说，小智帮您提交工单，精准获取专业合伙人支持。</p>
                  </div>
                </div>
              </button>

              {/* B. 我提供服务 */}
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">B</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我可以提供维修保养服务</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">有任何问题就跟小智说，并且如果您注册成为平台合伙人，小智会给您分配工单，获取额外收入。</p>
                  </div>
                </div>
              </button>

              {/* C. 只是了解 */}
              <button
                onClick={goToRegisterCompany}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-text-muted)] text-white text-sm flex items-center justify-center font-medium">C</span>
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">我只是了解一下</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">有任何问题就跟小智说，先看看，不着急注册。</p>
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
              <p className="text-sm text-[var(--color-text-secondary)]">首先告诉我们您的公司信息</p>
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
                placeholder="例如：XX金属制品有限公司"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium mb-1">用户名</label>
              <div className="flex gap-2">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="给自己起个用户名"
                  className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={handleRandomName}
                  className="px-3 py-2 bg-[var(--color-surface-elevated)] rounded-xl text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
                >
                  随机
                </button>
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">设置密码 *</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码（至少6位）"
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">确认密码 *</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
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

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">验证码</label>
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
                  {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            {error && error.includes('测试模式') && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-600 dark:text-amber-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCompanySubmit}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              下一步：选择身份
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              已有账号？{' '}
              <button onClick={goToLogin} className="text-[var(--color-primary)] hover:underline font-medium">立即登录</button>
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
              <p className="text-sm text-[var(--color-text-secondary)]">您希望以什么身份使用平台？</p>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handleIdentitySelect('customer')}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我是客户（需要设备维修保养服务）</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">认证后即可享受小智的精准服务推荐和工单管理。</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleIdentitySelect('engineer')}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white text-sm flex items-center justify-center font-medium">B</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[var(--color-primary)] transition-colors">我是合伙人（提供维修保养服务）</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">认证后需要填写背景信息，小智会根据您的专长精准推荐工单。</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleIdentitySelect('visitor')}
                className="w-full p-4 text-left rounded-xl border-2 border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-text-muted)] text-white text-sm flex items-center justify-center font-medium">C</span>
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">我只是了解一下（访客身份）</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">浏览小智的功能，暂不认证。功能受限，但随时可以认证升级。</p>
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
              <p className="text-base font-medium mb-1">身份认证</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {selectedIdentity === 'customer' ? '您选择了"客户"身份。认证后即可享受完整服务。' : '您选择了"合伙人"身份。认证后需填写背景信息。'}
              </p>
            </div>

            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl text-[13px] text-[var(--color-text-secondary)]">
              {selectedIdentity === 'customer' ? (
                <p>完成认证后，您可以：提交工单、查看设备档案、获取小智的精准服务推荐。</p>
              ) : (
                <p>完成认证后，您需要填写擅长的设备类型、品牌和维修项目，以便小智精准为您推荐工单。</p>
              )}
            </div>

            <button
              onClick={handleAuthConfirm}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium transition-colors"
            >
              {selectedIdentity === 'customer' ? '完成认证，开始使用' : '下一步：填写背景信息'}
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
              <p className="text-base font-medium mb-1">访客身份</p>
              <p className="text-sm text-[var(--color-text-secondary)]">您可以浏览小智的功能，但功能受限。随时可以在设置中认证升级。</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleVisitorComplete}
              disabled={submitting}
              className="w-full py-3 bg-[var(--color-text-muted)] hover:bg-[var(--color-text-secondary)] disabled:bg-[var(--color-text-muted)]/50 text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '注册中...' : '以访客身份开始'}
            </button>
          </div>
        )}

        {/* ========== Step register-engineer-2: 合伙人背景调查 ========== */}
        {step === 'register-engineer-2' && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-auth-prompt')} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">← 返回</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">完成背景信息（用于精准接单）</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 设备类型 */}
            <TagInput
              label="擅长的设备类型 *"
              options={deviceTypes}
              value={specialties}
              onChange={setSpecialties}
              placeholder="输入设备类型，回车添加..."
            />

            {/* 品牌（每个设备类型下有预设+空白框） */}
            {specialties.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-2">熟悉的品牌</label>
                {specialties.map((type) => (
                  <div key={type} className="mb-3">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">{type}：</p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(commonBrands[type] || []).map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => toggleBrand(type, brand)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            (brands[type] || []).includes(brand)
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                    <TagInput
                      placeholder="输入品牌，回车添加..."
                      value={brands[type] || []}
                      onChange={(val) => setBrands(prev => ({ ...prev, [type]: val }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 维修项目 */}
            <TagInput
              label="擅长的维修项目 *"
              options={commonServices}
              value={services}
              onChange={setServices}
              placeholder="输入维修项目，回车添加..."
            />

            {/* 服务地区 */}
            <RegionInput
              label="服务覆盖地区"
              value={serviceRegion}
              onChange={setServiceRegion}
              placeholder="输入省、市、区名称搜索..."
            />

            {/* 个人简介 */}
            <div>
              <label className="block text-xs font-medium mb-1">个人简介（选填）</label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="向客户展示您的自我介绍"
                rows={2}
                className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>

            <button
              onClick={handleRegisterEngineer} disabled={submitting}
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '入驻中...' : '注册成为合伙人'}
            </button>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">有任何钣金加工设备的问题，随时问AI小智</p>
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
              className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-text-muted)] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '登录中...' : '登录'}
            </button>

            <div className="text-center text-sm text-[var(--color-text-secondary)] pt-1">
              还没有账户？{' '}
              <button onClick={goToRegisterCompany} className="text-[var(--color-primary)] hover:underline font-medium">点击注册</button>
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
              <p className="text-sm text-[var(--color-text-secondary)]">输入手机号，我们将发送验证码重置密码</p>
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
                placeholder="请输入注册的手机号" maxLength={11}
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
                  placeholder="设置新密码（至少6位）"
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
                  if (!password || password.length < 6) { setError('密码至少6位'); return; }
                  if (!code) { setError('请输入验证码'); return; }
                  setSubmitting(true);
                  try {
                    await resetPassword({ phone, code, newPassword: password });
                    toastSuccess('密码重置成功，请使用新密码登录');
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