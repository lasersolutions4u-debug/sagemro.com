# COM/CN 首页文案（待审）

> 版本 v1 · 2026-09-29
> 读者：发起人（审文案）；执行层（落地）
> 定位依据：`2026-09-29-com-cn-audience-positioning-design.md` §2「五个入口」
> 落点：`frontend/src/data/publicHomeContent.js`（`zhContent` / `enContent`）+ 新建 `/partners/` 页面
> **状态：待审文案，未写入代码，未部署。**

---

## 0. 写这批文案的第一原则：不走业绩口径

🔴 【判断 · 高】**在拿到第一张付费订单之前，CN 主机厂入口只能用"能力 + 流程 + 边界"口径，不能用"业绩"口径。**

| # | 硬约束 | 原因 |
| --- | --- | --- |
| 1 | **不写客户名** | 邦德 / 森峰 / 宏山即使成为合作方，未经书面授权也不得在公开站点作为客户或合作方宣传 |
| 2 | **不写案例与数字** | "服务过 XX 家整机厂""年交付 XX 台次"目前都不成立。《广告法》禁止虚假宣传，而 CN 站面向的是会当场核实的工业客户，第一次面谈就会崩 |
| 3 | **不承诺未验证的能力** | 海外装机我们**还没有交付记录**。文案只能写"可承接 / 如何组织"，不能写"已完成" |

【判断】对 B2B 工业客户，**"把流程和边界写清楚"比"我们很厉害"更有说服力**——因为它直接降低对方的采购风险。现有首页 `process.boundary` 那句话做的正是这件事，本次改造沿用同一手法。

---

## 1. 结构变化：CN 首页需要新增一个受众分叉槽位

现有 `publicHomeContent.js` 只有一个转化入口 `requestCtas.assist`，**没有受众分叉结构**。CN 双入口需要新增：

```js
audiences: {
  maker: { eyebrow, title, description, bullets[3], cta, secondaryCta },  // 主入口：整机厂
  user:  { eyebrow, title, description, cta },                            // 次入口：设备用户（复用现有）
},
makerSections: {
  engagements: { title, items[3] },   // 我们能承接的三种协作
  workflow:    { title, steps[4] },   // 协作怎么走
  boundary:    { title, items[4] },   // 协作边界
},
```

**同步要改的两处**（否则 SEO 与预渲染内容会与新首页不一致）：
1. `frontend/src/data/publicSeoRoutes.js` 首页路由里硬编码的四个中文小标题（"我们能解决的设备问题 / 为什么选择 SAGEMRO / 服务流程 / 工具、技术洞察与品牌支持"，第 232–244 行）；
2. `frontend/tests/brand-assets-contract.test.mjs` 中与首页/欢迎页相关的断言（清单见定位方案 §5）。

---

## 2. CN 首页 · 主入口（整机厂 / 合作方）

| 槽位 | 文案 |
| --- | --- |
| `audiences.maker.eyebrow` | 面向激光与金属成形设备整机厂 |
| `audiences.maker.title` | **把售后交付交给我们，不占你的编制。** |
| `audiences.maker.description` | 承接质保期内上门、出厂调试与安装、出口设备海外装机与调试、返修件流转与备件支持。工程师由我们组织，按项目或按次结算。 |
| `audiences.maker.cta` | 提交协作需求 |
| `audiences.maker.secondaryCta` | 索取服务能力说明 |

**`audiences.maker.bullets`（三块，对应 `engagements`）**

| key | 标题 | 一句话说明 |
| --- | --- | --- |
| `in-warranty` | 保内上门 | 质保期内的上门需求常年占用你的人力与差旅预算；这部分可以按次承接，不占编制。 |
| `overseas` | 出口设备海外交付 | 海外装机、调试、客户培训与保内响应，由我们组织工程师并承担现场交付。 |
| `rma` | 返修件流转 | 客户等不起换新件的场合，先发可用件恢复生产，坏件回收维修后入库周转。 |

### 2.1 `makerSections.engagements`（三种协作逐条展开）

> 表格三列固定为：**你现在的处境 / 我们怎么接 / 需要你提供**。这一结构本身就是在替对方写采购决策依据。

**① 保内上门**

| 你现在的处境 | 我们怎么接 | 需要你提供 |
| --- | --- | --- |
| 质保期内上门由你自派人，人工与差旅占掉大部分服务成本，且人力被质保义务锁住 | 按次承接上门服务，工程师由我们组织；服务记录与检测结论留档并回传 | 机型与功率段、故障现象与报警、客户现场位置、质保状态 |

**② 出口设备海外交付**

| 你现在的处境 | 我们怎么接 | 需要你提供 |
| --- | --- | --- |
| 出口设备分散在不同国家，自建驻地团队覆盖不到，临时派人成本与周期都高 | 先远程判断，再按国家与可用资源确认现场方案；装机、调试、客户培训与保内响应由我们组织交付 | 出口国别、机型与数量、交付时间窗、当地联系人 |

**③ 返修件流转**

| 你现在的处境 | 我们怎么接 | 需要你提供 |
| --- | --- | --- |
| 客户等不起换新件的采购周期，而整机停机的损失由客户承担 | 先发可用件恢复生产，坏件回收维修后入库周转；检测数据与保修条款随件留档 | 部件型号、故障判定依据、是否需要交换件、保修口径 |

### 2.2 `makerSections.workflow`（协作四步）

| # | 步骤 | 说明 |
| --- | --- | --- |
| 1 | 说明机型与需求范围 | 设备类型、品牌型号、数量、所在地区与服务时间要求。 |
| 2 | 确认服务范围与结算方式 | 按项目或按次报价，写明服务边界、差旅与备件口径，双方确认后启动。 |
| 3 | 组织工程师与备件 | 由我们安排执行工程师与所需备件；关键部件只用正品。 |
| 4 | 交付并留档 | 交付记录、检测数据与服务结论留档；后续问题可追溯。 |

### 2.3 `makerSections.boundary`（协作边界 · 诚信条款）

> 【判断】这一节是**给对方的风控材料**，不是免责声明。CN 站面向的是要向上级交代的部门负责人，把边界写清楚能提高而不是降低转化。

| # | 边界 |
| --- | --- |
| 1 | 未经书面授权，**我们不使用任何整机厂或客户的名称、案例与数据**做宣传。 |
| 2 | 不对未检测的设备状态做统一承诺；诊断、报价与安全要求以技术确认结果为准。 |
| 3 | 海外交付按国家、地区与可用服务资源**逐案确认**，不预先承诺时效。 |
| 4 | 关键部件只用正品件；副厂件或替代件须事先书面确认并说明质保差异。 |

---

## 3. CN 首页 · 次入口（设备用户）

> 这一侧**沿用现有文案**（它已经被反复打磨过，且与 AI 门户的引导语一致），只调整呈现层级：从"整页主角"降为"次入口"，位置在主入口下方。

| 槽位 | 文案（保持不变） |
| --- | --- |
| `audiences.user.eyebrow` | 设备用户 |
| `audiences.user.title` | 设备出现故障？从问题判断到服务执行，帮你明确下一步。 |
| `audiences.user.description` | 面向激光切割机、折弯机及相关工业设备，提供故障诊断、维修、系统改造、移位安装、维护保养、旧设备评估与备件支持。 |
| `audiences.user.cta` | AI 协助填写（`https://ai.sagemro.cn/?mode=assist`） |

`problemLinks`、`services`、`reasons`、`process`、`faqs`、`tools`、`insights`、`brands` **全部保留现状**——它们服务的是设备用户，本次不动。

【判断】唯一需要复核的是 `process.boundary`（"AI 仅协助整理信息；实际诊断、报价、派工和安全要求由技术人员确认。"）——**这句必须保留原样**，它是 `CLAUDE.md` 第八节"不夸大 AI 能力"在首页的落点。

---

## 4. CN 首页 · 新增 4 条面向整机厂的 FAQ

追加到现有 `faqs.items`（不删原有 10 条）：

| key | 问题 | 回答 |
| --- | --- | --- |
| `maker-scope` | 你们能承接哪一段服务？ | 三类：质保期内上门、出口设备的海外装机与调试、返修件流转与备件支持。具体范围按机型、地区与服务资源逐案确认，不做超出服务能力的承诺。 |
| `maker-settlement` | 怎么结算？ | 按项目或按次报价，写明服务边界、差旅与备件口径。不采用按人天计价的模糊结算方式。 |
| `maker-engineers` | 执行工程师是你们自己的吗？ | 由我们组织的合作工程师执行，统一服务标准与验收口径；服务记录与检测数据留档并回传给你。 |
| `maker-overseas` | 海外交付你们怎么组织？ | 先远程判断，再按国家、机型与可用服务资源确认现场方案。不预先承诺时效，也不做未经验证的交付承诺。 |

---

## 5. COM 首页（en）· 保持设备用户为主

只做轻改写，不改定位：

| 槽位 | 现状 | 建议 |
| --- | --- | --- |
| `hero.eyebrow` | `Laser and metal-forming equipment service` | 保持不变 |
| `hero.title` | `Equipment problem? Clarify the next step from initial assessment to service delivery.` | 改为 `Equipment down? Get a clear next step — from assessment to service delivery.`（更短、以停机处境开场） |
| `hero.description` | 现有长句 | 保持不变（信息完整，含服务项清单） |
| `requestCtas.assist.label` | `Get help preparing a service request` | 保持不变 |

**COM 首页新增一个轻量入口**（不占首屏，放在 `reasons` 之后）：

| 槽位 | 文案 |
| --- | --- |
| `partnerEntry.title` | Dealers and service partners |
| `partnerEntry.description` | Selling Chinese-built laser and metal-forming equipment abroad? We can back you on diagnosis, spare parts, exchange units, and coordinated field service. |
| `partnerEntry.cta` | See how partner support works → `/partners/` |

【判断】放"自然入口"而不是"首屏主 CTA"的理由：COM 首页的搜索意图是**设备用户找维修**。渠道商意图（dealer support）混进首屏会稀释前者——这正是定位方案 §3 的纪律。

---

## 6. 新建页面 `sagemro.com/partners/`（仅 COM 露出）

**受众**：主机厂的海外渠道商与代理。**不发 CN 站**（CN 不出现渠道商招商内容，避免与 `euchio.com` 及主机厂自己的渠道体系冲突）。

| 区块 | 文案 |
| --- | --- |
| `eyebrow` | For overseas dealers and service partners |
| `title` | **A service and parts backstop for the machines you sell.** |
| `description` | We support dealers and agents handling Chinese-built laser and metal-forming equipment — remote diagnosis, spare-part supply, exchange units, and coordinated field service, so an equipment fault does not become your customer's reason to switch brands. |

**`whatYouGet.items[4]`**

| # | 标题 | 说明 |
| --- | --- | --- |
| 1 | Remote diagnosis before you commit a trip | Send us the machine model, alarm, and symptom. We review before anyone books a flight. |
| 2 | Spare parts and exchange units | Ship a working unit first to cut downtime, then recover and repair the faulty one. |
| 3 | Coordinated field service | When a site visit is unavoidable, we organize the engineer and the parts for that visit. |
| 4 | Escalation to the equipment maker | Where the issue needs the original manufacturer's engineering input, we route it with the evidence already collected. |

**`whatWeNeed.items[4]`**：machine brand and model / alarm code or fault symptom / machine year or serial / site country and access conditions

**`boundary.items[3]`**（沿用交叉项目文档的铁律）

| # | 边界 |
| --- | --- |
| 1 | We work **with** equipment makers and their existing dealer networks. We do not recruit exclusive agents, and we do not claim exclusivity we do not hold. |
| 2 | We do not replace the original manufacturer's warranty obligations or speak on their behalf. |
| 3 | Field-service feasibility is confirmed case by case by country and available resources; no lead time is promised in advance. |

**`cta`**：`Become a service partner`（落点待定，见定位方案 §9 第 3 项）

【判断】第 1 条边界同时解决两个风险：① `cross-project-synergy.md` 明令禁用"独家代理"表述（无正式协议时可能构成虚假宣传）；② 若你是在帮主机厂做渠道支持，这条边界避免被认为在抢它的渠道。

---

## 7. 四处措辞（已定，2026-09-29）

| # | 项 | **已定口径** | 已落到 |
| --- | --- | --- | --- |
| 1 | CN 主入口标题 | **承接整机厂售后交付，不占你的编制。**（取了更稳的那一版） | `zhContent.hero.title` |
| 2 | 行业称呼 | **整机厂**（不用"设备制造企业"）；窗口词用 **保内上门**（不用"质保期内上门"） | `zhContent.hero.description`、`makerEngagements` |
| 3 | 渠道商 CTA 落点 | **新增 `/api/partners` 路由** | `worker/src/lib/publicRoutes.js`、`api.js` |
| 4 | 次入口 CTA 文案 | **提交服务需求**（数据层不得出现 "AI"，因为契约测试限制 AI 只能出现在 `process.boundary`） | `zhContent.audiences.user.cta` |

### 7.1 实施记录

| 项 | 结果 |
| --- | --- |
| 数据层 | `frontend/src/data/publicHomeContent.js`：zh 新增 `audiences` / `makerEngagements` / `makerWorkflow` / `makerBoundary` / `makerFaqs`；en 新增 `partnerEntry` / `partnerPage`，hero 标题改短 |
| 渲染 | `PublicHomePage.jsx`：CN 首屏改单列整机厂口径；**CN 首页不渲染 AI 对话框**（整机厂受众前不放终端用户诊断组件，设备用户走次入口 CTA 进 AI 门户）；COM 首屏保留对话框；新增 `maker` / `user-entry` / `partner-entry` 分节 |
| 新页面 | `frontend/src/components/Public/PartnersPage.jsx` + `App.jsx` 路由（`isPartnersPath`，CN 访问走 404） |
| SEO | `publicSeoRoutes.js`：zh 首页多一节「整机厂售后协作」；新增 `/partners` 路由（仅 en），正文从 `partnerPage` 取，与可见页面**同源** |
| 埋点 | `useAcquisitionTracking.js`：`partners` 路由类型按 `service` 计入（与 `brands` 同口径） |
| 后端 | `handleSubmitPartner` + `/api/partners`；**复用 `leads` 表**，`source='website_partner'`、`source_type='partner_application'`，**不新增 migration** |
| 测试 | 3 个前端测试文件改为新口径（先红后绿）；`public-routes.test.mjs` 补 `/api/partners` 与 GET 不匹配断言 |

> 🔴 **上面的改动都在 `main` 上，且 `sagemro.cn` 看不到**——CN 由 `china-edition` 构建（见定位方案 §7）。COM 侧 push `main` 即生效。

---

## 8. 与契约测试的关系

【判断 · 高】本批文案**一旦写入代码**，需同步修改的断言：

| 文件 | 需同步的断言 |
| --- | --- |
| `frontend/tests/brand-assets-contract.test.mjs` | 与首页/欢迎页相关的逐句断言（清单见定位方案 §5）。**顺序必须是：先改测试表达新口径 → 再改文案。** |
| `frontend/tests/*` 中与首页 SEO 路由相关的断言 | 首页四个中文小标题改动后需同步（`publicSeoRoutes.js` 第 232–244 行） |

【事实】本文自身也已通过契约测试的禁用表述检查——**不复制那条正则，只描述它**（上一份定位方案的第一版正是因为逐字复制而被自己的规则拦下）。

---

## 9. 落地顺序建议

| 步 | 动作 | 说明 |
| --- | --- | --- |
| 1 | 你审 §7 的四处措辞 | 只有这四处需要拍板，其余可直接采用 |
| 2 | 改测试断言至新口径 | 先红后绿，证明断言真的在管文案 |
| 3 | 写入 `publicHomeContent.js` + `PublicHomePage.jsx` 渲染新槽位 | CN 与 COM 同步（同一文件的两套 copy） |
| 4 | 新建 `PartnersPage.jsx` + 路由 + SEO 路由 | 仅 COM 露出 |
| 5 | 本地验证 | `node --test tests/brand-assets-contract.test.mjs`；构建两种 market 产物对比 |
| 6 | **发布** | ⚠️ COM 可推 `main` 即生效；**CN 需先解决发布通道**（定位方案 §7） |

> 第 2–5 步在 main 上完成即可，**不需要等 CN 分支决策**——但 `sagemro.cn` 要看到中文新首页，必须走定位方案 §7 的三步。
