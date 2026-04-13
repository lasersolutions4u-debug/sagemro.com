import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/Chat/ChatArea';
import { WorkOrderModal } from './components/Sidebar/WorkOrderModal';
import { MyWorkOrdersModal } from './components/Sidebar/MyWorkOrdersModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { AboutModal } from './components/common/AboutModal';
import { LoginModal } from './components/Auth/LoginModal';
import { EngineerDashboard } from './components/Engineer/EngineerDashboard';
import { EngineerProfileModal } from './components/Engineer/EngineerProfileModal';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { generateId } from './utils/helpers';
import { submitWorkOrder as submitWorkOrderApi } from './services/api';

function App() {
  // 侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal 状态
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [myWorkOrdersModalOpen, setMyWorkOrdersModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [engineerDashboardOpen, setEngineerDashboardOpen] = useState(false);
  const [engineerProfileOpen, setEngineerProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);

  // 初始化用户状态
  useEffect(() => {
    const storedUser = localStorage.getItem('sagemro_user');
    const storedType = localStorage.getItem('sagemro_user_type');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    if (storedType) {
      setUserType(storedType);
    }
  }, []);

  // 对话管理
  const {
    conversations,
    createConversation,
    updateConversation,
    deleteConversation,
    getConversation,
  } = useConversations();

  const {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
  } = useChat();

  // 当前对话标题
  const currentConversation = conversationId ? getConversation(conversationId) : null;
  const currentTitle = currentConversation?.title || '新对话';

  // 新建对话
  const handleNewChat = useCallback(() => {
    clearMessages();
    setSidebarOpen(false);
  }, [clearMessages]);

  // 选择对话
  const handleSelectConversation = useCallback((conv) => {
    if (conv.id === conversationId) {
      setSidebarOpen(false);
      return;
    }
    // 从 localStorage 加载历史消息
    const stored = localStorage.getItem(`sagemro_messages_${conv.id}`);
    if (stored) {
      const history = JSON.parse(stored);
      loadMessages(history, conv.id);
    } else {
      clearMessages();
      loadMessages([], conv.id);
    }
    setSidebarOpen(false);
  }, [conversationId, clearMessages, loadMessages]);

  // 发送消息
  const handleSendMessage = useCallback(async (content) => {
    let convId = conversationId;
    if (!convId) {
      const newConv = createConversation();
      convId = newConv.id;
    }

    const stored = localStorage.getItem(`sagemro_messages_${convId}`);
    const currentMessages = stored ? JSON.parse(stored) : [];

    await sendMessage(content);

    setTimeout(() => {
      const updatedMessages = [...currentMessages, {
        id: generateId(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }];
      localStorage.setItem(`sagemro_messages_${convId}`, JSON.stringify(updatedMessages));

      updateConversation(convId, {
        title: content.slice(0, 20) + (content.length > 20 ? '...' : ''),
        last_message: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      });
    }, 0);
  }, [conversationId, createConversation, sendMessage, updateConversation]);

  // 提交工单
  const handleSubmitWorkOrder = useCallback(async (data) => {
    // TODO: 后续从登录状态获取 customer_id
    const customer_id = localStorage.getItem('sagemro_customer_id') || 'guest';

    const result = await submitWorkOrderApi({
      customer_id,
      type: data.type,
      description: data.description,
      urgency: data.urgency,
      device_id: data.device_id,
    });

    return result.work_order;
  }, []);

  // 删除对话
  const handleDeleteConversation = useCallback((id) => {
    deleteConversation(id);
    if (id === conversationId) {
      clearMessages();
    }
    localStorage.removeItem(`sagemro_messages_${id}`);
  }, [deleteConversation, conversationId, clearMessages]);

  // 登录成功
  const handleLoginSuccess = useCallback((userData) => {
    setCurrentUser(userData.user);
    setUserType(userData.userType);
  }, []);

  // 登出
  const handleLogout = useCallback(() => {
    localStorage.removeItem('sagemro_token');
    localStorage.removeItem('sagemro_user');
    localStorage.removeItem('sagemro_user_type');
    localStorage.removeItem('sagemro_customer_id');
    localStorage.removeItem('sagemro_engineer_id');
    setCurrentUser(null);
    setUserType(null);
  }, []);

  return (
    <div className="flex h-dvh">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        currentConversationId={conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenWorkOrder={() => setWorkOrderModalOpen(true)}
        onOpenMyWorkOrders={() => setMyWorkOrdersModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenAbout={() => setAboutModalOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenEngineerDashboard={() => setEngineerDashboardOpen(true)}
        currentUser={currentUser}
        userType={userType}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopGeneration={stopGeneration}
          onNewChat={handleNewChat}
          currentTitle={currentTitle}
          onToggleSidebar={() => setSidebarOpen(true)}
        />
      </div>

      {/* Modals */}
      <WorkOrderModal
        isOpen={workOrderModalOpen}
        onClose={() => setWorkOrderModalOpen(false)}
        onSubmit={handleSubmitWorkOrder}
      />
      <MyWorkOrdersModal
        isOpen={myWorkOrdersModalOpen}
        onClose={() => setMyWorkOrdersModalOpen(false)}
      />
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      <EngineerDashboard
        isOpen={engineerDashboardOpen}
        onClose={() => setEngineerDashboardOpen(false)}
        engineerId={localStorage.getItem('sagemro_engineer_id')}
        onViewProfile={() => setEngineerProfileOpen(true)}
      />
      <EngineerProfileModal
        isOpen={engineerProfileOpen}
        onClose={() => setEngineerProfileOpen(false)}
        engineerId={localStorage.getItem('sagemro_engineer_id')}
      />
    </div>
  );
}

export default App;
