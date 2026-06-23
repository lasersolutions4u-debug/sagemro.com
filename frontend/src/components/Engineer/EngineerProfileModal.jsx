import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { Star, MapPin, Phone, Briefcase, Wrench, Award, Bell, BellOff } from 'lucide-react';
import { getEngineerProfile } from '../../services/api';
import { usePushNotification } from '../../hooks/usePushNotification';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  cn: {
    title: 'SAGEMRO 工程师资料',
    loading: '加载中...',
    status: {
      available: '可服务',
      paused: '暂停接单',
      offline: '离线',
    },
    overallRating: '综合评分',
    reviews: '条评价',
    timeliness: '时效性',
    technical: '技术能力',
    communication: '沟通',
    professional: '专业性',
    specialties: '擅长设备',
    brands: '熟悉品牌',
    services: '维护与维修服务',
    bio: '个人简介',
    pushTitle: '推送通知',
    pushEnabled: '已开启：接收服务派单和内部更新通知',
    pushDenied: '已被浏览器阻止',
    pushDisabled: '未开启',
    disable: '关闭',
    enable: '开启',
    memberSince: '加入时间',
  },
  en: {
    title: 'SAGEMRO Engineer Profile',
    loading: 'Loading...',
    status: {
      available: 'Available',
      paused: 'Paused',
      offline: 'Offline',
    },
    overallRating: 'Overall Rating',
    reviews: 'reviews',
    timeliness: 'Timeliness',
    technical: 'Technical Skill',
    communication: 'Communication',
    professional: 'Professionalism',
    specialties: 'Equipment Specialties',
    brands: 'Familiar Brands',
    services: 'Maintenance & Repair Services',
    bio: 'Bio',
    pushTitle: 'Push Notifications',
    pushEnabled: 'Enabled - notifications for service assignments and internal updates',
    pushDenied: 'Blocked by browser',
    pushDisabled: 'Disabled',
    disable: 'Disable',
    enable: 'Enable',
    memberSince: 'Member since',
  },
};

export function EngineerProfileModal({ isOpen, onClose, engineerId }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { pushEnabled, pushPermission, enablePush, disablePush, isConfigured } =
    usePushNotification(engineerId, !!engineerId);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEngineerProfile(engineerId);
      setProfile(data.engineer);
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
                  <span className="text-[var(--color-text-secondary)]">{copy.professional}</span>
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
                          ? copy.pushDenied
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
              {copy.memberSince}: {new Date(profile.created_at).toLocaleDateString(isCn ? 'zh-CN' : 'en-US')}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
