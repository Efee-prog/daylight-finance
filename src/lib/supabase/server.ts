import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { publicEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * The session is read from the request cookies and verified server-side, which
 * is the point: the signed-in user's id comes from a token the server checked,
 * never from anything the client sent in a body or a query string. Combined
 * with Row Level Security, this is what makes one user's financial records
 * unreachable to another.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. A refreshed token is
            // discarded here and written by the middleware on the next
            // request instead, which is the documented arrangement — not an
            // error worth surfacing to the user.
          }
        },
      },
    },
  );
}
