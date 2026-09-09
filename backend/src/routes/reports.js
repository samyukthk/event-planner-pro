import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { sendReportPdf } from '../pdf.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve the report window from query params. */
function resolveWindow(q) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const range = q.range || 'monthly';
  switch (range) {
    case 'daily': {
      const day = q.date && DATE_RE.test(q.date) ? q.date : iso(today);
      return { range, from: day, to: day };
    }
    case 'yearly': {
      const year = q.year ? Number(q.year) : today.getFullYear();
      return { range, from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'custom': {
      const from = q.from && DATE_RE.test(q.from) ? q.from : iso(addDays(today, -30));
      const to = q.to && DATE_RE.test(q.to) ? q.to : iso(today);
      return { range, from, to };
    }
    default: {
      // monthly
      let month = q.month;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      }
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return { range: 'monthly', from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
    }
  }
}

/** Compute the report (summary + bucketed rows) for a given query window. */
function buildReport(q) {
  const { range, from, to } = resolveWindow(q);
  const bucketKey = (dateStr) => dateStr.slice(0, range === 'yearly' ? 4 : range === 'monthly' ? 7 : 10);

  const rows = db
    .prepare(
      `SELECT work_date, completed_at, payment_amount, expense_amount
         FROM works
        WHERE status = 'completed' AND completed_at IS NOT NULL
          AND date(completed_at) >= ? AND date(completed_at) <= ?`
    )
    .all(from, to);

  // Staff payments (user_payments) — money given to employees, bucketed by given_on.
  const payments = db
    .prepare(
      `SELECT given_on, amount, user_id, u.name AS user_name
         FROM user_payments up
         JOIN users u ON u.id = up.user_id
        WHERE given_on >= ? AND given_on <= ?
        ORDER BY given_on DESC, up.created_at DESC`
    )
    .all(from, to);

  const newBucket = (key) => ({ key, income: 0, expense: 0, profit: 0, works: 0, payments: 0, payment_count: 0 });
  const buckets = new Map();

  for (const r of rows) {
    const key = bucketKey(r.completed_at);
    const b = buckets.get(key) || newBucket(key);
    const income = r.payment_amount || 0;
    const expense = r.expense_amount || 0;
    b.income += income;
    b.expense += expense;
    b.works += 1;
    buckets.set(key, b);
  }

  for (const p of payments) {
    const key = bucketKey(p.given_on);
    const b = buckets.get(key) || newBucket(key);
    b.payments += p.amount || 0;
    b.payment_count += 1;
    buckets.set(key, b);
  }

  const grouped = [...buckets.values()].map((b) => ({ ...b, profit: b.income - b.expense })).sort((a, b) => (a.key < b.key ? 1 : -1));

  const sum = (sel) => grouped.reduce((s, b) => s + sel(b), 0);
  const summary = {
    income: sum((b) => b.income),
    expense: sum((b) => b.expense),
    profit: sum((b) => b.profit),
    works: sum((b) => b.works),
    payments: sum((b) => b.payments),
    payment_count: sum((b) => b.payment_count),
  };

  return { range, from, to, summary, rows: grouped };
}

router.get('/', (req, res) => {
  res.json(buildReport(req.query));
});

// Download the report as a PDF for the current filter window.
router.get('/pdf', (req, res) => {
  const report = buildReport(req.query);
  sendReportPdf(res, report);
});

export default router;