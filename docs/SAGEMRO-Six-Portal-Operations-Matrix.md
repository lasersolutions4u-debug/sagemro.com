# SAGEMRO 六入口运营与升级矩阵

> 目的：明确 SAGEMRO 国际版、中国版、Admin、Engineer 的入口边界、数据边界和升级策略，避免后续运营和部署混乱。

## 一、当前判断

SAGEMRO 目前已经形成三类角色入口：

- 客户 / 访客入口：主站 `sagemro.com` / `sagemro.cn`
- 运营入口：`admin.sagemro.com` / `admin.sagemro.cn`
- 工程师入口：目标为 `engineer.sagemro.com` / `engineer.sagemro.cn`

但当前还没有完全产品化为六个独立入口：

- 主站和工程师端共用 `frontend/`。
- Admin 使用独立 `admin/` 项目。
- `.cn` 域名会自动调用 `api.sagemro.cn`。
- Worker 会按 `.cn` 域名或来源域名路由到 `DB_CN`。
- Engineer 独立域名部署 job、CORS 白名单和 `.cn` 登录跳转已补齐；Cloudflare Pages 项目和自定义域名仍需手动创建/绑定。
- 页面文案还未完整分成英文版和中文版，部分 UI 中英混用。

## 二、六入口矩阵

| 入口 | 域名 | 主要用户 | 默认语言 | 当前代码来源 | 当前部署状态 | 运营方式 |
| --- | --- | --- | --- | --- | --- | --- |
| 国际版主站 | `sagemro.com` | 海外客户、访客 | English | `frontend/` | Cloudflare Pages `sagemro-com` | 国际市场内容、海外客户服务 |
| 中国版主站 | `sagemro.cn` | 国内客户、访客 | 中文简体 | `frontend/` | Cloudflare Pages `sagemro-cn`，正式商用目标迁阿里云 | 国内备案、中文内容、国内客户服务 |
| 国际版 Admin | `admin.sagemro.com` | 海外运营/内部团队 | English 或中英双语 | `admin/` | Cloudflare Pages `sagemro-admin` | 国际业务运营 |
| 中国版 Admin | `admin.sagemro.cn` | 国内运营/内部团队 | 中文简体 | `admin/` | Cloudflare Pages `sagemro-admin-cn`，正式商用目标迁阿里云 | 国内业务运营 |
| 国际版 Engineer | `engineer.sagemro.com` | 海外工程师/服务代表 | English | `frontend/` 工程师工作台 | CI 部署目标已补齐，需创建 Pages 项目和绑定域名 | 海外服务执行 |
| 中国版 Engineer | `engineer.sagemro.cn` | 国内工程师/区域负责人 | 中文简体 | `frontend/` 工程师工作台 | CI 部署目标已补齐，需创建 Pages 项目和绑定域名，正式商用目标迁阿里云 | 国内服务执行 |

## 三、统一管理还是分别管理

推荐采用：**统一代码库，分市场配置，分数据运营，可选择同步升级**。

### 统一管理的部分

以下内容应保持一套代码、一套核心逻辑：

- 账号认证与权限模型
- 客户、工程师、Admin 的角色边界
- 工单状态机
- 派工、报价、服务报告、评价流程
- 安全修复
- 输入校验、PII 脱敏、IDOR 防护
- 关键测试用例

这些内容应该优先在 `main` 验证，再同步到中国版。

### 分别管理的部分

以下内容必须按市场拆开：

- 默认语言和 UI 文案
- 首页、招商、法务、隐私政策、AI 服务说明
- ICP/公安备案号展示
- API 地址和数据源
- AI 服务商
- 短信、推送、支付、对象存储
- 国内合规内容和数据出境策略

中国版不应因为英文站营销内容更新而被动变化；英文版也不应被国内备案或合规文案干扰。

## 四、升级策略

| 变更类型 | 推荐升级方式 | 原因 |
| --- | --- | --- |
| 安全漏洞、权限修复 | 国际版和中国版一起升级 | 防止任一市场暴露相同风险 |
| 工单流程、工程师工作台通用能力 | 先国际版验证，再中国版升级 | 降低国内正式服务风险 |
| 中国备案、隐私政策、中文营销内容 | 只升级中国版 | 避免影响国际用户体验 |
| 英文首页、海外招商、海外邮件流程 | 只升级国际版 | 避免影响国内备案口径 |
| 数据库 schema | 两边分别执行和验证 | 国际库与中国库必须隔离 |
| AI provider 或 prompt 调整 | 分市场灰度 | 国内外模型、合规、语言要求不同 |

## 五、技术整理建议

下一阶段应建立一个明确的运行配置层：

```text
market = "com" | "cn"
portal = "customer" | "admin" | "engineer"
locale = "en" | "zh-CN"
apiBase = "https://api.sagemro.com" | "https://api.sagemro.cn"
```

配置来源可以先按 hostname 推导，后续再扩展为构建环境变量：

- `sagemro.com` → `market=com`, `portal=customer`, `locale=en`
- `sagemro.cn` → `market=cn`, `portal=customer`, `locale=zh-CN`
- `admin.sagemro.com` → `market=com`, `portal=admin`
- `admin.sagemro.cn` → `market=cn`, `portal=admin`
- `engineer.sagemro.com` → `market=com`, `portal=engineer`
- `engineer.sagemro.cn` → `market=cn`, `portal=engineer`

这样后续可以做到同一套功能逻辑、不同市场内容和不同部署目标。

## 六、今天后的优先级

1. 在 Cloudflare 创建 `sagemro-engineer` / `sagemro-engineer-cn` Pages 项目并绑定 `engineer.*` 域名。
2. 把主站、Admin、Engineer 的关键文案抽到中英文文案表。
3. 中国版备案通过后，先上线合规静态首页，再迁移登录和业务功能。
4. 将中国版 API、数据库、对象存储、AI provider 迁到阿里云或国内合规服务。

## 七、当前风险

- 项目根 `AGENTS.md`、`DEPLOY.md`、`TECH-SPEC.md` 曾存在口径不一致，后续必须以代码和 workflow 为准定期校对。
- 本地前端/admin 构建依赖存在 Windows optional dependency 缺失问题，需要在干净环境或 CI 中验证。
- `main` 当前落后远端提交，且本地有未提交修改，正式开发前必须整理分支状态。
- 中国版备案期间不得恢复 `sagemro.cn` / `www.sagemro.cn` 解析，也不得正式开放业务功能。
