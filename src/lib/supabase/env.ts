/**
 * Environment validation.
 *
 * Validated once, at the edge of the process, so a missing variable produces
 * one clear message instead of a stack trace about `undefined` deep inside the
 * Supabase client. Only NEXT_PUBLIC_ values are read here; nothing in this
 * module may ever touch the service role key, which bypasses Row Level
 * Security and must never reach a bundle the browser can load.
 */

import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a full URL, e.g. http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short to be a real key"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type PublicEnv = z.infer<typeof schema>;

let cached: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cached) return cached;

  // Read through explicit property access rather than a loop: Next.js inlines
  // NEXT_PUBLIC_ variables at build time only when it can see them statically.
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Daylight is not configured.\n${details}\n\n` +
        `Copy .env.example to .env.local and fill in the values. For local ` +
        `development, \`npx supabase start\` prints the URL and anon key.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** The absolute URL auth emails should link back to. */
export function siteUrl(): string {
  return publicEnv().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
