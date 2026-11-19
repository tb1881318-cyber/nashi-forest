const $=id=>document.getElementById(id);
const animals={J:'象',Q:'虎',K:'鼠'};
const roomParam=new URLSearchParams(location.search).get('room');
const playerLabel=p=>p.id+' · '+p.seat+'号';
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');}
async function request(path,body,auth){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/api'+path,{
   method:body?'POST':'GET',
   headers:{'content-type':'application/json',...(auth?{'x-game-session':auth}:{})},
   body:body?JSON.stringify(body):undefined,
   cache:'no-store',
   signal:controller.signal
  });
  if(!response.headers.get('content-type')?.includes('application/json')){
   throw new Error(response.status===401||response.redirected
    ?'登录状态已失效，请重新登录后返回本页'
    :'连接暂时异常，正在自动重试');
  }
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'请求失败');
  return result;
 }catch(error){
  if(error.name==='AbortError')throw new Error('连接超时，请稍后重试');
  if(error instanceof TypeError)throw new Error('网络连接中断，正在恢复同步');
  throw error;
 }finally{clearTimeout(timeout);}
}
function startPolling(task,interval){
 let timer=null,inFlight=false,paused=false,failures=0;
 function schedule(){
  if(!paused)timer=setTimeout(run,Math.min(interval*2**failures,15000));
 }
 async function run(){
  clearTimeout(timer);
  if(paused||inFlight)return;
  if(document.hidden){schedule();return;}
  inFlight=true;
  try{
   const result=await task();
   failures=result===false?Math.min(failures+1,4):0;
  }catch{failures=Math.min(failures+1,4);}
  finally{inFlight=false;schedule();}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)run();});
 window.addEventListener('pagehide',()=>{paused=true;clearTimeout(timer);});
 window.addEventListener('pageshow',()=>{paused=false;run();});
 run();
 return ()=>{paused=true;clearTimeout(timer);};
}
function storedValue(key){
 try{return localStorage.getItem(key);}catch{return null;}
}
function storeValue(key,value){
 try{localStorage.setItem(key,value);return true;}catch{return false;}
}
function setText(id,value){
 const element=$(id);
 if(element.textContent!==value)element.textContent=value;
}
function displayClock(room){
 const ms=room.deadline?room.deadline-Date.now():room.left;
 const s=Math.ceil(Math.max(0,ms)/1000);
 return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function renderHuntHistory(container,events){
 container.replaceChildren();
 for(const e of [...events].reverse()){
  const li=document.createElement('li');
  const time=new Date(e.at).toLocaleTimeString('zh-CN',{hour12:false});
  li.textContent=`${time} · 第${e.round}轮　${e.a} 捕食 ${e.b}　${score(e.gainA)} / ${score(e.gainB)} HP`;
  container.append(li);
 }
 if(!events.length)container.textContent='等待第一场捕食';
}
function setOptions(element,players,placeholder){
 const choices=[];
 if(placeholder)choices.push([placeholder,'']);
 for(const p of players)choices.push([playerLabel(p),String(p.seat)]);
 const unchanged=element.options.length===choices.length&&choices.every(
  ([label,value],index)=>element.options[index].text===label&&element.options[index].value===value
 );
 if(unchanged)return;
 const previous=element.value;
 const fragment=document.createDocumentFragment();
 for(const [label,value] of choices)fragment.append(new Option(label,value));
 element.replaceChildren(fragment);
 if(choices.some(([,value])=>value===previous))element.value=previous;
}
function link(page,room){const url=new URL(page,location.href);url.searchParams.set('room',room);return url.href;}
