const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('倒计时按服务器时间校准，设备慢两秒也不超过四分钟',()=>{
 const context=vm.createContext({document:{},location:{search:''},URLSearchParams,Date:{now:()=>100000}});
 vm.runInContext(fs.readFileSync('public/session.js','utf8'),context);
 context.room={deadline:342000,left:240000,clockOffset:2000};
 assert.equal(vm.runInContext('displayClock(room)',context),'04:00');
 context.room.deadline=332000;
 assert.equal(vm.runInContext('displayClock(room)',context),'03:50');
 context.room.deadline=99000;
 assert.equal(vm.runInContext('displayClock(room)',context),'00:00');
 context.room={deadline:342000,left:240000};
 assert.equal(vm.runInContext('displayClock(room)',context),'04:00');
});
