// Private institutional pilot UI. All content is rendered as text, not HTML.
(()=>{
const by=id=>document.getElementById(id);
const state={user:null,organizations:[],selected:null};
async function request(path,method='GET',body){
 const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;
}
function status(message){by('organizationStatus').textContent=message}
function clear(){state.user=null;state.organizations=[];state.selected=null;by('organizationStudio').hidden=true;by('organizationList').replaceChildren();by('organizationMembers').replaceChildren();by('organizationToken').textContent='';by('organizationSelected').textContent='';by('organizationAdmin').hidden=true;by('organizationProfessional').hidden=true;by('organizationParticipants').replaceChildren();by('organizationSharedNotes').replaceChildren();by('organizationParticipantToken').textContent='';by('organizationParticipantStudio').hidden=true;by('organizationMyEnrollments').replaceChildren();by('organizationParticipantStatus').textContent='';by('organizationParticipantAcceptToken').value='';by('organizationName').value='';by('organizationInviteEmail').value='';by('organizationAcceptToken').value='';status('');}
function item(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function button(label,handler){const node=item('button',label);node.type='button';node.addEventListener('click',handler);return node;}
async function refresh(){
 const result=await request('organizations');state.organizations=result.organizations;
 const list=by('organizationList');list.replaceChildren();
 if(!result.organizations.length)list.append(item('p','No organizations yet. Create a fictional pilot organization or accept an invitation.'));
 for(const org of result.organizations){const row=document.createElement('div');row.className='share-row';row.append(item('span',org.name+' · '+org.role),button('Open',()=>open(org.id)));list.append(row);}
 if(state.selected&&!result.organizations.some(o=>o.id===state.selected))state.selected=null;
 if(!state.selected){by('organizationAdmin').hidden=true;by('organizationProfessional').hidden=true;by('organizationSelected').textContent='';}
}
async function open(id){
 try{
 const info=await request('organizations/'+id);state.selected=id;
 by('organizationSelected').textContent=info.organization.name+' · '+info.role;
 const isAdmin=info.role==='admin';by('organizationAdmin').hidden=!isAdmin;
 by('organizationToken').textContent='';by('organizationParticipantToken').textContent='';by('organizationMembers').replaceChildren();by('organizationOverview').replaceChildren();by('organizationProfessional').hidden=false;await refreshParticipants();
 if(isAdmin){const overview=await request('organizations/'+id+'/overview');const summary=overview.summary;const box=by('organizationOverview');for(const [label,value] of [['Professional accounts (excluding administrator)',summary.professionalAccounts],['Active participant enrollments',summary.activeParticipantEnrollments],['Revoked enrollments',summary.revokedEnrollments]])box.append(item('p',label+': '+value));const members=await request('organizations/'+id+'/members');for(const m of members.members)by('organizationMembers').append(item('li',m.email+' · '+m.role));}
 status('Workspace opened. Shared goals require participant permission; administrators see only participation counts.');
 }catch(e){status(e.message)}
}
document.addEventListener('coach-identity',async e=>{
 clear();state.user=e.detail;
 if(state.user.role==='client'){by('organizationParticipantStudio').hidden=false;try{await refreshOwnEnrollments()}catch(err){by('organizationParticipantStatus').textContent=err.message}return;}
 if(state.user.role!=='coach')return;
 by('organizationStudio').hidden=false;
 try{await refresh()}catch(err){status(err.message)}
});
document.addEventListener('coach-view-cleared',clear);
by('organizationCreate').addEventListener('click',async()=>{
 try{const org=await request('organizations','POST',{name:by('organizationName').value});by('organizationName').value='';await refresh();await open(org.id);status('Organization created. Invite a fictional professional to continue.');}catch(e){status(e.message)}
});
by('organizationInvite').addEventListener('click',async()=>{
 if(!state.selected)return status('Open an organization first.');
 try{const r=await request('organizations/'+state.selected+'/invitations','POST',{email:by('organizationInviteEmail').value});by('organizationToken').textContent=r.invitationToken;status('One-time invitation token created. It expires in 24 hours. Copy it privately; the system does not send email.');}catch(e){status(e.message)}
});
by('organizationAccept').addEventListener('click',async()=>{
 try{await request('organizations/invitations/accept','POST',{token:by('organizationAcceptToken').value.trim()});by('organizationAcceptToken').value='';await refresh();status('Invitation accepted. Open the organization in your workspace list.');}catch(e){status(e.message)}
});
async function refreshParticipants(){
 const list=by('organizationParticipants');list.replaceChildren();
 if(!state.selected)return;
 const data=await request('organizations/'+state.selected+'/participants');
 if(!data.participants.length)list.append(item('li','No enrolled fictional participants yet.'));
 for(const p of data.participants)list.append(item('li',p.email));
 const shared=await request('organization-learning/'+state.selected+'/shared');const view=by('organizationSharedNotes');view.replaceChildren();
 if(!shared.notes.length)view.append(item('p','No goals shared with you yet.'));
 for(const note of shared.notes)view.append(item('p',note.participantEmail+' · '+note.perspective+' · '+note.goal+' — '+note.nextAction));
}
async function refreshOwnEnrollments(){
 const data=await request('organization-participants/mine');
 const view=by('organizationMyEnrollments');view.replaceChildren();
 if(!data.enrollments.length)view.append(item('p','No active institutional enrollments.'));
 for(const e of data.enrollments){
  const row=document.createElement('div');row.className='share-row';
  row.append(item('span',e.organizationName+' · '+e.professionalEmail),
    button('Revoke enrollment',async()=>{if(!confirm('Revoke this fictional institutional enrollment?'))return;try{await request('organization-participants/'+e.organizationId+'/revoke','POST',{});await refreshOwnEnrollments();by('organizationParticipantStatus').textContent='Enrollment revoked.'}catch(err){by('organizationParticipantStatus').textContent=err.message}}));
  view.append(row);
 }
 const select=by('organizationLearningOrg');select.replaceChildren();for(const e of data.enrollments){const option=document.createElement('option');option.value=e.organizationId;option.textContent=e.organizationName;select.append(option)}
 await refreshLearningNotes();
}
async function refreshLearningNotes(){
 const view=by('organizationLearningNotes');view.replaceChildren();const org=by('organizationLearningOrg').value;if(!org)return;
 const data=await request('organization-learning/'+org+'/notes');
 for(const n of data.notes){const row=document.createElement('div');row.className='share-row';row.append(item('span',n.perspective+' · '+n.goal+' — '+n.nextAction+' · '+(n.sharedAt?'Shared with my professional':'Private')));row.append(button(n.sharedAt?'Stop sharing':'Share with my professional',async()=>{try{await request('organization-learning/'+org+'/notes/'+n.id+'/'+(n.sharedAt?'unshare':'share'),'POST',{});await refreshLearningNotes();by('organizationLearningStatus').textContent=n.sharedAt?'Sharing revoked.':'Goal shared with your assigned professional.'}catch(e){by('organizationLearningStatus').textContent=e.message}}));view.append(row)}
}
by('organizationLearningOrg').addEventListener('change',()=>refreshLearningNotes().catch(e=>by('organizationLearningStatus').textContent=e.message));
by('organizationLearningSave').addEventListener('click',async()=>{
 try{const org=by('organizationLearningOrg').value;if(!org)throw Error('Accept an institutional enrollment first.');await request('organization-learning/'+org+'/notes','POST',{perspective:by('organizationLearningPerspective').value,goal:by('organizationLearningGoal').value,nextAction:by('organizationLearningAction').value});by('organizationLearningGoal').value='';by('organizationLearningAction').value='';await refreshLearningNotes();by('organizationLearningStatus').textContent='Saved privately. Not shared with your professional or institution.'}catch(e){by('organizationLearningStatus').textContent=e.message}
});
by('organizationInviteParticipant').addEventListener('click',async()=>{
 if(!state.selected)return status('Open an organization first.');
 try{const data=await request('organizations/'+state.selected+'/participants/invitations','POST',{email:by('organizationParticipantEmail').value});by('organizationParticipantToken').textContent=data.invitationToken;status('Participant invitation created. Share privately with the fictional participant.')}catch(err){status(err.message)}
});
by('organizationParticipantAccept').addEventListener('click',async()=>{
 try{await request('organization-participants/invitations/accept','POST',{token:by('organizationParticipantAcceptToken').value.trim()});by('organizationParticipantAcceptToken').value='';await refreshOwnEnrollments();by('organizationParticipantStatus').textContent='Enrollment accepted. You may revoke it here.'}catch(err){by('organizationParticipantStatus').textContent=err.message}
});
by('organizationRefresh').addEventListener('click',async()=>{try{await refresh();if(state.selected)await open(state.selected);status('Organization list refreshed.')}catch(e){status(e.message)}});
})();
