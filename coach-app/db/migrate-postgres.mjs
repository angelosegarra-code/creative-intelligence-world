import {createPostgresPool,migratePostgres} from '../postgres-store.mjs';

// Manual migration command for the isolated development database.
// Never print DATABASE_URL, database credentials, or client records.
const pool=createPostgresPool();
try{
  await migratePostgres(pool);
  console.log('Coach Studio PostgreSQL schema installed and verified.');
}catch(error){
  console.error('Coach Studio PostgreSQL migration failed:',error.code||error.message);
  process.exitCode=1;
}finally{
  await pool.end();
}
