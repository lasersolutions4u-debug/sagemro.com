import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eRuntime, localRunPaths } from '../support/runtime.mjs';

const repoDir = fileURLToPath(new URL('../../', import.meta.url));
export const wranglerCli = path.join(repoDir, 'worker/node_modules/wrangler/bin/wrangler.js');

export function prepareLocalEnv(env) {
  e2eRuntime(env);
  const { stateDir, configPath } = localRunPaths(env);
  const config = {
    name: 'sagemro-local-e2e', main: path.join(repoDir, 'worker/src/index.js'),
    compatibility_date: '2024-01-01',
    d1_databases: [{ binding: 'DB', database_name: 'sagemro-db', database_id: '00000000-0000-0000-0000-000000000001' }],
    r2_buckets: [{ binding: 'ATTACHMENTS', bucket_name: 'e2e-attachments' }, { binding: 'FIELD_EVIDENCE', bucket_name: 'e2e-field-evidence' }],
    kv_namespaces: [{ binding: 'KV', id: '00000000000000000000000000000001' }],
    secrets: { required: ['ENVIRONMENT', 'E2E_TEST_MODE', 'E2E_TEST_SECRET', 'JWT_SECRET', 'ADMIN_PHONE', 'ADMIN_PASSWORD', 'ADMIN_PHONE_CN', 'ADMIN_PASSWORD_CN', 'DEV_BYPASS_CODE', 'VERIFICATION_EMAIL_FROM'] },
  };
  writeFileSync(configPath, JSON.stringify(config), { flag: 'wx' });
  mkdirSync(stateDir);
  const execute = args => {
    const results = JSON.parse(execFileSync(process.execPath, [wranglerCli, 'd1', 'execute', 'sagemro-db',
      '--config', configPath, '--local', '--persist-to', stateDir, '--yes', '--json', ...args],
    { cwd: repoDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    if (results.some(result => !result.success)) throw new Error('Local D1 preparation failed');
    console.log(`Local D1: ${results.length} statements verified.`);
  };
  execute(['--file', path.join(repoDir, 'worker/schema.sql')]);
  execute(['--command', `
    INSERT INTO materials (
      id, market, material_code, category, name, name_en, spec, brand, unit,
      stock_quantity, reserved_quantity, safety_stock, status
    ) VALUES (
      'e2e-stock-material', 'com', 'E2E-STOCK-001', 'consumables',
      'E2E Stock Nozzle', 'E2E Stock Nozzle', 'D1.5', 'SAGEMRO', 'pcs',
      20, 0, 0, 'active'
    );
  `]);
  execute(['--command', 'SELECT COUNT(*) AS migration_count FROM _migrations; SELECT COUNT(*) AS application_count FROM engineer_applications;']);
}
