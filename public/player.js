let roomId=roomParam,playerSecret=null,me=null,revealed=true,lastRendered=null,registering=false,strategySubmitting=false,displayedDuel=null;
$('room').value=roomId??'';
$('roomField').hidden=!!roomId;
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
 $('identity').textContent=revealed?me.identity+' · '+animals[me.identity]:'♠';
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
 renderDuel();
 renderEncounters();
 $('board').href=link('board.html',roomId);
}
async function pull(){
 if(!roomId||!playerSecret||registering||strategySubmitting)return;
 try{
  const requestedRoom=roomId,requestedSecret=playerSecret;
  const updated=await request('/rooms/'+requestedRoom+'/me',undefined,requestedSecret);
  if(registering||strategySubmitting||requestedRoom!==roomId||requestedSecret!==playerSecret)return;
  me=updated;render();$('status').textContent='';
 }
 catch(e){if(me)$('status').textContent=e.message;return false;}
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
  me=await request('/rooms/'+roomId+'/me',undefined,playerSecret);render();$('status').textContent='';
 }catch(error){$('status').textContent=error.message;}finally{registering=false;$('register').disabled=false;}
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
$('reveal').onclick=()=>{revealed=!revealed;render();$('reveal').textContent=revealed?'盖回身份':'查看我的身份';};
if(roomId)credentials();
startPolling(pull,2000);
