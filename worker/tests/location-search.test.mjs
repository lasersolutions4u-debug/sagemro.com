import assert from 'node:assert/strict';
import test from 'node:test';

import { searchLocationProvider } from '../src/lib/location-search.js';

test('queries Amap for CN addresses and normalizes GCJ-02 results', async () => {
  let requestedUrl;
  const result = await searchLocationProvider({
    query: '济南市历城区',
    market: 'cn',
    env: { AMAP_WEB_SERVICE_KEY: 'test-amap-key' },
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({
        status: '1',
        geocodes: [{ formatted_address: '济南市历城区', location: '117.1201,36.6512', level: '区县' }],
      }));
    },
  });

  assert.equal(requestedUrl.hostname, 'restapi.amap.com');
  assert.equal(requestedUrl.searchParams.get('key'), 'test-amap-key');
  assert.equal(result.provider, 'amap');
  assert.equal(result.results[0].coordinate_system, 'gcj02');
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
