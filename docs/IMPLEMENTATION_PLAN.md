# Implementation plan

Progress against the eight planned phases. Updated 19 October 2026.

| Phase | State |
|---|---|
| 1. Audit and planning | **Done** |
| 2. Design system and interface | **Done** for the screens that exist |
| 3. Auth and data layer | **Done** |
| 4. Personal finance | **Partly done** — transactions complete; budgets and goals have logic but no screens |
| 5. CSV and portfolio | **Not started** (portfolio engine done, screens and CSV not) |
| 6. Insights and bilingual support | **Partly done** — i18n complete; insights screen not built |
| 7. QA, security, performance | **Partly done** — 143 tests pass; no E2E, no performance measurement |
| 8. Release preparation | **Not started** |

---

## Phase 1 — Audit and planning · Done

- Environment and toolchain audited; five defects in the generated scaffold
  identified and corrected before feature work.
- Port collision with an existing project found and avoided.
- Data model, money representation and calculation rules designed.
- Documents written: `PROJECT_AUDIT.md`, `ARCHITECTURE.md`, `DATABASE.md`,
  `FINANCIAL_CALCULATIONS.md`, `SECURITY.md`, `TESTING.md`, this plan.

## Phase 2 — Design system and interface · Done for existing screens

- Colour and typography tokens as a Tailwind v4 theme, with contrast measured
  rather than assumed.
- Shared primitives: buttons, inputs, form fields, page and section headers,
  metric display, notices, empty and error states, progress meter.
- Desktop rail and mobile bottom bar built as separate layouts from one typed
  navigation list.
- Signed-out shell as an asymmetric two-column composition.
- Income/expense area chart with a validated palette, a legend, gap handling
  for empty months and a data table.

**Remaining:** chart components for category breakdown, budget progress and
portfolio allocation; `error.tsx` and `loading.tsx` route boundaries.

## Phase 3 — Auth and data layer · Done

- Two migrations applied to a live Postgres without error.
- RLS on every user-owned table, with `WITH CHECK` and parent-ownership checks.
- New-user trigger creating a profile and nine starter categories.
- Email/password auth with server-side verification and middleware refresh.
- Typed data access with `::text` casts for every money column.
- Environment validated at startup.

## Phase 4 — Personal finance · Partly done

**Done:** transaction create, edit, delete and list against the database;
server-side validation accepting both Turkish and English number formats;
delete confirmation that names the record and its consequences; Overview
computing balance, income, expenses, net flow, savings rate, a six-month trend
and insights from the user's own rows.

**Remaining:**

- Transaction filtering and sorting UI (the repository already supports date
  range, kind, category, currency, amount range, search and four sort orders).
- Pagination controls.
- Budget screens: create, edit, delete, usage display with limit warnings.
- Goal screens: create, edit, archive, add and withdraw funds, movement
  history.
- Category management.

## Phase 5 — CSV and portfolio · Not started

**Remaining:**

- The import wizard: file selection, header detection, column mapping,
  preview, validation, error report, duplicate review, confirmation, atomic
  insert, result summary. Designed in `CSV_IMPORT.md`; the `import_batches`
  table exists.
- CSV export of the filtered transaction list, with formula-injection
  neutralisation.
- Portfolio screens: asset list and detail, trade entry, manual price updates,
  valuation history, allocation. The calculation engine is complete and tested.

## Phase 6 — Insights and bilingual support · Partly done

**Done:** complete Turkish and English catalogues with compile-time parity;
locale-aware money, date and percentage formatting; language switcher that
preserves the current page; locale persisted in a cookie.

**Remaining:** the Insights screen itself — monthly flow, category changes,
savings trend, budget usage and portfolio allocation, with the methodology
notes the brief asks for.

## Phase 7 — QA, security and performance · Partly done

**Done:** 127 unit tests over the calculation layer; 16 integration tests that
attempt to breach RLS against a live database and fail; typecheck and lint
clean; signed-in rendering verified against hand arithmetic.

**Remaining:**

- Playwright, and the twelve end-to-end scenarios in the brief.
- Component tests for form error states.
- Integration coverage for the budget, asset, trade and import tables.
- Rate limiting beyond Supabase defaults.
- A Lighthouse measurement — no performance claim is made until one exists.
- Accessibility audit with a screen reader.

## Phase 8 — Release preparation · Not started

**Remaining:** production build verification, hosting and environment setup,
migration procedure for a hosted database, screenshots, and a deployed demo.
See `DEPLOYMENT.md` for what is missing and what is needed from the project
owner.

---

## Suggested order from here

1. Transaction filters, sorting and pagination — finishes the screen that is
   already the most used.
2. Budget screens — the calculations are done and tested, so this is UI work
   against a settled interface.
3. Goal screens — same.
4. CSV import — the largest remaining piece of the brief, and the one most
   likely to surface data-quality questions.
5. Portfolio screens.
6. Insights screen.
7. Playwright, then deployment.

Budgets and goals come before CSV because they turn two "logic written, no
screen" modules into finished features, which is a better state for the project
than three half-finished ones.
