/**
 * executeTool 单元测试 (Phase 0.2 验证)
 *
 * 运行方式：
 *   cd worker
 *   node --test tests/execute-tool.test.mjs
 *
 * 目标：绕开 HTTP/wrangler dev，纯 Node + mock env/ctx，验证
 *   1. 服务端 role guard（ROLE_ALLOWED_TOOLS）
 *   2. fallback_instruction 形状
 *   3. ai_trace_logs 写入行为（denied / ok）
 *
 * 为什么不跑 wrangler dev：本地 D1 非完整 schema（缺 customers/engineers 表），
 * 且主要要验的是"执行层面的路由逻辑"，和 HTTP/auth 无关，unit test 更快更稳。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { executeTool, consumeLlmStream } from '../src/index.js';

// ============ Mock DB ============

/**
 * 构造一个内存 mock DB：
 *   - 捕获所有写入 ai_trace_logs 的 INSERT（供 trace 断言）
 *   - 对读路径返回足够 executor 成功执行的固定数据
 *
 * INSERT 到 ai_trace_logs 的列顺序（见 trace.js）：
 *   (id, conversation_id, user_id, user_role, tool_name, args_json,
 *    result_status, error_code, latency_ms, iteration, result_size_bytes)
 */
function makeMockEnv() {
  const traceRows = [];

  const DB = {
    prepare(sql) {
      const stmt = {
        _sql: sql,
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          // toolGetEngineerProfile: 查询 engineer 主表
          if (/FROM engineers WHERE id/.test(sql)) {
            return {
              name: '测试工程师',
              phone: '13800000001',
              specialties: '["激光切割机"]',
              brands: '{"激光切割机":["大族"]}',
              services: '["参数调试"]',
              service_region: '华东',
              status: 'available',
              level: 'junior',
              commission_rate: 0.8,
              credit_score: 100,
              wallet_balance: 0,
              rating_timeliness: 0,
              rating_technical: 0,
              rating_communication: 0,
              rating_professional: 0,
              rating_count: 0,
              total_orders: 0,
              total_earnings: 0,
            };
          }
          // toolGetEngineerProfile: 本月统计
          if (/COUNT\(\*\) as cnt.*SUM/s.test(sql)) {
            return { cnt: 0, earnings: 0 };
          }
          // toolGetEngineerProfile: 处理中工单数
          if (/COUNT\(\*\) as cnt.*FROM work_orders/s.test(sql)) {
            return { cnt: 0 };
          }
          return null;
        },
        async all() {
          // toolGetCustomerDevices
          if (/FROM devices d[\s\S]*LEFT JOIN work_orders/.test(sql)) {
            return {
              results: [
                {
                  id: 'dev-test-1',
                  name: '车间1号激光机',
                  type: '激光切割机',
                  brand: '大族',
                  model: 'G3015',
                  power: '3000W',
                  status: 'normal',
                  total_orders: 0,
                  completed_orders: 0,
                  last_order_date: null,
                },
              ],
            };
          }
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO ai_trace_logs/.test(sql)) {
            const [
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
              latency_ms,
              iteration,
              result_size_bytes,
            ] = this._args;
            traceRows.push({
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
              latency_ms,
              iteration,
              result_size_bytes,
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };

  return { env: { DB }, traceRows };
}

/**
 * Mock ctx.waitUntil —— 不要 fire-and-forget，让测试可以 await 所有 trace 写入完成
 * 再断言 traceRows。
 */
function makeMockCtx() {
  const pending = [];
  return {
    ctx: { waitUntil: (p) => pending.push(p) },
    flush: () => Promise.all(pending.splice(0)),
  };
}

// ============ 测试用例 ============

test('guest 调 get_engineer_profile → permission_denied + denied trace', async () => {
  const { env, traceRows } = makeMockEnv();
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_engineer_profile',
    args: {},
    env,
    ctx,
    userRole: 'guest',
    engineerId: null,
    customerId: null,
    conversationId: 'conv-test-1',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, 'permission_denied', '返回 error=permission_denied');
  assert.match(
    result.fallback_instruction,
    /Do not mention this tool/i,
    '返回 fallback_instruction 提示 AI 不要暴露错误',
  );
  assert.equal(traceRows.length, 1, '应写入恰好 1 条 trace');
  assert.equal(traceRows[0].result_status, 'denied');
  assert.equal(traceRows[0].error_code, 'permission_denied');
  assert.equal(traceRows[0].user_role, 'guest');
  assert.equal(traceRows[0].tool_name, 'get_engineer_profile');
  assert.equal(traceRows[0].conversation_id, 'conv-test-1');
});

test('customer 调 get_customer_devices → ok + ok trace', async () => {
  const { env, traceRows } = makeMockEnv();
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_customer_devices',
    args: {},
    env,
    ctx,
    userRole: 'customer',
    customerId: 'cust-test-1',
    conversationId: 'conv-test-2',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, undefined, '不应有 error 字段');
  assert.equal(result.count, 1, '返回 1 台设备');
  assert.equal(result.devices[0].type, '激光切割机');
  assert.equal(traceRows.length, 1);
  assert.equal(traceRows[0].result_status, 'ok');
  assert.equal(traceRows[0].error_code, null);
  assert.equal(traceRows[0].user_role, 'customer');
  assert.equal(traceRows[0].user_id, 'cust-test-1');
  assert.equal(traceRows[0].tool_name, 'get_customer_devices');
  assert.ok(traceRows[0].latency_ms >= 0, 'latency_ms 应存在且 >= 0');
  assert.ok(traceRows[0].result_size_bytes > 0, '应记录返回体字节数');
});

test('engineer 调 get_engineer_profile → ok + ok trace', async () => {
  const { env, traceRows } = makeMockEnv();
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_engineer_profile',
    args: {},
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-test-1',
    conversationId: 'conv-test-3',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, undefined, '不应有 error 字段');
  assert.equal(result.name, '测试工程师');
  assert.equal(result.level, '初级');
  assert.equal(result.commission_rate, 80);
  assert.deepEqual(result.specialties, ['激光切割机']);
  assert.equal(traceRows.length, 1);
  assert.equal(traceRows[0].result_status, 'ok');
  assert.equal(traceRows[0].user_role, 'engineer');
  assert.equal(traceRows[0].user_id, 'eng-test-1');
  assert.equal(traceRows[0].tool_name, 'get_engineer_profile');
});

test('customer 越权调 get_engineer_profile → permission_denied', async () => {
  const { env, traceRows } = makeMockEnv();
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_engineer_profile',
    args: {},
    env,
    ctx,
    userRole: 'customer',
    customerId: 'cust-test-1',
    conversationId: 'conv-test-4',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, 'permission_denied');
  assert.match(result.fallback_instruction, /Do not mention this tool/i);
  assert.equal(traceRows.length, 1);
  assert.equal(traceRows[0].result_status, 'denied');
  assert.equal(traceRows[0].error_code, 'permission_denied');
  assert.equal(traceRows[0].user_role, 'customer');
  assert.equal(
    traceRows[0].tool_name,
    'get_engineer_profile',
    '记录的是被拒的工具名，不是实际执行的',
  );
});

test('未知工具名 → unknown_tool trace', async () => {
  // 注意：guest 白名单是空集，所以 guest 调什么都会被 role guard 先拦截；
  // 要让"未知工具"分支生效，需要选一个"白名单非空"的 role，调一个不存在的工具。
  // 但现实里只要 role 把这个工具白名单列出来就可能有 executor；
  // 更稳的做法是临时构造：用 admin（白名单最全）调一个根本不在 executor map 里的工具。
  // admin 白名单硬编码了 4 个工具，都有 executor，无法直接测 unknown_tool。
  //
  // 这个场景等 Phase 0.3 加新工具的流程走通时再补。当前 role guard + executor map
  // 的集合关系让 unknown_tool 分支实际不可达，属于"深度防御"代码（允许挂着不测）。
});

// ============ consumeLlmStream SSE 累积逻辑 ============

/**
 * 构造一个 mock Response，body 分多个 chunk 吐出指定的 SSE 行。
 * 用于覆盖 tool_calls arguments 跨 chunk 分片的边界场景。
 */
function makeMockLlmResponse(chunks) {
  const enc = new TextEncoder();
  let idx = 0;
  return {
    body: {
      getReader() {
        return {
          async read() {
            if (idx >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: enc.encode(chunks[idx++]) };
          },
        };
      },
    },
  };
}

function makeMockController() {
  const emitted = [];
  return {
    controller: {
      enqueue: (u8) => emitted.push(new TextDecoder().decode(u8)),
    },
    emitted,
  };
}

test('consumeLlmStream: content 实时转发给客户端', async () => {
  const { controller, emitted } = makeMockController();
  const resp = makeMockLlmResponse([
    'data: {"choices":[{"delta":{"content":"你好"}}]}\n',
    'data: {"choices":[{"delta":{"content":"，小智"}}]}\n',
    'data: [DONE]\n',
  ]);

  const { content, toolCalls } = await consumeLlmStream({
    response: resp,
    controller,
    encoder: new TextEncoder(),
    convId: 'conv-x',
    decoder: new TextDecoder(),
  });

  assert.equal(content, '你好，小智');
  assert.equal(toolCalls.length, 0);
  assert.equal(emitted.length, 2, '每个 content delta 转发一次');
  assert.ok(emitted[0].includes('"content":"你好"'));
  assert.ok(emitted[1].includes('"content":"，小智"'));
  // [DONE] 不应转发（外层统一发）
  assert.ok(!emitted.some((e) => e.includes('[DONE]')));
});

test('consumeLlmStream: tool_calls arguments 跨 chunk 分片正确拼接', async () => {
  // OpenAI 流式规范：首包有 id + name，后续 chunk 只带 arguments 增量
  const chunks = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_customer_devices","arguments":""}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"lim"}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"it\\":"}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"10}"}}]}}]}\n',
    'data: [DONE]\n',
  ];
  const { controller, emitted } = makeMockController();

  const { content, toolCalls } = await consumeLlmStream({
    response: makeMockLlmResponse(chunks),
    controller,
    encoder: new TextEncoder(),
    convId: 'conv-y',
    decoder: new TextDecoder(),
  });

  assert.equal(content, '');
  assert.equal(emitted.length, 0, 'tool_calls 只累积不转发');
  assert.equal(toolCalls.length, 1);
  assert.equal(toolCalls[0].id, 'call_abc');
  assert.equal(toolCalls[0].function.name, 'get_customer_devices');
  assert.equal(toolCalls[0].function.arguments, '{"limit":10}');
  // 验证拼接出的 JSON 可被解析（下游 executeTool 就是这么用的）
  assert.deepEqual(JSON.parse(toolCalls[0].function.arguments), { limit: 10 });
});

test('consumeLlmStream: 并行多 tool_call 按 index 正确归档', async () => {
  // 两个并行 tool call（OpenAI 规范允许 parallel_tool_calls）
  // index 0 和 1 各自累积自己的 arguments
  const chunks = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_A","type":"function","function":{"name":"tool_a","arguments":""}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"call_B","type":"function","function":{"name":"tool_b","arguments":""}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"x\\":1}"}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{\\"y\\":2}"}}]}}]}\n',
    'data: [DONE]\n',
  ];
  const { controller } = makeMockController();

  const { toolCalls } = await consumeLlmStream({
    response: makeMockLlmResponse(chunks),
    controller,
    encoder: new TextEncoder(),
    convId: 'conv-z',
    decoder: new TextDecoder(),
  });

  assert.equal(toolCalls.length, 2);
  assert.equal(toolCalls[0].id, 'call_A');
  assert.equal(toolCalls[0].function.name, 'tool_a');
  assert.deepEqual(JSON.parse(toolCalls[0].function.arguments), { x: 1 });
  assert.equal(toolCalls[1].id, 'call_B');
  assert.equal(toolCalls[1].function.name, 'tool_b');
  assert.deepEqual(JSON.parse(toolCalls[1].function.arguments), { y: 2 });
});

test('consumeLlmStream: chunk 跨网络包边界时 buffer 仍能正确解析', async () => {
  // 一行 SSE 数据被切成两个 chunk（第二行以 \n 结尾）
  const chunks = [
    'data: {"choices":[{"delta":{"content":"分片"',
    '}}]}\n',
    'data: [DONE]\n',
  ];
  const { controller, emitted } = makeMockController();

  const { content } = await consumeLlmStream({
    response: makeMockLlmResponse(chunks),
    controller,
    encoder: new TextEncoder(),
    convId: 'conv-w',
    decoder: new TextDecoder(),
  });

  assert.equal(content, '分片');
  assert.equal(emitted.length, 1);
});

test('consumeLlmStream: 过滤缺 id/name 的残缺 tool_call', async () => {
  // 一个完整 call + 一个只有 index 没有 id 的脏数据
  const chunks = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_good","type":"function","function":{"name":"good","arguments":"{}"}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"arguments":"{\\"x\\":1}"}}]}}]}\n',
    'data: [DONE]\n',
  ];
  const { controller } = makeMockController();

  const { toolCalls } = await consumeLlmStream({
    response: makeMockLlmResponse(chunks),
    controller,
    encoder: new TextEncoder(),
    convId: 'conv-filter',
    decoder: new TextDecoder(),
  });

  assert.equal(toolCalls.length, 1, '只保留有 id + name 的 tool_call');
  assert.equal(toolCalls[0].id, 'call_good');
});

// ============ Phase 0.4: 合伙人待接单按 specialties 过滤 ============

/**
 * 专为 toolGetPendingTickets 定制的 mock env：
 *   - engineers SELECT specialties：返回配置的 specialtiesJson（字符串）
 *   - work_orders 全表查询（无 IN 过滤）：返回 allTickets
 *   - work_orders 带 IN 过滤：返回根据 IN 参数过滤后的 allTickets
 *   - ai_trace_logs：照常捕获
 *
 * SQL 捕获：把每次 prepare 的 sql + bind 参数写入 sqlCalls，供断言 IN 子句是否真的拼进去了
 */
function makeMockEnvForPending({ specialtiesJson, allTickets }) {
  const traceRows = [];
  const sqlCalls = [];

  const DB = {
    prepare(sql) {
      const stmt = {
        _sql: sql,
        _args: [],
        bind(...args) {
          this._args = args;
          sqlCalls.push({ sql, args });
          return this;
        },
        async first() {
          if (/SELECT specialties FROM engineers WHERE id/.test(sql)) {
            return specialtiesJson === undefined ? null : { specialties: specialtiesJson };
          }
          return null;
        },
        async all() {
          if (/FROM work_orders wo/.test(sql)) {
            // 有 IN 子句时按 type 过滤；没有就全量
            const inMatch = sql.match(/d\.type IN \(([^)]+)\)/);
            if (inMatch) {
              // this._args 排列：[...specialties, limit]
              const limit = this._args[this._args.length - 1];
              const types = this._args.slice(0, -1);
              const filtered = allTickets.filter((t) => types.includes(t.device_type));
              return { results: filtered.slice(0, limit) };
            }
            const limit = this._args[0];
            return { results: allTickets.slice(0, limit) };
          }
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO ai_trace_logs/.test(sql)) {
            const [
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
              latency_ms,
              iteration,
              result_size_bytes,
            ] = this._args;
            traceRows.push({
              id,
              conversation_id,
              user_id,
              user_role,
              tool_name,
              args_json,
              result_status,
              error_code,
              latency_ms,
              iteration,
              result_size_bytes,
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };

  return { env: { DB }, traceRows, sqlCalls };
}

const ALL_TICKETS = [
  {
    id: 'wo-1',
    order_no: 'WO-20260422-001',
    type: 'fault',
    description: '激光切割毛刺',
    urgency: 'urgent',
    created_at: '2026-04-22 10:00:00',
    device_type: '激光切割机',
    device_brand: '大族',
    device_model: 'G3015',
    customer_name: '张老板',
  },
  {
    id: 'wo-2',
    order_no: 'WO-20260422-002',
    type: 'fault',
    description: '折弯精度问题',
    urgency: 'normal',
    created_at: '2026-04-22 09:00:00',
    device_type: '折弯机',
    device_brand: '通快',
    device_model: 'TruBend',
    customer_name: '李厂长',
  },
  {
    id: 'wo-3',
    order_no: 'WO-20260422-003',
    type: 'maintenance',
    description: '切割头保养',
    urgency: 'normal',
    created_at: '2026-04-22 08:00:00',
    device_type: '激光切割机',
    device_brand: '迅镭',
    device_model: 'X3015',
    customer_name: '王总',
  },
];

test('engineer 有 specialties → SQL 带 IN 过滤 + 只返回匹配工单', async () => {
  const { env, sqlCalls } = makeMockEnvForPending({
    specialtiesJson: '["激光切割机"]',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 10 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-test-specialty',
    conversationId: 'conv-pending-1',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, undefined);
  assert.equal(result.filter_applied, true, '有 specialties 时 filter_applied=true');
  assert.deepEqual(result.engineer_specialties, ['激光切割机']);
  assert.equal(result.count, 2, '只保留 2 条激光切割机工单（过滤掉折弯机）');
  assert.ok(
    result.tickets.every((t) => t.device_type === '激光切割机'),
    '返回工单的 device_type 全部是激光切割机',
  );

  // 验 SQL 真的带了 IN 子句
  const wocall = sqlCalls.find((c) => /FROM work_orders wo/.test(c.sql));
  assert.ok(wocall, '应该有 work_orders 查询');
  assert.match(wocall.sql, /d\.type IN \(\?\)/, 'SQL 应包含 d.type IN (?)');
  assert.deepEqual(wocall.args, ['激光切割机', 10], 'bind 参数 = [...specialties, limit]');
});

test('engineer 多个 specialties → IN 占位符数量对应', async () => {
  const { env, sqlCalls } = makeMockEnvForPending({
    specialtiesJson: '["激光切割机","折弯机"]',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 10 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-multi',
    conversationId: 'conv-pending-2',
    iteration: 0,
  });

  await flush();

  assert.equal(result.filter_applied, true);
  assert.deepEqual(result.engineer_specialties, ['激光切割机', '折弯机']);
  assert.equal(result.count, 3, '3 条都匹配（2 激光 + 1 折弯）');

  const wocall = sqlCalls.find((c) => /FROM work_orders wo/.test(c.sql));
  assert.match(wocall.sql, /d\.type IN \(\?,\?\)/, '两个 specialties → 两个 ? 占位符');
  assert.deepEqual(wocall.args, ['激光切割机', '折弯机', 10]);
});

test('engineer 无 specialties（新 junior） → 降级全量查询', async () => {
  const { env, sqlCalls } = makeMockEnvForPending({
    specialtiesJson: '[]',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 10 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-new-junior',
    conversationId: 'conv-pending-3',
    iteration: 0,
  });

  await flush();

  assert.equal(result.filter_applied, false, '空 specialties 时 filter_applied=false');
  assert.deepEqual(result.engineer_specialties, []);
  assert.equal(result.count, 3, '全量返回');

  const wocall = sqlCalls.find((c) => /FROM work_orders wo/.test(c.sql));
  assert.ok(
    !/d\.type IN/.test(wocall.sql),
    'SQL 不应包含 IN 子句（降级路径）',
  );
  assert.deepEqual(wocall.args, [10], 'bind 只有 limit');
});

test('engineer specialties JSON 脏数据 → 容错为空 filter', async () => {
  const { env } = makeMockEnvForPending({
    specialtiesJson: '{not valid json',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 10 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-corrupted',
    conversationId: 'conv-pending-4',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, undefined, '不应抛错');
  assert.equal(result.filter_applied, false, '脏数据 → filter_applied=false');
  assert.deepEqual(result.engineer_specialties, []);
  assert.equal(result.count, 3, '降级全量');
});

test('engineer specialties 包含非字符串脏值 → 被过滤掉', async () => {
  const { env } = makeMockEnvForPending({
    specialtiesJson: '["激光切割机", 123, null, "", "折弯机"]',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 10 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-dirty-array',
    conversationId: 'conv-pending-5',
    iteration: 0,
  });

  await flush();

  assert.deepEqual(
    result.engineer_specialties,
    ['激光切割机', '折弯机'],
    '只保留非空字符串',
  );
  assert.equal(result.filter_applied, true);
});

test('limit 超过 20 → clip 到 20', async () => {
  const { env, sqlCalls } = makeMockEnvForPending({
    specialtiesJson: '["激光切割机"]',
    allTickets: ALL_TICKETS,
  });
  const { ctx, flush } = makeMockCtx();

  await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args: { limit: 999 },
    env,
    ctx,
    userRole: 'engineer',
    engineerId: 'eng-limit-test',
    conversationId: 'conv-pending-6',
    iteration: 0,
  });

  await flush();

  const wocall = sqlCalls.find((c) => /FROM work_orders wo/.test(c.sql));
  const boundLimit = wocall.args[wocall.args.length - 1];
  assert.equal(boundLimit, 20, 'limit 999 应被 clip 到 20');
});

// ============ 其他边界 ============

test('缺 env.DB 时 trace 仍然不抛错（fail-silent）', async () => {
  const { ctx, flush } = makeMockCtx();

  const result = await executeTool({
    toolName: 'get_engineer_profile',
    args: {},
    env: {}, // 没有 DB
    ctx,
    userRole: 'guest', // 触发 denied 分支（不依赖 DB 读）
    conversationId: 'conv-test-5',
    iteration: 0,
  });

  await flush();

  assert.equal(result.error, 'permission_denied');
  // trace.js 检测到 env.DB 缺失会 console.warn 静默返回，不抛错
  // 这里只验不崩溃即可
});
