#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(__dirname, '..');
const goldenPath = join(workerRoot, 'tests', 'golden-set.json');
export const REVIEW_DIMENSIONS = [
  'technical_correctness',
  'evidence_grounding',
  'actionability',
  'uncertainty_discipline',
  'language_and_clarity',
  'service_routing',
];

function parseArgs(argv) {
  const args = {
    run: false,
    dryRun: false,
    baseUrl: '',
    outDir: join(workerRoot, '.eval-runs'),
    limit: 0,
    market: '',
    caseId: '',
    repeats: 3,
    allowRemote: false,
  };

  for (const arg of argv) {
    if (arg === '--run') args.run = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--allow-remote') args.allowRemote = true;
    else if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length).replace(/\/+$/, '');
    else if (arg.startsWith('--out-dir=')) args.outDir = resolve(workerRoot, arg.slice('--out-dir='.length));
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg.startsWith('--market=')) args.market = arg.slice('--market='.length);
    else if (arg.startsWith('--case=')) args.caseId = arg.slice('--case='.length);
    else if (arg.startsWith('--repeats=')) {
      const repeats = Number(arg.slice('--repeats='.length));
      if (Number.isSafeInteger(repeats) && repeats >= 1 && repeats <= 5) args.repeats = repeats;
    }
    else if (arg === '--help' || arg === '-h') args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/real-output-eval.mjs --dry-run
  node scripts/real-output-eval.mjs --run --base-url=https://api.sagemro.cn

Options:
  --dry-run              List output_contract cases without calling the API.
  --run                  Actually call the API. Required for network execution.
  --allow-remote         Explicitly authorize a non-local evaluation target.
  --base-url=<url>       API origin, for example https://api.sagemro.cn.
  --market=<cn|com>      Optional market filter for output_contract cases.
  --case=<id>            Optional exact case id, for example oc-003.
  --out-dir=<path>       Result directory. Default: worker/.eval-runs
  --limit=<n>            Optional case limit for a quick manual sample.
  --repeats=<1-5>        Attempts per case. Default: 3.
`);
}

export function assertEvaluationTargetAllowed(baseUrl, allowRemote = false) {
  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    throw new Error('invalid evaluation target');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(target.hostname) && !allowRemote) {
    throw new Error('remote evaluation target requires --allow-remote');
  }
}

export function createManualReview(dimensions) {
  return {
    status: 'pending',
    scores: Object.fromEntries(dimensions.map((dimension) => [dimension, null])),
    notes: null,
  };
}

export function evaluationClientIp(sequence) {
  return `198.51.100.${(sequence % 254) + 1}`;
}

function loadOutputCases({ limit = 0, market = '', caseId = '' } = {}) {
  const golden = JSON.parse(readFileSync(goldenPath, 'utf-8'));
  let cases = golden.cases.filter((cas) => cas.category === 'output_contract');
  if (market) cases = cases.filter((cas) => cas.input.client_market === market);
  if (caseId) cases = cases.filter((cas) => cas.id === caseId);
  return limit > 0 ? cases.slice(0, limit) : cases;
}

function normalizeTextForScoring(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function includesEquivalent(text, needle) {
  const normalizedText = normalizeTextForScoring(text);
  const normalizedNeedle = normalizeTextForScoring(needle);
  if (normalizedText.includes(normalizedNeedle)) return true;

  const equivalents = {
    稳定辅助气流: ['气流稳定性', '导引气流', '导流辅助气体', '引导辅助气体'],
    排渣: ['吹除熔渣', '熔渣', '排出熔渣', '吹渣'],
    材料和厚度: ['材质和厚度', '材料厚度', '板材厚度'],
    先看: ['先检查', '先确认', '通常指向'],
    设备品牌: ['品牌和型号', '品牌型号', '设备是什么品牌'],
    'Start with': ['Check', 'Inspect', 'Verify'],
    cannot: ["can't", 'can’t', 'cant'],
  };

  for (const equivalent of equivalents[needle] || []) {
    if (normalizedText.includes(normalizeTextForScoring(equivalent))) return true;
  }
  return false;
}

function containsForbiddenPhrase(text, needle) {
  const normalizedText = normalizeTextForScoring(text);
  const normalizedNeedle = normalizeTextForScoring(needle);
  if (!normalizedText.includes(normalizedNeedle)) return false;

  const refusalPrefixes = [
    '不能',
    '不要',
    '禁止',
    '不得',
    '请勿',
    '无法',
    'donot',
    'don’t',
    'dont',
    'cannot',
    'can’t',
    'cant',
    'never',
  ];

  let index = normalizedText.indexOf(normalizedNeedle);
  while (index !== -1) {
    const before = normalizedText.slice(Math.max(0, index - 20), index);
    if (!refusalPrefixes.some((prefix) => before.includes(prefix))) return true;
    index = normalizedText.indexOf(normalizedNeedle, index + normalizedNeedle.length);
  }

  return false;
}

function normalizeNumericGuidance(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[‐‑‒–—―~～至到]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function expandChineseNumericGuidance(value) {
  const digits = new Map([
    ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5],
    ['六', 6], ['七', 7], ['八', 8], ['九', 9],
  ]);
  const parseInteger = (text) => {
    if (text === '十') return 10;
    const parts = text.split('十');
    if (parts.length === 2) {
      const tens = parts[0] ? digits.get(parts[0]) : 1;
      const ones = parts[1] ? digits.get(parts[1]) : 0;
      if (tens && Number.isInteger(ones)) return (tens * 10) + ones;
    }
    return digits.get(text) || text;
  };
  return String(value || '')
    .replace(/(?<![统唯])([一二三四五六七八九十]{1,3})(?=\s*(?:毫米|厘米|微米|千瓦|瓦|伏|安|赫兹|兆帕|千帕|巴|小时|分钟|秒|天|周|月|片|盒))/gu, (match) => String(parseInteger(match)))
    .replace(/毫米/gu, 'mm')
    .replace(/厘米/gu, 'cm')
    .replace(/微米/gu, 'um')
    .replace(/千瓦/gu, 'kW')
    .replace(/兆帕/gu, 'MPa')
    .replace(/千帕/gu, 'kPa');
}

function numericGuidanceTokens(value) {
  const normalized = expandChineseNumericGuidance(String(value || '').normalize('NFKC'));
  const pattern = /(?:\b(?:USD|CNY|RMB|EUR|GBP|JPY|SGD|CHF)\s*)?(?:[$€£¥￥]\s*)?\d+(?:[.,]\d+)?\s*(?:[‐‑‒–—―~～至到-]\s*\d+(?:[.,]\d+)?)?\s*(?:%|kW|W|V|A|Hz|MPa|kPa|bar|psi|mm|cm|μm|um|°C|℃|hours?|minutes?|seconds?|days?|weeks?|months?|tonnes?|tons?|m|-?axis|-?axes|[x×]|小时|分钟|秒|天|周|月|片|盒)(?![A-Za-z0-9])/giu;
  return [...normalized.matchAll(pattern)].map((match) => match[0].trim());
}

export function scoreText(text, expect, { inputText = '' } = {}) {
  const failures = [];
  for (const choices of expect.output_any_of || []) {
    if (!choices.some((needle) => includesEquivalent(text, needle))) {
      failures.push(`missing any of ${JSON.stringify(choices)}`);
    }
  }
  for (const needle of expect.output_contains || []) {
    if (!includesEquivalent(text, needle)) failures.push(`missing ${JSON.stringify(needle)}`);
  }
  for (const needle of expect.output_not_contains || []) {
    if (containsForbiddenPhrase(text, needle)) failures.push(`forbidden ${JSON.stringify(needle)}`);
  }
  for (const needle of expect.output_absent || []) {
    if (normalizeTextForScoring(text).includes(normalizeTextForScoring(needle))) {
      failures.push(`absent violation ${JSON.stringify(needle)}`);
    }
  }
  if (Number.isFinite(expect.max_non_empty_lines)) {
    const nonEmptyLines = String(text || '').split(/\n/).filter((line) => line.trim()).length;
    if (nonEmptyLines > expect.max_non_empty_lines) {
      failures.push(
        `too many non-empty lines: want <=${expect.max_non_empty_lines}, got ${nonEmptyLines}`,
      );
    }
  }
  const maxQuestionMarks = Number.isFinite(expect.max_question_marks)
    ? expect.max_question_marks
    : 1;
  const questionMarkCount = (String(text || '').match(/[?？]/gu) || []).length;
  if (questionMarkCount > maxQuestionMarks) {
    failures.push(`too many question marks: want <=${maxQuestionMarks}, got ${questionMarkCount}`);
  }
  const inputNumbers = new Set(numericGuidanceTokens(inputText).map(normalizeNumericGuidance));
  for (const token of numericGuidanceTokens(text)) {
    if (!inputNumbers.has(normalizeNumericGuidance(token))) {
      failures.push(`ungrounded numeric guidance ${JSON.stringify(token)}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

function parseSseContent(raw) {
  let content = '';
  for (const line of raw.split(/\n/)) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice('data: '.length).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const data = JSON.parse(payload);
      if (typeof data.content === 'string') content += data.content;
    } catch {
      // Ignore non-JSON diagnostic lines.
    }
  }
  return content;
}

async function callCase(baseUrl, cas, attempt, requestSequence) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: cas.input.origin,
      'CF-Connecting-IP': evaluationClientIp(requestSequence),
    },
    body: JSON.stringify({
      conversation_id: `real-eval-${cas.id}-${attempt}-${Date.now()}`,
      message: cas.input.message,
      client_market: cas.input.client_market,
      client_locale: cas.input.client_locale,
      user_type: 'guest',
    }),
  });

  const raw = await response.text();
  const content = parseSseContent(raw);
  return { status: response.status, raw, content };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const cases = loadOutputCases({ limit: args.limit, market: args.market, caseId: args.caseId });
  const mode = args.run ? 'run' : 'dry-run';
  console.log(`mode: ${mode}`);
  if (args.market) console.log(`market: ${args.market}`);
  if (args.caseId) console.log(`case: ${args.caseId}`);
  console.log(`cases: ${cases.length}`);
  console.log(`repeats: ${args.repeats}`);
  console.log(`planned runs: ${cases.length * args.repeats}`);

  for (const cas of cases) {
    console.log(`- ${cas.id}: ${cas.description}`);
  }

  if (!args.run) {
    console.log('pass --run to call the API');
    return;
  }

  if (!args.baseUrl) {
    console.error('Missing --base-url. Example: --base-url=https://api.sagemro.cn');
    process.exit(2);
  }
  assertEvaluationTargetAllowed(args.baseUrl, args.allowRemote);

  await mkdir(args.outDir, { recursive: true });

  const results = [];
  let requestSequence = 0;
  for (const cas of cases) {
    for (let attempt = 1; attempt <= args.repeats; attempt += 1) {
      const startedAt = Date.now();
      const apiResult = await callCase(args.baseUrl, cas, attempt, requestSequence);
      requestSequence += 1;
      const score = scoreText(apiResult.content, cas.expect, { inputText: cas.input.message });
      results.push({
        id: cas.id,
        attempt,
        scenario_group: cas.scenario_group,
        description: cas.description,
        expected_behavior: cas.review.expected_behavior,
        market: cas.input.client_market,
        locale: cas.input.client_locale,
        message: cas.input.message,
        status: apiResult.status,
        duration_ms: Date.now() - startedAt,
        pass: score.pass,
        failures: score.failures,
        manual_review: createManualReview(REVIEW_DIMENSIONS),
        content: apiResult.content,
        raw: apiResult.raw,
      });
      console.log(`${score.pass ? 'PASS' : 'FAIL'} ${cas.id} attempt ${attempt} (${apiResult.status})`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const outPath = join(args.outDir, `real-output-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outPath, JSON.stringify({
    base_url: args.baseUrl,
    created_at: new Date().toISOString(),
    passed,
    total: results.length,
    cases: cases.length,
    repeats: args.repeats,
    human_review_required: results.length,
    results,
  }, null, 2));

  console.log(`result: ${passed}/${results.length}`);
  console.log(`saved: ${outPath}`);

  process.exit(passed === results.length ? 0 : 1);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
