# Project overview

## What Daylight is

A personal finance application with an optional investment portfolio. A person
records what comes in and what goes out, sets monthly limits, earmarks savings,
and — if they want — tracks holdings they entered by hand. Every figure on
screen traces back to a record they entered themselves.

**Slogan:** *A clearer view of your money.*
**Supporting line:** *Understand your money. Make room for what matters.*

## Who it is for

Someone who wants to understand their own money without adopting an accounting
system. Specifically: a person who has tried a spreadsheet and found it
unreadable, and tried a bank app and found it unanswerable.

The primary user reads Turkish; English is an equal second language, not an
afterthought. Turkish is the default locale.

## The problem

Personal-finance tools tend to fail in one of two directions.

**Too simple:** they record transactions but cannot answer "what did I actually
save last month, and was that better or worse than usual?"

**Too dense:** they can answer it, but the answer is one tile in a grid of
twenty, and the user cannot tell which numbers are measured and which are
estimated.

Daylight aims at a third shape: few screens, each answering a specific question
completely, with the method behind each figure stated.

## Two principles that shape everything

### 1. No invented numbers

Where there is no data, the application says so.

- A month with no transactions is a **gap** in the chart, not a zero.
- A savings rate with no income is a **dash with an explanation**, not 0%.
- An asset with no recorded price is **excluded from the total and named**, not
  valued at nothing.
- Amounts in different currencies are **reported separately** until an exchange
  rate exists, rather than added into a plausible-looking total.
- A module whose screens are not built says so, instead of showing sample data.

A finance tool that displays a number the user cannot trace has lost the only
thing it was for.

### 2. No silent arithmetic error

No monetary value passes through a floating-point number anywhere between
Postgres and the screen. See
[FINANCIAL_CALCULATIONS.md](FINANCIAL_CALCULATIONS.md).

## Scope

### In scope for the MVP

| Area | What it covers |
|---|---|
| Overview | Balance, period income and expenses, net flow, savings rate, trend, insights, recent activity |
| Transactions | Create, edit, delete, filter, sort, search, CSV import and export |
| Budgets | Monthly category limits with usage and overrun warnings |
| Goals | Savings earmarks with deposits, withdrawals and progress |
| Portfolio | Manually entered assets, trades, prices, cost basis and profit |
| Insights | Period comparisons, category changes, allocation |
| Settings | Language, default currency, timezone, profile |
| Bilingual | Turkish and English, complete |
| Accounts | Email and password, with per-user data isolation |

### Explicitly out of scope

Bank account connections. Live market prices. Automated trading or any trading
bot. AI investment advice. Tax filing. Shared or family budgets. Forecasting
models. Derivatives, short positions and leverage. Corporate accounting. An
admin panel. Notifications and social features.

These are listed so their absence is a decision rather than an omission. The
first version has to be trustworthy before it is broad.

### Deliberate design constraints

- **Not a bank app, not an admin dashboard.** The visual language is editorial:
  cream paper, sage and olive, a serif display face, whitespace used as
  structure, figures large enough to read at a glance.
- **Minimalism is not missing features.** Complexity is managed rather than
  displayed. The multi-currency rules, the transfer model and the cost-basis
  engine are all more involved than what appears on screen.
- **Motion is restrained.** Short entrances and state transitions only, and
  `prefers-reduced-motion` is honoured.

## Current state

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the phase-by-phase
position and the README for the short version. In brief: the calculation layer,
database, security model, authentication, transactions, Overview, settings and
bilingual support are working and tested; budgets, goals, portfolio and
insights have their logic and tests but no screens; CSV import, end-to-end
tests and deployment have not been started.

## What "done" would mean

The acceptance bar for a first release:

- A user can sign in, record income and expenses, and see summaries computed
  from those records.
- Budgets and savings goals work.
- CSV import validates, reports errors and handles duplicates.
- Investment assets and trades can be recorded, with tested calculations.
- Both languages work, on mobile and desktop.
- Users cannot reach each other's records, and that is proven by a test.
- Financial calculations are verified independently of the interface.
- Typecheck, lint, build and the test suite all pass.
- Anything untested or unfinished is stated as such.

The last point is the one that makes the rest meaningful.
