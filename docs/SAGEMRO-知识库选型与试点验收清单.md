# SAGEMRO 知识库选型与试点验收清单

> 版本 v1 · 2026-09-17
> 读者：第 1–4 章给业务决策者，第 5 章与附录给技术执行
> 起因：评估自建知识库检索能力时，需要判断「直接采购成熟产品」是否比自研更可靠、更稳

---

## 0. 三句话说明

1. 这份清单只解决一个问题：**知识库这件事，哪些该买、哪些买不到、买了以后怎么判断是不是真有用。**
2. 第 3 章的问题清单可以**直接复制发给供应商**——对方答不上来或答得含糊的项，就是风险项。
3. 第 4 章的验收标准是用来**否掉**方案的，不是用来美化方案的。跑不达标就停，这是它存在的意义。

### 标记约定

| 标记 | 含义 |
| --- | --- |
| ✅ | 已在本仓库核实，可追溯到文件与行号 |
| ⚠️ | **未核实**。价格、区域可用性等为公开线索，必须由供应商书面确认 |
| 🔴 | 硬约束，不可妥协 |

> 说明：本清单编写时的网络环境无法打开供应商官网与定价页，因此**所有商务与技术细节都标记为 ⚠️**，只作为向供应商提问的起点，不作为决策依据。

---

## 1. 核心判断

### 1.1 知识库必须拆成三层看

把「知识库」当一个整体去选型，一定会选错。它实际是三层不同的东西：

| 层 | 干什么 | 能不能买 | 建议 |
| --- | --- | --- | --- |
| **文档解析层** | 把扫描件、表格、图片版手册变成干净文本 | 能，且标准化程度最高、风险最低 | ✅ **先买这层** |
| **检索层** | 把客户的问题匹配到正确的资料 | 能，托管方案已成熟 | 试点后再定 |
| **业务治理层** | 条目级审核、版本、适用工况、风险等级、禁止承诺项、双市场隔离 | **买不到** | 🔴 **自研（已具备）** |

### 1.2 为什么第三层买不到

这不是供应商不够强，而是这一层是 SAGEMRO 的行业判断，不在任何通用产品的能力范围内。仓库内可核实的依据：

- ✅ `worker/src/index.js:1417` —— 知识只能作为参考，**不得**作为最终诊断、报价、安全批准或配件适配承诺
- ✅ `worker/migrations/024_ai_evolution_foundation.sql:43` —— `knowledge_articles` 含 `market` / `locale` / `applicable_equipment` / `applicable_brand` / `applicable_model` / `risk_level` / `version` / `status` / `reviewed_by`
- ✅ `worker/migrations/046_knowledge_candidate_pipeline.sql:10` —— 候选 → 审核 → 发布的完整流水线
- ✅ `admin/src/pages/KnowledgeCandidatesPage.jsx:91` —— 高危条目禁止贡献工程师自审

**结论**：供应商能提供「引擎」，提供不了「这台设备在这个工况下该不该这么答」的判断权。买引擎不等于把责任转移出去。

### 1.3 三条不建议做的事

1. 🔴 **不要把客户设备档案、维修记录、报价数据交给外部供应商做训练或分析。** 解析手册可以外包，客户数据不行。
2. 🔴 **不要让任何方案自动对外承诺**报价、配件适配、安全结论、交期。这是 `worker/src/index.js:1417` 已经立下的规矩。
3. ⚠️ **不要在没有样本的情况下选型。** 没有 20 份真实手册 + 100 条真实问题的样本，任何对比都是听供应商讲故事。

### 1.4 明确不买的东西

| 不买 | 原因 |
| --- | --- |
| 知识图谱类能力 | 我们的关系已经长在 `applicable_*` 字段与工单/维修记录外键上（✅ `worker/migrations/024_ai_evolution_foundation.sql`），再上一个图库是纯成本 |
| 「AI 自动诊断」整包 | 与 🔴 第 2 条直接冲突 |

---

## 2. 候选供应商清单

> 全部价格与区域可用性均为 ⚠️ 未核实。请用第 3 章的问题清单逐项书面确认。

### 2.1 文档解析层（建议先买）

| 产品 | 归属 | 强项 | 对 SAGEMRO 的注意点 |
| --- | --- | --- | --- |
| Azure AI Document Intelligence ⚠️ | 微软 | 表格与版式抽取成熟；**中国区由 21Vianet 运营，有独立文档站点** | 中国区是独立云、独立账号、独立计费 |
| LlamaParse ⚠️ | LlamaIndex（美） | 面向 RAG 的解析质量，复杂 PDF 表现好 | 数据出境；中国区可用性待确认 |
| Unstructured ⚠️ | Unstructured.io（美） | 支持格式最广，可自托管 | 自托管＝回到运维问题 |
| Amazon Textract ⚠️ | AWS | 与 AWS 生态一体 | 中国区为独立分区 |
| Google Document AI ⚠️ | 谷歌 | OCR 与表单抽取强 | 中国区基本不可用 |

**为什么先买这层**：它输入输出定义清晰（文件进、文本/表格出），可以直接喂进现有的知识候选流水线；即使将来换供应商，重跑的代价也只是重新解析一遍手册。

### 2.2 检索层（试点后再定）

| 产品 | 归属 | 强项 | 对 SAGEMRO 的注意点 |
| --- | --- | --- | --- |
| Vectara ⚠️ | 美 | 托管 RAG 服务，带幻觉度量 | 不含市场隔离与适用工况规则，仍要自己包一层 |
| Ragie ⚠️ | 美 | 面向开发者的托管 RAG API | 同上 |
| LlamaCloud ⚠️ | LlamaIndex（美） | 与解析层同一家，链路短 | 同上 |
| Pinecone Assistant ⚠️ | 美 | 向量库厂商的托管问答层 | 同上 |
| Azure AI Search ⚠️ | 微软 | 混合检索成熟，中国区可用，与企业权限体系一体 | 深度绑定该云 |
| AWS Bedrock Knowledge Bases ⚠️ | AWS | 托管知识库，与 Bedrock 模型一体 | 中国区为独立分区 |
| Google Vertex AI Search ⚠️ | 谷歌 | 与 Google 生态一体 | 中国区基本不可用 |
| Onyx（原 Danswer）⚠️ | 开源 | 可自托管，数据完全自控 | 自托管＝运维责任回到自己身上 |

**关键差别**：这一层无论买谁，**第 1.1 节的第三层都还在我们手里**。所以选型的重点不是「谁的检索更准」，而是「谁愿意按我们的规则做过滤和引用回传」。

### 2.3 垂直整包方案（商业决策，不是技术选型）

| 产品 | 强在哪 | 对 SAGEMRO 的含义 |
| --- | --- | --- |
| Aquant ⚠️ | 面向制造业服务，用 OEM 手册 + 历史工单给技师建议，主打「沉淀专家知识」 | 与 SAGEMRO 的 AI 服务定位高度重叠 |
| Mavenoid ⚠️ | 硬件厂商的 AI 排障，支持拍照识别（Vision Assist）；公开客户含 Stanley Black & Decker | 同上，且有面向终端客户的形态 |
| Salesforce Agentforce for Field Service ⚠️ | 与 Field Service 工单体系一体 | 要把工单主数据迁进 Salesforce |
| 国内同类（诺力「AI 智能服务助手」、艾问「设备维修助理」等）⚠️ | 已在叉车等设备售后场景落地 | 说明这个赛道国内已有竞争者在跑，值得做竞品调研 |

🔴 **这一类的本质是「替代你们的产品」而不是「给你们加功能」。** 采用它等于把核心差异化租出去、按月付费，且客户数据与知识资产沉淀在对方平台上。这是商业决策，必须由业务方拍板，不能当成技术选型顺手决定。

### 2.4 中国市场专用（CN 链路必须单独考虑）

中国版是真实业务（见 `AGENTS.md` 第二节），因此 CN 链路不能沿用 COM 的选型结论。

| 产品 | 归属 | 说明 |
| --- | --- | --- |
| 阿里云百炼知识库 ⚠️ | 阿里云 | 有公开的知识库计费说明（示例为 `text-embedding-v4` + `qwen3-rerank` 组合）；与 ECS 同云，网络路径短 |
| 腾讯云智能体开发平台 / 大模型知识引擎 ⚠️ | 腾讯云 | 企业知识问答场景案例较多；与 WeKnora 同属腾讯体系 |
| RAGFlow / Dify / FastGPT ⚠️ | 开源 | 可部署在现有阿里云 ECS 上，数据不出境 |

🔴 **硬约束**：COM 侧客户数据不得进入部署在中国大陆机器上的知识库；CN 侧数据不出境。两套环境的知识内容需要物理隔离，这与 `AGENTS.md` 中 COM/CN 双 D1 的隔离口径一致。

---

## 3. 向供应商必须问清的问题

> 直接复制本节发送。**建议要求书面答复**，口头承诺不计入评估。

### A. 中国市场与合规（最容易踩坑，先问）

1. 你们的产品在中国大陆是否可用？由哪个法律实体运营（直营 / 21Vianet / 其他）？
2. 中国区是否与全球区**独立账号、独立计费、独立数据存储**？是否可以只买中国区？
3. 数据存储的物理位置在哪里？是否支持指定区域？
4. 是否签署数据处理协议（DPA）？是否支持数据删除与导出？
5. 你们是否会使用我们的数据训练模型？如果会，能否关闭并写入合同？

### B. 数据与安全

6. 文件在传输与静态存储时如何加密？
7. 你们的员工是否可以访问我们上传的文档？访问是否有审计日志？
8. 是否支持单点登录（SSO）与最小权限？
9. 发生过数据泄露事件吗？最近的独立安全审计报告（SOC 2 / ISO 27001）能否提供？

### C. 能力边界（这一节决定能不能用）

10. 能否只做**文档解析**、把结果回传给我们，不接管问答？（对应第 2.1 节）
11. 检索时能否按我们提供的字段做**硬过滤**（市场、语言、设备型号、材料、功率）？
12. 返回结果能否附带**原文出处**（哪份文件、哪一页、哪一段）？
13. 当知识库里没有依据时，系统能否**拒绝作答**而不是编造？这个行为能否被强制开启？
14. 能否记录每一次检索的引用来源，供我们事后审计？
15. 是否支持中英文混合检索？中文的分词与召回质量能否提供实测数据？
16. 扫描件与图片版手册的 OCR 准确率是多少？表格类（报警码对照表）能否保持行列结构？

### D. 商业条款

17. 定价模型是什么（按页 / 按 token / 按席位 / 按查询量）？有没有最低消费？
18. 是否有年付长约？能否先按月付费试点？
19. 超额使用的单价是多少？是否有预算上限保护？
20. 价格上调的频率与通知期？

### E. 退出与迁移

21. 如果终止合作，我们如何导出全部数据与处理结果？格式是否通用？
22. 迁移协助是否收费？
23. 服务等级协议（SLA）的可用性承诺是多少？不达标的赔付方式是什么？
24. 你们公司的融资与经营状况如何？（关系到未来 2–3 年是否还在）

---

## 4. 试点方案与验收标准

### 4.1 样本准备（这一步不能省）

| 项 | 数量 | 要求 |
| --- | --- | --- |
| 真实设备手册 | 20 份 | 覆盖不同品牌、含至少 5 份扫描件、至少 3 份带表格 |
| 真实客户问题 / 历史工单 | 100 条 | 中英文各半，含至少 20 条「知识库里没有答案」的 |
| 期望正确答案 | 100 条 | 由资深工程师人工标注，作为评分基准 |

### 4.2 时间盒

- **总计 4–6 周**，超出即重新评估，不允许无限延长。
- 建议节奏：第 1 周备样本 → 第 2–3 周接入与调参 → 第 4 周盲测打分 → 第 5–6 周出结论。
- 🔴 试点期间**不签长约、不同时上两家**。

### 4.3 验收标准

| 指标 | 定义 | 目标 | 性质 |
| --- | --- | --- | --- |
| **编造率** | 答案中出现资料里没有的参数、配件适配、报价或安全结论 | **必须为 0** | 🔴 一票否决 |
| **无依据拒答率** | 资料中确实没有答案时，系统正确表示「无法确认」的比例 | ≥ 95% | 🔴 一票否决 |
| **可溯源率** | 给出的答案能指回具体文件与位置的比例 | ≥ 90% | 硬指标 |
| **正确率** | 与工程师标注答案一致的比例 | ≥ 70% | 硬指标 |
| **中文召回质量** | 2–3 字关键词（如「激光」「切割头」）能召回正确资料的比例 | ≥ 80% | 硬指标 |
| **表格结构保真** | 报警码对照表的行列结构在解析后是否可用 | 人工判定 | 硬指标 |
| **人工工时下降** | 整理一份手册所需人工时间的变化 | ≥ 50% | 收益指标 |

> ⚠️ 上述目标值为建议起点，需由业务方与工程师共同确认后再固化，不要在试点中途下调。

### 4.4 评分表（用于横向比较多个方案）

| 维度 | 权重 | 评分（1–5） | 备注 |
| --- | --- | --- | --- |
| 编造率与拒答行为 | 30% | | 一票否决项，不达标直接淘汰 |
| 正确率与可溯源率 | 25% | | |
| 中文与表格处理质量 | 15% | | |
| 中国市场可用性与合规 | 15% | | 不满足则仅可用于 COM 或直接淘汰 |
| 集成与运维成本 | 10% | | |
| 商务条款与退出成本 | 5% | | |

### 4.5 停止条件

出现以下任一情况，立即停止试点并回到方案对比：

1. 编造率不为 0，且供应商无法给出可验证的修正方案；
2. 无依据拒答率低于 95%；
3. 供应商拒绝书面答复第 3 章 A 组的合规问题；
4. 试点周期超出第 4.2 节的时间盒。

---

## 5. 与现有系统的对接点（给技术执行）

对接本身风险很低：AI 服务运行在 Cloudflare Workers 上，接入任何外部服务本质上是一次 HTTPS 调用。真正的工作量在内容整理与评测。

### 5.1 现有地基（✅ 仓库内可查）

| 能力 | 位置 |
| --- | --- |
| 知识条目与检索工具 | `worker/src/index.js:1360-1419`（当前为 `instr()` 关键词匹配，无向量） |
| 知识条目表 | `worker/migrations/024_ai_evolution_foundation.sql:43` |
| 候选 → 审核 → 发布流水线 | `worker/migrations/046_knowledge_candidate_pipeline.sql:10`、`worker/src/lib/knowledge-candidate-workflow.js` |
| 后台管理界面 | `admin/src/pages/KnowledgePage.jsx`、`KnowledgeCandidatesPage.jsx` |
| 定时任务机制（可承载解析任务） | `worker/src/index.js:23864`（`scheduled` + `ctx.waitUntil`） |
| 文件存储 | `worker/wrangler.toml` 的 R2 `ATTACHMENTS` / `FIELD_EVIDENCE` |

### 5.2 建议的接线方式

1. 外部解析服务**只做解析**：手册进去，结构化文本出来。
2. 解析结果落到知识候选表，走**现有审核流水线**，不直接写入 `knowledge_articles`。
3. 审核通过后的条目才是 AI 可引用的知识；引用来源照常记录。
4. 检索层如果采购，则由 Worker 调用其 API，并**在调用前用 `market` / `locale` / `applicable_*` 做前置过滤**，避免跨市场串数据。

### 5.3 🔴 改动前必须注意

- 检索逻辑的改动会触碰既有契约测试：`worker/tests/knowledge-search-tool.test.mjs`、`worker/tests/knowledge-priority-policy.test.mjs` 锁定了提示词中的 `Knowledge Priority & Conflict Policy` 等字符串；`admin` 侧有对应断言。**改检索必须同批次更新这些测试**，否则 `test` job 会失败。
- 新增 migration 后，部署 Worker 前必须手动在生产 D1 执行（见 `AGENTS.md` 第五节）。

---

## 附录 A：未经核实条目汇总

以下内容在编写时**无法核实**，使用前必须确认：

| 条目 | 状态 |
| --- | --- |
| 所有产品价格、计费模型、最低消费 | ⚠️ 未核实 |
| Azure AI Search / Document Intelligence 在中国区的具体可用范围与限制 | ⚠️ 仅确认存在中国区文档站点，具体功能范围未核实 |
| AWS 中国区（北京 / 宁夏）服务清单与开通流程 | ⚠️ 未核实 |
| LlamaParse、Ragie、Vectara、Onyx 的中国区可用性与合规安排 | ⚠️ 未核实 |
| Aquant、Mavenoid 的实际报价、实施周期与是否接受中国企业客户 | ⚠️ 未核实 |
| 各家的 OCR 准确率、中文召回质量 | ⚠️ 厂商宣称值，必须用第 4.1 节样本实测 |
| 阿里云百炼知识库、腾讯云知识引擎的完整计费与限制 | ⚠️ 仅确认存在公开计费说明页，未核实细节 |

---

## 附录 B：信息来源

以下为编写时检索到的公开来源，**均只读取到搜索摘要，未打开正文**：

- RAG 服务与平台对比：[RAG as a Service in 2026](https://forage.ai/blog/rag-as-a-service-platforms/)、[Top 5 RAG-as-a-Service Platforms 2026](https://guptadeepak.com/tools/top-5-rag-as-a-service-platforms-2026/)、[Best Enterprise RAG Platforms 2026](https://www.sphereinc.com/blogs/best-enterprise-rag-platforms-2026)
- 垂直行业方案：[Aquant — AI for Manufacturing Service](https://www.aquant.ai/industries/manufacturing-plants)、[Aquant — Preserve Expert Knowledge](https://www.aquant.ai/solutions/capture-critical-knowledge)、[Mavenoid — Generative Vision AI](https://www.mavenoid.com/en/blog/generative-vision-ai)、[Mavenoid × Stanley Black & Decker](https://www.mavenoid.com/en/customers/stanley-black-decker)
- 企业内部搜索：[Onyx 评测 2026](https://www.promptquorum.com/zh/power-local-llm/onyx-review)、[Glean 定价追踪](https://www.vendr.com/marketplace/glean)
- 文档解析：[LlamaParse 替代方案对比（2026）](https://www.nutrient.io/blog/llamaparse-alternatives/)、[AI Document Parsing 2026 对比](https://futurepicker.com/en/ai-document-parsing-llamaparse-unstructured-azure-google-2026-en/)
- 中国区可用性：[Azure 中国 — AI 搜索区域支持](https://docs.azure.cn/en-us/search/search-region-support)、[Azure 中国 — Document Intelligence Studio](https://docs.azure.cn/en-us/ai-services/document-intelligence/studio-overview)、[AWS 中国指南](https://appinchina.co/a-guide-to-aws-china/)
- 国内方案：[阿里云百炼知识库计费说明](https://help.aliyun.com/zh/model-studio/billing-for-knowledge-base)、[腾讯云大模型知识引擎案例](https://cloud.tencent.cn/developer/article/2677597)、[诺力 AI 智能服务助手](http://www.nobleliftgroup.com/news/news-detail-1115.htm)、[「设备维修助理」产品介绍](https://www.sohu.com/a/1057004708_422550)
- 项目内部依据：[`docs/SAGEMRO-AI-进化架构蓝图.md`](./SAGEMRO-AI-进化架构蓝图.md)（Phase 3 Knowledge OS / Phase 4 RAG 接入）、`worker/src/index.js`、`worker/migrations/024_ai_evolution_foundation.sql`、`worker/migrations/046_knowledge_candidate_pipeline.sql`

---

## 附录 C：一页行动清单

| 步骤 | 负责方 | 产出 |
| --- | --- | --- |
| 1. 用第 3 章问题清单联系 2–3 家文档解析层供应商 | 业务 + 技术 | 书面答复对比 |
| 2. 备好 20 份手册 + 100 条问题样本（第 4.1 节） | 工程团队 | 带标注的测试集 |
| 3. 由业务方确认第 4.3 节目标值 | 业务方 | 签字确认的验收标准 |
| 4. 执行 4–6 周试点 | 技术 | 盲测评分表 |
| 5. 依第 4.4 节评分表决策：买 / 不买 / 换一家 | 业务方 | 决策记录 |
