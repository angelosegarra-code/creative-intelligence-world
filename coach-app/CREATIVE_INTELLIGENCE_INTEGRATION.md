# Creative Intelligence integration — phase 1

The persistent development server now provides:
- `GET /api/perspectives`: the four flexible Creative Intelligence thinking perspectives.
- `POST /api/challenge-drafts`: authenticated coach-only, deterministic challenge drafting from a focus and perspective. **Does not call Gemini** and **does not assign automatically**.
- `GET /api/learning-loop`: Discover → Explore → Challenge → Experiment → Learn and reflection prompts.
- Existing authenticated challenge assignment and reflection APIs remain the workflow of record.

The pilot UI offers a perspective selector and learning focus, places the generated draft in the editable challenge field, and requires the coach to explicitly assign it. The client can then submit a reflection.

## Future connection to the existing CI World services

Existing production Apps Script/Sheets workflows are separate and must not receive client data from this prototype. Before adding Gemini or existing services:
1. Verify service endpoint ownership, current request/response schema, and whether the provider processes/stores submitted information.
2. Build a server-only adapter with credentials from secret management; never expose API keys or Apps Script write endpoints in browser JavaScript.
3. Apply coach/client authorization, explicit consent and data minimization before sending any data externally.
4. Keep coach approval mandatory for generated suggestions; do not imply the model makes decisions for clients.
5. Add contract tests with mocked responses, timeouts, retry limits, and safe fallbacks.
6. Run automated tests and a privacy/security review before a real-client pilot.

**Status:** Source code committed on development branch; not deployed or independently executed in this session.
