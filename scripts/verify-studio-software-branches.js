#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainJs = fs.readFileSync(path.join(root, "main.js"), "utf8");
const libJs = fs.readFileSync(path.join(root, "lib.js"), "utf8");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function blockBetween(source, startNeedle, endNeedle) {
	const start = source.indexOf(startNeedle);
	assert(start !== -1, `${startNeedle} block not found`);
	const end = source.indexOf(endNeedle, start);
	assert(end !== -1, `${endNeedle} boundary not found`);
	return source.slice(start, end);
}

assert(libJs.includes('var isMELD = false;'), "MELD browser-source detector is missing");
assert(libJs.includes('navigator.userAgent.includes("Meld/")'), "MELD detector must use the upstream user-agent check");

const earlyStudioBlock = blockBetween(
	mainJs,
	'if (urlParams.has("hidehome")) {',
	'if (urlParams.has("previewmode")) {'
);
assert(earlyStudioBlock.includes("if (window.obsstudio || isMELD) {"), "studioSoftware must be set from OBS or MELD before redirect/settings handling");
assert(earlyStudioBlock.includes("session.studioSoftware = true;"), "early studioSoftware assignment is missing");

const redirectBlock = blockBetween(
	mainJs,
	'if (urlParams.has("nocontrols")) {',
	'if (isIFrame) {'
);
assert(redirectBlock.includes("if (!isIFrame && !session.studioSoftware) {"), "redirect/settings branch must key off session.studioSoftware");
assert(!redirectBlock.includes("if (!isIFrame && !window.obsstudio) {"), "redirect/settings branch still keys off window.obsstudio");

const cssInjectionBlock = blockBetween(
	mainJs,
	'if (urlParams.has("base64css") || urlParams.has("b64css") || urlParams.has("cssbase64") || urlParams.has("cssb64")) {',
	'if (urlParams.has("avatar")) {'
);
assert(!cssInjectionBlock.includes("|| window.obsstudio"), "CSS injection permissions should use session.studioSoftware, not window.obsstudio");
assert((cssInjectionBlock.match(/\|\| session\.studioSoftware/g) || []).length >= 3, "expected CSS studioSoftware permission checks are missing");

const jsInjectionBlock = blockBetween(
	mainJs,
	'if (urlParams.has("js")) {',
	'session.sitePassword = session.defaultPassword;'
);
assert(!jsInjectionBlock.includes("|| window.obsstudio"), "JS injection permissions should use session.studioSoftware, not window.obsstudio");
assert((jsInjectionBlock.match(/\|\| session\.studioSoftware/g) || []).length >= 2, "expected JS studioSoftware permission checks are missing");

assert(mainJs.includes("if (session.scene !== false && session.style === false && session.studioSoftware) {"), "scene style default must use session.studioSoftware");
assert(mainJs.includes("if (session.studioSoftware || navigator.userAgent.toLowerCase().indexOf(\" electron/\") > -1) {"), "fullscreen default must use session.studioSoftware");
assert(/}\s+else if \(session\.studioSoftware\) \{\s+getById\("header"\)\.style\.display = "none";/.test(mainJs), "header hiding must use session.studioSoftware");
assert(/if \(session\.studioSoftware\) \{\s+getById\("unexpectedPushLink"\)\.classList\.remove\("hidden"\);/.test(mainJs), "unexpected push link must use session.studioSoftware");
assert(/}\s+else if \(session\.studioSoftware && [^{]*session\.permaid === false/.test(mainJs), "room view auto-scene branch must use session.studioSoftware");
assert(mainJs.includes("if (session.style === false && session.studioSoftware) {"), "view style default must use session.studioSoftware");

const obsBlock = blockBetween(mainJs, "if (window.obsstudio) {", 'if (urlParams.has("chroma")) {');
assert(obsBlock.includes("window.obsstudio.pluginVersion"), "OBS plugin version handling must stay OBS-specific");
assert(obsBlock.includes("getOBSDetails();"), "OBS detail collection must stay OBS-specific");
assert(obsBlock.includes('window.addEventListener("obsSceneChanged", obsSceneChanged);'), "OBS event listeners must stay OBS-specific");

console.log("Studio software branch contract verified.");
console.log("Generic studio UX uses session.studioSoftware; OBS APIs stay behind window.obsstudio.");
