# 上线前核查清单（Launch Checklist）

本文档列出所有需要在 **正式上线前** 手工执行的步骤。仓库代码已经通过 P0/P1/P2 全部整改，但以下事项涉及生产数据或外部系统，不在代码自动化范围内。

---

## 1. 数据清理（生产 D1）

### 1.1 先跑预演（只读）

```bash
cd worker
wrangler d1 execute sagemro-db \
  --file migrations/data_fixes/cleanup_test_accounts_preflight.sql \
  --env production --remote
```

把结果贴给负责人确认：
- 需要删除的 customers / engineers 列表是否全是测试号
- 级联删除的工单/设备/钱包流水数量是否合理

### 1.2 确认后再跑真删除

```bash
wrangler d1 execute sagemro-db \
  --file migrations/data_fixes/cleanup_test_accounts.sql \
  --env production --remote
```

> ⚠️ 这一步不可逆。务必先 1.1 再 1.2。

---

## 2. 数据库迁移（生产 D1）

确保 `migrations/009_add_customer_onesignal.sql` 已经在生产库执行：

```bash
cd worker
wrangler d1 execute sagemro-db \
  --file migrations/009_add_customer_onesignal.sql \
  --env production --remote
```

验证：

```bash
wrangler d1 execute sagemro-db --command \
  "SELECT name FROM pragma_table_info('customers') WHERE name='onesignal_player_id';" \
  --env production --remote
# 应返回一行：onesignal_player_id
```

---

## 3. Workers 部署

```bash
cd worker
wrangler deploy --env production
```

部署后确认日志没有 runtime error，然后跑冒烟测试。

---

## 4. 冒烟测试（Smoke Test）

```bash
cd worker
API_BASE=https://sagemro-api.lasersolutions4u.workers.dev node tests/smoke.mjs
```

预期 5 组全部 PASS（IDOR 组若没传 SMOKE_CUST_TOKEN 会 SKIP，可以接受）。

如果任何一组 FAIL，**不要上线**，先回查。

补充用例（可选，要填测试 token）：

```bash
SMOKE_CUST_TOKEN=xxx SMOKE_OTHER_ORDER_ID=wo-yyy \
  API_BASE=https://sagemro-api.lasersolutions4u.workers.dev \
  node tests/smoke.mjs
```

---

## 5. 单元测试

本地跑一遍确保 auth 工具没有回归：

```bash
cd worker
npm test           # 或 node --test tests/auth.test.mjs
```

预期 20/20 pass。

---

## 6. 域名与 HTTPS

- [ ] `sagemro.com` 解析到 Cloudflare Pages（前端）
- [ ] `admin.sagemro.com` 解析到管理后台
- [ ] `api.sagemro.com` 解析到 sagemro-api Worker（生产）
- [ ] 三个域名全部启用 HTTPS（Cloudflare Universal SSL 即可）
- [ ] `frontend/.env.production` 里 `VITE_API_BASE` 指向 `https://api.sagemro.com` 或 Workers 默认域名

验证（任一即可）：

```bash
curl -I https://sagemro.com
curl -I https://api.sagemro.com/api/auth/send-code -X OPTIONS -H "Origin: https://sagemro.com"
```

---

## 7. CORS 白名单

检查 `worker/src/index.js` 的 CORS 白名单包含生产域名：

```js
const ALLOWED_ORIGINS = [
  'https://sagemro.com',
  'https://www.sagemro.com',
  'https://admin.sagemro.com',
  // 开发环境按需添加
];
```

---

## 8. OneSignal 推送（新增字段后启用）

- [ ] 生产环境 Worker 已通过 `wrangler secret` 设置：
  - `ONESIGNAL_APP_ID`
  - `ONESIGNAL_REST_API_KEY`
- [ ] 前端 `.env.production` 里 `VITE_ONESIGNAL_APP_ID` 已配置
- [ ] 客户/工程师登录后能看到"启用推送通知"入口（客户端订阅由 `usePushNotification` 自动处理）
- [ ] 随便下一个工单，工单状态变化（接单/报价/完成/评价）应触发推送到对应方

---

## 9. 密钥与环境变量

确认生产 Worker 已设置以下 secret（`wrangler secret list --env production`）：
- `JWT_SECRET`（≥32 字符随机串，**不要**复用测试环境）
- `OPENAI_API_KEY`
- `OPENAI_API_ENDPOINT`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- 短信网关相关密钥（按实际网关）

---

## 10. 监控与回滚

- [ ] Cloudflare Workers 仪表盘的实时日志（Tail Logs）在上线后 30 分钟内有人盯
- [ ] 回滚预案：记下当前部署的 deployment id，出问题立刻 `wrangler rollback`

---

## 完成签字

- [ ] 数据清理 ✅ 负责人：______   日期：______
- [ ] 迁移执行 ✅ 负责人：______   日期：______
- [ ] 冒烟测试通过 ✅ 负责人：______
- [ ] 域名/HTTPS 就绪 ✅ 负责人：______
- [ ] 正式放量 ✅ 日期：______
