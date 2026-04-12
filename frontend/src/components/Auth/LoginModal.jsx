import { useState } from 'react';
import { Modal } from '../common/Modal';
import { X } from 'lucide-react';
import { login, sendVerifyCode, registerCustomer, registerEngineer } from '../../services/api';

// 设备类型选项
const deviceTypes = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

// 常用品牌
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

// 常用服务项目
const commonServices = [
  '激光器维修', '切割头维护', '导轨润滑', '参数调试',
  '液压维修', '电气排查', '设备保养', '系统升级',
  '年度维保', '应急抢修', '培训指导', '配件供应'
];

export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register-customer' | 'register-engineer'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 工程师背景调查
  const [specialties, setSpecialties] = useState([]); // 设备类型
  const [brands, setBrands] = useState({}); // 品牌 { '激光切割机': ['大族', '通快'] }
  const [services, setServices] = useState([]); // 维修项目
  const [serviceRegion, setServiceRegion] = useState('');
  const [bio, setBio] = useState('');

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone) { setError('请输入手机号'); return; }
    if (phone.length !== 11) { setError('请输入正确的手机号'); return; }

    setCodeSending(true);
    setError('');
    try {
      await sendVerifyCode(phone);
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
    if (!name || !phone || !password || !code) { setError('请填写所有必填项'); return; }

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
    if (!name || !phone || !password || !code) { setError('请填写所有必填项'); return; }
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
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 切换设备类型
  const toggleSpecialty = (type) => {
    setSpecialties(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // 切换品牌
  const toggleBrand = (deviceType, brand) => {
    setBrands(prev => {
      const current = prev[deviceType] || [];
      const updated = current.includes(brand)
        ? current.filter(b => b !== brand)
        : [...current, brand];
      return { ...prev, [deviceType]: updated };
    });
  };

  // 切换服务项目
  const toggleService = (service) => {
    setServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const handleClose = () => {
    setPhone('');
    setPassword('');
    setName('');
    setCode('');
    setError('');
    setSpecialties([]);
    setBrands({});
    setServices([]);
    setServiceRegion('');
    setBio('');
    setActiveTab('login');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="登录/注册" size="lg">
      <div className="space-y-4">
        {/* Tab 切换 */}
        <div className="flex border-b border-[#e5e4e7] dark:border-[#3a3a4c]">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'login'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#6b6375]'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => setActiveTab('register-customer')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'register-customer'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#6b6375]'
            }`}
          >
            我是客户
          </button>
          <button
            onClick={() => setActiveTab('register-engineer')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'register-engineer'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#6b6375]'
            }`}
          >
            我是工程师
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 登录表单 */}
        {activeTab === 'login' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <button
              onClick={handleLogin} disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '登录中...' : '登录'}
            </button>
          </div>
        )}

        {/* 客户注册表单 */}
        {activeTab === 'register-customer' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">姓名</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">手机号</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={4}
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <button
              onClick={handleRegisterCustomer} disabled={submitting}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-[#6b6375] text-white rounded-xl font-medium transition-colors"
            >
              {submitting ? '注册中...' : '注册'}
            </button>
          </div>
        )}

        {/* 工程师注册表单 */}
        {activeTab === 'register-engineer' && (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {/* 基础信息 */}
            <div>
              <label className="block text-sm font-medium mb-1">姓名 *</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">手机号 *</label>
              <input
                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号" maxLength={11}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">验证码 *</label>
              <div className="flex gap-2">
                <input
                  type="text" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码" maxLength={4}
                  className="flex-1 px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                />
                <button
                  onClick={handleSendCode} disabled={codeSending || codeCooldown > 0}
                  className="px-3 py-2 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm disabled:opacity-50"
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码 *</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="设置密码"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 分割线 */}
            <div className="border-t border-[#e5e4e7] dark:border-[#3a3a4c] pt-3 mt-2">
              <p className="text-sm font-medium mb-1">背景信息（用于精准接单）</p>
              <p className="text-xs text-[#6b6375] mb-2">设备类型、品牌、维修项目均以标签形式填写</p>
            </div>

            {/* 设备类型 */}
            <div>
              <label className="block text-xs font-medium mb-2">擅长的设备类型 *</label>
              <div className="flex flex-wrap gap-1.5">
                {deviceTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleSpecialty(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      specialties.includes(type)
                        ? 'bg-[#f59e0b] text-white'
                        : 'bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#6b6375]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 品牌（根据选择的设备类型显示） */}
            {specialties.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-2">熟悉的品牌</label>
                {specialties.map((type) => (
                  <div key={type} className="mb-2">
                    <p className="text-xs text-[#6b6375] mb-1">{type}：</p>
                    <div className="flex flex-wrap gap-1">
                      {(commonBrands[type] || []).map((brand) => (
                        <button
                          key={brand}
                          onClick={() => toggleBrand(type, brand)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            (brands[type] || []).includes(brand)
                              ? 'bg-[#fbbf24] text-white'
                              : 'bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#6b6375]'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 维修项目 */}
            <div>
              <label className="block text-xs font-medium mb-2">擅长的维修项目 *</label>
              <div className="flex flex-wrap gap-1.5">
                {commonServices.map((service) => (
                  <button
                    key={service}
                    onClick={() => toggleService(service)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      services.includes(service)
                        ? 'bg-[#f59e0b] text-white'
                        : 'bg-[#f4f3f4] dark:bg-[#2a2a3c] text-[#6b6375]'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            {/* 服务地区 */}
            <div>
              <label className="block text-xs font-medium mb-1">服务覆盖地区</label>
              <input
                type="text" value={serviceRegion} onChange={(e) => setServiceRegion(e.target.value)}
                placeholder="如：华东地区 / 苏州 / 上海及周边"
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
            </div>

            {/* 个人简介 */}
            <div>
              <label className="block text-xs font-medium mb-1">个人简介（选填）</label>
              <textarea
                value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="向客户展示您的自我介绍"
                rows={2}
                className="w-full px-3 py-2 border border-[#e5e4e7] dark:border-[#3a3a4c] rounded-xl bg-white dark:bg-[#2a2a3c] focus:outline-none focus:ring-2 focus:ring-[#f59e0b] resize-none"
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
      </div>
    </Modal>
  );
}
