# Deployment

**Nothing has been deployed.** Daylight has only ever run locally. This
document describes what a deployment would require; it does not describe one
that happened.

## Local development

```bash
npm install
npm run db:start             # Docker required; first run pulls several images
cp .env.example .env.local   # paste in the URL and anon key db:start printed
npm run dev                  # http://localhost:3100
```

Ports are deliberately non-default so the project cannot collide with anything
else on the machine:

| Service | Port | URL |
|---|---|---|
| Application | 3100 | http://localhost:3100 |
| Supabase API gateway | 55321 | http://127.0.0.1:55321 |
| Postgres | 55322 | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Supabase Studio | 55323 | http://127.0.0.1:55323 |
| Local mail inbox | 55324 | http://127.0.0.1:55324 |

Confirmation emails are caught by the local inbox at port 55324 rather than
being sent. Verified working: sign-up creates the auth user, the trigger creates
the profile and nine starter categories, and sign-in returns a session.

### Production build, locally

```bash
npm run build
npm start                    # serves on 3100
```

## What a hosted deployment needs

### 1. A Supabase project

Create one, then apply the migrations:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

`db push` applies pending migrations. **Never run `db:reset` against a hosted
database** — it drops everything.

Then, in the Supabase dashboard:

- Set the Site URL and the redirect allow-list to the deployed domain, or email
  confirmation links will point at localhost.
- Decide whether email confirmation is required. It is off in the local config;
  for anything public it should be on.
- Configure an SMTP provider. Supabase's built-in sender is rate-limited and
  not intended for real use.
- Review the Auth rate limits. Daylight adds none of its own, so these are the
  only protection against credential stuffing.

### 2. Hosting for the application

Any host that runs Next.js 16 with Node 20+. The application needs:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the project's API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon/publishable key |
| `NEXT_PUBLIC_SITE_URL` | the deployed origin, e.g. `https://daylight.example` |

`SUPABASE_SERVICE_ROLE_KEY` must **not** be set in the application
environment. The application does not use it, and it bypasses Row Level
Security entirely.

### 3. Things that are not configured yet

These are gaps, not steps that were skipped at the end:

- **No security headers.** A deployment should add HSTS, a
  Content-Security-Policy and `X-Content-Type-Options: nosniff`. None are set.
- **No rate limiting of its own.** See above.
- **No error reporting.** Server errors are logged to stdout and nowhere else.
- **No CSV upload limits enforced in code.** The limits are described in
  `CSV_IMPORT.md`; the feature does not exist yet, so neither do they.
- **No CI pipeline.** `typecheck`, `lint`, `test` and `build` are run by hand.
  They should run on every push, with the database stack started so the
  integration tests do not silently skip.

## Pre-deployment checklist

Honest status of each item:

- [x] Production build succeeds locally
- [x] Migrations apply cleanly to a fresh database
- [x] RLS policies verified against a live database by test
- [x] Sign-up and sign-in flows work
- [x] No secrets committed; `.env.example` contains no real values
- [x] Demo data is synthetic and separate from any real records
- [x] Mobile and desktop layouts usable
- [ ] Deployed to a host
- [ ] Hosted Supabase project created and linked
- [ ] Auth redirect URLs set for the deployed domain
- [ ] SMTP configured
- [ ] Security headers configured
- [ ] CI running the checks on every push
- [ ] End-to-end tests passing in CI
- [ ] Screenshots captured for the README

## What is needed from the project owner

Deployment cannot proceed without these, and none of them can be created from
inside the repository:

1. A Supabase account and a project (its ref, URL and anon key).
2. A hosting account for the application.
3. A domain, if the deployment should not live on a provider subdomain.
4. An SMTP provider, if real confirmation emails are wanted.

Once those exist, the steps above are mechanical.
