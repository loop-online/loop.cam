#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const lib = fs.readFileSync(path.resolve(__dirname, "..", "lib.js"), "utf8");

const messageHandlerStart = lib.indexOf('socket.addEventListener("message", async function (event) {');
const processWhipStart = lib.indexOf("async function processWhipIn", messageHandlerStart);

if (messageHandlerStart === -1 || processWhipStart === -1) {
	throw new Error("Could not find WHIP client message handler.");
}

const handler = lib.slice(messageHandlerStart, processWhipStart);

const expectedSnippets = [
	'if ("sdp" in data) {',
	"try {",
	"var resp = await processWhipIn(data, sendTrickle);",
	"} catch (e) {",
	"var resp = e && (e.message || e.toString());",
	"ret.callback = data;",
	"socket.send(JSON.stringify(ret));"
];

for (const snippet of expectedSnippets) {
	if (!handler.includes(snippet)) {
		throw new Error(`WHIP error callback contract missing: ${snippet}`);
	}
}

const processIndex = handler.indexOf("var resp = await processWhipIn(data, sendTrickle);");
const catchIndex = handler.indexOf("var resp = e && (e.message || e.toString());");
const callbackIndex = handler.indexOf("ret.callback = data;");

if (!(processIndex < catchIndex && catchIndex < callbackIndex)) {
	throw new Error("WHIP error fallback should run before callback response handling.");
}

console.log("WHIP error callback contract verified.");
