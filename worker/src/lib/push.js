// OneSignal 推送 + 站内通知 helpers
//
// 公共约定：
// - 所有函数 fire-and-forget 语义，失败只打 log，不抛错
// - createNotification 写 notifications 表 + 尽力调 sendPushToUser
// - sendPushToUser 按 user_type 查对应表的 onesignal_player_id

import { generateId } from './util.js';

const ONESIGNAL_API = 'https://onesignal.com/api/v1/notifications';

// 写一条站内通知，并尝试推送（两者相互独立）
export async function createNotification(env, { user_id, user_type, type, title, body, data }) {
  try {
    const id = generateId();
    await env.DB.prepare(
      'INSERT INTO notifications (id, user_id, user_type, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, user_id, user_type, type, title, body, data ? JSON.stringify(data) : null).run();
  } catch (e) {
    console.error('[Notification] Failed to create:', e.message);
  }

  try {
    await sendPushToUser(user_id, user_type, env, {
      title,
      message: body,
      data: { ...(data || {}), notification_type: type },
    });
  } catch (e) {
    console.warn('[Notification] Push dispatch failed:', e.message);
  }
}

// 通用推送：按 userType 决定查 engineers 还是 customers 表
export async function sendPushToUser(userId, userType, env, { title, titleZh, message, messageZh, data }) {
  try {
    const table = userType === 'engineer' ? 'engineers'
                : userType === 'customer' ? 'customers'
                : null;
    if (!table) return false;

    const row = await env.DB.prepare(
      `SELECT onesignal_player_id FROM ${table} WHERE id = ?`
    ).bind(userId).first();

    if (!row?.onesignal_player_id) return false;

    const appId = env.ONESIGNAL_APP_ID;
    const apiKey = env.ONESIGNAL_REST_API_KEY;
    if (!appId || !apiKey) {
      console.warn('[sendPushToUser] OneSignal credentials not configured');
      return false;
    }

    const response = await fetch(ONESIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: [row.onesignal_player_id],
        headings: { en: title, zh: titleZh || title },
        contents: { en: message, zh: messageZh || message },
        data: data || {},
        android_group: 'sagemro',
      }),
    });

    if (!response.ok) {
      console.error('[sendPushToUser] OneSignal API error:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[sendPushToUser] error:', error);
    return false;
  }
}

// 向后兼容：保留原 sendPushToEngineer 语义（内部委托到 sendPushToUser）
export async function sendPushToEngineer(engineerId, env, payload) {
  return sendPushToUser(engineerId, 'engineer', env, payload);
}
