---
title: "feat: Loop Cam design-system contract"
type: feat
date: 2026-06-18
status: planned
origin: none (solo ce-plan invocation; grounded in untracked DESIGN.md / .impeccable/design.json)
depth: standard
---

# feat: Loop Cam design-system contract

## Summary

The Loop Cam design system was just authored — `DESIGN.md` (human spec), `.impeccable/design.json` (machine-readable tokens), and the `PRODUCT.md` / `AGENTS.md` / `docs/` pointer surface — but it sits **untracked** in the working tree, and **nothing enforces that the implemented token layer matches it**. This plan lands those canonical artifacts under version control, fixes a latent token-fallback drift bug in `loop-tokens.css`, and adds a pure-node verifier that pins `loop-tokens.css` against `.impeccable/design.json` so the spec and the implementation cannot silently diverge — the same verifier-contract pattern the rest of this fork uses to survive upstream refreshes.

This is a Loop-owned, low-merge-risk change. It touches no upstream runtime (`lib.js`, `main.js`, `webrtc.js`), renames no DOM ids, and changes no URL params or translation keys.

---

## Problem Frame

Loop Cam is a thin Loop-branded overlay on VDO.Ninja. Its durable contract is the `scripts/verify-*.js` suite: each verifier pins an intentional, merge-fragile Loop delta so an upstream re-merge that silently reverts it fails CI. The design system is now a first-class part of that Loop surface, yet it has two gaps:

1. **It is not under version control.** `DESIGN.md`, `PRODUCT.md`, `AGENTS.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, and `.impeccable/design.json` are untracked. They can be lost, and teammates/Vercel never see them. Meanwhile `.cursor/` (machine-local IDE debug logs and hook state) and `scripts/__pycache__/` (Python bytecode) are also untracked and would be swept in by a careless `git add -A`.

2. **The spec and implementation can drift unchecked.** `.impeccable/design.json` declares canonical token values (accent `#64c04d`, surface `#404249`, surface-raised `#313338`, radii, shadows, motion). `loop-tokens.css` implements them. Today the *effective* colors match because `main.css` defines `--discord-grey-7: #404249` and `--discord-grey-5: #313338`, but `loop-tokens.css`'s **fallback hexes are stale** — `var(--discord-grey-7, #2f3136)` and `var(--discord-grey-5, #383a40)`. If an upstream refresh ever drops or renames those `--discord-grey-*` variables, the surfaces silently render the wrong color, and no test catches it.

---

## Requirements

- **R1** — The canonical design-system artifacts are committed to the repo; machine-local noise (`.cursor/`, `scripts/__pycache__/`) is gitignored, not committed.
- **R2** — `loop-tokens.css` fallback hexes match the canonical values in `.impeccable/design.json` (no stale fallbacks that would render off-spec if upstream vars disappear).
- **R3** — A pure-node verifier pins `loop-tokens.css` (and the design-doc surface) against `.impeccable/design.json`, fails when they diverge, and is wired into the verify suite. It runs without Playwright.
- **R4** — `FORK.md` records the design-system docs as Loop-owned canonical artifacts so their provenance is unambiguous during upstream drift triage.

---

## Key Technical Decisions

- **KTD1 — `.impeccable/design.json` is the machine-readable source of truth; `DESIGN.md` is the human spec.** The new verifier reads `design.json`, not `DESIGN.md` prose, so it is robust to wording changes. `DESIGN.md` and `design.json` are kept consistent by humans; the verifier only asserts the JSON-to-CSS mapping.

- **KTD2 — Fix the fallback hexes in `loop-tokens.css`; do not touch the upstream `--discord-grey-*` definitions.** Keep the `var(--discord-grey-N, …)` reference so upstream-driven resolution is byte-for-byte unchanged on the live surface. Only correct the fallback literal from `#2f3136` → `#404249` (surface) and `#383a40` → `#313338` (surface-raised) so the fallback equals the documented canonical. This is behavior-preserving today and removes the latent drift. Rationale: `main.css:8-10` (Loop override block) defines `--discord-grey-5: #313338` / `--discord-grey-7: #404249`, which is what actually renders; the fallback only fires if those vanish, and when it fires it must match spec.

- **KTD3 — Commit canonical artifacts; gitignore machine-local state.** Track `DESIGN.md`, `PRODUCT.md`, `AGENTS.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `.impeccable/design.json`. Add `.cursor/` and `scripts/__pycache__/` to `.gitignore` (machine-local, regenerated, never canonical). `README.md`'s pre-existing working-tree modification is out of scope and left untouched.

- **KTD4 — The verifier asserts only statically-checkable, cleanly-mapped tokens.** It checks Loop-owned token *declarations* and their documented fallbacks (accent, the two surface fallbacks, radii, panel widths), plus presence of the documented shadow and motion values, and the existence + cross-linkage of the doc surface. It does **not** attempt to compute `var()` resolution from CSS text (not statically knowable) — that would be brittle. Scope the assertions to what can be verified deterministically from file contents.

---

## Implementation Units

### U1. Correct stale token fallbacks in `loop-tokens.css`

**Goal:** Make the surface fallback hexes match the canonical design tokens, eliminating the latent drift bug (R2).

**Requirements:** R2.

**Dependencies:** none.

**Files:**
- `loop-tokens.css` (modify)

**Approach:** In `:root`, change `--loop-ui-surface: var(--discord-grey-7, #2f3136)` to use fallback `#404249`, and `--loop-ui-surface-raised: var(--discord-grey-5, #383a40)` to use fallback `#313338`. Leave the `var(--discord-grey-N, …)` reference structure intact — only the fallback literal changes. Confirm no other Loop token's fallback diverges from `design.json` while here (accent `#64c04d`, border `#4a4d55`, muted `#a8b0bd`, radii already match).

**Patterns to follow:** existing `loop-tokens.css` declarations; the canonical values in `.impeccable/design.json` (`extensions.colorMeta`) and `DESIGN.md` color table.

**Test scenarios:** `Test expectation: none -- pure token value correction with no behavioral change on the live surface (upstream vars still resolve first). Coverage is provided by U2's verifier, which will assert these fallbacks equal the canonical values.`

**Verification:** `loop-tokens.css` surface fallbacks read `#404249` / `#313338`; `node scripts/verify-loop-css-contract.js` and `node scripts/verify-loop-icon-system.js` stay green.

---

### U2. Add `scripts/verify-loop-design-tokens.js` and wire it into the suite

**Goal:** Pin the implemented token layer and the doc surface against `.impeccable/design.json` so spec/implementation drift fails fast (R3).

**Requirements:** R3.

**Dependencies:** U1 (so the verifier passes on first run against corrected fallbacks).

**Files:**
- `scripts/verify-loop-design-tokens.js` (create)
- `package.json` (modify — add to the verify script aggregation if one exists)

**Approach:** Pure-node, no Playwright, mirroring `scripts/verify-loop-ui-simplification.js` structure (read files, accumulate `failures[]`, `process.exit(1)` on any). Parse `.impeccable/design.json` and assert against `loop-tokens.css` text:
- Accent: `design.json` accent ramp contains `#64c04d` and `loop-tokens.css` declares `--loop-accent: #64c04d`.
- Surface fallbacks: `--loop-ui-surface` fallback `#404249` and `--loop-ui-surface-raised` fallback `#313338` (these equal the `surface` tonal-ramp entries documented as Surface / Surface-Raised in `DESIGN.md`).
- Radii: the four `--loop-ui-radius-*` values (`8/12/16/999px`) match `DESIGN.md` `rounded` (`sm/md/lg/pill`). Source the expected set from `DESIGN.md` frontmatter or hardcode with a comment citing it — pick whichever is least brittle (frontmatter parse preferred if cheap).
- Shadows + motion presence: assert the two `design.json` shadow values and the `cubic-bezier(0.22, 1, 0.36, 1)` motion curve appear in the Loop CSS (`loop-ui.css` / `loop-tokens.css`).
- Doc-surface integrity: `DESIGN.md`, `PRODUCT.md`, `.impeccable/design.json` exist; `docs/DESIGN.md` links back to `../DESIGN.md`; `.impeccable/design.json` parses as JSON with a non-empty `components` array.

Emit a single success line on pass (e.g. `Loop design-system contract verified (tokens, fallbacks, shadows, doc surface).`). Add a header comment, matching the suite convention, explaining these are intentional Loop deltas an upstream re-merge must not silently revert.

**Patterns to follow:** `scripts/verify-loop-ui-simplification.js` (failures-array + `check()` helper, both-quote-style regexes, pure-node), `scripts/verify-loop-icon-system.js` (reading `loop-tokens.css`, `assert` helper). Check `package.json` for an existing `verify`/`verify:*` aggregate script and add this verifier alongside its peers; if none exists, leave a single `scripts.verify:design` entry.

**Test scenarios:**
- Happy path: on the post-U1 tree, `node scripts/verify-loop-design-tokens.js` exits 0 and prints the success line.
- Drift — accent: temporarily changing `--loop-accent` to a non-canonical hex makes it exit 1 with a message naming the accent token. (Manual confirmation during dev; revert after.)
- Drift — fallback: reverting U1's `--loop-ui-surface` fallback to `#2f3136` makes it exit 1 naming the surface fallback. (Confirms U1 and U2 are coupled as intended.)
- Drift — radius: removing or changing a `--loop-ui-radius-*` value makes it exit 1 naming the radius.
- Missing artifact: renaming `.impeccable/design.json` out of place makes it exit 1 with a clear "missing design source" message rather than an unhandled JSON-parse throw.

**Verification:** verifier exits 0 on the corrected tree, exits 1 (with a specific message) for each injected drift above, and is reachable via the documented npm verify path.

---

### U3. Repo hygiene: gitignore machine-local state, commit canonical artifacts

**Goal:** Bring the canonical design/product docs under version control while keeping machine-local noise out (R1).

**Requirements:** R1.

**Dependencies:** none (independent of U1/U2; sequence last so the committed tree includes the new verifier and corrected tokens).

**Files:**
- `.gitignore` (modify — add `.cursor/` and `scripts/__pycache__/`)
- `DESIGN.md`, `PRODUCT.md`, `AGENTS.md`, `docs/DESIGN.md`, `docs/PRODUCT.md`, `.impeccable/design.json` (track / commit)

**Approach:** Append `.cursor/` and `scripts/__pycache__/` to `.gitignore` (group under a brief "machine-local / generated" comment). Stage the six canonical artifacts explicitly by path — never `git add -A` — so untracked machine-local files cannot leak in. Leave the pre-existing `README.md` working-tree modification untouched (out of scope).

**Patterns to follow:** existing `.gitignore` (`.DS_Store` entry); `AGENTS.md` "Learned Workspace Facts" for what is Loop-canonical vs machine-local.

**Test scenarios:** `Test expectation: none -- version-control hygiene, no runtime behavior. Verification is via git state and the U2 doc-surface assertions.`

**Verification:** `git status` shows the six artifacts staged/tracked; `git check-ignore .cursor scripts/__pycache__` resolves both; no `.cursor/` or `__pycache__` path is staged.

---

### U4. Record design-system docs as Loop-owned in `FORK.md`

**Goal:** Make the design-system artifacts' Loop provenance explicit for upstream-drift triage (R4).

**Requirements:** R4.

**Dependencies:** U3 (docs must be tracked first).

**Files:**
- `FORK.md` (modify)
- `scripts/verify-fork-contract.js` (modify only if it enumerates Loop-owned files — confirm during execution)

**Approach:** Add a short entry to `FORK.md` listing `DESIGN.md`, `.impeccable/design.json`, `PRODUCT.md`, `AGENTS.md`, and the `docs/` pointers as Loop-owned canonical artifacts (not upstream), with a one-line note that `scripts/verify-loop-design-tokens.js` pins token/spec consistency. Inspect `scripts/verify-fork-contract.js`: if it asserts a registry of Loop-owned files, add these; if it does not enumerate files, leave it unchanged and rely on the new verifier. Do not invent a registry that doesn't exist.

**Patterns to follow:** existing `FORK.md` "Deliberate id divergences" / Loop-owned sections; the prior tail plan's FORK.md entries (`docs/plans/2026-06-17-003-…`).

**Test scenarios:** `Test expectation: none -- documentation. If verify-fork-contract.js is extended, U2/its own run is the check.`

**Verification:** `node scripts/verify-fork-contract.js` green; `FORK.md` names the design-system artifacts as Loop-owned.

---

## Scope Boundaries

**In scope:** committing the design-system doc surface, gitignoring machine-local state, the `loop-tokens.css` fallback fix, the new design-token verifier, and the `FORK.md` provenance note.

**Out of scope (non-goals):**
- Restyling any UI to "better match" the design system — the implementation already conforms; this plan enforces it, it does not redesign.
- Touching upstream `--discord-grey-*` definitions or any upstream runtime file.
- The pre-existing uncommitted `README.md` modification.
- Generating CSS *from* `design.json` (build-time token generation) — the tokens are hand-maintained; the verifier guards consistency without inverting ownership.

### Deferred to Follow-Up Work
- Build-time generation of `loop-tokens.css` from `.impeccable/design.json` (a `build:tokens` step) if hand-maintenance later proves error-prone. The verifier added here is the prerequisite signal for whether that's worth doing.
- Extending the verifier to the component CSS snippets in `design.json` (`.ds-*` reference components) if those become a maintained part of the live surface.

---

## System-Wide Impact

- **Developers / teammates:** gain a version-controlled, enforced design system; a drifting token now fails CI-equivalent local verification instead of shipping silently.
- **Vercel / production:** no runtime change. The token fallback fix is inert on the live surface (upstream vars resolve first); the only production-visible effect would appear if a future upstream refresh dropped the `--discord-grey-*` vars, in which case surfaces now stay on-spec.
- **Upstream merges:** one more verifier to run in the pre-refresh suite (`AGENTS.md` already documents running the full `scripts/verify-*.js` set); the `FORK.md` note clarifies provenance during drift triage.

---

## Risks & Dependencies

- **Risk: the verifier is brittle against legitimate token edits.** Mitigation: assert only the cleanly-mapped, deterministic subset (KTD4); source expected values from `design.json` / `DESIGN.md` rather than duplicating magic numbers where cheap.
- **Risk: `git add -A` sweeps in `.cursor/` before `.gitignore` lands.** Mitigation: U3 updates `.gitignore` and stages canonical artifacts by explicit path only.
- **Dependency:** U2 depends on U1 (verifier must pass on the corrected tree); U4 depends on U3 (docs tracked first). U1 and U3 are independent.

---

## Verification Strategy

Run the pure-node subset after each unit and as a final gate:

```
node scripts/verify-loop-design-tokens.js   # new — must exit 0
node scripts/verify-loop-css-contract.js
node scripts/verify-loop-icon-system.js
node scripts/verify-fork-contract.js
node scripts/verify-translation-health.js
node scripts/classify-fork-drift.js
```

Playwright/browser verifiers are not runnable locally (not installed); this change is fully covered by pure-node verifiers plus git-state checks. No browser pass is required since there is no live-surface visual change.
