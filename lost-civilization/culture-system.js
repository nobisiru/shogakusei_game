(()=>{
const state=[mk(),mk()];
let lastTurn='',lastPhase='朝',day=1,huntBusy=false;
function mk(){return{food:6,cap:6,spear:false,firstHunt:false,hungry:false,starveDays:0,lastHuntDay:0}}

const css=document.createElement('style');
css.textContent=`
.cultureHud{position:absolute;left:14px;top:58px;z-index:25;background:#07170fe8;border:1px solid #ffffff35;border-radius:13px;padding:8px 11px;font-weight:900;font-size:.76rem;box-shadow:0 8px 24px #0007;min-width:180px}
.cultureHud b{color:#ffe083}.cultureHud .survivalRow{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.cultureHud .survivalSub{display:block;margin-top:4px;color:#cbd8cf;font-size:.68rem}.cultureAction{position:absolute;left:14px;top:112px;z-index:26;border:1px solid #ffffff35;border-radius:12px;padding:9px 12px;background:#173a2a;color:#fff;font-weight:900;box-shadow:0 7px 18px #0008}.cultureAction:disabled{opacity:.45}.cultureAction.hidden{display:none}.foodFlash{animation:foodFlash .7s}@keyframes foodFlash{50%{filter:brightness(1.8);transform:scale(1.08)}}
@media(max-width:520px){.cultureHud{left:8px;top:50px;font-size:.69rem;padding:7px 9px}.cultureAction{left:8px;top:103px;font-size:.72rem;padding:8px 10px}}
`;
document.head.appendChild(css);

const world=document.getElementById('world');
const hud=document.createElement('div');hud.className='cultureHud';hud.id='cultureHud';world.appendChild(hud);
const action=document.createElement('button');action.className='cultureAction hidden';action.id='cultureAction';world.appendChild(action);

function currentIndex(){return document.getElementById('p1Card')?.classList.contains('active')?0:1}
function toast(t){let e=document.getElementById('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function invText(i){return document.getElementById(i?'p2Inv':'p1Inv')?.textContent||''}
function storeCounts(i){let t=invText(i),wood=Number((t.match(/🏕️🪵(\d+)/)||[])[1]||0),stone=Number((t.match(/🪨(\d+)/)||[])[1]||0);return{wood,stone}}
function coreMission(){return document.getElementById('missionNow')?.textContent||''}
function hasFire(i){let m=coreMission();return !m.includes('火を起こせ')}
function canInventSpear(i){let r=storeCounts(i);return hasFire(i)&&r.wood>=1&&r.stone>=1}

function inventSpear(){let i=currentIndex(),s=state[i];if(s.spear||!canInventSpear(i))return;s.spear=true;toast('🗡️ 石の槍を発明！ これで動物を狩れる');render()}
function hunt(){let i=currentIndex(),s=state[i];if(!s.spear||huntBusy||s.lastHuntDay===day)return;huntBusy=true;action.disabled=true;action.textContent='🐗 狩り中…';setTimeout(()=>{let gain=4;s.food=Math.min(s.cap,s.food+gain);s.firstHunt=true;s.lastHuntDay=day;s.hungry=false;s.starveDays=0;toast(`🐗 狩り成功！ 🍖 食料 +${gain}`);huntBusy=false;render()},650)}
action.onclick=()=>{let s=state[currentIndex()];if(!s.spear)inventSpear();else hunt()};

function consumeDay(){day++;for(const s of state){if(s.food>0){s.food=Math.max(0,s.food-1);s.hungry=s.food===0;if(!s.hungry)s.starveDays=0}else{s.hungry=true;s.starveDays++}}toast('🌙 1日終了　🍖 食料 -1');render()}

function setMission(title,detail){let mn=document.getElementById('missionNow'),md=document.getElementById('missionNeed');if(!mn||!md)return;mn.textContent=title;md.textContent=detail}
function render(){let i=currentIndex(),s=state[i],r=storeCounts(i);hud.innerHTML=`<div class="survivalRow">DAY ${day}　🍖 <b>${s.food}/${s.cap}</b>${s.spear?'　🗡️':''}${s.hungry?'　⚠️空腹':''}</div><span class="survivalSub">食料は1日ごとに1減る</span>`;
 action.classList.add('hidden');action.disabled=false;
 if(!hasFire(i))return;
 if(!s.spear){setMission('🗡️ 石の槍を発明せよ','火の次は狩り。基地に 木1・石1 をそろえよう');action.classList.remove('hidden');action.textContent=canInventSpear(i)?'🗡️ 石の槍を発明':'🗡️ 木1・石1が必要';action.disabled=!canInventSpear(i);return}
 if(!s.firstHunt){setMission('🐗 動物を狩れ！','石の槍を使って食料を確保しよう');action.classList.remove('hidden');action.textContent='🐗 動物を狩る';return}
 if(s.hungry){setMission('🍖 食料を確保せよ！','食料が0。狩りで食料を増やそう');action.classList.remove('hidden');action.textContent=s.lastHuntDay===day?'🐗 今日は狩り済み':'🐗 動物を狩る';action.disabled=s.lastHuntDay===day;return}
 if(s.food<=2){setMission('🍖 食料が少ない！','残りわずか。狩りをして備えよう');action.classList.remove('hidden');action.textContent=s.lastHuntDay===day?'🐗 今日は狩り済み':'🐗 動物を狩る';action.disabled=s.lastHuntDay===day;return}
 // 最初の狩りを終えたら、既存の水辺拠点→舟ミッションへ戻す。
 const core=invText(i);if(!core.includes('🌊'))setMission('🏕️ 水辺に拠点を作れ','川・海のとなりの陸地へ行こう');else if(!core.includes('🛶'))setMission('🛶 舟をつくれ','基地保管：木4');else setMission('⭐ 川と海を越えろ','水上では舟に変わる');
}

const turn=document.getElementById('turnText'),time=document.getElementById('timeBadge');
new MutationObserver(()=>{let t=turn.textContent;if(t!==lastTurn){lastTurn=t;setTimeout(render,80)}}).observe(turn,{childList:true,subtree:true,characterData:true});
new MutationObserver(()=>{let p=time.textContent;if(lastPhase.includes('晩')&&p.includes('朝'))consumeDay();lastPhase=p;render()}).observe(time,{childList:true,subtree:true,characterData:true});
const invObserver=new MutationObserver(()=>setTimeout(render,30));invObserver.observe(document.getElementById('p1Inv'),{childList:true,subtree:true,characterData:true});invObserver.observe(document.getElementById('p2Inv'),{childList:true,subtree:true,characterData:true});

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{state[0]=mk();state[1]=mk();day=1;lastPhase='朝';render()},250)));
document.getElementById('reset')?.addEventListener('click',()=>setTimeout(()=>{state[0]=mk();state[1]=mk();day=1;lastPhase='朝';render()},200));
render();
})();