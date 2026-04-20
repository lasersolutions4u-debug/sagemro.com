# Function Calling 工具实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 SAGEMRO AI 小智实现 Function Calling，让 AI 能够主动查询合伙人档案和待接单工单

**Architecture:** 在 Cloudflare Workers 中实现 OpenAI Function Calling 工具框架。AI 判断需要调用工具时，暂停流式输出，执行工具查 D1，将结果注入消息上下文，再继续生成回答。

**Tech Stack:** Cloudflare Workers (Hono), D1 SQL, OpenAI Function Calling (gpt-4o-mini)

---

## 文件结构

```
worker/src/index.js    # 唯一修改文件
  - 新增：TOOLS_SCHEMAS 常量（第250行后）
  - 新增：executeTool 工具执行路由函数
  - 新增：toolGetEngineerProfile 工具函数
  - 新增：toolGetPendingTickets 工具函数
  - 修改：handleChat 中加入 tools 参数
  - 修改：handleChat 中工具调用检测和处理逻辑
```

---

## 实现任务

### Task 1: 添加工具 Schema 定义

**Modify:** `worker/src/index.js:250-270`（在 `};` 之后、`// ============ 工具函数 ============` 之前插入）

- [ ] **Step 1: 添加 TOOLS_SCHEMAS 常量**

在第 250 行 `};` 后插入：

```javascript
// ============ Function Calling 工具定义 ============

const TOOLS_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'get_engineer_profile',
      description: '查询当前登录合伙人的完整档案信息，包括等级、钱包余额、信用分、评分、专长、服务地区、累计完成工单数、本月收入等。当合伙人询问自身状态时调用此工具。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_tickets_for_engineer',
      description: '查询平台当前所有待接单的工单列表。返回工单编号、设备类型、故障描述、紧急程度、提交时间。当合伙人询问有哪些新工单可接时调用此工具。',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: '返回数量限制，默认10条，最多20条'
          }
        },
        required: []
      }
    }
  }
];
```

---

### Task 2: 添加工具执行函数

**Modify:** `worker/src/index.js`（在工具函数区域内，`// 生成唯一 ID` 之前）

- [ ] **Step 1: 添加工具执行路由函数**

```javascript
// ============ Function Calling 工具实现 ============

// 执行工具调用（根据工具名路由到具体实现）
async function executeTool(toolName, args, env, engineerId) {
  switch(toolName) {
    case 'get_engineer_profile':
      return await toolGetEngineerProfile(engineerId, env);
    case 'get_pending_tickets_for_engineer':
      return await toolGetPendingTickets(args?.limit || 10, env);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// 工具1：查询合伙人档案
async function toolGetEngineerProfile(engineerId, env) {
  if (!engineerId) return { error: 'engineer_id is required' };

  try {
    const engineer = await env.DB.prepare(
      `SELECT name, phone, specialties, brands, services, service_region,
              status, level, commission_rate, credit_score, wallet_balance,
              rating_timeliness, rating_technical, rating_communication,
              rating_professional, rating_count, total_orders, total_earnings
       FROM engineers WHERE id = ?`
    ).bind(engineerId).first();

    if (!engineer) return { error: 'Engineer not found' };

    // 获取本月完成工单数和收入
    const monthly = await env.DB.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as earnings
      FROM work_orders wo
      LEFT JOIN engineer_wallets ew ON ew.work_order_id = wo.id AND ew.engineer_id = ? AND ew.type IN ('order_payment', 'bonus')
      WHERE wo.engineer_id = ? AND wo.status = 'completed'
      AND wo.completed_at >= datetime('now', 'start of month')`
    ).bind(engineerId, engineerId).first();

    // 获取当前处理中工单数
    const inProgress = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM work_orders
       WHERE engineer_id = ? AND status IN ('assigned', 'in_progress', 'pricing', 'in_service')`
    ).bind(engineerId).first();

    const levelText = { junior: '初级', senior: '中级', expert: '专家' };
    const statusText = { available: '接单中', paused: '暂停接单', offline: '离线' };

    const avgRating = engineer.rating_count > 0
      ? ((engineer.rating_timeliness + engineer.rating_technical +
          engineer.rating_communication + engineer.rating_professional) / 4).toFixed(1)
      : null;

    return {
      name: engineer.name,
      level: levelText[engineer.level] || engineer.level,
      commission_rate: Math.round((engineer.commission_rate || 0.80) * 100),
      credit_score: engineer.credit_score,
      wallet_balance: engineer.wallet_balance || 0,
      total_earnings: engineer.total_earnings || 0,
      service_region: engineer.service_region,
      specialties: (() => { try { return JSON.parse(engineer.specialties || '[]'); } catch { return []; } })(),
      brands: (() => { try { return JSON.parse(engineer.brands || '{}'); } catch { return {}; } })(),
      services: (() => { try { return JSON.parse(engineer.services || '[]'); } catch { return []; } })(),
      status: statusText[engineer.status] || engineer.status,
      current_orders: inProgress?.cnt || 0,
      monthly_completed: monthly?.cnt || 0,
      monthly_earnings: monthly?.earnings || 0,
      avg_rating: avgRating,
      rating_count: engineer.rating_count,
      total_completed: engineer.total_orders
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 工具2：查询待接单工单
async function toolGetPendingTickets(limit, env) {
  try {
    // 只查 pending 状态的工单（尚未分配工程师）
    const tickets = await env.DB.prepare(`
      SELECT wo.id, wo.order_no, wo.type, wo.description, wo.urgency, wo.created_at,
             d.type as device_type, d.brand as device_brand, d.model as device_model,
             c.name as customer_name
      FROM work_orders wo
      LEFT JOIN devices d ON d.id = wo.device_id
      LEFT JOIN customers c ON c.id = wo.customer_id
      WHERE wo.status = 'pending'
      ORDER BY
        CASE wo.urgency WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
        wo.created_at DESC
      LIMIT ?
    `).bind(Math.min(limit || 10, 20)).all();

    const typeText = { fault: '设备故障', maintenance: '维护保养', parameter: '参数调试', other: '其他' };
    const urgencyText = { normal: '普通', urgent: '紧急', critical: '非常紧急' };

    return {
      count: tickets.results?.length || 0,
      tickets: (tickets.results || []).map(t => ({
        order_no: t.order_no,
        device_type: t.device_type || '未知设备',
        device_brand: t.device_brand || '',
        device_model: t.device_model || '',
        problem: t.description,
        urgency: urgencyText[t.urgency] || t.urgency,
        type: typeText[t.type] || t.type,
        customer: t.customer_name || '匿名客户',
        created_at: t.created_at,
        time_ago: getTimeAgo(t.created_at)
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

// 辅助函数：获取相对时间字符串
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
```

---

### Task 3: 修改 handleChat — 加入 tools 参数

**Modify:** `worker/src/index.js:959-976`

找到：
```javascript
    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages,
          { role: 'user', content: message }
        ],
        stream: true,
        temperature: 0.7,
      }),
    });
```

替换为：
```javascript
    // 构建消息
    const allMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...messages,
      { role: 'user', content: message }
    ];

    const apiResponse = await fetch(env.OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: allMessages,
        tools: TOOLS_SCHEMAS,
        tool_choice: 'auto',
        stream: true,
        temperature: 0.7,
      }),
    });
```

---

### Task 4: 修改 handleChat — 处理工具调用流

**Modify:** `worker/src/index.js:1006-1065`（流式处理逻辑）

找到这段流式处理代码（从 `const stream = new ReadableStream` 开始）：

```javascript
    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') {
                if (trimmed === 'data: [DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n'));
                }
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6);
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                    const content = data.choices[0].delta.content;
                    fullContent += content;
                    const responseData = JSON.stringify({
                      content,
                      conversation_id: convId
                    });
                    controller.enqueue(encoder.encode(`data: ${responseData}\n`));
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (e) {
          // 处理错误
        } finally {
          // 保存 AI 响应到数据库
          if (fullContent) {
            try {
              await env.DB.prepare(
                'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
              ).bind(generateId(), convId, 'assistant', fullContent).run();
            } catch (e) {
              // 忽略保存错误
            }
          }
          controller.close();
        }
      }
    });
```

替换为：
```javascript
    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let toolCalls = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') {
                if (trimmed === 'data: [DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n'));
                }
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6);
                try {
                  const data = JSON.parse(dataStr);

                  // 检测工具调用
                  if (data.choices && data.choices[0].delta && data.choices[0].delta.tool_calls) {
                    toolCalls = data.choices[0].delta.tool_calls;
                  }

                  if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                    const content = data.choices[0].delta.content;
                    fullContent += content;
                    const responseData = JSON.stringify({
                      content,
                      conversation_id: convId
                    });
                    controller.enqueue(encoder.encode(`data: ${responseData}\n`));
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (e) {
          // 处理错误
        } finally {
          // 处理工具调用
          if (toolCalls && toolCalls.length > 0) {
            const toolCall = toolCalls[0];
            const toolName = toolCall.function?.name;
            const toolArgs = toolCall.function?.arguments
              ? JSON.parse(toolCall.function.arguments)
              : {};

            // 执行工具
            const toolResult = await executeTool(toolName, toolArgs, env, engineer_id);

            // 将工具结果作为消息注入
            const toolResultMessage = {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            };

            // 构建第二轮请求（不带 tools 参数，避免重复调用）
            const secondMessages = [
              ...allMessages,
              { role: 'assistant', content: fullContent },
              toolResultMessage
            ];

            const secondResponse = await fetch(env.OPENAI_API_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: secondMessages,
                stream: true,
                temperature: 0.7,
              }),
            });

            // 流式返回第二轮结果
            const secondReader = secondResponse.body.getReader();
            let secondBuffer = '';
            let finalContent = fullContent; // 保留第一轮内容

            try {
              while (true) {
                const { done, value } = await secondReader.read();
                if (done) break;

                secondBuffer += decoder.decode(value, { stream: true });
                const secondLines = secondBuffer.split('\n');
                secondBuffer = secondLines.pop() || '';

                for (const line of secondLines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed === 'data: [DONE]') {
                    if (trimmed === 'data: [DONE]') {
                      controller.enqueue(encoder.encode('data: [DONE]\n'));
                    }
                    continue;
                  }

                  if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.slice(6);
                    try {
                      const data = JSON.parse(dataStr);
                      if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                        const content = data.choices[0].delta.content;
                        finalContent += content;
                        const responseData = JSON.stringify({
                          content,
                          conversation_id: convId
                        });
                        controller.enqueue(encoder.encode(`data: ${responseData}\n`));
                      }
                    } catch (e) {
                      // 忽略
                    }
                  }
                }
              }
              fullContent = finalContent;
            } catch (e) {
              // 处理错误
            }
          }

          // 保存 AI 响应到数据库
          if (fullContent) {
            try {
              await env.DB.prepare(
                'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
              ).bind(generateId(), convId, 'assistant', fullContent).run();
            } catch (e) {
              // 忽略保存错误
            }
          }
          controller.close();
        }
      }
    });
```

---

### Task 5: 更新合伙人 Role Prompt（让 AI 知道何时调用工具）

**Modify:** `worker/src/index.js:221-249`（ROLE_PROMPTS.engineer 部分）

找到这部分：
```javascript
  engineer: `
【角色】你是 SAGEMRO 平台合伙人的业务助理。
...
```

在 engineer Role Prompt 的末尾添加：

```
## 工具调用指令
当合伙人询问以下类型问题时，必须先调用对应工具获取实时数据，再回答：
- 询问自身状态（钱包余额、信用分、评分、等级、提现等）→ 调用 get_engineer_profile
- 询问有哪些新工单可接、当前平台有哪些待接单工单 → 调用 get_pending_tickets_for_engineer
- 询问本月收入、本月完成工单数、当前处理中工单数 → 调用 get_engineer_profile

调用工具后，将工具返回的数据自然地融入回答中，不要机械地复述数据。
```

---

## 验证方式

实现完成后，用合伙人账号登录，向 AI 提问：

1. "我钱包里有多少钱？" → 应调用 `get_engineer_profile`，返回实时余额
2. "现在有哪些工单可以接？" → 应调用 `get_pending_tickets_for_engineer`，返回工单列表

可以通过 Cloudflare Workers 日志查看是否有工具调用记录。