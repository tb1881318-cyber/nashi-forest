import {createRoom,publicRoom,action,token,randomInt,fail,syncHpRound,personalHpHistory,personalDuel,submitStrategy,playerAction,personalSkills,useSkill,transferHp} from './game.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function readBody(request){
 const text=await request.text();
 if(text.length>12000)fail('请求过大',413);
 try{return JSON.parse(text);}catch{fail('无效请求');}
}
async function mutate(db,id,transform){
 for(let attempt=0;attempt<12;attempt++){
  const row=await db.prepare('SELECT data,version FROM rooms WHERE id=?').bind(id).first();
  if(!row)fail('对局不存在，请检查主持人发来的链接',404);
  const room=JSON.parse(row.data);
  const response=transform(room);
  const result=await db.prepare('UPDATE rooms SET data=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(room),id,row.version).run();
  if(result.meta.changes===1)return response;
 }
 fail('操作繁忙，请重试',409);
}
function playerView(room,player) {
 return {
  skills:personalSkills(room,player.seat),id:player.id,seat:player.seat,identity:player.identity,hp:player.hp,coins:player.coins,alive:player.alive,
  duel:personalDuel(room,player.seat),hpHistory:personalHpHistory(room,player.seat),state:publicRoom(room)
 };
}
export async function api(request,env){
 try{
  if(!env.DB)fail('对局服务暂未就绪',503);
  const url=new URL(request.url);
  if(request.method==='POST'&&url.pathname==='/api/rooms'){
   const body=await readBody(request);
   const room=createRoom(body.count);
   for(let attempt=0;attempt<40;attempt++){
    const id=String(1000+randomInt(9000));
    const result=await env.DB.prepare('INSERT OR IGNORE INTO rooms (id,data,version) VALUES (?,?,0)').bind(id,JSON.stringify(room)).run();
    if(result.meta.changes===1)return json({room:id,hostToken:room.hostToken,state:publicRoom(room)},201);
   }
   fail('创建失败，请重试',503);
  }
  const match=url.pathname.match(/^\/api\/rooms\/((?:\d{4}|\d{6}))(?:\/(join|me|host|action|strategy|play|skill|transfer))?$/);
  if(!match)fail('接口不存在',404);
  const [,id,endpoint]=match;
  const auth=request.headers.get('x-game-session')??'';
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT data FROM rooms WHERE id=?').bind(id).first();
   if(!row)fail('对局不存在',404);
   const room=JSON.parse(row.data);
   if(endpoint==='host'){
    if(auth!==room.hostToken)fail('仅创建本局的主持人可查看身份',403);
    return json({...publicRoom(room),players:room.players.map(({secret,...p})=>p)});
   }
   if(endpoint==='me'){
    const p=room.players.find(p=>p.secret===auth);
    if(!p)fail('请注册自己的玩家 ID',401);
    return json(playerView(room,p));
   }
   if(endpoint)fail('请求方式不正确',405);
   return json(publicRoom(room));
  }
  if(request.method!=='POST')fail('请求方式不正确',405);
  const body=await readBody(request);
  if(endpoint==='join'){
   const playerId=String(body.id??'').trim().normalize('NFKC');
   const secret=String(body.secret??'');
   if(!/^[\p{L}\p{N}_-]{1,16}$/u.test(playerId))fail('ID 请使用 1–16 个汉字、字母、数字或下划线');
   if(!/^[a-f0-9]{48}$/.test(secret))fail('请刷新玩家页后重试');
   return json(await mutate(env.DB,id,room=>{
    const prior=room.players.find(p=>p.secret===secret);
    if(prior)return {id:prior.id,seat:prior.seat};
    if(room.players.some(p=>p.id.toLocaleLowerCase()===playerId.toLocaleLowerCase()))fail('这个 ID 已被使用，请换一个');
    if(room.players.length>=room.count||room.done)fail('本局名额已满');
    const identity=room.deck.pop();
    const p={id:playerId,seat:room.players.length+1,secret,identity,hp:room.initialHp??20,coins:room.config.initial+room.config.stipend,alive:true,safe:false};
    room.players.push(p);
    syncHpRound(room);
    return {id:p.id,seat:p.seat};
   }));
  }
  if(endpoint==='transfer'){
   if(!/^[a-f0-9-]{20,60}$/.test(body.operation??''))fail('操作标识无效');
   return json(await mutate(env.DB,id,room=>{
    transferHp(room,auth,body);
    return playerView(room,room.players.find(p=>p.secret===auth));
   }));
  }
  if(endpoint==='skill'){
   if(!/^[a-f0-9-]{20,60}$/.test(body.operation??''))fail('操作标识无效');
   return json(await mutate(env.DB,id,room=>{
    useSkill(room,auth,body);
    return playerView(room,room.players.find(p=>p.secret===auth));
   }));
  }
  if(endpoint==='play'){
   if(!/^[a-f0-9-]{20,60}$/.test(body.operation??''))fail('操作标识无效');
   return json(await mutate(env.DB,id,room=>{
    playerAction(room,auth,body);
    return playerView(room,room.players.find(p=>p.secret===auth));
   }));
  }
  if(endpoint==='strategy'){
   return json(await mutate(env.DB,id,room=>{
    submitStrategy(room,auth,body.encounterId,body.choice);
    const player=room.players.find(p=>p.secret===auth);
    return playerView(room,player);
   }));
  }
  if(endpoint==='action'){
   if(!/^[a-f0-9-]{20,60}$/.test(body.operation??''))fail('操作标识无效');
   return json(await mutate(env.DB,id,room=>{
    if(auth!==room.hostToken)fail('请从创建对局的主持人浏览器操作',403);
    action(room,body);
    return publicRoom(room);
   }));
  }
  fail('接口不存在',404);
 }catch(error){return json({error:error.status?error.message:'服务暂时异常，请重试'},error.status??500);}
}
