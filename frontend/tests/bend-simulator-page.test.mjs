import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

import { normalizeBendProfileValue } from '../src/utils/bendProfileEditorState.js';
import { calculateBendSimulation, normalizeBendSimulationInput } from '../src/utils/bendSimulationEngine.js';
import { shouldPauseTimeline } from '../src/utils/bendSimulationTimeline.js';
import {
  applyBendSimulatorEditorChange,
  buildBendSimulatorWorkspaceState,
} from '../src/utils/bendSimulatorPageState.js';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const reactModule = pathToFileURL(require.resolve('react')).href;
const lucideModule = pathToFileURL(require.resolve('lucide-react')).href;
const pageStateModule = pathToFileURL(path.join(root, 'src/utils/bendSimulatorPageState.js')).href;
const timelineStateModule = pathToFileURL(path.join(root, 'src/utils/bendSimulationTimeline.js')).href;
const engineModule = pathToFileURL(path.join(root, 'src/utils/bendSimulationEngine.js')).href;
const presentationModule = pathToFileURL(path.join(root, 'src/utils/bendSimulationPresentation.js')).href;

const selectedInput = {
  unitSystem: 'metric', material: 'aluminum', thicknessMm: 3, sheetWidthMm: 1000, machine: 'shop-200', upperTool: 'gooseneck-punch', lowerTool: 'v-die-40',
  segments: [{ lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 1 }],
};

async function renderBendSimulatorPage() {
  const page = readFileSync(path.join(root, 'src/components/Tools/BendSimulatorPage.jsx'), 'utf8').replace(/^import .*;\n/gm, '');
  const source = `
    import { createElement, useEffect, useMemo, useRef, useState } from '${reactModule}';
    import { applyBendSimulatorEditorChange, buildBendSimulatorWorkspaceState, toBendSimulatorEditorInput } from '${pageStateModule}';
    import { calculateBendSimulation } from '${engineModule}';
    import { advanceBendPlayback } from '${timelineStateModule}';
    const ArrowLeft = () => null;
    const Calculator = () => null;
    const BrandMark = () => null;
    const Footer = () => null;
    const Modal = () => null;
    const submitBendSimulationReview = async () => ({});
    const trackFunnelEvent = () => {};
    const BendProfileEditor = ({ value }) => createElement('div', { 'data-role': 'editor', 'data-material': value.material, 'data-upper-tool': value.upperTool, 'data-lower-tool': value.lowerTool });
    const BendSimulationViewport = ({ result, activeFrame, viewMode }) => createElement('div', { 'data-role': 'viewport', 'data-active-frame': activeFrame, 'data-view-mode': viewMode, 'data-flat-length': result.flatLengthMm });
    const BendSimulationTimeline = ({ frames, activeFrame, playing }) => createElement('div', { 'data-role': 'timeline', 'data-active-frame': activeFrame, 'data-frame-count': frames.length, 'data-playing': String(playing) });
    const BendResultPanel = ({ result }) => createElement('div', { 'data-role': 'result', 'data-flat-length': result.flatLengthMm });
    ${page}
  `;
  const transformed = await transformWithOxc(source, 'BendSimulatorPage.jsx', { lang: 'jsx', format: 'esm', jsx: { runtime: 'classic', pragma: 'createElement' } });
  const { BendSimulatorPage } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
  return renderToStaticMarkup(createElement(BendSimulatorPage, {
    tool: { seoTitle: 'Press Brake Bend Simulator', guideBody: 'Plan a bend.' },
    copy: { navTools: 'Tools', navChat: 'AI chat', allTools: 'All tools', detailEyebrow: 'Free industry calculator' },
  }));
}

async function renderResultPanel(result, locale = 'en') {
  const panel = readFileSync(path.join(root, 'src/components/Tools/BendResultPanel.jsx'), 'utf8');
  const source = `import { createElement } from '${reactModule}';\n${panel}`
    .replace("from 'lucide-react'", `from '${lucideModule}'`)
    .replace("from '../../utils/bendSimulationPresentation'", `from '${presentationModule}'`);
  const transformed = await transformWithOxc(source, 'BendResultPanel.jsx', { lang: 'jsx', format: 'esm', jsx: { runtime: 'classic', pragma: 'createElement' } });
  const { BendResultPanel } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
  return renderToStaticMarkup(createElement(BendResultPanel, { result, locale, onRequestReview: () => {} }));
}

async function renderTimeline(locale = 'en') {
  const source = `import { createElement } from '${reactModule}';\n${readFileSync(path.join(root, 'src/components/Tools/BendSimulationTimeline.jsx'), 'utf8')}`
    .replace("from 'lucide-react'", `from '${lucideModule}'`)
    .replace("from 'react'", `from '${reactModule}'`)
    .replace("from '../../utils/bendSimulationTimeline'", `from '${timelineStateModule}'`);
  const transformed = await transformWithOxc(source, 'BendSimulationTimeline.jsx', { lang: 'jsx', format: 'esm', jsx: { runtime: 'classic', pragma: 'createElement' } });
  const { BendSimulationTimeline } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
  return renderToStaticMarkup(createElement(BendSimulationTimeline, {
    frames: [{ step: 0, activeBendOrder: null }, { step: 1, activeBendOrder: 1 }, { step: 2, activeBendOrder: null }],
    activeFrame: 1,
    playing: false,
    simulationId: 'test',
    locale,
  }));
}

async function loadReviewHelper() {
  const source = readFileSync(path.join(root, 'src/services/api.js'), 'utf8').replace("if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;", "return 'https://api.example.test';");
  const transformed = await transformWithOxc(source, 'api.js', { lang: 'js', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString('base64')}`);
}

test('bend simulator editor selections survive an engine-normalized rerender', () => {
  const normalized = normalizeBendSimulationInput(selectedInput);
  const editorValue = normalizeBendProfileValue(normalized);

  assert.equal(editorValue.material, 'aluminum');
  assert.equal(editorValue.machine.id, 'shop-200');
  assert.equal(editorValue.upperTool, 'gooseneck-punch');
  assert.equal(editorValue.lowerTool, 'v-die-40');
});

test('bend simulator page renders mobile-order children with synchronized initial props', async () => {
  const markup = await renderBendSimulatorPage();
  const editorIndex = markup.indexOf('data-role="editor"');
  const viewportIndex = markup.indexOf('data-role="viewport"');
  const timelineIndex = markup.indexOf('data-role="timeline"');
  const resultIndex = markup.indexOf('data-role="result"');

  assert.ok(editorIndex < viewportIndex && viewportIndex < timelineIndex && timelineIndex < resultIndex);
  assert.match(markup, /data-material="carbon_steel"/);
  assert.match(markup, /data-active-frame="0"/);
  assert.match(markup, /data-view-mode="2d"/);
  assert.match(markup, /data-frame-count="4"/);
});

test('editor changes recalculate the plan, reset animation, and keep child state synchronized', () => {
  const current = buildBendSimulatorWorkspaceState({ input: selectedInput, activeFrame: 1, playing: true, viewMode: '3d' });
  const next = applyBendSimulatorEditorChange(current, {
    ...selectedInput,
    thicknessMm: 6,
    segments: [...selectedInput.segments, { lengthMm: 80, angleDeg: 120, insideRadiusMm: 6, order: 2 }],
  });

  assert.equal(next.input.material, 'aluminum');
  assert.equal(next.input.upperTool, 'gooseneck-punch');
  assert.equal(next.input.lowerTool, 'v-die-40');
  assert.equal(next.activeFrame, 0);
  assert.equal(next.playing, false);
  assert.equal(next.viewMode, '3d');
  assert.equal(next.segmentAdjusted, true);
  assert.notEqual(next.result.flatLengthMm, current.result.flatLengthMm);
  assert.notEqual(next.result.tonnage.withSafetyTons, current.result.tonnage.withSafetyTons);
  assert.equal(next.viewport.result, next.result);
  assert.equal(next.viewport.activeFrame, next.timeline.activeFrame);
  assert.equal(next.timeline.frames, next.result.frames);
  assert.equal(next.resultPanel.result, next.result);
  assert.equal(shouldPauseTimeline({ previousFrames: current.timeline.frames, previousSimulationId: current.simulationId, frames: next.timeline.frames, simulationId: next.simulationId, playing: true }), true);
});

test('workspace reuses one simulation result while playback advances frames and changes views', () => {
  const current = buildBendSimulatorWorkspaceState({ input: selectedInput, activeFrame: 0, playing: true, viewMode: '2d' });
  const nextFrame = buildBendSimulatorWorkspaceState({
    input: current.input,
    result: current.result,
    simulationId: current.simulationId,
    activeFrame: 1,
    playing: true,
    viewMode: '2d',
  });
  const nextView = buildBendSimulatorWorkspaceState({
    input: current.input,
    result: current.result,
    simulationId: current.simulationId,
    activeFrame: 1,
    playing: true,
    viewMode: '3d',
  });

  assert.equal(nextFrame.result, current.result);
  assert.equal(nextFrame.timeline.frames, current.timeline.frames);
  assert.equal(nextFrame.playing, true);
  assert.equal(nextView.result, current.result);
  assert.equal(nextView.timeline.frames, current.timeline.frames);
  assert.equal(nextView.playing, true);
});

test('bend result panel presents planning fields and the engineer review CTA', async () => {
  const workspace = buildBendSimulatorWorkspaceState({ input: selectedInput });
  const markup = await renderResultPanel(workspace.result);

  assert.match(markup, /Recommended upper tool/);
  assert.match(markup, /V die/);
  assert.match(markup, /Tonnage/);
  assert.match(markup, /Machine margin/);
  assert.match(markup, /Bend allowance/);
  assert.match(markup, /Flat length/);
  assert.match(markup, /Derived flange lengths/);
  assert.match(markup, /50\.00 \/ 50\.00 mm/);
  assert.match(markup, /Planning estimate/);
  assert.match(markup, /Request engineer review/);
  assert.match(markup, /data-plan-status="review"/);
});

test('bend result status is green only when machine and complete tooling match are ready', async () => {
  const ready = buildBendSimulatorWorkspaceState({
    input: {
      ...selectedInput,
      material: 'carbon_steel',
      machine: 'shop-100',
      upperTool: 'standard-punch',
      lowerTool: 'v-die-24',
      segments: [{ lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 1 }],
    },
  });
  const noCompatible = calculateBendSimulation({
    ...selectedInput,
    machine: { id: 'american-machine', capacityTons: 100, bedLengthMm: 3000, minThicknessMm: 0.5, maxThicknessMm: 10, toolInterface: 'american' },
    upperTool: 'standard-punch',
    lowerTool: 'v-die-24',
  });
  const readyMarkup = await renderResultPanel(ready.result);
  const noCompatibleMarkup = await renderResultPanel(noCompatible);

  assert.equal(ready.result.resultStatus, 'ready');
  assert.match(readyMarkup, /data-plan-status="ready"/);
  assert.match(noCompatibleMarkup, /data-plan-status="review"/);
  assert.match(noCompatibleMarkup, /No compatible tooling/);
  assert.doesNotMatch(noCompatibleMarkup, /data-plan-status="ready"/);
});

test('bend result status stays ready for compatible non-preferred tooling', async () => {
  const result = calculateBendSimulation({
    unitSystem: 'metric', material: 'carbon_steel', thicknessMm: 3, sheetWidthMm: 1000, machine: 'shop-100',
    upperTool: 'gooseneck-punch', lowerTool: 'v-die-32',
    segments: [{ lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 1 }],
  });
  const markup = await renderResultPanel(result);

  assert.equal(result.resultStatus, 'ready');
  assert.match(markup, /data-plan-status="ready"/);
  assert.doesNotMatch(markup, /The selected (?:upper tool|lower die) is not compatible/);
});

test('Chinese result presentation localizes catalog values and warning codes', async () => {
  const workspace = buildBendSimulatorWorkspaceState({
    input: { ...selectedInput, sheetWidthMm: 5000, upperTool: 'standard-punch', lowerTool: 'v-die-6' },
  });
  const markup = await renderResultPanel(workspace.result, 'zh-CN');

  assert.match(markup, /铝/);
  assert.match(markup, /标准上模/);
  assert.match(markup, /200 吨通用折弯机/);
  assert.match(markup, /折弯补偿量/);
  assert.doesNotMatch(markup, /折弯系数/);
  assert.match(markup, /工作长度|折弯长度超过/);
  assert.doesNotMatch(markup, /Aluminum|Standard punch|Required tonnage exceeds|bend length exceeds/i);
});

test('Chinese timeline localizes dynamic frame labels and accessible controls', async () => {
  const markup = await renderTimeline('zh-CN');

  assert.match(markup, /规划动画/);
  assert.match(markup, /折弯 1/);
  assert.match(markup, /播放动画|暂停动画/);
  assert.doesNotMatch(markup, /Plan animation|Bend 1|Start|End|Play animation|Previous frame|Next frame/);
});

test('editor review CTA names an engineer and receives live result warnings', () => {
  const editor = readFileSync(path.join(root, 'src/components/Tools/BendProfileEditor.jsx'), 'utf8');
  const page = readFileSync(path.join(root, 'src/components/Tools/BendSimulatorPage.jsx'), 'utf8');

  assert.doesNotMatch(editor, /SAGEMRO AI/);
  assert.match(editor, /engineer|工程师/i);
  assert.match(page, /warnings=\{[^}]*result\.warnings/);
});

test('bend review helper posts only approved contact and numeric simulation fields', async () => {
  const { submitBendSimulationReview } = await loadReviewHelper();
  const workspace = buildBendSimulatorWorkspaceState({ input: selectedInput });
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ accepted: true }) };
  };

  try {
    await submitBendSimulationReview({
      contact: { name: 'Ada', company: 'SAGE', email: 'ada@example.test', phone: '+86 123456', drawing: 'ignore-me', password: 'ignore-me' },
      simulation: { ...workspace.result, uploadedFile: { name: 'part.dxf' }, secret: 'ignore-me' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.url, 'https://api.example.test/api/leads/bend-simulation');
  assert.deepEqual(JSON.parse(request.options.body), {
    contact: { name: 'Ada', company: 'SAGE', email: 'ada@example.test', phone: '+86 123456' },
    simulation: {
      unit_system: 'metric', material: 'aluminum', thickness_mm: 3, bend_length_mm: 1000, machine: 'shop-200', upper_tool: 'gooseneck-punch', lower_tool: 'v-die-40',
      segments: [{ span_length_mm: 100, angle_deg: 90, inside_radius_mm: 3, order: 1 }], flange_lengths_mm: [50, 50], result_status: workspace.result.resultStatus, warning_codes: workspace.result.warnings.map((warning) => warning.code),
      flat_length_mm: workspace.result.flatLengthMm, bend_allowance_mm: workspace.result.totalBendAllowanceMm, required_tonnage: workspace.result.tonnage.withSafetyTons,
    },
  });
});
