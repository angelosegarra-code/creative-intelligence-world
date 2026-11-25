# Institutional Coach Studio — private preview release checklist

Status: development branch only. This is not a public institutional offering.

## Current architecture
- Static public institutional demonstration: `coach-studio-organizations-demo.html` on the main website, fictional data only.
- Private Coach Studio Node app: `coach-app/postgres-server.mjs` on Render.
- Organization endpoints: `coach-app/organization-routes.mjs` and `organization-accept.mjs`.
- Additive PostgreSQL schema: `coach-app/db/organizations.sql` loaded by `migratePostgres`.
- The institutional feature branch is not deployed. When deployed, it requires a separate preview database and service to protect the existing pilot.
- Institutional participant enrollment and professional-specific caseloads are implemented as separate, consent-bound records. They do not automatically create private coach-client relationships.

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
7. Manually run the administrator/professional/participant three-browser walkthrough. Check that professional access never reveals admin-only membership and private participant data is absent.
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
- Broader aggregate program reports with privacy thresholds, explicit evaluation consent and suppression of small cohorts. The current admin overview only provides basic enrollment counts.
- Institutional program outcomes and any participant-approved reporting.
- Tenant isolation for all existing coaching and journey endpoints.
- Clinical compliance, institutional procurement/security review, production support.

Do not call this a live institutional platform until these limitations are addressed.

## Three-role guided institutional walkthrough (fictional)
**Institution:** Creative Learning Center. **Administrator:** Jordan (operations lead). **Professional:** Morgan (learning advisor). **Participant:** Casey (adult learner). All emails and data must be fictional.

1. Jordan registers a demo coach account and creates Creative Learning Center. Jordan sees the organization overview (initially zero professional accounts and zero participants).
2. Jordan invites Morgan's demo coach email using the one-time token. Morgan signs in and accepts. Jordan's overview now shows one professional account.
3. Morgan opens Creative Learning Center, invites Casey's fictional client email and shares the one-time token. Jordan cannot see Morgan's participant list.
4. Casey signs in as a client, reviews the institutional enrollment notice, and explicitly accepts. Casey sees Creative Learning Center and Morgan's demo email in My institutional enrollment.
5. Morgan's caseload shows Casey's fictional email. Jordan's overview shows one active enrollment but **not Casey's identity or personal work**.
6. Casey revokes enrollment. Morgan's caseload no longer shows Casey, and Jordan's active count returns to zero. No organization route grants access to private goals, profiles or reflections.
7. Repeat with another professional to verify that each sees only their own enrolled participants. The same participant cannot be silently reassigned between professionals.

**Sales demonstration wording:** “Organizations can invite professionals and track enrollment counts. Participants choose whether to enroll and may revoke that enrollment. Private coaching content is not included in institutional reporting.”

**Limitations:** This is a fictional proof of concept, not a compliance-certified production service. Institutional enrollment does not automatically establish an individual coach-client relationship or share a Creative Intelligence profile or goal. Those remain separate, explicit actions.

## Partner-facing walkthrough
The private `/organization-tour` page is a fictional, no-account guided presentation. It explains the organizational problem, the three roles, limited participation reporting, example settings and a controlled pilot discussion. It is **not** a live product demo and contains no personal data, API calls or persistence. The route remains behind the existing Render staging gate when deployed. Never suggest that the static sample counts are measured outcomes.
