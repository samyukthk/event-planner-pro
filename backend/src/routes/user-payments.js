import { Router } from 'express';
import { db } from '../db.js';
import { publicUser, requireAuth, requireAdmin } from '../auth.js';

const router = Router();
router.use('/users/:id', requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// List all works assigned to a user (admin only)
router.get('/:id/works', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const works = db
    .prepare(
      `SELECT w.*,\n       (SELECT COUNT(*) FROM work_assignees wa WHERE wa.work_id = w.id) AS assignee_count,\n       (SELECT GROUP_CONCAT(u.name, ', ')\n          FROM work_assignees wa JOIN users u ON u.id = wa.user_id\n         WHERE wa.work_id = w.id) AS coworker_names\n    FROM works w\n   WHERE w.id IN (SELECT work_id FROM work_assignees WHERE user_id = ?)\n   ORDER BY w.work_date DESC, w.created_at DESC`
    )
    .all(userId);

  res.json({
    user: publicUser(user),
    works: works.map((w) => ({
      ...w,
      assignee_count: w.assignee_count,
      coworker_names: w.coworker_names,
    })),
  });
});

// List payments made to a user (admin only)
router.get('/:id/payments', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const payments = db
    .prepare(
      `SELECT up.*, u.name AS given_by_name\n     FROM user_payments up\n     JOIN users u ON u.id = up.created_by\n    WHERE up.user_id = ?\n    ORDER BY up.given_on DESC, up.created_at DESC`
    )
    .all(userId);

  res.json({
    user: publicUser(user),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      given_on: p.given_on,
      given_at: p.given_at,
      source: p.source,
      notes: p.notes,
      given_by: p.created_by,
      given_by_name: p.given_by_name,
      created_at: p.created_at,
    })),
  });
});

// Settle (add) a payment to a user (admin only)
router.post('/:id/payments', requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const b = req.body || {};
  if (b.amount === undefined || b.amount === null || b.amount === '') {
    return res.status(400).json({ error: 'amount is required' });
  }
  const amount = Number(b.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (!DATE_RE.test(String(b.given_on || ''))) {
    return res.status(400).json({ error: 'given_on must be YYYY-MM-DD' });
  }
  if (b.given_at !== undefined && b.given_at !== '' && !TIME_RE.test(String(b.given_at))) {
    return res.status(400).json({ error: 'given_at must be HH:MM' });
  }

  const info = db
    .prepare(
      `INSERT INTO user_payments (user_id, amount, given_on, given_at, source, notes, created_by)\n     VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      amount,
      String(b.given_on).trim(),
      b.given_at || null,
      b.source || 'work settlement',
      b.notes || null,
      req.user.id,
    );

  const payment = db.prepare('SELECT * FROM user_payments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({
    payment: {
      id: payment.id,
      amount: payment.amount,
      given_on: payment.given_on,
      given_at: payment.given_at,
      source: payment.source,
      notes: payment.notes,
      given_by: req.user.id,
      given_by_name: req.user.name,
      created_at: payment.created_at,
    },
  });
});

export default router;