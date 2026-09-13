# AgriWorks Manager

## Project Overview
AgriWorks Manager is a web-based agricultural work and irrigation management system designed for tractor owners, irrigation service providers and agricultural contractors.

It helps manage:
- Farmers
- Agricultural work records
- Bills
- Payments
- Pending payments
- Expenses
- Dashboard monitoring
- Reports

## Key Features
- User authentication
- Farmer management
- Agricultural work management
- Billing management
- Payment tracking
- Expense management
- Dashboard with summaries
- Detailed dashboard views
- Reports and CSV export
- Profile management
- Password reset
- English, Hindi and Marathi language support
- Light and Dark mode
- Responsive Bootstrap UI
- Back and Next navigation
- Informational pages
- Mobile/tablet/desktop support

## Technology Stack

### Frontend
- React.js
- Vite
- Bootstrap 5
- Axios
- React Router

### Backend
- Python
- Django
- Django REST Framework
- Django CORS Headers

### Database
- SQLite

## Project Structure

```
AgriWorks Manager/
├── backend/
│   ├── accounts/
│   ├── api/
│   ├── billing/
│   ├── expenses/
│   ├── farmers/
│   ├── payments/
│   ├── works/
│   ├── config/
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── i18n/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## Requirements

- Python 3.x
- Node.js
- npm

## Local Setup

### 1. Clone the repository

Use the repository's normal GitHub clone process.

### 2. Backend setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

- Windows:
  ```bash
  venv\Scripts\activate
  ```
- macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

Then install dependencies and prepare the database:

```bash
pip install -r requirements.txt
python manage.py migrate
```

Create an admin account:

```bash
python manage.py createsuperuser
```

Start the backend server:

```bash
python manage.py runserver
```

The backend API will be available at `http://127.0.0.1:8000/api/`.

You can verify it is running at `http://127.0.0.1:8000/api/health/`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Environment configuration

Copy the provided example files and adjust them for your machine:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Never commit real secret keys, passwords or tokens to the repository.

## Application Overview

### Main sections (after login)

- Home (Dashboard) — `/`
- Farmers — `/farmers`
- Work — `/works`
- Bills — `/bills`
- Payments — `/payments`
- Expenses — `/expenses`
- Reports — `/reports`
- Profile — `/profile`

### Dashboard detail views

Each dashboard summary card opens a focused read-only detail view:

- `/dashboard/work-records`
- `/dashboard/income`
- `/dashboard/payments`
- `/dashboard/pending-payments`
- `/dashboard/expenses`
- `/dashboard/farmers`

### Informational pages

- About AgriWorks — `/about`
- Help & Support — `/help-support`
- FAQ — `/faq`
- Privacy Policy — `/privacy`
- Terms & Conditions — `/terms`
- Disclaimer — `/disclaimer`

## Notes for evaluators

- The interface is available in English, Hindi and Marathi via the language selector in the navbar.
- Light and Dark mode can be switched from the navbar; the choice is remembered in the browser.
- The Reports page supports filtering, CSV export and a print-friendly A4 layout.
- The project uses SQLite as its database; no additional database server is required.
