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
  const cnMethods = payment.match(/function cnPaymentMethods\(\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(notifications, /isCnLocale/);
  assert.match(notifications, /通知/);
  assert.match(notifications, /全部标为已读/);
  assert.match(notifications, /暂无通知/);
  assert.doesNotMatch(notifications, /title="Notifications"/);

  assert.match(payment, /isCnLocale/);
  assert.match(payment, /titlePay: '线下付款'/);
  assert.match(payment, /received: '已通知工程师'/);
  assert.match(payment, /goMessages: '前往消息并发送水单'/);
  assert.match(payment, /confirmBank: '付款成功通知工程师'/);
  assert.match(payment, /请通过上方对公账户完成线下付款/);
  assert.match(cnMethods, /bank_transfer/);
  assert.doesNotMatch(cnMethods, /paypal/i);
  assert.match(payment, /!isCn && result\?\.payment_method === 'paypal_card'/);
  assert.doesNotMatch(payment, /confirmBank: '申请 TT 电汇说明'/);
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
  assert.match(detailModal, /setBalancePaymentOpen\(false\); setTab\('messages'\)/);
  assert.doesNotMatch(detailModal, /title="Work Order Details"/);

  assert.match(messagePanel, /isCnLocale/);
  assert.match(messagePanel, /暂无消息/);
  assert.match(messagePanel, /输入消息/);
  assert.match(messagePanel, /添加图片或视频/);
  assert.match(messagePanel, /toLocaleTimeString\(isCn \? 'zh-CN' : 'en-US'/);
  assert.match(messagePanel, /hour12: !isCn/);

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
  const sidebar = read('frontend/src/components/Sidebar/Sidebar.jsx');
  const myDevices = read('frontend/src/components/Device/MyDevicesModal.jsx');

  assert.match(settings, /isCnLocale/);
  assert.match(settings, /账号/);
  assert.match(settings, /个人资料/);
  assert.match(settings, /我的设备/);
  assert.match(sidebar, /label: isCn \? '设备' : 'My Equipment'/);
  assert.match(myDevices, /title: '我的设备'/);
  assert.match(myDevices, /add: '添加设备'/);
  assert.match(myDevices, /手动添加设备/);
  assert.match(myDevices, /确认后才会保存/);
  assert.match(myDevices, /findMatchingDevice/);
  assert.match(myDevices, /setSelectedDevice\(existing\)/);
  assert.match(myDevices, /initialValues=\{deviceSuggestion\}/);
  assert.match(myDevices, /setError\(copy\.loadFailed\)/);
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
  assert.match(dashboard, /接受派工/);
  assert.match(dashboard, /退回派工/);
  assert.doesNotMatch(dashboard, /title="SAGEMRO Internal Engineer Workspace"/);
});

test('CN recruiting and shared overlays localize secondary labels', () => {
  const recruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');
  const feedback = read('frontend/src/components/common/FeedbackHost.jsx');
  const feedbackUtils = read('frontend/src/utils/feedback.js');

  assert.match(recruiting, /设备维保最佳方案：AI知识飞轮\+工程师技能实践/);
  assert.match(recruiting, /激光及金属成型设备维保工程师/);
  assert.match(recruiting, /咨询接待，任务整理/);
  assert.match(recruiting, /确认方案，解决问题/);
  assert.match(recruiting, /协调流程，沉淀记录/);
  assert.match(recruiting, /减少反复沟通，避免无效上门/);
  assert.match(recruiting, /一个越来越懂客户的AI，让技术服务更高效/);
  assert.match(recruiting, /知识技能持续进化，服务能力无限增长/);
  assert.match(recruiting, /不要忽略的重要提示：内容为AI生成，仅供参考/);
  assert.match(recruiting, /本页面文案均经人工审核确认/);
  assert.match(recruiting, /申请加入/);
  assert.match(recruiting, /finalLogin: '登录'/);
  assert.match(recruiting, /从单打独斗，到共享规模化能力/);
  assert.match(recruiting, /共享更有竞争力的供应链/);
  assert.match(recruiting, /共享品牌和市场获客能力/);
  assert.match(recruiting, /共享持续进阶的工程师培训/);
  assert.match(recruiting, /个人 \/ 团队服务能力/);
  assert.match(recruiting, /合作稳定后/);
  assert.match(recruiting, /removeTag\(tag\)/);
  assert.match(recruiting, /aria-label=\{copy\.closeForm\}/);
  assert.match(recruiting, /title=\{removeLabel\}/);
  assert.match(recruiting, /removeTag: '移除'/);
  assert.match(recruiting, /closeForm: '关闭申请表'/);
  assert.doesNotMatch(recruiting, /AI 接住流程|合作能带来什么|减少信息不足造成的非必要上门/);
  assert.doesNotMatch(recruiting, /aria-label="Close application form"/);
  assert.doesNotMatch(recruiting, /title="Remove"/);

  assert.match(feedback, /isCnLocale/);
  assert.match(feedback, /关闭/);
  assert.doesNotMatch(feedback, /aria-label="Close"/);

  assert.match(feedbackUtils, /isCnLocale/);
  assert.match(feedbackUtils, /isCn \? '确认' : 'Confirm'/);
  assert.match(feedbackUtils, /isCn \? '确定' : 'OK'/);
  assert.match(feedbackUtils, /isCn \? '取消' : 'Cancel'/);
});

test('CN legacy AI tools panel localizes visible service-agent copy', () => {
  const panel = read('frontend/src/components/AI/AIToolsPanel.jsx');

  assert.match(panel, /isCnLocale/);
  assert.match(panel, /AI 服务助手/);
  assert.match(panel, /结构化服务卡片/);
  assert.match(panel, /识别模块/);
  assert.match(panel, /用户应该怎样体验/);
  assert.match(panel, /开始助手对话/);
  assert.doesNotMatch(panel, />Detected module</);
  assert.doesNotMatch(panel, />How users should experience this:<\/strong>/);
  assert.doesNotMatch(panel, />Start agent chat/);
});

test('CN deep customer workflow modals avoid hard-coded English labels', () => {
  const messageBubble = read('frontend/src/components/Chat/MessageBubble.jsx');
  const rating = read('frontend/src/components/WorkOrder/RatingModal.jsx');
  const engineerReview = read('frontend/src/components/WorkOrder/EngineerReviewModal.jsx');

  assert.match(messageBubble, /isCnLocale/);
  assert.match(messageBubble, /复制/);
  assert.match(messageBubble, /图片预览/);
  assert.doesNotMatch(messageBubble, /title="Copy"/);
  assert.doesNotMatch(messageBubble, /alt="Preview"/);

  assert.match(rating, /isCnLocale/);
  assert.match(rating, /确认服务并评价/);
  assert.match(rating, /响应及时性/);
  assert.match(rating, /验收备注（可选）/);
  assert.match(rating, /title=\{copy\.title\}/);
  assert.match(rating, /placeholder=\{copy\.commentPlaceholder\}/);
  assert.doesNotMatch(rating, /title="Confirm Service & Review"/);

  assert.match(engineerReview, /isCnLocale/);
  assert.match(engineerReview, /评价客户配合/);
  assert.match(engineerReview, /现场条件/);
  assert.match(engineerReview, /提交评价/);
  assert.match(engineerReview, /title=\{copy\.title\}/);
  assert.match(engineerReview, /placeholder=\{copy\.commentPlaceholder\}/);
  assert.doesNotMatch(engineerReview, /title="Review Customer"/);
});
