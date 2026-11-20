let roomId=null,hostToken=null,state=null,busy=false,firstLoad=true,identitiesVisible=false,lastRendered=null;
try{
 const saved=JSON.parse(localStorage.getItem('nash-host-online'));
 if(saved){roomId=saved.room;hostToken=saved.token;}
}catch{}
for(let n=3;n<=12;n++)$('count').add(new Option(n+' 人',String(n)));
$('count').value='7';
$('count').onchange=()=>{
 $('create').textContent='创建 '+$('count').value+' 人新局';
 $('status').textContent=state?'创建后按所选人数开启新局':'';
};
function render(){
 if(!state)return;
 const snapshot=JSON.stringify([roomId,state,identitiesVisible]);
 if(snapshot===lastRendered)return;
 lastRendered=snapshot;
 $('game').hidden=false;$('roomLinks').hidden=false;$('boardLink').hidden=false;
 $('boardLink').href=link('board.html',roomId);
 $('playerLink').value=link('player.html',roomId);
 $('roomNumber').textContent='对局号 '+roomId;
 $('joined').textContent=state.players.length+' / '+state.count+' 人入场';
 $('seats').replaceChildren();
 for(let seat=1;seat<=state.count;seat++){
  const p=state.players.find(p=>p.seat===seat),card=document.createElement('article');
  const name=document.createElement('strong');name.textContent=p?playerLabel(p):seat+'号 · 等待入场';
  const identity=document.createElement('p');identity.className='host-identity';
  identity.textContent=p?.identity?(identitiesVisible?animals[p.identity]:'已隐藏'):'等待入场';
  card.append(name,identity);$('seats').append(card);
 }
}
async function pull(){
 if(!roomId||busy)return;
 try{
  const requestedRoom=roomId;
  const updated=await request('/rooms/'+requestedRoom+'/host',undefined,hostToken);
  if(requestedRoom!==roomId||busy)return;
  state=updated;
  if(firstLoad){$('count').value=String(state.count);$('create').textContent='创建 '+state.count+' 人新局';firstLoad=false;}
  render();$('status').textContent='';
 }catch(e){$('status').textContent=e.message;return false;}
}
$('setup').onsubmit=async e=>{
 e.preventDefault();if(busy)return;
 const requestedCount=Number($('count').value);
 busy=true;
 $('create').disabled=true;
 $('create').textContent='正在创建新局…';
 $('status').textContent='正在分配新的对局号…';
 try{
  const result=await request('/rooms',{count:requestedCount});
  roomId=result.room;hostToken=result.hostToken;state=result.state;
  lastRendered=null;firstLoad=false;
  const activeUrl=new URL(location.href);
  activeUrl.searchParams.set('room',roomId);
  window.history.replaceState(null,'',activeUrl.href);
  identitiesVisible=false;$('toggleIdentities').textContent='显示身份';$('toggleIdentities').setAttribute('aria-pressed','false');
  storeValue('nash-host-online',JSON.stringify({room:roomId,token:hostToken}));
  storeValue('nash-host-'+roomId,JSON.stringify({room:roomId,token:hostToken}));
  window.dispatchEvent(new CustomEvent('nash-room-changed',{detail:roomId}));
  render();$('status').textContent='新局已开启，对局号 '+roomId;
 }catch(e){$('status').textContent=e.message;}
 finally{
  busy=false;
  $('create').disabled=false;
  $('create').textContent='创建 '+$('count').value+' 人新局';
 }
};
$('copy').onclick=async()=>{
 try{await navigator.clipboard.writeText($('playerLink').value);$('status').textContent='入场链接已复制';}
 catch{$('playerLink').select();$('status').textContent='请复制选中的链接';}
};
$('toggleIdentities').onclick=()=>{
 identitiesVisible=!identitiesVisible;
 $('toggleIdentities').textContent=identitiesVisible?'隐藏身份':'显示身份';
 $('toggleIdentities').setAttribute('aria-pressed',String(identitiesVisible));
 render();
};
$('copyCode').onclick=async()=>{
 try{await navigator.clipboard.writeText(roomId);$('status').textContent='对局号已复制';}
 catch{$('status').textContent='对局号 '+roomId;}
};
startPolling(pull,2000);
