# ThaiConnect — Deployment Guide

Three services + a database:

| Piece | Where | Why |
|-------|-------|-----|
| Frontend (Next.js) | **Vercel** | native Next.js hosting |
| Backend (Express) | **Render** (Node web service) | long-running + Socket.IO |
| AI service (Flask) | **Render** (Python web service) | gunicorn + the ML models |
| Database | **MongoDB Atlas** | already set up |

`render.yaml` in the repo root is a Blueprint that provisions both Render services at once.

---

## 0. Before you start
- Rotate the exposed secrets first — see [SECURITY.md](SECURITY.md).
- Commit everything, including `backend/ml-data/*.joblib` + `model_metadata.json`
  (the AI service loads these at runtime) and `frontend/public/pdf.worker.min.mjs`.
- Push the repo to GitHub.

## 1. MongoDB Atlas
1. Atlas → **Network Access** → allow Render's egress (or `0.0.0.0/0` for a first deploy, then tighten).
2. Copy the connection string → this is `MONGODB_URI`.

## 2. Backend + AI service on Render (Blueprint)
1. Render → **New → Blueprint** → pick this repo. It reads `render.yaml` and creates
   `thaiconnect-backend` and `thaiconnect-ai`.
2. Fill the `sync: false` env vars in the dashboard:
   - **Backend:** `MONGODB_URI`, `JWT_SECRET` (32+ random chars), `AI_SERVICE_API_KEY`
     (any long random string), and — after step 3 — `FRONTEND_ORIGIN`. Set
     `AI_SERVICE_URL` to the AI service's Render URL.
   - **AI service:** `OPENAI_API_KEY` (xAI key), `AI_SERVICE_API_KEY` (**same value**
     as the backend), `BACKEND_ORIGINS` = the backend's Render URL.
3. Deploy. Verify:
   - Backend `GET /` → `{"status":"ok","db":"connected"}` (503 means Mongo isn't reachable).
   - AI `GET /api/ml/health` (needs the `X-API-Key` header) → all models `true`.

> The AI service runs `gunicorn` (already in `requirements.txt`). XGBoost needs
> `libgomp`, which is present on Render's Linux Python image — no extra step.

## 3. Frontend on Vercel
1. Vercel → **New Project** → import the repo → set **Root Directory = `frontend`**.
2. Environment variables:
   - `NEXT_PUBLIC_API_URL` = the **backend** Render URL (the Next rewrite proxies `/api/*` there).
   - `NEXT_PUBLIC_SOCKET_URL` = the **backend** Render URL (Socket.IO connects here directly).
3. Deploy → copy the Vercel URL.
4. Back on Render, set the backend's **`FRONTEND_ORIGIN`** to that Vercel URL and redeploy
   (needed for CORS + the Socket.IO handshake).

## 4. Auth / cookie note (important)
Auth uses an **httpOnly cookie**. The browser calls `/api/*` on the **Vercel origin**, and
Next rewrites it to the backend server-side — so from the browser it's same-origin and the
`SameSite=Lax` cookie works. Keep `NEXT_PUBLIC_API_URL` pointing at the backend so this
rewrite stays in place. Socket.IO connects cross-origin but authenticates with a short-lived
**ticket**, not the cookie, so it's unaffected. Everything is HTTPS in production, so the
`Secure` cookie flag is satisfied.

## 5. Post-deploy smoke test
- [ ] Register a **patient** and a **donor** (two browsers), both **allow location**.
- [ ] Patient dashboard loads; predictions page returns a real thalassaemia screen.
- [ ] Patient sends an SOS → donor gets the popup → donor accepts → **both see a toast**.
- [ ] Refresh: the session persists (cookie), and `/` health shows `db: connected`.

---

## Scaling follow-ups (not needed for a single-instance launch)
- **Rate limiting** is in-memory today — fine on one instance. For multiple instances,
  switch the `express-rate-limit` store to Redis (`rate-limit-redis` + a Render Redis add-on).
- **Notifications** are session-scoped (live socket events). A cross-session notification
  center needs a small `Notification` collection + fetch on load.
- **CI/CD**: Render + Vercel already auto-deploy on push to the default branch. Add a GitHub
  Action for `npm run typecheck` + `tsc` + `next build` on PRs if you want gated merges.
- The **admin → settings** page is display-only (shows placeholder service URLs); wire it to
  real config before relying on it.
