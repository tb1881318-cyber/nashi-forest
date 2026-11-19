import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {api} from '../worker/api.js';
import {createRoom,publicRoom,action,token} from '../worker/game.js';

function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
 return {
  prepare(sql) {
   return {
    bind(...args) {
     return {
      async first() { return sqlite.prepare(sql).get(...args); },
      async run() {
       const result=sqlite.prepare(sql).run(...args);
       return {meta:{changes:Number(result.changes)}};
      }
     };
    }
   };
  }
 };
}
async function call(db,path,body,secret){
 const response=await api(new Request('https://test.local/api'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(secret?{'x-game-session':secret}:{})},body:body?JSON.stringify(body):undefined}),{DB:db});
 return {status:response.status,data:await response.json()};
}
test('并发注册 7 人，重复提交、重名与超员处理，身份只在个人接口返回',async()=>{
 const db=database();
 const {data:created}=await call(db,'/rooms',{count:7});
 assert.match(created.room,/^\d{4}$/);
 const room='/rooms/'+created.room;
 const secrets=Array.from({length:8},()=>token());
 const registered=await Promise.all(secrets.slice(0,7).map((secret,i)=>call(db,room+'/join',{id:'玩家'+(i+1),secret})));
 assert.ok(registered.every(r=>r.status===200));
 assert.equal(new Set(registered.map(r=>r.data.seat)).size,7);
 const same=await call(db,room+'/join',{id:'玩家1',secret:secrets[0]});
 assert.equal(same.data.seat,registered[0].data.seat);
 const extra=await call(db,room+'/join',{id:'第八人',secret:secrets[7]});
 assert.equal(extra.status,400);
 const publicState=await call(db,room);
 assert.equal(publicState.data.players.length,7);
 assert.equal(publicState.data.count,7);
 for(const p of publicState.data.players){assert.equal(p.identity,undefined);assert.equal(p.secret,undefined);}
 const privateStates=await Promise.all(secrets.slice(0,7).map(s=>call(db,room+'/me',undefined,s)));
 assert.deepEqual(['J','Q','K'].map(id=>privateStates.filter(p=>p.data.identity===id).length).sort(),[2,2,3]);
 assert.equal((await call(db,room+'/me',undefined,token())).status,401);
 const hunt={action:'hunt',a:1,b:7,operation:crypto.randomUUID()};
 assert.equal((await call(db,room+'/action',hunt,token())).status,403);
 const first=await call(db,room+'/action',hunt,created.hostToken);
 assert.equal(first.status,200);
 const second=await call(db,room+'/action',hunt,created.hostToken);
 assert.equal(second.data.events.length,0);
 assert.equal(second.data.pendingHunt.id,first.data.pendingHunt.id);
 assert.deepEqual(second.data.players,first.data.players);
 const encounterId=first.data.pendingHunt.id;
 const aSecret=secrets[registered.findIndex(r=>r.data.seat===1)];
 const bSecret=secrets[registered.findIndex(r=>r.data.seat===7)];
 await call(db,room+'/strategy',{encounterId,choice:0},aSecret);
 await call(db,room+'/strategy',{encounterId,choice:1},bSecret);
 const resolved=(await call(db,room)).data;
 const event=resolved.events[0];
 assert.equal(event.aRole,undefined);assert.equal(event.bRole,undefined);assert.equal(event.identity,undefined);
 assert.equal(event.gainA+event.gainB,0);
 assert.ok(event.at>0);assert.equal(event.bSeat,7);
 assert.equal(resolved.players.find(p=>p.seat===7).safe,true);
 const invalid=await call(db,room+'/action',{...hunt,operation:crypto.randomUUID()},created.hostToken);
 assert.equal(invalid.status,400);
});
test('人数 3–12，抽起点、绕回第七座与保护重置',()=>{
 for(let count=3;count<=12;count++){
  const room=createRoom(count);
  assert.equal(room.deck.length,count);
  const counts=['J','Q','K'].map(id=>room.deck.filter(x=>x===id).length);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
 }
 const room=createRoom(7);
 room.players=Array.from({length:7},(_,i)=>({id:'P'+i,seat:i+1,identity:room.deck[i],secret:token(),hp:20,coins:15,safe:true,alive:true}));
 room.players[6].alive=false;
 room.round=5;room.sales[0]={seat:1};
 action(room,{action:'draw',first:7,operation:crypto.randomUUID()});
 assert.deepEqual(room.order,[1,2,3,4,5,6]);
 assert.ok(!JSON.stringify(publicRoom(room)).includes('identity'));
 room.round=1;
 action(room,{action:'next',operation:crypto.randomUUID()});
 assert.ok(room.players.every(p=>!p.safe));
 assert.equal(room.round,2);
 assert.equal(room.players[0].coins,20);
});
test('拍卖和捕食自动同步全员 HP，个人保留每轮开局、拍卖后和轮末数值',async()=>{
 const db=database();
 const {data:created}=await call(db,'/rooms',{count:3});
 assert.match(created.room,/^\d{4}$/);
 const room='/rooms/'+created.room;
 const secrets=Array.from({length:3},()=>token());
 for(let i=0;i<3;i++)assert.equal((await call(db,room+'/join',{id:'HP'+i,secret:secrets[i]})).status,200);
 const command=async body=>{
  const result=await call(db,room+'/action',{...body,operation:crypto.randomUUID()},created.hostToken);
  assert.equal(result.status,200);
  return result.data;
 };
 await command({action:'auction',item:0,unsold:true});
 const auction=await command({action:'auction',item:1,seat:1,price:1});
 assert.deepEqual(auction.players.map(p=>p.hp),[23,20,20]);
 assert.equal(auction.lastSettlement.kind,'auction');
 assert.deepEqual(auction.lastSettlement.players.map(p=>p.hp),[23,20,20]);
 let me=(await call(db,room+'/me',undefined,secrets[0])).data;
 assert.equal(me.hpHistory[0].start,20);
 assert.equal(me.hpHistory[0].afterAuction,23);
 const pending=await command({action:'hunt',a:1,b:2});
 const encounterId=pending.pendingHunt.id;
 await call(db,room+'/strategy',{encounterId,choice:0},secrets[0]);
 await call(db,room+'/strategy',{encounterId,choice:1},secrets[1]);
 const hunt=(await call(db,room)).data;
 const event=hunt.events[0];
 me=(await call(db,room+'/me',undefined,secrets[0])).data;
 assert.equal(me.hp,23+event.gainA);
 assert.equal(me.hpHistory[0].current,me.hp);
 assert.equal(me.hpHistory[0].afterAuction,23);
 assert.equal(hunt.lastSettlement.players.length,3);
 await command({action:'next'});
 me=(await call(db,room+'/me',undefined,secrets[0])).data;
 assert.equal(me.hpHistory.length,2);
 assert.equal(me.hpHistory[0].end,23+event.gainA);
 assert.equal(me.hpHistory[0].complete,true);
 assert.equal(me.hpHistory[1].start,me.hpHistory[0].end);
 assert.equal(me.hpHistory[1].afterAuction,null);
 const other=(await call(db,room+'/me',undefined,secrets[2])).data;
 assert.equal(other.hpHistory[0].end,20);
 assert.ok(!JSON.stringify(hunt.lastSettlement).includes('identity'));
});
test('旧局生命记录从当前值开始，已缺失的开局值不伪造',()=>{
 const room=createRoom(3);
 delete room.hpRounds;
 room.players=[{id:'旧玩家',seat:1,identity:'J',secret:token(),hp:17,coins:5,alive:true,safe:false}];
 action(room,{action:'adjust',seat:1,hp:21,coins:5,operation:crypto.randomUUID()});
 const entry=room.hpRounds[0].players[0];
 assert.equal(entry.start,null);
 assert.equal(entry.current,21);
});
test('仅主持人身份接口返回全员身份，公共与操作返回不泄露身份',async()=>{
 const db=database();
 const {data:created}=await call(db,'/rooms',{count:3});
 assert.match(created.room,/^\d{4}$/);
 const room='/rooms/'+created.room;
 for(let i=0;i<3;i++)await call(db,room+'/join',{id:'身份验收'+i,secret:token()});
 assert.equal((await call(db,room+'/host')).status,403);
 assert.equal((await call(db,room+'/host',undefined,token())).status,403);
 const host=(await call(db,room+'/host',undefined,created.hostToken)).data;
 assert.equal(host.players.length,3);
 assert.ok(host.players.every(p=>['J','Q','K'].includes(p.identity)&&!p.secret));
 const board=(await call(db,room)).data;
 assert.ok(board.players.every(p=>!p.identity&&!p.secret));
 const result=await call(db,room+'/action',{action:'hunt',a:1,b:2,operation:crypto.randomUUID()},created.hostToken);
 assert.equal(result.status,200);
 assert.ok(result.data.players.every(p=>!p.identity&&!p.secret));
 assert.equal(result.data.events.length,0);
 assert.ok(result.data.pendingHunt);
});
test('旧六位对局号仍可访问',async()=>{
 const db=database();
 const room=createRoom(7);
 await db.prepare('INSERT INTO rooms (id,data,version) VALUES (?,?,0)').bind('123456',JSON.stringify(room)).run();
 const legacy=await call(db,'/rooms/123456');
 assert.equal(legacy.status,200);
 assert.equal(legacy.data.count,7);
 assert.equal((await call(db,'/rooms/12345')).status,404);
});
test('双盲策略只有自己可见，全部锁定前不结算，重复提交只结算一次',async()=>{
 const db=database();
 const {data:created}=await call(db,'/rooms',{count:3});
 const room='/rooms/'+created.room;
 const secrets=[token(),token(),token()];
 for(let i=0;i<3;i++)await call(db,room+'/join',{id:'双盲'+i,secret:secrets[i]});
 const command=body=>call(db,room+'/action',{...body,operation:crypto.randomUUID()},created.hostToken);
 assert.equal((await command({action:'hunt',a:1,b:2,row:0,column:1})).status,400);
 const started=await command({action:'hunt',a:1,b:2});
 const encounterId=started.data.pendingHunt.id;
 const aChoice=await call(db,room+'/strategy',{encounterId,choice:0},secrets[0]);
 assert.equal(aChoice.status,200);
 assert.equal(aChoice.data.duel.choice,0);
 assert.deepEqual(aChoice.data.state.players.map(p=>p.hp),[20,20,20]);
 assert.equal(aChoice.data.state.events.length,0);
 const bBefore=(await call(db,room+'/me',undefined,secrets[1])).data;
 assert.equal(bBefore.duel.choice,null);
 assert.equal(bBefore.state.pendingHunt.submittedA,true);
 assert.equal(bBefore.state.pendingHunt.submittedB,false);
 for(const path of [room,room+'/host']){
  const visible=(await call(db,path,undefined,path.endsWith('/host')?created.hostToken:undefined)).data;
  assert.equal(visible.pendingHunt.choices,undefined);
  assert.equal(visible.pendingHunt.choice,undefined);
  assert.equal(visible.pendingHunt.row,undefined);
  assert.equal(visible.pendingHunt.column,undefined);
 }
 assert.equal((await call(db,room+'/strategy',{encounterId,choice:1},secrets[2])).status,403);
 assert.equal((await call(db,room+'/strategy',{encounterId,choice:1},created.hostToken)).status,401);
 assert.equal((await call(db,room+'/strategy',{encounterId,choice:1},secrets[0])).status,409);
 assert.equal((await command({action:'next'})).status,409);
 assert.equal((await command({action:'hunt',a:3,b:2})).status,409);
 const bChoice=await call(db,room+'/strategy',{encounterId,choice:1},secrets[1]);
 assert.equal(bChoice.status,200);
 assert.equal(bChoice.data.state.pendingHunt,null);
 assert.equal(bChoice.data.state.events.length,1);
 assert.equal(bChoice.data.state.events[0].row,0);
 assert.equal(bChoice.data.state.events[0].column,1);
 const repeat=await call(db,room+'/strategy',{encounterId,choice:1},secrets[1]);
 assert.equal(repeat.data.state.events.length,1);
 assert.deepEqual(repeat.data.state.players,bChoice.data.state.players);
});
test('双人同时提交、取消后迟到提交与下一场隔离',async()=>{
 const db=database();
 const {data:created}=await call(db,'/rooms',{count:3});
 const room='/rooms/'+created.room;
 const secrets=[token(),token(),token()];
 for(let i=0;i<3;i++)await call(db,room+'/join',{id:'同步'+i,secret:secrets[i]});
 const command=body=>call(db,room+'/action',{...body,operation:crypto.randomUUID()},created.hostToken);
 const old=(await command({action:'hunt',a:1,b:2})).data.pendingHunt.id;
 await call(db,room+'/strategy',{encounterId:old,choice:0},secrets[0]);
 await command({action:'cancelHunt'});
 const next=(await command({action:'hunt',a:1,b:2})).data.pendingHunt.id;
 assert.notEqual(old,next);
 assert.equal((await call(db,room+'/strategy',{encounterId:old,choice:0},secrets[1])).status,409);
 const results=await Promise.all([
  call(db,room+'/strategy',{encounterId:next,choice:1},secrets[0]),
  call(db,room+'/strategy',{encounterId:next,choice:0},secrets[1])
 ]);
 assert.ok(results.every(r=>r.status===200));
 const final=(await call(db,room)).data;
 assert.equal(final.events.length,1);
 assert.equal(final.events[0].encounterId,next);
 assert.equal(final.events[0].row,1);
 assert.equal(final.events[0].column,0);
 assert.equal(final.pendingHunt,null);
});
