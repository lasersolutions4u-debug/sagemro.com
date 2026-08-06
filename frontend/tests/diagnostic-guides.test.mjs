import assert from 'node:assert/strict';
import test from 'node:test';

import { getTechnicalAuthor } from '../src/data/technicalAuthors.js';

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
