# SAGEMRO AI 进化架构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 SAGEMRO AI 从 Prompt OS 到 Knowledge OS 再到 Agent OS 的可持续进化链路。

**Architecture:** 先建立 AI Gateway、交互日志、评测集和反馈队列，再接入知识库和 RAG，最后扩大受控 Agent 工作流。所有写入型 Agent 动作必须保留人工确认和审计记录。

**Tech Stack:** Cloudflare Workers, D1, R2, KV, React admin, React customer portal, OpenAI-compatible Chat Completions API, GitHub Actions.

---

## 文件结构

- Modify: `worker/src/index.js`：新增 AI 交互日志、评测接口、反馈队列接口、知识库接口和工具审计。
- Create: `worker/migrations/0XX_ai_evolution_foundation.sql`：新增 AI 进化相关 D1 表。
- Create: `worker/tests/ai-evolution.test.mjs`：覆盖交互日志、反馈队列、评测用例和知识库基础逻辑。
- Modify: `worker/package.json`：加入新的单测文件。
- Modify: `admin/src/App.jsx` 或现有后台路由文件：增加 AI 改进队列、知识库和评测中心入口。
- Create: `admin/src/components/AiImprovementQueue.jsx`：后台 AI 改进队列。
- Create: `admin/src/components/AiKnowledgeBase.jsx`：后台知识库管理。
- Create: `admin/src/components/AiEvalCenter.jsx`：后台评测中心。
- Modify: `frontend/src/components/Chat/` 或现有聊天组件：增加用户对 AI 回复的轻反馈入口。
- Modify: `TECH-SPEC.md`：记录 AI 进化架构、数据表和部署注意事项。

## Task 1：D1 数据底座

**Files:**

- Create: `worker/migrations/0XX_ai_evolution_foundation.sql`
- Modify: `TECH-SPEC.md`

- [ ] **Step 1: 编写 migration**

创建以下表：

```sql
CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  user_id TEXT,
  user_type TEXT,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  intent TEXT,
  message TEXT NOT NULL,
  response TEXT,
  model TEXT,
  prompt_version TEXT,
  knowledge_version TEXT,
  response_time_ms INTEGER,
  created_work_order INTEGER DEFAULT 0,
  created_lead INTEGER DEFAULT 0,
  user_feedback TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_feedback_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  interaction_id TEXT,
  conversation_id TEXT,
  work_order_id TEXT,
  title TEXT NOT NULL,
  original_message TEXT,
  ai_response TEXT,
  human_correction TEXT,
  recommended_action TEXT,
  owner_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  applicable_equipment TEXT,
  applicable_brand TEXT,
  applicable_model TEXT,
  risk_level TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_eval_cases (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  category TEXT NOT NULL,
  user_message TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  must_include TEXT,
  must_not_include TEXT,
  should_create_work_order INTEGER DEFAULT 0,
  risk_level TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_eval_runs (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  prompt_version TEXT,
  knowledge_version TEXT,
  total_cases INTEGER NOT NULL,
  passed_cases INTEGER NOT NULL,
  failed_cases INTEGER NOT NULL,
  pass_rate REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_tool_traces (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  work_order_id TEXT,
  user_id TEXT,
  user_type TEXT,
  tool_name TEXT NOT NULL,
  tool_input TEXT,
  tool_output TEXT,
  allowed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: 本地执行 migration 测试**

Run:

```bash
cd worker
npx wrangler d1 migrations apply sagemro-db --local
```

Expected:

```text
Migrations applied successfully
```

- [ ] **Step 3: 更新 TECH-SPEC**

在 AI 配置章节后新增“AI 进化架构”小节，链接到：

```markdown
[docs/SAGEMRO-AI-进化架构蓝图.md](./docs/SAGEMRO-AI-进化架构蓝图.md)
```

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0XX_ai_evolution_foundation.sql TECH-SPEC.md
git commit -m "feat(ai): add evolution foundation schema"
```

## Task 2：AI 交互日志

**Files:**

- Modify: `worker/src/index.js`
- Create: `worker/tests/ai-evolution.test.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: 写失败测试**

在 `worker/tests/ai-evolution.test.mjs` 中测试：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { logAiInteraction } from '../src/index.js';

test('logAiInteraction stores market, locale, prompt version, and response metadata', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            calls.push({ sql, args });
            return { run: async () => ({ success: true }) };
          },
        };
      },
    },
  };

  await logAiInteraction(env, {
    id: 'ai-1',
    conversationId: 'conv-1',
    userId: 'customer-1',
    userType: 'customer',
    market: 'cn',
    locale: 'zh-CN',
    intent: 'cutting_parameters',
    message: '6000W 能切多厚？',
    response: '碳钢建议...',
    model: 'deepseek-chat',
    promptVersion: 'prompt-2026-06-19',
    knowledgeVersion: 'none',
    responseTimeMs: 1200,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO ai_interactions/);
  assert.equal(calls[0].args[3], 'customer');
  assert.equal(calls[0].args[4], 'cn');
  assert.equal(calls[0].args[5], 'zh-CN');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test:unit --prefix worker
```

Expected:

```text
The requested module '../src/index.js' does not provide an export named 'logAiInteraction'
```

- [ ] **Step 3: 实现 `logAiInteraction`**

在 `worker/src/index.js` 中导出：

```js
export async function logAiInteraction(env, payload) {
  if (!env?.DB || !payload?.message) return;
  await env.DB.prepare(`
    INSERT INTO ai_interactions (
      id, conversation_id, user_id, user_type, market, locale, intent,
      message, response, model, prompt_version, knowledge_version, response_time_ms,
      created_work_order, created_lead, user_feedback
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.id || generateId(),
    payload.conversationId || null,
    payload.userId || null,
    payload.userType || 'guest',
    payload.market || 'com',
    payload.locale || 'en',
    payload.intent || null,
    payload.message,
    payload.response || null,
    payload.model || null,
    payload.promptVersion || null,
    payload.knowledgeVersion || null,
    payload.responseTimeMs || null,
    payload.createdWorkOrder ? 1 : 0,
    payload.createdLead ? 1 : 0,
    payload.userFeedback || null,
  ).run();
}
```

- [ ] **Step 4: 在聊天完成后调用日志**

在 `handleChat` 完成 AI 回复并保存 message 后调用 `logAiInteraction`，写入 market、locale、intent、模型、响应耗时和是否创建工单。

- [ ] **Step 5: 运行测试**

Run:

```bash
npm run test:unit --prefix worker
```

Expected:

```text
pass 177
fail 0
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.js worker/tests/ai-evolution.test.mjs worker/package.json
git commit -m "feat(ai): log chat interactions for learning loop"
```

## Task 3：AI 反馈队列 API

**Files:**

- Modify: `worker/src/index.js`
- Modify: `worker/tests/ai-evolution.test.mjs`

- [ ] **Step 1: 写失败测试**

测试客户可以提交 AI 回复反馈，管理员可以读取反馈列表。

- [ ] **Step 2: 新增接口**

```text
POST /api/ai/feedback
GET  /api/admin/ai/feedback
PATCH /api/admin/ai/feedback/:id
```

权限：

- `POST /api/ai/feedback`：访客和登录客户均可提交，但要限长和脱敏。
- `GET /api/admin/ai/feedback`：仅 admin。
- `PATCH /api/admin/ai/feedback/:id`：仅 admin。

- [ ] **Step 3: 运行测试**

Run:

```bash
npm run test:unit --prefix worker
```

Expected:

```text
fail 0
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js worker/tests/ai-evolution.test.mjs
git commit -m "feat(ai): add feedback improvement queue api"
```

## Task 4：知识库管理 API

**Files:**

- Modify: `worker/src/index.js`
- Modify: `worker/tests/ai-evolution.test.mjs`

- [ ] **Step 1: 写失败测试**

覆盖：

- admin 可以创建 draft 知识条目。
- admin 可以审核发布知识条目。
- 非 admin 不能写入知识库。
- 已发布知识可以按 market、locale、category 查询。

- [ ] **Step 2: 新增接口**

```text
GET    /api/admin/knowledge
POST   /api/admin/knowledge
PATCH  /api/admin/knowledge/:id
GET    /api/knowledge/search
```

- [ ] **Step 3: 运行测试**

Run:

```bash
npm run test:unit --prefix worker
```

Expected:

```text
fail 0
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js worker/tests/ai-evolution.test.mjs
git commit -m "feat(ai): add managed knowledge base api"
```

## Task 5：本地评测中心

**Files:**

- Create: `worker/tests/ai-eval-cases.json`
- Create: `worker/tests/ai-eval-runner.mjs`
- Modify: `worker/package.json`

- [ ] **Step 1: 创建第一批评测用例**

至少包含：

- 10 条中文简单问题，不应推服务申请。
- 10 条中文服务问题，应该引导服务申请。
- 10 条英文问题，必须英文回答。
- 10 条安全风险问题，必须安全提醒。

- [ ] **Step 2: 创建 runner**

Runner 先使用规则评测，不调用真实模型：

- 检查输出语言。
- 检查 forbidden words。
- 检查 service CTA 是否符合 expected。
- 检查安全问题是否包含安全提醒。

- [ ] **Step 3: 加入 npm script**

```json
"test:ai-eval": "node tests/ai-eval-runner.mjs"
```

- [ ] **Step 4: 运行评测**

Run:

```bash
npm run test:ai-eval --prefix worker
```

Expected:

```text
AI eval pass rate: 100%
```

- [ ] **Step 5: Commit**

```bash
git add worker/tests/ai-eval-cases.json worker/tests/ai-eval-runner.mjs worker/package.json
git commit -m "test(ai): add behavior eval harness"
```

## Task 6：后台 AI 改进队列

**Files:**

- Create: `admin/src/components/AiImprovementQueue.jsx`
- Modify: admin existing API client and navigation files.

- [ ] **Step 1: 写前端测试或静态 smoke**

如果 admin 当前没有前端测试框架，新增最小静态测试，检查组件包含：

- AI 改进队列标题。
- 来源。
- 严重程度。
- 状态。
- 人工修正。
- 推荐动作。

- [ ] **Step 2: 实现组件**

页面功能：

- 列表。
- 状态筛选。
- 严重程度筛选。
- 查看原始问题和 AI 回复。
- 填写人工修正。
- 修改处理状态。

- [ ] **Step 3: 构建后台**

Run:

```bash
npm run build --prefix admin
```

Expected:

```text
✓ built
```

- [ ] **Step 4: Commit**

```bash
git add admin/src
git commit -m "feat(admin): add AI improvement queue"
```

## Task 7：后台知识库管理

**Files:**

- Create: `admin/src/components/AiKnowledgeBase.jsx`
- Modify: admin navigation and API client.

- [ ] **Step 1: 实现列表和编辑**

功能：

- 查看知识条目。
- 新建 draft。
- 编辑适用设备、品牌、型号、风险等级。
- 提交审核。
- 发布和下线。

- [ ] **Step 2: 构建后台**

Run:

```bash
npm run build --prefix admin
```

Expected:

```text
✓ built
```

- [ ] **Step 3: Commit**

```bash
git add admin/src
git commit -m "feat(admin): add AI knowledge base management"
```

## Task 8：客户侧 AI 反馈

**Files:**

- Modify: `frontend/src/components/Chat/` or current chat message component.
- Modify: frontend API client.

- [ ] **Step 1: 增加轻反馈**

每条 AI 回复下方提供：

- 有帮助。
- 没解决。
- 需要人工确认。

- [ ] **Step 2: 调用反馈 API**

提交内容：

```json
{
  "conversation_id": "xxx",
  "message_id": "xxx",
  "feedback": "helpful | unresolved | needs_human",
  "note": "optional"
}
```

- [ ] **Step 3: 测试与构建**

Run:

```bash
npm test --prefix frontend
npm run build:cn --prefix frontend
```

Expected:

```text
fail 0
✓ built
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add AI answer feedback"
```

## Task 9：RAG 只读检索工具

**Files:**

- Modify: `worker/src/index.js`
- Modify: `worker/tests/execute-tool.test.mjs`
- Modify: `worker/tests/chat-access.test.mjs`

- [ ] **Step 1: 新增工具 schema**

新增：

```text
search_knowledge_base
```

参数：

```json
{
  "market": "cn | com",
  "locale": "zh-CN | en",
  "category": "fault | cutting_parameters | parts | maintenance | machine_selection | health",
  "query": "string"
}
```

- [ ] **Step 2: 工具实现**

先用 D1 `LIKE` 检索已发布知识条目，后续再替换向量检索。

- [ ] **Step 3: Prompt 接入**

要求 AI：

- 专业问题优先查知识库。
- 只把已发布知识作为依据。
- 区分“知识库依据”和“经验建议”。

- [ ] **Step 4: 测试**

Run:

```bash
npm run test:unit --prefix worker
```

Expected:

```text
fail 0
```

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/tests
git commit -m "feat(ai): add knowledge base retrieval tool"
```

## Task 10：部署与生产烟测

**Files:**

- Modify: `DEPLOY.md`

- [ ] **Step 1: 更新部署文档**

注明：

- 新增 migration 必须先手动应用到生产 D1。
- AI eval 必须在部署前通过。
- 知识库初期为 D1 检索，向量检索是后续增强。

- [ ] **Step 2: 运行完整验证**

Run:

```bash
npm test --prefix frontend
npm run build:cn --prefix frontend
npm run test:unit --prefix worker
npm run test:ai-eval --prefix worker
```

Expected:

```text
all pass
```

- [ ] **Step 3: Commit**

```bash
git add DEPLOY.md
git commit -m "docs(ai): document evolution deployment gates"
```

## 自检清单

- [ ] 所有写入型 AI 动作必须有人确认。
- [ ] 所有新增 API 都有权限控制。
- [ ] 简单问题不强推服务申请。
- [ ] 高风险问题必须安全提醒。
- [ ] 中文站默认中文，国际站默认英文。
- [ ] 知识库条目必须可审核、可下线、可版本化。
- [ ] AI 评测失败不得部署。
- [ ] 新增 migration 已在生产部署前手动执行。

