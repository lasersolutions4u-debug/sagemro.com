export const ANALYTICS_VERSION = '2';
export const SESSION_IDLE_MS = 30 * 60 * 1000;

const REFERRER_RULES = [
  [/^(?:[^.]+\.)?google\.[a-z.]+$/, 'google_organic', 'organic'],
  [/^(?:[^.]+\.)?baidu\.com$/, 'baidu_organic', 'organic'],
  [/^(?:[^.]+\.)?bing\.com$/, 'bing_organic', 'organic'],
  [/^(?:chatgpt\.com|chat\.openai\.com)$/, 'chatgpt_referral', 'ai_referral'],
  [/^(?:[^.]+\.)?perplexity\.ai$/, 'perplexity_referral', 'ai_referral'],
  [/^copilot\.microsoft\.com$/, 'copilot_referral', 'ai_referral'],
];

const ATTRIBUTION_FIELDS = ['source', 'medium', 'campaign', 'content', 'term'];
const GOOGLE_SEARCH_HOSTS = new Set([
  'google.com',
  'google.com.hk',
  'google.co.uk',
  'google.de',
  'google.fr',
  'google.ca',
  'google.com.au',
  'google.co.in',
]);

function normalizeHostname(hostname) {
  return typeof hostname === 'string'
    ? hostname.toLowerCase().replace(/^www\./, '')
    : '';
}

function isSagemroHostname(hostname) {
  return hostname === 'sagemro.com'
    || hostname.endsWith('.sagemro.com')
    || hostname === 'sagemro.cn'
    || hostname.endsWith('.sagemro.cn');
}

function isApprovedGoogleHost(hostname) {
  return [...GOOGLE_SEARCH_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function normalizeAttribution(attribution) {
  return Object.fromEntries(ATTRIBUTION_FIELDS.map((field) => [
    field,
    typeof attribution?.[field] === 'string' ? attribution[field] : '',
  ]));
}

function hasAttribution(attribution) {
  return Object.values(attribution).some(Boolean);
}

function isReusableStoredAttribution(attribution) {
  const source = attribution.source.trim().toLowerCase();
  const medium = attribution.medium.trim().toLowerCase();
  return hasAttribution(attribution) && source !== 'direct' && Boolean(medium) && medium !== 'none';
}

export function classifyReferrer(referrer, siteHostname) {
  try {
    const hostname = normalizeHostname(new URL(referrer).hostname);
    if (
      !hostname
      || hostname === normalizeHostname(siteHostname)
      || isSagemroHostname(hostname)
    ) return null;

    for (const [pattern, source, medium] of REFERRER_RULES) {
      if (pattern.test(hostname) && (source !== 'google_organic' || isApprovedGoogleHost(hostname))) {
        return { source, medium };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveTrafficAttribution({ search, referrer, siteHostname, stored }) {
  const params = new URLSearchParams(search || '');
  const fromUtm = normalizeAttribution({
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
  });
  if (hasAttribution(fromUtm)) return fromUtm;

  const classified = classifyReferrer(referrer, siteHostname);
  if (classified) return normalizeAttribution(classified);

  const fromStored = normalizeAttribution(stored);
  return isReusableStoredAttribution(fromStored) ? fromStored : normalizeAttribution();
}

export function createAnalyticsId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function resolveAnalyticsSession(storage, now = Date.now(), idFactory = createAnalyticsId) {
  try {
    const storedId = storage.getItem('sagemro_analytics_session_id');
    const storedActivity = storage.getItem('sagemro_analytics_last_activity_ms');
    const activity = Number(storedActivity);
    const canReuse = Boolean(storedId)
      && storedActivity !== null
      && storedActivity !== undefined
      && storedActivity !== ''
      && Number.isFinite(activity)
      && activity <= now
      && now - activity <= SESSION_IDLE_MS;

    const sessionId = canReuse ? storedId : idFactory('session');
    storage.setItem('sagemro_analytics_session_id', sessionId);
    storage.setItem('sagemro_analytics_last_activity_ms', String(now));
    return sessionId;
  } catch {
    return idFactory('session');
  }
}

export function createAnalyticsRequestId(idFactory = createAnalyticsId) {
  return idFactory('request');
}
