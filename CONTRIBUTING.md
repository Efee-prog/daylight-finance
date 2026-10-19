# Contributing

## Setup

```bash
npm install
npm run db:start             # Docker must be running; first run pulls several images
cp .env.example .env.local   # paste in the URL and anon key that db:start printed
npm run dev                  # http://localhost:3100
```

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four must pass. The tests must actually run — a skipped integration suite
is not a passing one, so start the database stack before claiming green.

## Where code goes

| Directory | Holds | Must not |
|---|---|---|
| `src/lib/finance` | Pure domain logic and arithmetic | import React, Next or Supabase |
| `src/lib/dates` | Calendar helpers | depend on the host timezone |
| `src/lib/db` | Database reads and writes | contain business rules |
| `src/lib/i18n` | Catalogues and formatting | let user-facing text live elsewhere |
| `src/features/*` | Server Actions and the components that use them | compute financial figures |
| `src/components` | Reusable presentation | query the database |
| `src/app` | Routing and page composition | hold logic worth testing |

The rule behind the table: a financial figure is computed in `lib/finance` and
nowhere else. If a component needs a number, it receives one.

## Standards

- TypeScript strict mode. `any` needs a comment explaining why nothing else
  works.
- Every user-facing string lives in `src/lib/i18n/messages/`. The Turkish
  catalogue defines the shape and English is type-checked against it, so a
  missing key is a build error. This includes validation messages, dialogs,
  toasts, chart tooltips, table headers and empty-state copy.
- No monetary value may touch a `number`. Use `Money` and `Fixed`. The only
  exception is the presentation edge, where a chart library requires one.
- A figure that is undefined must be modelled as `null` or a tagged status, not
  flattened to zero. Rendering 0% for "no income" is a different and false
  claim.
- Colours come from the design tokens in `src/app/globals.css`. Before adding a
  chart colour, validate it — the obvious editorial pairing in this palette
  fails colourblind separation, which is how the current chart colours came to
  be what they are.
- Comments explain *why*, not *what*. A comment restating the code is noise; a
  comment recording the measurement or constraint behind a decision is the
  reason the next person does not quietly undo it.

## Database changes

Add a new file under `supabase/migrations/`. Never edit a migration that has
already been applied. `npm run db:reset` rebuilds the local database and
destroys local data; it is never run against a deployed database.

After a schema change, regenerate the types and update the documents:

```bash
npm run db:types
```

`docs/DATABASE.md` and `docs/FINANCIAL_CALCULATIONS.md` must describe the same
system the code implements.

## Commits

Conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
`refactor:`.

A message should say what changed and why it was done that way. Do not describe
work that has not happened — a commit claiming a feature is finished when its
screens do not exist makes the whole history untrustworthy.

Branch from `main`. Do not force-push shared branches.
