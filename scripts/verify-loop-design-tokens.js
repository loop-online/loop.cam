#!/usr/bin/env node
// Pins the Loop Cam design system against its implementation. The canonical
// source is .impeccable/design.json (machine-readable) paired with DESIGN.md
// (human spec); loop-tokens.css and loop-ui.css implement it. These are
// intentional Loop deltas no other verifier guards — an upstream re-merge or a
// drifting hand-edit that desyncs spec and implementation should fail here.
// Pure-node; runs without Playwright.

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const read = file => fs.readFileSync(path.join(root, file), "utf8");
const exists = file => fs.existsSync(path.join(root, file));
const failures = [];
const check = (condition, message) => {
	if (!condition) failures.push(message);
};

// Fail closed with a clear message if the canonical source is missing or
// unparseable, rather than throwing an opaque stack later.
let design;
try {
	design = JSON.parse(read(".impeccable/design.json"));
} catch (error) {
	console.error("Loop design-system contract verification FAILED:\n");
	console.error(`  - .impeccable/design.json is missing or not valid JSON (${error.message})`);
	process.exit(1);
}

const tokens = read("loop-tokens.css");
// Shadows and motion live in loop-ui.css/loop-tokens.css; search both.
const loopCss = tokens + "\n" + read("loop-ui.css");

const surfaceRamp = (design.extensions && design.extensions.colorMeta
	&& design.extensions.colorMeta.surface && design.extensions.colorMeta.surface.tonalRamp) || [];
const accentRamp = (design.extensions && design.extensions.colorMeta
	&& design.extensions.colorMeta.accent && design.extensions.colorMeta.accent.tonalRamp) || [];

// Accent: the one green. Canonical hex must appear in the design.json ramp and
// be declared as the Loop accent token.
check(accentRamp.includes("#64c04d"), 'design.json: accent tonalRamp must include canonical Loop Green #64c04d');
check(/--loop-accent:\s*#64c04d\b/.test(tokens), 'loop-tokens.css: --loop-accent must be #64c04d (canonical Loop Green)');

// Surface fallbacks must equal the documented canonical greys. main.css resolves
// --discord-grey-7/5 to these today; the fallback must not drift off-spec.
check(/--loop-ui-surface:\s*var\(--discord-grey-7,\s*#404249\)/.test(tokens),
	'loop-tokens.css: --loop-ui-surface fallback must be #404249 (canonical Surface)');
check(/--loop-ui-surface-raised:\s*var\(--discord-grey-5,\s*#313338\)/.test(tokens),
	'loop-tokens.css: --loop-ui-surface-raised fallback must be #313338 (canonical Surface Raised)');
check(surfaceRamp.includes("#404249") && surfaceRamp.includes("#313338"),
	'design.json: surface tonalRamp must include #404249 and #313338 (Surface / Surface Raised)');

// Radii: DESIGN.md frontmatter `rounded` is the spec; loop-tokens.css must match.
const designMd = read("DESIGN.md");
const roundedBlock = (designMd.match(/^rounded:\n([\s\S]*?)\n[a-z]/m) || [])[1] || "";
const radiusKeys = { sm: "--loop-ui-radius-sm", md: "--loop-ui-radius-md", lg: "--loop-ui-radius-lg", pill: "--loop-ui-radius-pill" };
for (const [key, token] of Object.entries(radiusKeys)) {
	const specMatch = roundedBlock.match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));
	check(specMatch, `DESIGN.md: rounded.${key} must be defined in frontmatter`);
	if (specMatch) {
		const value = specMatch[1];
		const tokenMatch = tokens.match(new RegExp(`${token}:\\s*([^;]+);`));
		check(tokenMatch && tokenMatch[1].trim() === value,
			`loop-tokens.css: ${token} must be ${value} to match DESIGN.md rounded.${key} (found ${tokenMatch ? tokenMatch[1].trim() : "none"})`);
	}
}

// Shadows and motion declared in design.json must appear in the Loop CSS.
for (const shadow of (design.extensions && design.extensions.shadows) || []) {
	check(loopCss.includes(shadow.value),
		`loop CSS must use the "${shadow.name}" shadow ${shadow.value} (design.json elevation)`);
}
for (const motion of (design.extensions && design.extensions.motion) || []) {
	check(loopCss.includes(motion.value),
		`loop CSS must use the "${motion.name}" motion curve ${motion.value} (design.json motion)`);
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

console.log("Loop design-system contract verified (tokens, surface fallbacks, radii, shadows/motion, doc surface).");
