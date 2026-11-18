const $=id=>document.getElementById(id);async function call(path,method='GET',data){try{const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const raw=await r.text();let b;try{b=JSON.parse(raw)}catch{b={error:'Server returned a non-JSON response. Check staging access and refresh the page.'}}$('result').textContent=JSON.stringify({status:r.status,...b},null,2);return {...b,_status:r.status}}catch(e){$('result').textContent='Request failed: '+e.message}}
$('registrationForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('register'),status=$('registrationStatus'),restoreAccess=$('restoreStagingAccess');
  const email=$('regEmail').value.trim();
  button.disabled=true;
  restoreAccess.hidden=true;
  status.textContent='Creating demo account…';
  try{
    const result=await call('register','POST',{
      email,password:$('regPass').value,role:$('regRole').value
    });
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
$('login').onclick=async()=>{await call('login','POST',{email:$('email').value,password:$('password').value});const m=await call('me');$('identity').textContent=m.email?m.role+' · '+m.email:'Not signed in'};$('logout').onclick=async()=>{const r=await call('logout','POST',{});if(r?.ok){$('identity').textContent='Not signed in';$('email').value='';$('password').value=''}else{$('identity').textContent='Session could not be cleared. '+(r?.error||'Check staging access.')}};$('invite').onclick=()=>call('invitations','POST',{email:$('clientEmail').value});$('accept').onclick=()=>call('invitations/accept','POST',{token:$('token').value});$('clients').onclick=()=>call('clients');$('assign').onclick=()=>call('challenges','POST',{clientId:$('clientId').value,text:$('challenge').value});$('listChallenges').onclick=()=>call('challenges');$('reflect').onclick=()=>call('challenges/'+encodeURIComponent($('challengeId').value)+'/reflections','POST',{text:$('reflection').value});$('listReflections').onclick=()=>call('reflections');
$('draftChallenge').onclick=async()=>{const r=await call('challenge-drafts','POST',{focus:$('focus').value,perspective:$('perspective').value});if(r?.draft)$('challenge').value=r.draft};$('learningLoop').onclick=()=>call('learning-loop');

(async()=>{const m=await call('me');$('identity').textContent=m?.email?m.role+' · '+m.email:'Not signed in'})();
