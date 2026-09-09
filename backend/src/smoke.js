/* End-to-end smoke test: boots the API on a random port and exercises every endpoint. */
import app from './index.js';

const PORT = 4199;
const BASE = `http://localhost:${PORT}`;
let failures = 0;

function check(label, cond, extra = '') {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label} ${extra}`);
  }
}

async function main() {
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  const j = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON (e.g. PDF) */
    }
    return { status: res.status, data, text };
  };

  try {
    console.log('Auth');
    const bad = await j('/api/auth/login', { method: 'POST', body: { email: 'admin@eventplanner.com', password: 'wrong' } });
    check('login rejects wrong password', bad.status === 401);
    const admin = await j('/api/auth/login', { method: 'POST', body: { email: 'admin@eventplanner.com', password: 'admin123' } });
    check('admin login works', admin.status === 200 && !!admin.data.token, admin.text);
    const adminToken = admin.data.token;
    const ravi = await j('/api/auth/login', { method: 'POST', body: { email: 'ravi@eventplanner.com', password: 'ravi123' } });
    check('employee login works', ravi.status === 200);
    const raviToken = ravi.data.token;
    const noAuth = await j('/api/users');
    check('no token is rejected', noAuth.status === 401);

    console.log('Users (admin only)');
    const forbidden = await j('/api/users', { token: raviToken });
    check('employee cannot list users', forbidden.status === 403);
    const created = await j('/api/users', { method: 'POST', token: adminToken, body: { name: 'Test User', email: 'test@eventplanner.com', password: 'test123', role: 'employee' } });
    check('admin creates user', created.status === 201 && !!created.data.user.id, created.text);
    const users = await j('/api/users', { token: adminToken });
    check('user list contains new user', users.data.users.some((u) => u.email === 'test@eventplanner.com'));

    console.log('Works');
    const worksAll = await j('/api/works', { token: adminToken });
    check('admin sees all works', worksAll.data.works.length >= 4, String(worksAll.data.works.length));
    const worksRavi = await j('/api/works', { token: raviToken });
    check('employee sees only own works', worksRavi.data.works.every((w) => w.assignee_count > 0) && worksRavi.data.works.length < worksAll.data.works.length);
    const filtered = await j('/api/works?status=completed', { token: adminToken });
    check('status filter works', filtered.data.works.every((w) => w.status === 'completed'));

    const tomorrow = new Date(Date.now() + 86400000);
    const iso = (d) => d.toISOString().slice(0, 10);
    const newWork = await j('/api/works', {
      method: 'POST',
      token: adminToken,
      body: {
        title: 'Smoke Test Event',
        client_name: 'Smoke Client',
        client_phone: '+91 90000 00000',
        venue: 'Test Hall',
        work_date: iso(tomorrow),
        start_time: '10:00',
        reminder_time: '09:00',
        assignee_ids: [ravi.data.user.id],
      },
    });
    check('create work computes reminders', newWork.status === 201 && !!newWork.data.work.reminder_at && !!newWork.data.work.reminder_day_before_at, newWork.text);
    const workId = newWork.data.work.id;
    check('reminder day-before is one day earlier', newWork.data.work.reminder_day_before_at.slice(0, 10) === iso(new Date(tomorrow.getTime() - 86400000)));

    const detail = await j(`/api/works/${workId}`, { token: raviToken });
    check('assigned employee can view detail', detail.status === 200 && detail.data.work.assignees.length === 1);

    console.log('Close work + reports');
    const complete = await j(`/api/works/${workId}/complete`, {
      method: 'POST',
      token: adminToken,
      body: { payment_amount: 50000, expense_amount: 20000, payment_notes: 'paid' },
    });
    check('admin completes work with payment', complete.status === 200 && complete.data.work.status === 'completed' && complete.data.work.payment_amount === 50000, complete.text);
    const report = await j('/api/reports?range=yearly', { token: adminToken });
    check('yearly report has summary', report.status === 200 && report.data.summary.income > 0, report.text);
    const reportDenied = await j('/api/reports', { token: raviToken });
    check('employee cannot access reports', reportDenied.status === 403);

    console.log('Quotations + PDF');
    const quote = await j('/api/quotations', {
      method: 'POST',
      token: adminToken,
      body: {
        client_name: 'Smoke Client',
        client_phone: '+91 90000 00000',
        event_name: 'Test Event',
        items: [
          { description: 'Decor', qty: 1, unit_price: 10000 },
          { description: 'Catering', qty: 50, unit_price: 500 },
        ],
        discount: 1000,
        notes: 'Test notes',
      },
    });
    check('quotation created with number', quote.status === 201 && /^QT-/.test(quote.data.quotation.quotation_number), quote.text);
    const qid = quote.data.quotation.id;
    const pdf = await fetch(`${BASE}/api/quotations/${qid}/pdf`, { headers: { Authorization: `Bearer ${adminToken}` } });
    check('PDF is generated', pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf'));
    const wa = await j(`/api/quotations/${qid}/whatsapp`, { token: adminToken });
    check('WhatsApp link generated', wa.status === 200 && wa.data.url.startsWith('https://wa.me/'), wa.text);
  } catch (err) {
    console.error('Smoke test crashed:', err);
    failures += 1;
  } finally {
    server.close();
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed ✅');
  process.exit(0);
}

main();