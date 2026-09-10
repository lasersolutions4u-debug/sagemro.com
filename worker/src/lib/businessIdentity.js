export const BUSINESS_ROLES = new Set(['business_director', 'business_manager', 'business_specialist']);

export function isBusinessRole(role) { return BUSINESS_ROLES.has(role); }
export function marketAllows(staff, market) { return staff?.market_scope === 'all' || staff?.market_scope === market; }

export async function resolveBusinessHierarchy(profile, load, market) {
  const valid = (p) => p?.is_active && p.business_profile_required === 1 && p.raw_role === 'operations'
    && BUSINESS_ROLES.has(p.role) && [1, 2, 3].includes(p.grade) && (!market || marketAllows(p, market));
  if (!valid(profile)) return null;
  let current = profile;
  const seen = new Set([profile.staff_id]);
  for (const expected of profile.role === 'business_specialist' ? ['business_manager', 'business_director']
    : profile.role === 'business_manager' ? ['business_director'] : []) {
    if (!current.supervisor_staff_id || seen.has(current.supervisor_staff_id)) return null;
    seen.add(current.supervisor_staff_id);
    current = await load(current.supervisor_staff_id);
    if (!valid(current) || current.role !== expected) return null;
  }
  return current.role === 'business_director' && current.supervisor_staff_id === null ? current : null;
}

export async function resolveStaffIdentity(env, staffOrId, market) {
  const staff = typeof staffOrId === 'string'
    ? await env.DB.prepare('SELECT * FROM admin_staff_accounts WHERE id = ?').bind(staffOrId).first()
    : staffOrId;
  if (!staff?.is_active || (market && !marketAllows(staff, market))) return null;
  if (!staff.business_profile_required) return { ...staff, businessGrade: null, supervisorStaffId: null, businessProfileRequired: false };
  const load = async (id) => env.DB.prepare(`
    SELECT p.*, a.is_active, a.market_scope, a.business_profile_required, a.role AS raw_role
    FROM business_staff_profiles p JOIN admin_staff_accounts a ON a.id = p.staff_id WHERE p.staff_id = ?
  `).bind(id).first();
  const profile = await load(staff.id);
  const current = await resolveBusinessHierarchy(profile, load, market);
  if (!current) return null;
  return { ...staff, role: profile.role, businessGrade: profile.grade, supervisorStaffId: profile.supervisor_staff_id,
    businessProfileRequired: true, businessDirectorId: current.staff_id, businessRevision: profile.revision };
}

export async function hydrateStaffAuth(payload, env, account) {
  if (!payload || payload.userType !== 'admin') return payload;
  if (!payload.staffId) return isBusinessRole(payload.staffRole) || payload.businessProfileRequired ? null : payload;
  if (payload.userId !== payload.staffId) return null;
  const staff = await resolveStaffIdentity(env, account || payload.staffId, payload.market);
  if (!staff) return { ...payload, staffRole: 'invalid_staff', invalidStaff: true,
    businessGrade: null, supervisorStaffId: null, businessProfileRequired: false, mustChangePassword: true };
  return { ...payload, staffRole: staff.role, marketScope: staff.market_scope,
    mustChangePassword: Boolean(staff.must_change_password), businessGrade: staff.businessGrade,
    supervisorStaffId: staff.supervisorStaffId, businessProfileRequired: staff.businessProfileRequired };
}
