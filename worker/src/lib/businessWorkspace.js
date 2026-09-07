import { isBusinessRole, marketAllows, resolveStaffIdentity, resolveBusinessHierarchy } from './businessIdentity.js';

export class BusinessError extends Error {
  constructor(message, status = 400, code = 'invalid_business_request') { super(message); this.status = status; this.code = code; }
}
const fail = (message, status, code) => { throw new BusinessError(message, status, code); };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const bootstrap = (auth) => auth?.userType === 'admin' && !auth.staffId && auth.userId === 'admin';
const textId = (v) => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 128;
const revision = (v) => Number.isSafeInteger(v) && v >= 0;

export function assertBusinessIdentity(auth, expected) {
  if (!textId(expected)) fail('Expected staff identity is required');
  if (expected !== (auth.staffId || (bootstrap(auth) ? 'admin' : ''))) fail('Staff identity changed', 403, 'staff_identity_changed');
}

export async function businessEpoch(env) {
  return (await env.DB.prepare('SELECT revision FROM business_scope_version WHERE id = 1').first()).revision;
}
export async function businessScopeVersion(auth, market, epoch) {
  const rawVersion = JSON.stringify([auth.staffId || 'admin', market, epoch]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawVersion));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function businessEpochGuard(env, epoch) {
  return env.DB.prepare("SELECT CASE WHEN revision = ? THEN 1 ELSE json('business scope changed') END FROM business_scope_version WHERE id = 1").bind(epoch);
}
const mutationGuard = (env) => env.DB.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('business revision changed') END");
function audit(env, auth, targetType, targetId, action, before, after) {
  return env.DB.prepare('INSERT INTO audit_logs(id,actor_type,actor_id,target_type,target_id,action,before_state,after_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), 'admin', auth.staffId || auth.userId, targetType, targetId, action, before ? JSON.stringify(before) : null, JSON.stringify(after));
}

export async function prepareBusinessProfile(env, account, body) {
  const { role, grade } = body;
  const supervisor = body.supervisor_staff_id ?? null;
  const territoryIds = body.territory_ids ?? [];
  if (!isBusinessRole(role) || ![1, 2, 3].includes(grade) || !Array.isArray(territoryIds)
    || territoryIds.length > 200 || territoryIds.some(id => !textId(id)) || new Set(territoryIds).size !== territoryIds.length) fail('Invalid business role, grade or territories');
  if (role === 'business_director') {
    if (supervisor !== null) fail('A director cannot have a supervisor');
  } else {
    if (!textId(supervisor) || supervisor === account.id || territoryIds.length) fail('A manager or specialist requires a valid supervisor and no direct territory grants');
    const parent = await resolveStaffIdentity(env, supervisor);
    if (!parent || parent.role !== (role === 'business_manager' ? 'business_director' : 'business_manager')) fail('Invalid or inactive supervisor');
    const markets = account.market_scope === 'all' ? ['com', 'cn'] : [account.market_scope];
    for (const market of markets) if (!await resolveStaffIdentity(env, supervisor, market)) fail('Supervisor does not cover the account market');
  }
  for (const id of territoryIds) {
    const territory = await env.DB.prepare('SELECT id, market FROM business_territories WHERE id = ?').bind(id).first();
    if (!territory || !marketAllows(account, territory.market)) fail('Territory is outside the staff market');
  }
  return { role, grade, supervisor_staff_id: supervisor, territory_ids: territoryIds };
}

export function businessProfileStatements(env, staffId, profile) {
  return [
    env.DB.prepare('INSERT INTO business_staff_profiles(staff_id,role,grade,supervisor_staff_id) VALUES (?,?,?,?)')
      .bind(staffId, profile.role, profile.grade, profile.supervisor_staff_id),
    ...profile.territory_ids.map(id => env.DB.prepare('INSERT INTO business_director_territories(staff_id,territory_id) VALUES (?,?)').bind(staffId, id)),
  ];
}

export async function scope(env, auth, market) {
  if (auth?.userType !== 'admin') fail('Business workspace access denied', 403);
  const epoch = await businessEpoch(env);
  const isRoot = bootstrap(auth);
  const actor = auth.staffId ? await resolveStaffIdentity(env, auth.staffId, market) : null;
  const role = isRoot ? 'admin' : actor?.role;
  if (auth.market !== market || (!isRoot && !actor) || (role !== 'admin' && !isBusinessRole(role))) fail('Business workspace access denied', 403);
  const rows = (await env.DB.prepare(`
    SELECT a.id,a.display_name,a.is_active,a.market_scope,a.business_profile_required,a.role AS legacy_role,
      p.role,p.grade,p.supervisor_staff_id,p.revision
    FROM admin_staff_accounts a LEFT JOIN business_staff_profiles p ON p.staff_id=a.id ORDER BY a.id
  `).all()).results || [];
  const valid = [];
  const profiles = new Map(rows.map(row => [row.id, { ...row, staff_id: row.id, raw_role: row.legacy_role }]));
  for (const row of rows) {
    const director = await resolveBusinessHierarchy(profiles.get(row.id), id => profiles.get(id), market);
    if (director) valid.push({ ...row, director_id: director.staff_id });
  }
  const allowed = role === 'admin' ? valid : valid.filter(row => row.id === actor.id
    || (role === 'business_director' && row.director_id === actor.id)
    || (role === 'business_manager' && row.supervisor_staff_id === actor.id && row.role === 'business_specialist'));
  const grants = (await env.DB.prepare('SELECT staff_id,territory_id FROM business_director_territories ORDER BY staff_id,territory_id').all()).results || [];
  const allTerritories = (await env.DB.prepare('SELECT id,name,market FROM business_territories ORDER BY id').all()).results || [];
  const territories = allTerritories.filter(t => t.market === market && (role === 'admin'
    || grants.some(g => g.staff_id === actor.businessDirectorId && g.territory_id === t.id)));
  const version = await businessScopeVersion(auth, market, epoch);
  const projected = (isRoot ? rows : allowed).map(row => ({
    id: row.id, display_name: row.display_name, is_active: row.is_active, market_scope: row.market_scope,
    role: row.business_profile_required ? row.role : row.legacy_role, grade: row.grade ?? null,
    supervisor_staff_id: row.supervisor_staff_id ?? null, revision: row.revision ?? 0,
    business_profile_required: Boolean(row.business_profile_required),
    territory_ids: grants.filter(g => g.staff_id === row.id && (isRoot || territories.some(t => t.id === g.territory_id))).map(g => g.territory_id),
    effective_territory_ids: grants.filter(g => g.staff_id === valid.find(v => v.id === row.id)?.director_id
      && allTerritories.some(t => t.id === g.territory_id && t.market === market)).map(g => g.territory_id),
  }));
  return { actor, role, epoch, version, owners: allowed.map(row => row.id), territories,
    organization: { actor_staff_id: auth.staffId || 'admin', market, role, grade: actor?.businessGrade ?? null,
      can_configure: isRoot, can_assign: role !== 'business_specialist', staff: projected,
      territories: isRoot ? allTerritories : territories, scope_version: version } };
}

const recordTypes = {
  customer: { table: 'customers', columns: 'r.id,r.user_no,r.name,r.company,r.email,r.phone,r.region,r.city,r.created_at' },
  lead: { table: 'leads', columns: 'r.id,r.name,r.email,r.phone,r.source,r.source_type,r.interest,r.message,r.status,r.region,r.created_at' },
  work_order: { table: 'work_orders', columns: 'r.id,r.order_no,r.short_title,r.type,r.description,r.status,r.urgency,r.created_at' },
};
function predicate(s, market) {
  if (s.role === 'admin') return { sql: '(a.record_id IS NULL OR t.market = ?)', args: [market] };
  if (!s.owners.length || !s.territories.length) return { sql: '0', args: [] };
  return { sql: 't.market = ? AND a.owner_staff_id IN (SELECT value FROM json_each(?)) AND a.territory_id IN (SELECT value FROM json_each(?))',
    args: [market, JSON.stringify(s.owners), JSON.stringify(s.territories.map(t => t.id))] };
}
function recordQuery(kind, s, market) {
  const type = recordTypes[kind];
  if (!type) fail('Invalid record kind');
  const p = predicate(s, market);
  return { select: `SELECT ${type.columns},a.territory_id,a.owner_staff_id,COALESCE(a.revision,0) AS assignment_revision`,
    from: ` FROM ${type.table} r LEFT JOIN business_record_assignments a ON a.kind = ? AND a.record_id = r.id LEFT JOIN business_territories t ON t.id=a.territory_id WHERE ${p.sql}`,
    args: [kind, ...p.args] };
}
export async function detail(env, kind, id, s, market) {
  const q = recordQuery(kind, s, market);
  const record = await env.DB.prepare(q.select + q.from + ' AND r.id = ?').bind(...q.args, id).first();
  if (!record) fail('Record not found', 404, 'business_record_not_found');
  return record;
}
export async function ensureEpoch(env, s) {
  if (await businessEpoch(env) !== s.epoch) fail('Business scope changed; reload the workspace', 409, 'business_scope_changed');
}

export async function handleBusinessWorkspace(request, env, market) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.slice('/api/admin/business'.length);
    const body = ['POST', 'PUT'].includes(request.method) ? await request.json().catch(() => null) : null;
    const expected = body ? body.expected_staff_id : url.searchParams.get('expected_staff_id');
    if (!body && url.searchParams.getAll('expected_staff_id').length !== 1) fail('Expected staff identity is required');
    assertBusinessIdentity(request._auth, expected);
    const s = await scope(env, request._auth, market);
    const requestedVersion = body?.scope_version ?? url.searchParams.get('scope_version');
    if (requestedVersion !== null && requestedVersion !== undefined && requestedVersion !== s.version) fail('Business scope changed; reload the workspace', 409, 'business_scope_changed');
    if (path === '/organization' && request.method === 'GET') {
      await ensureEpoch(env, s);
      return reply(s.organization);
    }
    if (path === '/records' && request.method === 'GET') {
      const kind = url.searchParams.get('kind');
      const q = recordQuery(kind, s, market);
      const rawLimit = url.searchParams.get('limit');
      const limit = rawLimit === null ? 50 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) fail('Limit must be from 1 to 200');
      let after = '';
      const cursor = url.searchParams.get('cursor');
      if (cursor) {
        if (!requestedVersion) fail('Scope version is required with a cursor');
        try {
          const decoded = JSON.parse(atob(cursor));
          if (decoded.kind !== kind || decoded.scope_version !== s.version || !textId(decoded.after)) fail('Invalid cursor');
          after = decoded.after;
        } catch { fail('Invalid cursor'); }
      }
      const rows = (await env.DB.prepare(q.select + q.from + ' AND r.id > ? ORDER BY r.id ASC LIMIT ?').bind(...q.args, after, limit + 1).all()).results || [];
      const total = (await env.DB.prepare('SELECT COUNT(*) AS total' + q.from).bind(...q.args).first()).total;
      const records = rows.slice(0, limit);
      const next = rows.length > limit ? btoa(JSON.stringify({ kind, after: records.at(-1).id, scope_version: s.version })) : null;
      await ensureEpoch(env, s);
      return reply({ records, total, next_cursor: next, scope_version: s.version });
    }
    const recordPath = path.match(/^\/records\/(customer|lead|work_order)\/([^/]+)(\/assignment)?$/);
    if (recordPath && request.method === 'GET' && !recordPath[3]) {
      const record = await detail(env, recordPath[1], decodeURIComponent(recordPath[2]), s, market);
      await ensureEpoch(env, s);
      return reply({ record, scope_version: s.version });
    }
    if (recordPath && request.method === 'PUT' && recordPath[3]) {
      if (s.role === 'business_specialist') fail('Specialists cannot reassign records', 403);
      const kind = recordPath[1], id = decodeURIComponent(recordPath[2]);
      const before = await detail(env, kind, id, s, market);
      if (!revision(body.revision) || !textId(body.territory_id) || !textId(body.owner_staff_id)) fail('Invalid assignment');
      if (before.assignment_revision !== body.revision) fail('Assignment revision changed', 409, 'business_revision_changed');
      const owner = await resolveStaffIdentity(env, body.owner_staff_id, market);
      const territory = s.territories.find(t => t.id === body.territory_id);
      const grant = owner ? await env.DB.prepare('SELECT staff_id FROM business_director_territories WHERE staff_id=? AND territory_id=?').bind(owner.businessDirectorId || '', body.territory_id).first() : null;
      if (!owner || !isBusinessRole(owner.role) || !territory || !grant || (s.role !== 'admin' && !s.owners.includes(owner.id))) fail('Assignment target is outside the permitted scope', 403);
      const mutation = before.owner_staff_id
        ? env.DB.prepare("UPDATE business_record_assignments SET territory_id=?,owner_staff_id=?,revision=revision+1,updated_at=datetime('now') WHERE kind=? AND record_id=? AND revision=?").bind(body.territory_id, owner.id, kind, id, body.revision)
        : env.DB.prepare('INSERT INTO business_record_assignments(kind,record_id,territory_id,owner_staff_id,revision) VALUES (?,?,?,?,1)').bind(kind, id, body.territory_id, owner.id);
      await env.DB.batch([businessEpochGuard(env, s.epoch), mutation, mutationGuard(env),
        audit(env, request._auth, 'business_assignment', kind + ':' + id, 'business_assignment_changed',
          { territory_id: before.territory_id, owner_staff_id: before.owner_staff_id, revision: before.assignment_revision },
          { territory_id: body.territory_id, owner_staff_id: owner.id, revision: body.revision + 1 })]);
      const nextScope = await scope(env, request._auth, market);
      const record = await detail(env, kind, id, nextScope, market);
      await ensureEpoch(env, nextScope);
      return reply({ record, scope_version: nextScope.version });
    }
    if (!bootstrap(request._auth)) fail('Only the bootstrap administrator can configure the organization', 403);
    if (path === '/territories' && request.method === 'POST') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || !['com', 'cn'].includes(body.market)) fail('Invalid territory');
      if (body.market !== market) fail('Create the territory in its own market workspace', 400);
      const territory = { id: crypto.randomUUID(), name: body.name.trim(), market: body.market };
      await env.DB.batch([businessEpochGuard(env, s.epoch),
        env.DB.prepare('INSERT INTO business_territories(id,name,market) VALUES (?,?,?)').bind(territory.id, territory.name, territory.market),
        audit(env, request._auth, 'business_territory', territory.id, 'business_territory_created', null, territory)]);
      return reply({ territory }, 201);
    }
    const profilePath = path.match(/^\/staff\/([^/]+)$/);
    if (profilePath && request.method === 'PUT') {
      const id = decodeURIComponent(profilePath[1]);
      const account = await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id=?').bind(id).first();
      if (!account?.is_active) fail('Active staff account not found', 404);
      const before = await env.DB.prepare('SELECT * FROM business_staff_profiles WHERE staff_id=?').bind(id).first();
      if (!revision(body.revision) || body.revision !== (before?.revision || 0)) fail('Staff revision changed', 409, 'business_revision_changed');
      const previousGrants = await env.DB.prepare('SELECT territory_id FROM business_director_territories WHERE staff_id=? ORDER BY territory_id').bind(id).all();
      const beforeState = before ? { ...before, territory_ids: (previousGrants.results || []).map(row => row.territory_id) } : null;
      const profile = await prepareBusinessProfile(env, account, body);
      const child = await env.DB.prepare('SELECT staff_id FROM business_staff_profiles WHERE supervisor_staff_id=? LIMIT 1').bind(id).first();
      if (child && before.role !== profile.role) fail('Move subordinate staff before changing this role', 409);
      const profileWrite = before
        ? env.DB.prepare("UPDATE business_staff_profiles SET role=?,grade=?,supervisor_staff_id=?,revision=revision+1,updated_at=datetime('now') WHERE staff_id=? AND revision=?").bind(profile.role, profile.grade, profile.supervisor_staff_id, id, body.revision)
        : env.DB.prepare('INSERT INTO business_staff_profiles(staff_id,role,grade,supervisor_staff_id,revision) VALUES (?,?,?,?,1)').bind(id, profile.role, profile.grade, profile.supervisor_staff_id);
      await env.DB.batch([businessEpochGuard(env, s.epoch),
        env.DB.prepare("UPDATE admin_staff_accounts SET role='operations',business_profile_required=1,updated_at=datetime('now') WHERE id=?").bind(id),
        profileWrite, mutationGuard(env),
        env.DB.prepare('DELETE FROM business_director_territories WHERE staff_id=?').bind(id),
        ...profile.territory_ids.map(t => env.DB.prepare('INSERT INTO business_director_territories(staff_id,territory_id) VALUES (?,?)').bind(id, t)),
        audit(env, request._auth, 'business_staff_profile', id, 'business_profile_updated', beforeState, profile)]);
      const updated = await scope(env, request._auth, market);
      return reply({ staff: updated.organization.staff.find(row => row.id === id), scope_version: updated.version });
    }
    return reply({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof BusinessError) return reply({ error: error.message, code: error.code }, error.status);
    if (/malformed json|UNIQUE constraint/i.test(error.message)) return reply({ error: 'Business scope or revision changed', code: 'business_scope_changed' }, 409);
    throw error;
  }
}
