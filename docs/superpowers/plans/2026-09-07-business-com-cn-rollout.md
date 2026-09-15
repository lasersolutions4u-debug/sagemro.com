# 商务服务 COM/CN 分步上线与回滚实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本文件只描述方案，不授权生产写入、分支合并、发布或额外代理。

**Goal:** 在保留现有客户及工程师记录、维持 Admin 集中授权的前提下，安全发布商务报价、收款派单和服务执行流程。

**Architecture:** COM/CN 共用 `sagemro-api` Worker，分别绑定 `DB` 和 `DB_CN`。必须先完成两套数据库准备，再切换共享 Worker，随后更新国际版 Pages 和中国版阿里云页面；不能把共享 API 当作两个可独立发布的 API。

**Tech Stack:** GitHub Actions、Cloudflare Workers / D1 / Pages、阿里云 ECS / nginx、React、Node 24、Playwright。

---

## 0. 当前状态与授权边界

- 本计划依据业务分支提交 `3dd7fc19acc73c3f17099d160c7cdd98c82cb4e2`、本地 workflow、迁移文件和既有部署文档编制。未在本轮读取生产配置、数据库或客户资料。
- [x] 该提交的[云端完整验证](https://github.com/lasersolutions4u-debug/sagemro.com/actions/runs/34112186357)成功：Worker 307 + 1013、前端 473、Admin 171、E2E 契约 21、业务浏览器 23、完整流程 8；不是生产验收结果。
- [x] [PR #90](https://github.com/lasersolutions4u-debug/sagemro.com/pull/90)在上一轮核验时为草稿，自动合并关闭；四个正式部署任务均跳过。
- [x] 2026-09-07 的 COM/CN 新公钥备份已分别完成校验、解密和内存 SQLite 恢复检查；这不是本次 050–055 的 D1 迁移演练。
- [x] 用户确认恢复密钥已保存至 Bitwarden、另一设备可读取、剪贴板已清理；本机原凭据保留。私钥及客户数据不得进入本文件、Git 或日志。
- [ ] 当前在线版本、两库最新迁移记录、当前业务写入情况及正式发布窗口：必须在获准的生产只读预检阶段重新核实，不以历史信息代替。
- [ ] 本计划没有执行 050–055，没有合并、发布、停用账号或改变真实订单。

本轮只新增本计划文件。后续改动、提交推送、合并、生产备份、迁移、发布、权限变更和回滚分别展示范围并取得明确授权。出现 500、数据或数据库异常立即停止并告知 Joe，不自动修复或反复重试。

## 1. 目标与顺序

| 目标 | 当前仓库定义的生产位置 | 发布或验证条件 |
| --- | --- | --- |
| COM 数据库 | D1 `sagemro-db` | 只补缺失的 050–055；保留既有 049 |
| CN 数据库 | D1 `sagemro-db-cn` | 只补缺失的 050–055；不应用 COM 专用 049 |
| 共享 API | Worker `sagemro-api`，`env=production`；服务两个 API 域名 | 两库均完成迁移和校验后才部署 |
| 国际版后台 | Pages `sagemro-admin` | 先共享 Worker，后后台；当前仍需补顺序约束 |
| 国际版客户工作台 | Pages `sagemro-ai`，制品 `frontend/dist-portal` | Worker 成功后部署，验证隐私抓取限制 |
| 国际版公开站与工程师端 | Pages `sagemro-com`，制品 `frontend/dist` | 按现有 workflow 等待 AI 门户成功；工程师入口单独验收 |
| 中国版公开站、客户工作台、后台、工程师端 | 阿里云 `/var/www/sagemro-cn/current/{frontend,ai,admin,engineer}` | `china-edition` 验证通过后单独批准阿里云 workflow |

中国版 Pages 是辅助目标，成功不代表 `.cn` 实际线上页面已更新。发布前逐项确认域名仍指向上述平台；不在本计划中改 DNS、证书或域名绑定。

目标顺序：发布依赖修正及完整 CI → 隔离迁移演练 → 生产只读预检及窗口确认 → 两库新鲜备份 → COM 迁移和校验 → CN 迁移和校验 → 共享 Worker → 两域 API 验证 → COM 页面 → CN 分支验证和阿里云页面 → 分市场验收。

## Task 1: 先补后台发布顺序，不接触生产

**Files:** 修改 `.github/workflows/deploy.yml`；测试 `e2e/tests/ci-gate-contract.test.mjs`。此任务尚未实施，需单独批准。

当前 `deploy-admin` 只有 `needs: test`，与 Worker 并行。仅依靠同一个 `production` 审批不能表达“后台必须等 Worker 成功”。建议把依赖改为下面的完整条件，保留 `china-edition` 的独立后台辅助发布，不改变任何审批、目标或密钥。

- [ ] 先更新已有 `Cloudflare deploy jobs remain push-only with the existing branch guards` 测试中的 Admin 断言，并增加下面的精确依赖检查；观察旧配置失败。

```js
const adminJob = workflow.slice(workflow.indexOf('  deploy-admin:'));
assert.match(adminJob, /^\s+needs: \[test, deploy-worker\]$/m);
const expectedAdminIf = "github.event_name == 'push' && !cancelled() && needs.test.result == 'success' && ((github.ref == 'refs/heads/main' && needs['deploy-worker'].result == 'success') || (github.ref == 'refs/heads/china-edition' && needs['deploy-worker'].result == 'skipped'))";
assert.equal(adminJob.match(/^\s+if: (.+)$/m)?.[1], expectedAdminIf);
```

- [ ] 只替换 Admin job 的 `needs` 和 `if` 两行：

```yaml
    needs: [test, deploy-worker]
    if: github.event_name == 'push' && !cancelled() && needs.test.result == 'success' && ((github.ref == 'refs/heads/main' && needs['deploy-worker'].result == 'success') || (github.ref == 'refs/heads/china-edition' && needs['deploy-worker'].result == 'skipped'))
```

- [ ] 从仓库根目录运行 `node --test e2e/tests/ci-gate-contract.test.mjs`，预期全部通过；核对 PR、main 成功/失败、china-edition 的 Worker skipped、test 失败和取消场景，不能放宽失败时的拦截。
- [ ] 经批准才提交推送到现有草稿 PR，再等待新 HEAD 的 Ubuntu 完整 CI；不能沿用 `3dd7fc1` 的通过状态宣称新版本已验证。

停止条件：依赖/分支条件不符合上述边界，或任何测试失败。禁止通过取消审批、直接部署后台绕开依赖问题。

## Task 2: 发布前迁移演练与回滚资格核对

**Files:** 只读 `worker/migrations/050_engineer_service_profiles.sql` 至 `055_business_service_execution.sql`、`worker/src/lib/businessIdentity.js`、`worker/src/lib/requestAuth.js`、`worker/tests/business-service-execution.test.mjs`。生产演练不修改这些文件。

| 顺序 | 文件 | 影响及重点验证 |
| --- | --- | --- |
| 050 | `050_engineer_service_profiles.sql` | 新增工程师私有费用/能力资料表 |
| 051 | `051_business_scope.sql` | 账号增加 `business_profile_required`；新增商务组织、辖区、归属和版本触发器 |
| 052 | `052_business_quote_costs.sql` | 报价与历史增加来源；新增商务草稿及不可改写的成本快照 |
| 053 | `053_business_receipt_actors.sql` | 重建到账申报、凭证元数据表；必须保持原记录及关联 |
| 054 | `054_business_execution_assignments.sql` | 新增实际商务执行人、互斥与状态保护 |
| 055 | `055_business_service_execution.sql` | 重建到场签到、工作日、现场媒体、延期、日报修订五张表；新增商务服务状态和动作记录 |

- [ ] 获准后获取两库的最新结构和迁移记录，在隔离本地 D1 中重现各自基线；禁止向空库盲目重放所有历史迁移，禁止把最新 `schema.sql` 当作生产升级脚本。
- [ ] 先用虚构的旧工程师、工单、到账申报、凭证和现场记录，逐个演练各库缺失的 050–055。055 的现有 SQLite 测试不能替代两套真实结构基线上的完整 D1 演练。
- [ ] 若要使用真实备份演练，先单独确认处理范围：只在受限本机隔离环境解密、禁止应用外发、禁止打印业务内容；不得写进仓库或使用生产 database ID 的本地/远端配置。
- [ ] 每个迁移文件核对版本记录、目标列/表/索引/触发器及外键检查；053、055 比较迁移前后所有原记录的主键和原字段、关联一致性，仅记录计数和通过/失败，不输出客户内容。仅行数相等不算数据一致。
- [ ] 检查正在使用的旧 Worker 对迁移后结构仍可读写旧工程师流程。只有这项通过，才能让迁移与新 Worker 发布之间保留旧 API 服务。
- [ ] 确定发布维护窗口及写入控制办法，覆盖两个市场、客户端、后台、工程师端和后台定时任务；没有验证有效的写入控制，不开始表重建，也不承诺零停机。
- [ ] 从正式平台读取并记录旧 Worker 版本 ID、Pages 部署 ID、CN 四个链接的真实目标；这些值现在未读取，不能把 Git SHA 当作部署 ID，也不能根据目录名猜测上一版本。

验证命令（隔离本地测试，工作目录 `worker/`）：

```powershell
node --test tests/business-execution-api.test.mjs tests/business-service-execution.test.mjs tests/business-quote-api.test.mjs tests/business-workspace.test.mjs
```

通过条件：不仅测试绿灯，还要有各库基线演练、旧 API 兼容及实际可恢复版本的证据。未完成时只保留草稿 PR，不进入生产迁移。

## Task 3: 生产只读预检、备份和迁移批准

**Files:** 只读 `worker/wrangler.toml`、`.github/workflows/d1-backup.yml`、`DEPLOY.md`。以下命令是审批后使用的清单，本轮未运行。

- [ ] 先单独批准生产只读预检。从 `worker/` 分别查询版本；只取结构和聚合状态，不导出真实客户列表：

```powershell
npx wrangler d1 execute sagemro-db --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"
npx wrangler d1 execute sagemro-db-cn --env production --remote --command "SELECT version FROM _migrations ORDER BY version;"
```

- [ ] 将查询结果与 050–055 逐项对照；已应用的不重复执行。051、052 含 `ALTER TABLE ADD COLUMN`，053、055 含表重建，不能把 `INSERT OR IGNORE` 的迁移标记误认为整个文件幂等。
- [ ] CN 保留手机号数据库约束，不执行 `049_nullable_international_customer_phone.sql`；若其已存在或结构与历史预期不符，停止并报告，不自行逆迁移。
- [ ] 在已确认窗口内，单独批准 COM/CN 备份任务，取得实际成功的两份新产物；核对 recipient、生成时间、SHA-256、可解密性。等待审批的任务不是备份，旧备份不能自动代替发布前的新备份。
- [ ] 确认到账和现场媒体对应的 R2 对象保留策略；D1 SQL 备份只含对象元数据，不含照片/附件本体。此轮不清理对象或旧 release。
- [ ] 向 Joe 展示两库的确切缺失文件、053/055 表重建影响、窗口、备份证据及恢复限制，取得“执行生产迁移”专项确认。

## Task 4: 两库逐项迁移，再放行共享 API

**Files:** 只使用已验证提交中的上述六个迁移文件，不修改 SQL 内容，不新增临时生产脚本。

- [ ] COM 按 050 → 051 → 052 → 053 → 054 → 055，仅逐个执行确实缺失的文件；每次完成后校验再继续。
- [ ] COM 全部通过才对 CN 执行相同顺序；CN 不含 049。
- [ ] 执行形式为 `npx wrangler d1 execute` 的单文件命令，明确数据库和 `--env production --remote`；每条命令在执行前展示真实完整文件名，不提供无条件批量循环。
- [ ] 每次执行后核对对应 `_migrations` 行及结构；053/055 按 Task 2 的数据一致性标准校验，原有工程师关联应保留、新 `staff_id` 不应错误填充到旧记录。
- [ ] 如果命令超时、返回不确定或任一检查失败，停止后续文件，先只读判断实际数据库状态，不直接重跑、不手工删除迁移标记。
- [ ] 任一市场未准备好，共享 Worker 均不发布。COM 成功而 CN 失败不代表两库自动一起回滚；保留实际状态，按已验证的旧 API 兼容方案处理，并请求新的修复授权。
- [ ] 两库均通过后，再确认是否解除维护控制或继续到 API 切换；只有用户批准的发布窗口内才能继续。

## Task 5: 合并和分阶段发布

**Files:** `.github/workflows/deploy.yml`、`.github/workflows/aliyun-cn-deploy.yml`；本计划不修改 DNS、证书、数据库绑定或平台 Secret。

- [ ] 确认 Task 1 顺序约束已实施，新 HEAD 完整 CI 成功、备份和两库迁移证据齐备。再次核对 PR diff，取得合并和具体生产目标的授权。
- [ ] 合并 PR #90 后，核对 main 的实际合并 SHA 及其测试运行；只批准与该 SHA 对应的生产任务，不批量批准旧任务或无关任务。
- [ ] 先共享 Worker；随后从两个 API 域名检查 `/health`、市场路由、认证边界及结构只读探针。HTTP 200 不能代替版本、市场隔离或功能验收。
- [ ] Worker 通过后，再批准国际版 Admin 与 AI 门户；按原 workflow 等 AI 门户通过后发布公开站。保持 Admin 集中审核、派单，不在发布过程中创建或提升商务账号。
- [ ] 为中国版单独提出同步分支的变更清单，保留 CN 差异；经批准同步到 `china-edition` 后，对其最终 SHA 重跑完整测试，不以 main 的测试代替。
- [ ] 中国版测试和共享 API 兼容检查通过后，单独批准阿里云发布。入口是 `gh workflow run aliyun-cn-deploy.yml --ref china-edition`，此处仅记录命令，未执行。
- [ ] 记录本次 CN release ID，核对四个链接 `frontend`、`engineer`、`ai`、`admin` 均指向预期制品。现有脚本逐个替换链接，不是四站原子切换，也没有健康检查失败后的自动回退。
- [ ] 阿里云流程会为 runner 的 `/32` 地址临时开放既定 SSH 端口、上传制品、重载 nginx，再撤销临时规则；这也是生产配置影响，必须纳入发布授权。确认清理步骤成功，不新增全网 SSH 规则。
- [ ] 记录平台实际部署版本及结果；Cloudflare CN 辅助站成功不能代替阿里云生产验收。

## Task 6: 验收后再决定是否放权

**Files:** `admin/src/pages/BusinessWorkspacePage.jsx`、`admin/src/components/BusinessQuotePanel.jsx`、`BusinessPaymentPanel.jsx`、`BusinessExecutionPanel.jsx`、`BusinessServicePanel.jsx`；`frontend/src/components/Engineer/EngineerServiceProfileForm.jsx`；本任务只验证，不修改。

- [ ] COM/CN 的公开站、AI、Admin、工程师入口分别可访问，语言和 API 市场正确；私人入口抓取限制仍有效。
- [ ] 用户亲自登录确认可见入口；若需代理使用真实账号，只另行批准只读范围，不复制 Token/Cookie、导出客户名单或截图敏感内容。
- [ ] “商务工作台”显示在授权的 Admin/商务身份内；工程师本人费用与能力资料仍只通过工程师端维护。
- [ ] 在隔离虚构流程中证明：成本/预计毛利仅内部可见；客户确认报价和开工款核实后才可派单；未分配工程师不能读取订单客户联系资料或参与该订单消息。
- [ ] 在隔离虚构流程中证明：无人覆盖时由 Admin 指定商务承接，商务可在 Admin 提交现场和最终报告，不伪造 engineer 账号、评分或分成；客户验收不等于尾款到账。
- [ ] 真实生产不为验收创建报价、确认付款、派单、发送通知或提交报告。确需生产试点时，单独确认测试人员、订单、通知及财务隔离办法。
- [ ] 仍由 Admin 集中授权和审批。商务知识库完整写入授权、毛利绩效/薪资/分红结算、本地仓合作投资、后续分级放权不在本轮发布范围。

## Task 7: 异常停止与回滚决策

| 发生阶段 | 立即动作 | 可采用的恢复方向及限制 |
| --- | --- | --- |
| 合并/生产动作之前 | 停止，保留草稿和证据 | 无需生产回滚，修复测试后重新审批 |
| 迁移返回不确定、结构或数据校验异常 | 停止两个市场的后续迁移/发布，报告实际状态 | 不重跑不明状态的 SQL；不用反向 DROP 或删 `_migrations` 掩盖问题 |
| 一个数据库已迁移、另一个未完成 | 停止共享 Worker 发布 | 已成功的迁移不会因另一库失败自动撤销；仅使用 Task 2 已验证的兼容路径 |
| 新页面失败、共享 API 正常 | 停止后续页面，记录失败目标 | 经确认恢复该 Pages 旧部署或 CN 旧链接；保留新数据库及正常 API |
| 新 Worker 失败，但未启用新业务 | 停止放权和新增操作，报告影响 | 必须证明旧 Worker 对新结构、旧/新账号均兼容，才可申请应用回退；不是直接“一键回滚” |
| 已有商务账号或商务执行记录 | 停止不安全回退 | 旧 Worker 若忽略 `business_profile_required`，可能把商务当成旧 operations；若忽略 `staff_id`，也可能无法处理商务服务记录。优先保留身份/归属保护的兼容修复；停用账号及会话处理必须另批，不能认为停一个账号就解决所有兼容问题 |
| CN 四个链接部分切换或健康检查失败 | 停止，不重复运行整个发布任务 | 经确认按发布前逐项记录的真实目标恢复四个链接，验证 nginx 和站点；不猜路径，不删除旧 release |
| 确需恢复数据库备份 | 单独升级处理并取得明确授权 | 先留存当前状态和新增业务，核算备份时间之后的数据损失，确认停写及恢复点，在隔离 D1 验证后再谈生产恢复；不得用整库覆盖作为常规版本回滚 |

数据库“代码回退”和“数据恢复”分开审批。照片/附件本体与 D1 元数据必须一致，不删除新媒体对象或改动保留策略来凑齐回滚。

Cloudflare 官方说明：Worker 回退不会回退存储的数据状态，资源绑定变化还可能限制版本回退，参见[Workers 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。表重建涉及的外键检查延期只在相应事务范围内有效，不等于关闭数据约束，参见[D1 外键](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)。

## 执行前决策

推荐下一步仅批准 Task 1 的两个本地文件修正和测试，暂不执行生产动作。它通过后再安排 Task 2–3 的范围、发布窗口、维护/写入控制及最新版本采集。尚未证明旧 API 兼容或明确异常恢复资格时，不开始 053/055 表重建。
