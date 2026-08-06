import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getDiagnosticGuide, getDiagnosticGuides } from '../src/data/diagnosticGuides.js';
import { getTechnicalAuthor } from '../src/data/technicalAuthors.js';

const expectedTopics = [
  ['laser-cutting-machine-not-firing', 'Laser cutting machine not firing', '激光切割机不出光'],
  ['fiber-laser-burr-and-dross', 'Fiber laser burr and dross troubleshooting', '激光切割毛刺与挂渣排查'],
  ['laser-chiller-alarm-troubleshooting', 'Laser chiller alarm troubleshooting', '激光冷水机报警排查'],
  ['laser-protective-lens-burning', 'Why a laser protective lens keeps burning', '激光保护镜片频繁烧坏的原因'],
  ['press-brake-angle-inaccuracy', 'Press brake angle inaccuracy troubleshooting', '折弯角度不准怎么排查'],
  ['press-brake-angle-variation', 'Uneven bend angle across the part', '折弯角度左右不一致怎么排查'],
  ['press-brake-low-hydraulic-pressure', 'Press brake low hydraulic pressure checks', '折弯机液压压力不足检查'],
  ['laser-cutting-machine-maintenance-checklist', 'Laser cutting machine maintenance checklist', '激光切割机维护保养检查表'],
  ['press-brake-maintenance-checklist', 'Press brake maintenance checklist', '折弯机维护保养检查表'],
];

const expectedPublishedSlugs = [
  'laser-protective-lens-burning',
  'laser-cutting-machine-maintenance-checklist',
];

const expectedDraftSlugs = expectedTopics
  .map(([slug]) => slug)
  .filter((slug) => !expectedPublishedSlugs.includes(slug));

const prohibitedClaims = /fault code|故障代码|\bmost (?:common|likely)\b|最常见|排名|frequency|频率|OEM authorization|authorized (?:by|OEM)|授权|coverage|覆盖范围|certified|认证|case study|案例|success rate|成功率/i;

function publicCopy(guide) {
  return [
    guide.title,
    guide.description,
    guide.directAnswer,
    guide.safety,
    ...guide.symptoms,
    ...guide.causes,
    ...guide.checks,
    ...guide.actions,
    ...guide.stopConditions,
    guide.diagnosisPrompt,
  ].join(' ');
}

test('technical content resolves to a real public team identity', () => {
  for (const locale of ['en', 'zh-CN']) {
    const team = getTechnicalAuthor('sagemro-technical-service-team', locale);

    assert.equal(team.type, 'team');
    assert.match(team.name, /SAGEMRO/);
    assert.ok(team.bio.length >= 80);
    assert.equal(
      team.url,
      `${locale === 'zh-CN' ? 'https://sagemro.cn' : 'https://sagemro.com'}/about/technical-review`,
    );
  }
});

test('the complete bilingual diagnostic set contains exactly the nine approved topics', () => {
  for (const [locale, titleIndex] of [['en', 1], ['zh-CN', 2]]) {
    const guides = getDiagnosticGuides(locale, { publishedOnly: false });

    assert.deepEqual(guides.map((guide) => guide.slug), expectedTopics.map(([slug]) => slug));
    assert.deepEqual(guides.map((guide) => guide.title), expectedTopics.map((topic) => topic[titleIndex]));
    assert.equal(new Set(guides.map((guide) => guide.slug)).size, expectedTopics.length);
    assert.equal(getDiagnosticGuide('not-a-guide', locale), null);
  }
});

test('publication gate requires reviewed, evidence-complete diagnostic records', () => {
  for (const locale of ['en', 'zh-CN']) {
    const guides = getDiagnosticGuides(locale, { publishedOnly: false });

    for (const guide of guides) {
      assert.ok(['published', 'draft'].includes(guide.status));
      assert.ok(guide.description.length > 0);
      assert.ok(guide.directAnswer.length > 0);
      assert.ok(guide.safety.length > 0);
      assert.ok(guide.symptoms.length >= 2);
      assert.equal(guide.causes.length, guide.checks.length);
      assert.equal(guide.checks.length, guide.actions.length);
      assert.ok(guide.causes.length >= 3);
      assert.ok(guide.stopConditions.length >= 2);
      assert.ok(guide.relatedServiceSlug.length > 0);
      assert.ok(guide.relatedToolSlug.length > 0);
      assert.ok(guide.diagnosisPrompt.length > 0);
      assert.equal(guide.authorId, 'sagemro-technical-service-team');
      assert.equal(guide.reviewedBy, 'sagemro-technical-service-team');

      if (guide.status === 'published') {
        assert.equal(guide.publishedAt, '2026-08-06');
        assert.equal(guide.reviewedAt, '2026-08-06');
        assert.ok(guide.references.length > 0 || guide.internalEvidenceNotes.length > 0);

        for (const reference of guide.references) {
          assert.ok(reference.title.length > 0);
          assert.ok(reference.publisher.length > 0);
          assert.match(reference.url, /^https:\/\//);
          assert.equal(reference.accessedAt, '2026-08-06');
        }
      }
    }
  }
});

test('drafts are omitted by default and never appear in the current sitemap', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

  for (const locale of ['en', 'zh-CN']) {
    const completeSet = getDiagnosticGuides(locale, { publishedOnly: false });
    const visibleSet = getDiagnosticGuides(locale);
    const drafts = completeSet.filter((guide) => guide.status === 'draft');

    assert.deepEqual(visibleSet.map((guide) => guide.slug), expectedPublishedSlugs);
    assert.deepEqual(drafts.map((guide) => guide.slug), expectedDraftSlugs);
    assert.deepEqual(visibleSet, completeSet.filter((guide) => guide.status === 'published'));
    drafts.forEach((draft) => {
      assert.equal(getDiagnosticGuide(draft.slug, locale), null);
      assert.doesNotMatch(sitemap, new RegExp(`/diagnostics/${draft.slug}`));
    });
    visibleSet.forEach((guide) => assert.equal(getDiagnosticGuide(guide.slug, locale)?.slug, guide.slug));
  }
});

test('guides separate observations from diagnosis and keep safe escalation boundaries', () => {
  for (const locale of ['en', 'zh-CN']) {
    for (const guide of getDiagnosticGuides(locale, { publishedOnly: false })) {
      if (locale === 'en') {
        assert.match(guide.directAnswer, /observ(?:ation|ed|able)/i);
        assert.match(guide.directAnswer, /not (?:yet )?a diagnosis/i);
      } else {
        assert.match(guide.directAnswer, /现象|观察/);
        assert.match(guide.directAnswer, /不是.*诊断|不等于.*诊断/);
      }

      const stops = guide.stopConditions.join(' ');
      if (locale === 'en') {
        assert.match(stops, /exposed energized parts/i);
        assert.match(stops, /guard|interlock/i);
        assert.match(stops, /uncontrolled (?:hydraulic|mechanical)(?: or (?:hydraulic|mechanical))? movement/i);
        assert.match(stops, /smoke|fire|overheating/i);
        assert.match(stops, /OEM-only calibration/i);
      } else {
        assert.match(stops, /裸露带电部件/);
        assert.match(stops, /防护装置|联锁/);
        assert.match(stops, /失控的液压或机械运动/);
        assert.match(stops, /烟雾|起火|过热/);
        assert.match(stops, /仅限 OEM.*校准/);
      }

      assert.doesNotMatch(publicCopy(guide), prohibitedClaims);
      assert.doesNotMatch(publicCopy(guide), /\b\d+(?:\.\d+)?\s*(?:bar|psi|mm|°C|kW|V|A)\b/i);
    }
  }
});

test('callers receive copies instead of mutable diagnostic source records', () => {
  const first = getDiagnosticGuides('en', { publishedOnly: false });
  first[0].symptoms.push('mutation');
  first[0].references.push({ title: 'mutation' });

  const second = getDiagnosticGuides('en', { publishedOnly: false });
  assert.doesNotMatch(second[0].symptoms.join(' '), /mutation/);
  assert.doesNotMatch(JSON.stringify(second[0].references), /mutation/);
});
