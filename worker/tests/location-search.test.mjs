import assert from 'node:assert/strict';
import test from 'node:test';

import { searchLocationProvider } from '../src/lib/location-search.js';

test('does not query a third-party geocoder for CN addresses', async () => {
  let requestCount = 0;
  const result = await searchLocationProvider({
    query: '济南市历城区',
    market: 'cn',
    fetchImpl: async () => {
      requestCount += 1;
      throw new Error('CN location search must not call a provider');
    },
  });

  assert.equal(requestCount, 0);
  assert.equal(result.provider, 'browser_location');
  assert.deepEqual(result.results, []);
});

test('queries Mapbox for international addresses and normalizes WGS84 results', async () => {
  let requestedUrl;
  const result = await searchLocationProvider({
    query: 'Birmingham, United Kingdom',
    market: 'com',
    env: { MAPBOX_ACCESS_TOKEN: 'test-mapbox-token' },
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        features: [{ id: 'place.1', place_name: 'Birmingham, United Kingdom', center: [-1.8904, 52.4862], place_type: ['place'] }],
      }));
    },
  });

  assert.equal(requestedUrl.hostname, 'api.mapbox.com');
  assert.equal(requestedUrl.searchParams.get('access_token'), 'test-mapbox-token');
  assert.equal(result.provider, 'mapbox');
  assert.equal(result.results[0].coordinate_system, 'wgs84');
});
