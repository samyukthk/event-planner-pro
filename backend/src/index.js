import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import userPaymentsRoutes from './routes/user-payments.js';
import workRoutes, { uploadsDir } from './routes/works.js';
import reportRoutes from './routes/reports.js';
import quotationRoutes from './routes/quotations.js';
import { seedBackgroundJobs } from './jobs/seeds.js';

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded work documents
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', userPaymentsRoutes);
app.use('/api/works', workRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/quotations', quotationRoutes);

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;

// Start the server only when run directly (node src/index.js)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, async () => {
    console.log(`Event Planner API listening on http://localhost:${PORT}`);
    const counts = {
      users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
      works: db.prepare('SELECT COUNT(*) c FROM works').get().c,
      quotations: db.prepare('SELECT COUNT(*) c FROM quotations').get().c,
    };
    console.log('DB counts:', counts);

    // Fresh database (e.g. first boot on a new host) → seed demo users/works
    if (counts.users === 0) {
      try {
        await import('./seed.js');
        console.log('Auto-seeded demo data (fresh DB).');
      } catch (e) {
        console.error('Auto-seed failed:', e);
      }
    }

    try {
      seedBackgroundJobs();
    } catch (e) {
      console.error('Background jobs failed:', e);
    }
  });
}