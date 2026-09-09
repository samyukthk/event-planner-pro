# Run guide — Event Planner Pro (backend + Expo web preview)

Two processes are needed: the Express API (port 4000) and the Expo web app (port 8081,
which is what the Preview tab shows). The web app calls the API at `http://localhost:4000`
in dev.

## 1. Reproduce the artifacts (one-time)

Nothing is committed for runtime state, so a fresh checkout needs:

1. **Install dependencies** (both packages, npm — lockfiles are committed):
   ```bash
   cd backend && npm install
   cd ../mobile && npm install
   ```
2. **Create the SQLite database + demo data** (auto-creates `backend/data/`):
   ```bash
   cd backend && npm run seed
   ```
   Demo logins are printed by the seed (see README §2 — e.g. `subin@desireevents` /
   `subin123` for the admin).
3. **No env files are required** — `backend/src/db.js` and the API default to
   `PORT=4000`, dev JWT secret, and the SQLite path under `backend/data/`. If the main
   checkout ever gains `backend/.env` or `mobile/.env`, copy them here (adapt ports if
   the defaults are taken).

## 2. Run the servers (detached, survives the conversation)

Start the backend first (web app needs it for login), then Expo web. Log files live in
`.freebuff/` and stdout/stderr must go to different files.

```powershell
# Backend API — http://localhost:4000
powershell -NoProfile -Command '$p = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" -WorkingDirectory "C:\my project\backend" -RedirectStandardOutput "C:\my project\.freebuff\preview-backend.log" -RedirectStandardError "C:\my project\.freebuff\preview-backend.log.err" -WindowStyle Hidden -PassThru; Write-Output ("PID=" + $p.Id)'

# Expo web — http://localhost:8081  (this is the preview URL)
powershell -NoProfile -Command '$p = Start-Process -FilePath "npm.cmd" -ArgumentList "run","web" -WorkingDirectory "C:\my project\mobile" -RedirectStandardOutput "C:\my project\.freebuff\preview-web.log" -RedirectStandardError "C:\my project\.freebuff\preview-web.log.err" -WindowStyle Hidden -PassThru; Write-Output ("PID=" + $p.Id)'
```

Notes:
- The npm wrapper PID from `Start-Process` is not the listener PID — find the real one
  with `netstat -ano | findstr :8081` (or `:4000`) and use that for `register_preview`.
- `Start-Process` output redirection can swallow the wrapper's exit, so the PowerShell
  call may appear to "hang" — it doesn't; poll the port/log instead.
- Expo's first web bundle takes ~30–60 s; `GET /` returns 200 once Metro is ready.
- Verify: `curl http://localhost:4000/api/health` → `{"ok":true,...}`.

## 3. Handy checks

- API smoke test: `cd backend && npm run smoke`
- Mobile typecheck: `cd mobile && npx tsc --noEmit`
