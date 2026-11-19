# CI World Coach Pilot — verification and release gates

## Current evidence
- The code has been committed to the isolated `prototype/coach-dashboard-v1` branch.
- The repository has a GitHub Actions workflow: `.github/workflows/coach-app-tests.yml`.
- As of the latest check, the connector did not return a completed CI workflow run for the recent commits. Do **not** claim tests passed.
- The existing CI World public site is unchanged.

## Run a real local test
Use Node.js 22.13+ (22.16+ recommended):
```sh
cd coach-app
node --check server.mjs
node --check persistent-server.mjs
node --check app.js
npm test
npm run start:persistent
```
Then visit `http://127.0.0.1:3100` on the same computer. Use invented names and accounts only.

## Manual end-to-end smoke test
1. Register a fictional coach and client.
2. Sign in as coach; generate an invitation token addressed to the client.
3. Sign in as client; accept the token once; verify second acceptance is rejected.
4. Sign in as coach; confirm the client appears; draft a challenge using Observer; edit it and assign it.
5. Sign in as client; view challenge; submit reflection.
6. Sign in as coach; review reflection.
7. Restart the server; sign back in and confirm data remains.
8. Sign in as a different coach; confirm the client and reflection are inaccessible.
9. As client, revoke the relationship; verify the original coach loses access to reflections.

## Release blockers
- No external deployment or real-client data until email verification, hardened CSRF protection, authentication rate limits, password recovery, backups, consent records, secure production secrets, privacy terms, data export/deletion and independent security review are completed.
- This is a SQLite-backed **local** pilot, not a managed production database.
- Existing CI World Apps Script/Sheets and Gemini services remain disconnected from private client records.
