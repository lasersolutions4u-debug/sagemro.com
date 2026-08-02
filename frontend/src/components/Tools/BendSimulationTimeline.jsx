import { useEffect, useRef } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { clampTimelineFrame, shouldPauseTimeline } from '../../utils/bendSimulationTimeline';

export function BendSimulationTimeline({ frames = [], activeFrame = 0, playing = false, simulationId, onFrameChange, onTogglePlay, onStep }) {
  const previousSimulation = useRef({ frames, simulationId });
  const safeActiveFrame = clampTimelineFrame(activeFrame, frames);
  const lastFrame = Math.max(0, frames.length - 1);
  const frame = frames[safeActiveFrame];
  const frameLabel = frame?.activeBendOrder ? `Bend ${frame.activeBendOrder}` : safeActiveFrame === lastFrame ? 'Complete' : 'Start';

  useEffect(() => {
    if (shouldPauseTimeline({
      previousFrames: previousSimulation.current.frames,
      previousSimulationId: previousSimulation.current.simulationId,
      frames,
      simulationId,
      playing,
    })) onTogglePlay?.(false);
    previousSimulation.current = { frames, simulationId };
  }, [frames, simulationId, playing, onTogglePlay]);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4" aria-label="规划动画 Plan animation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">规划动画</div><h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">Plan animation</h2></div>
        <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">{frameLabel}</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => onStep?.(-1)} disabled={safeActiveFrame === 0} aria-label="Previous frame" className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-primary)] disabled:opacity-40"><SkipBack size={18} /></button>
        <button type="button" onClick={() => onTogglePlay?.(!playing)} disabled={frames.length < 2} aria-label={playing ? 'Pause animation' : 'Play animation'} className="rounded-lg bg-[var(--color-primary)] p-2 text-white disabled:opacity-40">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" onClick={() => onStep?.(1)} disabled={safeActiveFrame === lastFrame} aria-label="Next frame" className="rounded-lg border border-[var(--color-border)] p-2 text-[var(--color-text-primary)] disabled:opacity-40"><SkipForward size={18} /></button>
        <input type="range" min="0" max={lastFrame} step="1" value={safeActiveFrame} onChange={(event) => onFrameChange?.(Number(event.target.value))} aria-label="Bend plan frame" className="min-w-0 flex-1 accent-[var(--color-primary)]" />
      </div>
      <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-2" aria-label="Bend sequence">
        {frames.map((item, index) => <li key={`${item.step}-${index}`} className={`rounded-md border px-2 py-1.5 text-center text-xs ${index === safeActiveFrame ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>{item.activeBendOrder ? `Bend ${item.activeBendOrder}` : index === lastFrame ? 'End' : 'Start'}</li>)}
      </ol>
    </section>
  );
}
