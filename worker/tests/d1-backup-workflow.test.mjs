import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const workflowPath = resolve(import.meta.dirname, '../../.github/workflows/d1-backup.yml');
const actionPins = Object.freeze({
  checkout: 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
  setupNode: 'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
  uploadArtifact: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
});

function stepByName(job, name) {
  const step = job.steps.find((candidate) => candidate.name === name);
  assert.ok(step, `missing workflow step: ${name}`);
  return step;
}

test('production D1 backup workflow has scheduled production safeguards', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.backup;

  assert.equal(workflow.name, 'Production D1 Backup - COM and CN');
  assert.deepEqual(workflow.on.schedule, [{ cron: '17 18 * * *' }]);
  assert.deepEqual(workflow.on.workflow_dispatch, null);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.concurrency, {
    group: 'production-d1-backup',
    'cancel-in-progress': false,
  });
  assert.equal(job['runs-on'], 'ubuntu-latest');
  assert.equal(job.environment, 'production');
  assert.equal(job['timeout-minutes'], 30);
});

test('production credentials are scoped only to the D1 export step', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.backup;
  const exportStep = stepByName(job, 'Export COM and CN databases');

  assert.equal(job.env, undefined);
  assert.deepEqual(exportStep.env, {
    CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_D1_BACKUP_API_TOKEN }}',
    CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
  });
  for (const step of job.steps) {
    if (step === exportStep) continue;
    assert.equal(step.env, undefined, `${step.name} must not receive Cloudflare credentials`);
  }
});

test('third-party actions are pinned to reviewed commit SHAs', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.backup;

  assert.equal(stepByName(job, 'Checkout').uses, actionPins.checkout);
  assert.equal(stepByName(job, 'Setup Node').uses, actionPins.setupNode);
  assert.equal(stepByName(job, 'Upload COM backup').uses, actionPins.uploadArtifact);
  assert.equal(stepByName(job, 'Upload CN backup').uses, actionPins.uploadArtifact);
  for (const step of job.steps.filter((candidate) => candidate.uses)) {
    assert.match(step.uses, /@[0-9a-f]{40}$/);
  }
});

test('each market exports and uploads an independently verifiable artifact', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.backup;
  const prepare = stepByName(job, 'Prepare backup paths').run;
  const exportRun = stepByName(job, 'Export COM and CN databases').run;
  const validate = stepByName(job, 'Validate backups and write manifests').run;
  const comUpload = stepByName(job, 'Upload COM backup').with;
  const cnUpload = stepByName(job, 'Upload CN backup').with;

  assert.match(prepare, /COM_MANIFEST=.*com-sha256-manifest\.txt/);
  assert.match(prepare, /CN_MANIFEST=.*cn-sha256-manifest\.txt/);
  assert.match(prepare, /COM_METADATA=.*com-metadata\.txt/);
  assert.match(prepare, /CN_METADATA=.*cn-metadata\.txt/);
  assert.match(exportRun, /backup --market com --mode remote --confirm-production --output "\$COM_BACKUP"/);
  assert.match(exportRun, /backup --market cn --mode remote --confirm-production --output "\$CN_BACKUP"/);
  assert.match(validate, /find "\$COM_BACKUP" -type f -size \+100c/);
  assert.match(validate, /find "\$CN_BACKUP" -type f -size \+100c/);
  assert.match(validate, /sha256sum "\$\(basename "\$COM_BACKUP"\)" > "\$\(basename "\$COM_MANIFEST"\)"/);
  assert.match(validate, /sha256sum "\$\(basename "\$CN_BACKUP"\)" > "\$\(basename "\$CN_MANIFEST"\)"/);
  assert.match(validate, /echo "database=sagemro-db"\n\s+echo "git_sha=\$\{GITHUB_SHA\}"\n\} > "\$COM_METADATA"/);
  assert.match(validate, /echo "database=sagemro-db-cn"\n\s+echo "git_sha=\$\{GITHUB_SHA\}"\n\} > "\$CN_METADATA"/);

  assert.match(comUpload.name, /^sagemro-d1-com-/);
  assert.match(comUpload.path, /env\.COM_BACKUP/);
  assert.match(comUpload.path, /env\.COM_MANIFEST/);
  assert.match(comUpload.path, /env\.COM_METADATA/);
  assert.doesNotMatch(comUpload.path, /env\.CN_/);
  assert.equal(comUpload['retention-days'], 30);
  assert.equal(comUpload['if-no-files-found'], 'error');

  assert.match(cnUpload.name, /^sagemro-d1-cn-/);
  assert.match(cnUpload.path, /env\.CN_BACKUP/);
  assert.match(cnUpload.path, /env\.CN_MANIFEST/);
  assert.match(cnUpload.path, /env\.CN_METADATA/);
  assert.doesNotMatch(cnUpload.path, /env\.COM_/);
  assert.equal(cnUpload['retention-days'], 30);
  assert.equal(cnUpload['if-no-files-found'], 'error');
});

test('temporary backups are removed unconditionally without printing SQL', async () => {
  const workflow = parse(await readFile(workflowPath, 'utf8'));
  const job = workflow.jobs.backup;
  const cleanup = stepByName(job, 'Cleanup temporary backups');

  assert.equal(cleanup.if, 'always()');
  assert.match(cleanup.run, /rm -rf -- "\$BACKUP_DIR"/);
  for (const step of job.steps.filter((candidate) => candidate.run)) {
    assert.doesNotMatch(step.run, /\b(?:cat|head|tail|less|more)\s+[^\n]*\.sql\b/);
  }
});
