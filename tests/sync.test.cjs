const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/session.js'),'utf8');
function setup(){
 const timers=new Map(),events={},windowEvents={};
 let serial=0;
 const document={
  hidden:false,
  getElementById:()=>null,
  addEventListener:(event,fn)=>events[event]=fn,
  createDocumentFragment:()=>({options:[],append(option){this.options.push(option);}})
 };
 const context=vm.createContext({
  URLSearchParams,location:{search:''},document,
  window:{addEventListener:(event,fn)=>windowEvents[event]=fn},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},
  clearTimeout:id=>timers.delete(id),
  Option:function(text,value){this.text=text;this.value=value;},
  AbortController,TypeError
 });
 vm.runInContext(source,context);
 return {context,timers,document,events,windowEvents};
}
const flush=()=>new Promise(setImmediate);
test('慢网同步保持单个请求；切换标签与恢复前台不会堆积请求',async()=>{
 const {context,timers,events,document,windowEvents}=setup();
 let requests=0,resolve;
 context.task=()=>{requests++;return new Promise(r=>resolve=r);};
 vm.runInContext('startPolling(task,2000)',context);
 assert.equal(requests,1);
 events.visibilitychange();windowEvents.pageshow();
 assert.equal(requests,1);
 assert.equal(timers.size,0);
 resolve(true);await flush();
 assert.equal(timers.size,1);
 let [id,timer]=[...timers][0];timers.delete(id);timer.fn();
 assert.equal(requests,2);
 document.hidden=true;
 resolve(true);await flush();
 [id,timer]=[...timers][0];timers.delete(id);timer.fn();
 assert.equal(requests,2);
 document.hidden=false;events.visibilitychange();
 assert.equal(requests,3);
 windowEvents.pagehide();resolve(true);await flush();
 assert.equal(timers.size,0);
});
test('相同名单不会重建下拉菜单，已有选择保留',()=>{
 const {context}=setup();
 let replacements=0;
 const options=[{text:'甲 · 1号',value:'1'},{text:'乙 · 2号',value:'2'}];
 const element={options,value:'2',replaceChildren(fragment){replacements++;this.options=fragment.options;}};
 context.select=element;context.players=[{id:'甲',seat:1},{id:'乙',seat:2}];
 vm.runInContext('setOptions(select,players)',context);
 vm.runInContext('setOptions(select,players)',context);
 assert.equal(replacements,0);
 assert.equal(element.value,'2');
 context.players.push({id:'丙',seat:3});
 vm.runInContext('setOptions(select,players)',context);
 assert.equal(replacements,1);
 assert.equal(element.value,'2');
});
test('登录页响应作为连接错误处理，不自动跳转离开对局',async()=>{
 const {context}=setup();
 context.fetch=async()=>({headers:new Map([['content-type','text/html']]),status:401,redirected:false});
 await assert.rejects(vm.runInContext("request('/rooms/1234')",context),/登录状态已失效/);
});
test('同步脚本保留浏览器原生 history 对象',()=>{
 const nativeHistory={replaceState(){}};
 const context=vm.createContext({
  history:nativeHistory,URLSearchParams,location:{search:''},
  document:{getElementById(){}}
 });
 vm.runInContext(source,context);
 assert.equal(context.history,nativeHistory);
 assert.equal(typeof context.history.replaceState,'function');
});
test('三个台、计算器与规则之间保留对局号，创建新局后更新链接',()=>{
 const links=['host.html','player.html','board.html','calculator.html','index.html','https://example.org/'].map(href=>({
  href,
  getAttribute(){return this.href;}
 }));
 const documentEvents={},windowEvents={};
 const stored=new Map();
 const context=vm.createContext({
  URL,URLSearchParams,Set,
  location:{search:'?room=1234',href:'https://forest.test/board.html?room=1234',origin:'https://forest.test'},
  sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
  document:{querySelectorAll:()=>links,addEventListener:(name,fn)=>documentEvents[name]=fn},
  window:{addEventListener:(name,fn)=>windowEvents[name]=fn}
 });
 const navigation=fs.readFileSync(require('node:path').join(__dirname,'../public/desk-navigation.js'),'utf8');
 vm.runInContext(navigation,context);
 documentEvents.DOMContentLoaded();
 assert.ok(links.slice(0,5).every(a=>new URL(a.href).searchParams.get('room')==='1234'));
 assert.equal(links[5].href,'https://example.org/');
 windowEvents['nash-room-changed']({detail:'5678'});
 assert.ok(links.slice(0,5).every(a=>new URL(a.href).searchParams.get('room')==='5678'));
 assert.equal(context.location.href,'https://forest.test/board.html?room=1234');
});
