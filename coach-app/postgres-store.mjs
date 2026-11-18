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
  // Schema is a single transaction; do not run on an unrelated database.
  await pool.query(sql);
  const result=await pool.query("SELECT to_regclass('public.users') AS users, to_regclass('public.journey_goals') AS goals");
  if(!result.rows[0]?.users||!result.rows[0]?.goals)throw new Error('PostgreSQL schema verification failed');
  return true;
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
