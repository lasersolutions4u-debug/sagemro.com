import { useState } from 'react';
import { LayoutDashboard, Users, FileText, Star, LogOut } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { RatingsPage } from './pages/RatingsPage';

const NAV_ITEMS = [
  { key: 'dashboard', label: '数据概览', icon: LayoutDashboard },
  { key: 'users', label: '用户管理', icon: Users },
  { key: 'workorders', label: '工单管理', icon: FileText },
  { key: 'ratings', label: '评价管理', icon: Star },
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
      case 'workorders': return <WorkOrdersPage />;
      case 'ratings': return <RatingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex">
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
          <div className="text-base font-semibold text-[var(--color-primary)]">SAGEMRO</div>
          <div className="text-xs text-[var(--color-text-muted)]">管理后台</div>
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
              <span className="text-white text-xs font-medium">管</span>
            </div>
            <span className="truncate">{user.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)] transition-colors"
          >
            <LogOut size={16} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-medium">SAGEMRO 管理后台</span>
        </div>

        <div className="p-6 max-w-6xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
