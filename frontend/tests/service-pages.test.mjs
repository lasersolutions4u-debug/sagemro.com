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
  'equipment-system-retrofit',
  'machine-relocation-installation',
  'used-equipment-evaluation',
  'spare-parts-consumables',
  // 后四条按「以什么身份、按什么方式买」划分：前八条覆盖机型/部件，这四条覆盖
  // 整机厂合作、委外、海外交付与第三方身份——关键词调研显示这四簇几乎无人做落地页。
  'oem-service-partner',
  'after-sales-outsourcing',
  'overseas-delivery',
  'third-party-service',
];

const expectedTitles = {
  en: [
    'Laser Cutting Machine Repair & Diagnostics',
    'Press Brake Repair & Accuracy Support',
    'Industrial Equipment Remote Diagnostics',
    'Preventive Maintenance for Laser and Forming Equipment',
    'Equipment System Retrofit & Upgrade Support',
    'Machine Relocation, Installation & Commissioning',
    'Used Equipment Evaluation & Disposal Planning',
    'Spare Parts & Consumables Support',
    'OEM After-Sales Service Partner',
    'Outsourced Field Service for Laser Equipment',
    'Overseas Installation, Commissioning, and Warranty Response',
    'Third-Party and Multi-Brand Equipment Service',
  ],
  'zh-CN': [
    '激光切割机维修与故障诊断',
    '折弯机维修与精度支持',
    '工业设备远程诊断与工程师支持',
    '激光与金属成形设备预防性维护',
    '设备系统升级改造支持',
    '设备拆机、移位、安装与调试',
    '二手设备评估与处置建议',
    '备件与耗材供应支持',
    '整机厂售后合作',
    '设备委外维修与售后外包',
    '出口设备海外交付',
    '第三方与多品牌设备服务',
  ],
};

const remoteExclusions = [
  /energized electrical work/i,
  /safety-circuit bypass/i,
  /hydraulic opening under pressure/i,
  /OEM-only procedures/i,
];

// 名字里的数字要与 expectedSlugs 同步：这里曾长期写着 "eight"，而记录早已是 12 条，
// 于是测试名成了误导性文档。数字型的测试名最容易这样静默过期。
test('service hub exposes the twelve approved bilingual service records', () => {
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
      assert.equal(page.reviewedBy, undefined);
      assert.equal(page.reviewedAt, undefined);
      assert.ok(page.serviceKind);
      assert.ok(page.evidenceNotes.length > 0);
      assert.equal(getServicePage(page.slug, locale).slug, page.slug);
    }
  }

  assert.equal(getServicePage('not-a-service', 'en'), null);
});

test('used equipment service is an evaluation and disposal advisory service without an acquisition promise', () => {
  const englishPage = getServicePage('used-equipment-evaluation', 'en');
  const chinesePage = getServicePage('used-equipment-evaluation', 'zh-CN');

  const englishCopy = Object.values(englishPage).flat().join(' ');
  const chineseCopy = Object.values(chinesePage).flat().join(' ');

  assert.match(englishCopy, /evaluation/i);
  assert.match(englishCopy, /disposal/i);
  assert.match(englishCopy, /does not constitute.*purchase|no purchase commitment/i);
  assert.match(chineseCopy, /评估/);
  assert.match(chineseCopy, /处置/);
  assert.match(chineseCopy, /不构成.*收购承诺|不承诺收购/);
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
        // 额外小节同样是公开文案，必须一起过零数字与措辞检查。
        ...(page.extraSections ?? []).flatMap((section) => [section.heading, section.body]),
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
  assert.match(app, /const serviceRoute = portalTarget === 'public' \? getServicePageRoute\(currentPath\) : null;/);
  assert.match(app, /const isServicesPath = serviceRoute !== null;/);
  assert.match(app, /window\.history\.pushState\(\{\}, '', '\/'\);\s*setCurrentPath\('\/'\);/);
  // 服务请求页面已下线：服务页的转化入口改为打开咨询线索表单。
  assert.doesNotMatch(app, /service-request\?mode=manual/);
  assert.match(app, /<ServicePages[\s\S]*onStartDiagnosis=\{openConsultation\}[\s\S]*onOpenServiceRequest=\{openConsultation\}/);

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
    'page.evidenceNotes',
    '<PublicConversionPanel',
    'relatedPages.map',
  ];
  detailOrder.reduce((previousIndex, marker) => {
    const index = detail.indexOf(marker);
    assert.ok(index > previousIndex, `${marker} should follow the prior detail section`);
    return index;
  }, -1);
  assert.doesNotMatch(conversionPanel, /onStartDiagnosis/);
  assert.doesNotMatch(conversionPanel, /onOpenServiceRequest/);
  assert.match(conversionPanel, /openConsultationForm\(\)/);
  assert.match(conversionPanel, /href=\{diagnosisHref\}/);
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
    'equipment-system-retrofit': [],
    'machine-relocation-installation': [],
    'used-equipment-evaluation': [],
    'spare-parts-consumables': [],
    // 新增的四条「按身份/商业形态」入口目前不挂诊断指南——它们没有对应的故障处置内容，
    // 硬挂会给出不相关的链接。
    'oem-service-partner': [],
    'after-sales-outsourcing': [],
    'overseas-delivery': [],
    'third-party-service': [],
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
  assert.doesNotMatch(pages, /More reviewed guides will be added when their evidence is complete/);
  assert.doesNotMatch(pages, /更多指南将在证据完整并通过审核后发布/);
  assert.match(pages, /relatedGuides\.length > 0 &&/);
});

test('exchange units live as an anchored section of the parts page, not a separate page', () => {
  // 交换件是备件服务的一个机制，不是独立服务：单独开页会把内链权重劈到两个 URL 争同一主题，
  // 而这些词的已验证需求近乎零。所以它以一个带锚点的小节存在，日后真出询盘再升级为独立页。
  for (const locale of ['en', 'zh-CN']) {
    const parts = getServicePage('spare-parts-consumables', locale);
    assert.equal(parts.extraSections.length, 1);
    const [section] = parts.extraSections;
    assert.equal(section.anchor, 'exchange-unit');
    assert.ok(section.heading.length > 0);
    assert.ok(section.body.length > 0);

    // 其它服务页不带额外小节——否则这个机制会到处复制。
    for (const page of getServicePages(locale)) {
      if (page.slug === 'spare-parts-consumables') continue;
      assert.deepEqual(page.extraSections, [], `${page.slug} 不应有额外小节`);
    }

    // 返回的是副本，改一处不会污染下一次读取。
    const fresh = getServicePage('spare-parts-consumables', locale);
    fresh.extraSections[0].heading = 'changed';
    assert.notEqual(getServicePage('spare-parts-consumables', locale).extraSections[0].heading, 'changed');
  }
});

test('the public technical-review route and footer entry are bilingual runtime contracts', async () => {
  const [app, footer, page] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/common/Footer.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/About/TechnicalReviewPage.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /const TechnicalReviewPage = lazy/);
  assert.match(app, /const isTechnicalReviewPath = currentPath === '\/about\/technical-review'\s*\|\| currentPath === '\/about\/technical-review\/'/);
  assert.ok((app.match(/isTechnicalReviewPath/g) || []).length >= 4);
  assert.match(app, /<TechnicalReviewPage/);
  assert.match(footer, /href="\/about\/technical-review\/"/);
  assert.match(footer, /Technical review/);
  assert.match(footer, /技术审核/);
  assert.match(page, /getTechnicalReviewPolicy/);
  assert.match(page, /setSeoMetadata/);
  assert.match(page, /canonical = `\$\{host\}\/about\/technical-review\/`/);
  assert.match(page, /import \{ PublicSiteShell \}/);
  assert.match(page, /<PublicSiteShell isCn=\{locale === 'zh-CN'\} onOpenLegal=\{onOpenLegal\}>/);
});
