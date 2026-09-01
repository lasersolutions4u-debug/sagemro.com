import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('AI workspace removes the About modal while the public technical-review route remains', () => {
  const app = read('../src/App.jsx');
  const chatArea = read('../src/components/Chat/ChatArea.jsx');
  const publicSeoRoutes = read('../src/data/publicSeoRoutes.js');
  const technicalReviewPage = read('../src/components/About/TechnicalReviewPage.jsx');

  assert.doesNotMatch(app, /AboutModal|aboutModalOpen|onOpenAbout/);
  assert.doesNotMatch(chatArea, /onOpenAbout|aboutLabel/);
  assert.match(app, /const TechnicalReviewPage = lazy/);
  assert.match(app, /<TechnicalReviewPage/);
  assert.match(publicSeoRoutes, /path: '\/about\/technical-review'/);
  assert.match(technicalReviewPage, /canonical = `\$\{host\}\/about\/technical-review\/`/);
});
