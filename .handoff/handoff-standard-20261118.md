# Fleet handoff standard v1 — handoff 2026-11-18

Written by: claude (Claude Code cloud session, no access to local hosts).
Layer 1 of the standard it proposes (`docs/HANDOFF-STANDARD.md`). The
machine-readable minimum is in `.handoff/handoff-standard.mvh.json`.
Lines are **claims** until marked **verified** with the command and date.

## Resume target

- Repository: `tabenius/ragbaz-common`, branch `handoff-standard` (draft PR).
- Related: tabenius/rebsync#8 (`.handoff/android-release-20261118.md`, the
  first handoff in the new shape).
- Worktree on the writing host (hint only): `/home/user/ragbaz-common`.

## Where things stand

- **verified 2026-11-18:** there was no fleet handoff standard. There were
  six partial ones, listed in `docs/HANDOFF-STANDARD.md` §"Existing piece".
  Two incompatible `active-tasks.json` shapes exist (remote-android uses
  absolute `/home/xyzzy` paths; token-economy uses `schemaVersion 1.0.0`).
- **verified 2026-11-18:** `scripts/handoff.py new` drafts an MVH that the real
  `mneme evac build` (mneme `1caff30`) accepts into a `hypomnema.bundle.v1`.
  `handoff.py check` refuses an `X_PASSWORD=value` line and a GitHub token,
  and passes `read -rs`, `${{ secrets.X }}` and `$(pass show …)`. Command:
  scratch repo + `python3 scripts/handoff.py new/check`, then
  `mneme evac build --input …mvh.json`.
- **verified (git only):** the earlier work happened Oct 12 – Nov 2. Commits
  are listed in `docs/fleet-history-2026-09-15_2026-11-18.md`, "The handoff
  thread".
- **not found in git:** the background "gradually improve the handoff"
  automation the owner remembers. mneme's `HYPOMNEMA.md` plans it, and its
  `HYPOMNEMA-LOCAL.md` says continuous staging is unimplemented. Who wrote what
  (Claude, Codex, Big Pickle) cannot be told from git: about 1,100 commits
  carry the owner's identity and no trailer.
- **claim:** the standard is a proposal until the owner accepts it.

## Next action

Search the local hosts for the earlier handoff semi-automation (section Next action) and record what is found:

1. On each host (kali-1, the Chromebook, the laptop as it comes back),
   run the searches in `docs/HANDOFF-STANDARD.md` §5. Look also for
   timers and scripts:

       systemctl --user list-timers --all 2>/dev/null | grep -i -E 'handoff|evac|hypomn|mneme'
       crontab -l 2>/dev/null | grep -i -E 'handoff|evac|hypomn|mneme'
       grep -rIl -i -E 'handoff|hypomnema|mneme evac' ~/bin ~/.local/bin ~/.config ~/src 2>/dev/null | grep -v node_modules | head -50
       ls -la ~/Handoffs ~/Handoffs/evac 2>/dev/null

2. In mneme (OpenCode sessions, which is where Big Pickle runs), check Oct 15 – Nov 3 first:

       mneme query history_search --args '{"query":"handoff OR hypomnema OR evac OR MVH","mode":"fts","since_ms":1792015200000,"until_ms":1793656800000,"limit":50}'
       mneme query history_get_tool_runs --args '{"tool":"shell","since_ms":1792015200000,"limit":50}'

   For Claude and Codex, mneme has no index, so grep
   `~/.claude/projects/*/*.jsonl` and `~/.codex/sessions/` for the same words.
3. In Dash: call `handoffs_list {"includeHistory": true}` and
   `hypomnema.list_bundles`. Anything uploaded there between Oct 26 and Nov 3
   is direct evidence of the old flow.
4. Record findings as a dated section here, newest first: what, where, which
   harness/model, and whether it still runs. Fold anything useful into
   `scripts/handoff.py` or a host-side timer. Never copy secrets found
   along the way.

Then: the owner reviews and accepts or amends the standard. Migrate the
existing `.handoff/` dirs with `handoff.py index` and `check`, starting with
remote-android and token-economy. Add the one-line pointer to each repository's
`AGENTS.md`.

## Decisions

- Build on MVH v1 (mneme) as Layer 0 and keep mneme's schema authoritative.
  Do not fork it. (claude, proposal)
- The index lives per repository at `.handoff/active-tasks.json`, schema
  `ragbaz.handoff-index/1`, with repository-relative paths only. (claude, proposal)
- Git is the primary copy. Dash MCP, Hypomnema bundles and `rbq` are
  fallbacks for when git or GitHub is unavailable. (claude, proposal)
- Rejected: one central fleet handoff repository. It is a single point of
  failure, and handoffs belong next to the code they describe.

## Blockers

- The cloud session cannot see local hosts, sessions, timers or Dash, so the
  search in Next action needs a local agent or the owner.
- Owner acceptance of the standard.

## Verify

    git fetch origin && git checkout handoff-standard
    python3 scripts/handoff.py check
    # optional, with mneme built:
    mneme evac build --input .handoff/*.mvh.json --output /tmp/evac-test.json.gz --observed-at $(date +%s)

## Do not

- Put secrets in a handoff, chat or commit. On 2026-11-18 a keystore password
  was pasted into a chat. Name where a secret lives, never its value.
- Rewrite another participant's handoff section. Append a dated correction.
- Claim a harness wrote something without evidence (trailer, session id).

## Refs

- git:tabenius/ragbaz-common@handoff-standard
- docs/HANDOFF-STANDARD.md, docs/fleet-history-2026-09-15_2026-11-18.md
- mneme: `docs/HYPOMNEMA.md`, `docs/HYPOMNEMA-LOCAL.md`, `schemas/mvh.schema.json`, `src/evac.rs`
- ragbaz-dash `58eb62e` (personal handoff MCP), `56281f6` (Hypomnema sink)
- weftmark `docs/contracts/handoff-context-budget-v0.md`
- rebekah `docs/contracts/workspace-handoff.schema.json`
- token-economy `.handoff/codex-online.md`; remote-android `doc/08-Handoff.md`
- tabenius/rebsync#8
