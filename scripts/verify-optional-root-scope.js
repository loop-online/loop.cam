#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const supportedSurfaceFiles = [
	"index.html",
	"speedtest.html",
	"check.html",
	"results.html",
	"monitor.html",
	"iframe.html",
	"comms.html",
	"whiteboard.html",
	"whip.html",
	"podcast/bootstrap.js",
	"podcast/index.html",
	"podcast/studio.js"
];

const unpromotedDefaultSurfaceReferences = [
	/chat-lite\//,
	/notifications\//,
	/obs\//,
	/screenrecorder\//,
	/(?:href|src|window\.location|open)\s*=\s*["'][^"']*\.\/browsercheck\.html/,
	/(?:href|src|window\.location|open)\s*=\s*["'][^"']*\.\/codeccomparison\.html/,
	/(?:href|src|window\.location|open)\s*=\s*["'][^"']*\.\/resolutionchecker\.html/,
	/(?:href|src|window\.location|open)\s*=\s*["'][^"']*\.\/streamdeck\.html/
];

const failures = [];

for (const relativePath of supportedSurfaceFiles) {
	const absolutePath = path.join(root, relativePath);
	if (!fs.existsSync(absolutePath)) {
		failures.push(`${relativePath}: missing supported surface file`);
		continue;
	}

	const source = fs.readFileSync(absolutePath, "utf8");
	for (const pattern of unpromotedDefaultSurfaceReferences) {
		if (pattern.test(source)) {
			failures.push(`${relativePath}: references unpromoted upstream root or page: ${pattern}`);
		}
	}
}

if (failures.length) {
	throw new Error(`Optional upstream surface violation:\n${failures.join("\n")}`);
}

console.log("Optional upstream scope verified.");
console.log("Supported Loop routes do not promote optional upstream roots.");
