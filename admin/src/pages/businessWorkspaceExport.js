function exportError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export async function collectBusinessRecords({ fetchPage, expectedStaffId, initialScopeVersion, isCurrent, signal, onProgress }) {
  const checkIdentity = () => {
    signal?.throwIfAborted();
    if (!expectedStaffId || !isCurrent()) throw exportError('business_identity_changed');
  };
  const rows = [];
  const ids = new Set();
  const cursors = new Set();
  let cursor;
  let scopeVersion = initialScopeVersion;
  let total;
  do {
    checkIdentity();
    const page = await fetchPage({ expected_staff_id: expectedStaffId, limit: 100, export: 1, cursor, scope_version: scopeVersion }, signal);
    checkIdentity();
    if (!page || !Array.isArray(page.records) || !Number.isSafeInteger(page.total) || page.total < 0
      || typeof page.scope_version !== 'string' || !page.scope_version
      || (scopeVersion !== undefined && page.scope_version !== scopeVersion)
      || (total !== undefined && page.total !== total)) throw exportError('business_export_changed');
    scopeVersion = page.scope_version;
    total = page.total;
    for (const row of page.records) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw exportError('business_export_changed');
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length > total) throw exportError('business_export_changed');
    cursor = page.next_cursor;
    if (cursor != null) {
      if (typeof cursor !== 'string' || !cursor || cursors.has(cursor) || !page.records.length) throw exportError('business_export_changed');
      cursors.add(cursor);
    }
    onProgress?.(rows.length, total);
  } while (cursor != null);
  if (rows.length !== total) throw exportError('business_export_changed');
  checkIdentity();
  const latest = await fetchPage({ expected_staff_id: expectedStaffId, limit: 1, export: 1, scope_version: scopeVersion }, signal);
  checkIdentity();
  if (latest?.scope_version !== scopeVersion || latest?.total !== total) throw exportError('business_export_changed');
  return rows;
}

export function businessRecordsCsv(records, columns) {
  const cell = value => {
    let text = value == null ? '' : String(value);
    if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [columns.map(column => cell(column.label)).join(','),
    ...records.map(record => columns.map(column => cell(record[column.key])).join(',')),
  ].join('\r\n');
}
