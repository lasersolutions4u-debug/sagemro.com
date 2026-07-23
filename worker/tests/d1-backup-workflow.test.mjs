import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowPath = resolve(import.meta.dirname, '../../.github/workflows/d1-backup.yml');

test('production D1 backup workflow protects and exports both markets', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /^name:\s*.*production.*D1.*backup/im);
  assert.match(workflow, /^\s*schedule:\s*$/m);
  assert.match(workflow, /^\s*- cron:\s*['"]?\d+\s+\d+\s+\*\s+\*\s+\*['"]?\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
  assert.match(workflow, /^concurrency:\s*\n\s+group:\s*\S+\s*\n\s+cancel-in-progress:\s*false\s*$/m);
  assert.match(workflow, /^\s+runs-on:\s*ubuntu-latest\s*$/m);
  assert.match(workflow, /^\s+environment:\s*production\s*$/m);
  assert.match(workflow, /^\s+timeout-minutes:\s*\d+\s*$/m);
  assert.match(workflow, /actions\/checkout@v\d+/);
  assert.match(workflow, /actions\/setup-node@v\d+/);
  assert.match(workflow, /npm ci[^\n]*/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN:\s*\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\}/);

  assert.match(workflow, /node scripts\/d1-operations\.mjs backup --market com --mode remote[^\n]*--confirm-production[^\n]*--output/);
  assert.match(workflow, /node scripts\/d1-operations\.mjs backup --market cn --mode remote[^\n]*--confirm-production[^\n]*--output/);
  assert.match(workflow, /sagemro-db-\$\{[^\n]+\.sql/);
  assert.match(workflow, /sagemro-db-cn-\$\{[^\n]+\.sql/);
  assert.match(workflow, /find[^\n]*-type f[^\n]*-size \+100c/);
  assert.match(workflow, /sha256sum[^\n]*COM_BACKUP[^\n]*CN_BACKUP[^\n]*>[^\n]*MANIFEST/);

  assert.match(workflow, /name:\s*sagemro-d1-com-/);
  assert.match(workflow, /name:\s*sagemro-d1-cn-/);
  assert.equal((workflow.match(/retention-days:\s*30/g) || []).length, 2);
  assert.match(workflow, /if:\s*always\(\)/);
  assert.match(workflow, /rm\s+-rf[^\n]*BACKUP_DIR/);
  assert.doesNotMatch(workflow, /\b(?:cat|head|tail|less|more)\s+[^\n]*\.sql\b/);
});
