import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const N=16, HEX=1.0, HSTEP=.7;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
const players=[
 {name:'PLAYER 1',x:2,y:13,inv:{wood:0,stone:0,sand:0},fire:false,boat:false,seen:new Set()},
 {name:'COM',x:13,y:13,inv:{wood:0,stone:0,sand:0},fire:false,boat:false,seen:new Set()}
];
let mode='com',turn=0,dice=0,busy=false,overview=false,seed=1;
let map=[],heightMap=[],reachable=[],reachPaths=new Map(),drag=null;
let terrainMeshes=[],colliders=[],resources=[],highlights=[],humans=[],dieGroup=null,riverMesh=null;

const canvas=document.getElementById('game3d');
const world=document.getElementById('world');
const loading=document.getElementById('loading');
const errorEl=document.getElementById('webglError');
let renderer,scene,camera,raycaster,pointer=new THREE.Vector2(),clock=new THREE.Clock();
let cameraGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),lookNow=new THREE.Vector3(),camDistance=13;

boot();

function boot(){
 try{
  const test=document.createElement('canvas');
  if(!test.getContext('webgl2')) throw new Error('WebGL2 unavailable');
  init3D();bindUI();renderLoop();
  loading.classList.add('hidden');
 }catch(err){
  console.error(err);loading.classList.add('hidden');errorEl.textContent='3D表示を開始できませんでした: '+err.message;errorEl.classList.remove('hidden');
 }
}

function init3D(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9fbac3);scene.fog=new THREE.FogExp2(0x9aaeb0,.022);
 camera=new THREE.PerspectiveCamera(42,1,.1,120);raycaster=new THREE.Raycaster();
 const hemi=new THREE.HemisphereLight(0xe6f6ff,0x31452f,1.55);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffefd2,3.2);sun.position.set(-11,20,8);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.far=70;scene.add(sun);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x294c3b,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.45;floor.receiveShadow=true;scene.add(floor);
 resize();window.addEventListener('resize',resize);
}

const MAT={
 grass:new THREE.MeshStandardMaterial({color:0x668f4f,roughness:.98}),
 valley:new THREE.MeshStandardMaterial({color:0x4c743f,roughness:1}),
 sand:new THREE.MeshStandardMaterial({color:0xcab476,roughness:1}),
 rock:new THREE.MeshStandardMaterial({color:0x7f7869,roughness:1}),
 mountain:new THREE.MeshStandardMaterial({color:0x8d8a79,roughness:1}),
 cliff:new THREE.MeshStandardMaterial({color:0x716d60,roughness:1}),
 pass:new THREE.MeshStandardMaterial({color:0x7f8354,roughness:1}),
 goal:new THREE.MeshStandardMaterial({color:0x4f9a9e,roughness:.9}),
 water:new THREE.MeshPhysicalMaterial({color:0x3c8ca8,roughness:.2,transparent:true,opacity:.88,clearcoat:.5,clearcoatRoughness:.12}),
 river:new THREE.MeshPhysicalMaterial({color:0x55a8c1,roughness:.18,transparent:true,opacity:.94,clearcoat:.55,clearcoatRoughness:.1})
};

function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function rand(a,b){return a+Math.floor(rng()*(b-a+1))}
function inside(x,y){return x>=0&&y>=0&&x<N&&y<N}
function key(x,y){return `${x},${y}`}
function hdist(a,b,c,d){const dx=c-a,dy=d-b;return(Math.abs(dx)+Math.abs(dy)+Math.abs(dx+dy))/2}
function elevation(x,y){return heightMap[y]?.[x]??0}
function pos(x,y){return new THREE.Vector3((x+y*.5)*HEX*1.73,0,y*HEX*1.5)}
function topY(x,y){return elevation(x,y)*HSTEP}

function generateWorld(){
 seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
 map=Array.from({length:N},()=>Array(N).fill('grass'));heightMap=Array.from({length:N},()=>Array(N).fill(1));
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const e=Math.min(x,y,N-1-x,N-1-y);if(e===0||(e===1&&rng()<.5)){map[y][x]='water';heightMap[y][x]=0}}
 for(let b=0;b<4;b++){const cx=rand(4,11),cy=rand(3,10),r=rand(2,4),peak=rand(3,5);for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const d=Math.hypot(x-cx,y-cy);if(d<r)heightMap[y][x]=Math.max(heightMap[y][x],Math.max(2,Math.round(peak-d/r*2)))}}
 let rx=rand(5,10);for(let y=1;y<N-1;y++){rx=Math.max(2,Math.min(N-3,rx+rand(-1,1)));map[y][rx]='river';heightMap[y][rx]=0}
 for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){if(map[y][x]==='river')continue;const h=heightMap[y][x];if(h>=4)map[y][x]='mountain';else if(h===3)map[y][x]='cliff';else if(h===2&&rng()<.52)map[y][x]='valley'}
 for(const[sx,sy]of[[2,13],[13,13]])for(let y=sy-2;y<=sy+1;y++)for(let x=sx-2;x<=sx+2;x++)if(inside(x,y)){map[y][x]='grass';heightMap[y][x]=1}
 for(let i=0;i<15;i++)place('tree');for(let i=0;i<10;i++)place('rock');for(let i=0;i<7;i++)place('sand');
 let passes=0;for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)if((map[y][x]==='mountain'||map[y][x]==='cliff')&&rng()<.12){map[y][x]='pass';passes++}if(passes<2){map[5][5]='pass';heightMap[5][5]=2;map[6][10]='pass';heightMap[6][10]=2}
 for(const[gx,gy]of[[2,2],[13,2]]){for(let y=gy-1;y<=gy+1;y++)for(let x=gx-1;x<=gx+1;x++)if(inside(x,y)){map[y][x]='water';heightMap[y][x]=0}map[gy][gx]='goal';heightMap[gy][gx]=1}
 ensureNear(2,13,'tree');ensureNear(2,13,'rock');ensureNear(13,13,'tree');ensureNear(13,13,'rock');
}
function place(t){for(let i=0;i<100;i++){const x=rand(1,N-2),y=rand(1,N-2);if(map[y][x]==='grass'||map[y][x]==='valley'){map[y][x]=t;return}}}
function ensureNear(sx,sy,t){for(let y=Math.max(1,sy-4);y<=Math.min(N-2,sy);y++)for(let x=Math.max(1,sx-4);x<=Math.min(N-2,sx+4);x++)if(map[y][x]===t)return;const x=Math.max(1,Math.min(N-2,sx+(rng()<.5?-2:2))),y=Math.max(1,sy-2);map[y][x]=t;heightMap[y][x]=1}

function clearWorld(){
 for(const o of [...terrainMeshes,...colliders,...resources,...highlights,...humans])scene.remove(o);
 if(riverMesh)scene.remove(riverMesh);if(dieGroup)scene.remove(dieGroup);
 terrainMeshes=[];colliders=[];resources=[];highlights=[];humans=[];riverMesh=null;dieGroup=null;
}

function buildWorld(){
 clearWorld();
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  addTerrain(x,y);addCollider(x,y);addResource(x,y);addHighlight(x,y);
 }
 addRiver();
 humans=[makeHuman(0),makeHuman(1)];scene.add(...humans);updateHumans();
 reveal(players[0]);reveal(players[1]);updateFog();
}

function terrainMaterial(t){if(t==='tree')return MAT.grass;if(t==='rock')return MAT.grass;if(t==='sand')return MAT.sand;return MAT[t]||MAT.grass}
function addTerrain(x,y){
 const t=map[y][x],p=pos(x,y),h=topY(x,y);
 if(t==='water'){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1.14,1.18,.10,24),MAT.water.clone());mesh.position.set(p.x,.02,p.z);mesh.receiveShadow=true;mesh.userData={x,y,type:t};scene.add(mesh);terrainMeshes.push(mesh);return;
 }
 const high=t==='mountain'||t==='cliff';const topR=high?1.02:1.12,bottomR=high?1.24:1.18;
 const base=Math.max(-.12,h-(high?1.65:.78));const depth=Math.max(.28,h-base+.16);
 const sides=t==='mountain'?12:20;const geo=new THREE.CylinderGeometry(topR,bottomR,depth,sides,2,false);
 const mat=terrainMaterial(t).clone();const mesh=new THREE.Mesh(geo,mat);mesh.position.set(p.x,base+depth/2,p.z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={x,y,type:t};
 if(t==='mountain')mesh.scale.y=1.08;if(t==='valley')mesh.scale.y=.88;
 scene.add(mesh);terrainMeshes.push(mesh);
}
function addCollider(x,y){const p=pos(x,y),g=new THREE.CylinderGeometry(.98,.98,.12,6);g.rotateY(Math.PI/6);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({transparent:true,opacity:.002,depthWrite:false}));m.position.set(p.x,topY(x,y)+.09,p.z);m.userData={x,y};scene.add(m);colliders.push(m)}
function addHighlight(x,y){const p=pos(x,y),r=new THREE.Mesh(new THREE.RingGeometry(.62,.84,28),new THREE.MeshBasicMaterial({color:0xffdf56,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;r.position.set(p.x,topY(x,y)+.16,p.z);r.userData={x,y};scene.add(r);highlights.push(r)}
function addResource(x,y){const t=map[y][x],p=pos(x,y),y0=topY(x,y)+.14;if(t==='tree'){const g=new THREE.Group();g.userData={x,y};const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,.62,7),new THREE.MeshStandardMaterial({color:0x65452f,roughness:1}));trunk.position.y=.31;const crown=new THREE.Mesh(new THREE.ConeGeometry(.48,1.0,8),new THREE.MeshStandardMaterial({color:0x2b6337,roughness:1}));crown.position.y=1.05;g.add(trunk,crown);g.position.set(p.x,y0,p.z);g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g);resources.push(g)}else if(t==='rock'){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.35,0),new THREE.MeshStandardMaterial({color:0x8b877d,roughness:1}));r.position.set(p.x,y0+.27,p.z);r.scale.set(1.2,.75,1);r.castShadow=true;r.userData={x,y};scene.add(r);resources.push(r)}else if(t==='goal'){const g=new THREE.Group();g.userData={x,y};const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.15,8),new THREE.MeshStandardMaterial({color:0xf4d65c}));pole.position.y=.58;const star=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshStandardMaterial({color:0xffe56b,emissive:0x7b5d00,emissiveIntensity:.5}));star.position.y=1.25;g.add(pole,star);g.position.set(p.x,y0,p.z);scene.add(g);resources.push(g)}}
function addRiver(){const pts=[];for(let y=0;y<N;y++){for(let x=0;x<N;x++)if(map[y][x]==='river'){const p=pos(x,y);pts.push(new THREE.Vector3(p.x,.10,p.z));break}}if(pts.length>2){const curve=new THREE.CatmullRomCurve3(pts),geo=new THREE.TubeGeometry(curve,64,.24,8,false);riverMesh=new THREE.Mesh(geo,MAT.river);scene.add(riverMesh)}}

function makeHuman(i){const g=new THREE.Group(),shirt=new THREE.MeshStandardMaterial({color:i===0?0xe94f45:0x4b87ea,roughness:.88}),skin=new THREE.MeshStandardMaterial({color:0xe3ad87,roughness:.9});const torso=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.52,8),shirt);torso.position.y=.58;const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),skin);head.position.y=.99;const leg1=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.36,7),shirt),leg2=leg1.clone();leg1.position.set(-.09,.18,0);leg2.position.set(.09,.18,0);g.add(torso,head,leg1,leg2);g.userData={leg1,leg2};g.traverse(o=>{if(o.isMesh)o.castShadow=true});return g}
function updateHumans(){players.forEach((p,i)=>{const v=pos(p.x,p.y);humans[i].position.set(v.x,topY(p.x,p.y)+.18,v.z)})}

function reveal(p){for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(hdist(p.x,p.y,x,y)<=5)p.seen.add(key(x,y))}
function updateFog(){const v=players[turn];for(const m of terrainMeshes){const {x,y,type}=m.userData,seen=v.seen.has(key(x,y)),near=hdist(v.x,v.y,x,y)<=5;m.visible=seen;if(m.material){m.material.transparent=!near||type==='water';m.material.opacity=near?(type==='water'?.88:1):(type==='water'?.38:.44);m.material.depthWrite=near&&type!=='water'}}for(const r of resources){const d=r.userData;if(d&&Number.isFinite(d.x))r.visible=v.seen.has(key(d.x,d.y))}for(const c of colliders)c.visible=v.seen.has(key(c.userData.x,c.userData.y))}

function bindUI(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>startGame(b.dataset.mode));
 document.getElementById('backToTitle').onclick=()=>{document.getElementById('gameApp').classList.add('game-hidden');document.getElementById('titleScreen').style.display='grid'};
 document.getElementById('reset').onclick=resetGame;document.getElementById('playAgain').onclick=resetGame;document.getElementById('diceBtn').onclick=roll;
 document.getElementById('overviewBtn').onclick=()=>{overview=!overview;overview?showOverview():focusPlayer(turn)};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
 canvas.addEventListener('wheel',e=>{e.preventDefault();camDistance=THREE.MathUtils.clamp(camDistance+e.deltaY*.01,8,20);focusPlayer(turn)},{passive:false});
}
function startGame(m){mode=m;players[1].name=m==='com'?'COM':'PLAYER 2';document.getElementById('p2Name').textContent=players[1].name;document.getElementById('titleScreen').style.display='none';document.getElementById('gameApp').classList.remove('game-hidden');resetGame()}
function resetGame(){try{generateWorld();for(const p of players){p.inv={wood:0,stone:0,sand:0};p.fire=false;p.boat=false;p.seen=new Set()}players[0].x=2;players[0].y=13;players[1].x=13;players[1].y=13;turn=0;dice=0;busy=false;overview=false;reachable=[];reachPaths.clear();const d=document.getElementById('winDialog');if(d.open)d.close();buildWorld();updateHud();focusPlayer(0,true);toast('🌍 新しい世界')}catch(err){console.error(err);errorEl.textContent='3D地形の生成エラー: '+err.message;errorEl.classList.remove('hidden')}}

function focusPlayer(i=turn,instant=false){const p=players[i],v=pos(p.x,p.y),h=topY(p.x,p.y);lookGoal.set(v.x,h+.35,v.z);cameraGoal.set(v.x+camDistance*.68,7.2+camDistance*.2,v.z+camDistance*.82);if(instant){camera.position.copy(cameraGoal);lookNow.copy(lookGoal);camera.lookAt(lookNow)}document.getElementById('cameraLabel').textContent=`📍 ${p.name}`}
function showOverview(){const v=pos(7.5,7.5);lookGoal.set(v.x,1,v.z);cameraGoal.set(v.x+20,22,v.z+25);document.getElementById('cameraLabel').textContent='🗺️'}
function resize(){const r=world.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}

function canEnter(p,x,y,from){if(!inside(x,y))return false;const t=map[y][x],ft=map[from.y][from.x],dh=elevation(x,y)-elevation(from.x,from.y);if(t==='water'||t==='goal')return p.boat;if(t==='cliff'&&ft!=='pass')return false;if(Math.abs(dh)>=2&&t!=='pass'&&ft!=='pass')return false;if(t==='mountain'&&ft!=='pass'&&ft!=='mountain')return false;return true}
function getReachable(p,steps){const q=[{x:p.x,y:p.y,d:0,path:[]}],best=new Map([[key(p.x,p.y),0]]),out=[];reachPaths.clear();while(q.length){const cur=q.shift();if(cur.d===steps){if(cur.x!==p.x||cur.y!==p.y){out.push(cur);reachPaths.set(key(cur.x,cur.y),cur.path)}continue}for(const[dx,dy]of DIRS){const x=cur.x+dx,y=cur.y+dy,k=key(x,y);if(!canEnter(p,x,y,cur))continue;const nd=cur.d+1;if(best.has(k)&&best.get(k)<=nd)continue;best.set(k,nd);q.push({x,y,d:nd,path:[...cur.path,{x,y}]})}}return out}

async function roll(){if(busy||dice||(mode==='com'&&turn===1))return;busy=true;const n=rand(1,6);await animateDie(n);dice=n;reachable=getReachable(players[turn],n);showHighlights();busy=false;if(!reachable.length)setTimeout(endTurn,450)}
function makeDie(){if(dieGroup)scene.remove(dieGroup);dieGroup=new THREE.Group();const cube=new THREE.Mesh(new THREE.BoxGeometry(.82,.82,.82),new THREE.MeshStandardMaterial({color:0xfff5d8,roughness:.42}));cube.castShadow=true;dieGroup.add(cube);scene.add(dieGroup);return cube}
function animateDie(n){return new Promise(resolve=>{const cube=makeDie(),p=players[turn],v=pos(p.x,p.y),base=topY(p.x,p.y),t0=performance.now(),dur=920;dieGroup.position.set(v.x-1,base+2.2,v.z+.6);function step(now){const t=Math.min(1,(now-t0)/dur),hop=Math.abs(Math.sin(t*Math.PI*4))*(1-t)*1.65;dieGroup.position.set(v.x-1+t*3.2,base+.48+hop,v.z+.6+t*1.3);cube.rotation.x+=.24;cube.rotation.y+=.31;cube.rotation.z+=.19;if(t<1)requestAnimationFrame(step);else{setTimeout(()=>{scene.remove(dieGroup);dieGroup=null;resolve()},180)}}requestAnimationFrame(step)})}
function showHighlights(){const set=new Set(reachable.map(r=>key(r.x,r.y)));for(const h of highlights){h.material.opacity=set.has(key(h.userData.x,h.userData.y))?.82:0}if(reachable.length){const pts=reachable.map(r=>pos(r.x,r.y)),c=pts.reduce((a,b)=>a.add(b.clone()),new THREE.Vector3()).multiplyScalar(1/pts.length);lookGoal.set(c.x,1,c.z);cameraGoal.set(c.x+15,12,c.z+18)}}
async function moveTo(x,y){if(busy||!reachable.some(r=>r.x===x&&r.y===y))return;busy=true;const who=turn,p=players[who],path=reachPaths.get(key(x,y))||[{x,y}];reachable=[];showHighlights();for(const s of path){p.x=s.x;p.y=s.y;reveal(p);await walkStep(who,s.x,s.y);updateFog()}collect(p,x,y);autoCraft(p);updateHud();busy=false;if(map[y][x]==='goal'){win();return}setTimeout(endTurn,450)}
function walkStep(i,x,y){return new Promise(resolve=>{const g=humans[i],from=g.position.clone(),v=pos(x,y),to=new THREE.Vector3(v.x,topY(x,y)+.18,v.z),t0=performance.now();function step(now){const t=Math.min(1,(now-t0)/280),e=t*t*(3-2*t);g.position.lerpVectors(from,to,e);g.userData.leg1.rotation.x=Math.sin(t*Math.PI*4)*.6;g.userData.leg2.rotation.x=-Math.sin(t*Math.PI*4)*.6;if(t<1)requestAnimationFrame(step);else{g.userData.leg1.rotation.x=g.userData.leg2.rotation.x=0;focusPlayer(i);resolve()}}requestAnimationFrame(step)})}
function collect(p,x,y){const t=map[y][x];if(t==='tree'){p.inv.wood+=2;toast('🪵 +2')}else if(t==='rock'){p.inv.stone+=2;toast('🪨 +2')}else if(t==='sand'){p.inv.sand+=2;toast('砂 +2')}}
function autoCraft(p){if(!p.fire&&p.inv.wood>=2&&p.inv.stone>=1){p.inv.wood-=2;p.inv.stone--;p.fire=true;toast('🔥 火を発明！')}if(p.fire&&!p.boat&&p.inv.wood>=4){p.inv.wood-=4;p.boat=true;toast('🛶 舟を発明！')}}
function endTurn(){dice=0;reachable=[];reachPaths.clear();showHighlights();turn=1-turn;reveal(players[turn]);updateFog();updateHud();focusPlayer(turn);if(mode==='com'&&turn===1)setTimeout(comTurn,650)}
async function comTurn(){if(mode!=='com'||turn!==1)return;busy=true;const n=rand(1,6);await animateDie(n);dice=n;reachable=getReachable(players[1],n);showHighlights();if(!reachable.length){busy=false;endTurn();return}reachable.sort((a,b)=>scoreTarget(players[1],b)-scoreTarget(players[1],a));busy=false;moveTo(reachable[0].x,reachable[0].y)}
function scoreTarget(p,c){const t=map[c.y][c.x];let s=Math.random();if(!p.fire){if(t==='tree')s+=7;if(t==='rock')s+=6}else if(!p.boat){if(t==='tree')s+=8}else{if(t==='goal')s+=30;if(t==='water')s+=2}if(t==='pass')s+=2;if(!p.seen.has(key(c.x,c.y)))s+=2.5;return s}

function updateHud(){document.getElementById('p1Inv').textContent=`🪵${players[0].inv.wood} 🪨${players[0].inv.stone}${players[0].boat?' 🛶':''}`;document.getElementById('p2Inv').textContent=`🪵${players[1].inv.wood} 🪨${players[1].inv.stone}${players[1].boat?' 🛶':''}`;document.getElementById('turnText').textContent=players[turn].name;document.getElementById('p1Card').classList.toggle('active',turn===0);document.getElementById('p2Card').classList.toggle('active',turn===1);document.getElementById('diceBtn').disabled=busy||dice>0||(mode==='com'&&turn===1);const p=players[turn],mn=document.getElementById('missionNow'),md=document.getElementById('missionNeed');if(!p.fire){mn.textContent='🔥 火を起こせ';md.textContent='木 2　石 1'}else if(!p.boat){mn.textContent='🛶 舟をつくれ';md.textContent='木 4'}else{mn.textContent='⭐ 海の向こうへ';md.textContent='離島を見つけろ'}}
function win(){document.getElementById('winnerText').textContent=`${players[turn].name} 勝利！`;document.getElementById('winDialog').showModal()}
let toastTimer;function toast(s){const e=document.getElementById('toast');e.textContent=s;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),1100)}

function pointerDown(e){if(busy)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId)}
function pointerMove(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.px,dy=e.clientY-drag.py;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=true;drag.px=e.clientX;drag.py=e.clientY;if(drag.moved){cameraGoal.x-=dx*.018*camDistance;cameraGoal.z-=dy*.022*camDistance;lookGoal.x-=dx*.018*camDistance;lookGoal.z-=dy*.022*camDistance}}
function pointerUp(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(!moved&&!busy&&reachable.length){const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(colliders,false);for(const hit of hits){const{x,y}=hit.object.userData;if(reachable.some(q=>q.x===x&&q.y===y)){moveTo(x,y);break}}}}

function renderLoop(){function loop(){requestAnimationFrame(loop);const dt=Math.min(.033,clock.getDelta());camera.position.lerp(cameraGoal,1-Math.pow(.001,dt));lookNow.lerp(lookGoal,1-Math.pow(.001,dt));camera.lookAt(lookNow);const t=performance.now()*.001;if(riverMesh)riverMesh.material.roughness=.17+.03*Math.sin(t*1.7);renderer.render(scene,camera)}loop()}
