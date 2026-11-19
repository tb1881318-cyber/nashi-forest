import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,token,action,useSkill,personalSkills,publicRoom,turnView,playerAction,submitStrategy} from '../worker/game.js';
function setup(round){
 const room=createRoom(3);room.round=round;
 room.players=[1,2,3].map((seat,i)=>({seat,id:'P'+seat,secret:token(),identity:['J','Q','K'][i],hp:20,coins:30,alive:true,safe:false}));
 return room;
}
function command(room,body){action(room,{...body,operation:crypto.randomUUID()});}
function buy(room,seat=1){command(room,{action:'auction',item:0,seat,price:2,capacity:true});command(room,{action:'auction',item:1,unsold:true});return personalSkills(room,seat).cards.at(-1);}
function skill(room,seat,body){useSkill(room,room.players[seat-1].secret,{...body,operation:crypto.randomUUID()});}
test('拍卖先于计时摇号，技能成交自动入手、扣金币，鹰眼私有且只可使用一次',()=>{
 const room=setup(1);
 assert.throws(()=>command(room,{action:'timer'}),/先完成/);
 assert.throws(()=>command(room,{action:'draw'}),/先完成/);
 const card=buy(room);assert.equal(room.players[0].coins,28);
 command(room,{action:'timer'});assert.ok(room.deadline>0);
 skill(room,1,{cardId:card.id,target:2});
 assert.equal(personalSkills(room,1).intel[0].identity,'Q');
 assert.equal(personalSkills(room,2).intel.length,0);
 assert.ok(!JSON.stringify(publicRoom(room)).includes('identity'));
 assert.throws(()=>skill(room,1,{cardId:card.id,target:3}),/不可用/);
});
test('契约须自愿同意，托管3 HP；守约返还，背叛时守约者得到6 HP',()=>{
 for(const betray of [false,true]){
  const room=setup(2),card=buy(room);
  skill(room,1,{cardId:card.id,target:2});assert.equal(room.players[0].hp,20);
  const invite=personalSkills(room,2).invites[0];
  skill(room,2,{contractId:invite.id,accept:true});assert.deepEqual(room.players.slice(0,2).map(p=>p.hp),[17,17]);
  if(betray){
   command(room,{action:'hunt',a:1,b:2});assert.deepEqual(room.players.slice(0,2).map(p=>p.hp),[17,23]);
   command(room,{action:'cancelHunt'});
  }
  command(room,{action:'next'});
  assert.deepEqual(room.players.slice(0,2).map(p=>p.hp),betray?[17,23]:[20,20]);
 }
});
test('狼王分配两次额外行动，普通顺序后使用，每次仍双盲，保护区限制有效',()=>{
 const room=setup(3),card=buy(room);command(room,{action:'draw'});
 skill(room,1,{cardId:card.id,target:1,target2:2});assert.equal(room.extraTurns.length,2);
 room.events=room.players.map(p=>({round:3,aSeat:p.seat}));
 assert.equal(turnView(room).current,1);
 playerAction(room,room.players[0].secret,{action:'hunt',target:3,round:3,operation:crypto.randomUUID()});
 const id=room.pendingHunt.id;
 submitStrategy(room,room.players[0].secret,id,0);assert.equal(room.players[2].safe,false);
 submitStrategy(room,room.players[2].secret,id,1);assert.equal(room.players[2].safe,true);
 assert.equal(room.extraTurns[0].used,true);assert.equal(turnView(room).current,2);
 room.players.forEach(p=>p.safe=true);assert.equal(turnView(room).current,null);
});
test('断尾支付3 HP，刷新对局标识及双盲提交，禁止再次重定向',()=>{
 const room=setup(4),card=buy(room,2);
 command(room,{action:'hunt',a:1,b:2});const old=room.pendingHunt.id;
 submitStrategy(room,room.players[0].secret,old,0);
 skill(room,2,{cardId:card.id,target:3});
 assert.equal(room.players[1].hp,17);assert.equal(room.pendingHunt.bSeat,3);assert.notEqual(room.pendingHunt.id,old);
 assert.equal(room.pendingHunt.choices.a,null);assert.equal(room.pendingHunt.redirected,true);
 assert.throws(()=>submitStrategy(room,room.players[0].secret,old,0),/取消或更新/);
});
test('森林权杖指定实际先手，技能上限由服务端检查，过期技能不占容量',()=>{
 const room=setup(5),card=buy(room,2);
 skill(room,2,{cardId:card.id,target:3});assert.deepEqual(room.order,[3,1,2]);assert.equal(personalSkills(room,2).cards.length,0);
 const other=setup(4);other.skills=[{id:'a',type:1,round:1,seat:1,used:false},{id:'b',type:4,round:3,seat:1,used:false}];
 assert.throws(()=>buy(other),/已满两张/);
 skill(other,1,{cardId:'a',discard:true});const granted=buy(other);assert.equal(granted.type,4);
});
