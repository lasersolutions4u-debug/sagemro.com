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
  if (targetCoordinateSystem !== currentCoordinateSystem) {
    return { valid: false, reason: 'coordinate_system_mismatch' };
  }
  if (!isValidCoordinatePair(targetLatitude, targetLongitude)
    || !isValidCoordinatePair(currentLatitude, currentLongitude)) {
    return { valid: false, reason: 'invalid_coordinates' };
  }

  const distanceMeters = calculateDistanceMeters(
    targetLatitude,
    targetLongitude,
    currentLatitude,
    currentLongitude,
  );
  const radiusMeters = getArrivalRadiusMeters(currentAccuracyMeters);

  return {
    valid: true,
    withinGeofence: distanceMeters <= radiusMeters,
    distanceMeters: Math.round(distanceMeters),
    radiusMeters,
  };
}
