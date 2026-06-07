import { useEffect, useState } from 'react';
import { Modal } from './Modal';

const USER_AGREEMENT = `
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

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const tabs = [
    { key: 'agreement', label: 'Terms of Service' },
    { key: 'privacy', label: 'Privacy Policy' },
    { key: 'ai', label: 'AI Service Notice' },
  ];

  const content = {
    agreement: USER_AGREEMENT,
    privacy: PRIVACY_POLICY,
    ai: AI_DISCLAIMER,
  };

  const titles = {
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
          Effective date: June 7, 2026. Platform operator: Jinan Euchio Machinery Co., Ltd.
        </p>
        <SimpleMarkdown content={content[activeTab]} />
      </div>
    </Modal>
  );
}
