import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {PGlite} from '@electric-sql/pglite';
import {database,schema} from '../server/database.js';
import {app} from '../server/app.js';
import {token} from '../worker/game.js';

test('Render HTTP 与真实 PostgreSQL 引擎：7 人并发注册、双盲结算、重启保留及静态页面',async()=>{
 const pg=new PGlite();await pg.exec(schema);
 const pool={async query(sql,values){const r=await pg.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows};}};
 let server;
 const start=async()=>{
  server=createServer(app(pool,database(pool)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+server.address().port;
 };
 let base=await start();
 const close=()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
 const call=async(path,body,secret)=>{
  const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(secret?{'x-game-session':secret}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,data:await res.json()};
 };
 try {
  assert.equal((await call('/healthz')).status,200);
  for(const page of ['index.html','host.html','player.html','board.html','calculator.html']) {
   const res=await fetch(base+'/'+page);assert.equal(res.status,200);
   assert.match(res.headers.get('content-type'),/text\/html/);
   const html=await res.text();assert.match(html,/纳什森林/);
   const refs=[...html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)].map(m=>m[1]).filter(x=>!x.includes(':')&&!x.startsWith('//'));
   for(const ref of new Set(refs))assert.equal((await fetch(new URL(ref,base+'/'+page))).status,200,ref);
  }
  assert.equal((await fetch(base+'/.openai/hosting.json')).status,404);
  assert.equal((await fetch(base+'/worker/game.js')).status,404);
  assert.equal((await fetch(base+'/api/rooms',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{"count":7}'})).status,403);
  const created=await call('/api/rooms',{count:7});assert.equal(created.status,201);
  const path='/api/rooms/'+created.data.room;
  const secrets=Array.from({length:7},()=>token());
  const joins=await Promise.all(secrets.map((secret,i)=>call(path+'/join',{id:'参与'+i,secret})));
  assert.ok(joins.every(r=>r.status===200));
  assert.equal(new Set(joins.map(r=>r.data.seat)).size,7);
  const host=created.data.hostToken;
  const a=secrets[joins.findIndex(r=>r.data.seat===1)],b=secrets[joins.findIndex(r=>r.data.seat===7)];
  const action=body=>call(path+'/action',{...body,operation:crypto.randomUUID()},host);
  const duel=(await action({action:'hunt',a:1,b:7})).data.pendingHunt.id;
  assert.equal((await call(path+'/strategy',{encounterId:duel,choice:0},a)).status,200);
  const other=(await call(path+'/me',undefined,b)).data;
  assert.equal(other.duel.choice,null);assert.equal(other.state.pendingHunt.choices,undefined);
  assert.ok(other.state.players.every(p=>p.hp===30&&!p.identity&&!p.secret));
  await call(path+'/strategy',{encounterId:duel,choice:1},b);
  const final=(await call(path)).data;assert.equal(final.events.length,1);
  assert.equal(final.events[0].gainA+final.events[0].gainB,0);
  await call(path+'/strategy',{encounterId:duel,choice:1},b);
  assert.equal((await call(path)).data.events.length,1);
  await close();base=await start();
  const restored=(await call(path)).data;delete restored.serverTime;delete final.serverTime;assert.deepEqual(restored,final);
  const me=(await call(path+'/me',undefined,a)).data;
  assert.ok(['J','Q','K'].includes(me.identity));assert.equal(me.hpHistory.length,1);
 } finally {await close();await pg.close();}
});

test('Netlify 函数适配保持对局和双盲隐私',async()=>{
 const {netlifyHandler}=await import('../server/netlify.js');
 const pg=new PGlite();await pg.exec(schema);
 const pool={async query(sql,values){const r=await pg.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows};}};
 const handle=netlifyHandler(pool);
 const call=async(path,body,secret)=>{
  const res=await handle(new Request('https://test.netlify.app/api'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(secret?{'x-game-session':secret}:{})},body:body?JSON.stringify(body):undefined}));
  return {status:res.status,data:await res.json()};
 };
 try{
  const room=await call('/rooms',{count:7});assert.equal(room.status,201);
  const path='/rooms/'+room.data.room;
  const secrets=Array.from({length:7},()=>token());
  const joins=await Promise.all(secrets.map((secret,i)=>call(path+'/join',{id:'N'+i,secret})));
  assert.ok(joins.every(r=>r.status===200));
  const a=secrets[joins.findIndex(r=>r.data.seat===1)],b=secrets[joins.findIndex(r=>r.data.seat===2)];
  const start=await call(path+'/action',{action:'hunt',a:1,b:2,operation:crypto.randomUUID()},room.data.hostToken);
  const encounterId=start.data.pendingHunt.id;
  await call(path+'/strategy',{encounterId,choice:1},a);
  const before=(await call(path+'/me',undefined,b)).data;
  assert.equal(before.duel.choice,null);assert.equal(before.state.pendingHunt.choices,undefined);
  assert.ok(before.state.players.every(p=>p.hp===30&&!p.identity));
  await call(path+'/strategy',{encounterId,choice:0},b);
  const final=(await call(path)).data;assert.equal(final.events.length,1);
  assert.equal(final.events[0].gainA+final.events[0].gainB,0);
 }finally{await pg.close();}
});
