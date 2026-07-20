import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('customer service requests capture the site address and browser coordinates', () => {
  const modal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const admin = read('admin/src/pages/WorkOrdersPage.jsx');
  const app = read('frontend/src/App.jsx');
  const api = read('frontend/src/services/api.js');

  assert.match(modal, /service_address/);
  assert.match(modal, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(modal, /service_mode/);
  assert.match(modal, /serviceModeOptions/);
  assert.match(app, /service_latitude: data\.service_latitude/);
  assert.match(app, /service_location_source: data\.service_location_source/);
  assert.match(modal, /const allowAddressSearch = !isCn/);
  assert.match(modal, /\{allowAddressSearch && \(/);
  assert.match(detail, /const allowAddressSearch = !isCn/);
  assert.match(detail, /\{allowAddressSearch && \(/);
  assert.match(admin, /const isCn = runtimeConfig\.locale === 'zh-CN'/);
  assert.match(admin, /const allowAddressSearch = !isCn/);
  assert.match(admin, /\{allowAddressSearch && \(/);
  assert.match(api, /\/api\/location\/search/);
});

test('engineers can check in before completing an on-site work order', () => {
  const api = read('frontend/src/services/api.js');
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const worker = read('worker/src/index.js');
  const migration = read('worker/migrations/033_work_order_location_verification.sql');

  assert.match(api, /\/arrival-check/);
  assert.match(detail, /checkInWorkOrder/);
  assert.match(detail, /arrival_verification_required/);
  assert.match(worker, /handleWorkOrderArrivalCheck/);
  assert.match(worker, /arrival_verified_at/);
  assert.match(migration, /work_order_arrival_checks/);
});

test('remote and hybrid work orders can be converted to confirmed onsite service', () => {
  const api = read('frontend/src/services/api.js');
  const detail = read('frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx');
  const worker = read('worker/src/index.js');
  const migration = read('worker/migrations/035_onsite_conversion_workflow.sql');

  assert.match(api, /onsite-conversion\/request/);
  assert.match(api, /onsite-conversion\/confirm/);
  assert.match(detail, /requestOnsiteConversion/);
  assert.match(detail, /confirmOnsiteConversion/);
  assert.match(detail, /onsite_conversion_status/);
  assert.match(detail, /\{allowAddressSearch && \(/);
  assert.match(detail, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(worker, /handleRequestOnsiteConversion/);
  assert.match(worker, /handleConfirmOnsiteConversion/);
  assert.match(worker, /if \(!workOrder\.arrival_verification_required\)/);
  assert.doesNotMatch(worker, /!workOrder\.arrival_verification_required && workOrder\.service_mode !== 'hybrid'/);
  assert.doesNotMatch(detail, /arrival_verification_required \|\| detail\?\.service_mode === 'hybrid'/);
  assert.doesNotMatch(detail, /data\.service_address \|\| current\.service_address/);
  assert.match(migration, /onsite_conversion_requested_at/);
});
