import { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/Chat/ChatArea';
import { WorkOrderModal } from './components/Sidebar/WorkOrderModal';
import { MyWorkOrdersModal } from './components/Sidebar/MyWorkOrdersModal';
import { CustomerHomeModal } from './components/Settings/CustomerHomeModal';
import { AboutModal } from './components/common/AboutModal';
import { LoginModal } from './components/Auth/LoginModal';
import { EngineerDashboard } from './components/Engineer/EngineerDashboard';
import { EngineerProfileModal } from './components/Engineer/EngineerProfileModal';
import { MyDevicesModal } from './components/Device/MyDevicesModal';
import { NotificationModal } from './components/Notification/NotificationModal';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { usePushNotification } from './hooks/usePushNotification';
import { PushNotificationBanner } from './components/PushNotification/PushNotificationBanner';
import { generateId } from './utils/helpers';
import { submitWorkOrder as submitWorkOrderApi, getUnreadNotificationCount } from './services/api';

function App() {
  // 侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal 状态
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [myWorkOrdersModalOpen, setMyWorkOrdersModalOpen] = useState(false);
  const [customerHomeModalOpen, setCustomerHomeModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [engineerDashboardOpen, setEngineerDashboardOpen] = useState(false);
  const [engineerProfileOpen, setEngineerProfileOpen] = useState(false);
  const [myDevicesOpen, setMyDevicesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);

  // 通知未读数
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef(null);

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

  // 轮询未读通知数
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const data = await getUnreadNotificationCount();
        setUnreadCount(data.count || 0);
      } catch (e) {
        // silently fail
      }
    };

    fetchCount();
    pollRef.current = setInterval(fetchCount, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentUser]);

  // 对话管理
  const {
    conversations,
    createConversation,
    updateConversation,
    deleteConversation,
    getConversation,
  } = useConversations();

  // 推送通知（仅工程师）
  const engineerId = localStorage.getItem('sagemro_engineer_id');
  const { inAppNotification, dismissNotification } = usePushNotification(
    engineerId,
    userType === 'engineer'
  );

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
    const customer_id = localStorage.getItem('sagemro_customer_id');

    // 检查是否登录
    if (!customer_id) {
      throw new Error('请先登录后再提交工单');
    }

    // 将设备信息组合进描述，供 AI 分析
    const deviceInfo = [
      data.device_type?.length > 0 ? `设备类型：${data.device_type.join('、')}` : null,
      data.device_brand?.length > 0 ? `品牌：${data.device_brand.join('、')}` : null,
      data.device_model ? `型号：${data.device_model}` : null,
      data.region?.length > 0 ? `所在地区：${data.region.join('、')}` : null,
    ].filter(Boolean).join('；');

    const fullDescription = deviceInfo
      ? `${deviceInfo}。${data.description}`
      : data.description;

    const result = await submitWorkOrderApi({
      customer_id,
      type: data.type,
      description: fullDescription,
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
    // 登录后清空对话，确保用新账号的正确身份上下文开始对话
    clearMessages();
  }, [clearMessages]);

  // 登出
  const handleLogout = useCallback(() => {
    localStorage.removeItem('sagemro_token');
    localStorage.removeItem('sagemro_user');
    localStorage.removeItem('sagemro_user_type');
    localStorage.removeItem('sagemro_customer_id');
    localStorage.removeItem('sagemro_engineer_id');
    setCurrentUser(null);
    setUserType(null);
    setUnreadCount(0);
  }, []);

  // 通知未读数变化回调
  const handleUnreadCountChange = useCallback((delta) => {
    setUnreadCount(prev => Math.max(0, prev + delta));
  }, []);

  // 从通知跳转到工单详情
  const handleOpenWorkOrderDetail = useCallback((workOrderId) => {
    // 打开我的工单列表（目前没有单独详情页入口，通过列表查看）
    setMyWorkOrdersModalOpen(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        currentConversationId={conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenWorkOrder={() => setWorkOrderModalOpen(true)}
        onOpenMyWorkOrders={() => setMyWorkOrdersModalOpen(true)}
        onOpenSettings={() => {
          if (userType === 'engineer') {
            setEngineerDashboardOpen(true);
          } else {
            setCustomerHomeModalOpen(true);
          }
        }}
        onOpenAbout={() => setAboutModalOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenEngineerDashboard={() => setEngineerDashboardOpen(true)}
        onOpenMyDevices={() => setMyDevicesOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        unreadCount={unreadCount}
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
      <CustomerHomeModal
        isOpen={customerHomeModalOpen}
        onClose={() => setCustomerHomeModalOpen(false)}
        currentUser={currentUser}
        userType={userType}
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
      <MyDevicesModal
        isOpen={myDevicesOpen}
        onClose={() => setMyDevicesOpen(false)}
        currentUser={currentUser}
      />
      <NotificationModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadCountChange={handleUnreadCountChange}
        onOpenWorkOrderDetail={handleOpenWorkOrderDetail}
      />

      {/* 推送通知 Banner（工程师在线时收到推送） */}
      {userType === 'engineer' && (
        <PushNotificationBanner
          notification={inAppNotification}
          onDismiss={dismissNotification}
        />
      )}
    </div>
  );
}

export default App;
