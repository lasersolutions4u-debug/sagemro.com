import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDistanceMeters,
  evaluateArrivalCheck,
  getArrivalRadiusMeters,
  wgs84ToGcj02,
} from '../src/lib/location.js';

test('calculates geographic distance in meters', () => {
  const distance = calculateDistanceMeters(0, 0, 0, 0.001);
  assert.ok(distance > 100 && distance < 115);
});

test('accepts an engineer location inside the accuracy-aware geofence', () => {
  const result = evaluateArrivalCheck({
    targetLatitude: 36.6512,
    targetLongitude: 117.1201,
    currentLatitude: 36.6518,
    currentLongitude: 117.1201,
    currentAccuracyMeters: 30,
  });

  assert.equal(result.valid, true);
  assert.equal(result.withinGeofence, true);
  assert.equal(result.radiusMeters, 150);
});

test('expands the geofence when browser accuracy is low', () => {
  assert.equal(getArrivalRadiusMeters(180), 360);
  assert.equal(getArrivalRadiusMeters(500), 500);
});

test('converts WGS84 engineer coordinates before checking a GCJ-02 site', () => {
  const target = wgs84ToGcj02(36.6512, 117.1201);
  const result = evaluateArrivalCheck({
    targetLatitude: target.latitude,
    targetLongitude: target.longitude,
    targetCoordinateSystem: 'gcj02',
    currentLatitude: 36.6512,
    currentLongitude: 117.1201,
    currentCoordinateSystem: 'wgs84',
    currentAccuracyMeters: 10,
  });
  assert.equal(result.valid, true);
  assert.equal(result.withinGeofence, true);

  const distant = evaluateArrivalCheck({
    targetLatitude: 36.6512,
    targetLongitude: 117.1201,
    currentLatitude: 36.6612,
    currentLongitude: 117.1201,
    currentAccuracyMeters: 10,
  });
  assert.equal(distant.valid, true);
  assert.equal(distant.withinGeofence, false);
});
