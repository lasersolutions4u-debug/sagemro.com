// Golden-set eval harness (Phase 0.6)
//
// 运行方式：
//   cd worker
//   node tests/eval-harness.mjs
//   或：npm run test:golden
//
// 读取 tests/golden-set.json 的 30 个用例，按 category 分发执行：
//   - role_guard         → executeTool + 断言 error / ok / fallback
//   - redact             → redactPII + 断言 output / contains / not_contains
//   - specialties_filter → executeTool（带自定义 mock env）+ 断言
//                          filter_applied / engineer_specialties /
//                          matches_device_types / count / bound_limit
//
// 退出码：全通过 0，有失败 1，harness 本身崩溃 2（供 CI gate）

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { executeTool } from '../src/index.js';
import { redactPII } from '../src/lib/redact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, 'golden-set.json');
const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8'));

// ============ 通用 mock 基建 ============

function makeCtx() {
  return { waitUntil: () => {} };
}

/**
 * 面向 role_guard 类的通用 mock env：
 *   - 覆盖 executeTool 里所有被 role_guard 允许通过的工具最小路径
 *   - 被拒的 case 根本不会走到 DB，无需精细 mock
 *   - ai_trace_logs 写入静默吞
 */
function makeGenericEnv() {
  const DB = {
    prepare(sql) {
      const stmt = {
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          // get_engineer_profile: engineer 主表
          if (/FROM engineers WHERE id/.test(sql)) {
            return {
              name: '测试工程师',
              phone: '13800000001',
              specialties: '["激光切割机"]',
              brands: '{}',
              services: '[]',
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
          // get_engineer_profile: 本月统计 / 处理中工单
          if (/COUNT\(\*\) as cnt/.test(sql)) {
            return { cnt: 0, earnings: 0 };
          }
          // get_pending_tickets_for_engineer: engineer specialties 单独查询
          if (/SELECT specialties FROM engineers WHERE id/.test(sql)) {
            return { specialties: '[]' };
          }
          return null;
        },
        async all() {
          // get_customer_devices
          if (/FROM devices d[\s\S]*LEFT JOIN work_orders/.test(sql)) {
            return { results: [] };
          }
          // get_pending_tickets_for_engineer: 工单表
          if (/FROM work_orders wo/.test(sql)) {
            return { results: [] };
          }
          return { results: [] };
        },
        async run() {
          // ai_trace_logs / 其他写入 —— 静默
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return { DB };
}

/**
 * 专为 specialties_filter 类定制的 mock env：
 *   - engineers.specialties 返回 input 指定的 JSON 字符串
 *   - work_orders 查询根据 IN 子句过滤 available_types 构造出的 tickets
 *   - 捕获所有 SQL 调用供 bound_limit 断言
 */
function makeSpecialtiesEnv({ specialtiesJson, availableTypes, engineerNotFound }) {
  const sqlCalls = [];

  // 基于 availableTypes 构造工单池（每种 type 一条工单）
  const tickets = availableTypes.map((type, i) => ({
    id: `wo-${i + 1}`,
    order_no: `WO-GOLDEN-${String(i + 1).padStart(3, '0')}`,
    type: 'fault',
    description: `test ${type}`,
    urgency: 'normal',
    created_at: '2026-04-22 10:00:00',
    device_type: type,
    device_brand: '测试品牌',
    device_model: 'TEST-001',
    customer_name: '测试客户',
  }));

  const DB = {
    prepare(sql) {
      const stmt = {
        _args: [],
        bind(...args) {
          this._args = args;
          sqlCalls.push({ sql, args });
          return this;
        },
        async first() {
          if (/SELECT specialties FROM engineers WHERE id/.test(sql)) {
            if (engineerNotFound) return null;
            return { specialties: specialtiesJson };
          }
          return null;
        },
        async all() {
          if (/FROM work_orders wo/.test(sql)) {
            const inMatch = sql.match(/d\.type IN \(([^)]+)\)/);
            if (inMatch) {
              const boundLimit = this._args[this._args.length - 1];
              const types = this._args.slice(0, -1);
              return {
                results: tickets
                  .filter((t) => types.includes(t.device_type))
                  .slice(0, boundLimit),
              };
            }
            const boundLimit = this._args[0];
            return { results: tickets.slice(0, boundLimit) };
          }
          return { results: [] };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };

  return { env: { DB }, sqlCalls };
}

/**
 * 专为 conversation_history 类定制的 mock env：
 *   - 匹配 SELECT ... FROM conversation_summaries cs JOIN conversations c 查询，
 *     返回 summaries_mock 里的每条记录（summary_json 由 mock.summary 序列化）
 *   - ai_trace_logs 等写入静默
 */
function makeConversationHistoryEnv({ summariesMock }) {
  const rows = (summariesMock || []).map((s, i) => ({
    id: `sum-${i + 1}`,
    conversation_id: s.conversation_id,
    summary_json: JSON.stringify(s.summary),
    generated_at: s.generated_at,
    source_message_count: s.source_message_count ?? 6,
    conversation_created_at: s.conversation_created_at ?? s.generated_at,
  }));

  const DB = {
    prepare(sql) {
      const stmt = {
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async first() {
          return null;
        },
        async all() {
          if (/FROM conversation_summaries cs/.test(sql)) {
            const limit = this._args[this._args.length - 1] || rows.length;
            return { results: rows.slice(0, limit) };
          }
          return { results: [] };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
  return { DB };
}

// ============ 四种 category 的 runner ============

async function runRoleGuard(cas) {
  const { tool, args, user_role, engineer_id, customer_id } = cas.input;
  const env = makeGenericEnv();

  const result = await executeTool({
    toolName: tool,
    args: args || {},
    env,
    ctx: makeCtx(),
    userRole: user_role,
    engineerId: engineer_id ?? null,
    customerId: customer_id ?? null,
    conversationId: `golden-${cas.id}`,
    iteration: 0,
  });

  if (cas.expect.error) {
    if (result.error !== cas.expect.error) {
      return {
        pass: false,
        reason: `expected error="${cas.expect.error}", got ${JSON.stringify(result.error)}`,
      };
    }
    if (cas.expect.fallback_contains) {
      const fb = result.fallback_instruction || '';
      if (!fb.includes(cas.expect.fallback_contains)) {
        return {
          pass: false,
          reason: `fallback_instruction missing "${cas.expect.fallback_contains}" (got: ${JSON.stringify(fb).slice(0, 120)})`,
        };
      }
    }
    return { pass: true };
  }

  if (cas.expect.ok) {
    if (result.error) {
      return {
        pass: false,
        reason: `expected ok, got error="${result.error}"`,
      };
    }
    return { pass: true };
  }

  return { pass: false, reason: 'no expect.error or expect.ok specified' };
}

async function runRedact(cas) {
  const output = redactPII(cas.input.text);

  if ('output' in cas.expect) {
    if (output === cas.expect.output) return { pass: true };
    return {
      pass: false,
      reason: `expected ${JSON.stringify(cas.expect.output)}, got ${JSON.stringify(output)}`,
    };
  }

  if (cas.expect.output_contains) {
    for (const needle of cas.expect.output_contains) {
      if (!output.includes(needle)) {
        return {
          pass: false,
          reason: `missing "${needle}" in ${JSON.stringify(output)}`,
        };
      }
    }
  }
  if (cas.expect.output_not_contains) {
    for (const needle of cas.expect.output_not_contains) {
      if (output.includes(needle)) {
        return {
          pass: false,
          reason: `should NOT contain "${needle}" in ${JSON.stringify(output)}`,
        };
      }
    }
  }
  return { pass: true };
}

async function runSpecialtiesFilter(cas) {
  const { engineer_specialties_json, available_types, limit, no_engineer_id } = cas.input;

  // 特殊标记处理
  const engineerNotFound = engineer_specialties_json === '__NOT_FOUND__';
  // null / '__NOT_FOUND__' → engineer row 不存在
  // 否则作为 specialties 字段原文返回
  const specialtiesJson =
    engineer_specialties_json === null || engineerNotFound
      ? null
      : engineer_specialties_json;

  const { env, sqlCalls } = makeSpecialtiesEnv({
    specialtiesJson,
    availableTypes: available_types || [],
    engineerNotFound: engineerNotFound || engineer_specialties_json === null,
  });

  const args = {};
  if (limit !== undefined && limit !== null) args.limit = limit;

  const result = await executeTool({
    toolName: 'get_pending_tickets_for_engineer',
    args,
    env,
    ctx: makeCtx(),
    userRole: 'engineer',
    engineerId: no_engineer_id ? null : 'eng-golden',
    conversationId: `golden-${cas.id}`,
    iteration: 0,
  });

  // no_engineer_id 场景：executeTool 入口前会被 role_guard 放行，
  // toolGetPendingTickets 内部检测到 engineerId 缺失 → 降级全量
  if (result.error) {
    return {
      pass: false,
      reason: `tool errored: ${result.error} (fallback_instruction=${result.fallback_instruction})`,
    };
  }

  const failures = [];

  if ('filter_applied' in cas.expect) {
    if (result.filter_applied !== cas.expect.filter_applied) {
      failures.push(
        `filter_applied: want ${cas.expect.filter_applied}, got ${result.filter_applied}`,
      );
    }
  }

  if ('engineer_specialties' in cas.expect) {
    const got = result.engineer_specialties || [];
    const want = cas.expect.engineer_specialties;
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(
        `engineer_specialties: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
      );
    }
  }

  if ('matches_device_types' in cas.expect) {
    const got = (result.tickets || []).map((t) => t.device_type);
    const want = cas.expect.matches_device_types;
    const gotSet = new Set(got);
    const wantSet = new Set(want);
    const sameSize = gotSet.size === wantSet.size;
    const sameElements = [...wantSet].every((t) => gotSet.has(t));
    if (!sameSize || !sameElements) {
      failures.push(
        `matches_device_types: want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
      );
    }
  }

  if ('count' in cas.expect) {
    if (result.count !== cas.expect.count) {
      failures.push(`count: want ${cas.expect.count}, got ${result.count}`);
    }
  }

  if ('bound_limit' in cas.expect) {
    const wocall = sqlCalls.find((c) => /FROM work_orders wo/.test(c.sql));
    if (!wocall) {
      failures.push('bound_limit: no work_orders SQL call captured');
    } else {
      const boundLimit = wocall.args[wocall.args.length - 1];
      if (boundLimit !== cas.expect.bound_limit) {
        failures.push(
          `bound_limit: want ${cas.expect.bound_limit}, got ${boundLimit}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    return { pass: false, reason: failures.join('; ') };
  }
  return { pass: true };
}

async function runConversationHistory(cas) {
  const { user_role, customer_id, engineer_id, args, summaries_mock } = cas.input;

  const env = makeConversationHistoryEnv({ summariesMock: summaries_mock || [] });

  const result = await executeTool({
    toolName: 'get_conversation_history',
    args: args || {},
    env,
    ctx: makeCtx(),
    userRole: user_role,
    engineerId: engineer_id ?? null,
    customerId: customer_id ?? null,
    conversationId: `golden-${cas.id}`,
    iteration: 0,
  });

  if (result.error) {
    return {
      pass: false,
      reason: `tool errored: ${result.error}`,
    };
  }

  const failures = [];

  if ('count' in cas.expect) {
    if (result.count !== cas.expect.count) {
      failures.push(`count: want ${cas.expect.count}, got ${result.count}`);
    }
  }

  if ('filter_applied' in cas.expect) {
    if (result.filter_applied !== cas.expect.filter_applied) {
      failures.push(
        `filter_applied: want ${cas.expect.filter_applied}, got ${result.filter_applied}`,
      );
    }
  }

  if ('summaries_length' in cas.expect) {
    const got = (result.summaries || []).length;
    if (got !== cas.expect.summaries_length) {
      failures.push(
        `summaries.length: want ${cas.expect.summaries_length}, got ${got}`,
      );
    }
  }

  if ('pending_items_prefix' in cas.expect) {
    const prefix = cas.expect.pending_items_prefix;
    const matches = (result.open_pending_items || []).filter((p) =>
      typeof p?.item === 'string' && p.item.startsWith(prefix),
    );
    if (matches.length === 0) {
      failures.push(
        `open_pending_items: no entry starts with "${prefix}" (got ${JSON.stringify(result.open_pending_items)})`,
      );
    }
    if ('pending_items_min_count' in cas.expect) {
      if (matches.length < cas.expect.pending_items_min_count) {
        failures.push(
          `open_pending_items prefix "${prefix}": want >=${cas.expect.pending_items_min_count}, got ${matches.length}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    return { pass: false, reason: failures.join('; ') };
  }
  return { pass: true };
}

// ============ 主流程 ============

async function main() {
  const results = [];
  for (const cas of golden.cases) {
    let outcome;
    try {
      if (cas.category === 'role_guard') outcome = await runRoleGuard(cas);
      else if (cas.category === 'redact') outcome = await runRedact(cas);
      else if (cas.category === 'specialties_filter')
        outcome = await runSpecialtiesFilter(cas);
      else if (cas.category === 'conversation_history')
        outcome = await runConversationHistory(cas);
      else outcome = { pass: false, reason: `unknown category: ${cas.category}` };
    } catch (err) {
      outcome = {
        pass: false,
        reason: `threw: ${err.message}\n${err.stack?.split('\n').slice(0, 3).join('\n')}`,
      };
    }
    results.push({ ...cas, ...outcome });
  }

  // 按 category 聚合
  const byCat = new Map();
  for (const r of results) {
    if (!byCat.has(r.category)) byCat.set(r.category, { pass: 0, fail: 0, total: 0 });
    const s = byCat.get(r.category);
    s.total++;
    if (r.pass) s.pass++;
    else s.fail++;
  }

  console.log('');
  console.log('=== Golden set eval (Phase 0.6) ===');
  console.log(`source: ${GOLDEN_PATH}`);
  console.log(`version: ${golden.version}`);
  console.log('');

  for (const [cat, s] of byCat) {
    const icon = s.fail === 0 ? '✓' : '✗';
    console.log(`  ${icon}  ${cat.padEnd(20)}  ${s.pass}/${s.total}`);
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.log('');
    console.log('--- Failed cases ---');
    for (const r of failed) {
      console.log(`  [${r.id}] ${r.description}`);
      console.log(`      → ${r.reason}`);
    }
  }

  const total = results.length;
  const passed = total - failed.length;
  console.log('');
  console.log(`Total: ${passed}/${total}  (${failed.length} failed)`);

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Harness crashed:', err);
  console.error(err.stack);
  process.exit(2);
});
