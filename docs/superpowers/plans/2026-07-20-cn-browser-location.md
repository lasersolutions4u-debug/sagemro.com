# Chinese Browser Location Implementation Plan

**Goal:** Remove all Chinese paid-geocoder requests while retaining free browser-based site location and arrival verification.

**Architecture:** Keep the shared location-search endpoint for international Mapbox users, but short-circuit the `cn` market before any provider request. Gate address-search controls by market in customer, conversion, and Admin flows while retaining the existing browser Geolocation API and manual Admin coordinate confirmation.

## Completed Work

- [x] Added a regression test proving Chinese location search makes zero provider calls.
- [x] Returned `{ provider: 'browser_location', results: [] }` for the `cn` market before provider credentials are read.
- [x] Preserved international Mapbox geocoding and its regression test.
- [x] Hidden Chinese address-search controls in customer, on-site conversion, and Admin confirmation flows.
- [x] Preserved browser coordinate capture, coordinate storage, arrival check-in, WGS84/GCJ-02 conversion, and geofence verification.
- [x] Removed the retired Chinese geocoder secret from deployment documentation and technical specifications.
- [x] Verified Worker tests, frontend lint/tests/build, and Admin tests/build on both release branches.
