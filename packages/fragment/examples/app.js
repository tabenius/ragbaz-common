import cytoscape from 'cytoscape';
import {parse,assertValid,validate,evaluate,bindText,unresolved,ast,themes,resolveTheme,exportModel} from '../src/core.js';
import {createCombobox,keyboardProfile} from '../src/widgets.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let model=assertValid(JSON.parse($('#fragment-model').textContent));
let activePanel=null,scale=1,reverse=false,cy=null,focusBefore=null,savedTheme=null;
const env={color:true,monochrome:false,portrait:model.page.orientation==='portrait',landscape:model.page.orientation==='landscape',interaction:true,animation:!matchMedia('(prefers-reduced-motion: reduce)').matches,mouse:null,touch:null,keyboard:null,internet:null,storage:false};
try{localStorage.setItem('fragment-probe','1');localStorage.removeItem('fragment-probe');env.storage=true;savedTheme=localStorage.getItem('fragment-theme');}catch{}
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const text=t=>bindText(t,model.bindings);
function announce(s){$('#announcement').textContent=s;}
function theme(){for(const[k,v]of Object.entries(model.theme.tokens))document.documentElement.style.setProperty('--'+k,v);document.documentElement.style.colorScheme=model.theme.resolved.includes('dark')?'dark':'light';$('#front').style.fontFamily=model.theme.font==='system-serif'?'Georgia, serif':'system-ui, sans-serif';$('#theme-exact').textContent=`Requested: ${model.theme.requested}\nResolved: ${model.theme.resolved}`;$('#tokens').replaceChildren(...Object.entries(model.theme.tokens).map(([k,v])=>{const row=el('div',undefined,'token'),left=el('span'),swatch=el('i');swatch.style.background=v;left.append(swatch,document.createTextNode(k));row.append(left,el('span',v));return row;}));}
function render(){
 theme();const f=$('#front');f.replaceChildren();const top=el('div',undefined,'page-top');top.append(el('span','☉ RAGBAZ / FRAGMENT 0.1'),el('span',model.meta.disclosure.toUpperCase(),'disclosure'));f.append(top,el('h2',model.meta.title));
 f.append(el('div',`${model.kind.toUpperCase()} · ${model.meta.created} · ${model.meta.timezone}`,'meta'));
 for(const block of model.blocks){const s=el('section');s.id='block-'+block.id;s.append(el('h3',text(block.title)));
 if(block.type==='code'){const pre=el('pre',undefined,'code');const lines=text(block.text).split('\n');for(const [i,line]of lines.entries()){const span=el('span',line,line.trim().startsWith('#')?'syntax-comment':line.includes(':')?'syntax-keyword':/^\s*\d/.test(line)?'syntax-number':'syntax-string');pre.append(span,document.createTextNode(i===lines.length-1?'':'\n'));}s.append(pre);}
 else{s.append(el('p',text(block.text)));}
 if(block.type==='callout'){s.className='callout';s.style.borderColor=model.theme.tokens[block.role||'info'];}
 if(block.type==='figure-group'){const row=el('div',undefined,'figures');for(const figure of block.figures){const box=el('div',undefined,'figure');box.append(el('small',text(figure.label)),el('strong',text(figure.value)),el('p',text(figure.explanation)));row.append(box);}s.append(row);}
 if(block.type==='quiz'){const row=el('div',undefined,'quiz-options'),result=el('p','','quiz-result');result.setAttribute('role','status');for(const [i,option]of block.options.entries()){const button=el('button',text(option));button.onclick=()=>{result.textContent=i===block.answer?'Correct — the declared fallback preserves meaning.':'Try again — degradation allows a fallback.';};row.append(button);}s.append(row,result,el('p','Answer: '+text(block.options[block.answer]),'print-answer'));}
 f.append(s);
 }
 f.append(el('footer',`${model.id} · ${unresolved(model).length} unbound field(s) · ${model.meta.disclosure} · Draft / 01`));
 $$('#back .disclosure').forEach(e=>e.textContent=model.meta.disclosure.toUpperCase());$('#graph-text').replaceChildren(el('h3','Relationships · exact weights'));
 for(const edge of model.graph.edges){const label=id=>model.graph.nodes.find(n=>n.id===id).label;$('#graph-text').append(el('p',`${label(edge.source)} → ${label(edge.target)} · ${edge.weight.toFixed(2)}`));}
 $('#binding-info').textContent=JSON.stringify({unresolved:unresolved(model),additional:model.additional},null,2);
 $('#orientation').value=model.page.orientation;$('#margin').value=model.page.margin_mm;$('#font-size').value=model.page.font_pt;$('#layout').value=model.graph.layout;
 $('#author').value=model.bindings.author??'';css();report();if(reverse)graph();updateEditor();
}
function graph(){cy?.destroy();$('#graph').replaceChildren();cy=cytoscape({container:$('#graph'),elements:[...model.graph.nodes.map(n=>({data:{id:'node:'+n.id,label:n.label}})),...model.graph.edges.map((e,i)=>({data:{id:'edge:'+i,source:'node:'+e.source,target:'node:'+e.target,weight:e.weight}}))],style:[{selector:'node',style:{label:'data(label)','background-color':model.theme.tokens.primary,color:model.theme.tokens.foreground,'font-size':12,'text-valign':'bottom','text-margin-y':8,width:28,height:28}},{selector:'edge',style:{width:2,'line-color':model.theme.tokens.border,'target-arrow-shape':'triangle','target-arrow-color':model.theme.tokens.secondary,'curve-style':'bezier'}}],layout:{name:$('#layout').value,animate:false,randomize:false,idealEdgeLength:e=>40+160*(1-e.data('weight')),nodeRepulsion:()=>6000,padding:35}});}
function flip(){reverse=!reverse;$('#front').hidden=reverse;$('#back').hidden=!reverse;$('#sheet').classList.remove('turning');void $('#sheet').offsetWidth;$('#sheet').classList.add('turning');if(reverse)graph();announce(reverse?'Reverse: concept map':'Front: document');}
function printEnv(){return {...env,interaction:false,animation:false,mouse:false,touch:false,keyboard:false,color:$('#ink').value==='color',monochrome:$('#ink').value==='monochrome',portrait:model.page.orientation==='portrait',landscape:model.page.orientation==='landscape'};}
function report(){const r=evaluate(model,env,'screen');$('#status').textContent=`${model.kind.toUpperCase()} · ${r.status.toUpperCase()} · ${unresolved(model).length} UNBOUND`;$('#cap-report').textContent=JSON.stringify(r,null,2);const p=evaluate(model,printEnv(),'print');$('#print-report').textContent=[p.status.toUpperCase(),...p.issues.map(i=>`${i.capability}: ${i.observed}. ${i.reason} ${i.fallback||''}`)].join('\n');$('#do-print').disabled=p.status==='blocked';$('#print-now').disabled=p.status==='blocked';$('#canvas').setAttribute('data-capability-status',r.status);if(r.status==='blocked')$('#status').textContent+=' · PREVIEW ONLY; REQUIREMENTS UNMET';}
function css(){
 const landscape=model.page.orientation==='landscape';document.documentElement.style.setProperty('--page-width',landscape?'297mm':'210mm');document.documentElement.style.setProperty('--page-height',landscape?'210mm':'297mm');document.documentElement.style.setProperty('--margin',model.page.margin_mm+'mm');document.documentElement.style.setProperty('--font',model.page.font_pt+'pt');$('#paper-label').textContent=landscape?'A4 · 297 × 210 mm':'A4 · 210 × 297 mm';
 const backgrounds=$('#backgrounds').checked,mono=$('#ink').value==='monochrome';let rules=`@page { size: A4 ${model.page.orientation}; margin: ${model.page.margin_mm}mm; }\n@media print {\n :root { --font: ${model.page.font_pt}pt; }\n .page { print-color-adjust: exact; -webkit-print-color-adjust: exact; }\n`;
 if(!backgrounds)rules+=' .page { --background:#ffffff; --foreground:#171717; --surface:#f4f4f4; --secondary:#333333; --primary:#235c71; --muted:#444444; --border:#777777; --syntax-keyword:#235c71; --syntax-string:#345900; --syntax-number:#70387d; --syntax-comment:#555555; background:#fff; color:#171717; }\n';
 if(mono)rules+=' .page { filter: grayscale(1); }\n';rules+='}';$('#print-style').textContent=rules;$('#css-preview').textContent=rules;document.body.classList.toggle('print-reverse',$('#reverse-print').checked);report();
}
function print(){if(evaluate(model,printEnv(),'print').status==='blocked')return;window.print();}
window.addEventListener('beforeprint',()=>{const blocked=evaluate(model,printEnv(),'print').status==='blocked';document.body.classList.toggle('blocked-print',blocked);$('#print-blocked')?.remove();if(blocked){const p=el('p','Printing blocked: required capabilities are absent or unverified. See the print options report.');p.id='print-blocked';document.body.append(p);}});
window.addEventListener('afterprint',()=>{$('#print-blocked')?.remove();document.body.classList.remove('blocked-print');});
function openPanel(name){if(activePanel===name){closePanel();return;}focusBefore=document.activeElement;activePanel=name;$('#panel').hidden=false;for(const section of $$('#panel > section'))section.hidden=section.id!==name+'-panel';$('#panel-title').textContent={themes:'Theme browser',print:'Print stylesheet',legend:'Keyboard legend',inspector:'The exact model'}[name];$('#close').focus();if(name==='inspector')updateEditor();}
function closePanel(){activePanel=null;$('#panel').hidden=true;(focusBefore?.isConnected?focusBefore:$('#canvas')).focus();}
function navigate(dir){if(activePanel){const controls=$$('#'+activePanel+'-panel button, #'+activePanel+'-panel input:not([hidden]), #'+activePanel+'-panel select, #'+activePanel+'-panel textarea, #'+activePanel+'-panel summary').filter(e=>e.getClientRects().length&&!e.disabled);const i=controls.indexOf(document.activeElement);controls[(i+(dir==='up'||dir==='left'?-1:1)+controls.length)%controls.length]?.focus();}else $('#canvas').scrollBy({left:dir==='left'?-90:dir==='right'?90:0,top:dir==='up'?-90:dir==='down'?90:0,behavior:'auto'});}
function zoom(delta){scale=Math.min(2,Math.max(.35,scale+delta));document.documentElement.style.setProperty('--zoom',scale);$('#zoom-value').textContent=Math.round(scale*100)+'%';}
function updateEditor(){const format=$('#representation').value;$('#editor').value=format==='ast'?JSON.stringify(ast(model),null,2):exportModel(model,format);$('#editor').readOnly=format==='ast';$('#apply').disabled=format==='ast';}
function apply(source){try{const next=assertValid(parse(source));model=next;env.portrait=model.page.orientation==='portrait';env.landscape=!env.portrait;render();$('#diagnostics').textContent='Valid Fragment 0.1. Applied.';}catch(e){$('#diagnostics').textContent=e.message;}}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function selectTheme(slug){model.theme=resolveTheme(slug);try{localStorage.setItem('fragment-theme',model.theme.resolved);}catch{}render();announce('Theme: '+model.theme.resolved);}
$('#theme-cards').replaceChildren();$('#capabilities').replaceChildren();$('#panel').hidden=true;$('#front').hidden=false;$('#back').hidden=true;
for(const t of themes){const b=el('button',t.resolved,'theme-card'),sw=el('span',undefined,'swatches');for(const k of ['background','foreground','primary','secondary','accent']){const i=el('i');i.style.background=t.tokens[k];sw.append(i);}b.append(sw);b.onclick=()=>selectTheme(t.resolved);$('#theme-cards').append(b);}
if(savedTheme&&themes.some(t=>t.resolved===savedTheme)){const b=el('button','Restore saved preference: '+savedTheme);b.onclick=()=>selectTheme(savedTheme);$('#theme-cards').append(b);}
createCombobox({input:$('#theme-query'),list:$('#theme-options'),provider:async prefix=>themes.filter(t=>t.resolved.startsWith(prefix.toLowerCase())).map(t=>({id:t.resolved,label:t.resolved})),onSelect:item=>selectTheme(item.id),onError:e=>announce(e.message)});
$('#theme-query').addEventListener('fragment:escape',()=>$('#theme-cards button').focus());
for(const cap of Object.keys(env)){const label=el('label',cap),select=el('select');select.dataset.capability=cap;for(const [value,name]of [['unknown','Unknown'],['true','Available'],['false','Absent']]){const option=el('option',name);option.value=value;select.append(option);}select.value=env[cap]===null?'unknown':String(env[cap]);select.onchange=()=>{env[cap]=select.value==='unknown'?null:select.value==='true';report();};label.append(select);$('#capabilities').append(label);}
$$('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));$('#close').onclick=closePanel;$('#flip').onclick=flip;$('#plus').onclick=()=>zoom(.1);$('#minus').onclick=()=>zoom(-.1);$('#print-now').onclick=print;$('#do-print').onclick=print;
$('#orientation').onchange=()=>{model.page.orientation=$('#orientation').value;env.portrait=model.page.orientation==='portrait';env.landscape=!env.portrait;css();};
for(const [id,key,min,max]of [['margin','margin_mm',5,35],['font-size','font_pt',8,18]])$('#'+id).onchange=()=>{const n=Number($('#'+id).value);if(Number.isFinite(n)&&n>=min&&n<=max){model.page[key]=n;css();}else $('#'+id).value=model.page[key];};
for(const id of ['ink','backgrounds','reverse-print'])$('#'+id).onchange=css;
$('#representation').onchange=updateEditor;$('#apply').onclick=()=>apply($('#editor').value);$('#author').onchange=()=>{model.bindings.author=$('#author').value||null;render();};
$('#export').onclick=()=>{const format=$('#representation').value;download(model.id+'.'+(format==='yaml'?'yaml':'json'),format==='ast'?JSON.stringify(ast(model),null,2):exportModel(model,format),'text/plain');};
$('#export-html').onclick=()=>{
 const copy=document.documentElement.cloneNode(true);
 copy.querySelector('#fragment-model').textContent=JSON.stringify(model).replaceAll('<','\\u003c');
 const live=$$('input,select,textarea'), cloned=[...copy.querySelectorAll('input,select,textarea')];
 live.forEach((node,i)=>{const target=cloned[i];if(node.tagName==='SELECT'){[...target.options].forEach((o,j)=>o.toggleAttribute('selected',node.options[j].selected));}else if(node.tagName==='TEXTAREA'){target.textContent=node.value;}else if(node.type!=='file'){target.setAttribute('value',node.value);target.toggleAttribute('checked',node.checked);}});
 download(model.id+'.html','<!doctype html>\n'+copy.outerHTML,'text/html');
};
$('#import').onchange=async()=>{const f=$('#import').files[0];if(!f)return;if(f.size>1_000_000){$('#diagnostics').textContent='Input exceeds 1 MB';return;}try{apply(new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer()));}catch{$('#diagnostics').textContent='Import refused: unreadable file or invalid UTF-8. Current model unchanged.';}};
$('#layout').onchange=()=>{model.graph.layout=$('#layout').value;graph();};$('#relayout').onclick=graph;
keyboardProfile({actions:{legend:()=>openPanel('legend'),themes:()=>openPanel('themes'),printOptions:()=>openPanel('print'),inspector:()=>openPanel('inspector'),zoomIn:()=>zoom(.1),zoomOut:()=>zoom(-.1),flip,escape:closePanel},isPanelOpen:()=>!!activePanel,navigate});
render();if(innerWidth<800)zoom(-.35);
// Read-only integration hook for host diagnostics and browser conformance tests.
window.FragmentPreview={getModel:()=>structuredClone(model),getEnvironment:()=>({...env})};
