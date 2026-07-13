export const SUPPORTED_COORDINATE_SYSTEMS = new Set(['wgs84', 'gcj02']);

export function normalizeCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isValidCoordinatePair(latitude, longitude) {
  return latitude !== null && longitude !== null
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

const PI = Math.PI;
const AXIS = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(latitude, longitude) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLatitude(x, y) {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  value += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
  value += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
  return value;
}

function transformLongitude(x, y) {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  value += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
  value += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
  return value;
}

export function wgs84ToGcj02(latitude, longitude) {
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  const deltaLatitude = transformLatitude(longitude - 105, latitude - 35);
  const deltaLongitude = transformLongitude(longitude - 105, latitude - 35);
  const radLatitude = latitude / 180 * PI;
  const magic = 1 - EE * Math.sin(radLatitude) ** 2;
  const sqrtMagic = Math.sqrt(magic);
  return {
    latitude: latitude + (deltaLatitude * 180) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI),
    longitude: longitude + (deltaLongitude * 180) / (AXIS / sqrtMagic * Math.cos(radLatitude) * PI),
  };
}

export function gcj02ToWgs84(latitude, longitude) {
  if (outOfChina(latitude, longitude)) return { latitude, longitude };
  const converted = wgs84ToGcj02(latitude, longitude);
  return {
    latitude: latitude * 2 - converted.latitude,
    longitude: longitude * 2 - converted.longitude,
  };
}

export function convertCoordinatePair(latitude, longitude, fromSystem, toSystem) {
  if (fromSystem === toSystem) return { latitude, longitude };
  if (fromSystem === 'wgs84' && toSystem === 'gcj02') return wgs84ToGcj02(latitude, longitude);
  if (fromSystem === 'gcj02' && toSystem === 'wgs84') return gcj02ToWgs84(latitude, longitude);
  return null;
}

export function calculateDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusMeters = 6371008.8;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA))
      * Math.cos(toRadians(latitudeB))
      * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getArrivalRadiusMeters(accuracyMeters) {
  const accuracy = normalizeCoordinate(accuracyMeters);
  if (!accuracy || accuracy <= 0) return 150;
  return Math.min(500, Math.max(150, Math.ceil(accuracy * 2)));
}

export function evaluateArrivalCheck({
  targetLatitude,
  targetLongitude,
  targetCoordinateSystem = 'wgs84',
  currentLatitude,
  currentLongitude,
  currentAccuracyMeters,
  currentCoordinateSystem = 'wgs84',
}) {
  if (!SUPPORTED_COORDINATE_SYSTEMS.has(targetCoordinateSystem)
    || !SUPPORTED_COORDINATE_SYSTEMS.has(currentCoordinateSystem)) {
    return { valid: false, reason: 'unsupported_coordinate_system' };
  }
  if (!isValidCoordinatePair(targetLatitude, targetLongitude)
    || !isValidCoordinatePair(currentLatitude, currentLongitude)) {
    return { valid: false, reason: 'invalid_coordinates' };
  }

  const normalizedCurrent = convertCoordinatePair(
    currentLatitude,
    currentLongitude,
    currentCoordinateSystem,
    targetCoordinateSystem,
  );
  if (!normalizedCurrent) {
    return { valid: false, reason: 'coordinate_system_mismatch' };
  }

  const distanceMeters = calculateDistanceMeters(
    targetLatitude,
    targetLongitude,
    normalizedCurrent.latitude,
    normalizedCurrent.longitude,
  );
  const radiusMeters = getArrivalRadiusMeters(currentAccuracyMeters);

  return {
    valid: true,
    withinGeofence: distanceMeters <= radiusMeters,
    distanceMeters: Math.round(distanceMeters),
    radiusMeters,
  };
}
