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
  const tour=await fetch(origin+'/organization-tour');assert.equal(tour.status,200);
  const tourHtml=await tour.text();assert.match(tourHtml,/Jordan · Administrator/);assert.match(tourHtml,/Morgan · Professional/);assert.match(tourHtml,/Casey · Participant/);
  assert.match(tourHtml,/Illustrative walkthrough, not a live account/);
  assert.match(tourHtml,/What the institution gains/);
  assert.match(tourHtml,/Where the model could be piloted/);
  assert.match(tourHtml,/A focused pilot conversation/);
  assert.match(tourHtml,/A responsible first evaluation/);
  assert.match(tourHtml,/Experience the Creative Intelligence learning process/);
  for(const perspective of ['observer','dreamer','alchemist','visionary'])assert.match(tourHtml,new RegExp('data-perspective="'+perspective+'"'));
  assert.match(tourHtml,/Casey.s choice, not the system.s decision/);
  assert.match(tourHtml,/no real participant records/);
  const tourScript=await fetch(origin+'/organization-tour.js');assert.equal(tourScript.status,200);
  assert.match(await tourScript.text(),/data-panel/);
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
  const professionalEmail='fictional-advisor-'+nonce+'@example.test';
  const professionalPassword='advisor-password-'+nonce+'-long';
  const professionalRegistration=await post('/api/register',{email:professionalEmail,password:professionalPassword,role:'coach'});assert.equal(professionalRegistration.status,201);
  const professionalLogin=await post('/api/login',{email:professionalEmail,password:professionalPassword});assert.equal(professionalLogin.status,200);
  const professionalCookie=professionalLogin.headers.get('set-cookie')?.split(';')[0];assert.ok(professionalCookie);
  const denied=await fetch(origin+'/api/organizations/'+org.id+'/members',{headers:{Cookie:professionalCookie}});assert.equal(denied.status,404);
  const accepted=await post('/api/organizations/invitations/accept',{token},professionalCookie);assert.equal(accepted.status,200);
  const duplicate=await post('/api/organizations/invitations/accept',{token},professionalCookie);assert.equal(duplicate.status,403);
  const professionalOrganizations=await fetch(origin+'/api/organizations',{headers:{Cookie:professionalCookie}});assert.equal(professionalOrganizations.status,200);
  assert.equal((await professionalOrganizations.json()).organizations.find(o=>o.id===org.id)?.role,'professional');
  const membersDenied=await fetch(origin+'/api/organizations/'+org.id+'/members',{headers:{Cookie:professionalCookie}});assert.equal(membersDenied.status,403);
  const membersAllowed=await fetch(origin+'/api/organizations/'+org.id+'/members',{headers:{Cookie:cookie}});assert.equal(membersAllowed.status,200);
  assert.equal((await membersAllowed.json()).members.length,2);
  const participantEmail='fictional-participant-'+nonce+'@example.test';
  const participantPassword='participant-password-'+nonce+'-long';
  const participantRegistration=await post('/api/register',{email:participantEmail,password:participantPassword,role:'client'});assert.equal(participantRegistration.status,201);
  const participantLogin=await post('/api/login',{email:participantEmail,password:participantPassword});assert.equal(participantLogin.status,200);
  const participantCookie=participantLogin.headers.get('set-cookie')?.split(';')[0];assert.ok(participantCookie);
  const participantInvitation=await post('/api/organizations/'+org.id+'/participants/invitations',{email:participantEmail},professionalCookie);assert.equal(participantInvitation.status,201);
  const participantToken=(await participantInvitation.json()).invitationToken;
  const wrongAccept=await post('/api/organization-participants/invitations/accept',{token:participantToken},cookie);assert.equal(wrongAccept.status,403);
  const participantAccept=await post('/api/organization-participants/invitations/accept',{token:participantToken},participantCookie);assert.equal(participantAccept.status,200);
  const participantRepeat=await post('/api/organization-participants/invitations/accept',{token:participantToken},participantCookie);assert.equal(participantRepeat.status,403);
  const overview=await fetch(origin+'/api/organizations/'+org.id+'/overview',{headers:{Cookie:cookie}});assert.equal(overview.status,200);
  const counts=await overview.json();assert.equal(counts.summary.professionalAccounts,1);assert.equal(counts.summary.activeParticipantEnrollments,1);
  assert.equal(JSON.stringify(counts).includes(participantEmail),false);
  const overviewDenied=await fetch(origin+'/api/organizations/'+org.id+'/overview',{headers:{Cookie:professionalCookie}});assert.equal(overviewDenied.status,403);
  const caseload=await fetch(origin+'/api/organizations/'+org.id+'/participants',{headers:{Cookie:professionalCookie}});assert.equal(caseload.status,200);
  assert.equal((await caseload.json()).participants[0].email,participantEmail);
  const adminCaseload=await fetch(origin+'/api/organizations/'+org.id+'/participants',{headers:{Cookie:cookie}});assert.equal(adminCaseload.status,200);
  assert.equal((await adminCaseload.json()).participants.length,0);
  const ownEnrollments=await fetch(origin+'/api/organization-participants/mine',{headers:{Cookie:participantCookie}});assert.equal(ownEnrollments.status,200);
  assert.equal((await ownEnrollments.json()).enrollments.length,1);
  const revoke=await post('/api/organization-participants/'+org.id+'/revoke',{},participantCookie);assert.equal(revoke.status,200);
  const revokedOverview=await fetch(origin+'/api/organizations/'+org.id+'/overview',{headers:{Cookie:cookie}});assert.equal(revokedOverview.status,200);
  assert.equal((await revokedOverview.json()).summary.activeParticipantEnrollments,0);
  const logout=await post('/api/logout',{},cookie);assert.equal(logout.status,200);
  const after=await fetch(origin+'/api/organizations',{headers:{Cookie:cookie}});assert.equal(after.status,401);
 }finally{child.kill('SIGTERM');await delay(100)}
});
