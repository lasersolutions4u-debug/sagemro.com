import { useState } from 'react';
import { Modal } from './Modal';

// ===== 法律文档内容 =====

const USER_AGREEMENT = `
> 本协议依据 **《SAGEMRO 平台服务协议》（V1.0，2026年5月13日生效）** 精简，完整版本请参阅平台公示文件。
> 平台运营方：济南钰峭机械有限公司（Jinan Euchio Machinery Co., Ltd.）

## 一、平台定义

1.1 SAGEMRO 是钣金加工设备售后服务的撮合平台，通过 AI 助手"小智"为设备使用者（客户）提供技术咨询，并将客户与设备维修服务提供者（服务商/合伙人）进行匹配。

1.2 平台作为信息撮合方，本身不直接提供设备维修服务。维修服务由入驻平台的服务商独立提供。平台对服务过程进行记录和监督。

## 二、账户注册

2.1 客户注册需提供真实手机号码、用户昵称和登录密码。服务商入驻还需提供姓名，并可选择性填写设备类型、品牌、维修项目、服务地区等标签信息。

2.2 注册需通过短信验证码验证手机号码。同一手机号仅可注册一个客户账号和一个服务商账号。

2.3 用户应妥善保管账户和密码，不得将账户出借或转让给第三方。

## 三、工单服务流程

3.1 客户可通过 AI 对话或侧边栏入口创建工单，填写问题类型、描述和紧急程度。

3.2 工单状态依次为：已提交 → 处理中 → 报价中 → 待付款 → 服务中 → 已解决 → 已完成。

3.3 客户与服务商可在工单内进行消息沟通，消息记录长期保存。

## 四、报价与费用

4.1 服务商接单后可在工单内提交报价，包含人工费、配件费、差旅费和其他费用，合计为服务费小计。

4.2 客户支付的费用由平台统一收取，平台按服务费小计的一定比例收取平台技术服务费，剩余部分归服务商所有。具体费率根据服务商等级确定。

4.3 客户收到报价后可选择确认报价或拒绝报价（发起议价）。

## 五、服务商等级

5.1 服务商注册后默认为 Junior（初级）级，信用分 100 分。等级及对应费率以平台公布的等级规则为准。

5.2 服务商可在工作台查看当前等级、平台服务费率、信用分和钱包余额。

## 六、支付

6.1 平台支付功能目前处于**模拟环境**阶段。当前展示的支付方式（银行转账/支付宝/微信支付）为前端界面展示，交易为模拟交易，不涉及真实资金流动。

6.2 正式支付上线后，客户在线支付至平台托管账户，服务完成且客户确认后，平台将服务商应得款项结算至服务商钱包。正式支付上线前平台将通知所有用户。

## 七、服务商钱包与提现

7.1 服务商完成工单并获得客户评价后，应得款项计入钱包余额。服务商可在工作台查看钱包余额和收入流水。

7.2 服务商可申请提现，需已绑定银行卡信息，单次提现不低于 100 元、不高于 50,000 元。提现申请提交后由平台审核处理。

## 八、服务评价

8.1 工单完成后，客户可从时效性、技术熟练程度、沟通流畅度、专业性四个维度（1-5分）对服务商进行评价。

8.2 服务商可在工单完成后对客户进行内部评价，仅供平台内部参考。

## 九、用户行为规范

客户应提供真实的设备信息、配合服务商作业、按确认报价支付费用。服务商应按行业规范提供服务、接单后 24 小时内联系客户、如实报价、对客户信息保密、不绕过平台私下交易。所有用户不得利用平台从事违法活动或发布虚假信息。

## 十、个人信息保护

平台收集的用户信息仅用于提供服务，不会向第三方出售或分享（法律法规要求或经用户同意除外）。密码经 PBKDF2 加密存储，平台不以明文形式保存。

## 十一、免责声明

AI 小智的技术建议仅供参考，不构成专业维修承诺。维修服务由服务商独立提供，平台不对服务质量、时效做出保证。因不可抗力导致服务中断的，平台不承担责任但应在合理时间内恢复。

## 十二、协议修订

平台有权根据业务发展或法律法规变化修订本协议，修订后将在平台公示。用户继续使用即视为接受修订后的协议。本协议适用中华人民共和国法律，争议由济南钰峭机械有限公司所在地法院管辖。

## 联系方式

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.com
`.trim();

const PRIVACY_POLICY = `
## 一、我们收集的信息

**您主动提供的信息：**
- 注册信息：手机号码、真实姓名、公司名称、密码
- 服务商背景信息：擅长的设备类型、品牌、维修项目、服务地区
- 工单信息：设备类型、品牌型号、故障描述
- 评价内容：服务评分和文字评价

**我们自动收集的信息：**
- 对话记录：用于提供连续性咨询服务
- 工单消息：作为服务凭证保存
- 使用日志：IP 地址用于安全防护，不与个人身份关联

**我们不收集：** 身份证号码、银行卡信息、设备远程诊断数据。

## 二、信息的使用目的

- 提供核心服务：AI 技术咨询、工单管理、服务商匹配
- 个性化服务：基于设备档案提供针对性技术建议
- AI 服务优化：匿名化后改善 AI 回答质量（不将个人身份信息用于模型训练）
- 安全保障：IP 限流、异常行为检测

## 三、信息的存储与安全

- 数据存储在 Cloudflare 全球网络数据中心
- 所有传输通过 HTTPS 加密
- 密码经过加盐哈希处理，我们无法获取明文密码
- 敏感信息自动脱敏处理
- API 采用 JWT 身份验证，工单数据仅相关方可访问

## 四、信息的共享

- 我们不会将您的个人信息出售给任何第三方
- 工单信息仅展示给匹配的服务商
- 对话内容通过加密接口发送到 AI 服务商，不发送账户凭证
- 应法律要求时可能共享信息

## 五、您的权利

- 查阅权：可在个人中心查看您的信息
- 更正权：可随时修改个人信息和设备档案
- 删除权：可联系我们删除账户和相关数据
- 通知管理：可在设置中管理推送通知

## 六、Cookie 和本地存储

本平台使用浏览器 localStorage 存储登录状态和对话历史，不使用第三方跟踪 Cookie。

## 七、联系我们

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.com
`.trim();

const AI_DISCLAIMER = `
## 一、AI 服务性质

1.1 AI 小智是基于大语言模型技术的智能助手，其提供的所有技术咨询内容均为**参考建议**，不构成专业维修方案、维修承诺或质量保证。

1.2 AI 小智的知识来源于公开的行业资料和平台积累的服务数据，可能存在信息滞后或不完全匹配的情形。

1.3 AI 小智无法替代现场专业服务商的实际诊断和维修操作。

## 二、使用建议

- **技术咨询：** 故障分析和参数建议仅供初步参考。复杂故障请联系专业服务商现场诊断。
- **安全提醒：** 涉及高压电气、激光光路、液压系统等高风险操作时，请严格遵守安全规范。AI 的安全提醒不能替代现场安全评估。
- **报价参考：** AI 的报价分析基于历史数据，不构成定价指导。实际费用以双方确认为准。
- **设备参数：** AI 建议的参数为通用参考值，应根据具体设备状况调整。

## 三、数据说明

- 对话内容会被记录，用于提供连续性咨询和改善服务
- 敏感个人信息自动脱敏处理
- 对话内容不会分享给其他用户

## 四、服务限制

- AI 可能偶尔产生不准确的回答，请注意甄别
- 每位用户每日 AI 对话次数有上限
- AI 不回答与设备维修无关的问题
- AI 不提供具体的设备购买建议

## 五、责任限制

因参考 AI 建议而导致的任何设备损坏、人身伤害、经济损失，济南钰峭机械有限公司不承担责任。如需专业维修服务，请通过平台提交工单。

## 六、联系方式

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.com
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
    { key: 'agreement', label: '用户服务协议' },
    { key: 'privacy', label: '隐私政策' },
    { key: 'ai', label: 'AI服务须知' },
  ];

  const content = {
    agreement: USER_AGREEMENT,
    privacy: PRIVACY_POLICY,
    ai: AI_DISCLAIMER,
  };

  const titles = {
    agreement: 'SAGEMRO 用户服务协议',
    privacy: 'SAGEMRO 隐私政策',
    ai: 'SAGEMRO AI 服务须知',
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
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">用户服务协议：2026年5月13日 | 隐私政策·AI服务须知：2026年4月24日</p>
        <SimpleMarkdown content={content[activeTab]} />
      </div>
    </Modal>
  );
}
