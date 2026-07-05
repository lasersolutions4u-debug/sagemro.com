import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePaymentSummary,
  deriveSafetyStage,
  parseAiSummary,
} from '../src/components/WorkOrder/workOrderDetailModel.js';

test('parses AI summary only when valid content is available', () => {
  assert.deepEqual(parseAiSummary(JSON.stringify({ summary: '激光报警', required_specialties: ['laser'] })), {
    summary: '激光报警',
    required_specialties: ['laser'],
  });
  assert.equal(parseAiSummary('not-json'), null);
  assert.equal(parseAiSummary(null), null);
});

test('derives safety stage from urgency without overstating official diagnosis', () => {
  assert.deepEqual(deriveSafetyStage({ urgency: 'critical' }, null), {
    label: '高风险',
    tone: 'red',
    description: '到场前确认断电、激光、电气和现场防护条件。',
  });
  assert.deepEqual(deriveSafetyStage({ urgency: 'urgent' }, null), {
    label: '需优先处理',
    tone: 'amber',
    description: '建议提前确认现场联系人、停机窗口和必要备件。',
  });
});

test('derives payment summary as service progress without wallet wording', () => {
  const summary = derivePaymentSummary({ status: 'pending_payment', quote_review_status: 'approved' }, { payment: { status: 'pending' } });

  assert.deepEqual(summary.map((item) => [item.label, item.value]), [
    ['报价状态', '已通过运营复核'],
    ['客户确认', '待客户确认'],
    ['付款状态', '待回款'],
    ['服务完成', '服务处理中'],
    ['运营结算', '运营确认中'],
  ]);
  assert.equal(JSON.stringify(summary).includes('钱包'), false);
  assert.equal(JSON.stringify(summary).includes('提现'), false);
});
