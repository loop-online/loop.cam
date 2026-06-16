#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function assertEqual(name, actual, expected) {
	if (actual !== expected) {
		throw new Error(`${name} mismatch\nexpected: ${expected}\nactual:   ${actual}`);
	}
}

function assertDeepEqual(name, actual, expected) {
	const actualJson = JSON.stringify(actual);
	const expectedJson = JSON.stringify(expected);
	if (actualJson !== expectedJson) {
		throw new Error(`${name} mismatch\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
	}
}

function main() {
	const source = fs.readFileSync(path.join(root, "iframe-examples.js"), "utf8");
	const context = {};
	vm.createContext(context);
	vm.runInContext(source, context, { filename: "iframe-examples.js" });

	if (typeof context.guestTargetedAPI !== "function") {
		throw new Error("guestTargetedAPI should be defined");
	}

	const target = "guest-stream";
	const api = context.guestTargetedAPI(target);
	const expectedEntries = {
		ptzZoom: { value: "0.25", expected: { action: "ptzZoom", target, value: 0.25 } },
		ptzPan: { value: "-0.25", expected: { action: "ptzPan", target, value: -0.25 } },
		ptzTilt: { value: "0.5", expected: { action: "ptzTilt", target, value: 0.5 } },
		ptzFocus: { value: "-0.5", expected: { action: "ptzFocus", target, value: -0.5 } },
		ptzAutofocus: { value: true, expected: { action: "ptzAutofocus", target, value: true } },
		remoteMirror: { value: "toggle", expected: { action: "remoteMirror", target, value: "toggle" } },
		remoteRotate: { value: 90, expected: { action: "remoteRotate", target, value: 90 } }
	};

	for (const [name, contract] of Object.entries(expectedEntries)) {
		if (!api[name]) {
			throw new Error(`${name} should be in guestTargetedAPI`);
		}
		assertDeepEqual(`${name} result`, api[name].result(contract.value), contract.expected);
	}

	assertEqual("ptzZoom input type", api.ptzZoom.input.type, "range");
	assertEqual("ptzPan min", api.ptzPan.input.min, -1);
	assertEqual("ptzTilt max", api.ptzTilt.input.max, 1);
	assertEqual("remoteRotate option count", api.remoteRotate.options.length, 5);

	console.log("Iframe examples verified.");
	console.log(`Guest-targeted entries: ${Object.keys(expectedEntries).join(", ")}`);
}

main();
