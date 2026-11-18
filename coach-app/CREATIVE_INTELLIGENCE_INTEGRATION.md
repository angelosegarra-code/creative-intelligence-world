# Creative Intelligence in Coach Studio

## Existing architecture

| Area | Existing implementation | Reuse in private staging |
| --- | --- | --- |
| Profile generation | `free-creative-profile.html` embeds the existing Inner Cube Tally quiz. `profile.html` describes the paid Stripe → InnerCube questions → Gemini → email report flow. The repository README describes Tally, Google Sheets, Gemini and Gmail. The repository does not contain the production interpreter, mail automation, or an authenticated profile retrieval contract. | Open the existing quiz or profile page by explicit navigation. The client can bring their delivered profile summary and reported perspectives into their account. Retain the existing generator as the source. |
| Perspectives | The public profile page describes imagination/Dreamer, awareness/Observer, transformation/Alchemist and direction/Visionary. The personal goal pages store the primary and secondary starting perspectives in browser storage. Coach Studio already serves four perspective questions. | Use the existing Studio questions as prompts available for every goal. Profile perspectives are reported starting points and all four remain available. |
| Individual coaching | `personal-challenge.html` captures goal, why it matters and uncertainty in `creativeIntelligencePersonalChallenge`. `personal-coach.html` collects possibility, small action and what to notice, sends those fields with goal context through Apps Script's `personalCoach` operation, and renders reflection, next step, rationale and a question. | Retain the same goal context and experiment prompts in the authenticated workspace. Apply the Studio's existing deterministic perspective prompts. |
| Team experiments and outcomes | `decision-experiment.html` records decision, hypothesis, experiment, signals, assumptions and review date. `outcome-learning.html` records result, evidence, surprises, changed understanding and possibilities. The pages use challenge/iteration keys, browser backup and Apps Script/Sheets. | Reuse the learning sequence and questions. The team endpoints and browser storage are outside the private client boundary. |
| Private Coach Studio | `persistent-server.mjs` uses SQLite, staging authentication and account sessions. Invitations are email-bound and acceptance creates a revocable coach–client relationship. The app stores challenges and reflections and provides an editable deterministic draft. | Keep the authentication, relationships, challenge and reflection records. Add goal links, journey records and explicit sharing on top. |

This review is based on repository code and its documentation. Production services were not queried with client information.

## Private journey

**Profile → Goal → Perspectives → Challenge → Experiment → Reflection → Learning**

A client can use the workspace independently. Existing profile results are brought in as client-entered summaries with reported perspectives. Goal refinement, perspective notes and learning conclusions are recorded over time. Challenges and reflections use the existing tables, with new links to goals and experiments. Legacy records retain their existing access rules and remain available in the original pilot views.

An accepted invitation establishes the relationship. Sharing a profile or an individual goal is a separate client action for a named coach. A shared goal includes its existing and future journey activity. Coaches can review that activity and assign a next challenge. Clients decide which experiments to run and what they learned. Turning off a grant removes the coach's goal or profile access. Revoking the relationship removes all journey grants for that coach, including if the relationship is later restored.

## Before real-client use

- Add a documented, authenticated, consent-based profile handoff if automatic syncing is desired. Validate the production generator and processing contracts before connecting them.
- Plan managed persistent storage, backups, recovery testing, retention and data export/deletion. Development SQLite survives a process reopen on the same disk. The Render development service has no persistent volume guarantee across deploys.
- Verify identity and client ownership of imported reports, review session and consent controls, and complete an independent privacy and security review before introducing real records.
