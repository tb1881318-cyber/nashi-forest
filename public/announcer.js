function createForestAnnouncer(win){
 const supported=!!(win.speechSynthesis&&win.SpeechSynthesisUtterance);
 let enabled=false,current=null,last=null;
 const spoken=new Set();
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
  toggle(){
   if(!supported)return false;
   enabled=!enabled;
   if(enabled){if(current&&!spoken.has(current.id))announce();else say('语音提示已开启');}
   else win.speechSynthesis.cancel();
   return enabled;
  },
  update(pending){
   current=pending;
   if(pending?.id!==last){last=pending?.id??null;if(enabled)announce();}
  }
 };
}
