import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('public frontend routes render a localized 404 and keep static fallback rules', () => {
  const app = read('frontend/src/App.jsx');
  const notFound = read('frontend/src/components/common/NotFoundPage.jsx');
  const redirects = read('frontend/public/_redirects');

  assert.match(app, /<NotFoundPage isCn=\{isCn\} \/>/);
  assert.match(notFound, /Page not found/);
  assert.match(notFound, /页面不存在/);
  assert.match(redirects, /\/\* \/404\.html 404/);
});

test('tool and insight detail routes reject unknown slugs', () => {
  const tools = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const insights = read('frontend/src/components/Insights/InsightsPage.jsx');

  assert.match(tools, /slug && !selectedTool/);
  assert.match(insights, /slug && !insight/);
});
