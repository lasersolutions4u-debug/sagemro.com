import { useState } from 'react';
import { Bot, Send, ShieldAlert } from 'lucide-react';
import { aiServiceTools, buildAiToolPrompt } from '../../data/aiServiceTools';

export function AIToolsPanel({ onSendMessage }) {
  const [activeToolId, setActiveToolId] = useState(aiServiceTools[0].id);
  const [values, setValues] = useState({});

  const activeTool = aiServiceTools.find((tool) => tool.id === activeToolId) || aiServiceTools[0];

  const currentValues = values[activeTool.id] || {};

  const updateValue = (name, value) => {
    setValues((prev) => ({
      ...prev,
      [activeTool.id]: {
        ...(prev[activeTool.id] || {}),
        [name]: value,
      },
    }));
  };

  const handleSubmit = () => {
    onSendMessage(buildAiToolPrompt(activeTool, currentValues));
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Bot size={18} className="text-[var(--color-primary)]" />
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
          SAGEMRO Service OS
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {aiServiceTools.map((tool) => {
          const ToolIcon = tool.icon;
          const selected = tool.id === activeTool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveToolId(tool.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary)]/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/12 flex items-center justify-center flex-shrink-0">
                  <ToolIcon size={18} className="text-[var(--color-primary)]" />
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

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Send size={15} />
            {activeTool.cta}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <ShieldAlert size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            AI 结果仅作初步参考，不替代现场诊断、正式报价或安全评估。涉及高压电气、激光光路、气路、液压等高风险操作，请等待 SAGEMRO 官方服务确认。
          </p>
        </div>
      </div>
    </div>
  );
}
