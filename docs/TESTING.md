# Testing

## Tools

| Layer | Tool | Location |
|---|---|---|
| Unit | Vitest | `tests/unit/` |
| Integration (live Postgres) | Vitest + supabase-js | `tests/integration/` |
| End-to-end (browser) | Playwright — **not set up** | `tests/e2e/` |

## Commands

```bash
npm test              # everything
npm run test:watch    # watch mode
npm run test:coverage # with a coverage report
```

Integration tests need the local stack (`npm run db:start`). When it is not
running they **skip themselves** rather than fail, so `npm test` stays useful
without Docker — and the skip is visible in the output, because a security test
that quietly does not run is indistinguishable from one that passes.

## Current results

Last run: **143 passed, 0 failed, 9 files.**

| File | Tests | Covers |
|---|---|---|
| `unit/fixed.test.ts` | 17 | Decimal parsing, exact arithmetic, rounding modes, Turkish and English number formats |
| `unit/money.test.ts` | 13 | Minor units, currency exponents, mismatch rejection, conversion, large magnitudes |
| `unit/cashflow.test.ts` | 22 | Income, expenses, net, balance, savings rate, transfers, category shares, monthly series |
| `unit/budgets.test.ts` | 12 | What a budget counts, threshold boundaries, zero and negative limits, leap years |
| `unit/portfolio.test.ts` | 21 | Average cost, partial and full exits, overselling, valuation statuses, allocation, mixed currencies |
| `unit/goals.test.ts` | 11 | Progress, withdrawals, over-funding, currency mismatch, non-positive targets |
| `unit/dates.test.ts` | 15 | Calendar validation, month boundaries, period arithmetic, timezone-correct "today" |
| `unit/i18n.test.ts` | 26 | Catalogue parity, placeholder parity, locale resolution, money/date/percent formatting |
| `integration/isolation.test.ts` | 16 | RLS isolation, signup triggers, monetary precision across the API, database invariants |

## What the tests are for

These are not coverage theatre. Each expected value was worked out by hand from
the rule in `docs/FINANCIAL_CALCULATIONS.md` before the code existed, so a
failing test means the implementation disagrees with the documented rule — not
merely that behaviour changed.

Several tests exist specifically to pin behaviour that is easy to regress into
a plausible-looking bug:

- `0.1 + 0.2` must be exactly `0.3`, and a thousand additions of `0.01` must be
  exactly `10`.
- `"1,234"` means one thousand two hundred thirty-four; `"1,23"` means one
  point two three. Getting this wrong corrupts a CSV import silently.
- A savings rate with no income returns `null`, never `0`.
- A month with no records is marked `hasData: false`, so a chart draws a gap
  rather than a zero line.
- A fully closed investment position leaves exactly zero cost basis, with no
  rounding residue.
- Reading `amount_minor` as a JSON number **loses** the last digit at
  `9007199254740993`; reading it as text does not. Both halves are asserted, so
  if PostgREST ever changes its serialisation the test will say the `::text`
  cast can be reconsidered.

## Manual verification

The signed-in rendering path was checked against the running application with a
seeded account, comparing the displayed figures to hand arithmetic:

| Figure | Displayed | Expected |
|---|---|---|
| Cash balance | ₺81.256,30 | 280.400 − 169.143,70 − 30.000 |
| Income (October) | ₺46.800,00 | salary |
| Expenses (October) | ₺26.252,30 | 16.200 + 6.047,80 + 1.879 + 1.336,50 + 789 |
| Net cash flow | ₺20.547,70 | income − expenses |
| Savings rate | %43,9 | 20.547,70 / 46.800 |

The monthly ₺5.000 transfer appears in the balance but not in the expense
total, which is the behaviour the four-kind transaction model exists to
produce.

## Known gaps

- **No browser end-to-end tests.** Playwright is not installed. The flows below
  were exercised by hand against the running application, which is weaker than
  an automated check and is stated as such: sign up → profile and categories
  created → sign in → add income → add expense → Overview figures update → edit
  → delete with confirmation → language switch → mobile layout.
- **No component tests.** `tests/component/` is configured for jsdom via a
  `@vitest-environment jsdom` docblock but is empty. The form components
  deserve tests for their error states.
- **Integration coverage is partial.** Transactions, profiles, categories and
  the goal-currency trigger are covered; the budget, asset, trade and import
  tables are not yet exercised directly.
- **No performance measurement.** No Lighthouse run has been performed, so no
  performance claim is made anywhere in this repository.
