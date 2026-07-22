import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Package, Star, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { updateCustomerProfile, updateEngineerProfile, changePassword, getEngineerProfile, updateEngineerStatus } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    title: 'Account',
    saved: 'Saved successfully',
    saveFailed: 'Save failed',
    statusFailed: 'Failed to update status',
    passwordMismatch: 'New passwords do not match',
    passwordTooShort: 'New password must be at least 10 characters',
    passwordSaved: 'Password changed successfully',
    changeFailed: 'Change failed',
    status: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    level: { junior: 'Junior', senior: 'Senior', expert: 'Expert' },
    engineerSuffix: 'SAGEMRO Engineer',
    serviceScore: 'Service Score',
    reviews: 'reviews',
    profile: 'Profile',
    devices: 'My Equipment',
    password: 'Change Password',
    name: 'Name',
    phone: 'Phone',
    region: 'Region',
    regionPlaceholder: 'e.g. East China, Suzhou',
    serviceRegion: 'Service Region',
    bio: 'Bio',
    bioPlaceholder: 'Introduce yourself to customers...',
    levelLabel: 'Level',
    creditScore: 'Credit Score',
    saving: 'Saving...',
    save: 'Save Changes',
    devicesIntro: 'Manage your equipment profiles here. Each equipment has its own repair records.',
    devicesTitle: 'My Equipment',
    devicesSubtitle: 'View all equipment profiles',
    currentPassword: 'Current Password',
    currentPasswordPlaceholder: 'Enter current password',
    newPassword: 'New Password',
    newPasswordPlaceholder: 'At least 10 characters',
    confirmPassword: 'Confirm New Password',
    confirmPasswordPlaceholder: 'Re-enter new password',
    changing: 'Changing...',
  },
  cn: {
    title: '账号',
    saved: '已保存',
    saveFailed: '保存失败',
    statusFailed: '状态更新失败',
    passwordMismatch: '两次输入的新密码不一致',
    passwordTooShort: '新密码至少需要 10 位',
    passwordSaved: '密码已修改',
    changeFailed: '修改失败',
    status: { available: '可接单', paused: '暂停接单', offline: '离线' },
    level: { junior: '初级', senior: '高级', expert: '专家' },
    engineerSuffix: 'SAGEMRO 工程师',
    serviceScore: '服务分',
    reviews: '条评价',
    profile: '个人资料',
    devices: '我的设备',
    password: '修改密码',
    name: '姓名',
    phone: '手机号',
    region: '地区',
    regionPlaceholder: '例如：华东，苏州',
    serviceRegion: '服务区域',
    bio: '简介',
    bioPlaceholder: '向客户介绍你的设备经验和服务能力...',
    levelLabel: '等级',
    creditScore: '信用分',
    saving: '保存中...',
    save: '保存修改',
    devicesIntro: '在这里管理你的设备档案。每台设备都有独立的维修与服务记录。',
    devicesTitle: '我的设备',
    devicesSubtitle: '查看全部设备档案',
    currentPassword: '当前密码',
    currentPasswordPlaceholder: '输入当前密码',
    newPassword: '新密码',
    newPasswordPlaceholder: '至少 10 位',
    confirmPassword: '确认新密码',
    confirmPasswordPlaceholder: '再次输入新密码',
    changing: '修改中...',
  },
};

export function SettingsModal({ isOpen, onClose, currentUser, userType, onOpenMyDevices }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [tab, setTab] = useState('profile'); // 'profile' | 'devices' | 'password'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 客户档案
  const [customerForm, setCustomerForm] = useState({ name: '', region: '' });

  // 工程师档案
  const [engineerForm, setEngineerForm] = useState({ name: '', bio: '', service_region: '' });
  const [engineerStats, setEngineerStats] = useState(null);
  const [currentStatus, setCurrentStatus] = useState('available');

  // 密码修改
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

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
      const profileRes = await getEngineerProfile(engineerId);
      const profile = profileRes.engineer || {};
      setEngineerStats({
        level: profile.level,
        credit_score: profile.credit_score,
        rating: profile.rating_count > 0
          ? ((profile.rating_timeliness + profile.rating_technical + profile.rating_communication + profile.rating_professional) / 4).toFixed(1)
          : 'N/A',
        rating_count: profile.rating_count || 0,
      });
    } catch (err) {
      console.error('Failed to load engineer data', err);
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
      setSuccess(copy.saved);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || copy.saveFailed);
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
      setError(copy.statusFailed);
    }
  }

  async function handleChangePassword() {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }
    if (pwdForm.newPassword.length < 10) {
      setError(copy.passwordTooShort);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(copy.passwordSaved);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || copy.changeFailed);
    } finally {
      setLoading(false);
    }
  }

  const statusLabels = copy.status;
  const statusColors = { available: 'text-green-500', paused: 'text-yellow-500', offline: 'text-gray-400' };

  const levelLabels = copy.level;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
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
                  {levelLabels[engineerStats?.level] || copy.level.junior} {copy.engineerSuffix}
                </span>
                <span className={`text-[11px] ${statusColors[currentStatus]}`}>
                  {statusLabels[currentStatus]}
                </span>
              </div>
            )}
          </div>
          {/* 派工状态开关（内部工程师） */}
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

        {/* 工程师统计卡片 */}
        {userType === 'engineer' && engineerStats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 text-center">
              <div className="text-[18px] font-semibold text-green-400">
                {engineerStats?.credit_score ?? 100}
              </div>
              <div className="text-[11px] text-[var(--color-sidebar-text)] opacity-50 mt-0.5">{copy.serviceScore}</div>
            </div>
            <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 text-center">
              <div className="text-[18px] font-semibold text-yellow-400 flex items-center justify-center gap-1">
                <Star size={14} className="fill-yellow-400" />
                {engineerStats?.rating || 'N/A'}
              </div>
              <div className="text-[11px] text-[var(--color-sidebar-text)] opacity-50 mt-0.5">
                {engineerStats?.rating_count || 0} {copy.reviews}
              </div>
            </div>
          </div>
        )}

        {/* 标签页 */}
        <div className="flex border-b border-[var(--color-border)]">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'profile'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-sidebar-text)] opacity-50 hover:opacity-80'
            }`}
          >
            {copy.profile}
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
              {copy.devices}
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
            {copy.password}
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
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.name}</label>
                    <input
                      type="text"
                      value={customerForm.name}
                      onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                      className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.phone}</label>
                    <input
                      type="text"
                      value={currentUser?.phone || ''}
                      readOnly
                      className="w-full bg-[var(--color-input-bg)]/50 border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.region}</label>
                    <input
                      type="text"
                      value={customerForm.region}
                      onChange={e => setCustomerForm({ ...customerForm, region: e.target.value })}
                      placeholder={copy.regionPlaceholder}
                      className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.name}</label>
                    <input
                      type="text"
                      value={engineerForm.name}
                      onChange={e => setEngineerForm({ ...engineerForm, name: e.target.value })}
                      className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.phone}</label>
                    <input
                      type="text"
                      value={currentUser?.phone || ''}
                      readOnly
                      className="w-full bg-[var(--color-input-bg)]/50 border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.serviceRegion}</label>
                    <input
                      type="text"
                      value={engineerForm.service_region}
                      onChange={e => setEngineerForm({ ...engineerForm, service_region: e.target.value })}
                      placeholder={copy.regionPlaceholder}
                      className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.bio}</label>
                    <textarea
                      value={engineerForm.bio}
                      onChange={e => setEngineerForm({ ...engineerForm, bio: e.target.value })}
                      placeholder={copy.bioPlaceholder}
                      rows={3}
                      className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)] resize-none"
                    />
                  </div>
                  {/* 工程师等级信息 */}
                  <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-sidebar-text)] opacity-60">{copy.levelLabel}</span>
                      <span className="text-[var(--color-sidebar-text)]">{levelLabels[engineerStats?.level] || copy.level.junior}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-sidebar-text)] opacity-60">{copy.creditScore}</span>
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
                {loading ? copy.saving : copy.save}
              </button>
            </div>
          )}

          {/* 我的设备 */}
          {tab === 'devices' && userType === 'customer' && (
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--color-sidebar-text)] opacity-60">
                {copy.devicesIntro}
              </p>
              <button
                onClick={() => { onClose(); onOpenMyDevices(); }}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-hover)] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/20 flex items-center justify-center">
                    <Package size={20} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-medium text-[var(--color-sidebar-text)]">{copy.devicesTitle}</div>
                    <div className="text-[12px] text-[var(--color-sidebar-text)] opacity-50">{copy.devicesSubtitle}</div>
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
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.currentPassword}</label>
                <input
                  type="password"
                  value={pwdForm.oldPassword}
                  onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  placeholder={copy.currentPasswordPlaceholder}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.newPassword}</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  placeholder={copy.newPasswordPlaceholder}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-sidebar-text)] opacity-60 mb-1.5">{copy.confirmPassword}</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  placeholder={copy.confirmPasswordPlaceholder}
                  className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-sidebar-text)]"
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
                {loading ? copy.changing : copy.password}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
