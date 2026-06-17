---
title: Loop Lucide Icons Merge Readiness
date: 2026-06-17
execution: code
status: active
origin: docs/plans/2026-06-16-loop-lucide-icons-ship-plan.md
---

# Loop Lucide Icons Merge Readiness

## Summary

Close Thermos review blockers on `feat/loop-lucide-icons`: commit untracked UI assets, keep `lib.js` to substantive hunks only, extend verification, dedupe CSS ownership, and open a PR.

## Problem Frame

The Lucide icon layer verifies clean, but the branch is not deployable: `loop-tokens.css`, `loop-ui.css`, and `scripts/dev-server.py` are untracked while HTML references them; working tree has large uncommitted deltas; `lib.js` shows whole-file line-ending noise.

## Requirements

| ID | Requirement |
|----|-------------|
| R1 | `loop-tokens.css`, `loop-ui.css`, `scripts/dev-server.py` are tracked and linked from promoted pages |
| R2 | `lib.js` diff vs `main` is substantive only (~10 lines), no CRLF churn |
| R3 | `npm run verify:icons` passes; UI CSS contract verified on index + room |
| R4 | `.loop-header-action` styled in one CSS file only (`loop-ui.css`) |
| R5 | `devices.html` / `supports.html` have no whitespace-only churn |
| R6 | Branch pushed with PR describing icon + UI layer |

## Key Technical Decisions

- **KTD1: Ship UI layer with icons** — Commit tokens + UI CSS rather than stripping links; matches current working product.
- **KTD2: lib.js surgical patch** — Restore from `main`, re-apply three hunks (changeLg upgrade, mic meter `--mic-level`, permission HTML hook).
- **KTD3: CSS ownership** — `loop-icons.css` = glyphs/toolbar; `loop-ui.css` = chrome/layout including `.loop-header-action`.
- **KTD4: Defer loop-ui split** — Keep single `loop-ui.css` for this PR; split is follow-up (see Deferred).

## Implementation Units

### U1. Normalize lib.js delta

- **Goal:** Remove line-ending-only diff; keep functional hunks.
- **Requirements:** R2
- **Files:** `lib.js`
- **Approach:** `git checkout main -- lib.js`, then re-apply mic meter, changeLg, permission hooks.
- **Test scenarios:** `git diff main --ignore-all-space -- lib.js` shows ≤15 lines changed.
- **Verification:** `node --check lib.js`

### U2. Track UI assets and dev server

- **Goal:** Eliminate 404 deploy gap.
- **Requirements:** R1
- **Dependencies:** U1
- **Files:** `loop-tokens.css`, `loop-ui.css`, `scripts/dev-server.py`
- **Verification:** Files exist and are git-tracked.

### U3. CSS dedupe and whitespace cleanup

- **Goal:** Single owner for header actions; drop merge noise.
- **Requirements:** R4, R5
- **Dependencies:** U2
- **Files:** `loop-icons.css`, `devices.html`, `supports.html`
- **Approach:** Remove `.loop-header-action` block from `loop-icons.css`; revert whitespace-only HTML diffs if no semantic changes.
- **Verification:** `rg loop-header-action loop-icons.css` returns no rules.

### U4. Verification contract extension

- **Goal:** CI catches missing UI CSS links.
- **Requirements:** R3
- **Dependencies:** U2
- **Files:** `scripts/verify-loop-icon-system.js`, `package.json`
- **Test scenarios:** Script fails if `loop-ui.css` link removed from `index.html`; passes when present with matching `?ver=`.
- **Verification:** `npm run verify:icons`

### U5. Commit, push, PR

- **Goal:** Durable branch state for review.
- **Requirements:** R6
- **Dependencies:** U1–U4
- **Verification:** `gh pr view` shows open PR; checks pass or residuals documented.

## Scope Boundaries

### Deferred to Follow-Up Work

- Split `loop-ui.css` below 1k lines
- Replace body-wide `MutationObserver` with explicit `upgradeIcon` hooks
- Restore Firefox-mobile-specific permission copy
- Fix `?dropdown` vs `#dropButton { display: none !important }`

### Out of scope

- Full `refresh.css` dedup
- Playwright mandatory in CI

## Assumptions

- Thermos findings from 2026-06-17 are authoritative for blockers.
- `index.html` and `room.html` are the promoted pages requiring tokens + UI CSS.

## Verification

```bash
npm run verify:icons
node scripts/verify-loop-css-contract.js
git diff main --ignore-all-space --stat -- lib.js
```
