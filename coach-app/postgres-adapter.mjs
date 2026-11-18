import {AsyncLocalStorage} from 'node:async_hooks';
import {createPostgresPool,withTransaction} from './postgres-store.mjs';

// Isolated development adapter. Every request uses parameterized PostgreSQL queries.
// Transaction context is scoped to the async request, not a global connection.
export function createPostgresAdapter(pool=createPostgresPool()){
  const context=new AsyncLocalStorage();
  function sql(text){
    let index=0;
    return text.replace(/\?/g,()=>'$'+(++index));
  }
  async function query(statement,...params){
    const connection=context.getStore()||pool;
    return connection.query(sql(statement),params);
  }
  return {
    pool,
    q:async(statement,...params)=>(await query(statement,...params)).rows[0]||null,
    all:async(statement,...params)=>(await query(statement,...params)).rows,
    run:async(statement,...params)=>{const result=await query(statement,...params);return {changes:result.rowCount};},
    transaction:work=>withTransaction(pool,client=>context.run(client,work)),
    close:()=>pool.end()
  };
}
