# CI World Coach Studio

Run the private development workspace with Node.js 22.13 or later.

```sh
cd coach-app
npm test
npm run start:persistent
```

Open http://127.0.0.1:3100. Use fictional accounts. A client can bring in a CI Profile summary and work through goals, perspectives, challenges, experiments, reflections and learning independently. The coach creates an invitation token, the client accepts it, and the client chooses which profile or goal to share. The original pilot tools remain available for existing challenge and reflection records.

The persistent server uses SQLite. It reads `CI_COACH_DB_PATH` when set and defaults to `../.local/coach.sqlite`. A restart on the same disk preserves records. A deployment that replaces the filesystem can discard them. The Render development service requires staging sign-in and a separate app account.

See [Creative Intelligence integration](CREATIVE_INTELLIGENCE_INTEGRATION.md) for the production flow, consent boundaries and remaining work before real-client use. Private workspace content stays within Coach Studio. The existing public quiz opens separately and receives no workspace parameters.
