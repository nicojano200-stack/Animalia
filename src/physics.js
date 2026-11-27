export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const approach=(n,target,delta)=>n<target?Math.min(n+delta,target):Math.max(n-delta,target);
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const bodyRect=p=>({x:p.x-p.w/2,y:p.y-p.h,w:p.w,h:p.h});
const EPS=0.001;
// Axis-separated swept crossings: movement is clipped to the first crossed face.
// One-way ledges only catch downward movement from above, never sides or ceilings.
export function moveBody(p,dt,platforms){
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
export function wallContact(p,platforms,distance=.8){
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
export function wallHasIce(p,platforms,side){return !!side&&platforms.some(b=>b.iceSide===(side===1?'left':'right')&&!b.oneWay&&b.kind!=='ramp'&&Math.min(p.y,b.y+b.h)-Math.max(p.y-p.h,b.y)>=6&&Math.abs(side===1?p.x+p.w/2-b.x:p.x-p.w/2-b.x-b.w)<.8);}
