#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const streamSaverPath = path.join(root, "thirdparty/StreamSaver.js");
const mitmPath = path.join(root, "thirdparty/mitm.html");
const streamSaverSource = fs.readFileSync(streamSaverPath, "utf8");
const mitmSource = fs.readFileSync(mitmPath, "utf8");

function assertIncludes(name, source, snippet) {
	if (!source.includes(snippet)) {
		throw new Error(`${name} is missing expected source: ${snippet}`);
	}
}

new vm.Script(streamSaverSource, { filename: "thirdparty/StreamSaver.js" });

const scriptMatch = mitmSource.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
	throw new Error("thirdparty/mitm.html does not contain a script block");
}
new vm.Script(scriptMatch[1], { filename: "thirdparty/mitm.html<script>" });

assertIncludes(
	"StreamSaver",
	streamSaverSource,
	"let useBlobFallback = /constructor/i.test(global.HTMLElement) || !!global.safari || !!global.WebKitPoint;"
);
assertIncludes("StreamSaver", streamSaverSource, "const iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);");
assertIncludes("StreamSaver MITM", mitmSource, "throw new Error('[StreamSaver] Service worker registration failed')");
assertIncludes("StreamSaver MITM", mitmSource, "streamSaverError: true");

console.log("StreamSaver runtime assets verified.");
