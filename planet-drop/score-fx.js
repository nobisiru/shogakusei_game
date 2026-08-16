(()=>{
  const scoreBox=document.querySelector('.scoreBox');
  const scoreEl=document.getElementById('score');
  const gameWrap=document.querySelector('.gameWrap');
  if(!scoreBox||!scoreEl||!gameWrap||typeof window.addScore!=='function')return;

  const milestones=[
    {score:5000,title:'5,000',sub:'ORBIT BREAK!',rank:'D'},
    {score:10000,title:'10,000',sub:'STAR FORCE!',rank:'C'},
    {score:15000,title:'15,000',sub:'GALAXY RUSH!',rank:'B'},
    {score:20000,title:'20,000',sub:'COSMIC POWER!',rank:'A'},
    {score:25000,title:'25,000',sub:'UNIVERSE SHOCK!',rank:'S'},
    {score:30000,title:'30,000',sub:'LEGENDARY COSMOS!',rank:'S+'}
  ];
  let reached=new Set();

  const overlay=document.createElement('div');
  overlay.className='scoreMilestone';
  overlay.innerHTML='<div class="milestoneBurst"></div><div class="milestoneRank"></div><div class="milestoneTitle"></div><div class="milestoneSub"></div>';
  gameWrap.appendChild(overlay);

  const progress=document.createElement('div');
  progress.className='scoreProgress';
  progress.innerHTML='<div class="scoreProgressFill"></div><span class="scoreProgressText">NEXT 5,000</span>';
  scoreBox.appendChild(progress);

  function currentScore(){return Number(String(scoreEl.textContent).replace(/[^0-9]/g,''))||0}
  function updateProgress(value){
    const capped=Math.min(30000,value);
    const next=Math.min(30000,(Math.floor(capped/5000)+1)*5000);
    const floor=Math.floor(capped/5000)*5000;
    const pct=next===floor?100:((capped-floor)/(next-floor))*100;
    progress.querySelector('.scoreProgressFill').style.width=`${pct}%`;
    progress.querySelector('.scoreProgressText').textContent=capped>=30000?'MAX 30,000':`NEXT ${next.toLocaleString()}`;
  }
  function pointPop(amount){
    const p=document.createElement('div');
    p.className=amount>=1000?'scorePop big':'scorePop';
    p.textContent=`+${amount.toLocaleString()}`;
    scoreBox.appendChild(p);
    setTimeout(()=>p.remove(),850);
    scoreBox.classList.remove('scorePunch');void scoreBox.offsetWidth;scoreBox.classList.add('scorePunch');
  }
  function celebrate(m){
    reached.add(m.score);
    overlay.querySelector('.milestoneRank').textContent=`RANK ${m.rank}`;
    overlay.querySelector('.milestoneTitle').textContent=m.title;
    overlay.querySelector('.milestoneSub').textContent=m.sub;
    overlay.classList.remove('show','mega');void overlay.offsetWidth;
    if(m.score>=30000)overlay.classList.add('mega');
    overlay.classList.add('show');
    document.body.classList.remove('milestoneFlash');void document.body.offsetWidth;document.body.classList.add('milestoneFlash');
    navigator.vibrate?.(m.score>=30000?[80,40,120,40,180]:[40,25,80]);
    try{
      if(typeof window.tone==='function'){
        window.tone(440,.14,'square',.12,1.5);
        setTimeout(()=>window.tone(660,.18,'sine',.15,1.5),100);
        setTimeout(()=>window.tone(m.score>=30000?1320:880,.28,'sine',.18,1.2),220);
      }
    }catch(e){}
    setTimeout(()=>overlay.classList.remove('show'),1500);
  }

  const original=window.addScore;
  window.addScore=function(n){
    const before=currentScore();
    original(n);
    const after=currentScore();
    pointPop(n);
    updateProgress(after);
    for(const m of milestones)if(before<m.score&&after>=m.score&&!reached.has(m.score))celebrate(m);
  };

  const originalReset=window.reset;
  if(typeof originalReset==='function')window.reset=function(){
    reached=new Set();
    const r=originalReset.apply(this,arguments);
    updateProgress(0);
    return r;
  };
  updateProgress(currentScore());
})();