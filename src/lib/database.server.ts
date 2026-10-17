// Compatibility layer preserves the verified domain operations while using PostgreSQL.
// Only application-owned SQL passes here; all variable values remain bound parameters.
export type QueryResult={rows:any[];rowCount:number|null};
export type Connection={query:(sql:string,args?:any[])=>Promise<QueryResult>;release?:()=>void};
export type PoolLike=Connection&{connect:()=>Promise<Connection>};
export function postgresSQL(sql:string){let i=0;let quoted=false;let out='';for(let p=0;p<sql.length;p++){const c=sql[p];if(c==="'"){if(quoted&&sql[p+1]==="'"){out+="''";p++;continue;}quoted=!quoted;}out+=c==='?'&&!quoted?'$'+(++i):c;}if(/^INSERT OR IGNORE /i.test(out))out=out.replace(/^INSERT OR IGNORE /i,'INSERT ')+' ON CONFLICT DO NOTHING';return out;}
export class Statement {
 constructor(readonly db:Database,readonly sql:string,readonly args:any[]=[]){ }
 bind(...args:any[]){return new Statement(this.db,this.sql,args);}
 async first<T=any>():Promise<T|null>{return (await this.db.query(this.sql,this.args)).rows[0]||null;}
 async all<T=any>():Promise<{results:T[]}>{return {results:(await this.db.query(this.sql,this.args)).rows};}
 async run(){return {meta:{changes:(await this.db.query(this.sql,this.args)).rowCount||0}};}
}
export class Database {
 constructor(readonly pool:PoolLike,readonly connection?:Connection){}
 prepare(sql:string){return new Statement(this,sql);}
 async query(sql:string,args:any[]=[]){return (this.connection||this.pool).query(postgresSQL(sql),args);}
 async batch(items:Statement[]){return this.transaction(async db=>{const result=[];for(const s of items)result.push(await db.prepare(s.sql).bind(...s.args).run());return result;});}
 async transaction<T>(work:(db:Database)=>Promise<T>,lock?:string):Promise<T>{
  if(this.connection){const savepoint='sp_'+crypto.randomUUID().replaceAll('-','');await this.connection.query('SAVEPOINT '+savepoint);try{const r=await work(this);await this.connection.query('RELEASE SAVEPOINT '+savepoint);return r;}catch(e){await this.connection.query('ROLLBACK TO SAVEPOINT '+savepoint);await this.connection.query('RELEASE SAVEPOINT '+savepoint);throw e;}}
  const client=await this.pool.connect();try{await client.query('BEGIN');if(lock)await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);const r=await work(new Database(this.pool,client));await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release?.();}
 }
}
