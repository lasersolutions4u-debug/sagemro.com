import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createLocalEnvironment, e2eRuntime, localRunPaths, installLocalDnsMapping } from '../support/runtime.mjs';
import { prepareLocalEnv, wranglerCli } from './prepare-local-env.mjs';

const e2eDir = fileURLToPath(new URL('../', import.meta.url));
const repoDir = path.resolve(e2eDir, '..');

function runNode(args, env, cwd = e2eDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const [mode = 'test', ...args] = process.argv.slice(2);
  if (mode === 'server') {
    installLocalDnsMapping();
    const runtime = e2eRuntime();
    const paths = localRunPaths();
    const [target] = args;
    if (args.length !== 1 || !['worker', 'frontend', 'admin'].includes(target)) throw new Error('Unknown local server');
    if (target === 'worker') return runNode([wranglerCli, 'dev', '--config', paths.configPath,
      '--local', '--persist-to', paths.stateDir, '--ip', '127.0.0.1', '--port', '8878',
      '--log-level', 'warn', '--show-interactive-dev-session', 'false'], process.env, paths.runDir);
    process.env.VITE_API_BASE = runtime.apiBase;
    if (target === 'frontend') process.env.SAGEMRO_BUILD_TARGET = 'portal';
    const { createServer } = await import('../../frontend/node_modules/vite/dist/node/index.js');
    const root = path.join(repoDir, target);
    const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), envDir: paths.runDir,
      server: { host: '127.0.0.1', port: target === 'frontend' ? 4273 : 4274, strictPort: true,
        proxy: { '/api': { target: runtime.apiBase, changeOrigin: true } } } });
    await server.listen();
    return;
  }
  if (!['test', 'prepare'].includes(mode) || args.some(arg => !/^tests\/[a-z0-9-]+\.spec\.mjs$/.test(arg))) {
    throw new Error('Use test [tests/name.spec.mjs] or prepare');
  }
  const runDir = mkdtempSync(path.join(tmpdir(), 'sagemro-e2e-'));
  const env = createLocalEnvironment(process.env, runDir);
  console.log(`Isolated local E2E run: ${runDir}`);
  prepareLocalEnv(env);
  if (mode === 'prepare') return 0;
  return runNode([path.join(e2eDir, 'node_modules/@playwright/test/cli.js'), 'test', ...args], env);
}

main().then(code => { if (code !== undefined) process.exitCode = code; }).catch(() => {
  console.error('Local E2E stopped. See the failing check above; no production deployment was requested.');
  process.exitCode = 1;
});
