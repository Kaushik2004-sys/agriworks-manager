# AgriWorks Manager – Smart Farm Work & Irrigation Management System

## Project Overview

AgriWorks Manager is a web-based agricultural service management system for tractor owners, irrigation service providers, and agricultural contractors. It replaces paper/notebook records with structured digital records for farmers, agricultural work, billing, payments, expenses, and business reports.

Developed as a B.Sc. IT academic project.

## Live Application

Live Frontend: [https://agriworks-manager-frontend.vercel.app/](https://agriworks-manager-frontend.vercel.app/)

## Key Features

- User registration and login (email, username, or registered 10-digit mobile number), logout
- 24-hour authentication token expiry with single active session per account
- Email-based password reset (single-use link) and password change
- Farmer management (add, view, edit, delete, search)
- Agricultural work management (Ploughing, Rotavator, Cultivation, Harvesting, Irrigation, Other, Land Leveling)
- Bill generation from unbilled work records, with automatic Unpaid / Partial / Paid status
- Payment tracking with automatic pending-amount calculation (overpayment is rejected)
- Expense management (Diesel, Maintenance, Driver Wages, Other)
- Dashboard with business totals and recent activity
- Reports (work, billing, payments, pending payments, expenses, business performance) with filters and CSV export
- Problem reporting with screenshot upload, plus admin problem-report management
- Admin functionality (system overview, registered users, login history) for superusers
- English / Hindi / Marathi language support
- Responsive Bootstrap UI with Light / Dark mode
- Informational pages (About, Help & Support, FAQ, Privacy Policy, Terms & Conditions, Disclaimer, Contact & Report Problem)

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React.js, Bootstrap, Vite, Axios, React Router |
| Backend | Python, Django, Django REST Framework |
| Database | MySQL |
| Hosting | Vercel, Render, Aiven |

## System Architecture

```text
React.js Frontend
        ↓  Token-authenticated JSON API (Axios)
Django REST API
        ↓  Django ORM
MySQL Database
```

## Live Information Pages

- [एग्रीवर्क्स के बारे में](https://agriworks-manager-frontend.vercel.app/about)
- [सहायता व समर्थन](https://agriworks-manager-frontend.vercel.app/help-support)
- [अक्सर पूछे जाने वाले प्रश्न](https://agriworks-manager-frontend.vercel.app/faq)
- [गोपनीयता नीति](https://agriworks-manager-frontend.vercel.app/privacy)
- [नियम व शर्तें](https://agriworks-manager-frontend.vercel.app/terms)
- [अस्वीकरण](https://agriworks-manager-frontend.vercel.app/disclaimer)
- [संपर्क व समस्या रिपोर्ट](https://agriworks-manager-frontend.vercel.app/contact-support)

## Project Structure

```text
agriworks-manager/
├── backend/
│   ├── accounts/
│   ├── api/
│   ├── billing/
│   ├── expenses/
│   ├── farmers/
│   ├── payments/
│   ├── support/
│   ├── works/
│   └── config/
├── frontend/
│   └── src/
└── README.md
```

## Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Configure `backend/.env`, then:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

MySQL 8.x is required — create the database first:

```sql
CREATE DATABASE agriworks_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

Use `backend/.env.example` and `frontend/.env.example` as templates. Never commit real secrets.

## Project Status

AgriWorks Manager is an implemented and deployed B.Sc. IT academic project. The frontend is hosted on Vercel, the backend on Render, and the database on Aiven MySQL.
