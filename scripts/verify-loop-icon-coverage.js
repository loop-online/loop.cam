#!/usr/bin/env node
// Guards the removal of the Line Awesome font: every HTML page that uses a
// Line Awesome class hook must (a) load the Lucide upgrader and (b) use only
// tokens the Lucide map+glyph bundle covers. If either fails, the page would
// render broken icons now that the font no longer ships.

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

eval(fs.readFileSync(path.join(root, "loop-icon-line-map.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "loop-icon-glyphs.js"), "utf8"));
const MAP = globalThis.LoopIconLineMap;
const GLYPHS = globalThis.LoopIconGlyphs;

const htmls = fs.readdirSync(root).filter(f => f.endsWith(".html"));
const tokenRe = /class\s*=\s*["']([^"']*)["']/g;

const pagesMissingUpgrader = [];
const unmappedByToken = {};

for (const file of htmls) {
	const src = fs.readFileSync(path.join(root, file), "utf8");
	const tokens = new Set();
	let m;
	while ((m = tokenRe.exec(src))) {
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

console.log(`Loop icon coverage verified: ${htmls.length} HTML files, all Line Awesome hooks load the upgrader and map to Lucide glyphs.`);
