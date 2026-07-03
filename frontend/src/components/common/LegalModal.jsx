import { useEffect, useState } from 'react';
import { Modal } from './Modal';

const ZH_USER_AGREEMENT = `
## 1. 服务范围

1.1 SAGEMRO 智能服务系统面向激光切割机与钣金加工设备，提供 AI 辅助咨询、服务申请整理、服务协调、设备档案、备件咨询、维保跟进和新机选型支持。

1.2 SAGEMRO 是第三方设备服务流程，不是设备厂商官方售后，也不是公开技师撮合平台。客户向 SAGEMRO 提交服务需求后，由 SAGEMRO 审核并在适用情况下安排内部工程师或 SAGEMRO 指定服务人员。

## 2. 账号注册

2.1 客户注册时需要提供有效手机号、姓名、公司名称和登录密码。

2.2 工程师账号属于内部运营账号，由 SAGEMRO 创建或审核通过后分配，不开放工程师公开自助注册。

2.3 用户应妥善保管账号和密码，不得转借或转让给第三方使用。

## 3. 服务申请流程

3.1 客户可通过 SAGEMRO AI 对话开始咨询，也可通过可用入口提交 SAGEMRO 服务申请。

3.2 服务申请可能包括设备类型、品牌型号、报警代码、故障描述、紧急程度、图片或视频、所在地区和联系方式。

3.3 SAGEMRO 可使用 AI 生成初步摘要、风险提醒和便于服务跟进的信息。最终诊断、报价、排期和现场安全要求以 SAGEMRO 确认为准。

## 4. 报价与费用

4.1 AI 生成的费用判断仅供参考，不构成正式报价。

4.2 正式服务范围、费用、备件、差旅和付款方式由 SAGEMRO 与客户另行确认。

## 5. 服务记录

5.1 为完成服务交付和售后跟进，SAGEMRO 可能保存服务申请、消息、图片、维修动作、备件使用、服务报告和客户评价。

5.2 设备档案有助于 SAGEMRO 提供更准确的诊断、维保提醒、备件建议和升级建议。

## 6. 安全边界

AI 建议不能替代合格人员的现场判断。涉及电气、激光光路、液压、气路、吊装、动火等高风险操作时，应停止不安全操作并等待具备资质的人员处理。

## 7. 联系方式

济南钰峭机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const ZH_PRIVACY_POLICY = `
## 1. 我们收集的信息

**你主动提供的信息：**
- 注册信息：手机号、真实姓名、公司名称、密码
- 服务申请信息：设备类型、品牌型号、故障描述、地区、紧急程度和联系方式
- AI 对话输入：报警代码、切割参数、备件描述、选型需求、维保历史和设备健康信息
- 附件：用于诊断和服务记录的照片、截图、视频或文件
- 评价反馈：评分、评论、验收记录和后续跟进备注

**系统自动产生的信息：**
- 为连续咨询和服务跟进保存的对话记录与 AI 使用记录
- 用于安全、限流和故障排查的使用日志
- 用于登录状态和本地对话连续性的浏览器 localStorage 数据

## 2. 信息使用目的

- 提供 AI 初步诊断和技术咨询
- 创建服务申请、设备档案和服务报告
- 安排 SAGEMRO 内部工程师或 SAGEMRO 指定服务人员
- 推荐备件、维保计划或新机选型支持
- 在匿名化或脱敏后改进 AI 回复质量
- 保障账号安全、防止滥用并排查运营问题

## 3. 信息存储与安全

- 数据传输使用 HTTPS 加密
- 密码经过加盐哈希处理，不保存明文密码
- 敏感信息在进入 AI 处理或日志前可能进行脱敏
- 服务数据仅授权用户和 SAGEMRO 运营人员可访问

## 4. 信息共享

我们不出售你的个人信息。为完成服务交付，服务申请信息可能在必要范围内提供给 SAGEMRO 内部工程师或 SAGEMRO 指定服务人员。依法依规需要披露时，我们将按法律法规和主管部门要求处理。

## 5. 联系我们

济南钰峭机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const ZH_AI_DISCLAIMER = `
## 1. AI 服务性质

1.1 SAGEMRO AI 是基于大语言模型技术的设备咨询和服务接待助手。

1.2 AI 输出仅为初步服务建议，不构成最终诊断、维修承诺、安全许可、正式报价或质量保证。

1.3 AI 不能替代现场诊断、停机挂牌、用电安全评估、激光安全评估或合格工程师判断。

## 2. 使用建议

- **故障诊断：** AI 可以整理症状和可能原因，最终诊断仍需 SAGEMRO 确认。
- **切割参数：** AI 参数为参考范围，应结合设备状态、材料、气体、喷嘴和安全规范调整。
- **备件识别：** AI 识别属于初步判断，采购或更换前必须人工确认兼容性。
- **维修预估：** AI 可说明费用等级和影响因素，不构成正式价格。
- **新机选型：** AI 选型为初步建议，正式新机项目由 Euchio 或 SAGEMRO 指定销售人员确认。

## 3. 安全限制

- 不要仅凭 AI 输出进行带电维修
- 未经合格人员确认，不要打开激光光路、高压气路、液压系统或安全防护罩
- 出现烟雾、火灾风险、异常气味、裸露线路、严重碰撞或重复高风险报警时，应停止运行
- 对不确定的高风险情况，请提交 SAGEMRO 服务申请或等待具备资质的人员处理

## 4. 服务限制

AI 可能出现不准确或不完整回复。AI 适用于工业设备服务、备件、维保和选型场景，不应作为维修、采购、安全或法律决策的唯一依据。

## 5. 联系方式

济南钰峭机械有限公司 | Email: support@sagemro.com | https://sagemro.cn
`.trim();

const USER_AGREEMENT = `
## 1. Service Scope

1.1 SAGEMRO Service OS provides AI-assisted equipment consultation, service request preparation, service coordination, equipment records, spare parts consultation, maintenance follow-up, and new-machine selection support for laser cutting and sheet metal equipment.

1.2 SAGEMRO is an independent third-party equipment service workflow, not a machine manufacturer after-sales desk or a public technician marketplace. Customers submit service needs to SAGEMRO, and SAGEMRO reviews the request and arranges internal engineers or SAGEMRO-designated service personnel when applicable.

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

const PRIVACY_POLICY = `
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

const AI_DISCLAIMER = `
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
- For uncertain high-risk conditions, submit a SAGEMRO service request or wait for qualified personnel

## 4. Data Usage

- AI conversations and tool inputs may be stored to provide continuous consultation and service follow-up
- Sensitive information may be desensitized
- Chat content is not shared with other ordinary users

## 5. Service Limitations

- AI may occasionally produce inaccurate or incomplete responses
- AI is intended for industrial equipment service, parts, maintenance, and machine selection scenarios
- AI should not be used as the sole basis for repair, purchasing, safety, or legal decisions

## 6. Limitation of Liability

To the extent permitted by applicable law, Jinan Euchio Machinery Co., Ltd. is not liable for equipment damage, personal injury, production loss, or other losses caused by relying solely on AI output. For professional support, submit a SAGEMRO service request.

## 7. Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

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
  const isCn = typeof window !== 'undefined' && window.location.hostname.endsWith('.cn');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const tabs = isCn
    ? [
        { key: 'agreement', label: '用户协议' },
        { key: 'privacy', label: '隐私政策' },
        { key: 'ai', label: 'AI 服务说明' },
      ]
    : [
        { key: 'agreement', label: 'Terms of Service' },
        { key: 'privacy', label: 'Privacy Policy' },
        { key: 'ai', label: 'AI Service Notice' },
      ];

  const content = isCn
    ? {
        agreement: ZH_USER_AGREEMENT,
        privacy: ZH_PRIVACY_POLICY,
        ai: ZH_AI_DISCLAIMER,
      }
    : {
        agreement: USER_AGREEMENT,
        privacy: PRIVACY_POLICY,
        ai: AI_DISCLAIMER,
      };

  const titles = isCn
    ? {
        agreement: 'SAGEMRO 用户协议',
        privacy: 'SAGEMRO 隐私政策',
        ai: 'SAGEMRO AI 服务说明',
      }
    : {
        agreement: 'SAGEMRO Terms of Service',
        privacy: 'SAGEMRO Privacy Policy',
        ai: 'SAGEMRO AI Service Notice',
      };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[activeTab]} size="lg">
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-4 -mt-1 overflow-x-auto">
        {tabs.map((tab) => (
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
          {isCn
            ? '生效日期：2026 年 6 月 7 日。平台运营方：济南钰峭机械有限公司'
            : 'Effective date: June 7, 2026. Platform operator: Jinan Euchio Machinery Co., Ltd.'}
        </p>
        <SimpleMarkdown content={content[activeTab]} />
      </div>
    </Modal>
  );
}
