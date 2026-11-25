import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const sqlite=readFileSync(join(here,'db/schema.sql'),'utf8');
const postgres=readFileSync(join(here,'db/postgres-schema.sql'),'utf8');

function tables(sql){
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map(m=>m[1]).sort();
}

test('PostgreSQL pilot schema includes every existing SQLite table',()=>{
  assert.deepEqual(tables(postgres),[...tables(sqlite),'coach_demo_invites'].sort());
});

test('PostgreSQL pilot schema retains consent, uniqueness and ownership constraints',()=>{
  assert.match(postgres,/PRIMARY KEY\s*\(client_id,coach_id\)/);
  assert.match(postgres,/PRIMARY KEY\s*\(goal_id,coach_id\)/);
  assert.match(postgres,/email TEXT NOT NULL UNIQUE/);
  assert.match(postgres,/token_hash TEXT PRIMARY KEY/);
  assert.match(postgres,/REFERENCES journey_goals\(id\)/);
  assert.match(postgres,/REFERENCES users\(id\)/);
});

test('PostgreSQL schema uses native timestamps and avoids SQLite-only directives',()=>{
  assert.doesNotMatch(postgres.replace(/^--.*$/gm,''),/\bPRAGMA\b/);
  assert.doesNotMatch(postgres,/\bAUTOINCREMENT\b/);
  assert.match(postgres,/TIMESTAMPTZ/);
  assert.doesNotMatch(postgres,/^\s*(?:BEGIN|COMMIT);/m);
});
