import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../src/index.js';
import { signJwt } from '../src/lib/auth.js';

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
        return { results: [...env.__knowledge] };
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
          reviewed_by: null,
          reviewed_at: null,
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
    },
    KV: {
      async get() { return null; },
      async put() {},
    },
  };
  return env;
}

async function token(env, userType = 'admin') {
  return signJwt({
    userId: `${userType}-1`,
    userType,
    phone: '13800000000',
    iat: 1,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, env.JWT_SECRET);
}

async function api(env, path, { method = 'GET', body, userType = 'admin' } = {}) {
  const jwt = await token(env, userType);
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
  assert.equal(updated.json.article.reviewed_by, 'admin-1');
  assert.equal(updated.json.article.version, 2);
});

test('engineer cannot access admin knowledge management', async () => {
  const env = createEnv();
  const result = await api(env, '/api/admin/knowledge', { userType: 'engineer' });

  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, '需要管理员权限');
});
