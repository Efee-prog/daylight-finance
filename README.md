# Daylight

**A clearer view of your money.**

A personal finance application with an optional investment portfolio, built as
a working product rather than a dashboard mock-up: a real Postgres database,
real user accounts, persistent records, and financial arithmetic that is tested
rather than assumed.

The interface is deliberately not a standard SaaS dashboard. It takes its cues
from editorial print design — a cream page, sage and olive accents, a serif
display face, generous and purposeful whitespace, and figures large enough to
read at a glance.

---

## The problem it solves

Most personal-finance tools fail in one of two ways. Either they are so simple
that they cannot answer a real question ("what did I actually save last
month?"), or they are so dense that the answer is buried in a grid of widgets.
Daylight tries for a third thing: few screens, each of which answers a specific
question completely, with every figure traceable back to a record the user
entered themselves.

Two principles follow from that and are enforced throughout the codebase:

1. **No invented numbers.** Where there is no data, the app says so. A month
   with no transactions is a gap in the chart, not a zero. A savings rate with
   no income is a dash with an explanation, not 0%. An asset with no recorded
   price is excluded from the total and named, not valued at nothing.
2. **No silent arithmetic error.** No monetary value ever passes through a
   floating-point number, anywhere between Postgres and the screen.

---

## Current status

This is an MVP under active development. What follows separates what is built
and verified from what is not, because a README that blurs the two is useless
for judging the project.

### Working and verified

| Area | State |
|---|---|
| Financial calculation layer | Complete, 127 passing unit tests |
| Cross-user data isolation | Verified: 16 integration tests attempt to breach RLS and fail |
| Database schema + RLS policies | Applied to a live local Postgres without error |
| Email/password authentication | Working: sign up, sign in, sign out, session refresh |
| Transactions | Full CRUD against the database, server-side validation |
| Overview | All figures computed from the user's own records |
| Turkish / English | Both complete, switchable, preserved across reloads |
| Mobile and desktop layouts | Separate layouts, not a shrunken desktop table |

### Built underneath, screens not yet written

Budgets, savings goals, the investment portfolio and the Insights page have
their tables, RLS policies and calculation functions written and unit-tested.
Their pages currently state this plainly instead of showing sample data.

### Not started

CSV import and export, Playwright end-to-end tests, and deployment. See
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the sequence and
[Known limitations](#known-limitations) for the honest list.

---

## Design approach

| Decision | Reason |
|---|---|
| Cream paper (`#F6F5F0`) as the page, white reserved for form surfaces | White-on-white panels are what make a finance app read as an admin tool |
| Text on olive and clay is always ink, never white | Measured: white on olive is 1.8:1, ink on olive is 7.8:1 |
| Decorative hairlines and control borders are different tokens | The hairline is 1.2:1 — fine for a rule, a WCAG failure for an input edge |
| Tabular numerals on every figure | Otherwise a balance shifts sideways as its digits change |
| Chart colours chosen by validator, not by eye | The obvious olive/clay pairing measured ΔE 2.4 under deuteranopia: a colourblind reader could not tell income from expenses |
| Sections separated by rules, not cards | One card per figure is the look this product is avoiding |
| Charts carry a legend, direct labels and a data table | Identity is never conveyed by colour alone |

---

## Technology

- **Next.js 16** (App Router) with **React 19** and **TypeScript** in strict mode
- **Tailwind CSS v4**, tokens declared as a CSS-first theme
- **Supabase**: Postgres 17, Auth, and Row Level Security
- **Zod** for validation, shared by client and server
- **Recharts** for charts
- **Vitest** for unit tests
- No state-management library, no component library, no date library — the
  calculation layer and the date helpers are written in-house because money and
  calendar arithmetic are where the correctness risk lives

## Architecture at a glance

```
Browser ──► Server Component ──► lib/db  ──► Supabase (RLS) ──► Postgres
                  │                  ▲
                  ▼                  │
            lib/finance        Server Action
         (pure, no I/O)      (validates, writes)
```

`src/lib/finance` holds the domain core: it imports nothing from React, Next or
Supabase, which is what makes it testable in isolation. The UI never computes a
financial figure of its own, and the database layer never contains business
rules. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Getting started

### Requirements

- Node.js 20 or newer (developed on 24)
- Docker Desktop, running — the local database stack runs in containers

### Setup

```bash
git clone https://github.com/Efee-prog/daylight-finance.git
cd daylight-finance
npm install

# Start Postgres, Auth and the API gateway in Docker, applying all migrations.
# First run downloads several images and takes a few minutes.
npm run db:start

# Copy the template and paste in the URL and anon key that db:start printed.
cp .env.example .env.local

npm run dev
```

Then open **http://localhost:3100** and create an account.

### Ports

Daylight uses its own port block so it cannot collide with anything else
running on the machine:

| Service | Port |
|---|---|
| Application | 3100 |
| Supabase API gateway | 55321 |
| Postgres | 55322 |
| Supabase Studio | 55323 |
| Local mail inbox (confirmation emails) | 55324 |

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Safe in the browser *only* because RLS is enabled on every table; it carries no privileges of its own |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used to build auth redirect links |

`SUPABASE_SERVICE_ROLE_KEY` is **not** used by the application. It bypasses Row
Level Security entirely and must never be exposed to the browser or placed in a
`NEXT_PUBLIC_` variable.

Environment variables are validated at startup, so a missing value produces one
clear message instead of a stack trace about `undefined`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3100 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 3100 |
| `npm test` | Run the unit test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, write |
| `npm run db:start` | Start the local Supabase stack and apply migrations |
| `npm run db:stop` | Stop it |
| `npm run db:reset` | **Destructive.** Drop the local database and re-apply every migration |
| `npm run db:types` | Regenerate TypeScript types from the live schema |

### Database

Schema changes are made by adding a migration under `supabase/migrations/`,
never by editing an applied one. `npm run db:reset` rebuilds the local database
from scratch; it destroys local data and is never run against a deployed
database.

---

## Screenshots

> Not yet captured. The sign-in screen, Overview and Transactions are the three
> worth showing once the remaining screens are built.

## Demo

No public deployment yet. The application has only ever been run locally; see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for what deploying would require.

---

## Known limitations

- **CSV import and export are not implemented.** The database table that
  records import batches exists; the workflow does not.
- **Budgets, goals, portfolio and insights have no screens yet.** Their data
  model and calculations are written and tested.
- **No end-to-end browser tests.** Unit and integration coverage is thorough,
  but Playwright has not been set up, so the browser flows (filling the form,
  switching language, the mobile layout) have been verified by hand rather than
  automatically.
- **Multi-currency totals are intentionally incomplete.** With no exchange rate
  source, amounts in different currencies are reported separately and no
  combined total is offered.
- **Asset prices are entered by hand.** No market data provider is integrated,
  and the architecture leaves room for one without pretending to have it.
- **`noUncheckedIndexedAccess` is off.** Enabling it surfaced 86 mostly-safe
  destructuring sites; it is worth revisiting rather than suppressing.
- **No license file.** The repository is public but carries no license, so all
  rights are reserved by default and the code cannot legally be reused.

## Documentation

| Document | Covers |
|---|---|
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Purpose, users, scope, MVP boundaries |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data flow, design system |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, relationships, indexes, isolation |
| [docs/FINANCIAL_CALCULATIONS.md](docs/FINANCIAL_CALCULATIONS.md) | Every formula, with worked examples |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, RLS, secrets, and what is untested |
| [docs/TESTING.md](docs/TESTING.md) | What is covered and what is not |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | What a deployment would need |
| [docs/CSV_IMPORT.md](docs/CSV_IMPORT.md) | The planned import design |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phases, progress, remaining work |
| [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md) | Starting-point audit, decisions, risks |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow and standards |
| [CHANGELOG.md](CHANGELOG.md) | What changed, when |
