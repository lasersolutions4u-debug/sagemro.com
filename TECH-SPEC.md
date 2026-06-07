# SAGEMRO 技术规格

> 本文档描述 SAGEMRO 平台的技术架构、数据模型、API 设计和 AI 集成。
> 部署运维相关内容见 [DEPLOY.md](./DEPLOY.md)。
>
> ⚠️ 代码中的 `worker/src/index.js` 和 `worker/migrations/` 是事实来源。本文与代码不一致时，以代码为准。

---

## 一、技术架构

```
GitHub 仓库（代码托管）
    ↓ push / merge
Cloudflare Pages（官网部署）
Cloudflare Workers（AI API 代理 + 工单后端）
    ↓
Cloudflare D1（国际版 / 中国版独立数据库）
    ↓
DeepSeek API（deepseek-v4-pro）
```

生产环境按域名分为两套业务入口：

| 版本 | 前台 | 后台 | API | 数据库 |
|------|------|------|-----|--------|
| 国际版 | `sagemro.com` | `admin.sagemro.com` | `api.sagemro.com` | D1 `sagemro-db` |
| 中国版 | `sagemro.cn` | `admin.sagemro.cn` | `api.sagemro.cn` | D1 `sagemro-db-cn` |

前台和后台使用同一套 React 源码，但运行在 `.cn` 域名时默认调用 `https://api.sagemro.cn`。Worker 使用同一套代码部署，按 API 域名或请求来源域名把中国版请求路由到 `DB_CN`，避免中英文版本数据混用。

### 1.1 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 18 + Vite |
| 样式 | Tailwind CSS |
| 图标 | Lucide React |
| 动画 | Framer Motion |
| 路由 | React Router DOM |
| 部署 | Cloudflare Pages |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1（SQLite） |
| AI | DeepSeek API（deepseek-v4-pro） |

### 1.2 项目信息

- **品牌名**：SAGEMRO
- **AI 助手名**：小智
- **国际版域名**：`sagemro.com`
- **中国版域名**：`sagemro.cn`
- **国际版后台**：`admin.sagemro.com`
- **中国版后台**：`admin.sagemro.cn`
- **国际版 API**：`api.sagemro.com`
- **中国版 API**：`api.sagemro.cn`
- **GitHub 仓库**：`lasersolutions4u-debug/sagemro.com`

---

## 二、目录结构

```
sagemro/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── Chat/
│   │   │   ├── Tickets/
│   │   │   ├── Auth/
│   │   │   └── ui/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── context/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── admin/
│   └── ...（管理后台独立项目）
├── worker/
│   ├── src/
│   │   ├── index.js          # 主入口，含 System Prompt
│   │   ├── chat.js
│   │   ├── tickets.js
│   │   ├── engineers.js
│   │   ├── auth.js
│   │   ├── ratings.js
│   │   └── db.js
│   ├── migrations/
│   ├── tests/
│   └── wrangler.toml
├── .github/workflows/deploy.yml
└── docs/
```

---

## 三、AI 配置

### 3.1 API

| 配置项 | 值 |
|--------|-----|
| Provider | DeepSeek |
| Endpoint | `https://api.deepseek.com/v1/chat/completions` |
| Model | `deepseek-v4-pro` |
| API Key | `${OPENAI_API_KEY}` — 通过 `wrangler secret put` 注入，不在代码或文档中出现明文 |

### 3.2 Prompt 架构（三层叠加）

```
┌─────────────────────────────────────────────┐
│ Layer 3: Context Prompt（数据库注入）         │
├─────────────────────────────────────────────┤
│ Layer 2: Role Prompt（guest/customer/engineer）│
├─────────────────────────────────────────────┤
│ Layer 1: Base Prompt（所有人共用）            │
└─────────────────────────────────────────────┘
```

- **Base Prompt**：详见 [docs/xiaozhi-system-prompt.md](./docs/xiaozhi-system-prompt.md)
- **Role + Context 分层**：详见 [docs/xiaozhi-role-prompts-design.md](./docs/xiaozhi-role-prompts-design.md)

### 3.3 Function Calling 工具

| 工具名 | 功能 | 状态 |
|--------|------|------|
| `get_customer_profile` | 客户档案：设备列表、历史工单、评价 | ⏳ |
| `get_engineer_profile` | 合伙人档案：专长、等级、评分、钱包 | ✅ |
| `get_work_order_detail` | 工单详情：状态、消息、报价 | ⏳ |
| `get_pending_tickets_for_engineer` | 待接单工单列表 | ✅ |
| `get_pricing_history` | 历史报价数据（AI 核价参考） | ✅ 后端 |
| `get_regional_pricing` | 某地区某设备类型的平均报价 | ✅ 后端 |
| `get_customer_devices` | 客户设备列表 | ⏳ |
| `get_device_detail` | 设备详情（含维修记录） | ⏳ |
| `get_conversation_history` | 用户最近 N 条对话历史 | ⏳ |

---

## 四、环境变量

### 4.1 前端

```
# 可选。生产构建默认不设置，由运行域名自动选择：
#   *.sagemro.cn  → https://api.sagemro.cn
#   其他生产域名 → https://api.sagemro.com
VITE_API_BASE=https://api.sagemro.com
```

### 4.2 Worker（`wrangler.toml` [vars]）

| 变量 | 说明 |
|------|------|
| `ENVIRONMENT` | `development` / `production` |
| `DEV_BYPASS_CODE` | 开发环境固定验证码（仅 dev） |

### 4.3 Worker Secrets（`wrangler secret put`）

| Secret | 用途 |
|--------|------|
| `OPENAI_API_KEY` | DeepSeek API Key |
| `OPENAI_API_ENDPOINT` | DeepSeek API Endpoint |
| `JWT_SECRET` | JWT 签名密钥 |
| `ADMIN_PHONE` | 管理员手机号 |
| `ADMIN_PASSWORD` | 管理员密码 |
| `ONESIGNAL_APP_ID` | OneSignal 推送 App ID |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API Key |

---

## 五、ICP 经营许可证提交前技术核对

中国版用于 ICP 经营许可证材料时，应按以下口径准备和核验：

| 项目 | 当前技术口径 |
|------|--------------|
| 网站主域名 | `sagemro.cn` |
| 管理后台 | `admin.sagemro.cn` |
| API 服务 | `api.sagemro.cn` |
| 数据库 | D1 `sagemro-db-cn`，与国际版 `sagemro-db` 隔离 |
| 数据路由 | Worker 按 `.cn` API 域名或 `.cn` 来源域名进入 `DB_CN` |
| 用户协议/隐私政策 | 中国版页面需展示适用于国内主体的协议、隐私政策和 AI 服务说明 |
| 许可证展示 | 取得 ICP 经营许可证后，应在 `sagemro.cn` 页脚展示许可证编号 |
| 备案/接入 | 如主管部门或接入商要求大陆接入，应将中国版前台、后台、API 迁移或接入到可备案的国内接入服务商 |

---

## 六、数据库 Schema（D1）

### 5.1 customers — 客户用户表

```sql
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    region TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 5.2 engineers — 合伙人（工程师）表

```sql
CREATE TABLE engineers (
    id TEXT PRIMARY KEY,
    user_no TEXT UNIQUE NOT NULL,       -- E-0001
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,

    -- 背景调查（自由标签）
    specialties TEXT NOT NULL,          -- JSON数组：["激光切割机", "折弯机"]
    brands TEXT,                        -- JSON：{"激光切割机": ["大族", "通快"]}
    services TEXT NOT NULL,             -- JSON数组：["激光器维修", "切割头维护"]
    service_region TEXT,
    bio TEXT,

    -- 状态和评分
    status TEXT DEFAULT 'available',    -- available / paused / offline
    rating_timeliness REAL DEFAULT 0,
    rating_technical REAL DEFAULT 0,
    rating_communication REAL DEFAULT 0,
    rating_professional REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,

    -- V2 合伙人总包制
    level TEXT DEFAULT 'junior',        -- junior / senior / expert
    commission_rate REAL DEFAULT 0.80,  -- 80% / 85% / 88%
    credit_score INTEGER DEFAULT 100,
    deposit_balance INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    complex_orders INTEGER DEFAULT 0,
    success_orders INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now'))
);
```

### 5.3 devices — 设备表

```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    type TEXT NOT NULL,         -- 设备类型标签（自由填写）
    brand TEXT,                  -- 品牌标签（自由填写）
    model TEXT,
    power TEXT,
    name TEXT,                   -- 设备名称（migration 004 新增）
    status TEXT,                 -- 设备状态（migration 004 新增）
    photo_url TEXT,              -- 照片 URL（migration 004 新增）
    notes TEXT,                  -- 备注（migration 004 新增）
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 5.4 work_orders — 工单表

```sql
CREATE TABLE work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,     -- WO-YYYYMMDD-NNN
    customer_id TEXT,
    engineer_id TEXT,
    device_id TEXT,

    type TEXT NOT NULL,                -- fault / maintenance / parameter / other
    description TEXT NOT NULL,
    urgency TEXT DEFAULT 'normal',     -- normal / urgent / critical

    status TEXT DEFAULT 'pending',     -- pending / assigned / in_progress / pricing
                                       -- / in_service / resolved / pending_review
                                       -- / completed / rejected / cancelled

    ai_summary TEXT,
    ai_recommendation TEXT,            -- JSON：推荐的工程师 ID 和理由

    created_at TEXT DEFAULT (datetime('now')),
    assigned_at TEXT,
    started_at TEXT,
    resolved_at TEXT,
    completed_at TEXT,

    recommend_count INTEGER DEFAULT 0,
    rejected_engineers TEXT,           -- JSON数组：已拒绝的工程师 ID

    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

### 5.5 work_order_logs — 工单进度记录

```sql
CREATE TABLE work_order_logs (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT,
    actor_id TEXT,
    content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
);
```

### 5.6 ratings — 评价表

```sql
CREATE TABLE ratings (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL UNIQUE,
    engineer_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    rating_timeliness INTEGER NOT NULL,     -- 1-5
    rating_technical INTEGER NOT NULL,
    rating_communication INTEGER NOT NULL,
    rating_professional INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 5.7 conversations — 对话记录

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    engineer_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### 5.8 messages — 对话消息

```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,              -- user / assistant / system
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

### 5.9 合伙人钱包与风控表

```sql
-- 钱包流水
CREATE TABLE engineer_wallets (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 保证金流水
CREATE TABLE engineer_deposits (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 晋升记录
CREATE TABLE engineer_promotions (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    from_level TEXT,
    to_level TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 违规记录
CREATE TABLE engineer_violations (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    work_order_id TEXT,
    violation_type TEXT NOT NULL,
    credit_deduction INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 提现申请
CREATE TABLE engineer_withdrawals (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    fail_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);
```

### 5.10 索引

```sql
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_engineer ON work_orders(engineer_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_ratings_engineer ON ratings(engineer_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_engineers_status ON engineers(status);
CREATE INDEX idx_engineers_level ON engineers(level);
```

---

## 六、API 端点

### 6.1 认证

```
POST /api/auth/login
Body: { "phone": "手机号", "password": "密码" }
Response: { "token": "jwt", "user": {...}, "type": "customer" | "engineer" }

POST /api/auth/register/customer
Body: { "name", "phone", "password", "code" }

POST /api/auth/register/engineer
Body: {
  "name", "phone", "password", "code",
  "specialties": ["laser", "bending"],
  "brands": { "laser": ["大族", "通快"], "bending": [...] },
  "services": ["激光器维修", "切割头维护"],
  "service_region": "华东地区",
  "bio": "个人简介（可选）"
}

POST /api/auth/send-code
Body: { "phone": "手机号" }
```

### 6.2 AI 对话

```
POST /api/chat
Headers: Authorization: Bearer <token>
Body: { "message": "用户消息", "conversation_id": "可选" }
Response: SSE 流式
```

### 6.3 工单

```
POST   /api/tickets              创建工单（需登录）
GET    /api/tickets              我的工单列表
GET    /api/tickets/:id          工单详情
POST   /api/tickets/:id/rating   提交评价
```

### 6.4 合伙人

```
GET    /api/engineers/tickets              合伙人的工单列表
POST   /api/engineers/tickets/:id/accept   接单
POST   /api/engineers/tickets/:id/reject   拒单
POST   /api/engineers/tickets/:id/progress 添加进度
POST   /api/engineers/tickets/:id/resolve  标记已解决
GET    /api/engineers/profile              合伙人信息（含等级、提成比例、信用分）
PATCH  /api/engineers/profile              更新个人信息
PATCH  /api/engineers/status               更新接单状态
GET    /api/engineers/recommend            推荐合伙人列表（供 AI 调用）
GET    /api/engineers/wallet               钱包余额、保证金、流水
POST   /api/engineers/wallet/withdraw      申请提现（T+1到账）
```

### 6.5 设备

```
GET    /api/devices              获取当前客户的所有设备
POST   /api/devices              添加新设备
GET    /api/devices/:id          获取设备详情（含维修记录）
PATCH  /api/devices/:id          更新设备
DELETE /api/devices/:id          删除设备
```

---

## 七、关键业务流程

### 7.1 工单状态机

```
pending → assigned → in_progress → pricing → in_service → resolved → pending_review → completed
                      ↓                ↓                                    ↓
                   rejected         cancelled                          (超时自动完成)
```

### 7.2 核价公式

| 费用项 | 说明 |
|--------|------|
| 小计 | 人工费 + 配件费 + 差旅费 + 其他 |
| 平台服务费 | 小计 × (1 - 合伙人提成比例) |
| 合伙人实得 | 小计 × 提成比例 |
| 客户应付 | 小计（合伙人报的全包价）|
| 动态保证金 | 小计 × 5%（暂缓实施）|

### 7.3 合伙人等级

| 等级 | 提成比例 | 晋升条件 |
|------|---------|---------|
| Junior（默认）| 80% | 注册时自动 |
| Senior | 85% | 累计完成 N 单 + 评分 ≥ 4.5 |
| Expert | 88% | 累计完成 N 单 + 含 M 单复杂工单 + 评分 ≥ 4.7 |

---

> **最后更新**：2026-05-18（提取自原始 CLAUDE.md 第九章、第十章、第十一章）
