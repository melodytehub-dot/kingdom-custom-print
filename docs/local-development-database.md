# Local development database

The storefront runs on one SQLite dialect everywhere: Cloudflare D1 in
production and Node's built-in SQLite on disk in development. There is no
Postgres emulator to start, and no connection string to configure.

## Prepare the local database

```powershell
npm run db:local          # apply db/schema.sqlite.sql, then seed if empty
npm run db:local:reset    # delete .local-db/store.sqlite and start clean
npm run db:migrate        # apply the schema only
npm run db:seed           # reseed the catalog (resets catalog tables)
```

Data lives in `.local-db/store.sqlite`, which is ignored by git. Set
`LOCAL_DB_PATH` to use a different file, which is handy for throwaway QA runs.

Only one environment variable is needed for local admin work:

```
ADMIN_PASSWORD=choose-a-local-password
```

Put it in `.env.development.local`. `DATABASE_URL` is no longer read by the app.

## Database changes

Edit `db/schema.sqlite.sql`, then apply it to the local file and to D1:

```powershell
npm run db:migrate
npm run db:d1:schema
```

The schema is written so it can be re-applied: tables, indexes and triggers use
`IF NOT EXISTS`. Timestamps are ISO-8601 UTC text, booleans are `0`/`1`, and
JSON columns are text parsed by the query layer.

## Catalog seed for D1

`scripts/seed-sqlite.mjs` seeds the local database from `scripts/seed.mjs`
catalog data. To publish the same catalog to production:

```powershell
npm run db:seed:sql    # writes db/seed.sql from a throwaway seeded database
npm run db:d1:seed     # applies db/seed.sql to the remote D1 database
```

`db/seed.sql` replaces catalog tables and the seeded site settings only; it
never touches orders, customers or uploaded media.

## Run the checks

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

The write-path checks run against the local SQLite file and need no browser:

```powershell
npm run qa-order-writes    # checkout, inventory holds, payment, refund, cancel
npm run qa-admin-writes    # settings, products, homepage draft/publish (needs the dev server)
```

`scripts/qa-*-db.mjs` and the other `postgres`-based scripts are legacy harnesses
from the Postgres era. They are not part of the SQLite test path and need to be
ported before they can run again.
