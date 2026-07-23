import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatGeolocationError,
  getBrowserLocation,
  isBrowserGeolocationError,
} from '../src/utils/browserGeolocation.js';

function geolocationWithResults(results) {
  const calls = [];
  return {
    calls,
    getCurrentPosition(success, failure, options) {
      calls.push(options);
      const result = results.shift();
      if (result.coords) success(result);
      else failure(result);
    },
  };
}

test('browser location retries without high accuracy after timeout', async () => {
  const geolocation = geolocationWithResults([
    { code: 3, message: 'Timed out' },
    { coords: { latitude: 23.1, longitude: 113.3, accuracy: 120 } },
  ]);

  const position = await getBrowserLocation({ geolocation });

  assert.equal(position.coords.accuracy, 120);
  assert.equal(geolocation.calls.length, 2);
  assert.equal(geolocation.calls[0].enableHighAccuracy, true);
  assert.equal(geolocation.calls[1].enableHighAccuracy, false);
});

test('browser location retries without high accuracy when position is unavailable', async () => {
  const geolocation = geolocationWithResults([
    { code: 2, message: 'Position unavailable' },
    { coords: { latitude: 23.1, longitude: 113.3, accuracy: 80 } },
  ]);

  const position = await getBrowserLocation({ geolocation });

  assert.equal(position.coords.accuracy, 80);
  assert.equal(geolocation.calls.length, 2);
  assert.equal(geolocation.calls[1].enableHighAccuracy, false);
});

test('browser location does not retry permission denial', async () => {
  const denied = { code: 1, message: 'Permission denied' };
  const geolocation = geolocationWithResults([denied]);

  await assert.rejects(getBrowserLocation({ geolocation }), { code: denied.code });
  assert.equal(geolocation.calls.length, 1);
});

test('browser location rejects coordinates too coarse for service-site verification', async () => {
  const geolocation = geolocationWithResults([
    { coords: { latitude: 23.1, longitude: 113.3, accuracy: 900 } },
  ]);

  await assert.rejects(getBrowserLocation({ geolocation }), { code: 'accuracy_too_low' });
});

test('browser location rejects coarse coordinates returned by the fallback request', async () => {
  const geolocation = geolocationWithResults([
    { code: 3, message: 'Timed out' },
    { coords: { latitude: 23.1, longitude: 113.3, accuracy: 900 } },
  ]);

  await assert.rejects(getBrowserLocation({ geolocation }), { code: 'accuracy_too_low' });
});

test('browser location errors are distinguishable from coded API errors', async () => {
  const geolocation = geolocationWithResults([{ code: 1, message: 'Permission denied' }]);
  let locationFailure;
  try {
    await getBrowserLocation({ geolocation });
  } catch (error) {
    locationFailure = error;
  }

  const apiFailure = Object.assign(new Error('Arrival verification is unavailable.'), { code: 409 });
  assert.equal(isBrowserGeolocationError(locationFailure), true);
  assert.equal(isBrowserGeolocationError(apiFailure), false);
});

test('browser location errors explain permission, availability, timeout, and accuracy', () => {
  assert.match(formatGeolocationError({ code: 1 }, true), /系统设置.*浏览器/);
  assert.match(formatGeolocationError({ code: 2 }, true), /无法确定位置/);
  assert.match(formatGeolocationError({ code: 3 }, true), /超时/);
  assert.match(formatGeolocationError({ code: 'accuracy_too_low' }, true), /手机/);
  assert.match(formatGeolocationError({ code: 1 }, false), /system settings/i);
});
