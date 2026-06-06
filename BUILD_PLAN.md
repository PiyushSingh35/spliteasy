# BUILD_PLAN.md - Splitwise Clone (24-Hour Sprint)

**Deadline**: 2026-06-07 12:00 PM IST  
**Start Time**: 2026-06-06 (approx 24 hours)  
**Team**: 1 person + Claude (AI junior engineer)

---

## 1. PRODUCT RESEARCH

### How We Studied Splitwise
- User researched core features (not a daily power user)
- Focused on: Groups, Expenses, Balance Tracking, Settlements
- Identified core workflow: Login → Group → Add Friends → Expense → Balance → Settlement

### What We Learned
1. **Core Purpose**: Calculate who owes whom after group expenses
2. **Critical Feature**: Pairwise net balance calculation (collapse bidirectional debts)
3. **Multiple Split Types**: Equal (with rounding), Unequal (manual amounts), Percentage
4. **Instant Workflow**: No approvals, no complex pipelines — speed matters

### Workflows Identified
1. **User Onboarding**: Signup → Login with JWT
2. **Group Setup**: Create group → Add members by username search → View members
3. **Expense Logging**: Add expense → Select split type → Distribute amounts
4. **Balance Tracking**: View detailed "I owe Alice ₹100, Bob owes me ₹50" breakdown
5. **Settlement**: Record payment → Update balance instantly

### Product Assumptions Made
- Single currency (₹)
- All users must pre-exist in system (no invite links for MVP)
- Settlements are manual (not auto-charged)
- No recurring expenses
- No email notifications
- Responsive web-only (no mobile app separate)

---

## 2. ARCHITECTURE

### Tech Stack
| Layer | Choice | Version |
|-------|--------|---------|
| Backend | Django + DRF | 5.x / 3.x |
| Frontend | React + Context API + Tailwind | 18.x / 3.x |
| Database | PostgreSQL | Latest stable |
| Auth | JWT (django-rest-framework-simplejwt) | Latest |
| Deployment | AWS (EC2 + RDS + S3 + CloudFront) | N/A |

### Database Schema (PostgreSQL)
**9 Tables**:
1. `User` (id, username, email, password, name, created_at)
2. `Group` (id, name, created_by, description, created_at)
3. `GroupMember` (id, group_id, user_id, joined_at) — join table
4. `Expense` (id, group_id, payer_id, amount, description, category, split_type, created_at)
5. `ExpenseSplit` (id, expense_id, user_id, amount_owed, split_type)
6. `Balance` (id, group_id, user_id_1, user_id_2, net_amount, last_updated) — **CACHED**
7. `Settlement` (id, group_id, from_user_id, to_user_id, amount, created_at)
8. `ExpenseComment` (id, expense_id, user_id, comment_text, created_at)
9. `Notification` (id, user_id, message, is_read, created_at)

**Key Design Decision**: Balance table is **eagerly calculated** (updated when expense is created) for fast UI reads.

### API Design (RESTful)
**20 Endpoints across**:
- Authentication (signup, login, logout, me)
- Users (profile, search by username)
- Groups (CRUD, members, add/remove members)
- Expenses (CRUD, create with splits)
- Comments (add, get)
- Balances (get group balances)
- Settlements (record, list)
- Notifications (get, mark as read)

### Frontend Structure (React)
**7 Key Pages**:
1. Login/Signup
2. Dashboard (groups list)
3. Group Details (members, expenses)
4. Balance Board (detailed breakdown)
5. Add/Edit Expense (modal)
6. Expense Detail (with comments)
7. Settlement (record payment)

**State Management**: Context API with useReducer
- Global state: currentUser, groups, expenses, balances, notifications

### Deployment Architecture
```
Users → CloudFront (CDN) → S3 (React build)
Users → EC2 (Gunicorn/Django) → RDS PostgreSQL
DNS via Route 53
```

---

## 3. AI COLLABORATION PROCESS

### How We Instructed the AI
1. **Initial Prompt**: Provided the assignment PDF's required prompt template
2. **Discovery Interviews**: Asked 20 targeted questions across product/engineering
3. **Context-First**: Built AI_CONTEXT.md after each decision
4. **No Assumptions**: AI asked clarifying questions before suggesting solutions

### Key Questions the AI Asked
- Q12-Q20: Technical decisions (auth, database, deployment, debt storage, settlement logic, rounding, friend search)

### How We Answered
- User provided detailed, specific answers (not vague)
- Decided on pragmatic trade-offs (speed over perfection)
- Locked decisions into AI_CONTEXT.md immediately

### How the Plan Evolved
1. **Initial Scope**: Full Splitwise clone
2. **Refined Scope**: Removed 7 features (photos, recurring, email, etc.)
3. **Technical Decisions**: Locked JWT, PostgreSQL, EC2 + RDS, Context API
4. **Scope Additions**: Added in-app notifications, username search, simple comments

### AI_CONTEXT.md Maintenance
- Updated after every decision
- Now contains: Full product understanding, data model, API design, deployment plan
- Ready to be passed to another AI or developer for future work

---

## 4. TRADE-OFFS & SIMPLIFICATIONS

### What We Simplified
| Feature | Simplified Version | Time Saved |
|---------|-------------------|------------|
| Real-time updates | Comments fetched on page load (no WebSocket) | 5+ hours |
| Photo upload | No S3; expense categories are strings | 4+ hours |
| Email notifications | In-app only; no SendGrid | 3+ hours |
| Friend requests | Direct add via username; no approval workflow | 2 hours |
| Recurring expenses | Skip entirely; all one-time | 3 hours |
| Scalability | Not optimized for 10k+ users; acceptable for MVP | 2 hours |
| **Total Time Saved** | | **~22 hours** |

### What We Hardcoded
- Single currency (₹)
- No multi-tenancy
- All users visible (no privacy restrictions)
- Manual settlement records (no auto-charging)

### What We Avoided
- Mobile app (responsive web only)
- Cron jobs (recurring expenses)
- Complex file storage (AWS S3)
- Email infrastructure (SendGrid)
- Real-time infrastructure (WebSockets)
- Payment processing (Stripe)

### What We'd Improve with More Time
1. WebSocket real-time updates for comments
2. Expense categories as relational table with icons
3. User avatars (Gravatar or upload)
4. Email notifications
5. Recurring expense templates
6. Smart settlement suggestions (minimize transactions)
7. Transaction history & reports
8. Mobile app
9. Payment integration
10. Advanced search & filters

---

## 5. IMPLEMENTATION TIMELINE (24 HOURS)

### Phase 1: Backend Setup (Hours 0-4)
**Goal**: Database ready, models defined, migrations run

- [ ] Initialize Django project & virtual environment
- [ ] Install dependencies (Django, DRF, psycopg2, simplejwt, cors)
- [ ] Create PostgreSQL database locally
- [ ] Define all 9 models (User, Group, Expense, etc.)
- [ ] Create & run migrations
- [ ] Create Django superuser
- [ ] Test Django shell (create test records)

**Critical**: Models must be correct; changing them later wastes time.

### Phase 2: Backend API - Core (Hours 4-12)
**Goal**: All endpoints functional, tested via Postman

**Priority 1 (Hours 4-6)**:
- [ ] Serializers for all models
- [ ] Authentication endpoints (signup, login, logout)
- [ ] User profile endpoint
- [ ] User search endpoint (by username)
- **Test**: Login flow in Postman

**Priority 2 (Hours 6-9)**:
- [ ] Group CRUD endpoints
- [ ] Group member add/remove endpoints
- [ ] Expense CRUD endpoints with split handling
- [ ] **CRITICAL**: Debt calculation logic (calculate & cache balances)
- **Test**: Create group, add members, add expense, verify balances

**Priority 3 (Hours 9-12)**:
- [ ] Balance endpoints (get balances for user)
- [ ] Settlement endpoints (record payment, reduce balance)
- [ ] Comment endpoints (add, get)
- [ ] Notification endpoints (basic setup)
- **Test**: Full workflow in Postman

### Phase 3: Frontend Setup (Hours 12-16)
**Goal**: React app structure ready, routing working, auth flow functional

- [ ] Create React app (Vite or CRA)
- [ ] Install dependencies (Tailwind, axios, react-router)
- [ ] Set up Context API + useReducer for global state
- [ ] Create folder structure (pages, components, utils, services)
- [ ] Create API service layer (axios wrapper for auth, requests)
- [ ] Set up routing (private routes, public routes)
- [ ] Build Login & Signup pages
- [ ] Implement JWT storage & auto-login
- **Test**: Signup → Login → Redirect to dashboard

### Phase 4: Frontend Features (Hours 16-22)
**Goal**: All core pages working, connected to backend

**Priority 1 (Hours 16-18)**:
- [ ] Dashboard (list groups, create group button)
- [ ] Group details (show members, expenses, balance board link)
- [ ] Add group member modal (username search)
- **Test**: Create group, add members

**Priority 2 (Hours 18-20)**:
- [ ] Add expense modal (all 3 split types)
- [ ] Balance board (detailed breakdown)
- [ ] Settlement modal (record payment)
- **Test**: Add expense, verify balance, settle payment

**Priority 3 (Hours 20-22)**:
- [ ] Expense detail page (show splits, comments)
- [ ] Add comment form
- [ ] Edit/delete expense
- [ ] Polish UI (responsive, clean styling)
- **Test**: Full user workflow

### Phase 5: Deployment (Hours 22-23)
**Goal**: Live app on AWS

- [ ] Create AWS account (if not already)
- [ ] Set up RDS PostgreSQL instance
- [ ] Set up EC2 instance (t2.small, Ubuntu)
- [ ] Deploy backend (Gunicorn, systemd, Nginx)
- [ ] Deploy frontend (S3 + CloudFront)
- [ ] Configure domain & HTTPS
- [ ] Run smoke tests on live app

### Phase 6: Testing & Polish (Hours 23-24)
**Goal**: Quality & documentation

- [ ] Manual testing of all workflows
- [ ] Edge case testing (rounding, large numbers, concurrent actions)
- [ ] Bug fixes
- [ ] Write README.md (setup instructions, AI tool used)
- [ ] Final documentation
- [ ] Push to GitHub
- [ ] **SUBMIT**

---

## 6. CRITICAL PATH ITEMS (DO NOT SKIP)

These items will block everything else if not done correctly:

1. **Debt Calculation Logic** (Hours 4-9)
   - Implement rounding for equal splits
   - Implement balance collapse (bidirectional debt to net)
   - Test thoroughly before moving forward
   - **If this breaks, the entire app is worthless**

2. **Authentication (JWT)** (Hours 4-6)
   - Signup, login, token storage
   - Protected routes on frontend & backend
   - If this breaks, can't test anything else

3. **API Endpoints** (Hours 4-12)
   - Must be fully functional before starting frontend
   - Test all CRUD operations in Postman first
   - **No "we'll fix it later" — test as you go**

4. **Expense Creation with Splits** (Hours 6-9)
   - Equal split rounding
   - Unequal split validation (amounts sum correctly)
   - Percentage split validation (percentages sum to 100)
   - **If this breaks, balance calculation is wrong**

5. **Balance Calculation Trigger** (Hours 9)
   - After each expense, balances must be recalculated
   - Test: Create expense → Check Balance table → Verify amounts
   - **If this doesn't work, nothing works**

---

## 7. TESTING STRATEGY

### Unit Tests (Optional but Recommended)
- Debt calculation logic (rounding, net balance collapse)
- Use pytest + pytest-django
- **Priority**: Only if time permits after core features work

### Manual Testing (REQUIRED)
- **Postman**: Test all API endpoints
- **Browser**: Test full user workflows
- **Edge Cases**:
  - ₹100 ÷ 3 people = ₹33.34, ₹33.33, ₹33.33 (verify rounding)
  - Multiple expenses, multiple settlements
  - Large amounts (₹100,000+)
  - Many people in group (10+ members)

### Test Data
- Create 3-5 test users (alice, bob, charlie, diana, eve)
- Create 2-3 test groups with different member counts
- Add various expense types (equal, unequal, percentage)
- Test settlements

---

## 8. RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Debt calculation bugs | Test thoroughly in Phase 2; create unit tests |
| Database migration issues | Test locally first; keep backup |
| Slow API responses | Cache balances (already planned) |
| Frontend state management chaos | Use Context API + useReducer (simple & reliable) |
| AWS deployment complexity | Use Elastic Beanstalk if EC2 too slow (backup plan) |
| Time running out | Cut in-app notifications & reduce UI polish |
| Git/GitHub confusion | Initialize repo early; commit frequently |

---

## 9. SUCCESS CRITERIA

✅ **At Submission Time, You Must Have**:

1. **Working Live App**
   - Users can signup & login
   - Create groups & add members
   - Add expenses (all 3 split types)
   - View accurate balances
   - Record settlements

2. **Accurate Debt Calculation**
   - All split types work correctly
   - Rounding is precise
   - Balance updates on settlement

3. **GitHub Repo**
   - All code pushed
   - Proper .gitignore
   - Clean commit history

4. **Documentation**
   - README.md (setup + AI tool used)
   - BUILD_PLAN.md (this file) ✅
   - AI_CONTEXT.md (all context) ✅
   - Key prompts documented

5. **AWS Deployment**
   - App is live at a public URL
   - Database is RDS PostgreSQL
   - Frontend is S3 + CloudFront or Vercel

---

## 10. CONTINGENCY PLANS

### If Debt Calculation Takes Too Long
- Implement simple "just track who paid what" without balance collapse
- Less elegant, but functional

### If Backend Takes Too Long
- Use Firebase Realtime Database instead (faster setup)
- Violates "relational DB only" requirement, but better than incomplete

### If Deployment Takes Too Long
- Use Vercel (backend) + Firebase (database)
- Fast deployment, less AWS complexity

### If Time Runs Out
- Submit incomplete but working app
- Document what's missing in README
- Emphasize debt calculation logic (most important)

---

## 11. GIT STRATEGY

```
Initialize repo early (Hour 0)
Commit after each major milestone:
  - Commit 1: Django setup + models
  - Commit 2: API endpoints (backend complete)
  - Commit 3: React setup + auth
  - Commit 4: Core features (expenses, balances)
  - Commit 5: Deployment
  - Final commit: Documentation + cleanup
```

---

## 12. RESOURCES & TOOLS

### Django
- Django Documentation: https://docs.djangoproject.com/
- DRF Docs: https://www.django-rest-framework.org/
- SimpleJWT: https://django-rest-framework-simplejwt.readthedocs.io/

### React
- React Docs: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/docs
- Axios: https://axios-http.com/

### Deployment
- AWS Docs: https://docs.aws.amazon.com/
- PostgreSQL: https://www.postgresql.org/docs/

### Testing
- Postman: https://www.postman.com/

---

## 13. FINAL NOTES

### For the User
- **Speed > Perfection**: Good working app beats perfect incomplete app
- **Test as You Go**: Don't code for 8 hours then discover bugs
- **Ask Clarifications Early**: If unsure about requirements, ask immediately
- **Document Everything**: AI_CONTEXT.md + BUILD_PLAN.md are as important as code

### For the AI (Claude)
- **Stay Focused**: Follow this plan; don't scope-creep
- **Ask Before Suggesting**: Let user make technical decisions
- **Update AI_CONTEXT.md**: After each code section, document changes
- **Test Frequently**: Manual testing at each phase
- **Keep It Simple**: Leverage existing libraries; don't reinvent wheels

---

**Status**: 🟢 PLAN LOCKED & READY TO BUILD

**Next**: User reviews & approves this plan, then we start Phase 1.
