# Event Planner Pro — Employee Management App

> Employee management for event planners. **One codebase for Android, iOS and Web** + a **Node.js REST API**.

This document is a **module-by-module handbook**: every feature is explained with its *user flow* and its *data/API flow*, so anyone can pick up the project and extend it later.

---

## 1. Repository layout

```
├── README.md            ← this handbook
├── backend/             ← Node.js + Express REST API (port 4000)
│   ├── src/
│   │   ├── index.js         Express app + route mounting + static /uploads
│   │   ├── db.js            SQLite connection + full schema
│   │   ├── auth.js          JWT sign/verify + requireAuth + requireAdmin middleware
│   │   ├── constants.js     COMPANY_NAME, CURRENCY (used by PDFs & WhatsApp)
│   │   ├── pdf.js           Quotation PDF generator (pdfkit) + WhatsApp message builder
│   │   ├── seed.js          Creates demo users / works / quotation
│   │   ├── smoke.js         Automated end-to-end API test (19 checks)
│   │   └── routes/
│   │       ├── auth.js          POST login, GET me
│   │       ├── users.js         admin: list / create / delete users
│   │       ├── works.js         works CRUD, assignees, documents, complete
│   │       ├── reports.js       admin: financial reports (daily…yearly)
│   │       └── quotations.js    quotations CRUD + PDF + WhatsApp link
│   ├── data/              SQLite file (auto-created, gitignored)
│   └── uploads/           uploaded work documents (gitignored)
└── mobile/              ← Expo app (React Native + Expo Router + TypeScript)
    ├── app.json
    └── src/
        ├── app/               file-based routes (see §9 Navigation map)
        │   ├── _layout.tsx        root Stack + AuthProvider + notification handler
        │   ├── login.tsx
        │   ├── (tabs)/            bottom-tab screens
        │   ├── work/[id].tsx      work detail + close-work + documents
        │   └── quotation/new.tsx  create quotation
        ├── components/       ui.tsx (primitives), bottom-sheet.tsx, work-card.tsx,
        │                     assign-work-sheet.tsx (popup forms)
        └── lib/              api.ts, auth-context.tsx, notifications.ts,
                              files.ts, format.ts, storage.ts, theme.ts
```

---

## 2. Quick start

```bash
# 1) Backend
cd backend
npm install
npm run seed        # demo data + users
npm run dev         # API on http://localhost:4000

# 2) App (in another terminal)
cd mobile
npm install
npm run web         # browser version on http://localhost:8081
npm run android     # or iOS (see README of template / Expo docs)
```

### 2b. Build an installable APK (for testing on your phone)

The app uses a **dev client** (not Expo Go) because it relies on native modules such as notifications and file sharing. To build an APK that you can sideload onto your Android phone:

```bash
# From the mobile/ folder — first time only:
npx eas-cli login        # optional; needed if you want EAS cloud builds, not for local builds
npm install              # ensure expo-dev-client is present

# Build the dev APK locally (this can take 5–15 minutes, opens Android Studio toolchains):
npx expo run:android --variant debug
```

That command builds the native app **and** installs it on a connected device/emulator. If you only want the APK file (to copy to another phone), build with EAS in non-interactive mode:

```bash
npx eas-cli build \
  --profile development \
  --platform android \
  --local              # builds on this machine, outputs an .apk you can install
```

Either way the APK will connect to the backend on your PC over the LAN (see §11).

**Demo logins** (created by `npm run seed`):

| Name | Email | Password | Role |
| --- | --- | --- | --- |
| Subin | `subin@desireevents` | `subin123` | **admin** |
| Admin | `admin@eventplanner.com` | `admin123` | admin |
| Ravi Kumar | `ravi@eventplanner.com` | `ravi123` | employee |
| Priya Sharma | `priya@eventplanner.com` | `priya123` | employee |

> The app resolves the API automatically in dev (same host that serves the JS bundle). Override with `EXPO_PUBLIC_API_URL` if needed — see §11.

---

## 3. Architecture at a glance

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Mobile / Web app (Expo)     │        │  Backend (Node + Express)    │
│                              │  HTTP  │                              │
│  Screens  →  lib/api.ts ─────┼───────►│  routes/*.js  →  SQLite (db) │
│  (fetch + JWT Bearer token)  │  JSON  │  uploads/  (multer)          │
│                              │        │  PDF       (pdfkit)          │
│  expo-notifications (local   │        │  wa.me     (deep link)       │
│  alarms on this device)      │        │                              │
└──────────────────────────────┘        └──────────────────────────────┘
```

- **Auth model**: every request (except login) sends `Authorization: Bearer <jwt>`. The JWT is stored in AsyncStorage on the device. Two roles: `admin` and `employee`.
- **Who sees what**:

| Screen / API | Employee | Admin |
| --- | --- | --- |
| Dashboard, My Works, Profile | ✅ (own works only) | ✅ (all works) |
| Work detail | ✅ (only works they're assigned to) | ✅ (all) |
| Assign / edit / close work | ❌ | ✅ |
| Reports | ❌ (403) | ✅ |
| Quotations (+ PDF / WhatsApp) | ❌ (403) | ✅ |
| Team (add / delete users) | ❌ (403) | ✅ |

---

## 4. Modules

Each module lists: **Purpose**, **Access**, **User flow**, and **Data/API flow** (what actually happens in code).

---

### Module 1 — Authentication & Roles

- **Purpose**: let users sign in and gate features by role.
- **Access**: public (login only).
- **Files**: `backend/src/routes/auth.js`, `backend/src/auth.js`, `mobile/src/app/login.tsx`, `mobile/src/lib/auth-context.tsx`, `mobile/src/lib/api.ts`.

**User flow**
1. Open app → root layout shows a loader while the stored token is checked against `GET /api/auth/me`.
2. No valid session → redirected to `/login`.
3. Enter email + password → *Sign In*.
4. On success the token + user are saved, session is restored on next launch. On failure an error is shown.

**Data/API flow**
1. `POST /api/auth/login {email, password}` → backend looks up the user, compares `bcrypt` hash, signs a JWT (`expiresIn 30d`), returns `{ token, user }`.
2. App stores `token` in AsyncStorage (`ep_auth_token`) and the user object in React context (`AuthProvider`).
3. Every later API call attaches the token; `GET /api/auth/me` re-validates it at startup.
4. Logout clears storage + context and returns to login.

**Role enforcement happens twice**
- Backend: `requireAuth` (any logged-in user) and `requireAdmin` (admins only) middleware.
- Frontend: admin-only tabs (Reports, Quotations, Team) are hidden for employees; protected screens double-check `user.role`.

---

### Module 2 — Dashboard

- **Purpose**: at-a-glance view of the user's workload.
- **Access**: everyone (employees see their own works, admins see all).
- **Files**: `mobile/src/app/(tabs)/index.tsx`, `mobile/src/components/work-card.tsx`.

**User flow**
1. Dashboard loads and fetches the works list.
2. Shows greeting + the **next upcoming** work in a highlighted card (with venue/time + *View Details*).
3. **Upcoming** list (all assigned works from today onwards, newest first 5).
4. **Recently Completed** (last 3 completed works).
5. Pull-to-refresh; admins get an **Assign New Work** button that opens the bottom-sheet form (3a).
6. While here, the app also **syncs reminder alarms** for the loaded works (see Module 4).

**Data/API flow**
- `GET /api/works` → backend filters by role: employees get `WHERE user is in work_assignees`; admins get everything. Each row already includes `coworker_names` and `assignee_count`.
- The client splits the response into *upcoming* (`status=assigned` and `work_date ≥ today`) and *completed*.

---

### Module 3 — Works (create / list / detail / filters)

#### 3a. Assign a new work (admin)

- **Files**: `mobile/src/components/assign-work-sheet.tsx` (bottom-sheet form), `mobile/src/components/bottom-sheet.tsx`, `backend/src/routes/works.js`, `mobile/src/lib/api.ts`.

**User flow**
1. Dashboard → tap **Assign New Work** → the form slides up from the bottom as an iOS-style **bottom sheet** (grabber, dimmed backdrop, swipe-down/✕ to dismiss).
2. Fill: title, description, venue, client name/phone/email.
3. Schedule: work date, **start time**, **reminder time on the work day**.
4. Pick one or more employees (chips). At least one is required.
5. *Create & Assign Work*.

**Data/API flow**
1. `POST /api/works` with `{ title, …, work_date, start_time, reminder_time, assignee_ids[] }`.
2. Backend validates formats (`YYYY-MM-DD`, `HH:MM`), then calls `computeReminders()` to store two absolute datetimes:
   - `reminder_at` = work date at reminder time
   - `reminder_day_before_at` = the day before at the same time
3. Inserts the work (`status='assigned'`) and links every assignee in `work_assignees`.
4. Returns the full work. When each employee next opens the app, their device schedules the alarms (Module 4).

#### 3b. List works with filters

- **Files**: `mobile/src/app/(tabs)/works.tsx`, backend `GET /api/works`.

**User flow** — chips choose a range + a status:
- Range: **All · Today · This Week · This Month · This Year · Custom**
- Status: **All · Upcoming · Completed**
- Custom shows two date fields (`YYYY-MM-DD` from/to).
- Each card shows date, venue, coworkers, document count; tapping opens the detail.

**Data/API flow**
- The screen builds query params (`status`, `from`, `to`) and calls `GET /api/works?...`.
- Backend composes a parameterized `WHERE` from those filters (safe from SQL injection) and orders by `work_date DESC`.

#### 3c. Work detail + documents

- **Files**: `mobile/src/app/work/[id].tsx`, backend `GET /api/works/:id`, `POST/DELETE /api/works/:id/documents`.

**User flow**
1. Tap any work card → detail screen shows: client info, venue, date/time, description, the two **reminder datetimes**, the **coworkers** list (with avatars), and attached **documents**.
2. Anyone can tap a document's download icon.
3. Admins can **upload** documents (system file picker, multi-file) or **delete** them.

**Data/API flow**
- `GET /api/works/:id` returns the work with `assignees[]` (full users) and `documents[]`.
- Upload: multipart `POST …/documents` (field name `documents`) → multer saves the file to `backend/uploads/` with a random name; the original name is kept in `work_documents`.
- Files are served publicly at `GET /uploads/<filename>`.
- Download on mobile uses `expo-file-system` + `expo-sharing` (opens the share sheet); on web it opens a new tab. See `mobile/src/lib/files.ts`.

---

### Module 4 — Reminders & notifications

- **Purpose**: alarm the assigned employees **one day before** the work and **on the work day at the reminder time** set when the work was created.
- **How it works today**: *local notifications scheduled on each employee's own device* (Expo Notifications). This is the module to upgrade to remote push for production.
- **Files**: `mobile/src/lib/notifications.ts`, `mobile/src/app/(tabs)/index.tsx` (trigger), backend reminder columns in `works`.

**Flow**
1. Admin creates a work with a reminder time → backend stores `reminder_at` and `reminder_day_before_at`.
2. When an employee logs in / opens the Dashboard, the app calls `syncReminders(works)`.
3. For every work assigned to this user that is still `assigned` and whose reminder is in the future:
   - if not scheduled yet → `scheduleNotificationAsync` with a date trigger (stored under a persisted key like `5:on_day`);
   - duplicate schedules are skipped (keys stored in AsyncStorage `ep_scheduled_reminders`).
4. Completed or past works have their pending alarms cancelled.
5. Android asks permission and registers a high-importance channel (`work-reminders`) so alarms sound with vibration.

**Caveats**
- Alarms live on the device that scheduled them — if the employee never opens the app after the work is created, no alarm exists yet.
- Local notification scheduling is **not available on web** (`Platform.OS === 'web'` is skipped); the profile page explains this.
- Real cross-device push (even when the app is killed) requires expo-notifications remote push with FCM/APNs and a push token per device.

---

### Module 5 — Close work & payments

- **Purpose**: after the event, the admin records money received from the client and the expenses for that work, then marks it completed.
- **Access**: admin only.
- **Files**: backend `POST /api/works/:id/complete`, `mobile/src/app/work/[id].tsx` + `mobile/src/components/bottom-sheet.tsx`.

**User flow**
1. Open an assigned (not yet completed) work as admin. A fixed **Complete Work** button is docked at the bottom of the screen (only visible to admins; employees never see it).
2. Tap *Complete Work* → an iOS-style **bottom sheet slides up** with the payment form: **total received from client**, **total expenses**, optional payment notes (e.g. "advance + balance, UPI"). The sheet dismisses via ✕, backdrop tap, or swipe-down.
3. Tap *Complete Work* inside the sheet → sheet closes and the work's card shows a green **Payment Summary** (received / expenses / profit) with the completion date; the button disappears.

**Data/API flow**
1. `POST /api/works/:id/complete {payment_amount, expense_amount, payment_notes}`.
2. Backend validates numbers, sets `status='completed'`, `completed_at = now (local)`, and stores the amounts on the work.
3. This is the **source data for Module 6 (Reports)** — only completed works with these amounts feed the reports, bucketed by `completed_at`.

---

### Module 6 — Reports

- **Purpose**: admin financial overview (income, expense, profit) from closed works.
- **Access**: admin only.
- **Files**: `backend/src/routes/reports.js`, `mobile/src/app/(tabs)/reports.tsx`.

**User flow**
1. Reports tab → choose **Today / This Week / This Month / This Year / Custom**.
2. Four summary cards: **Income**, **Expense**, **Profit**, **Paid to staff** + completed-work & payment counts.
3. A **Breakdown** list groups the same numbers per day / month / year depending on the range, and each row also shows how much was **paid to staff** that bucket.

**Data/API flow**
1. Screen maps its choice to a backend range and params:
   - Today → `range=daily`
   - Week/Month/Year → frontend sends explicit date bounds as `range=custom` (week) or `range=monthly|yearly`
   - Custom → `range=custom&from=…&to=…`
2. Backend resolves the window, then selects **completed** works whose `date(completed_at)` falls inside it, **plus** all `user_payments` whose `given_on` falls inside it (the settle-payment records from Module 8).
3. Aggregation is done in JS: totals (`income = Σ payment_amount`, `expense = Σ expense_amount`, `profit = income − expense`, `payments = Σ user_payments.amount`) plus rows bucketed by `YYYY-MM-DD`, `YYYY-MM`, or `YYYY` keys — works and payments share the same buckets.
4. Response shape: `{ range, from, to, summary:{income,expense,profit,works,payments,payment_count}, rows:[{key,income,expense,profit,works,payments,payment_count}] }`.

---

### Module 7 — Quotations (PDF + WhatsApp)

- **Purpose**: build an itemized quotation for a client, convert it to a **PDF**, and **send it to the client on WhatsApp** with one tap.
- **Access**: admin only (API and tab both enforce it).
- **Files**: backend `src/routes/quotations.js`, `src/pdf.js`, `src/constants.js`; mobile `(tabs)/quotations.tsx`, `quotation/new.tsx`, `lib/files.ts`.

**User flow (create)**
1. Quotations tab → **New Quotation**.
2. Client details + phone (needed for WhatsApp), event name/date/venue.
3. Add item rows (description, qty, unit price) — subtotal & total update live; optional discount, tax, notes.
4. *Create Quotation* → gets a number like `QT-2026-0001`, returns to the list.

**User flow (share)**
1. On a quotation card: **PDF** downloads/opens the generated PDF (share sheet on mobile, new tab on web).
2. **WhatsApp** opens `wa.me/<phone>?text=<quotation summary>` with the client's phone pre-filled — the user taps send in WhatsApp itself.

**Data/API flow**
1. `POST /api/quotations` — backend validates items, computes `subtotal = Σ qty×unit_price`, `total = subtotal − discount + tax`, stores items as a JSON string, assigns the sequential `QT-YYYY-NNNN` number.
2. `GET /api/quotations/:id/pdf` streams a **pdfkit** document (company header, client box, item table, totals, notes) as `application/pdf`.
3. `GET /api/quotations/:id/whatsapp` returns `{ url, message }` — the message is the plain-text quotation summary built by `quotationWhatsAppMessage()`. Branding (company name, currency) comes from `constants.js` / env (`COMPANY_NAME`, `CURRENCY`).

---

### Module 8 — Team / user management (admin)

- **Purpose**: add and remove users; assign roles.
- **Access**: admin only (tab hidden for employees; API returns 403 otherwise).
- **Files**: backend `routes/users.js`, mobile `(tabs)/team.tsx`, mobile `components/bottom-sheet.tsx`, backend `seed.js`.

**UI layout**
- The team list is pinned to the top of the page (scrollable `FlatList` with pull-to-refresh) and a fixed **+ Add User** button is docked at the bottom, above the tab bar — the list viewport ends above the button, so rows are never hidden behind it.

**User flow**
1. Tap the fixed **+ Add User** button → an iOS-style **bottom sheet** slides up from the bottom (`components/bottom-sheet.tsx`): grabber handle, rounded top corners, dimmed backdrop, swipe-down / ✕ / backdrop-tap to dismiss.
2. In the sheet: name, email, phone, password, role (**Employee / Admin** chips). Form scrolls if the keyboard covers it, so it stays usable on small phones.
3. *Add User* submits, the sheet slides down, and the new user appears at the top of the team list.
4. Each row: avatar, name, email, role badge, delete button (except yourself; the last admin cannot be deleted).

**Data/API flow**
- `POST /api/users` — validates required fields + unique email, `bcrypt`-hashes the password, inserts with role.
- `GET /api/users` returns all users (newest first).
- `DELETE /api/users/:id` — guards: can't delete yourself, can't delete the last admin.
- **Email convention in this project**: no `.com` — logins look like `subin@desireevents` (`username@company`).

---

### Module 9 — Profile & sign out

- **Purpose**: view your own account and leave.
- **Access**: everyone.
- **Files**: `mobile/src/app/(tabs)/profile.tsx`.

**User flow**
1. Profile shows avatar, name, role badge, email, phone, join date.
2. An info card explains how reminders work on this platform (native vs web).
3. **Sign Out** clears the session and returns to the login screen.

---

## 5. API reference

Base URL (dev): `http://localhost:4000` — every route below (except login) requires `Authorization: Bearer <token>`.

### Auth
| Method | Path | Body / Query | Access | Returns |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | `{email, password}` | public | `{token, user}` |
| GET | `/api/auth/me` | — | any | `{user}` |

### Users (Module 8)
| Method | Path | Body / Query | Access | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/users` | — | admin | `{users[]}` |
| POST | `/api/users` | `{name, email, phone?, password, role}` | admin | `{user}` (201) |
| DELETE | `/api/users/:id` | — | admin | `{ok}` |

### Works (Module 3)
| Method | Path | Body / Query | Access | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/works` | `status? from? to? assignee_id?` | any (scope by role) | `{works[]}` |
| POST | `/api/works` | see 3a payload | admin | `{work}` (201) |
| GET | `/api/works/:id` | — | assigned user / admin | `{work}` (with assignees, documents) |
| PATCH | `/api/works/:id` | editable fields + `assignee_ids?` | admin | `{work}` |
| POST | `/api/works/:id/complete` | `{payment_amount, expense_amount, payment_notes?}` | admin | `{work}` |
| POST | `/api/works/:id/documents` | multipart field `documents` (≤10, 15 MB each) | admin | `{work}` (201) |
| DELETE | `/api/works/:id/documents/:docId` | — | admin | `{ok}` |
| GET | `/uploads/:filename` | — | public | file |

`GET /api/works` filter semantics: employees always get only their assigned works (their id is AND-ed into the query); admins may additionally pass `assignee_id`. `from`/`to` filter by `work_date`.

### Reports (Module 6)
| Method | Path | Query | Access | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/reports` | `range=daily\|monthly\|yearly\|custom`, plus `date?` `month?` `year?` `from? to?` | admin | `{range, from, to, summary, rows}` |
| GET | `/api/reports/pdf` | same query as above | admin | PDF stream (summary cards + breakdown table) |

### Quotations (Module 7)
| Method | Path | Body / Query | Access | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/quotations` | — | admin | `{quotations[]}` |
| POST | `/api/quotations` | see 7 flow payload | admin | `{quotation}` (201) |
| GET | `/api/quotations/:id` | — | admin | `{quotation}` |
| GET | `/api/quotations/:id/pdf` | — | admin | PDF stream |
| GET | `/api/quotations/:id/whatsapp` | — | admin | `{url, message}` |

---

## 6. Database schema (SQLite)

File: `backend/data/eventplanner.db` (created automatically; schema in `backend/src/db.js`).

```
users(id, name, email UNIQUE, phone, password_hash, role ['admin'|'employee'], created_at)

works(id, title, description, client_name, client_phone, client_email, venue,
      work_date 'YYYY-MM-DD', start_time 'HH:MM', reminder_time,
      reminder_at,            ← absolute local datetime: work day @ reminder time
      reminder_day_before_at, ← absolute local datetime: day before @ reminder time
      status ['assigned'|'completed'], created_by → users.id,
      created_at, completed_at,
      payment_amount, expense_amount, payment_notes)   ← filled on “complete work”

work_assignees(work_id → works.id, user_id → users.id)   PK(work_id, user_id)  ← coworkers

work_documents(id, work_id → works.id, filename, original_name, uploaded_at)

quotations(id, quotation_number UNIQUE 'QT-YYYY-NNNN', client_name, client_phone,
           client_email, event_name, event_date, venue,
           items JSON [ {description, qty, unit_price} ], notes,
           subtotal, discount, tax, total, created_by → users.id, created_at)
```

Relationships:
- `users` 1—N `works` (created_by), N—N via `work_assignees` (assignees / coworkers)
- `works` 1—N `work_documents`
- `works` (completed) feed `reports` (no separate payments table — income/expense live on the work)
- `quotations` are standalone client-facing documents

---

## 7. Mobile navigation map

```
src/app/
├── _layout.tsx        AuthProvider → Stack(login, (tabs), work/[id], quotation/new)
│                        + expo-notifications foreground handler + startup token check
├── login.tsx          ──► redirects to /(tabs) when already signed in
└── (tabs)/            guarded: redirects to /login when signed out
    ├── index.tsx        Dashboard            (M2)
    ├── works.tsx        My Works + filters   (M3b)
    ├── reports.tsx      Reports (admin)      (M6)
    ├── quotations.tsx   Quotations (admin)   (M7)
    ├── team.tsx         Team (admin)         (M8)
    └── profile.tsx      Profile              (M9)
```

Key helper files: `lib/api.ts` (typed REST client + API URL resolution), `lib/auth-context.tsx` (session), `lib/notifications.ts` (M4), `lib/files.ts` (PDF/document download+share), `lib/format.ts` (dates, `Rs.` money), `lib/storage.ts` (AsyncStorage), `lib/theme.ts` (colors/spacing/typography), `components/ui.tsx` (Button, Card, Input, Chip, Badge, Avatar, EmptyState, InfoRow…), `components/bottom-sheet.tsx` (iOS-style popup used by Team “Add user” and the Assign New Work form), `components/work-card.tsx`, `components/gestures.tsx` (pull-to-refresh + swipe-back, see below).

### Gestures (pull-to-refresh & swipe-back)

Two cross-platform gestures live in `components/gestures.tsx`:

- **Pull-to-refresh** (`PullRefresh`): on iOS/Android it is the native `RefreshControl` (screens pass `refreshing`/`onRefresh` to `ScrollView`/`FlatList` or the `Screen` component). On web, `react-native-web`'s `RefreshControl` is a no-op, so a custom touch/mouse gesture is used: pull down from the top of a page and the content follows your finger with a spinner; release past the threshold to reload. The gesture **only engages when every scrollable ancestor is at scrollTop 0**, so pulling from the middle of a page does nothing. When any popup (bottom sheet) is open, touches land on the modal overlay and the page refresh is naturally disabled. Wired into Dashboard, My Works, Team, Work Details, Reports, and Quotations.
- **Swipe-back** (`SwipeBackView`): swipe from the left edge rightwards to go back — the screen slides with your finger and navigates back past the threshold. On iOS/Android the native stack handles it (`gestureEnabled: true` in `_layout.tsx`); on web it is implemented with the same touch/mouse handlers and is applied to the Work Details screen (`work/[id].tsx`).

---

## 8. Example end-to-end request (trace one flow)

*Admin closes a work on mobile — the payment form is a bottom sheet:*

```
Screen (work/[id].tsx)
  │  tap the docked "Complete Work" button → BottomSheet slides up (close-work sheet)
  │  fill received / expenses / notes, tap the sheet's footer "Complete Work"
  │     → api.completeWork(id, {payment_amount, expense_amount, payment_notes})   lib/api.ts
  │  fetch POST http://<host>:4000/api/works/12/complete
  │     headers: Authorization: Bearer <jwt>  ·  Content-Type: application/json
  ▼
routes/works.js  requireAuth → requireAdmin → validate → UPDATE works
  │                 SET status='completed', completed_at=now,
  │                     payment_amount=…, expense_amount=…, payment_notes=…
  ▼
db.js  (better-sqlite3 prepared statement)
  ▼
  json { work } ──► sheet closes; screen re-renders: Payment Summary replaces the button
```

---

## 9. Environment variables

### Backend (`backend/.env` if desired)
| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `JWT_SECRET` | `dev-secret-change-me` | **Set a strong secret in production** |
| `DB_PATH` | `backend/data/eventplanner.db` | SQLite file location |
| `COMPANY_NAME` | `Event Planner Pro` | Branding on PDFs / WhatsApp text |
| `CURRENCY` | `Rs.` | Currency symbol on PDFs / WhatsApp text |

### Mobile
| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Optional override for the API URL (e.g. `https://api.yourdomain.com`). Without it the app derives the dev host from Expo's `hostUri`. |

---

## 10. Testing

```bash
cd backend
npm run smoke    # boots the API against a throwaway DB and runs 19 end-to-end checks:
                 # auth, role guards, works CRUD, reminder computation, complete-work,
                 # reports aggregation, quotation creation, PDF bytes, WhatsApp link
```

Mobile type check:

```bash
cd mobile
npx tsc --noEmit
```

---

## 11. Extension points & roadmap

Where to change what (future-proofing):

| Goal | Where |
| --- | --- |
| Rename the brand ("Event Planner Pro" → "Desire Events") | `backend/src/constants.js` (or `COMPANY_NAME` env) + `mobile/app.json` name + `mobile/src/app/login.tsx` brand block |
| Change currency | `CURRENCY` env / `backend/src/constants.js` + `mobile/src/lib/format.ts` |
| Real push reminders (any device, app closed) | add expo-notifications remote push: register push tokens per user/device on login, backend schedules FCM/APNs sends at `reminder_at` / `reminder_day_before_at` |
| Edit / delete works (admin) | PATCH route already exists in `backend/src/routes/works.js`; build an edit sheet reusing `components/assign-work-sheet.tsx` |
| Edit users / change passwords | add `PATCH /api/users/:id` + a change-password screen on Profile |
| Swap SQLite → PostgreSQL | replace `db.js` (better-sqlite3) with Prisma/Knex; keep routes untouched |
| Add employees in bulk | reuse `POST /api/users` from a script; remember the `username@desireevents` email convention |
| Chat/status updates per work | new table `work_updates(work_id, user_id, note, at)` + a section in `work/[id].tsx` |
| Client payments in instalments | promote `payments(work_id, type income/expense, amount, date)` and aggregate in `reports.js` |

---

*Generated with Codebuff 🤖 — keep this handbook in sync when modules change.*

---

## 12. Build an APK & host for free (for real devices)

This app is one Expo codebase. The same project can be:

- **Sideloaded as an APK** onto an Android phone (dev client build).
- **Run in a browser** as a web app (built static bundle hosted anywhere static).
- **The backend** hosted on a free Node.js host so the phone app talks to it over the internet.

### 12a. APK build (dev client)

**Why a dev client, not Expo Go:** Expo Go doesn't include every native module. This app uses `expo-notifications`, file system / sharing, and gesture handling that need a custom dev client. The `expo-dev-client` dependency and `eas.json` (profile `development`, `buildType: apk`) are already in the project.

**Two ways to get an APK:**

1. **Local build + install (fastest if a device is connected):**
   ```bash
   cd mobile
   npx expo run:android --variant debug
   ```
   Builds the app, launches it on a connected Android device or emulator. The resulting APK lives in `android/app/build/outputs/apk/debug/app-debug.apk` if you need to copy it manually.

2. **EAS local build (APK file only, no device needed during build):**
   ```bash
   cd mobile
   npx eas-cli build \
     --profile development \
     --platform android \
     --local
   ```
   Produces an installable `.apk`. EAS may prompt to configure your build environment the first time (Android SDK). On Windows, the easiest path is to install **Android Studio** (which bundles the SDK) or use **WSL2** with the Android SDK.

**API URL in the built APK:**

- By default the app derives the API host from the Expo dev server's `hostUri` (your PC while developing). In a built APK there is no dev server, so **set `EXPO_PUBLIC_API_URL`** at build time or before building:
   ```bash
   # Windows (CMD)
   set EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
   npx eas-cli build --profile development --platform android --local

   # or persist it for web builds (see §12c)
   ```
- The mobile `lib/api.ts` `resolveApiUrl()` already checks `EXPO_PUBLIC_API_URL` first, then falls back to `10.0.2.2:4000` on Android (emulator LAN loopback) and `localhost:4000` otherwise.

### 12b. Free backend hosting (so the phone can reach the API from anywhere)

The backend is a plain Node+Express app with no build step. You can host it for free on several platforms. Pick one:

| Host | Free tier | Notes |
| --- | --- | --- |
| **Render** | Web Service (free, spins down after 15 min inactivity) | Push backend to a Git repo (GitHub/GitLab), create a Render web service pointing at `backend/`, set `npm start` as the start command, add env vars (`JWT_SECRET`, `COMPANY_NAME`, `CURRENCY`). free tier sleeps — first request after idle takes ~30s. OK for testing. |
| **Railway** | Trial/app host (small free usage allowance) | Similar to Render; intuitive dashboard; persistent DB possible. |
| **Fly.io** | Free allowance (small VMs) | Requires CLI auth; great for a always-on tiny VM; you manage the SQLite file (consider a persistent volume). |
| **Vercel / Netlify / Cloudflare Workers** | Static + serverless functions | Possible (wrap Express in a serverless handler) but adds complexity; SQLite becomes a problem (serverless is ephemeral). Not recommended unless you migrate DB to Postgres. |

**Recommendation for a quick free deployment:** Render.

Steps (Render):
1. Push the whole repo to GitHub (backend/ at the repo root, or a subdirectory).
2. In Render: **New → Web Service**, connect the repo.
3. Root Directory = `backend` (if mono-repo), Build Command = `npm install`, Start Command = `npm start`.
4. Environment Variables: `JWT_SECRET` (strong random), `COMPANY_NAME`, `CURRENCY`, `PORT=4000`.
5. Deploy. Render gives you a `https://<name>.onrender.com` URL — that's your `EXPO_PUBLIC_API_URL` for the APK/web build.

**Database note:** SQLite writes to a file. On Render the filesystem is ephemeral by default (resets each deploy/restart). For a persistent DB, use Render's persistent disk ( paid) or switch the backend to a hosted Postgres (free tiers exist: Neon, Supabase). For testing with your own phone, running the backend on your PC and connecting over LAN is simpler and free.

### 12c. Free web hosting (for the browser version)

The web build is a static site (built by Expo Web into `mobile/web-build/`). Host it anywhere that serves static files:

```bash
cd mobile
npx expo export --platform web     # produces web-build/
```

Then upload `web-build/` to:
- **Vercel** (connect repo; set Framework Preset = `Expo` / `Static`)
- **Netlify** (drag-and-drop `web-build/` or Git integration)
- **Cloudflare Pages** / **GitHub Pages**

**Web build env:**
```bash
# Set the production API URL before exporting (so the web app calls the hosted backend)
set EXPO_PUBLIC_API_URL=https://your-backend.onrender.com   # Windows CMD
# or on Mac/Linux:
export EXPO_PUBLIC_API_URL=https://your-backend.onrender.com
npx expo export --platform web
```

The exports use `EXPO_PUBLIC_API_URL` via the `resolveApiUrl()` helper in `mobile/src/lib/api.ts`.

### 12d. Testing the APK on your mobile phone

**Prerequisites**
1. The backend running on your PC (`cd backend && npm run dev`) — or the backend deployed to a free host (§12b).
2. Your PC and phone on the **same Wi-Fi/LAN** if the backend is on your PC.
3. The APK installed on the phone:
   - If you built with `npx expo run:android`, it's already installed on the connected device.
   - Otherwise copy the `.apk` (from the EAS build output or `android/app/build/outputs/apk/debug/`) to the phone and tap to install. You may need to allow "Install from unknown sources" for your browser/file manager.

**Connect the phone app to the backend**
- **If backend is on your PC (LAN):**
  1. Find your PC's LAN IP: `ipconfig` (Windows) → look for IPv4 under your Wi-Fi/Ethernet adapter, e.g. `192.168.1.50`.
  2. Make sure Windows Firewall allows inbound connections on port 4000 (or temporarily disable the firewall for testing).
  3. The APK must reach `http://192.168.1.50:4000`. Best: rebuild the APK with `EXPO_PUBLIC_API_URL=http://192.168.1.50:4000` set at build time. Alternatively, the app can sometimes resolve the host via the dev server if you run `npx expo start` and connect the phone to the same Metro server (Expo Go / dev client QR scan) — but for a pure APK sideload, the env-var approach is most reliable.
- **If backend is hosted (Render/other):**
  1. Set `EXPO_PUBLIC_API_URL=https://<your-host>.onrender.com` at build time.
  2. Rebuild/redistribute the APK.

**First login**
- Seeded demo accounts (after `npm run seed`):
  - `subin@desireevents` / `subin123` (admin)
  - `admin@eventplanner.com` / `admin123` (admin)
  - `ravi@eventplanner.com` / `ravi123` (employee)
  - `priya@eventplanner.com` / `priya123` (employee)
- No `.com` at the end — logins use `username@company` form (e.g. `subin@desireevents`).

**Testing reminders on the phone**
- The app schedules **local notifications** on the device (one day before + on the work day at the set reminder time). Those only fire if the app has been opened at least once by the employee after the work is assigned. For remote push (alerts even when the app is closed), you'd need to add expo-notifications push tokens + a push provider (FCM/APNs) — see roadmap §11.

### 12e. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| APK opens, login fails / "Not found" | APK can't reach the backend (wrong API URL or LAN blocked) | Confirm `EXPO_PUBLIC_API_URL` matches the reachable backend URL; check phone can ping the backend host/port; check PC firewall. |
| Build fails with Android SDK missing | No Android SDK/NDK on this machine | Install Android Studio (SDK) or set `ANDROID_HOME`; on Windows the easiest is Android Studio. |
| Web build shows login screen but API calls fail | `EXPO_PUBLIC_API_URL` not set or wrong at export time | Re-export with the correct URL env var. |
| Backend works locally but not after deploying | SQLite file reset / PORT wrong / CORS | Use a persistent DB for hosted backends; confirm `PORT` env and that CORS allows the frontend origin. |
