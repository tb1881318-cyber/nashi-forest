import {createServer} from 'node:http';
import pg from 'pg';
import {app} from './app.js';
import {database,schema} from './database.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
pool.on('error',()=>console.error('Database connection interrupted'));
await pool.query(schema);
const server=createServer(app(pool,database(pool)));
server.requestTimeout=20000;
server.headersTimeout=15000;
server.listen(Number(process.env.PORT??10000),'0.0.0.0',()=>console.log('Nash Forest ready'));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
 const timeout=setTimeout(()=>process.exit(1),25000);timeout.unref();
 server.close(async()=>{await pool.end();clearTimeout(timeout);process.exit(0);});
 server.closeIdleConnections();
});
