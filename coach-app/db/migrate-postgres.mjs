import {createPostgresPool,migratePostgres} from '../postgres-store.mjs';

// Manual migration command for the isolated development database.
// Never print DATABASE_URL, database credentials, or client records.
let pool;
try{
  pool=createPostgresPool();
  await migratePostgres(pool);
  console.log('Coach Studio PostgreSQL schema installed and verified.');
}catch(error){
  console.error('Coach Studio PostgreSQL migration failed:',typeof error.code==='string'&&/^[A-Z0-9_]{2,32}$/.test(error.code)?error.code:'UNKNOWN');
  process.exitCode=1;
}finally{
  await pool?.end();
}
