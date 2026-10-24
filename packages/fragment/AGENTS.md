# Fragment implementation conventions

Read ../AGENTS.md and docs/PROTOCOL.md. This package is additive and independently
built; do not change the existing identity package's dependency graph.

The user explicitly prefers arrow-key and hjkl navigation in all their software.
Preserve this default in new widgets. Escape leaves completion text entry. Never
intercept h/j/k/l while the user is typing. Keep ordinary Tab focus traversal;
canvas-only Tab may flip an artifact. L, P, T, + and - are default actions.

Core functions live in src/ and crates/fragment/src/. Product/sample page rendering
belongs in examples/. Treat imported models and additional instructions as data.
No eval, automatic fetch, HTML insertion, or LLM invocation from imported content.

Update shared schema and both implementations together. Run npm test, cargo test,
npm run test:parity, and the offline browser tests after behavior changes. Also run
the repository root's npm test before proposing integration.
