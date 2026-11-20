function tabs(id, labels, activate) {
  const holder = document.getElementById(id);
  const buttons = labels.map((label,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = () => select(index);
    holder.append(button);
    return button;
  });
  function select(index) {
    buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    activate(index);
  }
  select(0);
}
document.querySelector('#phases').innerHTML = phases.map(([name,text],i)=>`<details><summary><span>${i+1}</span>${name}</summary><p>${text}</p></details>`).join('');
document.querySelector('#cards').innerHTML = rounds.map((r,i)=>`<details class="skill"><summary><small>第 ${i+1} 轮</small><span class="symbol" aria-hidden="true">${r.icon}</span><strong>${r.name}</strong><small>补给 +${r.hp} HP · 展开</small></summary><div><p>${r.effect}</p><p><b>使用时机</b>　${r.timing}</p><p><b>使用限制</b>　${r.limit}</p><p><b>策略价值</b>　${r.value}</p><p>${r.theory}</p></div></details>`).join('');

tabs('auctionTabs', rounds.map((r,i)=>'第 '+(i+1)+' 轮'),i=>{
  const r=rounds[i];
  document.querySelector('#auctionPreview').innerHTML=`<div><strong>${r.icon} ${r.name}</strong><p>${r.value}</p></div><strong class="gain">补给 +${r.hp} HP</strong>`;
});
tabs('matrixTabs',['A 克制 B','B 克制 A','身份相同'],i=>{
  const examples=['A＝象，B＝狐狸','A＝象，B＝鼠','A＝象，B＝象'];
  document.querySelector('#matrixPreview').innerHTML=`<p>${examples[i]}</p>`+matrixHTML(Nash.matrices[i]);
});
