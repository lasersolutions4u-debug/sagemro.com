# SummaryProtocol v1 提案

> 创建时间：2026-04-22
> 最后更新：2026-04-22（决策点全部锁定）
> 目的：为 Phase 1 跨会话记忆（`get_conversation_history` 工具）提供结构化摘要协议
> 状态：**✅ 评审通过，决议已锁定；待 Phase 0 完成后即可进入 Phase 1 编码**

---

## 一、背景与问题

### 1.1 当前状态

`conversations` 表（schema.sql:25-32）只存 `id / title / last_message / customer_id / created_at / updated_at`。

`messages` 表按 `conversation_id` 存原始消息。

**没有摘要字段。** Phase 1 设计 `get_conversation_history` 工具时若直接把 messages 塞给 AI：
- 工业对话动辄 20-50 轮，Token 爆炸
- 礼貌用语（"好的"、"谢谢"、"请稍等"）占比 30%+，稀释关键信号
- AI 无法按字段检索（比如"这个客户过去问过 3000W 激光机的 FAQ 吗？"）

### 1.2 为什么不能用通用摘要

`gpt-4o-mini` 默认摘要会产出："客户咨询了激光切割设备的毛刺问题，AI 给出了建议。" —— 这种摘要毫无 retrieval 价值。

**核心洞察**：B2B 工业场景里，"3000W 光纤 + 6mm 碳钢 + 挂渣" 这种**型号 + 参数 + 症状**三元组，才是真正可被 RAG 检索、可被 Agent 做相似案例匹配的信号。

---

## 二、设计原则

| 原则 | 说明 |
|---|---|
| **JSON over Markdown** | 摘要必须是结构化 JSON，不是自由文本。否则 Phase 3 FTS5/向量检索无法按字段命中 |
| **版本化** | 必须有 `protocol_version` 字段。协议一定会迭代，老数据不能因新字段破坏 |
| **字段稀疏可选** | 非设备/维修场景（钱包查询、投诉、日常闲聊）也能用，不能强制 device 字段 |
| **轻量生成** | 用 `gpt-4o-mini` + JSON mode，成本可忽略，延迟走 `ctx.waitUntil()` 异步 |
| **可回退** | JSON 解析失败时 fallback 为 `{"protocol_version": 1, "raw_text": "..."}`，不能炸主流程 |

---

## 三、v1 Schema（提案）

### 3.1 主 Schema（设备/维修场景）

```json
{
  "protocol_version": 1,
  "conversation_type": "device_consult | repair_request | pricing | rating_complaint | wallet_query | post_sale_followup | onboarding | general",
  "summary_text": "一句话总结（≤120字，给人看）",

  "device": {
    "type": "激光切割机",
    "brand": "大族",
    "model": "G3015",
    "power": "3000W",
    "material": "6mm碳钢"
  },

  "fault_keywords": ["挂渣", "毛刺", "断面纹路异常"],

  "intent": "咨询 | 报修 | 议价 | 评价 | 投诉 | 其他",

  "pending_items": [
    "[missing_info] 客户未提供材料牌号",
    "[awaiting_confirmation] AI 建议调整气压但未确认是否执行",
    "[followup_due] 推荐了张工程师但客户未回复"
  ],

  "sentiment": "neutral | satisfied | complaint | urgent",

  "referenced_ids": {
    "work_order_ids": ["WO-20260415-001"],
    "engineer_ids": [],
    "device_ids": ["dev-abc123"]
  },

  "generated_at": "2026-04-22T14:30:00Z",
  "source_message_count": 18
}
```

### 3.2 Fallback Schema（非设备场景）

比如合伙人查钱包、客户问"怎么注册"这类场景：

```json
{
  "protocol_version": 1,
  "conversation_type": "wallet_query",
  "summary_text": "合伙人查询本月收入，AI 返回 ¥8,200，3 笔待结算",
  "intent": "咨询",
  "sentiment": "neutral",
  "generated_at": "2026-04-22T14:30:00Z",
  "source_message_count": 4
}
```

**关键**：除 `protocol_version / conversation_type / summary_text / generated_at / source_message_count` 外，所有字段**可选**。空对话也能合法。

### 3.3 解析失败 Fallback

```json
{
  "protocol_version": 1,
  "conversation_type": "general",
  "summary_text": "[自动摘要失败，已保留原文前500字]",
  "raw_text_preview": "...",
  "generation_error": "json_parse_failed",
  "generated_at": "2026-04-22T14:30:00Z"
}
```

---

## 四、生成管线

### 4.1 触发时机

**✅ 决议：策略 B（阈值触发）**

| 策略 | 触发点 | 采纳 |
|---|---|---|
| A. 每轮触发 | 用户每次发消息后 | ❌ |
| **B. 阈值触发** | **累计消息 ≥ 6 条 且 距上次摘要 ≥ 3 条** | **✅ 采纳** |
| C. 关闭时触发 | 会话 updated_at 超过 30 分钟无新消息时（cron） | ❌ |

**实现细节**：
- 触发判断写在 `handleChat` 写入 assistant 消息之后
- 查询 `conversations.summary_message_count` 与当前 `messages` 总数差值 ≥ 3 且总数 ≥ 6 时入队
- 入队后用 `ctx.waitUntil(generateSummary(...))` 异步跑，不阻塞 SSE

### 4.2 生成调用

- 模型：`gpt-4o-mini`（成本 ~$0.15/1M input tokens）
- 模式：JSON mode（`response_format: { type: "json_object" }`）
- 输入：最近 N 轮原始消息（N=20，按 token 截断到 3K）+ SummaryProtocol 生成指令
- 输出：严格按上述 Schema 的 JSON
- 失败重试：1 次，仍失败则写 fallback schema
- 写入：`ctx.waitUntil()` 异步，不阻塞用户 SSE 响应

### 4.3 Token 预算

- 单次摘要生成：~3K input + 0.3K output = ~$0.0005
- 假设 1000 会话/天 × 每会话 3 次触发 = 3000 次/天 = **$1.5/天 = $45/月**
- Phase 1 可接受。上规模后转 B 策略+缓存可降到 $10/月

---

## 五、存储方案

### 5.1 Migration 014

**✅ 决议：独立 `conversation_summaries` 表（选项 B）**

```sql
-- 独立摘要表：支持历史版本 + 协议迭代并存
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    protocol_version INTEGER NOT NULL DEFAULT 1,
    summary_json TEXT NOT NULL,
    source_message_count INTEGER NOT NULL,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- 查询最新摘要常用：conversation_id + generated_at DESC
CREATE INDEX IF NOT EXISTS idx_conv_summaries_conv
  ON conversation_summaries(conversation_id, generated_at DESC);

-- conversations 表仍需加一个计数字段，用于阈值触发判断
ALTER TABLE conversations ADD COLUMN summary_message_count INTEGER DEFAULT 0;
```

**消费侧查询范式**：

```sql
-- 按客户取最近 5 次会话的最新摘要
SELECT cs.summary_json, cs.generated_at, c.id AS conv_id
FROM conversations c
JOIN conversation_summaries cs
  ON cs.conversation_id = c.id
  AND cs.id = (
    SELECT id FROM conversation_summaries
    WHERE conversation_id = c.id
    ORDER BY generated_at DESC LIMIT 1
  )
WHERE c.customer_id = ?
ORDER BY c.updated_at DESC
LIMIT 5;
```

---

## 六、`get_conversation_history` 工具消费方式

```js
// 伪代码：Phase 1 新增工具
{
  name: "get_conversation_history",
  description: "查询当前客户/合伙人最近 N 个会话的结构化摘要",
  parameters: {
    limit: { type: "number", default: 5 },
    filter_conversation_type: { type: "string", optional: true },  // 比如只要 repair_request
    filter_device_type: { type: "string", optional: true }          // 比如只要激光切割机
  }
}

// 返回：
{
  "summaries": [
    { protocol_version: 1, conversation_type: "repair_request", device: {...}, ... },
    ...
  ],
  "total_conversations_matched": 3
}
```

AI 拿到这组 summaries 就能说："您上个月问过 3000W 光纤激光机切 6mm 碳钢挂渣的问题，当时建议您调整辅助气压，这次还是同一症状吗？"

---

## 七、版本升级策略

### 7.1 加字段（v1 → v2 兼容）

新增可选字段 → 读取代码用 `?.` 即可，老数据继续读作 v1。

### 7.2 改字段语义（v1 → v2 破坏性）

必须 bump `protocol_version` 到 2。消费端按 version 分支处理：

```js
if (summary.protocol_version === 1) { /* 老读法 */ }
else if (summary.protocol_version === 2) { /* 新读法 */ }
```

后台可选：异步批量重新生成 v1 → v2（再调一次 mini）。

### 7.3 强制：不允许 in-place 修改已存 summary

老摘要是对当时对话的快照，修改会破坏溯源。需要"刷新"就再生成一条新记录（`conversation_summaries` 表方案天然支持）。

---

## 八、风险与权衡

| 风险 | 应对 |
|---|---|
| JSON mode 偶发格式错误 | 1 次重试 + fallback schema，不炸主流程 |
| 摘要漏关键信息（hallucination） | Phase 0 golden set 里加 5 条"摘要质量"测例 |
| 敏感信息进摘要（手机号、地址） | Phase 0 的脱敏正则在**生成摘要前**先清洗原文 |
| 成本失控 | 策略 B + 监控 trace 表里 summary 生成次数，超阈值降级到 C |
| 老会话没有摘要 | `get_conversation_history` 遇到空摘要时触发懒生成，或 fallback 返回 `last_message` |
| 用户改了设备信息，老摘要 device 字段过期 | 摘要是时间快照，不修正。消费端排序拿最新的 |

---

## 九、决议记录（2026-04-22 锁定）

| # | 议题 | 决议 |
|---|---|---|
| 1 | `conversation_type` 枚举 | **加 `post_sale_followup`（售后回访）+ `onboarding`（新合伙人入驻指引）**。完整枚举见 3.1 节 |
| 2 | 触发策略 | **策略 B（阈值触发）**：累计消息 ≥ 6 且距上次 ≥ 3 |
| 3 | 存储方案 | **选项 B：独立 `conversation_summaries` 表** + conversations 加 `summary_message_count` 计数字段 |
| 4 | 脱敏时机 | **生成摘要前**清洗原文（更安全；接受可能的摘要质量微损） |
| 5 | `summary_text` 长度 | **≤120 字**（给 AI 空间写清场景） |
| 6 | 老会话处理 | **不做懒生成**。Phase 1 只管新数据；老数据用独立的 `migrate_summaries.mjs` 脚本深夜手动刷一次（详见第 12 节） |

### 9.1 `pending_items` 的业务价值与 Role Prompt 注入 ⭐ 关键洞察

`pending_items` 是协议里最亮眼的字段——它让 AI 从"记得"升级为**"跟进业务流程"**。

**Phase 1 的 Role Prompt（所有角色）必须新增以下指令**：

```
如果 conversation_history 工具返回的摘要中存在 pending_items（形如 [missing_info] ... /
[awaiting_confirmation] ... / [followup_due] ...），请在本次对话开口时优先引导用户补齐
或跟进这些项，而不是泛泛地问"有什么可以帮你的"。

例子：
- 上次留下 [missing_info] 客户未提供材料牌号 → 本次开口："您上次咨询的那台 3000W 激光机
  切挂渣问题，还没提到具体的材料牌号，是 Q235 还是不锈钢？"
- 上次留下 [awaiting_confirmation] AI 建议调整气压但未确认 → 本次开口："上次建议把辅助
  气压调到 0.8MPa，后来调了吗？效果怎么样？"
- 上次留下 [followup_due] 推荐了张工程师但客户未回复 → 本次开口："之前给您推荐了张师傅
  处理折弯机的问题，还需要联系安排上门吗？"

完成一个 pending_item 后，在心里记住它已闭环；下次摘要生成时会自然不再出现。
```

**为什么这条指令价值高**：
- 客户感知：从"AI 助手"升级为"业务管家"
- 业务效果：降低客户流失（未跟进的咨询是沉默流失源）
- 合伙人端同理：推荐给合伙人的工单如果合伙人没响应，AI 下次开口主动问

### 9.2 `pending_items` 前缀约定

为了让 AI 和下游代码能快速扫描，`pending_items` 每条都以方括号前缀标签打头：

| 前缀 | 含义 | 典型例子 |
|---|---|---|
| `[missing_info]` | 客户/合伙人没提供必要信息 | `[missing_info] 客户未提供材料牌号` |
| `[awaiting_confirmation]` | AI 给了建议但未确认结果 | `[awaiting_confirmation] 建议调整气压至 0.8MPa，未确认` |
| `[followup_due]` | 推了下一步但未闭环 | `[followup_due] 推荐了张工程师但客户未回复` |
| `[payment_pending]` | 款项相关未完成 | `[payment_pending] 合伙人提现申请处理中` |
| `[rating_pending]` | 工单完成但未评价 | `[rating_pending] WO-20260415-001 已解决待评价` |

前缀不是强制 JSON 字段（保留字符串灵活性），但生成 prompt 里会强约束 mini 打上前缀。

---

## 十、验收标准（Phase 1 上线时）

- [ ] Migration 014 跑通（生产+本地）
- [ ] 100% 新会话在第 6 条消息后有 v1 摘要
- [ ] JSON 解析失败率 < 2%（通过 `ai_trace_logs` 查 `tool_name = 'generate_summary'` 统计）
- [ ] `get_conversation_history` 工具 10 条 golden 测例全部通过
- [ ] 单次摘要生成 P95 延迟 < 2s（不阻塞主流程，但仍要监控）
- [ ] 每日摘要生成成本 < $3（稳态估算 $1.5，预留 2x 缓冲）

---

## 十一、下一步

6 个决策点全部锁定。Phase 0 完成后即可进入 Phase 1 编码：

1. 写 `worker/migrations/014_conversation_summaries.sql`
2. 写 `worker/src/lib/summary.js`（生成管线：脱敏 → JSON mode 调用 → 失败重试 → 写表）
3. 写 `worker/src/lib/redact.js`（脱敏工具，同时供摘要前/工单描述存储前共用）
4. 在 `handleChat` 主流程加阈值触发点 + `ctx.waitUntil()`
5. 实现 `get_conversation_history` 工具（schema + executor + role guard）
6. 在 `ROLE_PROMPTS`（所有角色）里加 `pending_items` 跟进指令
7. 写 `scripts/migrate_summaries.mjs` 存量刷新脚本（详见第 12 节）
8. Golden set 新增 5 条 pending_items 跟进测例

## 十二、存量迁移脚本：`scripts/migrate_summaries.mjs`

**✅ 决议：不做懒生成，改为一次性刷新脚本**

### 12.1 运行方式

```bash
# 深夜手动在本地跑，直连生产 D1
cd worker
node ../scripts/migrate_summaries.mjs --env production --dry-run      # 先看会刷多少条
node ../scripts/migrate_summaries.mjs --env production --limit 50      # 分批跑
node ../scripts/migrate_summaries.mjs --env production                 # 全量
```

### 12.2 筛选规则

只刷有价值的存量：

| 条件 | 值 |
|---|---|
| `messages` 条数 | **> 5 条**（≤5 条的对话通常是问候/无信息量）|
| 是否已有摘要 | 否（`conversation_summaries` 无记录）|
| `updated_at` 时间 | 最近 90 天内（更老的意义不大，可配置）|

### 12.3 执行流程

```
1. 从 D1 拉出候选 conversation_id 列表（按上述规则）
2. 对每个 conversation：
   a. 拉 messages（最多最近 20 条）
   b. 脱敏
   c. 调 gpt-4o-mini JSON mode 生成摘要
   d. 写入 conversation_summaries
   e. 更新 conversations.summary_message_count
3. 失败的 conversation_id 写入 migrate_errors.log，不阻塞其他
4. 打印统计：处理 X 条，成功 Y 条，失败 Z 条，预计成本 $W
```

### 12.4 安全措施

- `--dry-run` 只打印会刷的数量和预估成本，不调 API 不写表
- `--limit N` 分批跑，出问题可立即停
- 失败记录进日志（不写回数据库），方便重试
- 脚本加速率限制：并发 ≤ 3，避免触发 jiekou.ai 限流
- 脚本结束前打印总成本估算（基于 mini 当前单价 × 调用次数 × 平均 token）

### 12.5 预估规模

- 当前冷启动，生产大概 < 50 条对话需要刷 → 成本 < $0.05
- 上规模后（假设 5000 条存量）→ 一次性成本 ~$2.5，可接受
- 脚本只跑一次，后续新会话走 Phase 1 的实时阈值触发
