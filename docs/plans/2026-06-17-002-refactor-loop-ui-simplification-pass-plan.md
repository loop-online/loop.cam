---
title: "refactor: Loop Cam UI/UX simplification pass"
type: refactor
date: 2026-06-17
branch: feat/loop-ui-simplification-pass
status: ready
depth: deep
origin: session audit (34-finding Loop Cam UI/UX architecture review)
---

# refactor: Loop Cam UI/UX Simplification Pass

## Summary

Implement the session UI/UX audit (34 findings across 7 themes) on the `feat/loop-ui-simplification-pass` branch. The work removes accumulated complexity in the Loop overlay — a double-shipped icon font, an over-broad MutationObserver, dead home-surface markup, a stale duplicated `room.html`, over-exposed flow controls, inconsistent buttons/copy/radii, and accessibility sloppiness — while keeping the thin-overlay fork contract intact.

The hard rule that governs sequencing: the 34 `scripts/verify-*.js` scripts **are** the test contract. Several pin exact declarations (radii, override-block strings, hidden-card ids, icon-system file presence). Any fix that changes a pinned declaration updates the matching verifier in the same unit — never deletes it. Each unit ends in a verifier run so the contract stays green commit-by-commit.

High-merge-cost upstream rewrites (deleting upstream home cards, renaming upstream DOM ids, de-duplicating the shared `settingstoggle` id) are called out explicitly per unit and either done with documented reasoning or deferred to `### Deferred to Follow-Up Work`, never silently.

---

## Problem Frame

Loop Cam is a thin Loop-branded overlay on upstream VDO.Ninja. The overlay has drifted: it now carries redundant runtime weight (Line Awesome font shipped alongside the Lucide runtime upgrade), a MutationObserver scoped to the whole `body` subtree, ~190 lines of permanently-hidden home cards, a `room.html` that is a near-verbatim stale copy of `index.html` (confirmed: menus differ only by ~30-line offset), and a default surface that over-exposes advanced controls. Buttons, resolution labels, and corner radii diverge across flows. There are concrete HTML-validity defects (a `<select id="codecGroupFlag" type="checkbox">`, a duplicated `id="settingstoggle"` present in both `index.html` and `room.html`).

The audit asked to "do it all, everything, make calls using best judgement." This plan converts that into dependency-ordered, individually-verifiable units, biased toward Loop-owned surfaces (the override block, `loop-*` files, curated reveal list) and conservative about upstream-markup churn that raises the cost of the next `upstream` merge.

---

## Scope Boundaries

**In scope (Loop-owned, confident):**
- Icon system consolidation: stop double-shipping Line Awesome where Lucide already covers it; narrow the MutationObserver; verify-script lockstep.
- Home surface: remove dead/hidden card weight from the default surface via `loopVisibleHomeCards` and the override block; keep upstream card markup present but not revealed.
- Button, copy, and resolution-label normalization in Loop override CSS and Loop-authored copy.
- CSS overlay hygiene + token drift: collapse one-off hex to `--loop-*` tokens, normalize radii to the DESIGN.md scale, dedupe override declarations.
- Accessibility: focus-visible, touch targets, labels/`aria` on Loop-authored controls; fix the `<select type="checkbox">` invalid attribute.
- Verifier updates in lockstep with every pinned-declaration change.

**Judgment-call rewrites (do with documented reasoning, else defer):**
- The `room.html` stale-duplicate divergence (theme 3) — reconcile the Loop-relevant deltas; do **not** rewrite upstream room logic.
- The shared duplicate `id="settingstoggle"` — assess `getElementById` impact before touching; this is upstream markup in two files.

### Deferred to Follow-Up Work
- Renaming any upstream DOM id consumed by `lib.js`/`webrtc.js`/`main.js` (high merge cost; needs a dedicated drift pass).
- Deleting upstream home-card markup outright (hide-don't-delete keeps merge cost low; revisit only if upstream removes them).
- Any change to URL params, function names, or translation keys (fork contract).

---

## Key Technical Decisions

1. **Hide, don't delete, upstream markup.** The fork contract and AGENTS.md both say keep upstream ids/markup stable and curate the reveal via `loopVisibleHomeCards`. Removing dead cards from the *surface* (CSS/curation) achieves the audit goal at near-zero merge cost; deleting the DOM does not. Rationale: every deleted upstream line is a future merge conflict.

2. **Verifier-in-lockstep, never verifier-deletion.** When a unit changes a declaration a `verify-*.js` pins (e.g. a radius, an override string, a hidden-card id), the same unit updates the assertion to the new intended contract. The verify suite is the lever a reviewer reruns (build-the-lever); weakening it to pass is prohibited.

3. **Local verification = pure-node verifiers + dev-server browser pass.** Playwright/puppeteer are not installed, so browser-driven verifiers cannot run locally. Pure-node verifiers (`verify-loop-css-contract`, `verify-fork-contract`, `verify-translation-health`, the file-presence checks in `verify-loop-icon-system`, `classify-fork-drift`) plus `npm run verify:icons` plus a manual `python3 scripts/dev-server.py 8765` pass are the verification floor. Browser-only verifiers are listed per unit as "rerun in CI / when Playwright present."

4. **Loop-owned CSS lives only in the labeled override block.** Per FORK.md, `main.css` stays upstream-first; all Loop CSS edits land in the `Loop Cam surface overrides` block (end of `main.css`) and the `loop-*.css` files. No edits to upstream `main.css` rules.

5. **Quick wins first, risky-upstream last.** Sequencing front-loads zero-risk Loop-owned fixes (validity bugs, token drift) so the branch is shippable-valuable even if the later judgment-call units get deferred.

---

## High-Level Technical Design

```
Theme → Unit → Surface touched → Verifier that gates it
─────────────────────────────────────────────────────────────────────
accessibility/validity  U1  index.html, loop-ui.css      verify-fork-contract, verify-codecs-handler
                                                          (+ dev-server)
css hygiene + tokens     U2  main.css override block,     verify-loop-css-contract  ← pins radii/strings
                             loop-tokens.css, loop-ui.css    (update in lockstep)
button + copy norm        U3  override block, loop copy    verify-loop-css-contract,
                                                          verify-loop-branding-surface,
                                                          verify-translation-health
icon-system over-build    U4  loop-icons.js, loop-icons.css verify-loop-icon-system,
                             index.html/room.html <head>     npm run verify:icons
dead home-surface         U5  lib.js loopVisibleHomeCards,  verify-loop-home-surface
                             override block                  (update if it pins ids)
flow over-exposure        U6  override block, lib.js        verify-loop-room-flow,
                             dropDownButtonAction            verify-camera/screen-share-flow
room.html divergence      U7  room.html (judgment call)     verify-loop-room-flow,
                                                          classify-fork-drift, verify-fork-contract
─────────────────────────────────────────────────────────────────────
Every unit ends: run its gating pure-node verifiers + classify-fork-drift; manual dev-server smoke.
```

This is directional. `ce-work` confirms exact line anchors at execution time; the verifier mapping is the load-bearing part.

---

## Implementation Units

### U1. Fix HTML-validity and accessibility defects (quick wins)

**Goal:** Remove concrete, low-risk correctness/a11y defects on Loop-authored or clearly-broken markup.

**Requirements:** Audit theme 7 (accessibility), finding #9 (`<select type="checkbox">`), plus focus-visible / touch-target / label gaps on Loop controls.

**Dependencies:** none.

**Files:**
- `index.html` (`#codecGroupFlag` at line ~469: remove invalid `type="checkbox"` from the `<select>`)
- `loop-ui.css` (focus-visible rings, 44px touch targets on footer/close controls per DESIGN.md)
- `loop-icons.css` (icon-button hit areas if needed)

**Approach:** The `<select type="checkbox">` is invalid HTML — `type` is ignored on `<select>`; removing it is behavior-preserving and cannot change the codec handler (it reads `.value`). Add `:focus-visible` outlines and confirm 44px targets only on Loop-authored chrome (footer pill, `.outer.close`). Do not touch upstream control logic.

**Patterns to follow:** DESIGN.md "44px touch targets," existing `.loop-footer-bar` rules in the override block.

**Test scenarios:**
- Covers finding #9: `verify-codecs-handler.js` still passes after removing `type="checkbox"` (codec selection unaffected).
- `verify-fork-contract.js` passes (no upstream id/param/key changed).
- Dev-server smoke: codec dropdown still selects; footer icons show a visible focus ring on keyboard tab; tap targets ≥44px.

**Verification:** `node scripts/verify-codecs-handler.js && node scripts/verify-fork-contract.js` green; manual dev-server pass.

---

### U2. CSS overlay hygiene and token-drift normalization

**Goal:** Collapse one-off hex values to `--loop-*` tokens, normalize corner radii to the DESIGN.md scale (sm 8 / md 12 / lg 16 / pill 999), and dedupe repeated declarations in the override block.

**Requirements:** Audit theme 6 (CSS overlay hygiene + token drift), findings on radius inconsistency and duplicated declarations.

**Dependencies:** U1 (so a11y rings use the normalized tokens).

**Files:**
- `main.css` (the `Loop Cam surface overrides` block only — end of file)
- `loop-tokens.css` (add/confirm `--loop-*` radius + color tokens)
- `loop-ui.css`
- `scripts/verify-loop-css-contract.js` (**lockstep**: this verifier pins exact declarations like `.column { border-radius: 16px }` and override strings — update each pinned assertion to the new normalized value in this same unit)

**Approach:** First read `verify-loop-css-contract.js` end-to-end and enumerate every declaration it pins. For each radius/colour I normalize, update the matching assertion to the intended value. Replace literal hex that duplicates a token with the `var(--loop-*)`. This is the highest-risk-of-breaking-verifiers unit, so it is done early and in one focused commit.

**Patterns to follow:** existing `--loop-*` tokens in `loop-tokens.css`; FORK.md rule that Loop CSS lives only in the labeled block.

**Test scenarios:**
- `verify-loop-css-contract.js` passes **after** its pinned values are updated to match the normalized declarations (not by loosening assertions).
- `classify-fork-drift.js` reports no new drift outside the override block.
- Dev-server smoke: home cards, panels, modal, footer pill render with consistent radii; no colour regressions in dark canvas.

**Verification:** `node scripts/verify-loop-css-contract.js && node scripts/classify-fork-drift.js` green; visual dev-server diff against current.

---

### U3. Button and copy normalization

**Goal:** Unify the 4 primary-button variants into one Loop primary style; normalize resolution labels and product copy to Loop Cam branding (reserve VDO.Ninja for advanced/source docs).

**Requirements:** Audit theme 5 (button + copy normalization), findings #7 (button variants) and #8 (resolution labels differ across flows).

**Dependencies:** U2 (button styling uses normalized tokens/radii).

**Files:**
- `main.css` override block (`.gowebcam`, `.gobutton` primary rules)
- `loop-ui.css`
- Loop copy / translation source for resolution labels and any un-rebranded user-facing strings (keep translation **keys** stable; change values only)
- `scripts/verify-loop-css-contract.js` and/or `scripts/verify-loop-branding-surface.js` (**lockstep** if they pin button declarations or copy strings)

**Approach:** Define one green primary per DESIGN.md ("One Green Rule") and route the variants to it. Normalize resolution label text to a single vocabulary across camera/screen/room flows. Branding copy edits follow the AGENTS.md preference (Loop Cam in product copy; VDO.Ninja only in advanced/source attribution). Do not rename translation keys — `verify-translation-health.js` enforces key parity.

**Patterns to follow:** DESIGN.md Buttons section; AGENTS.md branding preference; existing `loopCamPermissionDeniedHtml`-style Loop copy.

**Test scenarios:**
- `verify-translation-health.js` passes (all keys present across locales; only values changed).
- `verify-loop-branding-surface.js` passes (no vdo.ninja-branded residue on the default surface).
- `verify-loop-css-contract.js` passes after any pinned button declaration is updated in lockstep.
- Dev-server smoke: Start buttons identical across Camera/Screen/Room; resolution labels read identically across flows.

**Verification:** `node scripts/verify-translation-health.js && node scripts/verify-loop-branding-surface.js && node scripts/verify-loop-css-contract.js` green; dev-server cross-flow comparison.

---

### U4. Icon-system consolidation

**Goal:** Stop double-shipping the Line Awesome font where the Lucide runtime upgrade already covers the glyphs; narrow the MutationObserver from the whole-`body` subtree to the regions that actually receive injected icons.

**Requirements:** Audit theme 1 (icon-system over-build), findings #1 (ships both Line Awesome font + Lucide) and #2 (MutationObserver watches whole body subtree). Performance-relevant.

**Dependencies:** none functionally, but sequenced after U1–U3 so a regression here is isolated from the quick wins.

**Files:**
- `loop-icons.js` (MutationObserver scope at ~line 279; upgrade path at ~line 184)
- `loop-icons.css`
- `index.html` / `room.html` `<head>` (Line Awesome `<link>` — remove only if every rendered `la-*` glyph is confirmed covered by the Lucide map)
- `loop-icon-line-map.js` / `loop-icon-glyphs.js` (coverage check)
- `scripts/verify-loop-icon-system.js` (**lockstep** if it pins the font link or observer shape)

**Approach:** First prove glyph coverage: enumerate every `la-*` class used across the pages and confirm each maps in `loop-icon-line-map.js`. Only then drop the font `<link>`. For the observer, scope to the containers that receive dynamic `<i class="las la-*">` rather than `document.body` — confirm via dev-server that dynamically-revealed flows (expanded home cards, room settings) still upgrade. This is the build-the-lever unit: the coverage check is a script, not eyeballing.

**Patterns to follow:** `docs/LOOP_ICONS.md`; `npm run build:icons` / `npm run verify:icons` flow.

**Test scenarios:**
- `npm run verify:icons` passes (glyph map complete).
- `verify-loop-icon-system.js` file-presence/coverage checks pass.
- Dev-server smoke: every icon across home, camera, screen, room, control bar, footer renders as Lucide — including icons injected after interaction (open a flow, open settings). No missing-glyph boxes.
- Performance sanity: observer no longer fires on unrelated DOM mutations (spot-check via a `console.count` in the callback during the dev-server pass, removed before commit).

**Verification:** `npm run verify:icons && node scripts/verify-loop-icon-system.js` green; dynamic-injection dev-server pass.

---

### U5. Trim dead home-surface weight

**Goal:** Remove permanently-hidden cards and the info blob from the default surface via the curated reveal and override CSS, without deleting upstream card markup.

**Requirements:** Audit theme 2 (dead home-surface weight), finding #3 (dead "More Options" reveal + ~190 lines hidden cards), finding #10 (Screen home-card hand-rolled SVG → use the icon system), AGENTS.md preference to hide non-core cards/info blob.

**Dependencies:** U4 (Screen card icon should come from the consolidated icon system).

**Files:**
- `lib.js` (`loopVisibleHomeCards` at line 42494 — keep curated to `container-5`, `container-7` and whatever the product-core set is; the reveal loop at ~42500)
- `main.css` override block (hide `#info` and non-core cards on the default surface)
- `index.html` (Screen card: replace the hand-rolled inline SVG with a `las la-*` hook so the Lucide runtime upgrades it — Loop-owned card, low merge risk)
- `scripts/verify-loop-home-surface.js` (**lockstep** if it pins the visible-card id set)

**Approach:** Confirm the curated set against the product-core flows (Room, Camera, Screen). Hide the rest via CSS + curation; do not delete the upstream `<div class="card">` markup (hide-don't-delete decision). Swap the Screen card's bespoke SVG for the icon hook so all three cards share one icon path.

**Patterns to follow:** `loopVisibleHomeCards` existing shape; `.loop-home-card-icon` pattern in DESIGN.md.

**Test scenarios:**
- `verify-loop-home-surface.js` passes after its expected visible-id set is updated in lockstep with any curation change.
- `verify-fork-contract.js` passes (upstream card markup still present, just unrevealed).
- Dev-server smoke: default home shows exactly Room/Camera/Screen; `#info` hidden; "More Options" no longer exposes a dead reveal; Screen card icon renders via Lucide.

**Verification:** `node scripts/verify-loop-home-surface.js && node scripts/verify-fork-contract.js` green; default-surface dev-server pass.

---

### U6. Reduce flow over-exposure

**Goal:** Push advanced controls (SSO, codecs, allowlist, approval, director-as-performer) behind disclosure on Create-a-Room and the publish flows, keeping Create a Room the primary action.

**Requirements:** Audit theme 4 (flow over-exposure), finding #6 (Create Room over-exposes advanced options), AGENTS.md preference for advanced disclosure.

**Dependencies:** U2, U3 (disclosure UI uses normalized tokens/buttons).

**Files:**
- `main.css` override block (collapse/disclosure styling for advanced groups)
- `lib.js` (`dropDownButtonAction` at ~42496 if the disclosure toggles route through it — keep the function name stable)
- `index.html` (group advanced controls under a disclosure region; keep ids/params stable)

**Approach:** Wrap advanced controls in a Loop-styled disclosure without changing their ids, params, or handlers — the upgrade is presentational grouping plus a toggle. Default-collapsed on the primary surface. No upstream-handler logic changes.

**Patterns to follow:** existing setting-panel rows in DESIGN.md; the existing reveal mechanism rather than a new one (laziness protocol).

**Test scenarios:**
- `verify-loop-room-flow.js` passes (room creation path intact; ids/params stable).
- `verify-camera-publish-flow.js` / `verify-screen-share-flow.js` pass (publish flows unaffected) — note these may be Playwright-gated; run pure-node portions locally, full run in CI.
- Dev-server smoke: Create a Room shows name/password/primary action by default; advanced controls reachable behind one disclosure; entering a room as director and as participant both still work.

**Verification:** `node scripts/verify-loop-room-flow.js` green; `classify-fork-drift.js` clean; dev-server room-creation pass (director + participant).

---

### U7. Reconcile room.html divergence (judgment call)

**Goal:** Bring `room.html` into parity with the Loop deltas applied to `index.html` for the genuinely-shared surface, or explicitly defer if reconciliation risks upstream room logic.

**Requirements:** Audit theme 3 (room.html/index.html divergence), finding #4 (room.html stale un-rebranded duplicate menu), finding #5 (duplicate `id="settingstoggle"` — confirmed present in **both** files).

**Dependencies:** U1–U6 (the Loop deltas these units apply to `index.html` define what `room.html` should mirror).

**Files:**
- `room.html` (menu/branding/icon-hook parity with `index.html`; ids/params stable)
- decision record appended to this plan's follow-up section if deferred

**Approach (judgment call, documented):** Diff `room.html` against `index.html` for the Loop-overlay surface (branding copy, icon hooks, footer, override-block class usage) and apply the same Loop deltas — these are Loop-owned presentational changes, low merge risk. **Do not** rewrite upstream room logic or rename ids. For the duplicate `id="settingstoggle"`: it is upstream markup duplicated in both files; `document.getElementById('settingstoggle')` resolves to the **first** occurrence (the `la-sync-alt` element), leaving the second (`la-cog` settings gear) without that id binding. Assess whether `lib.js` actually binds by this id before changing anything. If a change is warranted, prefer giving the *settings gear* a Loop-distinct hook rather than mutating the upstream id — but if `lib.js` depends on the duplicate, **defer** to a dedicated drift pass and record the reasoning. Default posture: reconcile branding/icon parity now; defer the id-dedup unless analysis shows it is safe and a real bug on the Loop surface.

**Patterns to follow:** whatever U1–U6 established on `index.html`; FORK.md keep-ids-stable rule.

**Test scenarios:**
- `verify-loop-room-flow.js` passes.
- `verify-fork-contract.js` and `classify-fork-drift.js` pass (no upstream id/param churn unless a deliberate, documented bugfix).
- Dev-server smoke: `room.html` renders with Loop branding/icons matching `index.html`; room functions (join, settings gear opens settings).
- If id-dedup is attempted: confirm the settings gear opens settings AND the sync control still works (both former duplicate-id elements function).

**Verification:** `node scripts/verify-loop-room-flow.js && node scripts/verify-fork-contract.js && node scripts/classify-fork-drift.js` green; room.html dev-server pass. If deferred, the deferral and reasoning are written into `### Deferred to Follow-Up Work`.

---

## System-Wide Impact

- **End users (directors/performers/solo):** a calmer default surface — fewer cards, advanced controls tucked away, consistent buttons/labels/icons, lighter page (one icon system not two). No flow they rely on is removed; advanced controls remain reachable.
- **Next engineer / future upstream merge:** changes concentrate in Loop-owned files (override block, `loop-*`, curated reveal). Hide-don't-delete and id-stability keep the next `upstream` merge cost flat. Verifier-in-lockstep means the contract still documents intended behavior.
- **CI:** Playwright-gated verifiers run in CI even though they can't run locally; pure-node verifiers gate every unit locally.

## Risks & Mitigations

- **Breaking a pinned verifier silently → false green.** Mitigation: every unit names the verifier it must update in lockstep; updates tighten to the new intended value, never loosen.
- **Dropping the Line Awesome font before full Lucide coverage → missing glyphs.** Mitigation: U4 proves coverage with a script before removing the link.
- **Touching the duplicate `settingstoggle` id breaks an upstream binding.** Mitigation: U7 analyzes `lib.js` binding first; defers if unsafe.
- **No local browser verification.** Mitigation: manual dev-server pass per unit + CI for Playwright verifiers; documented in each unit.

## Verification Strategy (cross-cutting)

Pure-node floor, runnable locally, after every unit:
`node scripts/verify-loop-css-contract.js && node scripts/verify-fork-contract.js && node scripts/verify-translation-health.js && node scripts/verify-loop-icon-system.js && node scripts/classify-fork-drift.js && npm run verify:icons`

Plus a `python3 scripts/dev-server.py 8765` manual pass scoped to the unit's surface. Browser-driven verifiers (`verify-camera-publish-flow`, `verify-screen-share-flow`, others needing a DOM runtime) are rerun in CI / when Playwright is present.
