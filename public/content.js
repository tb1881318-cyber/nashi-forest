const rounds = [
  {name:'鹰眼', icon:'🦅', phase:'体验阶段', hp:3, timing:'建议在谈判前使用', limit:'查看一名其他玩家，使用一次即消耗。', effect:'秘密查看一名其他玩家的身份。你可以保密、交换或公开这条情报。', value:'减少信息不对称，帮助选择捕食对象。', theory:'不完全信息博弈 · 信息价值', teaching:'熟悉身份、公开拍卖和捕食。直接用计算器求解，第一轮无需手算。'},
  {name:'生死契约',icon:'🤝',phase:'理论阶段',hp:4,timing:'获得技能后当轮随时可用，不限阶段，当轮有效',limit:'双方同意后各托管 3 HP，保证金暂不计入可用生命值。',effect:'双方守约时轮末各取回 3 HP。一方主动捕食契约对象即视为背叛，守约方获得合计 6 HP。',value:'给合作提供可信承诺，也为背叛保留策略空间。',theory:'重复博弈 · 可信承诺',teaching:'挑一场对决，先展示矩阵，再用划线法、无差异条件手算，最后用计算器验证。'},
  {name:'狼王',icon:'🐺',phase:'策略阶段',hp:5,timing:'第三轮行动阶段',limit:'两次额外捕食必须选择不同目标，轮末失效，可无视自然保护区，攻击已被捕食的玩家；普通捕食仍遵守保护区。',effect:'得到两次额外捕食机会。持有者可自用，也可分给存活盟友。额外行动排在本轮常规行动之后，每次由实际发起人单独结算。',value:'改变威慑关系、联盟价值和目标选择。',theory:'行动机会 · 策略互动',teaching:'观察额外捕食机会如何改变威慑和联盟。'},
  {name:'断尾求生',icon:'🦎',phase:'博弈阶段',hp:6,timing:'被指定为捕食目标时',limit:'支付 3 HP，仅能使用一次。没有合法新目标时不可用，不可连续重定向。',effect:'取消针对自己的捕食，指定另一名未受保护的合法目标。发起人保持原位，新目标与其按原规则对决。',value:'转移对手目标，制造第三方风险。',theory:'策略预期 · 第三方外部性',teaching:'请学生讨论，其他玩家会如何预判和应对目标转移。'},
  {name:'森林权杖',icon:'👑',phase:'决胜阶段',hp:7,timing:'第五轮确定行动顺序时',limit:'指定一名存活玩家，使用后消耗。',effect:'指定第五轮第一位行动的玩家，其余存活玩家按座位顺时针行动。',value:'通过先手和目标选择影响决胜。',theory:'行动顺序 · 生命值管理',teaching:'比较轮次起点如何改变可选目标，并决定最后的生命值管理策略。'},
];
const phases = [
  ['拍卖','分别拍卖技能和补给。默认公开加价，最高出价者按自己的出价付款。'],
  ['自由谈判','限时四分钟，可交换情报、结盟或虚张声势。生死契约才有违约惩罚。'],
  ['确定顺序','每轮从本抽签池尚未抽中的存活玩家中随机摇号；所有存活玩家都抽过后重置抽签池，允许再次抽中。从起始座位顺时针行动。第五轮可用权杖指定先手。'],
  ['轮流捕食','默认每人主动捕食一次。可免费暂时跳过，稍后轮回；无目标免费结束。输家进入自然保护区，本轮不能被普通捕食，但仍能主动捕食。'],
  ['生命结算','先处理保证金，再淘汰 HP≤0 的玩家。下一轮重置保护状态。'],
];
const strategy = ['进攻','反击'];
function score(x) { return x > 0 ? '+' + x : String(x); }
function matrixHTML(m, marks, active, pure = []) {
  return '<table class="matrix"><thead><tr><th scope="col">A ＼ B</th><th scope="col">B 进攻</th><th scope="col">B 反击</th></tr></thead><tbody>' + m.map((row,i)=>'<tr><th scope="row">A '+strategy[i]+'</th>'+row.map((pair,j)=>{
    const isPure = pure.some(([r,c])=>i===r && j===c);
    return '<td class="'+(active?.[0]===i&&active?.[1]===j?'active ':'')+(isPure?'pure':'')+'"><div class="payoff">'+pair.map((v,k)=>'<span class="'+(v>0?'gain':v<0?'loss':'neutral')+(marks?.[i][j][k]?' best':'')+'"'+(marks?.[i][j][k]?' aria-label="'+(k?'B':'A')+' 的最优反应 '+v+'"':'')+'>'+score(v)+'</span>').join('<span aria-hidden="true">,</span>')+'</div>'+(isPure?'<small>纯策略均衡</small>':'')+'</td>';
  }).join('')+'</tr>').join('')+'</tbody></table>';
}
