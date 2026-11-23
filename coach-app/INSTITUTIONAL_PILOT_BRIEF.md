# CI World Organization Studio — Institutional Pilot Brief
**Status:** proposed fictional-data evaluation; not an offer of a production-ready clinical or educational service.

## The opportunity
Organizations rely on counselors, advisors, facilitators and coaches to help people navigate uncertainty, yet need to preserve participant autonomy and professional judgment. CI World proposes a structured environment for perspective-taking, self-directed action and reflection—not automated decisions about people.

## What the current development prototype demonstrates
- Administrator creates a fictional institution and invites professionals.
- Professional accepts an invitation, invites a fictional participant and sees only their own active enrollments.
- Participant explicitly accepts and can revoke institutional enrollment.
- Administrator sees limited counts of professional accounts, active enrollments and revoked enrollments, not participant identities or private reflections.
- A no-account guided tour switches between administrator, professional and participant views.
- Private individual coaching relationships, profiles and goals are **separate** from institutional enrollment. Organization enrollment does not grant access to those records.
- Automated unit, disposable PostgreSQL integration and three-role HTTP tests have passed. This is not equivalent to a production security review.

## Learning experience shown in the fictional tour
Casey explores a self-chosen learning question through four flexible perspectives: **Observer** (notice evidence), **Dreamer** (imagine possibilities), **Alchemist** (test assumptions), and **Visionary** (choose direction). Casey—not the technology or professional—chooses whether and how to act. The example is static and does not collect answers. This demonstrates the educational approach, not a production institutional goal workflow.

## What is not included
No real participant data, protected health information, student records, veterans' case information, clinical use, regulated decision-making, automated invitation email, institutional SSO, production SLA, formal compliance certification or institution-wide personal coaching analytics. The feature branch has not been deployed. A live isolated pilot requires separate hosting/database approval, operational controls and a privacy review.

## Suggested pilot structure — proposal, not a commitment
**Phase 0: Discovery (one conversation).** Identify a non-clinical learning problem, intended adult users, success criteria and safeguarding/privacy requirements. Demonstrate the fictional tour.

**Phase 1: Fictional workflow evaluation (1–2 weeks, indicative).** One institutional sponsor and one or two professionals review the guided tour, invitation sequence, consent, revocation and administrator overview using fictional identities only. No live participant onboarding.

**Phase 2: Decision gate.** Collect feedback on clarity, fit and missing controls. Decide whether a separately scoped, funded and privacy-reviewed live pilot is justified. No automatic transition to real records.

**Possible future Phase 3 (not yet offered):** A small, voluntary, non-clinical live cohort after isolated deployment, legal/privacy review, data retention and deletion design, incident response, consent documentation and role-based access review.

## Evaluation questions
1. Does the institution have a concrete use case where perspective-taking and self-directed action add value?
2. Can the professional explain the invitation and participant consent process without assistance?
3. Does the participant understand enrollment, separate coaching permissions and revocation?
4. Does the administrator get sufficient operational visibility without personal reflection data?
5. Which capabilities or safeguards are required before real use?

**Evidence:** Qualitative structured feedback from fictional walkthrough participants; completion of scripted tasks; a prioritized list of product and governance gaps. Do not claim improved learner outcomes or therapeutic benefit based on this exercise.

## Commercial conversation
This is a **discovery and fictional-prototype evaluation**, not a production license. Pricing, pilot duration, hosting and responsibilities should be agreed only after scope and safeguards are understood. No additional Render infrastructure has been purchased for this branch.

## Suggested 15-minute demonstration
- **0–2 min:** Problem and why preserving human judgment matters
- **2–6 min:** Administrator, professional and participant perspectives
- **6–9 min:** Invitation, consent, revocation and privacy boundary
- **9–12 min:** One institutional use case and its success criteria
- **12–15 min:** Feedback, requirements and decision on a controlled next step

## A question to close with
“Where in your organization would a professional benefit from helping people explore options and make their own next decision—and what would you need to see before testing that responsibly?”

## Technical reference
Private development route: `/organization-tour` on the feature branch. See `ORGANIZATION_PREVIEW_RELEASE.md` for release gates. The public static fictional demonstration may be used for orientation, but should not be represented as a live institutional platform.
