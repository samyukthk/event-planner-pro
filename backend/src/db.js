import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(process.env.DB_PATH || path.join(dataDir, 'eventplanner.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee', -- 'admin' | 'employee'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS works (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT NOT NULL,
  description          TEXT,
  client_name          TEXT NOT NULL,
  client_phone         TEXT,
  client_email         TEXT,
  venue                TEXT,
  work_date            TEXT NOT NULL,             -- YYYY-MM-DD
  start_time           TEXT,                      -- HH:MM
  reminder_time        TEXT,                      -- HH:MM when the on-day reminder fires
  reminder_at          TEXT,                      -- ISO local datetime: on work day at reminder_time
  reminder_day_before_at TEXT,                    -- ISO local datetime: one day before at reminder_time
  status               TEXT NOT NULL DEFAULT 'assigned', -- 'assigned' | 'completed'
  created_by           INTEGER NOT NULL REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at         TEXT,
  payment_amount       REAL,                      -- total received from client
  expense_amount       REAL,                      -- total expenses for this work
  payment_notes        TEXT
);

CREATE TABLE IF NOT EXISTS work_assignees (
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, user_id)
);

CREATE TABLE IF NOT EXISTS work_documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id       INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  original_name TEXT,
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_number TEXT UNIQUE,
  client_name      TEXT NOT NULL,
  client_phone     TEXT,
  client_email     TEXT,
  event_name       TEXT,
  event_date       TEXT,
  venue            TEXT,
  items            TEXT NOT NULL, -- JSON array [{ description, qty, unit_price }]
  notes            TEXT,
  subtotal         REAL NOT NULL,
  discount         REAL NOT NULL DEFAULT 0,
  tax              REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL,
  created_by       INTEGER NOT NULL REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_payments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount             REAL NOT NULL,                -- payment given to the user
  given_on           TEXT NOT NULL,               -- date payment was handed over: YYYY-MM-DD
  given_at           TEXT,                        -- optional time the payment was handed over: HH:MM
  source             TEXT,                        -- e.g. 'work settlement', 'advance', 'bonus', 'other'
  notes              TEXT,
  created_by         INTEGER NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/** Convert an ISO/local datetime string like "2026-09-08T09:00:00" into a sortable key. */
export function localKey(dt) {
  return (dt || '').slice(0, 19);
}