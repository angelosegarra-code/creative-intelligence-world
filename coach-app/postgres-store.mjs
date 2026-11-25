import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import pg from 'pg';

const here=dirname(fileURLToPath(import.meta.url));

/**
 * Pilot PostgreSQL connection. Never log DATABASE_URL or query parameters.
 * Render's internal connection URL is configured only in service environment.
 */
export function createPostgresPool({connectionString=process.env.DATABASE_URL}={}){
  if(!connectionString)throw new Error('DATABASE_URL is not configured');
  const parsed=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('DATABASE_URL must be PostgreSQL');
  return new pg.Pool({connectionString,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
}

export async function migratePostgres(pool){
  const sql=await readFile(join(here,'db/postgres-schema.sql'),'utf8');
  const organizations=await readFile(join(here,'db/organizations.sql'),'utf8');
  return withTransaction(pool,async client=>{
    // Serialize schema initialization by app instances using the same database.
    await client.query('SELECT pg_advisory_xact_lock(184320947, 1)');
    await client.query(sql);
    await client.query(organizations);
    const result=await client.query("SELECT to_regclass('public.users') AS users, to_regclass('public.journey_goals') AS goals, to_regclass('public.organization_learning_feedback') AS feedback");
    if(!result.rows[0]?.users||!result.rows[0]?.goals||!result.rows[0]?.feedback)throw new Error('PostgreSQL schema verification failed');
    return true;
  });
}

export async function withTransaction(pool,work){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await work(client);
    await client.query('COMMIT');
    return result;
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
  }
}
