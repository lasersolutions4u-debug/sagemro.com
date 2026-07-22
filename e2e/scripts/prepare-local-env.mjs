import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { e2eRuntime } from '../support/runtime.mjs';

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(e2eDir, '..');
const workerDir = path.join(repoDir, 'worker');
const stateDir = path.join(e2eDir, '.state');
const generatedDir = path.join(e2eDir, '.generated');
const testSecret = process.env.E2E_TEST_SECRET || 'local-e2e-secret-32-characters';

e2eRuntime({
  ...process.env,
  E2E_TEST_SECRET: testSecret,
});

rmSync(stateDir, { recursive: true, force: true });
rmSync(generatedDir, { recursive: true, force: true });
mkdirSync(stateDir, { recursive: true });
mkdirSync(generatedDir, { recursive: true });

const envFile = path.join(generatedDir, 'worker.env');
writeFileSync(envFile, [
  'ENVIRONMENT=development',
  'E2E_TEST_MODE=true',
  `E2E_TEST_SECRET=${testSecret}`,
  'DEV_BYPASS_CODE=246810',
  'JWT_SECRET=local-e2e-jwt-secret-at-least-32-characters',
  'ADMIN_PHONE=19900000001',
  'ADMIN_PASSWORD=LocalAdminPassword123!',
  'ADMIN_PHONE_CN=19900000002',
  'ADMIN_PASSWORD_CN=LocalCnAdminPassword123!',
  'VERIFICATION_EMAIL_FROM=SAGEMRO E2E <e2e@localhost.test>',
  '',
].join('\n'), { mode: 0o600 });

execFileSync('npx', [
  'wrangler', 'd1', 'execute', 'sagemro-db',
  '--local',
  '--persist-to', stateDir,
  '--file', path.join(workerDir, 'schema.sql'),
  '--yes',
], {
  cwd: workerDir,
  stdio: 'inherit',
});

execFileSync('npx', [
  'wrangler', 'd1', 'execute', 'sagemro-db',
  '--local',
  '--persist-to', stateDir,
  '--command', "SELECT COUNT(*) AS migration_count FROM _migrations; SELECT COUNT(*) AS application_count FROM engineer_applications;",
  '--yes',
], {
  cwd: workerDir,
  stdio: 'inherit',
});

console.log(`Prepared isolated E2E state at ${stateDir}`);
