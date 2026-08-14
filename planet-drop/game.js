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

const W=720,H=980;
const WALL=24,FLOOR=950,DANGER=150;
const GRAVITY=0.46,FRICTION=0.996,BOUNCE=0.24;

const levels=[
  {name:'ちり',r:22,score:1,c1:'#9ca3b7',c2:'#697084'},
  {name:'岩',r:29,score:3,c1:'#c48b66',c2:'#7e563f'},
  {name:'小惑星',r:39,score:8,c1:'#c5b79b',c2:'#746b5c'},
  {name:'衛星',r:50,score:18,c1:'#d9e3ef',c2:'#8997a9'},
  {name:'惑星',r:65,score:40,c1:'#5cc7e9',c2:'#275f9d'},
  {name:'巨大惑星',r:83,score:85,c1:'#f0b86c',c2:'#9c5c4c'},
  {name:'恒星',r:104,score:180,c1:'#ffd45a',c2:'#ef6a37'},
  {name:'ブラックホール',r:126,score:420,c1:'#6a4bf1',c2:'#0c0c18'}
];

let balls=[],score=0,nextLevel=0,dropX=W/2,canDrop=true,gameOver=false,lastTime=0,overflowTimer=0,mergeLock=new Set();

function randNext(){
  const r=Math.random();
  return r<.55?0:r<.86?1:2;
}
function reset(){
  balls=[];score=0;dropX=W/2;nextLevel=randNext();canDrop=true;gameOver=false;overflowTimer=0;mergeLock.clear();
  scoreEl.textContent='0';messageEl.classList.add('hidden');updateNext();updateMission();
}
function updateNext(){
  const lv=levels[nextLevel];
  nextPreview.innerHTML=`<div style="width:${Math.min(32,lv.r*.7)}px;height:${Math.min(32,lv.r*.7)}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2});box-shadow:inset -4px -5px 8px rgba(0,0,0,.18)"></div>`;
}
function updateMission(){
  const max=balls.reduce((m,b)=>Math.max(m,b.level),0);
  const target=Math.min(max+1,levels.length-1);
  missionText.textContent=target===levels.length-1?'ブラックホールを完成させよう':`${levels[target].name}をつくろう`;
}
function addScore(n){score+=n;scoreEl.textContent=score;}
function dropBall(){
  if(!canDrop||gameOver)return;
  const lv=levels[nextLevel];
  const x=Math.max(WALL+lv.r,Math.min(W-WALL-lv.r,dropX));
  balls.push({id:crypto.randomUUID?.()||Math.random().toString(36),x,y:58+lv.r,vx:0,vy:0,r:lv.r,level:nextLevel,age:0});
  canDrop=false;nextLevel=randNext();updateNext();
  setTimeout(()=>{canDrop=true},360);
}
function circleCollision(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const d2=dx*dx+dy*dy;
  const min=a.r+b.r;
  if(d2>=min*min||d2===0)return false;
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d;
  const overlap=min-d;
  a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;
  b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
  const rvx=b.vx-a.vx,rvy=b.vy-a.vy;
  const rel=rvx*nx+rvy*ny;
  if(rel<0){
    const impulse=-(1+BOUNCE)*rel*.5;
    a.vx-=impulse*nx;a.vy-=impulse*ny;
    b.vx+=impulse*nx;b.vy+=impulse*ny;
  }
  return true;
}
function merge(a,b){
  if(a.level!==b.level||a.level>=levels.length-1)return false;
  const key=[a.id,b.id].sort().join(':');
  if(mergeLock.has(key))return false;
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>(a.r+b.r)*(a.r+b.r)*.86)return false;
  mergeLock.add(key);
  const nl=a.level+1,lv=levels[nl];
  const merged={id:crypto.randomUUID?.()||Math.random().toString(36),x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:(a.vx+b.vx)/2,vy:Math.min((a.vy+b.vy)/2,-1.5),r:lv.r,level:nl,age:0,pulse:1};
  balls=balls.filter(x=>x!==a&&x!==b);balls.push(merged);
  addScore(lv.score);updateMission();
  return true;
}
function simulate(dt){
  if(gameOver)return;
  const step=Math.min(1.7,dt/16.67);
  balls.forEach(b=>{
    b.age+=dt;b.vy+=GRAVITY*step;b.vx*=FRICTION;b.vy*=.999;
    b.x+=b.vx*step;b.y+=b.vy*step;
    if(b.x-b.r<WALL){b.x=WALL+b.r;b.vx=Math.abs(b.vx)*BOUNCE}
    if(b.x+b.r>W-WALL){b.x=W-WALL-b.r;b.vx=-Math.abs(b.vx)*BOUNCE}
    if(b.y+b.r>FLOOR){b.y=FLOOR-b.r;b.vy=-Math.abs(b.vy)*BOUNCE;b.vx*=.985;if(Math.abs(b.vy)<.8)b.vy=0}
    if(b.pulse)b.pulse=Math.max(0,b.pulse-.045*step);
  });

  for(let pass=0;pass<3;pass++){
    let merged=false;
    outer:for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];
      if(circleCollision(a,b)&&a.level===b.level&&a.age>120&&b.age>120){if(merge(a,b)){merged=true;break outer}}
    }
    if(!merged)break;
  }

  const dangerous=balls.some(b=>b.age>1200&&b.y-b.r<DANGER&&Math.abs(b.vy)<1.4);
  overflowTimer=dangerous?overflowTimer+dt:Math.max(0,overflowTimer-dt*2);
  if(overflowTimer>1800){gameOver=true;finalScoreEl.textContent=score;messageEl.classList.remove('hidden')}
}
function starfield(){
  ctx.fillStyle='#070a19';ctx.fillRect(0,0,W,H);
  for(let i=0;i<90;i++){
    const x=(i*83)%W,y=(i*137)%H;
    const a=.25+((i*29)%50)/100;
    ctx.fillStyle=`rgba(210,225,255,${a})`;
    ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(64,82,155,.12)');g.addColorStop(1,'rgba(5,7,17,.0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function drawBall(b){
  const lv=levels[b.level];
  ctx.save();ctx.translate(b.x,b.y);
  const pulse=b.pulse?1+b.pulse*.12:1;ctx.scale(pulse,pulse);
  const g=ctx.createRadialGradient(-b.r*.35,-b.r*.38,b.r*.08,0,0,b.r);g.addColorStop(0,lv.c1);g.addColorStop(.72,lv.c1);g.addColorStop(1,lv.c2);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.17)';ctx.lineWidth=Math.max(2,b.r*.035);ctx.stroke();
  if(b.level===1||b.level===2){ctx.fillStyle='rgba(55,38,32,.18)';for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(-b.r*.3+k*b.r*.25,-b.r*.1+(k%2)*b.r*.28,b.r*(.09+.02*k),0,Math.PI*2);ctx.fill()}}
  if(b.level===3){ctx.fillStyle='rgba(110,125,145,.25)';for(let k=0;k<4;k++){ctx.beginPath();ctx.arc((k-1.5)*b.r*.28,(k%2-.5)*b.r*.35,b.r*.1,0,Math.PI*2);ctx.fill()}}
  if(b.level===4){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,b.r*.78,.2,2.4);ctx.stroke()}
  if(b.level===5){ctx.strokeStyle='rgba(255,220,170,.45)';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(0,0,b.r*1.18,b.r*.35,-.15,0,Math.PI*2);ctx.stroke()}
  if(b.level===6){ctx.shadowBlur=30;ctx.shadowColor='#ffbc42';ctx.strokeStyle='rgba(255,230,140,.35)';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,0,b.r*.92,0,Math.PI*2);ctx.stroke()}
  if(b.level===7){ctx.fillStyle='#050510';ctx.beginPath();ctx.arc(0,0,b.r*.58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(167,130,255,.65)';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(0,0,b.r*1.05,b.r*.35,-.35,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function draw(){
  starfield();
  ctx.fillStyle='rgba(255,87,115,.11)';ctx.fillRect(WALL,DANGER-2,W-WALL*2,4);
  ctx.fillStyle='rgba(255,118,145,.65)';ctx.font='700 14px system-ui';ctx.fillText('LIMIT',WALL+8,DANGER-12);
  ctx.strokeStyle='rgba(145,170,255,.22)';ctx.lineWidth=3;ctx.strokeRect(WALL,18,W-WALL*2,FLOOR-18);
  balls.slice().sort((a,b)=>a.y-b.y).forEach(drawBall);
  if(!gameOver&&canDrop){
    const lv=levels[nextLevel];
    const y=62+lv.r;
    ctx.save();ctx.globalAlpha=.68;ctx.setLineDash([8,10]);ctx.strokeStyle='rgba(170,195,255,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dropX,y+lv.r+8);ctx.lineTo(dropX,DANGER-8);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    drawBall({x:dropX,y,r:lv.r,level:nextLevel});
  }
}
function loop(t){const dt=lastTime?Math.min(34,t-lastTime):16;lastTime=t;simulate(dt);draw();requestAnimationFrame(loop)}
function pointerX(e){const rect=canvas.getBoundingClientRect();const clientX=e.touches?e.touches[0].clientX:e.clientX;return (clientX-rect.left)/rect.width*W}
function moveAim(e){if(gameOver)return;dropX=Math.max(45,Math.min(W-45,pointerX(e)));if(e.cancelable)e.preventDefault()}
canvas.addEventListener('pointermove',moveAim,{passive:false});
canvas.addEventListener('pointerdown',e=>{moveAim(e)} ,{passive:false});
canvas.addEventListener('pointerup',e=>{moveAim(e);dropBall();},{passive:false});
canvas.addEventListener('touchmove',moveAim,{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')dropX-=28;if(e.key==='ArrowRight')dropX+=28;if(e.key===' '||e.key==='ArrowDown')dropBall();dropX=Math.max(45,Math.min(W-45,dropX))});
restartBtn.addEventListener('click',reset);againBtn.addEventListener('click',reset);

function buildEvolution(){
  evoRow.innerHTML=levels.map((lv,i)=>`<div class="evoItem"><div class="evoDot" style="width:${20+i*3}px;height:${20+i*3}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2})"></div><span>${lv.name}</span></div>${i<levels.length-1?'<div style="color:#6273aa;font-size:12px">›</div>':''}`).join('');
}
buildEvolution();reset();requestAnimationFrame(loop);
