import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFoundPage } from './components/common/NotFoundPage';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatHistory } from './components/Sidebar/ChatHistory';
import { Modal } from './components/common/Modal';
import { FeedbackHost } from './components/common/FeedbackHost';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { generateId } from './utils/helpers';
import { isCnLocale } from './utils/locale';
import { setSeoMetadata } from './utils/seo';
import { getServicePageRoute } from './utils/servicePageRoute';
import { getPublicAcquisitionContext, useAcquisitionTracking } from './hooks/useAcquisitionTracking';
import { resolvePortalTarget } from './utils/portalTarget';
import { getConversation as getConversationApi, trackFunnelEvent, restoreSession, logout as logoutSession } from './services/api';
import { createAnalyticsRequestId } from './services/funnelAnalytics';
import { PublicHomePage } from './components/Public/PublicHomePage';
import { ConsultationForm } from './components/Public/ConsultationForm';

// 主站（sagemro.com / sagemro.cn）＝ 营销落地页 + 咨询线索表单 + AI 助手入口 + Store 链接。
// ai.sagemro.com / ai.sagemro.cn ＝ AI 对话门户（本文件底部的聊天界面）。
// engineer.sagemro.com / engineer.sagemro.cn ＝ 工程师招募落地页 + 申请表单。
// 工单、物料、设备、支付、通知、服务请求、工程师工作台已整体下线：
// 不要在这些分支里恢复任何工单/派工/报价相关页面。

// 重型组件懒加载，减少首屏 bundle 体积
// LoginModal 直接导入 — 关键的登录/注册入口，懒加载会导致 React #306（重复 React 实例）
import { LoginModal } from './components/Auth/LoginModal';
const LegalModal = lazy(() => import('./components/common/LegalModal').then(m => ({ default: m.LegalModal })));
const ChatArea = lazy(() => import('./components/Chat/ChatArea').then(m => ({ default: m.ChatArea })));
const IndustryToolsPage = lazy(() => import('./components/Tools/IndustryToolsPage').then(m => ({ default: m.IndustryToolsPage })));
const InsightsPage = lazy(() => import('./components/Insights/InsightsPage').then(m => ({ default: m.InsightsPage })));
const ServicePages = lazy(() => import('./components/Services/ServicePages').then(m => ({ default: m.ServicePages })));
const BrandServicePages = lazy(() => import('./components/Brands/BrandServicePages').then(m => ({ default: m.BrandServicePages })));
const TechnicalReviewPage = lazy(() => import('./components/About/TechnicalReviewPage').then(m => ({ default: m.TechnicalReviewPage })));
const EngineerRecruitingPage = lazy(() => import('./components/Engineer/EngineerRecruitingPage').then(m => ({ default: m.EngineerRecruitingPage })));

const BUILD_TARGET = typeof __SAGEMRO_BUILD_TARGET__ === 'string' ? __SAGEMRO_BUILD_TARGET__ : 'public';
const ENGINEER_PORTAL_URL = { cn: 'https://engineer.sagemro.cn', com: 'https://engineer.sagemro.com' };

function App() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const portalTarget = resolvePortalTarget({ buildTarget: BUILD_TARGET, hostname });
  const isEngineerHost = portalTarget === 'engineer';
  const isPortalHost = portalTarget === 'customer';
  const isCn = isCnLocale();

  useEffect(() => {
    trackFunnelEvent('traffic_source_captured', { entry: 'app_loaded' });
  }, []);

  // CN 站保留自己的站点标题（AI 门户与主站共用同一份产物）。
  useEffect(() => {
    document.title = isCn ? 'SAGEMRO 设备服务平台' : 'SAGEMRO — AI-Powered Equipment Service Platform';
  }, [isCn]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('agreement');
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionRestoreComplete, setSessionRestoreComplete] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  const isTechnicalReviewPath = currentPath === '/about/technical-review'
    || currentPath === '/about/technical-review/';
  const publicRoutePath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
  const acquisitionContext = getPublicAcquisitionContext({
    pathname: publicRoutePath,
    locale: isCn ? 'zh-CN' : 'en',
    sessionRestoreComplete,
    isEngineerHost,
    userType,
  });
  useAcquisitionTracking(acquisitionContext);

  const authVersionRef = useRef(0);

  // SEO：公开营销页可索引，其余（AI 门户 / 工程师站 / 未知路径）一律 noindex。
  useEffect(() => {
    const isToolsOrInsights = currentPath === '/tools' || currentPath.startsWith('/tools/')
      || currentPath === '/insights' || currentPath.startsWith('/insights/')
      || currentPath === '/services' || currentPath.startsWith('/services/')
      || currentPath === '/brands' || currentPath.startsWith('/brands/')
      || isTechnicalReviewPath;
    if (isToolsOrInsights || (isEngineerHost && currentPath === '/' && !userType)) return;

    const isPublicPath = portalTarget === 'public' && ((currentPath === '/')
      || currentPath === '/services' || currentPath.startsWith('/services/')
      || currentPath === '/brands' || currentPath.startsWith('/brands/')
      || isTechnicalReviewPath);
    const title = isCn ? 'SAGEMRO 智能服务系统' : 'SAGEMRO Service OS';
    const description = isCn
      ? 'SAGEMRO 面向激光切割与金属成型设备，帮助客户整理问题、连接合格工程师并沉淀服务记录。'
      : 'SAGEMRO helps industrial equipment users organize service needs, connect with qualified field engineers, and keep service records clear.';
    const canonicalHost = isCn ? 'https://sagemro.cn' : 'https://sagemro.com';
    const publicHost = isEngineerHost ? canonicalHost.replace('://', '://engineer.') : canonicalHost;
    setSeoMetadata({
      title: isPublicPath ? title : 'SAGEMRO Service Workspace',
      description: isPublicPath ? description : 'Private SAGEMRO workspace.',
      canonical: isPublicPath ? `${publicHost}/` : null,
      lang: isCn ? 'zh-CN' : 'en',
      robots: isPublicPath ? 'index,follow' : 'noindex,nofollow,noarchive',
      structuredData: isPublicPath ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SAGEMRO',
        url: `${canonicalHost}/`,
        email: 'support@sagemro.com',
      } : null,
    });
  }, [currentPath, isCn, isEngineerHost, isTechnicalReviewPath, portalTarget, userType]);

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

  const {
    conversations,
    createConversation,
    updateConversation,
    deleteConversation,
    renameConversation,
    getConversation,
    refresh: refreshConversations,
  } = useConversations({ isAuthenticated: Boolean(currentUser && userType) });

  const {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadMessages,
  } = useChat();

  const currentConversation = conversationId ? getConversation(conversationId) : null;
  const currentTitle = currentConversation?.title || (isCn ? '服务对话' : 'Service Chat');

  const handleNewChat = useCallback(() => {
    clearMessages();
    setSidebarOpen(false);
    setHistoryModalOpen(false);
  }, [clearMessages]);

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
  }, [conversationId, currentUser, clearMessages, loadMessages]);

  // 发送消息：登录用户走服务端会话，访客只落本地缓存。
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

    await sendMessage(content, images, convId, requestId, content);

    if (!currentUser) {
      setTimeout(() => {
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
    } else {
      refreshConversations();
    }
  }, [conversationId, createConversation, currentUser, refreshConversations, sendMessage, updateConversation]);

  const handleDeleteConversation = useCallback(async (id) => {
    await deleteConversation(id);
    if (id === conversationId) clearMessages();
    if (!currentUser) localStorage.removeItem(`sagemro_messages_${id}`);
  }, [deleteConversation, conversationId, currentUser, clearMessages]);

  const handleRenameConversation = useCallback(async (id, title) => {
    await renameConversation(id, title);
  }, [renameConversation]);

  const handleLoginSuccess = useCallback((userData) => {
    authVersionRef.current += 1;
    setCurrentUser(userData.user);
    setUserType(userData.userType);
    setLoginModalOpen(false);
    if (conversationId) {
      getConversationApi(conversationId)
        .then((data) => loadMessages(data.messages || [], conversationId))
        .catch(() => clearMessages());
    }
  }, [conversationId, loadMessages, clearMessages]);

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
  }, []);

  // 监听 401 自动登出事件（由 services/api.js 的 fetch 拦截器触发）
  useEffect(() => {
    const handler = () => {
      setCurrentUser(null);
      setUserType(null);
      setLoginModalOpen(true);
    };
    window.addEventListener('sagemro:auth-expired', handler);
    return () => window.removeEventListener('sagemro:auth-expired', handler);
  }, []);

  // 公开营销页的「咨询」入口（PublicSiteShell）通过事件打开本表单，避免逐页透传回调。
  useEffect(() => {
    const openConsultation = () => setConsultationOpen(true);
    window.addEventListener('sagemro:open-consultation', openConsultation);
    return () => window.removeEventListener('sagemro:open-consultation', openConsultation);
  }, []);

  const openLegal = useCallback((tab = 'agreement') => {
    setLegalInitialTab(tab);
    setLegalModalOpen(true);
  }, []);

  const openConsultation = useCallback(() => setConsultationOpen(true), []);

  const navigateHome = useCallback(() => {
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
  }, []);

  const loginModal = loginModalOpen ? (
    <LoginModal
      isOpen={loginModalOpen}
      onClose={() => setLoginModalOpen(false)}
      onLoginSuccess={handleLoginSuccess}
      onOpenLegal={openLegal}
      conversationId={conversationId}
    />
  ) : null;

  const legalModal = (
    <LegalModal
      isOpen={legalModalOpen}
      onClose={() => setLegalModalOpen(false)}
      initialTab={legalInitialTab}
    />
  );

  const consultationModal = (
    <ConsultationForm isOpen={consultationOpen} isCn={isCn} onClose={() => setConsultationOpen(false)} />
  );

  // ---------- 工程师站：招募落地页 + 申请表单 ----------
  if (isEngineerHost) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <EngineerRecruitingPage onOpenLogin={() => setLoginModalOpen(true)} />
          {loginModal}
          {legalModal}
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (portalTarget === 'blocked') {
    return <NotFoundPage isCn={isCn} />;
  }

  const isToolsPath = portalTarget === 'public' && (currentPath === '/tools' || currentPath.startsWith('/tools/'));
  const isInsightsPath = portalTarget === 'public' && (currentPath === '/insights' || currentPath.startsWith('/insights/'));
  const isBrandsPath = portalTarget === 'public' && (currentPath === '/brands' || currentPath.startsWith('/brands/'));
  const serviceRoute = portalTarget === 'public' ? getServicePageRoute(currentPath) : null;
  const isServicesPath = serviceRoute !== null;
  const isKnownPublicPath = currentPath === '/' || isToolsPath || isInsightsPath || isBrandsPath || isServicesPath || isTechnicalReviewPath;

  if (portalTarget === 'public' && !isKnownPublicPath) {
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
          {legalModal}
          {loginModal}
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
            onStartDiagnosis={openConsultation}
            onOpenServiceRequest={openConsultation}
          />
          {legalModal}
          {consultationModal}
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
            onStartDiagnosis={openConsultation}
            onOpenServiceRequest={openConsultation}
            onOpenLegal={openLegal}
          />
          {legalModal}
          {consultationModal}
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
          {legalModal}
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
          {legalModal}
        </Suspense>
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  if (currentPath === '/' && portalTarget === 'public') {
    return (
      <ErrorBoundary>
        <PublicHomePage isCn={isCn} onOpenLegal={openLegal} />
        <Suspense fallback={null}>{legalModal}</Suspense>
        {consultationModal}
        <FeedbackHost />
      </ErrorBoundary>
    );
  }

  // 工程师账号在客户端登录：工作台已下线，只保留招募入口与联系方式。
  if (userType === 'engineer') {
    const retired = isCn
      ? {
          title: '工程师工作台已下线',
          body: 'SAGEMRO 已把系统收敛为主站、AI 门户与知识库。工程师账号不再提供服务工单工作台。如需继续合作，请通过招募页面留下资料，或邮件联系 support@sagemro.com。',
          cta: '查看工程师招募',
          signOut: '退出当前账号',
          home: '返回首页',
        }
      : {
          title: 'The engineer workspace has been retired',
          body: 'SAGEMRO now runs as a marketing site, an AI portal, and a knowledge console. Engineer accounts no longer have a service work-order workspace. To keep working with us, use the recruiting page or email support@sagemro.com.',
          cta: 'Open the engineer recruiting page',
          signOut: 'Sign out',
          home: 'Back to home',
        };

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)] px-5 text-[var(--color-text-primary)]">
        <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-primary)]">SAGEMRO</div>
          <h1 className="mt-2 text-xl font-semibold">{retired.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{retired.body}</p>
          <div className="mt-5 flex flex-col gap-2">
            <a href={ENGINEER_PORTAL_URL[isCn ? 'cn' : 'com']} className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white">{retired.cta}</a>
            <button type="button" onClick={navigateHome} className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{retired.home}</button>
            <button type="button" onClick={handleLogout} className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{retired.signOut}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- AI 门户（ai.sagemro.com / ai.sagemro.cn）：AI 对话 ----------
  if (!isPortalHost) {
    return <NotFoundPage isCn={isCn} />;
  }

  if (!authReady) {
    return <div className="min-h-[100dvh] bg-[var(--color-bg)]" aria-busy="true" />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        conversations={conversations}
        currentConversationId={conversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenHistory={() => setHistoryModalOpen(true)}
        onOpenConsultation={openConsultation}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

      <ErrorBoundary>
        <Suspense fallback={null}>
          <Modal
            isOpen={historyModalOpen}
            onClose={() => setHistoryModalOpen(false)}
            title={isCn ? '会话历史' : 'Conversation History'}
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
        </Suspense>
      </ErrorBoundary>

      {loginModal}
      {legalModal}
      {consultationModal}
      <FeedbackHost />
    </div>
  );
}

export default App;
