(()=>{
const state=[mk(),mk()];
let lastTurn='',lastPhase='朝',day=1,huntBusy=false,lastMission='';
function mk(){return{food:6,cap:6,spear:false,firstHunt:false,hungry:false,starveDays:0,lastHuntDay:0}}

const css=document.createElement('style');
css.textContent=`
.cultureHud{position:absolute;left:14px;top:58px;z-index:25;background:#07170fe8;border:1px solid #ffffff35;border-radius:13px;padding:8px 11px;font-weight:900;font-size:.76rem;box-shadow:0 8px 24px #0007;min-width:180px}
.cultureHud b{color:#ffe083}.cultureHud .survivalRow{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.cultureHud .survivalSub{display:block;margin-top:4px;color:#cbd8cf;font-size:.68rem}.cultureAction{position:absolute;left:14px;top:112px;z-index:26;border:1px solid #ffffff35;border-radius:12px;padding:9px 12px;background:#173a2a;color:#fff;font-weight:900;box-shadow:0 7px 18px #0008}.cultureAction:disabled{opacity:.45}.cultureAction.hidden{display:none}.foodFlash{animation:foodFlash .7s}@keyframes foodFlash{50%{filter:brightness(1.8);transform:scale(1.08)}}
.missionClearPop{position:absolute;inset:0;z-index:90;display:grid;place-items:center;pointer-events:none;background:#07110b88;backdrop-filter:blur(3px);opacity:0;transition:opacity .18s}.missionClearPop.show{opacity:1}.missionClearCard{min-width:min(82%,390px);max-width:88%;padding:24px 22px;border-radius:22px;background:#13271ddd;border:1px solid #ffffff45;box-shadow:0 20px 65px #000c;text-align:center;transform:scale(.88);transition:transform .22s}.missionClearPop.show .missionClearCard{transform:scale(1)}.missionClearCard .clearMark{font-size:2.7rem;line-height:1}.missionClearCard small{display:block;margin-top:8px;color:#ffe083;font-weight:900;letter-spacing:.12em}.missionClearCard strong{display:block;margin-top:7px;font-size:1.08rem;line-height:1.55}.missionClearCard b{color:#ffe083}
@media(max-width:520px){.cultureHud{left:8px;top:50px;font-size:.69rem;padding:7px 9px}.cultureAction{left:8px;top:103px;font-size:.72rem;padding:8px 10px}.missionClearCard{padding:20px 16px}.missionClearCard strong{font-size:.96rem}}
`;
document.head.appendChild(css);

const world=document.getElementById('world');
const hud=document.createElement('div');hud.className='cultureHud';hud.id='cultureHud';world.appendChild(hud);
const action=document.createElement('button');action.className='cultureAction hidden';action.id='cultureAction';world.appendChild(action);
const clearPop=document.createElement('div');clearPop.className='missionClearPop';clearPop.innerHTML='<div class="missionClearCard"><div class="clearMark">✨</div><small>MISSION CLEAR</small><strong id="missionClearText"></strong></div>';world.appendChild(clearPop);
let clearTimer=0;
function showMissionClear(item){const text=document.getElementById('missionClearText');if(!text)return;text.innerHTML=`<b>${item}</b>を使用して、<br>ミッションクリアしました。`;clearPop.classList.add('show');clearTimeout(clearTimer);clearTimer=setTimeout(()=>clearPop.classList.remove('show'),1900)}

function currentIndex(){return document.getElementById('p1Card')?.classList.contains('active')?0:1}
function toast(t){let e=document.getElementById('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function invText(i){return document.getElementById(i?'p2Inv':'p1Inv')?.textContent||''}
function storeCounts(i){let t=invText(i),wood=Number((t.match(/🏕️🪵(\d+)/)||[])[1]||0),stone=Number((t.match(/🪨(\d+)/)||[])[1]||0);return{wood,stone}}
function bagCounts(i){if(i!==currentIndex())return{wood:0,stone:0};let t=document.getElementById('bagHud')?.textContent||'',wood=Number((t.match(/🪵(\d+)/)||[])[1]||0),stone=Number((t.match(/🪨(\d+)/)||[])[1]||0);return{wood,stone}}
function totalCounts(i){let a=storeCounts(i),b=bagCounts(i);return{wood:a.wood+b.wood,stone:a.stone+b.stone,store:a,bag:b}}
function coreMission(){return document.getElementById('missionNow')?.textContent||''}
function hasFire(i){let m=coreMission();return !m.includes('火を起こせ')}
function canInventSpear(i){let r=totalCounts(i);return hasFire(i)&&r.wood>=1&&r.stone>=1}

function inventSpear(){let i=currentIndex(),s=state[i];if(s.spear||!canInventSpear(i))return;s.spear=true;showMissionClear('木1・石1');toast('🗡️ 石の槍を発明！ これで動物を狩れる');render()}
function hunt(){let i=currentIndex(),s=state[i];if(!s.spear||huntBusy||s.lastHuntDay===day)return;huntBusy=true;action.disabled=true;action.textContent='🐗 狩り中…';setTimeout(()=>{let gain=4;s.food=Math.min(s.cap,s.food+gain);s.firstHunt=true;s.lastHuntDay=day;s.hungry=false;s.starveDays=0;showMissionClear('石の槍');toast(`🐗 狩り成功！ 🍖 食料 +${gain}`);huntBusy=false;render()},650)}
action.onclick=()=>{let s=state[currentIndex()];if(!s.spear)inventSpear();else hunt()};

function consumeDay(){day++;for(const s of state){if(s.food>0){s.food=Math.max(0,s.food-1);s.hungry=s.food===0;if(!s.hungry)s.starveDays=0}else{s.hungry=true;s.starveDays++}}toast('🌙 1日終了　🍖 食料 -1');render()}

function setMission(title,detail){let mn=document.getElementById('missionNow'),md=document.getElementById('missionNeed');if(!mn||!md)return;mn.textContent=title;md.textContent=detail}
function render(){let i=currentIndex(),s=state[i],r=totalCounts(i);hud.innerHTML=`<div class="survivalRow">DAY ${day}　🍖 <b>${s.food}/${s.cap}</b>${s.spear?'　🗡️':''}${s.hungry?'　⚠️空腹':''}</div><span class="survivalSub">食料は1日ごとに1減る</span>`;
 action.classList.add('hidden');action.disabled=false;
 if(!hasFire(i))return;
 if(!s.spear){setMission('🗡️ 石の槍を発明せよ',`木1・石1 が必要　所持合計：木${r.wood} 石${r.stone}`);action.classList.remove('hidden');action.textContent=canInventSpear(i)?'🗡️ 石の槍を発明':'🗡️ 木1・石1が必要';action.disabled=!canInventSpear(i);return}
 if(!s.firstHunt){setMission('🐗 動物を狩れ！','石の槍を使って食料を確保しよう');action.classList.remove('hidden');action.textContent='🐗 動物を狩る';return}
 if(s.hungry){setMission('🍖 食料を確保せよ！','食料が0。狩りで食料を増やそう');action.classList.remove('hidden');action.textContent=s.lastHuntDay===day?'🐗 今日は狩り済み':'🐗 動物を狩る';action.disabled=s.lastHuntDay===day;return}
 if(s.food<=2){setMission('🍖 食料が少ない！','残りわずか。狩りをして備えよう');action.classList.remove('hidden');action.textContent=s.lastHuntDay===day?'🐗 今日は狩り済み':'🐗 動物を狩る';action.disabled=s.lastHuntDay===day;return}
 const core=invText(i);if(!core.includes('🌊'))setMission('🏕️ 水辺に拠点を作れ','川・海のとなりの陸地へ行こう');else if(!core.includes('🛶'))setMission('🛶 舟をつくれ','基地保管：木4');else setMission('⭐ 川と海を越えろ','水上では舟に変わる');
}

function watchCoreMission(){let now=coreMission();if(!now||now===lastMission){lastMission=now;return}if(lastMission.includes('火を起こせ')&&!now.includes('火を起こせ'))showMissionClear('木2・石1');else if(lastMission.includes('舟をつくれ')&&!now.includes('舟をつくれ'))showMissionClear('木4');lastMission=now}
const turn=document.getElementById('turnText'),time=document.getElementById('timeBadge'),mission=document.getElementById('missionNow');
new MutationObserver(()=>{let t=turn.textContent;if(t!==lastTurn){lastTurn=t;setTimeout(render,80)}}).observe(turn,{childList:true,subtree:true,characterData:true});
new MutationObserver(()=>{let p=time.textContent;if(lastPhase.includes('晩')&&p.includes('朝'))consumeDay();lastPhase=p;render()}).observe(time,{childList:true,subtree:true,characterData:true});
new MutationObserver(()=>setTimeout(watchCoreMission,20)).observe(mission,{childList:true,subtree:true,characterData:true});
const invObserver=new MutationObserver(()=>setTimeout(render,30));invObserver.observe(document.getElementById('p1Inv'),{childList:true,subtree:true,characterData:true});invObserver.observe(document.getElementById('p2Inv'),{childList:true,subtree:true,characterData:true});invObserver.observe(document.getElementById('bagHud'),{childList:true,subtree:true,characterData:true});

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{state[0]=mk();state[1]=mk();day=1;lastPhase='朝';lastMission='';render();watchCoreMission()},250)));
document.getElementById('reset')?.addEventListener('click',()=>setTimeout(()=>{state[0]=mk();state[1]=mk();day=1;lastPhase='朝';lastMission='';render();watchCoreMission()},200));
render();watchCoreMission();
})();