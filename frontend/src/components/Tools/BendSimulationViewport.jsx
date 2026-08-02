import { Maximize, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import {
  buildFlatPath,
  buildFormedPath,
  buildPseudo3DProjection,
  buildToolGeometry,
} from '../../utils/bendSimulationRenderer';

const COPY = {
  en: {
    title: 'Bend viewport', flat: 'Flat pattern', formed: 'Formed path', twoDimensional: '2D view', threeDimensional: '3D view',
    fit: 'Fit viewport', fitted: 'Viewport fit to material', machine: 'Machine', upperTool: 'Upper tool', lowerTool: 'Lower tool', material: 'Material sheet',
    empty: 'No bend simulation is available yet. Add a valid bend profile to see the material and tooling.', active: 'Active bend', complete: 'Bend plan complete', start: 'Bend plan start',
  },
  zh: {
    title: '折弯视图', flat: '展开图', formed: '成型路径', twoDimensional: '二维视图', threeDimensional: '三维视图',
    fit: '适配视图', fitted: '视图已适配材料', machine: '折弯机', upperTool: '上模', lowerTool: '下模', material: '材料板材',
    empty: '暂无可用的折弯仿真。请添加有效的折弯工件以查看材料和模具。', active: '当前折弯', complete: '折弯计划完成', start: '折弯计划开始',
  },
};

function isChinese(locale) {
  return locale === 'zh' || locale === 'zh-CN';
}

function ActiveBendDescription({ description }) {
  return <p className="sr-only" aria-live="polite">{description}</p>;
}

export function BendSimulationViewport({ result, activeFrame = 0, viewMode = '2d', onViewModeChange, locale = 'en' }) {
  const copy = isChinese(locale) ? COPY.zh : COPY.en;
  const [fitRevision, setFitRevision] = useState(0);
  const hasResult = Array.isArray(result?.frames) && result.frames.length > 0 && Array.isArray(result?.flatPoints);

  if (!hasResult) {
    return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5" aria-label={copy.title}><p role="status" aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">{copy.empty}</p></section>;
  }

  const flat = buildFlatPath(result);
  const formed = buildFormedPath(result, activeFrame);
  const tooling = buildToolGeometry(result, activeFrame);
  const projection = buildPseudo3DProjection(result, activeFrame);
  const is3d = viewMode === '3d';
  const activeDescription = formed.activeBendOrder ? `${copy.active} ${formed.activeBendOrder}` : activeFrame === 0 ? copy.start : copy.complete;

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 sm:p-5" aria-label={copy.title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{copy.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{activeDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--color-border)] p-1" aria-label={copy.title}>
            <button type="button" onClick={() => onViewModeChange?.('2d')} aria-pressed={!is3d} className={`min-h-8 rounded-md px-3 text-xs font-semibold ${!is3d ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'}`}>{copy.twoDimensional}</button>
            <button type="button" onClick={() => onViewModeChange?.('3d')} aria-pressed={is3d} className={`min-h-8 rounded-md px-3 text-xs font-semibold ${is3d ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]'}`}>{copy.threeDimensional}</button>
          </div>
          <button type="button" onClick={() => setFitRevision((revision) => revision + 1)} aria-label="Fit viewport" title={copy.fit} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"><Maximize size={16} /><span className="hidden sm:inline">{copy.fit}</span></button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><span className="block text-[var(--color-text-muted)]">{copy.machine}</span><strong className="mt-1 block text-[var(--color-text-primary)]">{tooling.machineLabel}</strong></div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><span className="block text-[var(--color-text-muted)]">{copy.upperTool} / {copy.lowerTool}</span><strong className="mt-1 block text-[var(--color-text-primary)]">{tooling.upperToolLabel} · {tooling.lowerToolLabel}</strong></div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"><span className="block text-[var(--color-text-muted)]">{copy.material}</span><strong className="mt-1 block text-[var(--color-text-primary)]">{tooling.materialLabel}</strong></div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#111820] p-2">
        <svg key={fitRevision} viewBox={is3d ? projection.viewBox : formed.viewBox} className="h-64 w-full" role="img" aria-label={`${copy.title}: ${activeDescription}`}>
          {is3d ? (
            <g strokeLinejoin="round">
              {projection.sideFaces.map((face, index) => <polygon key={`${face}-${index}`} points={face} fill="#6f8494" stroke="#a7bac8" strokeWidth="1.5" />)}
              <polyline points={projection.back} fill="none" stroke="#9eb4c4" strokeWidth="5" opacity="0.72" />
              <polyline points={projection.front} fill="none" stroke="#e5edf2" strokeWidth="5" />
            </g>
          ) : (
            <g strokeLinejoin="round">
              <polyline points={flat.points} fill="none" stroke="#71808c" strokeDasharray="5 5" strokeWidth="2" aria-label={copy.flat} />
              <polyline points={formed.points} fill="none" stroke="#dce7ed" strokeWidth="5" aria-label={copy.formed} />
            </g>
          )}
          <polygon points={tooling.upperTool} fill="#5fa7d3" stroke="#b9dff5" strokeWidth="1.5" />
          <polygon points={tooling.lowerTool} fill="#426d89" stroke="#a6c9dd" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]"><span>{is3d ? copy.threeDimensional : copy.twoDimensional}</span><button type="button" onClick={() => setFitRevision((revision) => revision + 1)} className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]"><RotateCcw size={13} />{copy.fit}</button></div>
      <ActiveBendDescription description={activeDescription} />
    </section>
  );
}
