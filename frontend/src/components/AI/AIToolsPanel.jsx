import { useState } from 'react';
import { ArrowRight, Bot, ClipboardList, ShieldAlert, Sparkles, X } from 'lucide-react';
import { aiServiceTools, buildAiToolPrompt } from '../../data/aiServiceTools';
import { isCnLocale } from '../../utils/locale';

const COPY = {
  en: {
    badge: 'AI Service Agents',
    title: 'Six agents, one natural-language intake',
    intro: 'Users can start from chat. These agents help the system route the request, extract fields, generate immediate feedback, and prepare a service, parts, maintenance, retrofit, or accessory follow-up.',
    note: 'Form fields support confirmation; natural chat remains the primary experience.',
    auto: 'Auto-routed agent',
    activeHint: 'Start this agent directly, or let SAGEMRO detect it from a free-form chat message. The fields below show what AI will try to extract and confirm.',
    cardTitle: 'Structured service card',
    detectedModule: 'Detected module',
    caseType: 'Case type',
    nextAction: 'Next action',
    nextActionValue: 'AI answer + reviewed next step',
    experienceTitle: 'How users should experience this:',
    experienceBody: 'They describe the problem naturally. AI replies with preliminary value, extracts known fields, highlights missing information, and offers a practical reviewed next step.',
    safety: 'AI provides preliminary guidance only. SAGEMRO service coordination confirms diagnosis, quote, and safety requirements.',
    start: 'Start agent chat',
    clear: 'Clear',
    useFields: 'Use confirmed fields',
  },
  cn: {
    badge: 'AI 服务助手',
    title: '一个自然对话入口，整理多类服务信息',
    intro: '用户可以直接从聊天开始。AI 帮助识别场景、整理字段、补充问题，并形成便于人工复核的下一步摘要。',
    note: '表单字段用于核对信息；自然对话仍然是主要入口。',
    auto: '自动识别场景',
    activeHint: '可以直接启动这个助手，也可以让 SAGEMRO 从自由对话中识别。下面字段展示 AI 会尝试提取和确认的信息。',
    cardTitle: '结构化服务卡片',
    detectedModule: '识别模块',
    caseType: '场景类型',
    nextAction: '下一步',
    nextActionValue: 'AI 初步回复 + 人工复核摘要',
    experienceTitle: '用户应该怎样体验：',
    experienceBody: '用户自然描述问题。AI 先给出有价值的初步反馈，再整理已知信息、指出缺失信息，并给出便于复核的下一步。',
    safety: 'AI 仅提供初步参考。诊断、报价和安全要求仍需由 SAGEMRO 服务协作流程确认。',
    start: '开始助手对话',
    clear: '清空',
    useFields: '使用已确认字段',
  },
};

const CN_TOOL_COPY = {
  diagnosis: {
    title: '故障诊断 AI',
    shortTitle: '故障诊断',
    description: '把报警、图片和现象整理成结构化服务请求。',
    leadType: '维修服务',
    promptIntro: '请作为 SAGEMRO 设备诊断助手，提供安全、克制的初步判断。',
    outputGuide: '返回可能原因、风险级别、停机建议、需要补充的信息、可能涉及的配件，以及是否需要人工服务复核。',
    fields: {
      equipment: ['设备类型', '例如：光纤激光切割机'],
      brandModel: ['品牌 / 型号', '例如：3015 6kW、CypCut、锐科'],
      alarmCode: ['报警代码', '例如：Z 轴跟随误差'],
      symptom: ['故障现象', '描述发生了什么、何时开始、机器是否停机。'],
      material: ['材料 / 厚度 / 气体', '例如：6mm 碳钢，氧气'],
      region: ['位置', '城市 / 国家'],
      urgency: ['紧急程度', '普通 / 紧急 / 已停产'],
    },
  },
  'cutting-parameters': {
    title: '切割参数 AI',
    shortTitle: '切割参数',
    description: '整理材料、厚度、功率、气体和质量问题的安全参考范围。',
    leadType: '工艺调试',
    fields: {
      material: ['材料', '例如：不锈钢、碳钢、铝'],
      thickness: ['厚度', '例如：3mm'],
      laserPower: ['激光功率', '例如：3000W'],
      gas: ['辅助气体', '例如：氮气 / 氧气 / 空气'],
      nozzle: ['喷嘴 / 焦点', '例如：1.5 单喷，焦点未知'],
      qualityIssue: ['当前质量问题', '毛刺、挂渣、切不透、烧边、断面粗糙...'],
    },
  },
  'parts-identification': {
    title: '配件识别 AI',
    shortTitle: '配件识别',
    description: '识别耗材或配件类别，并整理人工确认所需信息。',
    leadType: '配件确认',
    fields: {
      partPhoto: ['图片 / 标识描述', '描述图片、刻字、编码或铭牌信息。'],
      machineInfo: ['机器 / 切割头', '例如：BM111、BLT、Precitec、Raytools'],
      partUse: ['使用位置', '例如：保护镜片、陶瓷环、传感器线'],
      quantity: ['需求数量', '例如：20 pcs'],
      shippingRegion: ['收货区域', '国家 / 城市'],
    },
  },
  'repair-estimate': {
    title: '服务成本参考 AI',
    shortTitle: '成本参考',
    description: '在正式复核前整理可能的成本因素和服务复杂度。',
    leadType: '服务成本背景',
    fields: {
      faultType: ['故障类型', '例如：激光功率下降、切割头撞机、冷水机报警'],
      machineAge: ['设备年限', '例如：4 年'],
      downtime: ['生产状态', '运行中 / 不稳定 / 已停机'],
      history: ['维修历史', '之前维修、更换过的配件、重复故障。'],
      location: ['位置', '城市 / 国家'],
    },
  },
  'machine-selection': {
    title: '改造与外设 AI',
    shortTitle: '改造评估',
    description: '整理升级、自动化、激光外设和后处理需求，供 SAGEMRO 复核。',
    leadType: '改造 / 外设',
    fields: {
      materials: ['当前工艺 / 材料', '例如：激光切碳钢，折弯不锈钢'],
      thicknessRange: ['当前范围或瓶颈', '例如：1-20mm、上下料慢、氮气不稳定'],
      sheetSize: ['机器 / 产线尺寸', '例如：1500x3000mm 激光，110T 折弯机'],
      capacity: ['产能目标', '日/月产量目标或节省人工目标'],
      budget: ['预算范围', '可选'],
      automation: ['需要的设备或升级', '冷水机、除尘、混气、去毛刺、上料、七轴、龙门、模具'],
      country: ['项目国家', '国家 / 地区'],
    },
  },
  'health-report': {
    title: '维护风险 AI',
    shortTitle: '维护风险',
    description: '根据使用强度、故障和维修历史整理维护风险信号。',
    leadType: '维护计划',
    fields: {
      machine: ['设备信息', '品牌、型号、功率、年份'],
      usage: ['使用强度', '例如：每天 10 小时，每周 6 天'],
      faultFrequency: ['近期故障频率', '例如：上个月停机 3 次'],
      maintenance: ['保养历史', '清洁、镜片更换、冷水机保养、历史维修。'],
      qualityIssues: ['质量问题', '毛刺、功率不稳、精度差、重复报警'],
    },
  },
};

function localizeTool(tool, isCn) {
  if (!isCn) return tool;
  const cn = CN_TOOL_COPY[tool.id] || {};
  const fields = tool.fields.map((field) => {
    const localized = cn.fields?.[field.name];
    return localized ? { ...field, label: localized[0], placeholder: localized[1] } : field;
  });
  return { ...tool, ...cn, icon: tool.icon, fields };
}

export function AIToolsPanel({ onSendMessage }) {
  const isCn = isCnLocale();
  const copy = isCn ? COPY.cn : COPY.en;
  const [activeToolId, setActiveToolId] = useState(aiServiceTools[0].id);
  const [values, setValues] = useState({});

  const activeTool = localizeTool(aiServiceTools.find((tool) => tool.id === activeToolId) || aiServiceTools[0], isCn);
  const visibleTools = aiServiceTools.map((tool) => localizeTool(tool, isCn));

  const updateValue = (name, value) => {
    setValues((prev) => ({
      ...prev,
      [activeTool.id]: {
        ...(prev[activeTool.id] || {}),
        [name]: value,
      },
    }));
  };

  const currentValues = values[activeTool.id] || {};

  const handleSubmit = () => {
    const prompt = buildAiToolPrompt(activeTool, currentValues);
    onSendMessage(prompt);
  };

  const handleAgentStart = () => {
    const prompt = isCn
      ? `请启动 ${activeTool.title}。先让我自然描述问题，再提取结构化字段、识别缺失信息、给出安全克制的初步反馈，并为 ${activeTool.leadType} 准备一段便于人工复核的下一步摘要。`
      : `Start ${activeTool.title} as a SAGEMRO Service OS agent. First ask me to describe the problem naturally. Then auto-extract structured fields, identify missing information, provide safe preliminary feedback, and prepare a neutral reviewed next-step summary for ${activeTool.leadType}.`;
    onSendMessage(prompt);
  };

  return (
    <div className="w-full max-w-7xl mx-auto rounded-[2rem] border border-[var(--color-border)] bg-white/85 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-700">
            <Bot size={14} />
            {copy.badge}
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {copy.intro}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          {copy.note}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          const selected = tool.id === activeTool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveToolId(tool.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selected
                  ? 'border-[var(--color-primary)] bg-amber-50 shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary)]/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/12 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {tool.shortTitle}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {tool.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#12202a] px-2.5 py-1 text-[11px] font-medium text-white">
                <Sparkles size={12} />
                {copy.auto}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                {activeTool.leadType}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {activeTool.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {copy.activeHint}
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ClipboardList size={14} />
              {copy.cardTitle}
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <span>{copy.detectedModule}</span>
                <strong className="text-slate-900">{activeTool.shortTitle}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>{copy.caseType}</span>
                <strong className="text-slate-900">{activeTool.leadType}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>{copy.nextAction}</span>
                <strong className="text-slate-900">{copy.nextActionValue}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <strong className="block text-amber-950">{copy.experienceTitle}</strong>
            {copy.experienceBody}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeTool.fields.map((field) => (
            <label
              key={field.name}
              className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
            >
              <span className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                {field.label}
              </span>
              {field.type === 'textarea' ? (
                <textarea
                  value={currentValues[field.name] || ''}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              ) : (
                <input
                  value={currentValues[field.name] || ''}
                  onChange={(event) => updateValue(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-start gap-2 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            <ShieldAlert size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <span>
              {copy.safety}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAgentStart}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#12202a] text-white text-xs font-medium hover:bg-[#203342] transition-colors"
            >
              {copy.start}
              <Bot size={14} />
            </button>
            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, [activeTool.id]: {} }))}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <X size={14} />
              {copy.clear}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              {copy.useFields}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
