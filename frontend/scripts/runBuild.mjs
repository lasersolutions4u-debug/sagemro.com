import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { buildPortalPages } from './buildPortalPages.mjs';
import { buildPublicPages } from './buildPublicPages.mjs';

const execFile = promisify(execFileCallback);
const frontendDir = fileURLToPath(new URL('..', import.meta.url));
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

export async function runBuild(target) {
  if (target !== 'public' && target !== 'portal') {
    throw new Error(`Unsupported SAGEMRO build target: ${target}`);
  }

  await execFile(process.execPath, [viteCli, 'build'], {
    cwd: frontendDir,
    env: {
      ...process.env,
      SAGEMRO_BUILD_TARGET: target,
    },
  });

  const distDir = join(frontendDir, target === 'portal' ? 'dist-portal' : 'dist');
  if (target === 'portal') {
    await buildPortalPages({ distDir });
  } else {
    await buildPublicPages({ distDir });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  await runBuild(process.argv[2] ?? 'public');
}
