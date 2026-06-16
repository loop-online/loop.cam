#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lib = fs.readFileSync(path.join(root, "lib.js"), "utf8");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

assert(!lib.includes("value => 27"), "midi command volume branch still uses arrow-function syntax");

const functionStart = lib.indexOf("function midiHotkeysCommand(command, value)");
const functionEnd = lib.indexOf("session.createResourceChannel", functionStart);

assert(functionStart !== -1, "midiHotkeysCommand function not found");
assert(functionEnd !== -1, "midiHotkeysCommand boundary not found");

const body = lib.slice(functionStart, functionEnd);

assert(body.includes("} else if (value >= 27) {"), "midi command volume branch does not compare value >= 27");
assert(body.includes('getRightOrderedElement(\'[data-action-type="volume"][data--u-u-i-d]\''), "midi command volume branch no longer targets the guest volume control");
assert(body.includes("remoteVolume(ele);"), "midi command volume branch no longer applies remote volume");

console.log("MIDI command volume branch verified.");
