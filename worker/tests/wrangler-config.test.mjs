import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const wranglerTomlPath = resolve(import.meta.dirname, '../wrangler.toml');

test('committed wrangler config does not include development bypass verification codes', async () => {
  const config = await readFile(wranglerTomlPath, 'utf8');

  assert.doesNotMatch(config, /^\s*DEV_BYPASS_CODE\s*=/m);
});

test('R2 绑定指向附件桶（现场证据随工单体系下线）', async () => {
  const config = await readFile(wranglerTomlPath, 'utf8');

  // FIELD_EVIDENCE 私有桶随工单体系一并下架；CN 只剩附件桶，生产环境同样绑定。
  assert.match(config, /\[\[r2_buckets\]\]\s*binding\s*=\s*"ATTACHMENTS"\s*bucket_name\s*=\s*"sagemro-attachments"/m);
  assert.match(config, /\[\[env\.production\.r2_buckets\]\]\s*binding\s*=\s*"ATTACHMENTS"\s*bucket_name\s*=\s*"sagemro-attachments"/m);
  assert.doesNotMatch(config, /FIELD_EVIDENCE/);
});
