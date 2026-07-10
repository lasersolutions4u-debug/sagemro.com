export const materialDensities = {
  carbon_steel: { label: 'Carbon steel', densityKgM3: 7850, priceUsdPerTon: 760 },
  stainless_steel: { label: 'Stainless steel 304', densityKgM3: 7930, priceUsdPerTon: 2850 },
  aluminum: { label: 'Aluminum 6061', densityKgM3: 2700, priceUsdPerTon: 2450 },
  brass: { label: 'Brass', densityKgM3: 8500, priceUsdPerTon: 6200 },
  copper: { label: 'Copper', densityKgM3: 8960, priceUsdPerTon: 9800 },
};

export const steelPriceReferences = [
  {
    label: 'US HRC steel futures',
    value: 'CME HRC futures',
    note: 'Exchange-traded futures reference for US hot-rolled coil.',
    url: 'https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html',
  },
  {
    label: 'Global steel reference',
    value: 'Trading Economics steel',
    note: 'Market reference only, not a supplier quote.',
    url: 'https://tradingeconomics.com/commodity/steel',
  },
  {
    label: 'Material estimate basis',
    value: 'Local quote required',
    note: 'Final sheet, plate, freight, and cutting costs depend on supplier, grade, and region.',
    url: '',
  },
];

export const industryTools = [
  {
    id: 'metal-weight',
    label: 'Metal Weight Calculator',
    shortLabel: 'Metal Weight',
    description: 'Estimate sheet, plate, and bar weight from material density and dimensions.',
    leadAction: 'Use this weight to ask SAGEMRO AI about cutting, bending, freight, or machine capacity.',
  },
  {
    id: 'steel-price',
    label: 'Steel Price Watch',
    shortLabel: 'Steel Price',
    description: 'Check common steel market references before estimating material cost.',
    leadAction: 'Use market references as context, then confirm local supplier pricing before purchase.',
  },
  {
    id: 'laser-cost',
    label: 'Laser Cutting Cost Calculator',
    shortLabel: 'Laser Cost',
    description: 'Estimate cutting cost from cut length, pierces, machine rate, gas, and setup time.',
    leadAction: 'Compare outsourcing, in-house cutting, or equipment ROI without locking into a vendor.',
  },
  {
    id: 'press-brake-tonnage',
    label: 'Press Brake Tonnage Calculator',
    shortLabel: 'Brake Tonnage',
    description: 'Estimate required press brake tonnage from material, thickness, length, and V die.',
    leadAction: 'Use the estimate to check machine capacity and ask for engineer review when margin is tight.',
  },
];

export function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

export function parsePositiveNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

