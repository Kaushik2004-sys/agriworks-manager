# AgriWorks Manager – Phase 1: Project Setup

## Structure
```
C:\AgriWorks
├── frontend/          # React.js + Vite + Bootstrap
│   ├── src/
│   │   ├── components/  # Reusable UI (future phases)
│   │   ├── pages/       # Page views (future phases)
│   │   └── services/api.js  # Axios client -> Django
│   ├── .env             # VITE_API_URL=http://127.0.0.1:8000/api
│   └── .env.example
└── backend/           # Django + DRF
    ├── config/        # settings.py, urls.py
    ├── api/           # Phase 1 health-check app
    │   ├── views.py   # GET /api/health/
    │   └── urls.py
    ├── .env           # DB_ENGINE, secret, CORS
    ├── .env.example
    └── requirements.txt
```

## Run Phase 1
Backend (http://127.0.0.1:8000):
```
cd C:\AgriWorks\backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Test: http://127.0.0.1:8000/api/health/

Frontend (http://localhost:5173):
```
cd C:\AgriWorks\frontend
npm install
npm run dev
```

## Database
- Project database: SQLite (`backend/db.sqlite3`, `DB_ENGINE=sqlite` in backend/.env).
  MySQL is not required for this project.
- The `mysql` block in `config/settings.py` is kept only as an unused fallback.

## Verification (Phase 1 done 12-09-2026)
- `python manage.py check` – no issues
- `python manage.py migrate` – OK
- `GET /api/health/` – 200 `{"backend":"Django + DRF running","database":"connected"}`
- `npm run build` – built in 2.28s, 0 errors

---

# Phase 2: User Authentication (Token Auth)

## Backend endpoints
- `POST /api/login/` – { username, password } -> { token, username }
- `POST /api/logout/` – requires `Authorization: Token <token>` -> deletes token
- `GET /api/me/` – requires token -> { username, is_staff }
- `GET /api/health/` – public, still works

## Frontend routes
- `/login` – public login form with validation
- `/` – protected Dashboard, redirects to `/login` if no token
- Navbar shows username + Logout when logged in

## Test user
- username: `admin` / password: `admin123`
- Created via: `python manage.py shell -c "from django.contrib.auth.models import User; ..."`

## Verification (Phase 2)
- Valid login returns token – OK
- Invalid credentials returns `{"error":"Invalid username or password."}` – OK
- `GET /api/me/` without token -> 401 – OK
- `GET /api/me/` with token -> 200 – OK
- `POST /api/logout/` -> token deleted, `GET /api/me/` -> 401 – OK
- `npm run build` – 87 modules, 0 errors – OK

---

# Phase 3: Farmer Management

## Backend (`farmers` app)
- Model `Farmer`: user FK (User->Farmer), name, mobile (10 digits), village, address
- `FarmerSerializer` validates name, 10-digit mobile, village
- `FarmerViewSet` (IsAuthenticated, per-user queryset, ?search= name/mobile/village)
- Routes: `GET/POST /api/farmers/`, `GET/PUT/DELETE /api/farmers/<id>/`

## Frontend
- Route `/farmers` (protected), navbar Home + Farmers
- `services/farmers.js`, `pages/Farmers.jsx`: table, search, add/update form, delete confirm
- Validation: required fields + 10-digit mobile, shows backend errors

## Verification (Phase 3)
- CREATE/ LIST/ SEARCH/ UPDATE/ DELETE – OK (live test, id 1)
- Invalid `{name:"",mobile:"123",village:""}` -> 400 with field errors – OK
- No token `GET /api/farmers/` -> 401 – OK
- `npm run build` – 89 modules, 0 errors – OK

---

# Phase 4: Agricultural Work Management

## Backend (`works` app)
- Model `Work`: user FK, farmer FK (Farmer->Work), work_type choices (Ploughing, Rotavator, Cultivation, Harvesting, Irrigation), work_date, area, amount
- `WorkSerializer` validates farmer belongs to user, date not future, area>0, amount>=0
- `WorkViewSet` (IsAuthenticated, per-user, ?search= type/farmer, ?farmer=id, ?work_type=type)
- Routes: `GET/POST /api/works/`, `GET/PUT/DELETE /api/works/<id>/`

## Frontend
- Route `/works` (protected), navbar Home + Farmers + Work
- `services/works.js`, `pages/Works.jsx`: farmer-linked table, search + farmer/type filters, add/update form, delete
- Validation: farmer/type/date required, date not future, area>0, amount>=0

## Verification (Phase 4)
- CREATE Ploughing 2.5ac Rs3000 -> UPDATE Irrigation 3ac Rs2500 – OK
- LIST / FILTER ?farmer= / SEARCH ?search=Ploughing – OK
- Invalid bad type + future + negative -> 400 with 4 field errors – OK
- No token -> 401, DELETE -> 204 – OK
- `npm run build` – 91 modules, 0 errors – OK

---

# Phase 5: Billing Management

## Backend (`billing` app)
- Model `Bill`: user FK, farmer FK, work OneToOne (Work->Bill), bill_date, total_amount, status Unpaid/Partial/Paid
- `get_paid_amount()` returns 0 until Phase 6 payments exist; `get_pending_amount()` = total - paid
- `BillSerializer` shows farmer_name/mobile/village, work_type/date, paid/pending; validates work ownership, one bill per work, farmer matches work
- `BillViewSet` (IsAuthenticated, per-user, ?search= farmer/work, ?status=, ?farmer=)
- Routes: `GET/POST /api/bills/`, `GET/PUT/DELETE /api/bills/<id>/`
- `works` API extended: `is_billed`, `bill_id`, `?unbilled=true` for generation dropdown

## Frontend
- Route `/bills` (protected), navbar Home + Farmers + Work + Bills
- `services/bills.js`, `pages/Bills.jsx`: bill table (farmer/work/total/paid/pending/status), search + status filter, Generate Bill from unbilled work with auto-fill, edit date/total, delete

## Verification (Phase 5)
- CREATE bill from work (farmer auto-filled) total Rs3000 paid 0 pending 3000 Unpaid – OK
- LIST + SEARCH, DUPLICATE same work -> 400 – OK
- No token -> 401, UPDATE total 3500 pending 3500 – OK, DELETE -> 204 – OK
- `npm run build` – 93 modules, 0 errors – OK

---

# Phase 6: Payment Management

## Backend (`payments` app)
- Model `Payment`: user FK, bill FK (Bill->Payment), payment_date, method (Cash/UPI/Bank Transfer/Cheque/Other), amount
- Rule enforced: amount > 0 and <= remaining (total - paid); date not future, not before bill date
- `PaymentViewSet` auto-updates `Bill.status` to Unpaid/Partial/Paid on create/update/delete; filters ?bill= ?search=
- Routes: `GET/POST /api/payments/`, `GET/PUT/DELETE /api/payments/<id>/`

## Frontend
- Route `/payments` (protected, supports `?bill=`), navbar + Payments, Bills page Pay button
- `services/payments.js`, `pages/Payments.jsx`: bill selector, Total/Paid/Pending/Status cards, history table, record/update form with max-allowed validation

## Verification (Phase 6, bill #2 total Rs55)
- PAY 20 -> Partial (paid 20 pending 35), PAY 15 multiple – OK
- OVERPAY 30 (pending 20) -> 400 exceeds remaining – OK
- PAY final 20 -> Paid (paid 55 pending 0), HISTORY 3 records – OK
- Test payments cleaned, bill reset to Unpaid – OK
- `npm run build` – 95 modules, 0 errors – OK

---

# Phase 7: Expense Management

## Backend (`expenses` app)
- Model `Expense`: user FK (User->Expense), expense_type (Diesel/Maintenance/Driver Wages/Other), amount, date, description
- Validation: type valid, amount > 0, date not future
- `ExpenseViewSet` (IsAuthenticated, per-user, ?search= type/description, ?expense_type=)
- Routes: `GET/POST /api/expenses/`, `GET/PUT/DELETE /api/expenses/<id>/`

## Frontend
- Route `/expenses` (protected), navbar + Expenses
- `services/expenses.js`, `pages/Expenses.jsx`: type/amount/date/description table, search + type filter, total summary, add/update form, delete

## Verification (Phase 7)
- CREATE Diesel 2000 -> UPDATE Driver Wages 1500 – OK
- LIST / SEARCH Diesel – OK
- Invalid bad type + negative + future -> 400 with 3 errors – OK
- No token -> 401, DELETE -> 204 – OK
- `npm run build` – 97 modules, 0 errors – OK

---

# Phase 8: Dashboard

## Backend (`api/dashboard/`)
- `GET /api/dashboard/` (IsAuthenticated, per-user): totals from real DB, no duplicates
- Totals: farmers, works, bills, income (Sum bills), received (Sum payments), pending (income-received), expenses (Sum expenses)
- Recent: 5 works, 5 payments, 5 expenses

## Frontend
- `services/dashboard.js`, rewritten `pages/Dashboard.jsx`: 6 stat cards + 3 recent lists with links
- Home route `/` now shows business summary

## Verification (Phase 8, live admin data)
- `GET /api/dashboard/` -> farmers 1, works 1, bills 1, income 55, received 30, pending 25, expenses 0 – OK (pending = 55-30)
- Recent works/payments present, expenses empty – OK (matches DB)
- No token -> 401 – OK
- `npm run build` – 98 modules, 0 errors – OK

---

# Phase 9: Report Generation

## Backend (`api/reports/?type=`)
- `GET /api/reports/` (IsAuthenticated, per-user) with filters farmer/status/work_type/expense_type/method/from/to/search
- Types: work, billing, payment, pending (pending>0 only), expense, performance (summary + by_work_type + by_expense_type)
- All from actual DB records, no duplicates

## Frontend
- Route `/reports` (protected), navbar Reports
- `services/reports.js`, `pages/Reports.jsx`: 6 report buttons, filters (search/farmer/dates + type-specific), summary card, table, Print + CSV export

## Verification (Phase 9, live admin data)
- work: 1 record Ploughing 1555ac Rs55 – OK
- billing: 1 bill total 55 paid 30 pending 25 Partial – OK
- payment: 2 records total 30 – OK
- pending: 1 bill pending 25 – OK
- expense: 0 records – OK
- performance: income 55 received 30 pending 25 expenses 0 profit_cash 30 – OK
- Filter from/to + unauth 401 – OK
- `npm run build` – 100 modules, 0 errors – OK

---

# Phase 10: Module Integration

## Flow verified
Login > Dashboard (/) > Farmers > Work > Bills > Payments > Expenses > Reports > Logout
- All routes protected except /login; unknown paths redirect to /
- Navbar order matches flow; Bills Pay button deep-links /payments?bill=
- Token auth persists across modules via axios interceptor + localStorage

## Relationships verified (live DB)
- Counts: 1 farmer, 1 work, 1 bill, 2 payments, 0 expenses
- Farmer->Work, Work->Bill, Bill->Payment chains: 0 mismatches
- User->Farmer, User->Expense ownership enforced

## Isolation verified (testuser2)
- Empty farmers/works/bills lists – OK (per-user querysets)
- GET admin farmer -> 404, CREATE work with admin farmer -> 400 – OK

## Full API flow (admin)
- login, dashboard, farmers, works, bills, payments, expenses, reports/performance, me – all 200 – OK
- logout -> me 401 – OK
- `npm run build` – 100 modules, 0 errors – OK

---

# Phase 11: Testing and Error Correction

Isolated regression run on testuser2 (fresh chain, cleaned after; admin data untouched).

## Backend – all passed
- Login/logout: valid 200, invalid 400, no-token 401 – OK
- Farmer CRUD: create/list/update/delete – OK; empty/bad mobile 400 – OK
- Work CRUD + Farmer link: create 10000, bad farmer id 400 – OK
- Bill generation + calc: total 10000 pending 10000 Unpaid, duplicate 400 – OK
- Payments: 3000 partial (pending 7000), +2000 multiple (paid 5000 pending 5000 Partial) – OK
- Payment rules: overpay 6000 -> 400 exceeds remaining, zero -> 400 – OK
- Full payment: +5000 -> paid 10000 pending 0 Paid; history 3 records – OK
- Pending formula: pending == income - received True; delete reverts Paid->Partial – OK
- Expense CRUD: create Diesel 2000, bad type/negative/future 400 – OK
- Dashboard + all 6 reports 200; unauth 401; cross-user 404/400 – OK

## Frontend – all passed
- `npm run build` 100 modules 0 errors; `npm run lint` 0 errors (8 fetch-on-mount style warnings only)
- Routes: /login public, all modules protected, * -> / – OK
- Validation on every form (required, 10-digit mobile, date not future, amount rules) + backend errors shown – OK
- Responsive: viewport meta, table-responsive on all tables, col-12/col-md grids – OK for desktop/laptop/tablet/mobile
- No broken routes, no console-blocking errors

## Genuine errors found: none. No code changes needed.

---

# Auth Update: Create Account + Email Login + Password Reset

Existing Token Auth preserved (nothing rebuilt). No unrelated modules touched.

## Database changes
- New `accounts_userprofile` table (migration `accounts.0001_initial`): OneToOne User,
  `full_name`, `company_name` (blank=True, optional), `mobile`, timestamps.
- `auth_user` untouched: no users deleted, all relationships intact
  (verified: admin + testuser2 present, 0 profiles for legacy accounts).

## Features updated
- `POST /api/register/`: Full Name*, Company (optional), Email* (valid+unique),
  Mobile* (10 digits), Password* + Confirm* (match, `set_password` hashed).
- `POST /api/login/`: accepts Email OR Username (admin username still works).
- `GET /api/me/`: + email + profile {full_name, company_name, mobile}
  (legacy users get empty profile, nothing breaks).
- `GET /api/dashboard/`: + `business` profile block for Dashboard/Bills/Reports reuse.
- `POST /api/password-reset/request/` + `/confirm/`: real backend flow with
  uid/token (PasswordResetTokenGenerator, 3-day timeout, single-use via
  password-state change). Link/token sent ONLY by email, never in any response;
  unknown email -> 404 error, no token generated. Old tokens revoked on reset.
- Frontend: `/signup` (6 fields), Login now Email + Create New Account + Forgot Password
  links, `/forgot-password`, `/reset-password?uid=&token=`, Dashboard shows company.

## Tests performed (all passed, test accounts cleaned after)
1. Register without company -> 201, company '' – OK
2. Register with company 'Green Acres Pvt Ltd' -> 201, stored – OK
3. Duplicate email -> 400 already exists – OK
4. Invalid email -> 400 – OK
5. Invalid mobile -> 400 – OK
6. Password mismatch -> 400 – OK
7. Hash check: pbkdf2 hash stored, plain != stored – OK
8. Email login with new account -> 200 – OK
9. Company in DB + /me/ profile – OK
10. Admin username login + me (empty profile) + dashboard business – OK
- Reset: request returns only a confirmation message (link sent by email, never
  exposed), unknown email -> 404, mismatch 400, confirm OK, new-password login
  OK, old password rejected, token reuse rejected – OK
- `npm run build` 103 modules 0 errors; `npm run lint` 0 errors.

## Remaining / email-service config still required
- Production reset emails need SMTP in `backend/.env` (see `.env.example`):
  EMAIL_BACKEND=smtp, EMAIL_HOST/PORT/USER/PASSWORD, EMAIL_USE_TLS,
  DEFAULT_FROM_EMAIL, FRONTEND_URL.
- In DEBUG the console email backend is used, so no SMTP is needed locally;
  the reset link travels only inside the email, never the API/UI.

---

# Email Validation Fix

Weak frontend regex replaced with strict checks on BOTH sides sharing one rule
(local part, exactly one @, dot-separated domain labels, letter-only extension ≥2).

## Files
- Backend (new): `accounts/validators.py` (`is_valid_email`); wired into
  `accounts/serializers.py` (register) and `accounts/views.py` (reset request).
- Frontend (new): `src/utils/validateEmail.js` (`isValidEmail`); wired into
  `pages/Signup.jsx` and `pages/ForgotPassword.jsx`. Login untouched (usernames allowed).
- Message on both sides: "Please enter a valid email address."

## Tests (15/15 on both sides + API + regression)
- Rejected (11): abc, abc@, @gmail.com, abc@gmail, abc@.com, abc..test@gmail.com,
  abc@gmail..com, "abc @gmail.com", abc@gmail.c, @, test@domain. – all rejected.
- Accepted (4): example@gmail.com, user123@gmail.com, farmer.name@gmail.com,
  business@company.in – all accepted.
- API: register with 5 invalid samples -> 400 with the message; valid -> 201;
  forgot with invalid -> 400; admin username login still OK.
- `npm run build` 104 modules 0 errors; `npm run lint` 0 errors.

---

# Profile Management

Own profile only (backend uses `request.user`; no id param, so no cross-user access).

## Backend (`accounts/`)
- `GET /api/profile/`: username, email (read-only), profile {full_name, company_name, mobile}.
- `PUT /api/profile/`: full_name* required, company_name optional, mobile 10 digits;
  sent `email` is ignored; creates profile for legacy users; syncs first_name.
- `POST /api/change-password/`: current* (verified), new* (min 6) + confirm (match);
  rotates token and returns the new one so the session continues.

## Frontend
- Navbar Profile link; protected `/profile` route; `Profile.jsx` with My Information
  view/edit + Change Password cards (Bootstrap, responsive).
- `services/api.js` + `AuthContext` (updateProfile/changePassword/refreshUser/loadProfile).

## Tests (temp account, removed after; 8/8 passed)
- View profile – OK; Edit+Save company/mobile – OK, email stayed unchanged – OK.
- Change password + login with new – OK; wrong current – 400; mismatch – 400.
- Bad mobile / empty name – 400 – OK; profile + change-password after logout – 401 – OK.
- Regression: admin username login, me, dashboard – OK.
- `npm run build` 105 modules 0 errors; `npm run lint` 0 errors.

---

# Strong Password Rule

One shared rule on both sides: min 8 chars + uppercase + lowercase + number +
special character. Login never checks strength, so older passwords keep working.
Passwords are always hashed via `set_password` (never plain text).

## Files
- Backend: `accounts/validators.py` (`password_error`); enforced in
  `RegisterSerializer`, reset-confirm and change-password views.
- Frontend: `src/utils/validatePassword.js`; enforced in Signup, Profile
  Change Password and Reset Password, each with hint text under the field.
- Message: "Password must be at least 8 characters and include an uppercase
  letter, a lowercase letter, a number and a special character."

## Tests
- Unit 9/9 both sides (short1!, alllowercase1!, ALLUPPER1!, NoNumber!!,
  NoSpecial12, Ab1! rejected; Pass1234!, Farmer@2026, Str0ng#Pass accepted).
- API: 5 weak registers -> 400; strong register 201; weak change/reset -> 400;
  mismatch -> 400; strong change + reset OK; admin (weak old password) login OK.
- `npm run build` 106 modules 0 errors; `npm run lint` 0 errors.

---

# Typo-Domain Rejection (extends Email Validation Fix)

Format check alone accepts well-formed typos (gmail.cm/co/con, gmial.com),
so a typo layer was added on both sides with one shared rule.

## Rule
- Exact provider name with an unknown variant (gmail.cm/co/con, yahoo.cm, ...) → reject.
- One typo away from a known domain (gmial.com, gmaill.com, ...) → reject.
- Known list covers gmail/yahoo/outlook/hotmail/live/icloud/rediffmail/zoho/
  proton/aol variants; any other well-formed domain (company.in, zoho.com) passes,
  so Gmail is not hardcoded as the only option.

## Files
- Backend: `accounts/validators.py` (`domain_typo_error`); enforced in
  registration serializer + reset-request view.
- Frontend: `src/utils/validateEmail.js` (same logic inside `isValidEmail`);
  Signup + Forgot Password block submit as before (Profile email is read-only,
  Login accepts usernames, Reset has no email field — correctly unchanged).
- Message unchanged: "Please enter a valid email address."

## Tests (18/18 both sides + API)
- Rejected: gmail.cm/co/con, gmial.com, gmailcom, kaushik@, @gmail.com,
  kaushik@gmail, kaushik@.com, kaushik..maurya@gmail.com — all rejected.
- Accepted: gmail.com, user.name@gmail.com, outlook.com, company.in, zoho.com,
  yahoo.co.in, outlook.in — all accepted.
- API: 3 typo registers → 400, typo forgot → 400, legit-domain register 201,
  admin login OK; temp account removed.
- `npm run build` 106 modules 0 errors; `npm run lint` 0 errors.

Note: the pre-existing account `kaushikmaurya7318@gmail.cm` was created before
this rule and was left untouched (existing users are never deleted).

---

# Responsive Layout Fix (UI only, no backend/API/DB changes)

## Cause
The navbar (`navbar-expand` with 7 module links + Profile + user + Logout in one
row) was wider than small viewports, forcing page-level horizontal scrolling.
Narrow filter columns (`col-8/col-4`) and non-wrapping button groups squeezed
content on split-screen and mobile.

## Changes (frontend only)
- `components/AppNavbar.jsx`: collapsible hamburger menu below `lg`
  (`navbar-expand-lg` + toggler + `collapse/show` state); menu closes on navigate.
- `index.css`: `overflow-x: clip` page guard (with `hidden` fallback); long text
  wraps instead of widening the layout. Tables keep inner scroll via existing
  `.table-responsive` wrappers.
- Filter rows stack full-width on mobile (Farmers search, Bills/Expenses/Reports
  button columns) and all `d-flex gap-2` button groups now wrap; Login links wrap.
- No functionality, API, database or business rules changed.

## Verification
- `npm run build` 106 modules 0 errors; `npm run lint` 0 errors (9 pre-existing
  style warnings, none new).
- Pattern audit: no `navbar-expand` without breakpoint, no narrow button columns,
  no unwrapped button groups remain.
- Manually resize check recommended: desktop, laptop, split-screen (~50% width),
  tablet and mobile — every page (Home, Farmers, Work, Bills, Payments, Expenses,
  Reports, Profile, Login/Signup/Forgot) should fit with no page-level sideways scroll
  (wide tables scroll inside their own container, which is intended).

---

# Site Footer (UI only)

- New `components/Footer.jsx`, rendered in `App.jsx` on every page: AgriWorks
  Manager + "Smart Farm Work & Irrigation Management System" + nav links
  (Home, Farmers, Work, Bills, Payments, Expenses, Reports) + "Developed for
  Agricultural Service Management" + "© 2026 AgriWorks Manager. All Rights Reserved."
- Matches navbar (`bg-success`, white text); stacks on mobile, links wrap;
  sticks to the bottom via flex layout (`#root` column + `mt-auto`), never overlaps.
- Footer shows the same `public/logo.png` asset as the navbar, centered above the
  content (`.footer-logo`: 40–60px responsive height, proportions kept).
- No functionality changes.
- `npm run build` 107 modules 0 errors; `npm run lint` 0 errors.

---

# Final Corrections Pass (SQLite kept, no data touched)

- Database: SQLite (`db.sqlite3`) confirmed as the project database; docs updated.
  Settings comment + `.env.example` updated; behavior unchanged (4 users, 1/1/1/2/0 intact).
- Reset tokens: explicit `PASSWORD_RESET_TIMEOUT` (24h default, env-overridable);
  single-use via password-state change. Forgot flow re-verified (no link exposure).
- Reports: table headers + summary keys now translated (EN/HI/MR) via label map.
- Tests: `backend/api/tests.py` — 5 smoke tests (auth, profile, password, full
  Farmer→Work→Bill→Payment→Expense chain, forgot/reset) run on an isolated test
  DB: `python manage.py test api` → OK (5 tests).
- Logo: `public/logo.png` resized 2298px/5.3MB → 512px/220KB, proportions kept.
- `testuser2` (empty, no email) identified as the only safe-to-remove test account;
  NOT deleted (awaiting confirmation). Other accounts are legitimate.
- Responsive re-audit: no overflow patterns; Profile layout stacks correctly.
- `npm run build` 109 modules 0 errors; `npm run lint` 0 errors; live dashboard
  and billing report re-verified (55/30/25).

---

# Multilingual Support: English / Hindi / Marathi (frontend only)

Centralized system, no duplicated pages: English text is the key,
`t('Save')` returns Hindi/Marathi from one dictionary with English fallback.

## Files
- New `src/i18n/translations.js` (276 keys × hi/mr) + `src/i18n/LanguageContext.jsx`
  (provider, `t()`, choice persisted in localStorage, `<html lang>` updated).
- `main.jsx`: app wrapped in `LanguageProvider`.
- Navbar: language selector (English/हिन्दी/मराठी); all links via `t()`.
- Translated screens: Dashboard, Farmers, Work, Bills, Payments, Expenses,
  Reports, Profile, Login, Signup, Forgot/Reset Password, Footer, ProtectedRoute —
  titles, labels, placeholders, buttons, table headers, validation/error/success
  and empty-state messages (error displays use `t()` so matching backend
  messages translate too; anything unmatched stays English).
- Data untouched: farmer names, amounts, dates, API endpoints, DB fields and
  code identifiers are never translated; select values stay English.
- Layout unchanged (same Bootstrap grid), so Devanagari text reflows safely;
  tables keep inner scroll.

## Verification
- `npm run build` 109 modules 0 errors; `npm run lint` 0 errors.
- Dictionary check: 276 hi + 276 mr keys, 0 empty; sample spot-check (nav,
  buttons, confirms, validation, reports) all resolve; unknown keys fall back
  to English. No backend changes.

---

# Navbar Logo (UI only)

- Logo file: `frontend/public/logo.png` (copied from the provided image,
  served at `/logo.png` and included in the production `dist` output).
- `components/AppNavbar.jsx`: brand now shows the logo image next to the
  AgriWorks text (still links to Home, still closes the mobile menu).
- `App.css` `.navbar-logo`: height-driven sizing (`clamp(28px, 4vw, 38px)`,
  `width: auto`, `object-fit: contain`) — original proportions kept, no
  distortion, scales across desktop/split-screen/tablet/mobile.
- No navigation or functionality changes.
- `npm run build` 109 modules 0 errors; `npm run lint` 0 errors.

---

# Maintenance Pass (13-09-2026, no data touched)

Fresh inspection from project files (no prior state reused).

## Checks – all passed
- `python manage.py check` – 0 issues
- `python manage.py test api` – 5 tests OK (isolated test DB)
- `python manage.py makemigrations --check` – no changes detected
- `pip check` – no broken requirements
- `npm run build` – 109 modules, 0 errors
- `npm run lint` – 0 errors (10 pre-existing fetch-on-mount style warnings only)
- Backend/frontend validators parity (email + typo-domain + strong password) – match
- Routes, i18n (286 hi + 286 mr keys, 0 missing), logo (220KB), footer, navbar – OK

## Fixes applied (3 small, non-breaking)
1. `backend/requirements.txt`: `mysqlclient`/`PyMySQL` commented out as optional
   (project DB is SQLite; they break fresh `pip install` on Windows without build tools).
2. `backend/config/settings.py` header comment: MySQL-primary wording corrected to SQLite.
3. `frontend/index.html` title: "frontend" -> "AgriWorks Manager".

## Notes (no change made, needs your decision)
- `frontend/.env` points to `http://192.168.0.105:8000/api` (LAN IP, baked in at build
  time). Keep it for LAN/mobile testing; switch to `http://127.0.0.1:8000/api`
  (see `.env.example`) before building for localhost-only use.
- Live DB now holds 4 users, 2 farmers, 2 works, 2 bills, 4 payments, 0 expenses
  (README phase sections describe older 1/1/1/2/0 snapshots – historical record kept).

---

# Stabilization Pass (13-09-2026, SQLite kept, no data touched)

Stack unchanged: React.js + Bootstrap frontend, Django + DRF backend, SQLite
(`db.sqlite3`). No migration, no feature removed, no working behavior altered.

## Issues found (all verified in code before fixing)
1. Backend `payments/views.py` `perform_update`: reassigning a payment to a
   different bill refreshed only the NEW bill; the OLD bill kept a stale
   Paid/Partial status. (Serializer allows bill change, so reachable.)
2. Backend `billing/views.py`: editing a bill's `total_amount` never
   recalculated `status` (e.g. raising total on a Paid bill left it Paid).
3. Backend `billing/serializers.py`: `if work and not attrs.get('total_amount')`
   treated an explicit `0` as missing and overwrote it with `work.amount`.
4. Frontend `pages/Reports.jsx`: summary row used raw `data.summary` instead of
   the guarded `summary` var (crash if backend omits it); CSV download used a
   detached `<a>` (fails on Firefox/Safari).
5. Frontend `pages/Dashboard.jsx`: `data.totals` / `data.recent_*` accessed
   without guards (malformed 200 response = white screen).

## Fixes made (minimal, behavior-preserving)
1. `perform_update` now refreshes the old bill too when `bill` is reassigned.
2. New `BillViewSet.perform_update` recalculates Paid/Partial/Unpaid from
   total vs sum(payments) after a bill edit (local helper, no import cycle).
3. Default-total condition changed to `attrs.get('total_amount') is None`,
   so explicit `0.00` is preserved.
4. Reports uses the guarded `summary` var; CSV anchor is appended to the DOM
   before click and removed after.
5. Dashboard uses `data?.totals || {}` and `(data?.recent_* || [])` defaults.

## Tests performed
- `python manage.py check` – 0 issues
- `python manage.py makemigrations --check` – no changes detected
- `python manage.py test` (full suite, isolated test DB) – 5 tests OK
- Temporary targeted tests on isolated test DB (deleted after run) – 3/3 OK:
  payment-reassign refreshes old bill (Paid->Unpaid, new bill Partial);
  bill total raise Paid->Partial with correct pending; explicit zero total kept.
- `pip check` – no broken requirements
- `npm run build` – 109 modules, 0 errors
- `npm run lint` – 0 errors (same 10 pre-existing fetch-on-mount style warnings)

## Deliberately NOT changed (working as designed)
- No 401 auto-logout interceptor (explicit error states work; auto-redirect
  would alter session behavior).
- Lint `set-state-in-effect` / `exhaustive-deps` warnings: standard
  fetch-on-mount idiom, not bugs.
- Email-login duplicate-email edge (`MultipleObjectsReturned`): unique
  constraint prevents it for new accounts; legacy-only risk.
- `frontend/.env` LAN IP (`192.168.0.105`) kept for LAN/mobile testing;
  switch to `127.0.0.1` per `.env.example` for localhost-only builds.

## Remaining issues
- None blocking. Live DB untouched (4 users, 2/2/2/4/0); dev server and
  production SMTP config remain environment tasks, not code defects.

---

# Login Connection Fix + A-to-Z Audit (13-09-2026, SQLite kept)

## Root cause (proven, not guessed)
- `frontend/.env` pointed to `http://192.168.0.105:8000/api` (stale LAN IP).
- Machine's current IP is `192.168.1.26`; old host times out (verified 3s timeout).
- Browser request fails with no response -> `Login.jsx:32` fallback shows
  "Login failed. Check backend connection."
- Backend was always healthy (listening 0.0.0.0:8000, `/api/health/` 200,
  admin exists/active/password usable, login logic accepts username -
  `Login.jsx` has no client-side email gate, so `admin` was never rejected).

## Fix (config only, 1 line, no auth logic touched)
- `frontend/.env`: `VITE_API_URL=http://127.0.0.1:8000/api` (matches `.env.example`).
- Rebuilt frontend so `dist/` embeds the correct URL (verified: no `192.168.0.105`
  in bundle, `127.0.0.1:8000` present).
- Action needed once: restart `npm run dev` (Vite reads `.env` at startup).

## Live verification (dev DB, reads + login only)
- `POST /api/login/ {admin,admin123}` -> 200 + token (username path proven).
- Token -> `GET /me/` 200, `GET /api/dashboard/` 200
  (income 80, received 44, pending 36 = 80-44 math verified).
- Wrong password -> 400 `{"error":"Invalid email or password."}` (proper message,
  not connection error). Redirect to `/` is code-verified (`Login.jsx:30`).

## A-to-Z automated audit (isolated test DB, temp file deleted after)
- 25 tests: 5 existing + 20 new covering registration/validation, username+email
  login, negatives, logout, forgot/reset (incl. single-use + weak/mismatch),
  profile, farmer CRUD, all 5 work types + validations, billing (auto-fill,
  duplicate block), payments Rs.10000 cases A-E (0/4000/6000/overpay-reject/
  2000+3000+5000), update/delete revert, expenses 4 types + invalids,
  dashboard math (20000/12000/8000/5000), all 6 reports + filters,
  cross-user isolation, cascade delete (no orphans). Result: 25/25 OK.
- `manage.py check` 0 issues; `pip check` clean; `npm run build` 109 modules
  0 errors; `npm run lint` 0 errors (10 pre-existing style warnings).
- i18n: 286 hi + 286 mr keys, 0 missing, 0 empty. Delete confirms, loading,
  empty, error and success states present on all pages (UI grep verified).
- Live dev-DB note: during this session interactive testing added 1 farmer +
  1 work + 1 bill + 2 payments (10:33-10:35); none of these rows came from
  audit commands (all audit writes ran on the isolated test DB).
