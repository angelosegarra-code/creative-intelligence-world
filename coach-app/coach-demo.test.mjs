import assert from 'node:assert/strict';
import test from 'node:test';
import {createPostgresAdapter} from './postgres-adapter.mjs';
import {createPostgresPool, migratePostgres} from './postgres-store.mjs';
import {createPostgresServer} from './postgres-server.mjs';

const url = process.env.CI_COACH_TEST_POSTGRES_URL;
test('private demo redemption isolates workspaces and never grants Studio access', {skip:!url}, async t => {
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname));
  process.env.RENDER = 'true';
  process.env.STAGING_ACCESS_USER = 'fictional-admin';
  process.env.STAGING_ACCESS_PASSWORD = 'fictional-example-password';
  const pool = createPostgresPool({connectionString:url});
  await migratePostgres(pool);
  const server = createPostgresServer(createPostgresAdapter(pool));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    delete process.env.RENDER;
    delete process.env.STAGING_ACCESS_USER;
    delete process.env.STAGING_ACCESS_PASSWORD;
  });
  const host = '127.0.0.1:'+server.address().port;
  const origin = 'https://'+host;
  const credentials = 'Basic '+Buffer.from('fictional-admin:fictional-example-password').toString('base64');
  const request = (path, options = {}) => fetch('http://'+host+path,{redirect:'manual',...options});
  async function issue() {
    const response = await request('/demo-invites',{
      method:'POST',headers:{authorization:credentials,origin},body:new URLSearchParams({action:'create'})
    });
    assert.equal(response.status,200);
    const html = await response.text();
    const invite = html.match(/coach-demo#([0-9a-f]{64})/);
    assert.ok(invite,'issued invite link missing');
    return invite[1];
  }
  const redeem = (token,cookie,from=origin) => request('/coach-demo/redeem',{
    method:'POST',headers:{origin:from,'Content-Type':'application/json',...(cookie?{cookie}:{})},
    body:JSON.stringify({token})
  });

  assert.equal((await request('/demo-invites')).status,303);
  const dashboard = await request('/demo-invites',{headers:{authorization:credentials}});
  assert.equal(dashboard.status,200);
  assert.equal(dashboard.headers.get('referrer-policy'),'same-origin');
  assert.equal((await request('/demo-invites',{
    method:'POST',headers:{authorization:credentials,origin:'null'},
    body:new URLSearchParams({action:'create'})
  })).status,403);
  assert.equal((await request('/demo-invites',{method:'POST',body:new URLSearchParams({action:'create'})})).status,401);
  assert.equal((await request('/coach-demo/session')).status,401);
  const page = await request('/coach-demo');
  assert.equal(page.status,200);
  assert.equal(page.headers.get('referrer-policy'),'no-referrer');
  assert.match(await page.text(),/Fictional client view/);

  const first = await issue();
  assert.equal((await redeem(first,undefined,'https://other.example')).status,403);
  const [one,two] = await Promise.all([redeem(first),redeem(first)]);
  assert.deepEqual([one.status,two.status].sort(),[200,401]);
  const opened = one.ok?one:two;
  const {workspace} = await opened.json();
  const setCookie = opened.headers.get('set-cookie');
  assert.match(setCookie,/Path=\/coach-demo; HttpOnly; Secure; SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  assert.equal((await redeem(first,cookie)).status,200);
  assert.equal((await request('/api/journey',{headers:{cookie}})).status,401);
  assert.equal((await request('/coach-demo/complete',{method:'POST',headers:{cookie,origin:'https://other.example'}})).status,403);
  assert.equal((await request('/coach-demo/complete',{method:'POST',headers:{cookie,origin}})).status,200);

  const second = await issue();
  const independent = await redeem(second);
  assert.notEqual((await independent.json()).workspace,workspace);
  assert.equal((await request('/coach-demo/session',{headers:{cookie}})).status,200);
  const revoked = await request('/demo-invites',{
    method:'POST',headers:{authorization:credentials,origin},body:new URLSearchParams({action:'revoke',id:workspace})
  });
  assert.match(await revoked.text(),/Revoked/);
  assert.equal((await request('/coach-demo/session',{headers:{cookie}})).status,401);
});
