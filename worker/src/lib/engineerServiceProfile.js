const MONEY_FIELDS = ['hourly_rate', 'day_rate', 'overtime_rate', 'travel_time_rate'];
const TEXT_FIELDS = ['base_location', 'coverage_regions', 'travel_transport_standard', 'hotel_standard', 'equipment_experience', 'tools', 'workshop', 'availability', 'languages', 'assistant_support', 'remote_support', 'qualifications_evidence', 'limitations'];
const FIELDS = ['version', 'currency', ...MONEY_FIELDS, 'hours_per_day', 'minimum_hours', 'valid_until', ...TEXT_FIELDS, 'cross_border_available', 'laser_source', 'cutting_head'];
const CAPABILITIES = ['unknown', 'none', 'diagnosis', 'replacement', 'internal_repair'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const decimal = value => typeof value === 'string' && /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value);
const validExpectedIdentity = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function validateServiceProfileBody(body) {
  if (!isObject(body) || Object.keys(body).some(key => !['revision', 'profile', 'expected_engineer_id'].includes(key))
    || !validExpectedIdentity(body.expected_engineer_id)
    || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER
    || !isObject(body.profile) || body.profile.version !== 1) return false;
  const profile = body.profile;
  if (Object.keys(profile).some(key => !FIELDS.includes(key))) return false;
  for (const [key, value] of Object.entries(profile)) {
    if (key === 'version' || value === null) continue;
    if (MONEY_FIELDS.includes(key) && !decimal(value)) return false;
    if (TEXT_FIELDS.includes(key) && (typeof value !== 'string' || value.length > 2000)) return false;
    if (key === 'currency' && (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))) return false;
    if (['hours_per_day', 'minimum_hours'].includes(key) && (!decimal(value) || Number(value) > (key === 'hours_per_day' ? 24 : 744))) return false;
    if (key === 'cross_border_available' && typeof value !== 'boolean') return false;
    if (key === 'valid_until' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || value < '1900-01-01' || value > '9999-12-31' || !Number.isFinite(Date.parse(value))
      || new Date(value).toISOString().slice(0, 10) !== value)) return false;
    if (['laser_source', 'cutting_head'].includes(key)) {
      if (!Array.isArray(value) || value.length > 3 || new Set(value).size !== value.length
        || value.some(item => !CAPABILITIES.includes(item))
        || (value.length > 1 && value.some(item => ['unknown', 'none'].includes(item)))) return false;
    }
  }
  return true;
}

async function boundedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch { return null; }
}

export async function handleEngineerServiceProfile(request, env, { jsonResponse, isCn }) {
  const fail = (code, cn, en, status) => jsonResponse({ code, error: isCn ? cn : en }, status);
  const auth = request._auth;
  if (!auth) return fail('sign_in_required', '请先登录', 'Please sign in', 401);
  if (auth.userType !== 'engineer' || typeof auth.userId !== 'string'
    || !await env.DB.prepare('SELECT id FROM engineers WHERE id = ?').bind(auth.userId).first()) {
    return fail('engineer_required', '仅工程师本人可填写', 'Only the engineer may report their own profile', 403);
  }
  const isRead = request.method === 'GET';
  const body = isRead ? null : await boundedJson(request);
  const expectedIds = new URL(request.url).searchParams.getAll('expected_engineer_id');
  const expectedId = isRead ? expectedIds[0] : body?.expected_engineer_id;
  if (isRead ? expectedIds.length !== 1 || !validExpectedIdentity(expectedId) : !validateServiceProfileBody(body)) {
    return fail('invalid_service_profile', '资料格式无效：请检查金额、日期、字段类型与长度', 'Invalid profile: check amounts, dates, field types and lengths', 400);
  }
  if (expectedId !== auth.userId) {
    return fail('engineer_identity_changed', '账号已切换，请重新加载页面', 'Account changed. Please reload the page', 403);
  }
  const select = () => env.DB.prepare('SELECT profile_json, revision, updated_at FROM engineer_service_profiles WHERE engineer_id = ?').bind(auth.userId).first();
  const result = row => ({ profile: row ? JSON.parse(row.profile_json) : null, revision: row?.revision ?? 0, updated_at: row?.updated_at ?? null, verification_status: 'self_reported' });
  if (isRead) return jsonResponse(result(await select()));
  const profileJson = JSON.stringify(body.profile);
  const saved = body.revision === 0
    ? await env.DB.prepare('INSERT INTO engineer_service_profiles (engineer_id, profile_json, revision) VALUES (?, ?, 1) ON CONFLICT(engineer_id) DO NOTHING').bind(auth.userId, profileJson).run()
    : await env.DB.prepare("UPDATE engineer_service_profiles SET profile_json = ?, revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE engineer_id = ? AND revision = ?").bind(profileJson, auth.userId, body.revision).run();
  if (saved.meta?.changes !== 1) {
    return fail('service_profile_conflict', '资料已在其他窗口更新，请读取最新版本后核对；当前输入尚未保存', 'Profile changed in another window. Load the latest version and review; your edits are not saved', 409);
  }
  return jsonResponse(result(await select()));
}
