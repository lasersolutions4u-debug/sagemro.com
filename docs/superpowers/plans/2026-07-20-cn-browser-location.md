# Chinese Browser Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Chinese Amap requests while retaining free browser-based site location and arrival verification.

**Architecture:** Keep the shared location-search endpoint for international Mapbox users, but short-circuit the `cn` market before any provider request. Gate address-search controls by market in customer, conversion, and Admin flows while retaining the existing browser Geolocation API and manual Admin coordinate confirmation.

**Tech Stack:** React, Vite, Cloudflare Workers, Node test runner

## Global Constraints

- Do not change the arrival geofence or coordinate-conversion algorithms.
- Do not add a replacement paid or free-quota map provider.
- Keep international Mapbox behavior unchanged.
- Do not add a database migration.

---

### Task 1: Provider Boundary

**Files:**
- Modify: `worker/tests/location-search.test.mjs`
- Modify: `worker/src/lib/location-search.js`
- Modify: `worker/src/index.js`

- [x] Add a failing test that counts provider calls for a Chinese location search and expects zero.
- [x] Return `{ provider: 'browser_location', results: [] }` for the `cn` market before reading provider credentials.
- [x] Keep the existing Mapbox test passing.
- [x] Remove the retired Chinese geocoder configuration and API descriptions.

### Task 2: Chinese Customer Flows

**Files:**
- Modify: `frontend/tests/work-order-location-contract.test.mjs`
- Modify: `frontend/src/components/Sidebar/WorkOrderModal.jsx`
- Modify: `frontend/src/components/WorkOrder/WorkOrderDetailModal.jsx`

- [x] Add failing contract assertions for market-gated address-search controls.
- [x] Hide address search and search results when `isCn` is true.
- [x] Keep browser location capture, coordinate submission, and engineer arrival check-in unchanged.
- [x] Update Chinese operational copy to tell the user to capture the equipment site's current location.

### Task 3: Chinese Admin Flow

**Files:**
- Modify: `admin/src/pages/WorkOrdersPage.jsx`

- [x] Hide Admin map search for `zh-CN`.
- [x] Preserve manual address, latitude, longitude, coordinate-system, reason, and audit submission.
- [x] Replace Chinese map wording with independently verified site-coordinate wording.

### Task 4: Configuration and Verification

**Files:**
- Modify: `DEPLOY.md`
- Modify: `TECH-SPEC.md`

- [x] Remove the retired Chinese geocoder secret from required deployment configuration.
- [x] Run Worker tests, frontend lint/tests/build, and Admin tests/build.
- [x] Repeat the relevant verification on `china-edition`.
