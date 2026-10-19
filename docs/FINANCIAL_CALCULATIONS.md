# Financial calculations

Every formula Daylight uses, what it includes and excludes, and a worked
example for each. This is the document to check when a figure on screen looks
wrong: if the number does not match the rule here, one of the two is a bug.

All of this lives in `src/lib/finance/`, which imports nothing from React, Next
or Supabase. That isolation is what makes it testable, and it is tested:
`tests/unit/` covers it with 127 cases.

---

## 1. How money is represented

**The rule: no monetary value ever passes through a floating-point number.**

`0.1 + 0.2` is `0.30000000000000004` in IEEE-754 doubles. In a ledger those
errors accumulate until the displayed balance no longer equals the sum of its
rows, and the user has no way to tell which is wrong.

Two integer representations, kept apart by the type system:

| Representation | Type | Used for | Precision |
|---|---|---|---|
| Minor units | `Money` (`bigint` + currency) | every amount of money | the currency's smallest unit |
| Fixed-point | `Fixed` (`bigint`, scaled 10^8) | quantities, unit prices, ratios | 8 decimal places |

`Money` carries its currency as part of the value, not as metadata beside it.
That is what makes `tryAmount + usdAmount` impossible to write: `addMoney`
throws `CurrencyMismatchError`, and summing a mixed list returns one total per
currency rather than a single meaningless number.

### Rounding

Multiplication is the only lossy operation, so it takes an explicit mode and
never rounds silently. The default is **half-up away from zero**: `2.5 → 3` and
`−2.5 → −3`. This matches how Turkish invoices and brokerage statements round,
and keeps the treatment of a value and its negation symmetric.

### Currency exponents

| Currency | Exponent | 1 unit is |
|---|---|---|
| TRY, USD, EUR, GBP | 2 | 100 minor units |
| JPY | 0 | 1 minor unit |
| XAU | 4 | 10,000 minor units |

Display precision comes from this table, not from `Intl`'s defaults — `Intl`
renders XAU with two decimals while Daylight stores four.

### Crossing the database boundary

PostgREST serialises `BIGINT` and `NUMERIC` as JSON numbers, and `JSON.parse`
turns those into doubles. Demonstrated, not assumed:

```
9007199254740993  →  JSON.parse  →  9007199254740992
```

That is one kuruş lost at a balance of ninety trillion lira. The data access
layer therefore selects every money, quantity and price column with a `::text`
cast and parses the string into a `BigInt`. `tests/integration/isolation.test.ts`
asserts both halves of this: the cast is exact, and the uncast read is not.

---

## 2. Transaction kinds

Four kinds, because transfers must be representable without being mistaken for
income or spending:

| Kind | Cash balance | Income total | Expense total | Budgets | Savings rate |
|---|---|---|---|---|---|
| `income` | + | ✔ | — | — | ✔ |
| `expense` | − | — | ✔ | ✔ | ✔ |
| `transfer_in` | + | — | — | — | — |
| `transfer_out` | − | — | — | — | — |

Amounts are always stored positive; direction comes from the kind. A negative
income row cannot exist to be double-counted.

A transfer between two things Daylight tracks is two rows — one `transfer_out`
and one `transfer_in` — which cancel in the cash balance and are invisible
everywhere else. Moving ₺5.000 into savings is therefore not spending, and
moving it back is not earnings.

---

## 3. Cash-flow formulas

### Income and expenses

```
income   = Σ amount where kind = 'income'
expenses = Σ amount where kind = 'expense'
```

Computed per currency. A user with lira and dollar records has two income
totals, not one.

### Net cash flow

```
net = income − expenses
```

Transfers are excluded by design.

### Cash balance

```
balance = Σ (amount × sign(kind))
```

The only aggregate that counts transfers, because they do move cash.

**Worked example** (the seeded demo account, October 2026):

```
income            46.800,00     salary
expenses          26.252,30     16.200 rent + 6.047,80 groceries
                                + 1.879 dining + 1.336,50 utilities + 789 transport
net               20.547,70
transfer out       5.000,00     moved into savings

October's contribution to the balance: 46.800,00 − 26.252,30 − 5.000,00
                                     = 15.547,70
```

Note that the ₺5.000 transfer reduces the balance but does **not** appear in
the expense total. That is the defining behaviour of this model, and it is
checked against live data as well as in unit tests.

### Savings rate

```
savings rate = (income − expenses) / income
```

**Returns `null` when income is zero.** The rate is genuinely undefined then —
not zero — and the interface renders a dash with "no income recorded in this
period" rather than 0%, which would be a different and false claim. The type is
`Fixed | null`, so a caller cannot accidentally treat it as a number.

```
income 46.800,00 · expenses 26.252,30
(46.800,00 − 26.252,30) / 46.800,00 = 0,439053…  →  %43,9
```

A negative rate is legitimate and is shown as such when spending exceeds
income.

### Spending by category

Shares are computed within a single currency, because a percentage of a
mixed-currency total would rest on an addition that is not valid.

```
share = category total / total spending in that currency
```

### Monthly series

The period list is supplied by the caller rather than derived from the data, so
a chart axis stays stable when a month is empty. Each point carries `hasData`,
which separates **"no records this month"** from **"netted zero this month"**.
The chart draws a gap for the former; drawing a zero line would invent data.

---

## 4. Budgets

```
usage     = spending counted by the budget / limit
remaining = limit − spending
```

A budget counts a transaction only when **all** of these hold:

- kind is `expense` (not a transfer, not an investment purchase)
- the category matches
- the currency matches the limit's currency
- the date falls inside the budget's calendar month, inclusive of both ends

| Condition | Status |
|---|---|
| spent > limit | `exceeded` |
| spent ≥ 80% of limit | `approaching` |
| otherwise | `under` |
| limit ≤ 0 | `invalid`, ratio `null` |

The 80% threshold is compared with integers (`spent × 100 ≥ limit × 80`) rather
than a float ratio, so the boundary is exact. Spending exactly at the limit is
`approaching`, not `exceeded`; one minor unit over is `exceeded`.

A zero or negative limit yields `ratio: null` and status `invalid` instead of a
division error or an unbounded percentage. The spending figure is still
reported, because it happened regardless of how the limit was set.

**Worked example**

```
Category  Dining out
Limit     ₺8.000,00
Spent     ₺5.200,00
Remaining ₺2.800,00
Usage     5.200 / 8.000 = 0,65  →  %65  →  under
```

---

## 5. Savings goals

```
saved     = Σ deposits − Σ withdrawals
remaining = max(target − saved, 0)
progress  = saved / target        (null when target ≤ 0)
```

**A goal balance is never added to the cash balance.** A goal is an earmark on
money the user already holds, not a second pile of it; summing the two would
count the same lira twice as net worth. If the user genuinely moved the cash,
they record a `transfer_out` and may link it to the goal entry, which keeps the
two views reconcilable without being added together.

Entries must share the goal's currency — a ₺50.000 goal part-funded in dollars
has no defined progress without an exchange rate, so the input is rejected
rather than converted by guesswork. This is enforced by a database trigger as
well as in the domain layer.

`remaining` is clamped at zero: an over-funded goal shows 0 remaining and a
progress above 100%, never a negative amount left to go.

---

## 6. Investment portfolio

### Cost method: weighted average cost

Not FIFO, not specific-lot. How it is applied, precisely:

**On a buy**

```
quantity   += q
cost basis += q × price + fee
```

Commission is capitalised into cost rather than expensed, so the average cost
reflects what the units actually cost to acquire.

**On a sell**

```
average cost = cost basis / quantity          (before the sale)
cost removed = q × average cost
proceeds     = q × price − fee
realised P/L += proceeds − cost removed
cost basis   -= cost removed
quantity     -= q
```

The sell-side fee reduces realised profit; it does not touch the remaining cost
basis. The average cost of the units still held is **unchanged** by a sale,
which is the defining property of the method.

**Closing a position.** When the final units are sold, the cost removed is the
entire remaining cost basis, derived by subtraction rather than by multiplying
a rounded average cost. Without that, a position fully sold could be left
holding a stray kuruş of basis forever.

**Worked example**

```
Buy   10 units @ ₺100          cost 1.000,00
Buy   30 units @ ₺140          cost 4.200,00
                               ─────────────
      40 units                 cost 5.200,00   average ₺130,00

Sell  10 units @ ₺150, fee ₺20
      proceeds      10 × 150 − 20 = 1.480,00
      cost removed  10 × 130      = 1.300,00
      realised P/L                =   180,00

      30 units remain, cost 3.900,00, average still ₺130,00
```

### Guard rails

- **Overselling raises `OversellError`.** A sale larger than the holding would
  create a negative quantity, which the rest of the application has no model
  for; it would silently become a short position.
- **Trades are replayed in date order**, with the row id as tiebreak. Applying
  a sale before the buy that supplied its units would raise a spurious
  oversell error, so ordering is part of correctness, not presentation.

### Valuation

```
market value     = quantity × latest recorded price
unrealised P/L   = market value − cost basis of units held
```

Valuation returns a **tagged status**, not a number:

| Status | Meaning |
|---|---|
| `valued` | a price exists, in the asset's own currency |
| `no-price` | no price recorded, or the only price is in another currency |
| `closed` | the position holds no units |

A missing price is not a zero value. An unpriced asset is **excluded from the
total and named**, so the interface can report "₺ total, $ total, 2 assets
without a price" rather than silently understating the portfolio.

The timestamp of the price is kept and shown, so a valuation recorded three
weeks ago is never presented as today's price. Historical prices are never
relabelled as current, and no portfolio history chart is drawn from prices that
were not recorded.

### Multiple currencies

Values in different currencies are **never added together**. The result names
the currencies it contains, and the interface states which currency each total
is expressed in. A combined total appears only when an exchange rate has been
supplied, and that rate's `asOf` date is carried with it so staleness can be
disclosed.

### Out of scope for this release

FIFO/LIFO lot selection, short positions, leverage, derivatives, corporate
actions, dividends and tax-lot accounting. These are listed so their absence is
a stated boundary rather than an oversight.

---

## 7. Dates

Transaction dates are **calendar dates in the user's own timezone**, not
instants. "19 October" is the same row whether the reader is in Istanbul or Los
Angeles.

They are stored as `DATE` and handled in the application as `YYYY-MM-DD`
strings, compared lexicographically — which sorts in calendar order — so a date
never shifts by a day through a UTC conversion. `new Date` appears only where
UTC-pinned construction makes month-end arithmetic safe, and formatting pins
the value to UTC noon so no timezone can move the day.

"Today" and "this month" are resolved against the timezone saved in the user's
profile.

---

## 8. Tested scenarios

The specification's required cases, each with its expected value worked out by
hand before the code was written:

| Scenario | Covered in |
|---|---|
| No transactions at all | `cashflow.test.ts` |
| Income only / expenses only | `cashflow.test.ts` |
| Zero income (savings rate undefined) | `cashflow.test.ts` |
| A thousand small amounts | `fixed.test.ts`, `cashflow.test.ts` |
| Amounts past `Number.MAX_SAFE_INTEGER` | `fixed.test.ts`, `money.test.ts` |
| Decimal amounts and rounding boundaries | `fixed.test.ts`, `money.test.ts` |
| Mixed currencies | `money.test.ts`, `cashflow.test.ts` |
| Repeat purchases of one asset | `portfolio.test.ts` |
| Partial sale | `portfolio.test.ts` |
| Selling more than held | `portfolio.test.ts` |
| Missing price / stale price / no history | `portfolio.test.ts` |
| Zero budget, negative budget, overrun | `budgets.test.ts` |
| Leap-year month boundaries | `budgets.test.ts`, `dates.test.ts` |
| Turkish and English decimal parsing | `fixed.test.ts` |
| Turkish and English display formatting | `i18n.test.ts` |
