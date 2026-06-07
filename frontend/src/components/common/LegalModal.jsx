import { useState } from 'react';
import { Modal } from './Modal';

const USER_AGREEMENT = `
> 本协议依据 **SAGEMRO Service OS 服务协议（V2.0，2026年6月7日生效）** 精简。
> 运营方：济南钰峭机械有限公司（Jinan Euchio Machinery Co., Ltd.）

## 一、服务定位

1.1 SAGEMRO Service OS 面向激光切割机、折弯机、焊接机及钣金加工设备，提供 AI 辅助诊断、官方服务申请、设备档案、服务报告、备件咨询、维保跟进和新机选型支持。

1.2 SAGEMRO 不定位为松散的第三方工程师撮合平台。客户提交的是 SAGEMRO 官方服务申请，SAGEMRO 根据问题类型、设备情况、地区和工程师能力安排内部工程师或经 SAGEMRO 确认的服务代表跟进。

1.3 AI 助手“小智”用于初步咨询、问题收集、风险提示和服务申请整理，不替代现场工程师诊断、维修操作或安全评估。

## 二、账户注册

2.1 客户注册需提供真实手机号码、姓名、公司名称和登录密码。用户应保证所提供信息真实、准确、完整。

2.2 工程师账号为 SAGEMRO 内部运营账号或经 SAGEMRO 审核的服务代表账号，不开放公众自行入驻注册。

2.3 用户应妥善保管账户和密码，不得将账户出借或转让给第三方。

## 三、服务申请流程

3.1 客户可通过 AI 工具、AI 对话或服务申请入口提交设备问题、参数调试、维保、备件或新机选型需求。

3.2 SAGEMRO 可使用 AI 对申请内容生成初步摘要、风险等级、所需技能标签和跟进建议。正式诊断、报价、服务安排和安全要求以 SAGEMRO 人工确认为准。

3.3 服务状态可能包括：待处理、已分配、处理中、报价中、服务中、待客户确认、已完成、已取消等。

## 四、报价、费用与支付

4.1 AI 生成的价格区间、备件判断或成本因素仅为参考，不构成正式报价或付款承诺。

4.2 正式服务范围、费用、备件、差旅、付款方式和交付安排由 SAGEMRO 与客户另行确认。

4.3 当前线上支付相关页面如有展示，除非 SAGEMRO 明确说明为正式支付入口，否则仅为测试、演示或内部流程界面。

4.4 SAGEMRO 不在客户侧展示平台抽佣、工程师钱包、提现或第三方自由入驻结算规则。

## 五、服务报告与客户确认

5.1 工程师完成服务前，应填写服务报告。服务报告可能包括客户现象、根因诊断、处理动作、调整参数、配件使用、工时、现场照片、后续维护建议等。

5.2 客户可在服务完成后确认服务结果并提交评价。客户评价用于服务质量改进、内部管理和后续服务参考。

## 六、用户义务

6.1 客户应提供真实、准确的设备信息和故障描述，配合 SAGEMRO 进行远程或现场诊断，并遵守设备安全操作规程。

6.2 涉及高压电气、激光光路、液压、气路、吊装、动火等高风险场景时，客户应停止不安全操作，并等待具备资质或能力的人员处理。

## 七、个人信息保护

7.1 SAGEMRO 收集和使用用户信息仅用于账号管理、AI 咨询、服务申请、设备档案、服务报告、通知、售后跟进、安全防护和运营管理。

7.2 SAGEMRO 不会向无关第三方出售个人信息。为完成服务，必要的服务申请信息可能展示给 SAGEMRO 内部工程师、客服、运营人员或经 SAGEMRO 确认的服务代表。

## 八、AI 服务边界

8.1 AI 小智输出仅为初步参考建议，不构成最终诊断、维修承诺、安全许可、正式报价或质量保证。

8.2 用户因自行参考 AI 建议进行高风险操作造成损失的，应自行承担相应风险。涉及安全或重大维修决策时，应等待 SAGEMRO 或合格人员确认。

## 九、协议修订

SAGEMRO 可根据业务发展、法律法规或监管要求修订本协议。用户继续使用服务，即视为接受修订后的协议。

## 十、联系方式

济南钰峭机械有限公司 | 邮箱：support@sagemro.com | https://sagemro.com
`.trim();

const PRIVACY_POLICY = `
## 一、我们收集的信息

**您主动提供的信息：**
- 注册信息：手机号码、真实姓名、公司名称、密码
- 服务申请信息：设备类型、品牌型号、故障描述、地区、紧急程度、联系方式
- AI 工具输入：报警代码、切割参数、备件描述、新机选型需求、设备健康报告输入
- 附件：用于诊断和服务记录的照片、截图、视频或文件
- 反馈：评分、备注、验收记录和跟进说明

**我们自动收集的信息：**
- 对话记录和 AI 工具使用记录，用于连续咨询和服务跟进
- 使用日志，用于安全防护、限流和故障排查
- 浏览器本地存储，用于登录状态和本地对话连续性

**我们不主动收集：** 身份证号码、银行卡信息、设备远程控制数据，除非另有明确约定。

## 二、信息的使用目的

- 提供 AI 初步诊断和技术咨询
- 创建服务申请、设备档案和服务报告
- 安排 SAGEMRO 工程师或认证服务代表
- 推荐备件、维保计划或新机选型支持
- 使用匿名化或脱敏数据改善 AI 回答质量
- 安全防护、滥用防控和运营排障

## 三、信息的存储与安全

- 所有传输通过 HTTPS 加密
- 密码经过加盐哈希处理，我们无法获取明文密码
- 敏感信息可能在 AI 处理或日志前进行脱敏
- API 采用身份认证和访问控制

## 四、信息的共享

- 我们不会将您的个人信息出售给任何第三方
- 服务申请信息可能仅在服务交付所必需范围内展示给 SAGEMRO 内部工程师或认证服务代表
- AI 对话内容可能通过加密接口发送到 AI 服务提供商，不发送账户密码
- 应法律法规或主管部门要求时可能披露信息

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

1.1 AI 小智是基于大语言模型技术的设备咨询和服务申请整理助手。

1.2 AI 输出仅为初步参考，不构成最终诊断、专业维修承诺、安全许可、正式报价或质量保证。

1.3 AI 不能替代现场诊断、上锁挂牌、电气安全评估、激光安全评估或合格工程师判断。

## 二、使用建议

- **故障诊断：** AI 可整理症状和可能原因，最终诊断需以 SAGEMRO 确认为准。
- **切割参数：** AI 参数为参考范围，应结合设备状态、材料、气体、喷嘴和安全规则调整。
- **备件识别：** AI 识别为初步判断，采购或更换前必须人工确认兼容性。
- **维修预估：** AI 可给出费用等级或影响因素，不构成正式报价。
- **新机选型：** AI 选型为初步建议，正式新机项目由 Euchio 或授权销售人员确认。

## 三、安全限制

- 不要仅依据 AI 输出进行带电维修
- 不要在无资质人员在场时打开激光光路、高压气路、液压系统或安全护罩
- 出现烟雾、火险、异味、裸露线路、严重撞机或反复高风险报警时，应立即停止运行
- 不确定的高风险情况，应提交 SAGEMRO 官方服务申请

## 四、数据说明

- 对话内容会被记录，用于提供连续性咨询和改善服务
- 敏感个人信息自动脱敏处理
- 对话内容不会分享给其他用户

## 五、服务限制

- AI 可能偶尔产生不准确的回答，请注意甄别
- 每位用户每日 AI 对话次数有上限
- AI 不回答与设备维修无关的问题
- AI 不应作为维修、采购、安全或法律决策的唯一依据

## 六、责任限制

因单独依赖 AI 输出而导致的设备损坏、人身伤害、停产损失或其他损失，济南钰峭机械有限公司不承担责任。如需专业服务，请提交 SAGEMRO 官方服务申请。

## 七、联系方式

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
