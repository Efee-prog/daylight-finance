# Changelog

Notable changes to this project. Entries describe work that is actually done;
planned work lives in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — 2026-10-19

First working build. Not released; no public deployment.

### Added

- **Financial calculation layer.** Exact decimal arithmetic on BigInt, with
  money held as minor units carrying its own currency code. Income, expenses,
  net cash flow, cash balance, savings rate, category breakdown, monthly
  series, budget usage, savings-goal progress, and a weighted-average-cost
  portfolio engine with realised and unrealised profit.
- **Database schema** for profiles, categories, transactions, budgets, savings
  goals and their entries, assets, investment transactions, price history and
  import batches, with triggers enforcing currency consistency between a parent
  and its children.
- **Row Level Security** on every user-owned table, with `WITH CHECK` clauses
  and parent-ownership verification.
- **Authentication**: email and password sign-up, sign-in and sign-out, with
  server-side session verification and middleware token refresh.
- **Transactions**: create, edit and delete against the database, with
  server-side validation and a confirmation dialog that states what will be
  deleted and what will be recalculated.
- **Overview**: cash balance, period income, expenses, net flow and savings
  rate, a six-month income/expense chart, insights and recent activity — every
  figure computed from the user's own records.
- **Settings**: display name, interface language, default currency and
  timezone.
- **Turkish and English** throughout, with locale-aware money, date and
  percentage formatting, and a language switcher that preserves the current
  page.
- **Editorial design system**: cream, sage and olive palette with
  contrast-checked tokens, serif display typography, tabular figures, and
  separate desktop and mobile navigation rather than one shrunken layout.
- **143 tests**: 127 unit tests covering the calculation layer, and 16
  integration tests that attempt to breach Row Level Security against a live
  Postgres and fail as intended.

### Decisions worth recording

- Next.js `cacheComponents` was disabled. Every authenticated route is
  request-bound through session cookies, so it would have added cache or
  Suspense boundaries everywhere without benefit.
- Chart series colours were selected with a palette validator after the obvious
  olive/clay pairing measured ΔE 2.4 under deuteranopia — indistinguishable to
  a red-green colourblind reader.
- Money columns are read from PostgREST with a `::text` cast, because JSON
  number serialisation loses the last digit above 2^53.
- `@types/node` was raised to v24 to match the installed runtime, which also
  resolved the peer conflict that blocked Vitest 5.
- The project runs on its own port block (app 3100, Supabase 553xx) so it
  cannot collide with other projects on the same machine.

### Not yet done

CSV import and export; screens for budgets, goals, portfolio and insights;
Playwright end-to-end tests; deployment.
