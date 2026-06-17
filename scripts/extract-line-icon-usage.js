#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mapPath = path.join(__dirname, "loop-icon-line-map.json");
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));

const targets = [
	"index.html",
	"lib.js",
	"main.js",
	"room.html",
	"whip.html",
	"electron.html",
	"speedtest.html",
	"translations/en.json"
];

const used = new Set();
const pattern = /\bla-([a-z0-9-]+)\b/g;

for (const file of targets) {
	const filePath = path.join(root, file);
	if (!fs.existsSync(filePath)) {
		continue;
	}
	const source = fs.readFileSync(filePath, "utf8");
	let match;
	while ((match = pattern.exec(source)) !== null) {
		used.add(match[1]);
	}
}

const unmapped = [...used].filter(name => !map[name]).sort();
if (unmapped.length) {
	console.error("Unmapped Line Awesome icons:", unmapped.join(", "));
	process.exit(1);
}

console.log(`Mapped ${used.size} Line Awesome icon names.`);
