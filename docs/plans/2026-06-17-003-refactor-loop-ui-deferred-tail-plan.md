---
title: "refactor: Loop Cam UI simplification — deferred tail"
type: refactor
date: 2026-06-17
status: planned
branch: feat/loop-ui-simplification-pass
origin: PR #3 residual review findings (loop-online/loop.cam#3)
---

# refactor: Loop Cam UI simplification — deferred tail

## Summary

Finishes the explicitly-deferred tail of the Loop Cam UI simplification audit (PR #3, still open on `feat/loop-ui-simplification-pass`). Three concrete items remain from that PR's residual section: the three deferred duplicate upstream DOM ids, room.html parity for the U6 "advanced room options" disclosure, and two advisory residuals (icon-verifier page-list self-registration, and a visual cue when URL params pre-populate a collapsed advanced field). Each duplicate id gets an explicit do-or-defer judgment call grounded in how the code actually resolves it.

This continues on the same branch and the same open PR (#3) — these are continuations of one audit, not a new feature.

---

## Problem Frame

The prior pass (PR #3) shipped the bulk of the audit but deliberately deferred a handful of items that needed intent analysis or carried merge cost. They were documented in the PR's `## Residual Review Findings` and FORK.md rather than fixed blind. This plan resolves them with the analysis now done:

- **Duplicate DOM ids** are invalid HTML and a latent correctness trap: `getElementById` returns only the first match, so a second element sharing an id is either dead weight or a silent mis-target. Upstream ships three such ids (`hiddenElements`, `main-js`, `fileselector2`); each needs its own call because the risk profile differs per id.
- **Disclosure asymmetry**: `index.html`'s Create-a-Room form collapses advanced options behind a disclosure (U6), but `room.html`'s equivalent form does not, so the two surfaces diverge — exactly the kind of index/room drift the audit set out to remove.
- **Advisory residuals**: a manually-maintained page list in `scripts/verify-loop-icon-system.js` that can silently fall out of sync, and a UX gap where a URL param pre-fills an advanced field the user cannot see because the disclosure defaults collapsed.

---

## Requirements

- **R1** — Eliminate each safe duplicate DOM id without changing runtime behavior; defer any duplicate whose dedupe is load-bearing or cosmetic, with the reason recorded in FORK.md.
- **R2** — Bring room.html's Create-a-Room advanced options behind the same default-collapsed disclosure as index.html, with matching ARIA semantics.
- **R3** — A URL param that pre-populates an advanced room option must not be hidden by the collapsed disclosure — the disclosure auto-expands when any advanced field carries a non-default value on load.
- **R4** — `scripts/verify-loop-icon-system.js` derives its wired-page list from a single source of truth rather than a hand-maintained array, so a new page cannot silently escape coverage.
- **R5** — Every behavioral change ends in a green pure-node verifier run; pinned declarations update in lockstep with their verifier; no verifier is deleted or loosened.

---

## Hard Constraints (carried from the prior pass)

- Work continues on `feat/loop-ui-simplification-pass`. Never commit to `main` — Vercel deploys production from `main` with no staging.
- `main.css` stays upstream-first; Loop styling lives only in the labeled `Loop Cam surface overrides` block.
- The `scripts/verify-*.js` suite is the test contract. A change to a pinned declaration updates its verifier in the same unit. Never delete or weaken a verifier to make it pass.
- Playwright is not installed locally. Verification relies on the pure-node verifier subset plus an `agent-browser` dev-server pass (`python3 scripts/dev-server.py <port>`).
- Upstream DOM-id renames carry high merge cost. Prefer behavior-preserving deletes of dead duplicates over renames; defer renames that touch live, functionally-distinct elements.
- `lib.js` has mixed CRLF/LF line endings — edit it with `perl -i -pe`, not the line-normalizing editor, and confirm `git diff --numstat` raw equals `--ignore-space-at-eol` after any edit.

---

## Key Technical Decisions

### KTD1 — `hiddenElements`: dedupe (remove the dead second occurrence)

`lib.js:7658-7659` is the only consumer: `getElementById("hiddenElements").append(session.rpcs[i].iframeEle)`. `getElementById` resolves the **first** `#hiddenElements` (the nested one inside the page container, `index.html:1746` / `room.html:1494`). The second, body-level occurrence (`index.html:1757` / `room.html:1505`) is never referenced — it is dead. Removing the second occurrence on both pages preserves behavior exactly (the resolved element is unchanged) and makes the id unique. **Do it.**

### KTD2 — `main-js`: defer (not a live duplicate)

The room.html "second" `id="main-js"` (`room.html:2767`) sits **inside an HTML comment** (`room.html:2765-2768`), shipped by upstream as a branding-swap example (`main.js` with `data-translation="blank"`). It has zero runtime effect; only the real tag at `room.html:2769` loads. `grep` flags it because it does not parse comments. Removing the comment would diverge from upstream's documentation convention for no runtime gain. **Defer; record in FORK.md that this is a commented example, not a live duplicate.**

### KTD3 — `fileselector2`: defer (load-bearing, distinct elements)

`room.html` has two functionally-distinct file inputs sharing this id: `room.html:190` (`onchange="session.changePublishFile(...)"`, hidden, accepts video/audio — publish-a-media-file) and `room.html:911` (`onchange="session.hostFile(...)"` — transfer-any-file-to-guests). No `getElementById("fileselector2")` reference exists in `lib.js`/`main.js`/`webrtc.js`, and no `<label for="fileselector2">` exists in room.html, so the trigger is dynamic or context-menu-driven and not statically discoverable. Renaming either input risks breaking an undiscovered caller and carries upstream merge cost against two live elements. **Defer; record the analysis in FORK.md.** (index.html is unaffected — single `#fileselector2` with a correct `<label for>`.)

### KTD4 — room.html disclosure mirrors the index.html pattern

Reuse the exact pattern from `index.html` (commit f23fc625): a `<button class="loop-disclosure-toggle" aria-expanded="false" aria-controls="roomAdvanced">` row after the password row, close the implicit tbody, then wrap the advanced rows in `<tbody id="roomAdvanced" hidden>`. room.html's form differs structurally (the `createRoom()` button sits **outside** the `<table>`, and there are fewer advanced rows), so the disclosure wraps from after the password row to the existing `</table>` (`room.html` ~line 403 to ~440). Reusing `id="roomAdvanced"` is safe — it is a separate document from index.html. `createRoom()` reads inputs by id regardless of visibility, so collapsing changes nothing functionally.

### KTD5 — auto-expand uses the same inline-handler idiom

The disclosure toggle is an inline `onclick` (no named function, to keep the merge surface off upstream-owned JS). The auto-expand cue follows the same idiom: a small inline script at the end of the form checks whether any control inside `#roomAdvanced` holds a non-default value and, if so, expands the disclosure and flips `aria-expanded`. No named function added to `lib.js`/`main.js`.

---

## Implementation Units

### U1. Dedupe the dead `hiddenElements` duplicate

**Goal:** Remove the unreferenced second `#hiddenElements` on both pages so the id is unique, with no behavior change (R1).

**Requirements:** R1, R5

**Dependencies:** none

**Files:**
- `index.html` (remove the body-level `<div id="hiddenElements"></div>` at ~line 1757; keep the nested one at ~1746)
- `room.html` (remove the body-level `<div id="hiddenElements"></div>` at ~line 1505; keep the nested one at ~1494)
- `scripts/verify-loop-ui-simplification.js` (extend: assert exactly one `#hiddenElements` per page)

**Approach:** Both pages carry two empty `<div id="hiddenElements"></div>`. Keep the first (the one `getElementById` already resolves and `lib.js` appends RPC iframes into); delete the second. Pure LF files — the standard editor is safe. Then add a pinning assertion to the existing simplification verifier so a future upstream merge that re-adds the duplicate fails.

**Patterns to follow:** the per-page count assertions already in `scripts/verify-loop-ui-simplification.js` (the `settingstoggle` count check).

**Test scenarios:**
- `verify-loop-ui-simplification.js` asserts `index.html` contains exactly one `id="hiddenElements"`.
- Same assertion for `room.html`.
- Covers R1: with the duplicate removed, the count is 1; re-introducing it makes the count 2 and the verifier fails.

**Verification:** `node scripts/verify-loop-ui-simplification.js` exits 0; the new count assertions are present; full pure-node suite stays green.

### U2. Record the deferred-id judgment calls in FORK.md

**Goal:** Document why `main-js` and `fileselector2` are intentionally left as duplicates, so a future maintainer (or upstream-merge resolver) does not "fix" them blind (R1).

**Requirements:** R1

**Dependencies:** none

**Files:**
- `FORK.md` (extend the existing `Deliberate id divergences` subsection under Upstream Compatibility Rules)

**Approach:** Add two short entries. `main-js`: the room.html second occurrence is inside an HTML comment (upstream branding example), zero runtime impact, left verbatim to track upstream. `fileselector2`: two functionally-distinct room.html inputs, no discoverable trigger, renaming risks an unknown caller — deferred pending an intent trace of who invokes them. Reference the `hiddenElements` dedupe (U1) as the contrasting "safe" case.

**Test scenarios:** Test expectation: none — documentation-only, no behavioral change.

**Verification:** FORK.md renders; entries are concise and name both ids with their reason.

### U3. room.html "Advanced room options" disclosure parity

**Goal:** Collapse room.html's Create-a-Room advanced options behind the same default-collapsed disclosure as index.html (R2).

**Requirements:** R2, R5

**Dependencies:** none

**Files:**
- `room.html` (insert the disclosure toggle row after the password row ~line 403; wrap the advanced rows through `</table>` ~line 440 in `<tbody id="roomAdvanced" hidden>`)
- `loop-ui.css` (no change expected — `.loop-disclosure-toggle` already defined; confirm it applies)
- `scripts/verify-loop-ui-simplification.js` (generalize the U6 assertions to cover room.html as well as index.html)

**Approach:** Mirror commit f23fc625. After the password row, insert `<tr><th colspan="3" ...><button type="button" class="loop-disclosure-toggle" aria-expanded="false" aria-controls="roomAdvanced" onclick="...toggleAttribute('hidden')...">Advanced room options</button></th></tr>`, close the implicit tbody, open `<tbody id="roomAdvanced" hidden>`, and close it before `</table>`. Use the `hidden` attribute (not inline `display`) so table layout is preserved. room.html is pure LF — the standard editor is safe.

**Patterns to follow:** `index.html` lines ~444-448 (the shipped U6 disclosure markup); `loop-ui.css` `.loop-disclosure-toggle` rule.

**Test scenarios:**
- `verify-loop-ui-simplification.js` asserts `room.html` has `<tbody id="roomAdvanced" ... hidden>`.
- Asserts exactly one `.loop-disclosure-toggle` on room.html with `aria-controls="roomAdvanced"` and `aria-expanded="false"`.
- Browser pass (agent-browser): on `room.html`, the advanced rows are hidden by default; clicking the toggle flips `aria-expanded` to `true` and reveals them; `createRoom()` still reads `codecGroupFlag` etc. regardless of collapsed state.
- Covers R2.

**Verification:** verifier exits 0 with room.html assertions present; agent-browser confirms collapse/expand on room.html; pure-node suite green.

### U4. Auto-expand the disclosure when advanced fields are pre-populated

**Goal:** When a URL param (or any pre-fill) sets a non-default advanced room option, expand the disclosure on load so the value is visible (R3).

**Requirements:** R3, R5

**Dependencies:** U3 (room.html disclosure must exist); index.html disclosure already exists

**Files:**
- `index.html` (inline script after the Create-a-Room form)
- `room.html` (same inline script after its form)
- `scripts/verify-loop-ui-simplification.js` (assert the auto-expand guard markup is present on both pages)

**Approach:** A small inline script that, on `DOMContentLoaded`, inspects controls inside `#roomAdvanced`: if any `<select>` is not on its default option, or any `<input type="checkbox">` is checked, or any text/number input is non-empty, remove `hidden` from `#roomAdvanced` and set the toggle's `aria-expanded="true"`. Inline per KTD5 to keep the change off upstream-owned JS. Guard against missing elements (run only if `#roomAdvanced` exists).

**Patterns to follow:** the inline `onclick` idiom on the disclosure toggle (KTD5); existing inline `DOMContentLoaded`-style scripts in the page if present.

**Test scenarios:**
- Browser pass: load `index.html` with a URL param that sets a non-default codec (e.g., the param VDO.Ninja maps to `codecGroupFlag`); the disclosure is expanded on load and `aria-expanded="true"`.
- Browser pass: load `index.html` with no advanced params; the disclosure stays collapsed (`aria-expanded="false"`).
- Repeat both on `room.html`.
- Edge: `#roomAdvanced` absent (defensive) — script no-ops without throwing.
- Covers R3.

**Verification:** agent-browser confirms expand-when-prefilled and collapsed-when-clean on both pages; verifier asserts the guard markup; suite green.

### U5. Self-registering wired-page list in the icon verifier

**Goal:** Replace the hand-maintained `wiredHtmlPages` array with a derived list so a new page cannot silently escape icon coverage (R4).

**Requirements:** R4, R5

**Dependencies:** none

**Files:**
- `scripts/verify-loop-icon-system.js` (derive the wired-page set instead of hardcoding)

**Approach:** The `wiredHtmlPages` array (line ~169) is the set of pages expected to wire the Loop icon assets with uniform cache versions. Derive it: glob root-level `*.html`, then include a page if its source references `loop-icons.js` (the upgrader). This makes the list self-maintaining — any page that loads the upgrader is automatically held to the uniform-cache-version check. Preserve the existing assertion semantics (uniform `?ver=` across the set). If deriving changes the effective set, reconcile so the verifier still passes on the current tree; do not loosen the cache-version assertion.

**Patterns to follow:** the existing `fs.readdirSync(root).filter(f => f.endsWith(".html"))` glob in `scripts/verify-loop-icon-coverage.js`; the `assertUniformCacheVersions` helper already in this file.

**Test scenarios:**
- `node scripts/verify-loop-icon-system.js` exits 0 on the current tree with the derived list.
- The derived set covers at least the pages the manual list named (no regression in coverage).
- Edge: a root HTML page that does not load `loop-icons.js` is excluded (not forced into the cache-version check).
- Covers R4.

**Verification:** verifier exits 0; the hardcoded array is gone (or reduced to a derivation); coverage is equal-or-broader than before.

---

## Scope Boundaries

### In scope
- The three deferred duplicate-id calls (one dedupe, two documented defers).
- room.html U6 disclosure parity + auto-expand cue on both pages.
- Icon-verifier page-list self-registration.

### Deferred to Follow-Up Work
- Actually renaming `fileselector2` — requires a runtime trace of what triggers each room.html input (context menu / dynamic dispatch). Out of this pass per KTD3.
- `loop-ui.css` decomposition (the ~1300-line file) — a separate refactor, noted advisory in PR #3.

### Outside this product's identity
- Removing upstream's commented `main-js` branding example (KTD2) — kept verbatim to track upstream.
- Any change to `main.css` upstream section, or revealing additional hidden home cards (`loopVisibleHomeCards` stays `[]`).

---

## Assumptions

- The same open PR #3 is the delivery target; these commits extend that PR rather than opening a second one.
- VDO.Ninja maps at least one URL param onto an advanced Create-a-Room control (codec is the most likely); U4's value is realized through whatever advanced params exist. If none map on the Loop surface, U4 still correctly no-ops (collapsed when clean) and the verifier-pinned markup documents intent.
- agent-browser remains available for the browser pass (it was, in the prior run), independent of the missing Playwright.

---

## Risks & Mitigation

- **Reusing `id="roomAdvanced"` across index.html and room.html** — safe because they are separate documents; no cross-page selector collisions. Mitigation: verifier asserts presence per page independently.
- **Auto-expand misfires on default state** — would defeat the disclosure. Mitigation: the "non-default" test is conservative (default-option selects, unchecked boxes, empty inputs all count as clean); browser scenario explicitly checks collapsed-when-clean.
- **hiddenElements dedupe removes the wrong one** — would break RPC iframe hosting. Mitigation: keep the first occurrence (the one `getElementById` resolves); deleting only the never-referenced second is behavior-identical.

---

## Verification Strategy

Each unit ends in `node scripts/verify-loop-ui-simplification.js` (and `verify-loop-icon-system.js` for U5), plus the full pure-node suite green: `verify-fork-contract`, `verify-loop-css-contract`, `verify-translation-health`, `verify-loop-icon-system`, `verify-loop-icon-coverage`, `verify-loop-ui-simplification`, `classify-fork-drift`. U3 and U4 add an `agent-browser` dev-server pass (collapse/expand + prefill-expand on both pages). Playwright-gated verifiers are not run locally (documented limitation).
