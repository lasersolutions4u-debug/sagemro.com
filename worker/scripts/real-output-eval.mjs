#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(__dirname, '..');
const goldenPath = join(workerRoot, 'tests', 'golden-set.json');

function parseArgs(argv) {
  const args = {
    run: false,
    dryRun: false,
    baseUrl: '',
    outDir: join(workerRoot, '.eval-runs'),
    limit: 0,
    market: '',
    caseId: '',
  };

  for (const arg of argv) {
    if (arg === '--run') args.run = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length).replace(/\/+$/, '');
    else if (arg.startsWith('--out-dir=')) args.outDir = resolve(workerRoot, arg.slice('--out-dir='.length));
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg.startsWith('--market=')) args.market = arg.slice('--market='.length);
    else if (arg.startsWith('--case=')) args.caseId = arg.slice('--case='.length);
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
  --base-url=<url>       API origin, for example https://api.sagemro.cn.
  --market=<cn|com>      Optional market filter for output_contract cases.
  --case=<id>            Optional exact case id, for example oc-003.
  --out-dir=<path>       Result directory. Default: worker/.eval-runs
  --limit=<n>            Optional case limit for a quick manual sample.
`);
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

export function scoreText(text, expect) {
  const failures = [];
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

async function callCase(baseUrl, cas) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: cas.input.origin,
    },
    body: JSON.stringify({
      conversation_id: `real-eval-${cas.id}-${Date.now()}`,
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

  await mkdir(args.outDir, { recursive: true });

  const results = [];
  for (const cas of cases) {
    const startedAt = Date.now();
    const apiResult = await callCase(args.baseUrl, cas);
    const score = scoreText(apiResult.content, cas.expect);
    results.push({
      id: cas.id,
      description: cas.description,
      market: cas.input.client_market,
      locale: cas.input.client_locale,
      message: cas.input.message,
      status: apiResult.status,
      duration_ms: Date.now() - startedAt,
      pass: score.pass,
      failures: score.failures,
      content: apiResult.content,
      raw: apiResult.raw,
    });
    console.log(`${score.pass ? 'PASS' : 'FAIL'} ${cas.id} (${apiResult.status})`);
  }

  const passed = results.filter((r) => r.pass).length;
  const outPath = join(args.outDir, `real-output-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(outPath, JSON.stringify({
    base_url: args.baseUrl,
    created_at: new Date().toISOString(),
    passed,
    total: results.length,
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
