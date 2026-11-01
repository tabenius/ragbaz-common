import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEvidence,evidenceHTML} from '../src/content/evidence-inspector.js';
const subject='a'.repeat(64);
const projection=inspectEvidence({schema:'ragbaz.evidence-inspector/1',subject:{kind:'design',sha256:subject},entries:[{type:'signature',label:'Original signed label',status:'unverified'}]});
test('translated chrome keeps original evidence bytes and states',()=>{
 const before=JSON.stringify(projection);
 const html=evidenceHTML(projection,{lang:'sv',messages:{title:'Bevisgranskning',subject:'Objekt',release:'Publicering ej godkänd'}});
 assert.match(html,/lang="sv"/);assert.match(html,/Bevisgranskning/);assert.match(html,/Original signed label/);
 assert.match(html,/unverified/);assert.equal(JSON.stringify(projection),before);
});
test('hostile translation strings are escaped and inert',()=>{
 const html=evidenceHTML(projection,{lang:'es',messages:{title:'<img src=x onerror=alert(1)>'}});
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
test('invalid locale refused, missing translations fall back to English',()=>{
 assert.throws(()=>evidenceHTML(projection,{lang:'../../bad'}));
 assert.match(evidenceHTML(projection,{lang:'en',messages:{title:'Local'}}),/Release authorization: not evaluated/);
});
