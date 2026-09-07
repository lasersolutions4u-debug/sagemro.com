import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transformWithOxc } from 'vite';

const apiSource = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');

test('service profile API uses authenticated self route and preserves conflict status', async () => {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: requests.length !== 3, status: 409, json: async () => requests.length === 3 ? { code: 'service_profile_conflict', error: 'Changed' } : { revision: 1, profile: { version: 1, hourly_rate: null } } };
  };
  const getSource = apiSource.match(/export async function getEngineerServiceProfile\([^]*?\n\}/)?.[0];
  const putSource = apiSource.match(/export async function saveEngineerServiceProfile\([^]*?\n\}/)?.[0];
  assert.ok(getSource, 'self read API exists');
  assert.ok(putSource, 'revision write API exists');
  const { getEngineerServiceProfile, saveEngineerServiceProfile } = new Function('fetch', 'API_BASE', 'authHeaders', `${getSource.replace('export ', '')}\n${putSource.replace('export ', '')}\nreturn { getEngineerServiceProfile, saveEngineerServiceProfile };`)(fetch, 'https://fixture.invalid', () => ({ Authorization: 'fixture' }));
  await getEngineerServiceProfile('engineer-a');
  await saveEngineerServiceProfile({ revision: 0, profile: { version: 1, hourly_rate: null } }, 'engineer-a');
  assert.equal(requests[0].url, 'https://fixture.invalid/api/engineers/service-profile?expected_engineer_id=engineer-a');
  assert.equal(requests[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].options.body), { expected_engineer_id: 'engineer-a', revision: 0, profile: { version: 1, hourly_rate: null } });
  await assert.rejects(saveEngineerServiceProfile({ revision: 0, profile: { version: 1 } }, 'engineer-a'), error => error.status === 409 && error.code === 'service_profile_conflict');
});

async function formHarness({ get, save, cn = false }) {
  const source = readFileSync(new URL('../src/components/Engineer/EngineerServiceProfileForm.jsx', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export function EngineerServiceProfileForm', 'function EngineerServiceProfileForm');
  const transformed = await transformWithOxc(source, 'EngineerServiceProfileForm.jsx', { lang: 'jsx', format: 'esm', jsx: { runtime: 'classic', pragma: 'element' } });
  const slots = [];
  const effects = [];
  const storage = new Map([['sagemro_user', JSON.stringify({ id: 'fixture' })], ['sagemro_user_type', 'engineer']]);
  const listeners = new Set();
  const browser = { localStorage: { getItem: key => storage.get(key) ?? null }, addEventListener: (name, handler) => { if (name === 'storage') listeners.add(handler); }, removeEventListener: (name, handler) => listeners.delete(handler), location: { reload() {} } };
  let cursor = 0;
  const runtime = {
    window: browser,
    React: { Fragment: 'fragment' },
    element: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity).filter(Boolean) } }),
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: initial => { const index = cursor++; return slots[index] ||= { current: initial }; },
    useId: () => 'fixture-id',
    useCallback: (callback, deps) => { const index = cursor++; const old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) slots[index] = { deps, callback }; return slots[index].callback; },
    useEffect: (effect, deps) => { const index = cursor++; const old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) { old?.cleanup?.(); slots[index] = { deps }; effects.push(() => { slots[index].cleanup = effect(); }); } },
    getEngineerServiceProfile: get,
    saveEngineerServiceProfile: save,
    isCnLocale: () => cn,
  };
  const code = transformed.code.replace(/export\s*\{[^]*?\};?/g, '');
  const Component = new Function(...Object.keys(runtime), `${code}\nreturn EngineerServiceProfileForm;`)(...Object.values(runtime));
  let tree;
  const render = (engineerId = 'fixture') => { cursor = 0; tree = Component({ engineerId }); while (effects.length) effects.shift()(); return tree; };
  const nodes = () => { const list = []; const walk = node => { if (!node || typeof node !== 'object') return; list.push(node); node.props?.children?.forEach(walk); }; walk(tree); return list; };
  return { render, nodes, storage, browser, setIdentity: id => storage.set('sagemro_user', JSON.stringify({ id })), emitStorage: key => listeners.forEach(handler => handler({ key, storageArea: browser.localStorage })), field: name => nodes().find(node => node.props?.name === name), button: text => nodes().find(node => node.type === 'button' && JSON.stringify(node.props.children).includes(text)), unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const empty = { profile: null, revision: 0, updated_at: null };

test('service profile form loads, preserves null money, saves then reads back, and has no fabricated defaults', async () => {
  let reads = 0;
  let submitted;
  const form = await formHarness({ get: async () => { reads++; return submitted ? { ...submitted, revision: 1 } : empty; }, save: async body => { submitted = body; return { ...body, revision: 1 }; } });
  form.render(); await tick(); form.render();
  assert.equal(form.field('hourly_rate').props.value, '');
  assert.equal(form.field('currency').props.value, '');
  assert.ok(form.nodes().some(node => node.type === 'details'));
  form.field('currency').props.onChange({ target: { value: 'USD' } });
  form.render();
  await form.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  form.render();
  assert.equal(submitted.profile.hourly_rate, null);
  assert.equal(submitted.profile.currency, 'USD');
  assert.equal(submitted.revision, 0);
  assert.equal(reads, 2);
  assert.match(JSON.stringify(form.render()), /Self-reported|self-reported/);
});

test('service profile conflict retains draft and blocks resubmit until explicit reconciliation', async () => {
  let calls = 0;
  const form = await formHarness({ get: async () => ({ ...empty, revision: 2, profile: { version: 1, hourly_rate: '20' } }), save: async () => { calls++; throw Object.assign(new Error('Changed'), { status: 409 }); } });
  form.render(); await tick(); form.render();
  form.field('hourly_rate').props.onChange({ target: { value: '30' } }); form.render();
  await form.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); form.render();
  assert.equal(form.field('hourly_rate').props.value, '30');
  assert.equal(form.button('Save draft').props.disabled, true);
  assert.equal(calls, 1);
  await form.button('Load latest for comparison').props.onClick(); form.render();
  assert.equal(form.field('hourly_rate').props.value, '30');
  assert.ok(form.button('Keep my draft'));
});

test('service profile modal unmounts on close and keys the form by engineer identity', () => {
  const source = readFileSync(new URL('../src/components/Engineer/EngineerProfileModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /isOpen && engineerId &&/);
  assert.match(source, /EngineerServiceProfileForm key=\{engineerId\} engineerId=\{engineerId\}/);
});

test('service profile loading failure can be retried without enabling blank accidental saves', async () => {
  let reads = 0;
  const form = await formHarness({ get: async () => { if (++reads === 1) throw new Error('offline'); return { ...empty, profile: { version: 1, hourly_rate: '15' }, revision: 1 }; }, save: async () => assert.fail('must not save while unloaded') });
  form.render(); await tick(); form.render();
  assert.equal(form.field('hourly_rate'), undefined);
  assert.ok(form.nodes().find(node => node.props?.role === 'alert'));
  form.button('Retry loading').props.onClick(); form.render(); await tick(); form.render();
  assert.equal(form.field('hourly_rate').props.value, '15');
  assert.equal(reads, 2);
});

test('service profile ignores stale loads after identity changes and unmounts', async () => {
  const pending = [];
  const form = await formHarness({ get: () => new Promise(resolve => pending.push(resolve)), save: async () => ({}) });
  form.setIdentity('engineer-a');
  form.render('engineer-a');
  form.setIdentity('engineer-b');
  form.render('engineer-b');
  pending[1]({ profile: { version: 1, hourly_rate: '20' }, revision: 1 }); await tick(); form.render('engineer-b');
  form.field('hourly_rate').props.onChange({ target: { value: '35' } }); form.render('engineer-b');
  pending[0]({ profile: { version: 1, hourly_rate: '99' }, revision: 1 }); await tick(); form.render('engineer-b');
  assert.equal(form.field('hourly_rate').props.value, '35');
  form.setIdentity('engineer-c');
  form.render('engineer-c');
  form.unmount();
  pending[2]({ profile: { version: 1, hourly_rate: '999' }, revision: 1 }); await tick(); form.render('engineer-c');
  assert.equal(form.field('hourly_rate'), undefined);
});

test('service profile blocks duplicate inflight saves and preserves draft after failure', async () => {
  let rejectSave;
  let saves = 0;
  const form = await formHarness({ get: async () => empty, save: () => { saves++; return new Promise((resolve, reject) => { rejectSave = reject; }); } });
  form.render(); await tick(); form.render();
  form.field('hourly_rate').props.onChange({ target: { value: '10.50' } }); form.render();
  const submit = form.nodes().find(node => node.type === 'form').props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(saves, 1);
  rejectSave(new Error('offline')); await pending; form.render();
  assert.equal(form.field('hourly_rate').props.value, '10.50');
  assert.ok(form.nodes().find(node => node.props?.role === 'alert'));
});

test('service profile clears confidential drafts after cross-tab identity or role changes and ignores late results', async () => {
  for (const kind of ['account', 'role', 'clear']) {
    let resolveLatest;
    let reads = 0;
    const form = await formHarness({ get: () => ++reads === 1 ? Promise.resolve({ profile: { version: 1, hourly_rate: '125.50' }, revision: 0 }) : new Promise(resolve => { resolveLatest = resolve; }), save: async () => { throw Object.assign(new Error('changed'), { status: 409 }); } });
    form.render(); await tick(); form.render();
    await form.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); form.render();
    const loading = form.button('Load latest for comparison').props.onClick();
    if (kind === 'account') { form.setIdentity('engineer-b'); form.emitStorage('sagemro_user'); }
    if (kind === 'role') { form.storage.set('sagemro_user_type', 'customer'); form.emitStorage('sagemro_user_type'); }
    if (kind === 'clear') { form.storage.clear(); form.emitStorage(null); }
    form.render();
    assert.equal(form.field('hourly_rate'), undefined, kind);
    assert.ok(form.button('Reload page'), kind);
    resolveLatest({ profile: { version: 1, hourly_rate: '999.99' }, revision: 1 }); await loading; form.render();
    assert.equal(JSON.stringify(form.nodes()).includes('999.99'), false, kind);
    assert.equal(JSON.stringify(form.nodes()).includes('125.50'), false, kind);
    assert.equal(form.button('Load latest for comparison'), undefined, kind);
  }
});

test('service profile checks identity synchronously before save and comparison and keeps same-account CSRF rotations', async () => {
  let writes = 0;
  let reads = 0;
  const form = await formHarness({ get: async engineerId => { assert.equal(engineerId, 'fixture'); reads++; return empty; }, save: async (body, engineerId) => { assert.equal(engineerId, 'fixture'); writes++; throw Object.assign(new Error('changed'), { status: 409 }); } });
  form.render(); await tick(); form.render();
  form.field('hourly_rate').props.onChange({ target: { value: '125.50' } }); form.render();
  form.storage.set('sagemro_csrf', 'rotated'); form.emitStorage('sagemro_csrf'); form.emitStorage('sagemro_user'); form.render();
  assert.equal(form.field('hourly_rate').props.value, '125.50');
  await form.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); form.render();
  assert.equal(writes, 1);
  form.setIdentity('engineer-b');
  await form.button('Load latest for comparison').props.onClick(); form.render();
  assert.equal(reads, 1);
  assert.ok(form.button('Reload page'));
  const unsaved = await formHarness({ get: async () => empty, save: async () => { writes++; } });
  unsaved.render(); await tick(); unsaved.render();
  unsaved.setIdentity('engineer-b');
  await unsaved.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); unsaved.render();
  assert.equal(writes, 1);
  assert.ok(unsaved.button('Reload page'));
});

test('service profile closes on server identity rejection even when local storage still has the old account', async () => {
  const changed = () => Object.assign(new Error('Account changed'), { status: 403, code: 'engineer_identity_changed' });
  for (const phase of ['read', 'save', 'read-back']) {
    let reads = 0;
    const form = await formHarness({ get: async () => { reads++; if (phase === 'read' || (phase === 'read-back' && reads === 2)) throw changed(); return { profile: { version: 1, hourly_rate: '125.50' }, revision: 0 }; }, save: async body => { if (phase === 'save') throw changed(); return { ...body, revision: 1 }; } });
    form.render(); await tick(); form.render();
    if (phase !== 'read') { await form.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); form.render(); }
    assert.ok(form.button('Reload page'), phase);
    assert.equal(form.field('hourly_rate'), undefined, phase);
    assert.equal(JSON.stringify(form.nodes()).includes('125.50'), false, phase);
  }
});
