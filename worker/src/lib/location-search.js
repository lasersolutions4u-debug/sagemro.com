const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function normalizeLocationQuery(value) {
  return String(value || '').trim().slice(0, 120);
}

function normalizeLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isFinite(limit)) return 5;
  return Math.min(5, Math.max(1, limit));
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
  if (market === 'cn') {
    return { provider: 'browser_location', results: [] };
  }

  if (normalizedQuery.length < 2) return { provider: 'mapbox', results: [] };

  const accessToken = env?.MAPBOX_ACCESS_TOKEN;
  if (!accessToken) throw new Error('mapbox_token_not_configured');
  const url = new URL(`${MAPBOX_GEOCODE_URL}/${encodeURIComponent(normalizedQuery)}.json`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', String(normalizedLimit));
  url.searchParams.set('language', 'en');
  const data = await fetchJson(url, fetchImpl);
  return { provider: 'mapbox', results: parseMapboxResults(data, normalizedLimit) };
}
