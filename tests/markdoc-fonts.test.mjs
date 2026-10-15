import test from 'node:test';
import assert from 'node:assert/strict';
import { THEME_FONTS, themeFontStyles } from '../demo/markdoc-ragbaz/fonts.js';

test('font alternatives are finite host-curated Google CSS2 families with swap and local fallback', () => {
  assert.equal(Object.keys(THEME_FONTS).length, 5);
  for (const [id, fonts] of Object.entries(THEME_FONTS)) {
    const url = new URL(fonts.url);
    assert.equal(url.origin, 'https://fonts.googleapis.com'); assert.equal(url.pathname, '/css2');
    assert.equal(url.searchParams.get('display'), 'swap');
    assert(url.searchParams.getAll('family').length > 0);
    const styles = themeFontStyles(id);
    assert(styles.includes(fonts.title)); assert(styles.includes(fonts.body));
    assert(styles.includes('Georgia,serif'));
    assert(Object.isFrozen(fonts));
  }
  assert.throws(() => themeFontStyles('https://attacker.example/fonts.css'), /No curated/);
});
