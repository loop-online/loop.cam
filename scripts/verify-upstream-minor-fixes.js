#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
	return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(file, value, expected) {
	if (!value.includes(expected)) {
		throw new Error(`${file} should include ${expected}`);
	}
}

function assertNotIncludes(file, value, unexpected) {
	if (value.includes(unexpected)) {
		throw new Error(`${file} should not include ${unexpected}`);
	}
}

const indexHtml = read("index.html");
const libJs = read("lib.js");
const mainJs = read("main.js");
const en = JSON.parse(read("translations/en.json"));
const blank = JSON.parse(read("translations/blank.json"));

assertIncludes("main.js", mainJs, "listenWebsocket(urlParams.get(\"justtalk\"));");
assertNotIncludes("main.js", mainJs, "uurlParams");

assertIncludes("index.html", indexHtml, "Unlock the video bitrate (20-Mbps)");
assertNotIncludes("index.html", indexHtml, "20mbps");
assertIncludes("translations/en.json", en.innerHTML["unlock-video-bitrate"], "20-Mbps");
assertIncludes("translations/blank.json", blank.innerHTML["unlock-video-bitrate"], "20-Mbps");
assertNotIncludes("lib.js", libJs, "-mbps");
assertIncludes("lib.js", libJs, "<small>-Mbps</small>");
assertIncludes("lib.js", libJs, "1.2-Mbps");

console.log("Upstream minor fixes verified.");
console.log("Checks: hearptsn typo, Mbps labels, translation strings.");
