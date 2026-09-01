import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Footer } from './components/common/Footer';
import { NotFoundPage } from './components/common/NotFoundPage';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Sidebar/ChatHistory';
import { Modal } from './components/common/Modal';
import { FeedbackHost } from './components/common/FeedbackHost';
import { PushNotificationBanner } from './components/PushNotification/PushNotificationBanner';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { usePushNotification } from './hooks/usePushNotification';
import { generateId } from './utils/helpers';
import { isCnLocale } from './utils/locale';
import { setSeoMetadata } from './utils/seo';
import { getServicePageRoute } from './utils/servicePageRoute';
import { getPublicAcquisitionContext, useAcquisitionTracking } from './hooks/useAcquisitionTracking';
import { parseServiceRequestEntry, resolvePortalTarget } from './utils/portalTarget';
import { submitWorkOrder as submitWorkOrderApi, uploadWorkOrderAttachment, getConversation as getConversationApi, getUnreadNotificationCount, trackFunnelEvent, restoreSession, logout as logoutSession } from './services/api';
import { createAnalyticsRequestId } from './services/funnelAnalytics';
import { PublicHomePage } from './components/Public/PublicHomePage';
import { getBrandServicePage } from './data/brandServicePages';

// 重型 Modal 懒加载，减少首屏 bundle 体积
// LoginModal 直接导入 — 关键的登录/注册入口，懒加载会导致 React #306（重复 React 实例）
import { LoginModal } from './components/Auth/LoginModal';
const BUILD_TARGET = typeof __SAGEMRO_BUILD_TARGET__ === 'string' ? __SAGEMRO_BUILD_TARGET__ : 'public';
const MyWorkOrdersModal = lazy(() => import('./components/Sidebar/MyWorkOrdersModal').then(m => ({ default: m.MyWorkOrdersModal })));
const EngineerDashboard = lazy(() => import('./components/Engineer/EngineerDashboard').then(m => ({ default: m.EngineerDashboard })));
const EngineerWorkspace = lazy(() => import('./components/Engineer/EngineerWorkspace').then(m => ({ default: m.EngineerWorkspace })));
const EngineerRecruitingPage = lazy(() => import('./components/Engineer/EngineerRecruitingPage').then(m => ({ default: m.EngineerRecruitingPage })));
const EngineerActivationPage = lazy(() => import('./components/Engineer/EngineerActivationPage').then(m => ({ default: m.EngineerActivationPage })));
const EngineerProfileModal = lazy(() => import('./components/Engineer/EngineerProfileModal').then(m => ({ default: m.EngineerProfileModal })));
const CustomerHomeModal = lazy(() => import('./components/Settings/CustomerHomeModal').then(m => ({ default: m.CustomerHomeModal })));
const LegalModal = lazy(() => import('./components/common/LegalModal').then(m => ({ default: m.LegalModal })));
const MyDevicesModal = lazy(() => import('./components/Device/MyDevicesModal').then(m => ({ default: m.MyDevicesModal })));
const NotificationModal = lazy(() => import('./components/Notification/NotificationModal').then(m => ({ default: m.NotificationModal })));
const IndustryToolsModal = lazy(() => import('./components/Tools/IndustryToolsModal').then(m => ({ default: m.IndustryToolsModal })));
const IndustryToolsPage = lazy(() => import('./components/Tools/IndustryToolsPage').then(m => ({ default: m.IndustryToolsPage })));
const InsightsPage = lazy(() => import('./components/Insights/InsightsPage').then(m => ({ default: m.InsightsPage })));
const ServicePages = lazy(() => import('./components/Services/ServicePages').then(m => ({ default: m.ServicePages })));
const BrandServicePages = lazy(() => import('./components/Brands/BrandServicePages').then(m => ({ default: m.BrandServicePages })));
const TechnicalReviewPage = lazy(() => import('./components/About/TechnicalReviewPage').then(m => ({ default: m.TechnicalReviewPage })));
const ServiceRequestPage = lazy(() => import('./components/ServiceRequest/ServiceRequestPage').then(m => ({ default: m.ServiceRequestPage })));
const ChatArea = lazy(() => import('./components/Chat/ChatArea').then(m => ({ default: m.ChatArea })));

function App() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const portalTarget = resolvePortalTarget({ buildTarget: BUILD_TARGET, hostname });
  const isEngineerHost = portalTarget === 'engineer';
  const isCn = isCnLocale();
  const engineerPortalUrl = isCn ? 'https://engineer.sagemro.cn' : 'https://engineer.sagemro.com';

  useEffect(() => {
    trackFunnelEvent('traffic_source_captured', { entry: 'app_loaded' });
  }, []);

  // 侧边栏状态
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal 状态
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [industryToolsOpen, setIndustryToolsOpen] = useState(false);
  const [myWorkOrdersModalOpen, setMyWorkOrdersModalOpen] = useState(false);
  const [customerHomeModalOpen, setCustomerHomeModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [engineerDashboardOpen, setEngineerDashboardOpen] = useState(false);
  const [engineerProfileOpen, setEngineerProfileOpen] = useState(false);
  const [myDevicesOpen, setMyDevicesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('agreement');
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionRestoreComplete, setSessionRestoreComplete] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const isTechnicalReviewPath = currentPath === '/about/technical-review'
    || currentPath === '/about/technical-review/';
  const isServiceRequestPath = portalTarget === 'customer'
    && (currentPath === '/service-request' || currentPath === '/service-request/');
  const serviceRequestEntry = parseServiceRequestEntry(window.location.search, {
    resolveBrand: (slug) => getBrandServicePage(slug, isCn ? 'zh-CN' : 'en')?.brandName || '',
  });
  const authVersionRef = useRef(0);
  const serviceRequestSubmissionRef = useRef(null);
  const engineerWorkOrderMatch = currentPath.match(/^\/work-orders\/([^/]+)$/);
  const engineerWorkOrderId = engineerWorkOrderMatch ? decodeURIComponent(engineerWorkOrderMatch[1]) : '';
  const publicRoutePath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
  const acquisitionContext = getPublicAcquisitionContext({
    pathname: publicRoutePath,
    locale: isCn ? 'zh-CN' : 'en',
    sessionRestoreComplete,
    isEngineerHost,
    userType,
  });
  useAcquisitionTracking(acquisitionContext);

  useEffect(() => {
    const isToolsOrInsights = portalTarget === 'public' && (currentPath === '/tools'
      || currentPath.startsWith('/tools/')
      || currentPath === '/insights'
      || currentPath.startsWith('/insights/')
      || currentPath === '/services'
      || currentPath.startsWith('/services/')
      || currentPath === '/brands'
      || currentPath.startsWith('/brands/')
      || isTechnicalReviewPath);
    if (isToolsOrInsights || (isEngineerHost && currentPath === '/' && !userType)) return;

    const isPublicPath = portalTarget === 'public' && ((currentPath === '/')
      || currentPath === '/services'
      || currentPath.startsWith('/services/')
      || currentPath === '/brands'
      || currentPath.startsWith('/brands/')
      || isTechnicalReviewPath);
    const isPrivateApp = !isPublicPath;
    const title = isCn ? 'SAGEMRO 智能服务系统' : 'SAGEMRO Service OS';
    const description = isCn
      ? 'SAGEMRO 面向激光切割与金属成型设备，帮助客户整理问题、连接合格工程师并沉淀服务记录。'
      : 'SAGEMRO helps industrial equipment users organize service needs, connect with qualified field engineers, and keep service records clear.';
    const canonicalHost = isCn ? 'https://sagemro.cn' : 'https://sagemro.com';
    const publicHost = isEngineerHost ? canonicalHost.replace('://', '://engineer.') : canonicalHost;
    setSeoMetadata({
      title: isPrivateApp ? 'SAGEMRO Service Workspace' : title,
      description: isPrivateApp ? 'Private SAGEMRO service workspace.' : description,
      canonical: isPrivateApp ? null : `${publicHost}/`,
      lang: isCn ? 'zh-CN' : 'en',
      robots: isPrivateApp ? 'noindex,nofollow,noarchive' : 'index,follow',
      structuredData: isPrivateApp ? null : {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SAGEMRO',
        url: `${canonicalHost}/`,
        email: 'support@sagemro.com',
      },
    });
  }, [currentPath, isCn, isEngineerHost, isTechnicalReviewPath, portalTarget, userType]);

  // 通知未读数
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef(null);

  // 初始化用户状态
  useEffect(() => {
    const restoreVersion = authVersionRef.current;
    restoreSession()
      .then((session) => {
        if (authVersionRef.current !== restoreVersion) return;
        if (session.authenticated) {
          if (session.csrfToken) {
            localStorage.setItem('sagemro_csrf_token', session.csrfToken);
            localStorage.removeItem('sagemro_token');
          }
          setCurrentUser(session.user);
          setUserType(session.userType);
          localStorage.setItem('sagemro_user', JSON.stringify(session.user));
          localStorage.setItem('sagemro_user_type', session.userType);
        } else {
          localStorage.removeItem('sagemro_token');
          localStorage.removeItem('sagemro_user');
          localStorage.removeItem('sagemro_user_type');
          localStorage.removeItem('sagemro_customer_id');
          localStorage.removeItem('sagemro_engineer_id');
          localStorage.removeItem('sagemro_csrf_token');
          setCurrentUser(null);
          setUserType(null);
        }
      })
      .catch(() => {
        if (authVersionRef.current !== restoreVersion) return;
        localStorage.removeItem('sagemro_user');
        localStorage.removeItem('sagemro_user_type');
        localStorage.removeItem('sagemro_customer_id');
        localStorage.removeItem('sagemro_engineer_id');
        localStorage.removeItem('sagemro_csrf_token');
        setCurrentUser(null);
        setUserType(null);
      })
      .finally(() => {
        setAuthReady(true);
        setSessionRestoreComplete(true);
      });
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
    renameConversation,
    getConversation,
    refresh: refreshConversations,
  } = useConversations({ isAuthenticated: Boolean(currentUser && userType) });

  // 推送通知（客户和工程师均可订阅）
  const pushUserId = userType === 'engineer'
    ? localStorage.getItem('sagemro_engineer_id')
    : userType === 'customer'
      ? localStorage.getItem('sagemro_customer_id')
      : null;
  const { inAppNotification, dismissNotification } = usePushNotification(
    pushUserId,
    userType === 'engineer' || userType === 'customer'
  );

  const {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
    deviceSuggestion,
    clearDeviceSuggestion,
  } = useChat();

  useEffect(() => {
    if (deviceSuggestion && userType === 'customer') {
      setMyDevicesOpen(true);
    }
  }, [deviceSuggestion, userType]);

  // 当前对话标题
  const currentConversation = conversationId ? getConversation(conversationId) : null;
  const currentTitle = currentConversation?.title || 'Service Chat';

  // 新建对话
  const handleNewChat = useCallback(() => {
    clearMessages();
    setSidebarOpen(false);
    setHistoryModalOpen(false);
  }, [clearMessages, setHistoryModalOpen, setSidebarOpen]);

  // 选择对话
  const handleSelectConversation = useCallback(async (conv) => {
    if (conv.id === conversationId) {
      setSidebarOpen(false);
      setHistoryModalOpen(false);
      return;
    }
    if (currentUser) {
      try {
        const data = await getConversationApi(conv.id);
        loadMessages(data.messages || [], conv.id);
      } catch (error) {
        console.error('Failed to load conversation from server:', error);
        clearMessages();
      }
    } else {
      const stored = localStorage.getItem(`sagemro_messages_${conv.id}`);
      if (stored) {
        loadMessages(JSON.parse(stored), conv.id);
      } else {
        clearMessages();
        loadMessages([], conv.id);
      }
    }
    setSidebarOpen(false);
    setHistoryModalOpen(false);
  }, [conversationId, currentUser, clearMessages, loadMessages, setHistoryModalOpen, setSidebarOpen]);

  // 发送消息
  const handleSendMessage = useCallback(async (content, images) => {
    let convId = conversationId;
    if (!convId) {
      const newConv = createConversation();
      convId = newConv.id;
    }

    const stored = currentUser ? null : localStorage.getItem(`sagemro_messages_${convId}`);
    const currentMessages = stored ? JSON.parse(stored) : [];
    const requestId = createAnalyticsRequestId();

    trackFunnelEvent('ai_conversation_started', {
      entry: 'main_chat',
      authenticated: Boolean(currentUser),
      conversation_id: convId,
      has_images: Boolean(images && images.length > 0),
      request_id: requestId,
    });

    await sendMessage(content, images, convId, requestId);

    if (!currentUser) setTimeout(() => {
      const updatedMessages = [...currentMessages, {
        id: generateId(),
        role: 'user',
        content,
        images: images && images.length > 0 ? images : undefined,
        created_at: new Date().toISOString(),
      }];
      localStorage.setItem(`sagemro_messages_${convId}`, JSON.stringify(updatedMessages));

      updateConversation(convId, {
        title: content.slice(0, 20) + (content.length > 20 ? '...' : ''),
        last_message: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      });
    }, 0);
    else refreshConversations();
  }, [conversationId, createConversation, currentUser, refreshConversations, sendMessage, updateConversation]);

  // 提交工单
  const handleServiceRequestSubmit = useCallback(async (payload, files = []) => {
    const customer_id = currentUser?.id || localStorage.getItem('sagemro_customer_id');
    if (!customer_id || userType !== 'customer') {
      throw new Error(isCn ? '请先使用客户账号登录后再提交服务请求' : 'Sign in with a customer account before submitting');
    }

    const fingerprint = JSON.stringify(payload);
    let submission = serviceRequestSubmissionRef.current;
    if (!submission || submission.fingerprint !== fingerprint) {
      const requestPayload = { ...payload, customer_id };
      const result = await submitWorkOrderApi(requestPayload);
      submission = {
        fingerprint,
        workOrder: result.work_order,
        uploadedFiles: new Set(),
      };
      serviceRequestSubmissionRef.current = submission;
    }

    const { workOrder } = submission;
    for (const file of files) {
      const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
      if (submission.uploadedFiles.has(fileKey)) continue;
      await uploadWorkOrderAttachment(workOrder.id, file);
      submission.uploadedFiles.add(fileKey);
    }

    serviceRequestSubmissionRef.current = null;
    trackFunnelEvent('service_request_created', {
      service_type: payload.intake?.service_request_kind || payload.type,
      urgency: payload.urgency,
      authenticated: true,
    });
    return workOrder;
  }, [currentUser, isCn, userType]);

  // 删除对话
  const handleDeleteConversation = useCallback(async (id) => {
    await deleteConversation(id);
    if (id === conversationId) {
      clearMessages();
    }
    if (!currentUser) localStorage.removeItem(`sagemro_messages_${id}`);
  }, [deleteConversation, conversationId, currentUser, clearMessages]);

  // 重命名对话
  const handleRenameConversation = useCallback(async (id, title) => {
    await renameConversation(id, title);
  }, [renameConversation]);

  // 登录成功
  const handleLoginSuccess = useCallback((userData) => {
    authVersionRef.current += 1;
    setCurrentUser(userData.user);
    setUserType(userData.userType);
    if (userData.userType === 'engineer') {
      // Engineer accounts belong in the independent engineer portal.
      // The main site remains customer/visitor focused.
      setLoginModalOpen(false);
    }
    if (conversationId) {
      getConversationApi(conversationId)
        .then((data) => loadMessages(data.messages || [], conversationId))
        .catch(() => clearMessages());
    }
  }, [conversationId, loadMessages, clearMessages, setCurrentUser, setLoginModalOpen, setUserType]);

  const handleActivationLoginSuccess = useCallback((userData) => {
    handleLoginSuccess(userData);
    window.history.replaceState({}, '', '/');
    setCurrentPath('/');
  }, [handleLoginSuccess, setCurrentPath]);

  // 登出
  const handleLogout = useCallback(() => {
    authVersionRef.current += 1;
    logoutSession().catch(() => {});
    localStorage.removeItem('sagemro_token');
    localStorage.removeItem('sagemro_user');
    localStorage.removeItem('sagemro_user_type');
    localStorage.removeItem('sagemro_customer_id');
    localStorage.removeItem('sagemro_engineer_id');
    localStorage.removeItem('sagemro_csrf_token');
    setCurrentUser(null);
    setUserType(null);
    setUnreadCount(0);
    if (!isEngineerHost && currentPath === '/engineer') {
      window.history.replaceState({}, '', '/');
      setCurrentPath('/');
    }
  }, [currentPath, isEngineerHost, setCurrentPath, setCurrentUser, setUserType]);

  // 监听 401 自动登出事件（由 services/api.js 的 fetch 拦截器触发）
  // token 过期 / 被踢下线时，清掉本地状态并弹出登录框，避免后续操作继续命中 401
  useEffect(() => {
    const handler = () => {
      setCurrentUser(null);
      setUserType(null);
      setUnreadCount(0);
      setLoginModalOpen(true);
    };
    window.addEventListener('sagemro:auth-expired', handler);
    return () => window.removeEventListener('sagemro:auth-expired', handler);
  }, []);

  // 通知未读数变化回调
  const handleUnreadCountChange = useCallback((delta) => {
    setUnreadCount(prev => Math.max(0, prev + delta));
  }, []);

  // 从通知跳转到工单详情
  const handleOpenWorkOrderDetail = useCallback((workOrderId) => {
    // 打开我的工单列表（目前没有单独详情页入口，通过列表查看）
    setMyWorkOrdersModalOpen(true);
  }, [setMyWorkOrdersModalOpen]);

  // 打开法律文档
  const openLegal = useCallback((tab = 'agreement') => {
    setLegalInitialTab(tab);
    setLegalModalOpen(true);
  }, [setLegalInitialTab, setLegalModalOpen]);

  const navigateHome = useCallback(() => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  }, [setCurrentPath]);

  const handleServiceDiagnosis = useCallback(() => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  }, [setCurrentPath]);

  const handleServiceRequest = useCallback(() => {
    window.history.pushState({}, '', '/service-request');
    setCurrentPath('/service-request');
  }, [setCurrentPath]);

  const handleRequireServiceRequestAuth = useCallback(() => {
    setLoginModalOpen(true);
  }, [setLoginModalOpen]);

  const showEngineerWorkspace = (isEngineerHost || currentPath === '/engineer') && userType === 'engineer';

  if ((isEngineerHost || currentPath === '/engineer') && currentPath !== '/activate' && !authReady) {
    return <div className="min-h-[100dvh] bg-[var(--color-bg)]" aria-busy="true" />;
  }

  if (isEngineerHost && currentPath === '/activate') {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <EngineerActivationPage onOpenLogin={() => setLoginModalOpen(true)} />
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onLoginSuccess={handleActivationLoginSuccess}
            onOpenLegal={openLegal}
            conversationId={conversationId}
          />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (showEngineerWorkspace) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <EngineerWorkspace
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenProfile={() => setEngineerProfileOpen(true)}
            workOrderId={engineerWorkOrderId}
          />
          {engineerProfileOpen && (
            <EngineerProfileModal
              isOpen={engineerProfileOpen}
              onClose={() => setEngineerProfileOpen(false)}
              engineerId={localStorage.getItem('sagemro_engineer_id')}
            />
          )}
          {userType === 'engineer' && (
            <PushNotificationBanner
              notification={inAppNotification}
              onDismiss={dismissNotification}
            />
          )}
          <FeedbackHost />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (isEngineerHost) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <EngineerRecruitingPage onOpenLogin={() => setLoginModalOpen(true)} />
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
            onOpenLegal={openLegal}
          />
          {legalModalOpen && (
            <LegalModal
              isOpen={legalModalOpen}
              onClose={() => setLegalModalOpen(false)}
              initialTab={legalInitialTab}
            />
          )}
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  const isToolsPath = portalTarget === 'public' && (currentPath === '/tools' || currentPath.startsWith('/tools/'));
  const isInsightsPath = portalTarget === 'public' && (currentPath === '/insights' || currentPath.startsWith('/insights/'));
  const isBrandsPath = portalTarget === 'public' && (currentPath === '/brands' || currentPath.startsWith('/brands/'));
  const serviceRoute = portalTarget === 'public' ? getServicePageRoute(currentPath) : null;
  const isServicesPath = serviceRoute !== null;
  if (portalTarget === 'blocked') {
    return <NotFoundPage isCn={isCn} />;
  }
  if (currentPath !== '/' && !isToolsPath && !isInsightsPath && !isBrandsPath && !isServicesPath && !isTechnicalReviewPath && !isServiceRequestPath) {
    return <NotFoundPage isCn={isCn} />;
  }

  if (isToolsPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <IndustryToolsPage
            pathname={currentPath}
            acquisitionContext={acquisitionContext}
            onOpenLegal={openLegal}
            onSendMessage={handleSendMessage}
            onNavigateHome={navigateHome}
          />
          <LegalModal
            isOpen={legalModalOpen}
            onClose={() => setLegalModalOpen(false)}
            initialTab={legalInitialTab}
          />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (isInsightsPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <InsightsPage
            pathname={currentPath}
            acquisitionContext={acquisitionContext}
            onOpenLegal={openLegal}
            onStartDiagnosis={handleServiceDiagnosis}
            onOpenServiceRequest={handleServiceRequest}
          />
          <LegalModal
            isOpen={legalModalOpen}
            onClose={() => setLegalModalOpen(false)}
            initialTab={legalInitialTab}
          />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (isServicesPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <ServicePages
            pathname={currentPath}
            locale={isCn ? 'zh-CN' : 'en'}
            acquisitionContext={acquisitionContext}
            onStartDiagnosis={handleServiceDiagnosis}
            onOpenServiceRequest={handleServiceRequest}
            onOpenLegal={openLegal}
          />
          <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} initialTab={legalInitialTab} />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (isTechnicalReviewPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <TechnicalReviewPage locale={isCn ? 'zh-CN' : 'en'} onOpenLegal={openLegal} />
          <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} initialTab={legalInitialTab} />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (isBrandsPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <BrandServicePages
            pathname={currentPath}
            locale={isCn ? 'zh-CN' : 'en'}
            onOpenLegal={openLegal}
          />
          <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} initialTab={legalInitialTab} />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (currentPath === '/' && portalTarget === 'public') {
    return (
      <ErrorBoundary>
        <PublicHomePage isCn={isCn} onOpenLegal={openLegal} />
        <Suspense fallback={null}>
          <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} initialTab={legalInitialTab} />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (userType === 'engineer') {
    const engineerRedirectCopy = isCn
      ? {
          title: '请从专属工作台继续',
          body: '当前账号适用于 SAGEMRO 工程师工作台。请前往专属入口查看服务任务、客户沟通和现场服务记录。',
          cta: `前往 ${engineerPortalUrl.replace('https://', '')}`,
          signOut: '退出当前账号',
        }
      : {
          title: 'Continue in the Engineer Workspace',
          body: 'This account is intended for the SAGEMRO Engineer Workspace. Use the dedicated portal to review service tasks, customer communication, and field service records.',
          cta: `Go to ${engineerPortalUrl.replace('https://', '')}`,
          signOut: 'Sign Out',
        };

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)] px-5 text-[var(--color-text-primary)]">
        <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
          <h1 className="mt-2 text-xl font-semibold">{engineerRedirectCopy.title}</h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {engineerRedirectCopy.body}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <a
              href={engineerPortalUrl}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white"
            >
              {engineerRedirectCopy.cta}
            </a>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)]"
            >
              {engineerRedirectCopy.signOut}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isServiceRequestPath) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <ServiceRequestPage
            onSubmit={handleServiceRequestSubmit}
            initialDraft={serviceRequestEntry.presets}
            mode={serviceRequestEntry.mode}
            isAuthenticated={Boolean(currentUser) && userType === 'customer'}
            onRequireAuth={handleRequireServiceRequestAuth}
            market={isCn ? 'cn' : 'com'}
            conversationId={conversationId}
            onBack={navigateHome}
          />
          {loginModalOpen && (
            <LoginModal
              isOpen={loginModalOpen}
              onClose={() => setLoginModalOpen(false)}
              onLoginSuccess={handleLoginSuccess}
              onOpenLegal={openLegal}
            />
          )}
          <LegalModal
            isOpen={legalModalOpen}
            onClose={() => setLegalModalOpen(false)}
            initialTab={legalInitialTab}
          />
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        currentConversationId={conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenHistory={() => setHistoryModalOpen(true)}
        onOpenIndustryTools={() => setIndustryToolsOpen(true)}
        onOpenWorkOrder={handleServiceRequest}
        onOpenMyWorkOrders={() => setMyWorkOrdersModalOpen(true)}
        onOpenSettings={() => {
          if (userType === 'engineer') {
            setEngineerDashboardOpen(true);
          } else {
            setCustomerHomeModalOpen(true);
          }
        }}
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Suspense fallback={null}>
          <ChatArea
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onStopGeneration={stopGeneration}
            onNewChat={handleNewChat}
            currentTitle={currentTitle}
            onToggleSidebar={() => setSidebarOpen(true)}
            onOpenLegal={openLegal}
          />
        </Suspense>
      </div>

      {/* Modals — 重型组件使用 Suspense 懒加载 */}
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Modal
            isOpen={historyModalOpen}
            onClose={() => setHistoryModalOpen(false)}
            title="Conversation History"
            size="2xl"
          >
            <ChatHistory
              conversations={conversations}
              currentId={conversationId}
              onSelect={handleSelectConversation}
              onDelete={handleDeleteConversation}
              onRename={handleRenameConversation}
            />
          </Modal>
          {industryToolsOpen && (
            <IndustryToolsModal
              isOpen={industryToolsOpen}
              onClose={() => setIndustryToolsOpen(false)}
              onSendMessage={handleSendMessage}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary>
        <Suspense fallback={null}>
          {myWorkOrdersModalOpen && (
            <MyWorkOrdersModal
              isOpen={myWorkOrdersModalOpen}
              onClose={() => setMyWorkOrdersModalOpen(false)}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      <CustomerHomeModal
        isOpen={customerHomeModalOpen}
        onClose={() => setCustomerHomeModalOpen(false)}
        currentUser={currentUser}
        userType={userType}
      />
      {loginModalOpen && (
        <LoginModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          onOpenLegal={openLegal}
        />
      )}
      <ErrorBoundary>
        <Suspense fallback={null}>
          {engineerDashboardOpen && (
            <EngineerDashboard
              isOpen={engineerDashboardOpen}
              onClose={() => setEngineerDashboardOpen(false)}
              engineerId={localStorage.getItem('sagemro_engineer_id')}
              onViewProfile={() => setEngineerProfileOpen(true)}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary>
        <Suspense fallback={null}>
          {engineerProfileOpen && (
            <EngineerProfileModal
              isOpen={engineerProfileOpen}
              onClose={() => setEngineerProfileOpen(false)}
              engineerId={localStorage.getItem('sagemro_engineer_id')}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      <MyDevicesModal
        isOpen={myDevicesOpen}
        onClose={() => {
          setMyDevicesOpen(false);
          clearDeviceSuggestion();
        }}
        currentUser={currentUser}
        userType={userType}
        deviceSuggestion={deviceSuggestion}
        onSuggestionHandled={clearDeviceSuggestion}
      />
      <NotificationModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onUnreadCountChange={handleUnreadCountChange}
        onOpenWorkOrderDetail={handleOpenWorkOrderDetail}
      />
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalInitialTab}
      />

      {/* 推送通知 Banner（工程师在线时收到推送） */}
      {userType === 'engineer' && (
        <PushNotificationBanner
          notification={inAppNotification}
          onDismiss={dismissNotification}
        />
      )}

      {/* 全局 toast / confirm 宿主 */}
      <FeedbackHost />
    </div>
  );
}

export default App;
