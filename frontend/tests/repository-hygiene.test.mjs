import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const trackedFiles = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean));

const retiredRootFiles = [
  'accept-and-price.js',
  'capture-chat.js',
  'capture-fix.js',
  'capture-payment.js',
  'capture-remaining.js',
  'capture-screenshots.js',
  'capture-wallet.js',
  'debug-chat.js',
  'netlify.toml.deprecated',
  'wrangler.toml',
];

const retiredFrontendFiles = [
  'frontend/public/media/engineer-service-flywheel-cn-poster.webp',
  'frontend/public/media/engineer-service-flywheel-cn.mp4',
  'frontend/public/media/engineer-service-flywheel-cn.webm',
  'frontend/public/media/engineer-service-flywheel-en-poster.webp',
  'frontend/public/media/engineer-service-flywheel-en.mp4',
  'frontend/public/media/engineer-service-flywheel-en.webm',
  'frontend/src/components/AI/AIToolsPanel.jsx',
  'frontend/src/components/Engineer/EngineerOverviewVideo.jsx',
  'frontend/src/components/Engineer/EngineerServiceReadinessCard.jsx',
  'frontend/src/components/Settings/SettingsModal.jsx',
  'frontend/src/components/Sidebar/ToolBar.jsx',
  'frontend/src/components/WorkOrder/EngineerReviewModal.jsx',
  'frontend/src/components/WorkOrder/RatingModal.jsx',
  'frontend/src/components/common/Button.jsx',
  'frontend/src/data/aiServiceTools.js',
  'frontend/src/data/loginPresets.js',
  'frontend/src/styles/tokens.css',
  'frontend/tests/engineer-overview-video-contract.test.mjs',
  'frontend/tests/engineer-service-readiness-contract.test.mjs',
  'tools/engineer-video/engineer-service-animation.js',
  'tools/engineer-video/index.html',
  'tools/engineer-video/render.mjs',
  'tools/engineer-video/styles.css',
];

const retiredFrontendApiFunctions = [
  'addWorkOrderMaterialItem',
  'applyWithdraw',
  'getCustomerReviews',
  'getEngineerWallet',
  'getRecommendedEngineers',
  'getRepairRecord',
  'getWorkOrderPayout',
  'getWorkOrderServiceReadiness',
  'refreshWorkOrderServiceReadiness',
  'uploadChatImage',
];

function collectFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

test('retired one-off tooling and unreachable frontend modules stay out of the repository', () => {
  for (const relativePath of [...retiredRootFiles, ...retiredFrontendFiles]) {
    assert.equal(existsSync(path.join(root, relativePath)), false, relativePath);
  }
});

test('production credential probes and machine-local state stay out of Git', () => {
  assert.equal(existsSync(path.join(root, 'worker/test-roles.sh')), false, 'worker/test-roles.sh');
  assert.doesNotMatch(readFileSync(path.join(root, 'worker/tests/smoke.mjs'), 'utf8'), /test-roles\.sh/);

  const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.claude\/memory\/$/m);
  assert.match(gitignore, /^\.obsidian\/workspace\.json$/m);

  for (const trackedPath of trackedFiles) {
    assert.equal(trackedPath.startsWith('.claude/memory/'), false, trackedPath);
    assert.notEqual(trackedPath, '.obsidian/workspace.json');
  }
});

test('generated acceptance screenshots stay outside Git-tracked report folders', () => {
  const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^reports\/\*\*\/screenshots\/\*\.png$/m);

  const screenshots = collectFiles(path.join(root, 'reports'))
    .filter((file) => /\/screenshots\/.*\.png$/i.test(file));

  assert.deepEqual(screenshots, []);
});

test('retired frontend API clients stay out of the application bundle', () => {
  const api = readFileSync(path.join(root, 'frontend/src/services/api.js'), 'utf8');
  for (const functionName of retiredFrontendApiFunctions) {
    assert.doesNotMatch(api, new RegExp(`export async function ${functionName}\\b`), functionName);
  }
});
