// All device input is normalized to a serializable object. The simulation never reads DOM events.
export const emptyInput = () => ({left:false,right:false,jump:false,roll:false,grab:false,jumpPressed:false,jumpReleased:false});
export function createInput(isChatOpen=()=>false) {
  const keys=new Set(), touches=new Set(); let press=false,release=false,oldJump=false;
  let blocked=false;
  const read=()=>({left:keys.has('ArrowLeft')||keys.has('KeyA')||touches.has('left'),right:keys.has('ArrowRight')||keys.has('KeyD')||touches.has('right'),jump:keys.has('KeyW')||touches.has('jump'),roll:keys.has('ShiftLeft')||keys.has('ShiftRight')||touches.has('roll'),grab:false});
  const edge=()=>{let j=read().jump;if(j&&!oldJump){press=true;release=false;}if(!j&&oldJump)release=true;oldJump=j;};
  const movement=new Set(['ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown',e=>{if(blocked||isChatOpen()||e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLButtonElement&&e.code==='Space')return;if(!e.repeat&&movement.has(e.code)){e.preventDefault();keys.add(e.code);edge();}});
  window.addEventListener('keyup',e=>{keys.delete(e.code);edge();});
  function clear(){keys.clear();touches.clear();press=release=oldJump=false;document.querySelectorAll('[data-touch]').forEach(b=>b.classList.remove('active'));}
  window.addEventListener('blur',clear);
  for(const b of document.querySelectorAll('[data-touch]')){const k=b.dataset.touch; const down=e=>{e.preventDefault();if(blocked||isChatOpen())return;b.setPointerCapture(e.pointerId);touches.add(k);b.classList.add('active');edge();}; const up=e=>{touches.delete(k);b.classList.remove('active');edge();};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);}
  return {setBlocked(value){blocked=value;clear();},sample(){if(blocked||isChatOpen())return emptyInput();const s={...read(),jumpPressed:press,jumpReleased:release};press=release=false;return s;},clear};
}
