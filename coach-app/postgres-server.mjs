import http from 'node:http';
import {createPostgresJourney,perspectives} from './postgres-journey.mjs';
import {createPostgresAdapter} from './postgres-adapter.mjs';
import {randomBytes,scryptSync,timingSafeEqual,createHash,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const hex=()=>randomBytes(24).toString('hex'),sha=s=>createHash('sha256').update(s).digest('hex');
const emailOk=s=>typeof s==='string'&&s.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const reply=(res,status,obj,extra={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(obj))};
const cookie=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('ci_coach_sid='))?.slice(13);
const stagingCookieName='__Host-ci_coach_staging';
const stagingSessionSeconds=8*60*60;
const sameBytes=(actual,expected)=>actual.length===expected.length&&timingSafeEqual(actual,expected);
const htmlHeaders={
  'Content-Type':'text/html; charset=utf-8',
  'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
};
const formContentType='application/x-www-form-urlencoded';

function stagingSignIn(res,status,error=''){
  res.writeHead(status,htmlHeaders);
  res.end(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coach Pilot staging sign-in</title>
<style>body{font:16px system-ui;background:#f3f6f1;color:#233e31;max-width:30rem;margin:3rem auto;padding:1rem}input{display:block;box-sizing:border-box;width:100%;margin:.4rem 0 1.2rem;padding:.6rem}button{background:#28543d;color:white;border:0;border-radius:6px;padding:.7rem 1rem}</style>
<main><h1>Coach Pilot staging sign-in</h1><p>Use your staging username and password to open the private demo.</p>
${error?'<p role="alert">'+error+'</p>':''}
<form action="/staging-access" method="post">
<label for="stagingUser">Staging username</label><input id="stagingUser" name="username" type="text" autocomplete="username" required>
<label for="stagingPassword">Staging password</label><input id="stagingPassword" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Open Coach Pilot</button>
</form></main></html>`);
}

function registrationResponse(res,status,message,nativeForm){
  if(!nativeForm)return reply(res,status,status===201?{ok:true}:{error:message});
  res.writeHead(status,htmlHeaders);
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Coach Pilot registration</title>
<main><h1>${message}</h1><p><a href="/${status===201?'#account-sign-in':''}">${status===201?'Continue to sign in':'Back to registration'}</a></p></main></html>`);
}

function stagingAccess(username,password){
  if(!username||!password||password.length<20)return null;
  const credentials=Buffer.from(username+':'+password);
  const sign=payload=>createHmac('sha256',credentials)
    .update('ci-coach-staging-session:'+payload).digest('hex');
  return {
    matchesForm(usernameInput,passwordInput){
      return typeof usernameInput==='string'&&typeof passwordInput==='string'
        &&sameBytes(Buffer.from(usernameInput),Buffer.from(username))
        &&sameBytes(Buffer.from(passwordInput),Buffer.from(password));
    },
    hasCredentials(req){
      const match=/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(req.headers.authorization||'');
      return !!match&&sameBytes(Buffer.from(match[1],'base64'),credentials);
    },
    hasSession(req){
      const value=(req.headers.cookie||'').split(';').map(part=>part.trim())
        .find(part=>part.startsWith(stagingCookieName+'='))?.slice(stagingCookieName.length+1);
      const match=/^(\d{1,12}\.[a-f0-9]{48})\.([a-f0-9]{64})$/.exec(value||'');
      if(!match)return false;
      const [expires]=match[1].split('.');
      return Number(expires)>Math.floor(Date.now()/1000)
        &&sameBytes(Buffer.from(match[2],'hex'),Buffer.from(sign(match[1]),'hex'));
    },
    sessionCookie(){
      const expires=Math.floor(Date.now()/1000)+stagingSessionSeconds;
      const payload=expires+'.'+hex();
      return stagingCookieName+'='+payload+'.'+sign(payload)
        +'; Path=/; Max-Age='+stagingSessionSeconds+'; Secure; HttpOnly; SameSite=Strict';
    }
  };
}
async function input(req,form=false){
  req.setEncoding('utf8');
  let s='';
  for await(const chunk of req){s+=chunk;if(s.length>12000)throw Error('too large')}
  return form?Object.fromEntries(new URLSearchParams(s)):JSON.parse(s||'{}');
}
export function createPostgresServer(adapter=createPostgresAdapter()){
const db=adapter;
const {q,all,run}=db;
const user=async req=>{const sid=cookie(req);if(!sid)return null;return await q('SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',sha(sid),Date.now())};
const active=async(coach,client)=>!!await q('SELECT 1 AS ok FROM relationships WHERE coach_id=? AND client_id=? AND revoked_at IS NULL',coach,client);
const audit=async(actor,event,kind,rid)=>await run('INSERT INTO audit_events(id,actor_id,event_type,resource_type,resource_id) VALUES(?,?,?,?,?)',hex(),actor,event,kind,rid);
const journey=createPostgresJourney({db,q,all,run,hex,active,audit,input,reply});
const onRender=!!process.env.RENDER;
const staging=onRender?stagingAccess(process.env.STAGING_ACCESS_USER,process.env.STAGING_ACCESS_PASSWORD):null;
const server=http.createServer(async(req,res)=>{try{
// Private staging gate. Fail closed on Render unless credentials are configured.
// Render terminates HTTPS. A successful page sign-in grants a separate staging cookie.
const u=new URL(req.url,'http://localhost'),p=u.pathname,m=req.method;
const origin=req.headers.origin,contentType=req.headers['content-type']?.split(';')[0].trim().toLowerCase();
const browserOrigin=(onRender?'https://':'http://')+req.headers.host;
let issueStagingCookie=false;
if(onRender){
  if(!staging)return reply(res,503,{error:'Staging access not configured'});
  if(p==='/staging-access'){
    if(m==='GET')return stagingSignIn(res,200);
    if(m!=='POST')return reply(res,405,{error:'Method not allowed'},{Allow:'GET, POST'});
    if(origin!==browserOrigin)return stagingSignIn(res,403,'Open this sign-in page directly and try again.');
    if(contentType!==formContentType)return stagingSignIn(res,415,'Submit using the sign-in form.');
    const {username,password}=await input(req,true);
    if(!staging.matchesForm(username,password))return stagingSignIn(res,401,'Staging username or password is incorrect.');
    res.writeHead(303,{Location:'/','Set-Cookie':staging.sessionCookie(),'Cache-Control':'no-store'});
    return res.end();
  }
  if(!staging.hasSession(req)){
    if(!staging.hasCredentials(req)){
      if(p.startsWith('/api/'))return reply(res,401,{error:'Staging access denied. Sign in to staging access and try again.'});
      res.writeHead(401,{'WWW-Authenticate':'Basic realm="CI World Coach Studio Staging"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end('Private staging access required');
    }
    issueStagingCookie=m==='GET'&&p==='/';
  }
}

if(m==='GET'&&p==='/'){
  const b=await readFile(join(here,'index.html'));
  const headers={...htmlHeaders};
  if(issueStagingCookie)headers['Set-Cookie']=staging.sessionCookie();
  res.writeHead(200,headers);
  return res.end(b);
}
if(m==='GET'&&['/app.js','/journey.js'].includes(p)){const js=await readFile(join(here,p.slice(1)));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(js)}
if(!p.startsWith('/api/'))return reply(res,404,{error:'Not found'});
// Browser writes must originate from this server. No wildcard CORS.
const nativeRegistration=m==='POST'&&p==='/api/register'&&contentType===formContentType;
if(m!=='GET'){
  if((origin&&origin!==browserOrigin)||(nativeRegistration&&!origin))return reply(res,403,{error:'Origin rejected'});
  if(contentType!=='application/json'&&!nativeRegistration)return reply(res,415,{error:'JSON required'});
}
if(m==='POST'&&p==='/api/register'){
  const b=await input(req,nativeRegistration);
  const email=typeof b?.email==='string'?b.email.trim().toLowerCase():'';
  if(!emailOk(email)||!['coach','client'].includes(b?.role)||typeof b.password!=='string'||b.password.length<14||b.password.length>128){
    return registrationResponse(res,400,'Enter a valid email, choose a role, and use a password with 14 to 128 characters.',nativeRegistration);
  }
  const salt=hex(),pass=scryptSync(b.password,salt,64).toString('hex');
  try{
    await run('INSERT INTO users(id,email,role,password_salt,password_hash) VALUES(?,?,?,?,?)',hex(),email,b.role,salt,pass);
  }catch(error){
    if(error.code==='23505')return registrationResponse(res,409,'A demo account already exists. Sign in or use a different demo email.',nativeRegistration);
    console.error('Coach Pilot registration database write failed.');
    return registrationResponse(res,500,'Could not save the demo account. Please try again.',nativeRegistration);
  }
  if(onRender)console.info('Coach Pilot demo registration succeeded ('+b.role+').');
  return registrationResponse(res,201,'Demo account created.',nativeRegistration);
}
if(m==='POST'&&p==='/api/login'){const b=await input(req),a=await q('SELECT * FROM users WHERE email=?',String(b.email||'').trim().toLowerCase());if(!a||typeof b.password!=='string'||b.password.length>128)return reply(res,401,{error:'Invalid credentials'});const check=scryptSync(b.password,a.password_salt,64),stored=Buffer.from(a.password_hash,'hex');if(stored.length!==check.length||!timingSafeEqual(check,stored))return reply(res,401,{error:'Invalid credentials'});const token=hex();await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',sha(token),a.id,Date.now()+28800000);return reply(res,200,{role:a.role,email:a.email},{'Set-Cookie':'ci_coach_sid='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(process.env.NODE_ENV==='production'?'; Secure':'')})}
if(m==='POST'&&p==='/api/logout'){const sid=cookie(req);if(sid)await run('DELETE FROM sessions WHERE token_hash=?',sha(sid));return reply(res,200,{ok:true},{'Set-Cookie':'ci_coach_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':'')})}
const actor=await user(req);if(!actor)return reply(res,401,{error:'Sign in required'});
if(p==='/api/journey'||p.startsWith('/api/journey/'))return await journey.route(req,res,p,m,actor);
if(m==='GET'&&p==='/api/me')return reply(res,200,actor);
if(m==='POST'&&p==='/api/logout'){const sid=cookie(req);if(sid)await run('DELETE FROM sessions WHERE token_hash=?',sha(sid));return reply(res,200,{ok:true},{'Set-Cookie':'ci_coach_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
if(m==='POST'&&p==='/api/invitations'&&actor.role==='coach'){const b=await input(req);if(!emailOk(b.email))return reply(res,400,{error:'Valid email required'});const token=hex();await run('INSERT INTO invitations(token_hash,coach_id,recipient_email,expires_at) VALUES(?,?,?,?)',sha(token),actor.id,b.email.trim().toLowerCase(),Date.now()+86400000);await audit(actor.id,'invitation_created','invitation',sha(token));return reply(res,201,{invitationToken:token,expiresInHours:24})}
if(m==='POST'&&p==='/api/invitations/accept'&&actor.role==='client'){const b=await input(req),key=sha(String(b.token||'')),inv=await q('SELECT * FROM invitations WHERE token_hash=? AND accepted_at IS NULL',key);if(!inv||inv.expires_at<Date.now()||inv.recipient_email!==actor.email)return reply(res,403,{error:'Invalid invitation'});await db.transaction(async()=>{await run('INSERT INTO relationships(coach_id,client_id,revoked_at) VALUES(?,?,NULL) ON CONFLICT(coach_id,client_id) DO UPDATE SET consented_at=CURRENT_TIMESTAMP,revoked_at=NULL',inv.coach_id,actor.id);await run('UPDATE invitations SET accepted_at=CURRENT_TIMESTAMP WHERE token_hash=? AND accepted_at IS NULL',key);await audit(actor.id,'relationship_consented','relationship',inv.coach_id);});return reply(res,200,{ok:true})}
if(m==='GET'&&p==='/api/clients'&&actor.role==='coach')return reply(res,200,{clients:await all('SELECT u.id,u.email FROM relationships r JOIN users u ON u.id=r.client_id WHERE r.coach_id=? AND r.revoked_at IS NULL',actor.id)});
if(m==='POST'&&p==='/api/challenges'&&actor.role==='coach'){const b=await input(req);if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000||!await active(actor.id,b.clientId))return reply(res,403,{error:'Not authorized or invalid challenge'});const id=hex();await run('INSERT INTO challenges(id,coach_id,client_id,text) VALUES(?,?,?,?)',id,actor.id,b.clientId,b.text.trim());await audit(actor.id,'challenge_assigned','challenge',id);return reply(res,201,{id,clientId:b.clientId,text:b.text.trim()})}
if(m==='GET'&&p==='/api/perspectives')return reply(res,200,{perspectives});
if(m==='POST'&&p==='/api/challenge-drafts'&&actor.role==='coach'){
  const b=await input(req),lens=String(b.perspective||'').toLowerCase(),focus=String(b.focus||'').trim();
  const perspective=perspectives.find(p=>p.id===lens);
  if(!perspective||!focus||focus.length>160)return reply(res,400,{error:'Valid focus and perspective required'});
  return reply(res,200,{perspective:lens,draft:'Explore '+focus+'. '+perspective.question+' Choose one small, safe experiment. Record what you expected, what happened, and what surprised you.',note:'Draft only. Coach must review and explicitly assign; no AI service called.'});
}
if(m==='GET'&&p==='/api/learning-loop')return reply(res,200,{stages:['Discover','Explore','Challenge','Experiment','Learn'],reflectionPrompts:['What did you expect?','What did you try?','What actually happened?','What surprised you?','What might you do differently next?']});
if(m==='GET'&&p==='/api/challenges'){const rows=actor.role==='coach'?await all('SELECT c.id,c.client_id AS "clientId",c.text FROM challenges c JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE c.coach_id=? AND r.revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM journey_challenge_links j WHERE j.challenge_id=c.id)',actor.id):await all('SELECT c.id,c.client_id AS "clientId",c.text FROM challenges c JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE c.client_id=? AND r.revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM journey_challenge_links j WHERE j.challenge_id=c.id)',actor.id);return reply(res,200,{challenges:rows})}
if(m==='POST'&&/^\/api\/challenges\/[a-f0-9]+\/reflections$/.test(p)&&actor.role==='client'){const cid=p.split('/')[3],c=await q('SELECT * FROM challenges WHERE id=?',cid),b=await input(req);if(!c||c.client_id!==actor.id||!await active(c.coach_id,actor.id)||await q('SELECT 1 FROM journey_challenge_links WHERE challenge_id=?',cid))return reply(res,403,{error:'Not authorized'});if(typeof b.text!=='string'||!b.text.trim()||b.text.length>4000)return reply(res,400,{error:'Invalid reflection'});const id=hex();await run('INSERT INTO reflections(id,challenge_id,client_id,text) VALUES(?,?,?,?)',id,cid,actor.id,b.text.trim());await audit(actor.id,'reflection_submitted','reflection',id);return reply(res,201,{id,challengeId:cid,text:b.text.trim()})}
if(m==='GET'&&p==='/api/reflections'){const rows=actor.role==='coach'?await all('SELECT f.id,f.challenge_id AS "challengeId",f.text FROM reflections f JOIN challenges c ON c.id=f.challenge_id JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE c.coach_id=? AND r.revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM journey_challenge_links j WHERE j.challenge_id=c.id)',actor.id):await all('SELECT f.id,f.challenge_id AS "challengeId",f.text FROM reflections f JOIN challenges c ON c.id=f.challenge_id JOIN relationships r ON r.coach_id=c.coach_id AND r.client_id=c.client_id WHERE f.client_id=? AND r.revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM journey_challenge_links j WHERE j.challenge_id=c.id)',actor.id);return reply(res,200,{reflections:rows})}
if(m==='POST'&&p==='/api/relationships/revoke'&&actor.role==='client'){
  const b=await input(req);
  journey.revoke(String(b.coachId),actor.id);
  return reply(res,200,{ok:true});
}
return reply(res,403,{error:'Forbidden'});
}catch(e){console.error('Coach Studio PostgreSQL request failed:',e?.code||e?.name||'unknown');return reply(res,500,{error:'Request could not be completed'})}});
server.on('close',()=>{void db.close()});return server}
if(process.argv[1]===fileURLToPath(import.meta.url)){createPostgresServer().listen(Number(process.env.PORT||3100),process.env.RENDER?'0.0.0.0':'127.0.0.1',()=>console.log('PostgreSQL coach pilot listening'))}
