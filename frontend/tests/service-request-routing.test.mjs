import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the application owns one service-request page route and no runtime work-order modal entry', async () => {
  const [app, sidebar, page] = await Promise.all([
    read('src/App.jsx'),
    read('src/components/Sidebar/Sidebar.jsx'),
    read('src/components/ServiceRequest/ServiceRequestPage.jsx'),
  ]);

  assert.match(app, /const ServiceRequestPage = lazy/);
  assert.match(app, /const isServiceRequestPath = portalTarget === 'customer'[\s\S]{0,120}currentPath === '\/service-request'/);
  assert.match(app, /<ServiceRequestPage[\s\S]*onSubmit=\{handleServiceRequestSubmit\}[\s\S]*isAuthenticated=\{Boolean\(currentUser\) && userType === 'customer'\}[\s\S]*onRequireAuth=\{handleRequireServiceRequestAuth\}/);
  assert.match(app, /const handleServiceRequest = useCallback\(\(\) => \{\s*window\.history\.pushState\(\{\}, '', '\/service-request'\);\s*setCurrentPath\('\/service-request'\);/);
  assert.match(app, /onOpenWorkOrder=\{handleServiceRequest\}/);
  assert.doesNotMatch(app, /setWorkOrderModalOpen\(true\)/);
  assert.doesNotMatch(app, /<WorkOrderModal/);
  assert.doesNotMatch(app, /components\/Sidebar\/WorkOrderModal/);
  assert.match(sidebar, /tool-create-work-order/);
  assert.match(page, /<ServiceRequestFlow/);
});

test('the canonical service request payload is submitted unchanged and attachments finish before success', async () => {
  const app = await read('src/App.jsx');
  const submitSource = app.slice(
    app.indexOf('const handleServiceRequestSubmit = useCallback'),
    app.indexOf('// 删除对话'),
  );

  assert.match(submitSource, /const requestPayload = \{ \.\.\.payload, customer_id \}/);
  assert.match(submitSource, /submitWorkOrderApi\(requestPayload\)/);
  assert.match(submitSource, /payload\.intake/);
  assert.match(submitSource, /uploadWorkOrderAttachment\(workOrder\.id, file\)/);
  assert.doesNotMatch(submitSource, /fullDescription|deviceInfo|设备类型：|品牌：|所在地区：/);
  assert.match(submitSource, /serviceRequestSubmissionRef/);
});

test('authentication is requested only at final submit and requires a second explicit submit', async () => {
  const [flow, page] = await Promise.all([
    read('src/components/ServiceRequest/ServiceRequestFlow.jsx'),
    read('src/components/ServiceRequest/ServiceRequestPage.jsx'),
  ]);
  const submitSource = flow.slice(flow.indexOf('const handleSubmit = async'), flow.indexOf('if (submitted)'));

  assert.match(flow, /isAuthenticated/);
  assert.match(flow, /onRequireAuth/);
  assert.match(flow, /authConfirmationRequired/);
  assert.match(submitSource, /saveServiceRequestDraft\(storage, resolvedMarket, \{ \.\.\.draft, step: 4 \}\)/);
  assert.match(submitSource, /if \(!isAuthenticated\)[\s\S]*onRequireAuth\?\.\(\)[\s\S]*return;/);
  assert.match(submitSource, /if \(authConfirmationRequired\) setAuthConfirmationRequired\(false\)/);
  assert.match(submitSource, /await onSubmit\(payload, files\)/);
  assert.match(page, /isAuthenticated=\{isAuthenticated\}/);
  assert.match(page, /onRequireAuth=\{onRequireAuth\}/);
});

test('public conversion links allow only bounded service-request presets', async () => {
  const panel = await read('src/components/common/PublicConversionPanel.jsx');

  assert.match(panel, /buildCustomerPortalUrl/);
  assert.match(panel, /mode: 'assist'/);
  assert.match(panel, /mode: 'manual'/);
  assert.match(panel, /href=\{serviceRequestHref\}/);
  assert.match(panel, /href=\{diagnosisHref\}/);
  assert.doesNotMatch(panel, /window\.history\.pushState/);
});
