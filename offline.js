(function(){"use strict";

// ===== config.js =====
// Seconds, world pixels, and pixels/second. Every editable value has slider metadata.
const DEFAULT_CONFIG = Object.freeze({maxSpeed:310, acceleration:2500, groundFriction:1850, airAcceleration:2050, jumpVelocity:590, gravity:1480, maxFallSpeed:650, coyoteTime:0.10, jumpBufferTime:0.13, carrySpeedMultiplier:0.85, jumpCutMultiplier:0.48, rollSpeedMultiplier:1.42, rollTurnMultiplier:0.35, springVelocity:860, windAcceleration:900, manaRegen:15, roundSeconds:90, cameraFollow:7, cameraLookAhead:0.25, shakeStrength:6, wallSlideSpeed:95, wallJumpVelocity:635, wallJumpPush:385, wallJumpLock:0.16, wallCoyoteTime:0.09,iceFriction:110,honeySpeed:0.52,conveyorSpeed:105,crumbleDelay:0.65,crumbleRespawn:3.5,vineGrabRadius:38,vineJumpVelocity:640,airDrag:0,fallGravityMult:1,lowJumpGravityMult:1,wallCheckDistance:0.8});
const CONFIG_RANGES = {maxSpeed:[100,650,5],acceleration:[300,6000,50],groundFriction:[100,5000,50],airAcceleration:[200,5000,50],jumpVelocity:[250,1000,10],gravity:[400,3000,20],maxFallSpeed:[200,1400,10],coyoteTime:[0,0.3,0.01],jumpBufferTime:[0,0.3,0.01],carrySpeedMultiplier:[0.4,1,0.01],jumpCutMultiplier:[0.1,1,0.01],rollSpeedMultiplier:[1,2.5,0.01],rollTurnMultiplier:[0.1,1,0.01],springVelocity:[300,1300,10],windAcceleration:[0,2200,25],manaRegen:[0,50,1],roundSeconds:[15,180,5],cameraFollow:[1,20,0.5],cameraLookAhead:[0,0.7,0.01],shakeStrength:[0,20,0.5],wallSlideSpeed:[40,300,5],wallJumpVelocity:[350,950,10],wallJumpPush:[200,650,5],wallJumpLock:[0.05,0.3,0.01],wallCoyoteTime:[0,0.2,0.01],iceFriction:[10,800,10],honeySpeed:[0.2,1,0.01],conveyorSpeed:[0,250,5],crumbleDelay:[0.2,2,0.05],crumbleRespawn:[1,8,0.25],vineGrabRadius:[15,70,1],vineJumpVelocity:[350,950,10],airDrag:[0,1000,5],fallGravityMult:[0.5,2.5,0.05],lowJumpGravityMult:[1,4,0.05],wallCheckDistance:[0.5,4,0.1]};
const config = {...DEFAULT_CONFIG};
const STEP = 1/60;

// The supplied movement.js values, mapped to the existing world/feet-based engine.
// Zero airDrag preserves the legacy airAcceleration * 0.18 behavior.
const SNAPPY_MOVEMENT = Object.freeze({maxSpeed:260,acceleration:2200,groundFriction:1800,airAcceleration:1600,airDrag:150,jumpVelocity:560,gravity:1500,fallGravityMult:1.15,lowJumpGravityMult:2.2,maxFallSpeed:720,coyoteTime:0.1,jumpBufferTime:0.1,jumpCutMultiplier:1,wallSlideSpeed:90,wallJumpPush:300,wallJumpVelocity:520,wallJumpLock:0.12,wallCoyoteTime:0.1,wallCheckDistance:2});
function applyMovementPreset(target,name){
  if(name!=='snappy'&&name!=='classic')return false;
  for(const key of Object.keys(SNAPPY_MOVEMENT))target[key]=name==='snappy'?SNAPPY_MOVEMENT[key]:DEFAULT_CONFIG[key];
  return true;
}

// ===== input.js =====
// All device input is normalized to a serializable object. The simulation never reads DOM events.
const emptyInput = () => ({left:false,right:false,jump:false,roll:false,grab:false,jumpPressed:false,jumpReleased:false});
function createInput(isChatOpen=()=>false) {
  const keys=new Set(), touches=new Set(); let press=false,release=false,oldJump=false;
  let blocked=false;
  const read=()=>({left:keys.has('ArrowLeft')||keys.has('KeyA')||touches.has('left'),right:keys.has('ArrowRight')||keys.has('KeyD')||touches.has('right'),jump:keys.has('KeyW')||touches.has('jump'),roll:keys.has('ShiftLeft')||keys.has('ShiftRight')||touches.has('roll'),grab:false});
  const edge=()=>{let j=read().jump;if(j&&!oldJump){press=true;release=false;}if(!j&&oldJump)release=true;oldJump=j;};
  const movement=new Set(['ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown',e=>{if(blocked||isChatOpen()||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLButtonElement&&e.code==='Space')return;if(!e.repeat&&movement.has(e.code)){e.preventDefault();keys.add(e.code);edge();}});
  window.addEventListener('keyup',e=>{keys.delete(e.code);edge();});
  function clear(){keys.clear();touches.clear();press=release=oldJump=false;document.querySelectorAll('[data-touch]').forEach(b=>b.classList.remove('active'));}
  window.addEventListener('blur',clear);
  for(const b of document.querySelectorAll('[data-touch]')){const k=b.dataset.touch; const down=e=>{e.preventDefault();if(blocked||isChatOpen())return;b.setPointerCapture(e.pointerId);touches.add(k);b.classList.add('active');edge();}; const up=e=>{touches.delete(k);b.classList.remove('active');edge();};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);}
  return {setBlocked(value){blocked=value;clear();},sample(){if(blocked||isChatOpen())return emptyInput();const s={...read(),jumpPressed:press,jumpReleased:release};press=release=false;return s;},clear};
}

// ===== physics.js =====
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const approach=(n,target,delta)=>n<target?Math.min(n+delta,target):Math.max(n-delta,target);
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const bodyRect=p=>({x:p.x-p.w/2,y:p.y-p.h,w:p.w,h:p.h});
const EPS=0.001;
// Axis-separated swept crossings: movement is clipped to the first crossed face.
// One-way ledges only catch downward movement from above, never sides or ceilings.
function moveBody(p,dt,platforms){
  const oldX=p.x,oldY=p.y,dx=p.vx*dt,dy=p.vy*dt,half=p.w/2;
  let nx=oldX+dx, ny=oldY+dy,hitWall=false,landed=false,impact=0,groundId=null;
  for(const b of platforms){if(b.oneWay||b.kind==='ramp')continue;if(oldY<=b.y+EPS||oldY-p.h>=b.y+b.h-EPS)continue;
    if(dx>0&&oldX+half<=b.x+EPS&&nx+half>b.x){nx=Math.min(nx,b.x-half);hitWall=true;}
    if(dx<0&&oldX-half>=b.x+b.w-EPS&&nx-half<b.x+b.w){nx=Math.max(nx,b.x+b.w+half);hitWall=true;}
  }
  const oldFoot=oldY;let ground=null,ceiling=null;
  for(const b of platforms){if(nx+half<=b.x+EPS||nx-half>=b.x+b.w-EPS)continue;
    if(b.kind==='ramp'){
      // Rising ramp, top surface only. Follow the slope when already supported.
      if(nx<b.x||nx>b.x+b.w)continue;
      const surface=x=>b.y+b.h*(b.slope==='down'?clamp((x-b.x)/b.w,0,1):1-clamp((x-b.x)/b.w,0,1));
      const prev=surface(oldX),next=surface(nx);const wasOn=oldX>=b.x-EPS&&oldX<=b.x+b.w+EPS&&(p.groundId===b.id&&p.onGround||Math.abs(oldFoot-prev)<2);
      if(dy>=0&&((oldFoot<=prev+EPS&&ny>=next-EPS)||wasOn))if(!ground||next<ground.y)ground={y:next,b};
      continue;
    }
    if((dy>=0&&p.onGround&&p.groundId!=null&&p.groundId===b.id||dy-(b.dy||0)>=-EPS)&&(oldY<=b.y+EPS||oldY<=b.y-(b.dy||0)+EPS)&&ny>=b.y-EPS&&(!ground||b.y<ground.y))ground={y:b.y,b};
    if(dy<0&&!b.oneWay&&oldY-p.h>=b.y+b.h-EPS&&ny-p.h<b.y+b.h){const y=b.y+b.h+p.h;if(ceiling===null||y>ceiling)ceiling=y;}
  }
  let vy=p.vy,vx=p.vx;if(hitWall)vx=0;
  if(ground){ny=ground.y;impact=Math.max(0,vy);vy=0;landed=true;groundId=ground.b.id??null;if(ground.b.kind==='spring'){vy=-ground.b.bounce;landed=false;}}
  else if(ceiling!==null){ny=ceiling;vy=0;}
  return {x:nx,y:ny,vx,vy,onGround:landed,hitWall,impact,groundId,sprung:!!ground&&ground.b.kind==='spring'};
}

// Wall normals point toward the contacted wall. Ignore tiny corner contacts,
// one-way ledges and ramps; only real solid faces support a wall jump.
function wallContact(p,platforms,distance=.8){
  for(const b of platforms){
    if(b.oneWay||b.kind==='ramp'||b.kind==='spring')continue;
    if(Math.min(p.y,b.y+b.h)-Math.max(p.y-p.h,b.y)<6)continue;
    if(Math.abs(p.x+p.w/2-b.x)<distance)return 1;
    if(Math.abs(p.x-p.w/2-b.x-b.w)<distance)return -1;
  }
  return 0;
}

// Icy wall coatings reduce grip only on the coated face. The regular wall
// jump is retained, but the hamster descends faster while holding toward ice.
function wallHasIce(p,platforms,side){return !!side&&platforms.some(b=>b.iceSide===(side===1?'left':'right')&&!b.oneWay&&b.kind!=='ramp'&&Math.min(p.y,b.y+b.h)-Math.max(p.y-p.h,b.y)>=6&&Math.abs(side===1?p.x+p.w/2-b.x:p.x-p.w/2-b.x-b.w)<.8);}

// ===== player.js =====

function spawnPlayer(spawn,scale=1){return {x:spawn.x,y:spawn.y,vx:0,vy:0,w:38*scale,h:43*scale,scale,onGround:false,coyote:0,jumpBuffer:0,jumpActive:false,carrying:false,rolling:false,facing:1,rotation:0,squash:0,walk:0,wallSide:0,wallGrace:0,lastWall:0,wallSliding:false,wallLock:0,groundId:null,vineId:null,vineCooldown:0,vineAngle:0,vineAngularVelocity:0,vineReleaseReady:false,vineDetached:false};}
// Pure update: previous state + normalized input + serializable world snapshot + tuning.
// No canvas, DOM, clock, audio, randomness, or mutation. Returns state and event data.
function updatePlayer(previous,input,world,c,dt){
  let p={...previous}; const events=[];
  const direction=Number(input.right)-Number(input.left);
  p.vineCooldown=Math.max(0,(p.vineCooldown||0)-dt);
  // A latched vine is a separate movement mode. Normal gravity and collisions
  // cannot detach the hamster. Re-grabbing is blocked until the next landing.
  if(p.onGround)p.vineDetached=false;
  const vines=world.vines||[];
  const held=p.vineId!=null;
  let vine=held?vines.find(v=>v.id===p.vineId):null;
  if(!held&&!p.vineDetached&&!p.vineCooldown&&!p.onGround&&!p.rolling){
    vine=vines.find(v=>Math.hypot(p.x-v.endX,p.y-p.h*.75-v.endY)<=Math.max(c.vineGrabRadius,55));
  }
  if(vine){
    const length=vine.length||145, anchorX=vine.x??vine.endX, anchorY=vine.y??(vine.endY-length);
    if(!held){
      p.vineAngle=vine.angle||0;p.vineAngularVelocity=0;
      p.vineReleaseReady=!input.jump&&!input.jumpPressed;
      events.push({type:'vineCatch',x:p.x,y:p.y});
    }
    // Direct responsive input: A pulls left, D pulls right. No key holds
    // the current angle; the rope does not swing itself or drop the player.
    const oldAngle=p.vineAngle, limit=1.02;
    const target=direction?direction*limit:oldAngle;
    const angle=approach(oldAngle,target,2.8*dt);
    const omega=(angle-oldAngle)/dt;
    p.vineAngle=angle;p.vineAngularVelocity=omega;
    p.x=anchorX+Math.sin(angle)*length;p.y=anchorY+Math.cos(angle)*length+p.h*.75;
    p.vx=p.vy=0;p.onGround=false;p.coyote=0;p.groundId=null;p.wallGrace=0;p.lastWall=0;p.wallLock=0;p.wallSliding=false;p.jumpBuffer=0;p.rolling=false;p.jumpActive=false;p.vineId=vine.id;
    if(direction)p.facing=direction;
    if(!input.jump&&!input.jumpPressed)p.vineReleaseReady=true;
    if(!held||!p.vineReleaseReady||!input.jumpPressed)return {player:p,events};
    const launchDirection=direction||p.facing;
    p.vineId=null;p.vineCooldown=.5;p.vineDetached=true;p.vineReleaseReady=false;p.facing=launchDirection;
    p.vx=launchDirection*clamp(c.wallJumpPush*.75+Math.abs(Math.cos(angle)*length*omega)*.30,180,420);
    p.vy=-c.vineJumpVelocity;p.jumpActive=true;p.wallLock=.18;p.squash=-.22;
    events.push({type:'jump',x:p.x,y:p.y});
    // Release once, without running a second jump or re-grab in this tick.
    return {player:p,events};
  }else p.vineId=null;
  const support=p.onGround?world.platforms.find(b=>b.id!=null&&b.id===p.groundId):null;
  if(support){p.x+=support.dx||0;p.y+=support.dy||0;}
  else if(p.onGround&&p.groundId!=null)p.onGround=false;
  p.coyote=p.onGround?c.coyoteTime:Math.max(0,p.coyote-dt);
  p.jumpBuffer=input.jumpPressed?Math.max(c.jumpBufferTime,dt):Math.max(0,p.jumpBuffer-dt);
  p.wallLock=Math.max(0,(p.wallLock||0)-dt);
  const contact=wallContact(p,world.platforms,c.wallCheckDistance);
  if(p.onGround){p.wallGrace=0;p.lastWall=0;}
  else if(contact&&!p.wallLock){p.wallGrace=c.wallCoyoteTime;p.lastWall=contact;}
  else p.wallGrace=Math.max(0,(p.wallGrace||0)-dt);
  p.rolling=!!input.roll&&!p.wallLock;if(direction&&!p.wallLock)p.facing=direction;
  const roll=p.rolling&&p.onGround;const speed=c.maxSpeed*(p.carrying?c.carrySpeedMultiplier:1)*(roll?c.rollSpeedMultiplier:1)*(support?.kind==='honey'?c.honeySpeed:1);
  const accel=(p.onGround?c.acceleration:c.airAcceleration)*(p.rolling?c.rollTurnMultiplier:1)*(support?.kind==='ice'?.32:1);
  if(!p.wallLock)p.vx=approach(p.vx,direction*speed,(direction?accel:p.onGround?(support?.kind==='ice'?c.iceFriction:c.groundFriction)*(roll?.35:1):(c.airDrag||c.airAcceleration*.18))*dt);
  for(const f of world.fans){if(overlaps(bodyRect(p),f.area))p.vx=clamp(p.vx+f.direction*c.windAcceleration*dt,-speed*1.8,speed*1.8);}
  if(p.jumpBuffer>0&&(p.onGround||p.coyote>0)){p.vy=-c.jumpVelocity;p.onGround=false;p.coyote=0;p.jumpBuffer=0;p.jumpActive=true;p.squash=-0.32;events.push({type:'jump',x:p.x,y:p.y});}
  else if(p.jumpBuffer>0&&!p.onGround&&!p.wallLock&&!p.rolling&&(contact||p.wallGrace>0)){
    const side=contact||p.lastWall;p.vx=-side*c.wallJumpPush;p.vy=-c.wallJumpVelocity;
    p.facing=-side;p.wallLock=c.wallJumpLock;p.wallGrace=0;p.lastWall=0;p.jumpBuffer=0;
    p.jumpActive=true;p.squash=-.25;p.wallSliding=false;events.push({type:'wallJump',x:p.x,y:p.y-15});
  }
  // Legacy instant cut and optional variable-gravity jump are mutually exclusive.
  // Springs keep their full upward launch (jumpActive is false for spring events).
  if((input.jumpReleased||!input.jump)&&p.jumpActive&&p.vy<0&&c.jumpCutMultiplier<1){p.vy*=c.jumpCutMultiplier;p.jumpActive=false;}
  const gravityScale=p.vy>0?c.fallGravityMult:p.vy<0&&p.jumpActive&&!input.jump?c.lowJumpGravityMult:1;
  p.vy=Math.min(c.maxFallSpeed,p.vy+c.gravity*gravityScale*dt);if(p.vy>=0)p.jumpActive=false;
  if(!p.onGround&&!p.wallLock&&!p.rolling&&contact&&direction===contact&&p.vy>0)p.vy=Math.min(p.vy,c.wallSlideSpeed*(wallHasIce(p,world.platforms,contact)?1.6:1));
  const wasGround=p.onGround;const belt=support?.kind==='conveyor'?(support.direction||1)*c.conveyorSpeed:0;
  const hit=moveBody({...p,vx:p.vx+belt},dt,world.platforms);if(!hit.hitWall)hit.vx-=belt;Object.assign(p,hit);
  p.wallSide=wallContact(p,world.platforms,c.wallCheckDistance);
  p.wallSliding=!p.onGround&&!p.wallLock&&!p.rolling&&p.wallSide!==0&&direction===p.wallSide&&p.vy>0;
  if(p.wallSliding)p.vy=Math.min(p.vy,c.wallSlideSpeed*(wallHasIce(p,world.platforms,p.wallSide)?1.6:1));
  if(p.onGround){p.wallLock=0;p.wallGrace=0;p.lastWall=0;}

  if(hit.sprung){p.coyote=0;p.jumpActive=false;p.squash=-.35;events.push({type:'spring',x:p.x,y:p.y});}
  else if(!wasGround&&p.onGround&&hit.impact>100){p.squash=Math.min(.38,hit.impact/1700);events.push({type:'land',x:p.x,y:p.y,impact:hit.impact});}
  p.squash=approach(p.squash,0,dt*2.6);p.walk+=Math.abs(p.vx)*dt/25;if(p.rolling)p.rotation+=p.vx*dt/20;else p.rotation=0;
  const edge=p.scale<1?p.w/2:20;if(p.x<edge){p.x=edge;p.vx=0;}if(p.x>world.width-edge){p.x=world.width-edge;p.vx=0;}
  return {player:p,events};
}

// ===== level.js =====
// JSON maps are embedded by build-offline.py for file://; served versions use fetch.
const LEVEL_FILES=['tutorial-01','tutorial-02','tutorial-03','tutorial-04'];
const LEVELS=/* MAP_DATA_START */ [{"id":"tutorial-01","name":"Tutorial 01","theme":"First Jump","difficulty":"Easy","practice":true,"width":1800,"height":540,"spawn":{"x":850,"y":390},"platforms":[{"id":"ground","x":0,"y":390,"w":1800,"h":150,"kind":"wood"},{"id":"jump-block","x":1100,"y":320,"w":120,"h":70,"kind":"wood"}],"hazards":[],"checkpoints":[],"vines":[],"signs":[],"acorn":{"x":1510,"y":361},"hole":{"x":270,"y":344,"floor":390},"jumpTargets":[{"x":1000,"y":390,"radius":85,"platform":"ground"},{"x":1160,"y":320,"radius":58,"platform":"jump-block"}]},{"id":"tutorial-02","name":"Tutorial 02","theme":"Meadow Discovery","difficulty":"Easy","practice":true,"terrainLesson":true,"width":2200,"height":540,"spawn":{"x":250,"y":390},"platforms":[{"id":"grass","x":0,"y":390,"w":840,"h":150,"kind":"grass"},{"id":"ice","x":840,"y":390,"w":360,"h":150,"kind":"ice"},{"id":"spring","x":1200,"y":390,"w":120,"h":150,"kind":"spring","style":"purple"},{"id":"chocolate","x":1320,"y":390,"w":400,"h":150,"kind":"honey","style":"chocolate"},{"id":"wood","x":1720,"y":390,"w":480,"h":150,"kind":"wood","style":"bare"}],"hazards":[],"checkpoints":[],"vines":[{"x":250,"y":115,"length":145,"amplitude":0.11,"period":3}],"signs":[{"x":250,"y":390,"label":"VINE · A/D + W"},{"x":550,"y":390,"label":"GRASS"},{"x":1020,"y":390,"label":"ICE"},{"x":1260,"y":390,"label":"BOUNCE!"},{"x":1520,"y":390,"label":"CHOCOLATE"},{"x":1950,"y":390,"label":"WOOD"}]},{"id":"tutorial-03","name":"Tutorial 03","theme":"Wall Jump","difficulty":"Easy","practice":true,"wallLesson":true,"width":960,"height":790,"spawn":{"x":480,"y":680},"platforms":[{"id":"ground","x":0,"y":680,"w":960,"h":110,"kind":"grass"},{"id":"left-wall","x":280,"y":225,"w":130,"h":455,"kind":"wall"},{"id":"right-wall","x":550,"y":225,"w":130,"h":455,"kind":"wall"}],"hazards":[],"checkpoints":[],"vines":[],"signs":[{"x":480,"y":225,"label":"ACORN SUMMIT"},{"x":200,"y":680,"label":"WALL JUMP"}],"acorn":{"x":480,"y":200},"hole":{"x":480,"y":634,"floor":680}},{"id":"tutorial-04","name":"Tutorial 04","theme":"Little Farmer","difficulty":"Easy","practice":true,"farmLesson":true,"width":1400,"height":540,"spawn":{"x":420,"y":390},"platforms":[{"id":"ground","x":0,"y":390,"w":1400,"h":150,"kind":"grass"}],"hazards":[],"checkpoints":[],"vines":[],"signs":[{"x":420,"y":390,"label":"LITTLE FARMER"}],"farmPlots":[{"x":620,"y":390},{"x":745,"y":390},{"x":870,"y":390},{"x":995,"y":390},{"x":1120,"y":390}]}] /* MAP_DATA_END */;
const FALLBACK_LEVEL=LEVELS[0];
async function loadLevel(id=LEVEL_FILES[0]) {
  const index=Math.max(0,LEVEL_FILES.indexOf(id));
  if(typeof location!=='undefined'&&location.protocol!=='file:'&&!globalThis.ANIMALIA_OFFLINE){try{const r=await fetch('./levels/'+LEVEL_FILES[index]+'.json');if(!r.ok)throw Error(r.status);const m=await r.json();if(!Array.isArray(m.platforms)||!m.spawn||(!m.practice&&(!m.acorn||!m.hole)))throw Error('Invalid map');return m;}catch(e){console.warn('Using bundled map',e);}}
  return structuredClone(LEVELS[index]);
}

// ===== parkour.js =====
// Deterministic stage state. Map geometry is immutable; dynamic data is serializable.
function createStage(level){return {time:0,crumble:{},checkpoint:null,debris:[],platforms:level.platforms.map(b=>({...b,dx:0,dy:0})),vines:vinePositions(level,0)};}
function vinePositions(level,t,previous=[],p=null,dt=0){return (level.vines||[]).map((v,i)=>{const old=previous.find(q=>q.id===i);let a=old?.angle||0,omega=old?.angularVelocity||0;if(p?.vineId===i){a=p.vineAngle;omega=p.vineAngularVelocity;}else{omega+=(-7.8*Math.sin(a)-1.5*omega)*dt;a+=omega*dt;}return {...v,id:i,endX:v.x+Math.sin(a)*v.length,endY:v.y+Math.cos(a)*v.length,angle:a,angularVelocity:omega};});}
function stepStage(stage,level,p,c,dt){const time=stage.time+dt;const crumble={...stage.crumble};for(const b of level.platforms){if(b.kind!=='crumble')continue;let age=crumble[b.id];if(age===undefined&&p.onGround&&p.groundId===b.id)age=0;if(age!==undefined){age+=dt;if(age>=c.crumbleDelay+c.crumbleRespawn)delete crumble[b.id];else crumble[b.id]=age;}}
 const platforms=level.platforms.flatMap(b=>{let age=crumble[b.id];if(b.kind==='crumble'&&age>=c.crumbleDelay)return [];let x=b.x,y=b.y;if(b.motion){const phase=t=>Math.sin(t*Math.PI*2/b.motion.period);x+=(b.motion.x||0)*phase(time);y+=(b.motion.y||0)*phase(time);}const prev=stage.platforms.find(q=>q.id===b.id);return [{...b,x,y,dx:prev?x-prev.x:0,dy:prev?y-prev.y:0,bounce:b.kind==='spring'?c.springVelocity:b.bounce,crumbleAge:age}];});// Falling pieces are visual only; the collision face vanishes at the collapse instant.
 const debris=level.platforms.filter(b=>b.kind==='crumble'&&crumble[b.id]>=c.crumbleDelay&&crumble[b.id]-c.crumbleDelay<.75).map(b=>({...b,fallAge:crumble[b.id]-c.crumbleDelay}));
 return {...stage,time,crumble,platforms,debris,vines:vinePositions(level,time,stage.vines,p,dt)};}
// Shared round collision predicates; tests use the same rules as the live loop.
function acornReached(level,p){const scale=level.playerScale||1;return Math.hypot(p.x-level.acorn.x,p.y-20*scale-level.acorn.y)<42*scale;}
function homeReached(level,p){const scale=level.playerScale||1;return p.carrying&&Math.abs(p.x-level.hole.x)<30*scale&&Math.abs(p.y-(level.hole.floor??level.hole.y+46))<40*scale;}
function checkpointAt(stage,level,p){return (level.checkpoints||[]).find(q=>p.onGround&&Math.abs(p.x-q.x)<46&&Math.abs(p.y-q.y)<9&&q.id!==stage.checkpoint?.id)||null;}
function recordTime(storage,id,seconds){try{const key='animalia.best.v04.'+id;const raw=storage.getItem(key);const best=raw===null?Infinity:Number(raw);if(!Number.isFinite(best)||best<=0||seconds<best){storage.setItem(key,String(seconds));return {best:seconds,newRecord:true};}return {best,newRecord:false};}catch{return {best:seconds,newRecord:false};}}
function bestTime(storage,id){try{const raw=storage.getItem('animalia.best.v04.'+id);const n=Number(raw);return raw!==null&&Number.isFinite(n)&&n>0?n:null;}catch{return null;}}

// ===== adventure.js =====
// Local-only progression and a compact, interpolated personal-best replay.
// No physics mutations, networking, or dependency on the renderer.
const PROFILE_KEY='animalia.adventure.v1';
const LIMIT=1801; // 180 seconds at 10 Hz, including the starting sample
const SAMPLE_PERIOD=.1;
const TRAIL_GOALS=Object.freeze({'parkour-01':25,'meadow-run':30,'tree-village-climb':30,'tree-village':30,'maze-run-01':18,'sunpetal-grove':22});
function freshAdventure(){return {xp:0,clears:0,trails:{}};}
function readAdventure(store){try{const p=JSON.parse(store.getItem(PROFILE_KEY)||'null');if(p&&Number.isSafeInteger(p.xp)&&p.xp>=0&&Number.isSafeInteger(p.clears)&&p.clears>=0&&p.trails&&typeof p.trails==='object'&&!Array.isArray(p.trails)&&Object.values(p.trails).every(t=>t&&Number.isSafeInteger(t.clears)&&t.clears>=0&&Number.isInteger(t.medals)&&t.medals>=0&&t.medals<=3&&(t.best===null||Number.isFinite(t.best)&&t.best>0)))return p;}catch{}return freshAdventure();}
function adventureRank(p){return Math.floor(Math.sqrt(p.xp/100))+1;}
function adventureSummary(p){const rank=adventureRank(p),min=100*(rank-1)**2,max=100*rank**2;return {rank,progress:(p.xp-min)/(max-min),completed:Object.values(p.trails).filter(t=>t?.clears>0).length,medals:Object.values(p.trails).reduce((n,t)=>n+(t?.medals||0),0)};}
function trailAward(id,seconds,falls,assisted=false){const target=TRAIL_GOALS[id]||30;return {target,medals:1+Number(falls===0&&!assisted)+Number(seconds<=target&&!assisted)};}
function finishAdventure(profile,store,id,seconds,falls,assisted=false){const old=profile.trails[id]||{clears:0,medals:0,best:null};const award=trailAward(id,seconds,falls,assisted);const medals=Math.max(old.medals,award.medals);const first=old.clears===0;const xp=25+(first?75:0)+25*(medals-old.medals);const next={xp:profile.xp+xp,clears:profile.clears+1,trails:{...profile.trails,[id]:{clears:old.clears+1,medals,best:old.best===null?seconds:Math.min(old.best,seconds)}}};try{store.setItem(PROFILE_KEY,JSON.stringify(next));}catch{}return {profile:next,xp,medals:award.medals,target:award.target,first};}
// A compact identifier prevents replaying a run made with different movement tuning.
function replayKey(id,cfg){const text=JSON.stringify(Object.keys(cfg).filter(k=>!['cameraFollow','cameraLookAhead','shakeStrength'].includes(k)).sort().map(k=>[k,cfg[k]]));let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return 'animalia.ghost.v1.'+id+'.'+(h>>>0).toString(36);}
function replaySample(p,t){return [Math.round(t*1000)/1000,Math.round(p.x*10)/10,Math.round(p.y*10)/10,p.facing,Math.round(p.vx),Math.round(p.vy),Number(p.onGround),Number(p.rolling),Number(p.carrying),Math.round((p.rotation||0)*100)/100,Math.round((p.walk||0)*100)/100,Number(p.wallSliding),p.wallSide||0];}
function readReplay(store,key){try{const r=JSON.parse(store.getItem(key)||'null');if(r&&Number.isFinite(r.time)&&r.time>0&&Array.isArray(r.frames)&&r.frames.length>=2&&r.frames.length<=LIMIT&&r.frames.every((f,i)=>Array.isArray(f)&&f.length===13&&f.every(Number.isFinite)&&(i===0||f[0]>r.frames[i-1][0])))return r;}catch{}return null;}
function saveReplay(store,key,time,frames){if(frames.length<2||frames.length>LIMIT)return false;const old=readReplay(store,key);if(old&&old.time<=time)return false;try{store.setItem(key,JSON.stringify({time,frames}));return true;}catch{return false;}}
function sampleReplay(replay,t,scale=1){if(!replay||t>replay.time||t<0)return null;const frames=replay.frames;let low=0,high=frames.length-1;while(low+1<high){const mid=(low+high)>>1;if(frames[mid][0]<=t)low=mid;else high=mid;}const a=frames[low],b=frames[high],f=Math.max(0,Math.min(1,(t-a[0])/Math.max(.001,b[0]-a[0])));const near=f<.5?a:b;const lerp=i=>a[i]+(b[i]-a[i])*f;const teleported=Math.hypot(b[1]-a[1],b[2]-a[2])>150;return {x:teleported?near[1]:lerp(1),y:teleported?near[2]:lerp(2),facing:near[3],vx:lerp(4),vy:lerp(5),onGround:!!near[6],rolling:!!near[7],carrying:!!near[8],rotation:lerp(9),walk:lerp(10),wallSliding:!!near[11],wallSide:near[12],squash:0,scale};}
function createReplayCapture(p){return {frames:[replaySample(p,0)],next:SAMPLE_PERIOD};}
function captureReplay(c,p,t,force=false){if(c.frames.length>=LIMIT)return;const sample=replaySample(p,t);if((force||t+1e-7>=c.next)&&sample[0]>c.frames.at(-1)[0]){c.frames.push(sample);c.next=(Math.floor((t+1e-7)/SAMPLE_PERIOD)+1)*SAMPLE_PERIOD;}}

// ===== shaman.js =====

const TOOLS=[{id:'cheese',name:'Cheese',icon:'🧀',cost:24,w:130,h:28,life:6,description:'Solid ledge · lasts 6 seconds'},{id:'spring',name:'Spring',icon:'↟',cost:22,w:72,h:18,life:12,description:'Launches your hamster · lasts 12 seconds'},{id:'fan',name:'Fan',icon:'✺',cost:28,w:45,h:50,life:10,description:'Pushes sideways · faces your last direction'},{id:'ramp',name:'Ramp',icon:'◢',cost:32,w:160,h:78,life:8,description:'Walkable slope · lasts 8 seconds'}];
const createShaman=()=>({mana:100,selected:0,objects:[],nextId:1});
function previewObject(state,x,y,facing=1){const t=TOOLS[state.selected];return {...t,x:Math.round((x-t.w/2)/5)*5,y:Math.round((y-t.h/2)/5)*5,direction:facing,remaining:t.life,kind:t.id};}
function canPlace(s,o,level,player){if(s.mana<o.cost||o.x<0||o.x+o.w>level.width||o.y<25||o.y+o.h>level.height-20)return false;if(o.kind==='fan')return true; if(overlaps(o,bodyRect(player)))return false;return ![...level.platforms,...s.objects.filter(v=>v.kind!=='fan')].some(b=>overlaps(o,b));}
function placeObject(s,o,level,p){if(!canPlace(s,o,level,p))return false;s.mana-=o.cost;s.objects.push({...o,id:s.nextId++});return true;}
function updateShaman(s,c,dt){s.mana=Math.min(100,s.mana+c.manaRegen*dt);s.objects=s.objects.map(o=>({...o,remaining:o.remaining-dt})).filter(o=>o.remaining>0);}
function worldFor(level,s,c,stage){return {width:level.width,vines:stage?.vines||[],platforms:[...(stage?.platforms||level.platforms),...s.objects.filter(o=>o.kind!=='fan').map(o=>({...o,id:`magic-${o.id}`,bounce:c.springVelocity}))],fans:s.objects.filter(o=>o.kind==='fan').map(o=>({...o,area:{x:o.direction>0?o.x:o.x-230,y:o.y-70,w:275,h:130}}))};}

// ===== camera.js =====

function createCamera(){return {x:0,y:0,shake:0,scale:1,width:960,height:600,ox:0,oy:0};}
function resizeCamera(c,w,h,level,mode){c.fixed=level?.camera==='overview'&&mode!=='follow';if(c.fixed){const top=Math.min(178,h*.25),bottom=Math.min(w<=700?245:190,h*.46),usable=Math.max(40,h-top-bottom);c.scale=Math.min((w-16)/level.width,usable/level.height);c.width=w/c.scale;c.height=h/c.scale;c.x=(level.width-c.width)/2;c.y=-(top+(usable-level.height*c.scale)/2)/c.scale;c.shake=0;}else{c.scale=level?.camera==='overview'?Math.min(w/(w<h?270:470),h/280):Math.min(w/(w<h?520:850),h/510);c.width=w/c.scale;c.height=h/c.scale;}}
function updateCamera(c,p,level,cfg,dt){if(c.fixed){c.shake=0;return;}let tx=clamp(p.x-c.width*.43+p.vx*cfg.cameraLookAhead,0,Math.max(0,level.width-c.width));let ty=clamp(p.y-c.height*.70,0,Math.max(0,level.height-c.height));if(level.camera==='overview'&&c.width>level.width)tx=(level.width-c.width)/2;if(c.height>level.height)ty=(level.height-c.height)/2;const k=1-Math.exp(-cfg.cameraFollow*dt);c.x+=(tx-c.x)*k;c.y+=(ty-c.y)*k;c.shake*=Math.exp(-13*dt);}
function screenToWorld(c,x,y){return {x:x/c.scale+c.x,y:y/c.scale+c.y};}

// ===== emotes.js =====
// Ten distinct expressions in the order of the supplied artwork.
const EMOTES=[["happy","Happy"],["sad","Sad"],["laughing","Laughing"],["crying","Crying"],["wow","Wow"],["cheer","Cheer"],["sleeping","Sleeping"],["love","Love"],["angry","Angry"],["shock","Shock"]];
function emoteAsset(face){return globalThis.ANIMALIA_EMOTE_ASSETS?.[face]||'assets/emotes/'+face+'.png';}
// Preload once; rendering never allocates images or changes simulation state.
function loadEmoteImages(){const images={};for(const [face] of EMOTES){if(!images[face]){const image=new Image();image.src=emoteAsset(face);images[face]=image;}}return images;}
function emote(index){return {index,remaining:2.6};}
// Replace with a proper multilingual moderation service before multiplayer.
function filterChat(text){return Array.from(text.trim()).slice(0,80).join('').replace(/\b(fuck|shit|bitch|asshole)\b/gi,m=>'•'.repeat(m.length));}

// ===== chat.js =====
// A single chatOpen flag owns keyboard focus and gameplay input isolation.

function createChat({canOpen,onOpen,clearInput,onSend}){
  const form=document.getElementById('chatForm'), field=document.getElementById('chatInput');
  const log=document.getElementById('chatLog'), toggle=document.getElementById('chatToggle');
  let chatOpen=false, openingSlash=null;
  const focus=()=>field.focus({preventScroll:true});
  const limit=()=>{if(Array.from(field.value).length>80)field.value=Array.from(field.value).slice(0,80).join('');};
  function open(){if(chatOpen){focus();return;}if(!canOpen())return;chatOpen=true;clearInput();onOpen();form.hidden=false;field.value='';focus();}
  function close(){if(!chatOpen)return;chatOpen=false;form.hidden=true;field.value='';field.blur();clearInput();}
  function send(){if(!chatOpen)return;const message=filterChat(field.value);close();if(!message)return;onSend(message);const row=document.createElement('div'),name=document.createElement('b');name.textContent='You: ';row.append(name,document.createTextNode(message));log.append(row);while(log.children.length>5)log.firstChild.remove();}
  form.addEventListener('submit',e=>{e.preventDefault();send();});
  field.addEventListener('input',e=>{if(!e.isComposing)limit();});
  field.addEventListener('compositionend',limit);
  toggle.addEventListener('click',()=>chatOpen?close():open());
  // Capture runs before all gameplay key handlers. Stop propagation but retain
  // native text editing (letters, spaces, Shift, digits, paste, IME).
  window.addEventListener('keydown',e=>{
    if(!chatOpen){
      if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.isComposing||!canOpen()||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target?.isContentEditable)return;
      e.preventDefault();e.stopImmediatePropagation();openingSlash=e.code;open();return;
    }
    e.stopImmediatePropagation();
    if(e.code===openingSlash&&e.repeat){e.preventDefault();return;}
    if(['Tab','F1','F2'].includes(e.code)){e.preventDefault();return;}
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(!e.repeat)send();}
  },true);
  window.addEventListener('keyup',e=>{if(e.code===openingSlash)openingSlash=null;if(chatOpen)e.stopImmediatePropagation();},true);
  // Clicking the canvas or other game controls cannot steal focus or place magic.
  for(const type of ['pointerdown','mousedown','click'])document.addEventListener(type,e=>{
    if(!chatOpen||form.contains(e.target)||toggle.contains(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();focus();
  },true);
  window.addEventListener('blur',()=>{openingSlash=null;clearInput();});
  return {open,close,isOpen:()=>chatOpen};
}

// ===== bubbles.js =====
// One serializable slot: chat and emotes replace each other.
function makeBubble(text,emoji=false){return {text,emoji,age:0,duration:5};}
function makeEmoteBubble(face,name){return {...makeBubble(name,true),face};}
function tickBubble(b,dt){return b&&b.age+dt<b.duration?{...b,age:b.age+dt}:null;}
function wrapBubble(text,measure,maxWidth=216,maxLines=3){
  const words=String(text).trim().split(/\s+/u);const rows=[];let row='';
  for(const word of words){const joined=row?row+' '+word:word;if(measure(joined)<=maxWidth){row=joined;continue;}if(row){rows.push(row);row='';}for(const ch of Array.from(word)){if(row&&measure(row+ch)>maxWidth){rows.push(row);row='';}row+=ch;}}
  if(row)rows.push(row);if(rows.length>maxLines){rows.length=maxLines;let last=rows[maxLines-1];while(last&&measure(last+'…')>maxWidth)last=Array.from(last).slice(0,-1).join('');rows[maxLines-1]=last+'…';}return rows.length?rows:[''];
}
// Called while the same world-to-canvas transform used by the hamster is active.
// Project the interpolated head anchor, then draw at stable CSS-pixel text size.
function drawWorldSpeech(ctx,worldX,worldY,b,w,h,dpr,emoteImages){
  if(!b)return;const m=ctx.getTransform();const x=(m.a*worldX+m.c*worldY+m.e)/dpr,y=(m.b*worldX+m.d*worldY+m.f)/dpr;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);drawSpeech(ctx,x,y,b,w,h,emoteImages);ctx.restore();
}
function drawSpeech(ctx,x,y,b,w,h,emoteImages){
  if(!b||w<48||h<48)return;ctx.save();ctx.font=b.emoji?'26px sans-serif':'bold 14px system-ui,sans-serif';
  const picture=b.face&&emoteImages?.[b.face];const hasArt=picture&&picture.complete&&picture.naturalWidth>0;
  // Image emotes use the existing world anchor, pop, fade, and edge clamping.
  // If an asset fails to load, the emote name remains readable instead.
  if(b.face&&!hasArt)ctx.font='bold 14px system-ui,sans-serif';
  const line=b.emoji&&!b.face?32:19,rows=hasArt?[]:wrapBubble(b.text,s=>ctx.measureText(s).width,Math.min(216,w-42),3),width=hasArt?78:Math.max(40,...rows.map(s=>ctx.measureText(s).width+22)),height=hasArt?76:rows.length*line+14;
  const pop=1-.22*Math.exp(-b.age*12)*Math.cos(b.age*24),scale=Math.min(pop,(w-12)/width,(h-16)/(height+9));
  const ax=x,ay=y+8,half=width*scale/2;x=Math.max(half+6,Math.min(w-half-6,x));
  // Prefer above the head; if there is no room, point upward from a bubble below it.
  const below=y-height*scale<6&&ay+height*scale+14<h;
  const top=below?Math.max(6,ay+10):Math.max(6,Math.min(h-height*scale-13,y-height*scale));
  ctx.globalAlpha=Math.max(0,Math.min(1,.2+b.age*12,(b.duration-b.age)/.6));
  ctx.translate(x,top);ctx.scale(scale,scale);ctx.shadowColor='#382b4955';ctx.shadowBlur=7;ctx.shadowOffsetY=2;ctx.fillStyle='#fffdf9';ctx.beginPath();ctx.roundRect(-width/2,0,width,height,12);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const tx=Math.max(-width/2+11,Math.min(width/2-11,(ax-x)/scale)),edge=below?0:height,tipY=below?-8:height+8;
  ctx.beginPath();ctx.moveTo(tx-6,edge+(below?1:-1));ctx.lineTo(Math.max((6-x)/scale,Math.min((w-6-x)/scale,(ax-x)/scale)),Math.max((3-top)/scale,Math.min((h-3-top)/scale,tipY)));ctx.lineTo(tx+6,edge+(below?1:-1));ctx.fill();
  if(hasArt){ctx.drawImage(picture,-33,5,66,66);ctx.restore();return;}
  ctx.fillStyle='#513947';ctx.textAlign='center';ctx.textBaseline='middle';rows.forEach((r,i)=>ctx.fillText(r,0,7+(i+.5)*line));ctx.restore();
}

// ===== background.js =====
// Cached parallax illustration layers. Only small animated accents are drawn per frame.
const BG_TAU=Math.PI*2;
const bgMod=(x,n)=>((x%n)+n)%n;
function bgOval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,BG_TAU);c.fill();}
function bgPath(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.stroke();}
function bgGlow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffd58100');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function bgCanvas(w,h){const a=document.createElement('canvas');a.width=w;a.height=h;return a;}
function bgRandom(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function bgHouse(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#926047';c.fillRect(-38,-46,76,49);c.strokeStyle='#5e3a52';c.lineWidth=3;c.strokeRect(-38,-46,76,49);c.beginPath();c.moveTo(-51,-44);c.quadraticCurveTo(-22,-56,0,-85);c.quadraticCurveTo(24,-53,51,-44);c.closePath();c.fillStyle='#78517e';c.fill();c.stroke();bgPath(c,[[-43,-46],[0,-79],[43,-46]],'#c687a6',3);for(const dx of [-20,20]){bgGlow(c,dx,-25,29,'#ffba6388');c.fillStyle='#ffda89';c.beginPath();c.roundRect(dx-9,-36,18,24,[8,8,2,2]);c.fill();bgPath(c,[[dx,-34],[dx,-13]],'#a76949',2);bgPath(c,[[dx-8,-25],[dx+8,-25]],'#a76949',2);}c.fillStyle='#755043';c.fillRect(-8,-11,16,14);bgPath(c,[[-46,4],[46,4]],'#543c4f',6);c.restore();}
function bgVillage(c,w,h){const base=h*.84,x=w*.51;c.save();c.translate(x,base);c.scale(h/720,h/720);
 // waterfall under a sprawling enchanted cherry tree
 c.fillStyle='#555b75';c.beginPath();c.moveTo(95,0);c.lineTo(120,-111);c.lineTo(230,-130);c.lineTo(280,0);c.closePath();c.fill();const waterfall=c.createLinearGradient(110,-120,250,0);waterfall.addColorStop(0,'#a6dfedaa');waterfall.addColorStop(1,'#d5e8ff22');c.fillStyle=waterfall;c.beginPath();c.moveTo(145,-115);c.lineTo(206,-119);c.lineTo(219,0);c.lineTo(123,0);c.closePath();c.fill();for(let i=0;i<9;i++)bgPath(c,[[145+i*7,-110],[137+i*8,-50],[132+i*10,-2]],'#d4efff44',2);
 const trunk=c.createLinearGradient(-100,0,90,0);trunk.addColorStop(0,'#674258');trunk.addColorStop(.48,'#9b6459');trunk.addColorStop(1,'#624052');c.fillStyle=trunk;c.beginPath();c.moveTo(-105,0);c.quadraticCurveTo(-34,-75,-45,-172);c.quadraticCurveTo(-70,-300,-25,-435);c.lineTo(40,-430);c.quadraticCurveTo(27,-260,48,-165);c.quadraticCurveTo(54,-65,109,0);c.closePath();c.fill();for(const [dx,dy] of [[-193,-310],[165,-315],[-135,-225],[140,-410]]){c.beginPath();c.moveTo(0,-130);c.quadraticCurveTo(dx*.25,dy+100,dx,dy);c.strokeStyle='#805266';c.lineWidth=30;c.lineCap='round';c.stroke();}
 const r=bgRandom(91);for(let i=0;i<125;i++){const a=r()*BG_TAU,rad=Math.sqrt(r()),xx=Math.cos(a)*rad*260,yy=-385+Math.sin(a)*rad*125;bgOval(c,xx,yy,24+r()*45,14+r()*26,['#a65a91','#c075a0','#dd8bab','#e9a1b2','#925584'][i%5]);}for(let i=0;i<28;i++){const yy=-20-i*12;bgGlow(c,Math.sin(i*.63)*28,yy,18,'#ffe29b88');bgOval(c,Math.sin(i*.63)*28,yy,2.4,2.4,'#fff3b2');}
 bgHouse(c,-92,-105,1.1);bgHouse(c,62,-205,.92);bgHouse(c,-115,-291,.85);bgHouse(c,155,-305,.7);bgHouse(c,20,-360,.68);for(const [a,b,y] of [[-120,55,-205],[58,155,-290],[-114,20,-350]]){c.beginPath();c.moveTo(a,y);c.quadraticCurveTo((a+b)/2,y+32,b,y);c.strokeStyle='#d3a078';c.lineWidth=4;c.stroke();for(let i=0;i<9;i++){const f=i/8,xx=a+(b-a)*f,yy=y+64*f*(1-f);bgPath(c,[[xx,yy-14],[xx,yy+4]],'#8c605c',2);}}for(const [xx,yy] of [[-174,-204],[106,-253],[195,-277],[-40,-270]]){bgPath(c,[[xx,yy-20],[xx,yy-6]],'#75505e',2);bgGlow(c,xx,yy,25,'#ffd38999');bgOval(c,xx,yy,7,10,'#ffe09a');}c.restore();}
// Source-art cloud fragments scroll on their own, fully off-screen at the wrap.
const SKY_CLOUDS=[[330,157,.105,.04,6],[196,49,.145,.25,3],[324,100,.42,.08,5],[259,64,.325,.54,4],[260,72,.60,.46,3],[362,146,.12,.80,5],[235,61,.46,.67,4],[175,61,.69,.18,2.5],[200,45,.76,.83,2.7],[360,231,.81,-.09,4],[352,241,.80,.88,4.5]];
function cloudDriftX(t,w,cloudWidth,phase,speed){const pad=12;return bgMod(phase*w+cloudWidth+pad+t*speed,w+cloudWidth+2*pad)-cloudWidth-pad;}
function skyImage(globalName,path){const img=new Image();img.src=globalThis[globalName]||path;return img;}
function drawSunsetArt(c,w,h,t,quality,sky,clouds){
 const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#6c45bc');g.addColorStop(.54,'#c96dcf');g.addColorStop(.83,'#fa9eb6');g.addColorStop(1,'#ffdaa0');c.fillStyle=g;c.fillRect(0,0,w,h);
 if(sky.complete&&sky.naturalWidth)c.drawImage(sky,0,0,w,h);
 // The sun never uses camera coordinates or time; resize keeps its relative anchor.
 const sunX=w*.844,sunY=h*.443,r=Math.min(w*.13,h*.083);
 bgGlow(c,sunX,sunY,r*2.2,'#ff9a9fc9');bgGlow(c,sunX,sunY,r*1.55,'#ffce91ab');bgOval(c,sunX,sunY,r,r,'#ffe49a');
 if(clouds.complete&&clouds.naturalWidth){const unit=Math.max(.48,Math.min(w/1672,h/941)*1.12);for(let i=0;i<SKY_CLOUDS.length;i++){if(quality==='low'&&[1,4,7,8].includes(i))continue;const [dw,dh,y,phase,speed]=SKY_CLOUDS[i],source=i===0?2:i===5?3:i, [sw,sh]=SKY_CLOUDS[source],cw=dw*unit,ch=dh*unit,x=cloudDriftX(t,w,cw,phase,speed*Math.max(.65,w/1200));c.drawImage(clouds,(source%4)*384,Math.floor(source/4)*256,sw,sh,x,y*h,cw,ch);}}
}
function createBackground(){let cache=null;const sky=skyImage("ANIMALIA_SKY","./assets/sunset-sky.png"),clouds=skyImage("ANIMALIA_CLOUDS","./assets/sunset-clouds.png");function build(w,h,quality){const k=quality==='high'?1:quality==='medium'?.75:.55;const W=Math.ceil(Math.max(900,w)*k),H=Math.ceil(Math.max(500,h)*k), layers=[];const r=bgRandom(203);for(let i=0;i<4;i++){const a=bgCanvas(W,H),c=a.getContext('2d');if(i<2){for(let j=0;j<3;j++){c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=4){const v=x/W*BG_TAU;c.lineTo(x,H*(.50+i*.15+j*.06)+Math.sin(v*(j+1)+i*2)*H*.085+Math.cos(v*5)*H*.025);}c.lineTo(W,H);c.closePath();c.fillStyle=i===0?['#b78ba3','#a27f98','#8c7592'][j]:['#8d8194','#788d88','#6a827c'][j];c.fill();}}else if(i===2){bgVillage(c,W,H);for(let j=0;j<8;j++){const x=j*W/7,y=H*.90,ht=H*(.16+r()*.18);bgPath(c,[[x,y],[x+8,y-ht]],'#65566d',9);for(let z=0;z<4;z++)bgOval(c,x+(r()-.5)*55,y-ht+z*10,24+r()*26,20+r()*20,'#75627c88');}}else{for(let j=0;j<Math.floor(W/9);j++){const x=r()*W,y=H*(.94+r()*.08);bgPath(c,[[x,y],[x-5,y-13-r()*10]],'#627f6799',2);if(j%3===0){for(let a=0;a<5;a++)bgOval(c,x+Math.cos(a*BG_TAU/5)*4,y-15+Math.sin(a*BG_TAU/5)*4,3,3,j%2?'#f3a7b9':'#ffe2a2');bgOval(c,x,y-15,2,2,'#ffd57d');}}}layers.push(a);}return {w,h,quality,layers};}
 return function draw(c,w,h,cam,t,level,p,quality){if(!cache||cache.w!==w||cache.h!==h||cache.quality!==quality)cache=build(w,h,quality);const altitude=level.practice||level.camera==='overview'?0:Math.max(0,Math.min(1,(level.spawn.y-p.y)/Math.max(1,level.spawn.y-level.acorn.y)));const dusk=altitude*.9;drawSunsetArt(c,w,h,t,quality,sky,clouds);
 // Preserve the altitude atmosphere without moving or replacing the sun.
 c.globalAlpha=dusk*.48;const night=c.createLinearGradient(0,0,0,h);night.addColorStop(0,'#20284e');night.addColorStop(.65,'#775b9a');night.addColorStop(1,'#df9eb1');c.fillStyle=night;c.fillRect(0,0,w,h);c.globalAlpha=altitude;for(let i=0;i<60;i++){const x=bgMod(i*137.17,w),y=h*.05+bgMod(i*57.1,h*.42);bgOval(c,x,y,1+(i%3)*.45,1+(i%3)*.45,'#fff6d9');}c.globalAlpha=1;
 for(let i=0;i<4;i++){const a=cache.layers[i],offset=bgMod(cam.x*[.10,.19,.27,.55][i],w);c.globalAlpha=level.camera==='overview'?[.76,.78,.38,.85][i]:i===3?.85:1;c.drawImage(a,-offset,0,w,h);c.drawImage(a,w-offset,0,w,h);}c.globalAlpha=1;c.fillStyle=`rgba(48,38,82,${dusk*.26})`;c.fillRect(0,0,w,h);
 const effects=quality==='low'?9:quality==='medium'?24:48;for(let i=0;i<effects;i++){const x=bgMod(i*167.7+Math.sin(t*.7+i)*24-cam.x*.33,w),y=bgMod(i*91.2+(i%8!==0&&i%3===0?1:-1)*t*(8+i%5),h);if(i%8===0){bgGlow(c,x,y,quality==='low'?13:30,'#ffd47f88');c.fillStyle='#f9b56e';c.beginPath();c.roundRect(x-9,y-11,18,23,5);c.fill();bgOval(c,x,y+2,4,3,'#fff0ae');for(let k=0;k<3;k++)bgOval(c,x-4+k*4,y-3,1.5,2,'#fff0ae');}else if(i%3===0){c.save();c.translate(x,y);c.rotate(t+i);bgOval(c,0,0,3,6,'#f5a9c0');c.restore();}else if(i%7===0){const flap=2+Math.abs(Math.sin(t*9+i))*5;bgOval(c,x-flap,y,flap,3,'#ffdb9b');bgOval(c,x+flap,y,flap,3,'#ffdb9b');}else{c.globalAlpha=.35+.55*(.5+.5*Math.sin(t*2+i));bgOval(c,x,y,1.8,1.8,'#fff5b4');c.globalAlpha=1;}}
 if(quality!=='low')for(let i=0;i<18;i++){const x=bgMod(i*71-cam.x*.6,w),y=h-5,dx=Math.sin(t*1.6+i)*5;bgPath(c,[[x,y],[x+dx,y-16]],'#76976c',2);bgOval(c,x+dx,y-17,4,3,i%2?'#f5a8bc':'#ffe4a4');}
 };}

// ===== audio.js =====
function createAudio(){let ctx=null,muted=false;function unlock(){try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});}catch{}}function tone(f,end,dur,when=0,volume=.06,type='sine'){if(muted||!ctx||ctx.state!=='running')return;const t=ctx.currentTime+when,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(end,t+dur);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+dur+.02);}
return {unlock,toggle(){muted=!muted;return muted;},play(type){if(type==='wallJump')tone(460,820,.13,0,.05,'triangle');if(type==='jump')tone(330,620,.15);if(type==='land')tone(120,60,.11,0,.035,'triangle');if(type==='pickup'){tone(500,740,.14);tone(740,1050,.18,.1);}if(type==='win') [523,659,784,1047].forEach((n,i)=>tone(n,n*1.02,.28,i*.105,.07,'triangle'));if(type==='emote')tone(620,400,.12);if(type==='spring')tone(180,950,.27);if(type==='place')tone(280,580,.17);if(type==='respawn')tone(380,130,.24);}};}

// ===== particles.js =====
// Cosmetic only: deliberately outside deterministic gameplay state.
function burst(list,type,x,y,count=10){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=type==='confetti'?80+Math.random()*260:20+Math.random()*100;const life=type==='confetti'?1.5+Math.random()*2:.35+Math.random()*.45;list.push({type,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(type==='confetti'?150:25),life,max:life,r:Math.random()*5+2,color:['#ffd17e','#ff8e9f','#b7e4a6','#c0a7f3','#fff0c1'][i%5],rot:Math.random()*6.28});}}
function updateParticles(list,dt){for(const p of list){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.type==='confetti'?180:60)*dt;p.rot+=dt*4;}return list.filter(p=>p.life>0);}
function drawParticles(ctx,list){for(const p of list){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.min(1,p.life/p.max*2);ctx.fillStyle=p.type==='confetti'?p.color:'#ffebc5';if(p.type==='confetti')ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r);else{ctx.beginPath();ctx.arc(0,0,p.r*(1.3-p.life/p.max*.5),0,Math.PI*2);ctx.fill();}ctx.restore();}}

// ===== debug.js =====
function debugText(s,fps,steps){const p=s.player;return ['ANIMALIA / SIM 60 Hz',`render ${fps.toFixed(0)} fps · ${steps} steps`,`speed ${Math.hypot(p.vx,p.vy).toFixed(1)} px/s`,`vx ${p.vx.toFixed(1)}  vy ${p.vy.toFixed(1)}`,`onGround ${p.onGround}`,`coyote ${p.coyote.toFixed(3)} s`,`wall ${p.wallSide} · slide ${p.wallSliding}`,`wall grace ${p.wallGrace.toFixed(3)} · lock ${p.wallLock.toFixed(3)}`,`jump buffer ${p.jumpBuffer.toFixed(3)} s`,`rolling ${p.rolling}  carrying ${p.carrying}`,`x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}`,`surface ${p.groundId??"—"} · vine ${p.vineId??"—"}`,`checkpoint ${s.stage?.checkpoint?.id??"start"}`,`magic objects ${s.shaman.objects.length}`,`mode ${s.mode} · ${s.status}`].join('\n');}

// ===== tutorial.js =====




// Fixed-step tutorial progress, independent of the renderer and DOM.
const WALK_SECONDS=2;
const REVEAL_SECONDS=5.4;
const TERRAIN_TASKS=[{"id":"vine","label":"Vine","hint":"Jump to catch it. Stay attached, hold A/D to swing, then press W again to jump off."},{"id":"grass","label":"Grass","hint":"Walk on normal ground."},{"id":"ice","label":"Ice","hint":"Slippery! Watch your momentum."},{"id":"spring","label":"Trampoline","hint":"Bounce high on the purple pad."},{"id":"chocolate","label":"Chocolate","hint":"Sticky ground slows you down."},{"id":"wood","label":"Wood","hint":"Walk on solid wooden ground."}];
function createTutorial(level){return {phase:level?.farmLesson?'farm':level?.wallLesson?'wall-intro':level?.terrainLesson?'terrain-intro':'intro',wallJumps:0,demoTime:0,terrainDone:{},vineGrabbed:false,left:0,right:0,jumps:[false,false],airborneJump:false,revealTime:0,foodVisible:!!level?.wallLesson,holeVisible:!!level?.wallLesson};}
function advanceTutorial(t,level,prev,p,input,events,dt){
  if(t.phase!=='controls')return;
  const dx=p.x-prev.x;
  if(!input.roll&&prev.onGround&&p.onGround){
    if(input.left&&!input.right&&dx<-.01)t.left=Math.min(WALK_SECONDS,t.left+dt);
    if(input.right&&!input.left&&dx>.01)t.right=Math.min(WALK_SECONDS,t.right+dt);
  }
  if(events.some(e=>e.type==='jump'||e.type==='wallJump'))t.airborneJump=true;
  if(p.onGround&&t.airborneJump){
    for(const [i,m] of level.jumpTargets.entries())if(p.groundId===m.platform&&Math.abs(p.x-m.x)<=m.radius)t.jumps[i]=true;
    t.airborneJump=false;
  }
  if(t.left>=WALK_SECONDS-1e-8&&t.right>=WALK_SECONDS-1e-8&&t.jumps.every(Boolean)){t.left=t.right=WALK_SECONDS;t.phase='reveal';}
}
function advanceReveal(t,dt){
  if(t.phase!=='reveal')return;
  t.revealTime=Math.min(REVEAL_SECONDS,t.revealTime+dt);
  t.foodVisible=t.revealTime>=.7;
  t.holeVisible=t.revealTime>=2.6;
  if(t.revealTime>=REVEAL_SECONDS-1e-8){t.phase='food';t.foodVisible=t.holeVisible=true;}
}
function revealPose(t,start,player,level,w,h,baseScale){
  const focus=(x,y,scale)=>({scale,x:x-w/(2*scale),y:y-h*.55/scale});
  const endW=w/baseScale,endH=h/baseScale;
  const end={scale:baseScale,x:Math.max(0,Math.min(Math.max(0,level.width-endW),player.x-endW*.43)),y:endH>level.height?(level.height-endH)/2:Math.max(0,Math.min(level.height-endH,player.y-endH*.70))};
  const food=focus(level.acorn.x,level.acorn.y,baseScale*1.26),home=focus(level.hole.x,level.hole.y+20,baseScale*1.26);
  const keys=[[0,start],[.7,food],[1.65,food],[2.6,home],[3.55,home],[REVEAL_SECONDS,end]];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,A]=keys[i-1],[b,B]=keys[i];let f=Math.max(0,Math.min(1,(t-a)/(b-a)));f=f*f*(3-2*f);return {scale:A.scale+(B.scale-A.scale)*f,x:A.x+(B.x-A.x)*f,y:A.y+(B.y-A.y)*f};}
  return end;
}

function advanceTerrain(t,prev,p,input,events){
 if(t.phase!=='terrain')return;
 if(p.vineId!=null)t.vineGrabbed=true;
 if(t.vineGrabbed&&prev.vineId!=null&&p.vineId==null&&events.some(e=>e.type==='jump'))t.terrainDone.vine=true;
 if(p.onGround&&['grass','ice','chocolate','wood'].includes(p.groundId)&&Math.abs(p.x-prev.x)>.05&&(input.left||input.right))t.terrainDone[p.groundId]=true;
 if(p.groundId==='spring'&&events.some(e=>e.type==='spring'))t.terrainDone.spring=true;
 if(TERRAIN_TASKS.every(q=>t.terrainDone[q.id]))t.phase='terrain-complete';
}

// Generate a real physics replay of the lesson, independent of the player.
// The ghost never collides with the live player or takes their acorn.
function buildWallDemo(level,cfg){
 const world={width:level.width,platforms:level.platforms,fans:[],vines:[]};
 let p=spawnPlayer(level.spawn),dir=1,jumps=0,got=false,done=false,frames=[],jumped=false;
 for(let i=0;i<900;i++){
  let keys=emptyInput(),label='D + W · Jump toward the wall';
  if(!got){
   if(p.y<level.acorn.y+130&&jumps>=2){
    const dx=level.acorn.x-p.x;dir=Math.abs(dx)>9?Math.sign(dx):0;
    keys.jump=true;label='Reach the golden acorn';
   }else if(!jumped&&p.onGround){keys.jump=keys.jumpPressed=true;jumped=true;}
   else if(jumped&&p.wallSide&&!p.wallLock&&!p.onGround){dir=-p.wallSide;keys.jump=keys.jumpPressed=true;label=(dir>0?'D':'A')+' + W · Kick to the opposite wall';}
   else{keys.jump=true;label=(dir>0?'Hold D':'Hold A')+' · Reach the opposite wall';}
   // When close to summit, still kick if touching a wall below the acorn.
   if(!keys.jumpPressed&&p.wallSide&&!p.wallLock&&!p.onGround&&p.y>level.acorn.y+55){dir=-p.wallSide;keys.jump=keys.jumpPressed=true;label=(dir>0?'D':'A')+' + W · Wall jump';}
   keys.left=dir<0;keys.right=dir>0;
  }else{
   const dx=level.hole.x-p.x;const steer=dx-p.vx*.13;keys.left=steer<-8;keys.right=steer>8;label='Return down to the hamster hole';
  }
  const result=updatePlayer(p,keys,world,cfg,STEP);p=result.player;
  jumps+=result.events.filter(e=>e.type==='wallJump').length;
  if(!got&&jumps>=2&&acornReached(level,p)){got=true;p.carrying=true;label='Acorn collected!';}
  frames.push({p:{...p},label,keys:{left:keys.left,right:keys.right,jump:keys.jumpPressed},jumps});
  if(got&&homeReached(level,p)){done=true;break;}
 }
 return {frames,jumps,got,done};
}
function wallDemoFrame(demo,time){if(!demo?.frames.length)return null;const i=Math.min(demo.frames.length-1,Math.max(0,Math.floor(time*60*.75)));return demo.frames[i];}
function advanceWallLesson(t,level,p,events){
 if(t.phase!=='wall-quest')return null;
 t.wallJumps+=events.filter(e=>e.type==='wallJump').length;
 if(!p.carrying&&t.wallJumps>=2&&acornReached(level,p)){p.carrying=true;t.foodVisible=false;return 'pickup';}
 if(homeReached(level,p)){t.phase='wall-complete';return 'complete';}
 return null;
}

// ===== economy.js =====
// Persistent, local beginner economy. All transactions are single-item.
const CARROT_GROW_MS=300000;
const CARROT_SELL=10;
const STARTER_SEEDS=5;
const SHOP_ITEMS=[
 {id:'shirt',category:'cosmetics',slot:'outfit',name:'Meadow shirt',icon:'👕',price:20,color:'#6eaad6'},
 {id:'dress',category:'cosmetics',slot:'outfit',name:'Petal dress',icon:'👗',price:30,color:'#df8fae'},
 {id:'hat',category:'cosmetics',slot:'hat',name:'Straw hat',icon:'👒',price:25,color:'#f0c477'},
 {id:'cream',category:'fur',slot:'fur',name:'Cream fur',icon:'●',price:35,color:'#f6e7c6'},
 {id:'brown',category:'fur',slot:'fur',name:'Cocoa fur',icon:'●',price:35,color:'#946747'},
 {id:'gold',category:'fur',slot:'fur',name:'Golden fur',icon:'●',price:45,color:'#e8b85d'}];
function newFarm(){return {coins:0,seeds:0,starterBought:0,carrots:0,sold:0,planted:0,harvested:0,shopSeen:false,plots:[null,null,null,null,null],owned:[],equipped:{},resources:{},collected:[]};}
function loadFarm(storage){try{const raw=JSON.parse(storage.getItem('animalia.farm.v1')||'null');if(raw&&Array.isArray(raw.plots)&&raw.plots.length===5)return {...newFarm(),...raw,plots:raw.plots.map(p=>p?{...p,starter:p.starter??(raw.sold<5)}:null)};}catch{}return newFarm();}
function saveFarm(storage,f){try{storage.setItem('animalia.farm.v1',JSON.stringify(f));}catch{}}
function farmStage(f){return !f.shopSeen?'shop-guide':f.starterBought<5?'buy':f.planted<5?'plant':f.harvested<5?'grow':f.sold<5?'sell':'done';}
const INVENTORY_CAPACITY=20, STACK_SIZE=99;
const RESOURCE_ITEMS=[{id:'wood',name:'Wood',category:'resources',price:2,x:170},{id:'stone',name:'Stone',category:'resources',price:3,x:540},{id:'leaf',name:'Meadow leaf',category:'resources',price:2,x:1280}];
function inventoryItems(f){const all=[{id:'seed',name:'Carrot seed',category:'seeds',quantity:f.seeds},{id:'carrot',name:'Carrot',category:'crops',quantity:f.carrots},...RESOURCE_ITEMS.map(i=>({...i,quantity:f.resources?.[i.id]||0})),...SHOP_ITEMS.filter(i=>f.owned.includes(i.id)).map(i=>({...i,quantity:1}))];return all.filter(i=>i.quantity>0);}
function inventoryStacks(f,filter='all',sort='category'){const rows=inventoryItems(f).filter(i=>filter==='all'||i.category===filter);rows.sort((a,b)=>sort==='quantity'?b.quantity-a.quantity||a.name.localeCompare(b.name):sort==='name'?a.name.localeCompare(b.name):a.category.localeCompare(b.category)||a.name.localeCompare(b.name));return rows.flatMap(i=>Array.from({length:Math.ceil(i.quantity/STACK_SIZE)},(_,n)=>({...i,quantity:Math.min(STACK_SIZE,i.quantity-n*STACK_SIZE),stack:n,key:i.id+':'+n})));}
function canStore(f,id){const rows=inventoryItems(f);const q=rows.find(i=>i.id===id)?.quantity||0;return q%STACK_SIZE!==0||inventoryStacks(f).length<INVENTORY_CAPACITY;}
function itemArt(id,color=''){const name=SHOP_ITEMS.find(i=>i.id===id&&i.category==='fur')?'fur':id;return '<svg class="animal-icon item-art" viewBox="0 0 72 72" aria-hidden="true" '+(color?'style="color:'+color+'"':'')+'><use href="#'+name+'"/></svg>';}
function canSkipCrop(f,i,now=Date.now()){const p=f.plots[i];return !!p&&p.starter===true&&f.sold<STARTER_SEEDS&&p.readyAt>now;}
function farmAction(f,action,arg,now=Date.now()){
 if(action==='skip'){if(!Number.isInteger(arg)||!canSkipCrop(f,arg,now))return false;f.plots[arg].readyAt=now;return true;}
 if(action==='equipSeed'){if(f.seeds<1)return false;f.equipped.seed='seed';return true;}
 if(action==='plantEquipped'){if(f.equipped.seed!=='seed'||f.plots[arg])return false;return farmAction(f,'plot',arg,now);}
 if(action==='open'){f.shopSeen=true;return true;}
 if(action==='collect'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||f.collected.includes(arg)||!canStore(f,arg))return false;f.resources[arg]=(f.resources[arg]||0)+1;f.collected.push(arg);return true;}
 if(action==='sellResource'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||!f.resources[arg])return false;f.resources[arg]--;f.coins+=item.price;return true;}
 if(action==='seed'){if(!f.shopSeen||!canStore(f,'seed'))return false;if(f.starterBought<5){f.starterBought++;f.seeds++;return true;}if(f.sold>=5&&f.coins>=3){f.coins-=3;f.seeds++;return true;}return false;}
 if(action==='plot'){if(!Number.isInteger(arg)||arg<0||arg>=5||f.starterBought<5)return false;const p=f.plots[arg];if(!p&&f.seeds>0){const starter=f.planted<STARTER_SEEDS;f.seeds--;f.planted++;f.plots[arg]={readyAt:now+CARROT_GROW_MS,starter};if(!f.seeds)delete f.equipped.seed;return true;}if(p&&now>=p.readyAt&&canStore(f,'carrot')){f.plots[arg]=null;f.carrots++;f.harvested++;return true;}return false;}
 if(action==='sell'){if(f.carrots<1)return false;f.carrots--;f.sold++;f.coins+=CARROT_SELL;return true;}
 if(action==='item'){const item=SHOP_ITEMS.find(i=>i.id===arg);if(!item)return false;if(!f.owned.includes(item.id)){if(f.coins<item.price||!canStore(f,item.id))return false;f.coins-=item.price;f.owned.push(item.id);}f.equipped[item.slot]=f.equipped[item.slot]===item.id?null:item.id;return true;}
 return false;
}
function farmRemaining(p,now=Date.now()){return p?Math.max(0,Math.ceil((p.readyAt-now)/1000)):0;}
function farmClock(n){return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function createFarmUI(actions){
 const el=id=>document.getElementById(id);let tab='character',filter='all',sort='category',selected='',lastKey='',targetPlot=null,returnToGarden=false;
 const shop=el('shopPanel'),garden=el('gardenPanel'),inventory=el('inventoryPanel'),shopButton=el('shopToggle');
 const panels=[shop,garden,inventory],isOpen=()=>panels.some(p=>!p.hidden);
 function sync(){el('game').classList.toggle('economy-open',isOpen());el('game').classList.toggle('inventory-open',!inventory.hidden);el('game').classList.toggle('shop-open',!shop.hidden);actions.block(isOpen());lastKey='';}
 function close(panel){if(!panel||panel===inventory){targetPlot=null;returnToGarden=false;}if(panel)panel.hidden=true;else panels.forEach(p=>p.hidden=true);sync();}
 function open(panel){actions.beforeOpen?.();if(panel===inventory){inventory.hidden=false;garden.hidden=true;if(innerWidth<1050)shop.hidden=true;}else if(panel===shop){shop.hidden=false;garden.hidden=true;if(innerWidth<1050)inventory.hidden=true;}else{panels.forEach(p=>p.hidden=p!==garden);}sync();}
 function chooseSoil(i,fromGarden=false){const f=actions.state();if(!actions.active()||f.starterBought<5||f.plots[i])return;targetPlot=i;returnToGarden=fromGarden;filter='seeds';selected='';shop.hidden=true;open(inventory);render(f);}
 function clickPlot(i,fromGarden=false){const f=actions.state();if(!f.plots[i]){chooseSoil(i,fromGarden);return;}if(farmRemaining(f.plots[i])>0){if(!fromGarden){open(garden);render(f);}return;}transact('plot',i);}
 function transact(action,arg){if(actions.change(action,arg)){lastKey='';render(actions.state());return true;}return false;}
 shopButton.onclick=()=>{if(!actions.active())return;if(!shop.hidden){close(shop);return;}transact('open');tab=farmStage(actions.state())==='buy'?'seeds':'character';open(shop);render(actions.state());};
 el('gardenToggle').onclick=()=>{if(!actions.active()||el('gardenToggle').disabled)return;if(!garden.hidden){close(garden);return;}open(garden);render(actions.state());};
 el('inventoryToggle').onclick=()=>{if(!actions.active()||el('inventoryToggle').disabled)return;if(!inventory.hidden){close(inventory);return;}open(inventory);render(actions.state());};
 el('closeShop').onclick=()=>close(shop);el('closeGarden').onclick=()=>close(garden);el('closeInventory').onclick=()=>close(inventory);
 el('shopTabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){tab=b.dataset.category;lastKey='';render(actions.state());}};
 el('shopItems').onclick=e=>{const b=e.target.closest('[data-buy]');if(b)transact(b.dataset.buy,b.dataset.item);};
 el('gardenPlots').onclick=e=>{const b=e.target.closest('[data-plot]');if(b)clickPlot(Number(b.dataset.plot),true);};
 el('sellCarrot').onclick=()=>transact('sell');
 el('gardenPlots').addEventListener('click',e=>{const b=e.target.closest('[data-skip]');if(b)transact('skip',Number(b.dataset.skip));});
 el('inventoryFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;selected='';lastKey='';render(actions.state());}};
 el('inventorySort').onchange=e=>{sort=e.target.value;lastKey='';render(actions.state());};
 el('inventorySlots').onclick=e=>{const b=e.target.closest('[data-slot]');if(b){selected=b.dataset.slot;lastKey='';render(actions.state());}};
 el('inventoryDetails').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='useSeed'){open(garden);render(actions.state());}else if(b.dataset.action==='plantEquipped'){const back=returnToGarden;if(targetPlot!==null&&transact('plantEquipped',targetPlot)){targetPlot=null;returnToGarden=false;close(inventory);if(back)open(garden);render(actions.state());}}else transact(b.dataset.action,b.dataset.item);};
 window.addEventListener('resize',()=>{if(innerWidth<1050&&!shop.hidden&&!inventory.hidden)close(inventory);});
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&isOpen()){e.preventDefault();e.stopImmediatePropagation();close();}},true);
 function render(f){
  const active=actions.active(),stage=farmStage(f),guide=active&&stage==='shop-guide';
  el('game').classList.toggle('farm-hud',active);
  el('economyBar').hidden=!active;el('shopGuide').hidden=!guide;shopButton.classList.toggle('guided',guide);el('coinBalance').textContent=f.coins;el('shopBalance').textContent=f.coins;el('gardenToggle').disabled=stage==='shop-guide'||stage==='buy';el('inventoryToggle').disabled=guide;
  if(!active){if(isOpen())close();return;}
  // Only rebuild interactive cards when their data changes. Crop timers update separately.
  if(!garden.hidden)for(const b of el('gardenPlots').querySelectorAll('[data-plot]')){const p=f.plots[Number(b.dataset.plot)],n=farmRemaining(p);if(p&&n){const clock=farmClock(n),label=b.querySelector('small');if(label.textContent!==clock)label.textContent=clock;}else if(p&&n===0&&b.dataset.growing==='true'){lastKey='';}}
  const key=JSON.stringify([f,tab,filter,sort,selected,targetPlot,...panels.map(p=>p.hidden)]);if(lastKey===key)return;lastKey=key;
  const coin='<i class="paw-coin"></i>';
  if(!shop.hidden){
    for(const b of el('shopTabs').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.category===tab);
    const target=el('shopItems');
    if(tab==='character')target.innerHTML='<div class="shop-empty"><div class="shop-hero">'+itemArt('paw')+'</div><h3>Animal characters</h3><p>New friends are coming to Animalia.</p><span class="coming-soon">Coming soon!</span></div>';
    else if(tab==='seeds'){const left=5-f.starterBought,starter=left>0,allowed=starter||f.sold>=5;target.innerHTML='<article class="shop-item seed-card"><div class="shop-item-icon">'+itemArt('seed')+'</div><div><small class="item-rarity">BEGINNER · FARMING</small><h3>Carrot seed</h3><p>5 minute growth · Sell for '+CARROT_SELL+' coins</p><small>'+(starter?'Free starter stock: '+left+'/5':'Starter seeds claimed')+'</small></div><button data-buy="seed" '+(!allowed||!canStore(f,'seed')||(!starter&&f.coins<3)?'disabled':'')+'>Buy 1 · '+coin+(starter?'0':'3')+'</button></article><p class="shop-note">'+(starter?'Purchase your five free seeds one at a time.':'Open Garden to plant your seeds.')+'</p>';}
    else target.innerHTML='<div class="market-grid">'+SHOP_ITEMS.filter(i=>i.category===tab).map(i=>{const owned=f.owned.includes(i.id),eq=f.equipped[i.slot]===i.id;return '<article class="market-card"><div class="shop-item-icon">'+itemArt(i.id,i.color)+'</div><small class="item-rarity">'+(eq?'EQUIPPED':owned?'OWNED':'WOODLAND COLLECTION')+'</small><h3>'+i.name+'</h3><button data-buy="item" data-item="'+i.id+'" '+(!owned&&(f.coins<i.price||!canStore(f,i.id))?'disabled':'')+'>'+(eq?'Remove':owned?'Equip':'Buy · '+coin+i.price)+'</button></article>';}).join('')+'</div>';
  }
  if(!garden.hidden){
    el('gardenInventory').textContent=f.seeds+' seeds · '+f.carrots+' harvested carrots';
    el('gardenPlots').innerHTML=f.plots.map((p,i)=>{const n=farmRemaining(p);return '<div class="plot-cell"><button class="garden-plot" data-plot="'+i+'" data-growing="'+!!(p&&n)+'" '+(!p&&f.starterBought<5||p&&(n>0||!canStore(f,'carrot'))?'disabled':'')+'>'+itemArt(p?(n?'garden':'carrot'):'garden')+'<b>Plot '+(i+1)+'</b><small>'+(p?(n?farmClock(n):'Harvest'):'Choose seed')+'</small></button>'+(canSkipCrop(f,i)?'<button class="free-skip" data-skip="'+i+'">✦ Free skip</button>':'')+'</div>';}).join('');
    el('sellCarrot').disabled=!f.carrots;el('sellCarrot').textContent='Sell 1 carrot · +'+CARROT_SELL+' coins';
  }
  if(!inventory.hidden){
    const stacks=inventoryStacks(f,filter,sort),used=inventoryStacks(f).length;
    for(const b of el('inventoryFilters').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.filter===filter);
    el('inventoryCount').textContent=used+' / '+INVENTORY_CAPACITY+' slots';el('capacityFill').style.width=Math.min(100,used/INVENTORY_CAPACITY*100)+'%';
    el('inventorySlots').innerHTML=Array.from({length:Math.max(INVENTORY_CAPACITY,stacks.length)},(_,i)=>{const item=stacks[i];return item?'<button class="inventory-slot '+(item.key===selected?'selected':'')+'" data-slot="'+item.key+'" title="'+item.name+'">'+itemArt(item.id,item.color)+'<b>×'+item.quantity+'</b></button>':'<div class="inventory-slot empty" aria-hidden="true">+</div>';}).join('');
    const item=stacks.find(i=>i.key===selected);const details=el('inventoryDetails');el('seedPickerHint').hidden=targetPlot===null;el('seedPickerHint').textContent=targetPlot===null?'':'Planting in Plot '+(targetPlot+1)+' · Select a carrot seed, then Equip.';
    if(!item){details.innerHTML='<small>Select an item to use, equip or sell.</small>';}else{let action='',label='';if(item.id==='seed'){action=f.equipped.seed==='seed'?(targetPlot!==null?'plantEquipped':'useSeed'):'equipSeed';label=action==='equipSeed'?'Equip':action==='plantEquipped'?'Plant 1 seed':'Choose soil';}else if(item.id==='carrot'){action='sell';label='Sell 1 · +10';}else if(item.category==='resources'){action='sellResource';label='Sell 1 · +'+item.price;}else{action='item';label=f.equipped[item.slot]===item.id?'Remove':'Equip';}details.innerHTML='<div><strong>'+item.name+'</strong><small>Stack: '+item.quantity+'</small></div><button data-action="'+action+'" data-item="'+item.id+'">'+label+'</button>';}
  }
 }
 return {render,close,isOpen,clickPlot,openGarden:()=>{open(garden);render(actions.state());}};
}

// ===== ui.js =====








function createUI(actions){const $=id=>document.getElementById(id);let toastTimer=0;const bind=(id,fn)=>$(id).addEventListener('click',e=>{fn(e);if(e.currentTarget instanceof HTMLButtonElement)e.currentTarget.blur();});
  const showToast=text=>{$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1800);};
  const wheel=()=>{$('emoteWheel').hidden=!$('emoteWheel').hidden;$('emoteToggle').setAttribute('aria-expanded',String(!$('emoteWheel').hidden));};const tune=()=>{$('tuning').hidden=!$('tuning').hidden;actions.clearInput();};const debug=()=>{$('debug').hidden=!$('debug').hidden;};
  TOOLS.forEach((t,i)=>{const b=document.createElement('button');b.innerHTML=`<span>${t.icon}</span>${i+1} · ${t.name}`;b.title=`${t.cost} mana — ${t.description}`;b.onclick=()=>{actions.select(i);b.blur();};$('toolButtons').append(b);});
  EMOTES.forEach(([face,name],i)=>{const b=document.createElement('button'),img=document.createElement('img'),label=document.createElement('small'),key=document.createElement('span');const shortcut=String((i+1)%10);b.type='button';b.className='hamster-emote';b.title=name+' ('+shortcut+' in Hamster mode)';b.setAttribute('aria-label',name+' emote');img.src=emoteAsset(face);img.alt='';img.draggable=false;label.textContent=name;key.className='emote-key';key.textContent=shortcut;b.append(key,img,label);b.onclick=()=>{actions.emote(i);b.blur();};$('emoteButtons').append(b);});
  const emoteToggleIcon=document.createElement('img');emoteToggleIcon.src=emoteAsset('happy');emoteToggleIcon.alt='';emoteToggleIcon.draggable=false;$('emoteToggle').replaceChildren(emoteToggleIcon);
  function buildSliders(){ $('sliders').replaceChildren();for(const [key,[min,max,step]] of Object.entries(CONFIG_RANGES)){const row=document.createElement('label');row.className='slider-row';const name=document.createElement('span');name.textContent=key;const out=document.createElement('output');out.textContent=config[key];const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=config[key];input.setAttribute('aria-label',key);input.oninput=()=>{config[key]=Number(input.value);if(Object.hasOwn(SNAPPY_MOVEMENT,key))$('movementPreset').value='custom';out.textContent=input.value;actions.configChange(key);};row.append(name,out,input);$('sliders').append(row);}}
  buildSliders();$('movementPreset').onchange=()=>{const name=$('movementPreset').value;if(applyMovementPreset(config,name)){buildSliders();actions.clearInput();showToast(name==='snappy'?'Snappy movement enabled':'Classic movement restored');}};bind('tutorialNext',actions.tutorialNext);bind('closeTuning',tune);bind('tuneToggle',tune);bind('debugToggle',debug);bind('emoteToggle',wheel);bind('modeToggle',actions.mode);bind('pause',actions.pause);bind('modalPrimary',actions.primary);bind('restart',actions.restart);bind('mute',()=>{$('mute').textContent=actions.mute()?'×♪':'♪';$('mute').setAttribute('aria-pressed',$('mute').textContent==='×♪');});bind('resetConfig',()=>{Object.assign(config,DEFAULT_CONFIG);$('movementPreset').value='classic';buildSliders();actions.configChange('roundSeconds');showToast('Default tuning restored');});
  bind('copyConfig',async()=>{const content='const DEFAULT_CONFIG = Object.freeze('+JSON.stringify(config,null,2)+');';try{await navigator.clipboard.writeText(content);showToast('Config copied!');}catch{const t=document.createElement('textarea');t.value=content;document.body.append(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();if(ok)showToast('Config copied!');else{const manual=window.prompt('Copy the config below:',content);void manual;}}});
  const chat=createChat({canOpen:()=> actions.canChat()&&$('overlay').hidden&&$('levelMenu').hidden&&$('settingsMenu').hidden,onOpen:()=>{},clearInput:actions.clearInput,onSend:actions.chat});
  const closeChat=chat.close;
  const menus=['levelMenu','settingsMenu'];
  function closeMenus(){for(const id of menus)$(id).hidden=true;actions.blockInput(false);}
  function toggleMenu(id){if(chat.isOpen())closeChat();const open=$(id).hidden;closeMenus();$(id).hidden=!open;actions.blockInput(open);if(open&&id==='levelMenu')refreshLevels();}
  function refreshLevels(){if(LEVELS.every(m=>m.practice)){$('trailbookSummary').textContent='Four meadow lessons · no time limit';$('trailbookProgress').parentElement.hidden=true;$('levelChoices').replaceChildren();LEVELS.forEach((m,i)=>{const b=document.createElement('button');b.className='trail-card';b.textContent=m.name+' · Easy · Free practice';b.onclick=()=>{closeMenus();actions.level(LEVEL_FILES[i]);};$('levelChoices').append(b);});return;}const p=actions.profile(),a=adventureSummary(p);$('trailbookSummary').textContent=`Explorer Lv. ${a.rank} · ${p.xp} XP · ${a.completed}/${LEVELS.length} cleared · ${a.medals}/${LEVELS.length*3} medals`;$('trailbookProgress').style.width=(a.progress*100)+'%';$('levelChoices').replaceChildren();LEVELS.forEach((m,i)=>{const b=document.createElement('button'),n=document.createElement('strong'),meta=document.createElement('small'),stars=document.createElement('span');const best=actions.best(m.id),trail=p.trails[m.id];b.className='trail-card';n.textContent=m.name+(m.id==='sunpetal-grove'?' · START HERE':'');meta.textContent=(m.difficulty||['Medium','Hard','Hard','Medium'][i])+' · '+(best===null?'No record':best.toFixed(2)+'s')+' · Speed target '+(TRAIL_GOALS[m.id]||30)+'s';stars.textContent='★'.repeat(trail?.medals||0)+'☆'.repeat(3-(trail?.medals||0));stars.className='trail-stars';b.append(n,meta,stars);b.onclick=()=>{closeMenus();actions.level(LEVEL_FILES[i]);};$('levelChoices').append(b);});}
  bind('levelToggle',()=>toggleMenu('levelMenu'));bind('modalLevels',()=>toggleMenu('levelMenu'));bind('nextTrail',actions.next);bind('settingsToggle',()=>toggleMenu('settingsMenu'));bind('closeLevels',closeMenus);bind('closeSettings',closeMenus);$('quality').value=actions.quality();$('quality').onchange=()=>actions.quality($('quality').value);$('cameraMode').value=actions.camera();$('cameraMode').onchange=()=>actions.camera($('cameraMode').value);$('showRoute').onchange=()=>actions.route($('showRoute').checked);$('ghostToggle').checked=actions.ghost();$('ghostToggle').onchange=()=>actions.ghost($('ghostToggle').checked);
  window.addEventListener('keydown',e=>{
    if(chat.isOpen()||document.getElementById('game').classList.contains('economy-open'))return; // panel/chat controls own keys
    if(menus.some(id=>!$(id).hidden)){if(e.code==='Escape'){e.preventDefault();closeMenus();}return;}
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement){if(e.code==='Escape'&&!$('tuning').hidden){e.preventDefault();tune();}return;}
    if(e.repeat)return;if(['Tab','F1','F2','Escape'].includes(e.code))e.preventDefault();if(e.code==='Tab')actions.mode();else if(e.code==='F1')tune();else if(e.code==='F2')debug();else if(e.code==='Escape'){if(!$('tuning').hidden)tune();else actions.pause();}else if(e.code==='KeyR')actions.restart();else if(/^Digit[0-9]$/.test(e.code)){const n=(Number(e.code.slice(-1))+9)%10;actions.number(n);}
  });
  let lastStatus='',lastProfile=null;return {showToast,closeChat,closeMenus,chatOpen:chat.isOpen,menuOpen:()=>menus.some(id=>!$(id).hidden),update(s){if(s.profile!==lastProfile){lastProfile=s.profile;const a=adventureSummary(s.profile);$('explorerRank').textContent=`EXPLORER LV. ${a.rank} · ${s.profile.xp} XP`;$('explorerXP').style.width=(a.progress*100)+'%';}
    $('game').classList.toggle('practice',!!s.practice);$('hamsterHint').textContent=s.practice?'A / D to move · W to jump':'Hold toward wall + Jump to climb';$('modalKicker').textContent=s.levelName;
    $('runInfo').textContent=`${s.falls} falls · ${s.flags} flags · ${s.assisted?'Assisted':s.ghostTime!==null&&actions.ghost()?'Ghost '+s.ghostTime.toFixed(1)+'s':'Target '+s.goalTarget+'s'}`;
    if(s.objective){$('goalArrow').style.transform=`rotate(${s.objective.angle}rad)`;$('goalDistance').textContent=s.objective.distance+'u';}
    $('levelName').textContent=s.levelName;$('levelDifficulty').hidden=!s.difficulty;$('levelDifficulty').textContent=s.difficulty?' · '+s.difficulty:'';$('bestTime').textContent=s.best===null?'Best —':'Best '+s.best.toFixed(2)+'s';const secs=Math.max(0,Math.ceil(s.time));$('timer').textContent=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`;$('timer').classList.toggle('danger',secs<=15);$('timeFill').style.width=`${Math.min(100,s.time/config.roundSeconds*100)}%`;const sh=s.mode==='shaman';$('mode').textContent=sh?'SHAMAN':'HAMSTER';$('modeDot').style.background=sh?'#b7c7ff':'#bce58c';$('manaArea').hidden=!sh;$('hamsterHint').hidden=sh;$('tools').hidden=!sh;$('manaFill').style.width=s.shaman.mana+'%';$('manaText').textContent=`${Math.floor(s.shaman.mana)} / 100`;$('toolDetail').textContent=`${TOOLS[s.shaman.selected].cost} mana · ${TOOLS[s.shaman.selected].description}`;[...$('toolButtons').children].forEach((b,i)=>b.classList.toggle('selected',i===s.shaman.selected));$('quest').textContent=s.player.carrying?'Bring the acorn home!':'Find the golden acorn';$('questSub').textContent=s.player.carrying?'Return to the wooden HOME sign.':'Follow the trail and reach the acorn.';$('questIcon').textContent=s.player.carrying?'🏡':'🌰';if(s.practice){
      const t=s.tutorial,phase=t.phase,dialog=$('tutorialDialog');$('timer').textContent='TUTORIAL';$('timer').classList.remove('danger');$('runInfo').textContent=phase==='complete'||phase==='free'?'Lesson complete!':phase==='food'?'02 · Bring it home':'01 · Learn to move';
      $('tutorialTasks').hidden=phase!=='controls';document.querySelector('.quest small').textContent=phase==='controls'||phase==='food'?'TASK':'TUTORIAL';$('questIcon').textContent=phase==='food'?(s.player.carrying?'🏡':'🌰'):phase==='complete'||phase==='free'?'★':'↑';
      $('quest').textContent=phase==='controls'?'CONTROL':phase==='food'?(s.player.carrying?'Bring the acorn home':'Collect the acorn') :phase==='reveal'?'A new adventure!':phase==='free'||phase==='complete'?'Tutorial complete!':'Your first adventure';
      $('questSub').textContent=phase==='controls'?'Complete all three tasks.':phase==='food'?(s.player.carrying?'Take the golden acorn to the hamster hole.':'Find the golden acorn, then bring it home.') :phase==='reveal'?'Watch the meadow come to life.':phase==='complete'||phase==='free'?'Great job, little explorer!':'Press Next to begin.';
      const time=n=>Math.min(2,n+1e-8).toFixed(1);const count=t.jumps.filter(Boolean).length;
      for(const [id,label,done] of [['taskLeft','A · Walk left  '+time(t.left)+' / 2s',t.left>=2-1e-8],['taskRight','D · Walk right  '+time(t.right)+' / 2s',t.right>=2-1e-8],['taskJump','W · Jump at the markers  '+count+' / 2',count===2]]){const el=$(id);el.textContent=(done?'✓  ':'○  ')+label;el.classList.toggle('done',done);}
      dialog.hidden=!(s.status==='playing'&&(phase==='intro'||phase==='complete')&&!menus.some(id=>!$(id).hidden));
      $('tutorialStep').textContent=phase==='complete'?'TUTORIAL 01 COMPLETE':'TUTORIAL 01';$('tutorialTitle').textContent=phase==='complete'?'You did it!':'Welcome to Animalia!';$('tutorialText').textContent=phase==='complete'?'You brought the golden acorn home! Next, discover vines and the different surfaces in the meadow.':'Learn to walk left and right, then jump at two glowing markers. Your first adventure awaits!';$('tutorialNext').textContent=phase==='complete'?'Next · Tutorial 02 →':'Next →';
      const terrain=s.levelId==='tutorial-02',terrainIntro=phase==='terrain-intro',terrainComplete=phase==='terrain-complete';$('terrainGuide').hidden=!(terrain&&terrainIntro);$('terrainTasks').hidden=!(terrain&&phase==='terrain');if(terrain){const count=TERRAIN_TASKS.filter(q=>t.terrainDone[q.id]).length;$('timer').textContent='MEADOW DISCOVERY';$('runInfo').textContent=count+' / 6 discovered';$('questIcon').textContent='✿';$('quest').textContent=terrainComplete||phase==='free'?'Meadow mastered!':'Discover the meadow';$('questSub').textContent=terrainIntro?'Press Next to explore.':terrainComplete||phase==='free'?'You tried every material!':'Try the vine and every surface.';document.querySelector('.quest small').textContent='TASK';$('hamsterHint').textContent=s.player.vineId!=null?(s.player.vineReleaseReady?'A/D swing · W jump off':'Attached! Release W first · A/D swing'):'W jump to grab · A/D swing';if(phase==='terrain'&&s.player.vineId!=null)$('questSub').textContent='Hold A or D to swing. Press W again to jump off.';for(const q of TERRAIN_TASKS){const el=$('terrain-task-'+q.id),done=!!t.terrainDone[q.id];el.textContent=(done?'✓ ':'○ ')+q.label;el.classList.toggle('done',done);}dialog.hidden=!(s.status==='playing'&&(terrainIntro||terrainComplete)&&!menus.some(id=>!$(id).hidden));$('tutorialStep').textContent=terrainComplete?'TUTORIAL 02 COMPLETE':'TUTORIAL 02 · DISCOVERY';$('tutorialTitle').textContent=terrainComplete?'Meadow mastered!':'New task: Explore the meadow';$('tutorialText').textContent=terrainComplete?'You discovered all six meadow features! Next, learn to wall jump and reach the acorn summit.':'Try each feature below to complete your next adventure.';$('tutorialNext').textContent=terrainComplete?'Next · Tutorial 03 →':'Next · Explore →';}
 $('wallTasks').hidden=!(s.levelId==='tutorial-03'&&phase==='wall-quest');$('ghostLesson').hidden=!(s.levelId==='tutorial-03'&&phase==='wall-demo'&&s.status==='playing');if(s.levelId==='tutorial-03'){const demo=wallDemoFrame(s.wallDemo,t.demoTime);const complete=phase==='wall-complete',ready=phase==='wall-ready',intro=phase==='wall-intro';$('timer').textContent='WALL JUMP';$('runInfo').textContent=complete||phase==='free'?'Lesson complete!':phase==='wall-demo'?'Watch the ghost':t.wallJumps+' wall jumps';$('questIcon').textContent=s.player.carrying?'🏡':'🌰';$('quest').textContent=complete||phase==='free'?'Wall jump mastered!':s.player.carrying?'Return the acorn home':'Reach the acorn summit';$('questSub').textContent=phase==='wall-demo'?'Watch the ghost guide first.':s.player.carrying?'Drop back down the gap to your starting hole.':'Jump toward a wall, press W again, then steer to the opposite wall.';$('hamsterHint').textContent='A/D toward wall · W to kick away';document.querySelector('.quest small').textContent='TASK';for(const [id,label,done] of [['wallKick','Perform wall jumps · '+Math.min(2,t.wallJumps)+'/2',t.wallJumps>=2],['wallFood','Collect the acorn',s.player.carrying||complete||phase==='free'],['wallHome','Bring it back home',complete||phase==='free']]){const e=$(id);e.textContent=(done?'✓ ':'○ ')+label;e.classList.toggle('done',done);}$('ghostInstruction').textContent=demo?.label||'Watch the ghost climb';$('ghostKeys').textContent=demo?[(demo.keys.left?'A':''),(demo.keys.right?'D':''),(demo.keys.jump?'W':'')].filter(Boolean).join(' + ')||'Release / land':'W';dialog.hidden=!(s.status==='playing'&&(intro||ready||complete)&&!menus.some(id=>!$(id).hidden));$('tutorialStep').textContent=complete?'TUTORIAL 03 COMPLETE':'TUTORIAL 03 · WALL JUMP';$('tutorialTitle').textContent=complete?'Wall jump mastered!':ready?'Your turn!':'Learn to wall jump';$('tutorialText').textContent=complete?'You climbed the walls and brought the acorn back home. Next, discover the shop and grow your first carrots!':ready?'Hold A or D toward a wall. Press W to kick off, then steer to the opposite wall. Collect the acorn at the top and return to your hole.':'Watch a ghost hamster demonstrate how to climb the two walls and return the golden acorn to its home.';$('tutorialNext').textContent=complete?'Next · Tutorial 04 →':ready?'Start challenge →':'Watch ghost →';}
 if(s.levelId==='tutorial-04'){const f=s.farm,stage=farmStage(f);dialog.hidden=true;$('timer').textContent='LITTLE FARMER';$('runInfo').textContent=f.sold+' / 5 starter carrots sold';$('questIcon').textContent='🥕';$('quest').textContent=({'shop-guide':'Open the SHOP',buy:'Buy your free carrot seeds',plant:'Plant your carrot seeds',grow:'Grow and harvest carrots',sell:'Sell your carrots',done:'Little farmer complete!'})[stage];$('questSub').textContent=({'shop-guide':'Follow the arrow to the Shop button.',buy:'Buy one at a time · '+f.starterBought+'/5',plant:'Click soil → select carrot seed → Equip → Plant · '+Math.min(f.planted,5)+'/5',grow:'Use Free skip on starter crops, or wait 5 minutes · '+Math.min(f.harvested,5)+'/5 harvested',sell:'Open Garden and sell one carrot at a time.',done:'Keep farming, or spend your coins in the shop.'})[stage];$('hamsterHint').textContent='Garden plots · click to plant or harvest';document.querySelector('.quest small').textContent='TASK';}
 let progress=null;if(phase==='controls')progress=[Math.min(2,t.left)+Math.min(2,t.right)+t.jumps.filter(Boolean).length,6,'Movement practice'];else if(phase==='terrain')progress=[Object.values(t.terrainDone).filter(Boolean).length,6,'Discoveries'];else if(phase==='wall-quest')progress=[Math.min(2,t.wallJumps)+(s.player.carrying?1:0),4,'Wall challenge'];else if(s.levelId==='tutorial-04'){const f=s.farm,stage=farmStage(f);progress=stage==='buy'?[f.starterBought,5,'Seeds purchased']:stage==='plant'?[f.planted,5,'Seeds planted']:stage==='grow'?[f.harvested,5,'Harvested']:[Math.min(f.sold,5),5,'Carrots sold'];} $('taskProgress').hidden=!progress;if(progress){$('taskProgressFill').style.width=Math.min(100,progress[0]/progress[1]*100)+'%';$('taskProgressText').textContent=Math.floor(progress[0])+' / '+progress[1]+' '+progress[2];}
 $('revealCaption').hidden=phase!=='reveal'||s.status!=='playing';$('revealCaption').textContent=t.revealTime<.7?'Great work!':t.revealTime<1.65?'A golden acorn appeared!':t.revealTime<2.6?'Where will you take it?':t.revealTime<3.55?'Your hamster hole!':'Collect the acorn and bring it home.';
    }if(s.status!==lastStatus){lastStatus=s.status;$('nextTrail').hidden=s.status!=='won';$('roundRecap').hidden=s.status!=='won';if(s.status==='won'&&s.award){$('awardStars').textContent='★'.repeat(s.award.medals)+'☆'.repeat(3-s.award.medals);$('awardStats').textContent=`+${s.award.xp} XP · ${s.falls} falls · ${s.finish.toFixed(2)}s`;$('awardHint').textContent=s.assisted?'Clear earned · use no magic or mid-run tuning for bonus medals':`Speed medal ≤ ${s.award.target}s · Clean medal: zero falls`;}$('overlay').hidden=s.status==='playing';const data={paused:['☾','Paused','The forest can wait.','Resume'],won:['🏆','You Win!',s.newRecord?'New record! '+s.finish.toFixed(2)+' seconds.':'Completed in '+s.finish.toFixed(2)+' seconds.','Play again'],lost:['⌛','Time’s Up!','Another adventure awaits.','Try again']}[s.status];if(data){$('modalMark').textContent=data[0];$('modalTitle').textContent=data[1];$('modalText').textContent=data[2];$('modalPrimary').textContent=data[3];}}},debugVisible:()=>$('debug').hidden===false,debugText:t=>$('debug').textContent=t};}

// ===== sprites.js =====
// Presentation only. Never mutates the player, hitbox, input or fixed-step clock.
// The original 96px artwork is retained; the smooth atlas has four samples per pose.
const CELL=96, SUB=4, SCALE=.72, TAU_SPRITE=Math.PI*2;
const clip=(row,poses,loop)=>Object.freeze({row,poses,count:poses*SUB,loop});
const HAMSTER_CLIPS=Object.freeze({idle:clip(0,8,true),run:clip(1,8,true),jump:clip(2,7,false),land:clip(3,4,false),roll:clip(4,3,true),carry:clip(5,8,true)});
const unit=v=>Math.min(1,Math.max(0,v));
const mix=(a,b,t)=>a+(b-a)*t;
const mod=(v,n)=>((v%n)+n)%n;
const damp=(a,b,dt,k)=>mix(a,b,1-Math.exp(-k*dt));
const smooth=v=>{v=unit(v);return v*v*(3-2*v);};
function loadHamsterSprites(){const image=new Image();image.src=globalThis.ANIMALIA_SPRITES||'./assets/hamster-smooth.png';return image;}
// Pure pose selection. phase is an independent locomotion cycle, optional for tools/tests.
function hamsterPose(p,t,c,phase=mod((p.walk||0)/5,1),landAge=null){
  const speed=Math.abs(p.vx||0), motion=unit(speed/Math.max(1,c.maxSpeed));
  const moving=p.onGround&&speed>15, breath=Math.sin(t*TAU_SPRITE/2.65);
  let name,index,bob=0,sx=1,sy=1,lean=0;
  const landing=landAge===null?p.squash>.045:landAge<.145;
  if(p.rolling){name='roll';index=mod((p.rotation||0)*2,3);}
  else if(p.wallSliding){name=p.carrying?'carry':'jump';index=p.carrying?1:4.2;sx=.96;sy=1.045;lean=(p.wallSide||0)*.08;}
  else if(!p.onGround){
    const v=p.vy||0, rise=unit(1+v/Math.max(1,c.jumpVelocity)), fall=unit(v/Math.max(1,c.maxFallSpeed));
    name=p.carrying?'carry':'jump';index=p.carrying?(v<0?mix(1,2.5,rise):mix(2.5,5,fall)):(v<0?mix(.5,3,smooth(rise)):mix(3,6,smooth(fall)));
    const stretch=v<0?unit(-v/c.jumpVelocity):unit(v/c.maxFallSpeed)*.55;
    sx-=stretch*.06;sy+=stretch*.11;lean=motion*.065*(p.vx<0?-1:1);
    if(p.vineId){index=p.carrying?2:3;lean=0;}
  }else if(landing&&!p.carrying){name='land';index=landAge===null?unit(1-p.squash/.32)*3:smooth(landAge/.145)*3;}
  else if(moving){name=p.carrying?'carry':'run';index=mod(phase,1)*8;const stride=Math.sin(phase*TAU_SPRITE*2);bob=(.5-.5*Math.cos(phase*TAU_SPRITE*2))*1.1*motion;sx+=stride*.023*motion;sy-=stride*.025*motion;lean=motion*.07*(p.vx<0?-1:1);}
  else{name=p.carrying?'carry':'idle';index=mod(t/2.65,1)*8;sx-=breath*.022;sy+=breath*.038;}
  const squash=Math.max(-.32,Math.min(.38,p.squash||0));
  sx*=1+squash*.50;sy*=1-squash*.50;
  const spec=HAMSTER_CLIPS[name], raw=index*SUB;
  const sample=spec.loop?mod(Math.round(raw),spec.count):Math.min(spec.count-1,Math.max(0,Math.round(raw)));
  return {clip:name,index:sample,bob,sx,sy,lean,facing:p.facing===-1?-1:1,rotation:p.rolling?(p.rotation||0):0,wallOffset:p.wallSliding?-(p.wallSide||0)*5:0,carryRoll:!!(p.rolling&&p.carrying)};
}
// One animator per visible character. Rendering state is not part of gameplay state.
function createHamsterAnimator(){return {phase:0,time:0,landAge:Infinity,ground:null,pose:null,from:null,blend:1,turn:1,turnFrom:1,turnTo:1,turnAge:.09,lastX:null,lastY:null,lastVy:0,buffer:null};}
function resetHamsterAnimator(a){Object.assign(a,createHamsterAnimator(),{buffer:a.buffer});}
function advanceHamsterAnimation(a,p,c,dt){
  dt=Math.max(0,Math.min(.1,dt||0));
  // Teleports and checkpoint respawns must never blend across the map.
  if(a.lastX!==null&&Math.hypot(p.x-a.lastX,p.y-a.lastY)>100)resetHamsterAnimator(a);
  a.lastX=p.x;a.lastY=p.y;
  a.time+=dt;
  if(a.ground===false&&p.onGround&&(p.squash>.025||p.vy>100||a.lastVy>100))a.landAge=0;
  else a.landAge+=dt;
  if(!p.onGround)a.landAge=Infinity;
  a.ground=!!p.onGround;a.lastVy=p.vy||0;
  if(p.onGround&&Math.abs(p.vx)>15)a.phase=mod(a.phase+dt*Math.min(4.2,Math.abs(p.vx)/135),1);
  const target=hamsterPose(p,a.time,c,a.phase,a.landAge);
  if(!a.pose){a.pose=target;a.turn=a.turnFrom=a.turnTo=target.facing;return a.pose;}
  if(target.facing!==a.turnTo){a.turnFrom=a.turn;a.turnTo=target.facing;a.turnAge=0;}
  a.turnAge=Math.min(.09,a.turnAge+dt);
  const turnT=a.turnAge/.09;
  a.turn=turnT<.5?a.turnFrom:a.turnTo;
  if(target.clip!==a.pose.clip){a.from={...a.pose};a.blend=0;}
  a.blend=Math.min(1,a.blend+dt/((target.clip==='roll'||a.from?.clip==='roll') ? .065 : .095));
  const old=a.pose;
  // Smooth transforms at actual render cadence, with a short squash on reversals.
  a.pose={...target,facing:a.turn,sx:damp(old.sx,target.sx,dt,26),sy:damp(old.sy,target.sy,dt,26),bob:damp(old.bob,target.bob,dt,28),lean:damp(old.lean,target.lean,dt,22),wallOffset:damp(old.wallOffset,target.wallOffset,dt,24)};
  if(a.blend>=1)a.from=null;
  return a.pose;
}
function paintPose(ctx,img,a,turnScale=1){
  const spec=HAMSTER_CLIPS[a.clip];
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(a.clip==='roll'){
    ctx.translate(0,-22);ctx.rotate(a.rotation);ctx.scale(a.sx,a.sy);
    ctx.drawImage(img,a.index*CELL,spec.row*CELL,CELL,CELL,-48*SCALE,-52*SCALE,CELL*SCALE,CELL*SCALE);
    if(a.carryRoll){ctx.fillStyle='#ffdbaf';ctx.beginPath();ctx.ellipse(12,8,6,5,0,0,TAU_SPRITE);ctx.fill();}
  }else{
    ctx.translate(a.wallOffset,-a.bob);ctx.rotate(a.lean);ctx.scale(a.facing*a.sx*turnScale,a.sy);
    ctx.drawImage(img,a.index*CELL,spec.row*CELL,CELL,CELL,-48*SCALE,-84*SCALE,CELL*SCALE,CELL*SCALE);
  }
  ctx.restore();
}
function drawHamsterSprite(ctx,p,t,c,img,animator=null,dt=1/60){
  if(!img.complete||!img.naturalWidth)return false;
  const a=animator?advanceHamsterAnimation(animator,p,c,dt):hamsterPose(p,t,c);
  const turnScale=animator?1-.18*Math.sin(Math.PI*animator.turnAge/.09):1;
  ctx.save();ctx.translate(p.x,p.y);
  if(p.onGround){ctx.save();ctx.globalAlpha=.19;ctx.fillStyle='#3b2937';ctx.beginPath();ctx.ellipse(0,-1,20,3.8,0,0,TAU_SPRITE);ctx.fill();ctx.restore();}
  if(animator?.from&&animator.blend<1){
    // Blend in a tiny transparent scratch canvas. Additive premultiplied weights
    // avoid darkening/opacity holes; never use additive blending on the actual world.
    if(!animator.buffer){animator.buffer=document.createElement('canvas');animator.buffer.width=animator.buffer.height=192;}
    const b=animator.buffer.getContext('2d');b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,192,192);b.save();b.scale(2,2);b.translate(48,78);
    const w=smooth(animator.blend);b.globalAlpha=1-w;paintPose(b,img,{...animator.from,facing:a.facing},turnScale);b.globalCompositeOperation='lighter';b.globalAlpha=w;paintPose(b,img,a,turnScale);b.restore();
    ctx.drawImage(animator.buffer,-48,-78,96,96);
  }else paintPose(ctx,img,a,turnScale);
  ctx.restore();return true;
}

// ===== main.js =====



















const TAU=Math.PI*2;
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function line(ctx,points,color,width=2){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function flower(ctx,x,y,color='#ffd685',scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);line(ctx,[[0,0],[1,-13]],'#637851',2);ellipse(ctx,-3,-5,4,2,'#7c925d');for(let j=0;j<5;j++)ellipse(ctx,1+Math.cos(j*TAU/5)*3.8,-15+Math.sin(j*TAU/5)*3.8,3.3,3.3,color);ellipse(ctx,1,-15,2.3,2.3,'#f3ab67');ctx.restore();}
function platform(ctx,b){if(b.kind==='wall'){wallPlatform(ctx,b);return;}ctx.save();ctx.shadowColor='#382d4b55';ctx.shadowBlur=10;ctx.shadowOffsetY=7;rounded(ctx,b.x,b.y,b.w,b.h,Math.min(10,b.h/2),'#80584b','#68443f');ctx.shadowBlur=0;ctx.shadowOffsetY=0;rounded(ctx,b.x+3,b.y+8,b.w-6,Math.max(5,b.h-12),6,'#a37555');ctx.save();ctx.beginPath();ctx.roundRect(b.x+2,b.y+3,b.w-4,b.h-5,6);ctx.clip();for(let i=0;i<b.w;i+=38){line(ctx,[[b.x+i,b.y+12],[b.x+i+5,b.y+b.h-3]],'#855941',1);line(ctx,[[b.x+i+10,b.y+b.h*.62],[b.x+i+29,b.y+b.h*.65]],'#bd8965',2);}ctx.restore();rounded(ctx,b.x,b.y-3,b.w,Math.min(13,b.h*.64),6,'#71864e');rounded(ctx,b.x+2,b.y-4,b.w-4,6,3,'#a7b96a');for(let i=17;i<b.w-7;i+=41){const n=Math.floor((b.x+i)*7)%5;if(n===0||n===3)flower(ctx,b.x+i,b.y-3,n===0?'#ffd27f':'#f4bdc8',.7);else line(ctx,[[b.x+i,b.y-3],[b.x+i-3,b.y-10],[b.x+i,b.y-3],[b.x+i+4,b.y-9]],'#8da65e',1.6);}ctx.restore();}
// Tall bark towers have luminous climb markings and climbable faces.
function wallPlatform(ctx,b){ctx.save();ctx.shadowColor='#3b283e66';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
 const g=ctx.createLinearGradient(b.x,0,b.x+b.w,0);g.addColorStop(0,'#80503e');g.addColorStop(.3,'#bd8559');g.addColorStop(.68,'#a36c4b');g.addColorStop(1,'#74453d');rounded(ctx,b.x,b.y,b.w,b.h,9,g,'#654439');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.save();ctx.beginPath();ctx.roundRect(b.x+2,b.y+3,b.w-4,b.h-5,7);ctx.clip();for(let i=0;i<5;i++){const x=b.x+12+i*14;ctx.beginPath();ctx.moveTo(x,b.y);for(let y=b.y;y<=b.y+b.h+20;y+=20)ctx.lineTo(x+Math.sin(y*.034+i)*5,y);ctx.strokeStyle=i%2?'#e5ae7855':'#65433288';ctx.lineWidth=3;ctx.stroke();}ctx.restore();
 for(const side of [b.x+7,b.x+b.w-7]){line(ctx,[[side,b.y+16],[side,b.y+b.h-12]],'#f8d18c88',2);for(let y=b.y+42;y<b.y+b.h-12;y+=53){line(ctx,[[side-4,y+4],[side,y-3],[side+4,y+4]],'#ffe4a4',2);}}
 rounded(ctx,b.x-1,b.y-4,b.w+2,12,5,'#75984e','#527347');rounded(ctx,b.x+1,b.y-5,b.w-2,5,3,'#b7cc78');flower(ctx,b.x+b.w*.35,b.y-5,'#ffd1da',.8);flower(ctx,b.x+b.w*.72,b.y-5,'#ffe19b',.7);ctx.restore();}
function magic(ctx,o,t,ghost=false,valid=true){ctx.save();ctx.globalAlpha=ghost?.55:Math.min(1,o.remaining/.75);if(o.kind==='cheese'){rounded(ctx,o.x,o.y,o.w,o.h,7,'#ffcb64','#ba8650');rounded(ctx,o.x+2,o.y+2,o.w-4,8,4,'#ffe5a0');for(let i=0;i<5;i++)ellipse(ctx,o.x+12+i*24,o.y+15+(i%2)*4,5,3.5,'#db9d4e');}else if(o.kind==='spring'){rounded(ctx,o.x,o.y+o.h-5,o.w,5,3,'#94644f');line(ctx,[[o.x+9,o.y+13],[o.x+19,o.y+5],[o.x+30,o.y+13],[o.x+41,o.y+5],[o.x+52,o.y+13],[o.x+63,o.y+5]],'#dbe7e6',3);rounded(ctx,o.x,o.y,o.w,6,3,'#9cd9e3','#4e889d');}else if(o.kind==='fan'){rounded(ctx,o.x,o.y,o.w,o.h,9,'#9b79b0','#5d486e');ellipse(ctx,o.x+o.w/2,o.y+o.h/2,17,17,'#54445f');ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);ctx.rotate(t*12);for(let i=0;i<4;i++){ctx.rotate(TAU/4);ellipse(ctx,0,-8,5,9,'#c1e5e4');}ellipse(ctx,0,0,4,4,'#ffe3aa');ctx.restore();for(let i=0;i<5;i++){let off=(t*100+i*46)%230;let x=o.direction>0?o.x+o.w+off:o.x-off;line(ctx,[[x,o.y+7+(i%3)*12],[x+o.direction*17,o.y+3+(i%3)*12]],'#b9eef0aa',2);}}else{ctx.beginPath();ctx.moveTo(o.x,o.y+o.h);ctx.lineTo(o.x+o.w,o.y);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.closePath();ctx.fillStyle='#d6a774';ctx.fill();ctx.strokeStyle='#956441';ctx.lineWidth=3;ctx.stroke();line(ctx,[[o.x+3,o.y+o.h-3],[o.x+o.w-2,o.y+1]],'#fce0a2',5);line(ctx,[[o.x+o.w-27,o.y+17],[o.x+o.w-27,o.y+o.h]],'#bc8756',2);}if(ghost){ctx.setLineDash([5,5]);ctx.strokeStyle=valid?'#e5ffbf':'#ff7578';ctx.lineWidth=2;ctx.strokeRect(o.x-2,o.y-2,o.w+4,o.h+4);}else{ctx.fillStyle='#fff1cf';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(Math.ceil(o.remaining)+'s',o.x+o.w/2,o.y-6);}ctx.restore();}
function acorn(ctx,x,y,t){y+=Math.sin(t*3)*4;const g=ctx.createRadialGradient(x,y,4,x,y,48);g.addColorStop(0,'#ffdc79aa');g.addColorStop(1,'#ffdc7900');ctx.fillStyle=g;ctx.fillRect(x-48,y-48,96,96);ctx.save();ctx.translate(x,y);ctx.rotate(-.15);ellipse(ctx,0,5,12,15,'#d78e4a','#865332');ellipse(ctx,0,-5,15,8,'#9a603a','#74492f');line(ctx,[[0,-11],[4,-17],[9,-17]],'#795136',3);for(let i=-9;i<=9;i+=6)line(ctx,[[i,-8],[i+3,-3]],'#bf8751',1.4);ellipse(ctx,-4,5,3,6,'#efb86d');ctx.restore();}
function hole(ctx,x,y,carrying,t){const floor=y+46;ctx.save();ctx.translate(x,floor);ctx.shadowColor='#3e354944';ctx.shadowBlur=10;ellipse(ctx,0,0,34,8,'#4c483a');ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-29,0);ctx.quadraticCurveTo(-30,-43,0,-45);ctx.quadraticCurveTo(30,-43,29,0);ctx.closePath();ctx.fillStyle='#9e7853';ctx.fill();ctx.strokeStyle='#674d3b';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.moveTo(-20,0);ctx.quadraticCurveTo(-20,-34,0,-35);ctx.quadraticCurveTo(20,-34,20,0);ctx.closePath();ctx.fillStyle='#40333a';ctx.fill();line(ctx,[[35,0],[35,-62]],'#77513e',5);rounded(ctx,10,-73,66,22,5,carrying?'#ffdf90':'#d9ad77','#855c42');ctx.fillStyle='#593d31';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('HOME',43,-58);if(carrying){ctx.fillStyle='#ffefab';ctx.font='20px sans-serif';ctx.fillText('↓',0,-51+Math.sin(t*5)*4);}ctx.restore();}
function mazeHole(ctx,x,floor,carrying,t){ctx.save();ctx.translate(x,floor);ellipse(ctx,0,0,18,4,'#4c483a');ctx.beginPath();ctx.moveTo(-16,0);ctx.quadraticCurveTo(-17,-24,0,-26);ctx.quadraticCurveTo(17,-24,16,0);ctx.closePath();ctx.fillStyle='#b28760';ctx.fill();ctx.strokeStyle='#674d3b';ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.moveTo(-10,0);ctx.quadraticCurveTo(-11,-19,0,-20);ctx.quadraticCurveTo(11,-19,10,0);ctx.closePath();ctx.fillStyle='#40333a';ctx.fill();rounded(ctx,-36,-20,16,18,4,carrying?'#ffdf90':'#d9ad77','#855c42');ellipse(ctx,-28,-7,3.2,2.6,'#75503e');for(let i=0;i<3;i++)ellipse(ctx,-32+i*4,-12,1.6,2,'#75503e');if(carrying){ctx.fillStyle='#ffefab';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('↓',0,-30+Math.sin(t*5)*2);}ctx.restore();}
function hamster(ctx,p,t,img,animator,dt){if(drawHamsterSprite(ctx,p,t,config,img,animator,dt))return;const x=p.x,y=p.y;ctx.save();ctx.translate(x,y);const moving=p.onGround&&Math.abs(p.vx)>15;const bob=moving?Math.sin(p.walk*1.8)*1.2:Math.sin(t*3)*.6;ctx.translate(0,-20+bob);ctx.scale(1+p.squash,1-p.squash);if(p.rolling)ctx.rotate(p.rotation);else ctx.scale(p.facing,1);
  const outline='#98573d';if(p.rolling){ellipse(ctx,0,0,21,21,'#dc9055',outline);ellipse(ctx,1,2,15,16,'#ffdb9f');ellipse(ctx,-13,-12,6,6,'#cf8051',outline);ellipse(ctx,-12,-12,3,3,'#f4bda5');ellipse(ctx,10,-1,2.8,3.5,'#69453c');line(ctx,[[9,10],[15,7]],'#b97148',2);if(p.carrying)ellipse(ctx,13,7,8,7,'#ffe3b3');ctx.restore();return;}
  ellipse(ctx,-18,5,6,5,'#f1c895',outline);ellipse(ctx,-12,-17,8,9,'#da8a54',outline);ellipse(ctx,-12,-17,4.6,5,'#f4b3a0');ellipse(ctx,9,-18,7,8,'#e49a61',outline);ellipse(ctx,9,-18,4,4.5,'#f2b5a2');ellipse(ctx,0,0,22,21,'#e8a15f',outline);ellipse(ctx,5,6,16,14,'#ffe3b2');const step=moving?Math.sin(p.walk*2.4)*3:0;ellipse(ctx,-9+step,18,8,4,'#f4c18d',outline);ellipse(ctx,10-step,18,7,4,'#f4c18d',outline);ellipse(ctx,10,6,p.carrying?12:8,p.carrying?10:7,'#fff0ca');ellipse(ctx,18,4,p.carrying?8:5,p.carrying?7:5,'#f7bf9e');const blink=Math.sin(t*1.4)>0.997;ellipse(ctx,9,-6,3.5,blink?.7:5,'#4e3735');if(!blink)ellipse(ctx,10,-8,1.2,1.5,'#fff5d9');ellipse(ctx,20,0,3.2,2.5,'#a96155');line(ctx,[[19,2],[17,5],[13,5]],'#9b6451',1.5);ellipse(ctx,-5,-10,5,3,'#f6bd7d');if(p.carrying){ellipse(ctx,-1,8,7,6,'#ffe9bb');}ctx.restore();}
// Map objects keep their original collision geometry; decorative art is separate.
function terrain(ctx,b,t){ctx.save();if(['purple','chocolate','bare'].includes(b.style)){const {x,y,w,h}=b;if(b.style==='purple'){rounded(ctx,x,y+5,w,h-5,7,'#634387','#49345f');for(let i=12;i<w-6;i+=24)line(ctx,[[x+i-5,y+27],[x+i+7,y+36],[x+i-5,y+45]],'#d5b7fa',3);rounded(ctx,x,y-3,w,15,7,'#ad79e9','#69459e');line(ctx,[[x+8,y+1],[x+w-8,y+1]],'#efd8ff',3);}else if(b.style==='chocolate'){rounded(ctx,x,y,w,h,7,'#754331','#503127');for(let i=0;i<w-8;i+=45)for(let j=0;j<h-8;j+=36)rounded(ctx,x+i+3,y+j+4,Math.min(39,w-i-5),Math.min(30,h-j-6),4,'#956047','#653b2d');rounded(ctx,x,y-3,w,10,4,'#b17a57','#69402c');}else{rounded(ctx,x,y,w,h,7,'#a8754b','#704b37');for(let j=10;j<h;j+=24){line(ctx,[[x+4,y+j],[x+w-4,y+j]],'#795035',2);for(let i=20;i<w-50;i+=85)line(ctx,[[x+i,y+j+5],[x+i+40,y+j+8]],'#cfa16a',2);}rounded(ctx,x,y-3,w,8,3,'#d5a16a','#8c5a3a');}ctx.restore();return;}if(b.kind==='ramp'){const down=b.slope==='down',y0=down?b.y:b.y+b.h,y1=down?b.y+b.h:b.y;ctx.beginPath();ctx.moveTo(b.x,y0);ctx.lineTo(b.x+b.w,y1);ctx.lineTo(b.x+b.w,y1+10);ctx.lineTo(b.x,y0+10);ctx.closePath();ctx.fillStyle='#a87551';ctx.fill();ctx.strokeStyle='#67463d';ctx.lineWidth=2;ctx.stroke();line(ctx,[[b.x,y0],[b.x+b.w,y1]],'#afcb79',5);for(let i=15;i<b.w;i+=23){const y=y0+(y1-y0)*i/b.w;line(ctx,[[b.x+i,y+3],[b.x+i-2,y+9]],'#e1b17b',1.5);}ctx.restore();return;}if(b.kind==='crystal'){const g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,'#c6a2e1');g.addColorStop(.45,'#8866ad');g.addColorStop(1,'#594479');rounded(ctx,b.x,b.y,b.w,b.h,Math.min(5,b.h/3),g,'#503960');ctx.save();ctx.beginPath();ctx.rect(b.x+1,b.y+1,b.w-2,b.h-2);ctx.clip();for(let i=0;i<b.h;i+=26){line(ctx,[[b.x+3,b.y+i],[b.x+b.w*.6,b.y+i+12],[b.x+b.w-3,b.y+i+5]],'#e4c7f366',1.6);}ctx.restore();}else if(b.style==='gold'&&b.kind==='spring'){rounded(ctx,b.x,b.y+3,b.w,b.h,4,'#855139','#543d3f');for(let i=6;i<b.w-4;i+=10)line(ctx,[[b.x+i,b.y+8],[b.x+i+4,b.y+2]],'#f4d69b',2);rounded(ctx,b.x,b.y-3,b.w,6,3,'#ffd36f','#ae773b');line(ctx,[[b.x+5,b.y-2],[b.x+b.w-5,b.y-2]],'#fff1b1',2);ctx.restore();return;}else if(b.kind==='crumble'&&b.crumbleAge!==undefined)ctx.translate(Math.sin(t*85)*2,0);if(b.kind==='wall'){wallPlatform(ctx,b);}else if(b.kind==='spring'){rounded(ctx,b.x,b.y+7,b.w,b.h-5,8,'#d7b08a','#885b51');for(let i=12;i<b.w;i+=24){ellipse(ctx,b.x+i,b.y+5,14,12,'#e88d9f','#a65070');ellipse(ctx,b.x+i-4,b.y+1,3,3,'#ffe4c8');}}else if(['ice','honey','conveyor','moving','crumble'].includes(b.kind)){platform(ctx,b);const colors={ice:'#a8dce5',honey:'#e9b65d',conveyor:'#8d99b6',moving:'#c4a2d0',crumble:'#b58b72'};rounded(ctx,b.x,b.y-3,b.w,12,5,colors[b.kind],'#745a61');for(let i=10;i<b.w-8;i+=24){if(b.kind==='conveyor'||b.kind==='moving'){const x=b.x+i+(b.kind==='conveyor'?t*40*(b.direction||1)%12:0);line(ctx,[[x-4,b.y],[x+2*(b.direction||1),b.y+3],[x-4,b.y+6]],'#fff0c8',2);}if(b.kind==='ice')line(ctx,[[b.x+i,b.y+5],[b.x+i+9,b.y-1]],'#f3ffff',2);if(b.kind==='honey')ellipse(ctx,b.x+i,b.y+8,5,7,'#edb964');if(b.kind==='crumble')line(ctx,[[b.x+i,b.y-3],[b.x+i-3,b.y+5],[b.x+i+4,b.y+11]],'#79574e',2);}}else if(b.kind!=='crystal'&&b.kind!=='wall')platform(ctx,b);if(b.iceSide){const x=b.iceSide==='left'?b.x:b.x+b.w-5;rounded(ctx,x,b.y+1,5,b.h-2,2,'#a3e2ee','#6fa7bb');line(ctx,[[x+1,b.y+4],[x+1,b.y+b.h-4]],'#e5ffff',1.3);}ctx.restore();}
function drawCheckpoint(ctx,q,active,t){line(ctx,[[q.x,q.y],[q.x,q.y-58]],'#80513e',5);ctx.save();ctx.translate(q.x,q.y-56);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(16,Math.sin(t*3)*3,34,2);ctx.lineTo(29,25);ctx.lineTo(0,22);ctx.closePath();ctx.fillStyle=active?'#f6d886':'#dc9bb6';ctx.fill();ctx.strokeStyle='#855449';ctx.stroke();ellipse(ctx,15,15,5,4,'#fff0cd');for(let i=0;i<3;i++)ellipse(ctx,9+i*6,8,2.5,3,'#fff0cd');ctx.restore();}
function drawVine(ctx,v){line(ctx,[[v.x,v.y],[v.endX,v.endY]],'#526d4e',5);for(let i=1;i<7;i++){const f=i/7;ellipse(ctx,v.x+(v.endX-v.x)*f+(i%2?5:-5),v.y+(v.endY-v.y)*f,7,3,'#a0b36c');}ellipse(ctx,v.endX,v.endY,8,8,'#dab07d','#79543f');}
// Show lift travel before the ledges are painted, so players can time their jump.
function drawObstacleGuide(ctx,b){if(!b.motion)return;const x=b.x+b.w/2,y=b.y+b.h/2,dx=b.motion.x||0,dy=b.motion.y||0;ctx.save();ctx.setLineDash([5,7]);line(ctx,[[x-dx,y-dy],[x+dx,y+dy]],'#fff0c799',2);ctx.setLineDash([]);for(const k of [-1,1]){ellipse(ctx,x+k*dx,y+k*dy,5,5,'#b99ac0','#71546d');}ctx.restore();}
function drawCrumbleWarning(ctx,b){if(b.kind!=='crumble'||b.crumbleAge===undefined)return;const left=clamp(1-b.crumbleAge/Math.max(.001,config.crumbleDelay),0,1);rounded(ctx,b.x+5,b.y+b.h+5,b.w-10,5,2,'#68434e');if(left>0)rounded(ctx,b.x+5,b.y+b.h+5,(b.w-10)*left,5,2,left<.35?'#ff8f92':'#ffda91');}
function drawHazard(ctx,b){if(b.h<=20)return;ctx.save();const base=b.y+b.h;const grad=ctx.createLinearGradient(0,b.y,0,base);grad.addColorStop(0,'#e0a1bc');grad.addColorStop(.42,'#9e668b');grad.addColorStop(1,'#52384f');const n=Math.max(1,Math.ceil(b.w/20));const width=b.w/n;for(let i=0;i<n;i++){const x=b.x+i*width;ctx.beginPath();ctx.moveTo(x,base);ctx.quadraticCurveTo(x+width*.25,b.y+11,x+width*.5,b.y);ctx.quadraticCurveTo(x+width*.75,b.y+11,x+width,base);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#603e5c';ctx.lineWidth=1.5;ctx.stroke();line(ctx,[[x+width*.45,b.y+8],[x+width*.26,base-6]],'#f1c2c6aa',1.4);}rounded(ctx,b.x,base-5,b.w,7,3,'#6a4b63');ctx.restore();}
async function boot(){let level=await loadLevel();const bg=createBackground();let quality=matchMedia('(pointer: coarse)').matches?'medium':'high';try{quality=localStorage.getItem('animalia.quality')||quality;}catch{}if(!['low','medium','high'].includes(quality))quality='high';let cameraMode='overview',showRoute=false;try{cameraMode=localStorage.getItem('animalia.maze.camera')==='follow'?'follow':'overview';}catch{}let changing=false;const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),input=createInput(()=>ui?.chatOpen()??false),audio=createAudio(),cam=createCamera();const emoteImages=loadEmoteImages(),hamsterImage=loadHamsterSprites(),hamsterAnimator=createHamsterAnimator();let particles=[],previous, state, pointer=null, ui, last=performance.now(),acc=0, fps=60, visualTime=0, elapsed=0;let cssW=innerWidth,cssH=innerHeight,dpr=1,baseScale=1,revealStart=null;
  // Storage may be denied in private/file preview contexts; keep this session playable.
  const memoryStore=new Map();let adventureStore;try{adventureStore=localStorage;}catch{adventureStore={getItem:k=>memoryStore.get(k)??null,setItem:(k,v)=>memoryStore.set(k,String(v))};}
  let farm=loadFarm(adventureStore),farmUI=null;
  let profile=readAdventure(adventureStore),replay=null,capture=null,ghostKey='',ghostEnabled=true;
  try{ghostEnabled=adventureStore.getItem('animalia.ghost.enabled')!=='false';}catch{}
  function nextTrail(){const i=LEVELS.findIndex(m=>m.id===level.id);return LEVEL_FILES[(i+1)%LEVEL_FILES.length];}
  async function chooseTrail(id){if(changing)return;changing=true;try{level=await loadLevel(id);restart();}finally{changing=false;}}

  function readBest(id){try{return bestTime(localStorage,id);}catch{return null;}}
  function restart(){resetHamsterAnimator(hamsterAnimator);if(ui){ui.closeChat();ui.closeMenus();}farmUI?.close();state={practice:!!level.practice,tutorialDone:false,tutorial:level.practice?createTutorial(level):null,levelId:level.id,player:spawnPlayer(level.spawn,level.playerScale||1),shaman:createShaman(),mode:'hamster',status:'playing',time:config.roundSeconds,bubble:null,stage:createStage(level),levelName:level.name,difficulty:level.difficulty||null,best:readBest(level.id),newRecord:false,finish:0,falls:0,flags:0,assisted:false,award:null,profile,ghostTime:null,goalTarget:TRAIL_GOALS[level.id]||30};ghostKey=replayKey(level.id,config);replay=level.practice?null:readReplay(adventureStore,ghostKey);capture=level.practice?null:createReplayCapture(state.player);state.ghostTime=replay?.time??null;state.farm=farm;state.wallDemo=level.wallLesson?buildWallDemo(level,config):null;if(state.wallDemo&&!state.wallDemo.done)state.wallDemo=buildWallDemo(level,DEFAULT_CONFIG);previous={...state.player};particles=[];elapsed=0;acc=0;input.clear();cam.x=0;cam.y=0;cam.shake=0;resizeCamera(cam,cssW,cssH,level,cameraMode);baseScale=cam.scale;revealStart=null;updateCamera(cam,state.player,level,config,1);if(ui){ui.update(state);ui.showToast(level.terrainLesson?'Explore the meadow materials!':level.practice?'Welcome to your first adventure!' :level.id==='sunpetal-grove'?'Welcome! Hold Space for higher jumps · take the acorn home.':level.id==='maze-run-01'?'Slide down the ramps! · Find the acorn, then HOME.':level.id==='parkour-01'?'Hold toward a wall, then press Jump to climb!':level.id==='meadow-run'?'Follow the colorful ledges · watch your footing!':'Find the spring mushrooms · hold E near a vine!');}}
  function respawn(){if(state.tutorial)state.tutorial.airborneJump=false;state.falls++;resetHamsterAnimator(hamsterAnimator);burst(particles,'dust',state.player.x,state.player.y-15,16);const carry=state.player.carrying;state.player=spawnPlayer(state.stage.checkpoint||level.spawn,level.playerScale||1);state.player.carrying=carry;previous={...state.player};burst(particles,'dust',state.player.x,state.player.y-15,20);audio.play('respawn');ui.showToast(state.stage.checkpoint?'Poof! Back to your flag.':'Poof! Back to the start.');}
  function mode(){if(level.farmLesson)return;if(level.wallLesson&&state.tutorial?.phase!=='free')return;if(state.status!=='playing'||ui?.chatOpen()||['intro','reveal','complete','terrain-intro','terrain-complete','wall-intro','wall-demo','wall-ready','wall-complete'].includes(state.tutorial?.phase))return;state.mode=state.mode==='hamster'?'shaman':'hamster';input.clear();ui.update(state);ui.showToast(state.mode==='shaman'?'Choose magic 1–4 · click to build':(level.practice?'Hamster mode · practice your jumps':'Hamster mode · race to the acorn'));}
  function pause(){if(!['playing','paused'].includes(state.status))return;if(ui?.chatOpen())ui.closeChat();state.status=state.status==='playing'?'paused':'playing';input.clear();ui.update(state);}
  function triggerEmote(i){if(state.status!=='playing')return;if(ui?.chatOpen()||!EMOTES[i])return;state.bubble=makeEmoteBubble(...EMOTES[i]);audio.play('emote');}
  function select(i){if(i>=0&&i<TOOLS.length){state.shaman.selected=i;ui.update(state);}}
  function tutorialNext(){const t=state.tutorial;if(!t)return;if(t.phase==='intro'){t.phase='controls';input.clear();ui.showToast('Follow the two glowing jump markers!');}else if(t.phase==='complete'){chooseTrail('tutorial-02');return;}else if(t.phase==='terrain-intro'){t.phase='terrain';input.clear();ui.showToast('Jump to catch the vine, A/D to swing, W to jump off!');}else if(t.phase==='terrain-complete'){chooseTrail('tutorial-03');return;}else if(t.phase==='wall-intro'){t.phase='wall-demo';t.demoTime=0;input.clear();}else if(t.phase==='wall-ready'){t.phase='wall-quest';input.clear();ui.showToast('Your turn! Hold toward a wall and press W to kick away.');}else if(t.phase==='wall-complete'){chooseTrail('tutorial-04');return;}ui.update(state);}
  restart();ui=createUI({tutorialNext,canChat:()=>!farmUI?.isOpen()&&!['intro','reveal','complete','terrain-intro','terrain-complete','wall-intro','wall-demo','wall-ready','wall-complete'].includes(state.tutorial?.phase),clearInput:()=>input.clear(),blockInput:v=>{if(v)farmUI?.close();input.setBlocked(v);},best:readBest,camera:v=>{if(v){cameraMode=v;try{localStorage.setItem('animalia.maze.camera',v);}catch{}resize();}return cameraMode;},route:v=>{showRoute=v;},quality:v=>{if(v){quality=v;try{localStorage.setItem('animalia.quality',v);}catch{}resize();}return quality;},level:chooseTrail,next:()=>chooseTrail(nextTrail()),profile:()=>profile,ghost:v=>{if(v!==undefined){ghostEnabled=v;try{adventureStore.setItem('animalia.ghost.enabled',String(v));}catch{}}return ghostEnabled;},restart,mode,pause,primary:()=>state.status==='paused'?pause():restart(),mute:()=>audio.toggle(),emote:triggerEmote,select,number:i=>state.mode==='shaman'?select(i):triggerEmote(i),chat:msg=>{state.bubble=makeBubble(msg);audio.play('emote');},configChange:k=>{if(k==='roundSeconds'&&!level.practice)state.time=Math.max(0,config.roundSeconds-elapsed);}});ui.update(state);farmUI=createFarmUI({beforeOpen:()=>{ui.closeChat();ui.closeMenus();},active:()=>!!level.farmLesson&&state.status==='playing',state:()=>farm,block:v=>input.setBlocked(v),change:(action,arg)=>{const before=farmStage(farm);if(!farmAction(farm,action,arg))return false;saveFarm(adventureStore,farm);audio.play('pickup');if(before!=='done'&&farmStage(farm)==='done'){audio.play('win');burst(particles,'confetti',state.player.x,state.player.y-50,70);ui.showToast('Tutorial 04 complete! Your farm is open for business.');}else if(action==='seed'&&farm.starterBought===5)ui.showToast('Five seeds purchased! Open Garden to plant.');return true;}});farmUI.render(farm);
  function resize(){const r=canvas.getBoundingClientRect();cssW=r.width;cssH=r.height;dpr=Math.min(window.devicePixelRatio||1,quality==='low'?1:quality==='medium'?1.5:2);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);resizeCamera(cam,cssW,cssH,level,cameraMode);baseScale=cam.scale;revealStart=null;updateCamera(cam,state.player,level,config,1);}
  window.addEventListener('resize',resize);resize();document.getElementById('loading').hidden=true;window.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});window.addEventListener('keydown',()=>audio.unlock());window.addEventListener('blur',()=>{if(state.status==='playing')pause();});
  function pos(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}canvas.addEventListener('pointermove',e=>{pointer=pos(e);});canvas.addEventListener('pointerleave',()=>{pointer=null;});canvas.addEventListener('pointerdown',e=>{if(level.farmLesson&&state.status==='playing'&&farmStage(farm)!=='shop-guide'&&!farmUI?.isOpen()&&!ui.menuOpen()&&!ui.chatOpen()){const a=pos(e),pt=screenToWorld(cam,a.x,a.y),i=level.farmPlots.findIndex(q=>Math.abs(pt.x-q.x)<50&&Math.abs(pt.y-q.y)<75);if(i>=0){farmUI.clickPlot(i);return;}}if(state.status!=='playing'||state.mode!=='shaman'||['intro','reveal','complete','terrain-intro','terrain-complete','wall-intro','wall-demo','wall-ready','wall-complete'].includes(state.tutorial?.phase)||ui.chatOpen()||ui.menuOpen())return;pointer=pos(e);const p=screenToWorld(cam,pointer.x,pointer.y),o=previewObject(state.shaman,p.x,p.y,state.player.facing);if(placeObject(state.shaman,o,{...level,platforms:state.stage.platforms},state.player)){state.assisted=true;audio.play('place');burst(particles,'dust',p.x,p.y,13);}else ui.showToast('Not enough mana or space here.');});
  function tick(){if(state.status!=='playing'||changing)return;previous={...state.player};const t=state.tutorial;
    if(level.farmLesson&&farmStage(farm)==='shop-guide'){input.clear();return;}
    if(level.farmLesson&&state.player.onGround)for(const r of RESOURCE_ITEMS){if(Math.abs(state.player.x-r.x)<29&&farmAction(farm,'collect',r.id)){saveFarm(adventureStore,farm);audio.play('pickup');ui.showToast(r.name+' added to backpack!');}}
    if(t?.phase==='wall-demo'){input.clear();t.demoTime+=STEP;const end=(state.wallDemo?.frames.length||1)/(60*.75)+.8;if(t.demoTime>=end)t.phase='wall-ready';return;}
    if(['intro','complete','terrain-intro','terrain-complete','wall-intro','wall-ready','wall-complete'].includes(t?.phase)){input.clear();return;}
    if(t?.phase==='reveal'){
      const food=t.foodVisible,home=t.holeVisible;advanceReveal(t,STEP);input.clear();
      if(!food&&t.foodVisible){audio.play('pickup');burst(particles,'confetti',level.acorn.x,level.acorn.y,18);}
      if(!home&&t.holeVisible){audio.play('pickup');burst(particles,'dust',level.hole.x,level.hole.floor-25,18);}
      return;
    }
    elapsed+=STEP;state.time=level.practice?config.roundSeconds:Math.max(0,config.roundSeconds-elapsed);if(!level.practice&&state.time<=0){state.status='lost';ui.closeChat();ui.update(state);return;}updateShaman(state.shaman,config,STEP);state.stage=stepStage(state.stage,level,state.player,config,STEP);const raw=input.sample();const result=updatePlayer(state.player,state.mode==='hamster'?raw:emptyInput(),worldFor(level,state.shaman,config,state.stage),config,STEP);state.player=result.player;state.bubble=tickBubble(state.bubble,STEP);const p=state.player;if(capture){captureReplay(capture,p,elapsed);if(replayKey(level.id,config)!==ghostKey)state.assisted=true;}
    // Tiny speed-dependent foot puffs make rapid movement readable without altering collision.
    if(p.onGround&&Math.abs(p.vx)>config.maxSpeed*.55&&Math.round(elapsed/STEP)%9===0&&quality!=='low')burst(particles,'dust',p.x-p.facing*10*(p.scale||1),p.y-2,2);
    for(const ev of result.events){if(ev.type==='vineCatch'){audio.play('pickup');ui.showToast('Vine grabbed! Hold A or D to swing. Release W, then press W to jump off.');continue;}audio.play(ev.type);burst(particles,'dust',ev.x,ev.y,ev.type==='land'?12:7);if(ev.type==='land'&&ev.impact>420)cam.shake=(cam.fixed?0:config.shakeStrength)*Math.min(1,ev.impact/650);}
    if(p.wallSliding&&Math.floor(elapsed/STEP)%7===0)burst(particles,'dust',p.x+p.wallSide*17,p.y-12,2);
    if(p.y>level.height+50||level.hazards.some(h=>overlaps(bodyRect(p),h))){respawn();return;}
    if(level.practice){
      if(t.phase==='wall-quest'){const event=advanceWallLesson(t,level,p,result.events);if(event==='pickup'){audio.play('pickup');burst(particles,'confetti',p.x,p.y-30,30);ui.showToast('Acorn collected! Return down to your hole.');}else if(event==='complete'){state.tutorialDone=true;p.vx=p.vy=0;input.clear();ui.closeChat();audio.play('win');burst(particles,'confetti',p.x,p.y-65,85);}}
      else if(t.phase==='terrain'&&state.mode==='hamster'){
 const before=Object.keys(t.terrainDone).length;advanceTerrain(t,previous,p,raw,result.events);if(Object.keys(t.terrainDone).length>before){audio.play('pickup');burst(particles,'confetti',p.x,p.y-40,18);}if(t.phase==='terrain-complete'){state.tutorialDone=true;p.vx=p.vy=0;input.clear();ui.closeChat();audio.play('win');burst(particles,'confetti',p.x,p.y-65,85);}
 }else if(t.phase==='controls'&&state.mode==='hamster'){
        advanceTutorial(t,level,previous,p,raw,result.events,STEP);
        if(t.phase==='reveal'){p.vx=p.vy=0;state.bubble=null;ui.closeChat();input.clear();revealStart={x:cam.x,y:cam.y,scale:cam.scale};audio.play('pickup');burst(particles,'confetti',p.x,p.y-50,25);}
      }else if(t.phase==='food'){
        if(!p.carrying&&acornReached(level,p)){p.carrying=true;audio.play('pickup');burst(particles,'dust',level.acorn.x,level.acorn.y,20);ui.showToast('Acorn collected! Bring it home.');}
        if(homeReached(level,p)){t.phase='complete';state.tutorialDone=true;p.vx=p.vy=0;input.clear();ui.closeChat();audio.play('win');burst(particles,'confetti',p.x,p.y-75,85);}
      }
      return;
    }
    const flag=checkpointAt(state.stage,level,p);if(flag){state.flags++;state.stage.checkpoint=flag;audio.play('pickup');ui.showToast('Checkpoint saved!');}
    if(!p.carrying&&acornReached(level,p)){p.carrying=true;audio.play('pickup');burst(particles,'dust',level.acorn.x,level.acorn.y,20);ui.showToast(level.id==='maze-run-01'?'Acorn acquired! Head to the hamster hole.':'Acorn acquired! Head back home.');}
    if(homeReached(level,p)){state.status='won';ui.closeChat();state.finish=elapsed;try{const r=recordTime(localStorage,level.id,elapsed);state.best=r.best;state.newRecord=r.newRecord;}catch{}state.assisted=state.assisted||replayKey(level.id,config)!==ghostKey;
    captureReplay(capture,p,elapsed,true);if(!state.assisted)saveReplay(adventureStore,ghostKey,elapsed,capture.frames);
    const reward=finishAdventure(profile,adventureStore,level.id,elapsed,state.falls,state.assisted);profile=reward.profile;state.profile=profile;state.award=reward;
    audio.play('win');burst(particles,'confetti',p.x,p.y-75,90);ui.update(state);}
  }
  function render(alpha,dt){const p={...state.player,x:previous.x+(state.player.x-previous.x)*alpha,y:previous.y+(state.player.y-previous.y)*alpha,rotation:state.player.rolling?previous.rotation+(state.player.rotation-previous.rotation)*alpha:0,walk:previous.walk+(state.player.walk-previous.walk)*alpha,squash:previous.squash+(state.player.squash-previous.squash)*alpha,vx:previous.vx+(state.player.vx-previous.vx)*alpha,vy:previous.vy+(state.player.vy-previous.vy)*alpha};const demo=state.tutorial?.phase==='wall-demo'?wallDemoFrame(state.wallDemo,state.tutorial.demoTime):null;const target=level.farmLesson||level.practice&&!['food','wall-quest'].includes(state.tutorial?.phase)?null:p.carrying?{x:level.hole.x,y:level.hole.floor??level.hole.y+46}:level.acorn;
    if(target){const dx=target.x-p.x,dy=target.y-(p.y-15*(p.scale||1));state.objective={angle:Math.atan2(dy,dx),distance:Math.round(Math.hypot(dx,dy))};}
    if(state.tutorial?.phase==='reveal'){
      if(!revealStart)revealStart={x:cam.x,y:cam.y,scale:cam.scale};
      Object.assign(cam,revealPose(state.tutorial.revealTime,revealStart,p,level,cssW,cssH,baseScale));cam.width=cssW/cam.scale;cam.height=cssH/cam.scale;cam.shake=0;
    }else{if(revealStart){Object.assign(cam,revealPose(5.4,revealStart,p,level,cssW,cssH,baseScale));cam.width=cssW/cam.scale;cam.height=cssH/cam.scale;revealStart=null;}if(level.farmLesson){const zoom=farmStage(farm)==='shop-guide'?1.45:1;cam.scale+=(baseScale*zoom-cam.scale)*Math.min(1,dt*7);cam.width=cssW/cam.scale;cam.height=cssH/cam.scale;}updateCamera(cam,demo?.p||p,level,config,dt);}
    ctx.setTransform(dpr,0,0,dpr,0,0);bg(ctx,cssW,cssH,cam,visualTime,level,p,quality);ctx.save();ctx.scale(cam.scale,cam.scale);ctx.translate(-cam.x+Math.sin(visualTime*75)*cam.shake,-cam.y+Math.cos(visualTime*62)*cam.shake*.6);
    for(const b of level.platforms)if(b.motion&&b.x+b.w+Math.abs(b.motion.x||0)>cam.x-80&&b.x-Math.abs(b.motion.x||0)<cam.x+cam.width+80&&b.y+b.h+Math.abs(b.motion.y||0)>cam.y-80&&b.y-Math.abs(b.motion.y||0)<cam.y+cam.height+80)drawObstacleGuide(ctx,b);for(const b of state.stage.platforms)if(b.x+b.w>cam.x-80&&b.x<cam.x+cam.width+80&&b.y+b.h>cam.y-80&&b.y<cam.y+cam.height+80){const drawn={...b,x:b.x-(b.dx||0)*(1-alpha),y:b.y-(b.dy||0)*(1-alpha)};terrain(ctx,drawn,visualTime);drawCrumbleWarning(ctx,drawn);}for(const b of state.stage.debris){ctx.save();ctx.globalAlpha=Math.max(0,1-b.fallAge/.75);ctx.translate(0,b.fallAge*b.fallAge*480);terrain(ctx,b,visualTime);ctx.restore();}for(const v of state.stage.vines){const held=state.player.vineId===v.id;drawVine(ctx,held?{...v,endX:p.x,endY:p.y-p.h*.75}:v);if(held){ctx.save();ctx.font='bold 13px sans-serif';ctx.textAlign='center';const label='A  ◀    SWING    ▶  D   ·   W  RELEASE';const w=ctx.measureText(label).width+22;rounded(ctx,p.x-w/2,p.y-105,w,25,7,'#543b42','#f5d5a0');ctx.fillStyle='#fff1d0';ctx.fillText(label,p.x,p.y-88);ctx.restore();}}for(const q of level.checkpoints||[]){if(level.camera==='overview'){ctx.save();ctx.translate(q.x,q.y);ctx.scale(.55,.55);ctx.translate(-q.x,-q.y);drawCheckpoint(ctx,q,q.id===state.stage.checkpoint?.id,visualTime);ctx.restore();}else drawCheckpoint(ctx,q,q.id===state.stage.checkpoint?.id,visualTime);}for(const b of level.hazards)drawHazard(ctx,b);for(const o of state.shaman.objects)magic(ctx,o,visualTime);if(!level.practice||state.tutorial?.foodVisible||state.tutorial?.holeVisible){if(!level.practice||state.tutorial?.holeVisible){if(level.playerScale){mazeHole(ctx,level.hole.x,level.hole.floor,state.player.carrying,visualTime);}else hole(ctx,level.hole.x,level.hole.y,state.player.carrying,visualTime);}if((!level.practice||state.tutorial?.foodVisible)&&!state.player.carrying&&state.tutorial?.phase!=='free'&&!demo?.p.carrying){ctx.save();ctx.translate(level.acorn.x,level.acorn.y);ctx.scale(level.playerScale||1,level.playerScale||1);acorn(ctx,0,0,visualTime);ctx.restore();}}if(showRoute&&level.route){ctx.save();ctx.setLineDash([5,5]);line(ctx,level.route,'#fff0a4',2.5);if(level.wallRoute){ctx.setLineDash([2,6]);line(ctx,level.wallRoute,'#9de7ff',1.6);}ctx.setLineDash([]);ctx.restore();}
    if(demo){const g=demo.p;ctx.save();ctx.globalAlpha=.58;ctx.translate(g.x,g.y);hamster(ctx,{...g,x:0,y:0},state.tutorial.demoTime,hamsterImage,null,dt);ctx.restore();ctx.save();ctx.font='bold 13px sans-serif';ctx.textAlign='center';const label='GHOST GUIDE';rounded(ctx,g.x-55,g.y-84,110,22,7,'#437b8b','#b8f4ff');ctx.fillStyle='#e8fcff';ctx.fillText(label,g.x,g.y-68);ctx.restore();}
    if(state.tutorial?.phase==='controls')for(const [i,m] of level.jumpTargets.entries()){
      const done=state.tutorial.jumps[i],pulse=Math.sin(visualTime*4+i)*3;ctx.save();ctx.globalAlpha=done?.55:1;ellipse(ctx,m.x,m.y-3,Math.min(m.radius,37),7,done?'#bde9a2aa':'#ffe49caa');ctx.translate(m.x,m.y-90+pulse);rounded(ctx,-23,-13,46,25,9,done?'#b7d18b':'#ffe1a0','#805944');ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillStyle='#624538';ctx.fillText(done?'✓':'W · '+(i+1),0,4);line(ctx,[[0,14],[0,23]],'#ffe4ab',2);line(ctx,[[-5,19],[0,24],[5,19]],'#ffe4ab',2);ctx.restore();
    }
    if(level.farmLesson)for(const r of RESOURCE_ITEMS){if(farm.collected.includes(r.id))continue;const x=r.x,y=382+Math.sin(visualTime*3)*3;ctx.save();if(r.id==='wood'){rounded(ctx,x-13,y-14,26,14,5,'#b78050','#694a34');ellipse(ctx,x-10,y-7,5,7,'#e7bb84','#98663b');}else if(r.id==='stone'){ellipse(ctx,x,y-7,13,9,'#a6aebd','#646d83');}else{ellipse(ctx,x-5,y-9,9,5,'#9bc35e','#577c3d');ellipse(ctx,x+5,y-14,9,5,'#77a84c','#577c3d');}ctx.restore();}
    // Farm plots are also visible in the world and mirror the persistent garden panel.
    if(level.farmLesson)for(const [i,q] of level.farmPlots.entries()){rounded(ctx,q.x-48,q.y-12,96,22,7,'#75452e','#513628');const crop=farm.plots[i];ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff0c8';ctx.fillText('PLOT '+(i+1),q.x,q.y+25);if(crop){const n=farmRemaining(crop);ctx.font=n?'25px sans-serif':'35px sans-serif';ctx.fillText(n?'🌱':'🥕',q.x,q.y-15);ctx.font='bold 12px sans-serif';ctx.fillText(n?farmClock(n):'READY',q.x,q.y-51);if(n&&crop.starter&&farm.sold<5){ctx.font='bold 10px sans-serif';ctx.fillText('CLICK FOR FREE SKIP',q.x,q.y-66);}}}
    // Trail signs, foreground flowers and tiny floating dust make the world feel alive.
    for(const s of level.signs||[]){if(s.compact){ctx.save();ctx.font='bold 9px sans-serif';const sw=ctx.measureText(s.label).width+13;line(ctx,[[s.x,s.y],[s.x,s.y-19]],'#80533f',2);rounded(ctx,s.x-sw/2,s.y-31,sw,14,4,'#e5bd8a','#825642');ctx.fillStyle='#634438';ctx.textAlign='center';ctx.fillText(s.label,s.x,s.y-21);ctx.restore();continue;}line(ctx,[[s.x,s.y],[s.x,s.y-46]],'#80533f',4);rounded(ctx,s.x-Math.max(37,s.label.length*3.7),s.y-52,Math.max(74,s.label.length*7.4),21,5,'#d4a36f','#825642');ctx.fillStyle='#634438';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(s.label,s.x,s.y-38);}
    if(ghostEnabled&&!state.assisted&&state.status==='playing'&&replay){const g=sampleReplay(replay,elapsed,level.playerScale||1);if(g&&Math.hypot(g.x-p.x,g.y-p.y)>18*(p.scale||1)){ctx.save();ctx.globalAlpha=.30;ctx.translate(g.x,g.y);ctx.scale(g.scale,g.scale);drawHamsterSprite(ctx,{...g,x:0,y:0},elapsed,config,hamsterImage);ctx.restore();ctx.save();ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillStyle='#d6f9ff';ctx.strokeStyle='#5b557b';ctx.lineWidth=2;ctx.strokeText('BEST GHOST',g.x,g.y-60*g.scale);ctx.fillText('BEST GHOST',g.x,g.y-60*g.scale);ctx.restore();}}
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.scale||1,p.scale||1);hamster(ctx,{...p,x:0,y:0},elapsed,hamsterImage,hamsterAnimator,state.status==='playing'&&!ui.menuOpen()&&!changing?dt:0);if(level.farmLesson){const outfit=SHOP_ITEMS.find(i=>i.id===farm.equipped.outfit),hat=SHOP_ITEMS.find(i=>i.id===farm.equipped.hat),fur=SHOP_ITEMS.find(i=>i.id===farm.equipped.fur);if(fur){ctx.save();ctx.globalAlpha=.55;ellipse(ctx,-11,-20,8,8,fur.color);ellipse(ctx,11,-20,8,8,fur.color);ctx.restore();}if(outfit)rounded(ctx,-16,-21,32,outfit.id==='dress'?17:12,6,outfit.color,'#805b63');if(hat){ellipse(ctx,0,-42,23,5,hat.color,'#997242');rounded(ctx,-13,-53,26,12,5,hat.color,'#997242');}}ctx.restore();ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff3d8';ctx.strokeStyle='#68504e';ctx.lineWidth=3;ctx.strokeText('You',p.x,p.y-64*(p.scale||1));ctx.fillText('You',p.x,p.y-64*(p.scale||1));
    if(state.mode==='shaman'&&pointer){const pt=screenToWorld(cam,pointer.x,pointer.y),o=previewObject(state.shaman,pt.x,pt.y,p.facing);magic(ctx,o,visualTime,true,canPlace(state.shaman,o,{...level,platforms:state.stage.platforms},p));}drawParticles(ctx,particles);drawWorldSpeech(ctx,p.x,p.y-76*(p.scale||1),state.bubble,cssW,cssH,dpr,emoteImages);ctx.restore();
  }
  function frame(now){const dt=Math.min(.15,(now-last)/1000);last=now;visualTime+=dt;fps=fps*.92+(.08/Math.max(.001,dt));let steps=0;if(state.status==='playing'&&!ui.menuOpen()&&!farmUI?.isOpen()&&!changing){acc+=dt;while(acc>=STEP&&steps<10){tick();acc-=STEP;steps++;if(state.status!=='playing'){acc=0;break;}}}else{acc=0;previous={...state.player};}if(state.status!=='paused')particles=updateParticles(particles,dt);render(state.status==='playing'?acc/STEP:1,dt);ui.update(state);farmUI?.render(farm);if(ui.debugVisible())ui.debugText(debugText(state,fps,steps));requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}

boot().catch(e=>{console.error(e);document.getElementById("loading").textContent="Unable to start Animalia.";});
})();
