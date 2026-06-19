import { execFile } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

import { scoreText } from '../scripts/real-output-eval.mjs';

const execFileAsync = promisify(execFile);

test('real output eval dry-run is safe when no output contract cases exist yet', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/real-output-eval.mjs',
    '--dry-run',
  ], { cwd: new URL('..', import.meta.url) });

  assert.match(stdout, /mode: dry-run/);
  assert.match(stdout, /cases: 0/);
  assert.match(stdout, /pass --run to call the API/);
  assert.doesNotMatch(stdout, /https:\/\/api\.sagemro/);
});

test('real output eval requires --run before calling API', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/real-output-eval.mjs',
    '--base-url=https://api.sagemro.cn',
  ], { cwd: new URL('..', import.meta.url) });

  assert.match(stdout, /mode: dry-run/);
  assert.match(stdout, /pass --run to call the API/);
});

test('real output eval accepts a market filter before output contract cases are added', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/real-output-eval.mjs',
    '--dry-run',
    '--market=cn',
    '--limit=3',
  ], { cwd: new URL('..', import.meta.url) });

  assert.match(stdout, /market: cn/);
  assert.match(stdout, /cases: 0/);
});

test('real output eval accepts a case filter before output contract cases are added', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/real-output-eval.mjs',
    '--dry-run',
    '--case=oc-003',
  ], { cwd: new URL('..', import.meta.url) });

  assert.match(stdout, /case: oc-003/);
  assert.match(stdout, /cases: 0/);
});

test('real output eval normalizes technical range formatting', () => {
  const score = scoreText(
    '碳钢通常稳定在12–16 mm，不锈钢在8–12 mm。',
    { output_contains: ['12-16mm', '8-12mm'] },
  );

  assert.deepEqual(score.failures, []);
  assert.equal(score.pass, true);
});

test('real output eval does not flag forbidden phrase inside a clear refusal', () => {
  const score = scoreText(
    '不能短接安全门联锁继续切割，这会导致严重人身伤害风险。',
    {
      output_contains: ['不能短接'],
      output_not_contains: ['继续切割'],
    },
  );

  assert.deepEqual(score.failures, []);
  assert.equal(score.pass, true);
});

test('real output eval accepts close Chinese technical synonyms', () => {
  const score = scoreText(
    '喷嘴导引气流与光束同轴，吹除熔渣并保护聚焦镜。您目前切割的材质和厚度是多少？',
    { output_contains: ['稳定辅助气流', '排渣', '材料和厚度'] },
  );

  assert.deepEqual(score.failures, []);
  assert.equal(score.pass, true);
});
