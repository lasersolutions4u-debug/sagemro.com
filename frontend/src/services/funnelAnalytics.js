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
// Snapshot of https://www.google.com/supported_domains, accessed 2026-08-07; leading dots normalized.
const GOOGLE_SEARCH_HOSTS = new Set(`google.com google.ad google.ae google.com.af google.com.ag google.al google.am google.co.ao google.com.ar google.as google.at google.com.au google.az google.ba google.com.bd google.be google.bf google.bg google.com.bh google.bi google.bj google.com.bn google.com.bo google.com.br google.bs google.bt google.co.bw google.by google.com.bz google.ca google.cd google.cf google.cg google.ch google.ci google.co.ck google.cl google.cm google.cn google.com.co google.co.cr google.com.cu google.cv google.com.cy google.cz google.de google.dj google.dk google.dm google.com.do google.dz google.com.ec google.ee google.com.eg google.es google.com.et google.fi google.com.fj google.fm google.fr google.ga google.ge google.gg google.com.gh google.com.gi google.gl google.gm google.gr google.com.gt google.gy google.com.hk google.hn google.hr google.ht google.hu google.co.id google.ie google.co.il google.im google.co.in google.iq google.is google.it google.je google.com.jm google.jo google.co.jp google.co.ke google.com.kh google.ki google.kg google.co.kr google.com.kw google.kz google.la google.com.lb google.li google.lk google.co.ls google.lt google.lu google.lv google.com.ly google.co.ma google.md google.me google.mg google.mk google.ml google.com.mm google.mn google.com.mt google.mu google.mv google.mw google.com.mx google.com.my google.co.mz google.com.na google.com.ng google.com.ni google.ne google.nl google.no google.com.np google.nr google.nu google.co.nz google.com.om google.com.pa google.com.pe google.com.pg google.com.ph google.com.pk google.pl google.pn google.com.pr google.ps google.pt google.com.py google.com.qa google.ro google.ru google.rw google.com.sa google.com.sb google.sc google.se google.com.sg google.sh google.si google.sk google.com.sl google.sn google.so google.sm google.sr google.st google.com.sv google.td google.tg google.co.th google.com.tj google.tl google.tm google.tn google.to google.com.tr google.tt google.com.tw google.co.tz google.com.ua google.co.ug google.co.uk google.com.uy google.co.uz google.com.vc google.co.ve google.co.vi google.com.vn google.vu google.ws google.rs google.co.za google.co.zm google.co.zw google.cat`.split(' '));

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
  return hasAttribution(attribution)
    && Boolean(source)
    && source !== 'direct'
    && Boolean(medium)
    && medium !== 'none'
    && medium !== 'direct';
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
