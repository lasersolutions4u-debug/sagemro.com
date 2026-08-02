import { ArrowLeft, Calculator } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark } from '../common/BrandMark';
import { Footer } from '../common/Footer';
import { Modal } from '../common/Modal';
import { BendProfileEditor } from './BendProfileEditor';
import { BendResultPanel } from './BendResultPanel';
import { BendSimulationTimeline } from './BendSimulationTimeline';
import { BendSimulationViewport } from './BendSimulationViewport';
import { submitBendSimulationReview, trackFunnelEvent } from '../../services/api';
import { applyBendSimulatorEditorChange, buildBendSimulatorWorkspaceState, toBendSimulatorEditorInput } from '../../utils/bendSimulatorPageState';

const INITIAL_INPUT = {
  unitSystem: 'metric', material: 'carbon_steel', thicknessMm: 3, sheetWidthMm: 1000, machine: 'shop-100', upperTool: 'standard-punch', lowerTool: 'v-die-24',
  segments: [{ lengthMm: 100, angleDeg: 90, insideRadiusMm: 3, order: 1 }, { lengthMm: 80, angleDeg: 120, insideRadiusMm: 3, order: 2 }],
};

const REVIEW_COPY = {
  en: { title: 'Request engineer review', intro: 'Share your contact details and this bend-plan summary. Do not include drawings, files, passwords, or other secrets.', name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', submit: 'Send review request', sending: 'Sending…', close: 'Close', success: 'Your request was sent for review.', failed: 'We could not send the request. Please try again.' },
  zh: { title: '申请工程师复核', intro: '提交联系方式和折弯方案摘要。请勿填写图纸、文件、密码或其他敏感信息。', name: '姓名', company: '公司', email: '邮箱', phone: '电话', submit: '发送复核申请', sending: '发送中…', close: '关闭', success: '复核申请已发送。', failed: '暂时无法发送申请，请稍后重试。' },
};

function isChinese(locale) {
  return locale === 'zh' || locale === 'zh-CN';
}

export function BendSimulatorPage({ tool, copy, onOpenLegal, locale = 'en' }) {
  const isCn = isChinese(locale);
  const reviewCopy = isCn ? REVIEW_COPY.zh : REVIEW_COPY.en;
  const [input, setInput] = useState(() => toBendSimulatorEditorInput(INITIAL_INPUT));
  const [activeFrame, setActiveFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState('2d');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [reviewStatus, setReviewStatus] = useState('idle');
  const completedSimulation = useRef('');
  const startedProperties = useRef({ material: input.material, bend_count: input.segments.length, unit_system: input.unitSystem });
  const workspace = useMemo(() => buildBendSimulatorWorkspaceState({ input, activeFrame, playing, viewMode }), [input, activeFrame, playing, viewMode]);
  const { result, simulationId } = workspace;

  useEffect(() => {
    trackFunnelEvent('bend_simulator_started', startedProperties.current);
  }, []);

  useEffect(() => {
    if (!playing || activeFrame >= result.frames.length - 1) return undefined;
    const timer = window.setInterval(() => setActiveFrame((frame) => Math.min(frame + 1, result.frames.length - 1)), 900);
    return () => window.clearInterval(timer);
  }, [activeFrame, playing, result.frames.length]);

  useEffect(() => {
    if (activeFrame < result.frames.length - 1 || completedSimulation.current === simulationId) return;
    completedSimulation.current = simulationId;
    setPlaying(false);
    trackFunnelEvent('bend_simulator_completed', { material: input.material, bend_count: input.segments.length, view_mode: viewMode });
  }, [activeFrame, input, result.frames.length, simulationId, viewMode]);

  const handleInputChange = (nextValue) => {
    const nextState = applyBendSimulatorEditorChange(workspace, nextValue);
    if (nextState.segmentAdjusted) {
      trackFunnelEvent('bend_simulator_segment_adjusted', { previous_bend_count: input.segments.length, bend_count: nextState.input.segments.length });
    }
    setInput(nextState.input);
    setActiveFrame(nextState.activeFrame);
    setPlaying(nextState.playing);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewStatus('sending');
    try {
      await submitBendSimulationReview({ contact, simulation: result });
      setReviewStatus('success');
    } catch {
      setReviewStatus('failed');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <BrandMark variant="logo" className="h-8 w-8 object-contain" />
            SAGEMRO
          </a>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <a href="/tools" className="hover:text-[var(--color-primary)]">{copy.navTools}</a>
            <a href="/" className="hover:text-[var(--color-primary)]">{copy.navChat}</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <a href="/tools" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft size={16} />
          {copy.allTools}
        </a>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#263238] bg-[#111820] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            <Calculator size={14} className="text-[var(--color-primary)]" />
            {copy.detailEyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.08] text-[var(--color-text-primary)] sm:text-[2.75rem]">{tool.seoTitle}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">{tool.guideBody}</p>
          <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">{isCn ? '规划估算，生产前需工程复核。' : 'Planning estimate — engineer review required before production.'}</p>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(17rem,.8fr)]">
          <div className="order-1"><BendProfileEditor value={workspace.input} locale={locale} onChange={handleInputChange} onRequestReview={() => setReviewOpen(true)} /></div>
          <div className="order-2 space-y-5"><BendSimulationViewport {...workspace.viewport} onViewModeChange={setViewMode} locale={locale} /><BendSimulationTimeline {...workspace.timeline} onFrameChange={setActiveFrame} onTogglePlay={setPlaying} onStep={(direction) => setActiveFrame((frame) => Math.max(0, Math.min(result.frames.length - 1, frame + direction)))} /></div>
          <div className="order-3"><BendResultPanel {...workspace.resultPanel} locale={locale} onRequestReview={() => setReviewOpen(true)} /></div>
        </div>
      </main>

      <Footer onOpenLegal={onOpenLegal} />
      <Modal isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title={reviewCopy.title}>
        <form className="space-y-4" onSubmit={handleReviewSubmit}>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{reviewCopy.intro}</p>
          {['name', 'company', 'email', 'phone'].map((field) => <label key={field} className="grid gap-1.5 text-sm font-medium text-[var(--color-text-primary)]"><span>{reviewCopy[field]}</span><input type={field === 'email' ? 'email' : 'text'} value={contact[field]} onChange={(event) => setContact((current) => ({ ...current, [field]: event.target.value }))} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]" /></label>)}
          {reviewStatus === 'success' && <p role="status" className="text-sm text-[var(--color-success)]">{reviewCopy.success}</p>}
          {reviewStatus === 'failed' && <p role="alert" className="text-sm text-[var(--color-error)]">{reviewCopy.failed}</p>}
          <div className="flex gap-3"><button type="button" onClick={() => setReviewOpen(false)} className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold text-[var(--color-text-primary)]">{reviewCopy.close}</button><button type="submit" disabled={reviewStatus === 'sending'} className="min-h-10 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50">{reviewStatus === 'sending' ? reviewCopy.sending : reviewCopy.submit}</button></div>
        </form>
      </Modal>
    </div>
  );
}
