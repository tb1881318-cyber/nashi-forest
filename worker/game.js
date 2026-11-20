export const matrices = [
 [[[6,-6],[-4,4]],[[-2,2],[4,-4]]],
 [[[3,-3],[-6,6]],[[-4,4],[2,-2]]],
 [[[4,-4],[-3,3]],[[-3,3],[4,-4]]]
];
const beats={J:'Q',Q:'K',K:'J'};
export const randomInt=n=>{
 const bound=2**32-(2**32%n);
 let value;
 do { value=crypto.getRandomValues(new Uint32Array(1))[0]; } while(value>=bound);
 return value%n;
};
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function integer(value,min,max) {
 if (!Number.isInteger(value)||value<min||value>max) fail('请输入有效的整数');
 return value;
}
export function createRoom(count) {
 integer(count,3,12);
 const deck=Array.from({length:Math.floor(count/3)},()=>['J','Q','K']).flat();
 const remainder=['J','Q','K'];
 while(deck.length<count) deck.push(remainder.splice(randomInt(remainder.length),1)[0]);
 for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {count,hostToken:token(),deck,players:[],hpRounds:[],lastSettlement:null,pendingHunt:null,round:1,done:false,events:[],order:[],drawn:null,
 initialHp:30,drawHistory:[],sales:[null,null],deadline:0,left:240000,processed:[],config:{initial:10,stipend:5},scepterUsed:false};
}
export function syncHpRound(room, stage='current') {
 const legacy = !room.hpRounds;
 room.hpRounds ??= [];
 let record=room.hpRounds.find(r=>r.round===room.round);
 if(!record){
  record={round:room.round,complete:false,players:[]};
  room.hpRounds.push(record);
 }
 for(const p of room.players){
  let entry=record.players.find(row=>row.seat===p.seat);
  if(!entry){
   entry={seat:p.seat,start:legacy?null:p.hp,afterAuction:null,current:p.hp,end:null};
   record.players.push(entry);
  }
  entry.current=p.hp;
  if(stage==='auction')entry.afterAuction=p.hp;
  if(stage==='end')entry.end=p.hp;
 }
 if(stage==='end')record.complete=true;
}
export function personalHpHistory(room, seat) {
 return (room.hpRounds??[]).map(record=>{
  const row=record.players.find(p=>p.seat===seat);
  return row ? {round:record.round,complete:record.complete,...row} : null;
 }).filter(Boolean);
}
function settle(room,kind,now,before) {
 syncHpRound(room,kind==='auction'?'auction':'current');
 room.lastSettlement={kind,round:room.round,at:now,players:room.players.map(p=>({
  seat:p.seat,id:p.id,hp:p.hp,change:p.hp-(before.get(p.seat)??p.hp)
 }))};
}
export function pendingHuntView(room) {
 const hunt=room.pendingHunt;
 if(!hunt)return null;
 return {
  id:hunt.id,a:hunt.a,b:hunt.b,aSeat:hunt.aSeat,bSeat:hunt.bSeat,
  submittedA:hunt.choices.a!==null,submittedB:hunt.choices.b!==null
 };
}
export function personalDuel(room,seat) {
 const hunt=room.pendingHunt;
 if(!hunt||![hunt.aSeat,hunt.bSeat].includes(seat))return null;
 const isA=hunt.aSeat===seat;
 const choice=hunt.choices[isA?'a':'b'];
 return {id:hunt.id,role:isA?'A':'B',opponent:isA?hunt.b:hunt.a,submitted:choice!==null,choice};
}
export function submitStrategy(room,secret,encounterId,choice,now=Date.now()) {
 const player=room.players.find(p=>p.secret===secret);
 if(!player)fail('请使用自己的玩家台提交策略',401);
 const completed=room.events.find(event=>event.encounterId===encounterId);
 if(completed){
  if(![completed.aSeat,completed.bSeat].includes(player.seat))fail('你不在这场捕食中',403);
  return;
 }
 const hunt=room.pendingHunt;
 if(!hunt||hunt.id!==encounterId)fail('本场捕食已取消或更新，请查看当前提示',409);
 if(![hunt.aSeat,hunt.bSeat].includes(player.seat))fail('你不在这场捕食中',403);
 integer(choice,0,1);
 const role=player.seat===hunt.aSeat?'a':'b';
 if(hunt.choices[role]!==null){
  if(hunt.choices[role]!==choice)fail('策略已经锁定，双方揭晓前不能修改',409);
  return;
 }
 hunt.choices[role]=choice;
 if(hunt.choices.a===null||hunt.choices.b===null)return;
 const a=room.players.find(p=>p.seat===hunt.aSeat);
 const b=room.players.find(p=>p.seat===hunt.bSeat);
 const before=new Map(room.players.map(p=>[p.seat,p.hp]));
 const row=hunt.choices.a,column=hunt.choices.b;
 const type=a.identity===b.identity?2:beats[a.identity]===b.identity?0:1;
 const [gainA,gainB]=matrices[type][row][column];
 a.hp+=gainA;b.hp+=gainB;
 if(gainA<0)a.safe=true;if(gainB<0)b.safe=true;
 room.events.push({encounterId:hunt.id,round:room.round,at:now,a:a.id,b:b.id,aSeat:a.seat,bSeat:b.seat,row,column,gainA,gainB});
 if(hunt.extraId){const extra=room.extraTurns.find(e=>e.id===hunt.extraId);extra.used=true;extra.targetSeat=b.seat;}
 room.pendingHunt=null;
 settle(room,'hunt',now,before);
}
export const skillNames=['鹰眼','生死契约','狼王','断尾求生','森林权杖'];
function initializeSkills(room){
 room.skills??=[];room.skillOps??=[];room.skillLog??=[];room.contracts??=[];room.extraTurns??=[];
 // Recover skill ownership from already recorded auctions without granting twice.
 if(room.sales[0]?.seat&&!room.skills.some(c=>c.round===room.round))room.skills.push({id:token(),type:room.round,round:room.round,seat:room.sales[0].seat,used:false});
}
function skillLive(room,c){return !c.used&&(![2,3,5].includes(c.type)||c.round===room.round);}
export function personalSkills(room,seat){
 initializeSkills(room);
 return {cards:room.skills.filter(c=>c.seat===seat&&skillLive(room,c)).map(c=>({...c,name:skillNames[c.type-1]})),
 intel:room.skills.filter(c=>c.seat===seat&&c.intel).map(c=>c.intel),
 invites:room.contracts.filter(c=>c.to===seat&&c.round===room.round&&c.status==='invited')};
}
function breach(room,a,b){
 for(const c of room.contracts??[])if(c.round===room.round&&c.status==='active'&&[c.from,c.to].includes(a)&&[c.from,c.to].includes(b)){
  c.status='betrayed';c.betrayer=a;
  room.players.find(p=>p.seat===b).hp+=6;
  room.skillLog.push({round:room.round,text:a+'号背叛契约，'+b+'号获得6 HP保证金'});
 }
}
export function useSkill(room,secret,body,now=Date.now()){
 initializeSkills(room);
 const player=room.players.find(p=>p.secret===secret);
 if(!player)fail('请使用自己的玩家台',401);
 if(room.skillOps.includes(body.operation))return;
 if(room.done||!player.alive)fail('当前不能使用技能');
 const before=new Map(room.players.map(p=>[p.seat,p.hp]));
 if(body.accept!==undefined){
  const c=room.contracts.find(c=>c.id===body.contractId&&c.to===player.seat&&c.round===room.round&&c.status==='invited');
  if(!c)fail('邀请已失效');
  const owner=room.players.find(p=>p.seat===c.from);
  if(body.accept===true){
   if(!room.sales.every(Boolean)||room.order.length||!owner.alive||owner.hp<3||player.hp<3)fail('契约需在拍卖结束后的谈判阶段同意，双方至少有3 HP');
   owner.hp-=3;player.hp-=3;c.status='active';
  }else c.status='declined';
 }else{
  const card=room.skills.find(c=>c.id===body.cardId&&c.seat===player.seat&&skillLive(room,c));
  if(!card)fail('技能不可用');
  if(body.discard===true){card.used=true;card.discarded=true;}
  else{
   const target=room.players.find(p=>p.seat===body.target&&p.alive);
   if(card.type===1){
    if(!target||target===player)fail('请选择其他存活玩家');
    card.intel={seat:target.seat,id:target.id,identity:target.identity};card.used=true;
   }else if(card.type===2){
    if(!room.sales.every(Boolean)||room.order.length||!target||target===player)fail('请在拍卖结束后的谈判阶段选择其他存活玩家');
    room.contracts.push({id:token(),round:room.round,from:player.seat,to:target.seat,status:'invited'});card.used=true;
   }else if(card.type===3){
    if(!room.order.length)fail('请先等待摇号');
    const recipients=[body.target,body.target2].map(seat=>room.players.find(p=>p.seat===seat&&p.alive));
    if(recipients.some(p=>!p))fail('请选择两次机会的使用者');
    for(const p of recipients)room.extraTurns.push({id:token(),round:room.round,seat:p.seat,cardId:card.id,used:false});card.used=true;
   }else if(card.type===4){
    const h=room.pendingHunt;
    if(!h||h.bSeat!==player.seat||h.redirected)fail('仅在被捕食时可用，不可连续转移');
    if(player.hp<3||!target||target===player||target.seat===h.aSeat||target.safe)fail('需3 HP，并选择合法新目标');
    player.hp-=3;
    room.pendingHunt={...h,id:token(),b:target.id,bSeat:target.seat,choices:{a:null,b:null},redirected:true};card.used=true;
    breach(room,h.aSeat,target.seat);
   }else if(card.type===5){
    if(!target)fail('请选择存活玩家');
    action(room,{action:'draw',first:target.seat,operation:body.operation},now);card.used=true;
   }
  }
  if(!card.intel)room.skillLog.push({round:room.round,text:player.seat+'号'+(card.discarded?'放弃':'使用')+skillNames[card.type-1]});
 }
 room.skillOps.push(body.operation);room.skillOps=room.skillOps.slice(-100);
 settle(room,'skill',now,before);
}
function wolfTargets(room,extra){return (room.extraTurns??[]).filter(e=>e.round===room.round&&e.used&&e.targetSeat&&(extra.cardId?e.cardId===extra.cardId:true)).map(e=>e.targetSeat);}
export function turnView(room) {
 const completed=new Set([
  ...room.events.filter(e=>e.round===room.round).map(e=>e.aSeat),
  ...(room.passes??[]).filter(e=>e.round===room.round).map(e=>e.seat)
 ]);
 const remaining=room.order.filter(seat=>!completed.has(seat)&&room.players.some(p=>p.seat===seat&&p.alive));
 const deferred=(room.deferredTurns??[]).filter(e=>e.round===room.round);
 const rank=seat=>{const i=deferred.findLastIndex(e=>e.seat===seat);return i<0?-1:i;};
 remaining.sort((a,b)=>rank(a)-rank(b));
 const extra=(room.extraTurns??[]).filter(e=>e.round===room.round&&!e.used&&room.players.some(p=>p.seat===e.seat&&p.alive)&&room.players.some(p=>p.alive&&p.seat!==e.seat&&!wolfTargets(room,e).includes(p.seat)));
 return {excludedTargets:remaining.length||!extra.length?[]:wolfTargets(room,extra[0]),ready:room.order.length>0,current:room.done?null:remaining[0]??extra[0]?.seat??null,extraId:remaining.length?null:extra[0]?.id??null,remaining:[...remaining,...extra.map(e=>e.seat)],completed:[...completed]};
}
export function playerAction(room,secret,body,now=Date.now()) {
 const player=room.players.find(p=>p.secret===secret);
 if(!player)fail('请使用自己的玩家台操作',401);
 room.playerOperations??=[];
 if(room.playerOperations.includes(body.operation))return;
 if(room.done||!player.alive)fail('当前不能行动',409);
 if(body.round!==room.round)fail('轮次已更新，请刷新玩家台',409);
 if(room.pendingHunt)fail('请等待当前捕食结算',409);
 const turn=turnView(room);
 if(!turn.ready)fail('等待主持人摇号',409);
 if(turn.current!==player.seat)fail('未到你的次序',403);
 if(body.action==='hunt') {
  action(room,{action:'hunt',a:player.seat,b:body.target,operation:body.operation},now);
  if(turn.extraId)room.pendingHunt.extraId=turn.extraId;
 } else if(body.action==='defer') {
  room.deferredTurns??=[];
  room.deferredTurns.push({round:room.round,seat:player.seat,at:now});
  if(turn.extraId){const i=room.extraTurns.findIndex(e=>e.id===turn.extraId);room.extraTurns.push(...room.extraTurns.splice(i,1));}
 } else if(body.action==='pass') {
  const before=new Map(room.players.map(p=>[p.seat,p.hp]));
  const legal=room.players.some(p=>p.alive&&p.seat!==player.seat&&!p.safe);
  if(legal)player.hp-=2;
  if(turn.extraId)room.extraTurns.find(e=>e.id===turn.extraId).used=true;
  room.passes??=[];
  room.passes.push({round:room.round,seat:player.seat,id:player.id,at:now,cost:legal?2:0});
  settle(room,'pass',now,before);
 } else fail('未知玩家操作');
 room.playerOperations.push(body.operation);room.playerOperations=room.playerOperations.slice(-100);
}
export function transferHp(room,secret,body,now=Date.now()){
 const from=room.players.find(p=>p.secret===secret);
 if(!from)fail('请使用自己的玩家台转让生命值',401);
 room.transfers??=[];
 if(room.transfers.some(t=>t.id===body.operation&&t.fromSeat===from.seat))return;
 if(room.done||!from.alive)fail('对局结束或淘汰后不能转让');
 if(body.round!==room.round)fail('轮次已更新，请重新确认转让',409);
 const to=room.players.find(p=>p.seat===body.target&&p.alive);
 if(!to||to===from)fail('请选择另一名未淘汰玩家');
 const amount=integer(body.amount,1,1000000);
 if(amount>from.hp)fail('转让数量不能超过当前可用生命值');
 const before=new Map(room.players.map(p=>[p.seat,p.hp]));
 from.hp-=amount;to.hp+=amount;
 room.transfers.push({id:body.operation,round:room.round,at:now,fromSeat:from.seat,toSeat:to.seat,from:from.id,to:to.id,amount});
 settle(room,'transfer',now,before);
}
export function publicRoom(room) {
 initializeSkills(room);
 return {transfers:room.transfers??[],skillLog:room.skillLog,contracts:room.contracts,phase:!room.sales.every(Boolean)?'拍卖':room.order.length?'行动':'谈判与摇号',count:room.count,players:room.players.map(({secret,identity,...p})=>p),
 turn:turnView(room),passes:room.passes??[],pendingHunt:pendingHuntView(room),round:room.round,done:room.done,events:room.events,order:room.order,drawn:room.drawn,
 serverTime:Date.now(),lastSettlement:room.lastSettlement??null,sales:room.sales,deadline:room.deadline,left:room.left,config:room.config,result:room.result??''};
}
export function action(room,body,now=Date.now()) {
 if(room.processed.includes(body.operation)) return;
 initializeSkills(room);
 syncHpRound(room);
 const before=new Map(room.players.map(p=>[p.seat,p.hp]));
 if(body.action==='settings'){
  room.config={initial:integer(body.initial,0,1000000),stipend:integer(body.stipend,0,1000000)};
 } else if(body.action==='timer'){
  if(!room.sales.every(Boolean))fail('请先完成本轮技能和补给拍卖');
  if(body.mode==='reset'){room.deadline=0;room.left=240000;}
  else if(room.deadline){room.left=Math.max(0,room.deadline-now);room.deadline=0;}
  else room.deadline=now+(room.left||240000);
 } else if(body.action==='draw'){
  if(!room.sales.every(Boolean))fail('请先完成本轮技能和补给拍卖');
  if(room.done||room.players.length!==room.count) fail('请先等待所有玩家入场');
  if(room.pendingHunt||room.events.some(e=>e.round===room.round)||(room.passes??[]).some(e=>e.round===room.round))fail('本轮已经开始行动，不能重新摇号',409);
  room.drawHistory??=[];
  let first;
  if(body.first)first=integer(body.first,1,room.count);
  else if(room.drawn)first=room.drawn;
  else {
   room.drawCycle??=0;
   const used=new Set(room.drawHistory.filter(e=>!e.designated&&(e.cycle??0)===room.drawCycle).map(e=>e.seat));
   let pool=room.players.filter(p=>p.alive&&!used.has(p.seat));
   if(!pool.length){room.drawCycle++;pool=room.players.filter(p=>p.alive);}
   if(!pool.length)fail('没有可参与摇号的存活玩家');
   first=pool[randomInt(pool.length)].seat;
  }
  if(!room.players.some(p=>p.alive&&p.seat===first))fail('请选择存活玩家');
  if(body.first){
   if(room.round!==5||!room.sales[0]?.seat||room.scepterUsed) fail('森林权杖当前不可用');
   room.scepterUsed=true;
  }
  if(!room.drawHistory.some(e=>e.round===room.round&&e.seat===first))room.drawHistory.push({round:room.round,seat:first,cycle:room.drawCycle??0,designated:!!body.first});
  room.drawn=first;
  room.order=room.players.filter(p=>p.alive).map(p=>p.seat).sort((a,b)=>(a-first+room.count)%room.count-(b-first+room.count)%room.count);
 } else if(body.action==='adjust'){
  const p=room.players.find(p=>p.seat===body.seat);
  if(!p||room.done) fail('玩家当前不可编辑');
  if(room.pendingHunt&&[room.pendingHunt.aSeat,room.pendingHunt.bSeat].includes(p.seat))fail('请先结算或取消这名玩家的当前捕食',409);
  p.hp=integer(body.hp,-1000000,1000000);
  p.coins=integer(body.coins,0,10000000);
 } else if(body.action==='auction'){
  if(room.done||!room.players.length) fail('当前无法拍卖');
  const item=integer(body.item,0,1);
  if(room.sales[item]) fail('该物品已处理');
  if(body.unsold) room.sales[item]={unsold:true};
  else {
   const p=room.players.find(p=>p.alive&&p.seat===body.seat);
   if(!p) fail('请选择存活玩家');
   if(item===0&&room.skills.filter(c=>c.seat===p.seat&&skillLive(room,c)).length>=2)fail('技能卡已满两张，请先在玩家台使用或放弃');
   const price=integer(body.price,0,10000000);
   if(price>p.coins) fail('出价超过金币余额');
   if(item===0&&!body.capacity) fail('请核对技能卡上限');
   p.coins-=price;
   if(item===1)p.hp+=room.round+2;
   room.sales[item]={seat:p.seat,id:p.id,price};
   if(item===0)room.skills.push({id:token(),type:room.round,round:room.round,seat:p.seat,used:false});
  }
 } else if(body.action==='hunt'){
  if(room.done||room.players.length!==room.count) fail('当前无法捕食');
  if(room.pendingHunt)fail('请先等待当前双方提交策略',409);
  if(body.row!==undefined||body.column!==undefined)fail('策略必须由双方在个人台秘密提交');
  if(room.order.length&&turnView(room).current!==body.a)fail('未到这名玩家的行动次序',403);
  const a=room.players.find(p=>p.alive&&p.seat===body.a);
  const b=room.players.find(p=>p.alive&&p.seat===body.b);
  const extraId=room.order.length?turnView(room).extraId:null;
  if(!a||!b||a===b||(b.safe&&!extraId)||(extraId&&turnView(room).excludedTargets.includes(b.seat))) fail('请选择合法捕食目标');
  breach(room,a.seat,b.seat);
  room.pendingHunt={id:token(),a:a.id,b:b.id,aSeat:a.seat,bSeat:b.seat,choices:{a:null,b:null},...(extraId?{extraId}:{})};
 } else if(body.action==='cancelHunt'){
  room.pendingHunt=null;
 } else if(body.action==='next'){
  if(room.done||room.players.length!==room.count)fail('当前无法结算');
  if(room.pendingHunt)fail('双方策略尚未揭晓，暂时不能结束本轮',409);
  if(room.order.length&&turnView(room).current!==null)fail('请等待所有玩家完成本轮行动',409);
  for(const c of room.contracts)if(c.round===room.round&&c.status==='active'){room.players.find(p=>p.seat===c.from).hp+=3;room.players.find(p=>p.seat===c.to).hp+=3;c.status='returned';}
  room.players.forEach(p=>{p.alive=p.alive&&p.hp>0;p.safe=false;});
  syncHpRound(room,'end');
  const alive=room.players.filter(p=>p.alive);
  room.done=room.round===5||alive.length<=1;
  if(room.done){
   const best=Math.max(...alive.map(p=>p.hp));
   const winners=alive.filter(p=>p.hp===best);
   room.result=winners.length? winners.map(p=>p.id).join('、')+(winners.length>1?' 并列第一':' 获胜')+' · '+best+' HP':'所有玩家淘汰';
  } else {
   room.round++;room.sales=[null,null];room.order=[];room.drawn=null;room.scepterUsed=false;
   alive.forEach(p=>p.coins+=room.config.stipend);
  }
  room.deadline=0;room.left=240000;
 } else fail('未知操作');
 if(body.action==='auction'&&room.sales.every(Boolean))settle(room,'auction',now,before);
 else if(body.action==='adjust')settle(room,'adjust',now,before);
 else syncHpRound(room);
 room.processed.push(body.operation);
 room.processed=room.processed.slice(-100);
}
