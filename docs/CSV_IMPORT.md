# CSV import and export

**Status: designed, not implemented.** The `import_batches` table exists and is
covered by RLS; the workflow does not exist yet. This document is the
specification it will be built against, so the rules are settled before the
code is written. Nothing here should be read as describing working behaviour.

## Why it is specified before being built

Import is the feature most able to corrupt a ledger quietly. A mis-parsed
decimal separator turns ₺1,23 into ₺1.230; a missing duplicate check doubles a
month of records; a non-atomic insert leaves half a file in the database with
no way to tell which half. Each of those produces a plausible-looking balance
that is wrong, which is the one failure mode this project treats as
unacceptable.

## The flow

1. **File selection** — drag-and-drop or file picker.
2. **Read** — parsed in the browser for preview; the authoritative parse
   happens on the server.
3. **Header detection** — the first row is examined for known field names in
   both languages.
4. **Column mapping** — the user confirms or corrects which column holds which
   field. Any column may be ignored.
5. **Preview** — the first rows as they would be stored, after parsing.
6. **Validation** — every row checked; see below.
7. **Error report** — invalid rows listed with the row number and the reason.
8. **Duplicate review** — possible duplicates shown for the user to decide.
9. **Confirmation** — the count that will be inserted, stated before anything
   is written.
10. **Insert** — inside a single database transaction.
11. **Result** — inserted, rejected and skipped counts, with a downloadable
    error report.

The first release supports transaction CSV. Investment-trade import extends the
same pipeline; automatically recognising every broker's format is explicitly
not attempted.

## Fields

| Field | Required | Accepted |
|---|---|---|
| `date` | yes | `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY` |
| `amount` | yes | `1234.56`, `1.234,56`, `1,234.56` |
| `type` | yes | `income`/`gelir`, `expense`/`gider`, `transfer_in`, `transfer_out` |
| `description` | no | up to 240 characters |
| `category` | no | matched to an existing category by name, case-insensitively |
| `currency` | no | a supported code; defaults to the user's preference |

Headers in either language are recognised. When they are not, the mapping step
is where the user resolves it — guessing is not acceptable for a field that
determines a sign.

## Validation

| Check | Rule |
|---|---|
| File type | `.csv` or `text/csv` only |
| File size | rejected above the configured limit |
| Row count | rejected above the configured limit |
| Encoding | UTF-8; a BOM is stripped. Turkish characters must survive |
| Date | must be a real calendar date — `2026-02-30` is rejected |
| Amount | must parse exactly and be greater than zero |
| Type | must be one of the four kinds |
| Currency | must be a supported code |
| Category | must belong to the user and match the row's kind |
| Precision | more decimals than the currency supports is **rejected**, not rounded |

Nothing in the file is trusted. A row that fails any check is rejected with its
row number and reason; it never arrives partially parsed.

### The decimal separator problem

`1,234` is ambiguous: one thousand two hundred thirty-four in English, one
point two three four in Turkish. The rule Daylight uses, already implemented
and unit-tested in `parseLocaleDecimal`:

- The **last** separator present determines the decimal point.
- Earlier separators must form valid thousand groups, or the value is rejected.
- A single separator followed by exactly three digits is a thousand group:
  `1,234` is 1234.
- Any other digit count is a decimal part: `1,23` is 1.23.

Both `1.234,56` and `1,234.56` therefore parse to the same amount, and
malformed grouping such as `1.23.456,78` is rejected rather than guessed at.

## Duplicates

A fingerprint over date, amount, currency, normalised description and category
detects likely repeats.

**Two different real transactions can share a date and an amount.** Two ₺50
coffees on the same day are not one coffee. Daylight therefore never deletes or
silently skips on the strength of a fingerprint: suspected duplicates are
**shown to the user**, who decides per row whether to import or skip. The
default is to skip, because re-uploading the same file by accident is more
common than genuinely identical pairs.

Each row records the `import_batch_id` that produced it, so an import can be
identified after the fact.

## Atomicity

The insert runs inside one database transaction. If it fails, nothing is
written and the result says so — there is no state in which a user has to
work out which half of their file arrived.

Rows rejected during validation never reach the insert. The result separates
inserted, rejected and skipped so the three are never conflated.

## Export

- Exports the current filtered transaction list, not everything, and says so.
- UTF-8 with a BOM, so Excel opens Turkish characters correctly.
- Dates as `YYYY-MM-DD`; amounts as plain decimals with a `.` separator, for
  machine round-tripping rather than display.
- **Formula injection is neutralised.** A cell beginning with `=`, `+`, `-` or
  `@` is prefixed so a spreadsheet treats it as text. A description a user
  typed must never execute when the file is opened.
- Quotes and embedded separators are escaped per RFC 4180.

## Tests to write alongside the implementation

- Turkish and English header rows
- Both decimal conventions, and malformed grouping
- Both date conventions, and impossible dates
- A BOM-prefixed file
- Turkish characters round-tripping through import and export
- An empty file, a header-only file, and a file over the row limit
- A row referencing another user's category
- The same file uploaded twice
- Two legitimate same-day, same-amount transactions
- A failure partway through, asserting that nothing was inserted
- An exported description beginning with `=`
