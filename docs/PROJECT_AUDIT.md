# Project audit

Recorded 19 October 2026, at the start of the project and updated as decisions
were made.

## Starting point

The target directory did not exist. There was no prior Daylight codebase, so
nothing was inherited and nothing was overwritten. The surrounding machine
already ran several unrelated projects, which turned out to matter (see
*Ports*).

| Checked | Found |
|---|---|
| Existing project in the working directory | None |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| git | 2.55.0 |
| GitHub CLI | 2.101.0, authenticated as `Efee-prog` with `repo` scope |
| Docker | 29.7.2, running, with other projects' containers active |

## Scaffold and the first five corrections

`create-next-app` produced Next 16.4.2, React 19.3, Tailwind v4 and TypeScript
5. Five things in the generated setup were wrong for this project and were
changed before any feature work:

1. **`cacheComponents: true`.** Every authenticated route in Daylight reads the
   session from cookies, so practically every page is request-bound. Under
   `cacheComponents` each of those reads must sit behind its own cache or
   Suspense boundary or the build fails — real complexity for no gain on a
   per-user dashboard. Disabled, with the reason recorded in `next.config.ts`.
2. **`target: "ES2017"`.** BigInt literals are unavailable below ES2020, and
   the entire money layer is built on BigInt. Raised to ES2022.
3. **`@types/node@^20`.** The installed runtime is Node 24, and Vitest 5
   requires `@types/node >= 22`; the mismatch surfaced as an `ERESOLVE`
   failure. Raised to v24 — aligning the types with the runtime rather than
   forcing the install past the conflict.
4. **`.env*` ignored wholesale.** That would have excluded `.env.example`,
   which must be committed. Added a negation.
5. **`typedRoutes`** (on by default in Next 16). Every route sits under the
   dynamic `[locale]` segment, so every href is assembled at runtime; typed
   routes cannot narrow those and demand an `as Route` cast at each call site,
   removing the checking the flag exists to provide. Disabled, and href
   construction was centralised in `src/lib/routes.ts` where a single
   documented assertion lives.

## Ports

Port 3000 was already held by `portal-app-dev`, and the default Supabase block
(543xx) is shared by any other Supabase project on the host. Daylight was moved
to its own block so it cannot collide:

| Service | Port |
|---|---|
| Application | 3100 |
| Supabase API gateway | 55321 |
| Postgres | 55322 |
| Studio | 55323 |
| Local mail inbox | 55324 |

## Decisions taken during the build

### Money representation

The central risk in a finance application is silent arithmetic error.
`0.1 + 0.2 !== 0.3` in doubles, and those errors accumulate until the balance
on screen stops matching the sum of the rows behind it.

Chosen: BigInt minor units for money, fixed-point BigInt at eight decimals for
quantities and prices, with the currency carried inside the value so that
adding two currencies is a type error rather than a bug to find later. No
external decimal library — the needed surface is small, and owning it means
owning the rounding rules explicitly.

### A hazard found while wiring the database

PostgREST serialises `BIGINT` and `NUMERIC` as JSON numbers. `JSON.parse` turns
`9007199254740993` into `9007199254740992` — one kuruş lost at a balance of
ninety trillion lira, and the loss is silent. Verified rather than assumed, and
handled by selecting every money column with a `::text` cast. The integration
suite asserts both the exact text read and the lossy number read, so if
PostgREST ever changes, the test says so.

### A hazard found while choosing chart colours

The obvious editorial pairing — the palette's own olive against its clay — was
run through a palette validator rather than approved by eye. It measured
ΔE 2.4 under deuteranopia and 8.6 for normal vision: a red-green colourblind
reader could not have told income from expenses, and nor could many others.
Re-stepped to a pair measuring 11.9 (protan) and 25.6 (normal). The one
remaining deviation is the chroma floor, which a muted dark green cannot clear
in OKLCh; secondary encoding (legend, direct labels, data table) was added so
colour is never the only signal.

The same approach caught two token problems: white text on olive is 1.8:1 and
is now never used, and the decorative hairline at 1.2:1 was split from a
control border at 3.2:1.

### Transfers as first-class kinds

Four transaction kinds (`income`, `expense`, `transfer_in`, `transfer_out`)
rather than two. Moving money into a savings goal must change the cash balance
without appearing as spending, or saving looks like overspending. Amounts are
stored strictly positive with direction in the kind, which makes a negative
income row unrepresentable.

### Goals are earmarks, not balances

A goal balance is never added to the cash balance. A goal is a label on money
the user already holds; summing the two would count the same lira twice as net
worth. Entries may link to the cash transaction that accompanied them, so the
two views stay reconcilable without being added.

## Risks

| Risk | Severity | Status |
|---|---|---|
| Float error in financial arithmetic | High | **Addressed** — integer arithmetic end to end, 127 unit tests |
| Precision loss across the API boundary | High | **Addressed** — `::text` casts, asserted in integration tests |
| One user reading another's records | High | **Addressed** — RLS with `WITH CHECK` and parent checks, 16 integration tests attempt the breach |
| Service role key leaking to the browser | High | **Addressed** — unused by application code, documented, not in any `NEXT_PUBLIC_` variable |
| Multi-currency totals being silently wrong | Medium | **Addressed** — mixed currencies are never summed; the absence of a total is stated |
| Showing invented figures where data is missing | Medium | **Addressed** — undefined is modelled as `null`/status, empty months are gaps |
| Unbuilt modules looking finished | Medium | **Addressed** — those pages state what is and is not built |
| No end-to-end browser tests | Medium | **Open** — flows verified by hand only |
| RLS policies on secondary tables untested | Medium | **Open** — same pattern as the tested ones, but untested |
| No rate limiting beyond Supabase defaults | Medium | **Open** |
| No deployment, so production config unproven | Medium | **Open** |
| CSV import not started | Low | **Open** — a core feature of the brief, still to do |
| `noUncheckedIndexedAccess` disabled | Low | **Open** — enabling it surfaced 86 mostly-safe sites; worth revisiting |

## Technical debt

- `src/app/[locale]/(app)/overview/page.tsx` loads every transaction to compute
  an all-time balance. Correct, and fine at demo scale; it will need a
  database-side aggregate before it meets several years of daily records.
- `middleware.ts` uses the file convention Next 16 now deprecates in favour of
  `proxy.ts`. It works and emits a warning; migrating is a small, separate
  change.
- No `error.tsx` or `loading.tsx` boundaries yet, so the error and loading
  states described in the brief exist as components but are not wired to route
  segments everywhere.
