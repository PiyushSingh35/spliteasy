# KEY_PROMPTS.md

The key prompts used to direct the AI (Claude) during this build. The AI was
instructed to behave like a junior engineer: interview first, never assume
requirements, record everything in `AI_CONTEXT.md`, then implement.

---

## 1. Kickoff / role-setting prompt (from the assignment)

> You are a junior engineer helping me complete an internship assignment. The
> assignment is to reverse engineer Splitwise, scope a realistic version, and
> build a working deployed app.
>
> Do not assume product requirements. Do not jump straight to implementation.
> Ask me detailed questions about product scope, UX, workflows, edge cases, and
> engineering decisions. After each answer, update `AI_CONTEXT.md` as the single
> source of truth. Produce a build plan before writing code. Start by
> interviewing me across: product goals, MVP scope, data model, auth, groups,
> expenses, settlements, balance calculation, UI, architecture, deployment,
> testing, and tradeoffs.

## 2. Materials / context-gathering prompt

> Go through the assignment PDF, the role-clarity doc, and the HR emails.
> Summarize what the assignment requires and the role expectations before we
> proceed.

## 3. Scope-locking answers (Round 1 — product)

Key decisions provided to the AI:
- Core loop: login → create group → add members → add expense → view balances → settle.
- Most critical feature: an accurate debt-splitting / balance engine.
- Splits: equal (with rounding), unequal (exact amounts), percentage. **Skip "shares".**
- Equal-split rounding: payer absorbs the extra paisa; total must be exact.
- Balances: pairwise net (collapse A↔B into one net figure), shown as a detailed breakdown.
- Settlements: single-party, instantly reduce the balance.
- "Chat" = simple comments thread on an expense (no websockets).
- Skip: receipt uploads, recurring expenses, emails, mobile app. In-app notifications are nice-to-have.

## 4. Tech-stack-locking answers (Round 2 — engineering)

- Auth: JWT. Database: PostgreSQL. Deployment target: AWS (EC2 + RDS + S3/CloudFront).
- Frontend state: Context API. Rounding: 2-decimal money.
- Balance storage: cached Balance table, eagerly recomputed.
- Add members by **username** search (not email), no approval pipeline.

## 5. Implementation prompt

> Start coding. Tell me what you are doing and why at each phase so I understand
> the build. Backend first (models → debt engine → API), verify with tests and a
> live smoke test, then build and verify the React frontend.

---

## How `AI_CONTEXT.md` was maintained

After every decision the AI updated `AI_CONTEXT.md`, and after each build phase it
recorded actual versions, deviations (e.g. psycopg3 for Python 3.14), and
verification results. The file is detailed enough to rebuild the app from scratch.
