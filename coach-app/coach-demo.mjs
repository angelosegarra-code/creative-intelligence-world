import {createHash, randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const tokenPattern = /^[0-9a-f]{64}$/;
const cookieName = '__Secure-ci_coach_demo';
const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
function sessionHash(req) {
  const session = (req.headers.cookie || '').split(';').map(part=>part.trim())
    .find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  return session && tokenPattern.test(session) ? digest(session) : '';
}
const assets = new Map([
  ['/coach-demo', ['coach-demo.html', 'text/html; charset=utf-8']],
  ['/coach-demo/app.js', ['coach-demo.js', 'text/javascript; charset=utf-8']],
  ['/coach-demo/style.css', ['coach-demo.css', 'text/css; charset=utf-8']]
]);
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => (
  {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]
));

export function createCoachDemo({q, all, run, input, reply}) {
  async function publicRoute(req, res, path, origin) {
    const method = req.method;
    const asset = assets.get(path);
    if (method === 'GET' && asset) {
      const data = await readFile(new URL(asset[0], import.meta.url));
      res.writeHead(200, {...headers, 'Content-Type':asset[1]});
      return res.end(data);
    }
    if (method === 'POST' && req.headers.origin !== origin) {
      return reply(res, 403, {error:'Open the demo directly and try again.'});
    }
    if (method === 'POST' && path === '/coach-demo/redeem') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(res, 415, {error:'JSON required'});
      let body;
      try { body = await input(req); } catch { return reply(res, 400, {error:'Invalid demo link.'}); }
      if (typeof body?.token !== 'string' || !tokenPattern.test(body.token)) {
        return reply(res, 400, {error:'Invalid demo link.'});
      }
      const session = token();
      const invite = await q(
        'UPDATE coach_demo_invites SET session_hash=?, redeemed_at=CURRENT_TIMESTAMP WHERE invite_hash=? AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING id, expires_at',
        digest(session), digest(body.token)
      );
      if (!invite) {
        const original = await q('SELECT id FROM coach_demo_invites WHERE invite_hash=? AND session_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP',
          digest(body.token), sessionHash(req));
        if (original) return reply(res, 200, {workspace:original.id});
        return reply(res, 401, {error:'This link has expired or was already used. Ask for a fresh link if needed.'});
      }
      const remaining = Math.max(1, Math.floor((new Date(invite.expires_at).getTime()-Date.now())/1000));
      return reply(res, 200, {workspace:invite.id}, {
        'Set-Cookie':cookieName+'='+session+'; Path=/coach-demo; HttpOnly; Secure; SameSite=Strict; Max-Age='+remaining
      });
    }
    if ((method === 'GET' && path === '/coach-demo/session') || (method === 'POST' && path === '/coach-demo/complete')) {
      const hash = sessionHash(req);
      const live = 'session_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP';
      const invite = method === 'GET'
        ? await q('SELECT id FROM coach_demo_invites WHERE '+live, hash)
        : await q('UPDATE coach_demo_invites SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP) WHERE '+live+' RETURNING id', hash);
      if (!invite) return reply(res, 401, {error:'Open the private demo link supplied by Creative Intelligence World.'});
      return reply(res, 200, {workspace:invite.id});
    }
    return reply(res, 404, {error:'Not found'});
  }

  async function adminRoute(req, res, origin) {
    let link = '';
    if (req.method === 'POST') {
      if (req.headers.origin !== origin) return reply(res, 403, {error:'Origin rejected'});
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') return reply(res, 415, {error:'Form required'});
      const body = await input(req, true);
      if (body.action === 'create') {
        const invite = token();
        await run("INSERT INTO coach_demo_invites(id,invite_hash,expires_at) VALUES (?,?,CURRENT_TIMESTAMP+INTERVAL '7 days')",
          randomBytes(12).toString('hex'), digest(invite));
        link = origin+'/coach-demo#'+invite;
      } else if (body.action === 'revoke' && /^[0-9a-f]{24}$/.test(body.id)) {
        await run('UPDATE coach_demo_invites SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP), session_hash=NULL WHERE id=?', body.id);
      } else {
        return reply(res, 400, {error:'Invalid demo action'});
      }
    } else if (req.method !== 'GET') {
      return reply(res, 405, {error:'Method not allowed'});
    }
    const invites = await all(`SELECT id, expires_at, redeemed_at, completed_at, revoked_at,
      expires_at<=CURRENT_TIMESTAMP AS expired FROM coach_demo_invites ORDER BY created_at DESC LIMIT 50`);
    const rows = invites.map(invite => {
      const status = invite.revoked_at ? 'Revoked' : invite.expired ? 'Expired'
        : invite.completed_at ? 'Completed' : invite.redeemed_at ? 'Opened' : 'Ready';
      const revoke = invite.revoked_at || invite.expired ? '' : `<form method="post"><input type="hidden" name="id" value="${escapeHtml(invite.id)}"><button name="action" value="revoke">Revoke</button></form>`;
      return `<tr><td>${escapeHtml(invite.id.slice(0,8))}</td><td>${status}</td><td>${escapeHtml(new Date(invite.expires_at).toISOString().slice(0,10))} UTC</td><td>${revoke}</td></tr>`;
    }).join('');
    res.writeHead(200, {...headers, 'Content-Type':'text/html; charset=utf-8'});
    return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coach demo invitations</title><link rel="stylesheet" href="/coach-demo/style.css"><main>
      <a href="/">Back to Coach Studio</a><h1>Coach demo invitations</h1>
      <p>Create one link per tester. Each link opens one fictional workspace in the first browser that uses it and expires after seven days.</p>
      <form method="post"><button name="action" value="create">Create private demo link</button></form>
      ${link ? `<label>Copy and send this link<input readonly value="${escapeHtml(link)}"></label><p>Copy it now. The full link is shown only once.</p>` : ''}
      <h2>Recent invitations</h2><table><thead><tr><th>Invite ID</th><th>Status</th><th>Expires</th><th>Access</th></tr></thead><tbody>${rows}</tbody></table>
      </main></html>`);
  }
  return {publicRoute, adminRoute};
}
