const AMAP_GEOCODE_URL = 'https://restapi.amap.com/v3/geocode/geo';
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function normalizeLocationQuery(value) {
  return String(value || '').trim().slice(0, 120);
}

function normalizeLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isFinite(limit)) return 5;
  return Math.min(5, Math.max(1, limit));
}

export function parseAmapResults(data, limit = 5) {
  return (Array.isArray(data?.geocodes) ? data.geocodes : [])
    .map((item, index) => {
      const [longitude, latitude] = String(item.location || '').split(',').map(Number);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        id: `amap-${index}-${longitude}-${latitude}`,
        label: item.formatted_address || item.address || '',
        address: item.formatted_address || item.address || '',
        latitude,
        longitude,
        coordinate_system: 'gcj02',
        source: 'amap_geocode',
        level: item.level || null,
      };
    })
    .filter((item) => item?.label)
    .slice(0, limit);
}

export function parseMapboxResults(data, limit = 5) {
  return (Array.isArray(data?.features) ? data.features : [])
    .map((item, index) => {
      const [longitude, latitude] = Array.isArray(item.center) ? item.center : [];
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        id: `mapbox-${item.id || index}`,
        label: item.place_name || item.text || '',
        address: item.place_name || item.text || '',
        latitude,
        longitude,
        coordinate_system: 'wgs84',
        source: 'mapbox_geocode',
        level: Array.isArray(item.place_type) ? item.place_type[0] || null : null,
      };
    })
    .filter((item) => item?.label)
    .slice(0, limit);
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`location_provider_http_${response.status}`);
  return response.json();
}

export async function searchLocationProvider({ query, market, env, limit = 5, fetchImpl = fetch }) {
  const normalizedQuery = normalizeLocationQuery(query);
  const normalizedLimit = normalizeLimit(limit);
  if (normalizedQuery.length < 2) return { provider: market === 'cn' ? 'amap' : 'mapbox', results: [] };

  if (market === 'cn') {
    const apiKey = env?.AMAP_WEB_SERVICE_KEY;
    if (!apiKey) throw new Error('amap_key_not_configured');
    const url = new URL(AMAP_GEOCODE_URL);
    url.searchParams.set('address', normalizedQuery);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('output', 'json');
    const data = await fetchJson(url, fetchImpl);
    if (data?.status !== '1') throw new Error(`amap_${data?.info || 'request_failed'}`);
    return { provider: 'amap', results: parseAmapResults(data, normalizedLimit) };
  }

  const accessToken = env?.MAPBOX_ACCESS_TOKEN;
  if (!accessToken) throw new Error('mapbox_token_not_configured');
  const url = new URL(`${MAPBOX_GEOCODE_URL}/${encodeURIComponent(normalizedQuery)}.json`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', String(normalizedLimit));
  url.searchParams.set('language', 'en');
  const data = await fetchJson(url, fetchImpl);
  return { provider: 'mapbox', results: parseMapboxResults(data, normalizedLimit) };
}
