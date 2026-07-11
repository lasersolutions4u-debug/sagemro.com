import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('pending quote approval is only available inside the full order drawer', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const tableStart = source.indexOf('<table');
  const drawerStart = source.indexOf('{detailOpen &&');
  const tableSource = source.slice(tableStart, drawerStart);
  const drawerSource = source.slice(drawerStart);

  assert.equal(tableSource.includes('handleApprovePricing(wo)'), false);
  assert.match(tableSource, /openDetail\(wo\)/);
  assert.match(drawerSource, /handleApprovePricing\(detail\)/);
});
