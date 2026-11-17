# CI World Coach App — Local API Pilot

Run with Node.js 20+:

```sh
cd coach-app
npm test
npm start
```

Open http://127.0.0.1:3100 on the same computer. Create fictional coach and client accounts. The coach generates a token, the client signs in and accepts it, the coach assigns a challenge, and the client submits a reflection for review. Revoking the relationship blocks further coach access to reflections.

**Development only. Never expose this server to the public internet or enter real client data.** Data lives only in process memory and disappears on restart. There is no email verification, MFA, durable storage, password recovery, durable audit trail, or production deployment. CSRF/origin protection, stronger rate limiting, persistent storage and backups, secure email invitations, consent records, data deletion/export, and a security review are required before any real pilot.

The existing CI World Apps Script / Sheets workflows are not yet integrated; client information must not be sent directly to those endpoints.
