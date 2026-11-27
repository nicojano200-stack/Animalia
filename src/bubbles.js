// One serializable slot: chat and emotes replace each other.
export function makeBubble(text,emoji=false){return {text,emoji,age:0,duration:5};}
export function makeEmoteBubble(face,name){return {...makeBubble(name,true),face};}
export function tickBubble(b,dt){return b&&b.age+dt<b.duration?{...b,age:b.age+dt}:null;}
export function wrapBubble(text,measure,maxWidth=216,maxLines=3){
  const words=String(text).trim().split(/\s+/u);const rows=[];let row='';
  for(const word of words){const joined=row?row+' '+word:word;if(measure(joined)<=maxWidth){row=joined;continue;}if(row){rows.push(row);row='';}for(const ch of Array.from(word)){if(row&&measure(row+ch)>maxWidth){rows.push(row);row='';}row+=ch;}}
  if(row)rows.push(row);if(rows.length>maxLines){rows.length=maxLines;let last=rows[maxLines-1];while(last&&measure(last+'…')>maxWidth)last=Array.from(last).slice(0,-1).join('');rows[maxLines-1]=last+'…';}return rows.length?rows:[''];
}
// Called while the same world-to-canvas transform used by the hamster is active.
// Project the interpolated head anchor, then draw at stable CSS-pixel text size.
export function drawWorldSpeech(ctx,worldX,worldY,b,w,h,dpr,emoteImages){
  if(!b)return;const m=ctx.getTransform();const x=(m.a*worldX+m.c*worldY+m.e)/dpr,y=(m.b*worldX+m.d*worldY+m.f)/dpr;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);drawSpeech(ctx,x,y,b,w,h,emoteImages);ctx.restore();
}
export function drawSpeech(ctx,x,y,b,w,h,emoteImages){
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
