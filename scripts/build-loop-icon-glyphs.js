#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mapPath = path.join(__dirname, "loop-icon-line-map.json");
const glyphsOutPath = path.join(root, "loop-icon-glyphs.js");
const mapOutPath = path.join(root, "loop-icon-line-map.js");

const TARGET_MIN_DIM = 18;
const TOGGLE_TARGET_MIN_DIM = 18;
const MIN_TOGGLE_SCALE = 0.85;
const MAX_SCALE = 1.75;
const MAX_PAIR_SCALE = 1.35;
const VIEWBOX_SIZE = 24;
const VIEWBOX_CENTER = VIEWBOX_SIZE / 2;

const OPTICAL_PAIRS = [
	["Mic", "MicOff"],
	["Webcam", "VideoOff"],
	["Video", "VideoOff"],
	["Phone", "PhoneOff"],
	["Volume", "Volume2", "VolumeX"],
	["Minimize2", "Maximize2"],
	["Eye", "EyeOff"],
	["Bell", "BellOff"]
];

const OPTICAL_OVERRIDES = {
	Volume: { scale: 1.2 },
	Settings: { scale: 1.0 },
	ChevronDown: { scale: 1.0 },
	ChevronRight: { scale: 1.0 },
	ChevronLeft: { scale: 1.0 },
	ChevronUp: { scale: 1.0 },
	Monitor: { toggleScale: 1.33, pairScale: 1.33 },
	Phone: { scale: 1.12, pairScale: 1.22, toggleScale: 1.22 }
};

let lucide;
try {
	lucide = require("lucide");
} catch (error) {
	console.error("lucide is required. Run: npm install lucide");
	process.exit(1);
}

function pathBounds(pathData) {
	const tokens = pathData.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
	let index = 0;
	let command = "";
	let x = 0;
	let y = 0;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	function add(px, py) {
		minX = Math.min(minX, px);
		maxX = Math.max(maxX, px);
		minY = Math.min(minY, py);
		maxY = Math.max(maxY, py);
	}

	function readNumber() {
		return parseFloat(tokens[index++]);
	}

	while (index < tokens.length) {
		const token = tokens[index];
		if (/[a-zA-Z]/.test(token)) {
			command = token;
			index += 1;
		} else if (!command) {
			index += 1;
			continue;
		}

		switch (command) {
			case "M":
				x = readNumber();
				y = readNumber();
				add(x, y);
				command = "L";
				break;
			case "L":
				x = readNumber();
				y = readNumber();
				add(x, y);
				break;
			case "H":
				x = readNumber();
				add(x, y);
				break;
			case "V":
				y = readNumber();
				add(x, y);
				break;
			case "Z":
			case "z":
				break;
			case "C": {
				const x1 = readNumber();
				const y1 = readNumber();
				const x2 = readNumber();
				const y2 = readNumber();
				const x3 = readNumber();
				const y3 = readNumber();
				add(x1, y1);
				add(x2, y2);
				x = x3;
				y = y3;
				add(x, y);
				break;
			}
			case "c": {
				const x1 = x + readNumber();
				const y1 = y + readNumber();
				const x2 = x + readNumber();
				const y2 = y + readNumber();
				const x3 = x + readNumber();
				const y3 = y + readNumber();
				add(x1, y1);
				add(x2, y2);
				x = x3;
				y = y3;
				add(x, y);
				break;
			}
			case "a":
				index += 7;
				break;
			default:
				index += 1;
		}
	}

	return { minX, maxX, minY, maxY };
}

function iconBounds(nodes) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const [tag, attrs] of nodes) {
		if (attrs.d) {
			const bounds = pathBounds(attrs.d);
			minX = Math.min(minX, bounds.minX);
			maxX = Math.max(maxX, bounds.maxX);
			minY = Math.min(minY, bounds.minY);
			maxY = Math.max(maxY, bounds.maxY);
		}
		if (attrs.x1 !== undefined) {
			minX = Math.min(minX, +attrs.x1, +attrs.x2);
			maxX = Math.max(maxX, +attrs.x1, +attrs.x2);
			minY = Math.min(minY, +attrs.y1, +attrs.y2);
			maxY = Math.max(maxY, +attrs.y1, +attrs.y2);
		}
		if (attrs.cx !== undefined) {
			minX = Math.min(minX, +attrs.cx - +attrs.r);
			maxX = Math.max(maxX, +attrs.cx + +attrs.r);
			minY = Math.min(minY, +attrs.cy - +attrs.r);
			maxY = Math.max(maxY, +attrs.cy + +attrs.r);
		}
		if (attrs.x !== undefined && attrs.width !== undefined) {
			minX = Math.min(minX, +attrs.x);
			maxX = Math.max(maxX, +attrs.x + +attrs.width);
			minY = Math.min(minY, +attrs.y);
			maxY = Math.max(maxY, +attrs.y + +attrs.height);
		}
	}

	const width = maxX - minX;
	const height = maxY - minY;
	return {
		minX,
		maxX,
		minY,
		maxY,
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		fill: (width * height) / (VIEWBOX_SIZE * VIEWBOX_SIZE)
	};
}

function computeOptical(nodes) {
	const bounds = iconBounds(nodes);
	const width = bounds.maxX - bounds.minX;
	const height = bounds.maxY - bounds.minY;
	const minDim = Math.min(width, height);
	const scale = Math.min(MAX_SCALE, TARGET_MIN_DIM / Math.max(minDim, 0.01));
	const toggleScale = Math.min(
		MAX_PAIR_SCALE,
		Math.max(MIN_TOGGLE_SCALE, TOGGLE_TARGET_MIN_DIM / Math.max(minDim, 0.01))
	);
	return {
		scale: +scale.toFixed(3),
		cx: +bounds.cx.toFixed(3),
		cy: +bounds.cy.toFixed(3),
		toggleScale: +toggleScale.toFixed(3)
	};
}

function unifyPairScales(optical) {
	for (const group of OPTICAL_PAIRS) {
		const pairScale = Math.max(...group.map(name => optical[name]?.scale || 1));
		const toggleScale = Math.max(...group.map(name => optical[name]?.toggleScale || 1));
		for (const name of group) {
			if (!optical[name]) {
				continue;
			}
			optical[name].pairScale = +Math.min(MAX_PAIR_SCALE, pairScale).toFixed(3);
			optical[name].toggleScale = +Math.min(MAX_PAIR_SCALE, toggleScale).toFixed(3);
		}
	}

	for (const name of Object.keys(optical)) {
		if (optical[name].pairScale === undefined) {
			optical[name].pairScale = optical[name].scale;
		}
		if (optical[name].toggleScale === undefined) {
			optical[name].toggleScale = optical[name].scale;
		}
	}
}

const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const lucideNames = [...new Set(Object.values(map))].sort();
const glyphs = {};
const optical = {};
const missing = [];

for (const name of lucideNames) {
	if (!lucide[name]) {
		missing.push(name);
		continue;
	}
	glyphs[name] = lucide[name];
	optical[name] = computeOptical(lucide[name]);
}

if (missing.length) {
	console.error("Missing Lucide exports:", missing.join(", "));
	process.exit(1);
}

unifyPairScales(optical);

for (const [name, override] of Object.entries(OPTICAL_OVERRIDES)) {
	if (optical[name]) {
		optical[name] = { ...optical[name], ...override };
	}
}

const banner = "/* Generated by scripts/build-loop-icon-glyphs.js — do not edit by hand. */\n";
const glyphsBody = `(function (global) {\n\tglobal.LoopIconGlyphs = ${JSON.stringify(glyphs)};\n\tglobal.LoopIconOptical = ${JSON.stringify(optical)};\n})(typeof window !== "undefined" ? window : globalThis);\n`;
const mapBody = `(function (global) {\n\tglobal.LoopIconLineMap = ${JSON.stringify(map)};\n})(typeof window !== "undefined" ? window : globalThis);\n`;

fs.writeFileSync(glyphsOutPath, banner + glyphsBody);
fs.writeFileSync(mapOutPath, banner + mapBody);
console.log(`Wrote ${lucideNames.length} Lucide glyphs to loop-icon-glyphs.js`);
console.log(`Wrote optical metadata for ${Object.keys(optical).length} icons`);
console.log(`Wrote ${Object.keys(map).length} Line Awesome mappings to loop-icon-line-map.js`);
