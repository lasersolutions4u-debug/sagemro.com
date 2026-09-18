import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker, { executeTool } from '../src/index.js';
import { signEnvSession, withFixtureAccounts } from './helpers/session-jwt.mjs';

function createStatement(env, sql) {
  return {
    args: [],
    bind(...args) {
      this.args = args;
      return this;
    },
    async first() {
      const normalized = sql.replace(/\s+/g, ' ');
      if (/SELECT COUNT\(\*\) as count FROM knowledge_articles/i.test(normalized)) {
        return { count: env.__knowledge.length };
      }
      if (/SELECT \* FROM knowledge_articles WHERE id = \?/i.test(normalized)) {
        return env.__knowledge.find((item) => item.id === this.args[0]) || null;
      }
      return null;
    },
    async all() {
      const normalized = sql.replace(/\s+/g, ' ');
      if (/FROM knowledge_articles/i.test(normalized)) {
        const rows = /status = 'published'/i.test(normalized)
          ? env.__knowledge.filter((article) => article.status === 'published' && article.market === this.args[0])
          : env.__knowledge;
        return { results: [...rows] };
      }
      return { results: [] };
    },
    async run() {
      const normalized = sql.replace(/\s+/g, ' ');
      if (/INSERT INTO knowledge_articles/i.test(normalized)) {
        const [
          id,
          market,
          locale,
          category,
          title,
          content,
          source,
          applicable_equipment,
          applicable_brand,
          applicable_model,
          risk_level,
          status,
          reviewed_by,
        ] = this.args;
        env.__knowledge.push({
          id,
          market,
          locale,
          category,
          title,
          content,
          source,
          applicable_equipment,
          applicable_brand,
          applicable_model,
          risk_level,
          version: 1,
          status,
          reviewed_by: reviewed_by || null,
          reviewed_at: status === 'published' ? '2026-07-09 00:00:00' : null,
          created_at: '2026-07-09 00:00:00',
          updated_at: '2026-07-09 00:00:00',
        });
      }
      if (/UPDATE knowledge_articles SET/i.test(normalized) && /WHERE id = \?/i.test(normalized)) {
        const id = this.args.at(-1);
        const article = env.__knowledge.find((item) => item.id === id);
        if (!article) return { success: true, meta: { changes: 0 } };
        [
          article.market,
          article.locale,
          article.category,
          article.title,
          article.content,
          article.source,
          article.applicable_equipment,
          article.applicable_brand,
          article.applicable_model,
          article.risk_level,
          article.status,
          article.reviewed_by,
        ] = this.args.slice(0, 12);
        article.version += 1;
        return { success: true, meta: { changes: 1 } };
      }
      if (/INSERT INTO audit_logs/i.test(normalized)) {
        env.__auditLogs.push({ args: this.args });
      }
      return { success: true, meta: { changes: 1 } };
    },
  };
}

function createEnv() {
  const env = {
    JWT_SECRET: 'knowledge-admin-test-secret-32-chars',
    __knowledge: [],
    __auditLogs: [],
    DB: {
      prepare(sql) {
        return createStatement(env, sql);
      },
      async batch(statements) {
        env.__batchCalls = (env.__batchCalls || 0) + 1;
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      },
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
  };
  return withFixtureAccounts(env, {
    customers: [{ id: 'customer-1' }, { id: 'customer-2' }],
    engineers: [{ id: 'engineer-1' }, { id: 'engineer-2' }, { id: 'lead-1', engineer_role: 'regional_lead' }],
    // 商务角色：business_profile_required=0 让 resolveStaffIdentity 直接返回该行，
    // 这样测试聚焦在「路由权限」本身，不需要搭完整的商务组织层级。
    admin_staff_accounts: [
      { id: 'specialist-1', role: 'business_specialist', is_active: 1, market_scope: 'all', must_change_password: 0, business_profile_required: 0 },
      { id: 'manager-1', role: 'business_manager', is_active: 1, market_scope: 'all', must_change_password: 0, business_profile_required: 0 },
      { id: 'ops-1', role: 'operations', is_active: 1, market_scope: 'all', must_change_password: 0, business_profile_required: 0 },
    ],
  });
}

async function token(env, userType = 'admin', staff = null) {
  return signEnvSession({
    userId: staff ? staff.id : (userType === 'admin' ? 'admin' : `${userType}-1`),
    userType,
    market: 'cn',
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...(staff ? { staffId: staff.id, staffRole: staff.role } : {}),
  }, env);
}

async function api(env, path, { method = 'GET', body, userType = 'admin', staff = null } = {}) {
  const jwt = await token(env, userType, staff);
  const response = await worker.fetch(new Request(`https://api.sagemro.cn${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Origin: 'https://admin.sagemro.cn',
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const json = await response.json();
  return { response, json };
}

test('admin can create and list draft knowledge articles', async () => {
  const env = createEnv();

  const created = await api(env, '/api/admin/knowledge', {
    method: 'POST',
    body: {
      market: 'cn',
      locale: 'zh-CN',
      category: 'maintenance',
      title: 'Raytools BM111 protective lens contamination',
      content: 'Check assist gas cleanliness, nozzle alignment, sealing ring, and lens seat before blaming lens quality.',
      source: 'manual extract',
      applicable_equipment: 'fiber laser cutter',
      applicable_brand: 'Raytools',
      applicable_model: 'BM111',
      risk_level: 'medium',
    },
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.json.article.status, 'draft');
  assert.equal(created.json.article.version, 1);

  const listed = await api(env, '/api/admin/knowledge?category=maintenance&status=draft&search=BM111');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.total, 1);
  assert.equal(listed.json.list[0].title, 'Raytools BM111 protective lens contamination');
});

test('admin can publish a knowledge article with reviewer metadata', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/knowledge', {
    method: 'POST',
    body: {
      category: 'fault',
      title: 'CypCut E-stop alarm first checks',
      content: 'Confirm the emergency stop circuit, door interlock, and reset state before deeper electrical checks.',
      risk_level: 'high',
    },
  });
  const articleId = created.json.article.id;

  const updated = await api(env, `/api/admin/knowledge/${articleId}`, {
    method: 'PATCH',
    body: {
      status: 'published',
      category: 'fault',
      title: 'CypCut E-stop alarm first checks',
      content: 'Confirm the emergency stop circuit, door interlock, and reset state before deeper electrical checks.',
      risk_level: 'high',
    },
  });

  assert.equal(updated.response.status, 200);
  assert.equal(updated.json.article.status, 'published');
  assert.equal(updated.json.article.reviewed_by, 'admin');
  assert.equal(updated.json.article.version, 2);
});

test('candidate-derived knowledge article is fully workflow-managed while manual article remains editable', async () => {
  const env = createEnv();
  for (const publicUseAllowed of [0, 1]) {
    const id = `candidate-article-${publicUseAllowed}`;
    env.__knowledge.push({
      id, market: publicUseAllowed === 0 ? 'com' : 'cn', locale: publicUseAllowed === 0 ? 'en' : 'zh-CN', category: 'fault', title: 'Candidate article',
      content: 'Verified content', source: `work_order_candidate:cand-${publicUseAllowed}`,
      risk_level: 'medium', status: 'draft', version: 1, public_use_allowed: publicUseAllowed,
    });
    const locked = await api(env, `/api/admin/knowledge/${id}`, {
      method: 'PATCH', body: { status: 'published', title: 'Bypassed title', content: 'Bypassed content' },
    });
    assert.equal(locked.response.status, 409);
    assert.equal(locked.json.error, 'candidate_article_managed_by_workflow');
    const unchanged = env.__knowledge.find((article) => article.id === id);
    assert.equal(unchanged.status, 'draft');
    assert.equal(unchanged.title, 'Candidate article');
    assert.equal(unchanged.content, 'Verified content');
  }

  const search = await executeTool({
    toolName: 'search_knowledge_base', args: { market: 'cn', query: 'Candidate article' },
    env, userRole: 'guest', market: 'com', conversationId: 'candidate-publish-gate', iteration: 0,
    ctx: { waitUntil() {} },
  });
  assert.equal(search.count, 0, 'workflow draft must remain absent from real COM knowledge search');

  env.__knowledge.push({
    id: 'manual-article', market: 'cn', locale: 'zh-CN', category: 'fault', title: 'Manual article',
    content: 'Manual content', source: 'manual:old', risk_level: 'low', status: 'draft', version: 1,
  });
  const editable = await api(env, '/api/admin/knowledge/manual-article', {
    method: 'PATCH', body: { source: 'manual:new' },
  });
  assert.equal(editable.response.status, 200);
  assert.equal(env.__knowledge.at(-1).source, 'manual:new');
});

test('engineer cannot access admin knowledge management', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge', { userType: 'engineer' });

  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, '需要管理员权限');
});

// ---------- 批量导入（一行一条） ----------

function batchRow(overrides = {}) {
  return {
    category: 'cutting_parameters',
    title: '6000W 碳钢切割参数（O2）',
    content: '| 厚度(mm) | 速度(m/min) |\n| --- | --- |\n| 3 | 3.6-4.2 |',
    source: '3-40kW参数(2023).xlsx / 工作表 6000W',
    applicable_equipment: '光纤激光切割机',
    applicable_model: '6000W',
    risk_level: 'medium',
    ...overrides,
  };
}

test('批量导入按行写入，失败行带上行号与原因，不影响其他行', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST',
    body: {
      articles: [
        batchRow({ title: '条目一' }),
        batchRow({ title: '' }),                       // 缺标题 → 该行失败
        batchRow({ title: '条目二', category: '不存在的分类' }), // 非法分类 → 该行失败
        batchRow({ title: '条目三' }),
      ],
    },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.total, 4);
  assert.equal(result.json.imported, 2);
  assert.equal(result.json.failed, 2);
  assert.equal(result.json.skipped, 0);

  const failed = result.json.results.filter((row) => !row.ok);
  assert.deepEqual(failed.map((row) => row.row), [2, 3], '失败行必须回报原始行号');
  assert.ok(failed.every((row) => typeof row.error === 'string' && row.error.length > 0));

  assert.equal(env.__knowledge.length, 2);
  assert.equal(env.__batchCalls, 1, '一次请求只应发出一次 batch');
});

test('批量导入按标题去重：重复导入不会产生副本', async () => {
  const env = createEnv();
  const body = { articles: [batchRow({ title: '重复条目' }), batchRow({ title: '另一个条目' })] };

  const first = await api(env, '/api/admin/knowledge/batch', { method: 'POST', body });
  assert.equal(first.json.imported, 2);

  const second = await api(env, '/api/admin/knowledge/batch', { method: 'POST', body });
  assert.equal(second.json.imported, 0);
  assert.equal(second.json.skipped, 2);
  assert.equal(env.__knowledge.length, 2, '第二次导入不应新增任何条目');
});

test('同一批次内的重复标题也会被跳过', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST',
    body: { articles: [batchRow({ title: '同批重复' }), batchRow({ title: '同批重复' })] },
  });

  assert.equal(result.json.imported, 1);
  assert.equal(result.json.skipped, 1);
  assert.equal(env.__knowledge.length, 1);
});

test('批量导入可覆盖状态；直接发布时写入审核人', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST',
    body: { status: 'published', articles: [batchRow({ title: '已发布条目' })] },
  });

  assert.equal(result.json.imported, 1);
  const article = env.__knowledge.at(-1);
  assert.equal(article.status, 'published');
  assert.equal(article.reviewed_by, 'admin', '直接发布必须留下审核人');
  assert.ok(article.reviewed_at);
});

test('批量导入：空数组、超限、非法状态都会被拒绝', async () => {
  const env = createEnv();
  assert.equal((await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', body: { articles: [] },
  })).response.status, 400);

  assert.equal((await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', body: { articles: Array.from({ length: 501 }, (_, i) => batchRow({ title: `t${i}` })) },
  })).response.status, 400);

  assert.equal((await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', body: { articles: [batchRow()], status: '不存在的状态' },
  })).response.status, 400);

  assert.equal((await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', body: {},
  })).response.status, 400);
});

test('批量导入仅限管理员', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', body: { articles: [batchRow()] }, userType: 'engineer',
  });
  assert.equal(result.response.status, 403);
  assert.equal(env.__knowledge.length, 0);
});

test('手动新建并直接发布时也会写入审核人', async () => {
  const env = createEnv();
  const created = await api(env, '/api/admin/knowledge', {
    method: 'POST',
    body: { ...batchRow({ title: '手动发布条目' }), status: 'published' },
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.json.article.status, 'published');
  assert.equal(created.json.article.reviewed_by, 'admin');
});

// ---------- 角色权限：商务角色可以用知识库 ----------

const SPECIALIST = { id: 'specialist-1', role: 'business_specialist' };
const MANAGER = { id: 'manager-1', role: 'business_manager' };
const OPERATIONS = { id: 'ops-1', role: 'operations' };

test('商务专员可以查看知识库列表并批量导入', async () => {
  const env = createEnv();

  const listed = await api(env, '/api/admin/knowledge', { staff: SPECIALIST });
  assert.equal(listed.response.status, 200);

  const imported = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST',
    staff: SPECIALIST,
    body: { status: 'published', articles: [batchRow({ title: '商务专员上传的条目' })] },
  });
  assert.equal(imported.response.status, 200);
  assert.equal(imported.json.imported, 1);
  assert.equal(env.__knowledge.at(-1).status, 'published');
  assert.equal(env.__knowledge.at(-1).reviewed_by, 'specialist-1', '审核人应是上传者本人');
});

test('商务经理同样可以导入', async () => {
  const env = createEnv();
  const imported = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', staff: MANAGER, body: { articles: [batchRow({ title: '经理上传' })] },
  });
  assert.equal(imported.response.status, 200);
  assert.equal(imported.json.imported, 1);
});

test('商务角色不能进入知识候选审核工作流', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge-candidates', { staff: SPECIALIST });
  assert.equal(result.response.status, 403, '放开的是知识库，不是候选审核');
});

test('运营 / 仓库 / 采购仍然不能访问知识库', async () => {
  const env = createEnv();
  const listed = await api(env, '/api/admin/knowledge', { staff: OPERATIONS });
  assert.equal(listed.response.status, 403, '本次只给商务角色授权，运营不动');

  const imported = await api(env, '/api/admin/knowledge/batch', {
    method: 'POST', staff: OPERATIONS, body: { articles: [batchRow()] },
  });
  assert.equal(imported.response.status, 403);
  assert.equal(env.__knowledge.length, 0);
});

test('商务角色仍可正常使用商务工作台接口', async () => {
  const env = createEnv();
  // 权限改为白名单拼接后，原有商务路由不能被打断
  const result = await api(env, '/api/admin/business/work-orders', { staff: SPECIALIST });
  assert.notEqual(result.response.status, 403);
});
