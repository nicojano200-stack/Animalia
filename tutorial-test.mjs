import assert from 'node:assert/strict';
import {LEVELS,LEVEL_FILES,loadLevel} from './src/level.js';
import {DEFAULT_CONFIG,applyMovementPreset,STEP} from './src/config.js';
import {spawnPlayer,updatePlayer} from './src/player.js';
import {emptyInput} from './src/input.js';
import {createShaman,worldFor} from './src/shaman.js';
import {acornReached,homeReached} from './src/parkour.js';
import {createTutorial,advanceTutorial,advanceReveal,revealPose,advanceTerrain,TERRAIN_TASKS,buildWallDemo,wallDemoFrame,advanceWallLesson} from './src/tutorial.js';
const level=await loadLevel();
assert.deepEqual(LEVEL_FILES,['tutorial-01','tutorial-02','tutorial-03','tutorial-04']);assert.equal(LEVELS.length,4);assert(level.practice);assert.equal(level.platforms.length,2);assert.equal(level.hazards.length,0);
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

const meadow=await loadLevel('tutorial-02');assert(meadow.terrainLesson);assert.equal(meadow.platforms.length,5);assert.equal(meadow.vines.length,1);
const {createStage,stepStage}=await import('./src/parkour.js');
for(const mode of ['classic','snappy']){
 const cfg={...DEFAULT_CONFIG};applyMovementPreset(cfg,mode);const task=createTutorial(meadow);assert.equal(task.phase,'terrain-intro');task.phase='terrain';let stage=createStage(meadow),p=spawnPlayer(meadow.spawn);const shaman=createShaman();
 const tick=(i={})=>{const raw={...emptyInput(),...i},old=p;stage=stepStage(stage,meadow,p,cfg,STEP);const result=updatePlayer(p,raw,worldFor(meadow,shaman,cfg,stage),cfg,STEP);p=result.player;advanceTerrain(task,old,p,raw,result.events);};
 tick();for(let j=0;j<70&&p.vineId==null;j++)tick({jump:true,jumpPressed:j===0});assert(p.vineId!=null,'automatic vine catch '+mode+' '+JSON.stringify(p));const caughtX=p.x;for(let j=0;j<120;j++)tick({jump:true});assert(p.vineId!=null&&Math.abs(p.x-caughtX)<.01,'held W cannot release or drift');for(let j=0;j<24;j++)tick({left:true});assert(p.vineId!=null&&p.x<caughtX-25,'A swings left');const leftX=p.x;for(let j=0;j<48;j++)tick({right:true});assert(p.vineId!=null&&p.x>leftX+40,'D swings right');const rightX=p.x;for(let j=0;j<120;j++)tick();assert(p.vineId!=null&&Math.abs(p.x-rightX)<.01,'idle stays attached');tick({jump:true,jumpPressed:true,right:true});assert(task.terrainDone.vine&&p.vineId==null,'W releases vine');for(let j=0;j<20;j++){tick({right:true});assert(p.vineId==null,'no regrab after release');}
 for(let j=0;j<850&&task.phase!=='terrain-complete';j++)tick({right:true});assert.equal(task.phase,'terrain-complete',mode+' '+JSON.stringify({task,p}));assert(TERRAIN_TASKS.every(q=>task.terrainDone[q.id]));console.log('PASS: '+mode+' meadow discovery: all six features.');
}

const wall=await loadLevel('tutorial-03');assert(wall.wallLesson);assert.equal(wall.hole.x,wall.spawn.x);assert.equal(wall.hole.floor,wall.spawn.y);
for(const mode of ['classic','snappy']){const cfg={...DEFAULT_CONFIG};applyMovementPreset(cfg,mode);const demo=buildWallDemo(wall,cfg);assert(demo.jumps>=2&&demo.got&&demo.done,mode+' '+JSON.stringify({jumps:demo.jumps,got:demo.got,done:demo.done,last:demo.frames.at(-1)}));assert(wallDemoFrame(demo,0));const lesson=createTutorial(wall);assert.equal(lesson.phase,'wall-intro');lesson.phase='wall-quest';let prevJumps=0,player=spawnPlayer(wall.spawn),pickup=false;for(const frame of demo.frames){player={...frame.p,carrying:player.carrying};const events=frame.jumps>prevJumps?[{type:'wallJump'}]:[];prevJumps=frame.jumps;const event=advanceWallLesson(lesson,wall,player,events);if(event==='pickup')pickup=true;}assert(pickup);assert.equal(lesson.phase,'wall-complete');console.log('PASS: '+mode+' wall-jump ghost demonstrates '+demo.jumps+' kicks, acorn and home.');}

const {newFarm,farmAction,farmStage,CARROT_GROW_MS,CARROT_SELL,saveFarm,loadFarm}=await import('./src/economy.js');
const farmTest=newFarm();assert.equal(farmStage(farmTest),'shop-guide');assert(!farmAction(farmTest,'seed'));assert(farmAction(farmTest,'open'));for(let i=0;i<5;i++)assert(farmAction(farmTest,'seed'));assert(!farmAction(farmTest,'seed'));assert.equal(farmTest.coins,0);assert.equal(farmStage(farmTest),'plant');for(let i=0;i<5;i++)assert(farmAction(farmTest,'plot',i,1000+i));assert.equal(farmStage(farmTest),'grow');assert(!farmAction(farmTest,'plot',0,1000+CARROT_GROW_MS-1));const storage=new Map();const store={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};saveFarm(store,farmTest);const saved=loadFarm(store);for(let i=0;i<5;i++)assert(farmAction(saved,'plot',i,1004+CARROT_GROW_MS));assert.equal(farmStage(saved),'sell');for(let i=0;i<5;i++)assert(farmAction(saved,'sell'));assert.equal(saved.coins,5*CARROT_SELL);assert.equal(farmStage(saved),'done');assert(!farmAction(saved,'sell'));assert(farmAction(saved,'item','shirt'));assert.equal(saved.equipped.outfit,'shirt');assert(farmAction(saved,'seed'));console.log('PASS: shop guide, five single free purchases, five-minute persistent crops, harvest and sell, cosmetic purchase, repeat farming.');
