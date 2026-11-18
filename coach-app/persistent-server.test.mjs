import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPersistentServer} from './persistent-server.mjs';
test('SQLite records survive restart and revocation hides coach access',async()=>{const dir=mkdtempSync(join(tmpdir(),'ci-coach-')),db=join(dir,'test.sqlite');let server;const start=async()=>{server=createPersistentServer(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port};const stop=async()=>new Promise(r=>server.close(r));let base=await start();const api=async(path,method='GET',body,cookie='')=>{const res=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||''}};try{
for(const [email,role] of [['coach@example.test','coach'],['client@example.test','client'],['other@example.test','coach']])assert.equal((await api('register','POST',{email,role,password:'very-long-demo-password'})).status,201);
const login=async email=>(await api('login','POST',{email,password:'very-long-demo-password'})).cookie;
let coach=await login('coach@example.test'),client=await login('client@example.test'),other=await login('other@example.test');
const inv=await api('invitations','POST',{email:'client@example.test'},coach);assert.equal(inv.status,201);
assert.equal((await api('invitations/accept','POST',{token:inv.data.invitationToken},client)).status,200);
const clientId=(await api('clients','GET',null,coach)).data.clients[0].id;
assert.equal((await api('perspectives','GET',null,coach)).data.perspectives.length,4);
assert.equal((await api('challenge-drafts','POST',{focus:'a difficult decision',perspective:'observer'},client)).status,403);
const draft=await api('challenge-drafts','POST',{focus:'a difficult decision',perspective:'observer'},coach);
assert.equal(draft.status,200);assert.match(draft.data.draft,/What do you notice/);
assert.deepEqual((await api('learning-loop','GET',null,client)).data.stages,['Discover','Explore','Challenge','Experiment','Learn']);
assert.equal((await api('challenges','POST',{clientId,text:'Not allowed'},other)).status,403);
const challenge=await api('challenges','POST',{clientId,text:'Reflect on change'},coach);assert.equal(challenge.status,201);
assert.equal((await api('challenges/'+challenge.data.id+'/reflections','POST',{text:'I tried a new idea'},client)).status,201);
await stop();base=await start();coach=await login('coach@example.test');client=await login('client@example.test');other=await login('other@example.test');
assert.equal((await api('reflections','GET',null,coach)).data.reflections.length,1);
assert.equal((await api('reflections','GET',null,other)).data.reflections.length,0);
const coachId=(await api('me','GET',null,coach)).data.id;
assert.equal((await api('relationships/revoke','POST',{coachId},client)).status,200);
assert.equal((await api('reflections','GET',null,coach)).data.reflections.length,0);
assert.equal((await api('challenges/'+challenge.data.id+'/reflections','POST',{text:'No longer shared'},client)).status,403);
}finally{if(server.listening)await stop();rmSync(dir,{recursive:true,force:true})}});

test('Render staging authenticates browser API calls without repeating Basic credentials',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ci-coach-staging-'));
  const previousEnv={
    RENDER:process.env.RENDER,
    STAGING_ACCESS_USER:process.env.STAGING_ACCESS_USER,
    STAGING_ACCESS_PASSWORD:process.env.STAGING_ACCESS_PASSWORD
  };
  let server;
  t.after(async()=>{
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    for(const [key,value] of Object.entries(previousEnv)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
    rmSync(dir,{recursive:true,force:true});
  });
  const start=async()=>{
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    server=createPersistentServer(join(dir,'test.sqlite'));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    return 'http://127.0.0.1:'+server.address().port;
  };

  process.env.RENDER='true';
  delete process.env.STAGING_ACCESS_USER;
  delete process.env.STAGING_ACCESS_PASSWORD;
  let base=await start();
  assert.equal((await fetch(base+'/')).status,503);
  assert.equal((await fetch(base+'/api/me')).status,503);

  process.env.STAGING_ACCESS_USER='fictional-staging-user';
  process.env.STAGING_ACCESS_PASSWORD='fictional-staging-password';
  base=await start();
  const authorization='Basic '+Buffer.from(
    process.env.STAGING_ACCESS_USER+':'+process.env.STAGING_ACCESS_PASSWORD
  ).toString('base64');
  const demoAccount={email:'staging-coach@example.test',role:'coach',password:'fictional-account-password'};
  const post=(path,data,cookie='')=>fetch(base+'/api/'+path,{
    method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)
  });
  const lockedPage=await fetch(base+'/');
  assert.equal(lockedPage.status,401);
  assert.match(lockedPage.headers.get('www-authenticate'),/^Basic /);
  assert.equal(lockedPage.headers.get('set-cookie'),null);
  assert.equal((await fetch(base+'/app.js')).status,401);
  const lockedApi=await post('register',demoAccount);
  assert.equal(lockedApi.status,401);
  assert.equal(lockedApi.headers.get('www-authenticate'),null);
  assert.match((await lockedApi.json()).error,/Staging access denied/);
  const invalid=await fetch(base+'/',{headers:{authorization:'Basic '+Buffer.from(
    process.env.STAGING_ACCESS_USER+':fictional-staging-passwore'
  ).toString('base64')}});
  assert.equal(invalid.status,401);

  const unlockedPage=await fetch(base+'/',{headers:{authorization}});
  assert.equal(unlockedPage.status,200);
  const setCookie=unlockedPage.headers.get('set-cookie');
  assert.match(setCookie,/^__Host-ci_coach_staging=/);
  for(const flag of ['Path=/','Max-Age=28800','Secure','HttpOnly','SameSite=Strict']){
    assert.ok(setCookie.split('; ').includes(flag));
  }
  assert.doesNotMatch(setCookie,/Domain=/i);
  const stagingCookie=setCookie.split(';')[0];
  const staleSignature=stagingCookie.slice(0,-1)+(stagingCookie.endsWith('0')?'1':'0');
  assert.equal((await post('register',demoAccount,staleSignature)).status,401);
  assert.equal((await fetch(base+'/app.js',{headers:{cookie:stagingCookie}})).status,200);
  const signedOut=await fetch(base+'/api/me',{headers:{cookie:stagingCookie}});
  assert.equal(signedOut.status,401);
  assert.equal((await signedOut.json()).error,'Sign in required');
  assert.equal((await post('register',demoAccount,stagingCookie)).status,201);
  const login=await post('login',demoAccount,stagingCookie);
  assert.equal(login.status,200);
  const accountCookie=login.headers.get('set-cookie').split(';')[0];
  assert.match(await (await fetch(base+'/api/me',{headers:{cookie:accountCookie}})).text(),/Staging access denied/);
  const combinedCookies=stagingCookie+'; '+accountCookie;
  const me=await fetch(base+'/api/me',{headers:{cookie:combinedCookies}});
  assert.equal(me.status,200);
  assert.equal((await me.json()).email,demoAccount.email);
  const logout=await post('logout',{},combinedCookies);
  assert.equal(logout.status,200);
  assert.match(logout.headers.get('set-cookie'),/^ci_coach_sid=;/);
  assert.equal((await fetch(base+'/app.js',{headers:{cookie:stagingCookie}})).status,200);

  const future=Date.now()+9*60*60*1000;
  const clock=t.mock.method(Date,'now',()=>future);
  try{
    assert.equal((await fetch(base+'/app.js',{headers:{cookie:stagingCookie}})).status,401);
  }finally{clock.mock.restore()}

  process.env.STAGING_ACCESS_PASSWORD='rotated-fictional-staging-password';
  base=await start();
  assert.equal((await fetch(base+'/app.js',{headers:{cookie:stagingCookie}})).status,401);
  assert.equal((await fetch(base+'/',{headers:{authorization}})).status,401);
});
