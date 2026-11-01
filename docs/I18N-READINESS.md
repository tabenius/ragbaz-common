# Localization architecture and acceptance gate

Six locales: `en`, `sv`, `ar` (RTL), `zh`, `es`, `ru`. The implementation is `src/i18n.js`, exported as `@ragbaz/common/i18n`.

The helper validates equal translation keys and named placeholders across six catalogs, negotiates regional locales, and identifies RTL. It returns **plain text** only. Rendering clients must use textContent/escaping and must not translate original manuscript content, raw evidence claims, cryptographic material or immutable identifiers.

This commit does **not** claim all downstream UI is translated. Each app must inventory every page, error, dialog, email, consent, empty state and accessibility label, extract those into complete catalogs, test language switching and RTL, and arrange review by fluent speakers for security-critical text. CI coverage is necessary, not sufficient.

Adoption: Mouseion and Pieces can import the helper once their pinned shared source is advanced. Arabic uses `dir=rtl` for display only; hashes, public keys and source bytes must remain byte-exact and direction-isolated.
