# Budget App (name TBD)

Personal budgeting web app. Tracks one or many income sources (Job A, Job B, ...), monthly plan vs actual spending, a 6-month bank balance forecast, and reconciliation against bank statements. Full spec: `SPEC.md`. Read it before starting any phase.

The product name is not decided. Use `APP_NAME` from `src/config/app.ts` everywhere a name is shown. Never hardcode a name.

## Stack
- Next.js (App Router, latest stable), React, TypeScript `strict`
- Tailwind CSS, shadcn/ui, lucide-react icons, Recharts
- Supabase: Postgres, Auth, Row Level Security. Region: Canada (`ca-central-1`)
- Drizzle ORM + drizzle-kit for schema and migrations
- Zod for all input validation
- date-fns + @date-fns/tz for dates
- Papa Parse for CSV
- next-intl for English and French
- Vitest for unit tests, Playwright for end-to-end tests
- Sentry for errors
- pnpm, deployed on Vercel

## Non-negotiable rules
1. Money is integer cents everywhere. `bigint` in Postgres, `number` in TypeScript (safe up to 2^53). Never use floats for money. Convert to dollars only when rendering, through `formatMoney()` in `src/lib/money.ts`.
2. Dates without time use Postgres `date` and ISO strings `YYYY-MM-DD` in TypeScript. Month boundaries are computed in the user's timezone from `profiles.timezone`.
3. Every table has `user_id uuid not null references auth.users` and RLS enabled with a policy `user_id = auth.uid()` for select, insert, update and delete. Every new table ships with an RLS test in `tests/rls/`.
4. All writes go through server actions in `src/server/actions/`. Each action: validates input with a Zod schema from `src/lib/validation/`, gets the user with `getUserOrThrow()`, and never trusts a `user_id` from the client.
5. Finance math lives in `src/lib/finance/` as pure functions. No database, no network, no `Date.now()` inside them; pass `today` in. Every function has Vitest tests.
6. `SUPABASE_SERVICE_ROLE_KEY` is only read in `src/server/admin.ts`, used only for account deletion. Never in a `NEXT_PUBLIC_` variable, never imported by a client component.
7. Never use `dangerouslySetInnerHTML`.
8. Every user-facing string goes through next-intl (`messages/en.json`, `messages/fr.json`). No hardcoded UI text.
9. Sentry must not receive payees, notes, amounts or CSV contents. Use the `beforeSend` scrubber in `src/lib/sentry.ts`.

## Code style
- No code comments. Names carry the meaning.
- No em dashes in UI copy or messages files.
- Small, targeted changes. Do not refactor code outside the task.
- Server components by default; `"use client"` only for interactive pieces.
- Colocate a page's components in `src/app/(app)/<route>/_components/`.
- Shared UI in `src/components/`. Domain types in `src/lib/types.ts`.

## Commands
- `pnpm dev`
- `pnpm lint` / `pnpm typecheck`
- `pnpm test` (Vitest) / `pnpm test:e2e` (Playwright)
- `pnpm db:generate` (drizzle-kit generate) / `pnpm db:migrate`
- `supabase start` / `supabase stop` / `supabase db reset`

## Workflow
- Start every phase in plan mode. Present the plan, wait for approval, then build.
- Write tests for `src/lib/finance/` before the UI that uses it.
- Run `pnpm typecheck && pnpm lint && pnpm test` before declaring a step done.
- Commit after each green step with a clear message.
- If a decision in `SPEC.md` changes, update `SPEC.md` and this file in the same commit.
