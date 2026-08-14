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
const WALL=24;
const GLOBAL_GRAVITY=0;      // 下向き重力はなし（宇宙空間の演出）
const BOUNCE=0.72;           // 衝突後はしっかり漂う
const MAX_SPEED=7.2;
const MUTUAL_G=10;           // 大きな天体同士の弱い引力
const OVERFLOW_COUNT=24;

// 以前より約35〜45%大きくし、ブラックホールまで簡単に到達しないバランスに変更
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

function id(){return crypto.randomUUID?.()||Math.random().toString(36)}
function massOf(b){return Math.max(1,(b.r/30)**2)}
function randNext(){const r=Math.random();return r<.62?0:r<.9?1:2}

function reset(){
  balls=[];score=0;dropX=W/2;nextLevel=randNext();canDrop=true;gameOver=false;overflowTimer=0;mergeLock.clear();
  scoreEl.textContent='0';messageEl.classList.add('hidden');updateNext();updateMission();
}
function updateNext(){
  const lv=levels[nextLevel];
  nextPreview.innerHTML=`<div style="width:${Math.min(34,lv.r*.55)}px;height:${Math.min(34,lv.r*.55)}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2});box-shadow:inset -4px -5px 8px rgba(0,0,0,.18)"></div>`;
}
function updateMission(){
  const max=balls.reduce((m,b)=>Math.max(m,b.level),0);
  const target=Math.min(max+1,levels.length-1);
  missionText.textContent=target===levels.length-1?'ブラックホールを完成させよう':`${levels[target].name}をつくろう`;
}
function addScore(n){score+=n;scoreEl.textContent=score}

function dropBall(){
  if(!canDrop||gameOver)return;
  const lv=levels[nextLevel];
  const x=Math.max(WALL+lv.r,Math.min(W-WALL-lv.r,dropX));
  // 無重力なので「落下」ではなく、一定速度で宇宙へ射出する
  const vx=(Math.random()-.5)*1.5;
  const vy=2.9+Math.random()*.55;
  balls.push({id:id(),x,y:WALL+lv.r+8,vx,vy,r:lv.r,level:nextLevel,age:0});
  canDrop=false;nextLevel=randNext();updateNext();
  setTimeout(()=>{canDrop=true},330);
}

function isOverlapping(a,b,slack=1){
  const dx=b.x-a.x,dy=b.y-a.y,min=a.r+b.r;
  return dx*dx+dy*dy<=min*min*slack*slack;
}

function merge(a,b){
  if(a.level!==b.level||a.level>=levels.length-1)return false;
  const key=[a.id,b.id].sort().join(':');
  if(mergeLock.has(key)||!isOverlapping(a,b,1.035))return false;
  mergeLock.add(key);
  const ma=massOf(a),mb=massOf(b),total=ma+mb;
  const nl=a.level+1,lv=levels[nl];
  const merged={
    id:id(),
    x:(a.x*ma+b.x*mb)/total,
    y:(a.y*ma+b.y*mb)/total,
    // 合体後も運動量をおおむね保つ
    vx:(a.vx*ma+b.vx*mb)/total,
    vy:(a.vy*ma+b.vy*mb)/total,
    r:lv.r,level:nl,age:0,pulse:1
  };
  balls=balls.filter(x=>x!==a&&x!==b);balls.push(merged);
  addScore(lv.score);updateMission();
  return true;
}

function circleCollision(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy,min=a.r+b.r;
  if(d2>=min*min||d2===0)return;
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,overlap=min-d;
  const ma=massOf(a),mb=massOf(b),sum=ma+mb;
  a.x-=nx*overlap*(mb/sum);a.y-=ny*overlap*(mb/sum);
  b.x+=nx*overlap*(ma/sum);b.y+=ny*overlap*(ma/sum);
  const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;
  if(rel<0){
    const j=-(1+BOUNCE)*rel/(1/ma+1/mb);
    a.vx-=j*nx/ma;a.vy-=j*ny/ma;
    b.vx+=j*nx/mb;b.vy+=j*ny/mb;
  }
}

function applyMutualGravity(step){
  // 「無重力」は地面方向への重力がない状態。
  // 惑星以上の大きな天体は、周囲を弱く引き寄せる。
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j];
    if(a.level<4&&b.level<4)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d2=Math.max(900,dx*dx+dy*dy),d=Math.sqrt(d2);
    const nx=dx/d,ny=dy/d,ma=massOf(a),mb=massOf(b);
    const force=MUTUAL_G*ma*mb/d2;
    a.vx+=force*nx/ma*step;a.vy+=force*ny/ma*step;
    b.vx-=force*nx/mb*step;b.vy-=force*ny/mb*step;
  }
}

function simulate(dt){
  if(gameOver)return;
  const step=Math.min(1.7,dt/16.67);
  applyMutualGravity(step);

  balls.forEach(b=>{
    b.age+=dt;
    b.vy+=GLOBAL_GRAVITY*step;
    const speed=Math.hypot(b.vx,b.vy);
    if(speed>MAX_SPEED){b.vx=b.vx/speed*MAX_SPEED;b.vy=b.vy/speed*MAX_SPEED}
    b.x+=b.vx*step;b.y+=b.vy*step;

    // 宇宙容器の四辺で反射。床に積もらず、ずっと漂う。
    if(b.x-b.r<WALL){b.x=WALL+b.r;b.vx=Math.abs(b.vx)*BOUNCE}
    if(b.x+b.r>W-WALL){b.x=W-WALL-b.r;b.vx=-Math.abs(b.vx)*BOUNCE}
    if(b.y-b.r<WALL){b.y=WALL+b.r;b.vy=Math.abs(b.vy)*BOUNCE}
    if(b.y+b.r>H-WALL){b.y=H-WALL-b.r;b.vy=-Math.abs(b.vy)*BOUNCE}
    if(b.pulse)b.pulse=Math.max(0,b.pulse-.045*step);
  });

  // 同種天体は接触した瞬間に合体
  for(let pass=0;pass<4;pass++){
    let merged=false;
    outer:for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];
      if(a.level===b.level&&a.age>65&&b.age>65&&isOverlapping(a,b,1.025)){
        if(merge(a,b)){merged=true;break outer}
      }
    }
    if(!merged)break;
  }

  // 異なる天体は衝突して方向を変える
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)circleCollision(balls[i],balls[j]);

  // 無重力では上端LIMITではなく、空間全体が混みすぎたら終了
  const crowded=balls.length>=OVERFLOW_COUNT;
  overflowTimer=crowded?overflowTimer+dt:Math.max(0,overflowTimer-dt*2);
  if(overflowTimer>2200){gameOver=true;finalScoreEl.textContent=score;messageEl.classList.remove('hidden')}
}

function starfield(){
  ctx.fillStyle='#070a19';ctx.fillRect(0,0,W,H);
  for(let i=0;i<110;i++){
    const x=(i*83)%W,y=(i*137)%H,a=.25+((i*29)%50)/100;
    ctx.fillStyle=`rgba(210,225,255,${a})`;ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  const g=ctx.createRadialGradient(W*.5,H*.45,40,W*.5,H*.45,H*.7);
  g.addColorStop(0,'rgba(70,86,165,.13)');g.addColorStop(1,'rgba(5,7,17,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function drawBall(b){
  const lv=levels[b.level];ctx.save();ctx.translate(b.x,b.y);
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
  ctx.strokeStyle='rgba(145,170,255,.26)';ctx.lineWidth=3;ctx.strokeRect(WALL,WALL,W-WALL*2,H-WALL*2);
  ctx.fillStyle='rgba(170,195,255,.6)';ctx.font='700 14px system-ui';ctx.fillText('ZERO-G SPACE',WALL+10,WALL+22);
  balls.slice().sort((a,b)=>a.level-b.level).forEach(drawBall);
  if(!gameOver&&canDrop){
    const lv=levels[nextLevel],y=WALL+lv.r+8;
    ctx.save();ctx.globalAlpha=.55;ctx.setLineDash([8,10]);ctx.strokeStyle='rgba(170,195,255,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dropX,y+lv.r+8);ctx.lineTo(dropX,240);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    drawBall({x:dropX,y,r:lv.r,level:nextLevel});
  }
}
function loop(t){const dt=lastTime?Math.min(34,t-lastTime):16;lastTime=t;simulate(dt);draw();requestAnimationFrame(loop)}
function pointerX(e){const rect=canvas.getBoundingClientRect();return (e.clientX-rect.left)/rect.width*W}
function moveAim(e){if(gameOver)return;dropX=Math.max(55,Math.min(W-55,pointerX(e)));if(e.cancelable)e.preventDefault()}
canvas.addEventListener('pointermove',moveAim,{passive:false});
canvas.addEventListener('pointerdown',e=>moveAim(e),{passive:false});
canvas.addEventListener('pointerup',e=>{moveAim(e);dropBall()},{passive:false});
window.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')dropX-=28;if(e.key==='ArrowRight')dropX+=28;if(e.key===' '||e.key==='ArrowDown')dropBall();dropX=Math.max(55,Math.min(W-55,dropX))});
restartBtn.addEventListener('click',reset);againBtn.addEventListener('click',reset);

function buildEvolution(){
  evoRow.innerHTML=levels.map((lv,i)=>`<div class="evoItem"><div class="evoDot" style="width:${20+i*3}px;height:${20+i*3}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,${lv.c1},${lv.c2})"></div><span>${lv.name}</span></div>${i<levels.length-1?'<div style="color:#6273aa;font-size:12px">›</div>':''}`).join('');
}
buildEvolution();reset();requestAnimationFrame(loop);
