import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenText, ClipboardCheck, LayoutDashboard, LogOut, Menu, ShieldCheck, Users } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { useAdminLocale } from './config/locale';
import { runtimeConfig } from './config/runtime';
import { BrandMark } from './components/BrandMark';
import { LanguageSwitch } from './components/LanguageSwitch';
import { adminLogout, changeAdminPassword, restoreAdminSession } from './services/api';

// 后台已裁剪为「知识库中枢」：登录 / 注册用户统计 / 注册用户管理 / 知识库 / 知识候选 / 内部员工账号。
// 工单、物料、报价、商务、推广分析、评价、工程师等页面已随业务下线移除，不要在导航里恢复。
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then(({ DashboardPage }) => ({ default: DashboardPage })));
const UsersPage = lazy(() => import('./pages/UsersPage.jsx').then(({ UsersPage }) => ({ default: UsersPage })));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage.jsx').then(({ KnowledgePage }) => ({ default: KnowledgePage })));
const KnowledgeCandidatesPage = lazy(() => import('./pages/KnowledgeCandidatesPage.jsx').then(({ KnowledgeCandidatesPage }) => ({ default: KnowledgeCandidatesPage })));
const StaffAccountsPage = lazy(() => import('./pages/StaffAccountsPage.jsx').then(({ StaffAccountsPage }) => ({ default: StaffAccountsPage })));

const TEXT = {
  en: {
    subtitle: 'Knowledge Console',
    mobileTitle: 'SAGEMRO Knowledge Console',
    adminInitial: 'A',
    logout: 'Sign out',
    nav: {
      dashboard: 'User Statistics',
      users: 'Registered Users',
      knowledge: 'Knowledge Base',
      knowledgeCandidates: 'Knowledge Candidates',
      staffAccounts: 'Internal Staff',
    },
  },
  'zh-CN': {
    subtitle: '知识中枢',
    mobileTitle: 'SAGEMRO 知识中枢',
    adminInitial: '管',
    logout: '退出登录',
    nav: {
      dashboard: '用户统计',
      users: '注册用户',
      knowledge: '知识库',
      knowledgeCandidates: '知识候选',
      staffAccounts: '内部员工账号',
    },
  },
};

const getNavItems = (t) => [
  { key: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
  { key: 'users', label: t.nav.users, icon: Users },
  { key: 'knowledge', label: t.nav.knowledge, icon: BookOpenText },
  { key: 'knowledgeCandidates', label: t.nav.knowledgeCandidates, icon: ClipboardCheck },
  { key: 'staffAccounts', label: t.nav.staffAccounts, icon: ShieldCheck },
];

const BUSINESS_ROLES = ['business_director', 'business_manager', 'business_specialist'];

function normalizeAdminUser(user) {
  if (!user) return user;
  return {
    ...user,
    staffRole: user.staffRole || 'admin',
    staffId: user.staffId ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

function AdminFrame({ children, onMenuToggle, sidebarOpen }) {
  const locale = useAdminLocale();
  if (runtimeConfig.market !== 'com') return children;
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 lg:px-5">
        {onMenuToggle && (
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onMenuToggle} title={locale === 'zh-CN' ? '菜单' : 'Menu'} aria-label={locale === 'zh-CN' ? '菜单' : 'Menu'} aria-expanded={sidebarOpen} aria-controls="admin-sidebar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] lg:hidden"><Menu size={22} /></button>
            <BrandMark className="h-10 w-10 shrink-0 rounded-full shadow-sm" />
            <div className="min-w-0">
              <div className="text-base font-semibold text-[var(--color-primary)]">SAGEMRO</div>
              <div className="truncate text-xs text-[var(--color-text-muted)]">{TEXT[locale]?.subtitle || TEXT.en.subtitle}</div>
            </div>
          </div>
        )}
        <LanguageSwitch className="ml-auto shrink-0" />
      </header>
      <div className="pt-14 [&_.fixed.inset-0]:top-14">{children}</div>
    </>
  );
}

function AdminPageLoading() {
  const locale = useAdminLocale();
  return (
    <div className="space-y-4" aria-busy="true" aria-label={locale === 'zh-CN' ? '正在加载页面' : 'Loading page'}>
      <div className="h-8 w-52 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
      <div className="h-48 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
    </div>
  );
}

function MandatoryPasswordChange({ user, onChanged }) {
  const locale = useAdminLocale();
  const isCn = locale === 'zh-CN';
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
        <div className="flex items-center gap-3"><BrandMark className="h-10 w-10 rounded-full" /><div><h1 className="font-semibold">{isCn ? '修改临时密码' : 'Change temporary password'}</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{isCn ? '完成修改后才能进入知识中枢。' : 'Change your password before entering the knowledge console.'}</p></div></div>
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
  const locale = useAdminLocale();
  const t = TEXT[locale] || TEXT.en;
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const sessionRestore = useRef(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    const isBootstrapAdmin = user.staffRole === 'admin' && user.staffId == null;
    // 非 admin 的内部员工（商务 / 运营 / 仓储 / 采购）与商务角色一样，只保留知识库上传与维护。
    if (user.staffRole !== 'admin') return getNavItems(t).filter((item) => item.key === 'knowledge');
    return getNavItems(t).filter((item) => {
      if (item.key === 'staffAccounts') return isBootstrapAdmin;
      return true;
    });
  }, [user, t]);

  useEffect(() => {
    let active = true;
    sessionRestore.current ??= restoreAdminSession();
    sessionRestore.current
      .then((session) => {
        if (!active) return;
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
        if (!active) return;
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_csrf_token');
        setUser(null);
      })
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user && !visibleNavItems.some((item) => item.key === activePage)) {
      setActivePage(visibleNavItems[0]?.key || 'knowledge');
    }
  }, [activePage, user, visibleNavItems]);

  useEffect(() => {
    const clearSwitchedSession = (event) => {
      if (event.key !== 'admin_user' || !user) return;
      try {
        const next = JSON.parse(event.newValue);
        if (next?.id === user.id && next?.staffId === user.staffId && next?.staffRole === user.staffRole) return;
      } catch { /* Invalid cached identity cannot retain the console. */ }
      setUser(null);
      setActivePage('dashboard');
    };
    window.addEventListener('storage', clearSwitchedSession);
    return () => window.removeEventListener('storage', clearSwitchedSession);
  }, [user]);

  if (window.location.pathname !== '/') {
    const isCn = locale === 'zh-CN';
    return (
      <AdminFrame>
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 text-[var(--color-text-primary)]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">404</div>
          <h1 className="mt-3 text-2xl font-semibold">{isCn ? '页面不存在' : 'Page not found'}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            {isCn ? '你访问的页面不存在，或者链接已经失效。' : 'The page you requested does not exist or the link has expired.'}
          </p>
          <a href="/" className="mt-6 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">
            {isCn ? '返回知识中枢' : 'Back to Knowledge Console'}
          </a>
        </div>
      </main>
      </AdminFrame>
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
    return <AdminFrame><div className="min-h-screen bg-[var(--color-bg)]" aria-busy="true" /></AdminFrame>;
  }

  if (!user) {
    return <AdminFrame><LoginPage onLogin={handleLogin} /></AdminFrame>;
  }

  if (user.mustChangePassword) {
    return <AdminFrame><MandatoryPasswordChange user={user} onChanged={setUser} /></AdminFrame>;
  }

  const isBootstrapAdmin = user.staffRole === 'admin' && user.staffId == null;
  const currentPage = visibleNavItems.some((item) => item.key === activePage) ? activePage : visibleNavItems[0]?.key || 'knowledge';

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'users': return <UsersPage />;
      case 'knowledge': return <KnowledgePage />;
      case 'knowledgeCandidates': return <KnowledgeCandidatesPage />;
      case 'staffAccounts': return isBootstrapAdmin ? <StaffAccountsPage /> : <DashboardPage />;
      default: return <KnowledgePage />;
    }
  };

  return (
    <AdminFrame onMenuToggle={() => setSidebarOpen((open) => !open)} sidebarOpen={sidebarOpen}>
    <div className={`flex bg-[var(--color-bg)] ${runtimeConfig.market === 'com' ? 'min-h-[calc(100dvh-3.5rem)]' : 'min-h-screen'}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside id="admin-sidebar" className={`
        fixed lg:static z-40 w-60 shrink-0 flex flex-col ${runtimeConfig.market === 'com' ? 'top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto' : 'h-screen'}
        bg-[var(--color-surface)] border-r border-[var(--color-border)]
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {runtimeConfig.market !== 'com' && <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10 shrink-0 rounded-full shadow-sm" />
            <div>
              <div className="text-base font-semibold text-[var(--color-primary)]">SAGEMRO</div>
              <div className="text-xs text-[var(--color-text-muted)]">{t.subtitle}</div>
            </div>
          </div>
        </div>}

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
        {runtimeConfig.market !== 'com' && <div className="sticky top-0 z-20 lg:hidden flex items-center gap-3 px-3 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} title={locale === 'zh-CN' ? '菜单' : 'Menu'} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)]"><Menu size={22} /></button>
          <BrandMark className="h-8 w-8 shrink-0 rounded-full" />
          <span className="min-w-0 truncate pr-20 text-sm font-medium">{t.mobileTitle}</span>
        </div>}

        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-5 lg:p-6">
          <Suspense fallback={<AdminPageLoading />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>
    </div>
    </AdminFrame>
  );
}
