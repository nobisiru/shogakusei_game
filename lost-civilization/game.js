const W = 9, H = 7;

const baseMap = [
  ['water','water','grass','grass','grass','grass','grass','water','water'],
  ['water','grass','tree','grass','rock','grass','tree','grass','water'],
  ['grass','grass','grass','grass','grass','grass','grass','grass','grass'],
  ['grass','rock','grass','grass','grass','grass','sand','grass','grass'],
  ['grass','grass','tree','grass','grass','rock','grass','grass','grass'],
  ['water','grass','grass','sand','grass','grass','tree','grass','water'],
  ['water','water','grass','grass','grass','sand','grass','water','water']
];

const blocked = new Set(['water']);
const icons = { grass:'', water:'🌊', tree:'🌲', rock:'🪨', sand:'🏖️' };
let state;

function freshState(){return {player:{x:4,y:3},map:baseMap.map(r=>[...r]),inv:{wood:0,stone:0,sand:0},built:{fire:false,furnace:false,glass:false},level:0,log:['目を覚ました。手元には何もない。'],clear:false};}
function tileGround(type){if(type==='water') return 'water'; if(type==='rock') return 'rockground'; if(type==='sand') return 'sandground'; return 'grass';}
function render(){
  const mapEl=document.getElementById('map'); mapEl.innerHTML='';
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const type=state.map[y][x], el=document.createElement('div'); el.className=`tile ${tileGround(type)}`;
    if(state.built.fire&&x===4&&y===3) el.classList.add('camp');
    const isPlayer=state.player.x===x&&state.player.y===y; let content='';
    if(isPlayer) content='<span class="player">🧭</span>'; else if(type!=='grass') content=`<span class="resource">${icons[type]}</span>`;
    if(state.built.fire&&!isPlayer&&x===4&&y===3) content='<span>🔥</span>'; if(state.built.furnace&&!isPlayer&&x===5&&y===3) content='<span>🧱</span>';
    el.innerHTML=content; mapEl.appendChild(el);
  }
  const inv=state.inv;
  document.getElementById('inventory').innerHTML=[['wood','🪵 木',inv.wood],['stone','🪨 石',inv.stone],['sand','⌛ 砂',inv.sand]].map(([k,n,v])=>`<span class="item ${v===0?'zero':''}">${n} × ${v}</span>`).join('');
  document.getElementById('level').textContent=state.level; document.getElementById('missionText').textContent=missionText();
  document.querySelectorAll('.craft').forEach(btn=>{const kind=btn.dataset.craft; btn.classList.toggle('done',state.built[kind]); btn.disabled=!canCraft(kind)||state.built[kind];});
  document.getElementById('log').innerHTML=state.log.slice(-6).reverse().map((x,i)=>`<li class="${i===0?'new':''}">${x}</li>`).join('');
}
function missionText(){if(!state.built.fire) return '木×2・石×1を集めて、たき火をつくろう'; if(!state.built.furnace) return '石×2・木×1を集めて、簡易炉をつくろう'; if(!state.built.glass) return '砂×2・木×1を集めて、ガラスをつくろう'; return '文明LEVEL 1 達成！';}
function canCraft(kind){const i=state.inv; if(kind==='fire') return i.wood>=2&&i.stone>=1; if(kind==='furnace') return state.built.fire&&i.stone>=2&&i.wood>=1; if(kind==='glass') return state.built.furnace&&i.sand>=2&&i.wood>=1; return false;}
function craft(kind){if(!canCraft(kind)||state.built[kind]) return; if(kind==='fire'){state.inv.wood-=2;state.inv.stone-=1;state.built.fire=true;addLog('火を起こした！ 熱が使えるようになった。');toast('🔥 たき火を発明！');} if(kind==='furnace'){state.inv.stone-=2;state.inv.wood-=1;state.built.furnace=true;addLog('簡易炉が完成。高い温度をつくれる。');toast('🧱 簡易炉を発明！');} if(kind==='glass'){state.inv.sand-=2;state.inv.wood-=1;state.built.glass=true;state.level=1;addLog('砂を熱してガラスを作った！');toast('🪟 ガラスを発明！');state.clear=true;setTimeout(()=>document.getElementById('clearDialog').showModal(),450);} render();}
function addLog(text){state.log.push(text);} function move(dx,dy){if(state.clear) return; const nx=state.player.x+dx,ny=state.player.y+dy;if(nx<0||ny<0||nx>=W||ny>=H)return;const type=state.map[ny][nx];if(blocked.has(type)){toast('🌊 水はまだ渡れない');return;}state.player={x:nx,y:ny};collect(nx,ny);render();}
function collect(x,y){const type=state.map[y][x]; if(type==='tree'){state.inv.wood+=2;state.map[y][x]='grass';addLog('木を集めた。加工や燃料に使えそうだ。');toast('🪵 木 +2');}else if(type==='rock'){state.inv.stone+=2;state.map[y][x]='grass';addLog('石を集めた。炉の材料になりそうだ。');toast('🪨 石 +2');}else if(type==='sand'){state.inv.sand+=2;state.map[y][x]='grass';addLog('砂を集めた。強く熱すると何か起きそうだ。');toast('⌛ 砂 +2');}}
let toastTimer; function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1100);} function reset(){const d=document.getElementById('clearDialog');if(d.open)d.close();state=freshState();render();toast('探索スタート！');}
function dir(name){const v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[name];move(...v);} document.addEventListener('keydown',e=>{const key=e.key.toLowerCase(),dirs={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};if(dirs[key]){e.preventDefault();dir(dirs[key]);}});
document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>dir(b.dataset.move)));document.querySelectorAll('[data-craft]').forEach(b=>b.addEventListener('click',()=>craft(b.dataset.craft)));document.getElementById('reset').addEventListener('click',reset);document.getElementById('playAgain').addEventListener('click',reset);
let touchStart=null;document.getElementById('map').addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStart=[t.clientX,t.clientY]},{passive:true});document.getElementById('map').addEventListener('touchend',e=>{if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart[0],dy=t.clientY-touchStart[1];touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;if(Math.abs(dx)>Math.abs(dy))dir(dx>0?'right':'left');else dir(dy>0?'down':'up');},{passive:true});reset();