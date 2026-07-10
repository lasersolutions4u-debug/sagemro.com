import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function extractPlaceholderExpression(source) {
  const match = source.match(/const placeholder = ([\s\S]*?);\n\n  return \(/);
  assert.ok(match, 'expected InputArea placeholder expression to be discoverable');
  return match[1];
}

test('customer, engineer, admin, and browser icons use the exact supplied SAGEMRO logo image', () => {
  const expectedAssets = [
    'frontend/public/sagemro-logo.png',
    'admin/public/sagemro-logo.png',
  ];

  for (const assetPath of expectedAssets) {
    assert.equal(existsSync(path.join(root, assetPath)), true, `${assetPath} should exist`);
  }

  assert.match(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-logo\.png/);
  assert.doesNotMatch(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-brand-mark\.svg/);
  assert.match(read('admin/src/components/BrandMark.jsx'), /sagemro-logo\.png/);
  assert.doesNotMatch(read('admin/src/components/BrandMark.jsx'), /sagemro-brand-mark\.svg/);

  assert.match(read('frontend/index.html'), /href="\/sagemro-logo\.png"/);
  assert.match(read('admin/index.html'), /href="\/sagemro-logo\.png"/);
});

test('main chat input is text-only and uses short mobile placeholder copy', () => {
  const inputArea = read('frontend/src/components/Chat/InputArea.jsx');
  const placeholderExpression = extractPlaceholderExpression(inputArea);

  assert.doesNotMatch(inputArea, /uploadChatImage|ImagePlus|type="file"|accept="image/);
  assert.doesNotMatch(placeholderExpression, /upload image|Add device|field context|material, thickness/i);
  assert.match(placeholderExpression, /Describe your service issue/);
});

test('main chat input supports Deepgram voice transcription without image upload', () => {
  const inputArea = read('frontend/src/components/Chat/InputArea.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(inputArea, /Mic/);
  assert.match(inputArea, /MediaRecorder/);
  assert.match(inputArea, /VOICE_RECORDING_LIMIT_MS = 30 \* 1000/);
  assert.doesNotMatch(inputArea, /voiceLanguage|<select|aria-label="Voice language"|Auto language/);
  assert.match(inputArea, /transcribeVoiceInput\(audioBlob\)/);
  assert.match(inputArea, /setInput\(\(current\) => current \? `\$\{current\} \$\{transcript\}` : transcript\)/);
  assert.match(inputArea, /Voice input unavailable/);
  assert.match(api, /transcribeVoiceInput\(audioBlob\)/);
  assert.doesNotMatch(api, /formData\.append\('language'/);
  assert.match(api, /\/api\/chat\/transcribe/);
  assert.doesNotMatch(inputArea, /type="file"|accept="image/);
});

test('main site first-impression copy keeps CN and COM market language separate', () => {
  const welcome = read('frontend/src/components/Chat/WelcomePage.jsx');
  const about = read('frontend/src/components/common/AboutModal.jsx');
  const footer = read('frontend/src/components/common/Footer.jsx');
  const engineerRecruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.match(welcome, /Keep laser and sheet-metal equipment running with AI-assisted service intake/);
  assert.match(welcome, /spare parts, consumables, laser peripherals, retrofit needs, automation accessories, and press brake tooling/);
  assert.match(welcome, /Retrofit review/);
  assert.doesNotMatch(welcome, /Machine selection|new-machine evaluation/);
  assert.match(welcome, /让专业 AI 协助，设备问题解决得更高效。/);
  assert.match(about, /An AI-assisted independent service platform/);
  assert.match(about, /spare parts, consumables, maintenance, retrofit, automation accessories, laser peripherals, or press brake tooling/);
  assert.doesNotMatch(about, /Machine selection|new-machine projects/);
  assert.match(about, /面向激光切割与钣金加工设备的第三方智能服务平台。/);
  assert.doesNotMatch(about, /field photos|现场照片/);
  assert.match(footer, /SAGEMRO operated by Jinan Euchio Machinery Co\., Ltd\./);
  assert.match(footer, /SAGEMRO 由济南钰峭机械有限公司运营/);
  assert.match(footer, /鲁ICP备2026032904号-1/);
  assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\//);
  assert.match(engineerRecruiting, /SAGEMRO 智能服务系统 · 认证服务代表计划/);
  assert.doesNotMatch(engineerRecruiting, /badge: 'SAGEMRO Service OS · 认证服务代表计划'/);
});

test('COM inquiry path asks for service-ready international request details', () => {
  const leadForm = read('frontend/src/components/Chat/LeadForm.jsx');
  const workOrderModal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

  assert.match(leadForm, /machine brand\/model, part number, country, urgency, and photos available/);
  assert.match(leadForm, /Country \/ region, equipment model, part number, urgency, and preferred contact channel/);
  assert.doesNotMatch(leadForm, /Briefly describe your equipment needs/);

  assert.match(workOrderModal, /Request Details/);
  assert.match(workOrderModal, /Country \/ Region/);
  assert.match(workOrderModal, /Equipment Model \/ Part No\./);
  assert.match(workOrderModal, /alarm code, part number, photos\/nameplate availability, country, and production impact/);
  assert.match(workOrderModal, /Email, WhatsApp, or phone/);
  assert.match(workOrderModal, /Spare Parts \/ Consumables/);
  assert.match(workOrderModal, /Retrofit \/ Peripheral Equipment/);
  assert.doesNotMatch(workOrderModal, /Parts Purchase/);
});

test('registration copy hides CN email input and routes verification through phone SMS', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');
  const api = read('frontend/src/services/api.js');
  const toolbar = read('frontend/src/components/Sidebar/ToolBar.jsx');

  assert.match(loginModal, /emailRequired: '请输入邮箱'/);
  assert.doesNotMatch(loginModal, /emailAddress: '邮箱/);
  assert.doesNotMatch(loginModal, /emailPlaceholder: '请输入邮箱地址'/);
  assert.match(loginModal, /smsVerificationCode: '短信验证码'/);
  assert.match(loginModal, /emailVerificationCode: 'Email verification code'/);
  assert.match(loginModal, /\{!isCn && \(\s*<div>\s*<label className="block text-sm font-medium mb-1">\{copy\.emailAddress\}<\/label>/);
  assert.match(loginModal, /sendVerifyCode\(\{ phone \}\)/);
  assert.match(loginModal, /sendVerifyCode\(\{ email \}\)/);
  assert.match(loginModal, /fullName: '姓名 \*'/);
  assert.match(loginModal, /fullNamePlaceholder: '请输入姓名'/);
  assert.doesNotMatch(loginModal, /真实姓名/);
  assert.match(api, /sendVerifyCode\(\{ phone, email \}\)/);
  assert.match(api, /JSON\.stringify\(payload\)/);
  assert.match(api, /registerCustomer\(\{ name, phone, email, password, code, company, identity \}\)/);
  assert.match(toolbar, /loginLabel: '登录 \/ 注册'/);
  assert.match(toolbar, /loginLabel: 'Sign In \/ Register'/);
  assert.doesNotMatch(toolbar, /<span>Sign In \/ Register<\/span>/);
});

test('international login accepts email or long international phone numbers', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(loginModal, /accountLabel: 'Email or phone'/);
  assert.match(loginModal, /accountPlaceholder: 'Email or phone number'/);
  assert.match(loginModal, /const \[loginAccount, setLoginAccount\] = useState\(''\)/);
  assert.match(loginModal, /maxLength=\{24\}/);
  assert.doesNotMatch(loginModal, /phone\.length !== 11/);
  assert.doesNotMatch(loginModal, /placeholder=\{copy\.phonePlaceholder\} maxLength=\{11\}/);
  assert.match(loginModal, /login\(\{ email: credential, password \}\)/);
  assert.match(api, /login\(\{ phone, email, password \}\)/);
  assert.match(api, /JSON\.stringify\(\{ phone, email, password \}\)/);
});

test('registration identity copy uses service-need wording instead of customer self-label', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');

  assert.match(loginModal, /customerTitle: 'I Need Service'/);
  assert.match(loginModal, /customerDesc: 'Use AI diagnostics, service requests, equipment records, spare parts, and maintenance follow-up.'/);
  assert.doesNotMatch(loginModal, /customerTitle: "I'm a Customer"/);
});

test('customer sidebar tools stay expanded without a More overflow menu', () => {
  const toolbar = read('frontend/src/components/Sidebar/ToolBar.jsx');

  assert.match(toolbar, /label: 'Request Service'/);
  assert.match(toolbar, /label: 'My Services'/);
  assert.match(toolbar, /label: 'Notifications'/);
  assert.match(toolbar, /label: 'My Equipment'/);
  assert.ok(
    toolbar.indexOf("label: 'Notifications'") < toolbar.indexOf("label: 'My Equipment'"),
    'Notifications should appear before My Equipment for logged-in customers'
  );
  assert.doesNotMatch(toolbar, /MoreHorizontal|sidebar-more-button|showCollapsed|setCollapsed|showMore|moreMenuRef/);
});

test('assigned work orders expose quote preparation instead of only cancellation', () => {
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(detailModal, /const pricingStatuses = \['assigned', 'in_progress', 'pricing', 'pending_payment', 'payment_review', 'in_service'\]/);
  assert.match(detailModal, /pricingStatuses\.includes\(effectiveStatus\)/);
});

test('work order attachments are folded into info instead of a separate tab', () => {
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.doesNotMatch(detailModal, /tabs\.push\(\{ key: 'attachments'/);
  assert.doesNotMatch(detailModal, /tab === 'attachments'/);
  assert.match(detailModal, /detail\?\.attachments\?\.length > 0/);
  assert.match(detailModal, /readOnly/);
  assert.doesNotMatch(repairRecord, /Attachments tab/);
});

test('engineer final service report can be submitted to customer review from report tab', () => {
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.match(repairRecord, /Submit Final Report to Customer/);
  assert.match(repairRecord, /onSubmitComplete/);
  assert.match(detailModal, /onSubmitComplete=\{/);
  assert.match(detailModal, /resolveWorkOrder\(workOrder\.id, userId\)/);
  assert.match(detailModal, /setTab\('info'\)/);
});

test('engineer can create a service report when the stored report is empty', () => {
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.match(repairRecord, /hasRepairRecordContent/);
  assert.match(repairRecord, /!hasRepairRecordContent\(repairRecord\)/);
  assert.match(repairRecord, /setIsEditing\(true\)/);
  assert.match(repairRecord, /Create Service Report/);
  assert.match(repairRecord, /Please complete and save this service report before submitting it to the customer/);
});

test('admin dispatch stays simple while Engineers owns search and profiles', () => {
  const app = read('admin/src/App.jsx');
  const usersPage = read('admin/src/pages/UsersPage.jsx');
  const workOrdersPage = read('admin/src/pages/WorkOrdersPage.jsx');
  const engineersPage = read('admin/src/pages/EngineersPage.jsx');
  const api = read('admin/src/services/api.js');

  assert.match(app, /import \{ EngineersPage \} from '\.\/pages\/EngineersPage'/);
  assert.match(app, /engineers: 'Engineers'/);
  assert.match(app, /users: 'Customers'/);
  assert.match(app, /case 'engineers': return <EngineersPage \/>/);

  assert.match(usersPage, /const type = 'customer'/);
  assert.doesNotMatch(usersPage, /\{ key: 'engineer', label: t\.engineer \}/);
  assert.doesNotMatch(usersPage, /\['customer', 'engineer'\]\.map/);

  assert.doesNotMatch(workOrdersPage, /engineerSearch/);
  assert.doesNotMatch(workOrdersPage, /exportEngineerPool/);
  assert.doesNotMatch(workOrdersPage, /filteredEngineers/);
  assert.match(workOrdersPage, /formatEngineerOption\(engineer\)/);

  assert.match(engineersPage, /getAdminEngineerDetail/);
  assert.match(engineersPage, /sagemro-engineers-current\.csv/);
  assert.match(engineersPage, /filterService/);
  assert.match(engineersPage, /selectedEngineer/);
  assert.match(engineersPage, /work_orders/);

  assert.match(api, /getAdminEngineerDetail\(engineerId\)/);
});

test('engineer profile lets Admin manage regional lead role and schedule signals', () => {
  const engineersPage = read('admin/src/pages/EngineersPage.jsx');
  const api = read('admin/src/services/api.js');

  assert.match(api, /updateAdminEngineer\(engineerId, data\)/);
  assert.match(engineersPage, /roleSettings: 'Regional Lead Settings'/);
  assert.match(engineersPage, /value: 'regional_lead'/);
  assert.match(engineersPage, /calendar_events/);
  assert.match(engineersPage, /active_work_orders/);
});

test('engineer application and admin engineer pages render regions and skills as tags', () => {
  const recruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');
  const engineersPage = read('admin/src/pages/EngineersPage.jsx');
  const applicationsPage = read('admin/src/pages/EngineerApplicationsPage.jsx');

  assert.match(recruiting, /TagInput/);
  assert.match(recruiting, /REGION_SUGGESTIONS/);
  assert.match(recruiting, /SKILL_SUGGESTIONS/);
  assert.match(recruiting, /onKeyDown/);
  assert.match(recruiting, /service_regions: \[\]/);
  assert.match(recruiting, /skill_tags: \[\]/);
  assert.doesNotMatch(recruiting, /service_regions: ''/);
  assert.doesNotMatch(recruiting, /skill_tags: ''/);

  assert.match(engineersPage, /renderTags\(profile\.engineer\.specialties/);
  assert.match(engineersPage, /renderTags\(profile\.engineer\.services/);
  assert.match(applicationsPage, /renderTags\(application\.service_regions/);
  assert.match(applicationsPage, /renderTags\(application\.skill_tags/);
});

test('engineer recruiting page is an ad-ready landing page with modal application', () => {
  const recruiting = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.match(recruiting, /modalOpen/);
  assert.match(recruiting, /Join SAGEMRO.s Industrial Service Network/);
  assert.match(recruiting, /Get matched with paid field service opportunities/);
  assert.match(recruiting, /Apply to Join/);
  assert.match(recruiting, /What is SAGEMRO/);
  assert.match(recruiting, /AI-assisted industrial service platform/);
  assert.match(recruiting, /What you may receive after approval/);
  assert.match(recruiting, /Paid field service opportunities/);
  assert.match(recruiting, /Quote review support/);
  assert.match(recruiting, /Payment confirmation before service/);
  assert.match(recruiting, /We are building the network region by region/);
  assert.match(recruiting, /What we look for/);
  assert.match(recruiting, /Regional Lead opportunity/);
  assert.match(recruiting, /How work and payment starts/);
  assert.match(recruiting, /Frequently asked questions/);
  assert.match(recruiting, /Approved representatives receive an account activation link/);
  assert.match(recruiting, /fixed inset-0 z-50/);
  assert.doesNotMatch(recruiting, /lg:grid-cols-\[1\.06fr_0\.94fr\]/);
});

test('engineer profile supports PayPal and SWIFT payout methods only', () => {
  const api = read('frontend/src/services/api.js');
  const profileModal = read('frontend/src/components/Engineer/EngineerProfileModal.jsx');
  const worker = read('worker/src/index.js');
  const migration = read('worker/migrations/031_engineer_payouts.sql');

  assert.match(api, /payout_method/);
  assert.match(api, /paypal_account/);
  assert.match(api, /bank_swift_code/);
  assert.match(profileModal, /Engineer payout method/);
  assert.match(profileModal, /PayPal account/);
  assert.match(profileModal, /Bank transfer \/ SWIFT/);
  assert.doesNotMatch(profileModal, /Wise/);
  assert.doesNotMatch(profileModal, /Payoneer/);
  assert.match(worker, /payout_method, paypal_account, bank_country, bank_name, bank_account, bank_swift_code, account_holder/);
  assert.match(migration, /payout_method TEXT DEFAULT 'paypal'/);
  assert.match(migration, /paypal_account TEXT/);
  assert.match(migration, /bank_swift_code TEXT/);
});

test('work orders expose engineer payout as internal closure after service completion', () => {
  const frontendApi = read('frontend/src/services/api.js');
  const adminApi = read('admin/src/services/api.js');
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const workOrdersPage = read('admin/src/pages/WorkOrdersPage.jsx');
  const worker = read('worker/src/index.js');
  const migration = read('worker/migrations/031_engineer_payouts.sql');

  assert.match(frontendApi, /getWorkOrderPayout/);
  assert.match(adminApi, /updateAdminWorkOrderPayout/);
  assert.match(detailModal, /Engineer service payment/);
  assert.match(detailModal, /Payout pending/);
  assert.match(workOrdersPage, /Engineer service payment/);
  assert.match(workOrdersPage, /Mark payout completed/);
  assert.match(worker, /handleAdminUpdateWorkOrderPayout/);
  assert.match(worker, /work_order_payouts/);
  assert.match(worker, /payout_status: payout\?\.status \|\| 'not_ready'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS work_order_payouts/);
  assert.match(migration, /status TEXT DEFAULT 'not_ready'/);
});

test('engineer task overview uses two columns on mobile', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5/);
});

test('engineer workspace gives English next steps and selected task context', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /getNextAction/);
  assert.match(workspace, /Needs action/);
  assert.match(workspace, /Next step:/);
  assert.match(workspace, /const activeTicket = selectedTicket \|\| tickets\[0\] \|\| null/);
  assert.match(workspace, /Current Task Context/);
  assert.match(workspace, /Customer \/ Region/);
  assert.match(workspace, /Machine \/ Service Type/);
  assert.match(workspace, /Job Preparation/);
  assert.match(workspace, /AI Intake Summary/);
  assert.doesNotMatch(workspace, / 路 |澶囦欢|閰嶄欢/);
});

test('engineer workspace formats AI intake JSON and hides internal category codes', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /formatAiIntakeSummary/);
  assert.match(workspace, /tryParseAiSummary/);
  assert.match(workspace, /summary\.required_specialties/);
  assert.match(workspace, /summary\.suggested_skills/);
  assert.match(workspace, /summary\.urgency_notes/);
  assert.match(workspace, /getDeviceLabel/);
  assert.match(workspace, /getIssueLabel/);
  assert.doesNotMatch(workspace, /<p>\{activeAiSummary \|\| activeTicket\.description/);
  assert.doesNotMatch(workspace, /formatCustomerDeviceLine\(ticket \|\| \{\}\)/);
});

test('engineer workspace keeps task context and scheduling display fully English', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');
  const calendar = read('frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx');

  assert.match(workspace, /formatEngineerDescription/);
  assert.match(workspace, /replaceChineseDeviceLabels/);
  assert.match(workspace, /CHINESE_ENGINEER_DESCRIPTION_TERMS/);
  assert.match(workspace, /\['客户', 'Customer'\]/);
  assert.match(workspace, /\['故障', 'Fault'\]/);
  assert.match(workspace, /\['激光切割头', 'laser cutting head'\]/);
  assert.match(workspace, /ticket\.description \? formatEngineerDescription\(ticket\.description\)/);
  assert.match(workspace, /Preparation for/);
  assert.match(workspace, /\{activeTicket\.order_no \|\| activeTicket\.id\}/);
  assert.doesNotMatch(workspace, /\{ticket\.description \|\| 'No service description yet'\}/);

  assert.match(calendar, /type="text"/);
  assert.match(calendar, /formatLocalDateTimeInput/);
  assert.match(calendar, /parseLocalDateTimeInput/);
  assert.match(calendar, /placeholder="YYYY-MM-DD HH:mm"/);
  assert.doesNotMatch(calendar, /type="datetime-local"/);
});

test('engineer workspace places calendar above tasks and checklist at the right bottom', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  const taskOverviewIndex = workspace.indexOf('Task Overview');
  const topGridIndex = workspace.indexOf('mb-6 grid items-start gap-4');
  const calendarIndex = workspace.indexOf('<EngineerAvailabilityCalendar />');
  const serviceTasksIndex = workspace.indexOf('Service Tasks');
  const contextIndex = workspace.indexOf('Current Task Context');
  const preparationIndex = workspace.indexOf('Job Preparation');
  const checklistIndex = workspace.indexOf('Service Standard Checklist');

  assert.ok(taskOverviewIndex > -1);
  assert.ok(topGridIndex > -1);
  assert.ok(calendarIndex > taskOverviewIndex);
  assert.ok(calendarIndex < serviceTasksIndex);
  assert.ok(contextIndex < preparationIndex);
  assert.ok(preparationIndex < checklistIndex);
});

test('customer service views translate machine fields to English', () => {
  const display = read('frontend/src/utils/workOrderDisplay.js');
  const myServices = read('frontend/src/components/Sidebar/MyWorkOrdersModal.jsx');
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(display, /\['激光切割机', 'Laser cutting machine'\]/);
  assert.match(display, /\['折弯机', 'Press brake'\]/);
  assert.match(myServices, /^const customerStatuses = \[/m);
  assert.match(myServices, /WorkOrderStatus\.RESOLVED/);
  assert.match(myServices, /WorkOrderStatus\.PENDING_REVIEW/);
  assert.match(myServices, /data-testid="go-rate-button"/);
  assert.match(detailModal, /const canRate = effectiveStatus === 'resolved' \|\| effectiveStatus === 'pending_review'/);
  assert.match(detailModal, /tabs\.push\(\{ key: 'repairRecord', label: 'Service Report' \}\)/);
  assert.match(myServices, /formatCustomerDeviceLine\(order\)/);
  assert.match(detailModal, /Machine: <span/);
});

test('payment instructions are readable and send customers back to Messages with proof guidance', () => {
  const paymentModal = read('frontend/src/components/Payment/PaymentModal.jsx');
  const pricingPanels = read('frontend/src/components/WorkOrder/PricingPanels.jsx');
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(paymentModal, /bg-white text-slate-950/);
  assert.match(paymentModal, /https:\/\/www\.paypal\.com\/ncp\/payment\/4YLFXRSUSZJ5N/);
  assert.match(paymentModal, /Open PayPal Payment Page/);
  assert.match(paymentModal, /send the bank slip or PayPal screenshot to the engineer in Messages/);
  assert.match(paymentModal, /Continue with PayPal Instructions/);
  assert.match(pricingPanels, /onConfirmed\?\.\('messages'\)/);
  assert.match(detailModal, /if \(nextTab\) setTab\(nextTab\)/);
});
