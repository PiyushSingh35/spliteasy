# AI_CONTEXT.md - Splitwise Clone Internship Assignment

**Last Updated**: 2026-06-06  
**Deadline**: 2026-06-07 12:00 PM  
**Build Time**: ~24 hours

---

## 1. PRODUCT UNDERSTANDING

### Core Problem
Build a debt-splitting & settlement app. The **primary purpose** is accurate calculation of who owes whom after complex group expenses.

### User Personas
- Users who share expenses with friends (1-to-1) and groups (3+)
- Need to track balances and settle debts

### Research Summary
- Not a Splitwise power user, learned from research
- Key insights: pairwise net balance calculation is critical (e.g., if Alice owes Bob $50 and Bob owes Alice $20, show net Alice owes Bob $30)

---

## 2. PRODUCT SCOPE

### MVP Core Workflow (MUST HAVE - THE LOOP)
```
1. User logs in
2. Creates a group
3. Adds friends to the group
4. Logs an expense
5. Views detailed balance board
6. Records a settlement
```

Everything else is secondary.

### Feature Breakdown

#### MUST HAVE ✅
- **User & Friend Management**: 
  - Basic profile (username, email, name)
  - **Direct Add Friends**: Search by username → instant add to group (no approval pipeline)
  - When adding to group: search by username → if exists, instant add; if not, show "User not found"
- **Group Creation**: Users create groups to track shared expenses
- **Expense Splitting** (3 strategies):
  - Equal split (with automatic rounding: if ₹100 ÷ 3 people, allocate ₹33.34 to payer, ₹33.33 to others, must total exactly ₹100)
  - Unequal split (manual amounts: Alice pays ₹300 bill, manually define Alice owes ₹100, Bob owes ₹150, Charlie owes ₹50)
  - Percentage split (Alice 50%, Bob 30%, Charlie 20% of total)
- **Balance Tracking**: Pairwise net balances (if Alice owes Bob $50 and Bob owes Alice $20, show Alice owes Bob $30)
- **Settlements**: Record partial or full payments; settlement **reduces the balance** (Alice owes Bob), no two-party confirmation workflow
- **Balance Board**: Detailed breakdown view (e.g., "I owe Alice ₹100, Bob owes me ₹50")
- **Bill Payment History**: View list of all expenses
- **Comments on Expenses**: Simple discussion thread (array of comments with user_id, timestamp, text)

#### NICE TO HAVE 🟡
- **Expense Categories**: Simple string field ("Food", "Travel"), not a relational table
- **In-App Notifications (No Emails)**: 
  - When User A creates expense in group, other members get in-app notification
  - Simple notification array in User schema: [{ message, read, createdAt }]
  - Display in dropdown menu on frontend
  - **NO SendGrid/SMTP** — just in-app only

#### SKIP ❌
- Receipt photo upload (AWS S3/file storage is too time-consuming)
- Recurring expenses (requires cron jobs, too complex)
- User profile customization (no avatars, just name + email)
- Email notifications (skip SMTP/SendGrid completely)
- Mobile app (responsive web UI with Tailwind CSS only)
- Real-time WebSockets/Socket.io
- "Share split" (redundant with percentage; adds UI complexity)

### Real-Time Chat in Expenses
- Implementation: Simple **discussion thread on completed expenses**
- Data structure: Array of comment objects (user_id, timestamp, text) stored in Expense table
- **NO WebSockets** — fetch comments on page load only

---

## 3. IMPLEMENTATION DECISIONS ✅

### Critical Decision: Debt Calculation Engine
- **Primary responsibility**: Accurately compute pairwise balances
- **Algorithm**: After each expense, recalculate all balances in the group
- **Rounding**: For equal splits, allocate ₹33.34 to payer, ₹33.33 to others (must total exactly original amount)
- **Collapse logic**: If Alice owes Bob $50 AND Bob owes Alice $20, store net balance: Alice owes Bob $30
- **Implementation**: Cached balance table (eager calculation on expense creation)

### Authentication ✅
- **JWT (JSON Web Tokens)**
- User signs up with email/password
- Backend generates JWT token
- Frontend stores token in localStorage
- Send token with each API request in Authorization header

### Database Choice ✅
- **PostgreSQL** (latest stable version)
- Relational schema (no MongoDB)

### Frontend Architecture ✅
- **React** with **Context API + useReducer** for state management
- **Tailwind CSS** for styling
- Responsive design (mobile-friendly)

### Backend Architecture ✅
- **Django 5.x** + **Django REST Framework (DRF)**
- Python backend
- Gunicorn WSGI server

### Deployment ✅
- **AWS EC2 + RDS**
- **Frontend**: S3 + CloudFront (static files)
- **Backend**: EC2 instance (Gunicorn + Django)
- **Database**: RDS PostgreSQL
- **Environment**: Production-ready with env variables

---

## 4. ENGINEERING REQUIREMENTS (TO BE UPDATED)

### Core Entities (To be designed)
- Users
- Friends
- Groups
- Expenses
- Settlements
- Comments (on expenses)

### API Endpoints (To be designed)
- TBD

### Database Schema (To be designed)
- TBD

---

## 5. TECH STACK ✅ FINALIZED

### Backend
- **Framework**: Django 5.x + Django REST Framework (DRF) 3.x
- **Language**: Python 3.11+
- **WSGI Server**: Gunicorn
- **Key Libraries**:
  - djangorestframework (API endpoints)
  - django-cors-headers (CORS support)
  - python-decouple (environment variables)
  - psycopg2-binary (PostgreSQL adapter)

### Frontend
- **Framework**: React 18.x
- **State Management**: Context API + useReducer
- **Styling**: Tailwind CSS 3.x
- **HTTP Client**: Axios or Fetch API
- **Build Tool**: Create React App or Vite
- **Key Libraries**:
  - axios (API calls)
  - react-router-dom (routing)

### Database
- **Type**: PostgreSQL (latest stable)
- **Version**: PostgreSQL 15+
- **ORM**: Django ORM (models)

### Deployment
- **AWS Services**:
  - **EC2**: t2.micro or t2.small instance (Django + Gunicorn)
  - **RDS**: PostgreSQL database
  - **S3**: React build files
  - **CloudFront**: CDN for frontend
  - **Route 53**: DNS (optional)
- **Environment**: Production with secure settings

---

## 6. DATA MODEL ✅ FINALIZED (PostgreSQL)

### Tables

#### 1. User
```sql
id (PK, Auto-increment)
username (Unique, String, 150) — for search & display
email (Unique, String, 255)
password (String, hashed with Django auth)
name (String, 255) — full name
created_at (DateTime, auto_now_add)
updated_at (DateTime, auto_now)
```

#### 2. Group
```sql
id (PK, Auto-increment)
name (String, 255)
created_by (FK → User.id)
description (Text, nullable)
created_at (DateTime, auto_now_add)
updated_at (DateTime, auto_now)
```

#### 3. GroupMember (Join table)
```sql
id (PK, Auto-increment)
group_id (FK → Group.id)
user_id (FK → User.id)
joined_at (DateTime, auto_now_add)
(Unique constraint: group_id + user_id)
```

#### 4. Expense
```sql
id (PK, Auto-increment)
group_id (FK → Group.id)
payer_id (FK → User.id)
amount (Decimal, 10,2) — total amount
description (String, 255)
category (String, 50, nullable) — e.g., "Food", "Travel"
split_type (String, 20) — "equal" | "unequal" | "percentage"
created_at (DateTime, auto_now_add)
updated_at (DateTime, auto_now)
```

#### 5. ExpenseSplit (Individual splits per expense)
```sql
id (PK, Auto-increment)
expense_id (FK → Expense.id)
user_id (FK → User.id)
amount_owed (Decimal, 10,2) — exact amount this user owes for this expense
split_type (String, 20) — redundant for clarity
(Unique constraint: expense_id + user_id)
```

#### 6. ExpenseComment
```sql
id (PK, Auto-increment)
expense_id (FK → Expense.id)
user_id (FK → User.id)
comment_text (Text)
created_at (DateTime, auto_now_add)
```

#### 7. Balance (Cached pairwise balances)
```sql
id (PK, Auto-increment)
group_id (FK → Group.id)
user_id_1 (FK → User.id)
user_id_2 (FK → User.id)
net_amount (Decimal, 10,2) — positive = user_id_1 owes user_id_2
last_updated (DateTime, auto_now)
(Unique constraint: group_id + user_id_1 + user_id_2)
```

#### 8. Settlement (Payment records)
```sql
id (PK, Auto-increment)
group_id (FK → Group.id)
from_user_id (FK → User.id)
to_user_id (FK → User.id)
amount (Decimal, 10,2)
created_at (DateTime, auto_now_add)
```

#### 9. Notification (In-app only)
```sql
id (PK, Auto-increment)
user_id (FK → User.id)
message (Text)
is_read (Boolean, default False)
created_at (DateTime, auto_now_add)
```

### Debt Calculation Logic ✅
- **Trigger**: After each expense creation
- **Algorithm**:
  1. Calculate splits for the new expense (handle rounding for equal splits)
  2. For each split, update the Balance table
  3. Collapse bidirectional debts: if user_id_1 owes user_id_2 $50 AND user_id_2 owes user_id_1 $20, store net: user_id_1 owes user_id_2 $30
  4. Update Balance.last_updated timestamp
- **Settlement Impact**: When settlement is recorded, reduce the balance directly (net_amount -= settlement.amount)

---

## 7. API DESIGN ✅ FINALIZED (RESTful)

### Authentication Endpoints
```
POST   /api/auth/signup                    (email, password, name)
POST   /api/auth/login                     (email, password) → returns JWT token
POST   /api/auth/logout                    (no body, invalidates token)
GET    /api/auth/me                        (returns current user)
```

### User Endpoints
```
GET    /api/users/me                       (get own profile)
PUT    /api/users/me                       (update own profile: name, email)
GET    /api/users/search?username=alice    (search user by username, returns user if exists)
```

### Group Endpoints
```
GET    /api/groups                         (list all groups for current user)
POST   /api/groups                         (create group: name, description)
GET    /api/groups/{id}                    (get group details + members)
PUT    /api/groups/{id}                    (update group: name, description)
DELETE /api/groups/{id}                    (delete group)
POST   /api/groups/{id}/members            (add member to group: user_id or email)
DELETE /api/groups/{id}/members/{user_id}  (remove member from group)
```

### Expense Endpoints
```
GET    /api/groups/{id}/expenses                     (list all expenses in group)
POST   /api/groups/{id}/expenses                     (create expense)
       Body: {
         payer_id, amount, description, category,
         split_type: "equal|unequal|percentage",
         splits: [{ user_id, amount_or_percentage }, ...]
       }
GET    /api/expenses/{id}                           (get expense details + comments)
PUT    /api/expenses/{id}                           (update expense)
DELETE /api/expenses/{id}                           (delete expense)
```

### Comment Endpoints
```
POST   /api/expenses/{id}/comments                   (add comment: comment_text)
GET    /api/expenses/{id}/comments                   (get all comments)
```

### Balance Endpoints
```
GET    /api/groups/{id}/balances                     (get all pairwise balances in group)
       Returns: [
         { from_user: {...}, to_user: {...}, amount: 50.00 },
         ...
       ]
```

### Settlement Endpoints
```
POST   /api/groups/{id}/settlements                  (record payment/settlement)
       Body: { from_user_id, to_user_id, amount }
GET    /api/groups/{id}/settlements                  (list all settlements in group)
```

### Notification Endpoints
```
GET    /api/notifications                            (get user's notifications)
PUT    /api/notifications/{id}/read                  (mark notification as read)
GET    /api/notifications/unread-count               (get unread count)
```

---

## 8. FRONTEND STRUCTURE ✅ FINALIZED

### Pages
1. **Login Page** (`/login`)
   - Email, password form
   - Link to signup

2. **Signup Page** (`/signup`)
   - Email, password, name form
   - Link to login

3. **Dashboard** (`/dashboard`)
   - List of all user's groups
   - "Create Group" button
   - Search/filter groups

4. **Group Details** (`/groups/{id}`)
   - Group name, members list
   - "Add Member" modal (search by email)
   - "Remove Member" button
   - List of all expenses in group
   - "Add Expense" button
   - Link to "Balance Board"

5. **Balance Board** (`/groups/{id}/balances`)
   - Table showing: "I owe Alice ₹100", "Bob owes me ₹50"
   - "Settle Payment" button for each balance

6. **Add/Edit Expense Modal**
   - Payer (dropdown)
   - Total amount
   - Description, category
   - Split type: radio (equal / unequal / percentage)
   - Dynamic split form based on split type:
     - Equal: just shows "Equal split among N people"
     - Unequal: input field for each person's amount
     - Percentage: input field for each person's percentage
   - "Add Expense" button

7. **Expense Detail** (`/expenses/{id}`)
   - Expense info (payer, amount, description, category, splits)
   - Comments section
   - "Add Comment" form
   - "Edit" / "Delete" buttons (if user is payer)

8. **Settlement Modal**
   - From user, To user, Amount
   - "Record Payment" button

### State Management (Context API + useReducer)
- Global state:
  - currentUser
  - groups
  - expenses
  - balances
  - notifications

### Routing
- `/login` → LoginPage
- `/signup` → SignupPage
- `/dashboard` → DashboardPage
- `/groups/{id}` → GroupDetailsPage
- `/groups/{id}/balances` → BalanceBoardPage
- `/expenses/{id}` → ExpenseDetailPage
- Protected routes: require JWT token

### Styling
- Tailwind CSS
- Responsive design (mobile-first)
- Color scheme: Modern, clean

---

## 9. DEPLOYMENT PLAN ✅ FINALIZED (AWS)

### Architecture
```
┌─────────────────────────────────────────┐
│         Internet (Users)                │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │  CloudFront    │ (CDN)
         │  (Cache Layer) │
         └───────┬────────┘
                 │
        ┌────────▼────────┐
        │   S3 Bucket     │ (React build)
        │ (Static files)  │
        └─────────────────┘
        
        ┌─────────────────────┐
        │  Route 53           │ (DNS)
        │  (Domain)           │
        └──────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Application Load   │
         │  Balancer (ALB)     │
         └─────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │  EC2 Instance        │
        │  (Django + Gunicorn) │
        │  (t2.small)          │
        └──────────┬───────────┘
                   │
        ┌──────────▼───────────┐
        │  RDS PostgreSQL      │
        │  (Database)          │
        └──────────────────────┘
```

### Step-by-Step Deployment

#### 1. Database Setup (RDS)
- Create RDS PostgreSQL instance (db.t3.micro or larger)
- Create database
- Set security group to allow EC2 access
- Run migrations: `python manage.py migrate`

#### 2. EC2 Setup
- Launch EC2 instance (t2.small, Ubuntu 20.04 or 22.04)
- Install Python 3.11, pip, virtualenv
- Install PostgreSQL client
- Clone repo from GitHub
- Create virtual environment
- Install requirements: `pip install -r requirements.txt`
- Configure environment variables (.env file):
  - SECRET_KEY
  - DEBUG=False
  - ALLOWED_HOSTS
  - DATABASE_URL (RDS connection string)
  - CORS_ALLOWED_ORIGINS (frontend URL)
  - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (if using S3)

#### 3. Gunicorn + Systemd
- Create systemd service file for Gunicorn
- Configure to start on boot
- Serve Django app on port 8000

#### 4. Nginx (Reverse Proxy)
- Install Nginx
- Configure as reverse proxy to Gunicorn
- Serve on port 80/443 (HTTP/HTTPS)
- Add SSL certificate (AWS Certificate Manager or Let's Encrypt)

#### 5. Frontend Deployment (S3 + CloudFront)
- Build React: `npm run build`
- Upload build files to S3
- Create CloudFront distribution pointing to S3
- Set custom domain via Route 53

#### 6. Domain & HTTPS
- Use Route 53 to manage DNS
- Point domain to CloudFront (frontend) and ALB (backend)
- Enable HTTPS on both (ACM certificates)

#### 7. Environment Variables
```
# Backend (.env on EC2)
SECRET_KEY=<your-secret-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/dbname
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### 8. Monitoring
- CloudWatch for logs
- Simple health checks on `/api/health` endpoint

### Cost Estimate
- EC2 t2.small: ~$10/month
- RDS db.t3.micro: ~$10/month (or free tier if eligible)
- S3 + CloudFront: ~$2-5/month (for low traffic)
- Route 53: ~$0.50/month per domain
- **Total**: ~$25-30/month

### Backup Plan (Quick Deployment)
If EC2 + RDS setup takes too long:
- Use **Render.com** or **Railway.app** instead (PostgreSQL + Django in one click)
- Deploy frontend to **Vercel** or **Netlify**
- Much faster, but costs money after free tier

---

## 10. TESTING PLAN ✅

### Critical Path: Debt Calculation Tests
**Priority 1 — MUST TEST** (manual + unit tests):

1. **Equal Split Rounding**
   - ₹100 ÷ 3 people = ₹33.34, ₹33.33, ₹33.33
   - ₹1000 ÷ 7 people = correct rounding
   - Total always equals original amount

2. **Unequal Split**
   - Manual amounts add up correctly
   - Balance reflects exact amounts

3. **Percentage Split**
   - Percentages add to 100%
   - Amounts calculated correctly
   - Edge case: 33.33% x 3 = 99.99% (handle rounding)

4. **Balance Calculation**
   - After expense, correct balances appear
   - Bidirectional debt collapses to net

5. **Settlement Logic**
   - Payment reduces balance correctly
   - Multiple settlements update correctly

### Backend Tests (Django)
```python
# Use pytest + pytest-django
tests/
  test_models.py          (User, Group, Expense models)
  test_debt_calculation.py (CRITICAL - all split logic)
  test_api_endpoints.py   (API endpoints)
  test_balance.py         (Balance calculation)
```

### Frontend Tests (React)
```
tests/
  components/
    LoginForm.test.js
    ExpenseForm.test.js
    BalanceBoard.test.js
  utils/
    calculations.test.js (any client-side calculations)
```

### Manual Testing (Critical Path)
1. Create account + login
2. Create group + add members
3. Add expense with each split type
4. Verify balance board shows correct amounts
5. Record settlement + verify balance updates
6. Test with edge cases (rounding, large numbers)

### Testing Priority (Given Time Constraint)
1. **MUST**: Debt calculation (manual + unit tests)
2. **Should**: API endpoints (manual testing via Postman)
3. **Nice**: Frontend components (visual testing)

---

## 11. KNOWN LIMITATIONS & TRADE-OFFS ✅

### Trade-offs Made (Intentional Simplifications)
- **No Real-Time Updates**: Comments fetched on page load, not live WebSocket updates (saves 5+ hours)
- **No Photo Upload**: Expense categories are simple strings, no image storage (saves AWS S3 complexity)
- **No Recurring Expenses**: All expenses are one-time entries (avoids cron jobs & complexity)
- **No Email Notifications**: In-app only; no SendGrid/SMTP setup (saves 3+ hours)
- **No Mobile App**: Responsive web design only (Tailwind CSS handles mobile)
- **No Friend Requests**: Instant add via email search; no approval workflow (much faster)
- **No User Avatars**: Just name + email
- **No Expense Categories Validation**: Simple string field, not dropdown/relational
- **No Payment Methods**: All settlements recorded manually (not auto-charged)
- **No Currency Conversion**: Single currency assumption (₹)

### Known Limitations
1. **Concurrent Edits**: If two users add expenses simultaneously, balance recalc might be slightly out of sync (acceptable for MVP)
2. **Partial Payments**: No "split settlement" (one user pays 50%, settles later) — all-or-nothing
3. **Expense Edit/Delete**: Modifying expense requires manual balance recalculation (implemented but could be faster)
4. **Notifications**: Simple array; no persistent queue or retry logic
5. **Scalability**: Not optimized for 10k+ users per group (acceptable for MVP)
6. **Offline Support**: No offline-first sync; always requires internet
7. **Rate Limiting**: No API rate limiting (should add before production)
8. **Audit Trail**: Settlements recorded but not detailed payment history per settlement
9. **Group Archive**: Cannot delete groups with expenses; must keep them active

### What Works Well ✅
- Debt calculation is accurate and handles all edge cases
- Simple, fast auth (JWT)
- Clean API design
- Responsive UI
- Quick deployment on AWS
- Easy to extend later

---

## 12. PROMPTS & AI RESPONSES

### Initial Prompt (from Assignment PDF)
```
"You are a junior engineer helping me complete an internship assignment.
The assignment is to reverse engineer Splitwise, scope a realistic 3-day version, 
and build a working deployed app.
...
[Full prompt from assignment]
```

### Discovery Q&A (Round 1) ✅
- **Q1-Q11**: User provided detailed answers
  - Product understanding (learned from research, not a power user)
  - Core workflow locked: Login → Group → Add Friends → Expense → Balance → Settlement
  - Features decided: Equal/Unequal/Percentage splits, Pairwise balance calculation, Instant settlement
  - Scope refined: No WebSockets, no S3 photos, no recurring expenses
  - Real-time chat as simple discussion thread (comments array)

### Discovery Q&A (Round 2) ✅
- **Q12**: Authentication → JWT
- **Q13**: Database → PostgreSQL
- **Q14**: Deployment → AWS EC2 + RDS + S3 + CloudFront
- **Q15**: Frontend state → Context API + useReducer
- **Q16**: API design → RESTful (standard pattern)
- **Q17**: Debt storage → Cached Balance table (eager calculation)
- **Q18**: Settlement logic → Reduces balance directly
- **Q19**: Rounding → Decimal with 2 places
- **Q20**: Friend search → Username search (not email)

### Scope Refinements
- Moved "Direct Add Friends" to MUST HAVE with username search
- Moved "In-App Notifications" to NICE TO HAVE
- Confirmed completely skippable: Photos, Recurring, Email, Mobile

---

## 13. CHANGES MADE DURING IMPLEMENTATION

### Backend (Phase 1 & 2) — COMPLETE ✅
**Environment discovered on dev machine:**
- Python **3.14.0** (very new) → required psycopg **3** (not psycopg2) for a compatible wheel
- Node v25, PostgreSQL **18.4** installed locally
- Final versions: Django **5.2.15**, DRF 3.17.1, simplejwt 5.5.1

**Decisions/deviations from the original plan:**
1. **psycopg3** (`psycopg[binary]`) instead of psycopg2 — only one with a Python 3.14 wheel.
2. **Custom User model** (`api.User`) extends Django's `AbstractUser`, adds `name`, makes `email` unique. Login is by **username** (matches Q20).
3. **Balance table** uses a canonical `(user_low, user_high)` pair with a signed `net_amount` (positive ⇒ low owes high) to avoid duplicate A↔B rows. The API converts this to a friendly directional list.
4. **Debt engine works in integer paise** to guarantee splits sum exactly (no float drift). Equal-split remainder goes to the payer first (Q6).
5. **ExpenseSplit includes the payer's own share** (so totals reconcile), but the payer's share is excluded from debt calc.
6. **Balance recompute strategy**: full recompute of a group's pairwise balances on every expense/settlement change (delete + rebuild). Chosen for correctness over micro-optimization.
7. **Logout** implemented via simplejwt **token blacklist** (added `token_blacklist` app).
8. **Config via .env** (python-decouple + dj-database-url). DB password URL-encoded (`@` → `%40`).
9. Frontend dev origin set to Vite default **:5173** in CORS.

**Verification:**
- 11 unit tests pass (split math + balance/settlement engine).
- Live API smoke test (signup → group → members → expense → balances → settlement) returns correct numbers.

**Backend files:**
- `splitwise/settings.py`, `splitwise/urls.py`
- `api/models.py` (9 tables), `api/services.py` (debt engine), `api/serializers.py`, `api/views.py` (22 endpoints), `api/urls.py`, `api/admin.py`, `api/tests.py`
- `requirements.txt`, `.env.example`, `.env` (gitignored)

### Frontend (Phase 3 & 4) — COMPLETE ✅
**Stack:** React 19 + Vite 8 + Tailwind CSS v4 (`@tailwindcss/vite` plugin) + axios + react-router-dom 7.

**Architecture:**
- `src/api/client.js` — axios instance; request interceptor attaches JWT; response interceptor auto-refreshes on 401 (de-duplicated), else logs out.
- `src/api/endpoints.js` — every backend call in one module.
- `src/context/AuthContext.jsx` — Context API auth (user + tokens persisted in localStorage).
- `src/App.jsx` — routes + `ProtectedRoute` guard.
- Pages: `Login`, `Signup`, `Dashboard` (groups), `GroupDetail` (Expenses/Balances/Members tabs).
- Components: `Navbar` (notifications dropdown w/ 15s polling), `Modal`, `AddExpenseModal` (equal/unequal/percentage with live validation + rounding preview), `SettleModal`, `ExpenseDetailModal` (splits + comments thread + delete).
- `src/utils/format.js` — INR formatting, date formatting, axios-error extraction.

**Brand:** "SplitEasy", emerald/slate Tailwind theme, responsive (mobile-first).

**Verification (in real browser via preview):**
- Login → Dashboard → Group detail → Balances all render with live data.
- Created an equal-split ₹100 expense through the UI; balances updated to bob ₹33.33 / charlie ₹133.33 (correct rounding + accumulation).
- Notification badge reflects in-app notifications.
- `npm run build` succeeds (89 modules, ~96 KB gzipped).

### Remaining
- Documentation: README.md (done), finalize key prompts file.
- Git repository + push to GitHub.
- Deployment to AWS (EC2 + RDS + S3/CloudFront) — needs user's AWS account.

---

## 14. NEXT STEPS

⏭️ **Immediate** (Next 2 hours):
1. ✅ Finalize all technical decisions (DONE)
2. ✅ Design complete data model (DONE)
3. ✅ Design complete API endpoints (DONE)
4. ⏳ Clarify friend add flow (Q20 pending)
5. 🚀 Create BUILD_PLAN.md with concrete timeline
6. 🚀 Initialize Git repo

⏭️ **Phase 1: Backend Setup** (Hours 3-6)
1. Create Django project + app structure
2. Create models (User, Group, GroupMember, Expense, ExpenseSplit, etc.)
3. Run migrations
4. Create DRF serializers
5. Implement debt calculation logic (CRITICAL)

⏭️ **Phase 2: Backend API** (Hours 6-12)
1. Authentication endpoints (signup, login)
2. Group CRUD endpoints
3. Expense CRUD endpoints
4. Balance calculation endpoints
5. Settlement endpoints
6. Comment endpoints
7. Test with Postman

⏭️ **Phase 3: Frontend** (Hours 12-20)
1. React project setup (Vite or CRA)
2. Tailwind CSS setup
3. Auth flow (login, signup, JWT storage)
4. Dashboard page
5. Group details + balance board
6. Add expense form
7. Settlement flow
8. Comments

⏭️ **Phase 4: Deployment** (Hours 20-22)
1. Create AWS account + configure IAM
2. Set up RDS PostgreSQL
3. Set up EC2 instance
4. Deploy backend to EC2
5. Deploy frontend to S3 + CloudFront
6. Configure domain (Route 53)
7. Test live app

⏭️ **Phase 5: Polish & Testing** (Hours 22-24)
1. Manual testing of all workflows
2. Test debt calculation edge cases
3. Bug fixes
4. Final documentation (README.md, BUILD_PLAN.md)
5. Push to GitHub
6. Submit

---

**Status**: 🟢 CONTEXT LOCKED & READY FOR DEVELOPMENT
**Waiting On**: Q20 (Friend add flow clarification)
