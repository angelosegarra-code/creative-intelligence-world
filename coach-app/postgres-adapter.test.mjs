import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresAdapter} from './postgres-adapter.mjs';

function fakePool(){
  const calls=[];
  const client={
    async query(statement,values=[]){calls.push({statement,values});return {rows:[{id:'fictional'}],rowCount:1}},
    release(){calls.push({statement:'RELEASE'})}
  };
  return {calls,async query(statement,values=[]){return client.query(statement,values)},async connect(){return client},async end(){}};
}

test('PostgreSQL adapter binds values instead of interpolating user input',async()=>{
  const pool=fakePool(),adapter=createPostgresAdapter(pool);
  const email="fictional' OR 1=1 --";
  assert.deepEqual(await adapter.q('SELECT id FROM users WHERE email=?',email),{id:'fictional'});
  assert.equal(pool.calls[0].statement,'SELECT id FROM users WHERE email=$1');
  assert.deepEqual(pool.calls[0].values,[email]);
});

test('PostgreSQL adapter returns rows and affected row counts',async()=>{
  const pool=fakePool(),adapter=createPostgresAdapter(pool);
  assert.equal((await adapter.all('SELECT id FROM users')).length,1);
  assert.deepEqual(await adapter.run('DELETE FROM sessions WHERE user_id=?','fictional'),{changes:1});
});

test('PostgreSQL adapter commits related changes together',async()=>{
  const pool=fakePool(),adapter=createPostgresAdapter(pool);
  await adapter.transaction(async()=>{
    await adapter.run('INSERT INTO journey_goals(id,client_id) VALUES (?,?)','goal','fictional');
    await adapter.run('INSERT INTO journey_goal_revisions(id,goal_id) VALUES (?,?)','revision','goal');
  });
  assert.deepEqual(pool.calls.map(call=>call.statement),[
    'BEGIN','INSERT INTO journey_goals(id,client_id) VALUES ($1,$2)',
    'INSERT INTO journey_goal_revisions(id,goal_id) VALUES ($1,$2)','COMMIT','RELEASE'
  ]);
});

test('PostgreSQL adapter rolls back on write failure',async()=>{
  const pool=fakePool(),adapter=createPostgresAdapter(pool);
  await assert.rejects(adapter.transaction(async()=>{throw Error('fictional write failed')}),/fictional write failed/);
  assert.deepEqual(pool.calls.map(call=>call.statement),['BEGIN','ROLLBACK','RELEASE']);
});
