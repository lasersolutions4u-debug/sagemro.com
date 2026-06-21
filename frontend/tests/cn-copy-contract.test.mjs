import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function extractCnCopyObject(source) {
  const start = source.indexOf('  cn: {');
  const end = source.indexOf('  en: {', start);
  assert.ok(start >= 0 && end > start, 'expected cn/en copy blocks to be discoverable');
  return source.slice(start, end);
}

function extractConstTemplate(source, name) {
  const pattern = new RegExp(`const ${name} = \`([\\s\\S]*?)\`\\.trim\\(\\);`);
  const match = source.match(pattern);
  assert.ok(match, `expected ${name} template to be discoverable`);
  return match[1];
}

test('CN engineer recruiting copy reads as native Chinese service positioning', () => {
  const source = extractCnCopyObject(read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx'));

  assert.doesNotMatch(source, /认证服务代表计划/);
  assert.doesNotMatch(source, /被看见、被支持、被认真对待/);
  assert.doesNotMatch(source, /Service Representative Network/);
  assert.doesNotMatch(source, /Admin 与区域负责人|区域负责人和 Admin|从 Admin 到区域负责人/);
  assert.doesNotMatch(source, /平台重点沉淀/);

  assert.match(source, /认证服务工程师计划/);
  assert.match(source, /真正懂现场的工程师/);
  assert.match(source, /运营团队/);
  assert.match(source, /区域负责人/);
  assert.match(source, /成就工程师/);
});

test('CN public service copy avoids stiff translated product wording', () => {
  const publicSources = [
    read('frontend/src/components/Chat/WelcomePage.jsx'),
    read('frontend/src/components/common/AboutModal.jsx'),
  ].join('\n');

  assert.doesNotMatch(publicSources, /获得可服务的清晰信息/);
  assert.doesNotMatch(publicSources, /进入官方服务动作/);
  assert.doesNotMatch(publicSources, /读取图片/);
  assert.doesNotMatch(publicSources, /一个聊天入口，六类服务结果/);
  assert.doesNotMatch(publicSources, /沉淀成客户、工程师和 SAGEMRO 都能继续推进的服务线索/);
  assert.doesNotMatch(publicSources, /报警、照片、备件/);
  assert.doesNotMatch(publicSources, /现场照片/);

  assert.match(publicSources, /把问题整理清楚/);
  assert.match(publicSources, /进入人工确认与服务安排/);
  assert.match(publicSources, /一次对话，理清六类服务方向/);
  assert.match(publicSources, /后续能推进的服务依据/);
});

test('CN first impression copy builds market trust for customers, engineers, and operations', () => {
  const homeSource = read('frontend/src/components/Chat/WelcomePage.jsx');
  const engineerCnCopy = extractCnCopyObject(read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx'));
  const adminLoginSource = [
    read('admin/src/pages/LoginPage.jsx'),
    read('admin/src/config/runtime.js'),
  ].join('\n');

  assert.match(homeSource, /官方服务入口/);
  assert.match(homeSource, /锁定下一步/);
  assert.match(homeSource, /少走弯路/);

  assert.match(engineerCnCopy, /长期合作/);
  assert.match(engineerCnCopy, /排单日历/);
  assert.match(engineerCnCopy, /区域协同/);

  assert.match(adminLoginSource, /SAGEMRO 运营中枢/);
  assert.match(adminLoginSource, /线索审核/);
  assert.match(adminLoginSource, /派工、报价和服务归档/);
  assert.doesNotMatch(adminLoginSource, /运营管理员登录/);
});

test('CN public and legal copy uses localized operator and service system names', () => {
  const publicSources = [
    read('frontend/src/components/common/Footer.jsx'),
    read('frontend/src/components/common/AboutModal.jsx'),
    read('frontend/src/components/Chat/WelcomePage.jsx'),
    read('frontend/src/components/Chat/ChatArea.jsx'),
    read('frontend/src/components/Auth/LoginModal.jsx'),
  ].join('\n');
  const legalSource = read('frontend/src/components/common/LegalModal.jsx');
  const legalCnCopy = [
    extractConstTemplate(legalSource, 'ZH_USER_AGREEMENT'),
    extractConstTemplate(legalSource, 'ZH_PRIVACY_POLICY'),
    extractConstTemplate(legalSource, 'ZH_AI_DISCLAIMER'),
  ].join('\n');
  const legalDocs = [
    read('docs/legal/privacy-policy.md'),
    read('docs/legal/ai-disclaimer.md'),
    read('docs/SAGEMRO-平台服务协议.md'),
  ].join('\n');

  assert.match(publicSources, /SAGEMRO 智能服务系统/);
  assert.match(publicSources, /济南钰峭机械有限公司/);
  assert.match(legalCnCopy, /SAGEMRO 智能服务系统/);
  assert.match(legalCnCopy, /济南钰峭机械有限公司/);
  assert.match(legalCnCopy, /https:\/\/sagemro\.cn/);
  assert.match(legalSource, /平台运营方：济南钰峭机械有限公司/);
  assert.match(legalDocs, /SAGEMRO 智能服务系统/);
  assert.match(legalDocs, /济南钰峭机械有限公司/);
  assert.match(legalDocs, /https:\/\/sagemro\.cn/);

  assert.doesNotMatch(legalCnCopy, /Jinan Euchio Machinery Co\., Ltd\./);
  assert.doesNotMatch(legalCnCopy, /SAGEMRO Service OS/);
  assert.doesNotMatch(legalCnCopy, /https:\/\/sagemro\.com/);
  assert.doesNotMatch(legalDocs, /Jinan Euchio Machinery Co\., Ltd\./);
  assert.doesNotMatch(legalDocs, /SAGEMRO Service OS/);
});

test('CN operations copy avoids internal English role labels in visible text', () => {
  const operationsSources = [
    read('frontend/src/components/Engineer/EngineerAvailabilityCalendar.jsx'),
    read('admin/src/App.jsx'),
    read('admin/src/pages/WorkOrdersPage.jsx'),
    read('admin/src/pages/EngineerApplicationsPage.jsx'),
    read('admin/src/pages/DashboardPage.jsx'),
  ].join('\n');

  assert.doesNotMatch(operationsSources, /Admin 与区域负责人/);
  assert.doesNotMatch(operationsSources, /区域负责人和 Admin/);
  assert.doesNotMatch(operationsSources, /从 Admin 到区域负责人/);
  assert.doesNotMatch(operationsSources, /主流程为 Admin 分配给区域负责人/);
  assert.doesNotMatch(operationsSources, /仅 Admin \/ 区域负责人 \/ 工程师可见/);
  assert.doesNotMatch(operationsSources, /审核认证服务代表申请/);
  assert.doesNotMatch(operationsSources, /运营管理后台/);

  assert.match(operationsSources, /运营团队/);
  assert.match(operationsSources, /工程师申请审核/);
  assert.match(operationsSources, /SAGEMRO 运营中枢/);
});

test('CN secondary customer flows include localized visible copy', () => {
  const expectedChineseCopy = [
    ['frontend/src/components/Sidebar/WorkOrderModal.jsx', /提交服务申请|服务类型|问题描述|SAGEMRO 将审核你的服务需求/],
    ['frontend/src/components/WorkOrder/PricingPanels.jsx', /正式报价|确认报价|协商调整|SAGEMRO 正在准备正式报价/],
    ['frontend/src/components/WorkOrder/AttachmentsPanel.jsx', /上传中|暂无附件|支持 JPG\/PNG\/GIF\/WebP\/MP4\/WebM/],
    ['frontend/src/components/Payment/PaymentModal.jsx', /确认付款|付款成功|模拟付款环境|正式付款安排以 SAGEMRO 确认为准/],
    ['frontend/src/components/Chat/LeadForm.jsx', /申请 SAGEMRO 跟进|提交成功|请留下联系方式/],
    ['frontend/src/components/Device/MyDevicesModal.jsx', /我的设备|设备信息会自动整理|不会公开展示/],
    ['frontend/src/components/Settings/CustomerHomeModal.jsx', /公司资料|公司信息|账户安全|保存修改/],
    ['frontend/src/components/Device/DeviceForm.jsx', /添加设备|设备名称|设备类型|添加/],
    ['frontend/src/components/Device/DeviceDetailPanel.jsx', /返回设备列表|设备类型|维护记录|SAGEMRO 工程师/],
    ['frontend/src/components/Sidebar/MyWorkOrdersModal.jsx', /我的服务|服务类型|SAGEMRO 工程师/],
    ['frontend/src/components/Chat/InputArea.jsx', /补充现场图片|发送图片，请帮我看一下现场情况/],
  ];

  for (const [relativePath, pattern] of expectedChineseCopy) {
    assert.match(read(relativePath), pattern, `${relativePath} should contain CN localized copy`);
  }
});
