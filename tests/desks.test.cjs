const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function element(){
 return {
  value:'',textContent:'',children:[],
  add(){},setAttribute(){},
  append(...children){this.children.push(...children);},
  replaceChildren(){this.children=[];}
 };
}
function fixture(name,extra={}){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const saved=new Map(),replaced=[];
 const context=vm.createContext({
  $,URL,Option:function(){},
  document:{createElement:element},
  localStorage:{getItem:()=>null},
  storeValue:(key,value)=>saved.set(key,value),
  location:{href:'https://forest.test/host.html'},
  window:{history:{replaceState:(_,__,url)=>replaced.push(url)},dispatchEvent(){}},
  CustomEvent:function(type,options){this.type=type;this.detail=options.detail;},
  startPolling(){},setOptions(){},storedValue:()=>null,
  animals:{J:'象',Q:'虎',K:'鼠'},
  strategy:['进攻','反击'],
  score:value=>value>0?'+'+value:String(value),
  playerLabel:p=>p.id,
  link:(page,room)=>page+'?room='+room,
  ...extra
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/'+name+'.js'),'utf8'),context);
 return {context,$,saved,replaced};
}
function text(element){return element.textContent+element.children.map(text).join('');}
test('同人数空局连续创建，两次都显示新房号并更新分享链接与地址',async()=>{
 let calls=0;
 const emptyState={count:7,players:[]};
 const {$,saved,replaced}=fixture('host',{
  request:async()=>({room:String(++calls===1?1111:2222),hostToken:'token'+calls,state:emptyState})
 });
 await $('setup').onsubmit({preventDefault(){}});
 assert.equal($('roomNumber').textContent,'对局号 1111');
 await $('setup').onsubmit({preventDefault(){}});
 assert.equal($('roomNumber').textContent,'对局号 2222');
 assert.equal($('playerLink').value,'player.html?room=2222');
 assert.equal($('seats').children.length,7);
 assert.equal(JSON.parse(saved.get('nash-host-online')).room,'2222');
 assert.equal(replaced.at(-1),'https://forest.test/host.html?room=2222');
 assert.equal($('create').disabled,false);
});
test('等待新局返回时拦住重复点击，失败后按钮恢复',async()=>{
 let reject,calls=0;
 const {$}=fixture('host',{
  request:()=>{calls++;return new Promise((_,r)=>reject=r);}
 });
 const pending=$('setup').onsubmit({preventDefault(){}});
 assert.equal($('create').disabled,true);
 await $('setup').onsubmit({preventDefault(){}});
 assert.equal(calls,1);
 reject(new Error('网络异常'));await pending;
 assert.equal($('create').disabled,false);
 assert.equal($('status').textContent,'网络异常');
});
test('个人交手按轮次显示双方策略和正确收益视角，包含被捕食记录',()=>{
 const sample={
  id:'我',seat:1,identity:'J',hp:20,coins:10,alive:true,hpHistory:[],
  state:{count:7,round:3,players:[],events:[
   {round:1,at:1,aSeat:1,bSeat:2,a:'我',b:'乙',row:0,column:1,gainA:-4,gainB:4},
   {round:2,at:2,aSeat:3,bSeat:1,a:'丙',b:'我',row:1,column:0,gainA:-2,gainB:2},
   {round:2,at:3,aSeat:3,bSeat:2,a:'丙',b:'乙',row:1,column:0,gainA:-2,gainB:2}
  ]}
 };
 const {context,$}=fixture('player',{roomParam:null,sample});
 vm.runInContext('me=sample;render()',context);
 assert.equal($('encounters').children.length,3);
 const rounds=$('encounters').children.map(text);
 assert.match(rounds[0],/你捕食 乙/);
 assert.match(rounds[0],/你 进攻，对方 反击 · 你 -4 HP，对方 \+4 HP/);
 assert.match(rounds[1],/丙 捕食你/);
 assert.match(rounds[1],/你 进攻，对方 反击 · 你 \+2 HP，对方 -2 HP/);
 assert.ok(!rounds[1].includes('丙捕食乙'));
 assert.match(rounds[2],/本轮暂无交手/);
 assert.ok(!/[象虎鼠]/.test(text($('encounters'))));
 const before=$('encounters').children[0];
 vm.runInContext('render()',context);
 assert.equal($('encounters').children[0],before);
});

test('无对局参数重新打开玩家台会恢复保存的身份，计算器携带对局号',async()=>{
 const sample={id:'已注册',seat:1,identity:'J',hp:18,coins:15,alive:true,hpHistory:[],duel:null,state:{count:3,round:1,players:[],events:[]}};
 const secrets=new Map([['nash-player-last-room','2698'],['nash-player-2698','a'.repeat(48)],['nash-player-last-id','已注册']]);
 let calls=[];
 const {context,$,saved}=fixture('player',{roomParam:null,storedValue:k=>secrets.get(k)||null,secret:()=>{throw Error('must reuse secret');},request:async(...args)=>{calls.push(args);return sample;}});
 assert.equal($('join').hidden,true);
 await vm.runInContext('pull()',context);
 assert.equal(calls[0][0],'/rooms/2698/me');assert.equal(calls[0][2],'a'.repeat(48));
 assert.equal($('name').textContent,'已注册');assert.equal($('join').hidden,true);
 assert.equal($('playerCalculator').href,'calculator.html?room=2698');
 assert.equal(saved.get('nash-player-last-room'),'2698');
 $('switchRoom').onclick();assert.equal($('join').hidden,false);assert.equal($('hand').hidden,true);
});

test('三人到齐时主持人显示开始对局入口并直达本轮拍卖',async()=>{
 const state={count:3,round:1,players:[1,2,3].map(seat=>({id:'P'+seat,seat})),sales:[null,null],order:[]};
 const {$}=fixture('host',{request:async()=>({room:'3456',hostToken:'host',state})});
 await $('setup').onsubmit({preventDefault(){}});
 assert.equal($('boardLink').textContent,'开始对局 · 进入拍卖');
 assert.equal($('boardLink').href,'board.html?room=3456#roundAuction');
 assert.match($('startHint').textContent,/人数已齐/);
});
