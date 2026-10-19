"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { publicEnv } from "./env";

/**
 * Supabase client for the browser.
 *
 * Carries the anon key, which is safe to expose only because Row Level
 * Security is enabled on every table: the key grants no privileges of its own,
 * and the user's identity comes from the session token. The client is used for
 * sign-in, sign-out and session refresh; reads and writes of financial data go
 * through Server Actions so that validation cannot be bypassed.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!browserClient) {
    const env = publicEnv();
    browserClient = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return browserClient;
}
