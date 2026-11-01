// Safe deterministic SVG renderer for trusted business model output.
// No arbitrary markup, scripts, external requests, SVG foreignObject or CSS imports.
import { evaluateBusinessPlan } from './business-plan.js';
const esc=(s)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function renderSegmentChartSVG(data,{title='Illustrative annual spending by segment',width=960}={}){
 if(!Number.isSafeInteger(width)||width<480||width>1600)throw Error('chart width outside bounds');
 if(typeof title!=='string'||title.length>160)throw Error('invalid chart title');
 const m=evaluateBusinessPlan(data);
 if(m.segments.length>20)throw Error('chart supports at most 20 segments');
 const height=120+m.segments.length*58;
 const max=Math.max(1,...m.segments.map(s=>s.annual_spend_cents));
 const rows=m.segments.map((s,i)=>{
  const y=93+i*58;
  const bar=Math.round(s.annual_spend_cents/max*(width-475));
  const label=esc(s.id);
  const value=esc('$'+(s.annual_spend_cents/100/1000000).toFixed(2)+'M');
  return '<text x="30" y="'+(y+19)+'" fill="#e9e1d6" font-size="16">'+label+'</text><rect x="230" y="'+y+'" width="'+(width-455)+'" height="25" rx="4" fill="#30444b"/><rect x="230" y="'+y+'" width="'+bar+'" height="25" rx="4" fill="'+(i%2?'#dfaa7b':'#75b2d1')+'"/><text x="'+(width-194)+'" y="'+(y+19)+'" fill="#e9e1d6" font-size="15">'+value+'</text>';
 }).join('');
 const note=m.total_is_additive?'Segment sum assumes disjoint populations.':'NON-DEDUPLICATED segment sum; populations may overlap.';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(title)+'"><rect width="100%" height="100%" fill="#17282e"/><title>'+esc(title)+'</title><text x="30" y="43" font-family="sans-serif" fill="#e9e1d6" font-size="25" font-weight="700">'+esc(title)+'</text><g font-family="sans-serif">'+rows+'</g><text x="30" y="'+(height-20)+'" font-family="sans-serif" font-size="13" fill="#d5bbb0">'+esc(note)+' Illustrative, not a forecast.</text></svg>';
}
