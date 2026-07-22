import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePublicRoute } from '../src/lib/publicRoutes.js';

function request(path, method = 'GET') {
  return new Request(`https://api.sagemro.com${path}`, { method });
}

function response(label) {
  return new Response(label, { status: 200 });
}

function handlers() {
  return {
    handleOptions: () => response('options'),
    handleE2EActivationMailbox: () => response('mailbox'),
    handleSendCode: () => response('send-code'),
    handleRegisterCustomer: () => response('register'),
    handlePublicEngineerRegistrationClosed: () => response('engineer-closed'),
    handleLogin: () => response('login'),
    handleAuthSession: () => response('session'),
    handleLogout: () => response('logout'),
    handleEngineerActivation: () => response('activate'),
    handleResetPassword: () => response('reset'),
    handleSendResetCode: () => response('send-reset'),
    handleChatUploadImage: () => response('upload'),
    handleChatTranscribe: () => response('transcribe'),
    handleChat: () => response('chat'),
    handleSubmitLead: () => response('lead'),
    handleSubmitEngineerApplication: () => response('application'),
    handleFunnelEvent: () => response('funnel'),
    handleHealth: () => response('health'),
  };
}

test('public route dispatcher selects exact method and path handlers', async () => {
  const routeHandlers = handlers();
  assert.equal(await (await handlePublicRoute(request('/api/auth/login', 'POST'), {}, {}, routeHandlers)).text(), 'login');
  assert.equal(await (await handlePublicRoute(request('/api/chat', 'POST'), {}, {}, routeHandlers)).text(), 'chat');
  assert.equal(await (await handlePublicRoute(request('/api/leads', 'POST'), {}, {}, routeHandlers)).text(), 'lead');
  assert.equal(await (await handlePublicRoute(request('/health'), {}, {}, routeHandlers)).text(), 'health');
  assert.equal(await handlePublicRoute(request('/api/auth/login'), {}, {}, routeHandlers), null);
});

test('public route dispatcher does not claim protected or unknown paths', async () => {
  const routeHandlers = handlers();
  assert.equal(await handlePublicRoute(request('/api/admin/stats', 'GET'), {}, {}, routeHandlers), null);
  assert.equal(await handlePublicRoute(request('/api/unknown', 'GET'), {}, {}, routeHandlers), null);
});
