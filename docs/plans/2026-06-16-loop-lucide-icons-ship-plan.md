---
title: Ship Loop Cam Lucide Icon System
date: 2026-06-16
execution: code
status: active
---

# Ship Loop Cam Lucide Icon System

## Summary

Land the Loop Cam Lucide icon migration and UX simplification pass (home cards, control bar mic meter, popup affordances) on a feature branch with verification scripts and a PR.

## Problem Frame

Loop Cam replaced Line Awesome font glyphs with runtime Lucide SVG upgrades while preserving upstream `las la-*` hooks. Initial work fixed page freezes and blank home menu; a six-agent audit found chevron state bugs, translation wiping mic meter markup, cache version drift on auxiliary pages, and CSS duplication. This plan ships the corrected system.

## Requirements

| ID | Requirement |
|----|-------------|
| R1 | Home cards render Lucide icons only (no conflicting CSS background-image) |
| R2 | Control bar mic meter uses stable icon stroke + `--mic-level` on `#mutebutton` |
| R3 | Settings/popup chevrons use `las la-chevron-*`; close uses `la-times` |
| R4 | `loop-icons.js` upgrades icons after translation and dynamic DOM inserts |
| R5 | All wired HTML pages share the same `loop-icons.css/js` cache version |
| R6 | `npm run verify:icons` passes; icon contract scripts pass |
| R7 | No main-thread freeze on index load |

## Key Technical Decisions

- **KTD1: Runtime upgrade, not build-time HTML rewrite** — Keep `las la-*` in HTML for upstream merge compatibility; Lucide injected by `loop-icons.js`.
- **KTD2: Minimal lib.js delta** — Only mic meter `--mic-level` and post-translation `LoopIcons.upgradeAll()` hook; avoid line-ending churn.
- **KTD3: CSS single source for icon visuals** — `loop-icons.css` owns sizing, affordances, director-link colors; strip duplicates from `main.css` override block.
- **KTD4: Accordion chevron state** — Preserve `bottom`/`right` classes in `toggleAccordionChevron` className assignment.

## Implementation Units

### U1. Icon runtime and CSS (complete — verify)

- Files: `loop-icons.js`, `loop-icons.css`, `loop-icon-glyphs.js`, `loop-icon-line-map.js`, `scripts/build-loop-icon-glyphs.js`, `scripts/loop-icon-line-map.json`
- Verify: init completes without hang; observer handles class + childList

### U2. Surface HTML wiring (complete — verify)

- Files: `index.html`, `room.html`, auxiliary pages (`check.html`, `devices.html`, etc.)
- Verify: `?ver=10` parity across all wired pages

### U3. Upstream hooks (complete — verify)

- Files: `lib.js` (mic meter + changeLg upgrade hook), `main.js` (mainmenu opacity)
- Verify: functional diff is 3 hunks only (`git diff --ignore-cr-at-eol lib.js`)

### U4. Home CSS cleanup (complete — verify)

- Files: `main.css` — removed container background-image rules, duplicate toggle font-size for upgraded icons, director-link triplication

### U5. Verification hardening (this pass)

- Files: `scripts/verify-loop-icon-system.js` — assert cache version parity across wired HTML
- Test: `npm run verify:icons`

### U6. Ship

- Create feature branch, commit, push, open PR, watch CI

## Scope Boundaries

- Out of scope: full `refresh.css` deletion/dedup, home card DOM reorder, chunked icon init perf, lib.js toggle `upgradeIcon` calls at every className site
- Out of scope: Playwright installation in CI (document as optional)

## Test Scenarios

1. Hard refresh index — home menu visible within 3s, no tab freeze
2. Settings accordion chevrons toggle down/right on repeated clicks
3. Mic active — white icon stroke, green glow on `.mic-meter` ring
4. Close settings shows `×` not chevron-right
5. `npm run verify:icons` exits 0

## Verification

```bash
npm run verify:icons
node scripts/verify-loop-css-contract.js
node scripts/smoke-loop-icons-init.js
node --check loop-icons.js main.js
```
