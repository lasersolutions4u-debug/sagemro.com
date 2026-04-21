import { useState, useEffect, useCallback, useRef } from 'react';
import { savePushSubscription } from '../services/api';
import { toastError } from '../utils/feedback';

// OneSignal App ID - 从环境变量读取
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

// 调试日志：仅在开发环境启用，避免污染生产控制台
const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

// 兼容旧签名：usePushNotification(engineerId, isEngineer)
// 也可以显式传 userId，按当前登录身份自动订阅（客户/工程师都支持）
export function usePushNotification(userId, shouldSubscribe) {
  const engineerId = userId; // 兼容旧命名
  const isEngineer = shouldSubscribe; // 兼容旧命名
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [isReady, setIsReady] = useState(false);
  const [inAppNotification, setInAppNotification] = useState(null); // { title, body, data }
  const initAttempted = useRef(false);

  // 等待 OneSignal SDK 真正加载完成（init 函数可用）
  // 注意：window.OneSignal 初始为 []（数组），数组也有 .push，不能用 .push 判断
  // SDK 加载后 window.OneSignal 被替换为对象，此时 init 才是 function
  const waitForOneSignal = useCallback(() => {
    return new Promise((resolve, reject) => {
      const isReady = () =>
        window.OneSignal &&
        !Array.isArray(window.OneSignal) &&
        typeof window.OneSignal.init === 'function';

      if (isReady()) {
        resolve();
        return;
      }

      // 最多等待 8 秒（SDK 异步加载 + 网络慢时需要更长时间）
      let waited = 0;
      const interval = setInterval(() => {
        waited += 100;
        if (isReady()) {
          clearInterval(interval);
          resolve();
        } else if (waited >= 8000) {
          clearInterval(interval);
          reject(new Error('OneSignal SDK 加载超时'));
        }
      }, 100);
    });
  }, []);

  // 初始化 OneSignal
  const initOneSignal = useCallback(async () => {
    debugLog('[Push] initOneSignal called, isEngineer:', isEngineer, 'engineerId:', engineerId, 'appId configured:', !!ONESIGNAL_APP_ID);

    if (!isEngineer || !engineerId || !ONESIGNAL_APP_ID) {
      debugLog('[Push] Skipping init - missing params');
      return;
    }

    if (initAttempted.current) {
      debugLog('[Push] Already attempted, skipping');
      return;
    }
    initAttempted.current = true;

    try {
      await waitForOneSignal();
    } catch (err) {
      console.warn('[Push]', err.message);
      initAttempted.current = false; // 允许后续重试
      return;
    }

    // 二次校验：等待完成后再确认 init 是 function（极端时序防护）
    if (typeof window.OneSignal?.init !== 'function') {
      debugLog('[Push] OneSignal.init still not available, skipping');
      initAttempted.current = false;
      return;
    }

    try {
      debugLog('[Push] Initializing OneSignal...');
      await window.OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        safari_web_id: null,
        notifyButton: {
          enable: false,
        },
        autoResubscribe: false,
        serviceWorkerParam: {
          scope: '/',
        },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });
      debugLog('[Push] OneSignal initialized');

      setIsReady(true);

      // 检查当前状态
      const permission = await window.OneSignal.getNotificationPermission();
      const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
      debugLog('[Push] permission:', permission, 'isSubscribed:', isSubscribed);

      setPushPermission(permission);
      setPushEnabled(isSubscribed);

      // 如果已经订阅但后端没有记录，同步到后端
      if (isSubscribed && permission === 'granted' && engineerId) {
        const playerId = await window.OneSignal.getUserId();
        debugLog('[Push] Already subscribed, playerId:', playerId);
        if (playerId) {
          try {
            await savePushSubscription(engineerId, {
              onesignal_player_id: playerId,
            });
            debugLog('[Push] Synced existing subscription to backend');
            // 同步成功后也要更新 UI
            setPushEnabled(true);
          } catch (e) {
            debugLog('[Push] Sync error (may already exist):', e);
          }
        }
      }

      // 监听推送通知到达（应用打开时，不会弹系统通知，需要 in-app 展示）
      window.OneSignal.push(function() {
        window.OneSignal.on('notification.display', function (event) {
          debugLog('[Push] Notification displayed:', event);
          // 如果页面在后台，浏览器不会弹通知，由 OneSignal SDK 处理
          // 如果页面在前台，手动展示 in-app 通知
          if (document.hidden) return;
          const data = event.notification?.data;
          if (data?.work_order_id) {
            setInAppNotification({
              title: event.notification?.heading || '📋 新工单通知',
              body: event.notification?.body || '您有新的工单等待接单',
              data
            });
            // 5秒后自动消失
            setTimeout(() => setInAppNotification(null), 5000);
          }
        });

        // 监听通知点击
        window.OneSignal.on('notification.clicked', function (event) {
          debugLog('[Push] Notification clicked:', event);
          const data = event.notification?.data;
          if (data?.work_order_id) {
            // 触发跳转到工单详情
            window.dispatchEvent(new CustomEvent('navigate-to-work-order', {
              detail: { workOrderId: data.work_order_id }
            }));
          }
        });
      });
    } catch (err) {
      console.error('[Push] OneSignal init error:', err);
    }
  }, [engineerId, isEngineer, waitForOneSignal]);

  // 启用推送
  const enablePush = useCallback(async () => {
    debugLog('[Push] enablePush called, isReady:', isReady);

    if (!isReady) {
      debugLog('[Push] OneSignal not ready, initializing...');
      await initOneSignal();
    }

    if (
      !window.OneSignal ||
      Array.isArray(window.OneSignal) ||
      typeof window.OneSignal.getNotificationPermission !== 'function'
    ) {
      console.error('[Push] OneSignal SDK not available');
      toastError('推送服务暂不可用，请刷新页面后重试');
      return;
    }

    try {
      const permission = await window.OneSignal.getNotificationPermission();
      debugLog('[Push] permission:', permission);

      if (permission === 'denied') {
        toastError('推送通知已被浏览器拒绝，请在浏览器设置中允许通知');
        return;
      }

      if (permission !== 'granted') {
        // 需要用户授权，弹出原生提示
        debugLog('[Push] Showing native prompt...');
        await window.OneSignal.showNativePrompt();
      }

      // 注册推送
      debugLog('[Push] Registering for push...');
      await window.OneSignal.push(function() {
        return window.OneSignal.registerForPushNotifications();
      });

      // 获取 Player ID
      const playerId = await window.OneSignal.getUserId();
      debugLog('[Push] Player ID:', playerId);

      if (playerId && engineerId) {
        debugLog('[Push] Saving to backend...');
        await savePushSubscription(engineerId, {
          onesignal_player_id: playerId,
        });
        debugLog('[Push] Saved to backend');
      } else {
        debugLog('[Push] No playerId or engineerId');
      }

      // 强制刷新状态
      const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
      debugLog('[Push] isSubscribed after registration:', isSubscribed);
      setPushEnabled(isSubscribed);
      setPushPermission('granted');
    } catch (err) {
      console.error('[Push] Enable push error:', err);
    }
  }, [isReady, initOneSignal, engineerId]);

  // 禁用推送
  const disablePush = useCallback(async () => {
    if (
      !window.OneSignal ||
      Array.isArray(window.OneSignal) ||
      typeof window.OneSignal.setSubscription !== 'function'
    ) {
      return;
    }

    try {
      // 使用 setSubscription 而不是 setPushNotificationsEnabled
      await window.OneSignal.setSubscription(false);
      setPushEnabled(false);
    } catch (err) {
      console.error('Disable push error:', err);
    }
  }, []);

  // 初始化（仅一次）
  useEffect(() => {
    if (isEngineer && engineerId) {
      initOneSignal();
    }
  }, [isEngineer, engineerId, initOneSignal]);

  return {
    pushEnabled,
    pushPermission,
    enablePush,
    disablePush,
    isReady,
    isConfigured: !!ONESIGNAL_APP_ID,
    inAppNotification,
    dismissNotification: () => setInAppNotification(null),
  };
}
