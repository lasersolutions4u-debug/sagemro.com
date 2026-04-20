import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Star, MapPin, Phone, Briefcase, Wrench, Award, Bell, BellOff } from 'lucide-react';
import { getEngineerProfile } from '../../services/api';
import { usePushNotification } from '../../hooks/usePushNotification';

export function EngineerProfileModal({ isOpen, onClose, engineerId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { pushEnabled, pushPermission, enablePush, disablePush, isReady, isConfigured } =
    usePushNotification(engineerId, !!engineerId);

  useEffect(() => {
    if (!isOpen || !engineerId) return;
    loadProfile();
  }, [isOpen, engineerId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getEngineerProfile(engineerId);
      setProfile(data.engineer);
    } catch (e) {
      console.error('加载合伙人档案失败:', e);
    } finally {
      setLoading(false);
    }
  };

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
    <Modal isOpen={isOpen} onClose={onClose} title="合伙人档案" size="md">
      <div className="space-y-5">
        {loading && (
          <div className="text-center py-8 text-[#6b6375]">加载中...</div>
        )}

        {!loading && profile && (
          <>
            {/* 基本信息 */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#f59e0b] flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {profile.name?.charAt(0) || '工'}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#08060d] dark:text-[#f3f4f6]">
                  {profile.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {profile.status === 'available' && (
                    <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded">可接单</span>
                  )}
                  {profile.status === 'paused' && (
                    <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded">暂停接单</span>
                  )}
                  {profile.status === 'offline' && (
                    <span className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded">离线</span>
                  )}
                </div>
              </div>
            </div>

            {/* 联系方式 */}
            <div className="flex gap-4 text-sm text-[#6b6375]">
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
            <div className="p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6b6375]">综合评分</span>
                <span className="text-xl font-bold text-[#f59e0b]">{avgRating.toFixed(1)}</span>
              </div>
              <div className="text-[#f59e0b] text-lg mb-3">
                {renderStars(avgRating)}
              </div>
              <div className="text-xs text-[#6b6375]">
                {profile.rating_count || 0} 次评价
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#e5e4e7] dark:border-[#3a3a4c]">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6375]">时效性</span>
                  <span className="text-[#f59e0b]">{profile.rating_timeliness?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6375]">技术熟练</span>
                  <span className="text-[#f59e0b]">{profile.rating_technical?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6375]">沟通流畅</span>
                  <span className="text-[#f59e0b]">{profile.rating_communication?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6375]">专业性</span>
                  <span className="text-[#f59e0b]">{profile.rating_professional?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
            </div>

            {/* 擅长的设备类型 */}
            {profile.specialties && profile.specialties.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase size={16} className="text-[#f59e0b]" />
                  <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6]">
                    擅长的设备类型
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.specialties.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg text-sm"
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
                  <Award size={16} className="text-[#f59e0b]" />
                  <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6]">
                    熟悉的品牌
                  </h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(profile.brands).map(([type, brands]) => (
                    <div key={type} className="flex items-start gap-2">
                      <span className="text-xs text-[#6b6375] min-w-[80px]">{type}：</span>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(brands) ? brands : []).map((b, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#2a2a3c] text-[#f59e0b] rounded text-xs"
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
                  <Wrench size={16} className="text-[#f59e0b]" />
                  <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6]">
                    维修保养项目
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.services.map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-[#2a2a3c] text-[#e0e0e0] rounded-lg text-sm"
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
                <h3 className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6] mb-2">
                  个人简介
                </h3>
                <div className="p-3 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl text-sm text-[#6b6375]">
                  {profile.bio}
                </div>
              </div>
            )}

            {/* 推送通知设置 */}
            {isConfigured && (
              <div className="p-4 bg-[#f4f3f4] dark:bg-[#2a2a3c] rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pushEnabled ? (
                      <Bell size={20} className="text-[#f59e0b]" />
                    ) : (
                      <BellOff size={20} className="text-[#6b6375]" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-[#08060d] dark:text-[#f3f4f6]">
                        推送通知
                      </div>
                      <div className="text-xs text-[#6b6375]">
                        {pushEnabled
                          ? '已开启，新工单和钱包变动时会推送'
                          : pushPermission === 'denied'
                          ? '已被浏览器拒绝'
                          : '未开启'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePushToggle}
                    disabled={pushPermission === 'denied'}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pushEnabled
                        ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                        : 'bg-[#f59e0b] hover:bg-[#d97706] text-white'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    {pushEnabled ? '关闭' : '开启'}
                  </button>
                </div>
              </div>
            )}

            {/* 注册时间 */}
            <div className="text-xs text-[#6b6375] text-center pt-2">
              加入时间：{new Date(profile.created_at).toLocaleDateString('zh-CN')}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
