import { Modal } from '../common/Modal';
import {
  Bot,
  Users,
  Wallet,
  ShieldCheck,
  Target,
  Receipt,
  ClipboardCheck,
  Brain,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const painPoints = [
  {
    icon: Users,
    title: '找工程师难',
    desc: '不知道去哪里找靠谱的工程师，品牌代理商太贵，社会维修师傅不放心。',
  },
  {
    icon: Wallet,
    title: '价格不透明',
    desc: '维修费用没有标准，讨价还价费时费力，经常被宰。',
  },
  {
    icon: ShieldCheck,
    title: '质量无保障',
    desc: '修完没保障，出了问题找不到人，没有记录可查。',
  },
];

const comparisons = [
  {
    dim: '找工程师',
    legacy: '口碑推荐 / 代理商',
    ours: 'AI 精准匹配最优工程师',
  },
  {
    dim: '定价',
    legacy: '口头议价，不透明',
    ours: '平台核价 · AI 审核 · 公开透明',
  },
  {
    dim: '服务保障',
    legacy: '无记录，出了问题找不到人',
    ours: '工单全程记录 · 平台托管',
  },
  {
    dim: '知识积累',
    legacy: '无',
    ours: 'AI 记住每台设备、每次维修',
  },
  {
    dim: '数据价值',
    legacy: '无',
    ours: '地区价格标准 · AI 定价能力',
  },
];

const customerValue = [
  '不再四处打听靠谱工程师',
  '报价透明，心里有底',
  '平台记录，服务有保障',
];

const engineerValue = [
  '稳定订单来源，平台派单',
  '不用自己谈价格，AI 辅助报价',
  '评价体系 + 等级晋升，建立个人品牌',
];

export function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="关于小智" size="md">
      <div className="space-y-6">
        {/* Hero */}
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-3">
            <Bot size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-1">
            SAGEMRO 小智
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            钣金加工行业智能服务平台 · 客户与工程师之间的 AI 枢纽
          </p>
        </div>

        {/* 痛点 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            我们解决什么问题
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {painPoints.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-3 bg-[var(--color-surface-elevated)] rounded-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center mb-2">
                  <Icon size={16} className="text-[var(--color-primary)]" />
                </div>
                <div className="text-[13px] font-medium text-[var(--color-text-primary)] mb-1">
                  {title}
                </div>
                <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 解决方案流程 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            我们的解决方案
          </h3>
          <div className="p-4 bg-[var(--color-surface-elevated)] rounded-xl">
            <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--color-text-primary)] flex-wrap">
              <span className="px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md">客户</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md">小智 AI</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">平台匹配</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">工程师</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">核价 / 议价</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">上门服务</span>
              <ArrowRight size={14} className="text-[var(--color-text-secondary)]" />
              <span className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md">评价完结</span>
            </div>
            <p className="mt-3 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              小智是入口，平台是保障，AI 是大脑。
            </p>
          </div>
        </section>

        {/* 对比表 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            传统方式 vs SAGEMRO
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--color-surface-elevated)]">
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">维度</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)]">传统方式</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--color-primary)]">SAGEMRO</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr
                    key={row.dim}
                    className={i % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-elevated)]/50'}
                  >
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{row.dim}</td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      <div className="flex items-start gap-1">
                        <XCircle size={13} className="text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
                        <span>{row.legacy}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <div className="flex items-start gap-1">
                        <CheckCircle2 size={13} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                        <span>{row.ours}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 数据飞轮 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            为什么 AI 是壁垒
          </h3>
          <div className="p-4 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <Brain size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">数据越多，AI 越准</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <Target size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">AI 越准，用户越信任</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg">
                <TrendingUp size={16} className="text-[var(--color-primary)] flex-shrink-0" />
                <span className="text-[12px] text-[var(--color-text-primary)]">用户越多，数据越多</span>
              </div>
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              每一次工单完成、每一次报价确认、每一次评价反馈，都是平台知识的沉淀。
              别人可以抄界面，但抄不走我们的数据。
            </p>
          </div>
        </section>

        {/* 双端价值 */}
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
            我们对用户的价值
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={16} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">对客户</span>
              </div>
              <ul className="space-y-1.5">
                {customerValue.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    <CheckCircle2 size={12} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardCheck size={16} className="text-[var(--color-primary)]" />
                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">对工程师</span>
              </div>
              <ul className="space-y-1.5">
                {engineerValue.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                    <CheckCircle2 size={12} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Slogan + 版权 */}
        <div className="pt-4 border-t border-[var(--color-border)] text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-primary)]">
            让天下没有难做的售后服务
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            © 2026 SageMRO. All rights reserved.
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            SageMRO 隶属于济南钰峭机械有限公司<br/>
            Jinan Euchio Machinery Co., Ltd.
          </p>
        </div>
      </div>
    </Modal>
  );
}
