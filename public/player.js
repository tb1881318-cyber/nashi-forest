let roomId=roomParam||storedValue('nash-player-last-room'),playerSecret=null,me=null,revealed=true,lastRendered=null,registering=false,strategySubmitting=false,displayedDuel=null;
$('room').value=roomId??'';
$('roomField').hidden=!!roomId;
$('id').value=storedValue('nash-player-last-id')||'';
let restoring=!!(roomId&&storedValue('nash-player-'+roomId));
if(restoring){$('join').hidden=true;$('status').textContent='正在恢复你的玩家身份…';}
function rememberPlayer(){
 storeValue('nash-player-last-room',roomId);
 storeValue('nash-player-last-id',me.id);
 storeValue('nash-player-id-'+roomId,me.id);
 $('id').value=me.id;
 const activeUrl=new URL(location.href);activeUrl.searchParams.set('room',roomId);
 window.history.replaceState(null,'',activeUrl.href);
 window.dispatchEvent(new CustomEvent('nash-room-changed',{detail:roomId}));
}
function storageKey(){return 'nash-player-'+roomId;}
function credentials(){
 playerSecret=storedValue(storageKey())||secret();
 storeValue(storageKey(),playerSecret);
}
function renderEncounters(){
 $('encounters').replaceChildren();
 for(let round=1;round<=me.state.round;round++){
  const section=document.createElement('section');
  section.className='encounter-round';
  const heading=document.createElement('h4');heading.textContent='第 '+round+' 轮';
  section.append(heading);
  const events=me.state.events.filter(event=>event.round===round&&(event.aSeat===me.seat||event.bSeat===me.seat));
  if(!events.length){
   const empty=document.createElement('p');empty.textContent='本轮暂无交手';section.append(empty);
  }
  for(const event of events){
   const attacking=event.aSeat===me.seat;
   const ownGain=attacking?event.gainA:event.gainB;
   const otherGain=attacking?event.gainB:event.gainA;
   const ownStrategy=strategy[attacking?event.row:event.column];
   const otherStrategy=strategy[attacking?event.column:event.row];
   const entry=document.createElement('article');
   const title=document.createElement('strong');
   title.textContent=attacking?'你捕食 '+event.b:event.a+' 捕食你';
   const details=document.createElement('p');
   details.textContent='你 '+ownStrategy+'，对方 '+otherStrategy+' · 你 '+score(ownGain)+' HP，对方 '+score(otherGain)+' HP';
   const outcome=document.createElement('small');
   outcome.textContent=new Date(event.at).toLocaleTimeString('zh-CN',{hour12:false})+' · '+(ownGain>0?'获胜':ownGain<0?'失利':'平局');
   entry.append(title,details,outcome);section.append(entry);
  }
  $('encounters').append(section);
 }
}
let skillSnapshot=null;
async function skillCommand(body){
 if(strategySubmitting)return;strategySubmitting=true;renderDuel();
 try{
  me=await request('/rooms/'+roomId+'/skill',{...body,operation:crypto.randomUUID()},playerSecret);
  skillSnapshot=null;lastRendered=null;render();$('skillStatus').textContent='操作已完成';
 }catch(error){$('skillStatus').textContent=error.message;}
 finally{strategySubmitting=false;renderTurn();renderDuel();}
}
function renderSkills(){
 const snapshot=JSON.stringify([me.skills,me.state.contracts,me.state.pendingHunt,me.state.order,me.state.players,me.state.sales,me.state.phase,me.state.contractAvailable,!!me.state.deadline]);
 if(snapshot===skillSnapshot)return;skillSnapshot=snapshot;
 const box=$('mySkills');box.replaceChildren();
 const data=me.skills??{cards:[],intel:[],invites:[]};
 if(!data.cards.length&&!data.intel.length&&!data.invites.length){const p=document.createElement('p');p.textContent='尚未获得技能，等待本轮拍卖。';box.append(p);}
 for(const card of data.cards){
  const info=rounds[card.type-1],panel=document.createElement('article'),title=document.createElement('strong');
  title.textContent=info.icon+' '+info.name;
  const details=document.createElement('details'),summary=document.createElement('summary'),rule=document.createElement('p');
  summary.textContent='技能规则';rule.textContent=info.effect+' '+info.timing+'；'+info.limit;details.append(summary,rule);
  const form=document.createElement('form');
  const targets=me.state.players.filter(p=>p.alive&&(card.type!==2||!p.bot)&&(card.type===1||card.type===2||card.type===4?p.seat!==me.seat:true));
  const select=document.createElement('select');select.required=true;
  const label=document.createElement('label');label.textContent=card.type===1?'选择要查看的玩家':card.type===2?'邀请哪位玩家':card.type===3?'第一次额外机会交给谁':card.type===4?'将捕食转移给谁':'指定哪位玩家先行动';
  select.setAttribute('aria-label',label.textContent);
  select.add(new Option('请选择玩家',''));
  for(const p of targets)select.add(new Option(playerLabel(p),p.seat));
  label.append(select);form.append(label);
  let second=null;
  if(card.type===3){second=document.createElement('select');second.required=true;const secondLabel=document.createElement('label');secondLabel.textContent='第二次额外机会交给谁';second.setAttribute('aria-label',secondLabel.textContent);second.add(new Option('请选择玩家',''));for(const p of targets)second.add(new Option(playerLabel(p),p.seat));secondLabel.append(second);form.append(secondLabel);}
  const button=document.createElement('button');button.className='primary top-gap';button.textContent=card.type===2?'谈判阶段：邀请建立契约':card.type===3?'分配两次额外机会':card.type===4?'支付3 HP并转移捕食':card.type===5?'指定首位行动玩家':'秘密查看身份';
  if(card.type===4)button.disabled=me.state.pendingHunt?.bSeat!==me.seat||me.state.pendingHunt?.redirected;
  if(card.type===2)button.disabled=me.state.contractAvailable===false||!me.state.sales.every(Boolean);
  if(card.type===2){const hint=document.createElement('p');hint.className='notice';hint.textContent=button.disabled?'拍卖完成后、首场捕食开始前可建立契约。':'现在可以建立契约：选择另一名玩家，点击邀请，对方同意后生效。';form.append(hint);}
  if(card.type===3)button.disabled=!me.state.order.length;
  form.append(button);form.onsubmit=e=>{e.preventDefault();skillCommand({cardId:card.id,target:Number(select.value),target2:second?Number(second.value):undefined});};
  const discard=document.createElement('button');discard.type='button';discard.textContent='放弃此卡';discard.onclick=()=>{if(confirm('确认放弃'+info.name+'？'))skillCommand({cardId:card.id,discard:true});};
  panel.append(title,details,form,discard);box.append(panel);
 }
 for(const intel of data.intel){const p=document.createElement('p');p.textContent='鹰眼情报（仅你可见）：'+intel.seat+'号 '+intel.id+' 的身份为 '+animals[intel.identity];box.append(p);}
 for(const contract of (me.state.contracts??[]).filter(c=>c.round===me.state.round&&[c.from,c.to].includes(me.seat)&&c.status!=='invited')){
  const p=document.createElement('p');
  p.textContent='生死契约 '+contract.from+'号 / '+contract.to+'号：'+({active:'生效中，双方各托管3 HP',declined:'邀请已拒绝',betrayed:'已背叛，保证金已结算',returned:'守约，保证金已返还'}[contract.status]??contract.status);
  box.append(p);
 }
 for(const invite of data.invites){
  const p=document.createElement('p');p.textContent=invite.from+'号邀请你建立生死契约，接受后双方各托管3 HP。';
  for(const accept of [true,false]){const b=document.createElement('button');b.textContent=accept?'同意并缴纳3 HP':'拒绝';if(accept)b.disabled=me.state.contractAvailable===false;b.onclick=()=>skillCommand({contractId:invite.id,accept});p.append(b);}
  box.append(p);
 }
}
let transferOperation=null,transferSignature=null;
function renderTransfer(){
 const targets=me.state.players.filter(p=>p.alive&&p.seat!==me.seat);
 setOptions($('transferTarget'),targets,'选择接收玩家');
 $('transferAmount').max=String(Math.max(0,me.hp));
 $('transferButton').disabled=strategySubmitting||!me.alive||me.state.done||me.hp<1||!targets.length;
 $('transferHint').textContent='当前可转让 '+Math.max(0,me.hp)+' HP。转出后立即扣除，接收方同步增加；HP≤0 在轮末淘汰。';
}
$('transferForm').onsubmit=async event=>{
 event.preventDefault();if(strategySubmitting||!me)return;
 const target=Number($('transferTarget').value),amount=Number($('transferAmount').value);
 const recipient=me.state.players.find(p=>p.seat===target);
 if(!recipient||!Number.isInteger(amount)||amount<1||amount>me.hp){$('transferStatus').textContent='请选择接收玩家，并输入不超过可用 HP 的正整数';return;}
 if(!confirm('确认向 '+playerLabel(recipient)+' 转让 '+amount+' HP？你将剩余 '+(me.hp-amount)+' HP。'))return;
 const signature=JSON.stringify([roomId,me.state.round,target,amount]);
 if(signature!==transferSignature){transferSignature=signature;transferOperation=crypto.randomUUID();}
 strategySubmitting=true;renderTransfer();renderDuel();
 try{
  me=await request('/rooms/'+roomId+'/transfer',{target,amount,round:me.state.round,operation:transferOperation},playerSecret);
  transferOperation=null;transferSignature=null;lastRendered=null;render();
  $('transferAmount').value='';$('transferStatus').textContent='已向 '+playerLabel(recipient)+' 转让 '+amount+' HP';
 }catch(error){$('transferStatus').textContent=error.message;}
 finally{strategySubmitting=false;renderTransfer();renderTurn();renderDuel();}
};
function renderTurn(){
 const state=me.state,turn=state.turn;
 const own=turn?.current===me.seat;
 const pending=state.pendingHunt;
 const current=state.players.find(p=>p.seat===turn?.current);
 $('turnTitle').textContent=state.done?'对局已结束':!me.alive?'你已淘汰':pending?(me.duel?'请在下方锁定策略':'等待当前双方结算'):!turn?.ready?'等待主持人摇号':!current?'本轮行动已完成':own?'轮到你行动':'未到你的次序';
 $('turnHint').textContent=current?'当前行动：'+playerLabel(current)+(turn?.extraId?'（狼王额外捕食，可无视保护区）':'')+(own?'，请选择捕食目标，或点击跳过本次捕食。':'，请等待。'):turn?.ready?'等待主持人进行轮末结算。':'摇号后按座位顺序依次行动。';
 const legal=state.players.filter(p=>p.alive&&p.seat!==me.seat&&(!p.safe||!!state.turn?.extraId)&&!(state.turn?.excludedTargets??[]).includes(p.seat));
 $('turnForm').hidden=!own||!!pending||!me.alive||state.done;
 setOptions($('turnTarget'),legal,'选择捕食目标');
 $('startHunt').disabled=strategySubmitting||!legal.length;
 $('passTurn').disabled=strategySubmitting;
 $('passTurn').textContent=legal.length?'暂时跳过（不扣 HP，稍后轮回）':'无合法目标，免费结束';
}
function renderDuel(){
 const duel=me.duel;
 $('duelPanel').hidden=!duel;
 if(!duel){displayedDuel=null;return;}
 if(displayedDuel!==duel.id){
  $('strategyForm').reset();
  $('strategyStatus').textContent='';
  displayedDuel=duel.id;
 }
 $('duelTitle').textContent=duel.role==='A'?'你正在捕食 '+duel.opponent:duel.opponent+' 正在捕食你';
 $('duelHint').textContent='在个人台独立选择，锁定后不能修改。双方锁定后同时揭晓。';
 const locked=duel.submitted||strategySubmitting;
 $('strategyForm').querySelectorAll('input').forEach(input=>{
  input.disabled=locked;
  if(duel.submitted)input.checked=Number(input.value)===duel.choice;
 });
 $('lockStrategy').disabled=locked;
 $('lockStrategy').textContent=duel.submitted?'已锁定':strategySubmitting?'提交中…':'锁定策略';
 if(duel.submitted)$('strategyStatus').textContent='你已锁定 '+strategy[duel.choice]+'，等待对方提交。';
}
function render(){
 const snapshot=JSON.stringify([me,revealed]);
 if(snapshot===lastRendered)return;
 lastRendered=snapshot;
 $('join').hidden=true;$('hand').hidden=false;$('name').textContent=me.id;
 $('seat').textContent=me.seat+'号座 · '+me.state.count+'人局';
 $('identity').textContent=revealed?animals[me.identity]:'♠';
 $('hp').textContent=me.hp+' HP · '+me.coins+' 金币'+(me.alive?'':' · 已淘汰');
 $('hpHistory').replaceChildren();
 for(const round of me.hpHistory??[]){
  const tr=document.createElement('tr');
  for(const value of [round.round,round.start,round.afterAuction,round.complete?round.end:round.current]){
   const td=document.createElement('td');td.textContent=value??'—';tr.append(td);
  }
  $('hpHistory').append(tr);
 }
 if(!me.hpHistory?.length){
  const tr=document.createElement('tr'),td=document.createElement('td');
  td.colSpan=4;td.textContent='旧局从下一次结算起记录';tr.append(td);$('hpHistory').append(tr);
 }
 renderSkills();
 renderTransfer();
 renderTurn();
 renderDuel();
 renderEncounters();
 $('board').href=link('board.html',roomId);
 $('playerCalculator').href=link('calculator.html',roomId);
}
async function pull(){
 if(!roomId||!playerSecret||registering||strategySubmitting)return;
 try{
  const requestedRoom=roomId,requestedSecret=playerSecret;
  const updated=await request('/rooms/'+requestedRoom+'/me',undefined,requestedSecret);
  if(registering||strategySubmitting||requestedRoom!==roomId||requestedSecret!==playerSecret)return;
  me=updated;rememberPlayer();render();$('status').textContent='';restoring=false;
 }
 catch(e){$('status').textContent=e.message;if(restoring){$('join').hidden=false;$('roomField').hidden=false;restoring=false;}return false;}
}
$('join').onsubmit=async e=>{
 e.preventDefault();if(registering)return;registering=true;$('register').disabled=true;
 roomId=$('room').value.trim();
 try{
  credentials();
  await request('/rooms/'+roomId+'/join',{id:$('id').value,secret:playerSecret});
  const activeUrl=new URL(location.href);
  activeUrl.searchParams.set('room',roomId);
  window.history.replaceState(null,'',activeUrl.href);
  window.dispatchEvent(new CustomEvent('nash-room-changed',{detail:roomId}));
  me=await request('/rooms/'+roomId+'/me',undefined,playerSecret);rememberPlayer();render();$('status').textContent='';
 }catch(error){$('status').textContent=error.message;}finally{registering=false;$('register').disabled=false;}
};
async function takeTurn(action){
 if(strategySubmitting)return;
 const operation=crypto.randomUUID();
 strategySubmitting=true;renderTurn();
 try{
  me=await request('/rooms/'+roomId+'/play',{action,target:Number($('turnTarget').value),round:me.state.round,operation},playerSecret);
  lastRendered=null;render();$('turnStatus').textContent='';
 }catch(error){$('turnStatus').textContent=error.message;}
 finally{strategySubmitting=false;renderTurn();renderDuel();}
}
$('turnForm').onsubmit=event=>{event.preventDefault();takeTurn('hunt');};
$('passTurn').onclick=()=>{
 const legal=me.state.players.some(p=>p.alive&&p.seat!==me.seat&&(!p.safe||!!me.state.turn?.extraId)&&!(me.state.turn?.excludedTargets??[]).includes(p.seat));
 takeTurn(legal?'defer':'pass');
};
$('strategyForm').onsubmit=async event=>{
 event.preventDefault();
 if(strategySubmitting||!me?.duel||me.duel.submitted)return;
 const selected=$('strategyForm').querySelector('input[name="tactic"]:checked');
 if(!selected)return;
 const encounterId=me.duel.id,choice=Number(selected.value);
 strategySubmitting=true;renderDuel();
 try{
  me=await request('/rooms/'+roomId+'/strategy',{encounterId,choice},playerSecret);
  lastRendered=null;
  render();
 }catch(error){$('strategyStatus').textContent=error.message;}
 finally{strategySubmitting=false;renderDuel();}
};
$('switchRoom').onclick=()=>{roomId=null;playerSecret=null;me=null;lastRendered=null;restoring=false;$('hand').hidden=true;$('join').hidden=false;$('roomField').hidden=false;$('room').value='';$('status').textContent='输入新的对局号即可加入，原身份仍保留。';};
$('reveal').onclick=()=>{revealed=!revealed;render();$('reveal').textContent=revealed?'盖回身份':'查看我的身份';};
if(roomId)credentials();
startPolling(pull,2000);
