import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('retired frontend API clients stay out of the China application bundle', async () => {
  const source = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');

  for (const name of [
    'uploadChatImage',
    'addWorkOrderMaterialItem',
    'getRecommendedEngineers',
    'getEngineerWallet',
    'applyWithdraw',
    'getCustomerReviews',
    'getRepairRecord',
  ]) {
    assert.doesNotMatch(source, new RegExp(`export async function ${name}\\b`));
  }
});
