// Consent-bound institutional participant enrollment. No profiles, goals or reflections returned.
export function createOrganizationParticipantRoutes({db,q,all,run,hex,sha,audit,input,reply,emailOk}){
 const idOk=s=>typeof s==='string'&&/^[a-f0-9]{48}$/.test(s);
 const isMember=async(org,user)=>!!await q("SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=?",org,user);
 return async(req,res,path,method,actor)=>{
  if(path==='/api/organization-participants/invitations/accept'&&method==='POST'){
   if(actor.role!=='client')return reply(res,403,{error:'Participant account required'});
   const b=await input(req);
   if(!idOk(b.token))return reply(res,403,{error:'Invalid invitation'});
   const accepted=await db.transaction(async()=>{
    const invitation=await q(`UPDATE organization_participant_invitations i SET accepted_at=CURRENT_TIMESTAMP
      WHERE i.token_hash=? AND i.recipient_email=? AND i.accepted_at IS NULL AND i.expires_at>?
      AND EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=i.organization_id AND m.user_id=i.professional_id)
      RETURNING i.organization_id,i.professional_id`,sha(b.token),actor.email,Date.now());
    if(!invitation)return null;
    const existing=await q('SELECT professional_id,revoked_at FROM organization_participants WHERE organization_id=? AND participant_id=?',invitation.organization_id,actor.id);
    if(existing)return null; // Never reassign or reinstate without a separate, explicit enrollment process.
    await run('INSERT INTO organization_participants(organization_id,participant_id,professional_id) VALUES(?,?,?)',invitation.organization_id,actor.id,invitation.professional_id);
    await audit(actor.id,'organization_participant_consented','organization',invitation.organization_id);
    return invitation.organization_id;
   });
   return accepted?reply(res,200,{ok:true,organizationId:accepted}):reply(res,403,{error:'Invalid or unavailable invitation'});
  }
  if(path==='/api/organization-participants/mine'&&method==='GET'){
   if(actor.role!=='client')return reply(res,403,{error:'Participant account required'});
   const rows=await all(`SELECT p.organization_id AS "organizationId",o.name AS "organizationName",
     u.email AS "professionalEmail",p.consented_at AS "consentedAt"
     FROM organization_participants p JOIN organizations o ON o.id=p.organization_id
     JOIN users u ON u.id=p.professional_id
     WHERE p.participant_id=? AND p.revoked_at IS NULL ORDER BY p.consented_at DESC`,actor.id);
   return reply(res,200,{enrollments:rows});
  }
  const revoke=/^\/api\/organization-participants\/([a-f0-9]{48})\/revoke$/.exec(path);
  if(revoke&&method==='POST'){
   if(actor.role!=='client')return reply(res,403,{error:'Participant account required'});
   const result=await run('UPDATE organization_participants SET revoked_at=CURRENT_TIMESTAMP WHERE organization_id=? AND participant_id=? AND revoked_at IS NULL',revoke[1],actor.id);
   if(!result.changes)return reply(res,404,{error:'Active enrollment not found'});
   await audit(actor.id,'organization_participant_revoked','organization',revoke[1]);
   return reply(res,200,{ok:true});
  }
  const match=/^\/api\/organizations\/([a-f0-9]{48})\/participants(?:\/invitations)?$/.exec(path);
  if(!match)return reply(res,404,{error:'Not found'});
  const org=match[1],invite=path.endsWith('/invitations');
  if(actor.role!=='coach'||!await isMember(org,actor.id))return reply(res,404,{error:'Organization not found'});
  if(invite&&method==='POST'){
   const b=await input(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
   if(!emailOk(email))return reply(res,400,{error:'Valid participant demo email required'});
   const token=hex();
   await run('INSERT INTO organization_participant_invitations(token_hash,organization_id,professional_id,recipient_email,expires_at) VALUES(?,?,?,?,?)',sha(token),org,actor.id,email,Date.now()+86400000);
   await audit(actor.id,'organization_participant_invited','organization',org);
   return reply(res,201,{invitationToken:token,expiresInHours:24,note:'Fictional participants only. The participant must sign in and consent.'});
  }
  if(!invite&&method==='GET'){
   const rows=await all(`SELECT u.email,p.consented_at AS "consentedAt"
      FROM organization_participants p JOIN users u ON u.id=p.participant_id
      WHERE p.organization_id=? AND p.professional_id=? AND p.revoked_at IS NULL ORDER BY p.consented_at DESC`,org,actor.id);
   return reply(res,200,{participants:rows});
  }
  return reply(res,404,{error:'Not found'});
 };
}
