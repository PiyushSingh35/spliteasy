# SplitEasy — a Splitwise-inspired expense splitter

A simplified, full-stack Splitwise clone: create groups, add members, log expenses
with **equal / unequal / percentage** splits, track **pairwise net balances**, record
**settlements**, and discuss expenses via comments. Built for the Spreetail Full-Stack
(Python + React) internship assignment.

> **AI tool used:** Claude (Anthropic) — acting as a "junior engineer" that interviewed
> the developer, recorded every decision in `AI_CONTEXT.md`, then implemented and tested
> the app. See `AI_CONTEXT.md`, `BUILD_PLAN.md`, and `KEY_PROMPTS.md`.

---

## Tech stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Python, Django 5.2, Django REST Framework, SimpleJWT |
| Database | PostgreSQL 18 (relational) |
| Frontend | React 19, Vite, Tailwind CSS v4, axios, React Router |
| Auth     | JWT (access + refresh, refresh-token blacklist on logout) |

---

## Features

- **Auth**: signup / login / logout with JWT; protected routes.
- **Groups**: create, view, delete; add members by **username**; remove members.
- **Expenses**: equal, unequal (exact amounts), and percentage splits — with
  money-safe rounding (integer paise; payer absorbs the remainder).
- **Balances**: cached **pairwise net** balances per group (bidirectional debts
  collapse to a single net figure).
- **Settlements**: record full or partial payments; balances update instantly.
- **Comments**: discussion thread per expense.
- **Notifications**: in-app notifications (no email).

---

## Project structure

```
Splitwise-app-clone/
├── backend/                 # Django + DRF API
│   ├── splitwise/           # project settings & root URLs
│   ├── api/                 # models, services (debt engine), serializers, views, urls, tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # React + Vite + Tailwind
│   └── src/                 # api/, context/, pages/, components/, utils/
├── AI_CONTEXT.md            # source-of-truth context (product → schema → API → deploy)
├── BUILD_PLAN.md            # research, architecture, AI collaboration, tradeoffs
└── KEY_PROMPTS.md           # the key prompts used with the AI
```

---

## Local setup

### Prerequisites
- Python 3.11+ (developed on 3.14)
- Node.js 18+
- PostgreSQL 14+ (developed on 18)

### 1. Database
Create a database called `splitwise` (any name works — match it in `.env`):
```bash
createdb -U postgres splitwise
```

### 2. Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Configure environment
cp .env.example .env
#   -> set SECRET_KEY and DATABASE_URL (URL-encode special chars in the password, e.g. @ -> %40)

python manage.py migrate
python manage.py createsuperuser     # optional, for /admin
python manage.py runserver           # http://127.0.0.1:8000
```

**`.env` example**
```
SECRET_KEY="<random-long-string>"
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://postgres:<url-encoded-password>@localhost:5432/splitwise
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 3. Frontend
```bash
cd frontend
npm install
# .env already points at the local API:
#   VITE_API_URL=http://127.0.0.1:8000/api
npm run dev                          # http://localhost:5173
```

Open http://localhost:5173, sign up, and start splitting.

---

## Running tests

The critical debt-calculation engine is unit-tested:
```bash
cd backend
python manage.py test api
```

---

## API overview

Base URL: `/api`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/signup/` | Register, returns JWT + user |
| POST | `/auth/login/` | Login, returns JWT + user |
| POST | `/auth/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET/PUT | `/users/me/` | Current user profile |
| GET | `/users/search/?username=` | Find user by username |
| GET/POST | `/groups/` | List / create groups |
| GET/PUT/DELETE | `/groups/{id}/` | Group detail |
| POST | `/groups/{id}/members/` | Add member (by username) |
| DELETE | `/groups/{id}/members/{userId}/` | Remove member |
| GET/POST | `/groups/{id}/expenses/` | List / create expenses |
| GET/DELETE | `/expenses/{id}/` | Expense detail / delete |
| GET/POST | `/expenses/{id}/comments/` | List / add comments |
| GET | `/groups/{id}/balances/` | Pairwise balances |
| GET/POST | `/groups/{id}/settlements/` | List / record settlements |
| GET | `/notifications/` | List notifications |

---

## How the debt engine works (the core)

1. **Splitting** works in integer **paise** to avoid floating-point drift; the payer
   receives any leftover paise so splits always sum to the exact total.
2. **Balances** are stored in canonical `(user_low, user_high)` pairs with a signed
   `net_amount` (positive ⇒ low owes high), so A↔B never duplicates.
3. On any expense or settlement change, the group's balances are **recomputed from
   scratch** (correctness over micro-optimization), folding settlements in as
   debt reductions.

See `backend/api/services.py`.
