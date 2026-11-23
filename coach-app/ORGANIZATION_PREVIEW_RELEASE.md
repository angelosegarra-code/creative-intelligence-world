# Institutional Coach Studio — private preview release checklist

Status: development branch only. This is not a public institutional offering.

## Current architecture
- Static public institutional demonstration: `coach-studio-organizations-demo.html` on the main website, fictional data only.
- Private Coach Studio Node app: `coach-app/postgres-server.mjs` on Render.
- Organization endpoints: `coach-app/organization-routes.mjs` and `organization-accept.mjs`.
- Additive PostgreSQL schema: `coach-app/db/organizations.sql` loaded by `migratePostgres`.
- All institutional records currently share the private pilot database with existing coach accounts. Organization membership is not yet connected to participant relationships.

## Verified by automated CI
- SQL migration, creation, and invitation lifecycle using disposable PostgreSQL.
- Distinct admin/professional account authorization, token expiry/reuse checks.
- HTTP server smoke test for sign-in, organization creation, invitation, membership and sign-out.
- Existing Coach Studio development tests.

## Before a hosted private preview
1. **Choose an isolated Render service and isolated PostgreSQL database.** Never point the preview at the existing private Coach Studio pilot database.
2. Configure the service from branch `feature/organization-workspaces-v1` with repository root `coach-app/`, build `npm ci --omit=dev`, start `npm run start:postgres`, runtime Node 22+, and plan approved by the account owner.
3. Configure `DATABASE_URL` from the new private preview database. Do not paste secrets into GitHub, PR comments, or chat.
4. Configure unique `STAGING_ACCESS_USER` and a strong `STAGING_ACCESS_PASSWORD` (minimum 20 characters). The server fails closed on Render if these are absent.
5. Configure `NODE_ENV=production` for secure session cookies. Verify TLS, account registration, session isolation, staging access, and no sensitive values in logs.
6. Use only fictional accounts. Never collect protected health, educational, or veterans' case records in this pilot.
7. Manually run the administrator/professional two-browser walkthrough. Check that professional access never reveals admin-only membership and private participant data is absent.
8. Confirm database lifecycle and backup strategy before inviting outside testers. The current free Render pilot database has a scheduled expiration date.
9. Obtain explicit approval before promoting the feature branch into the existing Coach Studio deployment.

## Manual walkthrough
1. Sign into staging access, then register fictional admin as Coach and sign in.
2. Under Organization Studio, create "Creative Learning Center".
3. Invite a fictional advisor's email and copy the 24-hour token.
4. Sign out, register the fictional advisor as Coach, sign in and accept token.
5. Open the organization as advisor; ensure role is professional and admin member list is hidden.
6. Sign back in as admin; confirm both members listed.
7. Attempt token reuse and unauthorized organization lookup; both must fail.
8. Confirm existing individual coach journey remains functional.

## Not yet implemented
- Automatic invitation email delivery, password reset and account verification.
- Participant-to-organization enrollment and scoped caseloads.
- Aggregate program reports with privacy thresholds and consent controls.
- Tenant isolation for all existing coaching and journey endpoints.
- Clinical compliance, institutional procurement/security review, production support.

Do not call this a live institutional platform until these limitations are addressed.
