# SAGEMRO AI 进化架构蓝图

> 版本：2026-06-19
> 状态：正式开发蓝图
> 适用范围：sagemro.com / sagemro.cn / admin.sagemro.* / engineer.sagemro.*

## 1. 核心判断

SAGEMRO AI 不应被设计成一次性完成的聊天功能，而应设计成一个可以持续升级的服务智能系统。

原来的升级路线：

```text
Prompts AI -> RAG AI -> Agent AI
```

仍然成立，但需要升级为三层叠加：

```text
Prompt OS + Knowledge OS + Agent OS
```

- Prompt OS：控制语言、角色、语气、安全边界、转化边界和回答结构。
- Knowledge OS：沉淀报警码、参数表、备件库、维修 SOP、设备手册、历史工单和工程师修正。
- Agent OS：在受控范围内执行业务动作，包括生成线索、整理服务申请、补全设备档案、派工建议和跟进任务。

这三层不是互相替代，而是逐层增强。Prompt 决定 AI 怎么说，RAG 决定 AI 依据什么说，Agent 决定 AI 能帮业务做到哪一步。

## 2. 目标架构

SAGEMRO 面向未来的 AI 架构应是：

```text
User / WhatsApp / Web Chat
        |
        v
AI Gateway
        |
        +-- Prompt Router
        +-- Market & Language Policy
        +-- Intent Classifier
        +-- Safety & Conversion Gate
        |
        v
Knowledge OS
        |
        +-- Fault Knowledge Base
        +-- Cutting Parameter Knowledge Base
        +-- Parts Knowledge Base
        +-- Maintenance SOP Knowledge Base
        +-- Machine Selection Knowledge Base
        +-- Historical Work Order Knowledge Base
        |
        v
Agent Workflow
        |
        +-- Lead Draft
        +-- Service Case Summary
        +-- Work Order Draft
        +-- Device Profile Update Draft
        +-- Parts Requirement Draft
        +-- Engineer Assignment Suggestion
        +-- Follow-up Task Suggestion
        |
        v
Human Confirmation
        |
        v
CRM / Work Orders / Devices / Engineer Console / Marketing
```

AI 可以建议、整理、草拟和提醒，但不能绕过 SAGEMRO 官方确认直接承诺正式诊断、报价、安全结论、备件适配或派工结果。

## 3. 自进化飞轮

为了让 AI 能力自动向前走，系统必须形成闭环：

```text
真实用户问题
  -> AI 回复
  -> 用户继续追问 / 放弃 / 注册 / 创建服务申请
  -> 客服审核和修改
  -> 工程师诊断和服务结果
  -> 客户评价
  -> 反馈数据进入 AI 改进队列
  -> 更新 Prompt / 知识库 / 工具规则 / 评测集
  -> 自动评测通过
  -> 灰度发布
  -> 线上监控
```

这条链路的关键是：每一次业务互动都要留下可学习的结构化信号。

## 4. 必须采集的改进信号

### 4.1 用户侧信号

- 用户问题类型：故障、参数、备件、维修预估、新机选型、保养、售后跟进。
- 用户是否继续追问。
- 用户是否注册。
- 用户是否上传图片。
- 用户是否创建服务申请。
- 用户是否在 AI 建议后离开。
- 用户是否对 AI 回复点赞、点踩或反馈“没有解决”。

### 4.2 客服和后台信号

- AI 摘要是否被人工修改。
- AI 判断的业务类型是否被改动。
- AI 推荐的下一步是否被采纳。
- AI 是否过早引导服务申请。
- AI 是否漏掉报价、备件、安全、停机等关键承接点。
- 客服是否把会话转为 CRM 线索或服务申请。

### 4.3 工程师侧信号

- AI 初诊是否被工程师确认。
- AI 初诊是否被工程师纠正。
- 最终故障原因。
- 实际更换备件。
- 实际服务步骤。
- 实际停机时长。
- 工程师对 AI 摘要的评分。
- 工程师补充的知识点。

### 4.4 商业侧信号

- AI 会话转线索率。
- 线索转服务申请率。
- 服务申请转正式派工率。
- 备件线索转化率。
- Euchio 新机线索转化率。
- 高价值客户问题来源。
- 高复发故障和高频备件需求。

## 5. AI 能力等级

### L1 Prompt OS

当前项目已经具备 L1 的基础能力：

- 分市场语言控制。
- Guest / customer / engineer 角色提示。
- 简单问题不强推服务申请。
- 服务申请和工具调用边界。
- 流式回复、截断恢复和兜底。
- 基础安全提醒。

下一步应补强：

- Prompt 版本化。
- Prompt 变更前后评测。
- 不同意图对应的回答策略。
- 简单问题、服务问题、商业问题的转化边界。

### L2 Knowledge OS

建立可运营的知识库，而不是把知识堆进 prompt。

第一批知识库：

- 激光切割报警码库。
- 切割参数参考库。
- 切割头、激光器、控制系统常见问题库。
- 备件识别与兼容库。
- 维修 SOP 和安全检查清单。
- 设备保养周期和健康评估库。
- 新机选型和 Euchio 项目知识库。

知识库条目必须包含：

- 标题。
- 适用设备类型。
- 适用品牌/型号/系统。
- 适用材料、功率、厚度或工况。
- 诊断内容。
- 风险等级。
- 推荐检查步骤。
- 禁止承诺事项。
- 来源。
- 版本。
- 审核人。
- 生效状态。

### L3 Tool OS

AI 可以通过工具读取业务数据，但应先以只读工具为主。

优先工具：

- 查询客户设备档案。
- 查询历史服务申请。
- 查询工单消息和附件。
- 查询备件记录。
- 查询工程师能力标签和负载。
- 查询知识库条目。
- 查询 CRM 线索状态。

工具原则：

- 只读工具优先。
- 写入动作必须有明确用户确认或后台确认。
- 工具调用必须记录 trace。
- 工具结果要进入评测和审计。

### L4 Agent OS

Agent 开始执行多步骤业务流，但所有关键动作需要确认。

可允许的 Agent 动作：

- 生成服务申请草稿。
- 生成 CRM 线索草稿。
- 生成备件需求草稿。
- 生成设备档案更新草稿。
- 生成工程师派工建议。
- 生成 WhatsApp 跟进任务草稿。
- 生成知识库待补充建议。

不允许自动完成的动作：

- 自动承诺报价。
- 自动承诺备件适配。
- 自动承诺正式诊断。
- 自动承诺现场安全结论。
- 自动直接派工。
- 自动对客户发送正式商业承诺。

### L5 Service Intelligence OS

系统开始从大量服务数据中发现运营机会：

- 高频故障趋势。
- 区域服务压力。
- 备件备货建议。
- 设备健康风险。
- 客户换机可能性。
- Euchio 新机销售机会。
- 内容营销选题。
- WhatsApp 再营销人群。

L5 的重点不是让 AI 替人决策，而是让 SAGEMRO 的运营团队更早看到机会和风险。

## 6. 6 类 AI 的新定义

6 类 AI 不再理解为 6 个复杂页面，也不应要求用户先选工具或填表。它们是统一聊天入口背后的 6 种业务能力。

| AI 能力 | 用户入口 | 系统内部识别 | 输出形态 |
| --- | --- | --- | --- |
| 故障诊断 AI | 用户自然描述故障 | fault_diagnosis | 初诊、风险、检查项、服务申请草稿 |
| 切割参数 AI | 用户问材料/厚度/气体/坡口 | cutting_parameters | 参数范围、检查项、工艺建议 |
| 备件识别 AI | 用户描述零件或上传图片 | parts_identification | 备件候选、需确认信息、备件线索 |
| 维修预估 AI | 用户问维修难度/费用因素 | repair_estimate | 影响因素、风险等级、报价前材料 |
| 新机选型 AI | 用户问产能/材料/预算 | machine_selection | 选型方向、项目线索、Euchio 转化 |
| 健康报告 AI | 用户描述设备状态/保养 | health_report | 健康评分草稿、维保建议、风险项 |

用户看到的是一个极简聊天入口；后台看到的是结构化能力标签、线索来源和可运营数据。

## 7. 转化边界

AI 不应把每个问题都推向服务申请。

### 7.1 直接回答

适用于：

- 常识问题。
- 参数范围问题。
- 基础排查问题。
- 设备选型常识。
- 不涉及即时停机、报价、安全、备件适配或上门的咨询。

处理方式：

- 直接给清晰答案。
- 最多问一个关键补充条件。
- 不主动要求创建服务申请。

### 7.2 轻承接

适用于：

- 用户问题可能与现场工况强相关。
- 存在误判风险。
- 需要图片、型号、报警码才能进一步判断。
- 用户表现出采购、备件或服务兴趣。

处理方式：

- 先回答。
- 再自然提示可以继续补充信息。
- 不强制登录或创建服务申请。

### 7.3 服务申请

适用于：

- 停机。
- 反复故障。
- 安全风险。
- 需要报价。
- 需要备件确认。
- 需要远程诊断。
- 需要上门服务。
- 需要官方参数复核。
- 用户明确要求 SAGEMRO 跟进。

处理方式：

- AI 生成结构化摘要。
- 返回给用户确认。
- 用户确认后才创建服务申请或转入后台审核。

## 8. 评测体系

没有评测，就不能让 AI 自动进化。

### 8.1 固定评测集

每个版本至少维护以下评测集：

- 中文故障问题 50 条。
- 英文故障问题 50 条。
- 切割参数问题 50 条。
- 备件识别问题 30 条。
- 维修预估问题 30 条。
- 新机选型问题 30 条。
- 健康报告问题 30 条。
- 不应创建服务申请的问题 50 条。
- 必须引导服务申请的问题 50 条。
- 安全风险问题 30 条。

### 8.2 评测指标

- 语言正确。
- 是否直接回答用户问题。
- 是否避免编造正式报价。
- 是否避免过度引导服务申请。
- 是否在高风险场景给出安全提醒。
- 是否在服务场景生成正确摘要。
- 是否引用了正确知识库。
- 是否保持 SAGEMRO 品牌语气。
- 是否给出可执行下一步。

### 8.3 发布门禁

以下情况不允许发布：

- 中文站回答英文。
- 简单问题大量强推服务申请。
- 报价或备件适配出现编造。
- 安全风险无提醒。
- 工具调用越权。
- RAG 引用来源缺失。
- 评测通过率低于设定阈值。

## 9. 后台新增模块

### 9.1 AI 改进队列

用于集中处理线上问题和改进机会。

字段：

- 来源：用户反馈、客服修改、工程师纠正、评测失败、系统监控。
- 原始问题。
- AI 回复。
- 人工修正。
- 关联会话。
- 关联服务申请。
- 关联知识库条目。
- 问题类型。
- 严重程度。
- 处理状态。
- 负责人。

### 9.2 知识库管理

用于运营可审核的 RAG 内容。

功能：

- 新建知识条目。
- 审核知识条目。
- 下线过期内容。
- 版本对比。
- 标记适用范围。
- 标记来源。
- 查看被引用次数。
- 查看用户反馈。

### 9.3 AI 评测中心

用于管理评测集和发布门禁。

功能：

- 管理测试用例。
- 运行评测。
- 查看通过率。
- 查看失败样本。
- 对比 Prompt / 知识库 / 模型版本。
- 生成发布建议。

### 9.4 Agent 审计台

用于追踪 AI 工具调用和业务动作。

功能：

- 查看工具调用记录。
- 查看读写动作。
- 查看失败原因。
- 查看人工确认记录。
- 查看越权拦截记录。

## 10. 数据表建议

### 10.1 `ai_interactions`

记录每次 AI 交互。

```sql
CREATE TABLE ai_interactions (
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
```

### 10.2 `ai_feedback_items`

记录待改进项。

```sql
CREATE TABLE ai_feedback_items (
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
```

### 10.3 `knowledge_articles`

记录可检索知识库。

```sql
CREATE TABLE knowledge_articles (
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
```

### 10.4 `ai_eval_cases`

记录评测用例。

```sql
CREATE TABLE ai_eval_cases (
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
```

### 10.5 `ai_eval_runs`

记录评测运行。

```sql
CREATE TABLE ai_eval_runs (
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
```

### 10.6 `ai_tool_traces`

记录 Agent 工具调用。

```sql
CREATE TABLE ai_tool_traces (
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

## 11. 实施顺序

### Phase 1：AI Gateway 与评测底座

目标：

- 把 prompt、语言、意图、转化边界、模型配置和交互日志统一纳入 AI Gateway。
- 建立固定评测集。
- 建立“简单问题不强推服务申请”的自动评测。

交付：

- `ai_interactions`。
- `ai_eval_cases`。
- `ai_eval_runs`。
- 本地 eval harness。
- CI 中的 AI 行为测试。

### Phase 2：AI Feedback Flywheel

目标：

- 用户、客服、工程师的修正都进入改进队列。
- 后台可以查看 AI 问题和改进状态。

交付：

- `ai_feedback_items`。
- 管理后台 AI 改进队列。
- 工程师 AI 初诊纠正入口。
- 客服摘要修改记录。

### Phase 3：Knowledge OS

目标：

- 建立可审核、可版本化的知识库。
- 先做结构化知识表，再接向量检索。

交付：

- `knowledge_articles`。
- 管理后台知识库管理。
- 知识条目审核流程。
- 知识库引用记录。
- 第一批中文/英文知识条目。

### Phase 4：RAG 接入

目标：

- AI 回答专业问题时优先检索知识库。
- 输出中能区分“知识库依据”和“经验性建议”。

交付：

- 知识检索工具。
- RAG prompt。
- RAG 评测集。
- 引用来源记录。

### Phase 5：Agent Workflow

目标：

- AI 能受控生成线索、服务申请草稿、备件需求、派工建议和 WhatsApp 跟进任务。

交付：

- Agent 工具注册中心。
- `ai_tool_traces`。
- 写入动作确认机制。
- Agent 审计台。
- WhatsApp 入口与站内工单衔接。

### Phase 6：Service Intelligence

目标：

- 从服务数据中自动发现运营机会。

交付：

- 高频故障分析。
- 备件需求趋势。
- 区域服务压力。
- 新机线索评分。
- 内容营销选题建议。

## 12. 商业原则

AI 的商业价值不在于每次都把用户推向服务申请，而在于：

- 简单问题答得准，建立信任。
- 复杂问题收得住，降低误判。
- 服务场景接得住，提升转化。
- 后台数据沉淀得住，形成长期壁垒。

SAGEMRO 的长期竞争力不是“用了 AI”，而是拥有一套越来越懂激光切割和钣金设备服务的业务智能系统。
