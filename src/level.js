// JSON maps are embedded by build-offline.py for file://; served versions use fetch.
export const LEVEL_FILES=['tutorial-01'];
export const LEVELS=/* MAP_DATA_START */ [{"id":"tutorial-01","name":"Tutorial 01","theme":"First Jump","difficulty":"Easy","practice":true,"width":1800,"height":540,"spawn":{"x":850,"y":390},"platforms":[{"id":"ground","x":0,"y":390,"w":1800,"h":150,"kind":"wood"},{"id":"jump-block","x":1100,"y":320,"w":120,"h":70,"kind":"wood"}],"hazards":[],"checkpoints":[],"vines":[],"signs":[],"acorn":{"x":1510,"y":361},"hole":{"x":270,"y":344,"floor":390},"jumpTargets":[{"x":1000,"y":390,"radius":85,"platform":"ground"},{"x":1160,"y":320,"radius":58,"platform":"jump-block"}]}] /* MAP_DATA_END */;
export const FALLBACK_LEVEL=LEVELS[0];
export async function loadLevel(id=LEVEL_FILES[0]) {
  const index=Math.max(0,LEVEL_FILES.indexOf(id));
  if(typeof location!=='undefined'&&location.protocol!=='file:'&&!globalThis.ANIMALIA_OFFLINE){try{const r=await fetch('./levels/'+LEVEL_FILES[index]+'.json');if(!r.ok)throw Error(r.status);const m=await r.json();if(!Array.isArray(m.platforms)||!m.spawn||(!m.practice&&(!m.acorn||!m.hole)))throw Error('Invalid map');return m;}catch(e){console.warn('Using bundled map',e);}}
  return structuredClone(LEVELS[index]);
}
