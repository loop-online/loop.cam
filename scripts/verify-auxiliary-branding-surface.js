#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(name, value, expected) {
	if (!value.includes(expected)) {
		throw new Error(`${name} should include ${expected}`);
	}
}

function assertExcludes(name, value, forbidden) {
	if (value.includes(forbidden)) {
		throw new Error(`${name} should not include ${forbidden}`);
	}
}

const speedtest = read("speedtest.html");
const results = read("results.html");
const check = read("check.html");
const monitor = read("monitor.html");
const comms = read("comms.html");
const whiteboard = read("whiteboard.html");
const whip = read("whip.html");
const confirm = read("confirm.html");
const readme = read("README.md");

assertIncludes("speedtest title", speedtest, "<title>Loop Cam Speed Test</title>");
assertIncludes("speedtest heading", speedtest, "Loop Cam video streaming quality test");
assertIncludes("speedtest support copy", speedtest, "contact your Loop production support channel");
assertExcludes("speedtest legacy title", speedtest, "VDON Speed Test");
assertExcludes("speedtest legacy upstream support link", speedtest, "discord.vdo.ninja");

assertIncludes("results title", results, "<title>Loop Cam Speed Test Results</title>");
assertIncludes("results heading", results, "Loop Cam video streaming quality test results");
assertExcludes("results legacy title", results, "VDON Speed Test");

assertIncludes("check title", check, "<title>Loop Cam Stream Test</title>");
assertIncludes("check heading", check, "Loop Cam video streaming quality check");
assertIncludes("check results link", check, 'new URL("./results.html", window.location.href)');
assertExcludes("check legacy title", check, "VDON Stream Test");
assertExcludes("check upstream results link", check, "vdo.ninja/alpha/results");

assertIncludes("monitor title", monitor, "<title>Loop Cam Monitoring</title>");
assertIncludes("monitor heading", monitor, "Loop Cam Remote Monitor");
assertExcludes("monitor legacy title", monitor, "VDO.Ninja Monitoring");
assertExcludes("monitor legacy heading", monitor, "VDO.Ninja Remote Monitor");

assertIncludes("comms title", comms, "<title>Loop Cam Comms</title>");
assertIncludes("comms powered by", comms, "Powered by Loop Cam");
assertExcludes("comms upstream support link", comms, "discord.vdo.ninja");
assertExcludes("comms upstream powered by", comms, "Powered by VDO.Ninja");

assertIncludes("whiteboard title", whiteboard, "<title>Loop Cam Whiteboard</title>");
assertIncludes("whiteboard og title", whiteboard, 'content="Loop Cam Whiteboard"');
assertExcludes("whiteboard upstream og title", whiteboard, 'content="VDO.Ninja Whiteboard"');

assertIncludes("whip title", whip, "<title>Loop Cam WHIP/WHEP Client</title>");
assertIncludes("whip support copy", whip, "For Loop Cam support");
assertExcludes("whip upstream support link", whip, "discord.vdo.ninja");

assertIncludes("confirm title", confirm, "<title>Loop Cam External Link Confirmation</title>");
assertIncludes("confirm meta title", confirm, 'content="Loop Cam"');
assertIncludes("confirm source link", confirm, "https://github.com/Loop-Online/loop.cam");
assertExcludes("confirm upstream title", confirm, "<title>VDO.Ninja</title>");

assertIncludes("readme fork contract", readme, "See `FORK.md`");
assertExcludes("readme old joke copy", readme, "Tee hee");

console.log("Auxiliary Loop branding surface verified.");
