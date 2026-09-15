import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

import {
  decideWatchdogAction,
  evaluateBackupFreshness,
} from '../scripts/backup-freshness-watchdog.mjs';

const workflowPath = resolve(
  import.meta.dirname,
  '../../.github/workflows/backup-freshness-watchdog.yml',
);
const HOUR_MS = 3_600_000;
const NOW = Date.parse('2026-09-15T21:43:00Z');

test('a successful backup inside the window is fresh', () => {
  const verdict = evaluateBackupFreshness({
    latestSuccessAt: new Date(NOW - 3 * HOUR_MS).toISOString(),
    now: NOW,
    maxAgeMs: 12 * HOUR_MS,
  });

  assert.equal(verdict.fresh, true);
  assert.equal(verdict.ageMs, 3 * HOUR_MS);
  assert.equal(verdict.latestSuccessAt, new Date(NOW - 3 * HOUR_MS).toISOString());
});

test('a successful backup older than the window is stale', () => {
  const verdict = evaluateBackupFreshness({
    latestSuccessAt: new Date(NOW - 27 * HOUR_MS).toISOString(),
    now: NOW,
    maxAgeMs: 12 * HOUR_MS,
  });

  assert.equal(verdict.fresh, false);
  assert.equal(verdict.ageMs, 27 * HOUR_MS);
});

test('the window boundary itself is still fresh, and no run at all is stale', () => {
  const boundary = evaluateBackupFreshness({
    latestSuccessAt: new Date(NOW - 12 * HOUR_MS).toISOString(),
    now: NOW,
    maxAgeMs: 12 * HOUR_MS,
  });
  assert.equal(boundary.fresh, true);

  const missing = evaluateBackupFreshness({ latestSuccessAt: null, now: NOW, maxAgeMs: 12 * HOUR_MS });
  assert.equal(missing.fresh, false);
  assert.equal(missing.ageMs, null);
  assert.match(missing.reason, /no successful d1-backup run/);
});

test('an unparsable timestamp is treated as no backup rather than as fresh', () => {
  const verdict = evaluateBackupFreshness({
    latestSuccessAt: 'not-a-timestamp',
    now: NOW,
    maxAgeMs: 12 * HOUR_MS,
  });

  assert.equal(verdict.fresh, false);
  assert.equal(verdict.ageMs, null);
});

test('the watchdog opens an issue once, stays quiet, then closes it on recovery', () => {
  assert.equal(decideWatchdogAction({ fresh: false, hasOpenIssue: false }), 'open-issue');
  // 已经在报的故障不再重复开单，避免每天刷屏。
  assert.equal(decideWatchdogAction({ fresh: false, hasOpenIssue: true }), 'none');
  assert.equal(decideWatchdogAction({ fresh: true, hasOpenIssue: true }), 'close-issue');
  assert.equal(decideWatchdogAction({ fresh: true, hasOpenIssue: false }), 'none');
});

test('the watchdog workflow can never be put behind an approval gate', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.watchdog;

  // 这是这个 workflow 存在的唯一理由：它必须无人值守地跑。审批等待没有超时，
  // 一旦挂上门禁就可能像 2026-08-11 至 2026-09-14 的备份那样卡死并且没人知道。
  assert.equal(job.environment, undefined);
  assert.equal(workflow.on.schedule[0].cron, '43 21 * * *');
  assert.equal(workflow.on.workflow_dispatch, null);
  assert.equal(job['runs-on'], 'ubuntu-latest');
  assert.equal(job['timeout-minutes'], 10);
});

test('the watchdog can read Actions runs and file issues, and nothing more', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const steps = workflow.jobs.watchdog.steps;
  const checkStep = steps.find((step) => step.name === 'Check backup freshness');

  assert.deepEqual(workflow.permissions, {
    contents: 'read',
    actions: 'read',
    issues: 'write',
  });
  assert.ok(checkStep, 'missing workflow step: Check backup freshness');
  assert.equal(checkStep.run, 'node worker/scripts/backup-freshness-watchdog.mjs');
  assert.equal(checkStep.env.GITHUB_TOKEN, '${{ github.token }}');
  assert.equal(checkStep.env.MAX_AGE_HOURS, '12');
  // 不得复用备份用的 Cloudflare 凭据：这个检查完全不接触生产数据。
  assert.equal(checkStep.env.CLOUDFLARE_API_TOKEN, undefined);
});

test('the watchdog workflow pins its third-party actions', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));

  for (const step of workflow.jobs.watchdog.steps.filter((candidate) => candidate.uses)) {
    assert.match(step.uses, /@[0-9a-f]{40}$/, `${step.name} must pin a reviewed commit SHA`);
  }
});
