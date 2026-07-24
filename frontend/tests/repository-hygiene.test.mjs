import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

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
];

const retiredFrontendFiles = [
  'frontend/src/components/AI/AIToolsPanel.jsx',
  'frontend/src/components/Settings/SettingsModal.jsx',
  'frontend/src/components/Sidebar/ToolBar.jsx',
  'frontend/src/components/WorkOrder/EngineerReviewModal.jsx',
  'frontend/src/components/WorkOrder/RatingModal.jsx',
  'frontend/src/components/common/Button.jsx',
  'frontend/src/data/aiServiceTools.js',
  'frontend/src/data/loginPresets.js',
  'frontend/src/styles/tokens.css',
];

const retiredFrontendApiFunctions = [
  'addWorkOrderMaterialItem',
  'applyWithdraw',
  'getCustomerReviews',
  'getEngineerWallet',
  'getRecommendedEngineers',
  'getRepairRecord',
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
