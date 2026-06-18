#!/usr/bin/env node
// Pins the Loop Cam design system against its implementation. The canonical
// source is .impeccable/design.json (machine-readable) paired with DESIGN.md
// (human spec); loop-tokens.css and loop-ui.css implement it. These are
// intentional Loop deltas no other verifier guards — an upstream re-merge or a
// drifting hand-edit that desyncs spec and implementation should fail here.
// Pure-node; runs without Playwright.

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const failures = [];
const check = (condition, message) => {
	if (!condition) failures.push(message);
};

// Read a repo file fail-closed: a missing or renamed canonical file (a plausible
// upstream re-merge outcome — the exact drift this verifier guards) reports as a
// contract failure with a clear message, never an opaque ENOENT stack later.
// Line endings are normalized so a CRLF checkout cannot break \n-anchored regexes.
const cache = {};
const read = file => {
	if (file in cache) return cache[file];
	try {
		return (cache[file] = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n"));
	} catch (error) {
		console.error("Loop design-system contract verification FAILED:\n");
		console.error(`  - ${file} is missing or unreadable (${error.message})`);
		process.exit(1);
	}
};
const exists = file => fs.existsSync(path.join(root, file));
const lc = s => s.toLowerCase();

// Canonical machine source. Parsed fail-closed so a missing or malformed file
// reports a contract violation rather than an opaque stack.
let design;
try {
	design = JSON.parse(read(".impeccable/design.json"));
} catch (error) {
	console.error("Loop design-system contract verification FAILED:\n");
	console.error(`  - .impeccable/design.json is missing or not valid JSON (${error.message})`);
	process.exit(1);
}

const tokens = read("loop-tokens.css");
const tokensLc = lc(tokens);
// Shadows and motion live in loop-ui.css/loop-tokens.css; search both.
const loopCssLc = lc(tokens + "\n" + read("loop-ui.css"));

const colorMeta = (design.extensions && design.extensions.colorMeta) || {};
const ramp = key => (((colorMeta[key] && colorMeta[key].tonalRamp) || []).map(lc));
const surfaceRamp = ramp("surface");
const accentRamp = ramp("accent");

// Accent: the one green. Canonical hex must appear in the design.json ramp and
// be declared as the Loop accent token. Hex compares are case-insensitive.
check(accentRamp.includes("#64c04d"), 'design.json: accent tonalRamp must include canonical Loop Green #64c04d');
check(/--loop-accent:\s*#64c04d\b/.test(tokensLc), 'loop-tokens.css: --loop-accent must be #64c04d (canonical Loop Green)');

// Surface fallbacks must equal the documented canonical greys. These are the
// var() *fallbacks*, used only if main.css drops --discord-grey-7/5. In the live
// cascade main.css defines them — to #404249/#313338 in :root, and softened to
// #3a3d45/#2f3237 under @media (prefers-color-scheme: dark). The dark-pin block
// below restores the canonical greys in that scheme, so the resolved dark-mode
// surface matches the fallback rather than the softened value.
check(/--loop-ui-surface:\s*var\(\s*--discord-grey-7\s*,\s*#404249\s*\)/.test(tokensLc),
	'loop-tokens.css: --loop-ui-surface fallback must be #404249 (canonical Surface)');
check(/--loop-ui-surface-raised:\s*var\(\s*--discord-grey-5\s*,\s*#313338\s*\)/.test(tokensLc),
	'loop-tokens.css: --loop-ui-surface-raised fallback must be #313338 (canonical Surface Raised)');

// Dark-theme surface pin: loop-tokens.css must re-pin the softened greys to
// canonical inside a prefers-color-scheme:dark :root block, so the home cards
// (.darktheme .card -> --discord-grey-7) and the --loop-ui-* tokens resolve
// on-spec in dark mode instead of main.css's #3a3d45/#2f3237 softening.
const darkPin = (tokensLc.match(/@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]*)\}/) || [])[1] || "";
check(/--discord-grey-7:\s*#404249\b/.test(darkPin),
	'loop-tokens.css: prefers-color-scheme:dark block must pin --discord-grey-7 to #404249 (canonical Surface)');
check(/--discord-grey-5:\s*#313338\b/.test(darkPin),
	'loop-tokens.css: prefers-color-scheme:dark block must pin --discord-grey-5 to #313338 (canonical Surface Raised)');
check(surfaceRamp.includes("#404249") && surfaceRamp.includes("#313338"),
	'design.json: surface tonalRamp must include #404249 and #313338 (Surface / Surface Raised)');

// DESIGN.md frontmatter is the human spec. Extract an indented child block under
// a top-level `key:` line, robust to key ordering and the block being last
// (terminates on the next non-indented line or end of frontmatter).
const frontmatter = (read("DESIGN.md").match(/^---\n([\s\S]*?)\n---/) || [])[1] || "";
check(frontmatter, "DESIGN.md: YAML frontmatter block must be present");
const childBlock = key => {
	const m = frontmatter.match(new RegExp(`^${key}:\\n((?:[ \\t]+.*(?:\\n|$))+)`, "m"));
	return m ? m[1] : "";
};

// Effective hex of a token declaration: the var() fallback when present, else
// the literal hex.
const effectiveHex = decl => {
	const fallback = decl.match(/var\([^,]+,\s*(#[0-9a-f]{3,8})\s*\)/);
	if (fallback) return fallback[1];
	const plain = decl.match(/#[0-9a-f]{3,8}/);
	return plain ? plain[0] : null;
};
const tokenValue = token => {
	const m = tokensLc.match(new RegExp(`${token}:\\s*([^;]+);`));
	return m ? m[1].trim() : null;
};

// Colors: cross-check the canonical colors that map to a --loop-* token. The
// frontmatter color map is the least-guarded leg of the contract — a hand-edit
// that desyncs DESIGN.md from the implementation must fail here.
const colorsBlock = childBlock("colors");
const colorToken = {
	canvas: "--loop-ui-bg",
	surface: "--loop-ui-surface",
	"surface-raised": "--loop-ui-surface-raised",
	border: "--loop-ui-border",
	"text-primary": "--loop-ui-text",
	"text-muted": "--loop-ui-muted",
	accent: "--loop-accent",
};
for (const [key, token] of Object.entries(colorToken)) {
	const specMatch = colorsBlock.match(new RegExp(`\\b${key}:\\s*"(#[0-9a-fA-F]{3,8})"`));
	check(specMatch, `DESIGN.md: colors.${key} must be defined in frontmatter`);
	if (specMatch) {
		const value = lc(specMatch[1]);
		const decl = tokenValue(token);
		const actual = decl && effectiveHex(decl);
		check(actual === value,
			`loop-tokens.css: ${token} must resolve to ${value} to match DESIGN.md colors.${key} (found ${actual || "none"})`);
	}
}

// Radii: DESIGN.md frontmatter `rounded` is the spec; loop-tokens.css must match.
const roundedBlock = childBlock("rounded");
const radiusKeys = { sm: "--loop-ui-radius-sm", md: "--loop-ui-radius-md", lg: "--loop-ui-radius-lg", pill: "--loop-ui-radius-pill" };
for (const [key, token] of Object.entries(radiusKeys)) {
	const specMatch = roundedBlock.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
	check(specMatch, `DESIGN.md: rounded.${key} must be defined in frontmatter`);
	if (specMatch) {
		const value = specMatch[1];
		const decl = tokenValue(token);
		check(decl === value,
			`loop-tokens.css: ${token} must be ${value} to match DESIGN.md rounded.${key} (found ${decl || "none"})`);
	}
}

// Shadows and motion declared in design.json must appear in the Loop CSS. Guard
// the arrays so an emptied/removed key cannot silently disable enforcement.
const shadows = (design.extensions && design.extensions.shadows) || [];
const motion = (design.extensions && design.extensions.motion) || [];
check(shadows.length > 0, "design.json: extensions.shadows must be present and non-empty");
check(motion.length > 0, "design.json: extensions.motion must be present and non-empty");
for (const shadow of shadows) {
	check(loopCssLc.includes(lc(shadow.value)),
		`loop CSS must use the "${shadow.name}" shadow ${shadow.value} (design.json elevation)`);
}
for (const curve of motion) {
	check(loopCssLc.includes(lc(curve.value)),
		`loop CSS must use the "${curve.name}" motion curve ${curve.value} (design.json motion)`);
}

// Doc-surface integrity: the canonical artifacts exist and cross-link.
for (const doc of ["DESIGN.md", "PRODUCT.md", ".impeccable/design.json", "docs/DESIGN.md"]) {
	check(exists(doc), `${doc}: canonical design-system artifact must exist`);
}
if (exists("docs/DESIGN.md")) {
	check(/\.\.\/DESIGN\.md/.test(read("docs/DESIGN.md")),
		'docs/DESIGN.md must link back to the canonical ../DESIGN.md');
}
check(Array.isArray(design.components) && design.components.length > 0,
	'design.json: components array must be present and non-empty');

if (failures.length) {
	console.error("Loop design-system contract verification FAILED:\n");
	console.error(failures.map(f => `  - ${f}`).join("\n"));
	process.exit(1);
}

console.log("Loop design-system contract verified (tokens, surface fallbacks, dark-mode pin, colors, radii, shadows/motion, doc surface).");
