import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceMessages } from '../src/content/evidence-locales.js';
import { inspectEvidence, evidenceHTML } from '../src/content/evidence-inspector.js';
import { assertCatalogs, SUPPORTED_LOCALES } from '../src/i18n.js';
const A='a'.repeat(64);
test('all six Inspector locales are complete',()=>assert.equal(assertCatalogs(evidenceMessages),true));
test('localized HTML never translates raw evidence claim labels or digest',()=>{
 const payload=inspectEvidence({schema:'ragbaz.evidence-inspector/1',subject:{kind:'chain',sha256:A},entries:[{type:'signature',status:'unverified',label:'<original> signed title'}]});
 for(const language of SUPPORTED_LOCALES) {
  const output=evidenceHTML(payload,{lang:language});
  assert.match(output, /&lt;original&gt; signed title/);
  assert.match(output, new RegExp(A));
  assert.match(output, /Release authorization: not evaluated\.|Publiceringsbehörighet|ترخيص الإصدار|发布授权|Autorización de publicación|Разрешение на публикацию/);
  assert(!output.includes('<original>'));
 }
});
