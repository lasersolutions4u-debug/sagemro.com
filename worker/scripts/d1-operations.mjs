import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

export const D1_TARGETS = Object.freeze({
  com: Object.freeze({ database: 'sagemro-db', label: 'international' }),
  cn: Object.freeze({ database: 'sagemro-db-cn', label: 'china' }),
});

const WORKER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_FILE = path.join(WORKER_ROOT, 'schema.sql');

export function buildD1Args({ market, operation, mode = 'local', file, output, persistTo, command, config, json = false, confirmProduction = false }) {
  const target = D1_TARGETS[market];
  if (!target) throw new Error(`Unsupported market: ${market}`);
  if (!['backup', 'execute'].includes(operation)) throw new Error(`Unsupported operation: ${operation}`);
  if (!['local', 'remote'].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
  if (mode === 'remote' && !confirmProduction) {
    throw new Error('Remote D1 operations require --confirm-production');
  }
  if (operation === 'backup' && !output) throw new Error('Backup requires an output path');
  if (operation === 'execute' && !file && !command) throw new Error('Execute requires --file or --command');

  const args = ['wrangler', 'd1', operation === 'backup' ? 'export' : 'execute', target.database];
  if (config) args.push('--config', config);
  if (mode === 'remote') args.push('--env', 'production', '--remote');
  else args.push('--local');
  if (persistTo && operation === 'execute') args.push('--persist-to', persistTo);
  if (operation === 'backup') args.push('--output', output);
  if (file) args.push('--file', file);
  if (command) args.push('--command', command);
  if (operation === 'execute' && !command) args.push('--yes');
  if (json && operation === 'execute') args.push('--json');
  return args;
}

export function parseCliArgs(argv) {
  const options = { operation: 'backup', market: 'com', mode: 'local', confirmProduction: false };
  const values = [...argv];
  if (values[0] && !values[0].startsWith('--')) options.operation = values.shift();

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];
    if (value === '--market') options.market = next;
    else if (value === '--mode') options.mode = next;
    else if (value === '--output') options.output = path.resolve(next);
    else if (value === '--persist-to') options.persistTo = path.resolve(next);
    else if (value === '--file') options.file = path.resolve(next);
    else if (value === '--command') options.command = next;
    else if (value === '--confirm-production') options.confirmProduction = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
    if (value.startsWith('--') && value !== '--confirm-production' && value !== '--help' && value !== '-h') index += 1;
  }
  return options;
}

export function executeWrangler(args, { cwd = WORKER_ROOT, runner = execFileSync, capture = false } = {}) {
  return runner('npx', args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
}

export function createBackupPath({ market, directory = path.join(WORKER_ROOT, '.codex-production-backups') } = {}) {
  const target = D1_TARGETS[market];
  if (!target) throw new Error(`Unsupported market: ${market}`);
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(directory, `${target.database}-${stamp}.sql`);
}

export function schemaMigrationVersions(schema = readFileSync(SCHEMA_FILE, 'utf8')) {
  return [...schema.matchAll(/\('([^']+)',\s*'[^']*'\)/g)].map((match) => match[1]);
}

export function buildSchemaProbe() {
  return "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index', 'trigger', 'view') ORDER BY type, name;";
}

export function buildRestoreDrillPlan({ market = 'com', workDir = path.join(os.tmpdir(), `sagemro-d1-drill-${Date.now()}`) } = {}) {
  const sourceState = path.join(workDir, 'source');
  const restoreState = path.join(workDir, 'restore');
  const backupFile = path.join(workDir, `${D1_TARGETS[market].database}-restore-drill.sql`);
  return {
    market,
    workDir,
    sourceState,
    restoreState,
    backupFile,
    sourceConfig: path.join(sourceState, 'wrangler.toml'),
    restoreConfig: path.join(restoreState, 'wrangler.toml'),
  };
}

export function buildLocalDrillConfig({ market, databaseId = randomUUID() }) {
  const database = D1_TARGETS[market]?.database;
  if (!database) throw new Error(`Unsupported market: ${market}`);
  return `name = "sagemro-d1-restore-drill"
main = "${path.join(WORKER_ROOT, 'src/index.js')}"
compatibility_date = "2026-07-22"

[[d1_databases]]
binding = "DB"
database_name = "${database}"
database_id = "${databaseId}"
`;
}

export function printHelp() {
  console.log(`Usage:
  node scripts/d1-operations.mjs backup --market com|cn --mode local|remote [--output file] [--confirm-production]
  node scripts/d1-operations.mjs schema-check --market com|cn --mode local|remote [--confirm-production]
  node scripts/d1-operations.mjs restore-drill [--market com|cn]

Remote mode is blocked unless --confirm-production is supplied.`);
}

function runBackup(options) {
  const output = options.output || createBackupPath({ market: options.market });
  mkdirSync(path.dirname(output), { recursive: true });
  executeWrangler(buildD1Args({ ...options, operation: 'backup', output }));
  console.log(`D1 backup written to ${output}`);
}

function runSchemaCheck(options) {
  executeWrangler(buildD1Args({
    ...options,
    operation: 'execute',
    command: buildSchemaProbe(),
  }));
}

function runRestoreDrill(options) {
  const plan = buildRestoreDrillPlan(options);
  mkdirSync(plan.workDir, { recursive: true });
  mkdirSync(plan.sourceState, { recursive: true });
  mkdirSync(plan.restoreState, { recursive: true });
  writeFileSync(plan.sourceConfig, buildLocalDrillConfig({ market: plan.market }));
  writeFileSync(plan.restoreConfig, buildLocalDrillConfig({ market: plan.market }));

  executeWrangler(buildD1Args({ market: plan.market, operation: 'execute', mode: 'local', file: SCHEMA_FILE, config: plan.sourceConfig }));
  const marker = "INSERT INTO customers (id, user_no, name, phone, password_hash, salt) VALUES ('restore-drill-customer', 'U999998', 'Restore Drill Customer', '+15550009998', 'drill-hash', 'drill-salt');";
  executeWrangler(buildD1Args({ market: plan.market, operation: 'execute', mode: 'local', command: marker, config: plan.sourceConfig }));
  executeWrangler(buildD1Args({ market: plan.market, operation: 'backup', mode: 'local', output: plan.backupFile, config: plan.sourceConfig }));
  executeWrangler(buildD1Args({ market: plan.market, operation: 'execute', mode: 'local', file: plan.backupFile, config: plan.restoreConfig }));
  const result = executeWrangler(buildD1Args({
    market: plan.market,
    operation: 'execute',
    mode: 'local',
    command: "SELECT COUNT(*) AS restored_customers FROM customers WHERE id = 'restore-drill-customer';",
    config: plan.restoreConfig,
    json: true,
  }), { capture: true });
  const parsed = JSON.parse(result);
  if (parsed?.[0]?.results?.[0]?.restored_customers !== 1) {
    throw new Error('Restore drill verification failed: marker row was not restored');
  }
  console.log(`D1 restore drill completed. Artifacts: ${plan.workDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) printHelp();
    else if (options.operation === 'backup') runBackup(options);
    else if (options.operation === 'schema-check') runSchemaCheck(options);
    else if (options.operation === 'restore-drill') runRestoreDrill(options);
    else throw new Error(`Unsupported command: ${options.operation}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
