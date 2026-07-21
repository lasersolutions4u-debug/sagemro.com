import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const adminRoot = path.resolve(import.meta.dirname, '../..');

async function read(relativePath) {
  return readFile(path.join(adminRoot, relativePath), 'utf8');
}

test('engineer applications expose independent review and activation workflows', async () => {
  const applications = await read('src/pages/EngineerApplicationsPage.jsx');

  assert.match(applications, /工程师合作申请/);
  assert.match(applications, /SAGEMRO 工程师服务协作网络/);
  assert.match(applications, /审核与账号开通/);
  assert.match(applications, /开通工程师账号/);
  assert.match(applications, /重新发送激活邮件/);
  assert.match(applications, /查看工程师档案/);
  assert.match(applications, /not_opened/);
  assert.match(applications, /awaiting_activation/);
  assert.match(applications, /activation_expired/);
  assert.match(applications, /activated/);
  assert.doesNotMatch(applications, /认证服务代表|创建账号后的工程师 ID|converted_user_id.*<input/);
});

test('engineer account setup stays inside the application card without password entry', async () => {
  const modal = await read('src/components/EngineerAccountSetupModal.jsx');

  assert.match(modal, /确认开通并发送激活邮件/);
  assert.match(modal, /application/);
  assert.match(modal, /regionalLeads/);
  assert.match(modal, /services/);
  assert.match(modal, /specialties/);
  assert.match(modal, /熟悉设备/);
  assert.match(modal, /服务项目/);
  assert.match(modal, /specialties: toList\(application\.equipment_types\)/);
  assert.match(modal, /services: toList\(application\.skill_tags\)/);
  assert.match(modal, /至少填写一项服务能力/);
  assert.doesNotMatch(modal, /type=["']password["']/);
});

test('admin API exposes application account opening and activation resend clients', async () => {
  const api = await read('src/services/api.js');

  assert.match(api, /openAdminEngineerAccount/);
  assert.match(api, /engineer-applications\/\$\{applicationId\}\/open-account/);
  assert.match(api, /resendAdminEngineerActivation/);
  assert.match(api, /engineer-applications\/\$\{applicationId\}\/resend-activation/);
});

test('application cards can navigate to the linked engineer profile', async () => {
  const app = await read('src/App.jsx');
  const applications = await read('src/pages/EngineerApplicationsPage.jsx');
  const engineers = await read('src/pages/EngineersPage.jsx');

  assert.match(app, /selectedEngineerId/);
  assert.match(app, /onOpenEngineer/);
  assert.match(app, /initialEngineerId/);
  assert.match(applications, /onOpenEngineer/);
  assert.match(engineers, /initialEngineerId/);
  assert.match(engineers, /onEngineerOpened/);
});

test('customer management no longer contains the generic engineer creation branch', async () => {
  const users = await read('src/pages/UsersPage.jsx');

  assert.doesNotMatch(users, /addType === ['"]engineer['"]|engineerRole|specialtiesLabel|servicesLabel/);
  assert.doesNotMatch(users, /DEVICE_TYPES|COMMON_SERVICES|filterSpecialty|filterStatus/);
});
