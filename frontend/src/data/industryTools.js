export const materialDensities = {
  carbon_steel: { label: 'Carbon steel', densityKgM3: 7850, priceUsdPerTon: 760 },
  stainless_steel: { label: 'Stainless steel 304', densityKgM3: 7930, priceUsdPerTon: 2850 },
  aluminum: { label: 'Aluminum 6061', densityKgM3: 2700, priceUsdPerTon: 2450 },
  brass: { label: 'Brass', densityKgM3: 8500, priceUsdPerTon: 6200 },
  copper: { label: 'Copper', densityKgM3: 8960, priceUsdPerTon: 9800 },
  red_copper: { label: 'Red copper / T2 copper', densityKgM3: 8890, priceUsdPerTon: 10200 },
  titanium_alloy: { label: 'Titanium alloy', densityKgM3: 4430, priceUsdPerTon: 18000 },
};

const materialDensityCn = {
  carbon_steel: { label: '碳钢' },
  stainless_steel: { label: '304 不锈钢' },
  aluminum: { label: '6061 铝合金' },
  brass: { label: '黄铜' },
  copper: { label: '铜' },
  red_copper: { label: '紫铜 / T2 铜' },
  titanium_alloy: { label: '钛合金' },
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

const shapeProfileCn = {
  sheet_plate: {
    label: '板材 / 平板',
    description: '用于板材、平板和矩形毛坯的理论重量估算。',
  },
  flat_bar: {
    label: '扁钢',
    description: '用于扁钢、矩形条料和带状材料的理论重量估算。',
  },
  round_bar: {
    label: '圆钢 / 圆棒',
    description: '用于实心圆钢、圆棒和轴类材料的理论重量估算。',
  },
  round_tube: {
    label: '圆管',
    description: '按外径和壁厚估算圆管、管材的理论重量。',
  },
  square_tube: {
    label: '方管 / 矩形管',
    description: '按外形尺寸和壁厚估算方管、矩形管的理论重量。',
  },
  angle: {
    label: '角钢',
    description: '用于等边或不等边角钢，并保留少量轧制圆角影响。',
  },
  channel: {
    label: '槽钢',
    description: '按腹板和两侧翼缘估算 U 型槽钢的理论重量。',
  },
  h_beam: {
    label: 'H 型钢 / 工字钢',
    description: '按腹板和两侧翼缘估算 H 型钢、工字钢的理论重量。',
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

const steelPriceReferencesCn = [
  {
    label: '美国热轧卷板期货',
    value: 'CME HRC 期货',
    note: '用于观察美国热轧卷板价格趋势的交易所参考。',
    url: 'https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html',
  },
  {
    label: '全球钢材参考',
    value: 'Trading Economics steel',
    note: '用于规划阶段参考。最终采购成本仍由供应商报价决定。',
    url: 'https://tradingeconomics.com/commodity/steel',
  },
  {
    label: '材料估算边界',
    value: '需要本地报价确认',
    note: '最终板材、运费和加工成本取决于供应商、牌号和地区。',
    url: '',
  },
];

export const assistGasOptions = {
  nitrogen: { label: 'Nitrogen', flowFactor: 0.034, speedFactor: 1.05 },
  oxygen: { label: 'Oxygen', flowFactor: 0.026, speedFactor: 0.78 },
  air: { label: 'Compressed air', flowFactor: 0.03, speedFactor: 0.92 },
};

const assistGasOptionsCn = {
  nitrogen: { label: '氮气' },
  oxygen: { label: '氧气' },
  air: { label: '压缩空气' },
};

export const dustLoadOptions = {
  light: { label: 'Light dust load', airflowFactor: 720 },
  medium: { label: 'Medium dust load', airflowFactor: 900 },
  heavy: { label: 'Heavy dust load', airflowFactor: 1120 },
};

const dustLoadOptionsCn = {
  light: { label: '轻粉尘负荷' },
  medium: { label: '中等粉尘负荷' },
  heavy: { label: '重粉尘负荷' },
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

const industryToolCn = {
  'metal-weight': {
    label: '材料重量计算器',
    shortLabel: '材料重量',
    description: '按材料密度和尺寸估算板材、管材、角钢、槽钢、型钢和棒材重量。',
    leadAction: '把理论重量作为规划参考，再结合切割、折弯、运输或设备承载能力继续判断。',
    seoTitle: '板材、管材、角钢、槽钢和型钢材料重量计算器',
    seoDescription: '按材料、型材和尺寸估算碳钢、不锈钢、铝、铜、黄铜、紫铜和钛合金的理论重量。',
    guideTitle: '在报价、切割、折弯或运输前先估算理论重量。',
    guideBody: '选择材料和型材，输入尺寸，把结果作为规划参考。轧制圆角、公差、涂层、牌号和供应商标准都会影响实际重量。',
    faqs: [
      ['为什么理论重量和供应商重量会不同？', '钢厂公差、圆角和型材标准会造成差异。请把这里的结果作为规划参考，并以材质证明或供应商表格确认。'],
      ['可以计算角钢和槽钢吗？', '可以。选择角钢或槽钢后，输入边长、翼缘、腹板和厚度等尺寸即可估算。'],
    ],
  },
  'steel-price': {
    label: '钢材价格预算工具',
    shortLabel: '钢材预算',
    description: '结合型材重量、参考单价和市场信息，估算材料预算。',
    leadAction: '把市场参考作为背景信息，采购前仍需确认本地供应商报价。',
    seoTitle: '钢材和金属材料价格预算工具',
    seoDescription: '按常见金属和型材的理论重量、每吨参考价，估算规划阶段的材料预算。',
    guideTitle: '把材料参考单价转换成粗略采购预算。',
    guideBody: '这个工具把型材理论重量和每吨参考价结合起来，适合早期规划。最终采购成本仍由供应商报价决定。',
    faqs: [
      ['这是实时钢材报价吗？', '这是用于规划的市场参考。牌号、形状、地区、运费、税费和供应商起订量都会影响最终成本。'],
      ['可以估算非钢材吗？', '可以。材料列表包含不锈钢、铝、黄铜、铜、紫铜和钛合金。'],
    ],
  },
  'laser-cost': {
    label: '激光切割成本计算器',
    shortLabel: '切割成本',
    description: '按切割长度、穿孔数量、设备小时费率、辅助气体和调机时间估算切割成本。',
    leadAction: '用于比较外协加工、自有产能和设备投资的早期假设，不绑定任何供应商。',
    seoTitle: '激光切割成本计算器',
    seoDescription: '按切割长度、切割速度、穿孔数量、设备小时费率、辅助气体和调机时间估算激光切割成本。',
    guideTitle: '在报价或产能比较前估算切割时间和车间成本。',
    guideBody: '请把结果用于规划。排版、搬运、辅助气体压力、去毛刺、废料和人工费率都会改变最终价格。',
    faqs: [
      ['激光切割成本主要受什么影响？', '通常由切割长度、切割速度、穿孔数量、气体使用、调机时间、搬运和本地小时费率共同决定。'],
      ['能比较外协和购买设备吗？', '可以作为早期比较参考。设备投资还需要考虑利用率、维护、融资、场地和操作人员能力。'],
    ],
  },
  'press-brake-tonnage': {
    label: '折弯机吨位计算器',
    shortLabel: '折弯吨位',
    description: '按材料、厚度、折弯长度和 V 槽开口估算折弯所需吨位。',
    leadAction: '用于初步检查设备能力；当余量较小时建议由工程师复核。',
    seoTitle: '折弯机吨位计算器',
    seoDescription: '按材料系数、板厚、折弯长度、V 槽开口和安全系数估算空气折弯吨位。',
    guideTitle: '生产前检查折弯机能力是否有足够余量。',
    guideBody: '这个空气折弯估算用于识别能力风险。生产前仍需确认模具、模具状态、折弯半径、材料抗拉强度和设备额定能力。',
    faqs: [
      ['V 槽开口应该怎么选？', '低碳钢空气折弯常用板厚约 8 倍作为起点，再按半径、模具和材料调整。'],
      ['什么时候需要工程师复核？', '当估算值接近设备能力、材料强度较高，或需要特殊模具时，建议先复核。'],
    ],
  },
  'gas-consumption': {
    label: '辅助气体用量计算器',
    shortLabel: '气体用量',
    description: '按喷嘴、压力、切割时间和占空比估算氮气、氧气或压缩空气用量。',
    leadAction: '用于比较辅助气体假设，再结合供应商单价或生产记录确认。',
    seoTitle: '激光切割辅助气体用量计算器',
    seoDescription: '按喷嘴直径、压力、切割时间、占空比和气体单价估算激光切割辅助气体用量与成本。',
    guideTitle: '在报价或核算运行成本前估算辅助气体用量。',
    guideBody: '输入喷嘴尺寸、压力、切割时间和气体单价，形成规划参考。实际消耗取决于减压阀设置、喷嘴状态、穿孔策略、泄漏和设备控制方式。',
    faqs: [
      ['这个结果能当作气体账单吗？', '它是规划参考。用于采购前，请结合流量计数据、气体供应商账单或设备记录确认。'],
      ['为什么喷嘴尺寸影响很大？', '喷嘴开口变大后，尤其在较高压力下，流量会明显增加。喷嘴状态和离焦距离也会影响实际用量。'],
    ],
  },
  'cutting-speed': {
    label: '激光切割速度参考',
    shortLabel: '切割速度',
    description: '按材料、厚度、辅助气体和激光功率对比规划阶段的速度范围。',
    leadAction: '用于检查节拍假设，再结合设备参数表和试切结果确认。',
    seoTitle: '按材料、厚度、气体和功率查询激光切割速度参考',
    seoDescription: '按材料、厚度、辅助气体和光纤激光功率获取激光切割速度规划参考。',
    guideTitle: '在查看设备参数前先形成第一版切割速度范围。',
    guideBody: '这个参考用于早期规划。实际速度取决于设备动态性能、光束质量、切割头、喷嘴、气体纯度、材料表面和边缘质量要求。',
    faqs: [
      ['可以直接作为最终切割参数吗？', '只能作为粗略范围。最终参数应来自设备试切、厂家参数表和可接受的边缘质量。'],
      ['为什么辅助气体会改变范围？', '氧气、氮气和压缩空气的切割反应、边缘质量和热输入不同，因此速度范围也会变化。'],
    ],
  },
  'bend-allowance': {
    label: 'V 槽和折弯展开辅助工具',
    shortLabel: '折弯展开',
    description: '整理 V 槽开口、内 R、折弯角度、K 因子和平板展开假设。',
    leadAction: '用于在排版、报价或工程师复核前记录折弯假设。',
    seoTitle: '折弯 V 槽和展开长度辅助工具',
    seoDescription: '按板厚、内 R、折弯角度、K 因子、折弯次数和边长估算 V 槽开口、折弯补偿和展开长度参考。',
    guideTitle: '下发展开图前检查折弯补偿假设。',
    guideBody: '这个工具计算规划阶段的折弯补偿和常用 V 槽起点。实际展开取决于模具、材料抗拉强度、轧制方向、折弯方式和车间校准数据。',
    faqs: [
      ['K 因子应该怎么选？', '空气折弯常用规划范围约 0.33 到 0.45，但应以车间标准或实测折弯数据为准。'],
      ['8 倍板厚一定是合适的 V 槽吗？', '它是低碳钢常见起点。半径、吨位、模具和材料可能要求不同开口。'],
    ],
  },
  'equipment-roi': {
    label: '设备投资回报计算器',
    shortLabel: '设备 ROI',
    description: '比较外协成本、自有运行成本、新增收入、前期投入和简单回收期。',
    leadAction: '用于整理投资取舍，不依赖单一供应商说法。',
    seoTitle: '激光切割设备投资回报计算器',
    seoDescription: '在比较外协加工和自购激光切割设备时，估算月度净影响和简单回收期。',
    guideTitle: '询价前先比较设备投资假设。',
    guideBody: '这个计算器比较月度外协支出和自有设备的月供、人工、维护、水电以及新增收入。它是规划模型，不是融资报价。',
    faqs: [
      ['自有成本应该包含什么？', '尽量包含设备月供或折旧、操作人员、维护、水电、气体、易损件、场地和编程时间。'],
      ['为什么要包含新增收入？', '有些工厂采购设备不仅是替代外协，也希望获得更快交期或更高毛利的订单。'],
    ],
  },
  'auxiliary-sizing': {
    label: '冷水机和除尘器选型参考',
    shortLabel: '辅机选型',
    description: '按激光功率、台面尺寸、工作时长和粉尘负荷估算冷却能力与除尘风量参考。',
    leadAction: '用于改造、搬迁或扩产前整理辅机需求清单。',
    seoTitle: '激光冷水机和除尘器选型检查表',
    seoDescription: '按激光功率、台面尺寸、工作时长和粉尘负荷估算激光切割设备的冷水机能力和除尘风量参考。',
    guideTitle: '在改造或扩产前整理辅机需求。',
    guideBody: '这个参考帮助早期检查冷却和烟尘处理需求。最终选型应结合设备手册、管道布局、当地规范、材料组合和合格供应商确认。',
    faqs: [
      ['可以替代供应商选型计算吗？', '不可以。它用于准备沟通并发现明显缺口，正式选型仍需供应商或工程人员确认。'],
      ['为什么台面面积会影响除尘？', '切割区域越大、粉尘负荷越高，通常需要更高捕集风量和更合理的管道规划。'],
    ],
  },
};

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

function isCn(locale) {
  return locale === 'zh-CN';
}

function localizeOptionMap(options, overlays, locale) {
  if (!isCn(locale)) return options;
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, { ...value, ...(overlays[key] || {}) }]),
  );
}

export function getLocalizedTool(tool, locale = 'en') {
  if (!tool || !isCn(locale)) return tool;
  return { ...tool, ...(industryToolCn[tool.id] || {}) };
}

export function getLocalizedMaterialDensities(locale = 'en') {
  return localizeOptionMap(materialDensities, materialDensityCn, locale);
}

export function getLocalizedShapeProfiles(locale = 'en') {
  return localizeOptionMap(shapeProfiles, shapeProfileCn, locale);
}

export function getLocalizedAssistGasOptions(locale = 'en') {
  return localizeOptionMap(assistGasOptions, assistGasOptionsCn, locale);
}

export function getLocalizedDustLoadOptions(locale = 'en') {
  return localizeOptionMap(dustLoadOptions, dustLoadOptionsCn, locale);
}

export function getLocalizedSteelPriceReferences(locale = 'en') {
  return isCn(locale) ? steelPriceReferencesCn : steelPriceReferences;
}

function materialOption(key, locale = 'en') {
  const localized = getLocalizedMaterialDensities(locale);
  return localized[key] || localized.carbon_steel;
}

function shapeOption(key, locale = 'en') {
  const localized = getLocalizedShapeProfiles(locale);
  return localized[key] || localized.sheet_plate;
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

export function calculateProfileWeight(values, locale = 'en') {
  const material = materialOption(values.material, locale);
  const shape = shapeOption(values.shape, locale);
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

function calculateMetalWeight(values, locale = 'en') {
  const profile = calculateProfileWeight(values, locale);

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

function calculateSteelPrice(values, locale = 'en') {
  const profile = calculateProfileWeight(values, locale);
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

function assistGasOption(key, locale = 'en') {
  const localized = getLocalizedAssistGasOptions(locale);
  return localized[key] || localized.nitrogen;
}

function dustLoadOption(key, locale = 'en') {
  const localized = getLocalizedDustLoadOptions(locale);
  return localized[key] || localized.medium;
}

function calculateGasConsumption(values, locale = 'en') {
  const gas = assistGasOption(values.assistGas, locale);
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

function calculateCuttingSpeed(values, locale = 'en') {
  const material = materialOption(values.material, locale);
  const gas = assistGasOption(values.assistGas, locale);
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

function calculateAuxiliarySizing(values, locale = 'en') {
  const laserPowerKw = parsePositiveNumber(values.laserPowerKw, 3);
  const tableLengthM = parsePositiveNumber(values.tableLengthMm, 3000) / 1000;
  const tableWidthM = parsePositiveNumber(values.tableWidthMm, 1500) / 1000;
  const cuttingHoursDay = parsePositiveNumber(values.cuttingHoursDay, 8);
  const dustLoad = dustLoadOption(values.dustLoad, locale);
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

const calculationCn = {
  'metal-weight': {
    title: '材料理论重量估算',
    rows: ['材料', '型材', '截面积', '总长度', '总重量', '材料参考价值'],
    note: '这是规划参考用的理论重量。轧制圆角、公差、涂层、牌号和供应商起订量都会影响实际数值。',
  },
  'steel-price': {
    title: '材料预算参考',
    rows: ['材料', '型材', '理论重量', '参考单价', '材料预算估算'],
    note: '用于规划阶段的市场参考。最终采购成本由供应商报价决定，采购前请确认牌号、公差、运费、税费和本地供应情况。',
  },
  'laser-cost': {
    title: '激光切割成本估算',
    rows: ['切割时间', '穿孔时间', '总机时', '成本估算'],
    note: '这是规划估算。排版、材料搬运、辅助气体压力、废料、去毛刺和本地人工费率都会改变最终价格。',
  },
  'press-brake-tonnage': {
    title: '折弯吨位估算',
    rows: ['所需吨位', '含安全余量', '建议 V 槽开口', '公式基础'],
    values: { 'Air bending estimate for mild steel adjusted by material factor': '低碳钢空气折弯估算，并按材料系数调整' },
    note: '生产前请确认模具、模具状态、折弯半径、材料抗拉强度和设备额定能力。',
  },
  'gas-consumption': {
    title: '辅助气体用量估算',
    rows: ['辅助气体', '估算流量', '有效切割时间', '估算用量', '气体成本估算'],
    note: '仅作为规划参考。喷嘴状态、穿孔、泄漏、减压阀设置、气体纯度和设备控制方式都会影响实际消耗。',
  },
  'cutting-speed': {
    title: '切割速度范围参考',
    rows: ['材料', '辅助气体', '厚度', '激光功率', '参考范围'],
    note: '请作为粗略规划范围使用。边缘质量、设备动态、喷嘴、焦点、气体纯度和材料表面决定最终切割参数。',
  },
  'bend-allowance': {
    title: '折弯展开估算',
    rows: ['建议 V 槽开口', '折弯补偿', '展开长度参考', 'K 因子'],
    note: '仅作为规划参考。请结合车间试折、实际模具、材料抗拉强度、轧制方向和公差要求验证。',
  },
  'equipment-roi': {
    title: '设备投资回报估算',
    rows: ['当前外协支出', '自有运行成本估算', '新增收入假设', '月度净影响', '简单回收期'],
    values: { 'No positive payback in this scenario': '当前假设下没有正向回收期' },
    note: '仅为规划模型。融资、利用率、残值、维护风险、操作人员、场地和材料搬运都会改变投资判断。',
  },
  'auxiliary-sizing': {
    title: '辅机选型参考',
    rows: ['激光功率', '台面面积', '冷水机能力参考', '除尘风量参考', '粉尘负荷'],
    note: '用于准备选型沟通。最终设备选择应依据设备手册、管道布局、当地规范、材料组合和供应商工程复核。',
  },
};

function localizeCalculationResult(toolId, result, locale) {
  if (!isCn(locale)) return result;
  const cn = calculationCn[toolId];
  if (!cn) return result;

  return {
    ...result,
    title: cn.title,
    rows: result.rows.map(([label, value], index) => [
      cn.rows[index] || label,
      cn.values?.[value] || value,
    ]),
    note: cn.note,
  };
}

export function calculateIndustryToolResult(toolId, values, locale = 'en') {
  let result;
  if (toolId === 'metal-weight') result = calculateMetalWeight(values, locale);
  else if (toolId === 'steel-price') result = calculateSteelPrice(values, locale);
  else if (toolId === 'laser-cost') result = calculateLaserCost(values);
  else if (toolId === 'press-brake-tonnage') result = calculatePressBrakeTonnage(values);
  else if (toolId === 'gas-consumption') result = calculateGasConsumption(values, locale);
  else if (toolId === 'cutting-speed') result = calculateCuttingSpeed(values, locale);
  else if (toolId === 'bend-allowance') result = calculateBendAllowance(values);
  else if (toolId === 'equipment-roi') result = calculateEquipmentRoi(values);
  else if (toolId === 'auxiliary-sizing') result = calculateAuxiliarySizing(values, locale);
  else result = calculateMetalWeight(values, locale);
  return localizeCalculationResult(toolId, result, locale);
}

export function buildIndustryToolReviewPrompt(tool, result) {
  const lines = result.rows.map(([label, value]) => `- ${label}: ${value}`).join('\n');
  return `Please review this ${tool.label} result as SAGEMRO AI.

${lines}

Explain what the result means, what assumptions may be risky, what information should be confirmed, and what practical next-step options the customer should consider. Keep the analysis neutral and do not push a vendor.`;
}
