import {approach,clamp,moveBody,overlaps,bodyRect,wallContact,wallHasIce} from './physics.js';
export function spawnPlayer(spawn,scale=1){return {x:spawn.x,y:spawn.y,vx:0,vy:0,w:38*scale,h:43*scale,scale,onGround:false,coyote:0,jumpBuffer:0,jumpActive:false,carrying:false,rolling:false,facing:1,rotation:0,squash:0,walk:0,wallSide:0,wallGrace:0,lastWall:0,wallSliding:false,wallLock:0,groundId:null,vineId:null,vineCooldown:0,vineAngle:0,vineAngularVelocity:0,vineReleaseReady:false,vineDetached:false};}
// Pure update: previous state + normalized input + serializable world snapshot + tuning.
// No canvas, DOM, clock, audio, randomness, or mutation. Returns state and event data.
export function updatePlayer(previous,input,world,c,dt){
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
