// Participant-owned learning notes. No professional or administrator read route.
export function createOrganizationLearningRoutes({q,all,run,hex,audit,input,reply}){
 const idOk=s=>typeof s==='string'&&/^[a-f0-9]{48}$/.test(s);
 const owner=async(org,actor)=>!!await q('SELECT 1 FROM organization_participants WHERE organization_id=? AND participant_id=? AND revoked_at IS NULL',org,actor.id);
 return async(req,res,path,method,actor)=>{
  if(actor.role!=='client')return reply(res,403,{error:'Participant account required'});
  const match=/^\/api\/organization-learning\/([a-f0-9]{48})\/notes$/.exec(path);
  if(!match)return reply(res,404,{error:'Not found'});
  const org=match[1];
  if(!await owner(org,actor))return reply(res,404,{error:'Active enrollment not found'});
  if(method==='GET'){
   const notes=await all('SELECT id,perspective,goal,next_action AS "nextAction",reflection,created_at AS "createdAt" FROM organization_learning_notes WHERE organization_id=? AND participant_id=? ORDER BY created_at DESC LIMIT 50',org,actor.id);
   return reply(res,200,{notes,privacy:'Visible only to this participant. Not shared with the organization or professional.'});
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
