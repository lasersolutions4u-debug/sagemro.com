const COST_KEYS = ['parts_cost', 'engineer_cost', 'travel_cost', 'other_cost'];
const INPUT_KEYS = ['currency', 'quoted_amount', 'costs'];
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

function isPlainDataObject(value, allowedKeys) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return allowedKeys.includes(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  });
}

export function calculateBusinessQuoteEstimate(input) {
  if (!isPlainDataObject(input, INPUT_KEYS)) return { code: 'business_quote_input_invalid' };
  const { currency, quoted_amount: quotedAmount } = input;
  if (currency !== 'CNY' && currency !== 'USD') return { code: 'business_quote_currency_invalid' };
  if (!Number.isSafeInteger(quotedAmount) || quotedAmount <= 0) {
    return { code: 'business_quote_amount_invalid' };
  }
  const sourceCosts = input.costs ?? {};
  if (!isPlainDataObject(sourceCosts, COST_KEYS)) return { code: 'business_quote_cost_invalid' };

  const costs = {};
  const missingCosts = [];
  let knownCostTotal = 0n;
  for (const key of COST_KEYS) {
    const cost = Object.hasOwn(sourceCosts, key) ? sourceCosts[key] : null;
    if (cost === undefined || cost === null) {
      costs[key] = null;
      missingCosts.push(key);
    } else {
      if (!Number.isSafeInteger(cost) || cost < 0) return { code: 'business_quote_cost_invalid' };
      costs[key] = cost;
      knownCostTotal += BigInt(cost);
    }
  }
  if (knownCostTotal > MAX_SAFE_INTEGER) return { code: 'business_quote_overflow' };

  const complete = missingCosts.length === 0;
  let grossProfit = null;
  let grossMarginBps = null;
  if (complete) {
    const amount = BigInt(quotedAmount);
    const profit = amount - knownCostTotal;
    const numerator = (profit < 0n ? -profit : profit) * 10000n;
    const roundedMargin = numerator / amount + (numerator % amount * 2n >= amount ? 1n : 0n);
    if (roundedMargin > MAX_SAFE_INTEGER) return { code: 'business_quote_overflow' };
    grossProfit = Number(profit);
    grossMarginBps = Number(profit < 0n ? -roundedMargin : roundedMargin);
  }

  return {
    value: {
      currency,
      quoted_amount: quotedAmount,
      costs,
      missing_costs: missingCosts,
      complete,
      known_cost_total: Number(knownCostTotal),
      total_cost: complete ? Number(knownCostTotal) : null,
      estimated_gross_profit: grossProfit,
      estimated_gross_margin_bps: grossMarginBps,
    },
  };
}
