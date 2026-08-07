import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('public frontend routes finish with a real 404 after private SPA rewrites', () => {
  const app = read('frontend/src/App.jsx');
  const notFound = read('frontend/src/components/common/NotFoundPage.jsx');
  const redirects = read('frontend/public/_redirects');

  assert.match(app, /<NotFoundPage isCn=\{isCn\} \/>/);
  assert.match(notFound, /This page doesn\\'t exist/);
  assert.match(notFound, /页面不存在/);
  assert.equal(existsSync(path.join(root, 'frontend/public/404.html')), false);
  assert.match(redirects, /\/activate \/ 200/);
  assert.match(redirects, /\/engineer \/ 200/);
  assert.match(redirects, /\/work-orders\/\* \/ 200/);
  assert.doesNotMatch(redirects, /^https?:\/\//m);
  assert.doesNotMatch(redirects, /\/404\.html 404/);
  assert.doesNotMatch(redirects, /^\/\* \/index\.html 200$/m);
  assert.doesNotMatch(redirects, /\s30[18]$/m);
});

test('tool and insight detail routes reject unknown slugs', () => {
  const tools = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const insights = read('frontend/src/components/Insights/InsightsPage.jsx');

  assert.match(tools, /const isMissing = page === 'not-found'/);
  assert.match(tools, /getIndustryToolsSeoMetadata/);
  assert.match(insights, /slug && !insight/);
});

test('frontend build keeps modulepreload dependencies enabled', () => {
  const viteConfig = read('frontend/vite.config.js');

  assert.match(viteConfig, /modulePreload:\s*\{[\s\S]*polyfill:\s*false/);
  assert.doesNotMatch(viteConfig, /resolveDependencies:\s*\(\)\s*=>\s*\[\]/);
});

test('public runtime links use the canonical trailing-slash policy', () => {
  const sources = [
    'frontend/src/components/About/TechnicalReviewPage.jsx',
    'frontend/src/components/Insights/DiagnosticGuide.jsx',
    'frontend/src/components/Insights/InsightsPage.jsx',
    'frontend/src/components/Services/ServicePages.jsx',
    'frontend/src/components/Tools/IndustryToolsPage.jsx',
    'frontend/src/components/common/Footer.jsx',
  ].map(read).join('\n');

  assert.doesNotMatch(sources, /href="\/(?:tools|services|insights|about\/technical-review)"/);
  assert.doesNotMatch(sources, /href=\{`\/(?:tools|services|insights)\/\$\{[^}]+\}`\}/);
});
