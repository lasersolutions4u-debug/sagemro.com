import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { isCnLocale } from '../../utils/locale';

const USER_AGREEMENT = `
## 1. Service Scope

1.1 SAGEMRO Service OS provides AI-assisted equipment consultation, service request preparation, independent service coordination, equipment records, spare parts and consumables consultation, maintenance follow-up, retrofit review, laser peripheral equipment support, automation accessory support, and press brake tooling support for laser cutting and sheet metal equipment.

1.2 SAGEMRO is an independent third-party equipment service workflow, not a public technician marketplace. Customers submit service needs to SAGEMRO, and SAGEMRO reviews the request and arranges internal engineers or qualified engineers reviewed by SAGEMRO when applicable.

1.3 SAGEMRO provides information services and service coordination, including demand intake, technical consultation support, service request organization, resource coordination, and digital service records. SAGEMRO does not operate as an open bidding platform, commission-splitting marketplace, or escrow settlement system.

## 2. Account Registration

2.1 Customers provide a valid phone number, name, company name, and login password to register.

2.2 Engineer accounts are internal operational accounts created or approved by SAGEMRO. Public engineer self-registration is not open.

2.3 Users should keep their account and password secure. Accounts may not be lent or transferred to third parties.

## 3. Service Request Process

3.1 Customers can start with the SAGEMRO AI chat or submit a SAGEMRO service request through available service entries.

3.2 A service request may include equipment type, brand/model, alarm code, fault description, urgency, photos/videos, region, and contact information.

3.3 SAGEMRO may use AI to create a preliminary summary, risk reminder, and service-ready information. Final diagnosis, quotation, schedule, and safety requirements are subject to SAGEMRO confirmation.

3.4 Service statuses may include pending confirmation, assigned, awaiting quote, dispatching, in service, awaiting customer confirmation, completed, or cancelled.

## 4. Quotation and Fees

4.1 AI-generated estimates are non-binding references only.

4.2 Formal service scope, fees, spare parts, travel costs, and payment methods are confirmed separately by SAGEMRO and the customer.

4.3 When applicable, SAGEMRO may charge information service fees, service coordination fees, or technical consultation fees for demand intake, technical consultation support, service request organization, resource coordination, and service record management. These fees are not technician commission, revenue sharing, escrow settlement, or automatic payment splitting.

4.4 Current online payment screens, if shown, are sandbox or demonstration interfaces unless SAGEMRO clearly states otherwise in a formal quote or agreement.

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

const PRIVACY_POLICY = `
## 1. Information We Collect

**Information you provide voluntarily:**
- Registration information: phone number, real name, company name, password
- Service request information: equipment type, brand/model, fault description, region, urgency, contact details
- AI chat inputs: alarm codes, cutting parameters, spare parts descriptions, consumables needs, retrofit needs, peripheral equipment needs, maintenance history, and equipment health information
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
- Arranging SAGEMRO internal engineers or qualified engineers reviewed by SAGEMRO
- Recommending spare parts, consumables, maintenance plans, peripheral equipment, retrofit options, or tooling support
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
- Service request information may be shared with SAGEMRO internal engineers or qualified engineers reviewed by SAGEMRO only as needed for service delivery
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

const AI_DISCLAIMER = `
## 1. Nature of AI Services

1.1 SAGEMRO AI is an equipment consultation and intake assistant based on large language model technology.

1.2 AI outputs are preliminary service guidance only. They do not constitute final diagnosis, repair commitment, safety approval, binding quotation, or quality guarantee.

1.3 AI cannot replace on-site diagnosis, lockout/tagout procedures, electrical safety assessment, laser safety assessment, or qualified engineer judgment.

## 2. Usage Recommendations

- **Fault diagnosis:** AI can summarize symptoms and likely causes, but final diagnosis requires SAGEMRO confirmation.
- **Cutting parameters:** AI parameters are reference ranges and must be adjusted according to machine condition, material, gas, nozzle, and safety rules.
- **Spare parts:** AI identification is preliminary. Compatibility must be manually confirmed before purchase or replacement.
- **Service cost reference:** AI may provide cost level or influencing factors for planning. Formal pricing requires qualified confirmation.
- **Retrofit and peripheral equipment:** AI suggestions are preliminary. Formal retrofit, auxiliary equipment, automation accessory, or tooling projects are confirmed by qualified personnel reviewed by SAGEMRO.

## 3. Safety Restrictions

- Do not perform energized electrical repair based solely on AI output
- Do not open laser optical paths, high-pressure gas lines, hydraulic systems, or safety covers without qualified personnel
- Stop operation when there is smoke, fire risk, abnormal smell, exposed wiring, severe collision, or repeated high-risk alarms
- For uncertain high-risk conditions, request SAGEMRO service support

## 4. Data Usage

- AI conversations and tool inputs may be stored to provide continuous consultation and service follow-up
- Sensitive information may be desensitized
- Chat content is not shared with other ordinary users

## 5. Service Limitations

- AI may occasionally produce inaccurate or incomplete responses
- AI is intended for industrial equipment service, parts, consumables, maintenance, retrofit, peripheral equipment, and tooling scenarios
- AI should not be used as the sole basis for repair, purchasing, safety, or legal decisions

## 6. Limitation of Liability

To the extent permitted by applicable law, Jinan Euchio Machinery Co., Ltd. is not liable for equipment damage, personal injury, production loss, or other losses caused by relying solely on AI output. For professional service, submit a SAGEMRO service request.

## 7. Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const CN_USER_AGREEMENT = `
## 1. 服务范围

1.1 SAGEMRO 智能服务系统为激光切割与钣金加工设备提供 AI 辅助咨询、服务需求整理、第三方服务协调、设备档案、备件及易损件咨询、维护跟进、增购改造评估、激光周边设备、自动化配套和折弯模具支持。

1.2 SAGEMRO 是独立第三方设备服务流程入口，不是公开工程师竞价平台。客户向 SAGEMRO 提交服务需求后，由 SAGEMRO 审核并根据实际情况安排内部工程师、合格工程师或经 SAGEMRO 审核的服务人员跟进。

1.3 SAGEMRO 提供信息服务与服务协调，包括需求接收、技术咨询支持、工单整理、资源协调和数字化服务记录。SAGEMRO 不作为公开竞价平台、佣金抽成平台或资金托管结算平台运营。

## 2. 账号注册

2.1 客户注册时应提供有效手机号、姓名、公司名称和登录密码。

2.2 工程师账号属于内部运营账号，由 SAGEMRO 创建或审核后分配。平台暂不开放公开工程师自由注册。

2.3 用户应妥善保管账号和密码，不得将账号出借、转让给第三方使用。

## 3. 服务请求流程

3.1 客户可以通过 SAGEMRO AI 对话开始咨询，也可以通过可用入口提交正式服务请求。

3.2 服务请求可能包含设备类型、品牌型号、报警代码、故障描述、紧急程度、图片或视频、所在地区和联系方式等信息。

3.3 SAGEMRO 可使用 AI 生成初步摘要、风险提示和服务准备信息。最终诊断、报价、排期和现场安全要求以 SAGEMRO 人工确认为准。

3.4 服务状态可能包括待确认、已分配、待报价、派工中、服务中、待客户确认、已完成或已取消等。

## 4. 报价与费用

4.1 AI 生成的费用估算仅作为非约束性参考。

4.2 正式服务范围、费用、备件、差旅和付款方式由 SAGEMRO 与客户另行确认。

4.3 在适用情况下，SAGEMRO 可就需求接收、技术咨询支持、工单整理、资源协调和服务记录管理收取信息服务费、服务协调费或技术咨询服务费。该等费用不属于工程师佣金、收益分成、资金托管或自动分账。

4.4 当前如出现在线支付相关页面，除非 SAGEMRO 在正式报价或协议中明确说明，否则仅为沙盒或演示界面。

## 5. 服务记录

5.1 SAGEMRO 可为服务交付和售后跟进保存工单记录、消息、图片、维修动作、使用备件、服务报告和客户反馈。

5.2 设备档案有助于 SAGEMRO 提供更准确的诊断、维护提醒、备件建议和升级建议。

## 6. 用户责任

客户应提供准确设备信息，如实描述故障，遵守安全提示，并配合 SAGEMRO 完成诊断和服务跟进。

用户不得利用本系统从事违法活动、提交虚假信息、恶意测试、侵权行为或与工业设备服务无关的活动。

## 7. 安全边界

AI 建议不能替代合格人员的现场评估。涉及高风险电气、激光光路、液压、气动、燃气、吊装或动火作业时，客户应停止不安全操作并等待合格人员处理。

## 8. 个人信息保护

用户信息用于服务交付、账号安全、诊断、服务记录和后续跟进。SAGEMRO 不出售用户个人信息。

## 9. 协议更新

SAGEMRO 可根据业务发展或法律要求更新本协议。用户继续使用服务即视为接受更新后的条款。

## 联系方式

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.cn
`.trim();

const CN_PRIVACY_POLICY = `
## 1. 我们收集的信息

**你主动提供的信息：**
- 注册信息：手机号、真实姓名、公司名称、密码
- 服务请求信息：设备类型、品牌型号、故障描述、所在地区、紧急程度和联系方式
- AI 对话输入：报警代码、切割参数、备件描述、易损件需求、增购改造需求、激光周边设备需求、维护历史和设备健康信息
- 附件：用于诊断和服务记录的照片、截图、视频或文件
- 反馈：评分、评论、验收记录和后续跟进备注

**我们自动收集的信息：**
- 用于连续咨询和服务跟进的聊天记录与 AI 使用记录
- 用于安全、防滥用和故障排查的使用日志
- 用于登录状态和本地对话连续性的浏览器 localStorage 数据

**我们不会主动收集的信息：**身份证号码、银行卡信息、生物识别信息或设备远程控制数据，除非双方另有明确约定。

## 2. 信息使用目的

- 提供 AI 初步诊断和技术咨询
- 创建服务请求、设备档案和服务报告
- 安排 SAGEMRO 内部工程师、合格工程师或经 SAGEMRO 审核的服务人员
- 推荐备件、易损件、维护计划、激光周边设备、自动化改造或折弯模具支持
- 使用匿名化或脱敏数据改善 AI 回复质量
- 进行安全保护、防滥用和运营故障排查

## 3. 信息存储与安全

- 数据传输使用 HTTPS 加密
- 密码经过加盐哈希处理，不保存明文密码
- 敏感信息在进入 AI 处理或日志前可进行脱敏
- API 访问采用身份认证控制
- 服务数据仅授权用户和 SAGEMRO 运营人员可访问

## 4. 信息共享

- 我们不会出售你的个人信息
- 为完成服务交付，服务请求信息可能按需提供给 SAGEMRO 内部工程师、合格工程师或经 SAGEMRO 审核的服务人员
- AI 对话内容可能通过加密接口发送给 AI 服务提供方，但不包含账号密码
- 法律法规或主管部门要求时，信息可能依法披露

## 5. 你的权利

- 访问：查看账号、服务请求和设备档案
- 更正：在功能支持时更新个人信息和设备记录
- 删除：在法律允许范围内联系我们删除账号或相关数据
- 通知管理：在浏览器或应用内管理通知设置

## 6. Cookies 与本地存储

本平台使用浏览器 localStorage 保存登录状态和对话连续性。核心服务交付不依赖第三方跟踪 Cookie。

## 7. 联系我们

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.cn
`.trim();

const CN_AI_DISCLAIMER = `
## 1. AI 服务性质

1.1 SAGEMRO AI 是基于大语言模型技术的设备咨询与需求接收助手。

1.2 AI 输出仅为初步服务参考，不构成最终诊断、维修承诺、安全许可、约束性报价或质量保证。

1.3 AI 不能替代现场诊断、断电挂牌程序、电气安全评估、激光安全评估或合格工程师判断。

## 2. 使用建议

- **故障诊断：**AI 可以总结症状和可能原因，最终诊断需由 SAGEMRO 确认。
- **切割参数：**AI 参数为参考范围，应结合设备状态、材料、气体、喷嘴和安全规则调整。
- **备件识别：**AI 识别为初步判断，采购或更换前需人工确认兼容性。
- **服务费用参考：**AI 可提供费用级别或影响因素，便于前期规划。正式价格需经合格人员确认。
- **增购改造与周边设备：**AI 建议为初步参考，正式增购改造、激光周边设备、自动化配套或折弯模具项目由合格人员或经 SAGEMRO 审核的人员确认。

## 3. 安全限制

- 不要仅凭 AI 输出进行带电维修
- 未经合格人员确认，不要打开激光光路、高压气路、液压系统或安全防护罩
- 出现烟雾、火灾风险、异味、裸露线路、严重碰撞或反复高风险报警时，应停止运行
- 不确定的高风险情况，应提交 SAGEMRO 服务请求

## 4. 数据使用

- AI 对话和工具输入可能被保存，用于连续咨询和服务跟进
- 敏感信息可进行脱敏处理
- 聊天内容不会提供给其他普通用户

## 5. 服务限制

- AI 偶尔可能生成不准确或不完整的回复
- AI 主要用于工业设备服务、备件、易损件、维护、增购改造、激光周边设备和模具支持场景
- AI 不应作为维修、采购、安全或法律决策的唯一依据

## 6. 责任限制

在适用法律允许范围内，济南钰峭机械有限公司不对用户仅依赖 AI 输出造成的设备损坏、人身伤害、生产损失或其他损失承担责任。如需专业服务，请提交 SAGEMRO 服务请求。

## 7. 联系方式

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.cn
`.trim();

const LEGAL_COPY = {
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
    effective: 'Effective date: June 7, 2026. Platform operator: Jinan Euchio Machinery Co., Ltd.',
    content: {
      agreement: USER_AGREEMENT,
      privacy: PRIVACY_POLICY,
      ai: AI_DISCLAIMER,
    },
  },
  cn: {
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
    effective: '生效日期：2026年6月7日。平台运营方：济南钰峭机械有限公司。',
    content: {
      agreement: CN_USER_AGREEMENT,
      privacy: CN_PRIVACY_POLICY,
      ai: CN_AI_DISCLAIMER,
    },
  },
};

function SimpleMarkdown({ content }) {
  const lines = content.split('\n');
  const elements = [];
  let listItems = [];

  const renderInline = (text) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-[var(--color-text-primary)]">{part}</strong> : part
    );
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 text-[13px] text-[var(--color-text-secondary)]">
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-[var(--color-text-primary)] mt-5 mb-2">
          {line.replace('## ', '')}
        </h3>
      );
    } else if (line.startsWith('- ')) {
      listItems.push(line.replace('- ', ''));
    } else if (line.match(/^\d+\.\d+ /)) {
      flushList();
      elements.push(
        <p key={i} className="text-[13px] text-[var(--color-text-secondary)] mb-1.5 pl-2">
          {renderInline(line)}
        </p>
      );
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-[13px] text-[var(--color-text-secondary)] mb-1.5">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();

  return <div>{elements}</div>;
}

export function LegalModal({ isOpen, onClose, initialTab = 'agreement' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const copy = isCnLocale() ? LEGAL_COPY.cn : LEGAL_COPY.en;

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.titles[activeTab]} size="lg">
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-4 -mt-1 overflow-x-auto">
        {copy.tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:ring-offset-2 ${
              activeTab === tab.key
                ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
          {copy.effective}
        </p>
        <SimpleMarkdown content={copy.content[activeTab]} />
      </div>
    </Modal>
  );
}
