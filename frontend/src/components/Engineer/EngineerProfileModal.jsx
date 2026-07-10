import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Star, MapPin, Phone, Briefcase, Wrench, Award, Bell, BellOff, CreditCard } from 'lucide-react';
import { getEngineerProfile, updateEngineerProfile } from '../../services/api';
import { usePushNotification } from '../../hooks/usePushNotification';

export function EngineerProfileModal({ isOpen, onClose, engineerId }) {
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
      setPayoutMessage('Payout method saved.');
    } catch (e) {
      setPayoutMessage(e.message || 'Failed to save payout method.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="SAGEMRO Engineer Profile" size="md">
      <div className="space-y-5">
        {loading && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">Loading...</div>
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
                    <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded">Available</span>
                  )}
                  {profile.status === 'paused' && (
                    <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded">Paused</span>
                  )}
                  {profile.status === 'offline' && (
                    <span className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded">Offline</span>
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
                <span className="text-sm text-[var(--color-text-secondary)]">Overall Rating</span>
                <span className="text-xl font-bold text-[var(--color-primary)]">{avgRating.toFixed(1)}</span>
              </div>
              <div className="text-[var(--color-primary)] text-lg mb-3">
                {renderStars(avgRating)}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {profile.rating_count || 0} reviews
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Timeliness</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_timeliness?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Technical Skill</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_technical?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Communication</span>
                  <span className="text-[var(--color-primary)]">{profile.rating_communication?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Professionalism</span>
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
                    Equipment Specialties
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
                    Familiar Brands
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
                    Maintenance & Repair Services
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
                  Bio
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
                  Engineer payout method
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
                    PayPal account
                  </label>
                  <label className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="payout_method"
                      checked={payoutForm.payout_method === 'bank_swift'}
                      onChange={() => updatePayoutField('payout_method', 'bank_swift')}
                      className="mr-2"
                    />
                    Bank transfer / SWIFT
                  </label>
                </div>

                {payoutForm.payout_method === 'paypal' ? (
                  <label className="text-xs text-[var(--color-text-secondary)]">
                    PayPal account
                    <input
                      value={payoutForm.paypal_account}
                      onChange={(event) => updatePayoutField('paypal_account', event.target.value)}
                      placeholder="PayPal email account"
                      className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                    />
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      Bank country
                      <input value={payoutForm.bank_country} onChange={(event) => updatePayoutField('bank_country', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      Account holder
                      <input value={payoutForm.account_holder} onChange={(event) => updatePayoutField('account_holder', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      Bank name
                      <input value={payoutForm.bank_name} onChange={(event) => updatePayoutField('bank_name', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)]">
                      Bank account
                      <input value={payoutForm.bank_account} onChange={(event) => updatePayoutField('bank_account', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                    <label className="text-xs text-[var(--color-text-secondary)] sm:col-span-2">
                      SWIFT code
                      <input value={payoutForm.bank_swift_code} onChange={(event) => updatePayoutField('bank_swift_code', event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" />
                    </label>
                  </div>
                )}

                <label className="text-xs text-[var(--color-text-secondary)]">
                  Notes for Admin
                  <textarea
                    value={payoutForm.payout_notes}
                    onChange={(event) => updatePayoutField('payout_notes', event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    SAGEMRO currently supports PayPal account and Bank transfer / SWIFT for engineer service payments.
                  </p>
                  <button
                    type="button"
                    onClick={handleSavePayout}
                    disabled={payoutSaving}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {payoutSaving ? 'Saving...' : 'Save payout method'}
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
                        Push Notifications
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {pushEnabled
                          ? 'Enabled - notifications for service assignments and internal updates'
                          : pushPermission === 'denied'
                          ? 'Blocked by browser'
                          : 'Disabled'}
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
                    {pushEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            )}

            {/* 注册时间 */}
            <div className="text-xs text-[var(--color-text-secondary)] text-center pt-2">
              Member since: {new Date(profile.created_at).toLocaleDateString('en-US')}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
