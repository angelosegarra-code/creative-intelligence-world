const $=id=>document.getElementById(id);
let sessionView=0;

async function call(path,method='GET',data,showResult=true){
  const view=sessionView;
  try{
    const response=await fetch('/api/'+path,{
      method,credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:data?JSON.stringify(data):undefined
    });
    const raw=await response.text();
    if(view!==sessionView)return;
    let result;
    try{result=JSON.parse(raw)}catch{result={error:'Server returned a non-JSON response. Check staging access and refresh the page.'}}
    if(showResult)$('result').textContent=JSON.stringify({status:response.status,...result},null,2);
    return {...result,_status:response.status};
  }catch(error){
    if(showResult&&view===sessionView)$('result').textContent='Request failed: '+error.message;
  }
}

function clearSessionView(){
  sessionView++;
  document.dispatchEvent(new Event('coach-view-cleared'));
  $('registrationForm').reset();
  for(const id of ['email','password','clientEmail','clientId','focus','challenge','token','challengeId','reflection']){
    $(id).value='';
  }
  $('perspective').value='observer';
  $('registrationStatus').textContent='';
  $('restoreStagingAccess').hidden=true;
  $('result').textContent='';
}

async function changeSession(action){
  $('login').disabled=true;
  $('logout').disabled=true;
  try{await action()}finally{
    $('login').disabled=false;
    $('logout').disabled=false;
  }
}

$('registrationForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('register'),status=$('registrationStatus'),restoreAccess=$('restoreStagingAccess');
  const email=$('regEmail').value.trim(),view=sessionView;
  button.disabled=true;
  restoreAccess.hidden=true;
  status.textContent='Creating demo account…';
  try{
    const result=await call('register','POST',{
      email,password:$('regPass').value,role:$('regRole').value
    });
    if(view!==sessionView)return;
    if(result?.ok&&result._status===201){
      $('email').value=email;
      $('regPass').value='';
      status.textContent='Demo account created. Use the Sign in section below to continue.';
    }else{
      status.textContent=result?.error||'Could not reach the server. Try again.';
      restoreAccess.hidden=result?._status!==401;
    }
  }finally{
    button.disabled=false;
  }
});
$('login').onclick=()=>changeSession(async()=>{
  const result=await call('login','POST',{email:$('email').value,password:$('password').value});
  if(result?._status!==200){
    $('password').value='';
    $('identity').textContent=result?.error||'Could not sign in. Try again.';
    return;
  }
  clearSessionView();
  await showIdentity();
});
$('logout').onclick=()=>changeSession(async()=>{
  const result=await call('logout','POST',{});
  if(!result?.ok){
    $('identity').textContent='Session could not be cleared. '+(result?.error||'Check staging access.');
    return;
  }
  clearSessionView();
  $('identity').textContent='Not signed in';
  $('result').textContent='Signed out.';
});
$('clients').onclick=()=>call('clients');$('assign').onclick=()=>call('challenges','POST',{clientId:$('clientId').value,text:$('challenge').value});$('listChallenges').onclick=()=>call('challenges');$('reflect').onclick=()=>call('challenges/'+encodeURIComponent($('challengeId').value)+'/reflections','POST',{text:$('reflection').value});$('listReflections').onclick=()=>call('reflections');
$('draftChallenge').onclick=async()=>{const r=await call('challenge-drafts','POST',{focus:$('focus').value,perspective:$('perspective').value});if(r?.draft)$('challenge').value=r.draft};$('learningLoop').onclick=()=>call('learning-loop');

async function showIdentity(){
  const view=sessionView;
  const result=await call('me');
  if(view!==sessionView)return;
  $('identity').textContent=result?.email?result.role+' · '+result.email:'Not signed in';
  if(result?.email)document.dispatchEvent(new CustomEvent('coach-identity',{detail:result}));
}
document.addEventListener('DOMContentLoaded',showIdentity,{once:true});
