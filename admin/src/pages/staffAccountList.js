// Pure list helpers for the internal staff accounts page.
// Kept free of React so filtering and organization summaries stay unit-testable.

const byId = (organization, key) => new Map((organization?.[key] || []).map((item) => [item.id, item]));

export function sortStaffAccounts(staff) {
  if (!Array.isArray(staff)) return [];
  // Codepoint order, not localeCompare: ICU collation differs between build machines.
  const nameOf = (account) => String(account.display_name || '');
  const byName = (a, b) => (nameOf(a) < nameOf(b) ? -1 : nameOf(a) > nameOf(b) ? 1 : 0);
  return [...staff].sort((a, b) => {
    if (Boolean(a.is_active) !== Boolean(b.is_active)) return a.is_active ? -1 : 1;
    return byName(a, b);
  });
}

// Organization relation only exists for business roles; the list endpoint copies
// grade / supervisor / territory ids onto those rows (see handleAdminStaffList).
export function orgSummary(account, organization) {
  if (!account?.business_profile_required) return null;
  const staffById = byId(organization, 'staff');
  const territoryById = byId(organization, 'territories');
  const ownIds = account.territory_ids || [];
  const nameOf = (id) => territoryById.get(id)?.name;
  const own = ownIds.map(nameOf).filter(Boolean);
  const inherited = (staffById.get(account.id)?.effective_territory_ids || [])
    .filter((id) => !ownIds.includes(id))
    .map(nameOf)
    .filter(Boolean);
  return {
    supervisorName: account.supervisor_staff_id ? (staffById.get(account.supervisor_staff_id)?.display_name || null) : null,
    ownTerritories: own,
    inheritedTerritories: inherited,
  };
}

export function matchesQuery(account, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  return [account?.display_name, account?.normalized_login, account?.normalized_phone]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function filterStaffAccounts(staff, { query = '', role = 'all', status = 'all' } = {}) {
  return (Array.isArray(staff) ? staff : []).filter((account) => {
    if (!matchesQuery(account, query)) return false;
    if (role !== 'all' && account.role !== role) return false;
    if (status === 'active' && !account.is_active) return false;
    if (status === 'inactive' && account.is_active) return false;
    return true;
  });
}

// What actually breaks when an account is deactivated: direct reports lose their
// supervisor and territory grants stop applying. Shown in the confirmation dialog.
export function deactivationImpact(account, staff) {
  const rows = Array.isArray(staff) ? staff : [];
  const id = account?.id;
  return {
    reports: id
      ? rows.filter((item) => item.id !== id && item.is_active && item.supervisor_staff_id === id).length
      : 0,
    territories: (account?.territory_ids || []).length,
  };
}
