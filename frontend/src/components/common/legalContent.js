const USER_AGREEMENT_EN = `
## 1. Service Scope

1.1 SAGEMRO Service OS provides AI-assisted equipment consultation, service request preparation, official service coordination, equipment records, spare parts consultation, maintenance follow-up, and new-machine selection support for laser cutting and sheet metal equipment.

1.2 SAGEMRO is an official service workflow, not a public technician marketplace. Customers submit service needs to SAGEMRO, and SAGEMRO reviews the request and arranges internal engineers or SAGEMRO-designated service personnel when applicable.

## 2. Account Registration

2.1 Customers provide a valid phone number, name, company name, and login password to register.

2.2 Engineer accounts are internal operational accounts created or approved by SAGEMRO. Public engineer self-registration is not open.

2.3 Users should keep their account and password secure. Accounts may not be lent or transferred to third parties.

## 3. Service Request Process

3.1 Customers can start with the SAGEMRO AI chat or submit an official service request through available service entries.

3.2 A service request may include equipment type, brand/model, alarm code, fault description, urgency, photos/videos, region, and contact information.

3.3 SAGEMRO may use AI to create a preliminary summary, risk reminder, and service-ready information. Final diagnosis, quotation, schedule, and safety requirements are subject to SAGEMRO confirmation.

3.4 Service statuses may include pending confirmation, assigned, awaiting quote, dispatching, in service, awaiting customer confirmation, completed, or cancelled.

## 4. Quotation and Fees

4.1 AI-generated estimates are non-binding references only.

4.2 Formal service scope, fees, spare parts, travel costs, and payment methods are confirmed separately by SAGEMRO and the customer.

4.3 Current online payment screens, if shown, are sandbox or demonstration interfaces unless SAGEMRO clearly states otherwise in a formal quote or agreement.

## 5. Service Records

5.1 SAGEMRO may keep service request records, messages, photos, repair actions, parts used, service reports, and customer feedback for service delivery and after-sales follow-up.

5.2 Equipment records help SAGEMRO provide more accurate diagnostics, maintenance reminders, spare parts recommendations, and upgrade suggestions.

## 6. User Responsibilities

Customers should provide accurate equipment information, describe faults truthfully, follow safety reminders, and cooperate with SAGEMRO during diagnosis and service.

Users must not use the system for illegal activities, false information, malicious testing, infringement, or activities unrelated to industrial equipment services.

## 7. Safety Boundary

AI suggestions cannot replace qualified on-site assessment. For high-risk electrical, laser optical path, hydraulic, pneumatic, gas, lifting, or hot-work operations, customers should stop unsafe operation and wait for qualified personnel.

## 8. Personal Information Protection

User information is used for service delivery, account security, diagnostics, service records, and follow-up. SAGEMRO does not sell users' personal information.

## 9. Agreement Amendments

SAGEMRO may update this agreement based on business development or legal requirements. Continued use of the service constitutes acceptance of the updated terms.

## Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const PRIVACY_POLICY_EN = `
## 1. Information We Collect

**Information you provide voluntarily:**
- Registration information: phone number, real name, company name, password
- Service request information: equipment type, brand/model, fault description, region, urgency, contact details
- AI chat inputs: alarm codes, cutting parameters, spare parts descriptions, machine selection needs, maintenance history, and equipment health information
- Attachments: photos, screenshots, videos, or files uploaded for diagnosis and service records
- Feedback: ratings, comments, acceptance records, and follow-up notes

**Information we collect automatically:**
- Chat history and AI usage records for continuous consultation and service follow-up
- Usage logs for security, rate limiting, and troubleshooting
- Browser localStorage data for login state and local chat continuity

**Information we do not intentionally collect:** national ID numbers, bank card information, biometric information, or remote-control data from your equipment unless separately agreed.

## 2. Purposes of Information Use

- Providing AI preliminary diagnostics and technical consultation
- Creating service requests, equipment records, and service reports
- Arranging SAGEMRO internal engineers or SAGEMRO-designated service personnel
- Recommending spare parts, maintenance plans, or new-machine selection support
- Improving AI response quality with anonymized or desensitized data
- Security protection, abuse prevention, and operational troubleshooting

## 3. Information Storage and Security

- Data transmission uses HTTPS encryption
- Passwords are salted and hashed; plaintext passwords are not stored
- Sensitive information may be desensitized before AI processing or logs
- API access uses authentication controls
- Service data is accessible only to authorized users and SAGEMRO operational staff

## 4. Information Sharing

- We do not sell your personal information
- Service request information may be shared with SAGEMRO internal engineers or SAGEMRO-designated service personnel only as needed for service delivery
- AI conversation content may be sent through encrypted interfaces to AI service providers without account passwords
- Information may be disclosed when required by law, regulation, or competent authorities

## 5. Your Rights

- Access: view your account, service requests, and equipment records
- Correction: update personal information and equipment records when available
- Deletion: contact us to delete your account or relevant data where legally permitted
- Notification management: manage browser or in-app notifications where supported

## 6. Cookies and Local Storage

This platform uses browser localStorage for login state and chat continuity. We do not rely on third-party tracking cookies for core service delivery.

## 7. Contact Us

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const AI_DISCLAIMER_EN = `
## 1. Nature of AI Services

1.1 SAGEMRO AI is an equipment consultation and intake assistant based on large language model technology.

1.2 AI outputs are preliminary service guidance only. They do not constitute final diagnosis, repair commitment, safety approval, binding quotation, or quality guarantee.

1.3 AI cannot replace on-site diagnosis, lockout/tagout procedures, electrical safety assessment, laser safety assessment, or qualified engineer judgment.

## 2. Usage Recommendations

- **Fault diagnosis:** AI can summarize symptoms and likely causes, but final diagnosis requires SAGEMRO confirmation.
- **Cutting parameters:** AI parameters are reference ranges and must be adjusted according to machine condition, material, gas, nozzle, and safety rules.
- **Spare parts:** AI identification is preliminary. Compatibility must be manually confirmed before purchase or replacement.
- **Repair estimate:** AI may provide cost level or influencing factors, not a binding price.
- **Machine selection:** AI selection is preliminary. Formal new-machine projects are confirmed by Euchio or SAGEMRO-designated sales personnel.

## 3. Safety Restrictions

- Do not perform energized electrical repair based solely on AI output
- Do not open laser optical paths, high-pressure gas lines, hydraulic systems, or safety covers without qualified personnel
- Stop operation when there is smoke, fire risk, abnormal smell, exposed wiring, severe collision, or repeated high-risk alarms
- For uncertain high-risk conditions, request SAGEMRO official service

## 4. Data Usage

- AI conversations and tool inputs may be stored to provide continuous consultation and service follow-up
- Sensitive information may be desensitized
- Chat content is not shared with other ordinary users

## 5. Service Limitations

- AI may occasionally produce inaccurate or incomplete responses
- AI is intended for industrial equipment service, parts, maintenance, and machine selection scenarios
- AI should not be used as the sole basis for repair, purchasing, safety, or legal decisions

## 6. Limitation of Liability

To the extent permitted by applicable law, Jinan Euchio Machinery Co., Ltd. is not liable for equipment damage, personal injury, production loss, or other losses caused by relying solely on AI output. For professional service, submit a SAGEMRO official service request.

## 7. Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const USER_AGREEMENT_CN = `
## 1. 服务范围

1.1 SAGEMRO Service OS 面向激光切割机及钣金加工设备，提供 AI 辅助咨询、服务需求整理、官方服务协调、设备档案、备件咨询、保养跟进和新机选型支持。

1.2 SAGEMRO 是官方服务流程入口，不是公开工程师接单平台。客户提交服务需求后，由 SAGEMRO 审核并在适用情况下安排内部工程师或 SAGEMRO 指定服务人员跟进。

## 2. 账号注册

2.1 客户注册时需提供有效手机号、姓名、公司名称和登录密码。

2.2 工程师账号属于内部运营账号，由 SAGEMRO 创建或审核开通，不开放工程师自行公开注册。

2.3 用户应妥善保管账号和密码，不得出借、转让或允许第三方冒用账号。

## 3. 服务申请流程

3.1 客户可以从 SAGEMRO AI 对话开始，也可以通过可用入口提交官方服务申请。

3.2 服务申请可能包含设备类型、品牌型号、报警代码、故障描述、紧急程度、图片或视频、地区和联系方式等信息。

3.3 SAGEMRO 可使用 AI 生成初步摘要、风险提醒和服务准备信息。最终诊断、报价、排期和现场安全要求，以 SAGEMRO 官方确认为准。

3.4 服务状态可能包括待确认、已分配、待报价、派工中、服务中、待客户确认、已完成或已取消。

## 4. 报价与费用

4.1 AI 生成的估算仅供参考，不构成正式报价或付款承诺。

4.2 正式服务范围、费用、备件、差旅及支付方式，由 SAGEMRO 与客户另行确认。

4.3 当前页面如出现在线支付、价格或演示信息，除非 SAGEMRO 在正式报价或协议中明确说明，否则仅作为测试或展示使用。

## 5. 服务记录

5.1 SAGEMRO 可保存服务申请、消息、图片、维修动作、备件使用、服务报告和客户反馈，用于服务交付和售后跟进。

5.2 设备档案用于帮助 SAGEMRO 提供更准确的诊断、保养提醒、备件建议和设备升级建议。

## 6. 用户责任

客户应提供真实、准确的设备信息和故障描述，遵守安全提醒，并配合 SAGEMRO 完成诊断和服务确认。

用户不得利用本系统从事违法违规、虚假信息、恶意测试、侵权或与工业设备服务无关的活动。

## 7. 安全边界

AI 建议不能替代合格人员的现场判断。涉及电气、激光光路、液压、气动、气体、吊装或动火等高风险作业时，客户应停止不安全操作并等待合格人员处理。

## 8. 个人信息保护

用户信息用于服务交付、账号安全、诊断、服务记录和后续跟进。我们不会出售用户个人信息。

## 9. 协议更新

SAGEMRO 可根据业务发展或法律法规要求更新本协议。用户继续使用服务，视为接受更新后的条款。

## 联系方式

济南欧驰机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const PRIVACY_POLICY_CN = `
## 1. 我们收集的信息

**你主动提供的信息：**
- 注册信息：手机号、真实姓名、公司名称、密码
- 服务申请信息：设备类型、品牌型号、故障描述、地区、紧急程度、联系方式
- AI 对话输入：报警代码、切割参数、备件描述、新机选型需求、保养历史和设备健康信息
- 附件：用于诊断和服务记录的照片、截图、视频或文件
- 反馈信息：评分、评价、验收记录和后续跟进备注

**我们自动收集的信息：**
- 用于连续咨询和服务跟进的对话历史与 AI 使用记录
- 用于安全、限流和排障的使用日志
- 用于登录状态和本地对话连续性的浏览器 localStorage 数据

**我们不会主动收集的信息：**身份证号、银行卡信息、生物识别信息，或未经另行约定的设备远程控制数据。

## 2. 信息使用目的

- 提供 AI 初步诊断和技术咨询
- 创建服务申请、设备档案和服务报告
- 安排 SAGEMRO 内部工程师或 SAGEMRO 指定服务人员
- 推荐备件、保养计划或新机选型支持
- 使用匿名化或脱敏数据改善 AI 回复质量
- 进行安全防护、滥用防范和运营排障

## 3. 信息存储与安全

- 数据传输使用 HTTPS 加密
- 密码采用加盐哈希存储，不保存明文密码
- 敏感信息在进入 AI 处理或日志前可进行脱敏
- API 访问采用身份认证控制
- 服务数据仅授权用户及 SAGEMRO 运营人员可访问

## 4. 信息共享

- 我们不会出售你的个人信息
- 为完成服务交付，服务申请信息可能按必要范围提供给 SAGEMRO 内部工程师或 SAGEMRO 指定服务人员
- AI 对话内容可能通过加密接口发送给 AI 服务提供方，但不包含账号密码
- 根据法律法规或主管部门要求，相关信息可能依法披露

## 5. 你的权利

- 查询：查看你的账号、服务申请和设备档案
- 更正：在可用功能范围内更新个人信息和设备记录
- 删除：在法律允许范围内，联系我们删除账号或相关数据
- 通知管理：在浏览器或站内功能中管理通知订阅

## 6. Cookie 与本地存储

本平台使用浏览器 localStorage 保存登录状态和对话连续性。核心服务交付不依赖第三方跟踪 Cookie。

## 7. 联系我们

济南欧驰机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const AI_DISCLAIMER_CN = `
## 1. AI 服务性质

1.1 SAGEMRO AI 是基于大语言模型技术的设备咨询和服务接待助手。

1.2 AI 输出仅为前期服务指引，不构成最终诊断、维修承诺、安全许可、正式报价或质量保证。

1.3 AI 不能替代现场诊断、断电挂牌、电气安全评估、激光安全评估或合格工程师判断。

## 2. 使用建议

- **故障诊断：**AI 可整理症状和可能原因，最终诊断需由 SAGEMRO 确认。
- **切割参数：**AI 参数为参考范围，应结合设备状态、材料、气体、喷嘴和安全规范调整。
- **备件识别：**AI 识别属于初步判断，购买或更换前需人工确认兼容性。
- **维修预估：**AI 可说明费用等级或影响因素，不构成正式价格。
- **新机选型：**AI 选型属于前期建议，正式新机项目由 Euchio 或 SAGEMRO 指定销售人员确认。

## 3. 安全限制

- 不得仅凭 AI 输出进行带电维修
- 未经合格人员处理，不得打开激光光路、高压气路、液压系统或安全防护罩
- 出现烟雾、火险、异味、裸露线路、严重碰撞或反复高风险报警时，应立即停机
- 对高风险情况不确定时，应提交 SAGEMRO 官方服务申请

## 4. 数据使用

- AI 对话和工具输入可能被保存，用于连续咨询和服务跟进
- 敏感信息可进行脱敏处理
- 对话内容不会分享给其他普通用户

## 5. 服务限制

- AI 可能偶尔产生不准确或不完整的回复
- AI 主要用于工业设备服务、备件、保养和新机选型场景
- AI 不应作为维修、采购、安全或法律决策的唯一依据

## 6. 责任限制

在适用法律允许范围内，因仅依赖 AI 输出造成的设备损坏、人身伤害、生产损失或其他损失，济南欧驰机械有限公司不承担相应责任。需要专业服务时，请提交 SAGEMRO 官方服务申请。

## 7. 联系方式

济南欧驰机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const legalContent = {
  en: {
    tabs: [
      { key: 'agreement', label: 'Terms of Service' },
      { key: 'privacy', label: 'Privacy Policy' },
      { key: 'ai', label: 'AI Service Notice' },
    ],
    titles: {
      agreement: 'SAGEMRO Terms of Service',
      privacy: 'SAGEMRO Privacy Policy',
      ai: 'SAGEMRO AI Service Notice',
    },
    meta: 'Effective date: June 7, 2026. Platform operator: Jinan Euchio Machinery Co., Ltd.',
    content: {
      agreement: USER_AGREEMENT_EN,
      privacy: PRIVACY_POLICY_EN,
      ai: AI_DISCLAIMER_EN,
    },
  },
  'zh-CN': {
    tabs: [
      { key: 'agreement', label: '服务条款' },
      { key: 'privacy', label: '隐私政策' },
      { key: 'ai', label: 'AI 服务说明' },
    ],
    titles: {
      agreement: 'SAGEMRO 服务条款',
      privacy: 'SAGEMRO 隐私政策',
      ai: 'SAGEMRO AI 服务说明',
    },
    meta: '生效日期：2026 年 6 月 7 日。平台运营方：济南欧驰机械有限公司。',
    content: {
      agreement: USER_AGREEMENT_CN,
      privacy: PRIVACY_POLICY_CN,
      ai: AI_DISCLAIMER_CN,
    },
  },
};

export function getLegalContent(locale = 'en') {
  return legalContent[locale] || legalContent.en;
}
