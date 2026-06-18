## Learned User Preferences

- Prioritize cleaning upstream VDO.Ninja user-facing residue and tightening the default experience over a broad visual redesign.
- Use Loop Cam branding for product and support copy; reserve VDO.Ninja naming for advanced technical docs and source attribution only.
- Do not rebrand hidden upstream routes (for example `obs/`) unless Loop plans to expose them on the default surface.
- Keep the thin Loop overlay strategy: small `--loop-*` token layer and labeled CSS overrides, not a rewrite of upstream styles.
- Hide non-core home cards and the info blob from the default surface (for example speed test, stream media file, `#info`).
- Keep Create a Room as the primary action; put SSO, codecs, allowlist, approval, and director-as-performer controls behind advanced disclosure.
- Do not delete remote branches `director-ui`, `gitbook`, `quickstart`, `v21.2-stable`, or `v22.9.stable` without asking first.

## Learned Workspace Facts

- Loop Cam is Loop's own fork at `loop-online/loop.cam`; do not open PRs or contribute changes back to `steveseguin/vdo.ninja`.
- Git remotes: `origin` → `loop-online/loop.cam` (canonical); `upstream` → `steveseguin/vdo.ninja` (fetch/merge update source only).
- `FORK.md` is the fork contract; `README.md` is the product overview. Both document the no-upstream-contribution policy.
- Vercel deploys from `main` with no staging environment.
- Upstream runtime (`lib.js`, `main.js`, `webrtc.js`) is source of truth; Loop owns branding and the simplified default surface.
- Keep upstream DOM ids, URL params, function names, and translation keys stable unless there is a clear bug or product reason.
- Home "More Options" is curated by `loopVisibleHomeCards` in `lib.js`; do not reveal every hidden VDO.Ninja card.
- `main.css` stays upstream-first; Loop styling lives in the labeled `Loop Cam surface overrides` block at the end.
- Before upstream refreshes, run `classify-fork-drift.js`, `audit-upstream-drift.js`, and `verify-fork-contract.js`; validate with the full `scripts/verify-*.js` suite.
- Icons render Lucide SVG via `loop-icons.js` while keeping upstream `las la-*` class names; rebuild with `npm run build:icons` and verify with `npm run verify:icons` (see `docs/LOOP_ICONS.md`).
- The design system is Loop-owned: `DESIGN.md` (human spec) + `.impeccable/design.json` (machine tokens) are canonical; `loop-tokens.css`/`loop-ui.css` implement them. Verify with `npm run verify:design`; `npm run verify` runs the icon and design contracts together (also wired as `npm test`).
- Local dev server: `python3 scripts/dev-server.py` (default port 8765).
