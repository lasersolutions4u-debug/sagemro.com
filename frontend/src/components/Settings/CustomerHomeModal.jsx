import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Building2 } from 'lucide-react';
import { updateCustomerProfile, changePassword } from '../../services/api';
import { isCnLocale } from '../../utils/locale';

const authStatusLabels = {
  authenticated: { en: 'Verified', cn: '已认证', color: 'px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 text-[11px]' },
  pending: { en: 'Pending Verification', cn: '待认证', color: 'px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 text-[11px]' },
  rejected: { en: 'Verification Rejected', cn: '认证未通过', color: 'px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[11px]' },
  guest: { en: 'Guest', cn: '访客', color: 'px-2 py-0.5 rounded-full bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] text-[11px]' },
};

export function CustomerHomeModal({ isOpen, onClose, currentUser, userType }) {
  const isCn = isCnLocale();
  const [tab, setTab] = useState('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    company: '',
    city: '',
    address: '',
    phone: '',
    company_description: '',
    business_scope: '',
    logo_url: '',
  });

  const [theme, setTheme] = useState('system');
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (isOpen && currentUser && userType === 'customer') {
      setForm({
        company: currentUser.company || '',
        city: currentUser.city || '',
        address: currentUser.address || '',
        phone: currentUser.phone || '',
        company_description: currentUser.company_description || '',
        business_scope: currentUser.business_scope || '',
        logo_url: currentUser.logo_url || '',
      });
      setTheme(localStorage.getItem('sagemro_theme') || 'system');
      setError('');
      setSuccess('');
      setTab('info');
    }
  }, [isOpen, currentUser, userType]);

  const handleSaveInfo = async () => {
    setLoading(true);
    setError('');
    try {
      await updateCustomerProfile(form);
      const updated = { ...currentUser, ...form };
      localStorage.setItem('sagemro_user', JSON.stringify(updated));
      setSuccess(isCn ? '已保存' : 'Saved successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || (isCn ? '保存失败' : 'Save failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('sagemro_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleChangePassword = async () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setError(isCn ? '两次输入的新密码不一致' : 'New passwords do not match');
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      setError(isCn ? '密码至少需要 6 位字符' : 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(isCn ? '密码已更新' : 'Password changed successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || (isCn ? '更新失败' : 'Update failed'));
    } finally {
      setLoading(false);
    }
  };

  const status = authStatusLabels[currentUser?.auth_status] || authStatusLabels.pending;

  const inputClass = "w-full bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCn ? '公司资料' : 'Company Profile'} size="lg">
      <div className="flex flex-col gap-5">

        {/* 头部：公司 Logo + 名称 + 认证状态 */}
        <div className="flex items-center gap-4 p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm">
          <div className="w-16 h-16 rounded-xl bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {form.logo_url ? (
              <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 size={28} className="text-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-semibold text-[var(--color-text-primary)] truncate">
              {form.company || (isCn ? '公司名称待完善' : 'Company name not set')}
            </div>
            <div className="text-[13px] text-[var(--color-text-secondary)] truncate mt-0.5">
              {currentUser?.phone}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={status.color}>
                {isCn ? status.cn : status.en}
              </span>
              {form.city && (
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  {form.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-[var(--color-border)]">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'info'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {isCn ? '公司信息' : 'Company Info'}
          </button>
          <button
            onClick={() => setTab('preferences')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'preferences'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {isCn ? '偏好设置' : 'Preferences'}
          </button>
          <button
            onClick={() => setTab('security')}
            className={`flex-1 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              tab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {isCn ? '账户安全' : 'Security'}
          </button>
        </div>

        {/* 标签页内容 */}
        <div className="min-h-[280px]">

          {/* 公司信息 */}
          {tab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '公司名称' : 'Company Name'}</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  placeholder={isCn ? '例如：某某钣金制造有限公司' : 'e.g. ABC Metal Products Co., Ltd.'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '所在城市' : 'City'}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder={isCn ? '例如：苏州' : 'e.g. Shanghai'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '详细地址' : 'Address'}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder={isCn ? '例如：工业园区某某路 123 号' : 'e.g. 123 Industrial Park Road'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '联系电话' : 'Phone'}</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder={isCn ? '手机或固定电话' : 'Mobile or landline'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '公司简介' : 'Company Description'}</label>
                <textarea
                  value={form.company_description}
                  onChange={e => setForm({ ...form, company_description: e.target.value })}
                  placeholder={isCn ? '简单介绍你的工厂、设备和主要加工业务。' : 'Briefly describe your company...'}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '主营业务' : 'Business Scope'}</label>
                <input
                  type="text"
                  value={form.business_scope}
                  onChange={e => setForm({ ...form, business_scope: e.target.value })}
                  placeholder={isCn ? '例如：钣金加工、激光切割、折弯焊接' : 'e.g. Sheet metal fabrication, laser cutting, bending'}
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-[13px] text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
              )}
              {success && (
                <div className="text-[13px] text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg px-3 py-2">{success}</div>
              )}

              <button
                onClick={handleSaveInfo}
                disabled={loading}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-lg text-[14px] font-medium transition-colors"
              >
                {loading ? (isCn ? '保存中...' : 'Saving...') : (isCn ? '保存修改' : 'Save Changes')}
              </button>
            </div>
          )}

          {/* 偏好设置 */}
          {tab === 'preferences' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-3">{isCn ? '显示偏好' : 'Appearance'}</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--color-border)] hover:border-blue-400'
                    }`}
                  >
                    <span className="text-2xl">☀️</span>
                    <span className="text-[13px] text-[var(--color-text-primary)]">{isCn ? '浅色' : 'Light'}</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--color-border)] hover:border-blue-400'
                    }`}
                  >
                    <span className="text-2xl">🌙</span>
                    <span className="text-[13px] text-[var(--color-text-primary)]">{isCn ? '深色' : 'Dark'}</span>
                  </button>
                  <button
                    onClick={() => handleThemeChange('system')}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      theme === 'system'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--color-border)] hover:border-blue-400'
                    }`}
                  >
                    <span className="text-2xl">💻</span>
                    <span className="text-[13px] text-[var(--color-text-primary)]">{isCn ? '跟随系统' : 'System'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 账户安全 */}
          {tab === 'security' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '当前密码' : 'Current Password'}</label>
                <input
                  type="password"
                  value={pwdForm.oldPassword}
                  onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  placeholder={isCn ? '请输入当前密码' : 'Enter your current password'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '新密码' : 'New Password'}</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  placeholder={isCn ? '至少 6 位字符' : 'At least 6 characters'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1.5">{isCn ? '确认新密码' : 'Confirm New Password'}</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  placeholder={isCn ? '请再次输入新密码' : 'Re-enter your new password'}
                  className={inputClass}
                />
              </div>

              {error && (
                <div className="text-[13px] text-red-600 dark:text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
              )}
              {success && (
                <div className="text-[13px] text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg px-3 py-2">{success}</div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white rounded-lg text-[14px] font-medium transition-colors"
              >
                {loading ? (isCn ? '更新中...' : 'Updating...') : (isCn ? '修改密码' : 'Change Password')}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
