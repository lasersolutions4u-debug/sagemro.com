import { useState, useEffect, useCallback, useRef } from 'react';
import { savePushSubscription } from '../services/api';

// OneSignal App ID - 从环境变量读取
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

export function usePushNotification(engineerId, isEngineer) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [isReady, setIsReady] = useState(false);
  const [inAppNotification, setInAppNotification] = useState(null); // { title, body, data }
  const initAttempted = useRef(false);

  // 等待 OneSignal SDK 加载完成
  const waitForOneSignal = useCallback(() => {
    return new Promise((resolve) => {
      if (window.OneSignal && window.OneSignal.push) {
        resolve();
        return;
      }
      // 最多等待 3 秒
      let waited = 0;
      const interval = setInterval(() => {
        waited += 100;
        if (window.OneSignal && window.OneSignal.push) {
          clearInterval(interval);
          resolve();
        } else if (waited >= 3000) {
          clearInterval(interval);
          resolve(); // 继续，不阻塞
        }
      }, 100);
    });
  }, []);

  // 初始化 OneSignal
  const initOneSignal = useCallback(async () => {
    console.log('[Push] initOneSignal called, isEngineer:', isEngineer, 'engineerId:', engineerId, 'appId configured:', !!ONESIGNAL_APP_ID);

    if (!isEngineer || !engineerId || !ONESIGNAL_APP_ID) {
      console.log('[Push] Skipping init - missing params');
      return;
    }

    if (initAttempted.current) {
      console.log('[Push] Already attempted, skipping');
      return;
    }
    initAttempted.current = true;

    await waitForOneSignal();

    if (!window.OneSignal) {
      console.log('[Push] OneSignal SDK not loaded');
      return;
    }

    try {
      console.log('[Push] Initializing OneSignal...');
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
      console.log('[Push] OneSignal initialized');

      setIsReady(true);

      // 检查当前状态
      const permission = await window.OneSignal.getNotificationPermission();
      const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
      console.log('[Push] permission:', permission, 'isSubscribed:', isSubscribed);

      setPushPermission(permission);
      setPushEnabled(isSubscribed);

      // 如果已经订阅但后端没有记录，同步到后端
      if (isSubscribed && permission === 'granted' && engineerId) {
        const playerId = await window.OneSignal.getUserId();
        console.log('[Push] Already subscribed, playerId:', playerId);
        if (playerId) {
          try {
            await savePushSubscription(engineerId, {
              onesignal_player_id: playerId,
            });
            console.log('[Push] Synced existing subscription to backend');
            // 同步成功后也要更新 UI
            setPushEnabled(true);
          } catch (e) {
            console.log('[Push] Sync error (may already exist):', e);
          }
        }
      }

      // 监听推送通知到达（应用打开时，不会弹系统通知，需要 in-app 展示）
      window.OneSignal.push(function() {
        window.OneSignal.on('notification.display', function (event) {
          console.log('[Push] Notification displayed:', event);
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
          console.log('[Push] Notification clicked:', event);
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
    console.log('[Push] enablePush called, isReady:', isReady);

    if (!isReady) {
      console.log('[Push] OneSignal not ready, initializing...');
      await initOneSignal();
    }

    if (!window.OneSignal) {
      console.error('[Push] OneSignal not available');
      return;
    }

    try {
      const permission = await window.OneSignal.getNotificationPermission();
      console.log('[Push] permission:', permission);

      if (permission === 'denied') {
        alert('推送通知已被浏览器拒绝，请在浏览器设置中允许通知');
        return;
      }

      if (permission !== 'granted') {
        // 需要用户授权，弹出原生提示
        console.log('[Push] Showing native prompt...');
        await window.OneSignal.showNativePrompt();
      }

      // 注册推送
      console.log('[Push] Registering for push...');
      await window.OneSignal.push(function() {
        return window.OneSignal.registerForPushNotifications();
      });

      // 获取 Player ID
      const playerId = await window.OneSignal.getUserId();
      console.log('[Push] Player ID:', playerId);

      if (playerId && engineerId) {
        console.log('[Push] Saving to backend...');
        await savePushSubscription(engineerId, {
          onesignal_player_id: playerId,
        });
        console.log('[Push] Saved to backend');
      } else {
        console.log('[Push] No playerId or engineerId');
      }

      // 强制刷新状态
      const isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
      console.log('[Push] isSubscribed after registration:', isSubscribed);
      setPushEnabled(isSubscribed);
      setPushPermission('granted');
    } catch (err) {
      console.error('[Push] Enable push error:', err);
    }
  }, [isReady, initOneSignal, engineerId]);

  // 禁用推送
  const disablePush = useCallback(async () => {
    if (!window.OneSignal) return;

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
