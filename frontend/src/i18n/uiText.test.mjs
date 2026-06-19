import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getUiText } from './uiText.js';

test('uses Simplified Chinese UI copy for China market', () => {
  const t = getUiText('zh-CN');

  assert.equal(t.sidebar.newChat, '新的服务对话');
  assert.equal(t.welcome.headline, '工业设备服务，从一个清晰工单开始。');
  assert.equal(t.chat.inputPlaceholder, '描述故障、备件、保养需求或新机项目，可随时上传图片。');
  assert.equal(t.auth.title, '登录 / 注册');
  assert.equal(t.workOrder.title, '提交 SAGEMRO 官方服务申请');
  assert.equal(t.customerHome.title, '公司资料');
  assert.equal(t.aiTools.title, '六类服务能力，一个自然语言入口');
});

test('keeps English UI copy for international market', () => {
  const t = getUiText('en');

  assert.equal(t.sidebar.newChat, 'New Service Chat');
  assert.equal(t.welcome.headline, 'Industrial equipment service should start with a clear case.');
  assert.equal(t.chat.inputPlaceholder, 'Describe the fault, part, maintenance need, or new-machine project. Upload images anytime.');
  assert.equal(t.auth.title, 'Sign In / Register');
});

test('falls back to English for unknown locale', () => {
  const t = getUiText('fr-FR');

  assert.equal(t.sidebar.newChat, 'New Service Chat');
});
