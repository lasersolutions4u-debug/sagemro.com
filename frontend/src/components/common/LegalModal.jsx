import { useState } from 'react';
import { Modal } from './Modal';

// ===== 法律文档内容 =====

const USER_AGREEMENT = `
## 一、服务说明

1.1 本平台是面向钣金加工行业设备后服务市场的综合服务平台，提供 AI 技术咨询、设备维修工单管理、合伙人匹配等服务。

1.2 本平台的 AI 助手"小智"提供的技术咨询内容仅供参考，不构成专业维修建议或维修承诺。具体维修方案应以现场专业人员的实际判断为准。

1.3 本平台作为信息中介平台，为客户与合伙人（维修服务提供方）提供信息撮合服务。本平台本身不直接提供设备维修服务。

## 二、用户注册与账户

2.1 您在注册时应提供真实、准确、完整的个人信息，并在信息变更时及时更新。

2.2 您应妥善保管账户信息和密码，因账户密码保管不善导致的损失由您自行承担。

2.3 一个手机号只能注册一个账户。您不得将账户转让、出借给他人使用。

## 三、客户权利与义务

3.1 客户可通过本平台提交设备维修工单，查看工单进度，与合伙人沟通，并对服务进行评价。

3.2 客户提交工单时应如实描述设备故障情况、设备型号等信息。

3.3 客户在确认合伙人报价后，应按约定支付服务费用。客户支付的费用包含合伙人服务费及平台服务费。

## 四、合伙人权利与义务

4.1 合伙人是在本平台注册并通过审核的独立维修服务提供方，与本平台之间不构成雇佣、劳动或代理关系。

4.2 合伙人应如实填写专业背景信息。

4.3 合伙人的服务收入按等级提成：初级 80%、高级 85%、专家 88%，剩余部分为平台服务费。

## 五、免责声明

5.1 AI 小智提供的技术咨询内容基于通用行业知识，仅供参考。我们不对 AI 咨询内容的准确性、完整性作任何保证。

5.2 本平台仅提供信息撮合服务，不对合伙人提供的维修服务质量、效果承担直接责任。

5.3 AI 报价审核结论仅基于历史数据分析，不构成定价建议或价格承诺。

## 六、法律适用与争议解决

6.1 本协议适用中华人民共和国法律。

6.2 因本协议引起的争议，双方应友好协商解决；协商不成的，可向济南钰峭机械有限公司所在地有管辖权的人民法院提起诉讼。

## 七、联系方式

济南钰峭机械有限公司 | 电话：18615584520 | https://sagemro.com
`.trim();

const PRIVACY_POLICY = `
## 一、我们收集的信息

**您主动提供的信息：**
- 注册信息：手机号码、真实姓名、公司名称、密码
- 合伙人背景信息：擅长的设备类型、品牌、维修项目、服务地区
- 工单信息：设备类型、品牌型号、故障描述
- 评价内容：服务评分和文字评价

**我们自动收集的信息：**
- 对话记录：用于提供连续性咨询服务
- 工单消息：作为服务凭证保存
- 使用日志：IP 地址用于安全防护，不与个人身份关联

**我们不收集：** 身份证号码、银行卡信息、设备远程诊断数据。

## 二、信息的使用目的

- 提供核心服务：AI 技术咨询、工单管理、合伙人匹配
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
- 工单信息仅展示给匹配的合伙人
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

济南钰峭机械有限公司 | 电话：18615584520 | https://sagemro.com
`.trim();

const AI_DISCLAIMER = `
## 一、AI 服务性质

1.1 AI 小智是基于大语言模型技术的智能助手，其提供的所有技术咨询内容均为**参考建议**，不构成专业维修方案、维修承诺或质量保证。

1.2 AI 小智的知识来源于公开的行业资料和平台积累的服务数据，可能存在信息滞后或不完全匹配的情形。

1.3 AI 小智无法替代现场专业工程师的实际诊断和维修操作。

## 二、使用建议

- **技术咨询：** 故障分析和参数建议仅供初步参考。复杂故障请联系专业合伙人现场诊断。
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

济南钰峭机械有限公司 | 电话：18615584520 | https://sagemro.com
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
    agreement: 'SageMRO 用户服务协议',
    privacy: 'SageMRO 隐私政策',
    ai: 'SageMRO AI 服务须知',
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
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">最后更新日期：2026年4月24日</p>
        <SimpleMarkdown content={content[activeTab]} />
      </div>
    </Modal>
  );
}
