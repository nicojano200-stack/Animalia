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
export function newFarm(){return {coins:0,seeds:0,starterBought:0,carrots:0,sold:0,planted:0,harvested:0,shopSeen:false,plots:[null,null,null,null,null],owned:[],equipped:{}};}
export function loadFarm(storage){try{const raw=JSON.parse(storage.getItem('animalia.farm.v1')||'null');if(raw&&Array.isArray(raw.plots)&&raw.plots.length===5)return {...newFarm(),...raw};}catch{}return newFarm();}
export function saveFarm(storage,f){try{storage.setItem('animalia.farm.v1',JSON.stringify(f));}catch{}}
export function farmStage(f){return !f.shopSeen?'shop-guide':f.starterBought<5?'buy':f.planted<5?'plant':f.harvested<5?'grow':f.sold<5?'sell':'done';}
export function farmAction(f,action,arg,now=Date.now()){
 if(action==='open'){f.shopSeen=true;return true;}
 if(action==='seed'){if(!f.shopSeen)return false;if(f.starterBought<5){f.starterBought++;f.seeds++;return true;}if(f.sold>=5&&f.coins>=3){f.coins-=3;f.seeds++;return true;}return false;}
 if(action==='plot'){if(!Number.isInteger(arg)||arg<0||arg>=5||f.starterBought<5)return false;const p=f.plots[arg];if(!p&&f.seeds>0){f.seeds--;f.planted++;f.plots[arg]={readyAt:now+CARROT_GROW_MS};return true;}if(p&&now>=p.readyAt){f.plots[arg]=null;f.carrots++;f.harvested++;return true;}return false;}
 if(action==='sell'){if(f.carrots<1)return false;f.carrots--;f.sold++;f.coins+=CARROT_SELL;return true;}
 if(action==='item'){const item=SHOP_ITEMS.find(i=>i.id===arg);if(!item)return false;if(!f.owned.includes(item.id)){if(f.coins<item.price)return false;f.coins-=item.price;f.owned.push(item.id);}f.equipped[item.slot]=f.equipped[item.slot]===item.id?null:item.id;return true;}
 return false;
}
export function farmRemaining(p,now=Date.now()){return p?Math.max(0,Math.ceil((p.readyAt-now)/1000)):0;}
export function farmClock(n){return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
export function createFarmUI(actions){
 const el=id=>document.getElementById(id);let tab='character',lastKey='',lastGuide=false;
 const shop=el('shopPanel'),garden=el('gardenPanel'),shopButton=el('shopToggle');
 function close(){shop.hidden=garden.hidden=true;lastKey='';actions.block(false);}
 function open(panel){close();panel.hidden=false;actions.block(true);lastKey='';}
 function transact(action,arg){if(actions.change(action,arg)){lastKey='';render(actions.state());}}
 shopButton.onclick=()=>{if(!actions.active())return;if(!shop.hidden){close();return;}transact('open');tab=farmStage(actions.state())==='buy'?'seeds':'character';open(shop);render(actions.state());};
 el('gardenToggle').onclick=()=>{if(!actions.active())return;if(!garden.hidden){close();return;}open(garden);render(actions.state());};
 el('closeShop').onclick=close;el('closeGarden').onclick=close;
 el('shopTabs').onclick=e=>{const b=e.target.closest('[data-category]');if(b){tab=b.dataset.category;lastKey='';render(actions.state());}};
 el('shopItems').onclick=e=>{const b=e.target.closest('[data-buy]');if(b)transact(b.dataset.buy,b.dataset.item);};
 el('gardenPlots').onclick=e=>{const b=e.target.closest('[data-plot]');if(b)transact('plot',Number(b.dataset.plot));};
 el('sellCarrot').onclick=()=>transact('sell');
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&(!shop.hidden||!garden.hidden)){e.preventDefault();e.stopImmediatePropagation();close();}},true);
 function render(f){
  const active=actions.active(),stage=farmStage(f),guide=active&&stage==='shop-guide';
  el('economyBar').hidden=!active;el('shopGuide').hidden=!guide;shopButton.classList.toggle('guided',guide);el('coinBalance').textContent=f.coins;el('shopBalance').textContent=f.coins;el('gardenToggle').disabled=stage==='shop-guide'||stage==='buy';
  if(!active){if(!shop.hidden||!garden.hidden)close();return;}
  const key=JSON.stringify([f,tab,Math.floor(Date.now()/1000),shop.hidden,garden.hidden]);if(lastKey===key)return;lastKey=key;
  if(!shop.hidden){
    for(const b of el('shopTabs').querySelectorAll('button'))b.classList.toggle('selected',b.dataset.category===tab);
    const target=el('shopItems');
    const coin='<i class="paw-coin"></i>';
    if(tab==='character')target.innerHTML='<div class="shop-empty"><span>✿</span><h3>Animal characters</h3><p>Coming soon</p></div>';
    else if(tab==='seeds'){const left=5-f.starterBought,starter=left>0,allowed=starter||f.sold>=5;target.innerHTML='<article class="shop-item"><div class="shop-item-icon">🥕</div><div><h3>Carrot seed</h3><p>5 minute growth · Sell each carrot for '+CARROT_SELL+' coins</p><small>'+(starter?'Beginner stock: '+left+'/5 remaining':'Starter seeds claimed')+'</small></div><button data-buy="seed" '+(!allowed||(!starter&&f.coins<3)?'disabled':'')+'>Buy 1 · '+coin+(starter?'0':'3')+'</button></article><p class="shop-note">'+(starter?'Buy your five free seeds one at a time.':'Your seeds are ready. Open Garden to plant them.')+'</p>';}
    else target.innerHTML=SHOP_ITEMS.filter(i=>i.category===tab).map(i=>{const owned=f.owned.includes(i.id),eq=f.equipped[i.slot]===i.id;return '<article class="shop-item"><div class="shop-item-icon" style="color:'+i.color+'">'+i.icon+'</div><div><h3>'+i.name+'</h3><small>'+(eq?'Equipped':owned?'Owned':'Wearable')+'</small></div><button data-buy="item" data-item="'+i.id+'" '+(!owned&&f.coins<i.price?'disabled':'')+'>'+(eq?'Remove':owned?'Equip':'Buy · '+coin+i.price)+'</button></article>';}).join('');
  }
  if(!garden.hidden){
    el('gardenInventory').textContent=f.seeds+' seeds · '+f.carrots+' harvested carrots';
    el('gardenPlots').innerHTML=f.plots.map((p,i)=>{const n=farmRemaining(p);return '<button class="garden-plot" data-plot="'+i+'" '+(!p&&(!f.seeds||f.starterBought<5)||p&&n>0?'disabled':'')+'><span>'+(p?(n?'🌱':'🥕'):'🟫')+'</span><b>Plot '+(i+1)+'</b><small>'+(p?(n?farmClock(n):'Harvest'):'Plant 1 seed')+'</small></button>';}).join('');
    el('sellCarrot').disabled=!f.carrots;el('sellCarrot').textContent='Sell 1 carrot · +'+CARROT_SELL+' coins';
  }
 }
 return {render,close,isOpen:()=>!shop.hidden||!garden.hidden,openGarden:()=>{open(garden);render(actions.state());}};
}
