import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getServicePage, getServicePages } from '../src/data/servicePages.js';
import { getDiagnosticGuides, getRelatedDiagnosticGuidesForService } from '../src/data/diagnosticGuides.js';
import { getServicePageRoute } from '../src/utils/servicePageRoute.js';

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

test('service routes lazy-load the public pages and preserve the existing conversion semantics', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(app, /const ServicePages = lazy\(\(\) => import\('\.\/components\/Services\/ServicePages'\)/);
  assert.match(app, /const serviceRoute = getServicePageRoute\(currentPath\);/);
  assert.match(app, /const isServicesPath = serviceRoute !== null;/);
  assert.match(app, /window\.history\.pushState\(\{\}, '', '\/'\);\s*setCurrentPath\('\/'\);/);
  assert.match(app, /const handleServiceRequest = useCallback\(\(\) => \{\s*setWorkOrderModalOpen\(true\);/);
  assert.match(app, /<ServicePages[\s\S]*onStartDiagnosis=\{handleServiceDiagnosis\}[\s\S]*onOpenServiceRequest=\{handleServiceRequest\}/);

  const [pages, conversionPanel] = await Promise.all([
    readFile(new URL('../src/components/Services/ServicePages.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/common/PublicConversionPanel.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(pages, /getServicePages\(locale\)/);
  assert.match(pages, /getServicePage\(slug, locale\)/);
  assert.match(pages, /<PublicConversionPanel/);
  const detail = pages.slice(pages.indexOf('function ServiceDetail'));
  const detailOrder = [
    'aria-label="breadcrumb"',
    'page.summary',
    '<InfoCard title={selectedCopy.equipment}',
    'page.process.map',
    'page.customerInputs.map',
    'page.remoteBoundary',
    'page.reviewedAt',
    '<PublicConversionPanel',
    'relatedPages.map',
  ];
  detailOrder.reduce((previousIndex, marker) => {
    const index = detail.indexOf(marker);
    assert.ok(index > previousIndex, `${marker} should follow the prior detail section`);
    return index;
  }, -1);
  assert.match(conversionPanel, /onStartDiagnosis/);
  assert.match(conversionPanel, /onOpenServiceRequest/);
});

test('service route parsing accepts only exact hub paths and rejects malformed paths', () => {
  assert.deepEqual(getServicePageRoute('/services'), { type: 'hub', slug: '' });
  assert.deepEqual(getServicePageRoute('/services/'), { type: 'hub', slug: '' });
  assert.deepEqual(getServicePageRoute('/services//'), { type: 'not-found', slug: '' });
  assert.deepEqual(getServicePageRoute('/services/unknown-service'), { type: 'detail', slug: 'unknown-service' });
  assert.equal(getServicePage(getServicePageRoute('/services/unknown-service').slug, 'en'), null);
  assert.deepEqual(getServicePageRoute('/services/laser-cutting-machine-repair//'), { type: 'not-found', slug: '' });
});

test('service pages link all and only relevant published diagnostic guides', async () => {
  const expectedRelations = {
    'laser-cutting-machine-repair': ['laser-protective-lens-burning', 'laser-cutting-machine-maintenance-checklist'],
    'press-brake-repair': [],
    'remote-diagnostics': [],
    'preventive-maintenance': ['laser-protective-lens-burning', 'laser-cutting-machine-maintenance-checklist'],
  };

  for (const locale of ['en', 'zh-CN']) {
    const publishedSlugs = new Set(getDiagnosticGuides(locale).map((guide) => guide.slug));
    const draftSlugs = new Set(getDiagnosticGuides(locale, { publishedOnly: false })
      .filter((guide) => guide.status === 'draft')
      .map((guide) => guide.slug));

    for (const page of getServicePages(locale)) {
      const guides = getRelatedDiagnosticGuidesForService(page.slug, locale);
      assert.deepEqual(guides.map((guide) => guide.slug), expectedRelations[page.slug]);
      assert.ok(guides.every((guide) => publishedSlugs.has(guide.slug)));
      assert.ok(guides.every((guide) => !draftSlugs.has(guide.slug)));
    }
  }

  const pages = await readFile(new URL('../src/components/Services/ServicePages.jsx', import.meta.url), 'utf8');
  assert.match(pages, /getRelatedDiagnosticGuidesForService\(page\.slug, locale\)/);
  assert.match(pages, /relatedGuides\.map/);
  assert.match(pages, /relatedGuides\.length/);
  assert.match(pages, /More reviewed guides will be added when their evidence is complete/);
  assert.match(pages, /更多指南将在证据完整并通过审核后发布/);
});

test('the public technical-review route and footer entry are bilingual runtime contracts', async () => {
  const [app, footer, page] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/common/Footer.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/About/TechnicalReviewPage.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /const TechnicalReviewPage = lazy/);
  assert.match(app, /currentPath === '\/about\/technical-review'/);
  assert.match(app, /<TechnicalReviewPage/);
  assert.match(footer, /href="\/about\/technical-review"/);
  assert.match(footer, /Technical review/);
  assert.match(footer, /技术审核/);
  assert.match(page, /getTechnicalReviewPolicy/);
  assert.match(page, /setSeoMetadata/);
  assert.match(page, /<Footer/);
});
