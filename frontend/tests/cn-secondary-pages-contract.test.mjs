import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  calculateIndustryToolResult,
  defaultIndustryToolForms,
  getLocalizedTool,
  getLocalizedMaterialDensities,
  getLocalizedShapeProfiles,
  industryTools,
} from '../src/data/industryTools.js';
import {
  getLocalizedInsight,
  getLocalizedInsights,
} from '../src/data/insights.js';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('CN tools data localizes every public tool definition', () => {
  assert.equal(industryTools.length, 9);

  for (const tool of industryTools) {
    const cn = getLocalizedTool(tool, 'zh-CN');
    assert.match(cn.label, /[\u4e00-\u9fff]/, `${tool.id} label should be Chinese`);
    assert.match(cn.description, /[\u4e00-\u9fff]/, `${tool.id} description should be Chinese`);
    assert.match(cn.seoTitle, /[\u4e00-\u9fff]/, `${tool.id} seoTitle should be Chinese`);
    assert.match(cn.guideBody, /[\u4e00-\u9fff]/, `${tool.id} guideBody should be Chinese`);
    assert.ok(cn.faqs.length >= 2, `${tool.id} should keep FAQs`);
    assert.match(cn.faqs[0][0], /[\u4e00-\u9fff]/, `${tool.id} FAQ question should be Chinese`);
  }

  assert.equal(getLocalizedTool(industryTools[0], 'en').label, industryTools[0].label);
});

test('CN tool options and calculator results use Chinese visible labels', () => {
  const materials = getLocalizedMaterialDensities('zh-CN');
  const profiles = getLocalizedShapeProfiles('zh-CN');
  const result = calculateIndustryToolResult('gas-consumption', defaultIndustryToolForms['gas-consumption'], 'zh-CN');

  assert.match(materials.carbon_steel.label, /碳钢/);
  assert.match(profiles.angle.label, /角钢/);
  assert.equal(result.title, '辅助气体用量估算');
  assert.match(result.rows.map(([label]) => label).join(' / '), /辅助气体/);
  assert.match(result.note, /规划参考/);
});

test('CN insights data localizes hub cards and detail articles', () => {
  const insights = getLocalizedInsights('zh-CN');
  const detail = getLocalizedInsight('laser-cutting-cost-drivers', 'zh-CN');

  assert.equal(insights.length, 3);
  assert.match(insights[0].title, /[\u4e00-\u9fff]/);
  assert.match(insights[0].description, /[\u4e00-\u9fff]/);
  assert.match(detail.title, /激光切割/);
  assert.match(detail.sections[0].heading, /[\u4e00-\u9fff]/);
  assert.match(detail.sections[0].body, /[\u4e00-\u9fff]/);
  assert.match(detail.readingTime, /分钟/);
});

test('CN secondary page components choose localized copy by runtime locale', () => {
  const toolsPage = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const toolCalculator = read('frontend/src/components/Tools/IndustryToolCalculator.jsx');
  const toolsModal = read('frontend/src/components/Tools/IndustryToolsModal.jsx');
  const insightsPage = read('frontend/src/components/Insights/InsightsPage.jsx');

  assert.match(toolsPage, /isCnLocale/);
  assert.match(toolsPage, /getLocalizedTool/);
  assert.match(toolsPage, /canonicalHost/);
  assert.match(toolsPage, /全部工具/);
  assert.match(toolCalculator, /FIELD_LABELS_CN/);
  assert.match(toolCalculator, /calculateIndustryToolResult\(tool\.id, currentValues, locale\)/);
  assert.match(toolsModal, /isCnLocale/);
  assert.match(toolsModal, /行业工具/);
  assert.match(insightsPage, /getLocalizedInsight/);
  assert.match(insightsPage, /全部洞察/);
  assert.match(insightsPage, /canonicalHost/);
});
