# 19 Pool — React Spike

A 1-week architecture spike: the legacy single-HTML-file app rebuilt as a proper Vite + React + TypeScript + Tailwind + Firebase project, deployed via Vercel.

---

## Changelog (this commit)

**What was built**

- Fresh Vite + React 18 + TypeScript project at the repo root.
- Tailwind CSS v3 with the `navy-950 / amber-500` palette extended into the theme so the existing utility classes work as-is.
- React Router v6 with five routes: `/`, `/signin`, `/signup`, `/create-league`, `/dashboard`.
- Firebase JS SDK v10 (modular) wired to the existing `pool-8bf61` project.
- Auth state via a small `AuthProvider` + `useAuth()` hook (`onAuthStateChanged`).
- `<ProtectedRoute>` wrapper that redirects to `/signin` when not authenticated.
- Reusable `<Button>`, `<Input>`, `<Card>` components (only built where used in 2+ places).
- Sign-up writes the user document at `users/{uid}` with the same field shape as the legacy app.
- Create-league generates a `WORD-XXXXX` code using the same algorithm as `generateCode()` in the legacy HTML, writes the league at `leagues/{code}`, and patches `users/{uid}.leagueCode`.
- Dashboard reads the user doc + league doc and shows the welcome / league code / sign-out.
- `vercel.json` rewrites all non-`/api/` paths to `index.html` so client-side routing works on Vercel.

**Project structure**

```
/
├── api/send-email.js          # Existing serverless function (Resend) — preserved
├── legacy/                    # Old 19pool_*.html files moved here (kept for reference)
├── public/                    # Vite static assets (empty for now)
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ProtectedRoute.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── SignIn.tsx
│   │   ├── SignUp.tsx
│   │   ├── CreateLeague.tsx
│   │   └── Dashboard.tsx
│   ├── lib/
│   │   ├── firebase.ts        # Firebase init + auth/db exports
│   │   └── auth.tsx           # AuthProvider, useAuth(), authErrorMessage()
│   ├── App.tsx                # React Router routes
│   ├── main.tsx               # React entry point
│   ├── index.css              # Tailwind + glass/hero/grid utility classes
│   └── vite-env.d.ts
├── .gitignore
├── index.html                 # Vite entry HTML
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts
```

**Dependencies installed**

Runtime: `react`, `react-dom`, `react-router-dom`, `firebase`, `resend` (kept for the existing `api/send-email.js`).
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss`, `postcss`, `autoprefixer`.

No state library, no UI framework, no styling library beyond Tailwind — per the spec.

**Firebase wiring approach**

The Firebase config is hardcoded in [`src/lib/firebase.ts`](src/lib/firebase.ts), matching the legacy approach. This config is **not a secret** — it is a public client identifier; security comes from the Firestore rules that are already deployed to the `pool-8bf61` project. We can move it to environment variables later if desired.

**Decisions made where the spec was ambiguous**

1. **Legacy HTML files** moved to `legacy/` rather than deleted. Vercel's filesystem check now serves the React app's `index.html` for `/` (via the SPA rewrite rule), and the legacy files won't be deployed. They're kept locally for reference.
2. **`vercel.json`** uses a single SPA rewrite (`/((?!api/).*) → /index.html`) so React Router controls all routes except `/api/*`, which Vercel auto-routes to the `api/` folder's serverless functions.
3. **`<Card>` padding** uses the legacy `p-8 sm:p-10` defaults inline; pages don't override.
4. **TOS acceptance** is implicit (a tiny notice under the password field) rather than a checkbox, since the spec just says to write the existing field shape and didn't require the modal. The TOS version `2026-05-05` matches the spec.
5. **Create League form**: I included `seasonEntry` and `venmo` per the spec, even though the legacy app collects those in a later step. This keeps the spike's create flow to a single form.
6. **`generateCode()`** preserved verbatim from the legacy app, including the no-`I/O/0/1` charset.
7. **Auth error mapping**: a small `authErrorMessage()` helper translates Firebase Auth error codes into friendly copy for both `SignIn` and `SignUp`.

---

## Setup

### One-time: install Node.js

This project uses Node.js (which gives you the `npm` command). If `npm --version` in Terminal says "command not found", install Node first:

1. Go to <https://nodejs.org>.
2. Download the **LTS** installer for macOS.
3. Open the downloaded `.pkg` and click through the installer.
4. Open a **new** Terminal window. Run `npm --version` — you should see a number (e.g. `10.x`).

### Run locally

In Terminal, from this project folder:

```bash
npm install          # one-time, downloads dependencies into node_modules/
npm run dev          # starts the dev server at http://localhost:5173
npm run build        # produces a production build in dist/
```

The Firebase config is hardcoded, so the existing `pool-8bf61` project is reachable from any machine — no `.env` setup needed locally.

## Deploy to Vercel

The first time only:

1. Push this repo to GitHub.
2. In the Vercel dashboard, click **Add New… → Project** and import the GitHub repo.
3. Vercel will auto-detect Vite — leave all defaults (`npm run build`, output `dist`).
4. If you want the email serverless function to work, add an environment variable: `RESEND_API_KEY` = (your Resend API key). The React app itself does not need any env vars.
5. Click **Deploy**.

After that, every push to `main` auto-deploys.

## Admin: wipe all test data

> ⚠️ **DESTRUCTIVE.** This wipes every league, every user document, and every Firebase Auth account in the project. Use only in development. The `config/` collection (pricing) is intentionally preserved.

### One-time Vercel setup

Set two environment variables in **Vercel → Project → Settings → Environment Variables** (apply to **Production** at minimum):

1. **`ADMIN_WIPE_SECRET`** — a long random string of your choice. This is the bearer secret you'll send in the request header. Treat it like a password. Suggested: `openssl rand -hex 32` produces a 64-char hex string.

2. **`FIREBASE_SERVICE_ACCOUNT_JSON`** — the entire contents of a Firebase service account key JSON file. To get it:
   - Go to **Firebase Console → Project Settings → Service accounts**.
   - Make sure "Firebase Admin SDK" is selected.
   - Click **Generate new private key** → confirm. A `.json` file downloads.
   - Open the file in a text editor, **copy the entire contents** (including the leading `{` and trailing `}`).
   - Paste it as the value of `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel.
   - Delete the downloaded `.json` file from your machine — once it's in Vercel you don't need a local copy.

After saving the env vars, redeploy (or push any small change) so the new function picks them up.

### Run the wipe

```bash
curl -X POST https://19pool.vercel.app/api/admin-wipe \
  -H "x-admin-secret: <YOUR_ADMIN_WIPE_SECRET>"
```

Returns a JSON summary, e.g.:

```json
{
  "leaguesDeleted": 3,
  "membersDeleted": 8,
  "usersDeleted": 5,
  "purchasesDeleted": 0,
  "authUsersDeleted": 5
}
```

A wrong or missing `x-admin-secret` returns `401 Unauthorized`.

## What is not included in this spike

Per the spec, all of the following are deferred:

- Invite flow / join-league
- ESPN score sync
- Standings / weekly winner detection
- Admin panel
- Pro features
- Pricing page
- Terms / TOS modal
- Tests

If something on this list shows up in the code, it's a bug — please flag it.
