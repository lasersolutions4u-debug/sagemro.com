import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Package, User, Wallet, Star, ToggleLeft, ToggleRight, ChevronRight, Lock, X } from 'lucide-react';
import { updateCustomerProfile, updateEngineerProfile, changePassword, getEngineerProfile, getEngineerWallet, updateEngineerStatus } from '../../services/api';

export function SettingsModal({ isOpen, onClose, currentUser, userType, onOpenMyDevices }) {
  const [tab, setTab] = useState('profile'); // 'profile' | 'devices' | 'password'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 客户档案
  const [customerForm, setCustomerForm] = useState({ name: '', region: '' });

  // 合伙人档案
  const [engineerForm, setEngineerForm] = useState({ name: '', bio: '', service_region: '' });
  const [engineerStats, setEngineerStats] = useState(null);
  const [engineerWallet, setEngineerWallet] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('available');

  // 密码修改
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // 设备数量（从父组件传入或本地获取）
  const [deviceCount] = useState(0);

  useEffect(() => {
    if (isOpen && currentUser) {
      if (userType === 'customer') {
        setCustomerForm({ name: currentUser.name || '', region: currentUser.region || '' });
      } else if (userType === 'engineer') {
        setEngineerForm({
          name: currentUser.name || '',
          bio: currentUser.bio || '',
          service_region: currentUser.service_region || '',
        });
        setCurrentStatus(currentUser.status || 'available');
        loadEngineerData();
      }
      setError('');
      setSuccess('');
      setTab('profile');
    }
  }, [isOpen, currentUser, userType]);

  async function loadEngineerData() {
    const engineerId = localStorage.getItem('sagemro_engineer_id');
    if (!engineerId) return;
    try {
      const [profileRes, walletRes] = await Promise.all([
        getEngineerProfile(engineerId),
        getEngineerWallet(engineerId),
      ]);
      setEngineerStats({
        level: profileRes.engineer?.level,
        commission_rate: profileRes.engineer?.commission_rate,
        credit_score: profileRes.engineer?.credit_score,
        rating: profileRes.engineer?.rating_count > 0
          ? ((profileRes.engineer.rating_timeliness + profileRes.engineer.rating_technical + profileRes.engineer.rating_communication + profileRes.engineer.rating_professional) / 4).toFixed(1)
          : '暂无',
        rating_count: profileRes.engineer?.rating_count || 0,
      });
      setEngineerWallet(walletRes);
    } catch (err) {
      console.error('加载合伙人数据失败', err);
    }
  }

  async function handleSaveProfile() {
    setLoading(true);
    setError('');
    try {
      if (userType === 'customer') {
        await updateCustomerProfile(customerForm);
        const updated = { ...currentUser, ...customerForm };
        localStorage.setItem('sagemro_user', JSON.stringify(updated));
      } else {
        await updateEngineerProfile(engineerForm);
        const updated = { ...currentUser, ...engineerForm };
        localStorage.setItem('sagemro_user', JSON.stringify(updated));
      }
      setSuccess('保存成功');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusToggle() {
    const newStatus = currentStatus === 'available' ? 'paused' : 'available';
    const engineerId = localStorage.getItem('sagemro_engineer_id');
    if (!engineerId) return;
    try {
      await updateEngineerStatus({ engineer_id: engineerId, status: newStatus });
      setCurrentStatus(newStatus);
      const updated = { ...currentUser, status: newStatus };
      localStorage.setItem('sagemro_user', JSON.stringify(updated));
    } catch (err) {
      setError('状态更新失败');
    }
  }

  async function handleChangePassword() {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      setError('新密码至少6位');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('密码修改成功');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || '修改失败');
    } finally {
      setLoading(false);
    }
  }

  const statusLabels = { available: '接单中', paused: '暂停接单', offline: '离线' };
  const statusColors = { available: 'text-green-500', paused: 'text-yellow-500', offline: 'text-gray-400' };

  const levelLabels = { junior: '初级', senior: '中级', expert: '专家' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="个人中心" size="md">
      <div className="flex flex-col gap-5">
        {/* 头像 + 名称区 */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-semibold">
              {currentUser?.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium text-[var(--color-sidebar-text)] truncate">
              {currentUser?.name}
            </div>
            <div className="text-[12px] text-[var(--color-sidebar-text)] opacity-50 truncate">
              {currentUser?.phone}
            </div>
            {userType === 'engineer' && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] px-1.5 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">
                  {levelLabels[engineerStats?.level] || '初级'}合伙人
                </span>
                <span className={`text-[11px] ${statusColors[currentStatus]}`}>
                  {statusLabels[currentStatus]}
                </span>
              </div>
            )}
          </div>
          {/* 接单状态开关（合伙人） */}
          {userType === 'engineer' && (
            <button
              onClick={handleStatusToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                currentStatus === 'available'
                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
              }`}
            >
              {currentStatus === 'available' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {statusLabels[currentStatus]}
            </button>
          )}
        </div>

        {/* 合伙人统计卡片 */}
        {userType === 'engineer' && engineerWallet && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#2a2a3c] rounded-xl p-3 text-center">
              <div className="text-[18px] font-semibold text-green-400">
                ¥{engineerWallet.wallet?.wallet_balance ?? 0}
              </div>
              <div className="text-[11px] text-[var(--color-sidebar-text)] opacity-50 mt-0.5">钱包余额</div>
            </div>
            <div className="bg-[#2a2a3c] rounded-xl p-3 text-center">
              <div className="text-[18px] font-semibold text-[var(--color-sidebar-text)]">
                ¥{engineerWallet.wallet?.deposit_balance ?? 0}
              </div>
              <div className="text-[11px] text-[var(--color-sidebar-text)] opacity-50 mt-0.5">保证金</div>
            </div>
            <div className="bg-[#2a2a3c] rounded-xl p-3 text-center">
              <div className="text-[18px] font-semibold text-yellow-400 flex items-center justify-center gap-1">
                <Star size={14} className="fill-yellow-400" />
                {engineerStats?.rating || '暂无'}
              </div>
              <div className="text-[11px] text-[var(--color-sidebar-text)] opacity-50 mt-0.5">
                {engineerStats?.rating_count || 0}次评价
              </div>
            </div>
          </div>
        )}

        {/* 标签页 */}
        <div className="flex border-b border-[#3a3a4c]">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'profile'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-sidebar-text)] opacity-50 hover:opacity-80'
            }`}
          >
            档案信息
          </button>
          {userType === 'customer' && (
            <button
              onClick={() => setTab('devices')}
              className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                tab === 'devices'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-sidebar-text)] opacity-50 hover:opacity-80'
              }`}
            >
              我的设备
            </button>
          )}
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'password'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-sidebar-text)] opacity-50 hover:opacity-80'
            }`}
          >
            修改密码
          </button>
        </div>

        {/* 标签页内容 */}
        <div className="min-h-[200px]">

          {/* 档案信息 */}
          {tab === 'profile' && (
            <div className="space-y-4">
              {userType === 'customer' ? (
                <>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">姓名</label>
                    <input
                      type="text"
                      value={customerForm.name}
                      onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                      className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">手机号</label>
                    <input
                      type="text"
                      value={currentUser?.phone || ''}
                      readOnly
                      className="w-full bg-[#2a2a3c]/50 border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">所在地区</label>
                    <input
                      type="text"
                      value={customerForm.region}
                      onChange={e => setCustomerForm({ ...customerForm, region: e.target.value })}
                      placeholder="如：华东地区、苏州市"
                      className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">姓名</label>
                    <input
                      type="text"
                      value={engineerForm.name}
                      onChange={e => setEngineerForm({ ...engineerForm, name: e.target.value })}
                      className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">手机号</label>
                    <input
                      type="text"
                      value={currentUser?.phone || ''}
                      readOnly
                      className="w-full bg-[#2a2a3c]/50 border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">服务地区</label>
                    <input
                      type="text"
                      value={engineerForm.service_region}
                      onChange={e => setEngineerForm({ ...engineerForm, service_region: e.target.value })}
                      placeholder="如：华东地区、苏州市"
                      className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">个人简介</label>
                    <textarea
                      value={engineerForm.bio}
                      onChange={e => setEngineerForm({ ...engineerForm, bio: e.target.value })}
                      placeholder="向客户介绍一下自己..."
                      rows={3}
                      className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] resize-none"
                    />
                  </div>
                  {/* 合伙人等级信息 */}
                  <div className="bg-[#2a2a3c] rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-sidebar-text)] opacity-60">等级</span>
                      <span className="text-[var(--color-sidebar-text)]">{levelLabels[engineerStats?.level] || '初级'}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-sidebar-text)] opacity-60">提成比例</span>
                      <span className="text-green-400">{((engineerStats?.commission_rate || 0.8) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-sidebar-text)] opacity-60">信用分</span>
                      <span className="text-[var(--color-sidebar-text)]">{engineerStats?.credit_score ?? 100}</span>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="text-[13px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
              )}
              {success && (
                <div className="text-[13px] text-green-400 bg-green-400/10 rounded-lg px-3 py-2">{success}</div>
              )}

              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-[14px] font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存修改'}
              </button>
            </div>
          )}

          {/* 我的设备 */}
          {tab === 'devices' && userType === 'customer' && (
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--color-sidebar-text)] opacity-60">
                在这里管理您的设备档案，每个设备都有独立的维修记录。
              </p>
              <button
                onClick={() => { onClose(); onOpenMyDevices(); }}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#2a2a3c] hover:bg-[#3a3a4c] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/20 flex items-center justify-center">
                    <Package size={20} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-medium text-[var(--color-sidebar-text)]">我的设备</div>
                    <div className="text-[12px] text-[var(--color-sidebar-text)] opacity-50">查看全部设备档案</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[var(--color-sidebar-text)] opacity-40" />
              </button>
            </div>
          )}

          {/* 修改密码 */}
          {tab === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">旧密码</label>
                <input
                  type="password"
                  value={pwdForm.oldPassword}
                  onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  placeholder="请输入旧密码"
                  className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">新密码</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  placeholder="至少6位"
                  className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">确认新密码</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  placeholder="再次输入新密码"
                  className="w-full bg-[#2a2a3c] border border-[#3a3a4c] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                />
              </div>

              {error && (
                <div className="text-[13px] text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
              )}
              {success && (
                <div className="text-[13px] text-green-400 bg-green-400/10 rounded-lg px-3 py-2">{success}</div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-[14px] font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '修改中...' : '修改密码'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
