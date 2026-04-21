# 部署说明

## 部署目标（统一为 Cloudflare 全家桶）

| 组件 | 目标 | 配置 |
|------|------|------|
| 前端官网 (`sagemro.com`) | Cloudflare Pages | `wrangler.toml`（根目录） |
| 管理后台 (`admin.sagemro.com`) | Cloudflare Pages | （项目独立配置） |
| API 后端 (`api.sagemro.com`) | Cloudflare Workers | `worker/wrangler.toml` |
| 数据库 | Cloudflare D1 | `sagemro-db` |
| 缓存 | Cloudflare KV | 见 `worker/wrangler.toml` |

> **Netlify 已停用**：历史上前端同时配过 Netlify（`netlify.toml`）和 Cloudflare Pages，两者并存会造成双重部署和流量分裂。现已统一到 Cloudflare Pages。原 `netlify.toml` 备份为 `netlify.toml.deprecated`，确认 Pages 正常运行一段时间后可删除。

## CI/CD（GitHub Actions）

`.github/workflows/deploy.yml` 触发条件：push 到 `main`。

### 所需 secrets

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需要 Pages + Workers 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

### 本地部署

```bash
# 部署 Worker（生产）
cd worker
npx wrangler deploy --env production

# 部署前端到 Pages
cd frontend
npm run build
cd ..
npx wrangler pages deploy frontend/dist --project-name=sagemro-frontend --branch=main

# 执行数据库迁移
cd worker
for f in migrations/*.sql; do
  npx wrangler d1 execute sagemro-db --file "$f"
done
```

## 环境变量 / Secrets（Worker）

`worker/wrangler.toml` 中不能放敏感密钥。敏感值通过 `wrangler secret put` 设置：

```bash
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put OPENAI_API_ENDPOINT --env production
wrangler secret put JWT_SECRET --env production
wrangler secret put ONESIGNAL_REST_API_KEY --env production
```

## 回滚

- 前端：Cloudflare Pages Dashboard → 历史部署 → Rollback
- Worker：`wrangler deploy --env production`（手动覆盖）或在 Cloudflare Dashboard 重新部署历史版本
