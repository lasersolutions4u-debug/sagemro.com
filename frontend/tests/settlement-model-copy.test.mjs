import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('engineer settings do not expose the retired wallet or internal settlement form', async () => {
  const source = await read('src/components/Settings/SettingsModal.jsx');

  assert.doesNotMatch(source, /Bank Account \(internal settlement\)/);
  assert.doesNotMatch(source, /收款账户（内部结算）/);
  assert.doesNotMatch(source, /bank_branch/);
  assert.doesNotMatch(source, /bank_account/);
});

test('retired wallet endpoints remain explicitly unavailable', async () => {
  const source = await read('../worker/src/index.js');

  assert.match(source, /\/api\/engineers\/wallet.*410/s);
  assert.match(source, /\/api\/engineers\/wallet\/withdraw.*410/s);
});

test('engineer profile response does not expose legacy wallet settlement fields', async () => {
  const source = await read('../worker/src/index.js');
  const profileHandler = source.match(/async function handleGetEngineerProfile[\s\S]*?\/\/ ============ 客户档案更新/)[0];
  const updateHandler = source.match(/async function handleUpdateEngineerProfile[\s\S]*?\/\/ ============ 修改密码/)[0];

  assert.doesNotMatch(profileHandler, /commission_rate/);
  assert.doesNotMatch(profileHandler, /wallet_balance/);
  assert.doesNotMatch(profileHandler, /deposit_balance/);
  assert.doesNotMatch(updateHandler, /commission_rate/);
});
