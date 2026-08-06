# SAGEMRO SEO 与 GEO 深度优化设计

**日期：** 2026-08-06
**状态：** 用户已逐节确认，等待书面复核
**业务目标：** 以设备故障诊断、维修服务和工程师支持的有效询盘为第一目标；免费工具承担搜索获客与品牌认知任务。

## 1. 背景与决策

SAGEMRO 当前已经具备中英文站、工具中心、技术文章、AI 诊断入口和推广分析能力，但自然搜索仍处于建立索引与搜索引擎认知的初期。

本设计采用以下路线：

> 技术地基 + 高意向服务与故障内容集群 + 免费工具引流 + 可引用的 GEO 内容体系。

不采用“先批量生成大量页面”的方式。原因是当前索引基础、内容深度、原始技术资料和搜索数据都不足以支撑大规模程序化 SEO。

## 2. 已验证的现状

### 2.1 Search Console

Google Search Console 已配置。审计时可见的近 28 天数据为：

- 总点击：0
- 总展示：11
- 平均点击率：0%
- 平均排名：25.3

数据量不足以可靠判断单个关键词的真实搜索量和转化价值，因此第一阶段不根据极少量查询数据追逐具体词，而按业务意图、真实服务能力、搜索联想和竞争页面共同排序。

百度搜索资源平台尚未配置。

### 2.2 抓取与索引

- `sagemro.com` 与 `sagemro.cn` 各有 16 个公开 sitemap URL，线上均返回 HTTP 200。
- sitemap 中已有 `.com` 与 `.cn` 的双向 `hreflang`，并以 `.com` 作为 `x-default`。
- 深层页面的初始 HTML 仍是通用标题、通用描述和空 React 容器；正确标题、canonical 和正文需要 JavaScript 执行后才出现。
- 不存在的路径返回 HTTP 200，再由客户端添加 `noindex`，存在软 404 风险。
- 尾部斜杠版本、`www` 与非 `www` 均可返回 200，缺少统一的服务端规范化跳转。
- sitemap 尚未提供准确 `lastmod`。

Google 可以执行 JavaScript，但静态可读 HTML 能降低渲染延迟与失败风险；对百度及部分 AI 搜索爬虫更重要。

### 2.3 内容与结构化数据

- 示例英文技术文章正文约 132 词，诊断深度不足。
- 示例工具页约 266 词，已有基本说明和 FAQ，但缺少完整公式、条件、示例、安全边界和工程师复核入口。
- 技术文章只有最小化 `Article` JSON-LD，缺少作者、审核者、发布时间、更新时间、主图和机构 Logo 等信息。
- 工具页暂无适配的 JSON-LD。
- 暂无 Open Graph、Twitter Card 和 `llms.txt`。

### 2.4 性能

线上抽测结果用于发现方向，不作为固定基准：

- `.com` 工具页 Lighthouse Performance 约 63，模拟 FCP/LCP 约 6 秒。
- `.cn` 工具页 Lighthouse Performance 约 56，模拟 FCP 约 9.7 秒、LCP 约 11.6 秒。
- 工具页加载了大量当前页面未使用的通用与 Markdown 代码。
- Logo 传输体积约 127 KB。
- `.com` 存在 Cloudflare beacon 与当前 CSP 冲突的控制台错误。

### 2.5 爬虫与 GEO

- `.com` 的 Cloudflare managed robots 当前表达 `search=yes, ai-train=no, use=reference`。
- `.com` 明确阻止了 GPTBot、Google-Extended、ClaudeBot 等训练或扩展用途爬虫，但未见对 OAI-SearchBot 的明确阻止。
- `.cn` 使用较基础的 allow/disallow robots 规则。

需要把“搜索发现与答案引用”和“模型训练”分开管理，避免限制训练时误伤搜索曝光。

## 3. 目标与非目标

### 3.1 目标

1. 让 Google、百度和允许的 AI 搜索爬虫无需执行 JavaScript即可读取公开页面的主要内容和 SEO 元数据。
2. 建立围绕激光切割机、折弯机、远程诊断和预防性维护的高意向搜索入口。
3. 让故障文章和工具自然引导用户进入 AI 诊断、工程师复核或服务需求提交。
4. 建立真实、可核验、可引用的中英文技术内容体系。
5. 用现有推广分析能力衡量自然搜索和 AI 引荐是否产生有效询盘。

### 3.2 非目标

- 不恢复或推广当前暂缓的折弯模拟器。
- 不批量生成品牌、型号、报警码和城市页面。
- 不虚构专家、门店、客户案例、评分、响应时间或成功率。
- 不以固定排名、固定流量或 AI 引用次数作为承诺。
- 不为 SEO 引入复杂的常驻 SSR 服务器。

## 4. 总体信息架构

公开搜索入口分为四类：

1. **服务页：** 承接明确维修、诊断和工程师支持意图。
2. **故障内容：** 回答具体故障，连接至诊断和服务。
3. **免费工具：** 完成计算或辅助判断，连接至工程师复核。
4. **品牌与枢纽页：** 说明 SAGEMRO 的实体、能力和内容层级。

推荐转化路径：

```text
Google / 百度 / AI 搜索
          ↓
服务页、故障内容或免费工具
          ↓
获得初步答案或计算结果
          ↓
AI 诊断 / 工程师复核 / 提交服务需求
          ↓
形成可跟进询盘
          ↓
真实案例脱敏后反哺内容
```

## 5. 技术 SEO 设计

### 5.1 构建时静态化

对有限的公开路由进行构建时静态化：

- 首页、工具中心、工具详情、技术内容中心、技术文章和公开服务入口生成完整 HTML。
- 初始 HTML 直接包含 title、description、H1、主要正文、canonical、hreflang 和 JSON-LD。
- React 在浏览器端继续接管交互，计算器与诊断功能保持现有行为。
- 登录后页面、后台和客户私有内容不进入预渲染与 sitemap。

选择构建时静态化而非全站 SSR，是因为公开页面数量有限，且需要同时适配 Cloudflare Pages 与阿里云 ECS 静态发布。

### 5.2 统一路由清单

建立一个公开路由清单作为以下输出的共同数据源：

- 构建时静态页面
- `.com` 与 `.cn` sitemap
- canonical
- hreflang
- 页面类型与结构化数据
- 索引许可
- 准确 `lastmod`

避免页面、sitemap 和 SEO 元数据分别手工维护后产生漂移。

### 5.3 URL 规范化

- HTTP 永久跳转到 HTTPS。
- `www` 永久跳转到非 `www`。
- 尾部斜杠只保留一个规范版本。
- 不存在的 URL 返回真实 HTTP 404。
- 404 页面保留可用导航，但必须为 `noindex`。
- 每个页面只声明一个 canonical。
- `.com` 与 `.cn` 继续保持双向 hreflang，`.com` 为 x-default。

具体跳转实现需要分别适配 Cloudflare Pages 与中国版 nginx，并在实施前按项目规则确认部署配置变更。

### 5.4 结构化数据

- 首页：`Organization`、`WebSite`
- 工具页：适用时使用 `SoftwareApplication` 或 `WebApplication`
- 技术文章：完整 `Article`
- 层级导航：`BreadcrumbList`
- 服务页：准确描述 provider、serviceType、areaServed 等可验证字段

文章补齐作者或团队、技术审核者、发布时间、更新时间、主图、发布机构和 Logo。FAQ 可作为正文，但不把 Google FAQ 富结果作为商业网站的主要策略。

### 5.5 robots 与 AI 搜索

- 允许 Googlebot、Bingbot、Baiduspider。
- 允许用于搜索发现和答案引用的爬虫，例如 OAI-SearchBot。
- GPTBot 等训练用途爬虫按公司政策单独控制。
- 不把 Google-Extended 与普通 Google 搜索抓取混为一谈。
- 核验 Cloudflare managed robots 与项目 robots 的最终合并结果。
- 提供简洁 `llms.txt` 作为辅助导航，不把它视为排名保证。

### 5.6 性能

- Markdown 与文章依赖只在内容页加载。
- 拆分工具页不需要的大型依赖。
- 优化 Logo 与首屏图片。
- 减少首屏脚本链，使静态正文先显示、交互代码后加载。
- 修复 Cloudflare 统计脚本与 CSP 的冲突，或移除不再使用的 beacon。

## 6. 关键词策略

### 6.1 四层关键词

| 层级 | 意图 | 中文示例 | 英文示例 | 目标 |
|---|---|---|---|---|
| 1 | 明确寻找服务 | 激光切割机维修、折弯机维修、工业设备维修服务 | fiber laser repair service, press brake repair service | 直接询盘 |
| 2 | 正在排查故障 | 不出光、毛刺、冷水机报警、折弯角度不准 | laser cutter not firing, fiber laser burr troubleshooting | 诊断或工程师支持 |
| 3 | 工艺与计算辅助 | 激光切割参数、折弯吨位、折弯展开 | laser cutting parameters, press brake tonnage calculator | 流量与品牌 |
| 4 | 品牌、型号、故障码 | 品牌报警代码、系列维修 | model-specific fault codes | 后期知识库 |

近期主攻第 1、2 层，增强第 3 层，暂缓规模化第 4 层。

### 6.2 核心服务页

建议建立或强化四个服务入口：

1. 激光切割机维修与故障诊断 / Laser Cutting Machine Repair & Diagnostics
2. 折弯机维修与精度恢复 / Press Brake Repair & Accuracy Support
3. 工业设备远程诊断与工程师支持 / Industrial Equipment Remote Diagnostics
4. 预防性维护与设备保养 / Preventive Maintenance Services

每页说明设备范围、可处理故障、远程与现场边界、客户需要准备的信息、服务流程、覆盖范围和提交方式。

### 6.3 激光切割内容集群

首批候选：

- 激光切割机故障诊断与维修
- 激光切割机不出光的排查顺序
- 切割毛刺、挂渣、烧边和切不透
- 保护镜片频繁烧坏
- 冷水机常见报警
- 焦点和喷嘴同心度校准
- 日常保养清单
- 不同材料厚度的参数调整方法

英文按真实搜索表达本地化，例如：

- fiber laser cutting problems and solutions
- laser cutting machine not firing
- fiber laser burr troubleshooting
- laser cutter not cutting through
- protective lens keeps burning
- laser chiller alarm troubleshooting
- fiber laser focus calibration
- laser cutting machine maintenance checklist

### 6.4 折弯内容集群

首批候选：

- 折弯机故障诊断与维修
- 折弯角度不准或左右不一致
- 液压压力不足
- 滑块、后挡料和伺服报警
- 折弯吨位计算
- V 槽选择与最小翻边
- 折弯展开、折弯扣除与 K 因子
- 折弯机维护检查表

英文按 `press brake troubleshooting`、`press brake angle accuracy problems`、`hydraulic press brake pressure problems`、`press brake tonnage calculator` 等表达布局。

### 6.5 页面合并原则

“维修电话”“维修联系方式”“维修师傅”“上门维修”等近义服务意图合并到一个高质量服务页。只有当问题拥有独立症状、原因、诊断步骤和解决方式时，才建立单独文章。

### 6.6 优先评分

候选主题按以下权重排序：

- 询盘和商业价值：40%
- Search Console、Google/Bing/Baidu 搜索联想与实际需求：25%
- SAGEMRO 是否能提供可靠答案：20%
- 当前竞争难度：15%

不编造搜索量；数据积累后以 Search Console、百度搜索资源平台和实际询盘校正。

## 7. GEO 与内容可信度

### 7.1 标准内容结构

每篇故障内容使用：

1. 直接结论
2. 安全提示
3. 症状确认
4. 按检查顺序排列的可能原因
5. 诊断步骤（检查对象、正常状态、异常表现、下一步）
6. 处理建议（可自行处理、需要技术人员、必须停机）
7. 参数、故障码与适用条件
8. 何时联系工程师

### 7.2 真实作者与审核

- 显示真实作者或 `SAGEMRO Technical Service Team`。
- 显示技术审核者或审核团队。
- 提供团队介绍、专业范围、发布日期、最近审核日期、修改记录和纠错入口。
- 不虚构专家姓名和履历。

### 7.3 第一手证据

优先使用可证明的原始经验：真实故障照片、脱敏报警画面、工程师检查顺序、参数变化、维修案例和工具计算示例。客户身份、品牌和序列号按需要脱敏。

公式、参数、安全规范和故障码优先引用制造商手册、标准组织或正式技术文档，并标明机型、版本、单位、适用条件和不确定范围。

### 7.4 品牌实体

统一品牌名称、业务类别、设备领域、服务地区、官方域名、中英文站关系、联系方式、Logo 和真实外部资料，使搜索系统将 SAGEMRO 识别为工业设备维修、诊断与 MRO 服务实体，而不是零散工具集合。

### 7.5 中英文本地化

中英文内容表达同一专业能力，但分别适配搜索语言、设备术语、单位和服务场景，不逐句翻译。

## 8. 转化与数据监测

### 8.1 页面主转化

| 页面类型 | 主转化 | 次转化 |
|---|---|---|
| 维修服务页 | 提交服务需求 | 查看服务流程 |
| 故障文章 | 启动 AI 诊断 | 联系工程师 |
| 维护内容 | 获取检查清单或建议 | 查看相关故障 |
| 免费工具 | 获取工程师复核 | 查看工艺指南 |
| 首页与枢纽页 | 描述设备问题 | 浏览服务能力 |

每页只突出一个主动作，避免所有页面统一使用缺少上下文的“联系我们”。

### 8.2 来源与事件

在现有推广分析能力中增加以下来源维度：

- google_organic
- baidu_organic
- bing_organic
- chatgpt_referral
- copilot_referral
- perplexity_referral
- unknown_organic

核心事件：SEO 落地页访问、有效阅读、工具启动与完成、AI 诊断启动与完成、服务表单开始与提交、工程师支持入口点击、有效询盘确认。

## 9. 分阶段实施

### 阶段 0：抓取和索引基础

- 构建时静态化
- 真实 404 与 URL 规范化
- canonical、hreflang、sitemap、lastmod
- 结构化数据
- robots、AI 搜索爬虫策略与 llms.txt
- 百度搜索资源平台准备
- 首屏性能优化

### 阶段 1：询盘入口

- 4 个核心服务页
- 中英文服务能力说明
- 页面主转化入口
- 自然搜索和 AI 引荐追踪
- 服务页、AI 诊断与工具的内部链接

### 阶段 2：首批高意向内容

优先发布不出光、毛刺与挂渣、冷水机报警、保护镜烧坏、折弯角度不准、左右不一致、液压压力不足和维护检查表等 8–12 个主题。中英文分别编写。

### 阶段 3：工具内容增强

优先增强折弯吨位、折弯展开、激光切割参数、切割成本等可靠工具。补充公式、输入项、单位、假设、示例、安全边界和工程师复核入口。

### 阶段 4：数据驱动扩展

根据 Search Console、百度数据和实际询盘决定后续故障主题、工具、品牌型号库、地区页和英文市场。无真实覆盖能力时不生成城市或 near-me 页面。

## 10. 验收标准

### 10.1 技术验收

- 公开 URL 的初始 HTML 直接包含正确标题、主要正文、canonical 和结构化数据。
- 不存在的 URL 返回真实 404。
- HTTP、www 和尾斜杠只保留一个规范版本。
- 中英文 sitemap 有效并包含准确 lastmod。
- 结构化数据无严重错误。
- Google、百度和允许的 AI 搜索爬虫可读取公开页面。
- 私有和登录后内容不进入 sitemap 与索引。

### 10.2 30 天观察

- Search Console 有效索引页面增长。
- 软 404 和抓取异常减少。
- 非品牌搜索展示开始增长。
- 百度能够发现并收录 `.cn` 页面。

### 10.3 60–90 天观察

- 高意向故障词和服务词的可见度提升。
- 自然搜索带来的诊断使用量增长。
- 工具至工程师复核的路径可测。
- 产生可追踪的自然搜索询盘。
- 第二批内容以真实查询和询盘数据决策。

## 11. 风险与控制

| 风险 | 控制方式 |
|---|---|
| 两套生产环境规则不同 | Cloudflare Pages 与中国版 nginx 分别验收跳转、404 和 sitemap |
| 构建时静态化破坏工具交互 | 静态 HTML 只负责首屏与索引，React hydration 后保持现有行为；为公开路由增加回归测试 |
| 中英文机械翻译 | 使用共同主题清单但分别写作和审核 |
| 故障建议造成安全风险 | 每篇提供安全边界、停机条件、适用设备和工程师升级路径 |
| 内容批量化导致薄页面 | 首轮限制为 4 个服务页、8–12 个故障主题和 4–6 个工具增强 |
| GEO 只做形式化标记 | 以可抓取正文、第一手证据、作者审核和可追溯来源为主，llms.txt 为辅 |
| 关键词流量不转化 | 以诊断启动、工程师复核和有效询盘作为核心指标 |

## 12. 权威参考

- [Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google 多区域与多语言网站指南](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google hreflang 指南](https://developers.google.com/search/docs/advanced/crawling/localized-versions)
- [Google sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google 对 sitemap lastmod 的说明](https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping)
- [Google Article 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Organization 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Cloudflare managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- [OpenAI publishers and developers FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)

## 13. 书面复核问题

实施计划开始前，需要确认本设计是否完整反映以下决策：

1. 询盘优先，工具流量为辅助。
2. 先修抓取与索引，再扩内容。
3. 采用构建时静态化，不引入常驻 SSR。
4. 首轮限制内容规模，不做程序化 SEO。
5. 允许搜索和答案引用类爬虫，训练类爬虫单独管理。
6. 中英文分别本地化，并同时覆盖 `.com` 与 `.cn` 实际生产环境。
