const COPY = {
  en: {
    title: 'AI Service Readiness Review', itemsToConfirm: (count) => `${count} items to confirm`,
    open: 'Open review', close: 'Close review', update: 'Update analysis', retry: 'Retry analysis',
    preparing: 'Preparing the service review…', stale: 'New service evidence is available. Update when you are ready.',
    confirmed: 'Confirmed facts', gaps: 'Gaps to confirm', questions: 'Questions for customer',
    readiness: 'Service-mode readiness', insert: 'Insert into message',
    workOrder: 'Work order', workOrderMessage: 'Work-order message', customerAi: 'Prior customer AI conversation',
    mediaReview: 'Media attachments require a manual review by the engineer.',
    itemStates: { ready: 'Ready', missing: 'Missing', manual_review: 'Manual review' },
  },
  cn: {
    title: 'AI 服务前核查', itemsToConfirm: (count) => `待确认 ${count} 项`,
    open: '打开核查', close: '收起核查', update: '更新分析', retry: '重试分析',
    preparing: '正在准备服务前核查…', stale: '已有新的服务信息，请在需要时更新分析。',
    confirmed: '已确认信息', gaps: '待确认事项', questions: '建议向客户确认',
    readiness: '服务方式准备度', insert: '带入消息',
    workOrder: '工单', workOrderMessage: '工单消息', customerAi: '此前客户 AI 对话',
    mediaReview: '媒体附件需要工程师人工查看。',
    itemStates: { ready: '已就绪', missing: '缺失', manual_review: '需人工确认' },
  },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortByPriority(items = []) {
  return [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
  );
}

const actionClass = 'rounded-lg border border-[#e5e8ed] px-3 py-1.5 text-xs font-bold text-[#394455] hover:bg-[#f7f8fa]';
const primaryActionClass = 'rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600';

export function EngineerServiceReadinessCard({
  isCn, state, review, expanded, pollingExpired, canRefresh,
  onToggle, onRefresh, onInsertQuestion,
}) {
  const copy = isCn ? COPY.cn : COPY.en;
  const sourceLabels = {
    work_order: copy.workOrder,
    work_order_message: copy.workOrderMessage,
    customer_ai_conversation: copy.customerAi,
  };

  const facts = review?.confirmed_facts || [];
  const gaps = sortByPriority(review?.gaps || []);
  const questions = sortByPriority(review?.customer_questions || []);
  const modeReadiness = review?.service_mode_readiness || [];
  const confirmCount = gaps.length + questions.length;
  const topQuestion = questions[0] || null;
  const hasReview = Boolean(review);
  const showSkeleton = (state === 'missing' || state === 'generating') && !hasReview;
  const showRetryOnly = state === 'failed' && !hasReview;

  return (
    <section className="rounded-xl border border-[#e5e8ed] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{copy.title}</h2>
        {hasReview && (
          <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
            {copy.itemsToConfirm(confirmCount)}
          </span>
        )}
      </div>

      {showSkeleton && (
        <div className="mt-3">
          <p className="text-xs text-[#697386]">{copy.preparing}</p>
          <div className="mt-2 space-y-2" aria-hidden="true">
            <div className="h-3 animate-pulse rounded bg-[#eef1f5]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-[#eef1f5]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[#eef1f5]" />
          </div>
          {pollingExpired && canRefresh && (
            <button type="button" onClick={onRefresh} className={`mt-3 ${primaryActionClass}`}>{copy.retry}</button>
          )}
        </div>
      )}

      {showRetryOnly && canRefresh && (
        <div className="mt-3">
          <button type="button" onClick={onRefresh} className={primaryActionClass}>{copy.retry}</button>
        </div>
      )}

      {hasReview && (
        <>
          {state === 'stale' && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{copy.stale}</p>
          )}
          {topQuestion && (
            <p className="mt-3 text-sm leading-6 text-[#394455]">{topQuestion.draft}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onToggle} className={actionClass} aria-expanded={expanded}>
              {expanded ? copy.close : copy.open}
            </button>
            {canRefresh && (
              <button type="button" onClick={onRefresh} className={state === 'failed' ? primaryActionClass : actionClass}>
                {state === 'failed' ? copy.retry : copy.update}
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-4 space-y-4 border-t border-[#eef1f5] pt-4">
              {facts.length > 0 && (
                <section>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#929baa]">{copy.confirmed}</h3>
                  <ul className="mt-2 space-y-2">
                    {facts.map((fact, index) => (
                      <li key={`${fact.label}-${index}`} className="text-sm leading-6 text-[#394455]">
                        <span className="font-semibold">{fact.label}</span>
                        {fact.detail && <span> — {fact.detail}</span>}
                        {sourceLabels[fact.source] && (
                          <span className="ml-1 text-xs text-[#929baa]">· {sourceLabels[fact.source]}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {gaps.length > 0 && (
                <section>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#929baa]">{copy.gaps}</h3>
                  <ul className="mt-2 space-y-2">
                    {gaps.map((gap, index) => (
                      <li key={`${gap.category}-${index}`} className="text-sm leading-6 text-[#394455]">
                        <span className="font-semibold">{gap.category}</span>
                        {gap.detail && <span> — {gap.detail}</span>}
                        {gap.why_it_matters && (
                          <span className="block text-xs text-[#697386]">{gap.why_it_matters}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {questions.length > 0 && (
                <section>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#929baa]">{copy.questions}</h3>
                  <ul className="mt-2 space-y-2">
                    {questions.map((question, index) => (
                      <li key={`${question.draft.slice(0, 24)}-${index}`} className="text-sm leading-6 text-[#394455]">
                        <p>{question.draft}</p>
                        <button
                          type="button"
                          onClick={() => onInsertQuestion(question)}
                          className="mt-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                        >
                          {copy.insert}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {modeReadiness.length > 0 && (
                <section>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#929baa]">{copy.readiness}</h3>
                  <ul className="mt-2 space-y-2">
                    {modeReadiness.map((item, index) => (
                      <li key={`${item.item}-${index}`} className="text-sm leading-6 text-[#394455]">
                        <span className="font-semibold">{item.item}</span>
                        <span className="ml-1 text-xs text-[#929baa]">
                          · {copy.itemStates[item.state] || item.state}
                        </span>
                        {item.detail && <span className="block text-xs text-[#697386]">{item.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {review.media_review_required && (
                <p className="text-xs leading-5 text-[#697386]">{copy.mediaReview}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
