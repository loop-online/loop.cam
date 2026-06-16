#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const mainJs = fs.readFileSync(path.resolve(__dirname, "..", "main.js"), "utf8");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function blockBetween(startNeedle, endNeedle) {
	const start = mainJs.indexOf(startNeedle);
	const end = mainJs.indexOf(endNeedle, start);
	assert(start !== -1, `${startNeedle} block not found`);
	assert(end !== -1, `${endNeedle} boundary not found`);
	return mainJs.slice(start, end);
}

function assertCatchFailsClosed(name, block) {
	const authStart = block.indexOf("let allow = false;");
	const allowBranch = block.indexOf("if (allow)", authStart);
	assert(authStart !== -1, `${name} allow guard not found`);
	assert(allowBranch !== -1, `${name} allow branch not found`);
	const authBlock = block.slice(authStart, allowBranch);
	const catchIndex = authBlock.lastIndexOf("} catch(e){");
	assert(catchIndex !== -1, `${name} authorization catch block not found`);
	const catchBlock = authBlock.slice(catchIndex, authBlock.indexOf("}", catchIndex + 11) + 1);
	assert(catchBlock.includes("allow = false;"), `${name} authorization catch block must fail closed`);
	assert(!catchBlock.includes("allow = true;"), `${name} authorization catch block still fails open`);
}

assertCatchFailsClosed(
	"external js",
	blockBetween('if (urlParams.has("js")) {', 'if (urlParams.has("base64js") || urlParams.has("b64js") || urlParams.has("jsbase64") || urlParams.has("jsb64")) {')
);

assertCatchFailsClosed(
	"base64 js",
	blockBetween('if (urlParams.has("base64js") || urlParams.has("b64js") || urlParams.has("jsbase64") || urlParams.has("jsb64")) {', "session.sitePassword = session.defaultPassword;")
);

console.log("JavaScript injection fail-closed behavior verified.");
