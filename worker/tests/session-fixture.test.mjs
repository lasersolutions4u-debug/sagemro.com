import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withFixtureAccounts } from './helpers/session-jwt.mjs';

function databaseFixture() {
  const rows = new Map([['fictional-staff', {
    id: 'fictional-staff', password_hash: 'stored-fictional-hash', salt: 'stored-fictional-salt', is_active: 1,
  }]]);
  const env = withFixtureAccounts({ DB: {
    prepare() {
      let id;
      return { bind(value) { id = value; return this; }, async first() { return rows.get(id) || null; } };
    },
  } }, { admin_staff_accounts: [{ id: 'fictional-staff' }, { id: 'static-fictional-staff' }] });
  const read = id => env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(id).first();
  return { env, rows, read };
}

test('session fixtures preserve stored password rotation, empty credentials and inactive account state', async () => {
  const { rows, read } = databaseFixture();
  assert.deepEqual(await read('fictional-staff'), rows.get('fictional-staff'));
  rows.set('fictional-staff', { id: 'fictional-staff', password_hash: 'rotated-fictional-hash', salt: 'rotated-fictional-salt', is_active: 0 });
  assert.deepEqual(await read('fictional-staff'), rows.get('fictional-staff'));
  rows.get('fictional-staff').password_hash = '';
  assert.equal((await read('fictional-staff')).password_hash, '');
});

test('session fixtures never resurrect a deleted stored account from static fixture declarations', async () => {
  const { env, rows, read } = databaseFixture();
  assert.ok(await read('fictional-staff'));
  rows.delete('fictional-staff');
  assert.equal(await read('fictional-staff'), null);
  withFixtureAccounts(env, { admin_staff_accounts: [{ id: 'fictional-staff' }] });
  assert.equal(await read('fictional-staff'), null);
});

test('session fixtures supply only declared static accounts and leave unknown accounts missing', async () => {
  const { read } = databaseFixture();
  assert.equal(await read('undeclared-fictional-staff'), null);
  assert.equal((await read('static-fictional-staff')).id, 'static-fictional-staff');
});
