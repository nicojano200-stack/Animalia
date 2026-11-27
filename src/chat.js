// A single chatOpen flag owns keyboard focus and gameplay input isolation.
import {filterChat} from './emotes.js';
export function createChat({canOpen,onOpen,clearInput,onSend}){
  const form=document.getElementById('chatForm'), field=document.getElementById('chatInput');
  const log=document.getElementById('chatLog'), toggle=document.getElementById('chatToggle');
  let chatOpen=false, openingSlash=null;
  const focus=()=>field.focus({preventScroll:true});
  const limit=()=>{if(Array.from(field.value).length>80)field.value=Array.from(field.value).slice(0,80).join('');};
  function open(){if(chatOpen){focus();return;}if(!canOpen())return;chatOpen=true;clearInput();onOpen();form.hidden=false;field.value='';focus();}
  function close(){if(!chatOpen)return;chatOpen=false;form.hidden=true;field.value='';field.blur();clearInput();}
  function send(){if(!chatOpen)return;const message=filterChat(field.value);close();if(!message)return;onSend(message);const row=document.createElement('div'),name=document.createElement('b');name.textContent='You: ';row.append(name,document.createTextNode(message));log.append(row);while(log.children.length>5)log.firstChild.remove();}
  form.addEventListener('submit',e=>{e.preventDefault();send();});
  field.addEventListener('input',e=>{if(!e.isComposing)limit();});
  field.addEventListener('compositionend',limit);
  toggle.addEventListener('click',()=>chatOpen?close():open());
  // Capture runs before all gameplay key handlers. Stop propagation but retain
  // native text editing (letters, spaces, Shift, digits, paste, IME).
  window.addEventListener('keydown',e=>{
    if(!chatOpen){
      if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.isComposing||!canOpen()||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target?.isContentEditable)return;
      e.preventDefault();e.stopImmediatePropagation();openingSlash=e.code;open();return;
    }
    e.stopImmediatePropagation();
    if(e.code===openingSlash&&e.repeat){e.preventDefault();return;}
    if(['Tab','F1','F2'].includes(e.code)){e.preventDefault();return;}
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(!e.repeat)send();}
  },true);
  window.addEventListener('keyup',e=>{if(e.code===openingSlash)openingSlash=null;if(chatOpen)e.stopImmediatePropagation();},true);
  // Clicking the canvas or other game controls cannot steal focus or place magic.
  for(const type of ['pointerdown','mousedown','click'])document.addEventListener(type,e=>{
    if(!chatOpen||form.contains(e.target)||toggle.contains(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();focus();
  },true);
  window.addEventListener('blur',()=>{openingSlash=null;clearInput();});
  return {open,close,isOpen:()=>chatOpen};
}
