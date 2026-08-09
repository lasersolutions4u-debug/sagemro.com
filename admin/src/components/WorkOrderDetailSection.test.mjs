import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = () => readFile(new URL('./WorkOrderDetailSection.jsx', import.meta.url), 'utf8');

test('detail navigation uses buttons and stable section targets', async () => {
  const component = await source();
  assert.match(component, /export function WorkOrderDetailNav/);
  assert.match(component, /type="button"/);
  assert.match(component, /onNavigate\(item\.key\)/);
  assert.match(component, /work-order-section-/);
});

test('detail sections expose disclosure semantics and a 44px control', async () => {
  const component = await source();
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /aria-controls=\{contentId\}/);
  assert.match(component, /min-h-11/);
  assert.match(component, /hidden=\{!open\}/);
});
