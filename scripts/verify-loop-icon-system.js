#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const map = JSON.parse(fs.readFileSync(path.join(__dirname, "loop-icon-line-map.json"), "utf8"));

const requiredFiles = [
	"loop-icons.css",
	"loop-icons.js",
	"loop-icon-glyphs.js",
	"loop-icon-line-map.js",
	"docs/LOOP_ICONS.md",
	"scripts/loop-icon-line-map.json",
	"scripts/build-loop-icon-glyphs.js"
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

const glyphsSource = fs.readFileSync(path.join(root, "loop-icon-glyphs.js"), "utf8");
assert(glyphsSource.includes("LoopIconOptical"), "loop-icon-glyphs.js must export LoopIconOptical");

const used = extractUsedIcons();
const unmapped = [...used].filter(name => !map[name]).sort();
if (unmapped.length) {
	throw new Error(`Unmapped Line Awesome icons on promoted surfaces: ${unmapped.join(", ")}`);
}

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

function loopIconVersionsFromHtml(source) {
	const cssMatch = source.match(/loop-icons\.css\?ver=(\d+)/);
	const jsMatch = source.match(/loop-icons\.js\?ver=(\d+)/);
	return {
		css: cssMatch ? cssMatch[1] : null,
		js: jsMatch ? jsMatch[1] : null
	};
}

const versionSets = wiredHtmlPages.map(page => {
	const source = fs.readFileSync(path.join(root, page), "utf8");
	const versions = loopIconVersionsFromHtml(source);
	assert(versions.css && versions.js, `${page} must link loop-icons.css and loop-icons.js with ?ver=`);
	return { page, ...versions };
});

const cssVersions = new Set(versionSets.map(entry => entry.css));
const jsVersions = new Set(versionSets.map(entry => entry.js));
assert(cssVersions.size === 1, `loop-icons.css cache versions must match across wired pages: ${JSON.stringify(versionSets)}`);
assert(jsVersions.size === 1, `loop-icons.js cache versions must match across wired pages: ${JSON.stringify(versionSets)}`);
console.log(`loop-icons cache version: css=${[...cssVersions][0]} js=${[...jsVersions][0]} (${wiredHtmlPages.length} pages)`);

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
		await page.waitForTimeout(300);

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
