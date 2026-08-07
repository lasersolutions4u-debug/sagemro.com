import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  calculateIndustryToolResult,
  defaultIndustryToolForms,
  getLocalizedSteelPriceReferences,
  getToolBySlug,
  getToolWorkedExample,
  industryTools,
  materialDensities,
  publicIndustryTools,
  shapeProfiles,
} from '../src/data/industryTools.js';
import { getIndustryToolsPageState, getIndustryToolsSeoMetadata } from '../src/utils/industryToolsPage.js';

test('metal weight calculator covers common sheet and structural profiles', () => {
  const profileIds = Object.keys(shapeProfiles);

  assert.deepEqual(profileIds, [
    'sheet_plate',
    'flat_bar',
    'round_bar',
    'round_tube',
    'square_tube',
    'angle',
    'channel',
    'h_beam',
  ]);
  assert.match(shapeProfiles.angle.label, /Angle/);
  assert.match(shapeProfiles.channel.label, /Channel/);
  assert.match(shapeProfiles.h_beam.label, /H \/ I beam/);
});

test('material references cover steel, stainless, aluminum, copper, red copper, brass, and titanium', () => {
  assert.match(materialDensities.carbon_steel.label, /Carbon steel/);
  assert.match(materialDensities.stainless_steel.label, /Stainless steel/);
  assert.match(materialDensities.aluminum.label, /Aluminum/);
  assert.match(materialDensities.brass.label, /Brass/);
  assert.match(materialDensities.copper.label, /Copper/);
  assert.match(materialDensities.red_copper.label, /Red copper/);
  assert.match(materialDensities.titanium_alloy.label, /Titanium alloy/);
});

test('defensible calculators disclose formula, calculator-generated example, assumptions, limits, safety, review, and references', () => {
  const requiredTools = {
    'metal-weight': /Metal weight = cross-section area × length × density × quantity/,
    'laser-cost': /Laser cutting cost = total machine time × hourly rate \+ assist-gas cost/,
    'bend-allowance': /Bend allowance per bend = angle in radians × \(inside radius \+ K-factor × thickness\)/,
  };

  for (const [id, formula] of Object.entries(requiredTools)) {
    const tool = industryTools.find((item) => item.id === id);
    const evidence = tool?.seoEvidence;
    const example = getToolWorkedExample(tool);

    assert.equal(evidence?.indexable, true);
    assert.match(evidence?.formula || '', formula);
    assert.ok(evidence?.assumptions?.length >= 3);
    assert.ok(evidence?.limitations?.length >= 2);
    assert.match(evidence?.safetyBoundary || '', /production|purchasing|operation/i);
    assert.match(evidence?.reviewPrompt || '', /review/i);
    assert.ok(evidence?.references?.length >= 1);
    assert.deepEqual(example?.result, calculateIndustryToolResult(id, evidence.workedExample.inputs));
    assert.ok(example.result.rows.some(([, value]) => /kg|USD|tons|mm/.test(value)));
  }
});

test('only evidence-complete calculators are public while all other direct tools are noindex', () => {
  const publicIds = ['metal-weight', 'laser-cost', 'bend-allowance'];

  assert.deepEqual(publicIndustryTools.map((tool) => tool.id), publicIds);

  for (const tool of industryTools) {
    assert.equal(getToolBySlug(tool.slug)?.id, tool.id);
    if (publicIds.includes(tool.id)) assert.equal(tool.seoEvidence?.indexable, true);
    else assert.equal(tool.seoEvidence?.indexable, false);
  }
});

test('implementation-only press brake tonnage evidence cannot pass the publication gate', () => {
  const tool = industryTools.find((item) => item.id === 'press-brake-tonnage');

  assert.equal(tool?.seoEvidence?.indexable, false);
  assert.equal(publicIndustryTools.some((item) => item.id === tool?.id), false);
});

test('worked examples do not fall through to metal weight for unsupported tools', () => {
  assert.equal(getToolWorkedExample(null), null);
  assert.equal(getToolWorkedExample({ id: 'unsupported', seoEvidence: { workedExample: { inputs: {} } } }), null);
});

test('evidence review CTA follows safety boundary and calculator CTA is suppressed for evidence tools', () => {
  const page = readFileSync(new URL('../src/components/Tools/IndustryToolsPage.jsx', import.meta.url), 'utf8');
  const calculator = readFileSync(new URL('../src/components/Tools/IndustryToolCalculator.jsx', import.meta.url), 'utf8');
  const evidenceStart = page.indexOf('function ToolEvidence');
  const safetyIndex = page.indexOf('EvidenceBlock title={copy.safety}', evidenceStart);
  const reviewIndex = page.indexOf('onClick={onReview}', evidenceStart);

  assert.match(calculator, /showReviewCta = true/);
  assert.match(calculator, /showReviewCta && onSendMessage/);
  assert.match(page, /showReviewCta=\{!tool\.seoEvidence\?\.formula\}/);
  assert.match(page, /getIndustryToolsSeoMetadata/);
  assert.match(page, /robots: seoMetadata\.robots/);
  assert.ok(page.indexOf('<ToolEvidence', 0) < page.indexOf('{copy.faq}'));
  assert.ok(safetyIndex < reviewIndex);
  assert.match(page, /Ask SAGEMRO AI to review this result/);
  assert.match(page, /请 SAGEMRO AI 复核此结果/);
});

test('tool page headings allow long Chinese titles to wrap on mobile', () => {
  const page = readFileSync(new URL('../src/components/Tools/IndustryToolsPage.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(page, /<h1 className="[^"]*break-keep/);
  assert.equal((page.match(/<h1 className="[^"]*break-words/g) || []).length, 2);
});

test('heuristic reference tools remain directly available but not indexable', () => {
  for (const id of ['cutting-speed', 'auxiliary-sizing']) {
    const tool = industryTools.find((item) => item.id === id);
    assert.equal(tool?.seoEvidence?.indexable, false);
    assert.equal(getToolBySlug(tool.slug)?.id, id);
    assert.equal(publicIndustryTools.some((item) => item.id === id), false);
  }
});

test('metal weight calculator computes angle steel from profile dimensions', () => {
  const result = calculateIndustryToolResult('metal-weight', {
    ...defaultIndustryToolForms['metal-weight'],
    material: 'carbon_steel',
    shape: 'angle',
    legAMm: '50',
    legBMm: '50',
    thicknessMm: '5',
    lengthMm: '6000',
    quantity: '10',
  });

  assert.equal(result.title, 'Estimated material weight');
  assert.match(result.rows.find(([label]) => label === 'Profile')?.[1], /Angle/);
  assert.match(result.rows.find(([label]) => label === 'Total weight')?.[1], /226\.08 kg/);
  assert.match(result.note, /theoretical weight/i);
});

test('steel price calculator uses selected material and structural profile weight', () => {
  const result = calculateIndustryToolResult('steel-price', {
    ...defaultIndustryToolForms['steel-price'],
    material: 'titanium_alloy',
    shape: 'round_bar',
    diameterMm: '40',
    lengthMm: '1000',
    quantity: '5',
    referenceUsdPerTon: '18000',
  });

  assert.equal(result.title, 'Reference material budget');
  assert.match(result.rows.find(([label]) => label === 'Material')?.[1], /Titanium alloy/);
  assert.match(result.rows.find(([label]) => label === 'Profile')?.[1], /Round bar/);
  assert.match(result.rows.find(([label]) => label === 'Estimated material budget')?.[1], /USD/);
});

test('CN steel price calculator uses domestic references and CNY', () => {
  const references = getLocalizedSteelPriceReferences('zh-CN');
  const result = calculateIndustryToolResult('steel-price', {
    ...defaultIndustryToolForms['steel-price'],
    referenceCnyPerTon: '3600',
  }, 'zh-CN');

  assert.deepEqual(references.map((item) => item.url), [
    'https://www.mysteel.com/',
    'https://www.shfe.com.cn/',
    'https://www.chinaisa.org.cn/',
  ]);
  assert.match(result.rows.find(([label]) => label === '参考单价')?.[1], /CNY/);
  assert.match(result.rows.find(([label]) => label === '材料预算估算')?.[1], /CNY/);
  assert.doesNotMatch(result.rows.find(([label]) => label === '参考单价')?.[1] || '', /USD/);
});

test('industry tools keep the paused bend simulator registered but out of public discovery', () => {
  assert.equal(industryTools.length, 10);
  assert.equal(publicIndustryTools.length, 3);
  assert.equal(publicIndustryTools.some((tool) => tool.id === 'bend-simulator'), false);
  assert.equal(getToolBySlug('metal-weight-calculator').id, 'metal-weight');
  assert.equal(getToolBySlug('steel-price-watch').id, 'steel-price');
  assert.equal(getToolBySlug('laser-cutting-cost-calculator').id, 'laser-cost');
  assert.equal(getToolBySlug('press-brake-tonnage-calculator').id, 'press-brake-tonnage');
  assert.equal(getToolBySlug('laser-assist-gas-consumption-calculator').id, 'gas-consumption');
  assert.equal(getToolBySlug('laser-cutting-speed-reference').id, 'cutting-speed');
  assert.equal(getToolBySlug('press-brake-v-die-bend-allowance-helper').id, 'bend-allowance');
  assert.equal(getToolBySlug('laser-cutting-machine-roi-calculator').id, 'equipment-roi');
  assert.equal(getToolBySlug('laser-chiller-dust-collector-sizing-checklist').id, 'auxiliary-sizing');
  const bendSimulator = getToolBySlug('bend-simulator');
  assert.equal(bendSimulator.id, 'bend-simulator');
  assert.match(bendSimulator.label, /Bend Simulator/);
  assert.match(bendSimulator.seoTitle, /Bend Simulator/);
  assert.match(bendSimulator.leadAction, /engineer/i);
  assert.equal(bendSimulator.faqs.length, 2);
  assert.equal(getToolBySlug('missing-tool'), null);
});

test('industry tools resolve hub and bend simulator routes with localized canonical SEO URLs', () => {
  const bendSimulator = getIndustryToolsPageState('/tools/bend-simulator', 'en');
  const bendSimulatorCn = getIndustryToolsPageState('/tools/bend-simulator', 'zh-CN');
  const hub = getIndustryToolsPageState('/tools', 'en');

  assert.equal(getToolBySlug('/tools/bend-simulator').id, 'bend-simulator');
  assert.equal(bendSimulator.page, 'bend-simulator');
  assert.equal(bendSimulator.selectedTool.id, 'bend-simulator');
  assert.equal(bendSimulator.canonical, 'https://sagemro.com/tools/bend-simulator');
  assert.equal(bendSimulatorCn.page, 'bend-simulator');
  assert.match(bendSimulatorCn.selectedTool.label, /折弯/);
  assert.equal(bendSimulatorCn.canonical, 'https://sagemro.cn/tools/bend-simulator');
  assert.equal(hub.slug, '');
  assert.equal(hub.page, 'hub');
  assert.equal(hub.selectedTool, null);
  assert.equal(hub.canonical, 'https://sagemro.com/tools');
});

test('unknown tool metadata keeps the requested path noindex without inheriting hub schema', () => {
  for (const [locale, host] of [['en', 'https://sagemro.com'], ['zh-CN', 'https://sagemro.cn']]) {
    for (const path of ['/tools/not-a-tool', '/tools/not-a-tool/extra', '/tools//', '/tools/metal-weight-calculator//']) {
      const route = getIndustryToolsPageState(path, locale);
      const metadata = getIndustryToolsSeoMetadata(route, locale);

      assert.equal(route.page, 'not-found');
      assert.equal(metadata.canonical, `${host}${path}`);
      assert.deepEqual(metadata.alternates, {
        en: `https://sagemro.com${path}`,
        'zh-CN': `https://sagemro.cn${path}`,
        'x-default': `https://sagemro.com${path}`,
      });
      assert.equal(metadata.robots, 'noindex,nofollow,noarchive');
      assert.equal(metadata.structuredData, null);
    }

    const hub = getIndustryToolsSeoMetadata(getIndustryToolsPageState('/tools', locale), locale);
    const publicTool = getIndustryToolsSeoMetadata(getIndustryToolsPageState('/tools/metal-weight-calculator', locale), locale);
    const noindexTool = getIndustryToolsSeoMetadata(getIndustryToolsPageState('/tools/steel-price-watch', locale), locale);
    const pausedTool = getIndustryToolsSeoMetadata(getIndustryToolsPageState('/tools/bend-simulator', locale), locale);

    assert.equal(hub.structuredData['@graph'][0]['@type'], 'CollectionPage');
    assert.equal(hub.robots, 'index,follow');
    assert.equal(publicTool.structuredData['@graph'][0]['@type'], 'WebApplication');
    assert.equal(publicTool.robots, 'index,follow');
    assert.equal(noindexTool.structuredData['@graph'][0]['@type'], 'WebApplication');
    assert.equal(noindexTool.robots, 'noindex,nofollow,noarchive');
    assert.equal(pausedTool.structuredData, null);
    assert.equal(pausedTool.robots, 'noindex,nofollow,noarchive');
  }
});

test('gas consumption calculator estimates assist gas usage and cost', () => {
  const result = calculateIndustryToolResult('gas-consumption', {
    ...defaultIndustryToolForms['gas-consumption'],
    assistGas: 'nitrogen',
    nozzleDiameterMm: '2',
    pressureBar: '12',
    cuttingMinutes: '45',
    dutyCyclePercent: '70',
    gasCostUsdM3: '0.42',
  });

  assert.equal(result.title, 'Estimated assist gas consumption');
  assert.match(result.rows.find(([label]) => label === 'Assist gas')?.[1], /Nitrogen/);
  assert.match(result.rows.find(([label]) => label === 'Estimated volume')?.[1], /m3/);
  assert.match(result.rows.find(([label]) => label === 'Estimated gas cost')?.[1], /\$/);
});

test('cutting speed reference returns a material and power based range', () => {
  const result = calculateIndustryToolResult('cutting-speed', {
    ...defaultIndustryToolForms['cutting-speed'],
    material: 'carbon_steel',
    assistGas: 'oxygen',
    thicknessMm: '6',
    laserPowerKw: '3',
  });

  assert.equal(result.title, 'Reference cutting speed range');
  assert.match(result.rows.find(([label]) => label === 'Material')?.[1], /Carbon steel/);
  assert.match(result.rows.find(([label]) => label === 'Reference range')?.[1], /m\/min/);
});

test('bend allowance helper calculates bend allowance and flat length reference', () => {
  const result = calculateIndustryToolResult('bend-allowance', {
    ...defaultIndustryToolForms['bend-allowance'],
    thicknessMm: '3',
    insideRadiusMm: '3',
    bendAngleDeg: '90',
    kFactor: '0.38',
    bendCount: '2',
    flangeAMm: '100',
    flangeBMm: '80',
  });

  assert.equal(result.title, 'Estimated bend allowance');
  assert.match(result.rows.find(([label]) => label === 'Bend allowance')?.[1], /mm/);
  assert.match(result.rows.find(([label]) => label === 'Flat length reference')?.[1], /mm/);
});

test('press brake tonnage calculator retains its planning result format', () => {
  const result = calculateIndustryToolResult('press-brake-tonnage', {
    ...defaultIndustryToolForms['press-brake-tonnage'],
    thicknessMm: '6',
    bendLengthMm: '3000',
    vDieMm: '48',
    materialFactor: '1',
    safetyFactor: '1.2',
  });

  assert.equal(result.title, 'Estimated press brake tonnage');
  assert.deepEqual(result.rows, [
    ['Required tonnage', '167.1 tons'],
    ['With safety margin', '200.5 tons'],
    ['Suggested V opening', '48 mm'],
    ['Formula basis', 'Air bending estimate for mild steel adjusted by material factor'],
  ]);
  assert.match(result.note, /Confirm tooling/);
});

test('equipment ROI calculator compares outsource spend and new machine cost', () => {
  const result = calculateIndustryToolResult('equipment-roi', {
    ...defaultIndustryToolForms['equipment-roi'],
    outsourceCostUsdMonth: '12000',
    machinePaymentUsdMonth: '4500',
    operatorCostUsdMonth: '3800',
    maintenanceUsdMonth: '700',
    utilitiesUsdMonth: '500',
    addedRevenueUsdMonth: '2500',
    upfrontCostUsd: '25000',
  });

  assert.equal(result.title, 'Estimated equipment ROI');
  assert.match(result.rows.find(([label]) => label === 'Monthly net impact')?.[1], /\$/);
  assert.match(result.rows.find(([label]) => label === 'Simple payback')?.[1], /months/);
});

test('auxiliary sizing checklist estimates chiller and dust collector reference ranges', () => {
  const result = calculateIndustryToolResult('auxiliary-sizing', {
    ...defaultIndustryToolForms['auxiliary-sizing'],
    laserPowerKw: '6',
    tableLengthMm: '3000',
    tableWidthMm: '1500',
    cuttingHoursDay: '8',
    dustLoad: 'medium',
  });

  assert.equal(result.title, 'Auxiliary equipment sizing reference');
  assert.match(result.rows.find(([label]) => label === 'Chiller capacity reference')?.[1], /kW/);
  assert.match(result.rows.find(([label]) => label === 'Dust collector airflow reference')?.[1], /CFM/);
});
