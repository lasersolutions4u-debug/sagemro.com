import {
  History,
  LogIn,
  LogOut,
  MessageSquarePlus,
  Send,
  User,
} from 'lucide-react';
import { BrandMark } from '../common/BrandMark';
import { isCnLocale } from '../../utils/locale';

// AI 门户的侧边栏。工单、设备、通知、工程师工作台入口已随业务下线，
// 这里只保留对话相关操作 + 咨询线索表单 + 登录/退出。
export function Sidebar({
  onNewChat,
  onOpenHistory,
  onOpenConsultation,
  onOpenLogin,
  onLogout,
  currentUser,
  isOpen,
  onClose,
}) {
  const isCn = isCnLocale();
  const tools = [
    { icon: MessageSquarePlus, label: isCn ? '新对话' : 'New Chat', onClick: onNewChat, testid: 'new-chat-button', primary: true },
    { icon: History, label: isCn ? '历史' : 'History', onClick: onOpenHistory, testid: 'tool-history' },
    { icon: Send, label: isCn ? '咨询留言' : 'Contact us', onClick: onOpenConsultation, testid: 'tool-consultation' },
  ];

  const rail = (
    <aside className="flex h-full w-[184px] flex-col items-stretch overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-2 py-3">
      <BrandMark className="mb-3 h-10 w-10 self-center shadow-sm" />
      <div className="flex w-full flex-1 flex-col items-stretch gap-2">
        {tools.map((tool) => (
          <RailButton key={tool.label} tool={tool} onClick={() => { tool.onClick?.(); onClose?.(); }} />
        ))}
      </div>
      <div className="flex w-full flex-col items-stretch gap-2 border-t border-[var(--color-border)] pt-3">
        {currentUser ? (
          <>
            <RailButton
              tool={{ icon: User, label: currentUser.name || (isCn ? '账号' : 'Account'), testid: 'user-avatar-button' }}
            />
            <RailButton
              tool={{ icon: LogOut, label: isCn ? '退出' : 'Log Out', onClick: onLogout, testid: 'logout-button' }}
              onClick={onLogout}
            />
          </>
        ) : (
          <RailButton
            tool={{ icon: LogIn, label: isCn ? '登录' : 'Sign In', onClick: onOpenLogin, testid: 'sidebar-login-button' }}
            onClick={() => { onOpenLogin?.(); onClose?.(); }}
          />
        )}
      </div>
    </aside>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <div className="hidden lg:block">{rail}</div>
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {rail}
      </div>
    </>
  );
}

function RailButton({ tool, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      title={tool.label}
      data-testid={tool.testid || `tool-${tool.label}`}
      onClick={onClick}
      className={`relative flex h-11 w-full items-center justify-start gap-2 rounded-lg px-2 transition-colors duration-200 ${
        tool.primary
          ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
          : 'text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-surface)] hover:text-[var(--color-sidebar-text)]'
      }`}
    >
      <Icon size={20} className="shrink-0" />
      <span className="min-w-0 truncate whitespace-nowrap text-xs">{tool.label}</span>
    </button>
  );
}
