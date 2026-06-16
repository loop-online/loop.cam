#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expected = {
	title: "Loop Cam",
	metaTitle: "Loop Cam",
	ogSiteName: "Loop Cam",
	ogTitle: "Loop Cam",
	ogUrl: "https://loop.cam/",
	twitterTitle: "Loop Cam",
	twitterUrl: "https://loop.cam/",
	manifestName: "Loop Cam",
	iframeTitle: "Loop Cam Iframe API",
	iframePlaceholder: "e.g., https://loop.cam/?view=teststream or just 'loop.cam/?room=myroom'"
};

const mimeTypes = {
	".css": "text/css",
	".gif": "image/gif",
	".html": "text/html",
	".ico": "image/x-icon",
	".js": "text/javascript",
	".json": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".wasm": "application/wasm",
	".webm": "video/webm",
	".woff": "font/woff",
	".woff2": "font/woff2"
};

function assertEqual(name, actual, wanted) {
	if (actual !== wanted) {
		throw new Error(`${name} mismatch\nexpected: ${wanted}\nactual:   ${actual}`);
	}
}

function assertNoVisibleUpstreamBrand(name, value) {
	if (/vdo\.ninja|obs\.ninja|VDO\.Ninja|OBS\.Ninja/i.test(value || "")) {
		throw new Error(`${name} exposes upstream brand: ${value}`);
	}
}

function assertIncludes(name, value, expected) {
	if (!value.includes(expected)) {
		throw new Error(`${name} should include ${expected}: ${value}`);
	}
}

function resolveChromePath() {
	return [
		process.env.CHROME_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium"
	].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function createServer() {
	const server = http.createServer((request, response) => {
		const url = new URL(request.url, "http://localhost");
		const pathname = decodeURIComponent(url.pathname);
		const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
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

async function main() {
	let chromium;
	try {
		({ chromium } = require("playwright"));
	} catch (error) {
		throw new Error("Playwright is required. Install it or run with a Codex runtime that provides it.");
	}

	const server = await createServer();
	const port = server.address().port;
	const executablePath = resolveChromePath();
	const launchOptions = { headless: true };
	if (executablePath) {
		launchOptions.executablePath = executablePath;
	}

	let browser;
	try {
		browser = await chromium.launch(launchOptions);
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));

		await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
		await page.waitForSelector("#logoname", { state: "attached", timeout: 30000 });

		const actual = await page.evaluate(() => {
			const attr = selector => document.querySelector(selector)?.getAttribute("content") || "";
			const visibleCardText = Array.from(document.querySelectorAll("div.column.card"))
				.filter(element => !element.classList.contains("hidden") && getComputedStyle(element).display !== "none")
				.map(element => element.textContent.replace(/\s+/g, " ").trim())
				.join(" | ");

			return {
				title: document.title,
				metaTitle: attr('meta[name="title"]'),
				ogSiteName: attr('meta[property="og:site_name"]'),
				ogTitle: attr('meta[property="og:title"]'),
				ogUrl: attr('meta[property="og:url"]'),
				twitterTitle: attr('meta[property="twitter:title"]'),
				twitterUrl: attr('meta[property="twitter:url"]'),
				manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "",
				helpAction: document.querySelector("#helpbutton")?.getAttribute("onclick") || "",
				header: document.querySelector("#logoname")?.textContent.replace(/\s+/g, " ").trim() || "",
				logoSrc: document.querySelector("#logo")?.getAttribute("src") || "",
				logoLoaded: Boolean(document.querySelector("#logo")?.complete && document.querySelector("#logo")?.naturalWidth),
				visibleCardText
			};
		});

		assertEqual("document title", actual.title, expected.title);
		assertEqual("meta title", actual.metaTitle, expected.metaTitle);
		assertEqual("og site name", actual.ogSiteName, expected.ogSiteName);
		assertEqual("og title", actual.ogTitle, expected.ogTitle);
		assertEqual("og url", actual.ogUrl, expected.ogUrl);
		assertEqual("twitter title", actual.twitterTitle, expected.twitterTitle);
		assertEqual("twitter url", actual.twitterUrl, expected.twitterUrl);
		assertEqual("manifest href", actual.manifestHref, "manifest.json");
		assertEqual("logo source", actual.logoSrc, "./media/loop_logo.png");
		assertEqual("logo loaded", actual.logoLoaded, true);
		assertIncludes("help action", actual.helpAction, "For Loop Cam support");
		assertNoVisibleUpstreamBrand("help community support", actual.helpAction.replace(/VDO\.Ninja docs/g, "upstream technical docs").replace(/https:\/\/docs\.vdo\.ninja/g, "upstream technical docs"));
		assertNoVisibleUpstreamBrand("header", actual.header);
		assertNoVisibleUpstreamBrand("visible cards", actual.visibleCardText);
		assertIncludes("visible cards", actual.visibleCardText, "Share Camera");
		assertIncludes("visible cards", actual.visibleCardText, "Share Screen");
		assertIncludes("visible cards", actual.visibleCardText, "Create a Room");

		const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
		assertEqual("manifest name", manifest.name, expected.manifestName);
		assertEqual("manifest short name", manifest.short_name, expected.manifestName);
		assertNoVisibleUpstreamBrand("manifest name", manifest.name);
		assertNoVisibleUpstreamBrand("manifest description", manifest.description);

			await page.goto(`http://127.0.0.1:${port}/iframe.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
			assertEqual("iframe document title", await page.title(), expected.iframeTitle);
			const iframePlaceholder = await page.$eval("#viewlink", element => element.getAttribute("placeholder") || "");
			const iframeVisibleText = await page.$eval("body", element => element.textContent.replace(/\s+/g, " ").trim());
			assertEqual("iframe view link placeholder", iframePlaceholder, expected.iframePlaceholder);
			assertNoVisibleUpstreamBrand("iframe document title", await page.title());
			assertNoVisibleUpstreamBrand("iframe view link placeholder", iframePlaceholder);
			assertNoVisibleUpstreamBrand("iframe visible text", iframeVisibleText.replace(/VDO\.Ninja technical docs/g, "upstream technical docs"));
			if (/Discord Community|discord\.vdo\.ninja/i.test(iframeVisibleText)) {
				throw new Error(`iframe visible text exposes upstream community support: ${iframeVisibleText}`);
			}

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Loop branding surface verified.");
		console.log(`Title: ${actual.title}`);
		console.log(`Header: ${actual.header}`);
		console.log(`Visible cards: ${actual.visibleCardText}`);
	} finally {
		if (browser) {
			await browser.close();
		}
		server.close();
	}
}

main().catch(error => {
	console.error(error.message);
	process.exit(1);
});
