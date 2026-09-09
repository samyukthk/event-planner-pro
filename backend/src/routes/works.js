import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { publicUser, requireAuth, requireAdmin } from '../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname || '')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const p2 = (n) => String(n).padStart(2, '0');

/** Compute local reminder datetimes for the on-day and one-day-before reminders. */
export function computeReminders(workDate, reminderTime) {
  const [y, m, d] = workDate.split('-').map(Number);
  const [hh, mm] = String(reminderTime || '09:00').split(':').map(Number);
  const fmt = (dt) =>
    `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}T${p2(dt.getHours())}:${p2(dt.getMinutes())}:00`;
  return {
    reminder_at: fmt(new Date(y, m - 1, d, hh, mm, 0)),
    reminder_day_before_at: fmt(new Date(y, m - 1, d - 1, hh, mm, 0)),
  };
}

/** Load a work together with assignees (coworkers) and documents. */
function loadWork(id) {
  const work = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!work) return null;
  const assignees = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role
       FROM work_assignees wa JOIN users u ON u.id = wa.user_id
       WHERE wa.work_id = ? ORDER BY u.name`
    )
    .all(id);
  const documents = db.prepare('SELECT * FROM work_documents WHERE work_id = ? ORDER BY uploaded_at DESC').all(id);
  return { ...work, assignees, documents };
}

function listWorksFor(user, query) {
  const { status, from, to, assignee_id } = query;
  const where = [];
  const params = [];

  if (user.role !== 'admin') {
    where.push('w.id IN (SELECT work_id FROM work_assignees WHERE user_id = ?)');
    params.push(user.id);
  } else if (assignee_id) {
    where.push('w.id IN (SELECT work_id FROM work_assignees WHERE user_id = ?)');
    params.push(Number(assignee_id));
  }
  if (status && ['assigned', 'completed'].includes(status)) {
    where.push('w.status = ?');
    params.push(status);
  }
  if (from && DATE_RE.test(from)) {
    where.push('w.work_date >= ?');
    params.push(from);
  }
  if (to && DATE_RE.test(to)) {
    where.push('w.work_date <= ?');
    params.push(to);
  }

  const sql = `
    SELECT w.*,
           (SELECT COUNT(*) FROM work_assignees wa WHERE wa.work_id = w.id) AS assignee_count,
           (SELECT GROUP_CONCAT(u.name, ', ')
              FROM work_assignees wa JOIN users u ON u.id = wa.user_id
             WHERE wa.work_id = w.id) AS coworker_names
    FROM works w
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY w.work_date DESC, w.created_at DESC`;
  return db.prepare(sql).all(...params);
}

// List works (employees see only their own, admins see all; supports filters)
router.get('/', (req, res) => {
  res.json({ works: listWorksFor(req.user, req.query) });
});

// Work detail with coworkers + documents
router.get('/:id', (req, res) => {
  const work = loadWork(Number(req.params.id));
  if (!work) return res.status(404).json({ error: 'Work not found' });
  if (req.user.role !== 'admin' && !work.assignees.some((a) => a.id === req.user.id)) {
    return res.status(403).json({ error: 'You are not assigned to this work' });
  }
  res.json({ work });
});

// Create a work (admin only)
router.post('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.client_name || !b.work_date) {
    return res.status(400).json({ error: 'title, client_name and work_date are required' });
  }
  if (!DATE_RE.test(b.work_date)) return res.status(400).json({ error: 'work_date must be YYYY-MM-DD' });
  if (b.start_time && !TIME_RE.test(b.start_time)) return res.status(400).json({ error: 'start_time must be HH:MM' });
  if (b.reminder_time && !TIME_RE.test(b.reminder_time)) return res.status(400).json({ error: 'reminder_time must be HH:MM' });

  const reminders = computeReminders(b.work_date, b.reminder_time || b.start_time || '09:00');
  const assigneeIds = Array.isArray(b.assignee_ids)
    ? [...new Set(b.assignee_ids.map((x) => Number(x)).filter((x) => Number.isInteger(x)))]
    : [];

  const info = db
    .prepare(
      `INSERT INTO works (title, description, client_name, client_phone, client_email, venue,
                          work_date, start_time, reminder_time, reminder_at, reminder_day_before_at,
                          status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?)`
    )
    .run(
      String(b.title).trim(),
      b.description || null,
      String(b.client_name).trim(),
      b.client_phone || null,
      b.client_email || null,
      b.venue || null,
      b.work_date,
      b.start_time || null,
      b.reminder_time || null,
      reminders.reminder_at,
      reminders.reminder_day_before_at,
      req.user.id
    );

  const workId = Number(info.lastInsertRowid);
  const insertA = db.prepare('INSERT INTO work_assignees (work_id, user_id) VALUES (?, ?)');
  const tx = db.transaction(() => assigneeIds.forEach((uid) => insertA.run(workId, uid)));
  tx();

  res.status(201).json({ work: loadWork(workId) });
});

// Update a work (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const work = loadWork(Number(req.params.id));
  if (!work) return res.status(404).json({ error: 'Work not found' });
  const b = req.body || {};
  const fields = ['title', 'description', 'client_name', 'client_phone', 'client_email', 'venue', 'work_date', 'start_time', 'reminder_time'];
  const allowed = {};
  for (const f of fields) if (b[f] !== undefined) allowed[f] = b[f];

  if (allowed.work_date !== undefined && !DATE_RE.test(allowed.work_date)) {
    return res.status(400).json({ error: 'work_date must be YYYY-MM-DD' });
  }
  if (allowed.start_time !== undefined && allowed.start_time && !TIME_RE.test(allowed.start_time)) {
    return res.status(400).json({ error: 'start_time must be HH:MM' });
  }
  if (allowed.reminder_time !== undefined && allowed.reminder_time && !TIME_RE.test(allowed.reminder_time)) {
    return res.status(400).json({ error: 'reminder_time must be HH:MM' });
  }

  const newDate = allowed.work_date || work.work_date;
  const newReminderTime = allowed.reminder_time !== undefined ? allowed.reminder_time : work.reminder_time;
  const reminders = computeReminders(newDate, newReminderTime || allowed.start_time || work.start_time || '09:00');
  allowed.reminder_at = reminders.reminder_at;
  allowed.reminder_day_before_at = reminders.reminder_day_before_at;

  if (Object.keys(allowed).length) {
    const cols = Object.keys(allowed).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE works SET ${cols} WHERE id = ?`).run(...Object.values(allowed), work.id);
  }

  if (Array.isArray(b.assignee_ids)) {
    const ids = [...new Set(b.assignee_ids.map((x) => Number(x)).filter((x) => Number.isInteger(x)))];
    const del = db.prepare('DELETE FROM work_assignees WHERE work_id = ?');
    const ins = db.prepare('INSERT INTO work_assignees (work_id, user_id) VALUES (?, ?)');
    const tx = db.transaction(() => {
      del.run(work.id);
      ids.forEach((uid) => ins.run(work.id, uid));
    });
    tx();
  }

  res.json({ work: loadWork(work.id) });
});

// Close a work with payment & expense details (admin only)
router.post('/:id/complete', requireAdmin, (req, res) => {
  const work = loadWork(Number(req.params.id));
  if (!work) return res.status(404).json({ error: 'Work not found' });
  if (work.status === 'completed') return res.status(400).json({ error: 'Work is already completed' });
  const b = req.body || {};
  const paymentAmount = b.payment_amount === undefined || b.payment_amount === null || b.payment_amount === '' ? null : Number(b.payment_amount);
  const expenseAmount = b.expense_amount === undefined || b.expense_amount === null || b.expense_amount === '' ? null : Number(b.expense_amount);
  if (paymentAmount !== null && Number.isNaN(paymentAmount)) return res.status(400).json({ error: 'Invalid payment_amount' });
  if (expenseAmount !== null && Number.isNaN(expenseAmount)) return res.status(400).json({ error: 'Invalid expense_amount' });

  db.prepare(
    `UPDATE works SET status = 'completed', completed_at = datetime('now', 'localtime'),
                      payment_amount = ?, expense_amount = ?, payment_notes = ? WHERE id = ?`
  ).run(paymentAmount, expenseAmount, b.payment_notes || null, work.id);

  res.json({ work: loadWork(work.id) });
});

// Upload documents for a work (admin only)
router.post('/:id/documents', requireAdmin, upload.array('documents', 10), (req, res) => {
  const work = loadWork(Number(req.params.id));
  if (!work) return res.status(404).json({ error: 'Work not found' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No files uploaded (field name: documents)' });

  const ins = db.prepare('INSERT INTO work_documents (work_id, filename, original_name) VALUES (?, ?, ?)');
  files.forEach((f) => ins.run(work.id, f.filename, f.originalname));
  res.status(201).json({ work: loadWork(work.id) });
});

// Delete a document (admin only)
router.delete('/:id/documents/:docId', requireAdmin, (req, res) => {
  const doc = db.prepare('SELECT * FROM work_documents WHERE id = ?').get(Number(req.params.docId));
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  db.prepare('DELETE FROM work_documents WHERE id = ?').run(doc.id);
  try {
    fs.unlinkSync(path.join(uploadsDir, doc.filename));
  } catch {
    /* file already gone */
  }
  res.json({ ok: true });
});

export default router;
export { uploadsDir };