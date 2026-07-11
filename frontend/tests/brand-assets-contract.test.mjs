import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function extractPlaceholderExpression(source) {
  const match = source.match(/const placeholder = ([^;]+);/);
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

  assert.match(welcome, /Describe the machine issue/);
  assert.match(welcome, /organize symptoms, risks, and next-step options/);
  assert.match(welcome, /before any service or purchasing decision/);
  assert.match(welcome, /Clear facts first/);
  assert.match(welcome, /BM111 alarm/);
  assert.match(welcome, /burrs on stainless steel/);
  assert.match(welcome, /href: '\/tools'/);
  assert.match(welcome, /href: '\/insights'/);
  assert.match(welcome, /Calculators/);
  assert.match(welcome, /Insights/);
  assert.doesNotMatch(welcome, /sales form|sales shortcut/i);
  assert.doesNotMatch(welcome, /Machine selection|new-machine evaluation/);
  assert.doesNotMatch(welcome, /supports international customers with independent after-sales service, spare parts, consumables/);
  assert.match(welcome, /先描述设备问题/);
  assert.match(welcome, /再决定是否需要人工服务、备件或进一步评估/);
  assert.match(about, /helps customers and engineers organize machine symptoms/);
  assert.match(about, /What The Chat Can Help Clarify/);
  assert.doesNotMatch(about, /One Chat, Six Service Outcomes/);
  assert.doesNotMatch(about, /sales request/i);
  assert.doesNotMatch(about, /Machine selection|new-machine projects/);
  assert.match(about, /帮助客户与工程师整理设备现象、风险和可选下一步/);
  assert.doesNotMatch(about, /operatorLine|Operated by Jinan Euchio Machinery/);
  assert.doesNotMatch(about, /field photos|现场照片/);
  assert.match(footer, /© 2026 SAGEMRO/);
  assert.doesNotMatch(footer, /operated by Jinan Euchio Machinery|由济南钰峭机械有限公司运营/);
  assert.match(footer, /鲁ICP备2026032904号-1/);
  assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\//);
  assert.match(engineerRecruiting, /SAGEMRO 智能服务系统 · 认证服务代表计划/);
  assert.doesNotMatch(engineerRecruiting, /badge: 'SAGEMRO Service OS · 认证服务代表计划'/);
});

test('AI tool copy keeps service preparation neutral instead of sales routing', () => {
  const aiTools = read('frontend/src/data/aiServiceTools.js');
  const aiPanel = read('frontend/src/components/AI/AIToolsPanel.jsx');
  const legal = read('frontend/src/components/common/LegalModal.jsx');

  assert.match(aiTools, /Service Cost Reference AI/);
  assert.match(aiTools, /Maintenance Risk Review AI/);
  assert.match(aiTools, /service request preparation or admin review/);
  assert.match(aiPanel, /neutral reviewed next-step summary/);
  assert.match(aiPanel, /Case type/);
  assert.match(aiPanel, /natural chat remains the primary experience/);
  assert.match(legal, /Service cost reference/);
  assert.match(legal, /服务费用参考/);
  assert.doesNotMatch(aiTools, /sales lead|Repair Estimate AI|Equipment Health Report AI|Health Report/);
  assert.doesNotMatch(aiPanel, /right SAGEMRO conversion action|right conversion action|Lead type/);
  assert.doesNotMatch(legal, /Repair estimate|维修估算/);
});

test('COM inquiry path asks for service-ready international request details', () => {
  const workOrderModal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

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
  assert.match(loginModal, /helps organize the facts so you can decide what to do next/);
  assert.doesNotMatch(loginModal, /guide the next service step/);
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

test('service report edit action is a compact top action instead of a bottom block button', () => {
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.match(repairRecord, /Pencil/);
  assert.match(repairRecord, /aria-label="Edit service report"/);
  assert.match(repairRecord, /<Pencil size=\{14\}/);
  assert.match(repairRecord, /self-start rounded-lg border border-\[var\(--color-border\)\] bg-\[var\(--color-surface\)\] px-3 py-2 text-xs/);
  assert.doesNotMatch(repairRecord, /grid gap-2 sm:grid-cols-2/);
  assert.doesNotMatch(repairRecord, /w-full py-2\.5 text-sm bg-\[var\(--color-surface-elevated\)\].*Edit Service Report/s);
});

test('service report parts entry explains manual parts and avoids material line duplication', () => {
  const repairRecord = read('frontend/src/components/WorkOrder/RepairRecordPanel.jsx');

  assert.match(repairRecord, /Parts Used \(manual entry\)/);
  assert.match(repairRecord, /Use this only for parts actually consumed or replaced on site/);
  assert.match(repairRecord, /If you already selected the same item in Material lines, do not enter it again here/);
  assert.match(repairRecord, /Part name/);
  assert.match(repairRecord, /Qty/);
  assert.match(repairRecord, /Unit/);
  assert.match(repairRecord, /Spec \/ note/);
  assert.match(repairRecord, /grid grid-cols-1 gap-2 sm:grid-cols-\[minmax\(180px,1fr\)_80px_90px_minmax\(160px,0\.8fr\)_auto\]/);
  assert.doesNotMatch(repairRecord, /placeholder="Specs"/);
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
  assert.match(recruiting, /Work with clear scope, prepared context, and documented service records/);
  assert.match(recruiting, /Apply to Join/);
  assert.match(recruiting, /What is SAGEMRO/);
  assert.match(recruiting, /AI-assisted industrial service platform/);
  assert.match(recruiting, /What you may receive after approval/);
  assert.match(recruiting, /Clear-scope field work/);
  assert.match(recruiting, /Prepared context and documented records/);
  assert.match(recruiting, /Quote review support/);
  assert.match(recruiting, /Payment and start authorization/);
  assert.match(recruiting, /We are building the network region by region/);
  assert.match(recruiting, /客户信息、报价边界、付款确认、现场安全和服务记录/);
  assert.doesNotMatch(recruiting, /Paid field service opportunities/);
  assert.doesNotMatch(recruiting, /Payment confirmation first/);
  assert.doesNotMatch(recruiting, /被看见、被支持、被认真对待/);
  assert.match(recruiting, /What we look for/);
  assert.match(recruiting, /Regional Lead opportunity/);
  assert.match(recruiting, /How work and payment starts/);
  assert.match(recruiting, /Frequently asked questions/);
  assert.match(recruiting, /Approved representatives receive an account activation link/);
  assert.match(recruiting, /fixed inset-0 z-50/);
  assert.doesNotMatch(recruiting, /lg:grid-cols-\[1\.06fr_0\.94fr\]/);
});

test('client shell moves conversation history into a modal and exposes industry tools', () => {
  const sidebar = read('frontend/src/components/Sidebar/Sidebar.jsx');
  const app = read('frontend/src/App.jsx');
  const chatHistory = read('frontend/src/components/Sidebar/ChatHistory.jsx');
  const industryToolsModal = read('frontend/src/components/Tools/IndustryToolsModal.jsx');
  const industryToolCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');
  const industryToolsPage = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const industryTools = read('frontend/src/data/industryTools.js');
  const insightsPage = read('frontend/src/components/Insights/InsightsPage.jsx');
  const insights = read('frontend/src/data/insights.js');
  const redirects = read('frontend/public/_redirects');

  assert.match(sidebar, /onOpenHistory/);
  assert.match(sidebar, /onOpenIndustryTools/);
  assert.match(sidebar, /History/);
  assert.match(sidebar, /Tools/);
  assert.match(sidebar, /Insights/);
  assert.match(sidebar, /href: '\/insights'/);
  assert.match(sidebar, /tool-insights/);
  assert.match(sidebar, /w-\[72px\]/);
  assert.doesNotMatch(sidebar, /<ChatHistory/);
  assert.match(app, /historyModalOpen/);
  assert.match(app, /industryToolsOpen/);
  assert.match(app, /currentPath === '\/tools'/);
  assert.match(app, /currentPath\.startsWith\('\/tools\/'\)/);
  assert.match(app, /currentPath === '\/insights'/);
  assert.match(app, /currentPath\.startsWith\('\/insights\/'\)/);
  assert.match(app, /<ChatHistory/);
  assert.match(app, /<IndustryToolsModal/);
  assert.match(app, /<IndustryToolsPage/);
  assert.match(app, /<InsightsPage/);
  assert.match(chatHistory, /Conversation History/);
  assert.match(chatHistory, /Search conversations/);
  assert.doesNotMatch(industryToolsModal, /<IndustryToolCalculator/);
  assert.match(industryToolsModal, /href="\/tools"/);
  assert.match(industryToolsModal, /All tools/);
  assert.match(industryToolsModal, /href="\/insights"/);
  assert.match(industryToolsModal, /industryTools\.map/);
  assert.match(industryToolCalculator, /Ask SAGEMRO AI to review this result/);
  assert.match(industryToolsPage, /href=\{`\/tools\/\$\{tool\.slug\}`\}/);
  assert.match(industryToolsPage, /link\[rel="canonical"\]/);
  assert.match(industryToolsPage, /meta\[name="\$\{name\}"\]/);
  assert.match(industryTools, /Metal Weight Calculator/);
  assert.match(industryTools, /Steel Price Watch/);
  assert.match(industryTools, /Laser Cutting Cost Calculator/);
  assert.match(industryTools, /Press Brake Tonnage Calculator/);
  assert.match(industryTools, /Assist Gas Consumption Calculator/);
  assert.match(industryTools, /Laser Cutting Speed Reference/);
  assert.match(industryTools, /V-die and Bend Allowance Helper/);
  assert.match(industryTools, /Equipment ROI Calculator/);
  assert.match(industryTools, /Chiller and Dust Collector Sizing/);
  assert.match(industryTools, /densityKgM3/);
  assert.match(industryTools, /market reference for planning/i);
  assert.match(industryTools, /metal-weight-calculator/);
  assert.match(industryTools, /steel-price-watch/);
  assert.match(industryTools, /laser-assist-gas-consumption-calculator/);
  assert.match(industryTools, /laser-cutting-speed-reference/);
  assert.match(industryTools, /press-brake-v-die-bend-allowance-helper/);
  assert.match(industryTools, /laser-cutting-machine-roi-calculator/);
  assert.match(industryTools, /laser-chiller-dust-collector-sizing-checklist/);
  assert.doesNotMatch(industryToolsPage, /Planned next calculators/);
  assert.match(insightsPage, /SAGEMRO Insights/);
  assert.match(insightsPage, /href=\{`\/tools\/\$\{insight\.toolSlug\}`\}/);
  assert.match(insights, /laser-cutting-cost-drivers/);
  assert.match(insights, /metal-weight-for-structural-profiles/);
  assert.match(redirects, /\/\* \/index\.html 200/);
});

test('public legal and tool copy use transparent reviewed-engineer wording', () => {
  const legal = read('frontend/src/components/common/LegalModal.jsx');
  const industryTools = read('frontend/src/data/industryTools.js');
  const toolsCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');

  assert.match(legal, /qualified engineers reviewed by SAGEMRO/);
  assert.match(legal, /合格工程师或经 SAGEMRO 审核的服务人员/);
  assert.doesNotMatch(legal, /SAGEMRO-designated service personnel/);
  assert.match(industryTools, /supplier quotes decide final purchasing cost/i);
  assert.match(toolsCalculator, /steelPriceReferences/);
  assert.doesNotMatch(industryTools, /not a supplier quote/i);
  assert.doesNotMatch(toolsCalculator, /not a supplier quote/i);
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

test('engineer task overview shows 8 personal metrics and 2 regional metrics', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /quotePending: tickets\.filter/);
  assert.match(workspace, /paymentFollowUp: tickets\.filter/);
  assert.match(workspace, /regionalQueue: tickets\.filter/);
  assert.match(workspace, /label: 'Quote Pending'/);
  assert.match(workspace, /label: 'Scheduled Dates'/);
  assert.match(workspace, /label: 'Regional Queue'/);
  assert.match(workspace, /label: 'Payment Follow-up'/);
  assert.match(workspace, /scheduledPreviewCount/);
  assert.match(workspace, /const personalMetrics = \[/);
  assert.match(workspace, /const regionalMetrics = isRegionalLead/);
  assert.match(workspace, /const metrics = \[\.\.\.regionalMetrics, \.\.\.personalMetrics\]/);
  assert.doesNotMatch(workspace, /label: 'Payment Follow-up'[\s\S]*const personalMetrics = \[/);
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

test('engineer workspace pairs compact task overview with a prominent calendar launcher', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  const taskOverviewIndex = workspace.indexOf('Task Overview');
  const splitOverviewIndex = workspace.indexOf('mb-6 grid items-stretch gap-4');
  const splitColumnsIndex = workspace.indexOf('lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]');
  const calendarLauncherIndex = workspace.indexOf('Scheduling Calendar');
  const calendarIndex = workspace.indexOf('<EngineerAvailabilityCalendar />');
  const serviceTasksIndex = workspace.indexOf('Service Tasks');
  const contextIndex = workspace.indexOf('Current Task Context');
  const preparationIndex = workspace.indexOf('Job Preparation');
  const checklistIndex = workspace.indexOf('Service Standard Checklist');

  assert.ok(taskOverviewIndex > -1);
  assert.ok(splitOverviewIndex > -1);
  assert.ok(splitColumnsIndex > splitOverviewIndex);
  assert.ok(taskOverviewIndex > splitOverviewIndex);
  assert.ok(calendarLauncherIndex > taskOverviewIndex);
  assert.match(workspace, /const \[isCalendarOpen, setIsCalendarOpen\] = useState\(false\)/);
  assert.match(workspace, /Update availability, blocked dates, and service windows/);
  assert.match(workspace, /lg:grid-cols-5/);
  assert.match(workspace, /bg-\[var\(--color-surface-elevated\)\] p-4/);
  assert.match(workspace, /size=\{18\}/);
  assert.match(workspace, /text-2xl font-semibold/);
  assert.match(workspace, /h-full rounded-2xl/);
  assert.doesNotMatch(workspace, /Visit windows/);
  assert.doesNotMatch(workspace, /Blocked dates/);
  assert.match(workspace, /title="My Scheduling Calendar"/);
  assert.match(workspace, /size="2xl"/);
  assert.ok(calendarIndex > checklistIndex);
  assert.ok(contextIndex < preparationIndex);
  assert.ok(preparationIndex < checklistIndex);
});

test('engineer workspace calendar launcher previews the next 30 days with scheduled dates highlighted', () => {
  const workspace = read('frontend/src/components/Engineer/EngineerWorkspace.jsx');

  assert.match(workspace, /getEngineerCalendarEvents/);
  assert.match(workspace, /buildCalendarPreviewDays/);
  assert.match(workspace, /getScheduledDateKeys/);
  assert.match(workspace, /calendarPreviewDays/);
  assert.match(workspace, /scheduledDateKeys/);
  assert.match(workspace, /Future 30 days/);
  assert.match(workspace, /Scheduled dates/);
  assert.match(workspace, /bg-amber-100/);
  assert.match(workspace, /text-amber-700/);
  assert.match(workspace, /grid-cols-7/);
  assert.match(workspace, /gap-0\.5/);
  assert.match(workspace, /min-h-6/);
});

test('engineer machine lead form captures multiple equipment needs and submits to admin', () => {
  const modal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');

  assert.match(modal, /equipment_needs/);
  assert.match(modal, /Equipment needs/);
  assert.match(modal, /Add equipment/);
  assert.match(modal, /Laser cutting machine/);
  assert.match(modal, /Laser welding machine/);
  assert.match(modal, /Press brake/);
  assert.match(modal, /Quantity/);
  assert.match(modal, /Power \/ specification/);
  assert.match(modal, /Submit to Admin/);
  assert.match(modal, /Machine lead submitted to Admin/);
  assert.doesNotMatch(modal, /Submit to Euchio Sales/);
  assert.doesNotMatch(modal, /why Euchio sales should follow up/);
});

test('engineer work order views redact customer contact before service and inside messages', () => {
  const detailModal = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const messagePanel = read('frontend/src/components/WorkOrder/MessagePanel.jsx');
  const redaction = read('frontend/src/utils/contactRedaction.js');
  const worker = read('worker/src/index.js');

  assert.match(redaction, /function redactContactInfo/);
  assert.match(redaction, /function canEngineerViewCustomerContact/);
  assert.match(redaction, /return 'XXX'/);
  assert.match(detailModal, /import \{ canEngineerViewCustomerContact, redactContactInfo \}/);
  assert.match(messagePanel, /import \{ redactContactInfo \}/);
  assert.match(read('frontend/src/components/Engineer/EngineerWorkspace.jsx'), /redactContactInfo\(replaceChineseDeviceLabels\(description\)\)/);
  assert.match(detailModal, /canEngineerViewCustomerContact\(effectiveStatus\)/);
  assert.match(detailModal, /redactContactInfo\(workOrder\.description\)/);
  assert.match(detailModal, /const customerPhoneDisplay = shouldShowCustomerContact \? detail\?\.customer_phone : detail\?\.customer_phone \? 'XXX' : ''/);
  assert.match(messagePanel, /redactContactInfo\(msg\.content\)/);
  assert.match(messagePanel, /content: redactContactInfo\(input\.trim\(\)\)/);
  assert.match(worker, /function redactContactInfoForWorkOrder/);
  assert.match(worker, /customer_phone: ''/);
  assert.match(worker, /description: redactContactInfoForWorkOrder\(wo\.description\)/);
  assert.match(worker, /content: redactContactInfoForWorkOrder\(row\.content\)/);
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
