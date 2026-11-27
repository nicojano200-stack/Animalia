import {spawnPlayer,updatePlayer} from './player.js';
import {emptyInput} from './input.js';
import {acornReached,homeReached} from './parkour.js';
import {STEP} from './config.js';
// Fixed-step tutorial progress, independent of the renderer and DOM.
export const WALK_SECONDS=2;
export const REVEAL_SECONDS=5.4;
export const TERRAIN_TASKS=[{"id":"vine","label":"Vine","hint":"Jump to catch it. Stay attached, hold A/D to swing, then press W again to jump off."},{"id":"grass","label":"Grass","hint":"Walk on normal ground."},{"id":"ice","label":"Ice","hint":"Slippery! Watch your momentum."},{"id":"spring","label":"Trampoline","hint":"Bounce high on the purple pad."},{"id":"chocolate","label":"Chocolate","hint":"Sticky ground slows you down."},{"id":"wood","label":"Wood","hint":"Walk on solid wooden ground."}];
export function createTutorial(level){return {phase:level?.farmLesson?'farm':level?.wallLesson?'wall-intro':level?.terrainLesson?'terrain-intro':'intro',wallJumps:0,demoTime:0,terrainDone:{},vineGrabbed:false,left:0,right:0,jumps:[false,false],airborneJump:false,revealTime:0,foodVisible:!!level?.wallLesson,holeVisible:!!level?.wallLesson};}
export function advanceTutorial(t,level,prev,p,input,events,dt){
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
export function advanceReveal(t,dt){
  if(t.phase!=='reveal')return;
  t.revealTime=Math.min(REVEAL_SECONDS,t.revealTime+dt);
  t.foodVisible=t.revealTime>=.7;
  t.holeVisible=t.revealTime>=2.6;
  if(t.revealTime>=REVEAL_SECONDS-1e-8){t.phase='food';t.foodVisible=t.holeVisible=true;}
}
export function revealPose(t,start,player,level,w,h,baseScale){
  const focus=(x,y,scale)=>({scale,x:x-w/(2*scale),y:y-h*.55/scale});
  const endW=w/baseScale,endH=h/baseScale;
  const end={scale:baseScale,x:Math.max(0,Math.min(Math.max(0,level.width-endW),player.x-endW*.43)),y:endH>level.height?(level.height-endH)/2:Math.max(0,Math.min(level.height-endH,player.y-endH*.70))};
  const food=focus(level.acorn.x,level.acorn.y,baseScale*1.26),home=focus(level.hole.x,level.hole.y+20,baseScale*1.26);
  const keys=[[0,start],[.7,food],[1.65,food],[2.6,home],[3.55,home],[REVEAL_SECONDS,end]];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,A]=keys[i-1],[b,B]=keys[i];let f=Math.max(0,Math.min(1,(t-a)/(b-a)));f=f*f*(3-2*f);return {scale:A.scale+(B.scale-A.scale)*f,x:A.x+(B.x-A.x)*f,y:A.y+(B.y-A.y)*f};}
  return end;
}

export function advanceTerrain(t,prev,p,input,events){
 if(t.phase!=='terrain')return;
 if(p.vineId!=null)t.vineGrabbed=true;
 if(t.vineGrabbed&&prev.vineId!=null&&p.vineId==null&&events.some(e=>e.type==='jump'))t.terrainDone.vine=true;
 if(p.onGround&&['grass','ice','chocolate','wood'].includes(p.groundId)&&Math.abs(p.x-prev.x)>.05&&(input.left||input.right))t.terrainDone[p.groundId]=true;
 if(p.groundId==='spring'&&events.some(e=>e.type==='spring'))t.terrainDone.spring=true;
 if(TERRAIN_TASKS.every(q=>t.terrainDone[q.id]))t.phase='terrain-complete';
}

// Generate a real physics replay of the lesson, independent of the player.
// The ghost never collides with the live player or takes their acorn.
export function buildWallDemo(level,cfg){
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
export function wallDemoFrame(demo,time){if(!demo?.frames.length)return null;const i=Math.min(demo.frames.length-1,Math.max(0,Math.floor(time*60*.75)));return demo.frames[i];}
export function advanceWallLesson(t,level,p,events){
 if(t.phase!=='wall-quest')return null;
 t.wallJumps+=events.filter(e=>e.type==='wallJump').length;
 if(!p.carrying&&t.wallJumps>=2&&acornReached(level,p)){p.carrying=true;t.foodVisible=false;return 'pickup';}
 if(homeReached(level,p)){t.phase='wall-complete';return 'complete';}
 return null;
}
