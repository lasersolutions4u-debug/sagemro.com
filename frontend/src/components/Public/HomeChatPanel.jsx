import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Send, Square } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { trackFunnelEvent } from '../../services/api';
import { createAnalyticsRequestId } from '../../services/funnelAnalytics';
import { openConsultationForm } from '../../utils/consultation';

// 主站首屏的 AI 对话框：复用与 AI 门户相同的 /api/chat（访客可用，按 IP 限流）。
// 注意：这是首屏的第二个转化入口，不能取代咨询线索表单——表单仍然由 PublicSiteShell
// 的「咨询」按钮和这里的按钮打开。
const TEXT = {
  com: {
    title: 'Ask SAGEMRO AI',
    subtitle: 'Describe the equipment and the problem. AI organizes it; a SAGEMRO engineer confirms.',
    placeholder: 'e.g. fiber laser cutting machine, alarm 4020, cut quality dropped…',
    send: 'Send',
    stop: 'Stop',
    sending: 'SAGEMRO AI is replying…',
    empty: 'Start with the machine, the alarm, and what changed.',
    suggestions: ['Alarm code meaning', 'Cut quality dropped', 'Preventive maintenance plan'],
    notice: 'AI answers are for reference only. Final diagnosis, pricing, and safety decisions follow the SAGEMRO service process.',
    details: 'Details',
    portal: 'Open the AI portal',
    consult: 'Request a consultation',
    you: 'You',
    ai: 'SAGEMRO AI',
  },
  cn: {
    title: '向 SAGEMRO AI 提问',
    subtitle: '描述设备与问题，AI 先整理信息，再由 SAGEMRO 工程师确认。',
    placeholder: '例如：光纤激光切割机，报警 4020，切割质量下降…',
    send: '发送',
    stop: '停止',
    sending: 'SAGEMRO AI 正在回复…',
    empty: '先说清楚设备、报警代码和发生了什么变化。',
    suggestions: ['报警代码含义', '切割质量下降', '预防性维护计划'],
    notice: 'AI 回答仅供参考。最终诊断、报价与现场安全仍按 SAGEMRO 服务流程确认。',
    details: '详情',
    portal: '打开 AI 门户',
    consult: '提交咨询需求',
    you: '你',
    ai: 'SAGEMRO AI',
  },
};

const PORTAL_URL = { cn: 'https://ai.sagemro.cn', com: 'https://ai.sagemro.com' };

export function HomeChatPanel({ isCn, onOpenLegal }) {
  const t = TEXT[isCn ? 'cn' : 'com'];
  const market = isCn ? 'cn' : 'com';
  const { messages, isStreaming, error, sendMessage, stopGeneration } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const submit = (content) => {
    const text = String(content ?? input).trim();
    if (!text || isStreaming) return;
    setInput('');
    trackFunnelEvent('ai_conversation_started', {
      entry: 'public_home_chat',
      authenticated: false,
      has_images: false,
      request_id: createAnalyticsRequestId(),
    });
    sendMessage(text, undefined);
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const answered = messages.filter((message) => message.content || message.role === 'user');

  return (
    <section className="flex h-full min-h-[420px] flex-col border border-[#e3d6c7] bg-[#fffdf8] shadow-[0_18px_50px_rgba(45,33,22,0.10)]" aria-label={t.title} data-home-chat="panel">
      <div className="border-b border-[#e6dccf] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#21160c]">{t.title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#756552]">{t.subtitle}</p>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite" data-home-chat="messages">
        {answered.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-[#756552]">{t.empty}</p>
            <div className="flex flex-wrap gap-2">
              {t.suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => submit(item)}
                  className="rounded-full border border-[#d8c9b6] px-3 py-1.5 text-xs text-[#5f5142] transition-colors hover:border-[#d97706] hover:text-[#b45309]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {answered.map((message) => (
          <div key={message.id} data-home-chat={message.role}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39686]">
              {message.role === 'user' ? t.you : t.ai}
            </div>
            <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${message.role === 'user' ? 'text-[#21160c]' : 'text-[#5f5142]'}`}>
              {message.content || (isStreaming ? t.sending : '')}
            </p>
          </div>
        ))}

        {error && (
          <p className="flex items-start gap-2 text-xs text-[#b45309]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>

      <div className="border-t border-[#e6dccf] px-4 py-3">
        <label htmlFor="home-chat-input" className="sr-only">{t.placeholder}</label>
        <div className="flex items-end gap-2">
          <textarea
            id="home-chat-input"
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.placeholder}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#d8c9b6] bg-white px-3 py-2 text-sm text-[#21160c] outline-none focus:border-[#d97706]"
          />
          {isStreaming ? (
            <button type="button" onClick={stopGeneration} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[#d8c9b6] px-3 text-sm text-[#5f5142]">
              <Square size={14} />{t.stop}
            </button>
          ) : (
            <button type="button" onClick={() => submit()} disabled={!input.trim()} className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-[#21160c] disabled:opacity-50" data-home-chat="send">
              <Send size={14} />{t.send}
            </button>
          )}
        </div>

        <p className="mt-2 text-[11px] leading-5 text-[#8a7864]">
          {t.notice}
          {onOpenLegal && (
            <button type="button" onClick={() => onOpenLegal('ai')} className="ml-1 underline decoration-dotted underline-offset-2 hover:text-[#b45309]">
              {t.details}
            </button>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href={PORTAL_URL[market]} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">
            {t.portal}<ArrowUpRight size={13} />
          </a>
          <button type="button" onClick={openConsultationForm} className="inline-flex min-h-9 items-center text-xs font-semibold text-[#b45309] underline decoration-[#e7b65b] underline-offset-4">
            {t.consult}
          </button>
        </div>
      </div>
    </section>
  );
}
