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

export const assistGasOptions = {
  nitrogen: { label: 'Nitrogen', flowFactor: 0.034, speedFactor: 1.05 },
  oxygen: { label: 'Oxygen', flowFactor: 0.026, speedFactor: 0.78 },
  air: { label: 'Compressed air', flowFactor: 0.03, speedFactor: 0.92 },
};

export const dustLoadOptions = {
  light: { label: 'Light dust load', airflowFactor: 720 },
  medium: { label: 'Medium dust load', airflowFactor: 900 },
  heavy: { label: 'Heavy dust load', airflowFactor: 1120 },
};

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
  {
    id: 'gas-consumption',
    slug: 'laser-assist-gas-consumption-calculator',
    label: 'Assist Gas Consumption Calculator',
    shortLabel: 'Gas Use',
    description: 'Estimate nitrogen, oxygen, or compressed air consumption from nozzle, pressure, cutting time, and duty cycle.',
    leadAction: 'Use this to compare assist-gas assumptions before checking supplier rates or production records.',
    seoTitle: 'Laser Assist Gas Consumption Calculator',
    seoDescription: 'Estimate laser cutting assist gas consumption and cost for nitrogen, oxygen, or compressed air from nozzle diameter, pressure, cutting minutes, duty cycle, and gas price.',
    guideTitle: 'Estimate assist gas usage before quoting or checking operating cost.',
    guideBody: 'Enter nozzle size, pressure, cutting time, and gas price to create a planning reference. Real consumption depends on regulator setup, nozzle condition, piercing strategy, leaks, and machine controls.',
    faqs: [
      ['Is this a gas supplier bill estimate?', 'It is a planning reference. Verify with flowmeter data, gas supplier statements, or machine records before using it for purchasing.'],
      ['Why does nozzle size matter?', 'A larger nozzle opening can increase flow quickly, especially at higher pressures. Nozzle condition and standoff also affect actual use.'],
    ],
  },
  {
    id: 'cutting-speed',
    slug: 'laser-cutting-speed-reference',
    label: 'Laser Cutting Speed Reference',
    shortLabel: 'Cut Speed',
    description: 'Compare rough speed ranges by material, thickness, assist gas, and laser power for planning checks.',
    leadAction: 'Use the range to sanity-check cycle time before confirming with a machine parameter table.',
    seoTitle: 'Laser Cutting Speed Reference by Material, Thickness, Gas, and Power',
    seoDescription: 'Get a planning reference for laser cutting speed by material, thickness, assist gas, and fiber laser power.',
    guideTitle: 'Build a first-pass cutting speed range before checking machine parameters.',
    guideBody: 'This reference is for early planning. Actual speed depends on machine dynamics, beam quality, cutting head, nozzle, gas purity, material surface, and edge quality requirements.',
    faqs: [
      ['Can I use this as the final machine parameter?', 'Use it as a rough range only. Final parameters should come from machine tests, OEM tables, and acceptable edge quality.'],
      ['Why does gas change the range?', 'Oxygen, nitrogen, and compressed air create different cutting behavior, edge quality, and heat input.'],
    ],
  },
  {
    id: 'bend-allowance',
    slug: 'press-brake-v-die-bend-allowance-helper',
    label: 'V-die and Bend Allowance Helper',
    shortLabel: 'Bend Allowance',
    description: 'Connect V opening, inside radius, bend angle, K-factor, and flat pattern assumptions before production.',
    leadAction: 'Use this to document bend assumptions before nesting, quoting, or engineer review.',
    seoTitle: 'Press Brake V-die and Bend Allowance Helper',
    seoDescription: 'Estimate V-die opening, bend allowance, and flat length reference from material thickness, inside radius, bend angle, K-factor, bend count, and flange lengths.',
    guideTitle: 'Check bend allowance assumptions before releasing a flat pattern.',
    guideBody: 'The helper calculates a planning bend allowance and common V-die starting point. Real flat patterns depend on tooling, material tensile strength, grain direction, bend method, and shop calibration.',
    faqs: [
      ['What K-factor should I use?', 'A common planning range is about 0.33 to 0.45 for air bending, but your shop standard or measured bend data should decide.'],
      ['Is 8x thickness always the right V opening?', 'It is a common starting point for mild steel. Radius, tonnage, tooling, and material may require a different opening.'],
    ],
  },
  {
    id: 'equipment-roi',
    slug: 'laser-cutting-machine-roi-calculator',
    label: 'Equipment ROI Calculator',
    shortLabel: 'Equipment ROI',
    description: 'Compare outsourcing, in-house operating cost, added revenue, upfront cost, and simple payback.',
    leadAction: 'Use this to frame investment tradeoffs without relying on a single supplier claim.',
    seoTitle: 'Laser Cutting Machine ROI Calculator',
    seoDescription: 'Estimate monthly net impact and simple payback when comparing outsourced cutting with an in-house laser cutting machine.',
    guideTitle: 'Compare equipment investment assumptions before asking for quotes.',
    guideBody: 'This calculator compares monthly outsource spend with estimated in-house payment, operator, maintenance, utilities, and added revenue. It is a planning model, not a financing quote.',
    faqs: [
      ['What should I include in in-house cost?', 'Include machine payment or depreciation, operator time, maintenance, utilities, gas, consumables, floor space, and programming time when available.'],
      ['Why include added revenue?', 'Some shops buy equipment not only to replace outsourcing, but also to win faster-turnaround or higher-margin work.'],
    ],
  },
  {
    id: 'auxiliary-sizing',
    slug: 'laser-chiller-dust-collector-sizing-checklist',
    label: 'Chiller and Dust Collector Sizing',
    shortLabel: 'Auxiliary Sizing',
    description: 'Estimate chiller capacity and dust collector airflow reference from laser power, table size, hours, and dust load.',
    leadAction: 'Use this as a checklist before retrofit, relocation, or capacity expansion planning.',
    seoTitle: 'Laser Chiller and Dust Collector Sizing Checklist',
    seoDescription: 'Estimate reference chiller capacity and dust collector airflow for laser cutting equipment from laser power, table size, operating hours, and dust load.',
    guideTitle: 'Organize auxiliary-equipment requirements before retrofit or expansion.',
    guideBody: 'The reference helps structure early checks for cooling and fume extraction. Final sizing should be confirmed with equipment manuals, duct layout, local code, material mix, and qualified suppliers.',
    faqs: [
      ['Can this replace a supplier sizing calculation?', 'No. Use it to prepare the discussion and identify obvious gaps before requesting formal sizing.'],
      ['Why does table area matter for dust collection?', 'Larger cutting areas and heavier dust loads usually require higher capture airflow and better duct planning.'],
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
  'gas-consumption': {
    assistGas: 'nitrogen',
    nozzleDiameterMm: '2',
    pressureBar: '12',
    cuttingMinutes: '45',
    dutyCyclePercent: '70',
    gasCostUsdM3: '0.42',
  },
  'cutting-speed': {
    material: 'carbon_steel',
    assistGas: 'oxygen',
    thicknessMm: '6',
    laserPowerKw: '3',
  },
  'bend-allowance': {
    thicknessMm: '3',
    insideRadiusMm: '3',
    bendAngleDeg: '90',
    kFactor: '0.38',
    bendCount: '2',
    flangeAMm: '100',
    flangeBMm: '80',
  },
  'equipment-roi': {
    outsourceCostUsdMonth: '12000',
    machinePaymentUsdMonth: '4500',
    operatorCostUsdMonth: '3800',
    maintenanceUsdMonth: '700',
    utilitiesUsdMonth: '500',
    addedRevenueUsdMonth: '2500',
    upfrontCostUsd: '25000',
  },
  'auxiliary-sizing': {
    laserPowerKw: '6',
    tableLengthMm: '3000',
    tableWidthMm: '1500',
    cuttingHoursDay: '8',
    dustLoad: 'medium',
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

function assistGasOption(key) {
  return assistGasOptions[key] || assistGasOptions.nitrogen;
}

function dustLoadOption(key) {
  return dustLoadOptions[key] || dustLoadOptions.medium;
}

function calculateGasConsumption(values) {
  const gas = assistGasOption(values.assistGas);
  const nozzleDiameterMm = parsePositiveNumber(values.nozzleDiameterMm, 2);
  const pressureBar = parsePositiveNumber(values.pressureBar, 10);
  const cuttingMinutes = parsePositiveNumber(values.cuttingMinutes);
  const dutyCycle = parsePositiveNumber(values.dutyCyclePercent, 100) / 100;
  const gasCost = parsePositiveNumber(values.gasCostUsdM3);
  const effectiveMinutes = cuttingMinutes * Math.min(dutyCycle, 1);
  const flowM3Min = gas.flowFactor * nozzleDiameterMm ** 2 * pressureBar;
  const volumeM3 = flowM3Min * effectiveMinutes;
  const cost = volumeM3 * gasCost;

  return {
    title: 'Estimated assist gas consumption',
    rows: [
      ['Assist gas', gas.label],
      ['Estimated flow', `${roundNumber(flowM3Min, 2)} m3/min`],
      ['Effective cutting time', `${roundNumber(effectiveMinutes, 1)} min`],
      ['Estimated volume', `${roundNumber(volumeM3, 2)} m3`],
      ['Estimated gas cost', `$${roundNumber(cost, 2)} USD`],
    ],
    note: 'Planning reference only. Nozzle condition, piercing, leaks, regulator setup, gas purity, and machine controls can change actual consumption.',
  };
}

function calculateCuttingSpeed(values) {
  const material = materialOption(values.material);
  const gas = assistGasOption(values.assistGas);
  const thicknessMm = parsePositiveNumber(values.thicknessMm, 1);
  const laserPowerKw = parsePositiveNumber(values.laserPowerKw, 3);
  const materialFactors = {
    carbon_steel: 1,
    stainless_steel: 0.82,
    aluminum: 0.95,
    brass: 0.48,
    copper: 0.42,
    red_copper: 0.4,
    titanium_alloy: 0.36,
  };
  const materialFactor = materialFactors[values.material] || 1;
  const midpoint = Math.max(0.08, (laserPowerKw * 4.1 * materialFactor * gas.speedFactor) / thicknessMm ** 1.12);
  const low = midpoint * 0.72;
  const high = midpoint * 1.28;

  return {
    title: 'Reference cutting speed range',
    rows: [
      ['Material', material.label],
      ['Assist gas', gas.label],
      ['Thickness', `${roundNumber(thicknessMm, 2)} mm`],
      ['Laser power', `${roundNumber(laserPowerKw, 2)} kW`],
      ['Reference range', `${roundNumber(low, 2)}-${roundNumber(high, 2)} m/min`],
    ],
    note: 'Use this as a rough planning range. Edge quality, machine dynamics, nozzle, focus, gas purity, and material surface decide final cutting parameters.',
  };
}

function calculateBendAllowance(values) {
  const thicknessMm = parsePositiveNumber(values.thicknessMm);
  const insideRadiusMm = parsePositiveNumber(values.insideRadiusMm, thicknessMm);
  const bendAngleDeg = parsePositiveNumber(values.bendAngleDeg, 90);
  const kFactor = parsePositiveNumber(values.kFactor, 0.38);
  const bendCount = parsePositiveNumber(values.bendCount, 1);
  const flangeA = parsePositiveNumber(values.flangeAMm);
  const flangeB = parsePositiveNumber(values.flangeBMm);
  const suggestedV = thicknessMm * 8;
  const allowancePerBend = (Math.PI / 180) * bendAngleDeg * (insideRadiusMm + kFactor * thicknessMm);
  const totalAllowance = allowancePerBend * bendCount;
  const flatReference = flangeA + flangeB + totalAllowance;

  return {
    title: 'Estimated bend allowance',
    rows: [
      ['Suggested V opening', `${roundNumber(suggestedV, 1)} mm`],
      ['Bend allowance', `${roundNumber(totalAllowance, 2)} mm total / ${roundNumber(allowancePerBend, 2)} mm per bend`],
      ['Flat length reference', `${roundNumber(flatReference, 2)} mm`],
      ['K-factor', `${roundNumber(kFactor, 3)}`],
    ],
    note: 'Planning reference only. Validate with shop bend tests, actual tooling, material tensile strength, grain direction, and required tolerance.',
  };
}

function calculateEquipmentRoi(values) {
  const outsource = parsePositiveNumber(values.outsourceCostUsdMonth);
  const payment = parsePositiveNumber(values.machinePaymentUsdMonth);
  const operator = parsePositiveNumber(values.operatorCostUsdMonth);
  const maintenance = parsePositiveNumber(values.maintenanceUsdMonth);
  const utilities = parsePositiveNumber(values.utilitiesUsdMonth);
  const addedRevenue = parsePositiveNumber(values.addedRevenueUsdMonth);
  const upfront = parsePositiveNumber(values.upfrontCostUsd);
  const inHouseCost = payment + operator + maintenance + utilities;
  const netImpact = outsource - inHouseCost + addedRevenue;
  const payback = netImpact > 0 ? upfront / netImpact : 0;

  return {
    title: 'Estimated equipment ROI',
    rows: [
      ['Current outsource spend', `$${roundNumber(outsource, 2)} USD / month`],
      ['Estimated in-house cost', `$${roundNumber(inHouseCost, 2)} USD / month`],
      ['Added revenue assumption', `$${roundNumber(addedRevenue, 2)} USD / month`],
      ['Monthly net impact', `$${roundNumber(netImpact, 2)} USD`],
      ['Simple payback', netImpact > 0 ? `${roundNumber(payback, 1)} months` : 'No positive payback in this scenario'],
    ],
    note: 'Planning model only. Financing, utilization, resale value, maintenance risk, operator availability, floor space, and material handling can change the investment case.',
  };
}

function calculateAuxiliarySizing(values) {
  const laserPowerKw = parsePositiveNumber(values.laserPowerKw, 3);
  const tableLengthM = parsePositiveNumber(values.tableLengthMm, 3000) / 1000;
  const tableWidthM = parsePositiveNumber(values.tableWidthMm, 1500) / 1000;
  const cuttingHoursDay = parsePositiveNumber(values.cuttingHoursDay, 8);
  const dustLoad = dustLoadOption(values.dustLoad);
  const tableAreaM2 = tableLengthM * tableWidthM;
  const chillerKw = laserPowerKw * (cuttingHoursDay > 8 ? 1.45 : 1.25);
  const airflowM3H = tableAreaM2 * dustLoad.airflowFactor;
  const airflowCfm = airflowM3H * 0.58858;

  return {
    title: 'Auxiliary equipment sizing reference',
    rows: [
      ['Laser power', `${roundNumber(laserPowerKw, 2)} kW`],
      ['Table area', `${roundNumber(tableAreaM2, 2)} m2`],
      ['Chiller capacity reference', `${roundNumber(chillerKw, 1)} kW cooling class`],
      ['Dust collector airflow reference', `${roundNumber(airflowM3H, 0)} m3/h / ${roundNumber(airflowCfm, 0)} CFM`],
      ['Dust load', dustLoad.label],
    ],
    note: 'Use this to prepare a sizing discussion. Final equipment selection should follow machine manuals, duct layout, local code, material mix, and supplier engineering review.',
  };
}

export function calculateIndustryToolResult(toolId, values) {
  if (toolId === 'metal-weight') return calculateMetalWeight(values);
  if (toolId === 'steel-price') return calculateSteelPrice(values);
  if (toolId === 'laser-cost') return calculateLaserCost(values);
  if (toolId === 'press-brake-tonnage') return calculatePressBrakeTonnage(values);
  if (toolId === 'gas-consumption') return calculateGasConsumption(values);
  if (toolId === 'cutting-speed') return calculateCuttingSpeed(values);
  if (toolId === 'bend-allowance') return calculateBendAllowance(values);
  if (toolId === 'equipment-roi') return calculateEquipmentRoi(values);
  if (toolId === 'auxiliary-sizing') return calculateAuxiliarySizing(values);
  return calculateMetalWeight(values);
}

export function buildIndustryToolReviewPrompt(tool, result) {
  const lines = result.rows.map(([label, value]) => `- ${label}: ${value}`).join('\n');
  return `Please review this ${tool.label} result as SAGEMRO AI.

${lines}

Explain what the result means, what assumptions may be risky, what information should be confirmed, and what practical next-step options the customer should consider. Keep the analysis neutral and do not push a vendor.`;
}
