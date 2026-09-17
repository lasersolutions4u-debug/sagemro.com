// 知识检索的**真实 SQL** 行为测试。
//
// 为什么需要这个文件
// ------------------
// `knowledge-search-tool.test.mjs` 用的是 mock DB，它把所有 `FROM knowledge_articles`
// 的查询都直接返回固定行，SQL 本身完全没被执行。也就是说：检索语句写错了它也照样绿。
//
// 这个文件跑在真的 SQLite 上（node:sqlite），用来锁住三件事：
//   1. 自然语言中文问句能命中（旧的整串 instr 实现对这类问句必然 0 命中）；
//   2. 型号 / 零件号能命中并且排在最前；
//   3. 检索不到时留下可追溯的 trace（否则「知识库没被用上」在运营端是静默的）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  if (type !== 'ExperimentalWarning') emitWarning.call(process, warning, ...args);
};
const { DatabaseSync } = await import('node:sqlite');
process.emitWarning = emitWarning;

import { executeTool } from '../src/index.js';

function normalizeBindValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

class TestD1Statement {
  constructor(owner, sql) {
    this.owner = owner;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args.map(normalizeBindValue);
    return this;
  }

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

const CUTTING_ARTICLE = {
  id: 'kb-cutting-1',
  market: 'com',
  locale: 'zh-CN',
  category: 'cutting_parameters',
  title: 'MFMC-6000W 100μm 不锈钢切割参数（N2）',
  content: [
    '机型：MFMC-6000W 连续激光器',
    '材料：不锈钢',
    '',
    '| 厚度(mm) | 速度(m/min) | 功率(W) |',
    '| --- | --- | --- |',
    '| 1 | 55-60 | 6000 |',
    '| 6 | 4-5 | 6000 |',
  ].join('\n'),
  applicable_equipment: '光纤激光切割机',
  applicable_brand: '创鑫激光 MAX',
  applicable_model: 'MFMC-6000W-100μm',
  risk_level: 'medium',
  status: 'published',
};

const PART_ARTICLE = {
  id: 'kb-part-1',
  market: 'com',
  locale: 'zh-CN',
  category: 'parts',
  title: 'BM111 保护镜片污染的处理顺序',
  content: '先检查辅助气体纯净度与喷嘴对中，再确认保护镜片是否发黄或点蚀，最后检查密封圈与镜座。',
  applicable_equipment: '光纤激光切割机',
  applicable_brand: 'Raytools',
  applicable_model: 'BM111',
  risk_level: 'medium',
  status: 'published',
};

const CN_ONLY_ARTICLE = {
  id: 'kb-cn-1',
  market: 'cn',
  locale: 'zh-CN',
  category: 'fault',
  title: '伺服驱动器过载报警的现场处置',
  content: '检查机械卡阻、驱动器散热与电机电缆。',
  applicable_model: 'CN-ONLY-MODEL',
  risk_level: 'high',
  status: 'published',
};

const DRAFT_ARTICLE = {
  id: 'kb-draft-1',
  market: 'com',
  locale: 'zh-CN',
  category: 'fault',
  title: '尚未审核的草稿条目',
  content: '这条内容不应该出现在任何检索结果里。',
  applicable_model: 'DRAFT-ONLY-MODEL',
  risk_level: 'low',
  status: 'draft',
};

// 参数表里气体写的是化学式（O2 / N2/Air），客户问的是中文（氧气 / 氮气）。
const CARBON_O2_ARTICLE = {
  id: 'kb-carbon-o2',
  market: 'com',
  locale: 'zh-CN',
  category: 'cutting_parameters',
  title: '6000W 碳钢切割参数（O2）',
  content: '| 厚度(mm) | 速度(m/min) |\n| --- | --- |\n| 3 | 3.6-4.2 |',
  applicable_model: '6000W',
  risk_level: 'medium',
  status: 'published',
};

const CARBON_N2_ARTICLE = {
  id: 'kb-carbon-n2',
  market: 'com',
  locale: 'zh-CN',
  category: 'cutting_parameters',
  title: '6000W 碳钢切割参数（N2/Air）',
  content: '| 厚度(mm) | 速度(m/min) |\n| --- | --- |\n| 3 | 15-20 |',
  applicable_model: '6000W',
  risk_level: 'medium',
  status: 'published',
};

function createEnv() {
  const DB = new TestD1Database();
  DB.sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  DB.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_trace_logs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      user_id TEXT,
      user_role TEXT,
      tool_name TEXT,
      args_json TEXT,
      result_status TEXT,
      error_code TEXT,
      iteration INTEGER,
      latency_ms INTEGER,
      result_size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const insert = DB.sqlite.prepare(`
    INSERT INTO knowledge_articles (
      id, market, locale, category, title, content, source,
      applicable_equipment, applicable_brand, applicable_model, risk_level, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const article of [
    CUTTING_ARTICLE, PART_ARTICLE, CN_ONLY_ARTICLE, DRAFT_ARTICLE,
    CARBON_O2_ARTICLE, CARBON_N2_ARTICLE,
  ]) {
    insert.run(
      article.id, article.market, article.locale, article.category, article.title,
      article.content, 'test fixture', article.applicable_equipment || null,
      article.applicable_brand || null, article.applicable_model || null,
      article.risk_level, article.status
    );
  }
  return {
    DB,
    KV: { async get() { return null; }, async put() {}, async delete() {} },
  };
}

async function search(env, { query, market = 'com', args = {} } = {}) {
  const pending = [];
  const result = await executeTool({
    toolName: 'search_knowledge_base',
    args: { query, ...args },
    env,
    ctx: { waitUntil: (promise) => pending.push(promise) },
    userRole: 'guest',
    market,
    conversationId: 'retrieval-test',
    iteration: 0,
  });
  await Promise.all(pending);
  return result;
}

function missTraces(env) {
  return env.DB.sqlite
    .prepare("SELECT args_json FROM ai_trace_logs WHERE error_code = 'no_knowledge_match'")
    .all();
}

test('自然语言中文问句能命中相关条目（旧实现整串比对必然 0 命中）', async () => {
  const env = createEnv();
  const result = await search(env, { query: '激光切割 不锈钢 参数' });

  assert.ok(result.count >= 1, `期望命中，实际 ${result.count} 条`);
  assert.equal(result.articles[0].id, CUTTING_ARTICLE.id);
  assert.ok(result.articles[0].match_score > 0);
});

test('问句里带无关后缀仍能命中（整串匹配会因此失败）', async () => {
  const env = createEnv();
  const result = await search(env, { query: '不锈钢切割参数是多少，请给个参考' });

  assert.ok(result.count >= 1, `期望命中，实际 ${result.count} 条`);
  assert.equal(result.articles[0].id, CUTTING_ARTICLE.id);
});

test('型号 / 零件号命中并排在前面', async () => {
  const env = createEnv();
  const result = await search(env, { query: 'BM111 保护镜片' });

  assert.ok(result.count >= 1);
  assert.equal(result.articles[0].id, PART_ARTICLE.id);
});

test('分类过滤仍然生效', async () => {
  const env = createEnv();
  const hit = await search(env, { query: 'MFMC-6000W', args: { category: 'cutting_parameters' } });
  assert.equal(hit.articles[0].id, CUTTING_ARTICLE.id);

  const miss = await search(env, { query: 'MFMC-6000W', args: { category: 'parts' } });
  assert.equal(miss.count, 0);
});

test('市场隔离：cn 的知识不会被 COM 检索到，反之亦然', async () => {
  const env = createEnv();

  const com = await search(env, { query: 'CN-ONLY-MODEL', market: 'com' });
  assert.equal(com.count, 0, 'cn 市场的条目不能在 COM 出现');

  const cn = await search(env, { query: 'CN-ONLY-MODEL', market: 'cn' });
  assert.equal(cn.count, 1);
  assert.equal(cn.articles[0].id, CN_ONLY_ARTICLE.id);
});

test('draft 条目永远不出现在检索结果里', async () => {
  const env = createEnv();
  const result = await search(env, { query: 'DRAFT-ONLY-MODEL' });
  assert.equal(result.count, 0);
});

test('检索不到时留下 no_knowledge_match trace，并带上原始问句', async () => {
  const env = createEnv();
  const result = await search(env, { query: 'E053 报警 怎么处理' });

  assert.equal(result.count, 0);
  assert.match(result.note, /No matching published SAGEMRO knowledge was found/);

  const traces = missTraces(env);
  assert.equal(traces.length, 1, '未命中应恰好留下一条 trace');
  assert.match(traces[0].args_json, /E053/);
});

test('问句填充词不参与匹配（否则「怎么处理」会把无关条目拉进来）', async () => {
  const env = createEnv();
  // 「处理」「怎么」这类词单独命中没有检索价值；这里只有填充词与无关型号
  const result = await search(env, { query: '请问这个东西应该怎么处理呢' });
  assert.equal(result.count, 0, '填充词不应该命中任何条目');
});

test('命中时不写 no_knowledge_match trace', async () => {
  const env = createEnv();
  await search(env, { query: 'BM111' });
  assert.equal(missTraces(env).length, 0);
});

test('空查询与无意义字符不会打到数据库', async () => {
  const env = createEnv();
  assert.equal((await search(env, { query: '' })).count, 0);
  assert.equal((await search(env, { query: '   ' })).count, 0);
  assert.equal((await search(env, { query: '，。！？' })).count, 0);
});

test('中文长串按二元组拆分，能召回部分重合的条目', async () => {
  const env = createEnv();
  // 「不锈钢切割参数」整串在正文里并不连续出现，只有二元组能救回来
  const result = await search(env, { query: '不锈钢切割参数' });
  assert.ok(result.count >= 1);
  assert.equal(result.articles[0].id, CUTTING_ARTICLE.id);
});

test('同义扩展：客户说「氧气」，表里写的是 O2', async () => {
  const env = createEnv();
  const result = await search(env, { query: '6000W 碳钢 氧气 切割参数是多少' });

  assert.ok(result.count >= 1);
  assert.equal(
    result.articles[0].id,
    CARBON_O2_ARTICLE.id,
    '带 O2 的条目应排在 N2/Air 之前'
  );
});

test('同义扩展：客户说「氮气」也能命中 N2 条目', async () => {
  const env = createEnv();
  const result = await search(env, { query: '氮气切割 碳钢' });
  assert.ok(result.count >= 1);
  assert.ok(['kb-carbon-n2', 'kb-carbon-o2'].includes(result.articles[0].id));
});

test('同义扩展不会把无关条目拉进来', async () => {
  const env = createEnv();
  // 「氧气」不该让零件类条目命中
  const result = await search(env, { query: '氧气' });
  assert.ok(result.articles.every((article) => article.id !== PART_ARTICLE.id));
});
