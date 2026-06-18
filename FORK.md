# Loop Cam Fork Contract

Loop Cam is a branded, focused fork of VDO.Ninja. The goal is to stay close enough to upstream that future updates remain practical, while presenting a simpler Loop product surface for production-source workflows.

## Relationship to VDO.Ninja (read this first)

**Loop Cam is Loop's own fork.** All product work happens in [loop-online/loop.cam](https://github.com/loop-online/loop.cam). We are **not** contributing changes back to the original [steveseguin/vdo.ninja](https://github.com/steveseguin/vdo.ninja) project.

The upstream repo exists here only as a **read-only update source**:

- `git fetch upstream` — see what changed upstream
- Review, merge, or cherry-pick into Loop's `main` when we want those fixes
- Reapply Loop branding and surface policy as a thin layer on top

Do **not** open pull requests to VDO.Ninja for Loop-specific work. Do **not** treat upstream as a place to land Loop features, docs, or branding. If something belongs in Loop Cam, it belongs in this repo.

Remotes:

| Remote | Repo | Purpose |
|--------|------|---------|
| `origin` | `loop-online/loop.cam` | **Canonical Loop Cam** — push here, deploy from here |
| `upstream` | `steveseguin/vdo.ninja` | **Update source only** — fetch and merge; no contributions |

## Product Scope

Loop Cam supports these primary workflows:

- Remote guests publish camera and microphone.
- Users share screens into a production workflow.
- Directors create and manage rooms.
- OBS or another browser source captures clean scene, solo, or view links.
- Basic guest controls, mute controls, layout controls, bitrate controls, and connection status stay available.
- Iframe and URL-parameter control remain available for integration and compatibility.

Loop Cam should not present the full VDO.Ninja feature set as the normal default experience.

## Surface Policy

Use four visibility levels when evaluating upstream features.

- Primary features are visible by default. This includes room creation, camera sharing, and screen sharing.
- Contextual features appear inside the room, director, guest, or clean-output flows where they naturally belong.
- Advanced features may remain available through explicit URLs, URL params, or APIs. They should not be promoted from the default home surface unless Loop uses them directly.
- Internal features can remain in the runtime for compatibility, but they should not be linked or advertised in the Loop UI.

The current home-page "More Options" reveal is intentionally curated by `loopVisibleHomeCards` in `lib.js`. Do not replace that with a broad selector that reveals every hidden VDO.Ninja card.

## Optional Upstream Roots

Loop Cam now keeps the latest upstream optional roots in the repo when merging VDO.Ninja. Treat those roots as available backend/direct-route capability, not as default Loop product surface.

Retain upstream support files and roots when a supported or intentionally hidden Loop route references them:

- `auth-client.js` and `auth-styles.css`: required by current upstream room/auth support.
- `check.css`: required by the upstream preflight check page.
- `core/`: required by the hidden podcast studio route.
- `podcast/`: hidden route kept available through `?podcast`.
- `chat-lite/`, `notifications/`, `obs/`, `screenrecorder/`, examples, and upstream media packs: retained from upstream for compatibility and future optional use, but not linked from the default Loop home surface.

Keep these advanced routes available but hidden from the normal home surface:

- `comms.html`
- `whiteboard.html`
- `whip.html`
- `monitor.html`
- `iframe.html`
- `speedtest.html`, `check.html`, and `results.html`
- `confirm.html`, because `lib.js` uses it for external URL confirmation.

Some older fork routes are still present as legacy/direct routes, but they are not part of the promoted Loop surface unless Loop deliberately adopts them:

- `mixer.html`
- `meet.html`
- `remotemidi.html`
- `electron.html`

Do not expose these pages from the default Loop surface just because upstream ships them. First decide whether the route is a Loop-supported workflow. If it is, align the visible copy with Loop and add a verifier. If it is not, keep it as a hidden direct route.

If a promoted Loop route starts referencing an upstream optional root, either verify that full dependency boundary or remove the link from the promoted route. Do not leave a half-present workflow that loads with local 404s.

## Upstream Compatibility Rules

Prefer keeping upstream names stable:

- Keep DOM ids such as `container-3`, `mutebutton`, and `directorLinks2`.
- Keep function names such as `previewWebcam`, `createRoom`, and `dropDownButtonAction`.
- Keep URL params such as `push`, `view`, `room`, `director`, and `scene`.
- Keep `session.*` properties and action names unless a real bug requires changing them.
- Avoid mass-renaming translation keys.

Deliberate id divergences (keep through upstream merges):

- The flip-camera glyph on `index.html` and `room.html` uses `id="flipcameratoggle"`. Upstream ships it as a second `id="settingstoggle"`, colliding with the real settings glyph (`las la-cog`) so `getElementById` only ever finds the first. The rename keeps `settingstoggle` unique per page. `scripts/verify-loop-ui-simplification.js` pins this; if an upstream merge reintroduces the duplicate, that verifier fails.
- The apparent `id="main-js"` duplicate near the end of `room.html` is not a real duplicate. The live script tag carrying `id="main-js"` (`src="./main.js?ver=1065"`) sits just below an HTML-commented branding example that reuses the same id for copy-paste parity (`<script ... id="main-js" src="./main.js" data-translation="blank"></script>`). The commented copy never reaches the DOM, so there is zero runtime duplication and nothing to dedupe.
- The `id="fileselector2"` duplicate in `room.html` is load-bearing and deliberately deferred. Two distinct `<input id="fileselector2">` elements are wired to different handlers — `session.changePublishFile(this,event)` and `session.hostFile(this,event)` — so upstream gave two genuinely different file pickers the same id. No discoverable UI trigger disambiguates which one a `getElementById("fileselector2")` caller expects, and renaming either risks breaking an unknown upstream caller. The duplicate is left as-is to avoid an unbounded-blast-radius rename.

Brand the public surface instead:

- Logos, favicons, and social images.
- Page titles and metadata.
- Visible copy in the default Loop path.
- CSS theme and Loop-specific visual overrides.
- Default settings and visible help links.
- Icon normalization via `loop-icons.css`, `loop-icons.js`, and `docs/LOOP_ICONS.md` (keep upstream `las la-*` class names).

## Icon System

Loop Cam **renders Lucide icons** (ISC) while keeping upstream **Line Awesome class names** (`las la-*`) for mergeability.

- **Map** — `scripts/loop-icon-line-map.json` (+ generated `loop-icon-line-map.js`)
- **Glyphs** — `loop-icon-glyphs.js` (generated from Lucide; run `npm run build:icons`)
- **Runtime** — `loop-icons.js` upgrades `<i class="las la-*">` to inline Lucide SVG; `loop-icons.css` normalizes size/contrast
- **Adding icons** — Map new `la-*` token → Lucide name, rebuild glyphs, run `node scripts/verify-loop-icon-system.js`
- **Docs** — `docs/LOOP_ICONS.md`

The Line Awesome font has been removed from the repo and `main.css` — Lucide is the only icon renderer. Every HTML page that uses `las la-*` hooks loads `loop-icons.js` and every hook maps to a Lucide glyph; `scripts/verify-loop-icon-coverage.js` enforces this and fails if any page uses a hook without the upgrader or without a mapping. The three former CSS-glyph icons (message-card warning/info, selected-device check) now use native Unicode glyphs.

## Design System

The Loop Cam design system is **Loop-owned**, not upstream. These are canonical artifacts; treat them as Loop surface during upstream-drift triage:

- **Human spec** — `DESIGN.md` (colors, typography, elevation, components, do's/don'ts)
- **Machine-readable tokens** — `.impeccable/design.json` (color ramps, shadows, motion, component snippets)
- **Product context** — `PRODUCT.md`, `AGENTS.md`, and the `docs/DESIGN.md` / `docs/PRODUCT.md` pointers
- **Implementation** — `loop-tokens.css` (the `--loop-*` token layer) and `loop-ui.css` carry the values; `main.css` stays upstream-first with Loop overrides in its labeled block

`scripts/verify-loop-design-tokens.js` pins the implementation to the spec — accent, surface fallbacks, radii, shadows, and motion in the CSS must stay consistent with `.impeccable/design.json` and `DESIGN.md`, and the verifier fails closed if the design source is missing. An upstream re-merge that drops a `--discord-grey-*` variable or a hand-edit that desyncs token from spec fails here.


Good cleanup reduces maintenance cost or user confusion:

- Ignore local machine artifacts such as `.DS_Store`.
- Remove broken visible links.
- Standardize Loop assets and metadata.
- Move branding into clear, easy-to-review places.
- Hide non-core entry points from the normal UI.
- Document supported flows and upgrade steps.

Risky cleanup should wait for stronger tests:

- Large rewrites of `lib.js`, `main.js`, or `webrtc.js`.
- Deleting backend feature branches that may still be used by direct URLs or integrations.
- Moving files that upstream expects by path.
- Renaming internal ids, functions, params, or data attributes.

## Upgrade Strategy

When refreshing from VDO.Ninja upstream (fetch/merge only — not contributing back):

1. Preserve the current Loop worktree and remove local artifact noise from the diff.
2. Fetch upstream and review file-level changes before merging.
3. Prioritize browser compatibility, WebRTC reliability, device handling, signaling, security, and OBS/browser-source behavior.
4. Reapply Loop branding and surface policy as a thin layer.
5. Keep advanced capabilities available unless there is a clear reason to remove them.
6. Verify the supported Loop workflows in a browser.

Use the drift audit before starting an upstream refresh:

```sh
node scripts/classify-fork-drift.js
node scripts/audit-upstream-drift.js
node scripts/verify-fork-contract.js
```

The classifier compares the fork base, the current Loop worktree, and latest upstream. Use it to avoid mistaking stale old VDO.Ninja code for Loop custom work. The normal interpretation is:

- `stale-native-vdo`: Loop still matches the fork base while upstream changed; normally take upstream.
- `loop-only-change`: Loop changed while upstream stayed like the fork base; preserve or intentionally clean up.
- `both-changed`: Loop and upstream both changed; inspect hunk-by-hunk.
- `aligned-with-upstream`: no action needed.

The drift audit is working-tree aware. It separates high-risk runtime overlap, upstream files added locally, local-only fork assets, and optional upstream-only roots. Use both reports to decide what to patch, what to hide, and what to leave out of the Loop product surface.

`main.css` should stay latest-upstream-first. Keep Loop-specific styling in the labeled `Loop Cam surface overrides` block at the end of the file, so future upstream CSS refreshes are mechanical and reviewable.

`main.js` and `lib.js` should also stay latest-upstream-first. Current Loop deltas are intentionally small:

- `main.js`: custom-domain title fallback should use Loop metadata, and iframe `function` messages should return before falling through to generic action handling.
- `lib.js`: `dropDownButtonAction` should reveal only `loopVisibleHomeCards`, not every hidden VDO.Ninja home card. Keep upstream card IDs intact. The default Loop home surface keeps `loopVisibleHomeCards` empty and hides `#dropButton` and `#info` via the Loop CSS override block.

If these files grow larger Loop deltas, treat that as drift to justify or remove.

## Verification Checklist

Before declaring an upgrade complete, verify:

- The home page shows the intended simple Loop surface.
- "More Options" only reveals approved Loop cards.
- A guest can publish camera and microphone.
- A user can publish screen share.
- A director room can be created.
- A second browser tab can join as a guest.
- The director can see and control the guest.
- A clean view, solo, or scene link works for capture.
- Basic mute, camera, layout, and bitrate controls still work.
- Iframe or URL-param integrations used by Loop still work.

Run the home-surface check after any upstream refresh or home-page change:

```sh
node scripts/verify-codecs-handler.js
node scripts/verify-streamsaver-assets.js
node scripts/verify-fork-contract.js
node scripts/verify-translation-health.js
node scripts/verify-optional-root-scope.js
node scripts/verify-loop-css-contract.js
node scripts/verify-loop-design-tokens.js
node scripts/classify-fork-drift.js index.html main.js lib.js webrtc.js main.css iframe.html iframe-examples.js thirdparty/CodecsHandler.js
node scripts/verify-iframe-examples.js
node scripts/verify-screen-share-effects-dom.js
node scripts/verify-whip-error-callback.js
node scripts/verify-midi-command-volume-branch.js
node scripts/verify-buffer-settings-ui.js
node scripts/verify-js-injection-fails-closed.js
node scripts/verify-studio-software-branches.js
node scripts/verify-whep-share-target.js
node scripts/verify-upstream-minor-fixes.js
node scripts/verify-auxiliary-branding-surface.js
NODE_PATH=/path/to/node_modules node scripts/verify-results-page-security.js
NODE_PATH=/path/to/node_modules node scripts/verify-guest-tips-param.js
NODE_PATH=/path/to/node_modules node scripts/verify-iframe-credentialless.js
NODE_PATH=/path/to/node_modules node scripts/verify-obs-iframe-app-region.js
NODE_PATH=/path/to/node_modules node scripts/verify-obs-control-buttons.js
NODE_PATH=/path/to/node_modules node scripts/verify-loop-home-surface.js
NODE_PATH=/path/to/node_modules node scripts/verify-loop-branding-surface.js
NODE_PATH=/path/to/node_modules node scripts/verify-language-timezone-reorder.js
NODE_PATH=/path/to/node_modules node scripts/verify-loop-room-flow.js
NODE_PATH=/path/to/node_modules node scripts/verify-camera-publish-flow.js
NODE_PATH=/path/to/node_modules node scripts/verify-screen-share-flow.js
NODE_PATH=/path/to/node_modules node scripts/verify-screen-share-aspect-ratio.js
NODE_PATH=/path/to/node_modules node scripts/verify-detailed-state-chunk-buffer.js
NODE_PATH=/path/to/node_modules node scripts/verify-url-obfuscation.js
NODE_PATH=/path/to/node_modules node scripts/verify-iframe-api-bridge.js
NODE_PATH=/path/to/node_modules node scripts/verify-target-guest-remote-controls.js
```

In Codex Desktop, the bundled runtime can run it with:

```sh
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-codecs-handler.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-streamsaver-assets.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-fork-contract.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-translation-health.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-optional-root-scope.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-loop-css-contract.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-loop-design-tokens.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-iframe-examples.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-screen-share-effects-dom.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-whip-error-callback.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-midi-command-volume-branch.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-buffer-settings-ui.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-js-injection-fails-closed.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-studio-software-branches.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-whep-share-target.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-upstream-minor-fixes.js
/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-auxiliary-branding-surface.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-results-page-security.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-guest-tips-param.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-iframe-credentialless.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-obs-iframe-app-region.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-obs-control-buttons.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-loop-home-surface.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-loop-branding-surface.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-language-timezone-reorder.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-loop-room-flow.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-camera-publish-flow.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-screen-share-flow.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-screen-share-aspect-ratio.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-detailed-state-chunk-buffer.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-url-obfuscation.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-iframe-api-bridge.js
NODE_PATH=/Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/robdezendorf/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify-target-guest-remote-controls.js
```
