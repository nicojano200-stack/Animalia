import assert from 'node:assert/strict';
import {DEFAULT_CONFIG as c,STEP} from './src/config.js';
import {spawnPlayer,updatePlayer} from './src/player.js';
import {moveBody} from './src/physics.js';
import {emptyInput} from './src/input.js';
import {createShaman,previewObject,placeObject,updateShaman,worldFor} from './src/shaman.js';
import {FALLBACK_LEVEL as level} from './src/level.js';
const flat={width:2000,platforms:[{x:0,y:300,w:2000,h:35}],fans:[]};const idle=emptyInput();
const step=(p,i=idle,w=flat)=>updatePlayer(p,i,w,c,STEP).player;
let p=spawnPlayer({x:100,y:300});p=step(p);assert.equal(p.onGround,true);let original=JSON.stringify(p);let jump=step(p,{...idle,jump:true,jumpPressed:true});assert.equal(JSON.stringify(p),original);assert(jump.vy<0);let double=step(jump,{...idle,jump:true,jumpPressed:true});assert(double.vy>jump.vy);let short=step(jump,{...idle,jumpReleased:true}),long=step(jump,{...idle,jump:true});assert(short.vy>long.vy);
for(let i=0;i<60;i++)p=step(p,{...idle,right:true});assert.equal(p.vx,c.maxSpeed);let carrying={...p,carrying:true};for(let i=0;i<30;i++)carrying=step(carrying,{...idle,right:true});assert.equal(carrying.vx,c.maxSpeed*c.carrySpeedMultiplier);let rolled={...p};for(let i=0;i<60;i++)rolled=step(rolled,{...idle,right:true,roll:true});assert(rolled.vx>p.vx);
let hit=moveBody({...spawnPlayer({x:100,y:100}),vy:40000},STEP,[{x:0,y:220,w:300,h:10}]);assert.equal(hit.y,220);assert(hit.onGround);hit=moveBody({...spawnPlayer({x:100,y:300}),vy:-10000},STEP,[{x:0,y:220,w:300,h:10,oneWay:true}]);assert(hit.y<220);
let s=createShaman();const o=previewObject(s,500,200);assert(placeObject(s,o,level,spawnPlayer(level.spawn)));assert.equal(s.mana,76);updateShaman(s,c,7);assert.equal(s.objects.length,0);assert.equal(s.mana,100);
s=createShaman();s.selected=1;const spring=previewObject(s,500,200);assert(placeObject(s,spring,level,spawnPlayer(level.spawn)));hit=moveBody({...spawnPlayer({x:500,y:180}),vy:1000},STEP,worldFor(level,s,c).platforms);assert(hit.sprung);assert.equal(hit.vy,-c.springVelocity);
// Coyote time and buffered landing jump.
p={...spawnPlayer({x:100,y:220}),coyote:.08};assert(step(p,{...idle,jump:true,jumpPressed:true}).vy<0);p={...spawnPlayer({x:100,y:294}),vy:500};p=step(p,{...idle,jump:true,jumpPressed:true});assert(p.onGround);assert(step(p,{...idle,jump:true}).vy<0);
console.log('PASS: movement, purity, jump cut, no double jump, carry, roll, swept collision, one-way platforms, mana, expiry, spring, coyote, buffering.');
// Ramp surface following and fan acceleration.
const ramp={x:400,y:200,w:160,h:80,kind:'ramp'};
hit=moveBody({...spawnPlayer({x:480,y:240}),vx:300,vy:20},STEP,[ramp]);assert(hit.onGround);assert(hit.y<240);
let fanWorld={...flat,fans:[{area:{x:0,y:200,w:300,h:200},direction:1}]};assert(step(spawnPlayer({x:100,y:300}),idle,fanWorld).vx>0);
console.log('PASS: ramp surface and wind force.');
// Animation selection, including facing and carry / roll precedence.
const {hamsterPose,HAMSTER_CLIPS}=await import('./src/sprites.js');
const base={...spawnPlayer({x:100,y:300}),onGround:true};
for(const [changes,clip] of [[{},'idle'],[{vx:100},'run'],[{onGround:false,vy:-400},'jump'],[{onGround:false,vy:300},'jump'],[{squash:.25},'land'],[{carrying:true},'carry'],[{rolling:true,carrying:true},'roll']]){const pose=hamsterPose({...base,...changes,facing:-1},1.3,c);assert.equal(pose.clip,clip);assert.equal(pose.facing,-1);assert(pose.index>=0&&pose.index<HAMSTER_CLIPS[clip].count);}
console.log('PASS: sprite states, frame bounds and left-facing mirror.');
// Wall slide cap, kick, no extra airborne jump, and complete parkour route.
const shaft={width:1000,fans:[],platforms:[{x:200,y:0,w:70,h:500}]};
let wall={...spawnPlayer({x:181,y:240}),vy:500};wall=step(wall,{...idle,right:true},shaft);assert(wall.wallSliding);assert(wall.vy<=c.wallSlideSpeed);const kicked=step(wall,{...idle,right:true,jump:true,jumpPressed:true},shaft);assert(kicked.vx<0&&kicked.vy<0&&kicked.wallLock>0);const again=step(kicked,{...idle,jump:true,jumpPressed:true},shaft);assert(again.vy>kicked.vy);
const oneWayWall={...shaft,platforms:[{...shaft.platforms[0],oneWay:true}]};assert(!step(wall,{...idle,right:true},oneWayWall).wallSliding);
console.log('PASS: wall slide and kick, no phantom one-way wall.');
// v0.4: actual dynamic stage state, special terrain, vines and saved records.
const {LEVELS}=await import('./src/level.js');
const {createStage,stepStage,checkpointAt,recordTime,bestTime}=await import('./src/parkour.js');
const {makeBubble,tickBubble,wrapBubble}=await import('./src/bubbles.js');
const {filterChat}=await import('./src/emotes.js');
const fs=await import('node:fs/promises');
for(const [i,file] of ['tutorial-01','tutorial-02','tutorial-03'].entries())assert.deepEqual(LEVELS[i],JSON.parse(await fs.readFile(new URL('./levels/'+file+'.json',import.meta.url),'utf8')));
let testLevel={width:1200,platforms:[{id:'move',x:100,y:300,w:160,h:20,oneWay:true,kind:'moving',motion:{x:40,y:35,period:2}},{id:'crumble',x:420,y:300,w:120,h:20,kind:'crumble',oneWay:true}],vines:[],checkpoints:[{x:480,y:300,id:'flag'}]};
let stage=createStage(testLevel),rider={...spawnPlayer({x:180,y:300}),onGround:true,groundId:'move'};
for(let i=0;i<150;i++){stage=stepStage(stage,testLevel,rider,c,STEP);rider=step(rider,idle,worldFor(testLevel,createShaman(),c,stage));const moving=stage.platforms[0];assert(rider.onGround,'moving platform retained rider');assert(Math.abs(rider.x-moving.x-80)<.01);assert(Math.abs(rider.y-moving.y)<.01);}
let cr={...spawnPlayer({x:480,y:300}),groundId:'crumble',onGround:true};assert.equal(checkpointAt(stage,testLevel,cr).id,'flag');for(let i=0;i<Math.ceil(c.crumbleDelay/STEP)+2;i++)stage=stepStage(stage,testLevel,cr,c,STEP);assert(!stage.platforms.some(b=>b.id==='crumble'));assert(stage.debris.length===1);let fallen=step(cr,idle,worldFor(testLevel,createShaman(),c,stage));assert(!fallen.onGround);for(let i=0;i<Math.ceil(c.crumbleRespawn/STEP)+2;i++)stage=stepStage(stage,testLevel,fallen,c,STEP);assert(stage.platforms.some(b=>b.id==='crumble'));
const surface=kind=>({width:2000,fans:[],platforms:[{id:'surface',x:0,y:300,w:2000,h:35,kind,direction:1}]});
const surfacePlayer={...spawnPlayer({x:100,y:300}),groundId:'surface',onGround:true,vx:200};assert(step(surfacePlayer,idle,surface('ice')).vx>step(surfacePlayer,idle,surface('wood')).vx);let sticky={...surfacePlayer,vx:0};for(let i=0;i<40;i++)sticky=step(sticky,{...idle,right:true},surface('honey'));assert.equal(sticky.vx,c.maxSpeed*c.honeySpeed);assert(step({...surfacePlayer,vx:0},idle,surface('conveyor')).x>100);
const vineWorld={width:1000,platforms:[],fans:[],vines:[{id:0,x:250,y:55,length:145,endX:250,endY:200,angle:0}]};let climber=spawnPlayer({x:250,y:232});climber=step(climber,{...idle,jump:true,jumpPressed:true},vineWorld);assert.equal(climber.vineId,0);for(let i=0;i<180;i++)climber=step(climber,{...idle,jump:true},vineWorld);assert(climber.vineId===0&&Math.abs(climber.x-250)<.01);for(let i=0;i<20;i++)climber=step(climber,{...idle,left:true},vineWorld);assert(climber.x<225&&climber.vineId===0);for(let i=0;i<45;i++)climber=step(climber,{...idle,right:true},vineWorld);assert(climber.x>250&&climber.vineId===0);const hangX=climber.x;for(let i=0;i<120;i++)climber=step(climber,idle,vineWorld);assert(climber.vineId===0&&Math.abs(climber.x-hangX)<.01);assert(Math.abs(Math.hypot(climber.x-250,climber.y-climber.h*.75-55)-145)<.001);climber=step(climber,{...idle,jump:true,jumpPressed:true,right:true},vineWorld);assert.equal(climber.vineId,null);assert(climber.vy<0&&climber.vx>0&&climber.vineDetached);for(let i=0;i<90;i++){climber=step(climber,idle,vineWorld);assert.equal(climber.vineId,null);}
const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};assert.equal(bestTime(storage,'a'),null);assert(recordTime(storage,'a',15).newRecord);assert(!recordTime(storage,'a',18).newRecord);assert(recordTime(storage,'a',12).newRecord);assert.equal(bestTime(storage,'a'),12);assert.equal(bestTime(storage,'b'),null);
let message=makeBubble('Hello');assert.equal(tickBubble(message,4.9).text,'Hello');assert.equal(tickBubble(message,5),null);assert.equal(makeBubble('👋',true).emoji,true);assert(wrapBubble('x'.repeat(100),s=>s.length*10,40,4).at(-1).endsWith('…'));assert(wrapBubble('hello world',s=>s.length*10,60).every(s=>s.length<=6));assert.equal(filterChat(' shit '),'••••');
console.log('PASS: moving-platform riders, crumble fall/restore, checkpoint, ice, honey, conveyor, vine attach/release, record isolation, bubble duration/wrapping/filter, JSON consistency.');

// Chat text limit, three-line wrapping and seamless cloud wrapping.
const {cloudDriftX}=await import('./src/background.js');
assert.equal(Array.from(filterChat('🐹'.repeat(90))).length,80);
assert.equal(wrapBubble('x'.repeat(80),s=>s.length*10,40).length,3);
assert(wrapBubble('x'.repeat(80),s=>s.length*10,40).at(-1).endsWith('…'));
for(const w of [390,1280]){const cw=170,v=4,period=(w+cw+24)/v;for(const t of [0,1,20,100])assert(Math.abs(cloudDriftX(t,w,cw,.2,v)-cloudDriftX(t+period,w,cw,.2,v))<1e-8);const wrap=(w+12-.2*w)/v;assert(cloudDriftX(wrap-.001,w,cw,.2,v)>w);assert(cloudDriftX(wrap+.001,w,cw,.2,v)+cw<0);}
console.log('PASS: 80-character Unicode limit, three-line bubbles, seamless offscreen cloud wrap.');
// v0.6: continuous renderer-only animation, independent of the simulation clock.
const {createHamsterAnimator,advanceHamsterAnimation,resetHamsterAnimator}=await import('./src/sprites.js');
const {readFileSync}=await import('node:fs');
const atlas=readFileSync(new URL('./assets/hamster-smooth.png',import.meta.url));
assert.equal(atlas.readUInt32BE(16),3072);assert.equal(atlas.readUInt32BE(20),576);
const anim=createHamsterAnimator(), still={...base,vx:0,vy:0,squash:0};
const stillBefore=JSON.stringify(still);const idleFrames=new Set();
for(let i=0;i<159;i++)idleFrames.add(advanceHamsterAnimation(anim,still,c,1/60).index);
assert(idleFrames.size>=30);assert.equal(JSON.stringify(still),stillBefore);
const idleA=hamsterPose(still,0,c),idleB=hamsterPose(still,2.65,c);assert.equal(idleA.index,idleB.index);assert(Math.abs(idleA.sy-idleB.sy)<1e-9);
const running={...still,vx:c.maxSpeed};advanceHamsterAnimation(anim,running,c,1/60);assert.equal(anim.pose.clip,'run');assert(anim.from&&anim.blend<1);
for(let i=0;i<10;i++)advanceHamsterAnimation(anim,running,c,1/60);assert.equal(anim.from,null);
const jumpP={...running,onGround:false,vy:-c.jumpVelocity};advanceHamsterAnimation(anim,jumpP,c,1/60);assert.equal(anim.pose.clip,'jump');
const fallP={...jumpP,vy:420};advanceHamsterAnimation(anim,fallP,c,1/60);assert(anim.pose.index>12);
advanceHamsterAnimation(anim,{...still,squash:.18},c,1/60);assert.equal(anim.pose.clip,'land');for(let i=0;i<12;i++)advanceHamsterAnimation(anim,still,c,1/60);assert.equal(anim.pose.clip,'idle');
advanceHamsterAnimation(anim,{...running,facing:-1},c,1/60);for(let i=0;i<6;i++)advanceHamsterAnimation(anim,{...running,facing:-1},c,1/60);assert.equal(anim.pose.facing,-1);
const a60=createHamsterAnimator(),a120=createHamsterAnimator();for(let i=0;i<60;i++)advanceHamsterAnimation(a60,running,c,1/60);for(let i=0;i<120;i++)advanceHamsterAnimation(a120,running,c,1/120);assert(Math.abs(a60.phase-a120.phase)<1e-8);
assert.equal(hamsterPose({...jumpP,carrying:true},0,c).clip,'carry');assert.equal(hamsterPose({...jumpP,carrying:true,rolling:true},0,c).clip,'roll');
resetHamsterAnimator(anim);assert.equal(anim.pose,null);assert.equal(anim.from,null);assert.equal(anim.phase,0);
console.log('PASS: 32-sample idle loop, smooth run/air/landing transitions, turning, carrying, 60/120Hz phase parity, reset, and render-state purity.');

const {EMOTES,emoteAsset}=await import('./src/emotes.js');
const {makeEmoteBubble}=await import('./src/bubbles.js');
assert.equal(EMOTES.length,10);assert.equal(new Set(EMOTES.map(x=>x[0])).size,10);
for(const [face,name] of EMOTES){const png=readFileSync(new URL('./'+emoteAsset(face),import.meta.url));assert.equal(png.readUInt32BE(16),192);assert.equal(png.readUInt32BE(20),192);assert.equal(png[25],6);const b=makeEmoteBubble(face,name);assert.equal(b.face,face);assert.equal(b.text,name);assert.deepEqual(JSON.parse(JSON.stringify(b)),b);assert.equal(tickBubble(b,5),null);}
assert.equal(makeBubble('new chat').face,undefined);
console.log('PASS: ten emote shortcuts, ten transparent PNGs, serializable bubble and expiry.');

// v1.2: supplied movement preset, integrated into the existing feet-based engine.
const {SNAPPY_MOVEMENT,applyMovementPreset}=await import('./src/config.js');
const snappy={...c};assert(applyMovementPreset(snappy,'snappy'));assert.equal(snappy.maxSpeed,260);assert.equal(snappy.airDrag,150);assert.equal(snappy.wallJumpVelocity,520);assert.equal(snappy.springVelocity,c.springVelocity);assert.equal(snappy.carrySpeedMultiplier,c.carrySpeedMultiplier);
const snStep=(p,i=idle,w=flat)=>updatePlayer(p,i,w,snappy,STEP).player;
let sp=snStep(spawnPlayer({x:100,y:300}));for(let i=0;i<60;i++)sp=snStep(sp,{...idle,right:true});assert.equal(sp.vx,260);
const initial=snStep(sp,{...idle,jump:true,jumpPressed:true});assert(initial.vy<0);assert.equal(initial.vy,-560+1500*STEP);
const shortHop=snStep(initial,idle),fullHop=snStep(initial,{...idle,jump:true});assert(Math.abs(shortHop.vy-initial.vy-1500*2.2*STEP)<1e-8);assert.equal(fullHop.vy-initial.vy,1500*STEP);
const fall=snStep({...spawnPlayer({x:100,y:100}),vy:100});assert.equal(fall.vy,100+1500*1.15*STEP);
const gliding=snStep({...spawnPlayer({x:100,y:100}),vx:100});assert.equal(gliding.vx,100-150*STEP);
const near={...spawnPlayer({x:179.5,y:240}),vy:500};const snSlide=snStep(near,{...idle,right:true},shaft);assert(snSlide.wallSliding);assert(snSlide.vy<=90);const snKick=snStep(snSlide,{...idle,jump:true,jumpPressed:true,right:true},shaft);assert.equal(snKick.vx,-300);assert.equal(snKick.vy,-520+1500*STEP);assert(snKick.wallLock>0);const snRepeat=snStep(snKick,{...idle,jump:true,jumpPressed:true},shaft);assert(snRepeat.vy>snKick.vy);
assert(applyMovementPreset(snappy,'classic'));assert.deepEqual(snappy,c);assert.equal(applyMovementPreset(snappy,'unknown'),false);
console.log('PASS: supplied movement preset, gradual jump cut, fall multiplier, air drag, wall probe, wall kick, lock, and exact restoration of classic tuning.');
