// Fixed-step tutorial progress, independent of the renderer and DOM.
export const WALK_SECONDS=2;
export const REVEAL_SECONDS=5.4;
export function createTutorial(){return {phase:'intro',left:0,right:0,jumps:[false,false],airborneJump:false,revealTime:0,foodVisible:false,holeVisible:false};}
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
