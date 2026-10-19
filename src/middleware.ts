import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  localeFromAcceptLanguage,
} from "@/lib/i18n/config";

/**
 * Runs before every page request and does exactly two things:
 *
 *  1. Refreshes the Supabase session and writes the rotated cookies. Server
 *     Components cannot set cookies, so without this the access token would
 *     expire mid-session and the user would be signed out at a random moment.
 *  2. Makes sure the URL carries a locale segment, remembering the choice in a
 *     cookie so a reload or a later visit keeps the user's language.
 *
 * It does not make authorisation decisions. Redirecting an unauthenticated
 * visitor is handled by the authenticated layout, and the real enforcement is
 * Row Level Security in Postgres — a middleware check alone would be security
 * theatre, since it only sees requests that go through the router.
 */
const PUBLIC_FILE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // No locale in the path: pick one and redirect, preserving the rest of the
  // URL including the query string.
  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : localeFromAcceptLanguage(request.headers.get("accept-language"));

    const target = request.nextUrl.clone();
    target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(target);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser() revalidates the token with the auth server rather than
    // trusting the cookie's contents, and is what triggers the refresh.
    await supabase.auth.getUser();
  }

  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets; the handler
    // re-checks so the two cannot drift apart.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

export const SUPPORTED_LOCALES = LOCALES;
export const FALLBACK_LOCALE = DEFAULT_LOCALE;
