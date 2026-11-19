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
 sales:[null,null],deadline:0,left:240000,processed:[],config:{initial:10,stipend:5},scepterUsed:false};
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
 a.hp+=gainA;b.hp+=gainB;b.safe=true;
 room.events.push({encounterId:hunt.id,round:room.round,at:now,a:a.id,b:b.id,aSeat:a.seat,bSeat:b.seat,row,column,gainA,gainB});
 room.pendingHunt=null;
 settle(room,'hunt',now,before);
}
export function turnView(room) {
 const completed=new Set([
  ...room.events.filter(e=>e.round===room.round).map(e=>e.aSeat),
  ...(room.passes??[]).filter(e=>e.round===room.round).map(e=>e.seat)
 ]);
 const remaining=room.order.filter(seat=>!completed.has(seat)&&room.players.some(p=>p.seat===seat&&p.alive));
 return {ready:room.order.length>0,current:room.done?null:remaining[0]??null,remaining,completed:[...completed]};
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
 } else if(body.action==='pass') {
  const before=new Map(room.players.map(p=>[p.seat,p.hp]));
  const legal=room.players.some(p=>p.alive&&p.seat!==player.seat&&!p.safe);
  if(legal)player.hp-=2;
  room.passes??=[];
  room.passes.push({round:room.round,seat:player.seat,id:player.id,at:now,cost:legal?2:0});
  settle(room,'pass',now,before);
 } else fail('未知玩家操作');
 room.playerOperations.push(body.operation);room.playerOperations=room.playerOperations.slice(-100);
}
export function publicRoom(room) {
 return {count:room.count,players:room.players.map(({secret,identity,...p})=>p),
 turn:turnView(room),passes:room.passes??[],pendingHunt:pendingHuntView(room),round:room.round,done:room.done,events:room.events,order:room.order,drawn:room.drawn,
 lastSettlement:room.lastSettlement??null,sales:room.sales,deadline:room.deadline,left:room.left,config:room.config,result:room.result??''};
}
export function action(room,body,now=Date.now()) {
 if(room.processed.includes(body.operation)) return;
 syncHpRound(room);
 const before=new Map(room.players.map(p=>[p.seat,p.hp]));
 if(body.action==='settings'){
  room.config={initial:integer(body.initial,0,1000000),stipend:integer(body.stipend,0,1000000)};
 } else if(body.action==='timer'){
  if(body.mode==='reset'){room.deadline=0;room.left=240000;}
  else if(room.deadline){room.left=Math.max(0,room.deadline-now);room.deadline=0;}
  else room.deadline=now+(room.left||240000);
 } else if(body.action==='draw'){
  if(room.done||room.players.length!==room.count) fail('请先等待所有玩家入场');
  if(room.pendingHunt||room.events.some(e=>e.round===room.round)||(room.passes??[]).some(e=>e.round===room.round))fail('本轮已经开始行动，不能重新摇号',409);
  const first=body.first ? integer(body.first,1,room.count) : randomInt(room.count)+1;
  if(body.first){
   if(room.round!==5||!room.sales[0]?.seat||room.scepterUsed) fail('森林权杖当前不可用');
   room.scepterUsed=true;
  }
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
   const price=integer(body.price,0,10000000);
   if(price>p.coins) fail('出价超过金币余额');
   if(item===0&&!body.capacity) fail('请核对技能卡上限');
   p.coins-=price;
   if(item===1)p.hp+=room.round+2;
   room.sales[item]={seat:p.seat,id:p.id,price};
  }
 } else if(body.action==='hunt'){
  if(room.done||room.players.length!==room.count) fail('当前无法捕食');
  if(room.pendingHunt)fail('请先等待当前双方提交策略',409);
  if(body.row!==undefined||body.column!==undefined)fail('策略必须由双方在个人台秘密提交');
  if(room.order.length&&turnView(room).current!==body.a)fail('未到这名玩家的行动次序',403);
  const a=room.players.find(p=>p.alive&&p.seat===body.a);
  const b=room.players.find(p=>p.alive&&p.seat===body.b);
  if(!a||!b||a===b||b.safe) fail('请选择合法捕食目标');
  room.pendingHunt={id:token(),a:a.id,b:b.id,aSeat:a.seat,bSeat:b.seat,choices:{a:null,b:null}};
 } else if(body.action==='cancelHunt'){
  room.pendingHunt=null;
 } else if(body.action==='next'){
  if(room.done||room.players.length!==room.count)fail('当前无法结算');
  if(room.pendingHunt)fail('双方策略尚未揭晓，暂时不能结束本轮',409);
  if(room.order.length&&turnView(room).current!==null)fail('请等待所有玩家完成本轮行动',409);
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
