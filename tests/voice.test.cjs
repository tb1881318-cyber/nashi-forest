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

test('结果语音在双方揭晓后播报收益，不重播旧记录与轮询结果',()=>{
 const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/announcer.js','utf8'),context);
 const calls=[];
 const a=context.createForestAnnouncer({speechSynthesis:{getVoices:()=>[],speak:u=>calls.push(u.text),cancel(){}},SpeechSynthesisUtterance:function(text){this.text=text;}});
 const old={encounterId:'old',aSeat:2,bSeat:3,row:0,column:0,gainA:4,gainB:-4};
 a.update(null,[old]);a.toggle();assert.equal(calls.length,1);
 const next={encounterId:'new',aSeat:1,bSeat:2,row:0,column:1,gainA:-4,gainB:4};
 a.update(null,[old,next]);
 assert.match(calls[1],/捕食结果，1号玩家选择进攻，2号玩家选择反击/);
 assert.match(calls[1],/1号玩家减少4点生命值，2号玩家增加4点生命值/);
 a.update(null,[old,next]);assert.equal(calls.length,2);
});
