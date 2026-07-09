import { useState } from 'react';
import { Boxes, ClipboardList, LayoutDashboard, Users, UserCog, FileText, Star, LogOut, Target } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { EngineersPage } from './pages/EngineersPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { RatingsPage } from './pages/RatingsPage';
import { LeadsPage } from './pages/LeadsPage';
import { EngineerApplicationsPage } from './pages/EngineerApplicationsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { runtimeConfig } from './config/runtime';
import { BrandMark } from './components/BrandMark';

const TEXT = {
  en: {
    subtitle: 'Operations Console',
    mobileTitle: 'SAGEMRO Operations Console',
    adminInitial: 'A',
    logout: 'Sign out',
    nav: {
      dashboard: 'Operations Dashboard',
      leads: 'Lead Inbox',
      workorders: 'Service Orders',
      engineerApplications: 'Engineer Applications',
      materials: 'Material Master',
      engineers: 'Engineers',
      users: 'Customers',
      ratings: 'Service Reviews',
    },
  },
  'zh-CN': {
    subtitle: '运营中枢',
    mobileTitle: 'SAGEMRO 运营中枢',
    adminInitial: '管',
    logout: '退出登录',
    nav: {
      dashboard: '运营驾驶舱',
      leads: '线索池',
      workorders: '派工与服务质量',
      engineerApplications: '工程师申请审核',
      materials: '物料管理',
      users: '客户与工程师',
      ratings: '评价管理',
    },
  },
};

const t = TEXT[runtimeConfig.locale] || TEXT.en;

const NAV_ITEMS = [
  { key: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
  { key: 'leads', label: t.nav.leads, icon: Target },
  { key: 'workorders', label: t.nav.workorders, icon: FileText },
  { key: 'materials', label: t.nav.materials, icon: Boxes },
  { key: 'engineerApplications', label: t.nav.engineerApplications, icon: ClipboardList },
  { key: 'engineers', label: t.nav.engineers || 'Engineers', icon: UserCog },
  { key: 'users', label: t.nav.users, icon: Users },
  { key: 'ratings', label: t.nav.ratings, icon: Star },
];

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />;
      case 'users': return <UsersPage />;
      case 'engineers': return <EngineersPage />;
      case 'workorders': return <WorkOrdersPage />;
      case 'materials': return <MaterialsPage />;
      case 'engineerApplications': return <EngineerApplicationsPage />;
      case 'ratings': return <RatingsPage />;
      case 'leads': return <LeadsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static z-40 w-60 h-screen flex flex-col
        bg-[var(--color-surface)] border-r border-[var(--color-border)]
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10 shrink-0 rounded-full shadow-sm" />
            <div>
              <div className="text-base font-semibold text-[var(--color-primary)]">SAGEMRO</div>
              <div className="text-xs text-[var(--color-text-muted)]">{t.subtitle}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActivePage(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activePage === item.key
                  ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
            <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">{t.adminInitial}</span>
            </div>
            <span className="truncate">{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)] transition-colors"
          >
            <LogOut size={16} />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="sticky top-0 z-20 lg:hidden flex items-center gap-3 px-3 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <BrandMark className="h-8 w-8 shrink-0 rounded-full" />
          <span className="min-w-0 truncate text-sm font-medium">{t.mobileTitle}</span>
        </div>

        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5 lg:p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
