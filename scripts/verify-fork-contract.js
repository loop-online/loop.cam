#!/usr/bin/env node

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const upstreamRef = process.env.UPSTREAM_REF || "upstream/develop";

function git(args, options = {}) {
	return cp.execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		...options
	});
}

function normalize(source) {
	return source.replace(/\r\n/g, "\n");
}

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readUpstream(relativePath) {
	return git(["show", `${upstreamRef}:${relativePath}`]);
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function diffNames(paths) {
	return git(["diff", "--ignore-cr-at-eol", "--name-only", upstreamRef, "--", ...paths])
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
}

function assertNoDiffFromUpstream(relativePath) {
	const current = normalize(read(relativePath));
	const upstream = normalize(readUpstream(relativePath));
	assert(current === upstream, `${relativePath} should match ${upstreamRef}`);
}

function objectKeys(object) {
	return Object.keys(object || {});
}

function setDifference(left, right) {
	const rightSet = new Set(right);
	return left.filter(value => !rightSet.has(value));
}

function extractDataTranslateKeys() {
	return [...read("index.html").matchAll(/\bdata-translate\s*=\s*["']([^"']+)["']/g)]
		.map(match => match[1].trim())
		.filter(Boolean);
}

function assertTranslationContract(relativePath) {
	const current = JSON.parse(read(relativePath));
	const upstream = JSON.parse(readUpstream(relativePath));
	const dataTranslateKeys = [...new Set(extractDataTranslateKeys())];
	const sections = ["titles", "innerHTML", "placeholders", "miscellaneous"];
	const allowedChanged = {
		titles: new Set(["add-your-camera", "remote-screenshare"]),
		innerHTML: new Set([
			"logo-header",
			"unlock-video-bitrate",
			"add-your-camera",
			"add-your-microphone",
			"remote-screenshare-obs",
			"info-blob"
		]),
		placeholders: new Set(),
		miscellaneous: new Set()
	};
	const expectedAddedInnerHTML = dataTranslateKeys
		.filter(key => !Object.prototype.hasOwnProperty.call(upstream.innerHTML || {}, key))
		.sort();

	for (const section of sections) {
		const currentKeys = objectKeys(current[section]);
		const upstreamKeys = objectKeys(upstream[section]);
		const removed = setDifference(upstreamKeys, currentKeys);
		assert(!removed.length, `${relativePath} removed upstream ${section} keys:\n${removed.join("\n")}`);

		const added = setDifference(currentKeys, upstreamKeys).sort();
		if (section === "innerHTML") {
			assert(
				JSON.stringify(added) === JSON.stringify(expectedAddedInnerHTML),
				`${relativePath} added unexpected innerHTML keys.\nexpected: ${expectedAddedInnerHTML.join(", ")}\nactual:   ${added.join(", ")}`
			);
		} else {
			assert(!added.length, `${relativePath} added unexpected ${section} keys:\n${added.join("\n")}`);
		}

		const changed = currentKeys
			.filter(key => Object.prototype.hasOwnProperty.call(upstream[section] || {}, key))
			.filter(key => JSON.stringify(current[section][key]) !== JSON.stringify(upstream[section][key]))
			.sort();
		const unexpectedChanged = changed.filter(key => !allowedChanged[section].has(key));
		assert(
			!unexpectedChanged.length,
			`${relativePath} changed unexpected ${section} keys:\n${unexpectedChanged.join("\n")}`
		);
	}
}

function assertForkContractDocumented() {
	const fork = read("FORK.md");
	for (const expected of [
		"Loop Cam Fork Contract",
		"loopVisibleHomeCards",
		"stale-native-vdo",
		"Optional Upstream Roots",
		"legacy/direct routes"
	]) {
		assert(fork.includes(expected), `FORK.md should document ${expected}`);
	}
}

function main() {
	git(["rev-parse", "--verify", upstreamRef], { stdio: ["ignore", "ignore", "pipe"] });

	const highRiskPaths = [
		"iframe-examples.js",
		"iframe.html",
		"index.html",
		"lib.js",
		"main.css",
		"main.js",
		"thirdparty/CodecsHandler.js",
		"webrtc.js"
	];
	const allowedHighRiskDiffs = new Set(["iframe.html", "index.html", "lib.js", "main.css", "main.js"]);
	const actualHighRiskDiffs = diffNames(highRiskPaths);
	const unexpectedHighRiskDiffs = actualHighRiskDiffs.filter(file => !allowedHighRiskDiffs.has(file));
	assert(
		!unexpectedHighRiskDiffs.length,
		`Unexpected high-risk runtime diffs from ${upstreamRef}:\n${unexpectedHighRiskDiffs.join("\n")}`
	);
	for (const file of ["iframe-examples.js", "thirdparty/CodecsHandler.js", "webrtc.js"]) {
		assertNoDiffFromUpstream(file);
	}

	const supportDiffs = diffNames([
		"thirdparty/StreamSaver.js",
		"thirdparty/StreamSaver_legacy.js",
		"thirdparty/mitm.html"
	]);
	assert(
		supportDiffs.every(file => file === "thirdparty/StreamSaver.js"),
		`Unexpected runtime-support diffs from ${upstreamRef}:\n${supportDiffs.join("\n")}`
	);

	assertTranslationContract("translations/en.json");
	assertTranslationContract("translations/blank.json");
	assertForkContractDocumented();

	console.log("Fork contract verified.");
	console.log(`Upstream ref: ${upstreamRef}`);
	console.log(`Allowed high-risk overlays: ${[...allowedHighRiskDiffs].sort().join(", ")}`);
	console.log("Translations preserve upstream keys and only apply explicit Loop overrides.");
}

main();
