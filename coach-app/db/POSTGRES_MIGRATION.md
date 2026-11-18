# Coach Studio PostgreSQL development service

Use the existing free Coach Studio database and its internal Render connection URL. Keep the existing staging access variables and leave external database access restricted. Use fictional accounts only. This rollout initializes the PostgreSQL schema and creates new fictional test accounts. It does not copy SQLite records.

Render root directory: coach-app
Build command: npm ci --omit=dev
Start command: npm run start:postgres

Startup applies the additive migration and checks that the expected tables exist before listening. A database or migration failure stops startup. Keep the connection URL in the service's DATABASE_URL secret.

To run the shared workflow suite against PostgreSQL as well as SQLite, set CI_COACH_TEST_POSTGRES_URL to an isolated local PostgreSQL database connection URL and run npm test. The test writes fictional records only. For a deployed smoke test, register fictional accounts, check consent and revocation, and check a saved journey after an app restart and a separate redeploy.
