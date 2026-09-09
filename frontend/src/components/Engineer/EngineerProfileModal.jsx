import { useState, useEffect, useCallback, useId } from 'react';
import { Modal } from '../common/Modal';
import { Star, MapPin, Phone, Briefcase, Wrench, Award, Bell, BellOff, CreditCard } from 'lucide-react';
import { getEngineerProfile, updateEngineerProfile } from '../../services/api';
import { usePushNotification } from '../../hooks/usePushNotification';
import { EngineerServiceProfileForm } from './EngineerServiceProfileForm';
import { isCnLocale } from '../../utils/locale';
import { categoryConfig, typeLabels } from '../../data/workOrderConfig';

function displayLabel(value) {
  return categoryConfig[value]?.label || typeLabels[value] || String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function displayRegions(value) {
  if (Array.isArray(value)) return value.join(' · ');
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(' · ');
  } catch { /* Legacy profiles may contain plain region text. */ }
  return value;
}

export function EngineerProfileModal({ isOpen, onClose, engineerId }) {
  const id = useId();
  const cn = isCnLocale();
  const [activeTab, setActiveTab] = useState('overview');
  const tabs = [
    { key: 'overview', label: cn ? '个人概况' : 'Overview' },
    { key: 'service', label: cn ? '服务能力与费用' : 'Capabilities & rates' },
    { key: 'payout', label: cn ? '收款设置' : 'Payout settings' },
  ];
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
    setActiveTab('overview');
    loadProfile();
  }, [isOpen, engineerId, loadProfile]);

  const handlePushToggle = async () => {
    if (pushEnabled) {
      await disablePush();
    } else {
      await enablePush();
    }
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
    <Modal isOpen={isOpen} onClose={onClose} title="SAGEMRO Engineer Profile" size="profile">
      <div className="space-y-5 sm:p-2">
        {loading && (
          <div className="text-center py-8 text-[var(--color-text-secondary)]">Loading...</div>
        )}

        {!loading && profile && (
          <>
            {/* 基本信息 */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
              <div className="w-14 h-14 shrink-0 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {profile.name?.charAt(0) || 'E'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-xl font-bold text-[var(--color-text-primary)]">
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
              <div className="flex basis-full items-center gap-2 text-sm text-[var(--color-text-secondary)] sm:basis-auto" aria-label="Overall Rating">
                <Star size={18} className="text-[var(--color-primary)]" />
                <strong className="text-lg text-[var(--color-text-primary)]">{avgRating.toFixed(1)}</strong>
                <span>({profile.rating_count || 0} reviews)</span>
              </div>
            </div>

            {/* 联系方式 */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--color-text-secondary)]">
              {profile.phone && <div className="flex min-w-0 items-center gap-2 break-words">
                <Phone size={16} className="shrink-0" />
                <span>{profile.phone}</span>
              </div>}
              {profile.service_region && (
                <div className="flex min-w-0 items-center gap-2">
                  <MapPin size={16} className="shrink-0" />
                  <span className="break-words">{displayRegions(profile.service_region)}</span>
                </div>
              )}
            </div>

            <div role="tablist" aria-label={cn ? '档案分区' : 'Profile sections'} className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--color-surface-elevated)] p-1">
              {tabs.map((tab, index) => <button
                key={tab.key}
                id={`${id}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`${id}-panel-${tab.key}`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={event => {
                  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault();
                  setActiveTab(tabs[next].key);
                  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
                }}
                className={`min-w-0 rounded-lg border px-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${activeTab === tab.key ? 'border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm' : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'}`}
              >{tab.label}</button>)}
            </div>

            <section role="tabpanel" id={`${id}-panel-overview`} aria-labelledby={`${id}-tab-overview`} hidden={activeTab !== 'overview'} tabIndex={0}>
            <div className="grid gap-6 md:grid-cols-2">
            {/* 评分 */}
            <div className="rounded-xl border border-[var(--color-border)] p-4 md:col-span-2">
              <h3 className="text-sm font-semibold">Service ratings</h3>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 mt-3 pt-3 border-t border-[var(--color-border)]">
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
                      {displayLabel(s)}
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
                      <span className="text-sm text-[var(--color-text-secondary)]">{displayLabel(type)}:</span>
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
                      {displayLabel(s)}
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

            </div>
            </section>

            <section role="tabpanel" id={`${id}-panel-service`} aria-labelledby={`${id}-tab-service`} hidden={activeTab !== 'service'} tabIndex={0}>
              {isOpen && engineerId && <EngineerServiceProfileForm key={engineerId} engineerId={engineerId} />}
            </section>

            <section role="tabpanel" id={`${id}-panel-payout`} aria-labelledby={`${id}-tab-payout`} hidden={activeTab !== 'payout'} tabIndex={0} className="space-y-6">
            <div className="p-4 sm:p-5 border border-[var(--color-border)] rounded-xl">
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
                  <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    PayPal account
                    <input
                      value={payoutForm.paypal_account}
                      onChange={(event) => updatePayoutField('paypal_account', event.target.value)}
                      placeholder="PayPal email account"
                      className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">
                      Bank country
                      <input value={payoutForm.bank_country} onChange={(event) => updatePayoutField('bank_country', event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </label>
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">
                      Account holder
                      <input value={payoutForm.account_holder} onChange={(event) => updatePayoutField('account_holder', event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </label>
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">
                      Bank name
                      <input value={payoutForm.bank_name} onChange={(event) => updatePayoutField('bank_name', event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </label>
                    <label className="text-sm font-medium text-[var(--color-text-primary)]">
                      Bank account
                      <input value={payoutForm.bank_account} onChange={(event) => updatePayoutField('bank_account', event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </label>
                    <label className="text-sm font-medium text-[var(--color-text-primary)] sm:col-span-2">
                      SWIFT code
                      <input value={payoutForm.bank_swift_code} onChange={(event) => updatePayoutField('bank_swift_code', event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </label>
                  </div>
                )}

                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  Notes for Admin
                  <textarea
                    value={payoutForm.payout_notes}
                    onChange={(event) => updatePayoutField('payout_notes', event.target.value)}
                    rows={2}
                    className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    SAGEMRO currently supports PayPal account and Bank transfer / SWIFT for engineer service payments.
                  </p>
                  <button
                    type="button"
                    onClick={handleSavePayout}
                    disabled={payoutSaving}
                    className="shrink-0 whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {payoutSaving ? 'Saving...' : 'Save payout method'}
                  </button>
                </div>
                {payoutMessage && <div role="status" className="text-sm text-[var(--color-text-secondary)]">{payoutMessage}</div>}
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

            </section>

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
