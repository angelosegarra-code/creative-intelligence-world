import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';

const databaseUrl=process.env.CI_ORGANIZATION_TEST_DATABASE_URL;

// Consume child output but only report recognized stages and error codes.
async function startSmokeServer(t,connectionString=databaseUrl){
 const child=spawn(process.execPath,['postgres-server.mjs'],{
  cwd:fileURLToPath(new URL('.',import.meta.url)),
  env:{...process.env,PORT:'0',DATABASE_URL:connectionString,NODE_ENV:'test',RENDER:''},
  stdio:['ignore','pipe','pipe']
 });
 const closed=once(child,'close').catch(()=>[]);
 t.after(async()=>{
  if(child.exitCode===null&&child.signalCode===null)child.kill();
  await closed;
 });
 let stage='before schema verification';
 let diagnostic='';
 let timer;
 const port=await new Promise((resolve,reject)=>{
  createInterface({input:child.stdout}).on('line',line=>{
   if(line==='Coach Studio PostgreSQL schema verified.')stage='after schema verification';
   const ready=/^PostgreSQL coach pilot listening on port (\d+)$/.exec(line);
   if(ready)resolve(Number(ready[1]));
  });
  createInterface({input:child.stderr}).on('line',line=>{
   const failure=/^Coach Studio PostgreSQL startup failed \((configuration|migration|listen)\): ([A-Z0-9_]{2,32})$/.exec(line);
   if(failure)diagnostic=failure[1]+' '+failure[2];
   if(/^SyntaxError:/.test(line))diagnostic='JavaScript syntax error during module loading';
  });
  const fail=reason=>reject(new Error('Smoke server '+reason+' ('+stage+(diagnostic?', '+diagnostic:'')+')'));
  child.once('error',()=>fail('could not launch'));
  closed.then(([code,signal])=>fail('closed with '+(signal??'exit code '+code)));
  timer=setTimeout(()=>fail('timed out waiting for its listening port'),12000);
 }).finally(()=>clearTimeout(timer));
 return 'http://127.0.0.1:'+port;
}

test('HTTP startup diagnostics identify invalid configuration without logging input',async t=>{
 const marker='fictional-secret-marker';
 await assert.rejects(startSmokeServer(t,marker),error=>{
  assert.match(error.message,/closed with exit code 1.*configuration ERR_INVALID_URL/);
  assert.ok(!error.message.includes(marker));
  return true;
 });
});

test('private organization browser/API smoke flow', {skip:!databaseUrl,timeout:30000},async t=>{
 const origin=await startSmokeServer(t);
 const get=(path,cookie)=>fetch(origin+path,{headers:{Cookie:cookie}});
 async function json(response,expected,label){
  const result=await response;
  assert.equal(result.status,expected,label);
  return result.json();
 }
 async function post(path,data,cookie){return fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)})}
  const page=await fetch(origin+'/',{signal:AbortSignal.timeout(3000)});
  assert.equal(page.status,200);
  const html=await page.text();
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
  assert.match(tourHtml,/From a personal goal to independent learning/);
  for(const stage of ['goal','share','question','reflect','adapt','withdraw']){assert.ok(tourHtml.includes('data-exchange="'+stage+'"'));assert.ok(tourHtml.includes('data-exchange-panel="'+stage+'"'));}
  assert.match(tourHtml,/Previously seen information cannot be recalled/);
  const tourScript=await fetch(origin+'/organization-tour.js');assert.equal(tourScript.status,200);
  const tourJs=await tourScript.text();assert.match(tourJs,/data-panel/);assert.match(tourJs,/data-exchange-panel/);
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
  assert.equal((await post('/api/organizations/'+org.id+'/participants/invitations',{email:participantEmail},cookie)).status,403);
  const ownEnrollments=await fetch(origin+'/api/organization-participants/mine',{headers:{Cookie:participantCookie}});assert.equal(ownEnrollments.status,200);
  assert.equal((await ownEnrollments.json()).enrollments.length,1);
  const privateNote=await post('/api/organization-learning/'+org.id+'/notes',{perspective:'observer',goal:'Explore a new skill',nextAction:'Try one small learning experiment'},participantCookie);assert.equal(privateNote.status,201);
  const initiallyShared=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:professionalCookie}});assert.equal(initiallyShared.status,200);assert.equal((await initiallyShared.json()).notes.length,0);
  const noteId=(await privateNote.json()).id;
  const share=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/share',{},participantCookie);assert.equal(share.status,200);
  const shared=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:professionalCookie}});assert.equal(shared.status,200);
  const sharedData=await shared.json();assert.equal(sharedData.notes.length,1);assert.equal(sharedData.notes[0].goal,'Explore a new skill');assert.equal('reflection' in sharedData.notes[0],false);
  const adminShared=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:cookie}});assert.equal(adminShared.status,200);assert.equal((await adminShared.json()).notes.length,0);
  const feedbackPost=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/feedback',{question:'What did you notice when you tried this?'},professionalCookie);assert.equal(feedbackPost.status,201);
  const adminFeedback=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/feedback',{question:'Unauthorized'},cookie);assert.equal(adminFeedback.status,404);
  const participantFeedback=await fetch(origin+'/api/organization-learning/'+org.id+'/notes/'+noteId+'/feedback',{headers:{Cookie:participantCookie}});assert.equal(participantFeedback.status,200);assert.equal((await participantFeedback.json()).feedback[0].question,'What did you notice when you tried this?');
  const reflectionPath='/api/organization-learning/'+org.id+'/notes/'+noteId+'/reflection';
  assert.equal((await post(reflectionPath,{reflection:'I discovered a new possibility.'},participantCookie)).status,200);
  assert.equal((await post(reflectionPath,{reflection:'Unauthorized edit'},professionalCookie)).status,403);
  assert.equal((await post(reflectionPath,{reflection:'Unauthorized edit'},cookie)).status,403);
  const reflected=await fetch(origin+'/api/organization-learning/'+org.id+'/notes',{headers:{Cookie:participantCookie}});
  assert.equal((await reflected.json()).notes[0].reflection,'I discovered a new possibility.');
  const stillShared=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:professionalCookie}});
  assert.equal(JSON.stringify(await stillShared.json()).includes('I discovered a new possibility.'),false);
  const unshare=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/unshare',{},participantCookie);assert.equal(unshare.status,200);
  const afterUnshareFeedback=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/feedback',{question:'Not permitted'},professionalCookie);assert.equal(afterUnshareFeedback.status,404);
  const afterUnshare=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:professionalCookie}});assert.equal((await afterUnshare.json()).notes.length,0);
  const reshare=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/share',{},participantCookie);assert.equal(reshare.status,200);
  const ownNotes=await fetch(origin+'/api/organization-learning/'+org.id+'/notes',{headers:{Cookie:participantCookie}});assert.equal(ownNotes.status,200);
  assert.equal((await ownNotes.json()).notes[0].goal,'Explore a new skill');
  const coachNotes=await fetch(origin+'/api/organization-learning/'+org.id+'/notes',{headers:{Cookie:professionalCookie}});assert.equal(coachNotes.status,403);
  const adminNotes=await fetch(origin+'/api/organization-learning/'+org.id+'/notes',{headers:{Cookie:cookie}});assert.equal(adminNotes.status,403);
  const orgPath='/api/organizations/'+org.id;
  const learningPath='/api/organization-learning/'+org.id;
  async function register(name,role){
   const email=name+'-'+nonce+'@example.test';
   const password='fictional-test-'+nonce+'-password';
   assert.equal((await post('/api/register',{email,password,role})).status,201);
   const response=await post('/api/login',{email,password});
   assert.equal(response.status,200);
   const session=response.headers.get('set-cookie')?.split(';')[0];
   assert.ok(session);
   return {email,session};
  }
  const secondAdvisor=await register('second-advisor','coach');
  const advisorInvite=await json(post(orgPath+'/invitations',{email:secondAdvisor.email},cookie),201,'second advisor invitation');
  assert.equal((await post('/api/organizations/invitations/accept',{token:advisorInvite.invitationToken},secondAdvisor.session)).status,200);
  const advisors=[{email:professionalEmail,session:professionalCookie},secondAdvisor];
  const participants=[{email:participantEmail,session:participantCookie,advisor:advisors[0],noteId}];
  for(let index=2;index<=6;index++){
   const participant=await register('participant-'+index,'client');
   const advisor=advisors[index<=3?0:1];
   const invitation=await json(post(orgPath+'/participants/invitations',{email:participant.email},advisor.session),201,'participant invitation');
   assert.equal((await post('/api/organization-participants/invitations/accept',{token:invitation.invitationToken},participant.session)).status,200);
   const note=await json(post(learningPath+'/notes',{perspective:'observer',goal:'Goal '+index,nextAction:'Try a short practice session'},participant.session),201,'private goal note');
   assert.equal((await post(learningPath+'/notes/'+note.id+'/share',{},participant.session)).status,200);
   participants.push({...participant,advisor,noteId:note.id});
  }
  const perspectives=['observer','dreamer','alchemist','visionary'];
  for(const [index,participant] of participants.entries()){
   const {session,advisor}=participant;
   const otherAdvisor=advisors.find(person=>person!==advisor);
   const anotherParticipant=participants[(index+1)%participants.length];
   const notePath=learningPath+'/notes/'+participant.noteId;
   if(index>0)assert.equal((await post(notePath+'/feedback',{question:'What changed after trying it?'},advisor.session)).status,201);
   assert.equal((await json(get(notePath+'/feedback',session),200,'participant feedback')).feedback.length,1);
   assert.equal((await post(notePath+'/feedback',{question:'Outside caseload'},otherAdvisor.session)).status,404);
   assert.equal((await get(notePath+'/feedback',anotherParticipant.session)).status,404);
   assert.equal((await post(notePath+'/reflection',{reflection:'Private institutional reflection '+index},session)).status,200);

   const primary=perspectives[index%perspectives.length];
   const profile={primary,secondary:perspectives[(index+1)%perspectives.length],summary:'Fictional private profile '+index};
   await json(post('/api/journey/profile',profile,session),201,'save profile');
   const journey=await json(get('/api/journey',session),200,'participant journey');
   assert.equal(journey.profile.summary,profile.summary);
   assert.equal(journey.profile.primary,primary);
   assert.deepEqual(journey.coaches,[]);
   const identity=await json(get('/api/me',session),200,'participant identity');
   for(const unauthorized of [advisor.session,otherAdvisor.session,cookie,anotherParticipant.session]){
    assert.equal((await get('/api/journey/profiles/'+identity.id,unauthorized)).status,403);
   }

   const goal={title:'Build a learning habit '+index,motivation:'Practice regularly'};
   const {id}=await json(post('/api/journey/goals',goal,session),201,'create journey goal');
   const goalPath='/api/journey/goals/'+id;
   await json(post(goalPath+'/explorations',{perspective:primary,note:'Consider different practice settings'},session),201,'explore goal');
   const challenge=await json(post(goalPath+'/challenges',{text:'Choose one practice session'},session),201,'create challenge');
   const experiment=await json(post(goalPath+'/experiments',{challengeId:challenge.id,possibility:'Try shorter practice',action:'Practice for 15 minutes',notice:'Record what helped'},session),201,'record experiment');
   const reflection=await json(post(goalPath+'/reflections',{experimentId:experiment.id,text:'Private journey reflection '+index},session),201,'reflect on experiment');
   await json(post(goalPath+'/learning',{reflectionId:reflection.id,changed:'Shorter practice helped',nextMove:'Repeat the session next week'},session),201,'record learning');
   assert.equal((await post(goalPath+'/revision',{...goal,status:'complete'},session)).status,200);
   const detail=await json(get(goalPath,session),200,'read journey progress');
   assert.equal(detail.goal.status,'complete');
   assert.equal(detail.revisions.length,2);
   assert.equal(detail.learning[0].nextMove,'Repeat the session next week');
   assert.equal((await get(goalPath,advisor.session)).status,403);
   assert.equal((await get(goalPath,cookie)).status,403);
  }
  for(const advisor of advisors){
   const expectedEmails=participants.filter(p=>p.advisor===advisor).map(p=>p.email).sort();
   const caseload=await json(get(orgPath+'/participants',advisor.session),200,'advisor caseload');
   assert.deepEqual(caseload.participants.map(p=>p.email).sort(),expectedEmails);
   const shared=await json(get(learningPath+'/shared',advisor.session),200,'advisor shared notes');
   assert.deepEqual(shared.notes.map(n=>n.participantEmail).sort(),expectedEmails);
   assert.ok(shared.notes.every(n=>!('reflection' in n)));
  }
  const pilotOverview=await json(get(orgPath+'/overview',cookie),200,'pilot counts');
  assert.deepEqual(pilotOverview.summary,{professionalAccounts:2,activeParticipantEnrollments:6,revokedEnrollments:0});
  assert.ok(participants.every(p=>!JSON.stringify(pilotOverview).includes(p.email)));
  const pilotAdminNotes=await json(get(learningPath+'/shared',cookie),200,'counts-only administrator');
  assert.deepEqual(pilotAdminNotes.notes,[]);
  const revoke=await post('/api/organization-participants/'+org.id+'/revoke',{},participantCookie);assert.equal(revoke.status,200);
  const afterRevocationFeedback=await post('/api/organization-learning/'+org.id+'/notes/'+noteId+'/feedback',{question:'Not permitted'},professionalCookie);assert.equal(afterRevocationFeedback.status,404);
  assert.equal((await post(reflectionPath,{reflection:'After revocation'},participantCookie)).status,404);
  const revokedShared=await fetch(origin+'/api/organization-learning/'+org.id+'/shared',{headers:{Cookie:professionalCookie}});const remainingShared=(await revokedShared.json()).notes;
  assert.equal(remainingShared.length,2);
  assert.ok(remainingShared.every(note=>note.id!==noteId));
  const revokedNotes=await fetch(origin+'/api/organization-learning/'+org.id+'/notes',{headers:{Cookie:participantCookie}});assert.equal(revokedNotes.status,404);
  const revokedOverview=await fetch(origin+'/api/organizations/'+org.id+'/overview',{headers:{Cookie:cookie}});assert.equal(revokedOverview.status,200);
  assert.equal((await revokedOverview.json()).summary.activeParticipantEnrollments,5);
  const logout=await post('/api/logout',{},cookie);assert.equal(logout.status,200);
  const after=await fetch(origin+'/api/organizations',{headers:{Cookie:cookie}});assert.equal(after.status,401);
});
