const announcer=createForestAnnouncer(window);
let state=null,busy=false,hostToken=null,generation=0,lastRendered=null;
function restoreHost(){
 try {
  const saved=JSON.parse(localStorage.getItem('nash-host-'+roomParam)||localStorage.getItem('nash-host-online'));
  if(String(saved?.room)===String(roomParam)&&saved?.token)hostToken=saved.token;
 }catch{}
}
restoreHost();
function route(){return '/rooms/'+roomParam;}
function alive(){return state.players.filter(p=>p.alive);}
function updateTargets(){setOptions($('b'),alive().filter(p=>String(p.seat)!==$('a').value&&!p.safe),'选择目标');}
function adjustFields(){const p=state.players.find(p=>String(p.seat)===$('adjustSeat').value);if(p){$('hp').value=p.hp;$('coins').value=p.coins;}}

let auctionRound=null;
function renderAuction(){
 const info=rounds[state.round-1];
 if(hostToken){
  const panel=$('auction').closest('section');
  if(panel.parentElement!==$('roundAuction')){$('roundAuction').append(panel);panel.classList.add('auction-entry');}
 }
 $('auctionHeading').textContent='第 '+state.round+' 轮 · '+(state.sales.every(Boolean)?'拍卖已结束':'先完成拍卖');
 if(auctionRound!==state.round){
  auctionRound=state.round;
  const box=$('auctionPreview');box.replaceChildren();
  const fold=document.createElement('details'),title=document.createElement('summary'),effect=document.createElement('p');
  title.textContent=info.icon+' '+info.name+' · 点击展开技能规则';
  effect.textContent=info.effect+' 使用时机：'+info.timing+'。限制：'+info.limit;
  fold.append(title,effect);
  const supply=document.createElement('p');supply.textContent='生命补给：+'+info.hp+' HP（成交后自动补给）';
  box.append(fold,supply);
 }
 const sales=state.sales.map((s,i)=>(i?'生命补给':info.name)+'：'+(!s?'待拍卖':s.unsold?'流拍':s.id+' · '+s.price+' 金币')).join(' ｜ ');
 let line=$('auctionSaleLine');
 if(!line){line=document.createElement('p');line.id='auctionSaleLine';$('auctionPreview').append(line);}
 line.textContent=sales+(state.sales.every(Boolean)?'。下一步：开始谈判，再摇号。':'。主持人请在这里依次记录技能、补给成交；无人出价则点击流拍。');
 $('item').options[0].textContent=info.name;
}
function render(){
 const snapshot=JSON.stringify(state);
 if(snapshot===lastRendered)return;
 lastRendered=snapshot;
 renderAuction();
 $('boardEntry').hidden=true;$('boardContent').hidden=false;
 $('heading').textContent=state.done?'本局结束':'第 '+state.round+' 轮 · 森林公共台';
 $('status').textContent=state.done?state.result:state.players.length+' / '+state.count+' 人入场 · 对局 '+roomParam;
 $('drawn').textContent=state.drawn??'—';
 $('order').textContent=state.order.length?state.order.map(n=>playerLabel(state.players.find(p=>p.seat===n))).join(' → '):'等待摇号';
 const active=state.players.find(p=>p.seat===state.turn?.current);
 if(state.order.length)$('order').textContent+=(active?' · 当前轮到 '+playerLabel(active):' · 本轮行动完成');
 const settlement=state.lastSettlement;
 const kind={auction:'拍卖结算',hunt:'捕食结算',adjust:'生命值调整',pass:'放弃捕食',skill:'技能结算',transfer:'生命值转让'};
 $('settlementTitle').textContent=settlement?'第 '+settlement.round+' 轮 · '+kind[settlement.kind]+'后全员 HP':'场上玩家';
 $('seats').replaceChildren();
 for(let seat=1;seat<=state.count;seat++){
  const p=state.players.find(p=>p.seat===seat),card=document.createElement('article');
  card.className='board-seat'+(p&&!p.alive?' out':'');
  const name=document.createElement('strong');name.textContent=p?p.id:seat+'号座';
  const hp=document.createElement('b');hp.textContent=p?p.hp+' HP':'待入场';
  const status=document.createElement('small');status.textContent=p?(p.alive?(p.safe?'保护中':p.coins+' 金币'):'淘汰'):'';card.append(name,hp,status);$('seats').append(card);
 }
 const event=state.events.at(-1),pending=state.pendingHunt;
 announcer.update(pending,state.events);
 $('latest').textContent=pending?pending.a+' 捕食 '+pending.b:event?event.a+' 捕食 '+event.b+'　'+score(event.gainA)+' / '+score(event.gainB)+' HP':'等待捕食';
 $('duelProgress').textContent=pending
  ?pending.a+'：'+(pending.submittedA?'已锁定':'选择中')+'　'+pending.b+'：'+(pending.submittedB?'已锁定':'选择中')
  :event?'双方已揭晓：'+event.a+' '+strategy[event.row]+'，'+event.b+' '+strategy[event.column]:'';
 $('cancelHunt').hidden=!hostToken||!pending;
 $('history').replaceChildren();
 for(let round=1;round<=state.round;round++){
  const row=document.createElement('li');
  const entries=state.events.filter(e=>e.round===round).map(e=>e.aSeat+'号 → '+e.bSeat+'号：'+strategy[e.row]+' / '+strategy[e.column]+'，'+score(e.gainA)+' / '+score(e.gainB)+' HP');
  for(const pass of (state.passes??[]).filter(e=>e.round===round))entries.push(pass.seat+'号放弃（'+(pass.cost?'−'+pass.cost+' HP':'免费')+'）');
  for(const transfer of (state.transfers??[]).filter(e=>e.round===round))entries.push(transfer.fromSeat+'号向'+transfer.toSeat+'号转让'+transfer.amount+' HP');
  for(const log of (state.skillLog??[]).filter(e=>e.round===round))entries.push(log.text);
  row.textContent='第 '+round+' 轮　'+(entries.join(' ｜ ')||'等待行动');
  $('history').append(row);
 }
 $('controls').hidden=!hostToken;
 $('controlJump').hidden=!hostToken;
 $('drawControls').hidden=!hostToken;
 $('timerControls').hidden=!hostToken;
 $('controlAccess').textContent=hostToken?'主持人模式：摇号和计时按钮位于对应数字下方。':'当前为只读公共台。请在创建本局的浏览器，从主持人台点击「公共台」进入操作。';
 if(hostToken){
  for(const id of ['a','buyer','first','adjustSeat'])setOptions($(id),alive(),id==='a'?'选择发起者':null);
  updateTargets();
  const locked=state.done||state.players.length!==state.count;
  $('next').disabled=locked||!!state.pendingHunt||!!state.turn?.current||!state.sales.every(Boolean)||!state.order.length;$('huntButton').disabled=locked||!!state.pendingHunt;$('draw').disabled=locked||!state.sales.every(Boolean);
  $('timer').disabled=!state.sales.every(Boolean);$('resetTimer').disabled=!state.sales.every(Boolean);
  $('result').textContent=state.result;
  $('sales').textContent=state.sales.map((s,i)=>s?(i?'补给':'技能')+' · '+(s.unsold?'流拍':s.id+' 支付 '+s.price+' 金币'):'').filter(Boolean).join('；');
  $('scepter').hidden=state.round!==5||!state.sales[0]?.seat||state.done;
  $('utilityPanel').hidden=true;
 }
 tick();
}
function tick(){if(state&&!document.hidden){if(hostToken)setText('timer',state.deadline?'暂停谈判':'开始谈判');setText('clock',displayClock(state));setText('phase',state.done?'对局结束':state.deadline?'谈判中':'等待主持人');}}
async function pull(){
 if(busy)return;
 const previousHost=hostToken;restoreHost();if(previousHost!==hostToken)lastRendered=null;
 if(!roomParam){$('status').textContent='输入对局号进入公共台';return;}
 try{const current=generation;const updated=await request('/rooms/'+roomParam);if(current!==generation)return;state=updated;render();}
 catch(e){$('status').textContent=e.message;return false;}
}
$('controlJump').onclick=()=>{$('controls').scrollIntoView({behavior:'smooth',block:'start'});};
$('previewVoice').onclick=()=>{if(!announcer.preview())$('actionStatus').textContent='当前浏览器不支持语音，请用 Chrome 或 Edge 打开试听。';};
$('enableVoice').onclick=()=>{
 const enabled=announcer.toggle();
 $('enableVoice').textContent=enabled?'关闭语音':'开启语音';
 $('enableVoice').setAttribute('aria-pressed',String(enabled));
 if(!enabled&&!announcer.supported)$('actionStatus').textContent='当前浏览器不支持语音播报，请使用 Chrome 或 Edge；文字提示正常显示。';
};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('status').textContent='可按 F11 全屏';}};
async function command(body){
 if(busy)return;
 busy=true;
 generation++;
 try{state=await request(route()+'/action',{...body,operation:crypto.randomUUID()},hostToken);render();$('actionStatus').textContent='';return true;}
 catch(e){$('actionStatus').textContent=e.message;return false;}
 finally{busy=false;}
}

$('a').onchange=updateTargets;
$('hunt').onsubmit=async e=>{
 e.preventDefault();
 if(await command({action:'hunt',a:Number($('a').value),b:Number($('b').value)})){
  $('actionStatus').textContent='已发起，等待双方在个人台锁定策略';
 }
};
$('cancelHunt').onclick=async()=>{
 if(confirm('取消当前捕食？已提交策略将清除，HP 不变。'))await command({action:'cancelHunt'});
};
$('draw').onclick=()=>command({action:'draw'});
$('useScepter').onclick=()=>command({action:'draw',first:Number($('first').value)});

$('timer').onclick=()=>command({action:'timer'});
$('resetTimer').onclick=()=>command({action:'timer',mode:'reset'});
$('next').onclick=()=>{if(confirm('确认技能费用、保证金与捕食均已结算？'))command({action:'next'});};
$('auction').onsubmit=e=>{e.preventDefault();command({action:'auction',item:Number($('item').value),seat:Number($('buyer').value),price:Number($('price').value),capacity:true});};
$('unsold').onclick=()=>command({action:'auction',item:Number($('item').value),unsold:true});
$('adjustSeat').onchange=adjustFields;
$('adjust').addEventListener('toggle',adjustFields);
$('adjust').closest('details').addEventListener('toggle',e=>{if(e.target.open)adjustFields();});
$('adjust').onsubmit=e=>{e.preventDefault();command({action:'adjust',seat:Number($('adjustSeat').value),hp:Number($('hp').value),coins:Number($('coins').value)});};
$('settings').onsubmit=e=>{e.preventDefault();command({action:'settings',initial:Number($('initial').value),stipend:Number($('stipend').value)});};

$('openBoard').onsubmit=event=>{
 event.preventDefault();
 location.href=link('board.html',$('boardRoom').value.trim());
};
try{
 const previous=JSON.parse(localStorage.getItem('nash-host-online'));
 if(!roomParam&&previous?.room){
  $('continueBoard').hidden=false;
  $('continueBoard').textContent='进入对局 '+previous.room;
  $('continueBoard').onclick=()=>{location.href=link('board.html',previous.room);};
 }
}catch{}
startPolling(pull,2000);setInterval(tick,250);
