(()=>{
const scoreEl=document.getElementById('score');
const scoreBox=document.querySelector('.scoreBox');
const fill=document.getElementById('scoreProgressFill');
const progressText=document.getElementById('scoreProgressText');
const milestone=document.getElementById('scoreMilestone');
const rank=document.getElementById('milestoneRank');
const title=document.getElementById('milestoneTitle');
const sub=document.getElementById('milestoneSub');
if(!scoreEl||!scoreBox||!milestone)return;

const STEP=5000,MAX=30000;
let last=Number(scoreEl.textContent)||0;
let lastMilestone=Math.floor(last/STEP)*STEP;
let fxTimer=0;

function milestoneLabel(v){
 if(v>=30000)return['COSMIC MAX','30000','宇宙級スコア！'];
 if(v>=25000)return['UNIVERSE','25000','宇宙の果てが見えてきた！'];
 if(v>=20000)return['GALAXY','20000','銀河級！'];
 if(v>=15000)return['SUPER NOVA','15000','超新星クラス！'];
 if(v>=10000)return['STAR MASTER','10000','1万点突破！'];
 return['NICE!','5000','5000点突破！'];
}
function tinyPop(delta,big=false){
 if(delta<=0)return;
 const e=document.createElement('div');
 e.className='scorePop'+(big?' big':'');
 e.textContent=`+${delta}`;
 scoreBox.appendChild(e);
 setTimeout(()=>e.remove(),900);
 scoreBox.classList.remove('scorePunch');
 void scoreBox.offsetWidth;
 scoreBox.classList.add('scorePunch');
}
function showMilestone(v){
 const [r,t,s]=milestoneLabel(v);
 rank.textContent=r;title.textContent=t;sub.textContent=s;
 milestone.classList.toggle('mega',v>=20000);
 milestone.classList.remove('show');
 void milestone.offsetWidth;
 milestone.classList.add('show');
 document.body.classList.remove('milestoneFlash');
 void document.body.offsetWidth;
 document.body.classList.add('milestoneFlash');
 clearTimeout(fxTimer);fxTimer=setTimeout(()=>milestone.classList.remove('show'),1550);
 try{navigator.vibrate?.(v>=20000?[60,40,100]:[35,25,60])}catch{}
}
function update(v){
 const delta=v-last;
 tinyPop(delta,delta>=500);
 const capped=Math.min(v,MAX);
 if(fill)fill.style.width=`${capped/MAX*100}%`;
 if(progressText){
   const next=v>=MAX?'MAX 30000':`${Math.min(MAX,(Math.floor(v/STEP)+1)*STEP)}まで`;
   progressText.textContent=next;
 }
 const reached=Math.floor(v/STEP)*STEP;
 if(reached>=STEP&&reached>lastMilestone){
   for(let m=lastMilestone+STEP;m<=reached;m+=STEP)showMilestone(Math.min(m,MAX));
   lastMilestone=reached;
 }
 if(v<last){lastMilestone=0}
 last=v;
}
new MutationObserver(()=>update(Number(scoreEl.textContent)||0)).observe(scoreEl,{childList:true,subtree:true,characterData:true});
update(last);
})();