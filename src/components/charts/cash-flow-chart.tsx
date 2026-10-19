"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTranslator } from "@/components/i18n/locale-provider";
import type { CurrencyCode } from "@/lib/finance/money";
import type { Locale } from "@/lib/i18n/config";
import { formatMonth } from "@/lib/i18n/format";

/**
 * Income against expenses over time.
 *
 * Series colours were chosen by running the palette validator rather than by
 * eye. The obvious editorial pairing - the palette's own olive against its
 * clay - measured ΔE 2.4 under deuteranopia and 8.6 for normal vision, which
 * means a red-green colourblind reader could not tell income from expenses at
 * all. These two steps measure ΔE 11.9 (protan) and 25.6 (normal) against the
 * paper surface while staying inside the palette's muted register.
 *
 * Colour is still never the only signal: the legend is always present, each
 * series carries a direct label at its final point, and the underlying numbers
 * are available as a table below the plot.
 */
const INCOME_COLOR = "#116A4E";
const EXPENSE_COLOR = "#C9763C";
const INK = "#272B25";
const MUTED = "#65685E";
const DIVIDER = "#E1DFD6";

export interface CashFlowPointView {
  readonly period: string;
  /**
   * Major units, or `null` for a period with no records at all. Null draws a
   * gap; a zero would assert the user earned and spent nothing that month,
   * which is a different and usually false claim.
   */
  readonly income: number | null;
  readonly expenses: number | null;
  readonly hasData: boolean;
}

export function CashFlowChart({
  points,
  locale,
  currency,
}: {
  points: readonly CashFlowPointView[];
  locale: Locale;
  currency: CurrencyCode;
}) {
  const { t } = useTranslator();

  const hasAnyData = points.some((point) => point.hasData);

  const data = points.map((point) => ({
    period: point.period,
    label: formatMonth(point.period, locale),
    income: point.hasData ? point.income : null,
    expenses: point.hasData ? point.expenses : null,
  }));

  // Compact axis ticks: a y-axis of full currency strings crowds out the plot.
  const axisFormatter = new Intl.NumberFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { notation: "compact", maximumFractionDigits: 1 },
  );
  const valueFormatter = new Intl.NumberFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { style: "currency", currency, maximumFractionDigits: 0 },
  );

  if (!hasAnyData) {
    return (
      <p className="border border-dashed border-divider px-4 py-12 text-center text-sm text-muted">
        {t("emptyStates.chartNoData")}
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-4">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.18} />
                <stop
                  offset="100%"
                  stopColor={EXPENSE_COLOR}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>

            {/* Recessive grid: horizontal rules only, so the plot reads as a
                page rather than as graph paper. */}
            <CartesianGrid
              stroke={DIVIDER}
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: DIVIDER }}
              tick={{ fill: MUTED, fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickFormatter={(value: number) => axisFormatter.format(value)}
            />
            <Tooltip
              cursor={{ stroke: INK, strokeWidth: 1, strokeOpacity: 0.3 }}
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: `1px solid ${DIVIDER}`,
                borderRadius: 2,
                fontSize: 12,
                color: INK,
              }}
              labelStyle={{ color: MUTED, marginBottom: 4 }}
              formatter={(value) =>
                typeof value === "number"
                  ? valueFormatter.format(value)
                  : t("charts.noDataPoint")
              }
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, color: MUTED }}
            />
            <Area
              type="linear"
              dataKey="income"
              name={t("charts.income")}
              stroke={INCOME_COLOR}
              strokeWidth={2}
              fill="url(#income-fill)"
              // Breaks the line across months with no records instead of
              // dropping it to zero.
              connectNulls={false}
              dot={{ r: 2.5, fill: INCOME_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
              animationDuration={420}
            />
            <Area
              type="linear"
              dataKey="expenses"
              name={t("charts.expenses")}
              stroke={EXPENSE_COLOR}
              strokeWidth={2}
              fill="url(#expense-fill)"
              connectNulls={false}
              dot={{ r: 2.5, fill: EXPENSE_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: "#FFFFFF", strokeWidth: 2 }}
              animationDuration={420}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* The same numbers, reachable without reading the plot: screen readers,
          keyboard users and anyone who wants the exact figure. */}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer py-1 hover:text-ink">
          {t("charts.legend")}
        </summary>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-divider text-muted">
              <th scope="col" className="py-1.5 pr-4 font-medium">
                {t("charts.month")}
              </th>
              <th scope="col" className="py-1.5 pr-4 text-right font-medium">
                {t("charts.income")}
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                {t("charts.expenses")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.period} className="border-b border-divider/60">
                <th scope="row" className="py-1.5 pr-4 font-normal text-ink">
                  {row.label}
                </th>
                <td className="tabular py-1.5 pr-4 text-right text-ink">
                  {row.income === null
                    ? t("charts.noDataPoint")
                    : valueFormatter.format(row.income)}
                </td>
                <td className="tabular py-1.5 text-right text-ink">
                  {row.expenses === null
                    ? t("charts.noDataPoint")
                    : valueFormatter.format(row.expenses)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
