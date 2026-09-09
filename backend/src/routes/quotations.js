import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { sendQuotationPdf, quotationWhatsAppMessage, waLink } from '../pdf.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function loadQuotation(id) {
  const q = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
  if (q) q.items = JSON.parse(q.items || '[]');
  return q;
}

// List quotations
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM quotations ORDER BY created_at DESC').all();
  rows.forEach((q) => (q.items = JSON.parse(q.items || '[]')));
  res.json({ quotations: rows });
});

// Create a quotation
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.client_name) return res.status(400).json({ error: 'client_name is required' });
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return res.status(400).json({ error: 'Add at least one item to the quotation' });

  const rows = items.map((it) => ({
    description: String(it.description || '').trim(),
    qty: Number(it.qty) || 1,
    unit_price: Number(it.unit_price) || 0,
  }));
  const subtotal = rows.reduce((s, r) => s + r.qty * r.unit_price, 0);
  const discount = Number(b.discount) || 0;
  const tax = Number(b.tax) || 0;
  const total = subtotal - discount + tax;

  const info = db
    .prepare(
      `INSERT INTO quotations (client_name, client_phone, client_email, event_name, event_date,
                               venue, items, notes, subtotal, discount, tax, total, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.client_name).trim(),
      b.client_phone || null,
      b.client_email || null,
      b.event_name || null,
      b.event_date || null,
      b.venue || null,
      JSON.stringify(rows),
      b.notes || null,
      subtotal,
      discount,
      tax,
      total,
      req.user.id
    );

  const id = Number(info.lastInsertRowid);
  const number = `QT-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
  db.prepare('UPDATE quotations SET quotation_number = ? WHERE id = ?').run(number, id);

  res.status(201).json({ quotation: loadQuotation(id) });
});

// Quotation detail
router.get('/:id', (req, res) => {
  const q = loadQuotation(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quotation not found' });
  res.json({ quotation: q });
});

// PDF download
router.get('/:id/pdf', (req, res) => {
  const q = loadQuotation(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quotation not found' });
  sendQuotationPdf(res, q);
});

// WhatsApp share link with the quotation summary text
router.get('/:id/whatsapp', (req, res) => {
  const q = loadQuotation(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quotation not found' });
  if (!q.client_phone) return res.status(400).json({ error: 'This quotation has no client phone number' });
  res.json({ url: waLink(q.client_phone, quotationWhatsAppMessage(q)), message: quotationWhatsAppMessage(q) });
});

export default router;