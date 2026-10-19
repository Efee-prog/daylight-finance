import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `cacheComponents` (and the `partialPrefetching` that builds on it) were
  // enabled by create-next-app. Daylight reads the Supabase session from
  // cookies on every authenticated route, so practically every page is
  // request-bound: under cacheComponents each of those reads has to sit behind
  // its own cache or Suspense boundary or the build fails. That is real
  // complexity for no gain on a per-user financial dashboard, so both stay off
  // until there is a page whose data is genuinely shared between users.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  typedRoutes: true,
};

export default nextConfig;
