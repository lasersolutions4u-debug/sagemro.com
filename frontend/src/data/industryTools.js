export const materialDensities = {
  carbon_steel: { label: 'Carbon steel', densityKgM3: 7850, priceUsdPerTon: 760 },
  stainless_steel: { label: 'Stainless steel 304', densityKgM3: 7930, priceUsdPerTon: 2850 },
  aluminum: { label: 'Aluminum 6061', densityKgM3: 2700, priceUsdPerTon: 2450 },
  brass: { label: 'Brass', densityKgM3: 8500, priceUsdPerTon: 6200 },
  copper: { label: 'Copper', densityKgM3: 8960, priceUsdPerTon: 9800 },
  red_copper: { label: 'Red copper / T2 copper', densityKgM3: 8890, priceUsdPerTon: 10200 },
  titanium_alloy: { label: 'Titanium alloy', densityKgM3: 4430, priceUsdPerTon: 18000 },
};

export const shapeProfiles = {
  sheet_plate: {
    label: 'Sheet / plate',
    fields: ['lengthMm', 'widthMm', 'thicknessMm'],
    description: 'Flat sheet, plate, and rectangular blank weight.',
  },
  flat_bar: {
    label: 'Flat bar',
    fields: ['lengthMm', 'widthMm', 'thicknessMm'],
    description: 'Flat steel bar and rectangular strip stock.',
  },
  round_bar: {
    label: 'Round bar',
    fields: ['lengthMm', 'diameterMm'],
    description: 'Solid round bar, rod, and shaft stock.',
  },
  round_tube: {
    label: 'Round tube / pipe',
    fields: ['lengthMm', 'outerDiameterMm', 'wallThicknessMm'],
    description: 'Round pipe and tube by outer diameter and wall thickness.',
  },
  square_tube: {
    label: 'Square / rectangular tube',
    fields: ['lengthMm', 'heightMm', 'widthMm', 'wallThicknessMm'],
    description: 'Square tube and rectangular tube by outer size and wall.',
  },
  angle: {
    label: 'Angle steel',
    fields: ['lengthMm', 'legAMm', 'legBMm', 'thicknessMm'],
    description: 'Equal or unequal angle profile with a small rolled-corner allowance.',
  },
  channel: {
    label: 'Channel steel',
    fields: ['lengthMm', 'heightMm', 'flangeWidthMm', 'webThicknessMm', 'flangeThicknessMm'],
    description: 'U channel estimate by web and two flanges.',
  },
  h_beam: {
    label: 'H / I beam',
    fields: ['lengthMm', 'heightMm', 'flangeWidthMm', 'webThicknessMm', 'flangeThicknessMm'],
    description: 'H beam and I beam estimate by web and two flanges.',
  },
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
    note: 'Market reference for planning. Supplier quotes decide final purchasing cost.',
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
    slug: 'metal-weight-calculator',
    label: 'Metal Weight Calculator',
    shortLabel: 'Metal Weight',
    description: 'Estimate sheet, plate, tube, angle, channel, beam, and bar weight from material density and dimensions.',
    leadAction: 'Use this weight to ask SAGEMRO AI about cutting, bending, freight, or machine capacity.',
    seoTitle: 'Metal Weight Calculator for Sheet, Tube, Angle, Channel, and Beam',
    seoDescription: 'Calculate theoretical metal weight for sheet, plate, round bar, tube, square tube, angle steel, channel steel, and H/I beam in carbon steel, stainless steel, aluminum, copper, brass, and titanium.',
    guideTitle: 'Calculate theoretical metal weight before quoting, cutting, bending, or shipping.',
    guideBody: 'Choose the material and profile, enter the dimensions, and use the result as a planning reference. Rolled corners, mill tolerance, coating, grade, and supplier standards can change actual weight.',
    faqs: [
      ['Why does theoretical weight differ from supplier weight?', 'Mills use tolerances and rounded profile geometry. Treat this result as a planning value and verify with the material certificate or supplier table.'],
      ['Can this calculate angle and channel steel?', 'Yes. Select Angle steel or Channel steel, then enter leg, flange, web, and thickness dimensions.'],
    ],
  },
  {
    id: 'steel-price',
    slug: 'steel-price-watch',
    label: 'Steel Price Watch',
    shortLabel: 'Steel Price',
    description: 'Estimate material budget from profile weight, material reference price, and market references.',
    leadAction: 'Use market references as context, then confirm local supplier pricing before purchase.',
    seoTitle: 'Steel and Metal Price Watch with Weight-Based Budget Calculator',
    seoDescription: 'Estimate a planning material budget for common metals and structural profiles using reference price per metric ton and calculated theoretical weight.',
    guideTitle: 'Turn a material reference price into a rough purchase budget.',
    guideBody: 'This tool combines profile weight with a reference price per metric ton. It is useful for early planning, but supplier quotes decide final purchasing cost.',
    faqs: [
      ['Is this a live steel quote?', 'It is a market reference for planning. Grade, shape, location, freight, tax, and supplier minimums decide the final cost.'],
      ['Can I estimate non-steel materials?', 'Yes. The material list includes stainless steel, aluminum, brass, copper, red copper, and titanium alloy.'],
    ],
  },
  {
    id: 'laser-cost',
    slug: 'laser-cutting-cost-calculator',
    label: 'Laser Cutting Cost Calculator',
    shortLabel: 'Laser Cost',
    description: 'Estimate cutting cost from cut length, pierces, machine rate, gas, and setup time.',
    leadAction: 'Compare outsourcing, in-house cutting, or equipment ROI without locking into a vendor.',
    seoTitle: 'Laser Cutting Cost Calculator',
    seoDescription: 'Estimate laser cutting cost from cut length, cutting speed, pierce count, machine hourly rate, assist gas, and setup time.',
    guideTitle: 'Estimate cutting time and shop cost before quoting or comparing capacity.',
    guideBody: 'Use the calculator for planning. Nesting, handling, assist gas pressure, deburring, scrap, and labor rates can change the final price.',
    faqs: [
      ['What matters most in laser cutting cost?', 'Cut length, cutting speed, pierce count, gas use, setup time, handling, and local hourly rate usually drive the estimate.'],
      ['Can this compare outsourcing and buying equipment?', 'It can support early comparison. For equipment investment, also check utilization, maintenance, financing, floor space, and operator capacity.'],
    ],
  },
  {
    id: 'press-brake-tonnage',
    slug: 'press-brake-tonnage-calculator',
    label: 'Press Brake Tonnage Calculator',
    shortLabel: 'Brake Tonnage',
    description: 'Estimate required press brake tonnage from material, thickness, length, and V die.',
    leadAction: 'Use the estimate to check machine capacity and ask for engineer review when margin is tight.',
    seoTitle: 'Press Brake Tonnage Calculator',
    seoDescription: 'Estimate press brake tonnage for air bending from material factor, thickness, bend length, V die opening, and safety margin.',
    guideTitle: 'Check press brake capacity before bending.',
    guideBody: 'This air-bending estimate helps identify capacity risk. Confirm tooling, die condition, bend radius, material tensile strength, and machine rating before production.',
    faqs: [
      ['What V die opening should I use?', 'A common starting point is about 8 times material thickness for mild steel, then adjust for radius, tooling, and material.'],
      ['When should an engineer review the bend?', 'Ask for review when the estimate is close to machine capacity, material is high strength, or the bend requires special tooling.'],
    ],
  },
];

export const defaultIndustryToolForms = {
  'metal-weight': {
    material: 'carbon_steel',
    shape: 'sheet_plate',
    lengthMm: '3000',
    widthMm: '1500',
    thicknessMm: '6',
    quantity: '1',
    diameterMm: '50',
    outerDiameterMm: '60',
    wallThicknessMm: '4',
    heightMm: '100',
    legAMm: '50',
    legBMm: '50',
    flangeWidthMm: '50',
    webThicknessMm: '6',
    flangeThicknessMm: '8',
  },
  'steel-price': {
    material: 'carbon_steel',
    shape: 'sheet_plate',
    lengthMm: '3000',
    widthMm: '1500',
    thicknessMm: '6',
    quantity: '1',
    diameterMm: '50',
    outerDiameterMm: '60',
    wallThicknessMm: '4',
    heightMm: '100',
    legAMm: '50',
    legBMm: '50',
    flangeWidthMm: '50',
    webThicknessMm: '6',
    flangeThicknessMm: '8',
    referenceUsdPerTon: '760',
  },
  'laser-cost': {
    cutLengthM: '120',
    cuttingSpeedMMin: '2.8',
    pierces: '80',
    pierceSeconds: '1.2',
    machineRateUsdHour: '55',
    gasRateUsdHour: '18',
    setupMinutes: '15',
  },
  'press-brake-tonnage': {
    materialFactor: '1',
    thicknessMm: '6',
    bendLengthMm: '3000',
    vDieMm: '48',
    safetyFactor: '1.2',
  },
};

export function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

export function parsePositiveNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getToolBySlug(slug) {
  return industryTools.find((tool) => tool.slug === slug) || null;
}

function materialOption(key) {
  return materialDensities[key] || materialDensities.carbon_steel;
}

function shapeOption(key) {
  return shapeProfiles[key] || shapeProfiles.sheet_plate;
}

function mm2ToM2(areaMm2) {
  return areaMm2 / 1_000_000;
}

export function calculateProfileAreaMm2(values) {
  const shape = values.shape || 'sheet_plate';
  const width = parsePositiveNumber(values.widthMm);
  const thickness = parsePositiveNumber(values.thicknessMm);
  const diameter = parsePositiveNumber(values.diameterMm);
  const outerDiameter = parsePositiveNumber(values.outerDiameterMm);
  const wall = parsePositiveNumber(values.wallThicknessMm);
  const height = parsePositiveNumber(values.heightMm);
  const legA = parsePositiveNumber(values.legAMm);
  const legB = parsePositiveNumber(values.legBMm);
  const flangeWidth = parsePositiveNumber(values.flangeWidthMm);
  const webThickness = parsePositiveNumber(values.webThicknessMm);
  const flangeThickness = parsePositiveNumber(values.flangeThicknessMm);

  if (shape === 'round_bar') return Math.PI * (diameter / 2) ** 2;

  if (shape === 'round_tube') {
    const innerDiameter = Math.max(outerDiameter - wall * 2, 0);
    return Math.PI * (outerDiameter ** 2 - innerDiameter ** 2) / 4;
  }

  if (shape === 'square_tube') {
    const innerWidth = Math.max(width - wall * 2, 0);
    const innerHeight = Math.max(height - wall * 2, 0);
    return width * height - innerWidth * innerHeight;
  }

  if (shape === 'angle') {
    return legA * thickness + legB * thickness - thickness ** 2 + thickness ** 2 * 0.2;
  }

  if (shape === 'channel') {
    const webHeight = Math.max(height - flangeThickness * 2, 0);
    return webHeight * webThickness + 2 * flangeWidth * flangeThickness;
  }

  if (shape === 'h_beam') {
    const webHeight = Math.max(height - flangeThickness * 2, 0);
    return webHeight * webThickness + 2 * flangeWidth * flangeThickness;
  }

  return width * thickness;
}

export function calculateProfileWeight(values) {
  const material = materialOption(values.material);
  const shape = shapeOption(values.shape);
  const areaMm2 = calculateProfileAreaMm2(values);
  const lengthM = parsePositiveNumber(values.lengthMm) / 1000;
  const quantity = parsePositiveNumber(values.quantity, 1);
  const weightKg = mm2ToM2(areaMm2) * lengthM * material.densityKgM3 * quantity;

  return {
    material,
    shape,
    areaMm2,
    lengthM,
    quantity,
    weightKg,
    priceUsd: (weightKg / 1000) * material.priceUsdPerTon,
  };
}

function calculateMetalWeight(values) {
  const profile = calculateProfileWeight(values);

  return {
    title: 'Estimated material weight',
    rows: [
      ['Material', profile.material.label],
      ['Profile', profile.shape.label],
      ['Cross-section area', `${roundNumber(profile.areaMm2, 2)} mm2`],
      ['Total length', `${roundNumber(profile.lengthM * profile.quantity, 2)} m`],
      ['Total weight', `${roundNumber(profile.weightKg, 2)} kg / ${roundNumber(profile.weightKg * 2.20462, 2)} lb`],
      ['Reference material value', `$${roundNumber(profile.priceUsd, 2)} USD`],
    ],
    note: 'This is theoretical weight for planning. Rolled corners, mill tolerance, coating, grade, and supplier minimums can change the real number.',
  };
}

function calculateSteelPrice(values) {
  const profile = calculateProfileWeight(values);
  const reference = parsePositiveNumber(values.referenceUsdPerTon, profile.material.priceUsdPerTon);
  const budget = (profile.weightKg / 1000) * reference;

  return {
    title: 'Reference material budget',
    rows: [
      ['Material', profile.material.label],
      ['Profile', profile.shape.label],
      ['Theoretical weight', `${roundNumber(profile.weightKg, 2)} kg / ${roundNumber(profile.weightKg / 1000, 4)} metric tons`],
      ['Reference price', `$${roundNumber(reference, 2)} USD / metric ton`],
      ['Estimated material budget', `$${roundNumber(budget, 2)} USD`],
    ],
    note: 'Market reference for planning. Supplier quotes decide final purchasing cost. Confirm grade, tolerance, freight, taxes, and local availability before purchasing.',
  };
}

function calculateLaserCost(values) {
  const cutLengthM = parsePositiveNumber(values.cutLengthM);
  const speed = parsePositiveNumber(values.cuttingSpeedMMin, 1);
  const pierces = parsePositiveNumber(values.pierces);
  const pierceSeconds = parsePositiveNumber(values.pierceSeconds);
  const machineRate = parsePositiveNumber(values.machineRateUsdHour);
  const gasRate = parsePositiveNumber(values.gasRateUsdHour);
  const setupMinutes = parsePositiveNumber(values.setupMinutes);
  const cuttingMinutes = cutLengthM / speed;
  const pierceMinutes = (pierces * pierceSeconds) / 60;
  const totalMinutes = cuttingMinutes + pierceMinutes + setupMinutes;
  const hourlyCost = machineRate + gasRate;
  const cost = (totalMinutes / 60) * hourlyCost;

  return {
    title: 'Estimated laser cutting cost',
    rows: [
      ['Cutting time', `${roundNumber(cuttingMinutes, 1)} min`],
      ['Pierce time', `${roundNumber(pierceMinutes, 1)} min`],
      ['Total machine time', `${roundNumber(totalMinutes, 1)} min`],
      ['Estimated cost', `$${roundNumber(cost, 2)} USD`],
    ],
    note: 'This is a planning estimate. Nesting, material handling, assist gas pressure, scrap, deburring, and local labor rates can change the final price.',
  };
}

function calculatePressBrakeTonnage(values) {
  const thicknessMm = parsePositiveNumber(values.thicknessMm);
  const bendLengthMm = parsePositiveNumber(values.bendLengthMm);
  const vDieMm = parsePositiveNumber(values.vDieMm, thicknessMm * 8);
  const materialFactor = parsePositiveNumber(values.materialFactor, 1);
  const safetyFactor = parsePositiveNumber(values.safetyFactor, 1.2);
  const thicknessIn = thicknessMm / 25.4;
  const lengthFt = bendLengthMm / 304.8;
  const vDieIn = vDieMm / 25.4;
  const requiredTons = ((575 * thicknessIn * thicknessIn * lengthFt) / vDieIn) * materialFactor;
  const withSafety = requiredTons * safetyFactor;

  return {
    title: 'Estimated press brake tonnage',
    rows: [
      ['Required tonnage', `${roundNumber(requiredTons, 1)} tons`],
      ['With safety margin', `${roundNumber(withSafety, 1)} tons`],
      ['Suggested V opening', `${roundNumber(vDieMm, 1)} mm`],
      ['Formula basis', 'Air bending estimate for mild steel adjusted by material factor'],
    ],
    note: 'Confirm tooling, die condition, bend radius, material tensile strength, and machine rating before production.',
  };
}

export function calculateIndustryToolResult(toolId, values) {
  if (toolId === 'metal-weight') return calculateMetalWeight(values);
  if (toolId === 'steel-price') return calculateSteelPrice(values);
  if (toolId === 'laser-cost') return calculateLaserCost(values);
  return calculatePressBrakeTonnage(values);
}

export function buildIndustryToolReviewPrompt(tool, result) {
  const lines = result.rows.map(([label, value]) => `- ${label}: ${value}`).join('\n');
  return `Please review this ${tool.label} result as SAGEMRO AI.

${lines}

Explain what the result means, what assumptions may be risky, what information should be confirmed, and what practical next-step options the customer should consider. Keep the analysis neutral and do not push a vendor.`;
}
