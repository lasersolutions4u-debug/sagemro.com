import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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
    else if (value === '--config') options.config = path.resolve(next);
    else if (value === '--file') options.file = path.resolve(next);
    else if (value === '--command') options.command = next;
    else if (value === '--directory') options.directory = path.resolve(next);
    else if (value === '--left') options.left = path.resolve(next);
    else if (value === '--right') options.right = path.resolve(next);
    else if (value === '--daily-days') options.dailyDays = Number(next);
    else if (value === '--weekly-weeks') options.weeklyWeeks = Number(next);
    else if (value === '--confirm-production') options.confirmProduction = true;
    else if (value === '--apply-retention') options.applyRetention = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
    if (
      value.startsWith('--')
      && value !== '--confirm-production'
      && value !== '--apply-retention'
      && value !== '--help'
      && value !== '-h'
    ) index += 1;
  }
  if (options.operation === 'retention-check' && options.applyRetention === undefined) options.applyRetention = false;
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

function normalizeSchemaSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

export function parseSchemaProbeResult(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const rows = Array.isArray(parsed)
    ? parsed.flatMap((entry) => entry?.results || [])
    : parsed?.results || [];
  return rows
    .filter((row) => row?.name && row?.sql && !String(row.name).startsWith('sqlite_'))
    .map((row) => ({
      type: String(row.type),
      name: String(row.name),
      sql: normalizeSchemaSql(row.sql),
    }))
    .sort((left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`));
}

function schemaObjects(snapshot) {
  return Array.isArray(snapshot) ? snapshot : snapshot?.objects || [];
}

export function compareSchemaSnapshots(leftSnapshot, rightSnapshot) {
  const left = new Map(schemaObjects(leftSnapshot).map((item) => [`${item.type}:${item.name}`, normalizeSchemaSql(item.sql)]));
  const right = new Map(schemaObjects(rightSnapshot).map((item) => [`${item.type}:${item.name}`, normalizeSchemaSql(item.sql)]));
  const onlyLeft = [...left.keys()].filter((key) => !right.has(key)).sort();
  const onlyRight = [...right.keys()].filter((key) => !left.has(key)).sort();
  const changed = [...left.keys()].filter((key) => right.has(key) && left.get(key) !== right.get(key)).sort();
  return {
    identical: onlyLeft.length === 0 && onlyRight.length === 0 && changed.length === 0,
    onlyLeft,
    onlyRight,
    changed,
  };
}

export function buildSchemaSnapshotPath({ market, directory = path.join(WORKER_ROOT, '.codex-schema-snapshots') } = {}) {
  const database = D1_TARGETS[market]?.database;
  if (!database) throw new Error(`Unsupported market: ${market}`);
  return path.join(directory, `${database}-schema.json`);
}

function isoWeekKey(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function utcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

export function planBackupRetention(files, { now = new Date(), dailyDays = 30, weeklyWeeks = 12 } = {}) {
  if (!Number.isInteger(dailyDays) || dailyDays < 1) throw new Error('dailyDays must be a positive integer');
  if (!Number.isInteger(weeklyWeeks) || weeklyWeeks < 0) throw new Error('weeklyWeeks must be a non-negative integer');
  const normalized = files
    .map((file) => ({ ...file, modifiedAt: new Date(file.modifiedAt) }))
    .filter((file) => !Number.isNaN(file.modifiedAt.getTime()))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  const dailyCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dailyDays + 1));
  const dailyKeys = new Set();
  const keepPaths = new Set();
  const weeklyKeys = new Set();

  for (const file of normalized) {
    if (file.modifiedAt >= dailyCutoff) {
      const key = utcDayKey(file.modifiedAt);
      if (!dailyKeys.has(key)) {
        dailyKeys.add(key);
        keepPaths.add(file.path);
      }
      continue;
    }
    const key = isoWeekKey(file.modifiedAt);
    if (weeklyKeys.has(key) || weeklyKeys.size >= weeklyWeeks) continue;
    weeklyKeys.add(key);
    keepPaths.add(file.path);
  }

  return {
    keep: normalized.filter((file) => keepPaths.has(file.path)),
    remove: normalized.filter((file) => !keepPaths.has(file.path)),
  };
}

export function buildRestoreDrillPlan({ market = 'com', workDir = path.join(os.tmpdir(), `sagemro-d1-drill-${randomUUID()}`) } = {}) {
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
  node scripts/d1-operations.mjs schema-snapshot --market com|cn --mode local|remote [--config file] [--output file] [--confirm-production]
  node scripts/d1-operations.mjs schema-diff --left com.json --right cn.json
  node scripts/d1-operations.mjs retention-check --market com|cn --directory path [--daily-days 30] [--weekly-weeks 12] [--apply-retention]
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

function runSchemaSnapshot(options) {
  const output = options.output || buildSchemaSnapshotPath({ market: options.market });
  mkdirSync(path.dirname(output), { recursive: true });
  const raw = executeWrangler(buildD1Args({
    ...options,
    operation: 'execute',
    command: buildSchemaProbe(),
    json: true,
  }), { capture: true });
  const snapshot = {
    market: options.market,
    database: D1_TARGETS[options.market].database,
    generatedAt: new Date().toISOString(),
    objects: parseSchemaProbeResult(raw),
  };
  writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`D1 schema snapshot written to ${output}`);
}

function runSchemaDiff(options) {
  if (!options.left || !options.right) throw new Error('Schema diff requires --left and --right');
  const result = compareSchemaSnapshots(
    JSON.parse(readFileSync(options.left, 'utf8')),
    JSON.parse(readFileSync(options.right, 'utf8')),
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.identical) process.exitCode = 2;
}

function runRetentionCheck(options) {
  if (!options.directory) throw new Error('Retention check requires --directory');
  const prefix = `${D1_TARGETS[options.market]?.database}-`;
  if (!D1_TARGETS[options.market]) throw new Error(`Unsupported market: ${options.market}`);
  const files = readdirSync(options.directory)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.sql'))
    .map((name) => {
      const filePath = path.join(options.directory, name);
      return { path: filePath, modifiedAt: statSync(filePath).mtime };
    });
  const plan = planBackupRetention(files, {
    dailyDays: options.dailyDays ?? 30,
    weeklyWeeks: options.weeklyWeeks ?? 12,
  });
  console.log(JSON.stringify({
    apply: options.applyRetention,
    keep: plan.keep.map((file) => file.path),
    remove: plan.remove.map((file) => file.path),
  }, null, 2));
  if (options.applyRetention) {
    for (const file of plan.remove) unlinkSync(file.path);
  }
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
    else if (options.operation === 'schema-snapshot') runSchemaSnapshot(options);
    else if (options.operation === 'schema-diff') runSchemaDiff(options);
    else if (options.operation === 'retention-check') runRetentionCheck(options);
    else if (options.operation === 'restore-drill') runRestoreDrill(options);
    else throw new Error(`Unsupported command: ${options.operation}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
