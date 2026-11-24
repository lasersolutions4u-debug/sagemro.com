/**
 * CLI wrapper so non-module builds (the Admin Vite build) can apply the same gate.
 *
 *   node ops/maintenance/apply.mjs <distDir>
 *
 * The directory is resolved against the current working directory, so
 * `cd admin && node ../ops/maintenance/apply.mjs dist` targets `admin/dist`.
 */

import { resolve } from 'node:path';

import { applyMaintenanceArtifact, readMaintenanceMode } from './render.mjs';

const [target] = process.argv.slice(2);
if (!target) {
  console.error('usage: node ops/maintenance/apply.mjs <distDir>');
  process.exit(1);
}

const distDir = resolve(process.cwd(), target);
const mode = readMaintenanceMode();
const result = await applyMaintenanceArtifact(distDir, { mode });

console.log(`[maintenance] toggle ${mode.enabled ? 'ON' : 'OFF'} — ${result.enabled ? 'wrote' : 'removed'} ${result.path}`);
