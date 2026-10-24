// Exact host-curated alternatives; manuscripts and queries never supply URLs.
const book = family => `${family.replaceAll(' ', '+')}:ital,wght@0,400;0,600;0,700;1,400`;
const css = families => 'https://fonts.googleapis.com/css2?' + families.map(f => 'family=' + f).join('&') + '&display=swap';
const entry = (title, body, families, ui) => Object.freeze({ title, body, ui, url: css(families) });
export const THEME_FONTS = Object.freeze({
  'markdoc-ragbaz-sci-tufte': entry('Source Serif 4', 'Source Serif 4', [book('Source Serif 4'), 'Source+Sans+3:wght@400;600'], 'Source Sans 3'),
  heartfulness: entry('Cormorant Garamond', 'EB Garamond', [book('Cormorant Garamond'), book('EB Garamond')]),
  'aether-prima-materia': entry('IM Fell English', 'Crimson Pro', ['IM+Fell+English:ital@0;1', book('Crimson Pro')]),
  'aether-sun-and-moon': entry('Cormorant Garamond', 'Spectral', [book('Cormorant Garamond'), book('Spectral')]),
  'aether-blackening': entry('Cormorant Infant', 'EB Garamond', [book('Cormorant Infant'), book('EB Garamond')]),
});

export function themeFontStyles(id) {
  const fonts = THEME_FONTS[id];
  if (!fonts) throw new Error('No curated fonts for installed presentation');
  return `
html[data-fonts=theme] body{font-family:"${fonts.body}",Baskerville,Georgia,serif}
html[data-fonts=theme] #paper>article>:is(h1,h2,h3,h4){font-family:"${fonts.title}",Baskerville,Georgia,serif}
html[data-fonts=theme] .aether-study,html[data-fonts=theme] .aether-plate text{font-family:"${fonts.body}",Georgia,serif}
${fonts.ui ? `html[data-fonts=theme] :is(.reader-drawer,button,input,select){font-family:"${fonts.ui}",system-ui,sans-serif}` : ''}
.font-option{display:grid;gap:8px;margin:0 0 20px;font:13px/1.5 system-ui,sans-serif}.font-option select{font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--rule);padding:9px;max-width:100%;min-height:42px}.font-option small{font-size:11px;color:var(--muted)}
`;
}

export function setupThemeFonts(config) {
  if (config.fontAlternatives !== 'google-curated/1') return;
  const fonts = THEME_FONTS[config.metaDocument?.id];
  if (!fonts) return;
  const root = document.documentElement;
  const key = 'ragbaz.reader.fonts';
  let stored;
  try { stored = localStorage.getItem(key); } catch { /* Session-only. */ }
  const label = document.createElement('label'); label.className = 'font-option'; label.htmlFor = 'theme-fonts';
  label.innerHTML = '<span>Typography</span><select id="theme-fonts" aria-describedby="theme-font-status"><option value="system">System fonts · offline</option><option value="theme">Theme fonts · Google</option></select><small id="theme-font-status" role="status"></small>';
  document.querySelector('.appearance-option').after(label);
  const select = label.querySelector('select'), status = label.querySelector('small');
  let link, timer, turn = 0;
  function apply(choice, persist = false) {
    const generation = ++turn;
    clearTimeout(timer); link?.remove(); link = undefined;
    choice = choice === 'theme' ? 'theme' : 'system'; select.value = choice;
    root.dataset.fonts = choice;
    document.dispatchEvent(new Event('reader-typography-change'));
    if (persist) try { localStorage.setItem(key, choice); } catch { /* Still works this session. */ }
    if (choice === 'system') { status.textContent = 'System fonts active. Theme fonts contact Google.'; return; }
    status.textContent = `Loading ${fonts.title} / ${fonts.body} from Google; system fallback stays available.`;
    const sheet = document.createElement('link'); link = sheet;
    const fallback = () => {
      if (generation !== turn) return;
      clearTimeout(timer); sheet.remove(); root.dataset.fonts = 'system';
      document.dispatchEvent(new Event('reader-typography-change'));
      status.textContent = 'Google fonts unavailable. System fallback is active.';
    };
    sheet.rel = 'stylesheet'; sheet.crossOrigin = 'anonymous'; sheet.referrerPolicy = 'no-referrer'; sheet.href = fonts.url;
    sheet.onload = () => {
      if (generation !== turn) return;
      clearTimeout(timer); status.textContent = `${fonts.title} / ${fonts.body} stylesheet loaded. Missing fonts or glyphs use fallback.`;
      document.dispatchEvent(new Event('reader-typography-change'));
    };
    sheet.onerror = fallback;
    timer = setTimeout(fallback, 12000);
    document.head.append(sheet);
  }
  select.addEventListener('change', () => apply(select.value, true));
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(event.newValue); });
  apply(stored);
}
