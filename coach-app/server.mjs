import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const users=new Map(),sessions=new Map(),invites=new Map(),relationships=new Map(),challenges=new Map(),reflections=new Map();
const id=()=>randomBytes(24).toString('hex');
const hash=x=>createHash('sha256').update(x).digest('hex');
const passwordHash=(password,salt)=>scryptSync(password,salt,64);
const validEmail=x=>typeof x==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x.length<=254;
const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const session=req=>{const key=cookies(req).ci_coach_sid;const s=key&&sessions.get(hash(key));if(!s||s.expires<Date.now())return null;return users.get(s.userId)};
const allowed=(coach,clientId)=>relationships.has(coach.id+':'+clientId);
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>12000)throw Error('Request too large')}return JSON.parse(data||'{}')}
function cookie(token){return 'ci_coach_sid='+encodeURIComponent(token)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(process.env.NODE_ENV==='production'?'; Secure':'')}
const limits=new Map();
function rate(req){const ip=req.socket.remoteAddress||'unknown',now=Date.now();const x=limits.get(ip)||{n:0,t:now};if(now-x.t>60000){x.n=0;x.t=now}x.n++;limits.set(ip,x);return x.n<=90}
export function createServer(){return http.createServer(async(req,res)=>{try{
if(!rate(req))return send(res,429,{error:'Too many requests'});
const url=new URL(req.url,'http://localhost');const path=url.pathname;
if(req.method==='GET'&&path==='/'){const html=await readFile(join(here,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(html)}
if(req.method==='GET'&&['/app.js','/journey.js'].includes(path)){const js=await readFile(join(here,path.slice(1)));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(js)}
if(!path.startsWith('/api/'))return send(res,404,{error:'Not found'});
if(req.method==='POST'&&path==='/api/register'){const b=await body(req);if(!validEmail(b.email)||typeof b.password!=='string'||b.password.length<14||b.password.length>128||!['coach','client'].includes(b.role))return send(res,400,{error:'Valid email, role and 14+ character password required'});const email=b.email.toLowerCase().trim();if([...users.values()].some(x=>x.email===email))return send(res,409,{error:'Account already exists'});const salt=id(),user={id:id(),email,role:b.role,salt,pass:passwordHash(b.password,salt)};users.set(user.id,user);return send(res,201,{ok:true})}
if(req.method==='POST'&&path==='/api/login'){const b=await body(req);const u=[...users.values()].find(x=>x.email===String(b.email||'').toLowerCase().trim());if(!u||typeof b.password!=='string'||b.password.length>128||!timingSafeEqual(passwordHash(b.password,u.salt),u.pass))return send(res,401,{error:'Invalid credentials'});const token=id();sessions.set(hash(token),{userId:u.id,expires:Date.now()+28800000});return send(res,200,{role:u.role,email:u.email},{'Set-Cookie':cookie(token)})}
const u=session(req);if(!u)return send(res,401,{error:'Sign in required'});
if(req.method==='GET'&&path==='/api/me')return send(res,200,{id:u.id,email:u.email,role:u.role});
if(req.method==='POST'&&path==='/api/logout'){const token=cookies(req).ci_coach_sid;if(token)sessions.delete(hash(token));return send(res,200,{ok:true},{'Set-Cookie':'ci_coach_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
if(req.method==='POST'&&path==='/api/invitations'&&u.role==='coach'){const b=await body(req);if(!validEmail(b.email))return send(res,400,{error:'Valid client email required'});const token=id();invites.set(hash(token),{coachId:u.id,email:b.email.toLowerCase().trim(),expires:Date.now()+86400000});return send(res,201,{invitationToken:token,expiresInHours:24,note:'Development only. Deliver token out of band; no email is sent.'})}
if(req.method==='POST'&&path==='/api/invitations/accept'&&u.role==='client'){const b=await body(req),key=hash(String(b.token||'')),invite=invites.get(key);if(!invite||invite.expires<Date.now()||invite.email!==u.email)return send(res,403,{error:'Invalid invitation'});relationships.set(invite.coachId+':'+u.id,true);invites.delete(key);return send(res,200,{ok:true})}
if(req.method==='POST'&&path==='/api/challenges'&&u.role==='coach'){const b=await body(req);if(typeof b.text!=='string'||!b.text.trim()||b.text.length>2000||!allowed(u,String(b.clientId)))return send(res,403,{error:'No authorized client relationship or invalid text'});const c={id:id(),coachId:u.id,clientId:b.clientId,text:b.text.trim()};challenges.set(c.id,c);return send(res,201,c)}
if(req.method==='GET'&&path==='/api/clients'&&u.role==='coach')return send(res,200,{clients:[...relationships.keys()].filter(x=>x.startsWith(u.id+':')).map(x=>{const client=users.get(x.split(':')[1]);return {id:client.id,email:client.email}})});
if(req.method==='GET'&&path==='/api/challenges')return send(res,200,{challenges:[...challenges.values()].filter(c=>u.role==='coach'?c.coachId===u.id:c.clientId===u.id)});
if(req.method==='POST'&&path.match(/^\/api\/challenges\/[a-f0-9]+\/reflections$/)&&u.role==='client'){const cid=path.split('/')[3],c=challenges.get(cid),b=await body(req);if(!c||c.clientId!==u.id||!allowed({id:c.coachId},u.id))return send(res,403,{error:'Not authorized'});if(typeof b.text!=='string'||!b.text.trim()||b.text.length>4000)return send(res,400,{error:'Reflection must be 1–4000 characters'});const r={id:id(),challengeId:cid,clientId:u.id,text:b.text.trim()};reflections.set(r.id,r);return send(res,201,r)}
if(req.method==='GET'&&path==='/api/reflections')return send(res,200,{reflections:[...reflections.values()].filter(r=>{const c=challenges.get(r.challengeId);return u.role==='client'?r.clientId===u.id:c.coachId===u.id&&allowed(u,r.clientId)})});
if(req.method==='POST'&&path==='/api/relationships/revoke'&&u.role==='client'){const b=await body(req);relationships.delete(String(b.coachId)+':'+u.id);return send(res,200,{ok:true})}
return send(res,403,{error:'Forbidden'});
}catch(e){return send(res,400,{error:e instanceof SyntaxError?'Invalid JSON':'Invalid request'})}})}
if(process.argv[1]===fileURLToPath(import.meta.url)){createServer().listen(Number(process.env.PORT||3100),'127.0.0.1',()=>console.log('Coach pilot listening on localhost'))}
