#!/usr/bin/env node
/**
 * SAGEMRO Worker 冒烟测试脚本（上线前 / 生产验证）
 *
 * 用途：
 *   - 上线前对 production API 做一轮端到端健康检查
 *   - 覆盖 test-roles.sh 没覆盖的安全硬化项：限流、未授权访问、无效 token、CORS
 *
 * 用法：
 *   API_BASE=https://sagemro-api.lasersolutions4u.workers.dev node tests/smoke.mjs
 *   # 或：
 *   npm run test:smoke    # 需在 package.json 中注入 API_BASE
 *
 * 默认不修改数据库（只读 + 限流触发性请求）。不传 API_BASE 时会打印提示并退出。
 */

const API_BASE = process.env.API_BASE || '';
if (!API_BASE) {
  console.log('⚠️  未设置 API_BASE 环境变量，跳过冒烟测试');
  console.log('    用法: API_BASE=https://your-api.workers.dev node tests/smoke.mjs');
  process.exit(0);
}

const results = { pass: 0, fail: 0, skip: 0 };
const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', NC = '\x1b[0m';

async function check(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    const r = await fn();
    if (r === 'skip') {
      console.log(`${YELLOW}SKIP${NC}`);
      results.skip++;
    } else {
      console.log(`${GREEN}PASS${NC}`);
      results.pass++;
    }
  } catch (e) {
    console.log(`${RED}FAIL${NC} — ${e.message}`);
    results.fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(path, opts = {}) {
  const resp = await fetch(`${API_BASE}${path}`, opts);
  const text = await resp.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: resp.status, headers: resp.headers, body };
}

console.log(`\n=== SAGEMRO Worker Smoke Test ===`);
console.log(`Target: ${API_BASE}\n`);

// ============ 分组 1：基础可用性 ============
console.log('[1] 基础可用性');

await check('OPTIONS 预检请求返回 CORS 头', async () => {
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://sagemro.com' },
  });
  assert(resp.status === 200 || resp.status === 204, `OPTIONS 应返回 2xx，实际 ${resp.status}`);
  assert(resp.headers.get('access-control-allow-origin'), '缺少 Access-Control-Allow-Origin');
});

await check('未知路径返回 404', async () => {
  const { status } = await fetchJson('/api/this-route-does-not-exist');
  assert(status === 404, `应返回 404，实际 ${status}`);
});

// ============ 分组 2：认证强制 ============
console.log('\n[2] 认证强制');

await check('GET /api/workorders 无 token 返回 401', async () => {
  const { status } = await fetchJson('/api/workorders');
  assert(status === 401, `应返回 401，实际 ${status}`);
});

await check('GET /api/workorders 伪造 token 被拒', async () => {
  const { status } = await fetchJson('/api/workorders', {
    headers: { Authorization: 'Bearer this.is.not-a-real-jwt-token' },
  });
  assert(status === 401, `伪造 token 应被拒，实际 ${status}`);
});

await check('POST /api/engineers/tickets/:id/accept 无 token 返回 401', async () => {
  const { status } = await fetchJson('/api/engineers/tickets/fake-id/accept', { method: 'POST' });
  assert(status === 401, `应返回 401，实际 ${status}`);
});

// ============ 分组 3：输入校验 ============
console.log('\n[3] 输入校验');

await check('POST /api/auth/send-code 非法手机号被拒', async () => {
  const { status, body } = await fetchJson('/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: 'not-a-phone' }),
  });
  assert(status >= 400 && status < 500, `非法手机号应返回 4xx，实际 ${status} / ${JSON.stringify(body).slice(0, 100)}`);
});

await check('POST /api/auth/login 空 body 被拒', async () => {
  const { status } = await fetchJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert(status >= 400 && status < 500, `空 body 应返回 4xx，实际 ${status}`);
});

// ============ 分组 4：限流 ============
console.log('\n[4] 限流（上线后生效，本地/测试环境可能 skip）');

await check('验证码 60 秒内重复请求触发 429', async () => {
  // 用一个格式合法但不存在的测试手机号。第一次成功发送，60 秒内第二次应被限流。
  const phone = '13599990000'; // 用一个测试号段避免误触真实用户
  const send = async () => {
    return fetchJson('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
  };
  const r1 = await send();
  if (r1.status !== 200) {
    // 可能是上一轮测试残留的限流，直接第二次检查 429
    console.log(`\n    首次请求状态 ${r1.status}，直接检查第二次...`);
  }
  const r2 = await send();
  assert(r2.status === 429, `第二次请求应被限流（429），实际 ${r2.status} / ${JSON.stringify(r2.body).slice(0, 100)}`);
});

// ============ 分组 5：IDOR 防护（读路径全覆盖）============
console.log('\n[5] IDOR 防护（读路径全覆盖）');

const custToken = process.env.SMOKE_CUST_TOKEN;
const otherOrderId = process.env.SMOKE_OTHER_ORDER_ID;
const otherConvId = process.env.SMOKE_OTHER_CONV_ID;
const otherCustomerId = process.env.SMOKE_OTHER_CUSTOMER_ID;

function assertDenied(status) {
  assert(
    status === 401 || status === 403 || status === 404,
    `越权访问应返回 401/403/404，实际 ${status}`
  );
}

// 无 token 的情况（默认必跑）
await check('未登录不能读工单详情', async () => {
  const { status } = await fetchJson('/api/workorders/any-id');
  assertDenied(status);
});

await check('未登录不能读工单消息', async () => {
  const { status } = await fetchJson('/api/workorders/any-id/messages');
  assertDenied(status);
});

await check('未登录不能读工单核价', async () => {
  const { status } = await fetchJson('/api/workorders/any-id/pricing');
  assertDenied(status);
});

await check('未登录不能读对话详情', async () => {
  const { status } = await fetchJson('/api/conversations/any-id');
  assertDenied(status);
});

await check('未登录不能读客户工程师评价', async () => {
  const { status } = await fetchJson('/api/customers/any-id/reviews');
  assertDenied(status);
});

// 登录但访问他人资源（要求测试数据，否则 skip）
await check('客户不能访问他人工单详情', async () => {
  if (!custToken || !otherOrderId) return 'skip';
  const { status } = await fetchJson(`/api/workorders/${otherOrderId}`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assertDenied(status);
});

await check('客户不能访问他人工单消息', async () => {
  if (!custToken || !otherOrderId) return 'skip';
  const { status } = await fetchJson(`/api/workorders/${otherOrderId}/messages`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assertDenied(status);
});

await check('客户不能访问他人工单核价', async () => {
  if (!custToken || !otherOrderId) return 'skip';
  const { status } = await fetchJson(`/api/workorders/${otherOrderId}/pricing`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assertDenied(status);
});

await check('客户不能访问他人对话', async () => {
  if (!custToken || !otherConvId) return 'skip';
  const { status } = await fetchJson(`/api/conversations/${otherConvId}`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assertDenied(status);
});

await check('客户不能查看其他客户的工程师评价', async () => {
  if (!custToken || !otherCustomerId) return 'skip';
  const { status } = await fetchJson(`/api/customers/${otherCustomerId}/reviews`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  assertDenied(status);
});

await check('客户不能给他人工单提交评价', async () => {
  if (!custToken || !otherOrderId) return 'skip';
  const { status } = await fetchJson(`/api/workorders/${otherOrderId}/rating`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${custToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rating_timeliness: 5, rating_technical: 5, rating_communication: 5, rating_professional: 5,
    }),
  });
  assertDenied(status);
});

// ============ 汇总 ============
console.log(`\n=== Summary ===`);
console.log(`${GREEN}Pass:${NC} ${results.pass}`);
console.log(`${RED}Fail:${NC} ${results.fail}`);
console.log(`${YELLOW}Skip:${NC} ${results.skip}`);

if (results.fail > 0) {
  console.log(`\n${RED}✗ 有 ${results.fail} 项失败，上线前必须修复${NC}`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}✓ 全部通过${NC}`);
  process.exit(0);
}
