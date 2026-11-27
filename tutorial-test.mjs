import assert from 'node:assert/strict';
import {LEVELS,LEVEL_FILES,loadLevel} from './src/level.js';
import {DEFAULT_CONFIG,applyMovementPreset,STEP} from './src/config.js';
import {spawnPlayer,updatePlayer} from './src/player.js';
import {emptyInput} from './src/input.js';
import {createShaman,worldFor} from './src/shaman.js';
import {acornReached,homeReached} from './src/parkour.js';
import {createTutorial,advanceTutorial,advanceReveal,revealPose} from './src/tutorial.js';
const level=await loadLevel();
assert.deepEqual(LEVEL_FILES,['tutorial-01']);assert.equal(LEVELS.length,1);assert(level.practice);assert.equal(level.platforms.length,2);assert.equal(level.hazards.length,0);
for(const mode of ['classic','snappy']){
 const cfg={...DEFAULT_CONFIG};applyMovementPreset(cfg,mode);let p=spawnPlayer(level.spawn);const world=worldFor(level,createShaman(),cfg);const t=createTutorial();assert(!t.foodVisible&&!t.holeVisible);t.phase='controls';
 const step=(i={})=>{const raw={...emptyInput(),...i},old=p,result=updatePlayer(p,raw,world,cfg,STEP);p=result.player;advanceTutorial(t,level,old,p,raw,result.events,STEP);};
 const repeat=(n,i)=>{for(let j=0;j<n;j++)step(i);};
 step();repeat(135,{left:true});repeat(140,{right:true});assert(t.left>=2-1e-8&&t.right>=2-1e-8,JSON.stringify(t));
 const walkTo=(x)=>{for(let j=0;j<300&&Math.abs(x-p.x)>12;j++)step({left:p.x>x,right:p.x<x});repeat(20,{});};
 walkTo(990);assert(Math.abs(p.x-1000)<75,p.x);for(let j=0;j<65;j++)step({jump:true,jumpPressed:j===0});assert(t.jumps[0],JSON.stringify({t,p}));
 for(let j=0;j<75&&!t.jumps[1];j++)step({right:p.x<1160,jump:true,jumpPressed:j===0});assert(t.jumps[1],JSON.stringify({t,p}));assert.equal(t.phase,'reveal');
 for(let j=0;j<45;j++)advanceReveal(t,STEP);assert(t.foodVisible&&!t.holeVisible);for(let j=0;j<120;j++)advanceReveal(t,STEP);assert(t.holeVisible);for(let j=0;j<180;j++)advanceReveal(t,STEP);assert.equal(t.phase,'food');
 for(const [w,h] of [[1280,800],[390,844]]){const scale=Math.min(w/(w<h?520:850),h/510),start={x:100,y:0,scale};const first=revealPose(0,start,p,level,w,h,scale);assert.deepEqual(first,start);const food=revealPose(1,start,p,level,w,h,scale),home=revealPose(3,start,p,level,w,h,scale),end=revealPose(5.4,start,p,level,w,h,scale);assert(Math.abs((level.acorn.x-food.x)*food.scale-w/2)<.01);assert(Math.abs((level.hole.x-home.x)*home.scale-w/2)<.01);assert.equal(end.scale,scale);}
 for(let j=0;j<220&&!p.carrying;j++){step({right:true});if(acornReached(level,p))p.carrying=true;}assert(p.carrying,JSON.stringify(p));
 // Walk back, jump over the one grass block and carry the acorn home.
 let jumped=false;for(let j=0;j<650&&!homeReached(level,p);j++){const launch=!jumped&&p.x<1320&&p.onGround;if(launch)jumped=true;step({left:true,jump:jumped&&p.x>1050,jumpPressed:launch});}assert(homeReached(level,p),JSON.stringify(p));console.log('PASS: '+mode+' full tutorial: walk timers, two jump targets, reveal, acorn, home.');
}
