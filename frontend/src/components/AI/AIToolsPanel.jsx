import { useState } from 'react';
import { ArrowRight, Bot, ClipboardList, Send, ShieldAlert, Sparkles, X } from 'lucide-react';
import { LeadForm } from '../Chat/LeadForm';
import { buildAiToolPrompt, getLocalizedAiServiceTools } from '../../data/aiServiceTools';
import { getCurrentUiText } from '../../i18n/uiText';

export function AIToolsPanel({ onSendMessage }) {
  const text = getCurrentUiText();
  const t = text.aiTools;
  const aiServiceTools = getLocalizedAiServiceTools(text.locale);
  const [activeToolId, setActiveToolId] = useState(aiServiceTools[0].id);
  const [values, setValues] = useState({});
  const [leadOpen, setLeadOpen] = useState(false);

  const activeTool = aiServiceTools.find((tool) => tool.id === activeToolId) || aiServiceTools[0];

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
    const prompt = buildAiToolPrompt(activeTool, currentValues, t);
    onSendMessage(prompt);
  };

  const handleAgentStart = () => {
    onSendMessage(t.startPrompt(activeTool));
  };

  const leadSummary = activeTool.fields
    .map((field) => `${field.label}: ${currentValues[field.name] || '-'}`)
    .join('\n');

  return (
    <div className="w-full max-w-7xl mx-auto rounded-[2rem] border border-[var(--color-border)] bg-white/85 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-700">
            <Bot size={14} />
            {t.eyebrow}
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
            {t.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t.intro}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          {t.optionalFields}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {aiServiceTools.map((tool) => {
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
                {t.autoRouted}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                {activeTool.leadType}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {activeTool.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {t.activeIntro}
            </p>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <ClipboardList size={14} />
              {t.structuredCard}
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <span>{t.detectedModule}</span>
                <strong className="text-slate-900">{activeTool.shortTitle}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t.leadType}</span>
                <strong className="text-slate-900">{activeTool.leadType}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>{t.nextAction}</span>
                <strong className="text-slate-900">{t.nextActionValue}</strong>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <strong className="block text-amber-950">{t.experienceTitle}</strong>
            {t.experienceBody}
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
              {t.notice}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAgentStart}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#12202a] text-white text-xs font-medium hover:bg-[#203342] transition-colors"
            >
              {t.startAgent}
              <Bot size={14} />
            </button>
            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, [activeTool.id]: {} }))}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <X size={14} />
              {t.clear}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              {t.useFields}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-medium transition-colors"
            >
              {t.requestFollowUp}
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      <LeadForm
        isOpen={leadOpen}
        onClose={() => setLeadOpen(false)}
        source="ai_tool"
        interest={activeTool.leadType}
        initialMessage={`AI Tool: ${activeTool.title}\n${leadSummary}`}
      />
    </div>
  );
}
