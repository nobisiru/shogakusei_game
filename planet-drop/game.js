const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score');
const finalScoreEl=document.getElementById('finalScore');
const messageEl=document.getElementById('message');
const nextPreview=document.getElementById('nextPreview');
const missionText=document.getElementById('missionText');
const restartBtn=document.getElementById('restartBtn');
const againBtn=document.getElementById('againBtn');
const evoRow=document.getElementById('evoRow');

const W=720,H=980,WALL=24;
const GLOBAL_GRAVITY=0,BOUNCE=.72,MAX_SPEED=7.2,MUTUAL_G=10;
const OVERFLOW_COUNT=24,OVERFLOW_TIME=2200;
const STREAK_WINDOW=720,STREAK_MAX=12;

const levels=[
  {name:'ちり',r:30,score:1,c1:'#9ca3b7',c2:'#697084'},
  {name:'岩',r:40,score:3,c1:'#c48b66',c2:'#7e563f'},
  {name:'小惑星',r:53,score:8,c1:'#c5b79b',c2:'#746b5c'},
  {name:'衛星',r:68,score:18,c1:'#d9e3ef',c2:'#8997a9'},
  {name:'惑星',r:88,score:40,c1:'#5cc7e9',c2:'#275f9d'},
  {name:'巨大惑星',r:110,score:85,c1:'#f0b86c',c2:'#9c5c4c'},
  {name:'恒星',r:136,score:180,c1:'#ffd45a',c2:'#ef6a37'},
  {name:'ブラックホール',r:160,score:420,c1:'#6a4bf1',c2:'#0c0c18'}
];

let balls=[],score=0,nextLevel=0,dropX=W/2,canDrop=true,gameOver=false,lastTime=0,overflowTimer=0,mergeLock=new Set();
let streak=0,lastLaunchAt=0,streakGlow=0,shots=[];

function id(){return crypto.randomUUID?.()||Math.random().toString(36)}
function massOf(b){return Math.max(1,(b.r/30)**2)}
function randNext(){const r=Math.random();return r<.62?0:r<.9?1:2}
function streakMultiplier(){return 1+Math.min(2,Math.floor(streak/4)*.5)}

function reset(){
  balls=[];score=0;dropX=W/2;nextLevel=randNext();canDrop=true;gameOver=false;overflowTimer=0;mergeLock.clear();
  streak=0;lastLaunchAt=0;streakGlow=0;shots=[];lastTime=0;
  scoreEl.textContent='0';messageEl.classList.add('hidden');updateNext();updateMission();
}
function updateNext(){
  const lv=levels[nextLevel];
  nextPreview.innerHTML=`<div style="width:${Math.min(34,lv.r*.55)}px;height:${Math.min(34,lv.r*.55)}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2})"></div>`;
}
function updateMission(){
  const max=balls.reduce((m,b)=>Math.max(m,b.level),0),target=Math.min(max+1,levels.length-1);
  missionText.textContent=target===levels.length-1?'ブラックホールを完成させよう':`${levels[target].name}をつくろう`;
}
function addScore(n){score+=n;scoreEl.textContent=score}

function dropBall(){
  if(!canDrop||gameOver)return;
  const now=performance.now();
  streak=(now-lastLaunchAt<STREAK_WINDOW)?Math.min(STREAK_MAX,streak+1):1;
  lastLaunchAt=now;streakGlow=1;
  const lv=levels[nextLevel];
  const x=Math.max(WALL+lv.r,Math.min(W-WALL-lv.r,dropX));
  const vx=(Math.random()-.5)*1.5,vy=3.05+Math.random()*.6;
  balls.push({id:id(),x,y:WALL+lv.r+8,vx,vy,r:lv.r,level:nextLevel,age:0});
  shots.push({x,y:WALL+10,life:1});
  canDrop=false;nextLevel=randNext();updateNext();
  setTimeout(()=>{canDrop=true},125);
}

function isOverlapping(a,b,slack=1){const dx=b.x-a.x,dy=b.y-a.y,min=a.r+b.r;return dx*dx+dy*dy<=min*min*slack*slack}
function merge(a,b){
  if(a.level!==b.level||a.level>=levels.length-1)return false;
  const key=[a.id,b.id].sort().join(':');
  if(mergeLock.has(key)||!isOverlapping(a,b,1.035))return false;
  mergeLock.add(key);
  const ma=massOf(a),mb=massOf(b),total=ma+mb,nl=a.level+1,lv=levels[nl];
  const merged={id:id(),x:(a.x*ma+b.x*mb)/total,y:(a.y*ma+b.y*mb)/total,vx:(a.vx*ma+b.vx*mb)/total,vy:(a.vy*ma+b.vy*mb)/total,r:lv.r,level:nl,age:0,pulse:1};
  balls=balls.filter(x=>x!==a&&x!==b);balls.push(merged);
  addScore(Math.round(lv.score*streakMultiplier()));updateMission();streakGlow=1;
  return true;
}
function circleCollision(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,min=a.r+b.r;if(d2>=min*min||d2===0)return;
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,overlap=min-d,ma=massOf(a),mb=massOf(b),sum=ma+mb;
  a.x-=nx*overlap*(mb/sum);a.y-=ny*overlap*(mb/sum);b.x+=nx*overlap*(ma/sum);b.y+=ny*overlap*(ma/sum);
  const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;
  if(rel<0){const j=-(1+BOUNCE)*rel/(1/ma+1/mb);a.vx-=j*nx/ma;a.vy-=j*ny/ma;b.vx+=j*nx/mb;b.vy+=j*ny/mb}
}
function applyMutualGravity(step){
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j];if(a.level<4&&b.level<4)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d2=Math.max(900,dx*dx+dy*dy),d=Math.sqrt(d2),nx=dx/d,ny=dy/d,ma=massOf(a),mb=massOf(b),force=MUTUAL_G*ma*mb/d2;
    a.vx+=force*nx/ma*step;a.vy+=force*ny/ma*step;b.vx-=force*nx/mb*step;b.vy-=force*ny/mb*step;
  }
}

function simulate(dt){
  if(gameOver)return;
  const step=Math.min(1.7,dt/16.67),now=performance.now();
  if(now-lastLaunchAt>STREAK_WINDOW)streak=0;
  streakGlow=Math.max(0,streakGlow-.04*step);
  shots.forEach(s=>{s.y+=22*step;s.life-=.08*step});shots=shots.filter(s=>s.life>0);
  applyMutualGravity(step);
  balls.forEach(b=>{
    b.age+=dt;b.vy+=GLOBAL_GRAVITY*step;const speed=Math.hypot(b.vx,b.vy);if(speed>MAX_SPEED){b.vx=b.vx/speed*MAX_SPEED;b.vy=b.vy/speed*MAX_SPEED}
    b.x+=b.vx*step;b.y+=b.vy*step;
    if(b.x-b.r<WALL){b.x=WALL+b.r;b.vx=Math.abs(b.vx)*BOUNCE}if(b.x+b.r>W-WALL){b.x=W-WALL-b.r;b.vx=-Math.abs(b.vx)*BOUNCE}
    if(b.y-b.r<WALL){b.y=WALL+b.r;b.vy=Math.abs(b.vy)*BOUNCE}if(b.y+b.r>H-WALL){b.y=H-WALL-b.r;b.vy=-Math.abs(b.vy)*BOUNCE}
    if(b.pulse)b.pulse=Math.max(0,b.pulse-.045*step);
  });
  for(let pass=0;pass<4;pass++){
    let merged=false;
    outer:for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];if(a.level===b.level&&a.age>65&&b.age>65&&isOverlapping(a,b,1.025)){if(merge(a,b)){merged=true;break outer}}
    }
    if(!merged)break;
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)circleCollision(balls[i],balls[j]);
  const crowded=balls.length>=OVERFLOW_COUNT;
  overflowTimer=crowded?Math.min(OVERFLOW_TIME,overflowTimer+dt):Math.max(0,overflowTimer-dt*2.5);
  if(overflowTimer>=OVERFLOW_TIME){gameOver=true;finalScoreEl.textContent=score;messageEl.classList.remove('hidden')}
}

function starfield(){
  ctx.fillStyle='#070a19';ctx.fillRect(0,0,W,H);
  for(let i=0;i<110;i++){const x=(i*83)%W,y=(i*137)%H,a=.25+((i*29)%50)/100;ctx.fillStyle=`rgba(210,225,255,${a})`;ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1)}
}
function drawBall(b){
  const lv=levels[b.level];ctx.save();ctx.translate(b.x,b.y);const pulse=b.pulse?1+b.pulse*.12:1;ctx.scale(pulse,pulse);
  const g=ctx.createRadialGradient(-b.r*.35,-b.r*.38,b.r*.08,0,0,b.r);g.addColorStop(0,lv.c1);g.addColorStop(.72,lv.c1);g.addColorStop(1,lv.c2);ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.17)';ctx.lineWidth=Math.max(2,b.r*.035);ctx.stroke();
  if(b.level===5){ctx.strokeStyle='rgba(255,220,170,.45)';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(0,0,b.r*1.18,b.r*.35,-.15,0,Math.PI*2);ctx.stroke()}
  if(b.level===6){ctx.shadowBlur=30;ctx.shadowColor='#ffbc42';ctx.strokeStyle='rgba(255,230,140,.35)';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,b.r*.92,0,Math.PI*2);ctx.stroke()}
  if(b.level===7){ctx.fillStyle='#050510';ctx.beginPath();ctx.arc(0,0,b.r*.58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(167,130,255,.65)';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,0,b.r*1.05,b.r*.35,-.35,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function draw(){
  starfield();
  shots.forEach(s=>{ctx.strokeStyle=`rgba(115,220,255,${s.life*.75})`;ctx.lineWidth=8*s.life;ctx.beginPath();ctx.moveTo(s.x,WALL+6);ctx.lineTo(s.x,s.y);ctx.stroke()});
  ctx.strokeStyle='rgba(145,170,255,.26)';ctx.lineWidth=3;ctx.strokeRect(WALL,WALL,W-WALL*2,H-WALL*2);
  balls.slice().sort((a,b)=>a.level-b.level).forEach(drawBall);

  const mult=streakMultiplier();
  if(streak>1){
    ctx.save();ctx.textAlign='center';ctx.shadowBlur=18*streakGlow;ctx.shadowColor='#6fe7ff';ctx.fillStyle='rgba(205,245,255,.96)';ctx.font='900 28px system-ui';ctx.fillText(`LAUNCH STREAK ×${streak}`,W/2,62);ctx.font='800 18px system-ui';ctx.fillText(`MERGE SCORE ×${mult.toFixed(1)}`,W/2,88);ctx.restore();
  }

  const ratio=Math.min(1,overflowTimer/OVERFLOW_TIME);
  const countText=`OBJECTS ${balls.length}/${OVERFLOW_COUNT}`;
  ctx.font='800 18px system-ui';ctx.fillStyle=balls.length>=OVERFLOW_COUNT?'#ff8aa0':'rgba(190,210,255,.8)';ctx.fillText(countText,WALL+12,H-WALL-18);
  if(ratio>0){
    ctx.fillStyle=`rgba(255,40,70,${.08+.22*ratio})`;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=`rgba(255,80,105,${.35+.65*ratio})`;ctx.lineWidth=10+10*ratio;ctx.strokeRect(WALL/2,WALL/2,W-WALL,H-WALL);
    ctx.textAlign='center';ctx.fillStyle='#ff9bab';ctx.font='900 34px system-ui';ctx.fillText('SPACE OVERLOAD',W/2,H*.44);
    ctx.font='900 64px system-ui';ctx.fillText(Math.max(1,Math.ceil((OVERFLOW_TIME-overflowTimer)/1000)),W/2,H*.51);
    ctx.font='800 18px system-ui';ctx.fillText('合体して天体数を23個以下に戻せ！',W/2,H*.56);ctx.textAlign='left';
  }

  if(!gameOver&&canDrop){const lv=levels[nextLevel],y=WALL+lv.r+8;ctx.save();ctx.globalAlpha=.5;ctx.setLineDash([8,10]);ctx.strokeStyle='rgba(170,195,255,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dropX,y+lv.r+8);ctx.lineTo(dropX,240);ctx.stroke();ctx.restore();drawBall({x:dropX,y,r:lv.r,level:nextLevel})}
}
function loop(t){const dt=lastTime?Math.min(34,t-lastTime):16;lastTime=t;simulate(dt);draw();requestAnimationFrame(loop)}
function pointerX(e){const rect=canvas.getBoundingClientRect();return (e.clientX-rect.left)/rect.width*W}
function moveAim(e){if(gameOver)return;dropX=Math.max(55,Math.min(W-55,pointerX(e)));if(e.cancelable)e.preventDefault()}
canvas.addEventListener('pointermove',moveAim,{passive:false});canvas.addEventListener('pointerdown',e=>moveAim(e),{passive:false});canvas.addEventListener('pointerup',e=>{moveAim(e);dropBall()},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')dropX-=28;if(e.key==='ArrowRight')dropX+=28;if(e.key===' '||e.key==='ArrowDown')dropBall();dropX=Math.max(55,Math.min(W-55,dropX))});
restartBtn.addEventListener('click',reset);againBtn.addEventListener('click',reset);
function buildEvolution(){evoRow.innerHTML=levels.map((lv,i)=>`<div class="evoItem"><div class="evoDot" style="width:${20+i*3}px;height:${20+i*3}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2})"></div><span>${lv.name}</span></div>${i<levels.length-1?'<div style="color:#6273aa;font-size:12px">›</div>':''}`).join('')}
buildEvolution();reset();requestAnimationFrame(loop);
