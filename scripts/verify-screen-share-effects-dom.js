#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function assertIncludes(name, value) {
	if (!indexHtml.includes(value)) {
		throw new Error(`${name} missing: ${value}`);
	}
}

function assertOrder(beforeName, before, afterName, after) {
	const beforeIndex = indexHtml.indexOf(before);
	const afterIndex = indexHtml.indexOf(after);
	if (beforeIndex === -1 || afterIndex === -1 || beforeIndex > afterIndex) {
		throw new Error(`${beforeName} should appear before ${afterName}`);
	}
}

assertIncludes("screen-share effects panel", 'id="effectsDiv3"');
assertIncludes("screen-share content image target", 'id="selectImageContent3"');
assertIncludes("screen-share overlay image target", 'id="selectImageOverlay3"');
assertIncludes("content image target hidden style", 'id="selectImageContent3" style="display:none;margin-top:10px;"');
assertIncludes("overlay image target hidden style", 'id="selectImageOverlay3" style="display:none;margin-top:10px;"');
assertOrder("screen-share effect amount", 'id="selectEffectAmount3"', "screen-share content image target", 'id="selectImageContent3"');
assertOrder("screen-share content image target", 'id="selectImageContent3"', "screen-share overlay image target", 'id="selectImageOverlay3"');
assertOrder("screen-share overlay image target", 'id="selectImageOverlay3"', "screen-share zoom controls", 'id="zoomPositionControls3"');

console.log("Screen-share effects DOM contract verified.");
