import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {createPostgresPool,migratePostgres} from './postgres-store.mjs';
import {createPostgresAdapter} from './postgres-adapter.mjs';
import {createOrganizationRoutes} from './organization-routes.mjs';
import {acceptOrganizationInvitation} from './organization-accept.mjs';

test('PostgreSQL organization invitation lifecycle and isolation', {skip:!process.env.CI_ORGANIZATION_TEST_DATABASE_URL},async()=>{
 const pool=createPostgresPool({connectionString:process.env.CI_ORGANIZATION_TEST_DATABASE_URL});
 const db=createPostgresAdapter(pool);
 const id=()=>randomBytes(24).toString('hex');
 const sha=s=>createHash('sha256').update(s).digest('hex');
 const reply=(_res,status,data)=>({status,data});
 const input=req=>Promise.resolve(req.body||{});
 const audit=async(actor,event,kind,rid)=>db.run('INSERT INTO audit_events(id,actor_id,event_type,resource_type,resource_id) VALUES(?,?,?,?,?)',id(),actor,event,kind,rid);
 const user=async(email,role='coach')=>{const uid=id();await db.run('INSERT INTO users(id,email,role,password_salt,password_hash) VALUES(?,?,?,?,?)',uid,email,role,'test','test');return {id:uid,email,role}};
 try{
  await migratePostgres(pool);
  const prefix=id().slice(0,12);
  const admin=await user('admin-'+prefix+'@example.test');
  const invited=await user('invited-'+prefix+'@example.test');
  const stranger=await user('stranger-'+prefix+'@example.test');
  const client=await user('client-'+prefix+'@example.test','client');
  const opts={db,q:db.q,all:db.all,run:db.run,hex:id,sha,audit,input,reply,emailOk:s=>typeof s==='string'&&/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(s)};
  const org=createOrganizationRoutes(opts),accept=acceptOrganizationInvitation(opts);
  const created=await org({body:{name:'Fictional Learning Center'}},{},'/api/organizations','POST',admin);
  assert.equal(created.status,201);
  const orgId=created.data.id;
  const other=await org({},{},'/api/organizations/'+orgId,'GET',stranger);
  assert.equal(other.status,404);
  const forbidden=await org({body:{email:invited.email}},{},'/api/organizations/'+orgId+'/invitations','POST',stranger);
  assert.equal(forbidden.status,404);
  const invite=await org({body:{email:invited.email}},{},'/api/organizations/'+orgId+'/invitations','POST',admin);
  assert.equal(invite.status,201);
  const token=invite.data.invitationToken;
  assert.equal((await accept({body:{token}},{},client)).status,403);
  assert.equal((await accept({body:{token}},{},stranger)).status,403);
  assert.equal((await accept({body:{token}},{},invited)).status,200);
  assert.equal((await accept({body:{token}},{},invited)).status,403);
  const list=await org({},{},'/api/organizations','GET',invited);
  assert.equal(list.data.organizations.length,1);
  assert.equal(list.data.organizations[0].role,'professional');
  assert.equal((await org({},{},'/api/organizations/'+orgId+'/members','GET',invited)).status,403);
  const members=await org({},{},'/api/organizations/'+orgId+'/members','GET',admin);
  assert.equal(members.data.members.length,2);
  assert.equal(members.data.members.some(m=>m.email===invited.email),true);
 }finally{await db.close()}
});
