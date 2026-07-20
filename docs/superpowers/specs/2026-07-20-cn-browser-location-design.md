# Chinese Browser Location Design

## Goal

Remove the Chinese site's paid Amap dependency while preserving customer site confirmation, engineer arrival check-in, coordinate storage, and geofence verification.

## Behavior

- Chinese customers enter the detailed site address manually and capture the equipment site's coordinates with the browser Geolocation API.
- Chinese on-site conversion uses the same browser location flow.
- Chinese Admin keeps manual address and coordinate confirmation for independently verified exceptions, with the existing audit reason.
- Chinese address-search controls are hidden and the Worker never calls a third-party geocoder for the `cn` market.
- International customer and Admin address search continues to use Mapbox.
- Existing WGS84/GCJ-02 conversion and arrival verification remain unchanged so legacy coordinates continue to work.

## Limits

- The person confirming the site must be physically near the equipment and allow browser location access.
- Browser geolocation requires HTTPS and is usually more accurate on a phone than on a desktop computer.
- Converting an arbitrary typed Chinese address into coordinates is intentionally no longer supported.

## Verification

- Worker unit tests prove Chinese searches make zero provider requests and international searches still use Mapbox.
- Frontend contract tests prove Chinese UI gates address-search controls while retaining browser geolocation and arrival check-in.
- Full Worker, frontend, and Admin CI commands must pass before deployment.
