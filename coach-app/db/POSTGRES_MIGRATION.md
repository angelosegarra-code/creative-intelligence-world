# Free PostgreSQL pilot migration — preparation only

A separate free Render PostgreSQL 18 database named `ci-world-coach-studio-pilot-db` was created on 2026-11-18 in Oregon. It is temporary and currently scheduled to expire on **2026-12-18**. Export pilot data or upgrade before then.

## Current state
- The deployed Coach Studio starts `node persistent-server.mjs` and uses SQLite through `node:sqlite`. It does **not** yet connect to PostgreSQL.
- `db/postgres-schema.sql` provides the equivalent relational tables and indexes, including private journeys and sharing permissions. It is not yet applied.
- No SQLite data has been migrated; do not assume existing fictional accounts will appear in PostgreSQL.
- Do not enter real client data during this pilot.

## Safe cutover checklist
1. Implement an asynchronous PostgreSQL data access layer (e.g. `pg`) and refactor **all** routes in `persistent-server.mjs` and `journey.mjs` to await queries and use database transactions. SQLite's synchronous `q/all/run` functions cannot be pointed at PostgreSQL.
2. Apply `db/postgres-schema.sql` to the **pilot database only** and validate foreign keys, uniqueness, invitation replay protection, sharing/revocation, and journey access controls.
3. Set a secret `DATABASE_URL` **in the Render Coach Studio service environment**, using the database's **internal** connection URL from the Render dashboard. Never commit or print credentials. Keep `STAGING_ACCESS_USER` and `STAGING_ACCESS_PASSWORD` unchanged.
4. Run local and GitHub tests for registration, login, client consent, challenge, experiment, reflection, revocation and account isolation. Include a restart/redeploy persistence test.
5. Only after all tests pass, switch the **development** service's start command to the PostgreSQL implementation; verify with fictional accounts. Do not modify `main` or the public website.
6. Arrange an export/upgrade before the free database expiration.

Do not set `DATABASE_URL` yet: the current server has no PostgreSQL support and doing so alone would not preserve records.
