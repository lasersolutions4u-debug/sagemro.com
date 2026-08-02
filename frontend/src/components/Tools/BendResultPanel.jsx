import { AlertTriangle, CheckCircle2, CircleX, Send } from 'lucide-react';
import { getBendCatalogLabel, localizeBendWarnings } from '../../utils/bendSimulationPresentation';

const COPY = {
  en: {
    title: 'Bend plan result', recommendation: 'Recommendation', recommendedUpper: 'Recommended upper tool', selectedUpper: 'Selected upper tool', recommendedV: 'Recommended V die', selectedV: 'Selected V die',
    tonnage: 'Tonnage', required: 'Required (with safety factor)', margin: 'Machine margin', bendAllowance: 'Bend allowance', flatLength: 'Flat length',
    warnings: 'Planning warnings', clear: 'No planning warnings detected.', disclaimer: 'Planning estimate — engineer review required before production.', review: 'Request engineer review',
  },
  zh: {
    title: '折弯方案结果', recommendation: '推荐方案', recommendedUpper: '推荐上模', selectedUpper: '已选上模', recommendedV: '推荐 V 槽', selectedV: '已选 V 槽',
    tonnage: '吨位', required: '需求吨位（含安全系数）', margin: '设备余量', bendAllowance: '折弯系数', flatLength: '展开长度',
    warnings: '规划提示', clear: '未发现规划预警。', disclaimer: '规划估算，生产前需工程复核。', review: '申请工程师复核',
  },
};

function isChinese(locale) {
  return locale === 'zh' || locale === 'zh-CN';
}

function formatMillimeters(value) {
  return `${Number(value || 0).toFixed(2)} mm`;
}

function marginStatus(result) {
  if (result.machine.marginTons < 0) return { Icon: CircleX, className: 'border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]' };
  if (result.machine.marginPercent < 10) return { Icon: AlertTriangle, className: 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]' };
  return { Icon: CheckCircle2, className: 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]' };
}

export function BendResultPanel({ result, locale = 'en', onRequestReview }) {
  const copy = isChinese(locale) ? COPY.zh : COPY.en;

  if (!result) {
    return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5" aria-label={copy.title}><p className="text-sm text-[var(--color-text-secondary)]">{isChinese(locale) ? '请输入有效折弯参数以生成规划结果。' : 'Enter a valid bend profile to generate a planning result.'}</p></section>;
  }

  const status = marginStatus(result);
  const StatusIcon = status.Icon;
  const isToolMatch = result.tooling.isVMatch;
  const warnings = localizeBendWarnings(result.warnings, locale);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5" aria-label={copy.title}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.title}</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{getBendCatalogLabel(result.input.material, locale)} · {result.segments.length} {isChinese(locale) ? '道折弯' : result.segments.length === 1 ? 'bend' : 'bends'}</p></div>
        <StatusIcon size={20} className={status.className.split(' ').at(-1)} aria-hidden="true" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.recommendation}</h3>
        <dl className="mt-3 grid gap-3 text-sm">
          <div><dt className="text-[var(--color-text-muted)]">{copy.recommendedUpper}</dt><dd className="font-medium text-[var(--color-text-primary)]">{getBendCatalogLabel(result.tooling.recommendedUpperTool, locale)}</dd></div>
          <div><dt className="text-[var(--color-text-muted)]">{copy.selectedUpper}</dt><dd className="font-medium text-[var(--color-text-primary)]">{getBendCatalogLabel(result.tooling.selectedUpperTool, locale)}</dd></div>
          <div><dt className="text-[var(--color-text-muted)]">{copy.recommendedV}</dt><dd className="font-medium text-[var(--color-text-primary)]">{getBendCatalogLabel(result.tooling.recommendedLowerTool, locale)}</dd></div>
          <div className={isToolMatch ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}><dt>{copy.selectedV}</dt><dd className="font-medium">{getBendCatalogLabel(result.tooling.selectedLowerTool, locale)}</dd></div>
        </dl>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label={copy.tonnage} value={`${result.tonnage.withSafetyTons.toFixed(2)} t`} detail={copy.required} />
        <Metric label={copy.margin} value={`${result.machine.marginTons.toFixed(2)} t`} detail={`${result.machine.marginPercent.toFixed(1)}% · ${result.machine.label}`} className={status.className} />
        <Metric label={copy.bendAllowance} value={formatMillimeters(result.totalBendAllowanceMm)} />
        <Metric label={copy.flatLength} value={formatMillimeters(result.flatLengthMm)} />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-3 text-sm text-[var(--color-text-primary)]">
        <h3 className="font-semibold">{copy.warnings}</h3>
        {warnings.length > 0 ? <ul className="mt-2 space-y-1 text-[var(--color-text-secondary)]">{warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul> : <p className="mt-2 text-[var(--color-text-secondary)]">{copy.clear}</p>}
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--color-text-secondary)]">{copy.disclaimer}</p>
      <button type="button" onClick={onRequestReview} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white"><Send size={16} />{copy.review}</button>
    </section>
  );
}

function Metric({ label, value, detail, className = '' }) {
  return <div className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${className}`}><span className="block text-xs text-[var(--color-text-muted)]">{label}</span><strong className="mt-1 block text-base text-[var(--color-text-primary)]">{value}</strong>{detail && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{detail}</span>}</div>;
}
