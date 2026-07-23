import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('material master offers CSV template download and local upload preview only', async () => {
  const source = await readFile(new URL('./MaterialsPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /MATERIAL_TEMPLATE_HEADERS/);
  assert.match(source, /Download CSV template/);
  assert.match(source, /Preview CSV/);
  assert.match(source, /accept=".csv"/);
  assert.match(source, /parseCsvRows/);
  assert.match(source, /preview only/i);
  assert.doesNotMatch(source, /bulkCreateAdminMaterial/);
});

test('operations staff receive material master data without mutation controls', async () => {
  const source = await readFile(new URL('./MaterialsPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /export function MaterialsPage\(\{ readOnly = false \}\)/);
  assert.match(source, /if \(readOnly\) return;/);
  assert.match(source, /\{!readOnly && \([\s\S]*t\.bulkTitle/);
  assert.match(source, /\{!readOnly && \([\s\S]*t\.requestsTitle/);
  assert.match(source, /\{!readOnly && \([\s\S]*startEdit\(material\)/);
  assert.match(source, /\{!readOnly && \([\s\S]*t\.newMaterial/);
});
