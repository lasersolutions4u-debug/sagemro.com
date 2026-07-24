export async function handlePublicRoute(request, env, ctx, handlers) {
  const { pathname: path } = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return handlers.handleOptions(request, env);
  }
  if (path === '/api/_e2e/mailbox/activation' && request.method === 'GET') {
    return handlers.handleE2EActivationMailbox(request, env);
  }
  if (path === '/api/auth/send-code' && request.method === 'POST') {
    return handlers.handleSendCode(request, env);
  }
  if (path === '/api/auth/register/customer' && request.method === 'POST') {
    return handlers.handleRegisterCustomer(request, env);
  }
  if (path === '/api/auth/register/engineer' && request.method === 'POST') {
    return handlers.handlePublicEngineerRegistrationClosed(request, env);
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    return handlers.handleLogin(request, env);
  }
  if (path === '/api/auth/session' && request.method === 'GET') {
    return handlers.handleAuthSession(request, env);
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    return handlers.handleLogout(request, env);
  }
  if (path === '/api/auth/engineer/activate' && request.method === 'POST') {
    return handlers.handleEngineerActivation(request, env);
  }
  if (path === '/api/auth/reset-password' && request.method === 'POST') {
    return handlers.handleResetPassword(request, env);
  }
  if (path === '/api/auth/send-reset-code' && request.method === 'POST') {
    return handlers.handleSendResetCode(request, env);
  }
  if (path === '/api/chat/upload-image' && request.method === 'POST') {
    return handlers.handleChatUploadImage(request, env);
  }
  if (path === '/api/chat/transcribe' && request.method === 'POST') {
    return handlers.handleChatTranscribe(request, env);
  }
  if (path === '/api/chat' && request.method === 'POST') {
    return handlers.handleChat(request, env);
  }
  if (path === '/api/leads' && request.method === 'POST') {
    return handlers.handleSubmitLead(request, env);
  }
  if (path === '/api/engineer-applications' && request.method === 'POST') {
    return handlers.handleSubmitEngineerApplication(request, env);
  }
  if (path === '/api/analytics/funnel' && request.method === 'POST') {
    return handlers.handleFunnelEvent(request, env);
  }
  if (path === '/health') {
    return handlers.handleHealth(request, env);
  }
  return null;
}
