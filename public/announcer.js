function createForestAnnouncer(win){
 const supported=!!(win.speechSynthesis&&win.SpeechSynthesisUtterance);
 let enabled=false,current=null,last=null;
 const spoken=new Set(),results=new Set();
 let initialized=false;
 function say(text){
  if(!enabled||!supported)return;
  const utterance=new win.SpeechSynthesisUtterance(text);
  utterance.lang='zh-CN';utterance.rate=0.95;
  const voices=win.speechSynthesis.getVoices();
  const chinese=voices.find(v=>/^zh[-_]CN/i.test(v.lang))??voices.find(v=>/^zh/i.test(v.lang));
  if(chinese)utterance.voice=chinese;
  win.speechSynthesis.speak(utterance);
 }
 function announce(){
  if(!current||spoken.has(current.id))return;
  spoken.add(current.id);
  say(current.aSeat+'号玩家选择捕食'+current.bSeat+'号玩家');
 }
 return {
  supported,
  preview(){
   if(!supported)return false;
   const previous=enabled;enabled=true;
   say('1号玩家选择捕食2号玩家。捕食结果，1号玩家选择进攻，2号玩家选择反击。1号玩家减少4点生命值，2号玩家增加4点生命值。');
   enabled=previous;return true;
  },
  toggle(){
   if(!supported)return false;
   enabled=!enabled;
   if(enabled){if(current&&!spoken.has(current.id))announce();else say('语音提示已开启');}
   else win.speechSynthesis.cancel();
   return enabled;
  },
  update(pending,events=[]){
   for(const event of events){
    const key=event.encounterId??[event.round,event.at,event.aSeat,event.bSeat].join(':');
    if(results.has(key))continue;
    results.add(key);
    if(initialized&&enabled){
     const gain=(seat,value)=>seat+'号玩家'+(value>0?'增加':value<0?'减少':'不变')+(value===0?'':Math.abs(value)+'点生命值');
     say('捕食结果，'+event.aSeat+'号玩家选择'+(event.row===0?'进攻':'反击')+'，'+event.bSeat+'号玩家选择'+(event.column===0?'进攻':'反击')+'。'+gain(event.aSeat,event.gainA)+'，'+gain(event.bSeat,event.gainB));
    }
   }
   initialized=true;
   current=pending;
   if(pending?.id!==last){last=pending?.id??null;if(enabled)announce();}
  }
 };
}
