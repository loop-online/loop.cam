#!/usr/bin/env node
// Guards the removal of the Line Awesome font for the static `class="las la-*"`
// hooks written into the root-level HTML pages: each such page must (a) load the
// Lucide upgrader and (b) use only tokens the Lucide map+glyph bundle covers, or
// it would render broken icons now that the font no longer ships.
// Scope: root-level *.html only (non-recursive; examples/ and subdirs excluded).
// JS-injected `la-*` hooks (lib.js/main.js) are covered by verify-loop-icon-system.js,
// which runs the same map+glyph check over the JS token census.

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

eval(fs.readFileSync(path.join(root, "loop-icon-line-map.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "loop-icon-glyphs.js"), "utf8"));
const MAP = globalThis.LoopIconLineMap;
const GLYPHS = globalThis.LoopIconGlyphs;
if (!MAP || typeof MAP !== "object") {
	throw new Error("loop-icon-line-map.js did not define LoopIconLineMap");
}
if (!GLYPHS || typeof GLYPHS !== "object") {
	throw new Error("loop-icon-glyphs.js did not define LoopIconGlyphs");
}

const htmls = fs.readdirSync(root).filter(f => f.endsWith(".html"));

const pagesMissingUpgrader = [];
const unmappedByToken = {};

for (const file of htmls) {
	const src = fs.readFileSync(path.join(root, file), "utf8");
	const tokens = new Set();
	for (const m of src.matchAll(/class\s*=\s*["']([^"']*)["']/g)) {
		const cls = m[1];
		if (!/\b(las|lar|lab)\b/.test(cls)) continue;
		for (const part of cls.split(/\s+/)) {
			if (part.indexOf("la-") === 0 && !["las", "lar", "lab"].includes(part)) {
				tokens.add(part.slice(3));
			}
		}
	}
	if (!tokens.size) continue;

	if (!src.includes("loop-icons.js")) {
		pagesMissingUpgrader.push(file);
	}
	for (const t of tokens) {
		const lucide = MAP[t];
		if (!lucide || !GLYPHS[lucide]) {
			(unmappedByToken[t] ||= new Set()).add(file);
		}
	}
}

const errors = [];
if (pagesMissingUpgrader.length) {
	errors.push(
		"Pages use Line Awesome hooks but do not load loop-icons.js (icons would not upgrade):\n  " +
		pagesMissingUpgrader.join("\n  ")
	);
}
const unmapped = Object.keys(unmappedByToken).sort();
if (unmapped.length) {
	errors.push(
		"Line Awesome tokens with no Lucide map/glyph (would render nothing):\n" +
		unmapped.map(t => `  la-${t}  <-  ${[...unmappedByToken[t]].join(", ")}`).join("\n")
	);
}

if (errors.length) {
	console.error("Loop icon coverage FAILED — Line Awesome font has been removed.\n");
	console.error(errors.join("\n\n"));
	process.exit(1);
}

console.log(`Loop icon coverage verified: ${htmls.length} root-level HTML files, all static Line Awesome hooks load the upgrader and map to Lucide glyphs.`);
