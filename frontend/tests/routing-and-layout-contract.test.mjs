import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'vite';

const root = path.resolve(import.meta.dirname, '../..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

test('CN public frontend routes render a localized 404 and keep static fallback rules', () => {
  const app = read('frontend/src/App.jsx');
  const notFound = read('frontend/src/components/common/NotFoundPage.jsx');
  const redirects = read('frontend/public/_redirects');

  assert.match(app, /<NotFoundPage isCn=\{isCn\} \/>/);
  assert.match(notFound, /页面不存在/);
  assert.match(redirects, /\/\* \/404\.html 404/);
});

test('CN tool detail titles wrap on narrow screens and reject unknown slugs', () => {
  const tools = read('frontend/src/components/Tools/IndustryToolsPage.jsx');
  const insights = read('frontend/src/components/Insights/InsightsPage.jsx');

  assert.match(tools, /slug && !rawSelectedTool/);
  assert.match(tools, /className="min-w-0"/);
  assert.match(tools, /break-words/);
  assert.doesNotMatch(tools, /<h1 className="mt-4 break-keep/);
  assert.match(insights, /slug && !insight/);
});

test('work order modal uses one full-height scroll surface without trailing blank space', () => {
  const modal = read('frontend/src/components/common/Modal.jsx');

  assert.match(modal, /overflow-y-auto/);
  assert.doesNotMatch(modal, /flex flex-col/);
  assert.doesNotMatch(modal, /min-h-0 overflow-y-auto/);
});

test('customer site location distinguishes current position from map selection', () => {
  const workOrderModal = read('frontend/src/components/Sidebar/WorkOrderModal.jsx');

  assert.match(workOrderModal, /locateSite: '确认现场定位'/);
  assert.match(workOrderModal, /locationCaptured: '现场定位已获取'/);
  assert.match(workOrderModal, /form\.service_mode === 'onsite'/);
  assert.match(workOrderModal, /service_accuracy_m \|\| 0/);
});

test('frontend build keeps modulepreload dependencies enabled', () => {
  const viteConfig = read('frontend/vite.config.js');

  assert.match(viteConfig, /modulePreload:\s*\{[\s\S]*polyfill:\s*false/);
  assert.doesNotMatch(viteConfig, /resolveDependencies:\s*\(\)\s*=>\s*\[\]/);
});

test('production build emits modulepreload links for initial vendor chunks', async () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'sagemro-build-'));
  await build({
    root: path.join(root, 'frontend'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  });

  const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
  for (const chunk of ['vendor-react', 'vendor-misc', 'vendor-markdown', 'vendor-motion', 'vendor-icons']) {
    assert.match(html, new RegExp(`rel="modulepreload"[^>]+${chunk}`));
  }
});

test('Aliyun deploy enforces HTTP/2, compression, caching, security headers, and rollback', () => {
  const workflow = read('.github/workflows/aliyun-cn-deploy.yml');

  assert.match(workflow, /nginx_backup="\$backup_root\/\$\{RELEASE_ID\}\.tgz"/);
  assert.match(workflow, /readlink -f "\$nginx_config_file"/);
  assert.match(workflow, /python3 "\$release\/ops\/enable_nginx_http2\.py"/);
  assert.match(workflow, /Roll back failed China release/);
  assert.match(workflow, /always\(\) && \(steps\.activate\.outcome == 'failure'/);
  assert.match(workflow, /for site_host in sagemro\.cn admin\.sagemro\.cn engineer\.sagemro\.cn/);
  assert.match(workflow, /content-encoding: gzip/);
  assert.match(workflow, /max-age=31536000, immutable/);
  assert.match(workflow, /Content-Security-Policy/);
  assert.match(workflow, /X-Content-Type-Options/);
  assert.match(workflow, /Strict-Transport-Security/);
  assert.match(workflow, /HTML is missing the no-cache policy/);
  assert.match(workflow, /HTML is missing security header/);
  assert.match(workflow, /test -L "\$link_path" \|\| \$SUDO test -e "\$link_path"/);
  assert.match(workflow, /previous_target" = "__MISSING__"/);
});
