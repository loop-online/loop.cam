#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const start = indexHtml.indexOf('id="bufferSettings"');
const end = indexHtml.indexOf('id="publishSettings"', start);

assert(start !== -1, "buffer settings modal not found");
assert(end !== -1, "buffer settings modal boundary not found");

const bufferSettings = indexHtml.slice(start, end);
const bufferTitle = "Local to this browser and selected remote stream. Normal WebRTC buffering is browser-limited; chunked mode uses a separate buffer.";

assert(bufferSettings.includes(`data-translate="change-playout-buffer" title="${bufferTitle}"`), "buffer label is missing the local/chunked-mode tooltip");
assert(bufferSettings.includes(`type='number' min='0' max='180000'`), "buffer number input does not allow 180000 ms");
assert(bufferSettings.includes(`type='range' min='0' max='180000' data-buffer-value='0' title="${bufferTitle}"`), "buffer range input does not allow 180000 ms");
assert(!bufferSettings.includes("max='10000'"), "buffer range input still has the old 10000 ms ceiling");
assert(!bufferSettings.includes("max='120000'"), "buffer number input still has the old 120000 ms ceiling");

console.log("Buffer settings UI verified.");
