import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('customer, engineer, admin, and browser icons share SAGEMRO brand assets', () => {
  const expectedAssets = [
    'frontend/public/sagemro-logo.png',
    'frontend/public/sagemro-brand-mark.svg',
    'admin/public/sagemro-logo.png',
    'admin/public/sagemro-brand-mark.svg',
  ];

  for (const assetPath of expectedAssets) {
    assert.equal(existsSync(path.join(root, assetPath)), true, `${assetPath} should exist`);
  }

  assert.match(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-brand-mark\.svg/);
  assert.match(read('frontend/src/components/common/BrandMark.jsx'), /sagemro-logo\.png/);
  assert.match(read('admin/src/components/BrandMark.jsx'), /sagemro-brand-mark\.svg/);
  assert.match(read('admin/src/components/BrandMark.jsx'), /sagemro-logo\.png/);

  assert.match(read('frontend/index.html'), /href="\/sagemro-brand-mark\.svg"/);
  assert.match(read('admin/index.html'), /href="\/sagemro-brand-mark\.svg"/);
});
