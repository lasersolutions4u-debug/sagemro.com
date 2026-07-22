# SAGEMRO Service OS 可执行方案

日期：2026-06-07

## 1. 战略定位

SAGEMRO Service OS 是 SAGEMRO 从“工程师撮合平台”升级为“AI 驱动的自营设备售后服务系统”的整体产品方案。

目标定位：

> SAGEMRO = AI 诊断获客入口 + 自营工程师服务体系 + 设备档案/工单系统 + 备件/维保复购 + Euchio 新机转化。

对外表达：

- 中国版：SAGEMRO 官方激光和成型设备售后服务。
- 国际版：AI-powered service, spare parts, and remote support for laser and metal forming equipment.

核心原则：

- 不做泛 MRO 商城，先聚焦激光和成型设备后服务。
- 不做松散撮合平台，改为 SAGEMRO 自营服务品牌。
- 不公开招商工程师接单，工程师改为内部工程师或认证服务代表。
- AI 不做噱头聊天，必须转化为线索、工单、设备档案和销售机会。
- Euchio 负责新机项目，SAGEMRO 负责售后、备件、维保和新机线索转化。

## 2. 目标业务闭环

### 2.1 中国版闭环

```text
用户搜索设备故障
-> 进入 SAGEMRO.cn
-> 使用 AI 诊断工具
-> 提交服务申请
-> 后台生成线索和 AI 摘要
-> SAGEMRO 客服确认
-> 自有工程师派工
-> 现场维修/保养/调试
-> 生成服务报告和设备档案
-> 推荐备件、维保合同或新机升级
-> 老旧设备线索转给 Euchio
```

### 2.2 国际版闭环

```text
用户通过 Google / AI Search 搜索故障或选型问题
-> 进入 SAGEMRO.com 英文工具页
-> 使用 AI Troubleshooting / Machine Selection
-> 留邮箱、WhatsApp 或公司信息
-> SAGEMRO 远程诊断
-> 推荐备件包、远程支持、服务协调或新机项目
-> 新机/升级项目转给 Euchio
```

## 3. 网站结构调整

### 3.1 中国版 `sagemro.cn`

| 页面 | 路径 | 目的 |
| --- | --- | --- |
| 首页 | `/` | 建立 SAGEMRO 官方自营售后服务心智 |
| AI 诊断中心 | `/ai` | 6 个 AI 工具统一入口 |
| 故障诊断 AI | `/ai/diagnosis` | 维修服务线索 |
| 切割参数 AI | `/ai/cutting-parameters` | SEO 流量和高频使用 |
| 备件识别 AI | `/ai/parts-identification` | 备件销售线索 |
| 维修成本预估 AI | `/ai/repair-estimate` | 服务报价前置沟通 |
| 新机选型 AI | `/ai/machine-selection` | Euchio 新机线索 |
| 设备健康报告 AI | `/ai/health-report` | 维保和换机线索 |
| 服务项目 | `/services` | 展示 SAGEMRO 官方服务能力 |
| 激光切割机维修 | `/services/laser-cutting-repair` | 高转化 SEO 服务页 |
| 安装调试 | `/services/installation` | 新机安装、搬迁调试 |
| 年度维保 | `/maintenance-plan` | B2B 长期合同 |
| 备件耗材 | `/spare-parts` | 高频耗材和配件复购入口 |
| 知识库 | `/knowledge` | 故障词、参数词、维护词 SEO |
| 服务申请 | `/service-request` | 替代“发布工单” |
| 我的设备 | `/my-devices` | 客户设备档案 |
| 我的服务 | `/my-services` | 工单、报价、服务报告、评价 |
| 关于我们 | `/about` | 自营团队、服务标准、资质展示 |
| 合规页面 | `/legal/*` | 协议、隐私政策、AI 说明、许可证展示 |

### 3.2 国际版 `sagemro.com`

| 页面 | 路径 | 目的 |
| --- | --- | --- |
| Home | `/` | 建立全球设备后服务和远程支持定位 |
| AI Center | `/ai` | 英文 AI 工具统一入口 |
| AI Troubleshooting | `/ai/troubleshooting` | 设备故障英文搜索流量 |
| Cutting Parameters | `/ai/cutting-parameters` | 切割参数流量和留资 |
| Parts Identification | `/ai/parts-identification` | 配件识别和备件销售 |
| Repair Estimate | `/ai/repair-estimate` | 维修成本预估和远程诊断线索 |
| Machine Selection | `/ai/machine-selection` | Euchio 新机项目线索 |
| Equipment Health Report | `/ai/health-report` | 维保、升级和换机机会 |
| Remote Support | `/remote-support` | 远程诊断服务 |
| Spare Parts | `/spare-parts` | 备件包和耗材包 |
| Service Network（规划） | `/service-partners` | 展示由 SAGEMRO 审核和协调的海外服务覆盖，不提供公开入驻或自由竞价 |
| Knowledge Base | `/knowledge` | Google SEO 内容矩阵 |
| Request Support | `/request-support` | 英文留资入口 |
| About | `/about` | 信任建设 |

## 4. 删除项和保留项

### 4.1 删除项

以下功能或表达不再符合 SAGEMRO Service OS 的定位，应删除：

- 公开工程师注册入口。
- 工程师自由接单/抢单的用户心智。
- 平台撮合、平台抽佣、服务商入驻等表达。
- 客户侧“选择工程师”的主流程。
- 面向自由职业工程师的钱包提现作为核心功能展示。
- 暗示平台仅提供信息撮合、不负责服务结果的文案。

如未来确实需要外部合作方，应统一包装为“SAGEMRO 认证服务代表/认证服务伙伴”，客户侧仍由 SAGEMRO 统一承诺、统一报价、统一验收。

### 4.2 保留并改造项

- 注册/登录：保留，身份改为客户、内部工程师、管理员。
- AI 聊天：保留，升级为 AI 诊断与转化系统。
- 设备档案：保留并强化。
- 工单系统：保留，前端文案改为“服务申请/我的服务”。
- 报价确认：保留，改为 SAGEMRO 官方报价确认。
- 附件上传：保留，用于故障照片、报警截图、维修记录。
- 评价系统：保留，用于评价 SAGEMRO 服务体验。
- 后台管理：保留并升级为运营中枢。

## 5. 6 个 AI 业务工具模块

6 个 AI 模块全部纳入第一版建设范围。它们不是 6 个简单提示词，也不是孤立页面，而是 6 个完整的业务工具模块。

统一结构：

```text
入口页面/组件
-> 结构化输入表单
-> 领域知识库检索
-> 专用 Prompt / Agent Workflow
-> 风险控制规则
-> 结果展示模板
-> 留资或服务申请 CTA
-> 后台 CRM / 工单 / 设备档案字段映射
```

### 5.1 故障诊断 AI

目标：

- 将设备故障搜索用户转化为维修服务线索。
- 将模糊描述转为结构化服务申请。
- 帮助客服和工程师快速判断优先级。

输入字段：

- 设备类型
- 品牌
- 型号
- 激光器品牌/功率
- 切割头/控制系统
- 报警代码
- 故障现象
- 材料、厚度、气体
- 照片/视频/报警截图
- 所在地区
- 紧急程度
- 联系方式

输出内容：

- 可能原因
- 风险等级
- 是否建议停机
- 建议补充的信息
- 初步检查项
- 可能需要的服务类型
- 可能相关备件
- 服务申请 CTA

后台沉淀：

- 线索类型：维修
- AI 摘要
- 风险等级
- 推荐工程师技能标签
- 设备档案草稿
- 服务申请草稿

### 5.2 切割参数 AI

目标：

- 获取高频 SEO 流量。
- 增强专业信任。
- 为后续维修、培训、选型转化铺垫。

输入字段：

- 材料类型
- 厚度
- 激光功率
- 气体类型
- 喷嘴规格
- 切割头类型
- 期望速度/质量
- 当前问题：毛刺、切不透、挂渣、烧边等

输出内容：

- 推荐参数区间
- 焦点建议
- 气压建议
- 速度建议
- 可能问题原因
- 调参注意事项
- 是否建议申请工艺调试服务

后台沉淀：

- 线索类型：工艺调试/培训
- 设备和材料标签
- 用户关注材料
- 潜在服务机会

### 5.3 备件识别 AI

目标：

- 将配件照片、型号不清、兼容问题转化为备件销售线索。
- 降低客户找错件、买错件的概率。

输入字段：

- 配件照片
- 配件上的编码/铭牌
- 所属设备品牌和型号
- 切割头/激光器/系统信息
- 使用问题
- 采购数量
- 收货国家/地区

输出内容：

- 配件类别判断
- 可能型号
- 需要人工确认的信息
- 适配风险提示
- 推荐联系 SAGEMRO 确认
- 备件咨询 CTA

后台沉淀：

- 线索类型：备件
- 可能 SKU
- 适配设备
- 采购意向数量
- 是否需要人工核型

### 5.4 维修成本预估 AI

目标：

- 提前筛选高意向客户。
- 降低客户对维修价格的不确定感。
- 为客服报价沟通提供参考。

输入字段：

- 故障类型
- 设备型号
- 使用年限
- 是否停机
- 是否有历史维修
- 是否需要上门
- 地区
- 照片/视频

输出内容：

- 成本等级：低/中/高
- 常见影响因素
- 是否需要上门确认
- 可能涉及配件
- 不给绝对报价，只给预估区间和风险提示
- 申请正式报价 CTA

后台沉淀：

- 线索类型：维修报价
- 预算敏感度
- 成交可能性
- 需要备件标签

### 5.5 新机选型 AI

目标：

- 将高客单设备采购需求转给 Euchio。
- 为客户提供初步配置建议，提高销售沟通效率。

输入字段：

- 加工材料
- 厚度范围
- 板材尺寸
- 日/月产能
- 预算范围
- 厂房条件
- 是否需要自动上下料
- 是否已有设备
- 目标国家/地区
- 联系方式

输出内容：

- 推荐功率区间
- 推荐幅面
- 自动化建议
- 气体和辅助设备建议
- 适合新购、升级或维修改造的判断
- Euchio 项目咨询 CTA

后台沉淀：

- 线索类型：新机
- 预算
- 成交紧急度
- 推荐配置
- 转交 Euchio 状态

### 5.6 设备健康报告 AI

目标：

- 将一次咨询变成长期客户档案。
- 推动维保合同、备件包和换机机会。

输入字段：

- 设备品牌/型号/年限
- 激光器功率
- 每日开机时间
- 最近故障次数
- 维修历史
- 切割质量问题
- 保养频率
- 关键部件更换记录

输出内容：

- 健康评分
- 风险部件
- 建议保养项目
- 推荐备件包
- 是否建议升级或换机
- 年度维保 CTA

后台沉淀：

- 设备健康等级
- 维保线索
- 备件推荐
- 新机升级机会
- 下次跟进时间

## 6. Prompt 与 Agent 设计

Prompt 不应写成单一大文本，应拆成 5 层：

```text
Base Prompt：SAGEMRO 身份、安全边界、服务责任边界
Domain Prompt：激光和成型设备、备件、工艺知识
Tool Prompt：当前 AI 工具的具体任务
Locale Prompt：中国版/国际版语言和合规口径
Conversion Prompt：如何引导服务申请、备件咨询、新机询盘
```

AI 安全原则：

- 不给绝对诊断。
- 不承诺绝对报价。
- 不指导危险带电操作。
- 不让用户绕过专业工程师做高风险维修。
- 对可能存在安全风险的场景提示停机并联系专业人员。
- 结果必须引导上传更多资料或申请 SAGEMRO 官方服务。

AI 输出应遵循：

```text
1. 初步判断
2. 可能原因
3. 风险等级
4. 建议补充的信息
5. 下一步建议
6. SAGEMRO 服务 CTA
```

## 7. 客户侧功能改造

### 7.1 首页

首页目标从“介绍平台功能”改为“建立官方服务信任”。

核心模块：

- Hero：AI 诊断 + SAGEMRO 官方工程师服务。
- 主要 CTA：立即诊断 / 申请服务。
- 服务能力：维修、保养、安装、调试、备件、维保。
- AI 工具入口：6 个工具卡片。
- 服务流程：AI 预诊断 -> 客服确认 -> 工程师派工 -> 完工报告。
- 典型故障：报警、切不透、毛刺、保护镜烧坏、冷水机报警。
- 设备类型：激光切割机、折弯机、焊接机、自动化上下料。
- 信任模块：自营团队、标准流程、服务报告、合规说明。

### 7.2 服务申请

“发布工单”改为“申请 SAGEMRO 官方服务”。

流程：

```text
选择服务类型
-> 填写设备信息
-> 描述故障/需求
-> 上传附件
-> 填写地区和联系方式
-> AI 生成摘要
-> 提交服务申请
```

服务类型：

- 设备维修
- 安装调试
- 工艺调参
- 年度保养
- 搬迁调机
- 备件咨询
- 新机选型

### 7.3 我的服务

替代“我的工单”。

状态建议：

- 待确认
- 已受理
- 待报价
- 待派工
- 服务中
- 待验收
- 已完成
- 已取消

### 7.4 我的设备

设备档案字段：

- 设备名称
- 设备类型
- 品牌
- 型号
- 激光器品牌/功率
- 切割头
- 控制系统
- 购买年份
- 所在地区
- 设备照片
- 维修历史
- 保养记录
- 推荐备件
- 健康状态

## 8. 工程师端功能改造

工程师端定位：

> SAGEMRO 内部工程师工作台。

功能：

- 今日派工
- 待处理服务
- 工单详情
- 客户设备档案
- 到场检查表
- 故障确认
- 报价建议
- 维修过程记录
- 更换备件记录
- 照片/视频上传
- 完工验收
- 服务报告生成
- 下次保养建议
- 新机升级线索上报

工程师账号：

- 不开放公众注册。
- 由后台管理员创建。
- 绑定技能标签、服务区域、证书、排班状态。

## 9. 后台运营中枢

后台应升级为 SAGEMRO Service OS 的运营中枢。

模块：

| 模块 | 功能 |
| --- | --- |
| 数据概览 | 线索、服务申请、成交率、完工率、复购率 |
| 线索 CRM | 新机、维修、备件、维保、远程支持线索 |
| AI 会话 | AI 工具使用记录、摘要、转化状态 |
| 服务申请 | 客户提交的问题、附件、AI 诊断 |
| 派工调度 | 工程师日程、区域、技能、负载 |
| 工单管理 | 报价、状态、附件、验收、评价 |
| 设备档案 | 客户设备、故障史、保养史、健康状态 |
| 备件目录 | SKU、适配设备、库存、推荐场景 |
| 维保合同 | SLA、服务次数、合同周期、到期提醒 |
| 工程师管理 | 内部账号、技能、证书、区域、状态 |
| 知识库管理 | 故障库、参数库、SOP、AI 引用内容 |
| 新机项目 | Euchio 线索同步、跟进状态、预算 |
| 合规审计 | 协议版本、AI 免责声明、操作日志 |

## 10. 数据模型建议

需要新增或强化的数据实体：

```text
leads
service_requests
work_orders
devices
service_reports
engineers
engineer_schedules
parts
part_recommendations
maintenance_contracts
ai_sessions
ai_diagnoses
knowledge_articles
machine_selection_leads
```

关键字段建议：

### 10.1 `leads`

- id
- lead_no
- source
- locale
- type：repair / parts / maintenance / new_machine / remote_support
- status
- priority
- customer_name
- phone
- email
- whatsapp
- company
- country
- region
- summary
- ai_score
- assigned_to
- transferred_to_euchio
- created_at
- updated_at

### 10.2 `service_requests`

- id
- request_no
- customer_id
- lead_id
- device_id
- service_type
- urgency
- issue_description
- ai_summary
- ai_risk_level
- status
- preferred_time
- address
- attachments
- created_at

### 10.3 `ai_diagnoses`

- id
- session_id
- tool_type
- locale
- input_json
- output_json
- risk_level
- recommended_service
- recommended_parts
- lead_id
- service_request_id
- device_id
- created_at

### 10.4 `service_reports`

- id
- work_order_id
- engineer_id
- arrival_checklist
- fault_confirmed
- repair_actions
- parts_used
- photos
- customer_signature
- next_maintenance_suggestion
- machine_upgrade_opportunity
- created_at

## 11. 内容与 SEO 策略

### 11.1 中国版内容

优先内容主题：

- 激光切割机报警代码大全
- 激光切割机切不透是什么原因
- 激光切割机毛刺大怎么解决
- 保护镜频繁烧坏原因
- 冷水机报警怎么处理
- 激光器功率下降怎么办
- 切割头电容异常怎么办
- 柏楚系统常见故障
- 激光切割机年度保养清单
- 激光切割机维修多少钱

每篇内容都应嵌入相关 AI 工具 CTA：

```text
遇到类似问题？立即使用 SAGEMRO AI 诊断。
```

### 11.2 国际版内容

优先内容主题：

- fiber laser cutting troubleshooting
- laser cutter alarm code guide
- laser cutting burr causes
- protective lens keeps burning
- laser chiller alarm troubleshooting
- CypCut parameter guide
- fiber laser maintenance checklist
- Chinese fiber laser support overseas
- fiber laser spare parts guide
- how to choose a fiber laser cutting machine

## 12. 运营策略

### 12.1 国内运营

- 先选择 1-2 个设备密集区域深耕。
- 用高意图故障词做百度 SEO 和竞价。
- 用视频号/抖音展示工程师真实案例。
- 用企业微信承接客户。
- 建立标准服务价格区间。
- 建立服务 SOP 和服务报告。
- 推年度维保合同，提高复购和稳定收入。

### 12.2 国际运营

- 先主打远程诊断和备件包。
- 用英文知识库获取 Google/AI Search 流量。
- 用 WhatsApp、Email 承接线索。
- 不轻易承诺全球上门，先表达 service coordination。
- 新机选型线索转给 Euchio。
- 针对海外中国激光设备用户做内容和案例。

## 13. 合规与服务责任

中国版建议对外口径：

> SAGEMRO 是设备售后服务企业的网站和数字化服务系统。客户申请的是 SAGEMRO 官方服务，不是平台撮合第三方服务商。

注意事项：

- 如果线上直接交易、收款、撮合第三方服务商，平台属性和合规要求会上升。
- 自营服务、线下合同、公司统一开票，有利于弱化平台撮合属性。
- 工程师涉及电气、焊接、高处等作业时，应管理证书和安全培训。
- 需要准备服务协议、隐私政策、AI 免责声明、售后责任边界。
- ICP 经营许可证和增值电信业务口径最终应由代办或主管部门确认。

## 14. 开发执行清单

### 14.1 信息架构

- 新增 AI 中心。
- 新增 6 个 AI 工具页面。
- 新增服务项目页面。
- 新增年度维保页面。
- 新增备件耗材页面。
- 新增知识库结构。
- 将发布工单改为服务申请。
- 将我的工单改为我的服务。
- 删除公开工程师注册入口。
- 删除工程师自由接单心智。

### 14.2 前端

- 首页按官方服务品牌重构。
- 导航改为：AI 诊断、服务项目、备件耗材、维保、新机选型、知识库。
- 客户端服务申请表重构。
- AI 工具统一交互组件。
- AI 结果模板组件。
- 设备档案强化。
- 我的服务状态重构。
- 国际版英文页面内容适配。
- 国内版中文页面内容适配。

### 14.3 后台

- 线索 CRM 增强。
- AI 会话和 AI 诊断结果管理。
- 服务申请管理。
- 派工调度管理。
- 工程师内部账号管理。
- 设备档案管理。
- 服务报告管理。
- 备件目录管理。
- 维保合同管理。
- 新机线索转 Euchio 状态管理。

### 14.4 后端

- 新增 AI 工具接口。
- 新增结构化 AI 输出保存。
- 新增线索分级逻辑。
- 新增服务申请实体。
- 新增服务报告实体。
- 强化设备档案。
- 新增备件实体。
- 新增维保合同实体。
- 删除或关闭公开工程师注册相关 API。
- 将工程师创建改为后台管理员创建。

### 14.5 AI

- 建立 5 层 Prompt 结构。
- 建立 6 个工具专用 Prompt。
- 建立故障知识库。
- 建立切割参数知识库。
- 建立备件识别知识库。
- 建立选型规则库。
- 建立 AI 安全边界。
- 建立 AI 输出 JSON Schema。
- 建立 AI 结果转线索/工单/设备档案规则。

### 14.6 文案

- 全站删除撮合平台表达。
- 全站统一为 SAGEMRO 官方服务。
- 服务 CTA 统一为：申请官方服务、预约诊断、获取报价、咨询备件、获取选型建议。
- 工程师对外称为 SAGEMRO 工程师或认证服务代表。
- AI 对外称为 AI 设备诊断助手。

## 15. 验收标准

产品验收：

- 用户进入首页后能明确理解 SAGEMRO 是官方服务团队。
- 用户可以从 6 个 AI 工具中完成诊断或咨询。
- AI 结果能生成结构化线索。
- 客户可以提交服务申请。
- 管理员可以查看线索、AI 摘要、服务申请。
- 工程师账号不再面向公众开放注册。
- 客户侧不再出现自由撮合和抢单心智。

商业验收：

- 每个 AI 工具都有明确 CTA。
- 每个 CTA 都能沉淀联系方式或服务申请。
- 新机选型线索能标记并转交 Euchio。
- 维修客户能沉淀设备档案。
- 服务完成后能生成维修记录和后续维保/备件机会。

合规验收：

- 国内版不表达平台抽佣。
- 国内版不表达第三方自由入驻接单。
- 用户协议、隐私政策、AI 说明与自营服务口径一致。
- 工程师现场服务责任边界和安全提示清晰。
