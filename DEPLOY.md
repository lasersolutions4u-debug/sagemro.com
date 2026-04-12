# SAGEMRO 部署指南

## 前置准备

### 1. Cloudflare 账号准备
确保你有 Cloudflare 账号并完成以下设置：

### 2. 获取 Cloudflare API Token
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **My Profile** → **API Tokens**
3. 点击 **Create Token** → **Create Custom Token**
4. 配置以下权限：
   - **Account**:
     - `Cloudflare Workers Scripts` - Edit
     - `Cloudflare D1` - Edit
     - `Cloudflare KV Namespaces` - Edit
   - **Zone**:
     - `Cloudflare Pages` - Edit (如果使用 Pages)
     - `Zone Settings` - Read
     - `DNS` - Edit
5. 点击 **Create Token** 并复制生成的 Token

### 3. 添加 GitHub Secrets
在 GitHub 仓库中添加以下 Secrets：
1. 进入 `https://github.com/lasersolutions4u-debug/sagemro.com/settings/secrets/actions`
2. 添加：
   - `CLOUDFLARE_API_TOKEN`: 你创建的 API Token
   - `CLOUDFLARE_ACCOUNT_ID`: 你的 Cloudflare Account ID（在 Cloudflare Dashboard 右侧找到）

---

## Cloudflare 资源创建

### 1. 创建 D1 数据库
```bash
cd worker

# 登录 Cloudflare（如果需要）
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create sagemro-db

# 会输出 database_id，复制它
```

### 2. 更新 wrangler.toml
编辑 `worker/wrangler.toml`，将 `your-database-id-here` 替换为实际创建的 database_id：

```toml
[[d1_databases]]
binding = "DB"
database_name = "sagemro-db"
database_id = "你复制的database_id"
```

### 3. 创建 KV Namespace
```bash
npx wrangler kv:namespace create "SAGEMRO_KV"
```

将返回的 `id` 填入 wrangler.toml：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你复制的KV_id"
```

### 4. 运行数据库迁移
```bash
npx wrangler d1 migrations apply sagemro-db --local
# 或在生产环境：
npx wrangler d1 migrations apply sagemro-db --remote --env production
```

### 5. 部署 Worker
```bash
cd worker
npx wrangler deploy --env production
```

---

## Cloudflare Pages 部署

### 1. 在 Cloudflare Dashboard 创建 Pages 项目
1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
3. 连接 GitHub 仓库：`lasersolutions4u-debug/sagemro.com`
4. 配置构建：
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`
5. 点击 **Save and Deploy**

### 2. 配置自定义域名
1. 在 Pages 项目设置中，进入 **Custom domains**
2. 添加你的域名（如 `sagemro.com` 或 `www.sagemro.com`）
3. Cloudflare 会自动配置 SSL 证书

---

## Worker 自定义域名（可选）

如果 API 需要独立域名（如 `api.sagemro.com`）：

1. 在 Cloudflare Dashboard 进入 Workers → 选择 `sagemro-api`
2. 点击 **Triggers** → **Custom Domains**
3. 添加你的 API 子域名

---

## 更新 Worker API Endpoint

部署完成后，更新前端 API 地址：

编辑 `frontend/src/services/api.js`：
```javascript
const API_BASE = 'https://api.sagemro.com';  // 你的 API 域名
```

或者保持使用 Cloudflare Workers 默认域名：
```javascript
const API_BASE = 'https://sagemro-api.your-account.workers.dev';
```

---

## 部署状态检查

部署后访问以下地址确认：
- 前端：`https://sagemro.com`（或你配置的自定义域名）
- Worker 健康检查：`https://api.sagemro.com/health`
- API 测试：`https://api.sagemro.com/api/workorders?customer_id=test`

---

## 故障排查

### 1. Worker 部署失败
```bash
# 本地测试
npx wrangler dev

# 查看日志
npx wrangler tail
```

### 2. D1 数据库连接失败
- 确认 `wrangler.toml` 中的 `database_id` 正确
- 确认 D1 数据库绑定名称是 `DB`（与代码中一致）

### 3. 前端无法连接 API
- 检查 `API_BASE` 地址是否正确
- 检查 Cloudflare CORS 配置
