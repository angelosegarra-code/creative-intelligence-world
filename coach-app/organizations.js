// Private institutional pilot UI. All content is rendered as text, not HTML.
(()=>{
const by=id=>document.getElementById(id);
const state={user:null,organizations:[],selected:null};
async function request(path,method='GET',body){
 const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;
}
function status(message){by('organizationStatus').textContent=message}
function clear(){state.user=null;state.organizations=[];state.selected=null;by('organizationStudio').hidden=true;by('organizationList').replaceChildren();by('organizationMembers').replaceChildren();by('organizationToken').textContent='';by('organizationName').value='';by('organizationInviteEmail').value='';by('organizationAcceptToken').value='';status('');}
function item(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}
function button(label,handler){const node=item('button',label);node.type='button';node.addEventListener('click',handler);return node;}
async function refresh(){
 const result=await request('organizations');state.organizations=result.organizations;
 const list=by('organizationList');list.replaceChildren();
 if(!result.organizations.length)list.append(item('p','No organizations yet. Create a fictional pilot organization or accept an invitation.'));
 for(const org of result.organizations){const row=document.createElement('div');row.className='share-row';row.append(item('span',org.name+' · '+org.role),button('Open',()=>open(org.id)));list.append(row);}
 if(state.selected&&!result.organizations.some(o=>o.id===state.selected))state.selected=null;
 if(!state.selected)by('organizationAdmin').hidden=true;
}
async function open(id){
 try{
 const info=await request('organizations/'+id);state.selected=id;
 by('organizationSelected').textContent=info.organization.name+' · '+info.role;
 const isAdmin=info.role==='admin';by('organizationAdmin').hidden=!isAdmin;
 by('organizationToken').textContent='';by('organizationMembers').replaceChildren();
 if(isAdmin){const members=await request('organizations/'+id+'/members');for(const m of members.members)by('organizationMembers').append(item('li',m.email+' · '+m.role));}
 status('Workspace opened. This pilot workspace does not expose participant records or aggregate reporting.');
 }catch(e){status(e.message)}
}
document.addEventListener('coach-identity',async e=>{
 clear();state.user=e.detail;
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
by('organizationRefresh').addEventListener('click',async()=>{try{await refresh();if(state.selected)await open(state.selected);status('Organization list refreshed.')}catch(e){status(e.message)}});
})();
