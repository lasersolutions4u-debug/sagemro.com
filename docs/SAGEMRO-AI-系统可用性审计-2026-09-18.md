# SAGEMRO 系统可用性审计（COM / 海外市场）

| 项 | 值 |
| --- | --- |
| 审计日期 | 2026-09-18（修订版 2） |
| 代码基线 | `58bdbcc`（main） |
| **范围** | **仅 COM / 海外市场**。中文站（`sagemro.cn` 系列）明确排除，相关条目已全部移出 |
| 使用者 | ① 海外客户 ② 海外客服工程师（`engineer.sagemro.com`） ③ 国内商务团队（`admin.sagemro.com`） |
| 审计方式 | **只读**代码审计 + 工作区数据统计 |
| **未做** | 未连生产 D1、未调用线上 API、未运行构建与测试 |
| 证据口径 | 每条结论附 `file:line`；无法验证的集中在附录 B；审计中修正过的判断集中在附录 A |

> **修订说明**：本版相对初版有三处实质变化——① 删除全部 CN/双市场内容；② 新增「国内商务团队」整块（初版完全没覆盖，是最大空白）；③ 修正 6 处判断，其中 **2 处是主审计人自己的错误**（见附录 A）。行号会随代码演进漂移，引用时请以符号名（函数名/常量名）为准。

---

## 0. 一页结论

**工程师主流程很稳；商务侧机制扎实但入口设计有坑；AI 的质量没有证据支撑。**

1. **服务交付不依赖 AI。** 服务标准 6 步 18 项、报告质量校验、报价付款闸门、领料全部是确定性代码。海外客服工程师能用的 AI 只有工单详情右栏一张「AI 服务指引」卡。**AI 挂掉不影响交付。**
2. **「商务承接服务」不是质量旁路。** 商务执行人复用工程师同一套 handler，6 步 18 项、报告质量、resolve/handover gate 同样生效（`handleSaveRepairRecord:8050`、`handleResolveWorkOrder:18353`）。
3. **但商务承接是 AI 与知识的双重黑洞。** 商务服务记录**永远不会**进入知识沉淀（`knowledge-candidates.js:66,76` 硬要求 `engineer_id`），商务执行人**100% 没有 AI 触点**（`index.js:6357` 只认 engineer）。
4. **两个死锁会让工单永远无法完成。** `site_timezone` 在报价确认后不可写，而 `fixed_date` 分期收款需要它 → 该期永远收不到 → 工单永远不能 `completed`。只能 Admin 人工放行。
5. **AI 的信心没有证据。** 黄金集 74 条里 30 条（含全部安全场景）在 CI 里硬编码 `pass: true`。
6. **工程师沉淀的经验进不了 AI。** 候选审核通过写入固定为 `draft`，而唯一发布接口对候选来源返回 409。**同时**商务同事直传知识库是通的（默认即发布）——快路径活、慢路径死。
7. **海外客户手机号明文进 LLM**，而你们对海外客户展示的隐私政策写着「我们不会发送您的手机号」（`privacy-policy.md:81`）。
8. **辖区配置有一个会静默致盲的坑**：UI 只允许「总监」角色持有辖区，先招专员/经理且无总监 → 那个人永远看不到任何业务数据，页面只说「暂无资料」。

### 给团队的表述建议

> **不要介绍成「AI 驱动」，介绍成「流程驱动，AI 辅助」。**
> 前者目前拿不出证据；后者是代码事实。

---

## 1. 三类使用者的真实入口

| 谁 | 入口 | 账号体系 | 实际能用什么 |
| --- | --- | --- | --- |
| 海外客户 | `sagemro.com` + `ai.sagemro.com` | 客户账号 / 游客 | AI 对话、服务申请、工单与报价确认、评价 |
| 海外客服工程师 | `engineer.sagemro.com` | 工程师账号（人工审核开通） | 工单、服务标准 6步18项、**AI 服务指引**、报告、领料、现场打卡 |
| 国内商务团队 | `admin.sagemro.com`（COM 市场） | `admin_staff_accounts` + `business_staff_profiles`，角色 `business_specialist/manager/director`（各 3 档） | 客户/线索/工单（**受辖区约束**）、报价、收款、知识库上传、可被指派为服务执行人 |

**关键机制**：`admin/src/App.jsx:313` 的 `useBusinessRecords` 在 COM 下把 admin 与商务角色的客户/线索/工单三个页面换成 `BusinessRecordsPage`，走 `/api/admin/business/records`（受辖区约束）。COM 下 `businessWorkspace` 菜单对所有角色隐藏（`App.jsx:202`）。

**服务端权限**：商务角色在服务端**只**被放行 `/api/admin/business/*` 与 `/api/admin/knowledge[/]`（`index.js:23503-23508`）。

---

## 2. 四条链路的真实工作原理

### 2.1 海外客户：对话链路

```
POST /api/chat
  → JWT 认证（earlyAuth + handler 内各自证一次）
  → 访客限流（CF-Connecting-IP 30/h，KV 异常 fail-open）
  → 配额占坑 enforceOpenAIBudget（每请求 +1）
  → 取历史消息（无 LIMIT）
  → 按角色生成 dataContext
  → 拼装 system prompt（6 层，拼装点 index.js:4746）
  → 循环：上游 LLM（最多 MAX_TOOL_ITERATIONS=4 轮工具 + 1 轮收口）
  → sanitizeCustomerVisibleAiContent（术语替换）
  → 落库 + 达阈值生成摘要 → SSE 下发
```

**提示词 6 层**：`SYSTEM_PROMPT`（`713-940`）+ `ROLE_PROMPTS`（`944-1079`，admin/system 落 guest）+ `marketContext`（`4715-4725`）+ `dataContext`（`4018-4158`）+ `finalResponseContract`（`4726-4741`）+ `intakeContract`（`4742-4745`）。

**23 条响应门禁**（`778-804`）——全部**只存在于提示词，服务端零运行时校验**，唯一后处理是 7 条术语替换（`4253-4264`）：安全门禁（高风险先停机、首句必须停机/隔离、禁拆镜片、禁空放激光、禁带电检测…）、证据门禁（禁未验证数值、焦点方向不得推断、一次只改一个变量）、问句门禁（全篇 ≤1 问号）、格式门禁（英文 80-140 词 / 中文 100-180 字）。

**门户的关键限制**：前端恒定发送 `serviceRequestOnly: true`（`frontend/src/hooks/useChat.js:55`），导致：
- `create_work_order` 工具被摘除（`index.js:4928`）
- 服务端启发式建单不可达（`index.js:4814`）
- **`maybeCreateMachineLeadFromChat` 不可达（`index.js:4779`）→ AI 门户永远不产出线索**

但 prompt 里仍写着「客户确认后必须立即调用 create_work_order」（`index.js:1013`），靠逐轮追加的 `intakeContract` 覆盖 → 提示词自相矛盾。

### 2.2 海外客服工程师：工程师端

| 环节 | 实现 | AI 依赖 | 状态 |
| --- | --- | --- | --- |
| 申请 → 开通 | `index.js:12398-12547` | 无 | 人工 Admin 审批 |
| 激活设密 | `index.js:3774-3857` | 无 | **激活即 `available` 进派单池，无二次确认** |
| 派单（本人池） | `index.js:10524,10658` | 无 | personal 只查 `engineer_id = ?` |
| 服务标准 6 步 18 项 | `lib/serviceStandard.js` | 无（确定性 gate） | **只渲染当前步** |
| **AI 服务指引** | `lib/serviceGuidance.js` + `EngineerServiceGuidanceCard.jsx` | **LLM + 强护栏** | 唯一可用的 AI |
| 备件/物料申请 | `lib/materialRequisitions.js` | 无 | — |
| 现场作业 | `lib/field-work.js` | 无 | 日报强制 4 段文本 + ≥1 照片 |
| 报价执行/付款闸门 | `lib/quoteExecution.js` | 无 | — |
| 报告质量校验 | `lib/service-report-quality.js` | 无（确定性） | **会阻塞服务完成** |
| 维修记录 → 知识候选 | `lib/knowledge-candidates.js` | 无 | engineer **无入口**（全在 Admin/运营侧） |

**AI 指引护栏强度**：schema 精确键校验（根对象必须**恰好** 8 个键）、`version === 2`、枚举白名单、item key 必须属于服务标准；任一失败**整份 reject** 并保留上一份有效结果（`serviceGuidance.js:203-207,247`；`index.js:6795-6797`）。→ 代价是敏感：模型多返回一个键就整份失败。

**已废弃但文档仍在承诺**：`EngineerServiceReadinessCard` 已于 `80eef60`（2026-08-20）删除，并由 `frontend/tests/repository-hygiene.test.mjs:34,44,59-60` **断言必须不存在**。后端 `/api/workorders/:id/service-readiness` 仍在（`7391-7506`），**零客户端调用**。→ 能用的后端 + 没人能看到的 UI + 死的成本入口。`CLAUDE.md` 第九节与那份 2026-07-27 handoff 都已 stale 且互相矛盾。

### 2.3 国内商务团队：商务侧

**身份模型**：`admin_staff_accounts.business_profile_required`（`051_business_scope.sql:1`）语义 =「身份是否由 `business_staff_profiles` 决定」。为 1 时必须同时满足 `is_active`、`raw_role='operations'`、`grade ∈ {1,2,3}`、`market_scope` 覆盖当前市场（`businessIdentity.js:7`）。

**层级**：无 `supervisor_staff_id` 者即顶端（**任意级别均可**，`businessIdentity.js:13`）；specialist → manager → director 链式校验（`16-23`），带 `seen` 防环。**只支持两跳**，更深的组织判为无效身份 → `invalid_staff` → 所有接口 403。

**辖区与可见范围**：

```
territories（辖区）由超管创建，只授予「无上级的顶层账号」（businessWorkspace.js:43-45）
  → 不复制到子行
  → 读取时算 effective_territory_ids = 该行解析出的顶层 director_id 的 grants ∩ 当前市场（98-99）

记录可见性谓词（113-118）：
  t.market = ? AND a.owner_staff_id IN (owners) AND a.territory_id IN (territories)

owners（84-86）：
  specialist → 只有自己
  manager    → 自己 + 直属 specialist
  director   → 整条线
```

**角色能力**：

| 能力 | 总监 | 经理 | 专员 | 证据 |
| --- | --- | --- | --- | --- |
| 看授权辖区内的客户/线索/工单 | ✓ | ✓ | ✓ | `businessWorkspace.js:84-86,113-117` |
| 分配商务负责人 | ✓ | ✓ | 仅「无上级的顶层专员」 | `businessWorkspace.js:104` |
| 报价新建/提交 | ✓ | ✓ | ✓ | `BusinessRecordsPage.jsx:13` |
| 报价审批 / 收款核销 / 派工程师 / 指定执行人 | ✗ 仅 Admin | ✗ | ✗ | `businessQuote.js:66`；`BusinessExecutionPanel.jsx:90` |
| 被指派后执行服务 | 仅被 Admin 指派者 | 同 | 同 | `index.js:20685,20712-20716` |
| 知识库上传与发布 | ✓ | ✓ | ✓ | `index.js:23498-23504` |
| 建辖区 / 改他人岗位 | ✗ | ✗ | ✗ | `businessWorkspace.js:203` |
| `grade` 1–3 | **无任何权限差异** | 同 | 同 | `business-workspace.test.mjs:50` 专门断言九档同权 |

**收款核销是真 Admin-only，四层保证**（`index.js:23373` 拒绝商务角色 → `23512` 要求 `userType=admin` → `prepareBusinessPaymentContext(adminOnly)` → guard 交叉校验 `audit_logs.actor_type='admin'` 且金额一致 `10800-10812`）。**质量最高的部分。**

**报价审核状态机是硬的**：`quote_version` + `scope_version`（SHA-256(staffId, market, epoch)）+ `expected_staff_id` + 成本快照跨表一致性四道断言，同一 `env.DB.batch` 内执行，任一失败整批回滚（`businessQuote.js:143,153-167`；`index.js:16909-16946`）。

**商务承接服务复用工程师同一套 handler**（`serviceActor` 上下文）：`handleSaveRepairRecord:8050`、`handleResolveWorkOrder:18353`、`handleConfirmWorkOrderServiceStandardItem:7160`。差异只有四点：① 开工前多一道 Admin 会签；② 客户不产生评分；③ **零 AI**；④ **零知识沉淀**。

**两个死锁（运营级，非 AI）**：

- **a) `site_timezone` 死锁**：报价确认后 `work_orders.site_timezone` 永久不可写（`16320-16322` 拒绝 quote-driven），而 `fixed_date` 分期发起收款需要它（`20358-20361`）→ 该期永远收不到 → 永远不能 `financially_settled` → 工单永远不能 `completed`（`17017-17023`）。
- **b) onsite 商务单签到死锁**：若 `site_timezone` 为空 → 现场签到 409（`8852,8801`）→ 到位核验无人能填（商务侧 arrival-check 被 `17903` 拒绝）→ 无法 resolve（`18373`）。仅 Admin 人工放行（`18305,23669`）可绕过。

### 2.4 知识库全链路（双路径）

```
【慢路径·工程师沉淀】维修记录 → 候选（要求客户评分 + customer_confirmed_at）
                     → 审核工作流 → approve
                     → 写入 knowledge_articles  ← 断点① 硬编码 status='draft'（17495）
                     → 发布（PATCH 改 status）   ← 断点② 对 work_order_candidate:% 返回 409（12895-12897）
                     → 检索（WHERE status='published'）← 于是永远查不到

【快路径·商务直传】admin 知识库页 → POST /api/admin/knowledge
                     → 默认 status='published'（KnowledgePage.jsx:264）
                     → reviewed_by 记成商务本人（12746）
                     → 直接进 AI 检索库 ✅ 可用
```

**另一重黑洞**：`prepareWorkOrderCandidate` 硬要求 `workOrder.engineer_id`（`knowledge-candidates.js:66,76`；另一入口 `17591` 同样要求）→ **商务承接的服务记录永远不会进入沉淀**。

**检索算法**（`1470-1594`）：
- 词元化：非字母数字切分 + 单位脱壳数字（仅 ≥1000）+ 同义词扩展 + 中文二元组兜底；**硬上限 12 个词元**
- 打分：`title 6 / model 5 / brand 3 / equipment 3 / content 1`，**布尔命中**（与次数、位置无关）
- 硬过滤：仅 `status='published' AND market=?`；`locale` **只加 4 分排序、不过滤**
- 并列：按 `updated_at/created_at` → 时间戳全同则退化为 **rowid / CSV 行序**
- 精确型号加权：`CAST(applicable_model AS INTEGER)`（`1521`）→ **`CAST('3000W') = CAST('3000S') = 3000`，加权失效**
- limit：schema 未暴露，实现读 `args.limit` → **实际恒为 5**
- 返回正文**不截断**

**已知真实退化**（实跑 122 行真实数据复现）：问 `3000W carbon steel 16mm`，top-5 **全是 3000S**（含不锈钢/铝/黄铜 3 条），3000W 一条未进。

**词元化结构性问题**：「3000W激光切割机切割不锈钢10mm参数是多少」→ 12 个词元里前 11 个是二元组，「参数」「3000」全被挤掉；「报警 E053」→ 报警码完全不成词。

**分类覆盖**：8 类（`fault / cutting_parameters / parts / maintenance / machine_selection / health / safety / other`）**仅填 1 类**。

---

## 3. 通用问题清单（分级）

### P0 —— 造成错误结论、违反承诺或阻塞交付

| # | 现象 | 证据 | 影响 | 状态 |
| --- | --- | --- | --- | --- |
| P0-1 | 知识沉淀环断开：approve 写入硬编码 `draft`，唯一发布接口对候选来源 409 | `index.js:17495` / `12895-12897` | 工程师沉淀的经验永远进不了 AI | ✅ 已验证 |
| P0-2 | 黄金集 30 条 `output_contract` 在 CI 里硬编码 `pass: true` | `tests/eval-harness.mjs:583` | 40% 用例（含全部安全场景）从未执行，`74/74` 是伪通过 | ✅ 已验证 |
| P0-3 | 检索机型串档：`CAST('3000W')` 与 `CAST('3000S')` 同为 3000 | `index.js:1521` | 用错机型的参数回答客户 | ✅ 已验证 |
| P0-4 | 海外客户姓名+手机号明文进 LLM prompt | `generateCustomerContext:4024,4041` → `4685` → `4746` → `4941`；`privacy-policy.md:81` | 违反自己发布的隐私政策 | ✅ 已验证 → **🔧 已修复**（见 5.1） |
| P0-5 | 服务单整理助手把 `contact.{name,email,phone,whatsapp}` 明文发出（访客可用） | `lib/serviceRequestIntake.js:289`；`index.js:23278,23308` | 同上，且无需登录即可触发 | ✅ 已验证 → **🔧 已修复**（见 5.1） |
| P0-5b | **`redactPII` 六类规则全是中国本土标识，对海外号码一律不命中** —— 即"脱敏"在 COM 上基本是空转 | `lib/redact.js:22-67`（`phone_cn` = `1[3-9]\d{9}`、中国身份证/车牌、银行卡中文关键词） | 即使给 chat 接上脱敏也等于没做；真正通用的只有 email 与带凭据 URL | ✅ 已验证 → **🔧 已修复**（见 5.1） |
| P0-6 | 商务承接的服务记录**永远不会**进入知识沉淀（硬要求 `engineer_id`） | `knowledge-candidates.js:66,76`；`index.js:17591` | 商务线的经验全部丢失 | ✅ 已验证 |
| P0-7 | `site_timezone` 死锁：`fixed_date` 分期永远收不到 → 工单永远不能 `completed` | `16320-16322` vs `20358-20361`；`17017-17023` | 需 Admin 人工放行，规模化后卡死 | ✅ 已验证（代码）／未实机复现 |
| P0-8 | 商务服务 / 报告质量校验的 `highRisk` 分支永不可达（唯一调用传 `false`） | `service-report-quality.js:60`；`index.js:18443` | 高风险工单的 `follow_up_advice` 从不强制 | ✅ 已验证 |

### P1 —— 静默错误、无法归因或能力缺口

| # | 现象 | 证据 | 影响 | 状态 |
| --- | --- | --- | --- | --- |
| P1-1 | 唯一真评测不在 CI、从未跑过 | `scripts/real-output-eval.mjs`；`.eval-runs/` 不存在 | 质量回归合并前不可见 | ✅ 已验证 |
| P1-2 | 无 prompt 版本 / 不记模型 / 召回结果不留档；trace 只写不读 | 无版本常量；`ai_trace_logs` 无查询入口 | 出事能定损、不能归因 | ✅ 已验证 |
| P1-3 | **UI 无法给顶层非总监授辖区** | `StaffAccountsPage.jsx:129`；`BusinessOrganizationPanel.jsx:22,60` | 先招专员/经理且无总监 → 永久看不到业务数据 | ✅ 已验证 |
| P1-4 | 停用中间节点静默废掉整条线，确认框只报直属下级数 | `businessIdentity.js:21`；`staffAccountList.js:57-65` | 停 1 个总监 = 全线下属失去访问 | ✅ 已验证 |
| P1-5 | 换线/改辖区不回填历史归属 | `businessWorkspace.js:116,214-233` | 旧记录对全部商务角色不可见，仅超管可见 | ✅ 逻辑已验证／未实机复现 |
| P1-6 | 提示词自相矛盾：门户恒发 `serviceRequestOnly`，prompt 仍命令必须建单 | `useChat.js:55` vs `index.js:1013` | 行为随入口漂移 | ✅ 已验证 |
| P1-7 | 工程师 prompt 要求引用「历史报价数据和地区均价」，但上下文无报价数据 | `index.js:1043` vs `generateEngineerContext:4071-4158` | 结构性幻觉源 | ✅ 已验证 |
| P1-8 | 商务错误码直出，且 403/404/409 折叠成同一句并清空表单 | `businessQuote.js:6,171`；`BusinessQuotePanel.jsx:131-132` | 权限不足/报价被锁/冲突说同一句，丢未保存输入 | ✅ 已验证 |
| P1-9 | 无辖区时只有空表格，无「请联系管理员授权」指引 | `businessWorkspace.js:115`；`BusinessWorkspacePage.jsx:213` | 新人误判为系统没数据 | ✅ 已验证 |
| P1-10 | 指派商务执行人后**无法取消或改派**（无 UPDATE/DELETE 实现） | `054:15` status CHECK 仅 `'assigned'` | 指错人只能改库 | ✅ 已验证 |
| P1-11 | 串档被写成测试契约：断言 3000W 查询首位必须是 3000S | `knowledge-retrieval.test.mjs:403-413` | 改对了反而变红 | ✅ 已验证 |
| P1-12 | **AI 门户永远不产出线索**（`maybeCreateMachineLeadFromChat` 被门控） | `index.js:4779` vs `useChat.js:55` | 最高意向的整机采购对话不变成线索 | ✅ 已验证 |
| P1-13 | 商务报价链路（COM）**零 AI 触点** | `index.js:19148` 对 com 返回 403 | 商务同事没有 AI 辅助 | ✅ 已验证 |
| P1-14 | 主数据 `business_territories` **无 UPDATE / DELETE / 状态位**，建错永久存在 | `schema.sql:1200-1205`（只有 id/name/market/created_at）；全仓对该表只有 SELECT 与 INSERT（`businessWorkspace.js:52,88,124,209`） | 重名辖区无法区分、无法清理，并在归属下拉里制造「归属黑洞」 | ✅ 已验证 |

### P2 —— 成本、体验与维护性

| # | 现象 | 证据 | 影响 |
| --- | --- | --- | --- |
| P2-1 | 配额每请求计 1 次，实际最多 5 次上游调用；KV 计数非原子 | `index.js:4216-4220` / `4251` | 成本最多低估 5 倍 |
| P2-2 | 假流式：整轮生成完才下发一帧 | `index.js:5001`（`efb43e1` 起） | 无逐字反馈 |
| P2-3 | 历史消息与知识正文注入无上限 | `4656-4660`；`1549-1567` | prompt 膨胀、成本不可控 |
| P2-4 | 工具 schema 全量暴露、授权解耦 | `4928-4930` vs `1651-1664` | 访客可见内部工具定义 |
| P2-5 | 商务材料申请以 `userType='admin'` 记账 | `14395,14421`；`20916-20918` | 审计无法区分商务人员与真 Admin |
| P2-6 | 核销决定通知发给记录 owner 而非申报人 | `21627-21647` | 无归属行时申报人收不到任何通知 |
| P2-7 | `scope()` 每请求全量拉 staff+grants 并 O(staff×grants) JS 过滤 | `businessWorkspace.js:73-100` | 上百人+多辖区时变慢（未压测） |
| P2-8 | 单文件 24,198 行 / 548 个顶层函数 | `worker/src/index.js` | 改动风险高 |
| P2-9 | 8 个测试文件从不进 CI（白名单手写且已漂移） | 含 `work-order-language.test.mjs` | 语言契约回归可静默合入 |

---

### 3.1 主数据「只增不删」扫描结果

**方法**：对 `worker/src` 全量提取 `INSERT INTO` / `DELETE FROM` / `UPDATE … SET` 的表名做差集，再逐个回 schema 与代码核验是否真有修正路径（状态位 / 停用 / 改派）。

| 资源 | 能改？ | 能删 / 停用？ | 判定 |
| --- | --- | --- | --- |
| `business_territories` 辖区 | ❌ 无 UPDATE | ❌ 无 DELETE、无 status 列 | 🔴 **纯死角**：建错永久存在（P1-14） |
| `business_execution_assignments` 商务执行指派 | ❌ 无 UPDATE | ❌ 无 DELETE，`status` CHECK 仅 `'assigned'` | 🔴 指派错人无法改派/取消（P1-10） |
| `business_record_assignments` 记录归属 | ✅ 可改派（`businessWorkspace.js:192`） | ❌ 无法置空 | 🟡 可纠正，但不能「取消归属」 |
| `leads` 线索 | ✅ 有 `status`（new/contacted/converted/lost） | ❌ 无 DELETE | 🟡 可标 `lost`，重复/垃圾线索永久累积 |
| `business_quote_drafts` 报价草稿 | ✅ | ❌ 无 DELETE | 🟡 草稿只能覆盖，不能丢弃 |
| `materials` 物料主数据 | ✅ 6 处 UPDATE | ✅ `status='active'` 可停用（`schema.sql:1142`） | ✅ 无问题 |
| `knowledge_articles` 知识条目 | ✅ PATCH | ✅ `archived` 状态 | ⚠️ 但候选来源条目 PATCH 被 409 挡（P0-1） |
| `admin_staff_accounts` 员工账号 | ✅ | ✅ `is_active` 停用 | ✅ 无问题 |
| `audit_logs` / `ai_trace_logs` / `*_events` / 评价 / 消息 / 成本快照 / 收款证据 | — | — | ✅ 审计流与不可变证据，只增是设计 |

**结论：真正的「配置死角」只有一个——辖区。** 其余资源都至少有停用或改派路径。

这条扫描的价值在于把「要不要做一套通用删除功能」从猜测变成清单：**只需要给辖区补一个「停用 / 重命名」入口**，不必做通用删除。同时它给出了一个反直觉的好消息——系统的其余主数据治理其实是完整的。

---

## 4. 评测与可观测性盲区

| 测试/工具 | 覆盖什么 | 在 CI | 盲区 |
| --- | --- | --- | --- |
| `golden-set.json` + `eval-harness.mjs`（74 条） | 44 条真跑 | ✅ | **30 条伪通过** |
| `real-output-eval.mjs` | 真打 `/api/chat` ×30 案例 ×3 次 | ❌ | 无门禁、从未运行 |
| `chat-access.test.mjs` | 越权/配额/超时/语言路由/prompt 文本 | ✅ | 全 mock，0 条真实输出 |
| `knowledge-retrieval.test.mjs`（18 条） | 召回集合 | ✅ | 只测召回不测生成；**含错误契约** |
| `business-workspace.test.mjs` | 辖区/层级/九档同权 | ✅ | — |
| `redact.test.mjs`（32 条） | PII 脱敏与不误伤 | ✅ | — |
| `e2e/`（23 个） | 前后端流程 | ✅ | **无 AI 对话用例** |

**回归防线**：

| 变更 | 会被什么挡住 | 结论 |
| --- | --- | --- |
| 改 prompt 措辞 | 9 条整句子串匹配 + 11 条 chat-access | **挡得住但脆弱** |
| 改检索排序 / 同义表 | 18 条检索测试 | 召回侧挡得住 |
| 改召回后的答案质量 | 无 | **完全裸奔** |
| 改模型 / 温度 | 无任何断言 | **完全裸奔** |
| 判断线上答案对应哪版 prompt | 无版本标识 | **不可能** |

**事故复盘可达上限**：能复原「用户说了什么 + AI 答了什么 + 调了哪些工具、是否失败」；**不能**复原「哪版 prompt、召回了什么、哪个模型」→ **可以定损，无法归因**。

---

## 5. 数据出境与隐私（COM 现状）

| 路径 | 发什么 | 脱敏 | COM 在跑 |
| --- | --- | --- | --- |
| 客户对话 `/api/chat` | 消息原文 + 历史原文 + system prompt 内【客户信息】姓名+手机号 | ❌ | ✅ |
| 服务单整理助手（访客可用） | message + `draft.contact.{name,email,phone,whatsapp}` | ❌ | ✅ |
| 工单摘要 / 服务就绪 / 服务指引 | — | ✅ | ✅ |
| 报价 AI 点评 | 报修描述前 200 字 + 地区 | ❌ | ❌ `19148` 直接 403（CN 专属） |

`redactPII` 在 `index.js` 只有 5 个调用点（`2278/5541/5686/6236/22962`），**主对话链路零调用**。

**与对外声明的冲突**：`docs/legal/privacy-policy.md:81`「**我们不会发送您的手机号**、密码等账户凭证」↔ 上表第 1、2 行。前端 `LegalModal.jsx:299,306,360` 用的是弱化表述（「**可**进行脱敏」）。

### 5.1 已完成的 PII 修复（2026-09-18）

修复 P0-4 / P0-5 / P0-5b 三项，改动 6 个文件、`npm test` 全绿（1098 pass / 0 fail）。

| 文件 | 改动 |
| --- | --- |
| `worker/src/lib/redact.js` | 新增国际号码规则（`+` 国家码 / `00` 国家码 / 北美 3-3-4）；导出 `PHONE_INTL_CATEGORY` 与 `CHAT_PII_CATEGORIES` |
| `worker/src/index.js` | chat 路径：当前消息与历史消息出境前脱敏；`generateCustomerContext` **不再查询也不再拼接 `customer.phone`** |
| `worker/src/lib/serviceRequestIntake.js` | 服务单整理助手的入参（消息 + 草稿）序列化后整体脱敏 |
| `worker/src/lib/summary.js` | 摘要素材（客户对话原文）改用 chat 类别 |
| `worker/src/lib/workOrderTitles.js` | 占位符清理列表补 `[电话]`（否则会漏进工单标题） |
| `worker/tests/redact.test.mjs` | 32 → 52 条，含国际号码正样本与误伤回归 |

**一个关键设计决定：国际号码是 opt-in，不进默认集。**

核验时发现技术语境下国际号码与别的东西**完全同形**，而且这些字符串已被既有测试锁定为"不得被改"：

| 字符串 | 真实含义 |
| --- | --- |
| `+1 234 5678` | 校准偏移（`+` 是正号） |
| `+44 7700 900123` | 零件号 |
| `+1.2345678 V` | 电压修正值 |
| `Part 415-555-0123` | 零件号（`workOrderTitles.js:6,42-44` 已有上下文门控） |

没有任何正则能把它和 `+1 415 555 0132` 区分开——**只有语境能**。因此只在"客户直接写给我们的话"（chat / 服务单整理 / 摘要）里显式开启；知识候选、服务就绪、服务指引保持原有默认集不变（零行为变化）。

**`countPII` 刻意不统计国际号码**：它的输出被 `knowledge-candidate-workflow` 当作"默认集是否命中"的检测向量（`Object.values(countPII(...)).some(...)`），加进去会让 `+1 234 5678` 被判成敏感内容——这条在开发过程中真实触发过一次测试失败。

**本次未覆盖、需要你决定的：**

1. ~~姓名仍在 prompt 里~~ —— **已按委托方决定移除（2026-09-18）**。`generateCustomerContext` 现在只保留 `region`（现场服务可行性判断必需），不再查询也不再拼接 `name`；代价是 AI 不再以姓名称呼客户。
2. **`readiness` / `guidance` 路径仍是默认集**（CN-only）。这两条脱的是工程师写的机器技术笔记，与上面的歧义问题同类，保持保守更安全。
3. **`00` 前缀要求分隔符**：`0044 20 7946 0958` 命中，`00442079460958` 不命中。这是为不误伤 `001380013800090` 这类长编号串而做的取舍。

---

## 6. 能力边界（分角色）

### 海外客服工程师

- ✅ **放心用**：服务标准、报告、领料、现场打卡、安全提示（23 条门禁是全系统质量最高部分）
- ⚠️ **需人工复核**：AI 服务指引（护栏硬、但无人工审核回路）；任何具体工艺参数（检索可能串档）
- ❌ **不要依赖**：备件型号与兼容性、故障判定结论
- 🚫 **不要承诺**：录进知识库的经验 AI 会学到（P0-1 未修之前）

### 国内商务团队

- ✅ **放心用**：辖区内的客户/线索/工单（谓词封死，未发现绕过路径）；报价录入与提交（四道断言 + 整批回滚）；收款发起与到账申报（核销真 Admin-only）；知识库上传（**上传即生效，AI 立刻能用**）
- ⚠️ **需知道**：辖区未配置 = 空表格（不会报错）；换线会导致旧记录不可见；指派执行人后无法改派
- ❌ **没有**：报价审核链路的 AI 辅助（COM 零 AI）；自己承接服务时的 AI 指引；服务记录的知识沉淀
- 🚫 **不要做**：在员工角色下拉里选 `operations` 建号（`bpr=0` 会绕过整个辖区模型，且与商务角色同处一个下拉）

### 海外客户

- ✅ AI 对话可用；服务申请、报价确认、评价链路正常
- ❌ **不能信**：AI 给出的具体参数（无证据支撑其正确性）

---

## 7. 分级改进清单

### 第一批（S 级，建议立刻做）

| # | 动作 | 为什么 | 证据 |
| --- | --- | --- | --- |
| 1 | 候选审核通过写 `published`，或给候选来源开显式发布出口 | 让飞轮的知识环闭上 | `17495` / `12895-12897` |
| 2 | `eval-harness.mjs:583` 改 `skipped` 并计数；删掉 3000S 错误契约 | 决定你还能不能相信 CI 绿灯 | `eval-harness.mjs:583`；`knowledge-retrieval.test.mjs:403-413` |
| 3 | ~~对话出境前脱敏 message + 历史；去掉 `generateCustomerContext` 的 `customer.phone`~~ | **✅ 已完成 2026-09-18**（含脱敏库补国际号码规则，见 5.1） | `4024,4041,4775,4658-4677` |
| 4 | ~~服务单整理助手对 `draft.contact` 全字段脱敏~~ | **✅ 已完成 2026-09-18** | `serviceRequestIntake.js:289` |
| 5 | 放开 UI 对顶层账号的辖区勾选（3 处判断改为「上级为空即顶层」） | 解锁先招专员/经理 | `StaffAccountsPage.jsx:129`；`BusinessOrganizationPanel.jsx:22,60` |
| 6 | 无辖区时给明确文案 + 引导（后端保持 `WHERE 0`，不要改成 403） | 避免误判为「系统没数据」 | `BusinessWorkspacePage.jsx:203,213` |
| 7 | 知识候选去掉 `engineer_id` 硬要求，支持商务服务记录 | 堵住商务线的知识黑洞 | `knowledge-candidates.js:66,76` |

### 第二批（M 级）

| # | 动作 |
| --- | --- |
| 8 | 修 `site_timezone` 死锁（报价确认时落快照，或 `fixed_date` 分期回退到工单时区） |
| 9 | 检索打分改计次加权；型号精确匹配（3000W ≠ 3000S）；并列不再按 rowid |
| 10 | 每次 chat 落一条可归因记录（`model` + `prompt_version` = 系统提示词短 hash） |
| 11 | `real-output-eval` 接 nightly / workflow_dispatch，结果上传 artifact 并设阈值 |
| 12 | admin 加 `ai_trace_logs` 只读查询页 + 补 60 天留存 cron |
| 13 | 商务错误码映射表；409 分级（仅 scope/identity 变化才清空表单） |
| 14 | 停用确认框递归统计整棵子树受影响人数；换线时给「待重新指派」清单 |
| 15 | 指派执行人支持改派/取消（`business_execution_assignments` 加状态与更新路径） |
| 16 | 补 `fault` / `parts` / `maintenance` / `machine_selection` 四类种子内容 |
| 17 | 修 `service-report-quality.js:60` 的 `highRisk` 死分支（高风险工单强制 follow-up） |
| 18 | 给辖区补「停用 / 重命名」入口（`schema.sql:1200` 加 status 与可改 name + 服务端路由）。**只需这一处，不必做通用删除**（见 3.1） |

### 第三批（L 级）

| # | 动作 |
| --- | --- |
| 19 | 客户侧答案反馈通道（有用/无用 + 纠错），作为黄金集的真实选题来源 |
| 20 | 拆分 `worker/src/index.js`（24,198 行） |
| 21 | 金额权威源统一（`work_order_pricing` 携带 currency 与税费口径） |

---

## 8. 上线前固化清单（辖区与派单标签由负责人配置）

**商务侧**

1. **先建一个总监账号**（哪怕占位），再建经理/专员 —— 否则专员/经理拿不到辖区（P1-3）。或者先做第 7 节第 5 项代码修复。
2. 每建一个账号，确认两件事：**上级已设** + **辖区已授予**。
3. 角色选择只选 `business_specialist / manager / director`；**不要选 `operations`**（绕过辖区模型）。
4. 层级**只支持两跳**（专员→经理→总监），不要设计更深的组织。
5. 记录要能被看到，必须同时满足：**已归属辖区 + 已分配 owner**（`business_record_assignments` 有行）。没有归属 = 谁都不看不见（超管除外）。
6. 停用总监前注意：**全线下属会立即失去访问**（P1-4）。

**工程师侧**

7. 派单标签（`specialties` / `brands` / `services` / `service_region`）**只能由你配**，工程师本人改不了，界面也不提示（`index.js:11306,11334-11344`）。不配 = 静默接不到单。
8. 确认 migration 043/044/045/051-056 已在生产 D1 执行（否则相关接口 500）。
   ⚠️ 注意：044 写入的 `legacy_not_recorded` 被 `isNonBlockingItem`（`serviceStandard.js:56-60`）视为**非阻塞**，因此**不会**造成 handover gate 死锁。初版审计的这条判断已被核验推翻（见附录 A 第 7 条）。

**通用**

9. `engineer.sagemro.com` 已确认在线。

---

## 9. 上手指引要点

### 海外客服工程师（第一周）

| 坑 | 表现 | 证据 |
| --- | --- | --- |
| 没有入职引导 | 首次登录落在空工作台 | frontend 全仓 grep `onboarding` **0 命中** |
| 派单标签只能找人配 | 接不到单，不知原因 | `index.js:11306,11334-11344` |
| 「服务能力与费用」页是陷阱 | 填了不影响派单 | `engineerServiceProfile` 全仓仅本人 GET/PUT |
| 报告质量不可见 | 只在被 400 拒绝时才知道 | `report_quality_status` 全仓 0 命中 |
| 18 项标准只能看到当前步 | 无法为下一步提前备工具 | `EngineerWorkOrderDetail.jsx:249-250` |
| 阻塞提示不含具体项 | 只说「请先完成当前必做项」 | `api.js:1103-1108` 不读 `blocking_items` |
| AI 失败无自救入口 | 只说「暂时不可用」 | `EngineerServiceGuidanceCard.jsx:31` |

### 国内商务团队（第一周）

| 坑 | 表现 | 证据 |
| --- | --- | --- |
| 无辖区 = 空表格 | 显示「当前范围内暂无资料」，不说是权限问题 | `businessWorkspace.js:115`；`BusinessWorkspacePage.jsx:213` |
| 首屏落在「线索」页 | 无欢迎页、无 checklist | `App.jsx:245-249`；无 onboarding 实现 |
| 权限不足/报价锁定/冲突说同一句话 | 提示「请关闭并重新打开工单」 | `BusinessQuotePanel.jsx:131` |
| 原始错误码直接显示 | 如 `business_quote_revision_changed` | `businessQuote.js:6,171` |
| 报价提交按钮灰掉且不解释 | 成本不完整时静默 disabled | `BusinessQuotePanel.jsx:166-168` |
| 批量建号会「炸掉」他人已打开的业务页 | 全局 `business_scope_version` 递增 → 409 | `051:36-50`；`index.js:13374` |
| 服务执行指派面板对商务是死界面 | 永远只显示「仅 Admin 可以指定」 | `BusinessExecutionPanel.jsx:90` |

**隐性知识（界面不说、只能靠人教）**：只有无上级账号能持辖区 / 上级必须先于下级创建 / 层级只支持两跳 / 停用上级 = 整条线断网 / 记录必须同时有辖区和 owner / `grade` 不代表权限 / 报价提交后自锁 / 币种由市场硬定（COM=USD） / 改密期间所有接口 403 / Admin 分两类（只有 bootstrap 超管能建员工与辖区）。

### 讲解口径

- **不要**向新人介绍「AI 服务就绪度评审」——该功能已删除（`80eef60`），文档 stale。
- 介绍 AI 时说「右栏那张 AI 服务指引卡」，并明确它**只建议、不 gate**。
- **不要**承诺「录进知识库的经验 AI 会学到」（工程师路径的沉淀环未接通）；但**可以**承诺「商务同事上传的知识立即生效」。

---

## 附录 A：审计方法与已知修正

由 9 个并行子任务分块审计，**关键主张由主审计人逐条回代码核验**。核验中修正 8 处：

| # | 原判断 | 核验结果 | 修正后口径 |
| --- | --- | --- | --- |
| 1 | （主审计人）`engineer.sagemro.com` 在仓库里没有部署配置，可能未上线 | **不成立**。委托方确认该站可正常访问 | 从「风险」降级为「已知条件」 |
| 2 | （主审计人）COM 的商务报价会看到中文、按「元」口径的 AI 点评 | **不成立**。`index.js:19148` 对 com 直接 403，该 AI 只在 CN 跑 | 从「当前问题」降级为「潜在风险」 |
| 3 | （子任务）`getAiFallbackMessage(env)` 导致「env 落到 error 位、客户看到 not fully configured」 | **不成立**。第一个实参绑定第一个形参 | 不是 bug，不需修 |
| 4 | （子任务）「前端丢弃 `blocking_items`」 | **部分不成立**。`EngineerWorkOrderDetail.jsx:367` 用它显示 start gate 数量 | 精确口径：resolve/handover 被阻塞时前端不读错误体里的该字段，且服务端下发的是 item key |
| 5 | （子任务）「专员能看到同辖区平级同事的全部资料，与设计文档相反」 | **不成立**。`businessWorkspace.js:84-86` 中 specialist 只匹配自身；`business-workspace.test.mjs:54` 断言 specialist 记录集为 `['specialist-a']` | specialist **只能看到自己的记录**，与设计文档一致 |
| 6 | （子任务）引用 `admin/src/components/BusinessStaffFields.jsx:22` | **路径不存在**。`BusinessStaffFields` 由 `admin/src/components/BusinessOrganizationPanel.jsx:9` 导出 | 结论正确（由 `StaffAccountsPage.jsx:129` 独立证实），引用路径已修正 |
| 7 | （子任务）044 迁移写入的 `legacy_not_recorded` 会让老工单 handover gate 永不满足（死锁） | **不成立**。`isNonBlockingItem`（`serviceStandard.js:56-60`）把 `legacy_not_recorded` 与 `confirmed`、合法的 `not_applicable` 并列为**非阻塞状态** | 044 **不会**造成 handover 死锁。`legacy_not_recorded` 的实际含义是「历史工单该步不追溯」，是设计上的放行而非阻塞 |
| 8 | （子任务）「有数据也可能显示『尚未分配辖区』——继承来的辖区不在信息条里」 | **不成立**。`businessWorkspace.js:89-90` 取的是 `actor.businessDirectorId` 的 grants（即**继承链顶端**的辖区），不是本人 grant；`staffAccountList.js:26-29` 也显式计算 `inheritedTerritories`。子任务引用的 `business-workspace.test.mjs:213` 断言的是「经理能看到专员的 `effective_territory_ids`」，不支持该结论 | 经理/专员能看到继承来的辖区名。信息条为空只发生在**整条链确实没有辖区**时——那是真实的「未授权」，不是显示 bug |

**保留这一节的理由**：审计本身也会编，包括主审计人。任何「AI 给出的结论」都应当被要求提供证据——包括本文。9 个子任务中有 4 个产出了至少一条不成立的判断。

---

## 附录 B：未能验证的点

> 📋 **需要真人验证的条目已单独整理成可执行清单**：`docs/SAGEMRO-待验证问题清单-可复现步骤.md`
> —— 按「现在就能试 / 需要多账号 / 只能代码验证」三档分组，每条含环境、步骤、预期现象与确认后的意义。

1. **`OPENAI_API_ENDPOINT` 的真实司法辖区**。只知道是单一 secret；默认模型名 `deepseek-chat` **不构成端点归属证据**。这是 P0-4 / P0-5 严重度的唯一不确定性来源。
2. **生产 D1 的实际内容**：`knowledge_articles` 的真实 status 分布、是否存在孤岛归属、是否有 `site_timezone` 为空的商务单、无辖区账号的数量。建议：
   ```sql
   SELECT market, locale, status, COUNT(*) FROM knowledge_articles GROUP BY 1,2,3;
   ```
3. **migration 043/044/045/051-056 是否已在生产 D1 执行**。
4. **线上 `output_contract` 30 条的真实通过率**。本审计只能证明「没人测」，**不能证明「AI 答得差」**。
5. **`ai_trace_logs` 的实际数据量与 `no_knowledge_match` 真实占比**。
6. **`site_timezone` 死锁的真实发生率**（未实机复现，代码路径已确定）。
7. **`scope()` 的性能**（上百人 + 多辖区未压测）。
8. **真实浏览器观感**：所有「用户看到什么」均由代码路径推导，未做端到端截图验证。

---

## 附录 C：证据索引（关键符号）

| 主题 | 符号 / 位置 |
| --- | --- |
| 提示词与门禁 | `SYSTEM_PROMPT:713-940`；门禁 `778-804`；拼装 `4746` |
| 工具与权限 | `ROLE_ALLOWED_TOOLS:1301-1335`；执行期拦截 `1651-1664` |
| 配额 | `enforceOpenAIBudget:4187-4221`；`MAX_TOOL_ITERATIONS:4251` |
| 循环与流式 | `4917-5069`；`deferContent:5001` |
| 门户门控 | `serviceRequestOnly:4548`；`4779`；`4814`；`4928`；`useChat.js:55` |
| 客户上下文（PII） | `generateCustomerContext:4018-4068` |
| 服务单整理（PII） | `lib/serviceRequestIntake.js:289`；`index.js:23278` |
| 检索 | `toolSearchKnowledgeBase:1470-1594`；`CAST:1521`；硬过滤 `1504` |
| 知识发布 | approve `17490-17510`；PATCH 409 `12895-12897`；商务直传 `KnowledgePage.jsx:264` |
| 知识候选 | `lib/knowledge-candidates.js:66,76`（硬要求 engineer_id） |
| 商务身份 | `lib/businessIdentity.js:3-24`；`lib/businessWorkspace.js:40-118` |
| 商务辖区 UI | `StaffAccountsPage.jsx:129`；`BusinessOrganizationPanel.jsx:9-24` |
| 报价状态机 | `lib/businessQuote.js:34-90,143-171`；`index.js:16836-16983` |
| 商务执行 | `index.js:20570-21060`；`BusinessExecutionPanel.jsx`；`BusinessServicePanel.jsx` |
| 收款核销 | `index.js:23373,23512,20528,10800-10812` |
| 评测 | `tests/eval-harness.mjs:583`；`tests/knowledge-retrieval.test.mjs:403-413` |
| 已废弃功能 | `frontend/tests/repository-hygiene.test.mjs:34,44,59-60` |
| 隐私声明 | `docs/legal/privacy-policy.md:81`；`LegalModal.jsx:299,306,360` |
