import test from 'node:test';
import assert from 'node:assert/strict';
import {REPLICAD_LANGUAGES,REPLICAD_LOCALES,replicadLanguage,replicadMessages} from '../src/content/replicad-locales.js';
test('six complete Replicad viewer catalogs',()=>{
 assert.deepEqual(REPLICAD_LANGUAGES,['en','sv','ar','zh','es','ru']);
 const keys=Object.keys(REPLICAD_LOCALES.en).sort();
 for(const locale of REPLICAD_LANGUAGES){
  const c=REPLICAD_LOCALES[locale];
  assert.deepEqual(Object.keys(c).sort(),keys);
  assert(Object.values(c).every(x=>typeof x==='string'&&x.trim().length>0));
 }
});
test('Arabic regional negotiation and supported fallback',()=>{
 assert.equal(replicadLanguage('ar-SA'),'ar');
 assert.equal(replicadLanguage('zh_CN'),'zh');
 assert.equal(replicadLanguage('fr-FR'),'en');
 assert.match(replicadMessages('ar').intro,/دون رفع/);
});
