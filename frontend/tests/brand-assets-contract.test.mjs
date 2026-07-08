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

test('CN chat input does not promote image upload in placeholder copy', () => {
  const placeholderExpression = extractPlaceholderExpression(read('frontend/src/components/Chat/InputArea.jsx'));

  assert.doesNotMatch(placeholderExpression, /上传图片/);
  assert.doesNotMatch(placeholderExpression, /随时上传/);
  assert.match(placeholderExpression, /描述设备、报警、材料厚度或现场问题。/);
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

  assert.match(detailModal, /const pricingStatuses = \['assigned', 'in_progress', 'pricing', 'pending_payment', 'in_service'\]/);
  assert.match(detailModal, /pricingStatuses\.includes\(effectiveStatus\)/);
});

test('admin dispatch supports searchable engineer selection and local CSV backup', () => {
  const workOrdersPage = read('admin/src/pages/WorkOrdersPage.jsx');
  const usersPage = read('admin/src/pages/UsersPage.jsx');

  assert.match(workOrdersPage, /function downloadCsv/);
  assert.match(workOrdersPage, /exportEngineerPool/);
  assert.match(workOrdersPage, /sagemro-engineer-pool\.csv/);
  assert.match(workOrdersPage, /const \[engineerSearch, setEngineerSearch\] = useState\(\{\}\)/);
  assert.match(workOrdersPage, /getEngineerSearchText\(engineer\)\.includes\(engineerQuery\)/);
  assert.match(workOrdersPage, /describeEngineer\(selectedEngineer\)/);
  assert.match(usersPage, /exportCurrentList/);
  assert.match(usersPage, /sagemro-engineers-current\.csv/);
  assert.match(usersPage, /sagemro-customers-current\.csv/);
});
