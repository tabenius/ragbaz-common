/** Reusable completion widget. Provider(prefix,{signal}) returns [{id,label}]. */
export function createCombobox({input,list,provider,onSelect=()=>{},onError=()=>{}}){
 let items=[],active=0,sequence=0,controller;
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');list.setAttribute('role','listbox');
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 function paint(){list.replaceChildren();list.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length));items.forEach((item,i)=>{const el=document.createElement('div');el.id=list.id+'-'+i;el.setAttribute('role','option');el.setAttribute('aria-selected',String(active===i));el.textContent=item.label;el.addEventListener('mousedown',e=>{e.preventDefault();select(i);});el.addEventListener('click',()=>select(i));list.append(el);});if(items.length){input.setAttribute('aria-activedescendant',list.id+'-'+active);list.children[active]?.scrollIntoView({block:'nearest'});}}
 function select(i){if(!items[i])return;input.value=items[i].label;onSelect(items[i]);close();}
 async function search(){const request=++sequence;controller?.abort();controller=new AbortController();try{const found=await provider(input.value,{signal:controller.signal});if(request!==sequence)return;items=found.slice(0,50);active=0;paint();}catch(e){if(request===sequence&&e.name!=='AbortError'){items=[];close();onError(e);}}}
 const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();sequence++;controller?.abort();close();input.blur();input.dispatchEvent(new CustomEvent('fragment:escape',{bubbles:true}));}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+items.length)%Math.max(1,items.length);paint();}else if(e.key==='Enter'&&!list.hidden){e.preventDefault();select(active);}};
 input.addEventListener('input',search);input.addEventListener('focus',search);input.addEventListener('keydown',key);input.addEventListener('blur',close);
 return {search,close,destroy(){sequence++;controller?.abort();input.removeEventListener('input',search);input.removeEventListener('focus',search);input.removeEventListener('keydown',key);input.removeEventListener('blur',close);close();}};
}
export function prefixApiProvider(endpoint,{fetchImpl=fetch}={}){
 return async(prefix,{signal})=>{const url=new URL(endpoint,location.href);if(!['https:','http:'].includes(url.protocol))throw Error('HTTP(S) endpoint required');url.searchParams.set('prefix',prefix);const response=await fetchImpl(url,{signal,credentials:'omit'});if(!response.ok)throw Error(`Search failed: ${response.status}`);const value=await response.json();if(!Array.isArray(value)||!value.every(v=>typeof v.id==='string'&&typeof v.label==='string'))throw Error('Expected [{id,label}]');return value;};
}
/** Never steal typing or modified browser shortcuts. Panels take priority over L. */
export function keyboardProfile({root=document,actions,isPanelOpen=()=>false,navigate=()=>{}}){
 const handler=e=>{
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(e.key==='Escape'){actions.escape?.();return;}
  const dirs={h:'left',j:'down',k:'up',l:'right',ArrowLeft:'left',ArrowDown:'down',ArrowUp:'up',ArrowRight:'right'};
  if(isPanelOpen()&&dirs[e.key]){e.preventDefault();navigate(dirs[e.key]);return;}
  const key=e.key.toLowerCase();const action=key==='+'||key==='='?'zoomIn':key==='-'?'zoomOut':key==='l'?'legend':key==='p'?'printOptions':key==='t'?'themes':key==='i'?'inspector':null;
  if(action){e.preventDefault();actions[action]?.();return;}
  if(e.key==='Tab'&&e.target.hasAttribute?.('data-fragment-canvas')&&!e.shiftKey){e.preventDefault();actions.flip?.();return;}
  if(dirs[e.key]){e.preventDefault();navigate(dirs[e.key]);}
 };
 root.addEventListener('keydown',handler);return()=>root.removeEventListener('keydown',handler);
}
