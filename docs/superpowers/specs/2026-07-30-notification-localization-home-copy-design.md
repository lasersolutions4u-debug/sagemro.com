# Notification Localization and Instant-Answer Homepage Copy

## Goal

Make Chinese in-app notifications consistently Chinese, align the unread count with the notification label, and update both public homepages to emphasize the immediate value of SAGEMRO AI.

The customer homepage remains AI-first. This change does not add marketing modules or alter the existing tools, insights, or service-promise placement.

## Approved Customer Copy

Chinese homepage:

- Headline: `设备问题不求人，即时交谈，马上就有答案`
- Intro: remove `遇到的` so the sentence uses `描述现场情况`.

International homepage:

- Headline: `Equipment trouble? Chat now. Get answers instantly.`
- The existing English intro remains unchanged.

## Notification Localization

### Root cause

The Chinese notification modal already localizes its interface controls, but stored notification title and body values are rendered as provided by the API. The existing display formatter translates Chinese service text into English for the international site; it intentionally does not translate English records into Chinese.

`field_day_report_submitted` is still generated in English for every market. Older `field_day_checked_in` records can also remain English even though new Chinese check-ins are now generated in Chinese.

### Design

The shared Worker will localize known system-generated notification types when a notification list is read from the Chinese market:

- `field_day_checked_in`
- `field_day_report_submitted`

The adapter will:

- convert the known English titles and bodies into approved Chinese copy;
- preserve the work-order number captured in the stored body;
- leave already-Chinese values unchanged;
- leave unknown notification types and user-authored text unchanged;
- leave international responses unchanged.

This read-time adapter makes existing English history display correctly without rewriting production data.

The field-day report creation path will also use the request market when writing new notifications. This prevents new Chinese records from being stored in English and keeps future notification delivery consistent with the in-app list.

No D1 migration or historical data backfill is required.

## Unread Badge Layout

The sidebar unread badge will participate in the same flex row as the bell icon and `通知` label:

- remove the absolute top-right positioning;
- use automatic left margin so it stays on the same line;
- keep vertical centering and the existing `99+` cap;
- preserve the same behavior in desktop and mobile sidebars.

The older toolbar implementation already uses an inline badge and does not need behavior changes.

## Error and Fallback Behavior

- If a legacy body does not match the known English template, preserve its original body rather than guessing.
- Notification loading, read state, navigation, and unread-count updates remain unchanged.
- Unknown notification types continue to display their stored values.

## Verification

Tests will be written before production changes and must demonstrate:

1. A Chinese notification-list response converts existing English check-in and field-report records.
2. An international notification-list response preserves the same English records.
3. A newly submitted Chinese field report writes Chinese notification copy.
4. The sidebar badge is inline with the notification label and no longer uses top-right absolute positioning.
5. Chinese and English homepage headlines match the approved copy, and the Chinese intro no longer contains `遇到的`.

Before release:

- run the complete Worker suite;
- run frontend lint, tests, and production build;
- run the Admin test/build gates required by the repository workflow.

## Release Sequence

1. Merge the shared Worker and international homepage change to `main`.
2. Verify the production Worker and international frontend deployment.
3. Synchronize the reviewed frontend and shared-code commits to `china-edition`.
4. Merge the China PR and manually run `aliyun-cn-deploy.yml`.
5. Smoke-test the COM homepage plus the CN customer, engineer, Admin, and API endpoints.
