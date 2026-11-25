// Accept an organization invitation after signing in as a professional.
export function acceptOrganizationInvitation({db,q,run,sha,audit,input,reply}){
 return async(req,res,actor)=>{
  if(actor.role!=='coach')return reply(res,403,{error:'Professional account required'});
  const b=await input(req);
  if(typeof b.token!=='string'||!/^[a-f0-9]{48}$/.test(b.token))return reply(res,403,{error:'Invalid invitation'});
  const ok=await db.transaction(async()=>{
   const row=await q('UPDATE organization_invitations SET accepted_at=CURRENT_TIMESTAMP WHERE token_hash=? AND recipient_email=? AND accepted_at IS NULL AND expires_at>? RETURNING organization_id',sha(b.token),actor.email,Date.now());
   if(!row)return null;
   await run("INSERT INTO organization_members(organization_id,user_id,role) VALUES(?,?,'professional') ON CONFLICT(organization_id,user_id) DO NOTHING",row.organization_id,actor.id);
   await audit(actor.id,'organization_invitation_accepted','organization',row.organization_id);
   return row.organization_id;
  });
  return ok?reply(res,200,{ok:true,organizationId:ok}):reply(res,403,{error:'Invalid or expired invitation'});
 };
}
