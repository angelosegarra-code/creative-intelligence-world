// Organization pilot API. No participant data or reflections are exposed here.
export function createOrganizationRoutes({db,q,all,run,hex,sha,audit,input,reply,emailOk}){
 const validId=id=>typeof id==='string'&&/^[a-f0-9]{48}$/.test(id);
 const admin=async(actor,id)=>!!await q("SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND role='admin'",id,actor.id);
 const member=async(actor,id)=>!!await q("SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=?",id,actor.id);
 return async function route(req,res,path,method,actor){
  if(actor.role!=='coach')return reply(res,403,{error:'Professional account required'});
  if(path==='/api/organizations'&&method==='POST'){
   const b=await input(req),name=typeof b.name==='string'?b.name.trim():'';
   if(name.length<3||name.length>120)return reply(res,400,{error:'Organization name must be 3–120 characters'});
   const id=hex();
   await db.transaction(async()=>{
    await run('INSERT INTO organizations(id,name,created_by) VALUES(?,?,?)',id,name,actor.id);
    await run("INSERT INTO organization_members(organization_id,user_id,role) VALUES(?,?,'admin')",id,actor.id);
    await audit(actor.id,'organization_created','organization',id);
   });
   return reply(res,201,{id,name,role:'admin'});
  }
  if(path==='/api/organizations'&&method==='GET'){
   const rows=await all('SELECT o.id,o.name,m.role FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? ORDER BY o.created_at DESC',actor.id);
   return reply(res,200,{organizations:rows});
  }
  const match=/^\/api\/organizations\/([a-f0-9]{48})(?:\/(members|overview|invitations|invitations\/accept))?$/.exec(path);
  if(!match)return reply(res,404,{error:'Not found'});
  const [,id,action]=match;
  if(!await member(actor,id))return reply(res,404,{error:'Organization not found'});
  if(!action&&method==='GET'){
   const org=await q('SELECT id,name FROM organizations WHERE id=?',id);
   const membership=await q('SELECT role FROM organization_members WHERE organization_id=? AND user_id=?',id,actor.id);
   return reply(res,200,{organization:org,role:membership.role});
  }
  if(action==='overview'&&method==='GET'){
   if(!await admin(actor,id))return reply(res,403,{error:'Administrator access required'});
   // Counts only. Never return emails, participant identifiers, goals or reflections.
   const counts=await q(`SELECT
      (SELECT COUNT(*)::integer FROM organization_members WHERE organization_id=?) AS "professionals",
      (SELECT COUNT(*)::integer FROM organization_participants WHERE organization_id=? AND revoked_at IS NULL) AS "enrolledParticipants",
      (SELECT COUNT(*)::integer FROM organization_participants WHERE organization_id=? AND revoked_at IS NOT NULL) AS "revokedEnrollments"`,id,id,id);
   return reply(res,200,{organizationId:id,summary:{
     professionalAccounts:Math.max(0,Number(counts.professionals)-1),
     activeParticipantEnrollments:Number(counts.enrolledParticipants),
     revokedEnrollments:Number(counts.revokedEnrollments)
   },privacy:'Counts only; no participant records or private coaching data.'});
  }
  if(action==='members'&&method==='GET'){
   if(!await admin(actor,id))return reply(res,403,{error:'Administrator access required'});
   const members=await all('SELECT u.email,m.role,m.joined_at AS "joinedAt" FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY m.joined_at',id);
   return reply(res,200,{members});
  }
  if(action==='invitations'&&method==='POST'){
   if(!await admin(actor,id))return reply(res,403,{error:'Administrator access required'});
   const b=await input(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
   if(!emailOk(email))return reply(res,400,{error:'Valid professional email required'});
   const token=hex(),expires=Date.now()+86400000;
   await run('INSERT INTO organization_invitations(token_hash,organization_id,invited_by,recipient_email,expires_at) VALUES(?,?,?,?,?)',sha(token),id,actor.id,email,expires);
   await audit(actor.id,'organization_invitation_created','organization',id);
   return reply(res,201,{invitationToken:token,expiresInHours:24,note:'Private testing only. Share token through a secure channel.'});
  }
  return reply(res,404,{error:'Not found'});
 };
}
