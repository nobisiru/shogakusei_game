import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const N=16, HEX=1.05, HSTEP=.62, DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
let mode='com',turn=0,dice=0,busy=false,overview=false,seed=1,map=[],heightMap=[],reachable=[],reachPaths=new Map(),tileMeshes=[],resourceMeshes=[],playerGroups=[],dieGroup=null,dieRolling=false,drag=null;
const players=[{name:'PLAYER 1',x:2,y:13,inv:{wood:0,stone:0,sand:0},fire:false,boat:false,seen:new Set()},{name:'COM',x:13,y:13,inv:{wood:0,stone:0,sand:0},fire:false,boat:false,seen:new Set()}];

const canvas=document.getElementById('game3d'),world=document.getElementById('world'),loading=document.getElementById('loading'),errorEl=document.getElementById('webglError');
let renderer,scene,camera,raycaster,pointer=new THREE.Vector2(),sun,ambient,clock=new THREE.Clock(),targetLook=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),camDistance=13;
const materials={};

function webgl2(){const c=document.createElement('canvas');return !!c.getContext('webgl2')}
if(!webgl2()){loading.classList.add('hidden');errorEl.classList.remove('hidden');throw new Error('WebGL2 unavailable')}

init3D();bindUI();startRenderLoop();

function init3D(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 scene=new THREE.Scene();scene.background=new THREE.Color(0x91abb6);scene.fog=new THREE.FogExp2(0x8fa3a5,.028);
 camera=new THREE.PerspectiveCamera(42,1,.1,100);raycaster=new THREE.Raycaster();
 ambient=new THREE.HemisphereLight(0xd9efff,0x30412f,1.35);scene.add(ambient);
 sun=new THREE.DirectionalLight(0xfff3d6,3.1);sun.position.set(-10,18,8);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;sun.shadow.camera.near=.5;sun.shadow.camera.far=50;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x244739,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.42;ground.receiveShadow=true;scene.add(ground);
 createMaterials();resize();window.addEventListener('resize',resize);loading.classList.add('hidden');
}
function createMaterials(){
 const mk=(c,r=.93)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:0});
 materials.grass=mk(0x5f8f49);materials.tree=mk(0x4f7f42);materials.rock=mk(0x827966);materials.sand=mk(0xc6ad67);materials.valley=mk(0x47713e);materials.pass=mk(0x7c8050);materials.mountain=mk(0x8b8a7d);materials.cliff=mk(0x706f64);materials.goal=mk(0x4d9498);
 materials.water=new THREE.MeshPhysicalMaterial({color:0x3d88a3,roughness:.3,metalness:.02,transparent:true,opacity:.9,clearcoat:.35,clearcoatRoughness:.2});materials.river=new THREE.MeshPhysicalMaterial({color:0x4b9fba,roughness:.28,transparent:true,opacity:.93,clearcoat:.28});
}
function rng(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}function rand(a,b){return a+Math.floor(rng()*(b-a+1))}function inside(x,y){return x>=0&&y>=0&&x<N&&y<N}function key(x,y){return `${x},${y}`}function hdist(a,b,c,d){let dx=c-a,dy=d-b;return(Math.abs(dx)+Math.abs(dy)+Math.abs(dx+dy))/2}
function hexPos(x,y,h=0){const wx=(x+y*.5)*HEX*1.72,wz=y*HEX*1.5;return new THREE.Vector3(wx,h*HSTEP/2,wz)}
function elevation(x,y){return heightMap[y]?.[x]??0}

function generateWorld(){
 seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;map=Array.from({length:N},()=>Array(N).fill('grass'));heightMap=Array.from({length:N},()=>Array(N).fill(1));
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const edge=Math.min(x,y,N-1-x,N-1-y);if(edge===0||(edge===1&&rng()<.48)){map[y][x]='water';heightMap[y][x]=0}}
 for(let b=0;b<4;b++){let cx=rand(4,11),cy=rand(3,10),r=rand(2,4),peak=rand(3,5);for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){let d=Math.hypot(x-cx,y-cy);if(d<r)heightMap[y][x]=Math.max(heightMap[y][x],Math.max(2,Math.round(peak-d/r*2)))}}
 let rx=rand(5,10);for(let y=1;y<N-1;y++){rx=Math.max(2,Math.min(N-3,rx+rand(-1,1)));map[y][rx]='river';heightMap[y][rx]=0;if(rng()<.18&&rx+1<N-1){map[y][rx+1]='river';heightMap[y][rx+1]=0}}
 for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){if(map[y][x]==='river')continue;let h=heightMap[y][x];if(h>=4)map[y][x]='mountain';else if(h===3)map[y][x]='cliff';else if(h===2&&rng()<.5)map[y][x]='valley'}
 for(const[sx,sy]of[[2,13],[13,13]])for(let y=sy-2;y<=sy+1;y++)for(let x=sx-2;x<=sx+2;x++)if(inside(x,y)){map[y][x]='grass';heightMap[y][x]=1}
 for(let i=0;i<15;i++)placeResource('tree');for(let i=0;i<10;i++)placeResource('rock');for(let i=0;i<7;i++)placeResource('sand');
 let passes=0;for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++)if((map[y][x]==='cliff'||map[y][x]==='mountain')&&rng()<.12){map[y][x]='pass';heightMap[y][x]=Math.max(2,heightMap[y][x]);passes++}if(passes<2){map[5][5]='pass';heightMap[5][5]=2;map[6][10]='pass';heightMap[6][10]=2}
 for(const[gx,gy]of[[2,2],[13,2]]){for(let y=gy-1;y<=gy+1;y++)for(let x=gx-1;x<=gx+1;x++)if(inside(x,y)){map[y][x]='water';heightMap[y][x]=0}map[gy][gx]='goal';heightMap[gy][gx]=1}
 ensureNear(2,13,'tree');ensureNear(2,13,'rock');ensureNear(13,13,'tree');ensureNear(13,13,'rock');
}
function placeResource(t){for(let i=0;i<100;i++){let x=rand(1,N-2),y=rand(1,N-2);if(map[y][x]==='grass'||map[y][x]==='valley'){map[y][x]=t;return}}}
function ensureNear(sx,sy,t){for(let y=Math.max(1,sy-4);y<=Math.min(N-2,sy);y++)for(let x=Math.max(1,sx-4);x<=Math.min(N-2,sx+4);x++)if(map[y][x]===t)return;let x=Math.max(1,Math.min(N-2,sx+(rng()<.5?-2:2))),y=Math.max(1,sy-2);map[y][x]=t;heightMap[y][x]=1}

function clearWorld(){for(const m of tileMeshes)scene.remove(m);for(const m of resourceMeshes)scene.remove(m);for(const g of playerGroups)scene.remove(g);if(dieGroup)scene.remove(dieGroup);tileMeshes=[];resourceMeshes=[];playerGroups=[];dieGroup=null}
function buildWorld(){
 clearWorld();const geo=new THREE.CylinderGeometry(HEX,HEX,1,6,1,false);geo.rotateY(Math.PI/6);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const t=map[y][x],h=elevation(x,y),depth=Math.max(.28,h*HSTEP+.18),mat=(t==='tree'?materials.grass:t==='rock'?materials.grass:t==='sand'?materials.sand:materials[t]||materials.grass).clone();
  const mesh=new THREE.Mesh(geo,mat);const p=hexPos(x,y,h);mesh.scale.y=depth;mesh.position.set(p.x,depth/2-.18,p.z);mesh.castShadow=t!=='water'&&t!=='river';mesh.receiveShadow=true;mesh.userData={x,y,tile:true,type:t};scene.add(mesh);tileMeshes.push(mesh);
  addResourceObject(t,x,y,h);
 }
 playerGroups.push(makeHuman(0),makeHuman(1));scene.add(...playerGroups);updatePlayerMeshes();reveal(players[0]);reveal(players[1]);updateFog();
}
function addResourceObject(t,x,y,h){const base=hexPos(x,y,h);base.y=h*HSTEP+.12;if(t==='tree'){const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.75,7),new THREE.MeshStandardMaterial({color:0x68472f,roughness:1}));trunk.position.y=.38;const crown=new THREE.Mesh(new THREE.ConeGeometry(.52,1.15,8),new THREE.MeshStandardMaterial({color:0x285f36,roughness:1}));crown.position.y=1.15;g.add(trunk,crown);g.position.copy(base);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);resourceMeshes.push(g)}else if(t==='rock'){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.38,0),new THREE.MeshStandardMaterial({color:0x8b877d,roughness:1}));r.scale.set(1.2,.7,1);r.position.copy(base).add(new THREE.Vector3(0,.28,0));r.castShadow=true;scene.add(r);resourceMeshes.push(r)}else if(t==='goal'){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1.2,8),new THREE.MeshStandardMaterial({color:0xf4d65c,roughness:.7}));pole.position.copy(base).add(new THREE.Vector3(0,.65,0));pole.castShadow=true;scene.add(pole);resourceMeshes.push(pole)}}
function makeHuman(i){const g=new THREE.Group(),shirt=new THREE.MeshStandardMaterial({color:i===0?0xe54f43:0x4a86e8,roughness:.85}),skin=new THREE.MeshStandardMaterial({color:0xe5b08a,roughness:.9});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.46,4,8),shirt);body.position.y=.54;const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),skin);head.position.y=1;const leg1=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.32,3,6),shirt),leg2=leg1.clone();leg1.position.set(-.09,.13,0);leg2.position.set(.09,.13,0);g.add(body,head,leg1,leg2);g.userData={leg1,leg2};g.traverse(o=>{if(o.isMesh)o.castShadow=true});return g}
function updatePlayerMeshes(){players.forEach((p,i)=>{const v=hexPos(p.x,p.y,elevation(p.x,p.y));playerGroups[i].position.set(v.x,elevation(p.x,p.y)*HSTEP+.25,v.z)})}
function reveal(p){for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(hdist(p.x,p.y,x,y)<=5)p.seen.add(key(x,y))}
function updateFog(){const v=players[turn];for(const m of tileMeshes){let{x,y}=m.userData,seen=v.seen.has(key(x,y)),now=hdist(v.x,v.y,x,y)<=5;m.visible=seen;m.material.opacity=now?1:.5;m.material.transparent=!now;m.material.depthWrite=now}}

function bindUI(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>startGame(b.dataset.mode));document.getElementById('backToTitle').onclick=()=>{document.getElementById('gameApp').classList.add('game-hidden');document.getElementById('titleScreen').style.display='grid'};document.getElementById('reset').onclick=resetGame;document.getElementById('playAgain').onclick=resetGame;document.getElementById('diceBtn').onclick=roll;document.getElementById('overviewBtn').onclick=()=>{overview=!overview;overview?showOverview():focusPlayer(turn)};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',e=>{e.preventDefault();camDistance=THREE.MathUtils.clamp(camDistance+e.deltaY*.01,8,20);focusPlayer(turn)},{passive:false});
}
function startGame(m){mode=m;players[1].name=m==='com'?'COM':'PLAYER 2';document.getElementById('p2Name').textContent=players[1].name;document.getElementById('titleScreen').style.display='none';document.getElementById('gameApp').classList.remove('game-hidden');resetGame()}
function resetGame(){generateWorld();players[0].x=2;players[0].y=13;players[1].x=13;players[1].y=13;for(const p of players){p.inv={wood:0,stone:0,sand:0};p.fire=false;p.boat=false;p.seen=new Set()}turn=0;dice=0;busy=false;overview=false;reachable=[];reachPaths.clear();document.getElementById('winDialog').close?.();buildWorld();updateHud();focusPlayer(0,true);toast('🌍 新しい世界')}

function focusPlayer(i=turn,instant=false){const p=players[i],center=hexPos(p.x,p.y,elevation(p.x,p.y));lookGoal.set(center.x,elevation(p.x,p.y)*HSTEP+.2,center.z);const ang=Math.PI*.22;cameraGoal.set(center.x+camDistance*Math.sin(ang),7.6+camDistance*.18,center.z+camDistance*Math.cos(ang));if(instant){camera.position.copy(cameraGoal);targetLook.copy(lookGoal)}document.getElementById('cameraLabel').textContent=`📍 ${p.name}`}
function showOverview(){let cx=hexPos(7.5,7.5,0);lookGoal.set(cx.x,0,cx.z);cameraGoal.set(cx.x+19,20,cx.z+23);document.getElementById('cameraLabel').textContent='🗺️'}
function resize(){const r=world.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}

function canEnter(p,x,y,from){if(!inside(x,y))return false;let t=map[y][x],fromT=map[from.y][from.x],dh=elevation(x,y)-elevation(from.x,from.y);if(t==='water'||t==='goal')return p.boat;if(t==='cliff'&&fromT!=='pass')return false;if(Math.abs(dh)>=2&&t!=='pass'&&fromT!=='pass')return false;if(t==='mountain'&&fromT!=='pass'&&fromT!=='mountain')return false;return true}
function getReachable(p,steps){let q=[{x:p.x,y:p.y,d:0,path:[]}],best=new Map([[key(p.x,p.y),0]]),out=[];reachPaths.clear();while(q.length){let cur=q.shift();if(cur.d===steps){if(cur.x!==p.x||cur.y!==p.y){out.push(cur);reachPaths.set(key(cur.x,cur.y),cur.path)}continue}for(const[dx,dy]of DIRS){let x=cur.x+dx,y=cur.y+dy,k=key(x,y);if(!canEnter(p,x,y,cur))continue;let nd=cur.d+1;if(best.has(k)&&best.get(k)<=nd)continue;best.set(k,nd);q.push({x,y,d:nd,path:[...cur.path,{x,y}]})}}return out}
async function roll(){if(busy||dice||(mode==='com'&&turn===1))return;busy=true;document.getElementById('diceBtn').classList.add('rolling');const n=1+Math.floor(Math.random()*6);await animateDie(n);document.getElementById('diceBtn').classList.remove('rolling');dice=n;reachable=getReachable(players[turn],dice);highlightReachable();busy=false;if(!reachable.length)setTimeout(endTurn,450)}
function makeDie(){if(dieGroup)scene.remove(dieGroup);dieGroup=new THREE.Group();const geom=new THREE.BoxGeometry(.8,.8,.8),mats=[];for(let i=1;i<=6;i++)mats.push(new THREE.MeshStandardMaterial({map:dieTexture(i),roughness:.45}));const cube=new THREE.Mesh(geom,mats);cube.castShadow=true;dieGroup.add(cube);scene.add(dieGroup);return cube}
function dieTexture(n){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#fff7df';g.fillRect(0,0,128,128);g.fillStyle='#1d1b18';const P=[[64,64],[38,38],[90,90],[90,38],[38,90],[38,64],[90,64]];let idx={1:[0],2:[1,2],3:[1,0,2],4:[1,3,4,2],5:[1,3,0,4,2],6:[1,5,4,3,6,2]}[n];for(const i of idx){g.beginPath();g.arc(P[i][0],P[i][1],10,0,Math.PI*2);g.fill()}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function animateDie(result){return new Promise(resolve=>{let cube=makeDie(),p=players[turn],start=hexPos(p.x,p.y,elevation(p.x,p.y));dieGroup.position.set(start.x-1,elevation(p.x,p.y)*HSTEP+2.4,start.z+1);let t0=performance.now(),dur=900;dieRolling=true;function step(now){let t=Math.min(1,(now-t0)/dur),hop=Math.abs(Math.sin(t*Math.PI*4))*(1-t)*1.7;dieGroup.position.x=start.x-1+t*3.3;dieGroup.position.z=start.z+1+t*1.2;dieGroup.position.y=elevation(p.x,p.y)*HSTEP+.5+hop;cube.rotation.x+=.22;cube.rotation.y+=.28;cube.rotation.z+=.18;if(t<1)requestAnimationFrame(step);else{cube.rotation.set(0,0,0);dieRolling=false;setTimeout(()=>{scene.remove(dieGroup);dieGroup=null;resolve()},220)}}requestAnimationFrame(step)})}
function highlightReachable(){const set=new Set(reachable.map(r=>key(r.x,r.y)));for(const m of tileMeshes){if(set.has(key(m.userData.x,m.userData.y))){m.material.emissive=new THREE.Color(0x8c7618);m.material.emissiveIntensity=.7}else{m.material.emissive=new THREE.Color(0x000000);m.material.emissiveIntensity=0}}if(reachable.length){let xs=reachable.map(r=>hexPos(r.x,r.y,elevation(r.x,r.y)));let c=xs.reduce((a,b)=>a.add(b.clone()),new THREE.Vector3()).multiplyScalar(1/xs.length);lookGoal.copy(c);cameraGoal.set(c.x+15,12,c.z+18)}}
async function moveTo(x,y){if(busy||!reachable.some(r=>r.x===x&&r.y===y))return;busy=true;let who=turn,p=players[who],path=reachPaths.get(key(x,y))||[{x,y}];reachable=[];highlightReachable();for(const s of path){p.x=s.x;p.y=s.y;reveal(p);await walkStep(who,s.x,s.y);updateFog()}collect(p,x,y);autoCraft(p);updateHud();busy=false;if(map[y][x]==='goal'){win();return}setTimeout(endTurn,450)}
function walkStep(i,x,y){return new Promise(resolve=>{let g=playerGroups[i],from=g.position.clone(),v=hexPos(x,y,elevation(x,y)),to=new THREE.Vector3(v.x,elevation(x,y)*HSTEP+.25,v.z),t0=performance.now();function step(now){let t=Math.min(1,(now-t0)/260),e=t*t*(3-2*t);g.position.lerpVectors(from,to,e);g.userData.leg1.rotation.x=Math.sin(t*Math.PI*4)*.55;g.userData.leg2.rotation.x=-Math.sin(t*Math.PI*4)*.55;lookGoal.lerp(to,.15);if(t<1)requestAnimationFrame(step);else{g.userData.leg1.rotation.x=g.userData.leg2.rotation.x=0;focusPlayer(i);resolve()}}requestAnimationFrame(step)})}
function collect(p,x,y){let t=map[y][x];if(t==='tree'){p.inv.wood+=2;toast('🪵 +2')}else if(t==='rock'){p.inv.stone+=2;toast('🪨 +2')}else if(t==='sand'){p.inv.sand+=2;toast('砂 +2')}}
function autoCraft(p){if(!p.fire&&p.inv.wood>=2&&p.inv.stone>=1){p.inv.wood-=2;p.inv.stone--;p.fire=true;toast('🔥 火を発明！')}if(p.fire&&!p.boat&&p.inv.wood>=4){p.inv.wood-=4;p.boat=true;toast('🛶 舟を発明！')}}
function endTurn(){dice=0;reachable=[];reachPaths.clear();turn=1-turn;reveal(players[turn]);updateFog();updateHud();focusPlayer(turn);if(mode==='com'&&turn===1)setTimeout(comTurn,650)}
async function comTurn(){if(mode!=='com'||turn!==1)return;busy=true;let n=1+Math.floor(Math.random()*6);await animateDie(n);dice=n;reachable=getReachable(players[1],n);highlightReachable();if(!reachable.length){busy=false;endTurn();return}reachable.sort((a,b)=>scoreTarget(players[1],b)-scoreTarget(players[1],a));busy=false;moveTo(reachable[0].x,reachable[0].y)}
function scoreTarget(p,c){let t=map[c.y][c.x],s=Math.random();if(!p.fire){if(t==='tree')s+=7;if(t==='rock')s+=6}else if(!p.boat){if(t==='tree')s+=8}else{if(t==='goal')s+=30;if(t==='water')s+=2}if(t==='pass')s+=2;if(!p.seen.has(key(c.x,c.y)))s+=2.5;return s}

function updateHud(){document.getElementById('p1Inv').textContent=`🪵${players[0].inv.wood} 🪨${players[0].inv.stone}${players[0].boat?' 🛶':''}`;document.getElementById('p2Inv').textContent=`🪵${players[1].inv.wood} 🪨${players[1].inv.stone}${players[1].boat?' 🛶':''}`;document.getElementById('turnText').textContent=players[turn].name;document.getElementById('p1Card').classList.toggle('active',turn===0);document.getElementById('p2Card').classList.toggle('active',turn===1);document.getElementById('diceBtn').disabled=busy||dice>0||(mode==='com'&&turn===1);let p=players[turn],mn=document.getElementById('missionNow'),md=document.getElementById('missionNeed');if(!p.fire){mn.textContent='🔥 火を起こせ';md.textContent='木 2　石 1'}else if(!p.boat){mn.textContent='🛶 舟をつくれ';md.textContent='木 4'}else{mn.textContent='⭐ 海の向こうへ';md.textContent='離島を見つけろ'}}
function win(){document.getElementById('winnerText').textContent=`${players[turn].name} 勝利！`;document.getElementById('winDialog').showModal()}
let toastTimer;function toast(s){const e=document.getElementById('toast');e.textContent=s;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),1100)}

function pointerDown(e){if(busy)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,moved:false};canvas.setPointerCapture?.(e.pointerId)}
function pointerMove(e){if(!drag||drag.id!==e.pointerId)return;let dx=e.clientX-drag.px,dy=e.clientY-drag.py;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=true;drag.px=e.clientX;drag.py=e.clientY;if(drag.moved){cameraGoal.x-=dx*.018*camDistance;cameraGoal.z-=dy*.022*camDistance;lookGoal.x-=dx*.018*camDistance;lookGoal.z-=dy*.022*camDistance}}
function pointerUp(e){if(!drag||drag.id!==e.pointerId)return;let moved=drag.moved;drag=null;if(!moved&&!busy&&reachable.length){const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(tileMeshes,false);for(const hit of hits){let{x,y}=hit.object.userData;if(reachable.some(q=>q.x===x&&q.y===y)){moveTo(x,y);break}}}}

function startRenderLoop(){function loop(){requestAnimationFrame(loop);let dt=Math.min(.033,clock.getDelta());camera.position.lerp(cameraGoal,1-Math.pow(.001,dt));targetLook.lerp(lookGoal,1-Math.pow(.001,dt));camera.lookAt(targetLook);const t=performance.now()*.001;for(const m of tileMeshes){if(m.userData.type==='water'||m.userData.type==='river'){m.material.roughness=.28+.05*Math.sin(t+m.position.x)}}renderer.render(scene,camera)}loop()}
