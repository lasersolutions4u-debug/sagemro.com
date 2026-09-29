# COM/CN 受众定位与文案改造方案

> 版本 v1 · 2026-09-29
> 读者：发起人（定位决策）；执行层（文案与实现）
> 起因：确认 `sagemro.cn` 面向国内主机厂、`sagemro.com` 面向海外渠道与终端客户，并相应调整 `engineer` 子域
> 战略依据：`docs/research/2026-09-29-双线选择决策备忘录.md`、`docs/research/2026-09-29-海外售后切入路径.md`
> **状态：方案（未实施）。本文不授权代码改动、分支操作或发布。** 第 7 章的 CN 发布通道部分涉及 workflow 修改，按项目协作约束须单独批准。

---

## 0. 三句话说明

1. **方向成立，但要拆成五个入口**：CN 做**双入口**（主机厂 + 终端工厂），COM 保持**终端客户为主 + 渠道商单独一页**，engineer 站把口径从"招人"改成"**活从哪来**"。
2. **技术路径已经铺好**：现有 `isCnLocale()` + 各 copy 表的 `en` / `zh-CN` 双份结构 + `public-<market>/` 资产叠加，意味着这是**一次文案与结构改造，不是重写**。
3. 🔴 **但 CN 的发布通道没通**：`sagemro.cn` 由 `china-edition` 构建。**中文文案可以在 main 上先做完，但上不了线**——发布通道要单独决策（第 7 章）。

---

## 1. 现状：今天的分家是"语言维度"，不是"受众维度"

| 事实 | 位置 | 含义 |
| --- | --- | --- |
| 市场只决定 locale / lang / host 与静态资产叠加 | `frontend/scripts/markets.mjs`（`MARKETS`、`copyMarketAssets`） | `SAGEMRO_BUILD_MARKET` **不改变组件文案的受众**，只改变语言与域名 |
| CN 判定来自运行时 | `frontend/src/utils/locale.js` → `isCnLocale()` | 组件按语言取 copy，不按受众 |
| 文案是双份表结构 | `publicHomeContent.js`（`zhContent`/`enContent`）、`servicePages.js`、`diagnosticGuides.js`、`insights.js`、`industryTools.js`、`EngineerRecruitingPage.jsx`（`ENGINEER_RECRUITING_COPY`） | **改成受众维度 = 改这两套 copy 的内容与首屏结构**，机制不动 |
| CN 可叠加专属静态资产 | `frontend/public-cn/` | 国内专属素材（政策文件、中文 PDF）走这里，不影响 COM 产物 |

【判断】**改造代价可控。** 不需要新基建，需要的是：① 两套 copy 的定位重写 ② 首页首屏结构从"单入口"变"双入口" ③ 新增一个渠道商页面 ④ 同步修改契约测试断言。

---

## 2. 五个入口的定位（核心）

| # | 入口 | 受众 | 首屏必须回答的问题 | 主 CTA |
| --- | --- | --- | --- | --- |
| 1 | `sagemro.cn` 首页 · **主入口** | 国内主机厂（**售后部门 / 海外事业部**，不是设备采购） | "能不能替我把保内上门、海外装机、返修件包下来，比我自己做更便宜？" | 提交协作需求（进 `leads`） |
| 2 | `sagemro.cn` 首页 · **次入口** | 国内终端工厂（3–50 台设备） | "我的设备坏了找谁、多久、多少钱？" | AI 先整理问题 / 填服务需求 |
| 3 | `sagemro.com` 首页 | 海外终端客户与设备使用者 | "谁能来修、覆盖哪些品牌、多久到？" | AI 诊断 / Request service |
| 4 | `sagemro.com/partners/`（**新建**） | **主机厂的海外渠道商与代理** | "备件能不能到、有没有服务后盾、我卖设备时售后谁兜？" | Become a service partner |
| 5 | `engineer.sagemro.cn` / `.com` | 合作工程师 | "**活从哪来**、一单多少钱、要不要我垫钱？" | 提交申请 |

【判断】第 1 与第 3 项是同一个业务的两端：CN 面向**上游付费甲方**，COM 面向**海外需求方**——正好对应发起人的两项能力（主机厂关系、外贸交付）。这是本次改造真正的战略价值。

---

## 3. 定位纪律（防止三个站点互相打架）

| 纪律 | 理由 |
| --- | --- |
| CN 主入口**不出现"设备销售 / 代理"话术** | 会与 `euchio.com` 定位重叠，也会与主机厂自己的销售体系冲突 |
| `/partners/` 写"**支持主机厂的海外渠道服务**"，**不写"招收独家代理"** | 发起人已确认：渠道商是**帮主机厂招/支持的**，不是自己的。且 `cross-project-synergy.md` 的铁律明确禁用"独家代理"表述（无正式独家协议时可能构成虚假宣传） |
| COM 首页保持**终端客户**为主，渠道商不占首屏 | 渠道商要招商政策与利润，终端客户要"谁能来修"，两种搜索意图混在一个首屏会互相稀释 |
| 品牌露出分寸：`SAGEMRO` 是平台/服务品牌 | `Footer` 契约测试禁止出现"由济南钰峭机械有限公司运营"，CN 站也不得把 `EUCHIO` 作为主体露出 |

---

## 4. 改造清单（按文件）

| 站点 / 页面 | 文件 | 改什么 |
| --- | --- | --- |
| CN 首页 | `frontend/src/data/publicHomeContent.js`（`zhContent`） | 首屏改为**双入口**：主 CTA 面向主机厂、次 CTA 面向终端工厂；hero 与首屏三块文案重写 |
| COM 首页 | 同上（`enContent`） | 保持终端客户为主；仅微调，不大改 |
| CN 服务页 | `frontend/src/data/servicePages.js`（`SERVICE_PAGES['zh-CN']`） | 视定位新增面向主机厂的协作条目（出海售后、保内上门外包、返修件流转） |
| 渠道商页 | **新建** `frontend/src/components/Public/PartnersPage.jsx` + `App.jsx` 路由 + `publicSeoRoutes.js` 路由与 schema | `/partners/`，仅 COM 露出（CN 不出现） |
| 工程师页 | `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`（`ENGINEER_RECRUITING_COPY`） | 补"活从哪来"（主机厂派单 / 海外装机 / 保内上门）、技能门槛（能独立处理 6kW 以下机型）、结算与垫资口径 |
| 技术洞察 | `frontend/src/data/diagnosticGuides.js`、`insights.js` | 后续可增主机厂视角内容（**不在本轮**） |
| CN 发布通道 | `.github/workflows/aliyun-cn-deploy.yml` | 见第 7 章；**本文不授权修改** |

> **首页与 `/partners/` 的具体文案**见配套文件 `2026-09-29-com-cn-homepage-copy-deck.md`（待审，含逐槽位中英文案与四处待拍板措辞）。

---

## 5. 🔴 契约测试影响清单（改文案前必读）

`frontend/tests/brand-assets-contract.test.mjs` 对文案有**逐句断言**。以下是本方案会触及的部分（已逐行核对）：

| 约束 | 具体内容 |
| --- | --- |
| 必须保留 | `ChatArea`：`SAGEMRO AI 设备服务平台`、`专为激光和成型设备打造的智能服务助手`、中英文 AI 免责声明（"最终诊断、报价和现场安全需经 SAGEMRO 服务流程确认"） |
| 必须保留 | `Footer`：`© 2026 SAGEMRO`、`鲁ICP备2026032904号-1`、备案链接 |
| 必须保留 | `EngineerRecruitingPage`：`客服工程师品牌共创平台`、`SAGEMRO Service Engineer Brand Program`、`客服工程师品牌共创，让技术价值充分体现`、`Co-create the service brand. Earn what your skill is worth.` |
| **禁止出现** | `EngineerRecruitingPage`：`智能服务系统`、`Certified Representative Program` |
| **禁止出现** | `ChatArea` 与 `Footer`：`sales lead`、`Repair Estimate AI`、`Equipment Health Report AI`、`Health Report`、`operated by Jinan Euchio Machinery`、`由济南钰峭机械有限公司运营` |
| 必须保留 | `welcomePageCopy`：`SAGEMRO Service OS` 或 `Useful shop-floor tools`；**禁止** `sales lead`、`right conversion action`、`Lead type` |
| 必须保留 | `LegalModal`：`Service cost reference`、`服务费用参考`；**禁止** `Repair estimate`、`维修估算` |
| **全目录禁用表述** | 一条正则，共五个备选分支：三个「钣金 + 设备」类旧组合词（含中间夹字的变体）、一个把「成形」误写成「成型」的旧组合词、一个英文 sheet/metal 组合词。扫描范围：`frontend/src`、`admin/src`、`worker/src`、`docs`、`Marketing` 与根目录 `*.md`。**逐字正则见测试文件第 146 行——本文不复制它，因为复制动作本身就会触发它**（本稿第一版正是这样被自己的规则拦下的） |

【判断 · 高】**改造顺序必须是"先改测试表达新口径 → 再改文案"**，不要改完文案再放宽断言。后者等于把契约测试变成橡皮图章，而这些断言正是防止 AI-first 客户端文案被普通营销话术覆盖的护栏（见 `CLAUDE.md` 第八节）。

---

## 6. SEO 影响

| 市场 | 现状 | 改造后方向 |
| --- | --- | --- |
| CN | `Baiduspider` allowed（由 `market=cn` 决定） | 主机厂导向：设备维保外包、保内上门服务、设备返修、出海售后协作。**避免与 `euchio.com` 的销售关键词互抢** |
| COM | `en`，`Baiduspider` disallowed | 终端客户：`laser cutting machine repair`、`laser service`；`/partners/` 用 `service partner` / `dealer support`，**不用** `distributor wanted` |
| 既有差异须保留 | `publicSeoRoutes.js` 中 CN 会**去掉** Store 链接，COM 保留 `dhgate` store 入口 | 改造不得抹平这条差异 |

---

## 7. CN 发布通道：三个选项的评估与建议

### 7.1 现实约束（已核实）

- `.github/workflows/aliyun-cn-deploy.yml` 第 23 行硬校验：`if [ "${GITHUB_REF_NAME}" != "china-edition" ]` → `::error::` 失败；第 94–95 行构建为 `npm run build:public` / `build:portal`，**无 `SAGEMRO_BUILD_MARKET: cn`**。
- 仓库现状：当前分支 `main`（7b1ca77）；`china-edition`（5a81154）。
- 项目记忆（`AGENTS.md`）：`china-edition` **已冻结、不再同步**，但仍是 CN 的唯一构建来源；与 main **双向分叉**（CN 独有提交 479、main 独有 483）；CN 独有 28 个 `frontend/` 文件。

### 7.2 选项评估

| 选项 | 评估 | 结论 |
| --- | --- | --- |
| **直接改 `china-edition`** | ❌ 与项目记忆冲突——该分支被明确要求"**不要把它当成待同步的分支**"。且它没有 `frontend/scripts/markets.mjs`（无 market 维度），改动**无法回流 main**，结果是中文文案双份维护、永久分叉 | **不建议**。注：`docs/superpowers/plans/2026-09-07-business-com-cn-rollout.md` 曾把"同步到 china-edition"写成常规做法，但该做法**已被 2026-09-17 之后的冻结决定取代** |
| **暂缓 CN** | ❌ 发起人已明确"中文必须改造"；且 CN 前端长期落后会累积成更大的迁移债 | **不可接受** |
| **把 CN 发布入口切到 main** | ✅ 但有前置工作量（见 7.3） | **建议采纳，分三步** |

### 7.3 建议：切 main，分三步，第一步只读

**支持这个建议的三条理由：**

1. **CN 本来就欠一次同步。** 项目记忆原文："**CN 侧尚未同步这次裁剪**：`china-edition` 分支仍带着完整旧功能，CN 的裁剪是紧接的第二步。"——切 main 等于**一次完成两件已经欠着的事**（受众改造 + 裁剪同步）。
2. **那 28 个"CN 独有文件"很可能大部分是已下线的旧功能 UI。** 若只读审计证明多数是死代码，切 main 的性质就从"高风险内容迁移"变成"顺势完成 CN 裁剪"，风险大幅下降。**这也是为什么第一步必须是审计，不是切换。**
3. **不切 main，中文改造将永远需要双份维护**，而 `china-edition` 已经冻结——每改一次中文文案都要在两个分支各改一遍。

**三步：**

| 步 | 动作 | 产出 | 授权 |
| --- | --- | --- | --- |
| ① | **只读差异审计** | 逐项清单：CN 独有 28 个文件的"保留 / 丢弃 / 移植"分类，并标注哪些属于已下线旧功能 | 只读，无需生产授权 |
| ② | 三处改动：`aliyun-cn-deploy.yml` 的 ref 校验、构建加 `SAGEMRO_BUILD_MARKET: cn`、`frontend/tests/aliyun-deploy-workflow-contract.test.mjs` 断言 | 可构建正确 CN 产物的 workflow | 🔴 **必须单独批准**（项目协作约束：修改 `deploy.yml` / `wrangler.toml` / Pages 项目名前先在对话中确认） |
| ③ | 切换 + 阿里云发布 + 四站健康检查 | CN 新站上线 | 单独批准 |

### 7.4 ⏸ 但**现在不必做这一步**

**中文文案改造可以先在 main 上做完**（`zh-CN` copy 数据本来就在 main 里），只是发布通道没通。所以：

> **"中文必须改造"与"CN 由 china-edition 构建"不冲突——改造现在就能做，发布等切换。**

这样改造工作立刻可以开始，不被分支阻塞；CN 线上继续由 `china-edition` 服务旧站，切换到 main 之后一次性上线新文案。

---

## 8. 与战略备忘录的时序关系

| 事实 | 后果 |
| --- | --- |
| 站点改造**不产生第一张付费订单** | 主备忘录 §6 的 90 天目标是主机厂第一张付费订单；改造不应占用它的资源 |
| 受众定位取决于"关系方是整机集成商还是光源厂" | 主备忘录 §9 第 1 项仍是**唯一能推翻全局的变量**；若关系方是光源厂，第 2 章第 1 项入口（服务承包）不成立，CN 首屏话术要改为备件与模块渠道 |
| 碎片化报告 §1：系统与品牌是**放大器不是发动机** | 改造可以现在做（零部署风险、纯文案），但**推广投入**必须排在发动机（在保密度/第一张付费订单）之后 |

【判断】**建议时序**：文案改造现在在 main 上完成（不发布）→ 关系落纸 + 第一张付费订单 → 再做第 7 章的 CN 发布通道切换 → 一次性上线中文新站。若 30 天内关系落不成纸，改造暂停。

---

## 9. 待确认与遗留风险

| # | 项 | 状态 / 影响 |
| --- | --- | --- |
| 1 | 主机厂关系方类型 | ✅ **已定：整机集成商**（2026-09-29）→ CN 主入口写"服务外包 + 出海协作 + 保内上门" |
| 2 | `/partners/` 的主 CTA 落点 | ✅ **已定：新增 `POST /api/partners`**（复用 `leads` 表，无 migration），已实施 |
| 3 | CN 首页是否保留 AI 对话框 | ✅ **已定：不保留**（整机厂受众前不放终端诊断组件；设备用户走次入口 CTA 进 AI 门户） |
| 4 | `工维邦` 是否作为 CN 客户端品牌露出 | ✅ **近似检索已通过**（代理确认可注册，2026-09-29 发起人告知）。仍待决：是否作为 CN 客户端品牌露出——若露出，CN 站文案要带品牌 |
| 5 | CN 发布通道是否按第 7 章推进 | ⏳ 未决。决定中文新文案何时可见 |
| 6 | 🔴 **与整机厂签约时的"品牌使用"条款** | ⏳ 未决，但**必须在签约前谈**——见 §9.1 |

### 9.1 ✅ 已解决（2026-09-29）：品牌页整体下线

**决策：删除 `/brands/` 品牌页与其中全部内容**（发起人 2026-09-29 决定）。删除后公开站不再出现任何设备品牌名——"品牌名是否适合公开"这个问题，连同下面分析出的三处张力，一并消失。

**实施范围**：删除 `brandServicePages.js`、`Brands/BrandServicePages.jsx`、`brand-service-pages.test.mjs`（含 `Brands/` 目录）；移除 `App.jsx` 的路由与 SEO 公开路径、`publicSeoRoutes.js` 的 `/brands` 路由与首页链接、`publicHomeContent.js` 的 `brands` 段、`PublicHomePage.jsx` 的品牌分节与 4 条 label、`PublicSiteShell.jsx` 的导航项、`buildPublicPages.mjs` 的 `llms.txt` 条目；并重新生成 `public/sitemap.xml` 与 `public/llms.txt`（公开路由数 → 22）。**全部可从 git 历史恢复。**

> ⚠️ **代价（需知晓）**：`/brands/` 下 14 个页面（中英各一套，共 28 个 URL）此前是**已索引的高意图落地页**（`{brand} laser repair` 这类词）。删除后这部分自然流量归零。若日后想找回，可用**不含品牌名**的品类页（如"光纤激光器维修"/"切割头维修"）承接同样的搜索意图。

**以下是当初做出该决定时的分析，保留作为决策依据。**

【事实】删除前 `/brands/` 下有 **14 个品牌页**（大族、宏山、邦德、海目星、TRUMPF、百超、天田、亚威、锐科、IPG、创鑫、柏楚/BOCHU、倍福、RayTools），每页都渲染 `independenceNotice`：**"SAGEMRO 是独立的多品牌工业设备服务协调方，并非 {品牌} 官方服务机构，也未获得该品牌授权。品牌名称仅用于识别客户现有设备。"**（`brandServicePages.js` 第 75 行；`BrandServicePages.jsx` 第 103 行渲染；`brand-service-pages.test.mjs` 用断言锁定中英文措辞）

【判断】**这段声明在法务上是正确做法**——商标的**指明性合理使用**：用他人商标说明"我能服务你已有的这台设备"是允许的，只要不暗示授权或来源关系。在"独立第三方维保商"身份下，这是最稳的口径。

但它与新的"做整机厂服务承包方"战略存在三处张力：

| # | 张力 | 后果 |
| --- | --- | --- |
| 1 | 公开站上写着"**未获得该品牌授权**"，而新卖点恰恰是"承接该整机厂的售后交付" | 客户或整机厂看到会困惑：到底有合作还是没合作 |
| 2 | `/brands/` 把该整机厂与**它的竞品**并列在同一个 hub 下 | 部分整机厂会反对自己的品牌与竞品并列出现在第三方服务商页面 |
| 3 | 授权服务商身份一旦成立，"独立第三方"表述就不再准确 | 文案口径必须按关系分层，不能再一句通用 |

【判断 · 高】**处理方式：按关系分层，并把品牌使用写进合同。**

1. **无书面合作的品牌** → 保留现有独立性声明口径（合规且安全）。
2. **有书面合作的整机厂** → 品牌使用措辞**必须由书面授权决定**，不能由市场端自行决定。签约时要明确谈三件：可否公开使用其品牌名、以什么措辞（"授权服务商" / "合作服务商" / 仅"服务支持"）、可否与竞品并列在同一页面。
3. **`/partners/` 页面不列任何品牌名**（当前实现即如此）。该页受众是"主机厂的海外渠道商"，在那个语境下列品牌最容易暗示并不存在的渠道/代理关系——这也会撞上 `cross-project-synergy.md` 明令禁用的"独家代理"表述。

> 这条因此是**签约前置条件**。它与《双线选择决策备忘录》§5.1"往客户界面 / 服务数据 / 品类或区域权上爬"是同一件事的两面：**品牌使用权也是要让对方在合同里给出的东西**，而不是自己先挂在网上再说。

---

## 附：本文核实的事实与来源

| 事实 | 来源 | 方式 |
| --- | --- | --- |
| market 只决定 locale / host 与静态资产叠加 | `frontend/scripts/markets.mjs`（`MARKETS`、`copyMarketAssets`） | 读全文 |
| CN 判定来自 `isCnLocale()`，文案为 `en` / `zh-CN` 双份表 | `frontend/src/App.jsx`、`data/publicHomeContent.js`、`data/servicePages.js`、`components/Engineer/EngineerRecruitingPage.jsx` | grep + 读 |
| CN 构建无 market 开关、ref 硬校验 `china-edition` | `.github/workflows/aliyun-cn-deploy.yml` 第 20–24、94–95 行 | 读 |
| 当前分支 `main` 7b1ca77、`china-edition` 5a81154 | `git branch -a` | 命令 |
| 文案逐句断言与全目录禁用表述正则 | `frontend/tests/brand-assets-contract.test.mjs` 第 115–164、146–150 行 | 读 |
| CN 去掉 Store 链接、COM 保留 dhgate store | `frontend/src/data/publicSeoRoutes.js` 第 258 行 | grep |
| `china-edition` 冻结、双向分叉 479/483、CN 独有 28 个文件 | 项目记忆 `AGENTS.md` / `CLAUDE.md` 第三节 | 指令上下文 |
| 曾经的"同步到 china-edition"做法 | `docs/superpowers/plans/2026-09-07-business-com-cn-rollout.md` Task 5 | 读全文 |

> 本文写作约定：本文件所在目录会被 `frontend/tests/brand-assets-contract.test.mjs` 扫描，品类表述统一用「激光和成型设备 / 金属成形设备」，未使用被契约测试禁止的旧表述。
