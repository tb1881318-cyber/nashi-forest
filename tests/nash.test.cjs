const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const nashModule = {exports:{}};
new Function('module',fs.readFileSync(require('node:path').join(__dirname,'../public/nash.js'),'utf8'))(nashModule);
const {matrices,relation,analyze,sample} = nashModule.exports;

test('全部九种身份组合及混合均衡',()=>{
  const expected = [[2,0,1],[1,2,0],[0,1,2]];
  const probabilities = [[3/8,1/2],[2/5,8/15],[1/2,1/2]];
  for (const [i,a] of ['J','Q','K'].entries()) for(const [j,b] of ['J','Q','K'].entries()) {
    const type = relation(a,b);
    assert.equal(type,expected[i][j]);
    const m = matrices[type];
    const result = analyze(m);
    assert.equal(result.pure.length,0);
    assert.deepEqual([result.interior.p[0],result.interior.q[0]],probabilities[type]);
    for (const row of m) for(const [x,y] of row) assert.equal(x+y,0);
  }
});
test('三个矩阵的 24 个最优反应标记逐项核对',()=>{
  const expected = [[[true,false],[false,true]],[[false,true],[true,false]]];
  matrices.forEach(m=>assert.deepEqual(analyze(m).marks,expected));
});
test('随机抽样使用两个独立阈值并正确处理等于阈值',()=>{
  for(const m of matrices) {
    const {p:[p],q:[q]}=analyze(m).interior;
    for(const [a,b,row,col] of [[0,0,0,0],[0,q,0,1],[p,0,1,0],[p,q,1,1]]) {
      const draws=[a,b];
      assert.deepEqual(sample(p,q,()=>draws.shift()),[row,col]);
      assert.equal(draws.length,0);
    }
  }
});
test('严格占优策略导致一个纯均衡，无内点均衡',()=>{
  const result=analyze([[[3,3],[3,0]],[[1,3],[1,0]]]);
  assert.deepEqual(result.pure,[[0,0]]);
  assert.equal(result.interior,undefined);
});
test('协调博弈同时存在两个纯均衡和一个内点均衡',()=>{
  const result=analyze([[[2,2],[0,0]],[[0,0],[2,2]]]);
  assert.deepEqual(result.pure,[[0,0],[1,1]]);
  assert.deepEqual(result.interior.p,[.5,.5]);
});
test('所有收益相同，存在连续均衡',()=>{
  const result=analyze([[[1,1],[1,1]],[[1,1],[1,1]]]);
  assert.equal(result.pure.length,4);
  assert.deepEqual(result.interior.p,[0,1]);
  assert.deepEqual(result.interior.q,[0,1]);
  assert.equal(result.supports.length,9);
});
test('无差异只在边界成立，不误报内点均衡',()=>{
  const result=analyze([[[2,2],[1,1]],[[2,1],[0,1]]]);
  assert.equal(result.interior,undefined);
  assert.ok(result.supports.some(s=>s.aChoice===2 || s.bChoice===2));
});
