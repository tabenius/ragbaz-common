import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_LOCALES, isRtl, localeFor, assertCatalogs, translate } from '../src/i18n.js';
const catalog=Object.fromEntries(SUPPORTED_LOCALES.map(l=>[l,{greeting:'Hello {user}',save:'Save'}]));
test('six locales and regional negotiation',()=>{assert.equal(SUPPORTED_LOCALES.length,6);assert.equal(localeFor('ar-SA'),'ar');assert.equal(localeFor('zh_CN'),'zh');assert.equal(localeFor('xx'),'en');assert.equal(isRtl('ar-EG'),true);assert.equal(isRtl('sv'),false)});
test('catalog coverage and placeholder agreement are mandatory',()=>{assert.equal(assertCatalogs(catalog),true);const broken=structuredClone(catalog);delete broken.ar.save;assert.throws(()=>assertCatalogs(broken));const mismatch=structuredClone(catalog);mismatch.zh.greeting='您好 {person}';assert.throws(()=>assertCatalogs(mismatch));});
test('translation output is text, not executable markup',()=>{assert.equal(translate(catalog,'ar','greeting',{user:'<script>'}),'Hello <script>');assert.throws(()=>translate(catalog,'en','missing'));assert.throws(()=>translate(catalog,'en','greeting'));});
