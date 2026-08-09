import { ChevronDown } from 'lucide-react';

export function WorkOrderDetailNav({ items, onNavigate }) {
  return (
    <nav aria-label={items.ariaLabel} className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:px-5">
      {items.links.map((item) => (
        <button key={item.key} type="button" onClick={() => onNavigate(item.key)} className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]">
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function WorkOrderDetailSection({ sectionKey, title, summary, open, onToggle, children }) {
  const sectionId = `work-order-section-${sectionKey}`;
  const contentId = `${sectionId}-content`;

  return (
    <section id={sectionId} className="scroll-mt-28 rounded-xl border border-[var(--color-border)]">
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={() => onToggle(sectionKey)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0 truncate whitespace-nowrap"><span className="font-medium">{title}</span>{summary && <span className="ml-2 hidden text-[var(--color-text-muted)] sm:inline">{summary}</span>}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={contentId} hidden={!open} className="border-t border-[var(--color-border)] p-4">{children}</div>
    </section>
  );
}
