# 设备档案系统设计规格

> **项目：** SAGEMRO 设备档案 + 维修记录关联工单
> **日期：** 2026-04-20
> **状态：** 已确认

---

## 一、目标

为 SAGEMRO 平台的客户提供设备档案管理功能：
1. 客户可在侧边栏查看和管理自己的设备列表
2. 每个设备有完整档案卡，展示设备信息 + 维修保养记录
3. 维修记录直接关联到具体工单，可跳转查看工单详情
4. AI 小智也能调用工具展示设备档案

---

## 二、数据库变更（Migration）

**文件：** `worker/migrations/004_add_device_fields.sql`

```sql
-- 设备表新增字段
ALTER TABLE devices ADD COLUMN name TEXT;                      -- 设备名称（如"车间1号激光机"）
ALTER TABLE devices ADD COLUMN status TEXT DEFAULT 'normal';    -- 设备状态：normal/running/maintenance
ALTER TABLE devices ADD COLUMN photo_url TEXT;                  -- 设备照片 URL
ALTER TABLE devices ADD COLUMN notes TEXT;                      -- 客户备注（文字）

-- 工单表补充 completed_at（如果缺失）
ALTER TABLE work_orders ADD COLUMN completed_at TEXT;
```

---

## 三、后端 API（Cloudflare Workers）

### 3.1 设备管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/devices` | 获取当前客户的所有设备（含工单统计） |
| POST | `/api/devices` | 添加新设备 |
| GET | `/api/devices/:id` | 获取设备详情（含维修记录列表） |
| PATCH | `/api/devices/:id` | 更新设备（名称/照片/备注/状态） |
| DELETE | `/api/devices/:id` | 删除设备 |

### 3.2 API 详情

**GET `/api/devices`**
```json
Response: {
  "devices": [
    {
      "id": "xxx",
      "name": "车间1号激光机",
      "type": "激光切割机",
      "brand": "大族",
      "model": "G3015H",
      "power": "3000W",
      "status": "normal",
      "photo_url": "",
      "notes": "",
      "created_at": "2026-04-01",
      "total_orders": 5,
      "completed_orders": 4,
      "last_order_date": "2026-04-15"
    }
  ]
}
```

**GET `/api/devices/:id`**
```json
Response: {
  "device": { /* 设备完整信息 */ },
  "work_orders": [
    {
      "id": "xxx",
      "order_no": "WO-20260415-001",
      "type": "fault",
      "description": "激光切割毛刺多",
      "urgency": "normal",
      "status": "completed",
      "engineer_name": "张师傅",
      "rating": 4.8,
      "cost_summary": { "labor": 800, "parts": 200, "travel": 100 },
      "created_at": "2026-04-15",
      "completed_at": "2026-04-16"
    }
  ]
}
```

---

## 四、Function Calling 工具（AI 调用）

### 4.1 工具列表

| 工具名 | 功能 |
|--------|------|
| `get_customer_devices` | AI 查询客户的所有设备列表（名称/类型/品牌/状态/工单数） |
| `get_device_detail` | AI 查询某设备详情（含维修记录，参数：device_id） |

### 4.2 Schema

```javascript
{
  name: 'get_customer_devices',
  description: '查询当前客户的所有设备档案列表，包含设备名称、类型、品牌、状态和维修记录摘要。用于客户询问自己有哪些设备时。',
  parameters: { type: 'object', properties: {}, required: [] }
}

{
  name: 'get_device_detail',
  description: '查询指定设备的完整档案，包括设备详细信息和所有关联的维修工单记录。用于客户询问某个设备的详细信息或维修历史时。',
  parameters: {
    type: 'object',
    properties: {
      device_id: { type: 'string', description: '设备ID' }
    },
    required: ['device_id']
  }
}
```

---

## 五、前端组件

### 5.1 组件列表

| 组件 | 功能 |
|------|------|
| `MyDevicesModal.jsx` | 设备列表弹窗（侧边栏入口） |
| `DeviceCard.jsx` | 单个设备卡片（用于列表展示） |
| `DeviceDetailPanel.jsx` | 设备详情面板（展开后显示完整信息 + 维修记录） |
| `DeviceForm.jsx` | 添加/编辑设备表单 |
| `WorkOrderCard.jsx` | 维修记录卡片（关联工单） |

### 5.2 组件位置

```
frontend/src/components/Device/
  ├── MyDevicesModal.jsx
  ├── DeviceCard.jsx
  ├── DeviceDetailPanel.jsx
  ├── DeviceForm.jsx
  └── WorkOrderCard.jsx
```

---

## 六、UI 交互流程

### 6.1 侧边栏入口

**ToolBar 组件（frontend/src/components/Sidebar/ToolBar.jsx）：**
- 新增按钮：`📦 我的设备`
- 仅登录客户可见（engineer 不显示）

**MyDevicesModal 弹窗：**
- 顶部标题："我的设备"
- 右上角添加按钮：`+ 添加设备`
- 设备卡片列表（DeviceCard）
- 点击卡片 → 展开 DeviceDetailPanel

### 6.2 设备卡片（DeviceCard）

```
┌────────────────────────────────────────┐
│ 📦 车间1号激光机          🟢 正常      │
│ 激光切割机 | 大族 | 3000W              │
│ ──────────────────────────────────────│
│ 📋 5次维保 | 最后维保：3天前            │
└────────────────────────────────────────┘
```

### 6.3 设备详情面板（DeviceDetailPanel）

```
┌─ 车间1号激光机 ──────────────────────────┐
│                                        │
│ 类型：激光切割机    品牌：大族           │
│ 型号：G3015H      功率：3000W          │
│ 状态：🟢 正常                           │
│ 添加时间：2026-04-01                    │
│                                        │
│ 📝 备注                                 │
│ [点击编辑备注...]                        │
│                                        │
│ 📸 设备照片                              │
│ [上传照片]                               │
│                                        │
│ ───────────────────────────────────────│
│ 📋 维修保养记录（5条）                   │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ WO-20260415-001    ✅ 已完成       │ │
│ │ 设备故障 | 2026-04-15              │ │
│ │ 激光切割毛刺多...                  │ │
│ │ 张师傅 | ⭐4.8                     │ │
│ │ 费用：¥1,100                       │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [查看工单详情 →]                        │
└────────────────────────────────────────┘
```

### 6.4 设备表单（DeviceForm）

```
┌─ 添加设备 ──────────────────────────────┐
│                                        │
│ 设备名称 *                               │
│ [例如：车间1号激光机]                    │
│                                        │
│ 设备类型 *                               │
│ [激光切割机 ▼] 或 [+ 添加标签]          │
│                                        │
│ 品牌（可选）                             │
│ [大族 ▼] 或 [+ 添加标签]               │
│                                        │
│ 型号（可选）                             │
│ [G3015H]                               │
│                                        │
│ 功率（可选）                             │
│ [3000W]                                │
│                                        │
│            [取消]    [保存]             │
└────────────────────────────────────────┘
```

---

## 七、AI 对话展示

当客户询问设备时，AI 调用工具后展示：

```
客户：我的设备有哪些？
AI：
  📦 您的设备档案

  1️⃣ 车间1号激光机
     类型：激光切割机 | 品牌：大族 | 功率：3000W
     状态：🟢 正常 | 维保记录：5次

  2️⃣ 折弯机1号
     类型：折弯机 | 品牌：通快 | 功率：-
     状态：🟡 维保中 | 维保记录：2次

  您想了解哪台设备的详细信息？我可以为您展示完整的维修记录。
```

---

## 八、权限控制

- 仅 `customer` 类型用户可访问设备 API
- 设备属于客户，客户只能查看/操作自己的设备
- `engineer` 类型用户不可访问设备 API

---

## 九、技术实现顺序

1. **数据库 Migration** — 新增字段
2. **后端 API** — 设备 CRUD + 工单关联查询
3. **后端 Function Calling 工具** — `get_customer_devices` + `get_device_detail`
4. **前端组件** — MyDevicesModal + DeviceCard + DeviceDetailPanel + DeviceForm
5. **侧边栏入口** — ToolBar 新增按钮
6. **AI Role Prompt 更新** — 客户 Role 新增设备调用指令

---

## 十、依赖关系

- `devices` 表已存在，只需 ADD COLUMN
- `work_orders.device_id` 外键已存在，工单关联直接可用
- 无需新建关联表，复用已有外键关系