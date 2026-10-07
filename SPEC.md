# Budget App (name TBD): Build Spec

Version 1.0, 2026-10-07. Source of truth for v1. `CLAUDE.md` holds the coding rules; this file holds what to build.

---

## 1. Product summary

A web app (installable on phones) for people with one income or many. A user can have only Job A, or Job A, Job B, Job C and more, each on its own pay schedule. Every month the app answers three questions:

1. What did I plan to earn and spend?
2. What actually happened?
3. What will my bank balance be over the next 6 months?

It also checks itself against the user's real bank statement balance so the numbers stay trustworthy.

v1 is single-user per account. No shared budgets, no bank sync, no business ledgers, no investments.

---

## 2. Features (v1)

| # | Feature | Summary |
|---|---|---|
| F1 | Sign up and log in | Email magic link and Google. No passwords. |
| F2 | Quick setup | 3-step onboarding: accounts, income sources, categories. |
| F3 | Accounts | Chequing, savings, credit card, cash. Opening balance and date. |
| F4 | Income sources | One or many (Job A, Job B, ...). Each has its own pay schedule and expected amount. Expected pay shows before it lands. |
| F5 | Categories | Four buckets: Income, Bills, Expenses, Savings and Debt. Starter set, fully editable. |
| F6 | Add a transaction | Under 5 seconds on a phone: amount, category, account, date, note. |
| F7 | Transaction list | Search, filter by month, category, account. Edit and delete. |
| F8 | Transfers | Moves between own accounts and credit card payments are not spending. |
| F9 | Bank CSV import | Column mapping saved per bank, duplicate skipping, rule-based categorization, review before saving. |
| F10 | Monthly budget | Planned amount per category, actuals computed from transactions, copy last month. |
| F11 | Dashboard | Summary cards, plan vs actual, spending breakdown, budget health, upcoming bills and paydays. |
| F12 | Balance forecast | End-of-month balance for the current month and next 5. |
| F13 | Match my bank (reconcile) | Enter a statement balance; see the gap and the transactions that may explain it. |
| F14 | Export | CSV of transactions; CSV of a month's budget; full JSON export of all data. |
| F15 | Works on phone | PWA, installable, responsive down to 360 px wide. |

## 3. Requirements (v1)

| # | Requirement | How it is met |
|---|---|---|
| R1 | Users only ever see their own data, enforced by the database | RLS on every table (`user_id = auth.uid()`), RLS tests per table |
| R2 | Data stored in Canada | Supabase project in `ca-central-1`; Vercel functions region `yul1` |
| R3 | Never ask for or store bank login credentials | CSV import only |
| R4 | Delete account removes everything; full export available first | Settings: JSON export + delete flow using the admin client |
| R5 | Plain-language privacy policy and terms | `/privacy` and `/terms` pages, linked in footer and sign-up |
| R6 | Amounts exact to the cent, in CAD | Integer cents end to end |
| R7 | Phone and laptop, English and French | Responsive layouts, next-intl with `en` and `fr` |
| R8 | Daily backups with restore | Supabase PITR enabled on production |
| R9 | Pages load in under 2 s on a phone | Server components, no client data waterfalls, Lighthouse mobile performance ≥ 85 |
| R10 | Errors reported without exposing transactions | Sentry with `beforeSend` scrubber |

---

## 4. Stack and project layout

See `CLAUDE.md` for the stack. Folder layout:

```
src/
  app/
    (marketing)/page.tsx            landing
    (marketing)/privacy/page.tsx
    (marketing)/terms/page.tsx
    login/page.tsx
    auth/callback/route.ts
    onboarding/page.tsx
    (app)/layout.tsx                authed shell: nav, month context
    (app)/dashboard/page.tsx
    (app)/transactions/page.tsx
    (app)/budget/[month]/page.tsx   month = YYYY-MM
    (app)/forecast/page.tsx
    (app)/accounts/page.tsx
    (app)/accounts/[id]/page.tsx    detail + reconcile
    (app)/income/page.tsx
    (app)/bills/page.tsx
    (app)/categories/page.tsx
    (app)/import/page.tsx
    (app)/settings/page.tsx         profile, language, timezone, rules, export, delete
    api/export/route.ts             CSV and JSON downloads
    manifest.ts
  components/                       shared UI (MoneyInput, MonthSwitcher, CategoryPicker, ...)
  config/app.ts                     APP_NAME, DEFAULT_CURRENCY, DEFAULT_TIMEZONE
  db/schema.ts                      Drizzle schema
  db/client.ts
  lib/
    money.ts                        parseMoney, formatMoney
    dates.ts                        month helpers, business day helpers
    finance/
      schedule.ts                   generatePayDates, generateBillDates
      actuals.ts                    computeMonthActuals
      forecast.ts                   computeForecast
      reconcile.ts                  computeBalance, computeReconciliation
      matching.ts                   matchExpectedToTransactions
      categorize.ts                 applyRules
      csv.ts                        parseBankCsv, buildImportHash
    validation/                     Zod schemas
    types.ts
    sentry.ts
  server/
    actions/                        one file per domain
    queries/                        read helpers used by server components
    auth.ts                         getUserOrThrow
    admin.ts                        service role client (delete account only)
messages/en.json
messages/fr.json
supabase/migrations/                generated SQL + RLS policies
tests/
  unit/                             Vitest, mirrors src/lib
  rls/                              Vitest against local Supabase
  e2e/                              Playwright
```

---

## 5. Data model

All tables: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger), RLS enabled, four policies (`select`, `insert`, `update`, `delete`) with `user_id = auth.uid()`; insert and update also use `with check (user_id = auth.uid())`. Every foreign key to another user-owned table must belong to the same user; enforce with a composite foreign key `(user_id, <fk>)` referencing a unique `(user_id, id)` on the target.

### Enums
- `account_type`: `chequing`, `savings`, `credit_card`, `cash`
- `bucket`: `income`, `bill`, `expense`, `savings_debt`
- `income_cadence`: `weekly`, `biweekly`, `semimonthly`, `monthly`, `irregular`
- `bill_cadence`: `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`
- `rule_match`: `contains`, `starts_with`, `equals`, `regex`
- `amount_mode`: `single`, `split`

### Tables

**profiles** (primary key is `user_id`, no separate `id`)
| Column | Type | Notes |
|---|---|---|
| user_id | uuid pk | references auth.users |
| display_name | text | |
| timezone | text not null default 'America/Toronto' | IANA name |
| locale | text not null default 'en' | `en` or `fr` |
| currency | text not null default 'CAD' | v1 only CAD |
| onboarded_at | timestamptz null | null until onboarding finishes |

**accounts**
| Column | Type | Notes |
|---|---|---|
| name | text not null | |
| type | account_type not null | |
| opening_balance_cents | bigint not null default 0 | credit card owed = negative |
| opening_date | date not null | |
| include_in_forecast | boolean not null | default true for chequing, cash, credit_card; false for savings |
| sort_order | int not null default 0 | |
| archived_at | timestamptz null | |

**categories**
| Column | Type | Notes |
|---|---|---|
| name | text not null | |
| bucket | bucket not null | |
| color | text not null | one of a fixed palette of 10 token names |
| sort_order | int not null default 0 | |
| archived_at | timestamptz null | archived categories keep history |
| unique | (user_id, bucket, lower(name)) where archived_at is null | |

**income_sources**
| Column | Type | Notes |
|---|---|---|
| name | text not null | e.g. "Job A" |
| account_id | uuid not null | where pay lands |
| category_id | uuid not null | income bucket; created automatically with the same name |
| cadence | income_cadence not null | |
| anchor_date | date not null | a real past or next payday |
| semimonthly_day_1 | smallint null | 1 to 31, default 15 |
| semimonthly_day_2 | smallint null | 1 to 31, 31 means last day of month |
| expected_amount_cents | bigint not null check (> 0) | per paycheque; for `irregular`, per month |
| active | boolean not null default true | |
| ended_on | date null | no pay dates after this |

**recurring_bills**
| Column | Type | Notes |
|---|---|---|
| name | text not null | |
| account_id | uuid not null | paid from |
| category_id | uuid not null | bucket `bill` or `savings_debt` |
| cadence | bill_cadence not null | |
| anchor_date | date not null | |
| amount_cents | bigint not null check (> 0) | |
| active | boolean not null default true | |
| ended_on | date null | |

**transactions**
| Column | Type | Notes |
|---|---|---|
| account_id | uuid not null | |
| date | date not null | |
| amount_cents | bigint not null check (<> 0) | positive = money in, negative = money out |
| category_id | uuid null | null = uncategorized (or a transfer leg without a category) |
| payee | text not null default '' | max 200 chars |
| note | text not null default '' | max 500 chars |
| transfer_group_id | uuid null | both legs of a transfer share it |
| income_source_id | uuid null | set when matched to an expected paycheque |
| recurring_bill_id | uuid null | set when matched to an expected bill |
| import_batch_id | uuid null | |
| import_hash | text null | |
| reviewed | boolean not null default true | false for imported rows until the user confirms |
| unique | (account_id, import_hash) where import_hash is not null | dedupe |
| index | (user_id, date), (user_id, category_id, date), (account_id, date) | |

**budgets**
| Column | Type | Notes |
|---|---|---|
| month | date not null check (extract(day from month) = 1) | first day of month |
| category_id | uuid not null | |
| planned_cents | bigint not null check (>= 0) | |
| unique | (user_id, month, category_id) | |

**balance_snapshots**
| Column | Type | Notes |
|---|---|---|
| account_id | uuid not null | |
| date | date not null | statement date |
| statement_balance_cents | bigint not null | |
| unique | (account_id, date) | |

**import_profiles**
| Column | Type | Notes |
|---|---|---|
| name | text not null | e.g. "My bank chequing" |
| header_signature | text not null | normalized, joined header row; used to auto-select |
| has_header | boolean not null default true | |
| date_column | int not null | 0-based |
| date_format | text not null | `yyyy-MM-dd`, `MM/dd/yyyy`, `dd/MM/yyyy`, `M/d/yyyy` |
| description_column | int not null | |
| amount_mode | amount_mode not null | `single` = one signed column; `split` = debit and credit columns |
| amount_column | int null | |
| debit_column | int null | |
| credit_column | int null | |
| invert_sign | boolean not null default false | for banks that export debits as positive |

**import_batches**
| Column | Type | Notes |
|---|---|---|
| account_id | uuid not null | |
| file_name | text not null | |
| row_count | int not null | |
| imported_count | int not null | |
| duplicate_count | int not null | |

**categorization_rules**
| Column | Type | Notes |
|---|---|---|
| match_type | rule_match not null | |
| pattern | text not null | max 200 chars; regex validated on save, 50 ms timeout guard |
| category_id | uuid not null | |
| priority | int not null default 100 | lower runs first |

### Starter categories (seeded at onboarding, user can edit)
- **Income:** one category per income source (auto), plus "Other income"
- **Bills:** Rent, Phone, Internet, Utilities, Insurance, Subscriptions
- **Expenses:** Groceries, Dining out, Transport, Shopping, Entertainment, Personal care, Education, Other
- **Savings and Debt:** Emergency fund, Savings, Credit card payment, Loan payment

---

## 6. Domain rules

### Signs and buckets
- `amount_cents` is signed. Spending is negative. Refunds are positive and reduce spending in their category.
- For display, bill, expense and savings_debt actuals are shown as positive "spent" amounts: `spent = -sum(amount_cents)`.
- Income actual = `sum(amount_cents)` of transactions in income categories.

### Transfers (F8)
- A transfer creates two transactions in one database transaction: `-X` on the source account and `+X` on the destination, sharing `transfer_group_id`. Same date.
- Transfer legs are excluded from income and expense totals.
- Exception: if the outgoing leg has a category in `savings_debt` (e.g. Emergency fund, Credit card payment), it counts toward that category's actual. The incoming leg never has a category.
- Editing or deleting one leg edits or deletes both.

### Matching expected items (F4, F11)
- Expected paycheques come from `generatePayDates`. Expected bills come from `generateBillDates`.
- An expected item is **matched** if a transaction exists with the same `income_source_id` (or `recurring_bill_id`) dated within ±4 days.
- When the user saves a transaction in an income category that belongs to an income source, set `income_source_id` automatically. Same for bills: if the category belongs to exactly one active recurring bill and the amount is within 10% of it, set `recurring_bill_id`.
- Imported transactions get the same auto-match during review.
- Unmatched expected items dated today or later are **upcoming**. Unmatched items dated before today in the current month are **late** and shown with a warning badge.

---

## 7. Core logic (`src/lib/finance/`)

All functions are pure. Inputs are plain objects; `today` is passed in as `YYYY-MM-DD`.

### 7.1 `generatePayDates(source, from, to): string[]`
- `weekly`: `anchor_date + 7k` for all integer k, within `[from, to]`.
- `biweekly`: `anchor_date + 14k`.
- `semimonthly`: for every month in range, days `semimonthly_day_1` and `semimonthly_day_2`; a day above the month's length becomes the last day.
- `monthly`: the anchor's day of month each month; clamp to month length.
- `irregular`: one entry per month on the last day of the month, flagged as an estimate.
- For `semimonthly` and `monthly`: if the date is Saturday or Sunday, move to the previous Friday.
- Exclude dates after `ended_on` and all dates if `active` is false.

### 7.2 `generateBillDates(bill, from, to): string[]`
- `weekly` +7k, `biweekly` +14k, `monthly` anchor day clamped, `quarterly` every 3 months, `yearly` every 12 months. No weekend shifting.

### 7.3 `computeMonthActuals({ month, categories, transactions })`
Returns per category `{ categoryId, bucket, actualCents }` and per bucket totals:
```
incomeActual       = sum(amount) of txns in income categories, excluding transfer legs
billsActual        = -sum(amount) of txns in bill categories, excluding transfer legs
expensesActual     = -sum(amount) of txns in expense categories, excluding transfer legs
savingsDebtActual  = -sum(amount) of txns in savings_debt categories (outgoing transfer legs included)
remaining          = incomeActual - billsActual - expensesActual - savingsDebtActual
```
Uncategorized non-transfer transactions are returned separately as `uncategorizedCents` and a count, and shown as a warning on the dashboard.

### 7.4 `computeBalance(account, transactions, asOf): number`
`opening_balance_cents + sum(amount_cents)` for that account's transactions with `opening_date <= date <= asOf`.

### 7.5 `computeForecast({ today, accounts, incomeSources, bills, budgets, transactions, months: 6 })`
Pool = accounts with `include_in_forecast = true` and not archived.

```
start(current month) = sum of computeBalance(account, today) over the pool
for each month m from the current month through 5 months ahead:
  window = m is current ? (today, monthEnd] : [monthStart, monthEnd]
  income   = sum of expected_amount over pay dates in window, plus late unmatched pay dates in the current month
  bills    = sum of amount over bill dates in window, plus late unmatched bill dates in the current month,
             only for bills paid from a pool account
  variable = sum over expense categories of max(planned(m, c) - spentSoFar(m, c), 0)
  savings  = sum over savings_debt categories with no recurring bill of max(planned(m, c) - spentSoFar(m, c), 0)
  end(m)   = start(m) + income - bills - variable - savings
  start(m+1) = end(m)
```
- `planned(m, c)`: the budget row for that month; if none, the most recent earlier budget row for that category; if none, 0.
- `spentSoFar` is only non-zero for the current month.
- Income landing in a non-pool account is ignored.
- Each month returns `{ month, start, income, bills, variable, savings, end, estimated: boolean }`. `estimated` is true if any irregular income contributed.
- A month whose `end` is below 0 is flagged `belowZero`.

### 7.6 `computeReconciliation({ account, transactions, snapshot, lastReconciledSnapshot })`
```
computed = computeBalance(account, transactions, snapshot.date)
gap      = snapshot.statement_balance_cents - computed
```
Returns `{ computed, gap, suspects }`. `suspects` (only when gap ≠ 0):
1. Transactions on that account with `reviewed = false`, dated up to `snapshot.date`.
2. Possible duplicates: pairs with the same amount, dates within 1 day, and payees equal after normalizing (lowercase, digits and punctuation stripped).
3. Any single transaction whose amount equals `gap` or `-gap`.
4. Transactions dated after the last zero-gap snapshot.

### 7.7 `applyRules(description, rules): categoryId | null`
Rules sorted by `priority` then `created_at`. First match wins. Matching is case-insensitive on a trimmed description.

### 7.8 `parseBankCsv(text, profile)` and `buildImportHash(...)`
- Parse with Papa Parse, `skipEmptyLines: true`.
- Money parsing (`parseMoney`): strip `$`, spaces and thousands separators; `(12.34)` and trailing `-` or `DR` mean negative; `CR` means positive; supports `,` as decimal separator when the value has exactly 2 digits after a comma and no dot.
- `split` mode: `amount = credit - debit`.
- Apply `invert_sign` last.
- `import_hash = sha256(account_id | date | amount_cents | normalizedDescription | n)`, where `n` is the occurrence index of identical `(date, amount, description)` rows within the same file. This keeps two real identical purchases on the same day while still deduping re-imports.
- Limits: 5 MB, 5,000 rows. Reject rows with unparseable dates or amounts and report them by line number.

### 7.9 Required unit tests (minimum)
- Pay dates: biweekly across a year boundary; semimonthly 15 and 31 in February (28 and 29 days); monthly on the 31st; weekend shift to Friday; `ended_on` respected; inactive source yields nothing.
- Bills: quarterly from Nov 30 clamps to Feb 28 or 29.
- Actuals: refunds reduce spend; transfers excluded; savings transfer leg counted once; uncategorized reported.
- Forecast: one income source; three income sources on different cadences; income into a non-pool account ignored; late paycheque included; no budget rows falls back to the previous month; `belowZero` flag.
- Reconcile: exact match gives gap 0; duplicate detection; single-transaction gap suspect.
- CSV: debit/credit split; parentheses negatives; `CR`/`DR`; identical rows in one file both import; re-import of the same file imports 0.
- Money: `parseMoney` and `formatMoney` in `en-CA` and `fr-CA` (`1 234,56 $`).

---

## 8. Screens

Shared shell: top bar with logo placeholder (`APP_NAME`), month switcher where relevant, and a floating **+** button on mobile that opens Quick Add from any screen. Desktop: left sidebar nav. Mobile: bottom nav with Dashboard, Transactions, Budget, Forecast, More.

### Login (`/login`)
Email field with "Send me a link" and a "Continue with Google" button. Links to privacy and terms.

### Onboarding (`/onboarding`)
Shown until `profiles.onboarded_at` is set. Three steps with a progress indicator, each skippable except step 1.
1. **Accounts:** add at least one. Name, type, current balance, as-of date (default today).
2. **Income:** add zero or more sources. Name defaults to "Job A", then "Job B", and so on. Account, cadence, a recent or next payday, amount per paycheque. "Add another income" button.
3. **Categories:** starter set shown grouped by bucket with checkboxes; user unticks what they don't need. Finish seeds categories, creates income categories, sets the current month's budget to 0 for each, and sets `onboarded_at`.

### Dashboard (`/dashboard`)
For the selected month:
- **Summary cards (5):** Income, Bills, Expenses, Savings and Debt, Remaining. Each shows actual with "of {planned}" below.
- **Plan vs Actual:** grouped bars for the four buckets.
- **Where the money went:** donut of expense and bill actuals by category, top 6 + "Other".
- **Budget health:** progress ring of total spent vs total planned outflow; centre shows remaining.
- **Upcoming (next 14 days):** expected paycheques and bills, with matched/late badges.
- **Forecast strip:** the next 3 months' end balances from `computeForecast`, linking to `/forecast`.
- **Warnings:** uncategorized count, unreviewed imports count, a late paycheque, or a forecast month below zero.

### Transactions (`/transactions`)
- Filters: month, account, category, bucket, text search on payee and note, "unreviewed only".
- List grouped by date, with running daily totals. Infinite scroll, page size 50, server-side.
- Row tap opens an edit sheet. Bulk select to change category, mark reviewed, or delete.

### Quick Add (sheet)
- Fields in order: amount (numeric keypad, sign toggle defaulting to spend), category (recent first), account (remembers last used), date (default today), payee, note.
- Type switch at top: Spend, Income, Transfer. Transfer shows From and To accounts and an optional savings_debt category.
- Save with Enter. Target: 3 taps plus amount for a repeat purchase.

### Budget (`/budget/[month]`)
- Four sections (Income, Bills, Expenses, Savings and Debt). Columns: Category, Planned (inline editable `MoneyInput`), Actual, Difference (coloured: over plan in critical colour for outflows, under plan for income).
- Section totals and grand totals with Remaining.
- "Copy plan from previous month" button: copies planned amounts from the month before this one (not the latest month). Confirms before overwriting non-zero values.
- Income section pre-fills planned from expected pay dates for that month (user can override).
- Bills section pre-fills from recurring bills for that month.

### Forecast (`/forecast`)
- Line chart of end-of-month balance for 6 months, with a zero line.
- Table below: Month, Start, Income, Bills, Planned spending, Savings, End. Estimated months marked.
- Breakdown drawer per month: each expected paycheque and bill by date.
- Explainer text: which accounts are in the pool, with a link to change it.

### Accounts (`/accounts`, `/accounts/[id]`)
- List with computed current balance and last reconciled date.
- Detail: balance history line (end of each month), transactions for that account, and the **Reconcile** panel:
  - Inputs: statement date, statement balance.
  - Result: computed balance, gap. Gap 0 shows a success state and saves the snapshot. Gap not 0 shows the suspects list with actions (edit, delete, mark reviewed, mark not a duplicate).

### Income (`/income`)
List of income sources (Job A, Job B, ...) with cadence, amount, next pay date, and this month's received vs expected. Add, edit, end (sets `ended_on`), reactivate.

### Bills (`/bills`)
List of recurring bills with cadence, amount, next due date, paid-this-period badge. Add, edit, end.

### Categories (`/categories`)
Grouped by bucket. Rename, recolour, reorder (drag), archive. Archiving a category with transactions keeps them; the category is hidden from pickers.

### Import (`/import`)
1. **Upload:** choose account, drop CSV.
2. **Map:** if the header signature matches a saved profile, preselect it. Otherwise pick columns, date format, amount mode, invert sign. Live preview of the first 10 parsed rows. "Save as profile".
3. **Review:** all rows with parsed date, description, amount, suggested category (from rules), duplicate flag (already in DB), and auto-match to income or bill. User can change categories inline and "create rule from this" on any row. Duplicates unchecked by default.
4. **Commit:** inserts selected rows with `reviewed = false` unless the user ticked "mark all reviewed", writes `import_batches`, shows a summary. "Undo this import" deletes the batch's transactions for 24 hours.

### Settings (`/settings`)
- Profile: display name, language (EN/FR), timezone.
- Forecast pool: toggle `include_in_forecast` per account.
- Categorization rules: list, add, edit, reorder, test against a sample description.
- Export: transactions CSV (date range), budget CSV (month), full JSON.
- Delete account: type the word DELETE (localized) to confirm; deletes all rows and the auth user, signs out.

---

## 9. Server actions (`src/server/actions/`)

Each returns `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`. Each calls `revalidatePath` for affected routes.

- `accounts.ts`: `createAccount`, `updateAccount`, `archiveAccount`
- `categories.ts`: `createCategory`, `updateCategory`, `reorderCategories`, `archiveCategory`
- `income.ts`: `createIncomeSource` (also creates its income category), `updateIncomeSource`, `endIncomeSource`
- `bills.ts`: `createBill`, `updateBill`, `endBill`
- `transactions.ts`: `createTransaction`, `createTransfer`, `updateTransaction`, `deleteTransaction`, `bulkUpdateTransactions`, `bulkDeleteTransactions`, `markReviewed`
- `budget.ts`: `setPlanned`, `copyPlanFromPreviousMonth`
- `reconcile.ts`: `saveSnapshot`
- `import.ts`: `previewImport` (parse and return rows, no writes), `commitImport`, `undoImport`, `saveImportProfile`
- `rules.ts`: `createRule`, `updateRule`, `deleteRule`, `reorderRules`
- `onboarding.ts`: `completeOnboarding`
- `settings.ts`: `updateProfile`, `deleteAccount`

---

## 10. Security checklist

- [ ] RLS enabled and tested on every table (test: user B cannot select, insert, update or delete user A's rows, including via a forged `user_id` or foreign key)
- [ ] Composite foreign keys prevent linking to another user's account or category
- [ ] Service role key only in `src/server/admin.ts`
- [ ] Zod on every action; string length limits as in section 5
- [ ] CSV parsed server side, size and row limits, file not stored
- [ ] Regex rules validated and run with a timeout guard
- [ ] Rate limiting: magic link requests 5 per hour per email; imports 20 per hour per user (Upstash or a Postgres counter)
- [ ] Security headers in `next.config`: CSP (self, Supabase URL, Sentry), HSTS, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Sentry `beforeSend` drops request bodies and scrubs payee, note, amount fields
- [ ] Separate Supabase projects for staging and production; migrations applied by CI
- [ ] PITR on production
- [ ] `/privacy` and `/terms` written in plain language (EN and FR), covering what is stored, where (Canada), retention, export and deletion

---

## 11. Non-functional

- **Performance:** dashboard data in a single server query helper; no client fetching on first load. Lighthouse mobile performance ≥ 85, accessibility ≥ 95.
- **Accessibility:** all inputs labelled, charts have a text summary or table alternative, colour is never the only signal (over/under also shown with + and − and icons), focus visible, keyboard usable.
- **i18n:** `en` and `fr`. Money with `Intl.NumberFormat(locale-CA, { style: 'currency', currency: 'CAD' })`. Dates with date-fns locales.
- **PWA:** `manifest.ts` with name from `APP_NAME`, icons (placeholder), `display: standalone`, theme colour. Service worker (Serwist) caches the app shell only; no offline writes in v1.
- **Theme:** light and dark via CSS variables; respects system setting.

---

## 12. Build phases

Each phase is one Claude Code session. Start in plan mode, approve the plan, then build. Do not start the next phase until "Done when" is true and CI is green.

### Phase 0: Setup
**Prompt:**
> Read CLAUDE.md and SPEC.md. Set up the project per section 4: Next.js with TypeScript strict, Tailwind, shadcn/ui, Drizzle, Supabase local, next-intl (en, fr, no URL prefix, locale from cookie), Vitest, Playwright, ESLint, Prettier, Sentry with the scrubber from section 10. Add `src/config/app.ts` with `APP_NAME = "Budget App"`. Add the pnpm scripts listed in CLAUDE.md. Add a GitHub Actions workflow that runs typecheck, lint, unit tests, and Playwright against a local Supabase. Create an empty landing page and the authed layout shell with placeholder nav. Plan first.

**Done when:** `pnpm dev` runs, CI is green on an empty app, `supabase start` works.

### Phase 1: Auth and schema
**Prompt:**
> Implement section 5 in `src/db/schema.ts` with Drizzle, generate migrations, and add the RLS policies, composite foreign keys, unique constraints, check constraints and `updated_at` triggers as SQL in the migrations. Implement magic link and Google login (section 8, Login), the auth callback, `getUserOrThrow`, and profile creation on first sign-in. Middleware redirects unauthenticated users to /login and un-onboarded users to /onboarding. Write the RLS tests in tests/rls for every table. Plan first.

**Done when:** RLS tests pass for every table; a user can sign in and lands on /onboarding.

### Phase 2: Money, dates, accounts, categories, onboarding
**Prompt:**
> Implement `src/lib/money.ts` and `src/lib/dates.ts` with the tests in 7.9. Implement the accounts, categories and income actions (section 9) and the Onboarding flow (section 8) including starter categories from section 5 and Job A, Job B default naming. Build the Accounts list page and the Categories page. Plan first.

**Done when:** a new user completes onboarding with two accounts and two income sources and sees them listed.

### Phase 3: Transactions and transfers
**Prompt:**
> Implement transactions and transfers per section 6 and the actions in section 9. Build Quick Add (all three types), the Transactions page with filters, grouping, infinite scroll, edit sheet and bulk actions. Implement auto-setting of income_source_id and recurring_bill_id from section 6. Add Playwright tests: add a spend, add income, add a transfer, edit, delete, bulk recategorize. Plan first.

**Done when:** a week of real spending can be logged on a phone in under 5 seconds per entry.

### Phase 4: Schedules, actuals, budget, dashboard
**Prompt:**
> Implement `schedule.ts`, `matching.ts` and `actuals.ts` from section 7 with all their tests from 7.9 first. Then build Income and Bills pages, the Budget page with copy-from-previous-month and pre-fill, and the Dashboard exactly as in section 8, using Recharts. Plan first.

**Done when:** for a hand-built test month, every dashboard number matches a manual calculation in the Playwright test.

### Phase 5: CSV import and rules
**Prompt:**
> Implement `csv.ts` and `categorize.ts` from section 7 with their tests first. Build the 4-step Import flow, import profiles, the rules section in Settings, "create rule from this", and undo import. Enforce the limits in 7.8 and section 10. Add fixture CSVs in tests/fixtures for a single-amount bank, a debit/credit split bank, and a bank with positive debits. Plan first.

**Done when:** each fixture imports correctly and re-importing it imports 0 rows.

### Phase 6: Forecast and reconcile
**Prompt:**
> Implement `forecast.ts` and `reconcile.ts` from section 7 with their tests first. Build the Forecast page, the forecast strip on the Dashboard, the forecast pool setting, and the Reconcile panel on account detail with suspect actions. Plan first.

**Done when:** a seeded scenario with Job A biweekly, Job B semimonthly and Job C irregular produces the expected 6-month table in a unit test, and reconciliation reaches gap 0 after fixing a seeded duplicate.

### Phase 7: Export, settings, launch hardening
**Prompt:**
> Implement exports (CSV and JSON) and Settings fully, including delete account via the admin client. Write /privacy and /terms in EN and FR. Add the PWA manifest and Serwist app-shell caching. Complete every item in the section 10 checklist and section 11. Add empty states and error pages for every route. Run Lighthouse on mobile and fix anything below the targets. Plan first.

**Done when:** section 10 is fully ticked, Lighthouse targets are met, and a fresh user can go from sign-up to a reconciled month without help.

---

## 13. Definition of done (v1)

- All 15 features and 10 requirements implemented and covered by at least one test.
- Every function in `src/lib/finance/` has unit tests including the cases in 7.9.
- RLS tests pass for every table.
- Playwright covers: sign-up and onboarding, quick add, transfer, budget edit, import, forecast view, reconcile to zero, export, delete account.
- Works in English and French; no hardcoded strings.
- Deployed to production on Vercel with Supabase in `ca-central-1`.
