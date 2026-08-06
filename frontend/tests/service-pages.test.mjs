import assert from 'node:assert/strict';
import test from 'node:test';

import { getServicePage, getServicePages } from '../src/data/servicePages.js';

const expectedSlugs = [
  'laser-cutting-machine-repair',
  'press-brake-repair',
  'remote-diagnostics',
  'preventive-maintenance',
];

const expectedTitles = {
  en: [
    'Laser Cutting Machine Repair & Diagnostics',
    'Press Brake Repair & Accuracy Support',
    'Industrial Equipment Remote Diagnostics',
    'Preventive Maintenance for Laser and Forming Equipment',
  ],
  'zh-CN': [
    '激光切割机维修与故障诊断',
    '折弯机维修与精度支持',
    '工业设备远程诊断与工程师支持',
    '激光与金属成形设备预防性维护',
  ],
};

const remoteExclusions = [
  /energized electrical work/i,
  /safety-circuit bypass/i,
  /hydraulic opening under pressure/i,
  /OEM-only procedures/i,
];

test('service hub exposes the four approved bilingual service records', () => {
  for (const locale of ['en', 'zh-CN']) {
    const pages = getServicePages(locale);

    assert.deepEqual(pages.map((page) => page.slug), expectedSlugs);
    assert.deepEqual(pages.map((page) => page.title), expectedTitles[locale]);
    assert.equal(new Set(pages.map((page) => page.slug)).size, expectedSlugs.length);

    for (const page of pages) {
      assert.equal(page.status, 'published');
      assert.ok(page.description.length > 0);
      assert.ok(page.summary.length > 0);
      assert.ok(page.equipment.length > 0);
      assert.ok(page.issues.length >= 3);
      assert.ok(page.process.length >= 4);
      assert.ok(page.customerInputs.length >= 4);
      assert.ok(page.remoteBoundary.length > 0);
      assert.ok(page.onsiteBoundary.length > 0);
      assert.ok(page.primaryCta.length > 0);
      assert.ok(page.secondaryCta.length > 0);
      assert.equal(page.reviewedBy, 'sagemro-technical-service-team');
      assert.ok(page.publishedAt.length > 0);
      assert.ok(page.reviewedAt.length > 0);
      assert.ok(page.evidenceNotes.length > 0);
      assert.equal(getServicePage(page.slug, locale).slug, page.slug);
    }
  }

  assert.equal(getServicePage('not-a-service', 'en'), null);
});

test('service records keep the approved operational and safety boundaries', () => {
  for (const page of getServicePages('en')) {
    assert.deepEqual(page.process, [
      'Describe the symptom and operating context',
      'Share model, alarm, photos, and recent changes',
      'Review safe checks and decide remote or onsite escalation',
      'Record the agreed next action in the SAGEMRO service workspace',
    ]);
    remoteExclusions.forEach((exclusion) => assert.match(page.remoteBoundary, exclusion));
    assert.match(page.onsiteBoundary, /confirmed after equipment, location, urgency, and engineer fit are reviewed/i);
  }

  for (const page of getServicePages('zh-CN')) {
    assert.match(page.remoteBoundary, /带电电气作业/);
    assert.match(page.remoteBoundary, /旁路.*安全回路/);
    assert.match(page.remoteBoundary, /带压.*液压/);
    assert.match(page.remoteBoundary, /仅限 OEM/);
    assert.match(page.onsiteBoundary, /设备、地点、紧急程度和工程师匹配情况.*评估/);
  }
});

test('service content avoids unsupported claims and numeric service promises', () => {
  for (const locale of ['en', 'zh-CN']) {
    for (const page of getServicePages(locale)) {
      const publicCopy = [
        page.title,
        page.seoTitle,
        page.description,
        page.summary,
        page.equipment,
        ...page.issues,
        ...page.process,
        ...page.customerInputs,
        page.remoteBoundary,
        page.onsiteBoundary,
        page.primaryCta,
        page.secondaryCta,
        page.evidenceNotes,
      ].join(' ');

      assert.doesNotMatch(publicCopy, /\d/);
      assert.doesNotMatch(publicCopy, /OEM authorization|authorized (?:by|OEM)|certified|success rate|coverage guarantee/i);
      assert.doesNotMatch(publicCopy, /manufacturer fault code|named case/i);
    }
  }
});
