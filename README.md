# AgriWorks Manager – Smart Farm Work & Irrigation Management System

## Project Overview

AgriWorks Manager is a web-based agricultural service management system designed for tractor owners, irrigation service providers, and agricultural contractors. It manages farmers, agricultural work, billing, payments, expenses, reports, and related records from one central place.

Developed as a B.Sc. IT academic project.

## Problem Statement

Small agricultural service providers typically depend on paper/notebook-based records, which causes:

- Difficulty tracking agricultural work across farmers and dates
- Calculation mistakes in bills and pending amounts
- Pending payments that are hard to follow up
- Expense tracking spread across notebooks
- Misplaced or damaged records
- Difficulty generating business reports

AgriWorks Manager replaces the notebook with structured digital records, automatic calculations, and reports. It is an academic project and is not presented as a commercially deployed product.

## Main Features

- User registration and login (email or username), logout
- Password reset via email link and password change
- Farmer management (add, view, edit, delete, search)
- Agricultural work management, linked to one farmer per record
- Supported work types: Ploughing, Rotavator, Cultivation, Harvesting, Irrigation, Other, Land Leveling
- Automatic bill generation from unbilled work records
- Bill status: Unpaid, Partial, Paid (recalculated automatically)
- Generated bill totals are locked after bill creation and cannot be changed
- Payment recording with farmer-first selection: Farmer → Work/Bill → Payment
- Payment methods: Cash, UPI, Bank Transfer, Cheque, Other
- Expense management (Diesel, Maintenance, Driver Wages, Other)
- Dashboard with totals and recent activity, plus focused detail views
- Reports (work, billing, payments, pending payments, expenses, business performance) with filters, CSV export and print layout
- Problem reporting / support with screenshot upload
- My Reports with Pending / In Progress / Resolved status visibility
- Admin (superuser) functionality: system overview, problem-report management, login-history viewing
- Responsive Bootstrap UI for mobile, tablet and desktop
- Multi-language support: English, Hindi, Marathi
- Light and Dark mode
- Informational pages: About, Help & Support, FAQ, Privacy Policy, Terms & Conditions, Disclaimer, Contact & Report Problem

## Technology Stack

Frontend:

- React.js
- Bootstrap
- Vite
- Axios
- React Router

Backend:

- Python
- Django
- Django REST Framework

Database:

- MySQL (current development database: MySQL 8.4)

## System Architecture

```text
React frontend (Vite)
        ↓  Token-authenticated JSON API (Axios)
Django REST API
        ↓  Django ORM (mysqlclient)
MySQL database
```

The frontend calls the Django REST API with a per-login token (`Token <key>` in the `Authorization` header). The API is namespaced under `/api/` (for example, `/api/health/`, `/api/farmers/`, `/api/bills/`).

## Project Structure

```text
AgriWorks Manager/
├── backend/
│   ├── accounts/        # registration, login, profile, password reset, login history
│   ├── api/             # health, dashboard, reports, admin overview, shared tests
│   ├── billing/         # bills
│   ├── expenses/        # expenses
│   ├── farmers/         # farmers
│   ├── payments/        # payments
│   ├── support/         # problem reports
│   ├── works/           # agricultural work records
│   ├── config/          # settings, root URLs, WSGI
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── i18n/        # English, Hindi, Marathi translations
│   │   ├── pages/
│   │   ├── services/    # API helpers per module
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Important Business Rules

Confirmed by the current implementation:

- Users can access only their own applicable records (all business queries are scoped to the logged-in user; admin/superuser-only views are restricted to superusers).
- Bill total must be greater than 0.
- A generated bill total cannot be changed after creation (same-value resubmits are allowed).
- Bill total cannot become lower than the amount already paid.
- Pending amount cannot become negative.
- Overpayment (payment above the pending amount) is rejected.
- Bill status follows payment state: no payment → Unpaid, partial → Partial, fully paid → Paid.
- Problem reports are scoped to the reporting user; only superusers can change status or delete reports.
- Payment date cannot be in the future or before the bill date.

## Installation / Local Setup (Windows)

### 1. Clone the repository

Use the repository's normal GitHub clone process.

### 2. MySQL database

Install MySQL 8.x and create the database:

```sql
CREATE DATABASE agriworks_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Configure `backend/.env` (see Environment Variables below), then:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

The backend API will be available at `http://127.0.0.1:8000/api/`. Verify it at `http://127.0.0.1:8000/api/health/` (it reports database connectivity).

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` (Vite may bind IPv6 localhost on some machines; use `localhost` rather than `127.0.0.1` for the dev URL if needed).

## Environment Variables

Copy the examples and fill real values. Never commit `.env` files (both are git-ignored).

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Database configuration (`backend/.env`):

```text
DB_NAME=agriworks_db
DB_USER=root
DB_PASSWORD=AgriWorks@123
DB_HOST=127.0.0.1
DB_PORT=3306
```

Frontend API configuration (`frontend/.env`):

```text
VITE_API_URL=http://127.0.0.1:8000/api
```

Optional SMTP / password-reset configuration (`backend/.env`; without it, reset emails go to the Django console instead of a real inbox):

```text
EMAIL_BACKEND=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-gmail@example.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
DEFAULT_FROM_EMAIL=your-gmail@example.com
```

## API Overview

Major areas under `/api/` (all except registration/login/password-reset require authentication):

- `health/` — service and database status
- `register/`, `login/`, `logout/`, `me/`, `profile/`, `change-password/`
- `password-reset/request/`, `password-reset/confirm/`
- `farmers/`, `works/`, `bills/`, `payments/`, `expenses/`
- `problem-reports/` (own reports for users; full management for superusers)
- `dashboard/`, `reports/`
- `admin/overview/`, `admin/login-history/` (superusers only)

## Testing

Latest verified results against MySQL:

- Django `manage.py check` → PASS
- Backend test suite → **28/28 PASS**
- Frontend lint → 0 errors
- Frontend build → successful
- Migration consistency (`makemigrations --check`, unapplied migrations) → PASS

These are the current automated checks passing; they are not a claim of absolute production readiness.

## Security / Data Safety

Confirmed implementation details (not a hacker-proof claim):

- Token authentication; passwords are stored hashed using Django's default password hasher and are never returned by the API.
- Business data is scoped per user at the queryset level; admin endpoints require superuser status.
- Password-reset links are single-use, expire after 24 hours, and are delivered only to the registered email address (never in API responses).
- Keep `SECRET_KEY`, database passwords, Gmail App Passwords and API tokens out of source control (`.env` files are ignored by Git).

## Project Status

Academic/college project under development and finalization. Not production-deployed.

## Future Enhancements

Ideas only, not current features:

- Cloud deployment
- Automated backups
- Advanced analytics
- Notifications
- Additional agricultural service features
