import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const entryPages = [
  'src/components/Services/ServicePages.jsx',
  'src/components/Insights/InsightsPage.jsx',
  'src/components/Tools/IndustryToolsPage.jsx',
  'src/components/About/TechnicalReviewPage.jsx',
];

const embeddedPages = [
  'src/components/Insights/DiagnosticGuide.jsx',
  'src/components/Tools/BendSimulatorPage.jsx',
];

test('public content entry pages reuse the shared public site shell', () => {
  for (const path of entryPages) {
    const source = read(path);
    assert.match(source, /import \{ PublicSiteShell \}/, path);
    assert.match(source, /<PublicSiteShell\b/, path);
    assert.doesNotMatch(source, /function (?:ServiceShell|InsightShell|ToolPageShell)\b/, path);
    assert.doesNotMatch(source, /import \{ (?:BrandMark|Footer) \}/, path);
  }
});

test('shared public navigation exposes every public hub and the market portal', () => {
  const shell = read('src/components/Public/PublicSiteShell.jsx');

  for (const href of ['/services/', '/brands/', '/tools/', '/insights/']) {
    assert.match(shell, new RegExp(`['"]${href.replaceAll('/', '\\/')}['"]`));
  }
  assert.match(shell, /https:\/\/ai\.sagemro\.cn/);
  assert.match(shell, /https:\/\/ai\.sagemro\.com/);
  assert.match(shell, /https:\/\/www\.dhgate\.com\/store\/sagemro/);
  assert.match(shell, /target="_blank" rel="noopener noreferrer"/);
  assert.match(shell, /商城（筹备中）/);
  assert.match(shell, /aria-disabled="true"/);
});

test('shared shell owns the only public main and footer landmarks', () => {
  const shell = read('src/components/Public/PublicSiteShell.jsx');
  assert.match(shell, /<main>\{children\}<\/main>/);
  assert.match(shell, /<Footer onOpenLegal=\{onOpenLegal\}/);

  for (const path of [...entryPages, ...embeddedPages]) {
    const source = read(path);
    assert.doesNotMatch(source, /<main\b/, `${path} must not nest a main inside PublicSiteShell`);
  }

  const bendSimulator = read('src/components/Tools/BendSimulatorPage.jsx');
  assert.doesNotMatch(bendSimulator, /<header\b|<Footer\b|<BrandMark\b/);
});

test('public navigation refactor does not introduce a second service form', () => {
  const sources = entryPages.map(read).join('\n');
  assert.doesNotMatch(sources, /WorkOrderModal|ServiceRequestFlow|<form\b/);
});
