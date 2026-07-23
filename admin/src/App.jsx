import { useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardList, LayoutDashboard, Users, UserCog, FileText, Star, LogOut, Target, BookOpenText, Menu, PackageSearch, ShieldCheck } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { EngineersPage } from './pages/EngineersPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { RatingsPage } from './pages/RatingsPage';
import { LeadsPage } from './pages/LeadsPage';
import { EngineerApplicationsPage } from './pages/EngineerApplicationsPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { MaterialRequisitionsPage } from './pages/MaterialRequisitionsPage';
import { StaffAccountsPage } from './pages/StaffAccountsPage';
import { runtimeConfig } from './config/runtime';
import { BrandMark } from './components/BrandMark';
import { adminLogout, changeAdminPassword, restoreAdminSession } from './services/api';

const TEXT = {
  en: {
    subtitle: 'Operations Console',
    mobileTitle: 'SAGEMRO Operations Console',
    adminInitial: 'A',
    logout: 'Sign out',
    nav: {
      dashboard: 'Operations Dashboard',
      leads: 'Machine Leads',
      workorders: 'Service Orders',
      engineerApplications: 'Engineer Applications',
      materials: 'Material Master',
      materialRequisitions: 'Material Requisitions',
      staffAccounts: 'Internal Staff',
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
      leads: '整机线索',
      workorders: '服务工单',
      engineerApplications: '工程师申请审核',
      materials: '物料管理',
      materialRequisitions: '物料领用申请',
      staffAccounts: '内部员工账号',
      users: '客户',
      ratings: '评价管理',
    },
  },
};

const t = TEXT[runtimeConfig.locale] || TEXT.en;

const NAV_ITEMS = [
  { key: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
  { key: 'leads', label: t.nav.leads, icon: Target },
  { key: 'knowledge', label: t.nav.knowledge || 'Knowledge Base', icon: BookOpenText },
  { key: 'workorders', label: t.nav.workorders, icon: FileText },
  { key: 'materials', label: t.nav.materials, icon: Boxes },
  { key: 'materialRequisitions', label: t.nav.materialRequisitions, icon: PackageSearch },
  { key: 'engineerApplications', label: t.nav.engineerApplications, icon: ClipboardList },
  { key: 'engineers', label: t.nav.engineers || 'Engineers', icon: UserCog },
  { key: 'users', label: t.nav.users, icon: Users },
  { key: 'ratings', label: t.nav.ratings, icon: Star },
  { key: 'staffAccounts', label: t.nav.staffAccounts, icon: ShieldCheck },
];

const REQUISITION_ROLES = ['admin', 'operations', 'warehouse', 'procurement'];
const OPERATIONAL_NAV_KEYS = new Set(['dashboard', 'materialRequisitions']);

function normalizeAdminUser(user) {
  if (!user) return user;
  return {
    ...user,
    staffRole: user.staffRole || 'admin',
    staffId: user.staffId ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

function MandatoryPasswordChange({ user, onChanged }) {
  const isCn = runtimeConfig.locale === 'zh-CN';
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(isCn ? '两次输入的新密码不一致' : 'New passwords do not match');
      return;
    }
    setPending(true);
    try {
      await changeAdminPassword(oldPassword, newPassword);
      const nextUser = { ...user, mustChangePassword: false };
      localStorage.setItem('admin_user', JSON.stringify(nextUser));
      onChanged(nextUser);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="flex items-center gap-3"><BrandMark className="h-10 w-10 rounded-full" /><div><h1 className="font-semibold">{isCn ? '修改临时密码' : 'Change temporary password'}</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{isCn ? '完成修改后才能进入运营中枢。' : 'Change your password before entering the operations console.'}</p></div></div>
        {error && <div className="mt-4 border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div className="mt-5 space-y-3">
          <div><label htmlFor="current-password" className="mb-1 block text-sm text-[var(--color-text-secondary)]">{isCn ? '当前临时密码' : 'Current temporary password'}</label><input id="current-password" type="password" autoComplete="current-password" required value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-3 text-sm" /></div>
          <div><label htmlFor="new-password" className="mb-1 block text-sm text-[var(--color-text-secondary)]">{isCn ? '新密码（至少 10 位）' : 'New password (10+ characters)'}</label><input id="new-password" type="password" autoComplete="new-password" required minLength="10" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-3 text-sm" /></div>
          <div><label htmlFor="confirm-password" className="mb-1 block text-sm text-[var(--color-text-secondary)]">{isCn ? '确认新密码' : 'Confirm new password'}</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength="10" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-3 text-sm" /></div>
        </div>
        <button type="submit" disabled={pending} className="mt-5 w-full whitespace-nowrap rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? (isCn ? '修改中...' : 'Changing...') : (isCn ? '修改密码并继续' : 'Change password and continue')}</button>
      </form>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    const isBootstrapAdmin = user.staffRole === 'admin' && user.staffId == null;
    const isOperationalStaff = user.staffId != null && user.staffRole !== 'admin';
    return NAV_ITEMS.filter((item) => {
      if (item.key === 'staffAccounts') return isBootstrapAdmin;
      if (item.key === 'materialRequisitions') return REQUISITION_ROLES.includes(user.staffRole);
      if (isOperationalStaff) return OPERATIONAL_NAV_KEYS.has(item.key);
      return true;
    });
  }, [user]);

  useEffect(() => {
    restoreAdminSession()
      .then((session) => {
        if (session.authenticated && session.userType === 'admin') {
          const restoredUser = normalizeAdminUser(session.user);
          localStorage.setItem('admin_user', JSON.stringify(restoredUser));
          setActivePage('dashboard');
          setUser(restoredUser);
        } else {
          localStorage.removeItem('admin_user');
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_csrf_token');
        setUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (user && !visibleNavItems.some((item) => item.key === activePage)) {
      setActivePage('dashboard');
    }
  }, [activePage, user, visibleNavItems]);

  if (window.location.pathname !== '/') {
    const isCn = runtimeConfig.locale === 'zh-CN';
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 text-[var(--color-text-primary)]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">404</div>
          <h1 className="mt-3 text-2xl font-semibold">{isCn ? '页面不存在' : 'Page not found'}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            {isCn ? '你访问的页面不存在，或者链接已经失效。' : 'The page you requested does not exist or the link has expired.'}
          </p>
          <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
            {isCn ? '返回管理后台' : 'Back to Admin'}
          </a>
        </div>
      </main>
    );
  }

  const handleLogout = () => {
    adminLogout().catch(() => {});
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setActivePage('dashboard');
    setUser(null);
  };

  const handleLogin = (nextUser) => {
    const normalizedUser = normalizeAdminUser(nextUser);
    localStorage.setItem('admin_user', JSON.stringify(normalizedUser));
    setActivePage('dashboard');
    setUser(normalizedUser);
  };

  if (!authReady) {
    return <div className="min-h-screen bg-[var(--color-bg)]" aria-busy="true" />;
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (user.mustChangePassword) {
    return <MandatoryPasswordChange user={user} onChanged={setUser} />;
  }

  const isBootstrapAdmin = user.staffRole === 'admin' && user.staffId == null;
  const currentPage = visibleNavItems.some((item) => item.key === activePage) ? activePage : 'dashboard';

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage staffRole={user.staffRole} staffId={user.staffId} />;
      case 'users': return <UsersPage />;
      case 'engineers': return <EngineersPage initialEngineerId={selectedEngineerId} onEngineerOpened={() => setSelectedEngineerId('')} />;
      case 'workorders': return <WorkOrdersPage />;
      case 'materials': return <MaterialsPage />;
      case 'materialRequisitions': return <MaterialRequisitionsPage staffRole={user.staffRole} />;
      case 'staffAccounts': return isBootstrapAdmin ? <StaffAccountsPage /> : <DashboardPage staffRole={user.staffRole} staffId={user.staffId} />;
      case 'knowledge': return <KnowledgePage />;
      case 'engineerApplications': return <EngineerApplicationsPage onOpenEngineer={(engineerId) => { setSelectedEngineerId(engineerId); setActivePage('engineers'); }} />;
      case 'ratings': return <RatingsPage />;
      case 'leads': return <LeadsPage />;
      default: return <DashboardPage staffRole={user.staffRole} staffId={user.staffId} />;
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
          {visibleNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { setActivePage(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                currentPage === item.key
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
          <button onClick={() => setSidebarOpen(true)} title="Menu" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)]"><Menu size={22} /></button>
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
