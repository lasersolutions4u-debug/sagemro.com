import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateIndustryToolResult,
  defaultIndustryToolForms,
  getToolBySlug,
  materialDensities,
  shapeProfiles,
} from '../src/data/industryTools.js';

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
  assert.match(result.rows.find(([label]) => label === 'Estimated material budget')?.[1], /\$/);
});

test('public tool slugs resolve to SEO-ready tool definitions', () => {
  assert.equal(getToolBySlug('metal-weight-calculator').id, 'metal-weight');
  assert.equal(getToolBySlug('steel-price-watch').id, 'steel-price');
  assert.equal(getToolBySlug('laser-cutting-cost-calculator').id, 'laser-cost');
  assert.equal(getToolBySlug('press-brake-tonnage-calculator').id, 'press-brake-tonnage');
  assert.equal(getToolBySlug('missing-tool'), null);
});
