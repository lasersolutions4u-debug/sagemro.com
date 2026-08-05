const REPORT_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const LIVE_DATA_DELAY_MS = 5 * 60 * 1000;
const MAX_REPORT_DAYS = 90;
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
  for (const snapshot of snapshots || []) addSnapshotCounts(merged, snapshot || {});
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
