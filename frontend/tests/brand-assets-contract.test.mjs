import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function extractPlaceholderExpression(source) {
  const match = source.match(/const placeholder = ([\s\S]*?);\n\n  return \(/)
    || source.match(/placeholder=\{([\s\S]*?)\}\n\s+disabled=/);
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

test('CN footer includes ICP record for the China site', () => {
  const footer = read('frontend/src/components/common/Footer.jsx');

  assert.match(footer, /SAGEMRO by 济南钰峭机械有限公司/);
  assert.match(footer, /鲁ICP备2026032904号-1/);
  assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\//);
});

test('registration copy uses email verification and a neutral name field', () => {
  const loginModal = read('frontend/src/components/Auth/LoginModal.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(loginModal, /请输入邮箱/);
  assert.match(loginModal, /邮箱 \*/);
  assert.match(loginModal, /请输入邮箱地址/);
  assert.match(loginModal, /sendVerifyCode\(email\)/);
  assert.match(loginModal, /姓名 \*/);
  assert.match(loginModal, /请输入姓名/);
  assert.doesNotMatch(loginModal, /真实姓名/);
  assert.match(api, /sendVerifyCode\(email\)/);
  assert.match(api, /JSON\.stringify\(\{ email \}\)/);
  assert.match(api, /registerCustomer\(\{ name, phone, email, password, code, company, identity \}\)/);
});
