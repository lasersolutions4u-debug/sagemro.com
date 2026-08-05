const REPORT_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const LIVE_DATA_DELAY_MS = 5 * 60 * 1000;
const MAX_REPORT_DAYS = 90;
// Reserved internal query marker compiled only into fixed empty-attribution SQL.
export const DIRECT_ATTRIBUTION_FILTER = '__sagemro_direct__';
const COUNT_FIELDS = [
  'sessions',
  'aiRequests',
  'aiSuccesses',
  'registrationEvents',
  'serviceRequestEvents',
  'visitors',
  'aiVisitors',
  'registrationVisitors',
  'serviceVisitors',
  'unattributedSessions',
  'missingAnonymousEvents',
  'legacyEvents',
];

export class PromotionAnalyticsInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PromotionAnalyticsInputError';
    this.status = 400;
  }
}

function formatUtcDateTime(timestamp) {
  return new Date(timestamp).toISOString().replace('T', ' ').replace('.000Z', '');
}

function parseReportDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new PromotionAnalyticsInputError(`${label} must be a YYYY-MM-DD date`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new PromotionAnalyticsInputError(`${label} must be a valid report date`);
  }

  return { value, utcMidnight: date.getTime() - REPORT_TIMEZONE_OFFSET_MS };
}

function cleanFilter(value, max) {
  return String(value || '').trim().slice(0, max);
}

function count(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function sampleStatus(sessions) {
  if (sessions === 0) return 'no_data';
  return sessions < 20 ? 'insufficient' : 'ready';
}

function serviceRequestCount(snapshot) {
  return snapshot.serviceRequestEvents === undefined
    ? count(snapshot.serviceRequests)
    : count(snapshot.serviceRequestEvents);
}

function registrationCount(snapshot) {
  return snapshot.registrationEvents === undefined
    ? count(snapshot.registrations)
    : count(snapshot.registrationEvents);
}

export function parsePromotionFilters(searchParams, { allowedMarkets, now = new Date() } = {}) {
  const from = parseReportDate(searchParams.get('from'), 'from');
  const to = parseReportDate(searchParams.get('to'), 'to');
  if (from.utcMidnight > to.utcMidnight) {
    throw new PromotionAnalyticsInputError('from must not be after to');
  }

  const reportDays = ((to.utcMidnight - from.utcMidnight) / (24 * 60 * 60 * 1000)) + 1;
  if (reportDays > MAX_REPORT_DAYS) {
    throw new PromotionAnalyticsInputError(`Report range cannot exceed ${MAX_REPORT_DAYS} days`);
  }

  const scopedMarkets = [...new Set((allowedMarkets || []).filter((market) => (
    market === 'com' || market === 'cn'
  )))];
  const requestedMarket = cleanFilter(searchParams.get('market'), 10) || 'all';
  if (!scopedMarkets.length) {
    throw new PromotionAnalyticsInputError('No promotion analytics markets are available');
  }
  if (requestedMarket !== 'all' && requestedMarket !== 'com' && requestedMarket !== 'cn') {
    throw new PromotionAnalyticsInputError('market must be all, com, or cn');
  }

  const markets = requestedMarket === 'all'
    ? scopedMarkets
    : scopedMarkets.filter((market) => market === requestedMarket);
  if (!markets.length) {
    throw new PromotionAnalyticsInputError('Requested market is not permitted');
  }

  const toUtcExclusive = to.utcMidnight + (24 * 60 * 60 * 1000);
  const cutoff = new Date(now).getTime() - LIVE_DATA_DELAY_MS;
  if (!Number.isFinite(cutoff)) {
    throw new PromotionAnalyticsInputError('now must be a valid date');
  }

  return {
    from: from.value,
    to: to.value,
    fromUtc: formatUtcDateTime(from.utcMidnight),
    toUtcExclusive: formatUtcDateTime(toUtcExclusive),
    effectiveToUtcExclusive: formatUtcDateTime(Math.min(toUtcExclusive, cutoff)),
    markets,
    source: cleanFilter(searchParams.get('source'), 100),
    medium: cleanFilter(searchParams.get('medium'), 100),
    campaign: cleanFilter(searchParams.get('campaign'), 200),
  };
}

export function ratio(numerator, denominator) {
  const safeDenominator = Number(denominator);
  return Number.isFinite(safeDenominator) && safeDenominator > 0
    ? count(numerator) / safeDenominator
    : null;
}

function addSnapshotCounts(target, snapshot) {
  for (const field of COUNT_FIELDS) {
    if (field === 'registrationEvents') target[field] += registrationCount(snapshot);
    else if (field === 'serviceRequestEvents') target[field] += serviceRequestCount(snapshot);
    else target[field] += count(snapshot[field]);
  }
}

function addSnapshotRates(snapshot) {
  return {
    ...snapshot,
    aiSuccessRate: ratio(snapshot.aiSuccesses, snapshot.aiRequests),
    sessionToRequestRate: ratio(serviceRequestCount(snapshot), snapshot.sessions),
    sessionToRegistrationRate: ratio(registrationCount(snapshot), snapshot.sessions),
    sampleStatus: sampleStatus(snapshot.sessions),
  };
}

export function mergePromotionSnapshots(snapshots) {
  const merged = Object.fromEntries(COUNT_FIELDS.map((field) => [field, 0]));
  let coverageStart = null;
  for (const snapshot of snapshots || []) {
    addSnapshotCounts(merged, snapshot || {});
    if (snapshot?.coverageStart && (!coverageStart || snapshot.coverageStart < coverageStart)) {
      coverageStart = snapshot.coverageStart;
    }
  }
  merged.coverageStart = coverageStart;
  return addSnapshotRates(merged);
}

export function mergeChannelRows(rowsByMarket) {
  const merged = new Map();
  for (const rows of rowsByMarket || []) {
    for (const row of rows || []) {
      const source = row.source || '';
      const medium = row.medium || '';
      const campaign = row.campaign || '';
      const key = JSON.stringify([source, medium, campaign]);
      const target = merged.get(key) || {
        source,
        medium,
        campaign,
        sessions: 0,
        aiRequests: 0,
        aiSuccesses: 0,
        registrations: 0,
        serviceRequests: 0,
      };
      for (const field of ['sessions', 'aiRequests', 'aiSuccesses', 'registrations', 'serviceRequests']) {
        target[field] += count(row[field]);
      }
      merged.set(key, target);
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    aiSuccessRate: ratio(row.aiSuccesses, row.aiRequests),
    sessionToRequestRate: ratio(row.serviceRequests, row.sessions),
    sampleStatus: sampleStatus(row.sessions),
  }));
}

function worstLevel(current, next) {
  const levels = { normal: 0, warning: 1, critical: 2 };
  return levels[next] > levels[current] ? next : current;
}

function reason(metric, level, value, threshold, sampleCount) {
  return { metric, level, value, threshold, sampleCount };
}

function conversionDroppedAtLeastThirtyPercent(
  currentNumerator,
  currentDenominator,
  previousNumerator,
  previousDenominator,
  calculatedDrop,
) {
  const counts = [currentNumerator, currentDenominator, previousNumerator, previousDenominator];
  if (counts.every(Number.isSafeInteger)) {
    return BigInt(currentNumerator) * BigInt(previousDenominator) * 10n
      <= BigInt(previousNumerator) * BigInt(currentDenominator) * 7n;
  }
  return calculatedDrop !== null && calculatedDrop >= 0.3;
}

export function evaluatePromotionHealth(current = {}, previous = {}, recentAi = []) {
  const reasons = [];
  let level = 'normal';
  const aiRequests = count(current.aiRequests);
  const aiSuccessRate = ratio(current.aiSuccesses, aiRequests);

  if (aiRequests >= 20 && aiSuccessRate < 0.95) {
    const aiLevel = aiSuccessRate < 0.9 ? 'critical' : 'warning';
    level = worstLevel(level, aiLevel);
    reasons.push(reason('ai_success_rate', aiLevel, aiSuccessRate, aiLevel === 'critical' ? 0.9 : 0.95, aiRequests));
  }

  const latestAi = recentAi.slice(0, 5);
  if (latestAi.length === 5 && latestAi.every((request) => request && request.success === false)) {
    level = worstLevel(level, 'critical');
    reasons.push(reason('recent_ai_failures', 'critical', 5, 5, latestAi.length));
  }

  const currentSessions = count(current.sessions);
  const previousSessions = count(previous.sessions);
  const trafficDrop = ratio(previousSessions - currentSessions, previousSessions);
  if (previousSessions >= 20 && trafficDrop !== null && trafficDrop >= 0.4) {
    level = worstLevel(level, 'warning');
    reasons.push(reason('traffic_drop', 'warning', trafficDrop, 0.4, previousSessions));
  }

  const currentServiceRequests = serviceRequestCount(current);
  const previousServiceRequests = serviceRequestCount(previous);
  const currentConversion = ratio(currentServiceRequests, currentSessions);
  const previousConversion = ratio(previousServiceRequests, previousSessions);
  const conversionDrop = previousConversion && currentConversion !== null
    ? (previousConversion - currentConversion) / previousConversion
    : null;
  if (
    currentSessions >= 20
    && previousSessions >= 20
    && conversionDrop !== null
    && conversionDroppedAtLeastThirtyPercent(
      currentServiceRequests,
      currentSessions,
      previousServiceRequests,
      previousSessions,
      conversionDrop,
    )
  ) {
    level = worstLevel(level, 'warning');
    reasons.push(reason('conversion_drop', 'warning', conversionDrop, 0.3, Math.min(currentSessions, previousSessions)));
  }

  const unattributedRate = ratio(current.unattributedSessions, currentSessions);
  if (currentSessions >= 20 && unattributedRate !== null && unattributedRate >= 0.3) {
    level = worstLevel(level, 'warning');
    reasons.push(reason('unattributed_sessions', 'warning', unattributedRate, 0.3, currentSessions));
  }

  return { level, reasons };
}

export function buildEventWhere(filters) {
  const clauses = ['created_at >= ?', 'created_at < ?'];
  const params = [filters.fromUtc, filters.effectiveToUtcExclusive];
  for (const [column, value] of [
    ['source', filters.source],
    ['medium', filters.medium],
    ['campaign', filters.campaign],
  ]) {
    if (!value) continue;
    if (value === DIRECT_ATTRIBUTION_FILTER) {
      clauses.push(`COALESCE(${column}, '') = ''`);
    } else {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }
  return { sql: clauses.join(' AND '), params };
}

const FILTERED_EVENTS = (where) => `
  WITH filtered AS (
    SELECT event_name, session_id, anonymous_id, source, medium, campaign, created_at,
           json_extract(properties_json, '$.analytics_version') AS analytics_version,
           json_extract(properties_json, '$.request_id') AS request_id
    FROM funnel_events
    WHERE ${where}
  ), eligible_ai_requests AS (
    SELECT DISTINCT request_id
    FROM filtered
    WHERE analytics_version = '2'
      AND event_name = 'ai_conversation_started'
      AND COALESCE(request_id, '') != ''
  )
`;

const OVERVIEW_SELECT = `
  SELECT
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' THEN session_id END) AS sessions,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' THEN request_id END) AS aiRequests,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_response_received' AND request_id IN (SELECT request_id FROM eligible_ai_requests) THEN request_id END) AS aiSuccesses,
    SUM(CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' THEN 1 ELSE 0 END) AS registrationEvents,
    SUM(CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' THEN 1 ELSE 0 END) AS serviceRequestEvents,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS visitors,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS aiVisitors,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS registrationVisitors,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS serviceVisitors,
    SUM(CASE WHEN analytics_version = '2' AND COALESCE(anonymous_id, '') = '' THEN 1 ELSE 0 END) AS missingAnonymousEvents,
    COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' AND COALESCE(source, '') = '' THEN session_id END) AS unattributedSessions,
    MIN(CASE WHEN analytics_version = '2' THEN created_at END) AS coverageStart,
    SUM(CASE WHEN analytics_version IS NULL OR analytics_version != '2' THEN 1 ELSE 0 END) AS legacyEvents
  FROM filtered
`;

function dbFirst(db, sql, params) {
  return db.prepare(sql).bind(...params).first();
}

async function dbRows(db, sql, params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results || [];
}

function normalizeSnapshot(snapshot = {}) {
  const normalized = Object.fromEntries(COUNT_FIELDS.map((field) => [field, count(snapshot[field])]));
  normalized.coverageStart = snapshot.coverageStart || null;
  return addSnapshotRates(normalized);
}

function normalizeDailyRow(row = {}) {
  return {
    date: row.date,
    sessions: count(row.sessions),
    aiRequests: count(row.aiRequests),
    aiSuccesses: count(row.aiSuccesses),
    registrations: count(row.registrations),
    serviceRequests: count(row.serviceRequests),
  };
}

function normalizeChannelRow(row = {}) {
  return {
    source: row.source || '',
    medium: row.medium || '',
    campaign: row.campaign || '',
    sessions: count(row.sessions),
    aiRequests: count(row.aiRequests),
    aiSuccesses: count(row.aiSuccesses),
    registrations: count(row.registrations),
    serviceRequests: count(row.serviceRequests),
  };
}

function dailySql(where) {
  return `${FILTERED_EVENTS(where)}
    SELECT
      date(datetime(created_at, '+8 hours')) AS date,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' THEN session_id END) AS sessions,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' THEN request_id END) AS aiRequests,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_response_received' AND request_id IN (SELECT request_id FROM eligible_ai_requests) THEN request_id END) AS aiSuccesses,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS registrations,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS serviceRequests
    FROM filtered
    GROUP BY date
    ORDER BY date ASC`;
}

function recentAiSql(where) {
  return `${FILTERED_EVENTS(where)},
    starts AS (
      SELECT request_id, MAX(created_at) AS createdAt
      FROM filtered
      WHERE analytics_version = '2'
        AND event_name = 'ai_conversation_started'
        AND COALESCE(request_id, '') != ''
      GROUP BY request_id
    )
    SELECT starts.createdAt AS createdAt,
      CASE WHEN COUNT(responses.request_id) > 0 THEN 1 ELSE 0 END AS success
    FROM starts
    LEFT JOIN filtered responses
      ON responses.analytics_version = '2'
      AND responses.event_name = 'ai_response_received'
      AND responses.request_id = starts.request_id
    GROUP BY starts.request_id, starts.createdAt
    ORDER BY starts.createdAt DESC
    LIMIT 5`;
}

export async function queryPromotionOverviewDb(db, filters) {
  const { sql: where, params } = buildEventWhere(filters);
  const [snapshot, daily, recentAi] = await Promise.all([
    dbFirst(db, `${FILTERED_EVENTS(where)}${OVERVIEW_SELECT}`, params),
    dbRows(db, dailySql(where), params),
    dbRows(db, recentAiSql(where), params),
  ]);
  return {
    ...normalizeSnapshot(snapshot),
    daily: daily.map(normalizeDailyRow),
    recentAi: recentAi.map((row) => ({
      success: Boolean(row.success),
      createdAt: row.createdAt,
    })),
  };
}

function channelSql(where) {
  return `${FILTERED_EVENTS(where)}
    SELECT
      COALESCE(source, '') AS source,
      COALESCE(medium, '') AS medium,
      COALESCE(campaign, '') AS campaign,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'traffic_source_captured' THEN session_id END) AS sessions,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_conversation_started' THEN request_id END) AS aiRequests,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'ai_response_received' AND request_id IN (SELECT request_id FROM eligible_ai_requests) THEN request_id END) AS aiSuccesses,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'signup_completed' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS registrations,
      COUNT(DISTINCT CASE WHEN analytics_version = '2' AND event_name = 'service_request_created' AND COALESCE(anonymous_id, '') != '' THEN anonymous_id END) AS serviceRequests
    FROM filtered
    GROUP BY COALESCE(source, ''), COALESCE(medium, ''), COALESCE(campaign, '')
    HAVING sessions > 0 OR aiRequests > 0 OR aiSuccesses > 0 OR registrations > 0 OR serviceRequests > 0
    ORDER BY serviceRequests DESC, registrations DESC, sessions DESC`;
}

export async function queryPromotionChannelsDb(db, filters) {
  const { sql: where, params } = buildEventWhere(filters);
  const [rows, daily] = await Promise.all([
    dbRows(db, channelSql(where), params),
    dbRows(db, dailySql(where), params),
  ]);
  return {
    rows: rows.map(normalizeChannelRow),
    daily: daily.map(normalizeDailyRow),
  };
}

function previousPeriodFilters(filters) {
  const from = Date.parse(`${filters.fromUtc.replace(' ', 'T')}Z`);
  const effectiveTo = Date.parse(`${filters.effectiveToUtcExclusive.replace(' ', 'T')}Z`);
  const duration = Math.max(0, effectiveTo - from);
  return {
    ...filters,
    fromUtc: formatUtcDateTime(from - duration),
    effectiveToUtcExclusive: formatUtcDateTime(from),
  };
}

function mergeDailyRows(rowsByMarket) {
  const rows = new Map();
  for (const marketRows of rowsByMarket || []) {
    for (const row of marketRows || []) {
      const target = rows.get(row.date) || {
        date: row.date, sessions: 0, aiRequests: 0, aiSuccesses: 0, registrations: 0, serviceRequests: 0,
      };
      for (const field of ['sessions', 'aiRequests', 'aiSuccesses', 'registrations', 'serviceRequests']) {
        target[field] += count(row[field]);
      }
      rows.set(row.date, target);
    }
  }
  return [...rows.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function sortChannelRows(rows) {
  return [...rows].sort((left, right) => (
    right.serviceRequests - left.serviceRequests
    || right.registrations - left.registrations
    || right.sessions - left.sessions
    || left.source.localeCompare(right.source)
    || left.medium.localeCompare(right.medium)
    || left.campaign.localeCompare(right.campaign)
  ));
}

function bestChannelSummary(rows) {
  const [best] = sortChannelRows(mergeChannelRows([
    rows.map((row) => ({ ...row, campaign: '' })),
  ]));
  if (!best) return null;
  const summary = { ...best };
  delete summary.campaign;
  return summary;
}

function bestCampaignSummary(rows) {
  const [best] = sortChannelRows(mergeChannelRows([
    rows.map((row) => ({ ...row, source: '', medium: '' })),
  ]));
  if (!best) return null;
  const summary = { ...best };
  delete summary.source;
  delete summary.medium;
  return summary;
}

export async function loadPromotionOverview(databases, filters) {
  const currentByMarket = await Promise.all(filters.markets.map((market) => (
    queryPromotionOverviewDb(databases[market], filters)
  )));
  const previousByMarket = await Promise.all(filters.markets.map((market) => (
    queryPromotionOverviewDb(databases[market], previousPeriodFilters(filters))
  )));
  const current = mergePromotionSnapshots(currentByMarket);
  const previous = mergePromotionSnapshots(previousByMarket);
  const recentAi = currentByMarket
    .flatMap((snapshot) => snapshot.recentAi)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
    .map(({ success }) => ({ success }));
  return {
    current,
    previous,
    daily: mergeDailyRows(currentByMarket.map((snapshot) => snapshot.daily)),
    recentAi,
    health: evaluatePromotionHealth(current, previous, recentAi),
    dataQuality: {
      coverageStart: current.coverageStart,
      legacyEvents: current.legacyEvents,
      missingAnonymousEvents: current.missingAnonymousEvents,
      unattributedSessions: current.unattributedSessions,
      attributionCoverage: ratio(current.sessions - current.unattributedSessions, current.sessions),
    },
  };
}

export async function loadPromotionChannels(databases, filters) {
  const results = await Promise.all(filters.markets.map((market) => (
    queryPromotionChannelsDb(databases[market], filters)
  )));
  const mergedRows = sortChannelRows(mergeChannelRows(results.map((result) => result.rows)));
  const rows = mergedRows.slice(0, 100);
  const attributedRows = mergedRows.filter((row) => row.source !== '');
  return {
    rows,
    daily: mergeDailyRows(results.map((result) => result.daily)),
    summary: {
      bestChannel: bestChannelSummary(mergedRows),
      bestCampaign: bestCampaignSummary(mergedRows),
      attributableServiceRequests: attributedRows.reduce((total, row) => total + row.serviceRequests, 0),
      attributionCoverage: ratio(
        attributedRows.reduce((total, row) => total + row.sessions, 0),
        mergedRows.reduce((total, row) => total + row.sessions, 0),
      ),
    },
  };
}
