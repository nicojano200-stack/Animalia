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
export function newFarm(){return {coins:0,seeds:0,starterBought:0,carrots:0,sold:0,planted:0,harvested:0,shopSeen:false,plots:[null,null,null,null,null],owned:[],equipped:{},resources:{},collected:[],decorOwned:{},homeDecor:[],tutorialStep:0};}
export function loadFarm(storage){try{const raw=JSON.parse(storage.getItem('animalia.farm.v1')||'null');if(raw&&Array.isArray(raw.plots)&&raw.plots.length===5)return {...newFarm(),...raw,tutorialStep:Number.isInteger(raw.tutorialStep)?Math.max(0,Math.min(4,raw.tutorialStep)):(farmStage(raw)==='done'?4:0),plots:raw.plots.map(p=>p?{...p,starter:p.starter??(raw.sold<5)}:null)};}catch{}return newFarm();}
export function saveFarm(storage,f){try{storage.setItem('animalia.farm.v1',JSON.stringify(f));}catch{}}
export function farmStage(f){return !f.shopSeen?'shop-guide':f.starterBought<5?'buy':f.planted<5?'plant':f.harvested<5?'grow':f.sold<5?'sell':'done';}
export const ONBOARDING_LEVELS=['tutorial-01','tutorial-02','tutorial-03','tutorial-04','home'];
export function onboardingDone(f){return f.tutorialStep===4&&farmStage(f)==='done';}
export function onboardingLevel(f){return ONBOARDING_LEVELS[onboardingDone(f)?4:Math.min(3,Math.max(0,f.tutorialStep||0))];}
export function canEnterOnboarding(f,id){return onboardingDone(f)?ONBOARDING_LEVELS.includes(id):id===onboardingLevel(f);}
export function completeOnboardingLesson(f,id){const i=ONBOARDING_LEVELS.indexOf(id);if(i<0||i>3||i!==f.tutorialStep||i===3&&farmStage(f)!=='done')return false;f.tutorialStep=i+1;return true;}
export const INVENTORY_CAPACITY=20, STACK_SIZE=99;
export const RESOURCE_ITEMS=[{id:'wood',name:'Wood',category:'resources',price:2,x:170},{id:'stone',name:'Stone',category:'resources',price:3,x:540},{id:'leaf',name:'Meadow leaf',category:'resources',price:2,x:1280}];
export const DECOR_ITEMS=[{id:'flowerpot',name:'Flower pot',category:'decor',price:10},{id:'bench',name:'Wooden bench',category:'decor',price:20},{id:'lantern',name:'Garden lantern',category:'decor',price:15}];
export function decorAvailable(f,id){return Math.max(0,(f.decorOwned[id]||0)-f.homeDecor.filter(d=>d.id===id).length);}
export function inventoryItems(f){const all=[{id:'seed',name:'Carrot seed',category:'seeds',quantity:f.seeds},{id:'carrot',name:'Carrot',category:'crops',quantity:f.carrots},...RESOURCE_ITEMS.map(i=>({...i,quantity:f.resources?.[i.id]||0})),...SHOP_ITEMS.filter(i=>f.owned.includes(i.id)).map(i=>({...i,quantity:1})),...DECOR_ITEMS.map(i=>({...i,quantity:decorAvailable(f,i.id)}))];return all.filter(i=>i.quantity>0);}
export function inventoryStacks(f,filter='all',sort='category'){const rows=inventoryItems(f).filter(i=>filter==='all'||i.category===filter);rows.sort((a,b)=>sort==='quantity'?b.quantity-a.quantity||a.name.localeCompare(b.name):sort==='name'?a.name.localeCompare(b.name):a.category.localeCompare(b.category)||a.name.localeCompare(b.name));return rows.flatMap(i=>Array.from({length:Math.ceil(i.quantity/STACK_SIZE)},(_,n)=>({...i,quantity:Math.min(STACK_SIZE,i.quantity-n*STACK_SIZE),stack:n,key:i.id+':'+n})));}
export function canStore(f,id){const rows=inventoryItems(f);const q=rows.find(i=>i.id===id)?.quantity||0;return q%STACK_SIZE!==0||inventoryStacks(f).length<INVENTORY_CAPACITY;}
export function itemArt(id,color=''){const decorIcon={flowerpot:'🌷',bench:'🪑',lantern:'🏮'}[id];if(decorIcon)return '<span class="decor-icon">'+decorIcon+'</span>';const name=SHOP_ITEMS.find(i=>i.id===id&&i.category==='fur')?'fur':id;return '<svg class="animal-icon item-art" viewBox="0 0 72 72" aria-hidden="true" '+(color?'style="color:'+color+'"':'')+'><use href="#'+name+'"/></svg>';}
export function canSkipCrop(f,i,now=Date.now()){const p=f.plots[i];return !!p&&p.starter===true&&f.sold<STARTER_SEEDS&&p.readyAt>now;}
export function farmAction(f,action,arg,now=Date.now()){
 if(action==='buyDecor'){const item=DECOR_ITEMS.find(i=>i.id===arg);if(!item||farmStage(f)!=='done'||f.coins<item.price||!canStore(f,arg))return false;f.coins-=item.price;f.decorOwned[arg]=(f.decorOwned[arg]||0)+1;return true;}
 if(action==='placeDecor'){const {id,x}=arg||{};if(farmStage(f)!=='done'||!DECOR_ITEMS.some(i=>i.id===id)||!Number.isFinite(x)||x<45||x>1555||decorAvailable(f,id)<1||f.homeDecor.length>=30||f.homeDecor.some(d=>Math.abs(d.x-x)<65))return false;f.homeDecor.push({id,x:Math.round(x)});return true;}
 if(action==='putAwayDecor'){const i=arg;if(!Number.isInteger(i)||i<0||i>=f.homeDecor.length||!canStore(f,f.homeDecor[i].id))return false;f.homeDecor.splice(i,1);return true;}
 if(action==='skip'){if(!Number.isInteger(arg)||!canSkipCrop(f,arg,now))return false;f.plots[arg].readyAt=now;return true;}
 if(action==='equipSeed'){if(f.seeds<1)return false;f.equipped.seed='seed';return true;}
 if(action==='plantEquipped'){if(f.equipped.seed!=='seed'||f.plots[arg])return false;return farmAction(f,'plot',arg,now);}
 if(action==='open'){f.shopSeen=true;return true;}
 if(action==='collect'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||f.collected.includes(arg)||!canStore(f,arg))return false;f.resources[arg]=(f.resources[arg]||0)+1;f.collected.push(arg);return true;}
 if(action==='sellResource'){const item=RESOURCE_ITEMS.find(i=>i.id===arg);if(!item||!f.resources[arg])return false;f.resources[arg]--;f.coins+=item.price;return true;}
 if(action==='seed'){if(!f.shopSeen||!canStore(f,'seed'))return false;if(f.starterBought<5){f.starterBought++;f.seeds++;return true;}if(f.sold>=5&&f.coins>=3){f.coins-=3;f.seeds++;return true;}return false;}
 if(action==='plot'){if(!Number.isInteger(arg)||arg<0||arg>=5||f.starterBought<5)return false;const p=f.plots[arg];if(!p&&f.seeds>0){const starter=f.planted<STARTER_SEEDS;f.seeds--;f.planted++;f.plots[arg]={readyAt:now+CARROT_GROW_MS,starter};if(!f.seeds)delete f.equipped.seed;return true;}if(p&&now>=p.readyAt&&canStore(f,'carrot')){f.plots[arg]=null;f.carrots++;f.harvested++;return true;}return false;}
 if(action==='sell'){if(f.carrots<1)return false;f.carrots--;f.sold++;f.coins+=CARROT_SELL;return true;}
 if(action==='item'){const item=SHOP_ITEMS.find(i=>i.id===arg);if(!item)return false;if(!f.owned.includes(item.id)){if(f.coins<item.price||!canStore(f,item.id))return false;f.coins-=item.price;f.owned.push(item.id);}f.equipped[item.slot]=f.equipped[item.slot]===item.id?null:item.id;return true;}
 return false;
}
export function farmRemaining(p,now=Date.now()){return p?Math.max(0,Math.ceil((p.readyAt-now)/1000)):0;}
export function farmClock(n){return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
export function createFarmUI(actions){
 const el=id=>document.getElementById(id);let tab='character',filter='all',sort='category',selected='',lastKey='',targetPlot=null,returnToGarden=false;
 const shop=el('shopPanel'),garden=el('gardenPanel'),inventory=el('inventoryPanel'),shopButton=el('shopToggle');
 const panels=[shop,garden,inventory],isOpen=()=>panels.some(p=>!p.hidden);
 function sync(){el('game').classList.toggle('economy-open',isOpen());el('game').classList.toggle('inventory-open',!inventory.hidden);el('game').classList.toggle('shop-open',!shop.hidden);actions.block(isOpen());lastKey='';}
 function close(panel){if(!panel||panel===inventory){targetPlot=null;returnToGarden=false;}if(panel)panel.hidden=true;else panels.forEach(p=>p.hidden=true);sync();}
 function open(panel){if(panel!==inventory){targetPlot=null;returnToGarden=false;}actions.beforeOpen?.();if(panel===inventory){inventory.hidden=false;garden.hidden=true;if(innerWidth<1050)shop.hidden=true;}else if(panel===shop){shop.hidden=false;garden.hidden=true;if(innerWidth<1050)inventory.hidden=true;}else{panels.forEach(p=>p.hidden=p!==garden);}sync();}
 function chooseSoil(i,fromGarden=false){const f=actions.state();if(!actions.active()||f.starterBought<5||f.plots[i])return;targetPlot=i;returnToGarden=fromGarden;filter='seeds';selected='';shop.hidden=true;open(inventory);render(f);}
 function clickPlot(i,fromGarden=false){const f=actions.state();if(!f.plots[i]){chooseSoil(i,fromGarden);return;}if(farmRemaining(f.plots[i])>0){if(!fromGarden){open(garden);render(f);}return;}transact('plot',i);}
 function transact(action,arg){if(actions.change(action,arg)){lastKey='';render(actions.state());return true;}return false;}
 shopButton.onclick=()=>{if(!actions.active())return;if(!shop.hidden){close(shop);return;}transact('open');tab=farmStage(actions.state())==='buy'?'seeds':'character';open(shop);render(actions.state());};
 el('gardenToggle').onclick=()=>{if(!actions.active()||el('gardenToggle').disabled)return;if(actions.isHome()){close();actions.goGarden();return;}if(!garden.hidden){close(garden);return;}open(garden);render(actions.state());};
 el('inventoryToggle').onclick=()=>{if(!actions.active()||el('inventoryToggle').disabled)return;if(!inventory.hidden){close(inventory);return;}targetPlot=null;returnToGarden=false;filter='all';selected='';open(inventory);render(actions.state());};
 el('closeShop').onclick=()=>close(shop);el('closeGarden').onclick=()=>close(garden);el('closeInventory').onclick=()=>close(inventory);
 el('shopTabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){tab=b.dataset.category;lastKey='';render(actions.state());}};
 el('shopItems').onclick=e=>{const b=e.target.closest('[data-buy]');if(b){if(b.dataset.buy==='placeDecor'){const id=b.dataset.item;close();actions.startDecor(id);}else transact(b.dataset.buy,b.dataset.item);}};
 el('gardenPlots').onclick=e=>{const b=e.target.closest('[data-plot]');if(b)clickPlot(Number(b.dataset.plot),true);};
 el('sellCarrot').onclick=()=>transact('sell');
 el('gardenPlots').addEventListener('click',e=>{const b=e.target.closest('[data-skip]');if(b)transact('skip',Number(b.dataset.skip));});
 el('inventoryFilters').onclick=e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;selected='';lastKey='';render(actions.state());}};
 el('inventorySort').onchange=e=>{sort=e.target.value;lastKey='';render(actions.state());};
 el('inventorySlots').onclick=e=>{const b=e.target.closest('[data-slot]');if(b){selected=b.dataset.slot;lastKey='';render(actions.state());}};
 el('inventoryDetails').onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='placeDecor'){if(!actions.isHome())return;const id=b.dataset.item;close();actions.startDecor(id);}else if(b.dataset.action==='useSeed'){if(actions.isHome()){close();actions.goGarden();}else{open(garden);render(actions.state());}}else if(b.dataset.action==='plantEquipped'){const back=returnToGarden;if(targetPlot!==null&&transact('plantEquipped',targetPlot)){targetPlot=null;returnToGarden=false;close(inventory);if(back)open(garden);render(actions.state());}}else transact(b.dataset.action,b.dataset.item);};
 window.addEventListener('resize',()=>{if(innerWidth<1050&&!shop.hidden&&!inventory.hidden)close(inventory);});
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&isOpen()){e.preventDefault();e.stopImmediatePropagation();close();}},true);
 function render(f){
  const active=actions.active(),stage=farmStage(f),guide=active&&stage==='shop-guide';
  el('game').classList.toggle('farm-hud',active);el('game').classList.toggle('home-hud',actions.isHome());el('decorShopTab').hidden=stage!=='done';el('decorFilter').hidden=stage!=='done';
  el('economyBar').hidden=!active;el('shopGuide').hidden=!guide;shopButton.classList.toggle('guided',guide);el('coinBalance').textContent=f.coins;el('shopBalance').textContent=f.coins;el('gardenToggle').disabled=stage==='shop-guide'||stage==='buy';el('inventoryToggle').disabled=guide;
  if(!active){if(isOpen())close();return;}
  // Only rebuild interactive cards when their data changes. Crop timers update separately.
  if(!garden.hidden)for(const b of el('gardenPlots').querySelectorAll('[data-plot]')){const p=f.plots[Number(b.dataset.plot)],n=farmRemaining(p);if(p&&n){const clock=farmClock(n),label=b.querySelector('small');if(label.textContent!==clock)label.textContent=clock;}else if(p&&n===0&&b.dataset.growing==='true'){lastKey='';}}
  const key=JSON.stringify([f,tab,filter,sort,selected,targetPlot,...panels.map(p=>p.hidden)]);if(lastKey===key)return;lastKey=key;
  const coin='<i class="paw-coin"></i>';
  if(!shop.hidden){
    for(const b of el('shopTabs').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.category===tab);
    const target=el('shopItems');
    if(tab==='decor')target.innerHTML='<div class="market-grid">'+DECOR_ITEMS.map(i=>'<article class="market-card"><div class="shop-item-icon">'+itemArt(i.id)+'</div><small class="item-rarity">HOME COLLECTION · '+decorAvailable(f,i.id)+' in bag</small><h3>'+i.name+'</h3><button data-buy="buyDecor" data-item="'+i.id+'" '+(f.coins<i.price||!canStore(f,i.id)?'disabled':'')+'>Buy · '+coin+i.price+'</button>'+(decorAvailable(f,i.id)&&actions.isHome()?'<button data-buy="placeDecor" data-item="'+i.id+'">Place</button>':'')+'</article>').join('')+'</div>';
    else if(tab==='character')target.innerHTML='<div class="shop-empty"><div class="shop-hero">'+itemArt('paw')+'</div><h3>Animal characters</h3><p>New friends are coming to Animalia.</p><span class="coming-soon">Coming soon!</span></div>';
    else if(tab==='seeds'){const left=5-f.starterBought,starter=left>0,allowed=starter||f.sold>=5;target.innerHTML='<article class="shop-item seed-card"><div class="shop-item-icon">'+itemArt('seed')+'</div><div><small class="item-rarity">BEGINNER · FARMING</small><h3>Carrot seed</h3><p>5 minute growth · Sell for '+CARROT_SELL+' coins</p><small>'+(starter?'Free starter stock: '+left+'/5':'Starter seeds claimed')+'</small></div><button data-buy="seed" '+(!allowed||!canStore(f,'seed')||(!starter&&f.coins<3)?'disabled':'')+'>Buy 1 · '+coin+(starter?'0':'3')+'</button></article><p class="shop-note">'+(starter?'Purchase your five free seeds one at a time.':'Open Garden to plant your seeds.')+'</p>';}
    else target.innerHTML='<div class="market-grid">'+SHOP_ITEMS.filter(i=>i.category===tab).map(i=>{const owned=f.owned.includes(i.id),eq=f.equipped[i.slot]===i.id;return '<article class="market-card"><div class="shop-item-icon">'+itemArt(i.id,i.color)+'</div><small class="item-rarity">'+(eq?'EQUIPPED':owned?'OWNED':'WOODLAND COLLECTION')+'</small><h3>'+i.name+'</h3><button data-buy="item" data-item="'+i.id+'" '+(!owned&&(f.coins<i.price||!canStore(f,i.id))?'disabled':'')+'>'+(eq?'Remove':owned?'Equip':'Buy · '+coin+i.price)+'</button></article>';}).join('')+'</div>';
  }
  if(!garden.hidden){
    el('gardenInventory').textContent=f.seeds+' seeds · '+f.carrots+' harvested carrots';
    el('gardenPlots').innerHTML=f.plots.map((p,i)=>{const n=farmRemaining(p);return '<div class="plot-cell"><button class="garden-plot" data-plot="'+i+'" data-growing="'+!!(p&&n)+'" '+(!p&&f.starterBought<5||p&&(n>0||!canStore(f,'carrot'))?'disabled':'')+'>'+itemArt(p?(n?'garden':'carrot'):'garden')+'<b>Plot '+(i+1)+'</b><small>'+(p?(n?farmClock(n):'Harvest'):'Choose seed')+'</small></button>'+(canSkipCrop(f,i)?'<button class="free-skip" data-skip="'+i+'">✦ Free skip</button>':'')+'</div>';}).join('');
    el('sellCarrot').disabled=!f.carrots;el('sellCarrot').textContent='Sell 1 carrot · +'+CARROT_SELL+' coins';
  }
  if(!inventory.hidden){
    const stacks=inventoryStacks(f,filter,sort),used=inventoryStacks(f).length;
    for(const b of el('inventoryFilters').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.filter===filter);
    el('inventoryCount').textContent=used+' / '+INVENTORY_CAPACITY+' slots';el('capacityFill').style.width=Math.min(100,used/INVENTORY_CAPACITY*100)+'%';
    el('inventorySlots').innerHTML=Array.from({length:Math.max(INVENTORY_CAPACITY,stacks.length)},(_,i)=>{const item=stacks[i];return item?'<button class="inventory-slot '+(item.key===selected?'selected':'')+'" data-slot="'+item.key+'" title="'+item.name+'">'+itemArt(item.id,item.color)+'<b>×'+item.quantity+'</b></button>':'<div class="inventory-slot empty" aria-hidden="true">+</div>';}).join('');
    const item=stacks.find(i=>i.key===selected);const details=el('inventoryDetails');el('seedPickerHint').hidden=targetPlot===null;el('seedPickerHint').textContent=targetPlot===null?'':'Planting in Plot '+(targetPlot+1)+(f.equipped.seed==='seed'?' · Carrot seed equipped. Select the seed and Plant.':' · Select a carrot seed, then Equip.');
    if(!item){details.innerHTML='<small>Select an item to use, equip or sell.</small>';}else{let action='',label='';if(item.id==='seed'){action=f.equipped.seed==='seed'?(targetPlot!==null?'plantEquipped':'useSeed'):'equipSeed';label=action==='equipSeed'?'Equip':action==='plantEquipped'?'Plant 1 seed':'Choose soil';}else if(item.id==='carrot'){action='sell';label='Sell 1 · +10';}else if(item.category==='resources'){action='sellResource';label='Sell 1 · +'+item.price;}else if(item.category==='decor'){action='placeDecor';label=actions.isHome()?'Place':'Visit Home to place';}else{action='item';label=f.equipped[item.slot]===item.id?'Remove':'Equip';}details.innerHTML='<div><strong>'+item.name+'</strong><small>Stack: '+item.quantity+'</small></div><button data-action="'+action+'" data-item="'+item.id+'">'+label+'</button>';}
  }
 }
 return {render,close,isOpen,clickPlot,openDecor:()=>{tab='decor';open(shop);render(actions.state());},openGarden:()=>{open(garden);render(actions.state());}};
}
