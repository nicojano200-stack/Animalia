// Ten distinct expressions in the order of the supplied artwork.
export const EMOTES=[["happy","Happy"],["sad","Sad"],["laughing","Laughing"],["crying","Crying"],["wow","Wow"],["cheer","Cheer"],["sleeping","Sleeping"],["love","Love"],["angry","Angry"],["shock","Shock"]];
export function emoteAsset(face){return globalThis.ANIMALIA_EMOTE_ASSETS?.[face]||'assets/emotes/'+face+'.png';}
// Preload once; rendering never allocates images or changes simulation state.
export function loadEmoteImages(){const images={};for(const [face] of EMOTES){if(!images[face]){const image=new Image();image.src=emoteAsset(face);images[face]=image;}}return images;}
export function emote(index){return {index,remaining:2.6};}
// Replace with a proper multilingual moderation service before multiplayer.
export function filterChat(text){return Array.from(text.trim()).slice(0,80).join('').replace(/\b(fuck|shit|bitch|asshole)\b/gi,m=>'•'.repeat(m.length));}
