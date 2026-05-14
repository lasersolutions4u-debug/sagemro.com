// Helper: accept work order and submit pricing via API
const API = 'https://sagemro-api.lasersolutions4u.workers.dev';

async function api(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function main() {
  // 1. Login as engineer
  console.log('Logging in as engineer...');
  const engLogin = await api('/api/auth/login', 'POST', {
    phone: '13900018888',
    password: '123456',
  });
  if (!engLogin.token) {
    console.error('Engineer login failed:', engLogin);
    process.exit(1);
  }
  const engToken = engLogin.token;
  console.log('Engineer logged in, id:', engLogin.user?.id);

  // 2. Find WO-20260514-986
  console.log('Getting engineer tickets...');
  const tickets = await api('/api/engineers/tickets', 'GET', null, engToken);
  const wo = tickets.work_orders?.find(w => w.order_no === 'WO-20260514-986');
  if (!wo) {
    console.error('WO-20260514-986 not found');
    tickets.work_orders?.forEach(w => console.log(' -', w.order_no, w.status));
    process.exit(1);
  }
  console.log('Found WO:', wo.order_no, 'status:', wo.status);

  // 3. Accept if pending
  if (wo.status === 'pending' && !wo.engineer_id) {
    console.log('Accepting work order...');
    const r = await api('/api/engineers/tickets/accept', 'POST', {
      work_order_id: wo.id,
    }, engToken);
    console.log('Accept result:', r.success ? 'OK' : r);
  }

  // 4. Submit pricing
  console.log('Submitting pricing...');
  const pricingData = {
    labor_fee: 1500,
    parts_fee: 800,
    travel_fee: 300,
    other_fee: 0,
    parts_detail: '',
  };
  const pricingResult = await api(`/api/workorders/${wo.id}/pricing`, 'POST', pricingData, engToken);
  console.log('Pricing result:', pricingResult);

  // 5. Get the customer token
  console.log('\nLogging in as customer...');
  const custLogin = await api('/api/auth/login', 'POST', {
    phone: '13900008888',
    password: '123456',
  });
  const custToken = custLogin.token;
  console.log('Customer logged in, id:', custLogin.user?.id);

  // 6. Confirm pricing
  console.log('Confirming pricing...');
  const confirmResult = await api(`/api/workorders/${wo.id}/pricing/confirm`, 'POST', {}, custToken);
  console.log('Confirm result:', confirmResult);

  // 7. Pay
  console.log('Paying...');
  const payResult = await api(`/api/workorders/${wo.id}/pay`, 'POST', {}, custToken);
  console.log('Pay result:', payResult);

  console.log('\nDone! WO-20260514-986 should now be in_service or resolved.');
}

main().catch(console.error);
