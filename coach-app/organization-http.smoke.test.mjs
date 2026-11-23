import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('private organization browser/API smoke flow', {skip:!process.env.CI_ORGANIZATION_TEST_DATABASE_URL,timeout:30000},async()=>{
 const port=32000+Math.floor(Math.random()*1000);
 const origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['postgres-server.mjs'],{
  cwd:new URL('.',import.meta.url).pathname,
  env:{...process.env,PORT:String(port),DATABASE_URL:process.env.CI_ORGANIZATION_TEST_DATABASE_URL,NODE_ENV:'test',RENDER:''},
  stdio:['ignore','pipe','pipe']
 });
 let output='';child.stderr.on('data',d=>output+=String(d).slice(0,300));
 async function ready(){for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Server exited during smoke test');try{const r=await fetch(origin+'/');if(r.ok)return await r.text()}catch{}await delay(100)}throw Error('Server did not start: '+output)}
 async function post(path,data,cookie){return fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)})}
 try{
  const html=await ready();
  assert.match(html,/id="organizationStudio"/);
  assert.match(html,/organizations\.js/);
  const script=await fetch(origin+'/organizations.js');assert.equal(script.status,200);assert.match(await script.text(),/organizationCreate/);
  const nonce=Math.random().toString(36).slice(2);
  const email='org-admin-'+nonce+'@example.test';
  const password='test-password-'+nonce+'-long';
  const registration=await post('/api/register',{email,password,role:'coach'});assert.equal(registration.status,201);
  const login=await post('/api/login',{email,password});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
  const create=await post('/api/organizations',{name:'Fictional Pilot Institution'},cookie);assert.equal(create.status,201);
  const org=await create.json();assert.ok(org.id);
  const listing=await fetch(origin+'/api/organizations',{headers:{Cookie:cookie}});assert.equal(listing.status,200);
  const list=await listing.json();assert.ok(list.organizations.some(o=>o.id===org.id));
  const invite=await post('/api/organizations/'+org.id+'/invitations',{email:'fictional-advisor-'+nonce+'@example.test'},cookie);assert.equal(invite.status,201);
  const token=(await invite.json()).invitationToken;assert.match(token,/^[a-f0-9]{48}$/);
  const logout=await post('/api/logout',{},cookie);assert.equal(logout.status,200);
  const after=await fetch(origin+'/api/organizations',{headers:{Cookie:cookie}});assert.equal(after.status,401);
 }finally{child.kill('SIGTERM');await delay(100)}
});
