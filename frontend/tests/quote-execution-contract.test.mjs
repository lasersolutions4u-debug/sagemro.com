import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('payment schedule editor exposes bounded installment editing with stable controls', async () => {
  const source = await readSource('../src/components/WorkOrder/PaymentScheduleEditor.jsx');

  assert.match(source, /payment_plan_mode/);
  assert.match(source, /single/);
  assert.match(source, /installments/);
  assert.match(source, /payment_schedule\.length < 6/);
  assert.match(source, /payment_schedule\.length > 2/);
  assert.match(source, /createDefaultInstallment/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /Trash2/);
  assert.match(source, /Plus/);
  assert.match(source, /aria-label=/);
  assert.match(source, /title=/);
  assert.match(source, /aria-label=\{copy\.addInstallment\}/);
  assert.match(source, /title=\{copy\.addInstallment\}/);
  assert.match(source, /md:grid-cols-\[/);
  assert.match(source, /whitespace-nowrap/);
  assert.match(source, /required_before_start/);
  assert.match(source, /trigger_type/);
  assert.match(source, /due_date/);
  assert.match(source, /description/);
});

test('payment schedule editor shows total scheduled difference and percentage summary', async () => {
  const source = await readSource('../src/components/WorkOrder/PaymentScheduleEditor.jsx');

  assert.match(source, /scheduleTotals/);
  assert.match(source, /copy\.total/);
  assert.match(source, /copy\.scheduled/);
  assert.match(source, /copy\.difference/);
  assert.match(source, /percent/);
});

test('pricing panels integrate onsite days schedules validation and versioned confirmation', async () => {
  const [panels, detail, api] = await Promise.all([
    readSource('../src/components/WorkOrder/PricingPanels.jsx'),
    readSource('../src/components/WorkOrder/WorkOrderDetailModal.jsx'),
    readSource('../src/services/api.js'),
  ]);

  assert.match(panels, /PaymentScheduleEditor/);
  assert.match(panels, /PaymentScheduleSummary/);
  assert.match(panels, /serviceMode/);
  assert.match(panels, /expected_service_days/);
  assert.match(panels, /\['onsite', 'hybrid'\]\.includes\(serviceMode\)/);
  assert.match(panels, /buildPricingPayload/);
  assert.match(panels, /isCnLocale\(\) \? 'CNY' : 'USD'/);
  assert.match(panels, /isQuoteTermsValid/);
  assert.match(panels, /invalidTerms/);
  assert.match(panels, /pricing\.quote_version/);
  assert.match(detail, /serviceMode=\{detail\?\.service_mode/);
  assert.match(api, /quote_version: quoteVersion/);
});

test('customer confirmation shows localized invalid server terms and disables confirmation', async () => {
  const source = await readSource('../src/components/WorkOrder/PricingPanels.jsx');

  assert.match(source, /t\.customer\.invalidTerms/);
  assert.match(source, /disabled=\{!scheduleIsValid\}/);
  assert.match(source, /disabled=\{submitting \|\| !scheduleIsValid\}/);
  assert.match(source, /The quote payment terms are invalid/);
  assert.match(source, /报价付款条款无效/);
});

test('customer negotiation blocks malformed and zero nonempty counteroffers', async () => {
  const source = await readSource('../src/components/WorkOrder/PricingPanels.jsx');

  assert.match(source, /const normalizedCounterOffer = counterOffer === ''/);
  assert.match(source, /counterOffer !== '' && \(normalizedCounterOffer === null \|\| normalizedCounterOffer <= 0\)/);
  assert.match(source, /toastWarning\(t\.customer\.counterOfferInvalid\)/);
  assert.match(source, /rejectReason,\s*normalizedCounterOffer/);
});

test('customer summary presents the complete quote version without raw enum labels', async () => {
  const source = await readSource('../src/components/WorkOrder/PaymentScheduleSummary.jsx');

  assert.match(source, /labor_fee/);
  assert.match(source, /parts_fee/);
  assert.match(source, /travel_fee/);
  assert.match(source, /other_fee/);
  assert.match(source, /expected_service_days/);
  assert.match(source, /payment_schedule/);
  assert.match(source, /triggerLabels\[installment\.trigger_type\]/);
  assert.doesNotMatch(source, />\{installment\.trigger_type\}</);
});

test('pricing copy is bilingual and explains extension days do not add labor fees', async () => {
  const source = await readSource('../src/components/WorkOrder/PricingPanels.jsx');

  assert.match(source, /Expected onsite workdays/);
  assert.match(source, /预计现场作业日/);
  assert.match(source, /100% before service starts/);
  assert.match(source, /开工前一次付清/);
  assert.match(source, /Approved extensions increase the workday allowance only and do not automatically add labor fees\./);
  assert.match(source, /获批延期只增加可用作业日，不会自动增加人工费。/);
  assert.doesNotMatch(source, /get cn\(\) \{\s*return this\.en/);
});
