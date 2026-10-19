# Security

Financial records are sensitive. This document states what Daylight does to
protect them, and — equally important — which of those claims have actually
been tested and which have not.

## Threat model

The browser is assumed hostile. The Supabase anon key ships to the client, so
anyone can craft requests against the API with a valid key and their own
session. Authorisation therefore cannot live in the application: it must hold
in the database, against a request the application never saw.

## Authentication

- Email and password through Supabase Auth. Passwords are never stored by
  Daylight and never appear in its logs.
- The server identifies the user with `supabase.auth.getUser()`, which
  revalidates the token against the auth service. `getSession()` merely decodes
  whatever is in the cookie and is never trusted server-side.
- Session cookies are `httpOnly` and `sameSite=lax`, and are marked `secure` in
  production. Rotation happens in middleware, because Server Components cannot
  write cookies and the token would otherwise expire mid-session.
- A minimum password length of 10 characters is enforced on the server.
- Sign-in returns **one message** for a wrong password and for an unknown
  address, so the form cannot be used to discover which emails have accounts.

## Authorisation

**The user id is never read from client input.** Not from a request body, not
from a query parameter, not from a hidden form field. It comes from the
verified session, and every Server Action calls `requireSession()` before
writing.

Row Level Security is enabled on every user-owned table:
`profiles`, `categories`, `transactions`, `budgets`, `savings_goals`,
`savings_goal_entries`, `assets`, `investment_transactions`,
`asset_price_history`, `import_batches`.

Three details that are easy to get wrong and are handled explicitly:

1. **`WITH CHECK` as well as `USING`.** Without it a user could update one of
   their own rows and reassign it to another `user_id`, or insert a row already
   labelled with a victim's id.
2. **Parent ownership is verified.** A policy that only checked `user_id` would
   still let a user attach their transaction to someone else's category, or
   their trade to someone else's asset. The policies carry an `EXISTS` clause
   confirming the referenced parent belongs to the caller.
3. **`asset_price_history` has no update policy.** A recorded observation is
   corrected by deleting it and recording a new one, which keeps the valuation
   history honest.

`handle_new_user` is `SECURITY DEFINER` because it runs on the auth trigger,
before the new user has a session. Its `search_path` is pinned to `public` so a
mutable search path cannot be used to hijack the definer's privileges.

### What has been verified

`tests/integration/isolation.test.ts` runs against a live Postgres with two
real signed-in users and the anon key — exactly what a browser has. It asserts
that an attacker:

- reads nothing from another user's `transactions`, by listing and by id
- cannot read another user's `profiles` row
- is **rejected** (`42501`) when inserting a row labelled with another user's id
- is **rejected** when reassigning one of their own rows to another user
- is **rejected** when referencing another user's category
- deletes nothing when attempting to delete every row

All 16 assertions pass. This moves cross-user isolation from *implemented* to
*verified*.

### What has not been verified

- **Policies on `budgets`, `savings_goals`, `savings_goal_entries`, `assets`,
  `investment_transactions` and `import_batches` are written but only partly
  exercised.** The integration suite covers transactions, profiles, categories
  and the goal-currency trigger. The others follow the same pattern and the
  pattern is proven, but "follows a proven pattern" is not the same as tested.
- **No penetration testing.** No external review has been performed.
- **Rate limiting is Supabase's defaults.** Daylight adds none of its own, so
  sign-in attempts are limited only by whatever the Auth service enforces. This
  is a gap for a production deployment.

## Input validation

Validation runs on the server regardless of what the browser checked. Client
checks exist for immediacy, not for safety; a request built by hand gets the
same treatment.

- Zod schemas validate shape, type and bounds.
- Amounts are parsed with an explicit locale-aware decimal parser that rejects
  malformed input rather than coercing it. Extra precision is **rejected**, not
  truncated — silently dropping a digit the user typed is a data-integrity bug.
- An upper bound on a single amount catches a mistyped figure (an extra five
  zeros) without limiting legitimate records.
- Category/kind pairing is checked, since an income row filed under an expense
  category would corrupt every budget that category feeds.
- Timezone strings are validated by attempting to construct an `Intl`
  formatter, so a bad value cannot make every date on the dashboard throw.
- The database enforces its own invariants independently: positive amounts,
  known currencies, budget periods starting on the first of a month, and
  matching currencies between a goal and its entries.

## Injection

- All database access goes through the Supabase client, which parameterises
  queries. No SQL string is assembled from user input.
- Search terms are escaped before being used in an `ILIKE` pattern, so a user
  searching for `100%` gets a literal match rather than a wildcard.
- React escapes interpolated values by default. `dangerouslySetInnerHTML` is
  not used anywhere in this codebase.
- CSV export (not yet implemented) must neutralise cells beginning with
  `=`, `+`, `-` or `@` to prevent formula injection in spreadsheet software.
  This is recorded in `docs/CSV_IMPORT.md` as a requirement, not as done.

## Secrets

- `.env.local` is git-ignored. `.env.example` is committed and contains no real
  values.
- Only `NEXT_PUBLIC_` variables are read by application code, and they are
  validated at startup.
- **`SUPABASE_SERVICE_ROLE_KEY` is not used by the application.** It bypasses
  Row Level Security entirely. It must never appear in a `NEXT_PUBLIC_`
  variable or reach the browser.
- The anon key is safe to expose *only because* RLS is enabled on every table.
  It carries no privileges of its own.
- The repository was scanned for committed credentials before its first push.
  The keys that appear in local development are the fixed, well-known defaults
  that `supabase start` generates for a containerised stack; they grant access
  to nothing outside this machine.

## Error handling

Users see readable messages from the translation catalogue. Underlying errors —
which may name a table or a constraint — are not forwarded to the browser.

A failed query is reported as an error, never as an empty result: telling a
user whose connection dropped that they have no transactions would be a lie
about their own records.

## Transport and headers

Local development runs over HTTP. A deployment must terminate TLS and should
add HSTS, a Content-Security-Policy and `X-Content-Type-Options: nosniff`.
None of these are configured yet — see `docs/DEPLOYMENT.md`.

## Data minimisation

Daylight stores an email address, an optional display name, a locale, a default
currency, a timezone, and the financial records the user enters. There is no
analytics, no third-party script, and no bank connection. Fonts are
self-hosted, so rendering a page makes no request to another origin.

## Reporting

This is a portfolio project without a production deployment. If you find a
problem, open an issue on the repository.
