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

test('admin drawer supports onsite confirmation, arrival audit, and manual override', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /onsite-conversion\/confirm/);
  assert.match(api, /arrival-override/);
  assert.match(source, /confirmAdminOnsiteConversion/);
  assert.match(source, /overrideAdminArrival/);
  assert.match(source, /arrival_checks/);
  assert.match(source, /onsite_conversion_status/);
  assert.match(source, /adminSiteLocation\.service_latitude === ''/);
  assert.match(source, /adminSiteLocation\.service_longitude === ''/);
  assert.match(source, /window\.prompt/);
});

test('admin drawer can confirm the completed service balance payment', async () => {
  const source = await readFile(new URL('./WorkOrdersPage.jsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../services/api.js', import.meta.url), 'utf8');

  assert.match(api, /payment\/approve-balance/);
  assert.match(source, /approveAdminWorkOrderBalance/);
  assert.match(source, /detail\.balance_payment\?\.status/);
  assert.match(source, /确认尾款到账/);
});
