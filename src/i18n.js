// Shared, deterministic application-language support. Never translate signed data.
export const SUPPORTED_LOCALES = Object.freeze(['en','sv','ar','zh','es','ru']);
export const RTL_LOCALES = Object.freeze(['ar']);
const has = Object.prototype.hasOwnProperty;
export function localeFor(value, fallback='en') {
  if (!SUPPORTED_LOCALES.includes(fallback)) throw new RangeError('Invalid fallback locale');
  if (typeof value !== 'string') return fallback;
  const head = value.toLowerCase().replace(/_/g,'-').split('-')[0];
  return SUPPORTED_LOCALES.includes(head) ? head : fallback;
}
export function isRtl(value) { return RTL_LOCALES.includes(localeFor(value)); }
export function assertCatalogs(catalogs, reference='en') {
  if (!catalogs || typeof catalogs !== 'object' || Array.isArray(catalogs)) throw new TypeError('Catalogs required');
  const base=catalogs[reference];
  if (!base || typeof base !== 'object' || Array.isArray(base)) throw new TypeError('Missing reference catalog');
  const keys=Object.keys(base).sort();
  if (!keys.length) throw new RangeError('Empty catalog');
  for (const locale of SUPPORTED_LOCALES) {
    const entries=catalogs[locale];
    if (!entries || typeof entries!=='object' || Array.isArray(entries)) throw new RangeError('Missing locale '+locale);
    if (JSON.stringify(Object.keys(entries).sort())!==JSON.stringify(keys)) throw new RangeError('Missing or extra keys for '+locale);
    for (const key of keys) {
      if (!/^[a-z][a-z0-9_.-]*$/.test(key) || typeof entries[key]!=='string' || !entries[key].trim()) throw new RangeError('Invalid translation: '+locale+'.'+key);
      const params = text => [...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map(m=>m[1]).sort().join(',');
      if (params(entries[key])!==params(base[key])) throw new RangeError('Placeholder mismatch: '+locale+'.'+key);
    }
  }
  return true;
}
export function translate(catalogs, locale, key, params={}) {
  const lang=localeFor(locale);
  if (!has.call(catalogs[lang],key)) throw new RangeError('Unknown translation key');
  return catalogs[lang][key].replace(/\{([a-z][a-z0-9_]*)\}/g, (_m,name)=>{
    if (!has.call(params,name)) throw new RangeError('Missing translation argument');
    return String(params[name]);
  });
}
// Caller must render translated strings and arguments using textContent / escaped text.
// No innerHTML or interpolation into HTML attributes with this API.
