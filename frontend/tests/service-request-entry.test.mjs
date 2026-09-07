import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCustomerPortalUrl, parseServiceRequestEntry } from '../src/utils/portalTarget.js';
import { getServicePages } from '../src/data/servicePages.js';
import { getPublicHomeContent } from '../src/data/publicHomeContent.js';
import { getPublicSeoRoutes } from '../src/data/publicSeoRoutes.js';
import * as drafts from '../src/components/ServiceRequest/serviceRequestDraft.js';

test('AI entry opens chat, manual entry opens the single form in both markets', () => {
  for (const market of ['cn', 'com']) {
    for (const mode of ['assist', 'manual']) {
      const url = new URL(buildCustomerPortalUrl({ market, presets: { mode, service: 'retrofit' } }));
      assert.equal(url.pathname, mode === 'assist' ? '/' : '/service-request');
      assert.equal(url.host, `ai.sagemro.${market}`);
      assert.equal(parseServiceRequestEntry(url.search).presets.service_kind, 'retrofit');
    }
    assert.equal(new URL(getPublicHomeContent(market === 'cn').requestCtas.assist.href).pathname, '/');
  }
});

test('every bilingual service selects its matching request type without an invented review date', () => {
  const kinds = ['repair', 'repair', 'repair', 'maintenance', 'retrofit', 'relocation', 'used_equipment', 'parts'];
  for (const locale of ['en', 'zh-CN']) {
    const pages = getServicePages(locale);
    assert.deepEqual(pages.map((page) => page.serviceKind), kinds);
    for (const page of pages) {
      assert.equal(page.reviewedAt, undefined);
      assert.equal(page.reviewedBy, undefined);
      const route = getPublicSeoRoutes(locale).find((route) => route.path === `/services/${page.slug}`);
      assert.equal(route.modified, undefined);
      assert.equal(route.body.emptyState, '');
    }
  }
});

test('saved requests require an explicit choice and a new entry is never mixed with the saved request', () => {
  assert.equal(typeof drafts.getServiceRequestDraftChoices, 'function');
  const saved = drafts.createEmptyServiceRequestDraft({ presets: { service_kind: 'repair', description: 'Example machine fault.' } });
  saved.step = 4;
  const choices = drafts.getServiceRequestDraftChoices(saved, {
    mode: 'manual', presets: { service_kind: 'retrofit', description: 'Example upgrade request.' },
  });
  assert.equal(choices.needsChoice, true);
  assert.equal(choices.saved.service_kind, 'repair');
  assert.equal(choices.saved.step, 4);
  assert.equal(choices.fresh.service_kind, 'retrofit');
  assert.equal(choices.fresh.description, 'Example upgrade request.');
  assert.equal(choices.fresh.step, 1);
  assert.notEqual(choices.fresh.submission_key, choices.saved.submission_key);
  assert.equal(saved.description, 'Example machine fault.');
  assert.equal(drafts.getServiceRequestDraftChoices(drafts.createEmptyServiceRequestDraft()).needsChoice, false);
});

test('public links track clicks without executing legacy in-app navigation callbacks', async () => {
  const source = await readFile(new URL('../src/components/common/PublicConversionPanel.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\}, onStartDiagnosis\)|\}, onOpenServiceRequest\)/);
  assert.match(source, /service: serviceRequestPreset/);
});
