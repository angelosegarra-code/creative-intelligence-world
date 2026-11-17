import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createPersistentServer} from './persistent-server.mjs';
test('SQLite records survive restart and revocation hides coach access',async()=>{const dir=mkdtempSync(join(tmpdir(),'ci-coach-')),db=join(dir,'test.sqlite');let server;const start=async()=>{server=createPersistentServer(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port};const stop=async()=>new Promise(r=>server.close(r));let base=await start();const api=async(path,method='GET',body,cookie='')=>{const res=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||''}};try{
for(const [email,role] of [['coach@example.test','coach'],['client@example.test','client'],['other@example.test','coach']])assert.equal((await api('register','POST',{email,role,password:'very-long-demo-password'})).status,201);
const login=async email=>(await api('login','POST',{email,password:'very-long-demo-password'})).cookie;
let coach=await login('coach@example.test'),client=await login('client@example.test'),other=await login('other@example.test');
const inv=await api('invitations','POST',{email:'client@example.test'},coach);assert.equal(inv.status,201);
assert.equal((await api('invitations/accept','POST',{token:inv.data.invitationToken},client)).status,200);
const clientId=(await api('clients','GET',null,coach)).data.clients[0].id;
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
