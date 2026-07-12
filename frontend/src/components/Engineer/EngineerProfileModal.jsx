import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Star, MapPin, Phone, Briefcase, Wrench, Award, Bell, BellOff, CreditCard } from 'lucide-react';
import { getEngineerProfile, updateEngineerProfile } from '../../services/api';
import { usePushNotification } from '../../hooks/usePushNotification';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    title: 'SAGEMRO Engineer Profile',
    loading: 'Loading...',
    status: { available: 'Available', paused: 'Paused', offline: 'Offline' },
    overallRating: 'Overall Rating',
    reviews: 'reviews',
    timeliness: 'Timeliness',
    technical: 'Technical Skill',
    communication: 'Communication',
    professionalism: 'Professionalism',
    specialties: 'Equipment Specialties',
    brands: 'Familiar Brands',
    services: 'Maintenance & Repair Services',
    bio: 'Bio',
    payoutSaved: 'Payout method saved.',
    payoutFailed: 'Failed to save payout method.',
    payoutTitle: 'Engineer payout method',
    paypalAccount: 'PayPal account',
    bankSwift: 'Bank transfer / SWIFT',
    paypalPlaceholder: 'PayPal email account',
    bankCountry: 'Bank country',
    accountHolder: 'Account holder',
    bankName: 'Bank name',
    bankAccount: 'Bank account',
    swiftCode: 'SWIFT code',
    adminNotes: 'Notes for Admin',
    payoutNote: 'SAGEMRO currently supports PayPal account and Bank transfer / SWIFT for engineer service payments.',
    saving: 'Saving...',
    savePayout: 'Save payout method',
    pushTitle: 'Push Notifications',
    pushEnabled: 'Enabled - notifications for service assignments and internal updates',
    pushBlocked: 'Blocked by browser',
    pushDisabled: 'Disabled',
    disable: 'Disable',
    enable: 'Enable',
    memberSince: 'Member since',
    dateLocale: 'en-US',
  },
  cn: {
    title: 'SAGEMRO 工程师资料',
    loading: '加载中...',
    status: { available: '可接单', paused: '暂停接单', offline: '离线' },
    overallRating: '综合评分',
    reviews: '条评价',
    timeliness: '及时性',
    technical: '技术能力',
    communication: '沟通配合',
    professionalism: '专业度',
    specialties: '设备专长',
    brands: '熟悉品牌',
    services: '服务项目',
    bio: '简介',
    payoutSaved: '收款方式已保存。',
    payoutFailed: '收款方式保存失败。',
    payoutTitle: '工程师收款方式',
    paypalAccount: 'PayPal 账号',
    bankSwift: '银行转账 / SWIFT',
    paypalPlaceholder: 'PayPal 邮箱账号',
    bankCountry: '银行所在国家',
    accountHolder: '账户姓名',
    bankName: '银行名称',
    bankAccount: '银行账号',
    swiftCode: 'SWIFT 代码',
    adminNotes: '给 Admin 的备注',
    payoutNote: 'SAGEMRO 目前支持 PayPal 账号和银行转账 / SWIFT 作为工程师服务结算方式。',
    saving: '保存中...',
    savePayout: '保存收款方式',
    pushTitle: '推送通知',
    pushEnabled: '已开启 - 接收服务派工和内部更新通知',
    pushBlocked: '浏览器已阻止',
    pushDisabled: '未开启',
    disable: '关闭',
    enable: '开启',
    memberSince: '加入时间',
    dateLocale: 'zh-CN',
  },
};

export function EngineerProfileModal({ isOpen, onClose, engineerId }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    payout_method: 'paypal',
    paypal_account: '',
    bank_country: '',
    bank_name: '',
    bank_account: '',
    bank_swift_code: '',
    account_holder: '',
    payout_notes: '',
  });
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');
  const { pushEnabled, pushPermission, enablePush, disablePush, isConfigured } =
    usePushNotification(engineerId, !!engineerId);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEngineerProfile(engineerId);
      setProfile(data.engineer);
      setPayoutForm({
        payout_method: data.engineer?.payout_method || 'paypal',
        paypal_account: data.engineer?.paypal_account || '',
        bank_country: data.engineer?.bank_country || '',
        bank_name: data.engineer?.bank_name || '',
        bank_account: data.engineer?.bank_account || '',
        bank_swift_code: data.engineer?.bank_swift_code || '',
        account_holder: data.engineer?.account_holder || '',
        payout_notes: data.engineer?.payout_notes || '',
      });
    } catch (e) {
      console.error('加载工程师档案失败:', e);
    } finally {
      setLoading(false);
    }
  }, [engineerId]);

  useEffect(() => {
    if (!isOpen || !engineerId) return;
    loadProfile();
  }, [isOpen, engineerId, loadProfile]);

  const handlePushToggle = async () => {
    if (pushEnabled) {
      await disablePush();
    } else {
      await enablePush();
    }
  };

  // 评分显示
  const renderStars = (rating) => {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  };

  const updatePayoutField = (field, value) => {
    setPayoutForm((prev) => ({ ...prev, [field]: value }));
    setPayoutMessage('');
  };

  const handleSavePayout = async () => {
    setPayoutSaving(true);
    setPayoutMessage('');
    try {
      const data = await updateEngineerProfile(payoutForm);
      setProfile(data.engineer);
      setPayoutMessage(copy.payoutSaved);
    } catch (e) {
      setPayoutMessage(e.message || copy.payoutFailed);
    } finally {
      setPayoutSaving(false);
    }
  };

  const avgRating = profile
    ? (
        (profile.rating_timeliness || 0) +
        (profile.rating_technical || 0) +
        (profile.rating_communication || 0) +
        (profile.rating_professional || 0)
      ) / 4
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title} size="md">
      <div className="space-y-5">
        {loading && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">{copy.loading}</div>
        )}

        {!loading && profile && (
          <>
            {/* 基本信息 */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {profile.name?.charAt(0) || 'E'}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {profile.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {profile.status === 'available' && (
                    <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded">{copy.status.available}</span>
                  )}
                  {profile.status === 'paused' && (
                    <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded">{copy.status.paused}</span>
                  )}
                  {profile.status === 'offline' && (
                    <span className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded">{copy.status.offline}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 联系方式 */}
            <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-1">
                <Phone size={14} />
                <span>{profile.phone}</span>
              </div>
              {profile.service_region && (
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>{profile.service_region}</span>
                </div>
              )}
            </div>

            {/* 评分 */}
            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{copy.overallRating}</span>
                <span className="text-xl font-bold text-[var(--color-primary)]">{avgRating.toFixed(1)}</span>
              </div>
              <div className="text-[var(--color-primary)] text-lg mb-3">
                {renderStars(avgRating)}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {profile.rating_count || 0} {copy.reviews}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{copy.timeliness}</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_timeliness?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{copy.technical}</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_technical?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{copy.communication}</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_communication?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{copy.professionalism}</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_professional?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
            </div>

            {/* 擅长的设备类型 */}
            {profile.specialties && profile.specialties.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={16} className="text-[var(--color-primary)]" />
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    {copy.specialties}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.specialties.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 熟悉的品牌 */}
            {profile.brands && Object.keys(profile.brands).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award size={16} className="text-[var(--color-primary)]" />
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    {copy.brands}
                  </h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(profile.brands).map(([type, brands]) => (
                    <div key={type} className="flex items-start gap-2">
                      <span className="text-xs text-[var(--color-text-secondary)] min-w-[80px]">{type}：</span>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(brands) ? brands : []).map((b, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[var(--color-surface-elevated)] text-[var(--color-primary)] rounded text-xs"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 维修保养项目 */}
            {profile.services && profile.services.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wrench size={16} className="text-[var(--color-primary)]" />
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    {copy.services}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.services.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] rounded-lg text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 个人简介 */}
            {profile.bio && (
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  {copy.bio}
                </h3>
                <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl text-sm text-[var(--color-text-secondary)]">
                  {profile.bio}
                </div>
              </div>
            )}

            {/* 推送通知设置 */}
            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-[var(--color-primary)]" />
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {copy.payoutTitle}
                </h3>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="payout_method"
                      checked={payoutForm.payout_method === 'paypal'}
                      onChange={() => updatePayoutField('payout_method', 'paypal')}
                      className="mr-2"
                    />
                    {copy.paypalAccount}
                  </label>
                  <label className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="payout_method"
                      checked={payoutForm.payout_method === 'bank_swift'}
                      onChange={() => updatePayoutField('payout_method', 'bank_swift')}
                      className="mr-2"
                    />
                    {copy.bankSwift}
                  </label>
                </div>

                {payoutForm.payout_method === 'paypal' ? (
                  <label className="text-xs text-[var(--color-text-secondary)]">
                    {copy.paypalAccount}
                    <input
                      value={payoutForm.paypal_account}
                      onChange={(event) => updatePayoutField('paypal_account', event.target.value)}
                      placeholder={copy.paypalPlaceholder}
                      className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                    />
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.bankCountry}
                      <input value={payoutForm.bank_country} onChange={(event) => updatePayoutField('bank_country', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.accountHolder}
                      <input value={payoutForm.account_holder} onChange={(event) => updatePayoutField('account_holder', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.bankName}
                      <input value={payoutForm.bank_name} onChange={(event) => updatePayoutField('bank_name', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      {copy.bankAccount}
                      <input value={payoutForm.bank_account} onChange={(event) => updatePayoutField('bank_account', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)] sm:col-span-2">
                      {copy.swiftCode}
                      <input value={payoutForm.bank_swift_code} onChange={(event) => updatePayoutField('bank_swift_code', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                  </div>
                )}

                <label className="text-xs text-[var(--color-text-secondary)]">
                  {copy.adminNotes}
                  <textarea
                    value={payoutForm.payout_notes}
                    onChange={(event) => updatePayoutField('payout_notes', event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {copy.payoutNote}
                  </p>
                  <button
                    type="button"
                    onClick={handleSavePayout}
                    disabled={payoutSaving}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {payoutSaving ? copy.saving : copy.savePayout}
                  </button>
                </div>
                {payoutMessage && <div className="text-xs text-[var(--color-text-secondary)]">{payoutMessage}</div>}
              </div>
            </div>

            {isConfigured && (
              <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pushEnabled ? (
                      <Bell size={20} className="text-[var(--color-primary)]" />
                    ) : (
                      <BellOff size={20} className="text-[var(--color-text-secondary)]" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">
                        {copy.pushTitle}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {pushEnabled
                          ? copy.pushEnabled
                          : pushPermission === 'denied'
                          ? copy.pushBlocked
                          : copy.pushDisabled}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePushToggle}
                    disabled={pushPermission === 'denied'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pushEnabled
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    {pushEnabled ? copy.disable : copy.enable}
                  </button>
                </div>
              </div>
            )}

            {/* 注册时间 */}
            <div className="text-xs text-[var(--color-text-secondary)] text-center pt-2">
              {copy.memberSince}: {new Date(profile.created_at).toLocaleDateString(copy.dateLocale)}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
