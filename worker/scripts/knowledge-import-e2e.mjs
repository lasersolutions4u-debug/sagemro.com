// 知识库导入端到端验证。
//
// 做四件事，全部跑在真实 SQLite 上、走真实的 HTTP 路由与处理器：
//   1. 把 `artifacts/kb-import/internal-params-2023-cut-params.csv`（122 条基准表条目）
//      通过 POST /api/admin/knowledge/batch 导入；
//   2. 验证导入后仍是 draft —— 此时 AI 检索不到（发布门禁有效）；
//   3. 再以 published 导入一遍，验证重复导入被跳过而不是产生副本；
//   4. 用若干**真实客户式问句**跑 search_knowledge_base，看能不能命中。
//
// 这是「改了检索之后到底有没有用」最直接的证据，不依赖任何生产凭据。
//
// 用法：
//   cd worker
//   node scripts/knowledge-import-e2e.mjs [csv路径]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  if (type !== 'ExperimentalWarning') emitWarning.call(process, warning, ...args);
};
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = emitWarning;

const { signEnvSession, withFixtureAccounts } = await import('../tests/helpers/session-jwt.mjs');
const worker = await import('../src/index.js');
// 直接用后台那份共享解析实现，避免同一套 CSV 规则出现第三份实现
const { parseCsvRows, stripBom } = await import('../../admin/src/utils/csv.js');

const CSV_PATH = process.argv[2] || fileURLToPath(
  new URL('../../artifacts/kb-import/internal-params-2023-cut-params.csv', import.meta.url)
);
const JWT_SECRET = 'knowledge-import-e2e-secret-32-chars';

function normalizeBindValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

class TestD1Statement {
  constructor(owner, sql) { this.owner = owner; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args.map(normalizeBindValue); return this; }
  async first(column) {
    const row = this.owner.sqlite.prepare(this.sql).get(...this.args);
    if (row === undefined) return null;
    return column === undefined ? row : row[column];
  }
  async all() {
    return { success: true, results: this.owner.sqlite.prepare(this.sql).all(...this.args) };
  }
  async run() {
    const result = this.owner.sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class TestD1Database {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys = ON');
  }
  prepare(sql) { return new TestD1Statement(this, sql); }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

function createEnv() {
  const DB = new TestD1Database();
  DB.sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_trace_logs (
      id TEXT PRIMARY KEY, conversation_id TEXT, user_id TEXT, user_role TEXT,
      tool_name TEXT, args_json TEXT, result_status TEXT, error_code TEXT,
      iteration INTEGER, latency_ms INTEGER, result_size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, actor_id TEXT, target_type TEXT, target_id TEXT,
      action TEXT, before_state TEXT, after_state TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const env = { DB, JWT_SECRET, KV: { async get() { return null; }, async put() {}, async delete() {} } };
  return withFixtureAccounts(env, { customers: [], engineers: [] });
}

async function adminToken(env) {
  return signEnvSession({
    userId: 'admin', userType: 'admin', market: 'com', phone: '13800000000',
    iat: 1, exp: Math.floor(Date.now() / 1000) + 3600,
  }, env);
}

async function importBatch(env, articles, status) {
  const jwt = await adminToken(env);
  const response = await worker.default.fetch(new Request('https://api.sagemro.com/api/admin/knowledge/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://admin.sagemro.com',
    },
    body: JSON.stringify({ articles, status }),
  }), env, { waitUntil() {} });
  return { status: response.status, json: await response.json() };
}

async function search(env, query, market = 'com') {
  const pending = [];
  const result = await worker.executeTool({
    toolName: 'search_knowledge_base',
    args: { query },
    env,
    ctx: { waitUntil: (promise) => pending.push(promise) },
    userRole: 'guest',
    market,
    conversationId: 'import-e2e',
    iteration: 0,
  });
  await Promise.all(pending);
  return result;
}

const QUERIES = [
  '不锈钢切割参数',
  '6000W 碳钢 氧气 切割参数是多少',
  '铝合金 12mm 切割速度',
  '黄铜怎么切',
  '紫铜切割参数',
  'MFMC-6000W 不锈钢',
  '切割参数',
  'E053 报警 怎么处理',
];

function line(label, value) {
  console.log(`  ${label.padEnd(28)}${value}`);
}

const csvText = readFileSync(CSV_PATH, 'utf8');
const rawRows = parseCsvRows(stripBom(csvText));
const headers = rawRows[0].map((header) => header.trim());
const rows = rawRows.slice(1).map((cells) => {
  const row = {};
  headers.forEach((header, index) => { row[header] = (cells[index] ?? '').trim(); });
  return row;
});
console.log(`来源: ${CSV_PATH}`);
console.log(`CSV: ${rows.length} 行, 列: ${headers.join(', ')}\n`);

const env = createEnv();

// ---- 1. 导入为草稿 ----
console.log('【1】导入为草稿');
const asDraft = await importBatch(env, rows, 'draft');
line('HTTP', asDraft.status);
if (asDraft.status !== 200) {
  console.error(JSON.stringify(asDraft.json, null, 2));
  process.exit(1);
}
line('导入 / 跳过 / 失败', `${asDraft.json.imported} / ${asDraft.json.skipped} / ${asDraft.json.failed}`);
if (asDraft.json.failed) {
  for (const row of asDraft.json.results.filter((r) => !r.ok).slice(0, 10)) {
    line(`  第 ${row.row} 行`, row.error);
  }
}

// ---- 2. 草稿不可检索 ----
console.log('\n【2】草稿状态下的检索（应全部为 0）');
let draftLeaked = 0;
for (const query of ['不锈钢切割参数', '6000W 碳钢 氧气']) {
  const result = await search(env, query);
  if (result.count > 0) draftLeaked += 1;
  line(query, `命中 ${result.count} 条`);
}
line('草稿泄漏', draftLeaked === 0 ? '无 ✅' : `${draftLeaked} 次 ❌`);

// ---- 3. 重复导入去重（草稿库） ----
console.log('\n【3】重复导入应被去重，而不是产生副本');
const again = await importBatch(env, rows, 'published');
line('导入 / 跳过 / 失败', `${again.json.imported} / ${again.json.skipped} / ${again.json.failed}`);
line('本条应全部跳过', again.json.imported === 0 ? '是 ✅' : '否 ❌');
line('库中条目总数（应为 122）', env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM knowledge_articles').get().n);

// ---- 4. 另起一套库：导入即发布 ----
console.log('\n【4】导入即发布（另一套空库，模拟勾选「导入并发布」）');
const env2 = createEnv();
const published = await importBatch(env2, rows, 'published');
line('导入 / 跳过 / 失败', `${published.json.imported} / ${published.json.skipped} / ${published.json.failed}`);
line('已发布条目数', env2.DB.sqlite
  .prepare("SELECT COUNT(*) AS n FROM knowledge_articles WHERE status = 'published'").get().n);
line('带审核人的已发布条目', env2.DB.sqlite
  .prepare("SELECT COUNT(*) AS n FROM knowledge_articles WHERE status = 'published' AND reviewed_by IS NOT NULL").get().n);

// ---- 5. 真实问句检索 ----
console.log('\n【5】真实问句检索');
let hit = 0;
for (const query of QUERIES) {
  const result = await search(env2, query);
  const top = result.articles[0];
  if (result.count > 0) hit += 1;
  const detail = top ? `${result.count} 条 | 首位: ${top.title} (score ${top.match_score})` : '0 条';
  line(query, detail);
}
console.log(`\n命中 ${hit} / ${QUERIES.length}（最后一个问句设计为应无命中）`);

// ---- 6. 线上真实失败回归 ----
// 2026-09-18 线上实测：模型发英文检索词、并带 locale="en"，而条目正文是中文，
// 三次调用全部 no_knowledge_match，AI 只好回答「没有可引用的参数」。
// 这三条查询原样保留在这里，作为回归用例。
console.log('\n【6】线上真实失败回归（英文提问 + locale 不匹配）');
const REGRESSION = [
  ['3000W carbon steel 16mm cutting parameters', { locale: 'en', category: 'cutting_parameters' }],
  ['3000W laser cutting parameters 10mm carbon steel', { locale: 'en', category: 'cutting_parameters' }],
  ['3000W 18mm carbon steel cutting parameters oxygen nozzle focus speed', { locale: 'zh-CN', category: 'cutting_parameters' }],
];
let recovered = 0;
for (const [query, args] of REGRESSION) {
  const pending = [];
  const result = await worker.executeTool({
    toolName: 'search_knowledge_base',
    args: { query, ...args },
    env: env2,
    ctx: { waitUntil: (promise) => pending.push(promise) },
    userRole: 'guest',
    market: 'com',
    conversationId: 'regression',
    iteration: 0,
  });
  await Promise.all(pending);
  if (result.count > 0) recovered += 1;
  line(query.slice(0, 44), result.count > 0
    ? `${result.count} 条 | 首位: ${result.articles[0].title}`
    : '0 条 ❌');
}
console.log(`\n恢复命中 ${recovered} / ${REGRESSION.length}`);
