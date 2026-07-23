const MAX_SERVICE_LOCATION_ACCURACY_METERS = 500;

function requestPosition(geolocation, options) {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function locationError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'BrowserGeolocationError';
  error.code = code;
  Object.assign(error, details);
  return error;
}

function normalizeGeolocationError(error) {
  if (isBrowserGeolocationError(error)) return error;
  return locationError(error?.code ?? 'unknown', error?.message || 'Unable to get browser location.', {
    cause: error,
  });
}

function ensureUsableAccuracy(position, maxAccuracyMeters) {
  const accuracy = Number(position?.coords?.accuracy);
  if (Number.isFinite(accuracy) && accuracy > maxAccuracyMeters) {
    throw locationError('accuracy_too_low', 'Location accuracy is too low.', { accuracy });
  }
  return position;
}

export async function getBrowserLocation({
  geolocation = globalThis.navigator?.geolocation,
  maxAccuracyMeters = MAX_SERVICE_LOCATION_ACCURACY_METERS,
} = {}) {
  if (!geolocation?.getCurrentPosition) {
    throw locationError('unsupported', 'Browser geolocation is unavailable.');
  }

  try {
    const position = await requestPosition(geolocation, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
    return ensureUsableAccuracy(position, maxAccuracyMeters);
  } catch (error) {
    if (![2, 3].includes(error?.code)) throw normalizeGeolocationError(error);
  }

  try {
    const position = await requestPosition(geolocation, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
    return ensureUsableAccuracy(position, maxAccuracyMeters);
  } catch (error) {
    throw normalizeGeolocationError(error);
  }
}

export function isBrowserGeolocationError(error) {
  return error?.name === 'BrowserGeolocationError';
}

export function formatGeolocationError(error, isCn) {
  const accuracy = Math.round(Number(error?.accuracy) || 0);
  const messages = isCn ? {
    unsupported: '当前浏览器不支持定位，请改用手机浏览器并确保系统定位已开启。',
    permission: '定位权限被拒绝。请在系统设置中允许浏览器使用定位，并在浏览器的网站设置中允许定位。',
    unavailable: '设备暂时无法确定位置。请开启系统定位和 Wi-Fi，移动到信号较好的位置后重试。',
    timeout: '获取位置超时。请开启 Wi-Fi，或改用设备现场的手机重试。',
    accuracy: `当前定位误差过大${accuracy ? `（约 ${accuracy} 米）` : ''}，不能用于现场核验。请在设备现场使用手机重新定位。`,
    unknown: '无法获取当前位置。请检查系统定位和浏览器网站权限后重试。',
  } : {
    unsupported: 'This browser does not support location. Use a mobile browser and enable system location services.',
    permission: 'Location permission was denied. Allow location for this browser in system settings and for this site in browser settings.',
    unavailable: 'Your device cannot determine its location. Enable system location services and Wi-Fi, then try again in an area with a better signal.',
    timeout: 'Location lookup timed out. Enable Wi-Fi or try again on a phone at the equipment site.',
    accuracy: `Location accuracy is too low${accuracy ? ` (about ${accuracy} m)` : ''} for site verification. Try again on a phone at the equipment site.`,
    unknown: 'Unable to get your current location. Check system location services and this site\'s browser permission, then try again.',
  };

  if (error?.code === 'unsupported') return messages.unsupported;
  if (error?.code === 'accuracy_too_low') return messages.accuracy;
  if (error?.code === 1) return messages.permission;
  if (error?.code === 2) return messages.unavailable;
  if (error?.code === 3) return messages.timeout;
  return messages.unknown;
}
