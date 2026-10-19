import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

/**
 * The shared interaction primitives.
 *
 * Collected in one file because they only make sense as a set: the same
 * border, the same focus treatment, the same height. Splitting them across
 * eight files would make it easier for them to drift apart than to stay
 * consistent, which is the opposite of what a design system is for.
 *
 * Note the border colour. Controls use `line-strong` (3.2:1), not the
 * decorative `divider` hairline (1.2:1), because an input whose edge a
 * low-vision user cannot find is not an input. See globals.css.
 */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 " +
  "text-sm font-medium transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-sage",
  quiet: "text-muted hover:bg-sage hover:text-ink",
  // Negative actions are outlined rather than filled: a solid red block draws
  // the eye to the most destructive option on the screen.
  danger:
    "border border-negative bg-surface text-negative hover:bg-negative hover:text-paper",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
      {...props}
    />
  );
}

const CONTROL =
  "w-full rounded-sm border border-line-strong bg-surface px-3 py-2.5 " +
  "text-sm text-ink placeholder:text-muted/70 " +
  "disabled:bg-sage/40 disabled:text-muted";

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        CONTROL,
        invalid && "border-negative",
        props.inputMode === "decimal" && "tabular",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, invalid && "border-negative", className)}
      {...props}
    >
      {children}
    </select>
  );
}

/**
 * A labelled field.
 *
 * The label is always a real `<label>` tied to the control by id, the hint and
 * the error are referenced through aria-describedby, and a required field is
 * marked in text as well as with the attribute. Errors are never signalled by
 * colour alone.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  requiredLabel?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && requiredLabel ? (
          <span className="ml-1 font-normal text-muted">
            ({requiredLabel})
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      <div
        data-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      >
        {children}
      </div>
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-xs text-negative"
        >
          <span aria-hidden="true" className="mt-px font-semibold">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A page heading with optional supporting line and trailing actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-divider pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-prose">
        <h1 className="font-serif text-headline text-ink">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * A section of a page.
 *
 * Deliberately a titled region separated by a rule rather than a card. Putting
 * every figure in its own bordered box is what makes a finance dashboard look
 * like an admin panel; the editorial alternative is whitespace and hierarchy.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("flex flex-col gap-5", className)}>
      {/* A section may carry a description or actions without a title — the
          transactions list, for instance, shows only a record count. Guarding
          the whole header on `title` silently dropped those. */}
      {title || description || actions ? (
        <div
          className={cx(
            "flex items-end justify-between gap-4",
            title && "border-b border-divider pb-3",
          )}
        >
          <div>
            {title ? (
              <h2 className="font-serif text-title text-ink">{title}</h2>
            ) : null}
            {description ? (
              <p className={cx("text-xs text-muted", title && "mt-1")}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * A headline figure.
 *
 * `tabular` is not optional here: without tabular numerals a balance shifts
 * sideways as its digits change, which reads as instability in exactly the
 * place a user needs to feel certainty.
 */
export function MetricDisplay({
  label,
  value,
  hint,
  tone = "neutral",
  size = "regular",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "muted";
  size?: "regular" | "large";
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "muted"
          ? "text-muted"
          : "text-ink";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <span
        className={cx(
          "tabular font-medium",
          size === "large" ? "text-figure-lg" : "text-figure",
          toneClass,
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

/** An explanatory note, used for disclosures such as a stale price. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "caution";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex gap-3 rounded-sm border-l-2 px-4 py-3 text-xs leading-relaxed",
        tone === "caution"
          ? "border-caution bg-clay/20 text-ink"
          : "border-olive bg-sage/60 text-ink",
      )}
    >
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-1 text-muted" : "text-muted"}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Shown when there is genuinely nothing yet, never when a query failed. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-line-strong/60 px-6 py-12 sm:items-center sm:text-center">
      <div className="max-w-sm">
        <p className="font-serif text-title text-ink">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Shown when data could not be loaded.
 *
 * Distinct from EmptyState on purpose: telling a user whose connection failed
 * that they have no transactions would be a lie about their own records.
 */
export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-4 border-l-2 border-negative bg-surface px-6 py-8"
    >
      <div className="max-w-prose">
        <p className="font-serif text-title text-ink">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** A horizontal progress meter, used for budgets and goals. */
export function ProgressMeter({
  ratio,
  tone = "neutral",
  label,
}: {
  /** 0–1. Values above 1 are drawn full and the overflow reported in text. */
  ratio: number | null;
  tone?: "neutral" | "caution" | "negative";
  label: string;
}) {
  const clamped = ratio === null ? 0 : Math.max(0, Math.min(ratio, 1));
  const fill =
    tone === "negative"
      ? "bg-negative"
      : tone === "caution"
        ? "bg-caution"
        : "bg-positive";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ratio === null ? undefined : Math.round(clamped * 100)}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-sage"
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
