import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKFLOW_FILE = 'd1-backup.yml';
const ISSUE_TITLE = 'D1 backup freshness alert';
const DEFAULT_MAX_AGE_HOURS = 12;

/**
 * Decide whether the latest successful production D1 backup is recent enough.
 *
 * Why this exists: the scheduled backup sat behind the `production` approval
 * gate from 2026-08-11 to 2026-09-14. Every nightly run was cancelled and
 * nothing noticed for five weeks. A backup that stops silently is worse than
 * one that fails loudly, so this check is deliberately independent of the
 * backup workflow and must never be put behind an approval gate itself.
 */
export function evaluateBackupFreshness({ latestSuccessAt, now, maxAgeMs }) {
  const latest = latestSuccessAt ? Date.parse(latestSuccessAt) : Number.NaN;
  if (!Number.isFinite(latest)) {
    return {
      fresh: false,
      ageMs: null,
      latestSuccessAt: null,
      reason: 'no successful d1-backup run was found',
    };
  }
  const ageMs = now - latest;
  const fresh = ageMs <= maxAgeMs;
  return {
    fresh,
    ageMs,
    latestSuccessAt: new Date(latest).toISOString(),
    reason: fresh
      ? 'the latest successful d1-backup run is inside the freshness window'
      : 'the latest successful d1-backup run is older than the freshness window',
  };
}

/** Which alert action the current state calls for. */
export function decideWatchdogAction({ fresh, hasOpenIssue }) {
  if (fresh && hasOpenIssue) return 'close-issue';
  if (!fresh && !hasOpenIssue) return 'open-issue';
  return 'none';
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

async function githubJson(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'sagemro-backup-freshness-watchdog',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function formatAge(ageMs) {
  if (ageMs === null) return 'never';
  return `${Math.floor(ageMs / 3_600_000)}h ${Math.floor((ageMs % 3_600_000) / 60_000)}m`;
}

function issueBody({ repository, verdict, maxAgeHours }) {
  return [
    '## The nightly production D1 backup has gone stale',
    '',
    `The \`${WORKFLOW_FILE}\` workflow has not produced a successful run within the last ${maxAgeHours} hours.`,
    '',
    `- Latest successful run: ${verdict.latestSuccessAt ?? 'none found'}`,
    `- Age: ${formatAge(verdict.ageMs)}`,
    `- Reason: ${verdict.reason}`,
    '',
    '### What to check, in order',
    '',
    `1. Open the run list: https://github.com/${repository}/actions/workflows/${WORKFLOW_FILE}`,
    '2. Cancelled runs usually mean another run is holding the `production-d1-backup` concurrency group. Cancel the stuck run so the next scheduled run can start.',
    '3. A failed run usually means the export, encryption, or artifact upload step broke. Read the first failing step of the `Export production D1 databases` job. Never print SQL or private keys into a log.',
    '4. If no run is listed at all, the schedule is disabled or the workflow file is broken.',
    '',
    'Run the workflow manually with **Run workflow** to close the gap once the cause is fixed. This issue closes automatically on the next healthy check.',
    '',
    '_Filed by `worker/scripts/backup-freshness-watchdog.mjs`. Do not edit the title: the watchdog matches it to avoid duplicate issues._',
  ].join('\n');
}

export async function runWatchdog({
  token,
  repository,
  now = Date.now(),
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
}) {
  const runs = await githubJson(
    `/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/runs?status=success&per_page=1`,
    { token },
  );
  const latestSuccessAt = runs?.workflow_runs?.[0]?.created_at ?? null;
  const verdict = evaluateBackupFreshness({
    latestSuccessAt,
    now,
    maxAgeMs: maxAgeHours * 3_600_000,
  });

  const issues = await githubJson(`/repos/${repository}/issues?state=open&per_page=100`, { token });
  const openIssue = (issues ?? []).find(
    (issue) => issue.title === ISSUE_TITLE && !issue.pull_request,
  ) ?? null;

  const action = decideWatchdogAction({ fresh: verdict.fresh, hasOpenIssue: Boolean(openIssue) });
  let issueNumber = openIssue?.number ?? null;

  if (action === 'open-issue') {
    const created = await githubJson(`/repos/${repository}/issues`, {
      token,
      method: 'POST',
      body: {
        title: ISSUE_TITLE,
        body: issueBody({ repository, verdict, maxAgeHours }),
      },
    });
    issueNumber = created?.number ?? null;
  } else if (action === 'close-issue') {
    await githubJson(`/repos/${repository}/issues/${openIssue.number}/comments`, {
      token,
      method: 'POST',
      body: {
        body: `Recovered. The latest successful backup is ${verdict.latestSuccessAt} (${formatAge(verdict.ageMs)} old). Closing automatically.`,
      },
    });
    await githubJson(`/repos/${repository}/issues/${openIssue.number}`, {
      token,
      method: 'PATCH',
      body: { state: 'closed' },
    });
  }

  return { verdict, action, issueNumber, maxAgeHours };
}

function summaryLines(report) {
  const { verdict, action, issueNumber, maxAgeHours } = report;
  return [
    `## D1 backup freshness: ${verdict.fresh ? 'OK' : 'STALE'}`,
    '',
    `- Window: ${maxAgeHours}h`,
    `- Latest successful run: ${verdict.latestSuccessAt ?? 'none found'}`,
    `- Age: ${formatAge(verdict.ageMs)}`,
    `- Verdict: ${verdict.reason}`,
    `- Issue action: ${action}${issueNumber ? ` (#${issueNumber})` : ''}`,
    '',
  ].join('\n');
}

export async function main() {
  const token = requireEnv('GITHUB_TOKEN');
  const repository = requireEnv('GITHUB_REPOSITORY');
  const maxAgeHours = Number(process.env.MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error('MAX_AGE_HOURS must be a positive number.');
  }

  const report = await runWatchdog({ token, repository, maxAgeHours });
  const summary = summaryLines(report);
  process.stdout.write(`${summary}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  }

  if (!report.verdict.fresh) {
    process.exitCode = 1;
  }
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
