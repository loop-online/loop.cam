#!/usr/bin/env node
// Pins the Loop UI simplification pass (U5/U6/U7). These are intentional,
// merge-fragile edits to upstream-owned markup that no other verifier guards:
// an upstream re-merge that silently reverts any of them should fail here.
// Pure-node; runs without Playwright.

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const read = file => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => {
	if (!condition) failures.push(message);
};

// U5: the home "More Options" reveal no longer un-hides non-core VDO.Ninja cards.
// The curated list must stay empty — re-introducing container ids re-exposes them.
const libJs = read("lib.js");
check(
	/var loopVisibleHomeCards\s*=\s*\[\s*\]/.test(libJs),
	'lib.js: loopVisibleHomeCards must stay [] (U5 dropped the non-core home-card reveal)'
);

// U6: advanced Create-a-Room controls collapse behind a disclosure on index.html.
const indexHtml = read("index.html");
check(
	/<tbody id="roomAdvanced"[^>]*\shidden\b/.test(indexHtml),
	'index.html: <tbody id="roomAdvanced"> must carry the hidden attribute (U6 disclosure default-collapsed)'
);
const toggleMatches = indexHtml.match(/class="loop-disclosure-toggle"/g) || [];
check(
	toggleMatches.length === 1,
	`index.html: expected exactly one .loop-disclosure-toggle, found ${toggleMatches.length}`
);
const toggleTag = (indexHtml.match(/<button[^>]*class="loop-disclosure-toggle"[^>]*>/) || [])[0] || "";
check(
	/aria-controls="roomAdvanced"/.test(toggleTag),
	'index.html: .loop-disclosure-toggle must set aria-controls="roomAdvanced"'
);
check(
	/aria-expanded="false"/.test(toggleTag),
	'index.html: .loop-disclosure-toggle must default aria-expanded="false"'
);
check(
	read("loop-ui.css").includes(".loop-disclosure-toggle {"),
	'loop-ui.css: must define the .loop-disclosure-toggle rule (U6 styling)'
);

// U7: flip-camera glyph owns flipcameratoggle; the settings glyph keeps settingstoggle.
// Pre-pass both pages shared id="settingstoggle" across two distinct controls.
for (const page of ["index.html", "room.html"]) {
	const src = read(page);
	check(
		src.includes('id="flipcameratoggle" class="toggleSize las la-sync-alt"'),
		`${page}: flip-camera glyph must use id="flipcameratoggle" (U7 dedupe)`
	);
	check(
		!/id="settingstoggle"[^>]*la-sync-alt/.test(src),
		`${page}: id="settingstoggle" must not sit on the la-sync-alt (flip-camera) glyph`
	);
	const settingsCount = (src.match(/id="settingstoggle"/g) || []).length;
	check(
		settingsCount === 1,
		`${page}: expected exactly one id="settingstoggle", found ${settingsCount}`
	);
}

if (failures.length) {
	console.error("Loop UI simplification pass verification FAILED:\n");
	console.error(failures.map(f => `  - ${f}`).join("\n"));
	process.exit(1);
}

console.log("Loop UI simplification pass verified (U5 home cards, U6 room disclosure, U7 toggle ids).");
