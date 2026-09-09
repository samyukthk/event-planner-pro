import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { computeReminders } from './routes/works.js';

const hash = (pw) => bcrypt.hashSync(pw, 10);

function upsertUser(name, email, phone, password, role) {
  const exists = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email);
  if (exists) return exists.id;
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, phone, hash(password), role);
  return Number(info.lastInsertRowid);
}

const adminId = upsertUser('Admin', 'admin@eventplanner.com', '+91 90000 00001', 'admin123', 'admin');
upsertUser('Subin', 'subin@desireevents', '', 'subin123', 'admin');
const raviId = upsertUser('Ravi Kumar', 'ravi@eventplanner.com', '+91 90000 00002', 'ravi123', 'employee');
const priyaId = upsertUser('Priya Sharma', 'priya@eventplanner.com', '+91 90000 00003', 'priya123', 'employee');

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function upsertWork(title, opts) {
  const exists = db.prepare('SELECT id FROM works WHERE title = ?').get(title);
  if (exists) return exists.id;
  const { work_date, start_time, reminder_time, assignees, status, payment, expense, notes, completedAt } = opts;
  const rem = computeReminders(work_date, reminder_time || start_time || '09:00');
  const info = db
    .prepare(
      `INSERT INTO works (title, description, client_name, client_phone, client_email, venue,
                          work_date, start_time, reminder_time, reminder_at, reminder_day_before_at,
                          status, created_by, completed_at, payment_amount, expense_amount, payment_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      opts.description || '',
      opts.client,
      opts.clientPhone || '+91 90000 00000',
      opts.clientEmail || 'client@example.com',
      opts.venue,
      work_date,
      start_time || '09:00',
      reminder_time || start_time || '09:00',
      rem.reminder_at,
      rem.reminder_day_before_at,
      status || 'assigned',
      adminId,
      completedAt || null,
      payment ?? null,
      expense ?? null,
      notes || null
    );
  const workId = Number(info.lastInsertRowid);
  const ins = db.prepare('INSERT OR IGNORE INTO work_assignees (work_id, user_id) VALUES (?, ?)');
  assignees.forEach((uid) => ins.run(workId, uid));
  return workId;
}

upsertWork('Wedding Decoration - Mehta Family', {
  description: 'Full stage & mandap decoration with floral setup.',
  client: 'Mr. Mehta',
  clientPhone: '+91 98111 22334',
  venue: 'The Grand Palace, Mumbai',
  work_date: iso(addDays(today, 2)),
  start_time: '09:00',
  reminder_time: '08:00',
  assignees: [raviId, priyaId],
});

upsertWork('Corporate Annual Day - TechNova', {
  description: 'Stage, sound, lighting and anchoring for annual day.',
  client: 'TechNova Pvt Ltd',
  clientPhone: '+91 98222 33445',
  venue: 'Hotel Marigold, Pune',
  work_date: iso(addDays(today, 5)),
  start_time: '17:00',
  reminder_time: '16:00',
  assignees: [raviId],
});

upsertWork('Birthday Party - Arjun', {
  description: 'Theme decoration, cake table and games setup.',
  client: 'Mrs. Desai',
  clientPhone: '+91 98333 44556',
  venue: 'Sunset Lawns, Thane',
  work_date: iso(addDays(today, -10)),
  start_time: '18:00',
  reminder_time: '17:00',
  assignees: [priyaId],
  status: 'completed',
  payment: 35000,
  expense: 18500,
  notes: 'Client paid full amount. Catering bill separate.',
  completedAt: iso(addDays(today, -8)),
});

upsertWork('Product Launch - Zenith Motors', {
  description: 'Stage setup, LED wall and photo booth.',
  client: 'Zenith Motors',
  clientPhone: '+91 98444 55667',
  venue: 'JW Convention Centre, Mumbai',
  work_date: iso(addDays(today, -20)),
  start_time: '11:00',
  reminder_time: '10:00',
  assignees: [raviId, priyaId],
  status: 'completed',
  payment: 120000,
  expense: 64000,
  notes: '',
  completedAt: iso(addDays(today, -18)),
});

// Seed one quotation
{
  const exists = db.prepare('SELECT id FROM quotations LIMIT 1').get();
  if (!exists) {
    const items = [
      { description: 'Stage decoration (floral)', qty: 1, unit_price: 45000 },
      { description: 'Lighting & sound', qty: 1, unit_price: 18000 },
      { description: 'Anchor', qty: 1, unit_price: 12000 },
      { description: 'Catering per plate', qty: 150, unit_price: 650 },
    ];
    const subtotal = items.reduce((s, it) => s + it.qty * it.unit_price, 0);
    const discount = 5000;
    const tax = 0;
    const total = subtotal - discount + tax;
    const info = db
      .prepare(
        `INSERT INTO quotations (client_name, client_phone, client_email, event_name, event_date, venue,
                                 items, notes, subtotal, discount, tax, total, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Mr. Mehta',
        '+91 98111 22334',
        'mehta@example.com',
        'Wedding of daughter - Mehta Family',
        iso(addDays(today, 2)),
        'The Grand Palace, Mumbai',
        JSON.stringify(items),
        'Prices include setup and takedown. 50% advance to confirm booking.',
        subtotal,
        discount,
        tax,
        total,
        adminId
      );
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE quotations SET quotation_number = ? WHERE id = ?').run(`QT-${today.getFullYear()}-${String(id).padStart(4, '0')}`, id);
  }
}

console.log('Seed complete.');
console.log('  Subin  : subin@desireevents / subin123 (admin)');
console.log('  Admin  : admin@eventplanner.com / admin123');
console.log('  Ravi   : ravi@eventplanner.com / ravi123');
console.log('  Priya  : priya@eventplanner.com / priya123');