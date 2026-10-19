import "@testing-library/jest-dom/vitest";

// Financial figures are rendered with Intl; pin the clock-independent bits so
// a test never depends on the machine's locale or timezone.
process.env.TZ ??= "Europe/Istanbul";
