# Durable storage groundwork

The SQL schema and parameterized access functions are the next stage of the coach-client app. These files are **not yet connected** to `server.mjs`: that server still uses in-memory maps. Do not represent the prototype as durable or production-ready.

## Local initialization
Requires a Node.js version supporting `node:sqlite` (Node 22.13+ or newer; behavior and flags vary by version).

```sh
cd coach-app
node db/migrate.mjs
```

By default the database is written to `../.local/coach.sqlite`, outside `coach-app`. The path can be overridden with `CI_COACH_DB_PATH`. Do not commit database files. Before a public deployment use a managed, encrypted, backed-up database and an explicit migration runner.

## Security boundaries
- Authorization must be enforced for every read/write using session identity, never an arbitrary ID supplied by a browser.
- A revoked relationship blocks coach access to client reflections. Separate deletion and export flows remain to be implemented.
- Email verification, MFA, CSRF protection, hardened session management, audit events, and retention policies are pending.
- No connection to the existing Apps Script/Sheets services has been made; do not transmit client data there.
- Do not use actual client data in the current pilot.
