import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  buildWorkOrderShortTitle,
  normalizeWorkOrderShortTitle,
  resolveWorkOrderShortTitle,
} from '../src/lib/workOrderTitles.js';

test('normalizes whitespace and removes contact information', () => {
  assert.equal(
    normalizeWorkOrderShortTitle('  Han\'s   3015 repair  support@example.com  '),
    'Han\'s 3015 repair',
  );
  assert.equal(
    normalizeWorkOrderShortTitle('现场维修 13800138000'),
    '现场维修',
  );
  assert.equal(
    normalizeWorkOrderShortTitle('Field repair +1 (415) 555-0100'),
    'Field repair',
  );
  assert.equal(
    normalizeWorkOrderShortTitle('Field repair 415-555-0100'),
    'Field repair',
  );
});

test('builds deterministic localized titles without AI text', () => {
  const order = {
    type: 'fault',
    service_mode: 'onsite',
    category_l1: 'laser_cutting',
    device_brand: "Han's Laser",
    device_model: '3015',
    description: 'Customer pasted a long equipment metadata sentence.',
  };

  assert.equal(buildWorkOrderShortTitle(order, 'com'), "Han's Laser 3015 on-site repair");
  assert.equal(buildWorkOrderShortTitle(order, 'cn'), "Han's Laser 3015 现场维修");
});

test('uses localized category and service fallbacks when device data is sparse', () => {
  const order = { type: 'maintenance', category_l1: 'laser_cutting' };
  assert.equal(buildWorkOrderShortTitle(order, 'com'), 'Laser cutting maintenance');
  assert.equal(buildWorkOrderShortTitle(order, 'cn'), '激光切割维护保养');
});

test('persisted Admin title is authoritative and is not language-filtered', () => {
  assert.equal(
    resolveWorkOrderShortTitle({ short_title: '济南 3015 维修', type: 'fault' }, 'com'),
    '济南 3015 维修',
  );
});

test('resolved titles are never empty and stay within 100 characters', () => {
  const resolved = resolveWorkOrderShortTitle({
    device_brand: 'A'.repeat(120),
    device_model: '3015',
    type: 'fault',
  }, 'com');
  assert.equal(resolved.length <= 100, true);
  assert.equal(resolveWorkOrderShortTitle({}, 'com'), 'Service task');
  assert.equal(resolveWorkOrderShortTitle({}, 'cn'), '服务任务');
});

test('schema and migration contain the nullable short title column', () => {
  const migration = readFileSync(new URL('../migrations/042_work_order_short_title.sql', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE work_orders ADD COLUMN short_title TEXT/);
  assert.match(migration, /'042_work_order_short_title'/);
  assert.match(schema, /short_title TEXT/);
});
