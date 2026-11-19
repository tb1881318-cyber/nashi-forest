const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('捕食语音按座位播报一次；不受双方策略提交及轮询重复触发',()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync('public/announcer.js','utf8'),context);
 const calls=[];
 const win={speechSynthesis:{getVoices:()=>[],speak:u=>calls.push(u.text),cancel(){}},SpeechSynthesisUtterance:function(text){this.text=text;}};
 const a=context.createForestAnnouncer(win);
 a.update({id:'one',aSeat:1,bSeat:2});assert.equal(calls.length,0);
 assert.equal(a.toggle(),true);assert.equal(calls[0],'1号玩家选择捕食2号玩家');
 a.update({id:'one',aSeat:1,bSeat:2,submittedA:true});assert.equal(calls.length,1);
 a.update(null);a.update({id:'two',aSeat:7,bSeat:3});assert.equal(calls[1],'7号玩家选择捕食3号玩家');
 a.toggle();a.update({id:'three',aSeat:2,bSeat:1});assert.equal(calls.length,2);
 a.toggle();assert.equal(calls[2],'2号玩家选择捕食1号玩家');
 assert.equal(context.createForestAnnouncer({}).toggle(),false);
});
