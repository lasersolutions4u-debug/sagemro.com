// Pure list helpers for the internal staff accounts page.
// Kept free of React so filtering stays unit-testable.
// 商务组织（辖区 / 上级 / 档位）已随商务模块下线，这里只保留纯列表能力。

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
