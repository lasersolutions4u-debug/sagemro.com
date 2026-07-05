import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  derivePaymentBadge,
  deriveWorkOrderActionLabel,
  groupEngineerTickets,
  sortEngineerWorkQueue,
} from '../src/components/Engineer/engineerWorkspaceModel.js';

test('groups engineer tickets into operational homepage metrics', () => {
  const tickets = [
    { id: 'wo-assigned', status: 'assigned' },
    { id: 'wo-progress', status: 'in_progress' },
    { id: 'wo-service', status: 'in_service' },
    { id: 'wo-pricing', status: 'pricing' },
    { id: 'wo-resolved', status: 'resolved' },
    { id: 'wo-review', status: 'pending_review' },
    { id: 'wo-payment', status: 'pending_payment' },
    { id: 'wo-done', status: 'completed', completed_at: new Date().toISOString() },
    { id: 'wo-parts', status: 'assigned', description: '需要配件保护镜片' },
  ];

  const grouped = groupEngineerTickets(tickets);

  assert.deepEqual(grouped.today.map((item) => item.id), ['wo-assigned', 'wo-progress', 'wo-service', 'wo-parts']);
  assert.deepEqual(grouped.pending.map((item) => item.id), ['wo-assigned', 'wo-parts']);
  assert.deepEqual(grouped.active.map((item) => item.id), ['wo-progress', 'wo-service']);
  assert.deepEqual(grouped.pricing.map((item) => item.id), ['wo-pricing']);
  assert.deepEqual(grouped.reports.map((item) => item.id), ['wo-resolved', 'wo-review']);
  assert.deepEqual(grouped.customerConfirm.map((item) => item.id), ['wo-resolved', 'wo-review']);
  assert.deepEqual(grouped.payment.map((item) => item.id), ['wo-payment']);
  assert.deepEqual(grouped.completedThisMonth.map((item) => item.id), ['wo-done']);
  assert.deepEqual(grouped.parts.map((item) => item.id), ['wo-parts']);
});

test('derives payment and action labels without wallet wording', () => {
  assert.deepEqual(derivePaymentBadge({ status: 'pending_payment' }), {
    label: '待回款',
    tone: 'amber',
    visible: true,
  });
  assert.deepEqual(derivePaymentBadge({ status: 'completed' }), {
    label: '已完成',
    tone: 'green',
    visible: true,
  });
  assert.equal(JSON.stringify(derivePaymentBadge({ status: 'pending_payment' })).includes('钱包'), false);
  assert.equal(JSON.stringify(derivePaymentBadge({ status: 'pending_payment' })).includes('提现'), false);

  assert.deepEqual(deriveWorkOrderActionLabel({ status: 'pricing' }), {
    label: '待报价',
    tone: 'purple',
  });
  assert.deepEqual(deriveWorkOrderActionLabel({ status: 'resolved' }), {
    label: '待客户确认',
    tone: 'teal',
  });
});

test('sorts engineer work queue by operational urgency', () => {
  const sorted = sortEngineerWorkQueue([
    { id: 'completed', status: 'completed' },
    { id: 'payment', status: 'pending_payment' },
    { id: 'critical', status: 'assigned', urgency: 'critical' },
    { id: 'pricing', status: 'pricing' },
    { id: 'progress', status: 'in_progress' },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['critical', 'payment', 'pricing', 'progress', 'completed']);
});

test('engineer homepage source keeps AI and customer device details out of global sidebar', () => {
  const source = readFileSync(new URL('../src/components/Engineer/EngineerWorkspace.jsx', import.meta.url), 'utf8');

  assert.equal(source.includes('<h2 className="mb-3 font-semibold">AI 诊断摘要</h2>'), false);
  assert.equal(source.includes('<h2 className="mb-3 font-semibold">客户设备档案</h2>'), false);
  assert.match(source, /待回款/);
  assert.match(source, /工程师工具箱/);
});
