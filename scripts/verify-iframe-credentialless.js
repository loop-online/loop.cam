#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const mimeTypes = {
	".css": "text/css",
	".gif": "image/gif",
	".html": "text/html",
	".ico": "image/x-icon",
	".js": "text/javascript",
	".json": "application/json",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".wasm": "application/wasm",
	".wav": "audio/wav",
	".webm": "video/webm",
	".woff": "font/woff",
	".woff2": "font/woff2"
};

function assertEqual(name, actual, expected) {
	if (actual !== expected) {
		throw new Error(`${name} mismatch\nexpected: ${expected}\nactual:   ${actual}`);
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

async function inspectIframe(page, port) {
	await page.goto(`http://127.0.0.1:${port}/iframe.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
	await page.waitForSelector("#viewlink", { timeout: 30000 });
	await page.fill("#viewlink", `http://127.0.0.1:${port}/?view=loopiframeverify`);
	await page.check("#cleanoutput");
	await page.check("#transparent");
	await page.check("#hidemenu");
	await page.evaluate(() => window.loadIframe());
	await page.waitForSelector("#container .iframe-example iframe", { timeout: 30000 });

	return page.$eval("#container .iframe-example iframe", iframe => ({
		allow: iframe.getAttribute("allow") || "",
		crossorigin: iframe.getAttribute("crossorigin"),
		credentialless: iframe.getAttribute("credentialless"),
		src: iframe.getAttribute("src") || "",
		shouldUseCredentialless: window.shouldUseCredentiallessIframe(),
		supportsCredentialless: window.supportsCredentiallessIframe(),
		isFirefoxFamily: window.isFirefoxFamilyBrowser()
	}));
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

		const chromiumContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		const chromiumPage = await chromiumContext.newPage();
		const chromiumResult = await inspectIframe(chromiumPage, port);
		assertEqual("chromium firefox family", chromiumResult.isFirefoxFamily, false);
		if (chromiumResult.supportsCredentialless) {
			assertEqual("chromium should use credentialless", chromiumResult.shouldUseCredentialless, true);
			assertEqual("chromium crossorigin", chromiumResult.crossorigin, "anonymous");
			assertEqual("chromium credentialless", chromiumResult.credentialless, "true");
			if (!chromiumResult.allow.includes("cross-origin-isolated")) {
				throw new Error("chromium allow permissions should include cross-origin-isolated");
			}
		}
		await chromiumContext.close();

		const firefoxUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0";
		const firefoxContext = await browser.newContext({ userAgent: firefoxUA, viewport: { width: 1280, height: 900 } });
		const firefoxPage = await firefoxContext.newPage();
		const firefoxResult = await inspectIframe(firefoxPage, port);
		assertEqual("firefox family", firefoxResult.isFirefoxFamily, true);
		assertEqual("firefox should use credentialless", firefoxResult.shouldUseCredentialless, false);
		assertEqual("firefox crossorigin", firefoxResult.crossorigin, null);
		assertEqual("firefox credentialless", firefoxResult.credentialless, null);
		if (firefoxResult.allow.includes("cross-origin-isolated")) {
			throw new Error("firefox allow permissions should not include cross-origin-isolated");
		}
		await firefoxContext.close();

		if (!firefoxResult.src.includes("cleanoutput") || !firefoxResult.src.includes("transparent") || !firefoxResult.src.includes("hidemenu")) {
			throw new Error(`iframe src should include clean output params: ${firefoxResult.src}`);
		}

		console.log("Iframe credentialless behavior verified.");
		console.log(`Chromium credentialless support: ${chromiumResult.supportsCredentialless}`);
		console.log("Firefox-family user agents omit credentialless iframe attributes.");
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
