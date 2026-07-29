import { useEffect, useState } from 'react';

const PRIORITY_STYLES = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function EngineerServiceGuidanceCard({
  isCn,
  state,
  guidance,
  generatedAt,
  pollingExpired,
  canRefresh,
  onRefresh,
  onInsertQuestion,
  onActionFeedback,
}) {
  const [correctionIndex, setCorrectionIndex] = useState(null);
  const [note, setNote] = useState('');
  const [submittingIndex, setSubmittingIndex] = useState(null);
  const copy = isCn
    ? {
      eyebrow: 'AI 服务指引',
      title: '当前最重要的一步',
      preparing: '正在结合工单证据生成下一步指引…',
      delayed: '生成时间较长。你可以重试，固定服务标准仍可正常使用。',
      failed: 'AI 指引暂时不可用。请按服务标准继续，稍后重试。',
      stale: '工单已有新证据，AI 正在准备更新。',
      observations: '判断依据',
      actions: '建议行动',
      rationale: '原因',
      questions: '建议向客户确认',
      draftOnly: '带入消息草稿后仍需你检查并发送。',
      evidence: '仍需证据',
      use: '采用',
      ignore: '忽略',
      correct: '修正',
      correctionLabel: '修正说明',
      correctionPlaceholder: '简要说明哪里不准确，以及正确情况',
      submitCorrection: '提交修正',
      cancel: '取消',
      insertDraft: '带入消息草稿',
      refresh: '更新指引',
      retry: '重试',
      saving: '提交中…',
      generated: '生成于',
      readOnly: '此工单阶段为只读，仍可参考现有指引。',
      noGuidance: '当前没有 AI 建议。请按服务标准继续。',
      priorities: { high: '高', medium: '中', low: '低' },
    }
    : {
      eyebrow: 'AI service guidance',
      title: 'Most important next step',
      preparing: 'Building the next-step guidance from current work-order evidence…',
      delayed: 'Generation is taking longer than expected. Retry when ready; the fixed service standard remains available.',
      failed: 'AI guidance is temporarily unavailable. Continue with the service standard and retry later.',
      stale: 'New work-order evidence is available. AI is preparing an update.',
      observations: 'Why this matters',
      actions: 'Recommended actions',
      rationale: 'Why',
      questions: 'Questions to confirm with the customer',
      draftOnly: 'The text is inserted as a draft for your review and is never sent automatically.',
      evidence: 'Evidence still needed',
      use: 'Use',
      ignore: 'Ignore',
      correct: 'Correct',
      correctionLabel: 'Correction note',
      correctionPlaceholder: 'Briefly explain what is inaccurate and what is correct',
      submitCorrection: 'Submit correction',
      cancel: 'Cancel',
      insertDraft: 'Insert as message draft',
      refresh: 'Update guidance',
      retry: 'Retry',
      saving: 'Submitting…',
      generated: 'Generated',
      readOnly: 'This work-order stage is read-only. Existing guidance remains available for reference.',
      noGuidance: 'No AI guidance is available. Continue with the service standard.',
      priorities: { high: 'High', medium: 'Medium', low: 'Low' },
    };

  const actions = guidance?.next_actions || [];
  const observations = guidance?.observations || [];
  const questions = guidance?.customer_questions || [];
  const evidenceNeeded = guidance?.evidence_needed || [];
  const hasGuidance = Boolean(guidance);
  const showPreparing = (state === 'missing' || state === 'generating') && !hasGuidance;
  const generatedLabel = generatedAt
    ? new Intl.DateTimeFormat(isCn ? 'zh-CN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(generatedAt))
    : '';

  useEffect(() => {
    setCorrectionIndex(null);
    setNote('');
    setSubmittingIndex(null);
  }, [generatedAt]);

  const submitFeedback = async (index, feedbackType, correctionNote = '') => {
    if (!canRefresh || submittingIndex !== null) return;
    setSubmittingIndex(index);
    try {
      await onActionFeedback(index, feedbackType, correctionNote);
      if (feedbackType === 'corrected') {
        setCorrectionIndex(null);
        setNote('');
      }
    } finally {
      setSubmittingIndex(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[#e5e8ed] bg-white p-4 sm:p-5" aria-labelledby="service-guidance-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600">{copy.eyebrow}</p>
          <h2 id="service-guidance-title" className="mt-1 text-base font-bold text-[#18202b]">{copy.title}</h2>
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 rounded-lg border border-[#d9dde4] px-3 py-2 text-xs font-bold text-[#394455] hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {state === 'failed' ? copy.retry : copy.refresh}
          </button>
        )}
      </div>

      <div className="mt-4" aria-live="polite">
        {showPreparing && (
          <div className="rounded-xl bg-[#f7f8fa] p-4">
            <p className="text-sm leading-6 text-[#697386]">{copy.preparing}</p>
            <div className="mt-3 space-y-2" aria-hidden="true">
              <div className="h-2.5 animate-pulse rounded-full bg-[#dfe3e9]" />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[#e8ebef]" />
            </div>
            {pollingExpired && <p className="mt-3 text-xs leading-5 text-amber-800">{copy.delayed}</p>}
          </div>
        )}

        {state === 'failed' && !hasGuidance && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
            {copy.failed}
          </p>
        )}

        {!showPreparing && state !== 'failed' && !hasGuidance && (
          <p className="rounded-xl bg-[#f7f8fa] px-3 py-3 text-sm leading-6 text-[#697386]">{copy.noGuidance}</p>
        )}

        {hasGuidance && (
          <div className="space-y-5">
            {(state === 'stale' || state === 'generating') && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                {copy.stale}
              </p>
            )}
            {state === 'failed' && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                {copy.failed}
              </p>
            )}
            {!canRefresh && (
              <p className="rounded-xl bg-[#f7f8fa] px-3 py-2 text-xs leading-5 text-[#697386]">{copy.readOnly}</p>
            )}

            <div className="border-l-2 border-orange-500 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${PRIORITY_STYLES[guidance.risk_level] || PRIORITY_STYLES.low}`}>
                  {copy.priorities[guidance.risk_level] || copy.priorities.low}
                </span>
                {generatedLabel && <span className="text-[11px] text-[#7c8798]">{copy.generated} {generatedLabel}</span>}
              </div>
              <p className="mt-2 text-[15px] font-bold leading-6 text-[#263140]">{guidance.headline}</p>
            </div>

            {observations.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#7c8798]">{copy.observations}</h3>
                <ul className="mt-2 space-y-2">
                  {observations.map((observation, index) => (
                    <li key={`${observation.detail}-${index}`} className="flex gap-2 text-sm leading-5 text-[#4b5667]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-hidden="true" />
                      <span>{observation.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actions.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#7c8798]">{copy.actions}</h3>
                <ol className="mt-2 space-y-3">
                  {actions.map((action, index) => {
                    const isCorrecting = correctionIndex === index;
                    const isSubmitting = submittingIndex === index;
                    return (
                      <li key={`${action.action}-${index}`} className="rounded-xl border border-[#e5e8ed] p-3">
                        <div className="flex gap-3">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#18202b] text-[11px] font-black text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-5 text-[#263140]">{action.action}</p>
                            {action.rationale && (
                              <p className="mt-1 text-xs leading-5 text-[#697386]">
                                <span className="font-bold">{copy.rationale}: </span>{action.rationale}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!canRefresh || submittingIndex !== null}
                            onClick={() => submitFeedback(index, 'accepted')}
                            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-45"
                          >
                            {isSubmitting ? copy.saving : copy.use}
                          </button>
                          <button
                            type="button"
                            disabled={!canRefresh || submittingIndex !== null}
                            onClick={() => submitFeedback(index, 'ignored')}
                            className="rounded-lg border border-[#d9dde4] px-3 py-1.5 text-xs font-bold text-[#4b5667] hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-45"
                          >
                            {copy.ignore}
                          </button>
                          <button
                            type="button"
                            disabled={!canRefresh || submittingIndex !== null}
                            aria-expanded={isCorrecting}
                            onClick={() => {
                              setCorrectionIndex(index);
                              setNote('');
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#697386] hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-45"
                          >
                            {copy.correct}
                          </button>
                        </div>

                        {isCorrecting && (
                          <div className="mt-3 rounded-lg bg-[#f7f8fa] p-3">
                            <label htmlFor={`guidance-correction-${index}`} className="text-xs font-bold text-[#394455]">
                              {copy.correctionLabel}
                            </label>
                            <textarea
                              id={`guidance-correction-${index}`}
                              value={note}
                              maxLength={500}
                              rows={2}
                              onChange={(event) => setNote(event.target.value)}
                              placeholder={copy.correctionPlaceholder}
                              className="mt-2 w-full resize-y rounded-lg border border-[#cfd5de] bg-white px-3 py-2 text-sm text-[#263140] outline-none placeholder:text-[#929baa] focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isSubmitting || note.trim().length === 0}
                                onClick={() => submitFeedback(index, 'corrected', note.trim())}
                                className="rounded-lg bg-[#18202b] px-3 py-2 text-xs font-bold text-white hover:bg-[#263140] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {isSubmitting ? copy.saving : copy.submitCorrection}
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => {
                                  setCorrectionIndex(null);
                                  setNote('');
                                }}
                                className="rounded-lg px-3 py-2 text-xs font-bold text-[#697386] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                              >
                                {copy.cancel}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {questions.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#7c8798]">{copy.questions}</h3>
                <p className="mt-1 text-xs leading-5 text-[#7c8798]">{copy.draftOnly}</p>
                <ul className="mt-2 space-y-2">
                  {questions.map((question, index) => (
                    <li key={`${question.draft}-${index}`} className="rounded-xl bg-[#f7f8fa] p-3">
                      <p className="text-sm leading-5 text-[#394455]">{question.draft}</p>
                      <button
                        type="button"
                        onClick={() => onInsertQuestion(question)}
                        className="mt-2 rounded-lg border border-[#d9dde4] bg-white px-3 py-1.5 text-xs font-bold text-[#394455] hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                      >
                        {copy.insertDraft}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evidenceNeeded.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#7c8798]">{copy.evidence}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {evidenceNeeded.map((evidence) => (
                    <span key={evidence} className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-xs font-semibold text-[#596577]">
                      {String(evidence).replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
