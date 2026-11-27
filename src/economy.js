// Persistent, local beginner economy. All transactions are single-item.
export const CARROT_GROW_MS=300000;
export const CARROT_SELL=10;
export const STARTER_SEEDS=5;
export const SHOP_ITEMS=[
 {id:'shirt',category:'cosmetics',slot:'outfit',name:'Meadow shirt',icon:'👕',price:20,color:'#6eaad6'},
 {id:'dress',category:'cosmetics',slot:'outfit',name:'Petal dress',icon:'👗',price:30,color:'#df8fae'},
 {id:'hat',category:'cosmetics',slot:'hat',name:'Straw hat',icon:'👒',price:25,color:'#f0c477'},
 {id:'cream',category:'fur',slot:'fur',name:'Cream fur',icon:'●',price:35,color:'#f6e7c6'},
 {id:'brown',category:'fur',slot:'fur',name:'Cocoa fur',icon:'●',price:35,color:'#946747'},
 {id:'gold',category:'fur',slot:'fur',name:'Golden fur',icon:'●',price:45,color:'#e8b85d'}];
export function newFarm(){return {coins:0,seeds:0,starterBought:0,carrots:0,sold:0,planted:0,harvested:0,shopSeen:false,plots:[null,null,null,null,null],owned:[],equipped:{},resources:{},collected:[]};}
export function loadFarm(storage){try{const raw=JSON.parse(storage.getItem('animalia.farm.v1')||'null');if(raw&&Array.isArray(raw.plots)&&raw.plots.length===5)return {...newFarm(),...raw};}catch{}return newFarm();}
export function saveFarm(storage,f){try{storage.setItem('animalia.farm.v1',JSON.stringify(f));}catch{}}
export function farmStage(f){return !f.shopSeen?'shop-guide':f.starterBought<5?'buy':f.planted<5?'plant':f.harvested<5?'grow':f.sold<5?'sell':'done';}
export const INVENTORY_CAPACITY=20, STACK_SIZE=99;
export const RESOURCE_ITEMS=[{id:'wood',name:'Wood',category:'resources',price:2,x:170},{id:'stone',name:'Stone',category:'resources',price:3,x:540},{id:'leaf',name:'Meadow leaf',category:'resources',price:2,x:1280}];
export function inventoryItems(f){const all=[{id:'seed',name:'Carrot seed',category:'seeds',quantity:f.seeds},{id:'carrot',name:'Carrot',category:'crops',quantity:f.carrots},...RESOURCE_ITEMS.map(i=>({...i,quantity:f.resources?.[i.id]||0})),...SHOP_ITEMS.filter(i=>f.owned.includes(i.id)).map(i=>({...i,quantity:1}))];return all.filter(i=>i.quantity>0);}
export function inventoryStacks(f,filter='all',sort='category'){const rows=inventoryItems(f).filter(i=>filter==='all'||i.category===filter);rows.sort((a,b)=>sort==='quantity'?b.quantity-a.quantity||a.name.localeCompare(b.name):sort==='name'?a.name.localeCompare(b.name):a.category.localeCompare(b.category)||a.name.localeCompare(b.name));return rows.flatMap(i=>Array.from({length:Math.ceil(i.quantity/STACK_SIZE)},(_,n)=>({...i,quantity:Math.min(STACK_SIZE,i.quantity-n*STACK_SIZE),stack:n,key:i.id+':'+n})));}
export function canStore(f,id){const rows=inventoryItems(f);const q=rows.find(i=>i.id===id)?.quantity||0;return q%STACK_SIZE!==0||inventoryStacks(f).length<INVENTORY_CAPACITY;}
export function itemArt(id,color=''){const name=SHOP_ITEMS.find(i=>i.id===id&&i.category==='fur')?'fur':id;return '<svg class="animal-icon item-art" viewBox="0 0 72 72" aria-hidden="true" '+(color?'style="color:'+color+'"':'')+'><use href="#'+name+'"/></svg>';}
export function farmAction(f,action,arg,now=Date.now()){
 if(action==='open'){f.shopSeen=true;return true;}
 if(action==='collect'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||f.collected.includes(arg)||!canStore(f,arg))return false;f.resources[arg]=(f.resources[arg]||0)+1;f.collected.push(arg);return true;}
 if(action==='sellResource'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||!f.resources[arg])return false;f.resources[arg]--;f.coins+=item.price;return true;}
 if(action==='seed'){if(!f.shopSeen||!canStore(f,'seed'))return false;if(f.starterBought<5){f.starterBought++;f.seeds++;return true;}if(f.sold>=5&&f.coins>=3){f.coins-=3;f.seeds++;return true;}return false;}
 if(action==='plot'){if(!Number.isInteger(arg)||arg<0||arg>=5||f.starterBought<5)return false;const p=f.plots[arg];if(!p&&f.seeds>0){f.seeds--;f.planted++;f.plots[arg]={readyAt:now+CARROT_GROW_MS};return true;}if(p&&now>=p.readyAt&&canStore(f,'carrot')){f.plots[arg]=null;f.carrots++;f.harvested++;return true;}return false;}
 if(action==='sell'){if(f.carrots<1)return false;f.carrots--;f.sold++;f.coins+=CARROT_SELL;return true;}
 if(action==='item'){const item=SHOP_ITEMS.find(i=>i.id===arg);if(!item)return false;if(!f.owned.includes(item.id)){if(f.coins<item.price||!canStore(f,item.id))return false;f.coins-=item.price;f.owned.push(item.id);}f.equipped[item.slot]=f.equipped[item.slot]===item.id?null:item.id;return true;}
 return false;
}
export function farmRemaining(p,now=Date.now()){return p?Math.max(0,Math.ceil((p.readyAt-now)/1000)):0;}
export function farmClock(n){return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
export function createFarmUI(actions){
 const el=id=>document.getElementById(id);let tab='character',filter='all',sort='category',selected='',lastKey='';
 const shop=el('shopPanel'),garden=el('gardenPanel'),inventory=el('inventoryPanel'),shopButton=el('shopToggle');
 const panels=[shop,garden,inventory],isOpen=()=>panels.some(p=>!p.hidden);
 function sync(){el('game').classList.toggle('economy-open',isOpen());el('game').classList.toggle('inventory-open',!inventory.hidden);el('game').classList.toggle('shop-open',!shop.hidden);actions.block(isOpen());lastKey='';}
 function close(panel){if(panel)panel.hidden=true;else panels.forEach(p=>p.hidden=true);sync();}
 function open(panel){actions.beforeOpen?.();if(panel===inventory){inventory.hidden=false;garden.hidden=true;if(innerWidth<1050)shop.hidden=true;}else if(panel===shop){shop.hidden=false;garden.hidden=true;if(innerWidth<1050)inventory.hidden=true;}else{panels.forEach(p=>p.hidden=p!==garden);}sync();}
 function transact(action,arg){if(actions.change(action,arg)){lastKey='';render(actions.state());return true;}return false;}
 shopButton.onclick=()=>{if(!actions.active())return;if(!shop.hidden){close(shop);return;}transact('open');tab=farmStage(actions.state())==='buy'?'seeds':'character';open(shop);render(actions.state());};
 el('gardenToggle').onclick=()=>{if(!actions.active()||el('gardenToggle').disabled)return;if(!garden.hidden){close(garden);return;}open(garden);render(actions.state());};
 el('inventoryToggle').onclick=()=>{if(!actions.active()||el('inventoryToggle').disabled)return;if(!inventory.hidden){close(inventory);return;}open(inventory);render(actions.state());};
 el('closeShop').onclick=()=>close(shop);el('closeGarden').onclick=()=>close(garden);el('closeInventory').onclick=()=>close(inventory);
 el('shopTabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){tab=b.dataset.category;lastKey='';render(actions.state());}};
 el('shopItems').onclick=e=>{const b=e.target.closest('[data-buy]');if(b)transact(b.dataset.buy,b.dataset.item);};
 el('gardenPlots').onclick=e=>{const b=e.target.closest('[data-plot]');if(b)transact('plot',Number(b.dataset.plot));};
 el('sellCarrot').onclick=()=>transact('sell');
 el('inventoryFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;selected='';lastKey='';render(actions.state());}};
 el('inventorySort').onchange=e=>{sort=e.target.value;lastKey='';render(actions.state());};
 el('inventorySlots').onclick=e=>{const b=e.target.closest('[data-slot]');if(b){selected=b.dataset.slot;lastKey='';render(actions.state());}};
 el('inventoryDetails').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='useSeed'){open(garden);render(actions.state());}else transact(b.dataset.action,b.dataset.item);};
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&isOpen()){e.preventDefault();e.stopImmediatePropagation();close();}},true);
 function render(f){
  const active=actions.active(),stage=farmStage(f),guide=active&&stage==='shop-guide';
  el('game').classList.toggle('farm-hud',active);
  el('economyBar').hidden=!active;el('shopGuide').hidden=!guide;shopButton.classList.toggle('guided',guide);el('coinBalance').textContent=f.coins;el('shopBalance').textContent=f.coins;el('gardenToggle').disabled=stage==='shop-guide'||stage==='buy';el('inventoryToggle').disabled=guide;
  if(!active){if(isOpen())close();return;}
  // Only rebuild interactive cards when their data changes. Crop timers update separately.
  if(!garden.hidden)for(const b of el('gardenPlots').querySelectorAll('[data-plot]')){const p=f.plots[Number(b.dataset.plot)],n=farmRemaining(p);if(p&&n){b.querySelector('small').textContent=farmClock(n);}else if(p&&b.disabled&&n===0){lastKey='';}}
  const key=JSON.stringify([f,tab,filter,sort,selected,...panels.map(p=>p.hidden)]);if(lastKey===key)return;lastKey=key;
  const coin='<i class="paw-coin"></i>';
  if(!shop.hidden){
    for(const b of el('shopTabs').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.category===tab);
    const target=el('shopItems');
    if(tab==='character')target.innerHTML='<div class="shop-empty"><div class="shop-hero">'+itemArt('paw')+'</div><h3>Animal characters</h3><p>New friends are coming to Animalia.</p><span class="coming-soon">Coming soon!</span></div>';
    else if(tab==='seeds'){const left=5-f.starterBought,starter=left>0,allowed=starter||f.sold>=5;target.innerHTML='<article class="shop-item seed-card"><div class="shop-item-icon">'+itemArt('seed')+'</div><div><small class="item-rarity">BEGINNER · FARMING</small><h3>Carrot seed</h3><p>5 minute growth · Sell for '+CARROT_SELL+' coins</p><small>'+(starter?'Free starter stock: '+left+'/5':'Starter seeds claimed')+'</small></div><button data-buy="seed" '+(!allowed||!canStore(f,'seed')||(!starter&&f.coins<3)?'disabled':'')+'>Buy 1 · '+coin+(starter?'0':'3')+'</button></article><p class="shop-note">'+(starter?'Purchase your five free seeds one at a time.':'Open Garden to plant your seeds.')+'</p>';}
    else target.innerHTML='<div class="market-grid">'+SHOP_ITEMS.filter(i=>i.category===tab).map(i=>{const owned=f.owned.includes(i.id),eq=f.equipped[i.slot]===i.id;return '<article class="market-card"><div class="shop-item-icon">'+itemArt(i.id,i.color)+'</div><small class="item-rarity">'+(eq?'EQUIPPED':owned?'OWNED':'WOODLAND COLLECTION')+'</small><h3>'+i.name+'</h3><button data-buy="item" data-item="'+i.id+'" '+(!owned&&(f.coins<i.price||!canStore(f,i.id))?'disabled':'')+'>'+(eq?'Remove':owned?'Equip':'Buy · '+coin+i.price)+'</button></article>';}).join('')+'</div>';
  }
  if(!garden.hidden){
    el('gardenInventory').textContent=f.seeds+' seeds · '+f.carrots+' harvested carrots';
    el('gardenPlots').innerHTML=f.plots.map((p,i)=>{const n=farmRemaining(p);return '<button class="garden-plot" data-plot="'+i+'" '+(!p&&(!f.seeds||f.starterBought<5)||p&&(n>0||!canStore(f,'carrot'))?'disabled':'')+'>'+itemArt(p?(n?'garden':'carrot'):'garden')+'<b>Plot '+(i+1)+'</b><small>'+(p?(n?farmClock(n):'Harvest'):'Plant 1 seed')+'</small></button>';}).join('');
    el('sellCarrot').disabled=!f.carrots;el('sellCarrot').textContent='Sell 1 carrot · +'+CARROT_SELL+' coins';
  }
  if(!inventory.hidden){
    const stacks=inventoryStacks(f,filter,sort),used=inventoryStacks(f).length;
    for(const b of el('inventoryFilters').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.filter===filter);
    el('inventoryCount').textContent=used+' / '+INVENTORY_CAPACITY+' slots';el('capacityFill').style.width=Math.min(100,used/INVENTORY_CAPACITY*100)+'%';
    el('inventorySlots').innerHTML=Array.from({length:Math.max(INVENTORY_CAPACITY,stacks.length)},(_,i)=>{const item=stacks[i];return item?'<button class="inventory-slot '+(item.key===selected?'selected':'')+'" data-slot="'+item.key+'" title="'+item.name+'">'+itemArt(item.id,item.color)+'<b>×'+item.quantity+'</b></button>':'<div class="inventory-slot empty" aria-hidden="true">+</div>';}).join('');
    const item=stacks.find(i=>i.key===selected);const details=el('inventoryDetails');
    if(!item){details.innerHTML='<small>Select an item to use, equip or sell.</small>';}else{let action='',label='';if(item.id==='seed'){action='useSeed';label='Plant seed';}else if(item.id==='carrot'){action='sell';label='Sell 1 · +10';}else if(item.category==='resources'){action='sellResource';label='Sell 1 · +'+item.price;}else{action='item';label=f.equipped[item.slot]===item.id?'Remove':'Equip';}details.innerHTML='<div><strong>'+item.name+'</strong><small>Stack: '+item.quantity+'</small></div><button data-action="'+action+'" data-item="'+item.id+'">'+label+'</button>';}
  }
 }
 return {render,close,isOpen,openGarden:()=>{open(garden);render(actions.state());}};
}
