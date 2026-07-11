import { test } from 'node:test';
import assert from 'node:assert/strict';

import { executeTool } from '../src/index.js';

function makeCtx() {
  const pending = [];
  return {
    ctx: { waitUntil: (promise) => pending.push(promise) },
    flush: () => Promise.all(pending.splice(0)),
  };
}

function makeEnv() {
  const traceRows = [];
  const sqlCalls = [];
  const rows = [
    {
      id: 'kb-published-1',
      market: 'cn',
      locale: 'zh-CN',
      category: 'maintenance',
      title: 'BM111 protective lens contamination',
      content: 'Check assist gas cleanliness and nozzle alignment first.',
      source: 'manual extract',
      applicable_equipment: 'fiber laser cutter',
      applicable_brand: 'Raytools',
      applicable_model: 'BM111',
      risk_level: 'medium',
      version: 1,
      status: 'published',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-07-10 00:00:00',
      created_at: '2026-07-10 00:00:00',
      updated_at: '2026-07-10 00:00:00',
    },
  ];

  const DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          sqlCalls.push({ sql, args });
          return this;
        },
        async first() {
          return null;
        },
        async all() {
          if (/FROM knowledge_articles/i.test(sql)) {
            return { results: rows };
          }
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO ai_trace_logs/i.test(sql)) {
            const [
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
            ] = this.args;
            traceRows.push({
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };

  return { env: { DB }, traceRows, sqlCalls };
}

test('guest can search published knowledge articles only', async () => {
  const { env, traceRows, sqlCalls } = makeEnv();
  const { ctx, flush } = makeCtx();

  const result = await executeTool({
    toolName: 'search_knowledge_base',
    args: {
      market: 'cn',
      locale: 'zh-CN',
      category: 'maintenance',
      query: 'BM111 protective lens',
    },
    env,
    ctx,
    userRole: 'guest',
    conversationId: 'conv-kb-1',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, undefined);
  assert.equal(result.count, 1);
  assert.equal(result.articles[0].status, 'published');
  assert.equal(result.articles[0].title, 'BM111 protective lens contamination');
  assert.match(sqlCalls.find((call) => /FROM knowledge_articles/i.test(call.sql)).sql, /status = 'published'/i);
  assert.equal(traceRows.at(-1).tool_name, 'search_knowledge_base');
  assert.equal(traceRows.at(-1).result_status, 'ok');
});
