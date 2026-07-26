# Security — secret rotation & posture

This file tracks the Week‑1 security work and, most importantly, the secrets
**you must rotate yourself** in each provider's dashboard. Anything that ever
sat in a plaintext `.env` on disk should be treated as compromised and rotated
before launch.

## ✅ Already done in the codebase
- `.env` / `.env.*` are git‑ignored at the repo root **and** in `backend/` and
  `ai-service/` (defense in depth). `.env.example` templates are kept in git.
- **`JWT_SECRET` rotated** locally (fresh 64‑char random value in `backend/.env`).
- **`AI_SERVICE_API_KEY` is now its own secret**, no longer the xAI key. The same
  fresh value is set in `backend/.env` and `ai-service/.env`.
- **Clerk keys removed** from `frontend/.env` and `frontend/.env.local` (Clerk is
  not used by the code — the secret key was dead weight and a leak risk).
- JWT now travels in an **httpOnly cookie**, not localStorage.
- AI‑service API‑key check uses **constant‑time comparison** (`hmac.compare_digest`).

## 🔴 You must rotate these manually (I can't — they live in provider dashboards)

### 1. MongoDB Atlas database password  — **HIGH PRIORITY**
The password is embedded in `MONGODB_URI` and has been in plaintext on disk.
1. Atlas → **Database Access** → edit the DB user → **Edit Password** → autogenerate.
2. Update `MONGODB_URI` in `backend/.env` with the new password.
3. Consider **Network Access** → restrict IP allow‑list to your servers only.

### 2. xAI (Grok) API key — **HIGH PRIORITY**
`OPENAI_API_KEY` in `ai-service/.env` is a live billing credential.
1. https://console.x.ai → **API Keys** → revoke the current key.
2. Create a new key → put it in `ai-service/.env` as `OPENAI_API_KEY`.
3. Set a spending limit while you're there.

### 3. Clerk application key — **MEDIUM**
The `CLERK_SECRET_KEY` was exposed on disk even though the app no longer uses Clerk.
1. https://dashboard.clerk.com → the app that owned `sk_test_…` → **API Keys** →
   rotate/delete, or delete the whole application if you don't plan to use it.

## After rotating
- Restart all three services so they pick up the new values.
- Never paste real secrets into `.env.example`, code, chat, or screenshots.
- For production, set every value from `*.env.example` as real environment
  variables in your host (Render/Vercel/etc.), not as committed files.

## Production checklist (carried over from the audit)
- [ ] `NODE_ENV=production` on all services (enables HSTS + fail‑fast env checks).
- [ ] `FRONTEND_ORIGIN`, `MONGODB_URI`, `JWT_SECRET`, `AI_SERVICE_URL`,
      `AI_SERVICE_API_KEY` all set — the backend now refuses to boot without them.
- [ ] Backend behind HTTPS (cookies are `Secure` in production).
- [ ] `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` point at the real backend.
