import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';

const vite = await createServer({ root: fileURLToPath(new URL('../..', import.meta.url)), logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
after(() => vite.close());
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const fixtureUser = { id: 's1', staffId: 's1', staffRole: 'business_specialist', businessGrade: 3, name: 'Example Specialist' };

test('business workbench loads only scoped APIs and specialists have no assignment action', async () => {
  const { BusinessWorkspacePage } = await vite.ssrLoadModule('/src/pages/BusinessWorkspacePage.jsx');
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const requests = [];
  globalThis.localStorage = { getItem: key => key === 'admin_user' ? JSON.stringify(fixtureUser) : null };
  globalThis.fetch = async url => {
    const path = new URL(url);
    requests.push(path);
    return Response.json(path.pathname.endsWith('/organization')
      ? { actor_staff_id: 's1', role: 'business_specialist', grade: 3, market: 'com', staff: [], territories: [{ id: 't1', name: 'Example territory', market: 'com' }], can_configure: false, can_assign: false, scope_version: '1' }
      : { records: [{ id: 'c1', name: 'Example customer', email: 'sample@example.invalid', assignment_revision: 1 }], total: 1, next_cursor: null, scope_version: '1' });
  };
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessWorkspacePage, { user: fixtureUser })); });
    assert.match(text(renderer.toJSON()), /Example customer/);
    assert.match(text(renderer.toJSON()), /Example territory/);
    assert.ok(requests.length >= 2);
    assert.ok(requests.every(url => url.pathname.startsWith('/api/admin/business/') && url.searchParams.get('expected_staff_id') === 's1'));
    assert.equal(renderer.root.findAllByType('button').some(button => text(button) === 'Assign ownership'), false);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});

test('business page clears stale records when the server rejects current identity', async () => {
  const { BusinessWorkspacePage } = await vite.ssrLoadModule('/src/pages/BusinessWorkspacePage.jsx');
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => key === 'admin_user' ? JSON.stringify(fixtureUser) : null };
  let reject = false;
  globalThis.fetch = async url => reject ? Response.json({ error: 'Identity changed', code: 'business_identity_changed' }, { status: 403 })
    : Response.json(new URL(url).pathname.endsWith('/organization')
      ? { actor_staff_id: 's1', staff: [], territories: [], role: 'business_specialist', grade: 1, can_assign: false, scope_version: '1' }
      : { records: [{ id: 'c1', name: 'Private fixture' }], total: 1, next_cursor: null, scope_version: '1' });
  let renderer;
  try {
    await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessWorkspacePage, { user: fixtureUser })); });
    assert.match(text(renderer.toJSON()), /Private fixture/);
    reject = true;
    const refresh = renderer.root.findAllByType('button').find(button => text(button) === 'Refresh');
    await act(async () => refresh.props.onClick());
    assert.doesNotMatch(text(renderer.toJSON()), /Private fixture/);
    assert.ok(renderer.root.findAllByProps({ role: 'alert' }).length);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});

test('business navigation uses the scoped workbench instead of legacy operations pages', async () => {
  const app = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /BusinessWorkspacePage/);
  assert.match(app, /isBusinessStaff/);
  assert.match(app, /businessWorkspace: 'Business workspace'/);
  assert.match(app, /businessWorkspace: '商务工作台'/);
});

test('fixed record entries load only their own kind and omit the old internal navigation', async () => {
  const { BusinessWorkspacePage } = await vite.ssrLoadModule('/src/pages/BusinessWorkspacePage.jsx');
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => key === 'admin_user' ? JSON.stringify(fixtureUser) : null };
  try {
    for (const kind of ['customer', 'lead', 'work_order', 'invalid', null]) {
      const requests = [];
      globalThis.fetch = async value => {
        const url = new URL(value); requests.push(url);
        return Response.json(url.pathname.endsWith('/organization')
          ? { actor_staff_id: 's1', role: 'business_specialist', staff: [], territories: [], can_assign: false, scope_version: 'fixture' }
          : { records: [], total: 0, next_cursor: null, scope_version: 'fixture' });
      };
      let renderer;
      try {
        await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessWorkspacePage, { user: fixtureUser, recordKind: kind })); });
        assert.equal(renderer.root.findAllByProps({ role: 'group', 'aria-label': 'Business workspace' }).length, 0);
        if (kind === null || kind === 'invalid') {
          assert.equal(requests.length, 0);
          assert.equal(renderer.root.findAllByProps({ role: 'alert' }).length, 1);
        } else {
          assert.deepEqual(requests.filter(url => url.pathname.endsWith('/records')).map(url => url.searchParams.get('kind')), [kind]);
          assert.doesNotMatch(text(renderer.toJSON()), /Business workspace/);
        }
      } finally { if (renderer) await act(async () => renderer.unmount()); }
    }
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('shared entry never mounts legacy management children for business or unknown roles', async () => {
  const { BusinessRecordsPage } = await vite.ssrLoadModule('/src/pages/BusinessRecordsPage.jsx');
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  let mounts = 0;
  function LegacyPage() { mounts++; return React.createElement('div', null, 'Legacy management fixture'); }
  globalThis.fetch = async value => Response.json(new URL(value).pathname.endsWith('/organization')
    ? { actor_staff_id: 's1', staff: [], territories: [], can_assign: false, scope_version: 'fixture' }
    : { records: [], total: 0, next_cursor: null, scope_version: 'fixture' });
  try {
    for (const role of ['business_director', 'business_manager', 'business_specialist', 'warehouse', 'unexpected']) {
      const user = { ...fixtureUser, staffRole: role };
      globalThis.localStorage = { getItem: key => key === 'admin_user' ? JSON.stringify(user) : null };
      let renderer;
      try {
        await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessRecordsPage, { user, kind: 'customer' }, React.createElement(LegacyPage))); });
        assert.equal(mounts, 0);
        assert.equal(renderer.root.findAllByType('button').some(button => text(button) === 'Record management'), false);
      } finally { if (renderer) await act(async () => renderer.unmount()); }
    }
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('business staff form shows inherited territories before a manager or specialist is saved', async () => {
  const { BusinessStaffFields } = await vite.ssrLoadModule('/src/components/BusinessOrganizationPanel.jsx');
  for (const [role, parentRole] of [['business_manager', 'business_director'], ['business_specialist', 'business_manager']]) {
    let renderer;
    try {
      await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessStaffFields, {
        value: { role, grade: 1, market_scope: 'com', supervisor_staff_id: 'parent-fixture' }, onChange() {},
        organization: { staff: [{ id: 'parent-fixture', display_name: 'Example parent', role: parentRole, is_active: 1, market_scope: 'com', effective_territory_ids: ['territory-fixture'] }], territories: [{ id: 'territory-fixture', name: 'Example inherited territory', market: 'com' }] },
      })); });
      assert.match(text(renderer.toJSON()), /Inherited territories/);
      assert.match(text(renderer.toJSON()), /Example inherited territory/);
    } finally { if (renderer) await act(async () => renderer.unmount()); }
  }
});

test('opening details pins the list scope and discards old rows after a changed or missing record', async () => {
  const { BusinessWorkspacePage } = await vite.ssrLoadModule('/src/pages/BusinessWorkspacePage.jsx');
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => key === 'admin_user' ? JSON.stringify(fixtureUser) : null };
  try {
    for (const status of [200, 404]) {
      const detailRequests = [];
      globalThis.fetch = async value => {
        const url = new URL(value);
        if (url.pathname.endsWith('/organization')) return Response.json({ actor_staff_id: 's1', staff: [], territories: [], role: 'business_specialist', grade: 1, can_assign: false, scope_version: '1' });
        if (url.pathname.endsWith('/records')) return Response.json({ records: [{ id: 'c1', name: 'Retained fixture' }, { id: 'c2', name: 'Revoked fixture' }], total: 2, next_cursor: null, scope_version: '1' });
        detailRequests.push(url);
        return Response.json(status === 404 ? { error: 'Not found' } : { record: { id: 'c1', name: 'Retained fixture' }, scope_version: '2' }, { status });
      };
      let renderer;
      try {
        await act(async () => { renderer = TestRenderer.create(React.createElement(BusinessWorkspacePage, { user: fixtureUser })); });
        const button = renderer.root.findAllByType('button').find(node => text(node) === 'View details');
        await act(async () => button.props.onClick());
        assert.equal(detailRequests[0].searchParams.get('scope_version'), '1');
        assert.doesNotMatch(text(renderer.toJSON()), /Revoked fixture/);
        assert.equal(renderer.root.findAllByProps({ role: 'dialog' }).length, 0);
      } finally { if (renderer) await act(async () => renderer.unmount()); }
    }
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});
