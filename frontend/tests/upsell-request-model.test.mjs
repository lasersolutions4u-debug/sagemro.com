import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpsellPayload,
  getUpsellCategoryLabel,
  getUpsellStatusLabel,
} from '../src/components/Upsell/upsellRequestModel.js';

test('buildUpsellPayload creates workspace payload without work order id', () => {
  const payload = buildUpsellPayload({
    category: 'laser_peripheral',
    title: '客户考虑增加除尘装置',
    description: '现场粉尘较大',
    site_context: '已有激光切割设备',
    expected_timeline: 'within_3_months',
    budget_signal: 'comparing_quotes',
    contact_name: '王经理',
    contact_phone: '13800000000',
  }, { sourceType: 'engineer_workspace' });

  assert.equal(payload.source_type, 'engineer_workspace');
  assert.equal(payload.work_order_id, '');
  assert.equal(payload.category, 'laser_peripheral');
});

test('buildUpsellPayload creates work-order-linked payload', () => {
  const payload = buildUpsellPayload({
    category: 'automation_retrofit',
    title: '桁架上下料改造',
    description: '客户希望降低人工上下料强度',
  }, { sourceType: 'work_order', workOrderId: 'wo-1' });

  assert.equal(payload.source_type, 'work_order');
  assert.equal(payload.work_order_id, 'wo-1');
});

test('labels keep product copy away from complete machine sales', () => {
  assert.equal(getUpsellCategoryLabel('bending_tooling', 'zh-CN'), '折弯相关');
  assert.equal(getUpsellStatusLabel('pending_assignment', 'zh-CN'), '待分配');
});
