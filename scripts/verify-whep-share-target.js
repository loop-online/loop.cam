#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const mainJs = fs.readFileSync(path.resolve(__dirname, "..", "main.js"), "utf8");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const start = indexHtml.indexOf('id="container-16"');
const end = indexHtml.indexOf('id="unexpectedPushLink"', start);

assert(start !== -1, "WHEP card not found");
assert(end !== -1, "WHEP card boundary not found");

const whepCard = indexHtml.slice(start, end);

assert(whepCard.includes('id="whepURL"'), "WHEP URL input not found");
assert(whepCard.includes('onclick="toggleWhepTestPreview(event)"'), "WHEP preview button does not use the WHEP preview handler");
assert(whepCard.includes('onclick="startWhepSharingFromInput(event)"'), "WHEP share button does not use the WHEP share handler");
assert(!whepCard.includes("session.publishIFrame(getById('iframeURL').value);"), "WHEP share button still publishes iframeURL");
assert(mainJs.includes('const whepInput = getById("whepURL");'), "WHEP runtime does not read whepURL");
assert(mainJs.includes("session.publishIFrame(normalizedWhepUrl);"), "WHEP runtime does not publish the normalized WHEP URL");

console.log("WHEP share target verified.");
