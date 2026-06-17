#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlCache = new Map();

function readHtml(page) {
	if (!htmlCache.has(page)) {
		htmlCache.set(page, fs.readFileSync(path.join(root, page), "utf8"));
	}
	return htmlCache.get(page);
}

const indexHtml = readHtml("index.html");
const map = JSON.parse(fs.readFileSync(path.join(__dirname, "loop-icon-line-map.json"), "utf8"));

const requiredFiles = [
	"loop-tokens.css",
	"loop-ui.css",
	"loop-icons.css",
	"loop-icons.js",
	"loop-icon-glyphs.js",
	"loop-icon-line-map.js",
	"docs/LOOP_ICONS.md",
	"scripts/loop-icon-line-map.json",
	"scripts/build-loop-icon-glyphs.js",
	"scripts/dev-server.py"
];

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function extractUsedIcons() {
	const targets = [
		"index.html",
		"lib.js",
		"main.js",
		"room.html",
		"whip.html",
		"electron.html",
		"speedtest.html",
		"check.html",
		"devices.html",
		"results.html",
		"supports.html",
		"translations/en.json"
	];
	const used = new Set();
	const pattern = /\bla-([a-z0-9-]+)\b/g;
	for (const file of targets) {
		const source = fs.readFileSync(path.join(root, file), "utf8");
		let match;
		while ((match = pattern.exec(source)) !== null) {
			used.add(match[1]);
		}
	}
	return used;
}

function resolveChromePath() {
	return [
		process.env.CHROME_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium"
	].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function createServer() {
	const mimeTypes = {
		".css": "text/css",
		".html": "text/html",
		".js": "text/javascript"
	};
	const server = http.createServer((request, response) => {
		const url = new URL(request.url, "http://localhost");
		const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
		const filePath = path.resolve(root, relativePath);
		if (!filePath.startsWith(root)) {
			response.writeHead(403);
			response.end("Forbidden");
			return;
		}
		fs.readFile(filePath, (error, data) => {
			if (error) {
				response.writeHead(404);
				response.end("Not found");
				return;
			}
			response.writeHead(200, {
				"Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
			});
			response.end(data);
		});
	});
	return new Promise(resolve => {
		server.listen(0, "127.0.0.1", () => resolve(server));
	});
}

requiredFiles.forEach(file => {
	assert(fs.existsSync(path.join(root, file)), `Missing Loop icon file: ${file}`);
});

assert(indexHtml.includes("loop-icons.css"), "index.html must link loop-icons.css");
assert(indexHtml.includes("loop-icon-glyphs.js"), "index.html must load loop-icon-glyphs.js");
assert(indexHtml.includes("loop-icon-line-map.js"), "index.html must load loop-icon-line-map.js");
assert(indexHtml.includes("loop-icons.js"), "index.html must load loop-icons.js");

const uiHtmlPages = ["index.html", "room.html"];
uiHtmlPages.forEach(page => {
	const source = readHtml(page);
	assert(source.includes("loop-tokens.css"), `${page} must link loop-tokens.css`);
	assert(source.includes("loop-ui.css"), `${page} must link loop-ui.css`);
});

function assetVersionsFromHtml(source, assets) {
	const versions = {};
	for (const [key, basename] of Object.entries(assets)) {
		const match = source.match(new RegExp(`${basename.replace(".", "\\.")}\\?ver=(\\d+)`));
		versions[key] = match ? match[1] : null;
	}
	return versions;
}

function assertUniformCacheVersions(pages, assets, label) {
	const versionSets = pages.map(page => {
		const source = readHtml(page);
		const versions = assetVersionsFromHtml(source, assets);
		for (const [key, basename] of Object.entries(assets)) {
			assert(versions[key], `${page} must link ${basename} with ?ver=`);
		}
		return { page, ...versions };
	});
	const keys = Object.keys(assets);
	for (const key of keys) {
		const values = new Set(versionSets.map(entry => entry[key]));
		assert(values.size === 1, `${label} ${assets[key]} cache versions must match: ${JSON.stringify(versionSets)}`);
	}
	const summary = keys.map(key => `${key}=${[...new Set(versionSets.map(entry => entry[key]))][0]}`).join(" ");
	console.log(`${label} cache version: ${summary} (${pages.length} pages)`);
}

assertUniformCacheVersions(uiHtmlPages, { tokens: "loop-tokens.css", ui: "loop-ui.css" }, "loop-ui");

const glyphsSource = fs.readFileSync(path.join(root, "loop-icon-glyphs.js"), "utf8");
assert(glyphsSource.includes("LoopIconOptical"), "loop-icon-glyphs.js must export LoopIconOptical");

const used = extractUsedIcons();
const unmapped = [...used].filter(name => !map[name]).sort();
if (unmapped.length) {
	throw new Error(`Unmapped Line Awesome icons on promoted surfaces: ${unmapped.join(", ")}`);
}

eval(glyphsSource);
const glyphs = globalThis.LoopIconGlyphs;
assert(glyphs && typeof glyphs === "object", "loop-icon-glyphs.js must define LoopIconGlyphs");
const glyphless = [...new Set([...used].map(name => map[name]))].filter(lucide => !glyphs[lucide]).sort();
if (glyphless.length) {
	throw new Error(`Mapped icons missing a Lucide glyph (runtime upgrade would no-op): ${glyphless.join(", ")}`);
}
console.log(`Verified Lucide glyph presence for ${used.size} used Line Awesome hooks (incl. JS-injected).`);

const wiredHtmlPages = [
	"index.html",
	"room.html",
	"check.html",
	"devices.html",
	"electron.html",
	"results.html",
	"speedtest.html",
	"supports.html",
	"whip.html"
];

assertUniformCacheVersions(
	wiredHtmlPages,
	{ css: "loop-icons.css", js: "loop-icons.js" },
	"loop-icons"
);

async function verifyBrowser() {
	let chromium;
	try {
		({ chromium } = require("playwright"));
	} catch (error) {
		console.log("Playwright unavailable; static Lucide icon checks passed.");
		return;
	}

	const server = await createServer();
	const port = server.address().port;
	const launchOptions = { headless: true };
	const executablePath = resolveChromePath();
	if (executablePath) {
		launchOptions.executablePath = executablePath;
	}

	let browser;
	try {
		browser = await chromium.launch(launchOptions);
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load", timeout: 30000 });
		await page.waitForFunction(() => window.LoopIcons && window.LoopIcons.ready === true, { timeout: 10000 });

		const engine = await page.evaluate(() => window.LoopIcons.engine);
		assert(engine === "lucide", `LoopIcons engine should be lucide, got: ${engine}`);

		const upgraded = await page.evaluate(() => {
			const icon = document.getElementById("mutetoggle");
			return {
				upgraded: icon && icon.classList.contains("loop-icon-upgraded"),
				hasSvg: !!(icon && icon.querySelector("svg.loop-icon-svg")),
				ariaHidden: icon && icon.getAttribute("aria-hidden") === "true"
			};
		});
		assert(upgraded.upgraded, "mutetoggle should upgrade to Lucide");
		assert(upgraded.hasSvg, "mutetoggle should contain Lucide SVG");
		assert(upgraded.ariaHidden, "mutetoggle should be aria-hidden when parent is labeled");

		const homeCardIcon = await page.$eval("#container-1 .loop-home-card-icon svg", el => !!el);
		assert(homeCardIcon, "home card should render Lucide icon");
	} finally {
		if (browser) {
			await browser.close();
		}
		server.close();
	}
}

verifyBrowser()
	.then(() => {
		console.log("Loop icon system verified (Lucide).");
		console.log(`Mapped promoted-surface icons: ${used.size}`);
	})
	.catch(error => {
		console.error(error.message);
		process.exit(1);
	});
