import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBusinessQuoteEstimate } from '../src/lib/businessQuoteEstimate.js';

const COST_KEYS = ['parts_cost', 'engineer_cost', 'travel_cost', 'other_cost'];
const zeroCosts = () => ({ parts_cost: 0, engineer_cost: 0, travel_cost: 0, other_cost: 0 });
const quote = (changes = {}) => ({ currency: 'CNY', quoted_amount: 100000, costs: zeroCosts(), ...changes });

test('business quote calculates direct costs and gross profit in the quote currency integer units', () => {
  assert.deepEqual(calculateBusinessQuoteEstimate({
    currency: 'CNY',
    quoted_amount: 100000,
    costs: { parts_cost: 20000, engineer_cost: 30000, travel_cost: 10000, other_cost: 0 },
  }), {
    value: {
      currency: 'CNY',
      quoted_amount: 100000,
      costs: { parts_cost: 20000, engineer_cost: 30000, travel_cost: 10000, other_cost: 0 },
      missing_costs: [],
      complete: true,
      known_cost_total: 60000,
      total_cost: 60000,
      estimated_gross_profit: 40000,
      estimated_gross_margin_bps: 4000,
    },
  });
});

test('business quote accepts CNY and USD without currency conversion', () => {
  for (const currency of ['CNY', 'USD']) {
    const { value } = calculateBusinessQuoteEstimate(quote({ currency }));
    assert.equal(value.currency, currency);
    assert.equal(value.total_cost, 0);
    assert.equal(value.estimated_gross_profit, 100000);
    assert.equal(value.estimated_gross_margin_bps, 10000);
    assert.equal(value.complete, true);
  }
});

test('business quote treats absent, undefined and null cost objects as fully unknown', () => {
  const absent = quote();
  delete absent.costs;
  for (const input of [absent, quote({ costs: undefined }), quote({ costs: null }), quote({ costs: {} })]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(input), { value: {
      currency: 'CNY', quoted_amount: 100000,
      costs: { parts_cost: null, engineer_cost: null, travel_cost: null, other_cost: null },
      missing_costs: COST_KEYS, complete: false, known_cost_total: 0,
      total_cost: null, estimated_gross_profit: null, estimated_gross_margin_bps: null,
    } });
  }
});

test('business quote keeps each missing cost unknown and retains explicitly entered zero', () => {
  for (const key of COST_KEYS) {
    for (const missing of ['absent', undefined, null]) {
      const costs = { parts_cost: 10, engineer_cost: 20, travel_cost: 30, other_cost: 40 };
      const expectedKnown = 100 - costs[key];
      if (missing === 'absent') delete costs[key];
      else costs[key] = missing;
      const { value } = calculateBusinessQuoteEstimate(quote({ costs }));
      assert.equal(value.costs[key], null);
      assert.deepEqual(value.missing_costs, [key]);
      assert.equal(value.known_cost_total, expectedKnown);
      assert.equal(value.complete, false);
      assert.equal(value.total_cost, null);
      assert.equal(value.estimated_gross_profit, null);
      assert.equal(value.estimated_gross_margin_bps, null);
    }
  }
  const { value } = calculateBusinessQuoteEstimate(quote({ costs: { other_cost: null, engineer_cost: 0 } }));
  assert.deepEqual(value.missing_costs, ['parts_cost', 'travel_cost', 'other_cost']);
  assert.equal(value.costs.engineer_cost, 0);
});

test('business quote allows break-even and negative gross profit', () => {
  for (const [cost, profit, margin] of [[100000, 0, 0], [160000, -60000, -6000]]) {
    const { value } = calculateBusinessQuoteEstimate(quote({ costs: { ...zeroCosts(), parts_cost: cost } }));
    assert.equal(value.estimated_gross_profit, profit);
    assert.equal(value.estimated_gross_margin_bps, margin);
  }
});

test('business quote rounds gross margin to nearest basis point with ties away from zero', () => {
  for (const [amount, cost, margin] of [
    [20000, 19999, 1], [20000, 20001, -1],
    [20001, 20000, 0], [20001, 20002, 0],
    [19999, 19998, 1], [19999, 20000, -1],
    [20000, 19997, 2], [20000, 20003, -2],
    [3, 2, 3333], [3, 4, -3333],
  ]) {
    const { value } = calculateBusinessQuoteEstimate(quote({
      quoted_amount: amount, costs: { ...zeroCosts(), other_cost: cost },
    }));
    assert.equal(value.estimated_gross_margin_bps, margin, `amount=${amount}, cost=${cost}`);
  }
});

test('business quote preserves exact safe integer totals and profit near the upper limit', () => {
  const max = Number.MAX_SAFE_INTEGER;
  for (const [costs, total, profit, margin] of [
    [zeroCosts(), 0, max, 10000],
    [{ ...zeroCosts(), parts_cost: max }, max, 0, 0],
    [{ ...zeroCosts(), parts_cost: max - 1, engineer_cost: 1 }, max, 0, 0],
    [{ ...zeroCosts(), parts_cost: max - 1 }, max - 1, 1, 0],
  ]) {
    const { value } = calculateBusinessQuoteEstimate(quote({ quoted_amount: max, costs }));
    assert.equal(value.known_cost_total, total);
    assert.equal(value.total_cost, total);
    assert.equal(value.estimated_gross_profit, profit);
    assert.equal(value.estimated_gross_margin_bps, margin);
  }
  const { value } = calculateBusinessQuoteEstimate(quote({ quoted_amount: max, costs: { parts_cost: max } }));
  assert.equal(value.known_cost_total, max);
  assert.equal(value.total_cost, null);
});

test('business quote rejects aggregate cost overflow even while remaining costs are unknown', () => {
  for (const costs of [
    { ...zeroCosts(), parts_cost: Number.MAX_SAFE_INTEGER, engineer_cost: 1 },
    { parts_cost: Number.MAX_SAFE_INTEGER, engineer_cost: 1 },
    Object.fromEntries(COST_KEYS.map((key) => [key, Number.MAX_SAFE_INTEGER])),
  ]) assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs })), { code: 'business_quote_overflow' });
});

test('business quote rejects unsafe margin and preserves large safe margins exactly', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const safeCost = 900719925475;
  const { value } = calculateBusinessQuoteEstimate(quote({ quoted_amount: 1, costs: { ...zeroCosts(), other_cost: safeCost } }));
  assert.equal(value.estimated_gross_margin_bps, -9007199254740000);
  for (const cost of [safeCost + 1, max]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ quoted_amount: 1, costs: { ...zeroCosts(), other_cost: cost } })), {
      code: 'business_quote_overflow',
    });
  }
});

test('business quote rejects non-object and non-plain top-level inputs', () => {
  for (const input of [undefined, null, [], '', 'quote', 0, 1, true, false, 1n, Symbol('quote'), () => {}, new Date(), new Map(), Object.create({ currency: 'CNY' }), new (class Quote {})()]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(input), { code: 'business_quote_input_invalid' });
  }
});

test('business quote rejects unknown top-level keys including commission and platform fees', () => {
  for (const key of ['commission_rate', 'platform_fee', 'exchange_rate', 'tax_rate', 'total_cost', 'extra', '__proto__', 'constructor', Symbol('hidden')]) {
    assert.deepEqual(calculateBusinessQuoteEstimate({ ...quote(), [key]: 0 }), { code: 'business_quote_input_invalid' });
  }
});

test('business quote requires one of the exact supported currency strings', () => {
  for (const currency of [undefined, null, '', 'cny', 'usd', ' CNY', 'EUR', 'RMB', 0, true, {}, [], new String('CNY')]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ currency })), { code: 'business_quote_currency_invalid' });
  }
  const input = quote();
  delete input.currency;
  assert.deepEqual(calculateBusinessQuoteEstimate(input), { code: 'business_quote_currency_invalid' });
});

test('business quote requires a positive safe integer amount without coercion', () => {
  for (const quoted_amount of [undefined, null, 0, -0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '100000', '', true, false, [], {}, 1n, new Number(100000)]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ quoted_amount })), { code: 'business_quote_amount_invalid' });
  }
  const input = quote();
  delete input.quoted_amount;
  assert.deepEqual(calculateBusinessQuoteEstimate(input), { code: 'business_quote_amount_invalid' });
});

test('business quote rejects non-plain cost containers', () => {
  for (const costs of [[], '', 'costs', 0, false, true, 1n, Symbol('cost'), () => {}, new Date(), new Map(), Object.create({ parts_cost: 1 }), new (class Costs {})()]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs })), { code: 'business_quote_cost_invalid' });
  }
});

test('business quote rejects invalid cost primitives for every cost category', () => {
  for (const key of COST_KEYS) {
    for (const invalid of [-1, 0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '0', '', true, false, [], {}, 0n, Symbol('cost'), () => {}, new Number(0)]) {
      assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs: { ...zeroCosts(), [key]: invalid } })), { code: 'business_quote_cost_invalid' });
    }
  }
});

test('business quote rejects unknown cost keys', () => {
  for (const key of ['commission_rate', 'platform_fee', 'tax', 'total_cost', 'extra', '__proto__', 'constructor', Symbol('cost')]) {
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs: { ...zeroCosts(), [key]: 0 } })), { code: 'business_quote_cost_invalid' });
  }
});

test('business quote rejects accessors without invoking them and rejects hidden properties', () => {
  let reads = 0;
  for (const descriptor of [
    { enumerable: true, get() { reads += 1; return 100000; } },
    { enumerable: false, value: 100000 },
  ]) {
    const input = Object.defineProperty(quote(), 'quoted_amount', descriptor);
    assert.deepEqual(calculateBusinessQuoteEstimate(input), { code: 'business_quote_input_invalid' });
    const costs = Object.defineProperty(zeroCosts(), 'parts_cost', descriptor);
    assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs })), { code: 'business_quote_cost_invalid' });
  }
  assert.equal(reads, 0);
});

test('business quote rejects cyclic data with stable errors', () => {
  const input = quote();
  input.extra = input;
  assert.deepEqual(calculateBusinessQuoteEstimate(input), { code: 'business_quote_input_invalid' });
  const costs = zeroCosts();
  costs.parts_cost = costs;
  assert.deepEqual(calculateBusinessQuoteEstimate(quote({ costs })), { code: 'business_quote_cost_invalid' });
});

test('business quote accepts plain null-prototype data objects', () => {
  const input = Object.assign(Object.create(null), quote({ costs: Object.assign(Object.create(null), zeroCosts()) }));
  assert.deepEqual(calculateBusinessQuoteEstimate(input), { value: {
    currency: 'CNY', quoted_amount: 100000, costs: zeroCosts(),
    missing_costs: [], complete: true, known_cost_total: 0,
    total_cost: 0, estimated_gross_profit: 100000, estimated_gross_margin_bps: 10000,
  } });
});

test('business quote never mutates or aliases frozen input costs', () => {
  const costs = Object.freeze({ parts_cost: 1, engineer_cost: undefined, other_cost: null });
  const input = Object.freeze(quote({ costs }));
  const { value } = calculateBusinessQuoteEstimate(input);
  assert.equal(costs.engineer_cost, undefined);
  assert.equal(Object.hasOwn(costs, 'travel_cost'), false);
  assert.notEqual(value.costs, costs);
  value.costs.parts_cost = 999;
  value.missing_costs.push('extra');
  assert.equal(costs.parts_cost, 1);
  assert.deepEqual(calculateBusinessQuoteEstimate(input).value.missing_costs, ['engineer_cost', 'travel_cost', 'other_cost']);
});
