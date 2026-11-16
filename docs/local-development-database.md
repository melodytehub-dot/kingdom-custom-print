# Local development database

The storefront normally talks to the production Postgres database through
Cloudflare Hyperdrive. Dashboard and editor checks should not run against that
database, so development and QA use a local Postgres-compatible server built on
PGlite.

## Start the local database

```powershell
npm run db:local          # listens on 127.0.0.1:55432
npm run db:local:reset    # delete the local data directory and re-apply db/schema.sql
```

The first run applies `db/schema.sql`. Data is kept in `.local-db/`, which is
ignored by git.

Create `.env.development.local` so `next dev` uses it:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres
ADMIN_PASSWORD=choose-a-local-password
```

`.env.development.local` takes precedence over `.env.local`, so the production
connection string is untouched. Seed the sample catalog with:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres'
node scripts/seed.mjs
```

## Run the dashboard checks

Start the app with `npx next dev -p 3026 -H 127.0.0.1`, then:

```powershell
$env:QA_BASE='http://localhost:3026'
$env:QA_EDITOR_PASSWORD='<the local password>'
$env:QA_ENGINE='Chrome'          # Chrome, Edge, or WebKit

node scripts/qa-homepage-editor.mjs
node scripts/qa-homepage-history.mjs
node scripts/qa-admin-pages.mjs
node scripts/qa-admin-settings.mjs
node scripts/qa-custom-pages.mjs
```

Database-level scripts read `DATABASE_URL` directly:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres'
node scripts/qa-homepage-layout-db.mjs
node scripts/qa-home-settings-db.mjs
```

All of these scripts create their own pages, versions, or temporary tables.
None of them should be pointed at the live store.
