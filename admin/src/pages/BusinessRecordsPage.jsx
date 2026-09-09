import { useState } from 'react';
import { useAdminLocale } from '../config/locale';
import { BusinessWorkspacePage } from './BusinessWorkspacePage';

const BUSINESS_ROLES = ['business_director', 'business_manager', 'business_specialist'];
const RECORD_KINDS = ['customer', 'lead', 'work_order'];

export function BusinessRecordsPage({ user, kind, children }) {
  const locale = useAdminLocale();
  const [view, setView] = useState('management');
  const isCn = locale === 'zh-CN';
  if (!RECORD_KINDS.includes(kind)) return null;
  if (BUSINESS_ROLES.includes(user.staffRole)) return <BusinessWorkspacePage user={user} recordKind={kind} />;
  if (user.staffRole !== 'admin') return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label={isCn ? '记录视图' : 'Record view'}>
        {[
          ['management', isCn ? '记录管理' : 'Record management'],
          ['business', isCn ? '业务跟进' : 'Business follow-up'],
        ].map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-lg border px-3 py-2 text-sm ${view === value ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{label}</button>)}
      </div>
      {view === 'management' ? children : <BusinessWorkspacePage user={user} recordKind={kind} />}
    </div>
  );
}
