import { db } from '../db.js';

const p2 = (n) => String(n).padStart(2, '0');

const fmt = (dt) =>
  `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}T${p2(dt.getHours())}:${p2(dt.getMinutes())}:00`;

/**
 * Backfill job: recompute reminder_at / reminder_day_before_at for assigned works
 * that are missing them (e.g. rows created before the reminder feature existed).
 * Uses the same local-time logic as computeReminders() in routes/works.js.
 */
export function localizeDates() {
  const rows = db
    .prepare(
      `SELECT id, work_date, COALESCE(reminder_time, start_time, '09:00') AS reminder_time
         FROM works
        WHERE status = 'assigned'
          AND (reminder_at IS NULL OR reminder_at = ''
               OR reminder_day_before_at IS NULL OR reminder_day_before_at = '')`
    )
    .all();

  const update = db.prepare(
    'UPDATE works SET reminder_at = ?, reminder_day_before_at = ? WHERE id = ?'
  );

  for (const row of rows) {
    const [y, m, d] = String(row.work_date).split('-').map(Number);
    const [hh, mm] = String(row.reminder_time).split(':').map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) continue;
    update.run(
      fmt(new Date(y, m - 1, d, hh, mm, 0)),
      fmt(new Date(y, m - 1, d - 1, hh, mm, 0)),
      row.id,
    );
  }

  return rows.length;
}
