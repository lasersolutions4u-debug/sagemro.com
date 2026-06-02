import { useState } from 'react';
import { Modal } from './Modal';

// ===== 法律文档内容 =====

const USER_AGREEMENT = `
> This agreement is a summary based on the **SAGEMRO Platform Terms of Service (V1.0, effective May 13, 2026)**. For the full version, please refer to the official publication on the platform.
> Platform Operator: Jinan Euchio Machinery Co., Ltd.

## 1. Platform Definition

1.1 SAGEMRO is a matchmaking platform for sheet metal equipment after-sales services. Through the AI assistant "XiaoZhi," it provides technical consultation to equipment users (customers) and matches customers with equipment repair service providers (engineers/partners).

1.2 The platform acts as an information intermediary and does not directly provide equipment repair services. Repair services are independently provided by engineers registered on the platform. The platform records and supervises the service process.

## 2. Account Registration

2.1 Customers must provide a valid phone number, display name, and login password to register. Engineers must also provide their real name and may optionally fill in tags such as equipment type, brand, service items, and service region.

2.2 Registration requires phone number verification via SMS code. Each phone number can register one customer account and one engineer account.

2.3 Users should keep their account and password secure. Accounts may not be lent or transferred to third parties.

## 3. Work Order Service Process

3.1 Customers can create work orders through AI chat or the sidebar entry, filling in the problem type, description, and urgency level.

3.2 Work order statuses in order: Submitted > In Progress > Quoting > Pending Payment > Under Service > Resolved > Completed.

3.3 Customers and engineers can communicate via messages within the work order. Message history is retained long-term.

## 4. Quotation and Fees

4.1 After accepting an order, engineers can submit a quotation within the work order, including labor fees, parts fees, travel expenses, and other costs, totaling the service fee subtotal.

4.2 Fees paid by customers are collected by the platform. The platform charges a technical service fee based on a percentage of the service fee subtotal, with the remainder going to the engineer. Specific rates are determined by the engineer's tier.

4.3 After receiving a quotation, the customer may choose to confirm or reject the quotation (initiate negotiation).

## 5. Service Provider Tiers

5.1 Service Providers are assigned the Junior tier by default upon registration, with a credit score of 100. Tiers and corresponding rates are subject to the platform's published tier rules.

5.2 Service Providers can view their current tier, platform service fee rate, credit score, and wallet balance on their dashboard.

## 6. Payment

6.1 The platform's payment functionality is currently in a **sandbox environment**. The displayed payment methods (bank transfer / Alipay / WeChat Pay) are for frontend interface demonstration only. Transactions are simulated and do not involve real funds.

6.2 When official payment goes live, customer payments will be held in the platform's escrow account. After service completion and customer confirmation, the platform will settle the engineer's earnings to their wallet. The platform will notify all users before official payment launches.

## 7. Service Provider Wallet and Withdrawal

7.1 After completing a work order and receiving a customer review, the service provider's earnings are credited to their wallet balance. Service Providers can view their wallet balance and transaction history on their dashboard.

7.2 Service Providers may apply for withdrawal. A linked bank account is required. The minimum withdrawal amount is 100 CNY per transaction and the maximum is 50,000 CNY. Withdrawal requests are reviewed and processed by the platform.

## 8. Service Reviews

8.1 After a work order is completed, customers can rate the engineer across four dimensions (1-5 scale): timeliness, technical proficiency, communication quality, and professionalism.

8.2 Engineers can submit an internal review of the customer after work order completion, for platform reference only.

## 9. User Code of Conduct

Customers should provide accurate equipment information, cooperate with engineers during service, and pay according to confirmed quotations. Engineers should provide services in accordance with industry standards, contact the customer within 24 hours of accepting an order, quote honestly, keep customer information confidential, and not bypass the platform for private transactions. All users must not use the platform for illegal activities or publish false information.

## 10. Personal Information Protection

User information collected by the platform is used solely for service delivery and will not be sold or shared with third parties (except as required by law or with user consent). Passwords are stored with PBKDF2 encryption; the platform does not store plaintext passwords.

## 11. Disclaimer

AI XiaoZhi's technical suggestions are for reference only and do not constitute professional repair commitments. Repair services are independently provided by engineers; the platform does not guarantee service quality or timeliness. The platform shall not be liable for service interruptions caused by force majeure, but shall restore service within a reasonable time.

## 12. Agreement Amendments

The platform reserves the right to amend this agreement based on business development or changes in laws and regulations. Amendments will be published on the platform. Continued use of the platform constitutes acceptance of the amended agreement. This agreement is governed by the laws of the People's Republic of China, and disputes shall be subject to the jurisdiction of the courts in the location of Jinan Euchio Machinery Co., Ltd.

## Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const PRIVACY_POLICY = `
## 1. Information We Collect

**Information you provide voluntarily:**
- Registration information: phone number, real name, company name, password
- Service Provider background: equipment types, brands, service items, service regions
- Work order information: equipment type, brand and model, fault description
- Review content: service ratings and written reviews

**Information we collect automatically:**
- Chat history: used to provide continuous consultation services
- Work order messages: retained as service records
- Usage logs: IP addresses are used for security protection and are not linked to personal identity

**Information we do not collect:** national ID numbers, bank card information, remote equipment diagnostic data.

## 2. Purposes of Information Use

- Providing core services: AI technical consultation, work order management, engineer matching
- Personalized services: providing targeted technical advice based on equipment records
- AI service improvement: anonymized data used to improve AI response quality (personal identity information is not used for model training)
- Security: IP rate limiting, abnormal behavior detection

## 3. Information Storage and Security

- Data is stored in Cloudflare's global network of data centers
- All transmissions are encrypted via HTTPS
- Passwords are salted and hashed; we cannot access plaintext passwords
- Sensitive information is automatically desensitized
- API uses JWT authentication; work order data is accessible only to relevant parties

## 4. Information Sharing

- We do not sell your personal information to any third party
- Work order information is displayed only to matched engineers
- Chat content is sent to AI service providers through encrypted interfaces without account credentials
- Information may be shared when required by law

## 5. Your Rights

- Access: you can view your information in your personal center
- Correction: you can modify personal information and equipment records at any time
- Deletion: you can contact us to delete your account and related data
- Notification management: you can manage push notifications in settings

## 6. Cookies and Local Storage

This platform uses browser localStorage to store login state and chat history. We do not use third-party tracking cookies.

## 7. Contact Us

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

const AI_DISCLAIMER = `
## 1. Nature of AI Services

1.1 AI XiaoZhi is an intelligent assistant based on large language model technology. All technical consultation content it provides constitutes **reference suggestions only** and does not constitute professional repair solutions, repair commitments, or quality guarantees.

1.2 AI XiaoZhi's knowledge is derived from publicly available industry materials and service data accumulated by the platform. Information may be outdated or not fully applicable.

1.3 AI XiaoZhi cannot replace on-site diagnosis and repair operations by professional engineers.

## 2. Usage Recommendations

- **Technical consultation:** Fault analysis and parameter suggestions are for preliminary reference only. For complex faults, please contact a professional engineer for on-site diagnosis.
- **Safety reminders:** When dealing with high-risk operations such as high-voltage electrical systems, laser optical paths, and hydraulic systems, please strictly follow safety regulations. AI safety reminders cannot replace on-site safety assessments.
- **Quotation reference:** AI quotation analysis is based on historical data and does not constitute pricing guidance. Actual costs are subject to mutual confirmation.
- **Equipment parameters:** Parameters suggested by AI are general reference values and should be adjusted based on specific equipment conditions.

## 3. Data Usage

- Chat content is recorded to provide continuous consultation and improve services
- Sensitive personal information is automatically desensitized
- Chat content is not shared with other users

## 4. Service Limitations

- AI may occasionally produce inaccurate responses; please verify independently
- Each user has a daily limit on AI conversation sessions
- AI does not answer questions unrelated to equipment repair
- AI does not provide specific equipment purchasing recommendations

## 5. Limitation of Liability

Jinan Euchio Machinery Co., Ltd. shall not be liable for any equipment damage, personal injury, or economic loss resulting from reliance on AI suggestions. For professional repair services, please submit a work order through the platform.

## 6. Contact

Jinan Euchio Machinery Co., Ltd. | Email: support@sagemro.com | https://sagemro.com
`.trim();

// ===== 简易 Markdown 渲染 =====
function SimpleMarkdown({ content }) {
  const lines = content.split('\n');
  const elements = [];
  let listItems = [];

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

  const renderInline = (text) => {
    // bold
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-[var(--color-text-primary)]">{part}</strong> : part
    );
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

// ===== 导出的法律文档 Modal =====
export function LegalModal({ isOpen, onClose, initialTab = 'agreement' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

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

  // 当 initialTab 变化时同步
  if (isOpen && activeTab !== initialTab) {
    setActiveTab(initialTab);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[activeTab]} size="lg">
      {/* 标签切换 */}
      <div className="flex border-b border-[var(--color-border)] mb-4 -mt-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 文档内容 */}
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">Terms of Service: May 13, 2026 | Privacy Policy & AI Service Notice: April 24, 2026</p>
        <SimpleMarkdown content={content[activeTab]} />
      </div>
    </Modal>
  );
}
