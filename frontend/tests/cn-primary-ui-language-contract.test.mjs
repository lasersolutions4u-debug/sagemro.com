import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('CN primary customer UI avoids English-only modal and conversation copy', () => {
  const app = read('frontend/src/App.jsx');
  const chatHistory = read('frontend/src/components/Sidebar/ChatHistory.jsx');
  const conversations = read('frontend/src/hooks/useConversations.js');

  assert.match(app, /historyTitle/);
  assert.match(app, /会话历史/);
  assert.match(app, /currentTitle = currentConversation\?\.title \|\| \(isCn \? '服务对话' : 'Service Chat'\)/);

  assert.match(chatHistory, /isCnLocale/);
  assert.match(chatHistory, /会话历史/);
  assert.match(chatHistory, /搜索会话/);
  assert.match(chatHistory, /今天|昨天|最近 7 天|更早/);
  assert.doesNotMatch(chatHistory, /<div className="text-sm font-semibold[^>]*>Conversation History<\/div>/);

  assert.match(conversations, /isCnLocale/);
  assert.match(conversations, /新对话/);
});

test('CN notifications and payment modals expose Chinese customer-facing copy', () => {
  const notifications = read('frontend/src/components/Notification/NotificationModal.jsx');
  const payment = read('frontend/src/components/Payment/PaymentModal.jsx');

  assert.match(notifications, /isCnLocale/);
  assert.match(notifications, /通知/);
  assert.match(notifications, /全部标为已读/);
  assert.match(notifications, /暂无通知/);
  assert.doesNotMatch(notifications, /title="Notifications"/);

  assert.match(payment, /isCnLocale/);
  assert.match(payment, /确认付款方式/);
  assert.match(payment, /付款方式已收到/);
  assert.match(payment, /前往消息/);
  assert.match(payment, /电汇/);
});

test('CN service list localizes visible service request labels', () => {
  const myServices = read('frontend/src/components/Sidebar/MyWorkOrdersModal.jsx');

  assert.match(myServices, /isCnLocale/);
  assert.match(myServices, /我的服务/);
  assert.match(myServices, /服务状态/);
  assert.match(myServices, /提交时间/);
  assert.match(myServices, /取消/);
  assert.match(myServices, /评价/);
  assert.doesNotMatch(myServices, /title="My Services"/);
});

test('CN service detail workflow localizes customer-visible secondary UI', () => {
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const messagePanel = read('frontend/src/components/WorkOrder/MessagePanel.jsx');
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');
  const pricingPanels = read('frontend/src/components/WorkOrder/PricingPanels.jsx');

  assert.match(detailModal, /isCnLocale/);
  assert.match(detailModal, /工单详情/);
  assert.match(detailModal, /详情/);
  assert.match(detailModal, /消息/);
  assert.match(detailModal, /确认报价/);
  assert.match(detailModal, /服务报告/);
  assert.match(detailModal, /故障描述/);
  assert.match(detailModal, /AI 分析/);
  assert.match(detailModal, /取消服务请求/);
  assert.doesNotMatch(detailModal, /title="Work Order Details"/);

  assert.match(messagePanel, /isCnLocale/);
  assert.match(messagePanel, /暂无消息/);
  assert.match(messagePanel, /输入消息/);
  assert.match(messagePanel, /添加图片或视频/);

  assert.match(repairRecord, /暂无服务报告/);
  assert.match(repairRecord, /客户描述/);
  assert.match(repairRecord, /原因分析/);
  assert.match(repairRecord, /服务处理与后续建议/);
  assert.match(repairRecord, /保存服务报告/);

  assert.match(pricingPanels, /报价待沟通/);
  assert.match(pricingPanels, /确认报价/);
  assert.match(pricingPanels, /配件清单/);
  assert.doesNotMatch(pricingPanels, /闁板秳娆㈠〒鍛礋/);
});

test('CN account settings localizes customer profile and password UI', () => {
  const settings = read('frontend/src/components/Settings/SettingsModal.jsx');

  assert.match(settings, /isCnLocale/);
  assert.match(settings, /账号/);
  assert.match(settings, /个人资料/);
  assert.match(settings, /我的设备/);
  assert.match(settings, /修改密码/);
  assert.match(settings, /姓名/);
  assert.match(settings, /手机号/);
  assert.match(settings, /地区/);
  assert.match(settings, /保存修改/);
  assert.doesNotMatch(settings, /title="Account"/);
});

test('CN engineer workspace exposes localized operational labels', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /isCnLocale/);
  assert.match(workspace, /工程师工作台/);
  assert.match(workspace, /区域负责人工作台/);
  assert.match(workspace, /任务概览/);
  assert.match(workspace, /排期日历/);
  assert.match(workspace, /未来 30 天/);
  assert.match(workspace, /服务任务/);
  assert.match(workspace, /当前任务上下文/);
  assert.match(workspace, /服务准备/);
  assert.match(workspace, /服务标准检查清单/);
});

test('CN engineer profile modal localizes profile, rating, and payout labels', () => {
  const profile = read('frontend/src/components/Engineer/EngineerProfileModal.jsx');

  assert.match(profile, /isCnLocale/);
  assert.match(profile, /SAGEMRO 工程师资料/);
  assert.match(profile, /综合评分/);
  assert.match(profile, /设备专长/);
  assert.match(profile, /熟悉品牌/);
  assert.match(profile, /服务项目/);
  assert.match(profile, /工程师收款方式/);
  assert.match(profile, /保存收款方式/);
  assert.doesNotMatch(profile, /title="SAGEMRO Engineer Profile"/);
});

test('CN legacy engineer dashboard modal localizes dispatch labels', () => {
  const dashboard = read('frontend/src/components/Engineer/EngineerDashboard.jsx');

  assert.match(dashboard, /isCnLocale/);
  assert.match(dashboard, /SAGEMRO 工程师工作台/);
  assert.match(dashboard, /查看我的资料/);
  assert.match(dashboard, /可服务状态/);
  assert.match(dashboard, /已派工服务任务/);
  assert.match(dashboard, /确认派工/);
  assert.match(dashboard, /退回派工/);
  assert.doesNotMatch(dashboard, /title="SAGEMRO Internal Engineer Workspace"/);
});
