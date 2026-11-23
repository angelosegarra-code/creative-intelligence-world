// Participant-owned learning notes. No professional or administrator read route.
export function createOrganizationLearningRoutes({q,all,run,hex,audit,input,reply}){
 const idOk=s=>typeof s==='string'&&/^[a-f0-9]{48}$/.test(s);
 const owner=async(org,actor)=>!!await q('SELECT 1 FROM organization_participants WHERE organization_id=? AND participant_id=? AND revoked_at IS NULL',org,actor.id);
 return async(req,res,path,method,actor)=>{
  const shared=/^\/api\/organization-learning\/([a-f0-9]{48})\/shared$/.exec(path);
  if(shared&&method==='GET'){
   if(actor.role!=='coach')return reply(res,403,{error:'Professional account required'});
   const rows=await all(`SELECT n.id,n.perspective,n.goal,n.next_action AS "nextAction",
      u.email AS "participantEmail",n.shared_at AS "sharedAt"
      FROM organization_learning_notes n
      JOIN organization_participants p ON p.organization_id=n.organization_id AND p.participant_id=n.participant_id
      JOIN organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.professional_id
      JOIN users u ON u.id=n.participant_id
      WHERE n.organization_id=? AND p.professional_id=? AND p.revoked_at IS NULL
        AND m.role='professional' AND n.shared_at IS NOT NULL
      ORDER BY n.shared_at DESC LIMIT 50`,shared[1],actor.id);
   return reply(res,200,{notes:rows,privacy:'Only explicitly shared goals and next actions from active participants. No private reflections.'});
  }
  if(actor.role!=='client')return reply(res,403,{error:'Participant account required'});
  const toggle=/^\/api\/organization-learning\/([a-f0-9]{48})\/notes\/([a-f0-9]{48})\/(share|unshare)$/.exec(path);
  if(toggle&&method==='POST'){
   const [,org,noteId,action]=toggle;
   if(!await owner(org,actor))return reply(res,404,{error:'Active enrollment not found'});
   const result=await run('UPDATE organization_learning_notes SET shared_at='+(action==='share'?'CURRENT_TIMESTAMP':'NULL')+' WHERE id=? AND organization_id=? AND participant_id=?',noteId,org,actor.id);
   if(!result.changes)return reply(res,404,{error:'Learning note not found'});
   await audit(actor.id,action==='share'?'organization_learning_shared':'organization_learning_unshared','organization',org);
   return reply(res,200,{ok:true,shared:action==='share'});
  }
  const match=/^\/api\/organization-learning\/([a-f0-9]{48})\/notes$/.exec(path);
  if(!match)return reply(res,404,{error:'Not found'});
  const org=match[1];
  if(!await owner(org,actor))return reply(res,404,{error:'Active enrollment not found'});
  if(method==='GET'){
   const notes=await all('SELECT id,perspective,goal,next_action AS "nextAction",reflection,shared_at AS "sharedAt",created_at AS "createdAt" FROM organization_learning_notes WHERE organization_id=? AND participant_id=? ORDER BY created_at DESC LIMIT 50',org,actor.id);
   return reply(res,200,{notes,privacy:'Private unless explicitly shared. Reflections are never shared by this feature.'});
  }
  if(method==='POST'){
   const b=await input(req);
   const perspective=String(b.perspective||'').toLowerCase(),goal=String(b.goal||'').trim(),nextAction=String(b.nextAction||'').trim();
   if(!['observer','dreamer','alchemist','visionary'].includes(perspective)||!goal||goal.length>500||!nextAction||nextAction.length>500)return reply(res,400,{error:'Choose a perspective and enter a goal and next action (maximum 500 characters each)'});
   const id=hex();
   await run('INSERT INTO organization_learning_notes(id,organization_id,participant_id,perspective,goal,next_action) VALUES(?,?,?,?,?,?)',id,org,actor.id,perspective,goal,nextAction);
   await audit(actor.id,'organization_learning_note_created','organization',org);
   return reply(res,201,{id,privacy:'Private to participant'});
  }
  return reply(res,405,{error:'Method not allowed'});
 };
}
