(function (root) {
  const beats = { J: 'Q', Q: 'K', K: 'J' };
  const matrices = [
    [[[6,-6],[-4,4]],[[-2,2],[4,-4]]],
    [[[3,-3],[-6,6]],[[-4,4],[2,-2]]],
    [[[4,-4],[-3,3]],[[-3,3],[4,-4]]],
  ];
  const relation = (a, b) => a === b ? 2 : beats[a] === b ? 0 : 1;
  // d0 and d1 are the payoff differences between choosing attack and counter,
  // conditional on the opponent attacking or countering, respectively.
  function allowed(d0, d1, choice) {
    if (choice === 2) {
      if (d0 === d1) return d0 === 0 ? [0,1] : null;
      const root = -d1 / (d0-d1);
      return root >= 0 && root <= 1 ? [root,root] : null;
    }
    if (choice === 0) { d0 = -d0; d1 = -d1; }
    if (Math.min(d0,d1) >= 0) return [0,1];
    if (Math.max(d0,d1) < 0) return null;
    const root = -d1 / (d0-d1);
    return d0 > d1 ? [root,1] : [0,root];
  }
  function restrict(interval, choice) {
    if (!interval) return null;
    const [lo,hi] = interval;
    if (choice === 0 || choice === 1) return lo <= choice && hi >= choice ? [choice,choice] : null;
    return hi > 0 && lo < 1 ? interval : null;
  }
  function analyze(m) {
    const a = [0,1].map(j => m[0][j][0]-m[1][j][0]);
    const b = [0,1].map(i => m[i][0][1]-m[i][1][1]);
    const marks = m.map((row,i)=>row.map((_,j)=>[(i===0 ? a[j] : -a[j])>=0,(j===0 ? b[i] : -b[i])>=0]));
    const pure = [];
    const supports = [];
    marks.forEach((row,i)=>row.forEach(([aBest,bBest],j)=>{ if(aBest && bBest) pure.push([i,j]); }));
    for (const aChoice of [0,1,2]) {
      for (const bChoice of [0,1,2]) {
        const p = restrict(allowed(...b,bChoice),aChoice);
        const q = restrict(allowed(...a,aChoice),bChoice);
        if (p && q) supports.push({aChoice,bChoice,p,q});
      }
    }
    const interior = supports.find(s=>s.aChoice===2 && s.bChoice===2);
    return {a,b,marks,pure,supports,interior};
  }
  const sample = (p,q,rng=Math.random)=>[rng()<p?0:1,rng()<q?0:1];
  const api = {beats,matrices,relation,analyze,sample};
  if (typeof module !== 'undefined') module.exports = api;
  else root.Nash = api;
})(globalThis);
