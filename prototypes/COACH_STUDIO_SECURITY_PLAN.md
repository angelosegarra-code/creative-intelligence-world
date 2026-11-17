# Coach Studio — production security and integration plan

## Prototype status
`prototypes/coach-client-journey.html` demonstrates a coach creating and approving a challenge, a client completing a reflection, and a coach reviewing it. It runs entirely in browser memory. The role switch is **not authentication**. Do not use real client information.

## Required before a real client pilot
1. Select a maintained authentication provider with verified email, session expiry, MFA for coaches, and recovery.
2. Create server-side roles: `coach`, `client`, and `admin`. Never trust a client-supplied coach ID or role.
3. Persist `users`, `coach_client_relationships`, `invitations`, `challenges`, `reflections`, `consents`, and `audit_events` in a database with server-enforced per-record authorization.
4. Invitation: single-use random token stored only as a hash, scoped to coach and intended email, short expiry, revocable; require verified recipient and affirmative consent.
5. Coach may see a reflection only if an active relationship and sharing consent exist. Clients can revoke access. Every API read and write must enforce this server-side.
6. Implement export and deletion, retention periods, encryption in transit/at rest, minimal logs, abuse controls and backups.
7. Existing Apps Script / Google Sheets learning endpoints must **not** be called directly with confidential client data from the browser. Build an authenticated backend adapter with strict authorization and data minimization, or migrate storage to a purpose-built private database.
8. Add tests for cross-coach access, guessed client IDs, expired/reused invitation tokens, revoked consent, unauthenticated requests, and reflected HTML injection.
9. Obtain a privacy/security review and coach/client pilot consent before collecting sensitive personal information.

## Suggested API contracts (design only)
- `POST /api/invitations` (coach) → invitation created, no client access yet
- `POST /api/invitations/accept` (verified client) → consented relationship
- `POST /api/challenges` (coach) → draft
- `POST /api/challenges/:id/assign` (owner coach) → assigned
- `GET /api/my/challenges` (client) → only their assigned challenges
- `POST /api/challenges/:id/reflections` (assigned client) → reflection
- `GET /api/clients/:id/reflections` (authorized coach, active consent) → allowed reflections
- `DELETE /api/relationships/:id` → revoke future access

## Release boundary
Do not merge this development branch into `main` or publish client workflows until the security requirements above are implemented and verified. No secrets belong in repository files or client-side JavaScript.
