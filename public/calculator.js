const $ = id => document.getElementById(id);
let matrix;
let analysis;
let usingCustom = false;
let showBest = false;
let showMix = false;
let activeCell = null;
const roleNames = ['A 克制 B','B 克制 A','双方身份相同'];
const number = n => String(Number(n.toPrecision(12)));
function percent(n) {
  const rounded = Number((n*100).toFixed(2));
  if (n>0 && rounded===0) return '&lt;0.01%';
  if (n<1 && rounded===100) return '>99.99%';
  return rounded + '%';
}
const fields = [];
for (const i of [0,1]) {
  for (const j of [0,1]) {
    for (const player of [0,1]) {
      const label = document.createElement('label');
      label.textContent = `A ${strategy[i]} / B ${strategy[j]} · ${player ? 'B' : 'A'} 收益`;
      const input = document.createElement('input');
      Object.assign(input,{type:'number', min:'-1000000', max:'1000000', step:'any', required:true});
      label.append(input);
      $('customFields').append(label);
      fields.push({i,j,player,input});
    }
  }
}
function refresh() {
  if (!usingCustom) {
    const relation = Nash.relation($('a').value,$('b').value);
    matrix = Nash.matrices[relation];
    $('relation').textContent = roleNames[relation] + ' · 零和捕食';
  } else {
    $('relation').textContent = '自定义收益矩阵';
  }
  analysis = Nash.analyze(matrix);
  activeCell = null;
  $('outcome').textContent = '';
  draw();
}
function draw() {
  $('matrix').innerHTML = matrixHTML(matrix,showBest ? analysis.marks : null,activeCell,showBest ? analysis.pure : []);
  $('best').setAttribute('aria-pressed',String(showBest));
  $('best').textContent = showBest ? '隐藏最优反应' : '显示最优反应';
  $('bestText').hidden = !showBest;
  const pure = analysis.pure.length;
  $('bestText').textContent = pure ? `找到 ${pure} 个纯策略纳什均衡，绿色描边处为双方最优反应重合的格子。` : '不存在纯策略纳什均衡，需要考虑混合策略。';
  $('random').disabled = !analysis.interior;
  if (showMix) showSolution();
}
function fraction(n,d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return number(n/d);
  let a = Math.abs(n), b = Math.abs(d);
  while (b) [a,b] = [b,a%b];
  if (d < 0) { n = -n; d = -d; }
  return d/a === 1 ? String(n/a) : `${n/a}/${d/a}`;
}
function term(x,variable) { return `${x < 0 ? '−' : ''}${number(Math.abs(x))}${variable}`; }
function exp(coefs,v) { return term(coefs[0],v) + (coefs[1]<0?' − ':' + ') + term(Math.abs(coefs[1]),`(1−${v})`); }
function solution(coefs,deltas,v) {
  const d = deltas[0]-deltas[1];
  const equation = exp(coefs[0],v) + ' = ' + exp(coefs[1],v);
  let simplified = `${term(d,v)} = ${number(-deltas[1])}`;
  if (d === 0) simplified += deltas[1]===0 ? '，任意概率均满足无差异条件' : '，无解';
  else simplified += `，${v} = ${fraction(-deltas[1],d)}`;
  return `<p class="equation">${equation}<br>${simplified}</p>`;
}
function representative(interval) {
  return interval[0] === interval[1] ? interval[0] : (interval[0]+interval[1])/2;
}
function describe(interval) {
  return interval[0] === interval[1] ? percent(interval[0]) : '在 (0%, 100%) 内均可取';
}
function showSolution() {
  const m = matrix;
  $('derivation').hidden = false;
  const equationsA = solution(m.map(row=>row.map(pair=>pair[0])),analysis.a,'q');
  const equationsB = solution([0,1].map(j=>m.map(row=>row[j][1])),analysis.b,'p');
  $('equations').innerHTML = '<h3>对 B 无差异，求 A 的 p</h3><p>B 进攻期望收益 ＝ B 反击期望收益</p>'+equationsB+'<h3>对 A 无差异，求 B 的 q</h3><p>A 进攻期望收益 ＝ A 反击期望收益</p>'+equationsA;
  const inner = analysis.interior;
  const mixedBoundary = analysis.supports.filter(s=> (s.aChoice===2)!==(s.bChoice===2)).length;
  const pure = analysis.pure.length;
  let html = `<p>纯策略均衡 ${pure} 个。${mixedBoundary ? '另外存在一方随机、另一方固定出招的边界混合均衡。' : ''}</p>`;
  if (!inner) {
    html += '<p class="notice">没有双方进攻概率都严格介于 0% 与 100% 的内点混合均衡。</p>';
  } else {
    const p = representative(inner.p), q = representative(inner.q);
    const multiple = inner.p[0]!==inner.p[1] || inner.q[0]!==inner.q[1];
    if (multiple) html += `<p class="notice">存在无穷多个内点均衡。p ${describe(inner.p)}，q ${describe(inner.q)}。以下显示用于模拟的一组均衡概率。</p>`;
    html += `<div class="fieldrow"><div class="prob">A 进攻 · p<strong>${percent(p)}</strong>反击 ${percent(1-p)}</div><div class="prob">B 进攻 · q<strong>${percent(q)}</strong>反击 ${percent(1-q)}</div></div>`;
  }
  $('probabilities').innerHTML = html;
}
function result(cell,text) {
  activeCell = cell;
  const [i,j] = cell;
  const [a,b] = matrix[i][j];
  $('outcome').textContent = `${text}　A ${strategy[i]}，B ${strategy[j]}。生命变化 A ${score(a)} HP，B ${score(b)} HP。`;
  draw();
}
for (const role of ['a','b']) $(role).onchange = refresh;
$('best').onclick = () => { showBest = !showBest; draw(); };
$('mix').onclick = () => { showMix = true; draw(); };
$('random').onclick = () => {
  if (!analysis.interior) return;
  showMix = true;
  result(Nash.sample(representative(analysis.interior.p),representative(analysis.interior.q)),'均衡抽样');
};
$('manual').onclick = () => result([Number($('manualA').value),Number($('manualB').value)],'手动结算');
$('customToggle').onclick = () => {
  const isOpening = $('custom').hidden;
  $('custom').hidden = !isOpening;
  $('customToggle').setAttribute('aria-expanded',String(isOpening));
  if (isOpening) fields.forEach(({i,j,player,input})=>input.value = matrix[i][j][player]);
};
$('custom').onsubmit = event => {
  event.preventDefault();
  const m = [[[],[]],[[],[]]];
  fields.forEach(({i,j,player,input})=>m[i][j][player] = input.valueAsNumber);
  usingCustom = true;
  matrix = m;
  $('roles').hidden = true;
  refresh();
};
$('restore').onclick = () => {
  usingCustom = false;
  $('roles').hidden = false;
  $('custom').hidden = true;
  $('customToggle').setAttribute('aria-expanded','false');
  refresh();
};
const ids = new URLSearchParams(location.search);
for (const key of ['a','b']) if (['J','Q','K'].includes(ids.get(key))) $(key).value = ids.get(key);
refresh();
