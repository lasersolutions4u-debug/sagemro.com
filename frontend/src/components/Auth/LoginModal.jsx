import { useState } from 'react';
import { Modal } from '../common/Modal';
import { TagInput } from '../common/TagInput';
import { RegionInput } from '../common/RegionInput';
import { login, sendVerifyCode, sendResetCode, resetPassword, registerCustomer, registerEngineer } from '../../services/api';

// ============ 预设选项 ============
const deviceTypes = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

const commonBrands = {
  '激光切割机': ['大族', '通快', '百超', '迅镭', '邦德', '宏山', '奔腾', '华工'],
  '折弯机': ['通快', '百超', 'Amada', '亚威', '普玛宝', '萨瓦尼尼', '爱克'],
  '冲床': ['Amada', '村田', '金方圆', '扬力', '通快', '爱克'],
  '焊接机': ['福尼斯', '林肯', '米勒', '松下', '伊萨', '麦格米特', '奥太'],
  '激光焊接': ['大族', '通快', 'IPG', '创鑫', '锐科', '杰普特'],
  '卷板机': ['德国通快', '日本AMADA', '扬州锻压', '华东锻压'],
  '等离子切割': ['飞马特', '林德', '库卡', '小松', '海宝'],
  '水刀切割': ['福禄', 'OMAX', '大族', '百超', '水刀坊'],
  '剪板机': ['爱克', '通快', '百超', '金方圆', '扬力', 'AMADA'],
};

const commonServices = [
  '激光器维修', '切割头维护', '导轨润滑', '参数调试',
  '液压维修', '电气排查', '设备保养', '系统升级',
  '年度维保', '应急抢修', '培训指导', '配件供应'
];

// ============ 随机用户名生成 ============
const adjectives = ['热情', '敬业', '金牌', '资深', '靠谱', '专业', '极速', '全能'];
const nouns = ['钢铁侠', '钣金侠', '机械师', '工匠', '技师', '大师', '精灵', '超人'];
const suffixes = ['老张', '小李', '王师', '陈工', '刘师傅'];

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const useSuffix = Math.random() > 0.5;
  return useSuffix ? adj + noun : adj + suffixes[Math.floor(Math.random() * suffixes.length)];
}

// ============ 组件 ============
export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  // step flow: login | register-customer | register-engineer-1 | register-engineer-2
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
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotStep, setForgotStep] = useState('phone'); // 'phone' | 'code-sent'

  // 工程师背景调查
  const [specialties, setSpecialties] = useState([]);
  const [brands, setBrands] = useState({});
  const [services, setServices] = useState([]);
  const [serviceRegion, setServiceRegion] = useState([]);
  const [bio, setBio] = useState('');

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone) { setError('请输入手机号'); return; }
    if (phone.length !== 11) { setError('请输入正确的手机号'); return; }

    setCodeSending(true);
    setError('');
    try {
      const data = await sendVerifyCode(phone);
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

  // 发送重置密码验证码
  const handleSendResetCode = async () => {
    if (!phone) { setError('请输入手机号'); return; }

    setSubmitting(true);
    setError('');
    try {
      await sendResetCode(phone);
      setForgotStep('code-sent');
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!password || password.length < 6) { setError('密码至少6位'); return; }
    if (!code) { setError('请输入验证码'); return; }

    setSubmitting(true);
    setError('');
    try {
      await resetPassword({ phone, code, newPassword: password });
      // 重置成功后跳转登录
      setForgotStep('phone');
      setStep('login');
      setError('');
      alert('密码重置成功，请使用新密码登录');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 登录
  const handleLogin = async () => {
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
  };

  // 客户注册
  const handleRegisterCustomer = async () => {
    if (!name || !password || !confirmPassword) { setError('请填写所有必填项'); return; }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }

    setSubmitting(true);
    setError('');
    try {
      await registerCustomer({ name, phone, password, code });
      const result = await login({ phone, password });
      localStorage.setItem('sagemro_token', result.token);
      localStorage.setItem('sagemro_user', JSON.stringify(result.user));
      localStorage.setItem('sagemro_user_type', result.userType);
      localStorage.setItem('sagemro_customer_id', result.user.id);
      onLoginSuccess?.(result);
      handleClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 工程师注册
  const handleRegisterEngineer = async () => {
    if (!name || !password || !confirmPassword) { setError('请填写所有必填项'); return; }
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
        bio
      });
      const result = await login({ phone, password });
      localStorage.setItem('sagemro_token', result.token);
      localStorage.setItem('sagemro_user', JSON.stringify(result.user));
      localStorage.setItem('sagemro_user_type', result.userType);
      localStorage.setItem('sagemro_engineer_id', result.user.id);
      onLoginSuccess?.(result);
      handleClose();
    } catch (e) {
      console.error('注册工程师失败:', e);
      const errorMsg = e.message || String(e) || '注册失败，请重试';
      setError(errorMsg);
      setSubmitting(false);
    }
  };

  const toggleBrand = (deviceType, brand) => {
    setBrands(prev => {
      const current = prev[deviceType] || [];
      const updated = current.includes(brand)
        ? current.filter(b => b !== brand)
        : [...current, brand];
      return { ...prev, [deviceType]: updated };
    });
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
    setStep('login');
    onClose();
  };

  const handleRandomName = () => {
    setName(generateRandomName());
  };

  // 打开客户注册页（生成随机用户名）
  const goToRegisterCustomer = () => {
    setName(generateRandomName());
    setStep('register-customer');
  };

  // 打开工程师注册第1步（生成随机用户名）
  const goToRegisterEngineer1 = () => {
    setName(generateRandomName());
    setStep('register-engineer-1');
  };

  // 根据步骤动态计算 Modal 尺寸
  const getModalSize = () => {
    if (step === 'register-engineer-2') return 'xl';
    if (step === 'choice') return 'md';
    return 'lg';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="登录/注册" size={getModalSize()}>
      <div className="space-y-4">

        {/* ========== Step 1: 问题分流页 ========== */}
        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-base font-medium">下面哪一项比较符合我的情况？</h3>
            </div>

            <div className="space-y-2.5">
              {/* A. 我需要服务 */}
              <button
                onClick={goToRegisterCustomer}
                className="w-full p-4 text-left rounded-xl border-2 border-[#f4f3f4] dark:border-[#3a3a4c] hover:border-[#f59e0b] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f59e0b] text-white text-sm flex items-center justify-center font-medium">A</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[#f59e0b] transition-colors">我需要或将来可能需要设备维修保养服务</p>
                    <p className="text-xs text-[#6b6375] mt-0.5">有任何问题就跟小智说，小智帮您提交工单，精准获取专业工程师支持。</p>
                  </div>
                </div>
              </button>

              {/* B. 我提供服务 */}
              <button
                onClick={goToRegisterEngineer1}
                className="w-full p-4 text-left rounded-xl border-2 border-[#f4f3f4] dark:border-[#3a3a4c] hover:border-[#f59e0b] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f59e0b] text-white text-sm flex items-center justify-center font-medium">B</span>
                  <div>
                    <p className="font-medium text-sm group-hover:text-[#f59e0b] transition-colors">我可以提供维修保养服务</p>
                    <p className="text-xs text-[#6b6375] mt-0.5">有任何问题就跟小智说，并且如果您注册成为平台工程师，小智会给您分配工单，获取额外收入。</p>
                  </div>
                </div>
              </button>

              {/* C. 只是了解 */}
              <button
                onClick={handleClose}
                className="w-full p-4 text-left rounded-xl border-2 border-[#f4f3f4] dark:border-[#3a3a4c] hover:border-[#6b6375] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#6b6375] text-white text-sm flex items-center justify-center font-medium">C</span>
                  <div>
                    <p className="font-medium text-sm text-[#6b6375] group-hover:text-[#9b92a0] transition-colors">我只是了解一下</p>
                    <p className="text-xs text-[#6b6375] mt-0.5">有任何问题就跟小智说，先看看，不着急注册。</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========== 客户注册页 ========== */}
        {step === 'register-customer' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('login')} className="text-sm text-[#6b6375] hover:text-[#f59e0b]">← 返回登录</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6375]">注册成为客户</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium mb-1">用户名</label>
              <div className="flex gap-2">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="给自己起个用户名"
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  type="button"
                  onClick={handleRandomName}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-xs text-[#6b6375] hover:text-[#f59e0b]"
                >
                  随机
                </button>
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">设置密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码（至少6位）"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">确认密码</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={6}
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm disabled:opacity-50"
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
              onClick={handleRegisterCustomer} disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '注册中...' : '注册'}
            </button>

            {/* 已有账号？登录 */}
            <div className="text-center text-sm text-[#6b6375] pt-1">
              已有账号？{' '}
              <button
                onClick={() => { setStep('login'); setError(''); }}
                className="text-[#f59e0b] hover:underline font-medium"
              >
                立即登录
              </button>
            </div>
          </div>
        )}

        {/* ========== 工程师注册第1步：账户信息 ========== */}
        {step === 'register-engineer-1' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('login')} className="text-sm text-[#6b6375] hover:text-[#f59e0b]">← 返回登录</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6375]">注册成为工程师</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium mb-1">用户名</label>
              <div className="flex gap-2">
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="给自己起个用户名"
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  type="button"
                  onClick={handleRandomName}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-xs text-[#6b6375] hover:text-[#f59e0b]"
                >
                  随机
                </button>
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">设置密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码（至少6位）"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium mb-1">确认密码</label>
              <input
                type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 手机号 */}
            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium mb-1">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={6}
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm disabled:opacity-50"
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
              onClick={() => { setError(''); setStep('register-engineer-2'); }}
              disabled={!name || !password || !confirmPassword || phone.length !== 11}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              下一步：填写背景信息
            </button>

            {/* 已有账号？登录 */}
            <div className="text-center text-sm text-[#6b6375] pt-1">
              已有账号？{' '}
              <button
                onClick={() => { setStep('login'); setError(''); }}
                className="text-[#f59e0b] hover:underline font-medium"
              >
                立即登录
              </button>
            </div>
          </div>
        )}

        {/* ========== 工程师注册第2步：背景调查 ========== */}
        {step === 'register-engineer-2' && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('register-engineer-1')} className="text-sm text-[#6b6375] hover:text-[#f59e0b]">← 返回上一步</button>
            </div>

            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6375]">完成背景信息（用于精准接单）</p>
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
                    <p className="text-xs text-[#6b6375] mb-1">{type}：</p>
                    {/* 预设品牌按钮 */}
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {(commonBrands[type] || []).map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          onClick={() => toggleBrand(type, brand)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            (brands[type] || []).includes(brand)
                              ? 'bg-[#fbbf24] text-white'
                              : 'bg-[#f4f3f4] dark:bg-[#2a3a4c] text-[#6b6375]'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                    {/* 品牌 TagInput（空白框） */}
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
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] resize-none"
              />
            </div>

            <button
              onClick={handleRegisterEngineer} disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '注册中...' : '注册成为工程师'}
            </button>
          </div>
        )}

        {/* ========== 忘记密码页 ========== */}
        {step === 'forgot-password' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setStep('login')} className="text-sm text-[#6b6375] hover:text-[#f59e0b]">← 返回登录</button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6375]">输入手机号，我们将发送验证码重置密码</p>
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
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">验证码</label>
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={6}
                  className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
              </div>
            )}

            {forgotStep === 'code-sent' && (
              <div>
                <label className="block text-sm font-medium mb-1">设置新密码</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="设置新密码（至少6位）"
                  className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
              </div>
            )}

            <button
              onClick={forgotStep === 'code-sent' ? handleResetPassword : handleSendResetCode}
              disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '处理中...' : forgotStep === 'code-sent' ? '重置密码' : '发送验证码'}
            </button>
          </div>
        )}

        {/* ========== 登录页 ========== */}
        {step === 'login' && (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <p className="text-sm text-[#6b6375]">有任何钣金加工设备的问题，随时问AI小智</p>
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
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] text-[#08060d] dark:text-[#f3f4f6] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            {/* 记住登录状态 */}
            <div className="flex items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#e5e4e7] dark:border-[#3a3a4c] text-[#f59e0b] focus:ring-[#f59e0b]"
                />
                <span className="text-[#6b6375]">保持登录状态</span>
              </label>
            </div>
            <button
              onClick={handleLogin} disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '登录中...' : '登录'}
            </button>

            {/* 注册链接 */}
            <div className="text-center text-sm text-[#6b6375] pt-1">
              还没有账户？{' '}
              <button
                onClick={() => goToRegisterCustomer()}
                className="text-[#f59e0b] hover:underline font-medium"
              >
                点击注册
              </button>
              {' 或 '}
              <button
                onClick={() => setStep('forgot-password')}
                className="text-[#f59e0b] hover:underline font-medium"
              >
                忘记密码
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
