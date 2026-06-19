import { execFile } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('real output eval dry-run lists output contract cases without network', async () => {
  const { stdout } = await execFileAsync('node', [
    'scripts/real-output-eval.mjs',
    '--dry-run',
  ], { cwd: new URL('..', import.meta.url) });

  assert.match(stdout, /mode: dry-run/);
  assert.match(stdout, /cases: 10/);
  assert.match(stdout, /oc-001/);
  assert.match(stdout, /oc-010/);
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
