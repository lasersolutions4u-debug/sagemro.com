import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '../..');
const recruitingPath = path.join(root, 'frontend/src/components/Engineer/EngineerRecruitingPage.jsx');
const recruitingSource = readFileSync(recruitingPath, 'utf8');

let recruitingModule;
let renderedCn;

async function ensureLoaded() {
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { hostname: 'engineer.sagemro.cn', pathname: '/', search: '' },
    fetch: globalThis.fetch,
  };
  let vite;
  try {
    vite = await createServer({
      root: path.join(root, 'frontend'),
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    });
    recruitingModule = await vite.ssrLoadModule('/src/components/Engineer/EngineerRecruitingPage.jsx');
    renderedCn = renderToStaticMarkup(
      React.createElement(recruitingModule.EngineerRecruitingPage, { onOpenLogin() {} }),
    );
  } finally {
    try {
      await vite?.close();
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  }
}

test.before(ensureLoaded);

function exportedContent() {
  const entry = Object.entries(recruitingModule).find(([, value]) => (
    value
    && typeof value === 'object'
    && value.cn
    && value.en
    && typeof value.cn === 'object'
  ));
  assert.ok(entry, 'Expected the JSX module to export its stable { cn, en } recruiting content object');
  return entry[1];
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function exportedSeoBuilder() {
  const isDescriptor = (value) => (
    value
    && typeof value === 'object'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.canonical === 'string'
    && typeof value.lang === 'string'
    && value.structuredData?.['@type'] === 'Service'
  );

  for (const [name, candidate] of Object.entries(recruitingModule)) {
    if (candidate === recruitingModule.EngineerRecruitingPage || typeof candidate !== 'function') continue;
    for (const invoke of [
      (locale) => candidate(locale),
      (locale) => candidate({ locale }),
    ]) {
      try {
        const cn = invoke('cn');
        const en = invoke('en');
        if (isDescriptor(cn) && isDescriptor(en)) return { name, cn: plain(cn), en: plain(en) };
      } catch {
        // Ignore unrelated function exports while dynamically locating the pure descriptor builder.
      }
    }
  }
  assert.fail('Expected an exported pure locale SEO descriptor builder');
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText() {
  return decodeHtml(renderedCn);
}

function renderedHeadings() {
  return [...renderedCn.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({ level: Number(match[1]), text: decodeHtml(match[2]) }));
}

function resolveInitialValue(token) {
  if (token === '2') return 2;
  if (/^['"]Q3['"]$/.test(token)) return 'Q3';
  const assignment = recruitingSource.match(
    new RegExp(`(?:const|let)\\s+${token}\\s*=\\s*(2|'Q3'|"Q3")\\s*;`),
  );
  return assignment ? resolveInitialValue(assignment[1]) : undefined;
}

function tabMapPassesCurrentItemToSelection(setterName) {
  const escapedSetter = setterName.replace(/[$]/g, '\\$&');
  for (const map of recruitingSource.matchAll(
    /questionSlides\.map\(\s*\(\s*([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s*\)\s*=>/g,
  )) {
    const [, itemName, indexName] = map;
    const currentSelection = indexName
      ? `(?:${itemName.replace(/[$]/g, '\\$&')}\\.id|${indexName.replace(/[$]/g, '\\$&')})`
      : `${itemName.replace(/[$]/g, '\\$&')}\\.id`;
    const mapBody = recruitingSource.slice(map.index, map.index + 1800);
    const click = mapBody.match(/onClick\s*=\s*\{([\s\S]{0,500}?)\}/);
    if (!click) continue;
    const selectionCall = click[1].match(
      new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\(\\s*(${currentSelection})\\s*\\)`),
    );
    if (!selectionCall) continue;
    const calledName = selectionCall[1];
    if (calledName === setterName) return true;
    const escapedCalled = calledName.replace(/[$]/g, '\\$&');
    const arrowHandler = recruitingSource.match(
      new RegExp(`const\\s+${escapedCalled}\\s*=\\s*(?:\\(\\s*([^)]*?)\\s*\\)|([A-Za-z_$][\\w$]*))\\s*=>`),
    );
    const functionHandler = recruitingSource.match(
      new RegExp(`function\\s+${escapedCalled}\\s*\\(\\s*([^)]*?)\\s*\\)`),
    );
    const handlerMatch = arrowHandler || functionHandler;
    if (!handlerMatch) continue;
    const parameterList = arrowHandler ? (handlerMatch[1] || handlerMatch[2]) : handlerMatch[1];
    const firstParameter = parameterList.split(',')[0].trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(firstParameter)) continue;
    const escapedParameter = firstParameter.replace(/[$]/g, '\\$&');
    const handlerBody = recruitingSource.slice(handlerMatch.index, handlerMatch.index + 1000);
    if (new RegExp(`\\b${escapedSetter}\\s*\\(\\s*${escapedParameter}\\s*\\)`).test(handlerBody)) {
      return true;
    }
  }
  return false;
}

function selectedQuestionRendersBothFields(stateName) {
  const escapedState = stateName.replace(/[$]/g, '\\$&');
  const directQuestion = new RegExp(
    `questionSlides\\s*\\[\\s*${escapedState}\\s*\\]\\s*\\??\\.question`,
  ).test(recruitingSource);
  const directConfirmation = new RegExp(
    `questionSlides\\s*\\[\\s*${escapedState}\\s*\\]\\s*\\??\\.confirmation`,
  ).test(recruitingSource);
  if (directQuestion && directConfirmation) return true;

  for (const selected of recruitingSource.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*questionSlides[^;\n]*);/g,
  )) {
    if (!new RegExp(`\\b${escapedState}\\b`).test(selected[2])) continue;
    const escapedSelected = selected[1].replace(/[$]/g, '\\$&');
    const rendersQuestion = new RegExp(
      `\\{\\s*${escapedSelected}\\s*\\??\\.question\\s*\\}`,
    ).test(recruitingSource);
    const rendersConfirmation = new RegExp(
      `\\{\\s*${escapedSelected}\\s*\\??\\.confirmation\\s*\\}`,
    ).test(recruitingSource);
    if (rendersQuestion && rendersConfirmation) return true;
  }
  return false;
}

function findCarouselInteraction() {
  for (const declaration of recruitingSource.matchAll(
    /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\(\s*([^),]+)\s*\)/g,
  )) {
    const [, stateName, setterName, initialToken] = declaration;
    const escapedState = stateName.replace(/[$]/g, '\\$&');
    const usesSlides = new RegExp(
      `questionSlides[\\s\\S]{0,1800}\\b${escapedState}\\b|\\b${escapedState}\\b[\\s\\S]{0,1800}questionSlides`,
    ).test(recruitingSource);
    const clickUpdatesState = tabMapPassesCurrentItemToSelection(setterName);
    if (usesSlides && clickUpdatesState) {
      return { stateName, initialValue: resolveInitialValue(initialToken.trim()) };
    }
  }
  return null;
}

function findModalInteraction() {
  for (const declaration of recruitingSource.matchAll(
    /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\(\s*false\s*\)/g,
  )) {
    const [, stateName, setterName] = declaration;
    const escapedState = stateName.replace(/[$]/g, '\\$&');
    const escapedSetter = setterName.replace(/[$]/g, '\\$&');
    const gated = new RegExp(`\\{\\s*${escapedState}\\s*&&\\s*\\(`).test(recruitingSource);
    const clickSets = (value) => {
      const inline = new RegExp(
        `onClick\\s*=\\s*\\{[\\s\\S]{0,240}?\\b${escapedSetter}\\s*\\(\\s*${value}\\s*\\)`,
      ).test(recruitingSource);
      const handler = recruitingSource.match(
        new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{?[\\s\\S]{0,800}?\\b${escapedSetter}\\s*\\(\\s*${value}\\s*\\)`),
      );
      const named = handler && new RegExp(
        `onClick\\s*=\\s*\\{\\s*${handler[1]}\\s*\\}`,
      ).test(recruitingSource);
      return inline || named;
    };
    const opensFromCta = clickSets('true');
    const closesFromClick = clickSets('false');
    if (gated && opensFromCta && closesFromClick) return true;
  }
  return false;
}

test('CN exported content keeps approved hero and structured recruiting data', () => {
  const copy = exportedContent().cn;

  assert.equal(copy.title, '让专业工程师价值最大化');
  assert.equal(
    copy.subtitle,
    '面向激光切割机及金属成形设备行业，SAGEMRO 连接服务需求、工程师协作、供应链与 AI 知识能力，逐步建设覆盖全国的设备维修保养、升级改造等专业服务网络。',
  );
  assert.ok([copy.primary, copy.applyNow].includes('提交服务意向'));
  assert.deepEqual(plain(copy.questionSlides), [
    { id: 'Q1', question: '我能接到什么单？', confirmation: '带着客户来，平台帮你把服务做完整' },
    { id: 'Q2', question: '收入怎么算？', confirmation: '工时价值优先，每笔业务清晰核算' },
    { id: 'Q3', question: 'AI 在合作中做什么？', confirmation: '派工前，先看 AI 整理的接单摘要' },
  ]);
  assert.equal(copy.coreValueTitle, '少处理琐事，多专注有价值的现场服务');
  assert.deepEqual(plain(copy.platformSupport), ['订单与沟通', '工具与配件', '记录与报告', '核算与结算']);
  assert.deepEqual(plain(copy.engineerFocus), ['故障诊断', '维修保养', '技术判断', '现场交付']);
  assert.deepEqual(plain(copy.developmentDirections), [
    { title: '全国共享客服中心', status: '逐步布局' },
    { title: '配件集采与供应链', status: '逐步建设' },
    { title: '新媒体营销与获客', status: '持续开展' },
    { title: 'AI 与知识库运营', status: '持续积累' },
  ]);
  assert.deepEqual(plain(copy.cooperationPrinciples), [
    { title: '着眼长期服务和共同成长', text: '以长期合作为目标，让工程师、平台与客户在持续服务中共同受益。' },
    { title: '公平、诚信、透明', text: '客户来源、双方投入和业务收益清晰记录，合作方案提前沟通，核算有据可查。' },
    { title: '尊重数据价值', text: 'AI 时代，数据是核心价值。详实的服务记录和报告，既形成工程师的专业履历，也持续推动 AI 成长。' },
  ]);
  const text = visibleText();
  for (const required of [
    copy.title,
    copy.subtitle,
    copy.coreValueTitle,
    ...copy.platformSupport,
    ...copy.engineerFocus,
    ...copy.developmentDirections.flatMap((item) => [item.title, item.status]),
    ...copy.cooperationPrinciples.flatMap((item) => [item.title, item.text]),
  ]) {
    assert.ok(text.includes(required), `Expected rendered CN page to show: ${required}`);
  }
});

test('CN rendered page preserves the approved v32 platform intro and detailed service story', () => {
  const text = visibleText();

  for (const required of [
    '工业现场服务协作网络',
    '服务机会',
    '工程师协作',
    '供应链支持',
    'AI 与知识',
    '工程师最关心的三个问题',
    '客户现象、设备信息、已有记录和 AI 初步整理集中呈现',
    'AI 先整理接单信息，工程师带着更完整的上下文到现场',
    '平台协助处理订单协调、信息整理、工具备件、服务报告和结算跟进',
    '工程师的核心价值，在现场解决问题',
    '平台持续建设更大的服务网络',
    '连接区域工程师、工具备件与服务协作',
    '服务数据推动 AI，规模推动供应链与营销',
  ]) {
    assert.ok(text.includes(required), `Expected approved v32 content: ${required}`);
  }

  assert.match(recruitingSource, /max-w-\[1280px\]/);
  assert.doesNotMatch(recruitingSource, /6\.8rem|Responsibility keywords|职责关键词/);
});

test('CN rendered carousel defaults to Q3 and exposes manual click switching without autoplay', () => {
  const copy = exportedContent().cn;
  const activeElements = [...renderedCn.matchAll(
    /<button\b[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/gi,
  )].map((match) => decodeHtml(match[1]));
  const activeText = activeElements.join(' ');

  assert.match(activeText, /Q3/);
  assert.match(activeText, new RegExp(copy.questionSlides[2].question));
  assert.match(activeText, new RegExp(copy.questionSlides[2].confirmation));
  const interaction = findCarouselInteraction();
  assert.equal(interaction?.initialValue === 2 || interaction?.initialValue === 'Q3', true);
  assert.equal(
    interaction ? selectedQuestionRendersBothFields(interaction.stateName) : false,
    true,
    'Expected the current selected question object to render both question and confirmation',
  );
  assert.doesNotMatch(recruitingSource, /setInterval\s*\(|\bautoPlay\b|\bautoplay\b/);
});

test('CN rendered page shows the approved concise application CTA without requiring a data shape', () => {
  const text = visibleText();

  assert.match(text, /加入 SAGEMRO 工程师网络/);
  assert.match(text, /填写基本信息，运营团队审核后与你联系。/);
  assert.match(text, /提交合作意向/);
  assert.match(text, /提交服务意向/);
});

test('CN recruiting data and rendered output avoid unsupported promises and close variants', () => {
  const exported = Object.entries(recruitingModule).find(([, value]) => value?.cn && value?.en)?.[1];
  const combined = `${visibleText()} ${exported ? JSON.stringify(exported.cn) : ''}`;

  assert.doesNotMatch(combined, /济南[^，。；;"'<>]{0,16}筹建/);
  assert.doesNotMatch(combined, /中心[^，。；;"'<>]{0,8}筹建/);
  assert.doesNotMatch(combined, /固定(?:比例|分成|分成比例)/);
  assert.doesNotMatch(combined, /(?:马上|立即)派单/);
  assert.doesNotMatch(combined, /工程师(?:可|可以|能够)?直接(?:与|和)?\s*AI\s*(?:对话|沟通|聊天)/);
});

test('actual CN h1, h2, and h3 headings do not end with a full stop', () => {
  const headings = renderedHeadings();

  assert.ok(headings.length > 0);
  for (const heading of headings) {
    assert.notEqual(heading.text, '', `Rendered h${heading.level} must not be empty`);
    assert.doesNotMatch(heading.text, /[。．.]$/, `Rendered h${heading.level} must not end with a full stop`);
  }
});

test('application modal retains gated open, CTA trigger, close, form submit, and API semantics', () => {
  assert.equal(findModalInteraction(), true);
  assert.doesNotMatch(renderedCn, /<form\b/i, 'Application form must be gated while the modal is closed');
  const submitHandler = recruitingSource.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,3000}?\bsubmitEngineerApplication\s*\(/,
  );
  assert.ok(submitHandler, 'Expected an async application handler to call submitEngineerApplication');
  assert.match(
    recruitingSource,
    new RegExp(`<form\\b[^>]*\\bonSubmit=\\{\\s*${submitHandler[1]}\\s*\\}`),
  );
  const formState = [...recruitingSource.matchAll(
    /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*useState\(\s*\{([\s\S]{0,1600}?)\}\s*\);/g,
  )].find((match) => /service_regions\s*:/.test(match[2]) && /skill_tags\s*:/.test(match[2]));
  assert.ok(formState, 'Expected application form state with service_regions and skill_tags');
  const escapedForm = formState[1].replace(/[$]/g, '\\$&');
  assert.match(
    recruitingSource,
    new RegExp(
      `submitEngineerApplication\\s*\\(\\s*\\{[\\s\\S]{0,1200}?\\.\\.\\.${escapedForm}[\\s\\S]{0,1200}?service_regions\\s*:\\s*[A-Za-z_$][\\w$]*\\(\\s*${escapedForm}\\.service_regions\\s*\\)[\\s\\S]{0,1200}?skill_tags\\s*:\\s*[A-Za-z_$][\\w$]*\\(\\s*${escapedForm}\\.skill_tags\\s*\\)`,
    ),
    'Expected submitted payload to spread form data and normalize both tag collections',
  );
});

test('public engineer recruiting SEO retains canonical and Service schema semantics', () => {
  const { name, cn, en } = exportedSeoBuilder();

  assert.equal(cn.title, '认证服务代表网络 | SAGEMRO');
  assert.equal(cn.description, '加入 SAGEMRO 工程师合作网络，为激光切割机、折弯机和金属成形设备提供清晰、可记录的现场服务协作。');
  assert.equal(en.title, 'Industrial Service Engineer Network | SAGEMRO');
  assert.equal(en.description, "Join SAGEMRO's industrial service engineer network for laser cutting and metal forming equipment field service.");
  assert.deepEqual(
    {
      cn: {
        canonical: cn.canonical,
        lang: cn.lang,
        context: cn.structuredData['@context'],
        type: cn.structuredData['@type'],
        provider: cn.structuredData.provider,
        areaServed: cn.structuredData.areaServed,
        url: cn.structuredData.url,
      },
      en: {
        canonical: en.canonical,
        lang: en.lang,
        context: en.structuredData['@context'],
        type: en.structuredData['@type'],
        provider: en.structuredData.provider,
        areaServed: en.structuredData.areaServed,
        url: en.structuredData.url,
      },
    },
    {
      cn: {
        canonical: 'https://engineer.sagemro.cn/',
        lang: 'zh-CN',
        context: 'https://schema.org',
        type: 'Service',
        provider: { '@type': 'Organization', name: 'SAGEMRO', url: 'https://sagemro.cn/' },
        areaServed: 'China',
        url: 'https://engineer.sagemro.cn',
      },
      en: {
        canonical: 'https://engineer.sagemro.com/',
        lang: 'en',
        context: 'https://schema.org',
        type: 'Service',
        provider: { '@type': 'Organization', name: 'SAGEMRO', url: 'https://sagemro.com/' },
        areaServed: 'Worldwide',
        url: 'https://engineer.sagemro.com',
      },
    },
  );
  const escapedName = name.replace(/[$]/g, '\\$&');
  const directUse = new RegExp(
    `setSeoMetadata\\s*\\(\\s*${escapedName}\\s*\\(`,
  ).test(recruitingSource);
  const assignedUse = recruitingSource.match(
    new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapedName}\\s*\\([^;]*\\)\\s*;[\\s\\S]{0,1000}?setSeoMetadata\\s*\\(\\s*\\1\\s*\\)`),
  );
  assert.ok(
    directUse || assignedUse,
    'Expected the component to pass the exported SEO descriptor into setSeoMetadata',
  );
});
