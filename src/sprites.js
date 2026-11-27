// Presentation only. Never mutates the player, hitbox, input or fixed-step clock.
// The original 96px artwork is retained; the smooth atlas has four samples per pose.
const CELL=96, SUB=4, SCALE=.72, TAU_SPRITE=Math.PI*2;
const clip=(row,poses,loop)=>Object.freeze({row,poses,count:poses*SUB,loop});
export const HAMSTER_CLIPS=Object.freeze({idle:clip(0,8,true),run:clip(1,8,true),jump:clip(2,7,false),land:clip(3,4,false),roll:clip(4,3,true),carry:clip(5,8,true)});
const unit=v=>Math.min(1,Math.max(0,v));
const mix=(a,b,t)=>a+(b-a)*t;
const mod=(v,n)=>((v%n)+n)%n;
const damp=(a,b,dt,k)=>mix(a,b,1-Math.exp(-k*dt));
const smooth=v=>{v=unit(v);return v*v*(3-2*v);};
export function loadHamsterSprites(){const image=new Image();image.src=globalThis.ANIMALIA_SPRITES||'./assets/hamster-smooth.png';return image;}
// Pure pose selection. phase is an independent locomotion cycle, optional for tools/tests.
export function hamsterPose(p,t,c,phase=mod((p.walk||0)/5,1),landAge=null){
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
export function createHamsterAnimator(){return {phase:0,time:0,landAge:Infinity,ground:null,pose:null,from:null,blend:1,turn:1,turnFrom:1,turnTo:1,turnAge:.09,lastX:null,lastY:null,lastVy:0,buffer:null};}
export function resetHamsterAnimator(a){Object.assign(a,createHamsterAnimator(),{buffer:a.buffer});}
export function advanceHamsterAnimation(a,p,c,dt){
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
export function drawHamsterSprite(ctx,p,t,c,img,animator=null,dt=1/60){
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
