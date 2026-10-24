// A reader preference, never document-authored metadata or publication state.
export function setupAppearance() {
  const root = document.documentElement;
  const select = document.getElementById('appearance');
  const key = 'ragbaz.sci.appearance';
  select.value = root.dataset.appearance || 'system';
  select.addEventListener('change', () => {
    const choice = ['light', 'dark'].includes(select.value) ? select.value : 'system';
    if (choice === 'system') delete root.dataset.appearance;
    else root.dataset.appearance = choice;
    try {
      if (choice === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, choice);
    } catch { /* File URLs and storage-denied contexts still support this session. */ }
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    const choice = ['light', 'dark'].includes(event.newValue) ? event.newValue : 'system';
    select.value = choice;
    if (choice === 'system') delete root.dataset.appearance;
    else root.dataset.appearance = choice;
  });
}
