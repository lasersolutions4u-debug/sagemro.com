import { useMemo, useState } from 'react';
import { ArrowRight, Bot, Send, ShieldAlert, X } from 'lucide-react';
import { LeadForm } from '../Chat/LeadForm';
import { aiServiceTools, buildAiToolPrompt } from '../../data/aiServiceTools';

export function AIToolsPanel({ onSendMessage }) {
  const [activeToolId, setActiveToolId] = useState(aiServiceTools[0].id);
  const [values, setValues] = useState({});
  const [leadOpen, setLeadOpen] = useState(false);

  const activeTool = useMemo(
    () => aiServiceTools.find((tool) => tool.id === activeToolId) || aiServiceTools[0],
    [activeToolId]
  );

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

  const leadSummary = activeTool.fields
    .map((field) => `${field.label}: ${currentValues[field.name] || '-'}`)
    .join('\n');

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Bot size={18} className="text-[var(--color-primary)]" />
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
          SAGEMRO Service OS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {aiServiceTools.map(({ id, icon: Icon, shortTitle, description }) => {
          const selected = id === activeTool.id;
          return (
            <button
              key={id}
              onClick={() => setActiveToolId(id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary)]/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/12 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {shortTitle}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {description}
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
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {activeTool.title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {activeTool.description}
            </p>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs">
            {activeTool.leadType}
          </span>
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
              AI provides preliminary guidance only. SAGEMRO official service confirms diagnosis, quote, and safety requirements.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setValues((prev) => ({ ...prev, [activeTool.id]: {} }))}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              <X size={14} />
              Clear
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-medium hover:bg-[var(--color-primary)]/10 transition-colors"
            >
              {activeTool.cta}
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setLeadOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-medium transition-colors"
            >
              Request Follow-up
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
