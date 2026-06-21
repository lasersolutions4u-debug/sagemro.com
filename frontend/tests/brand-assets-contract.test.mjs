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

  assert.match(welcome, /Explain the machine issue once/);
  assert.match(welcome, /设备问题先说清楚，服务推进少走弯路。/);
  assert.match(about, /An AI-assisted official service entrance/);
  assert.match(about, /面向激光切割与钣金加工设备的 AI 辅助官方服务入口。/);
  assert.doesNotMatch(about, /field photos|现场照片/);
  assert.match(footer, /SAGEMRO by Jinan Euchio Machinery Co\., Ltd\./);
  assert.match(footer, /SAGEMRO by 济南钰峭机械有限公司/);
  assert.match(engineerRecruiting, /SAGEMRO 智能服务系统 · 认证服务代表计划/);
  assert.doesNotMatch(engineerRecruiting, /badge: 'SAGEMRO Service OS · 认证服务代表计划'/);
});
