#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const mimeTypes = {
	".css": "text/css",
	".html": "text/html",
	".js": "text/javascript",
	".json": "application/json",
	".woff": "font/woff",
	".woff2": "font/woff2"
};

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
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
		const relativePath = pathname === "/" ? "results.html" : pathname.replace(/^\/+/, "");
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
	let capturedRequestUrl = null;
	try {
		browser = await chromium.launch(launchOptions);
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		await context.route("https://record.vdo.workers.dev/**", async route => {
			capturedRequestUrl = route.request().url();
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([
					{
						bitrate: 2500,
						target: 2500,
						buffer: 80,
						packetloss: 0.01,
						resolution: "1920 x 1080<script>",
						QLR: "none",
						info: {
							Browser: 'Chromium<img src=x onerror="window.__xss = true">',
							platform: 'MacIntel<svg onload="window.__xss = true">',
							gpGPU: "GPU <b>name</b>",
							CPU: "CPU <script>bad()</script>",
							conn_type: "wifi"
						},
						encoder: "vp9<img src=x>"
					}
				])
			});
		});

		const page = await context.newPage();
		const id = 'room&evil=<img src=x onerror="window.__idXss=true">';
		await page.goto(`http://127.0.0.1:${port}/results.html?id=${encodeURIComponent(id)}`, {
			waitUntil: "domcontentloaded",
			timeout: 30000
		});
		await page.waitForFunction(() => document.getElementById("details").textContent.includes("Browser used"), null, { timeout: 10000 });

		assert(capturedRequestUrl, "results request was not made");
		const captured = new URL(capturedRequestUrl);
		assert(captured.searchParams.get("name") === id, "results id was not preserved as a single encoded name parameter");
		assert(captured.searchParams.get("evil") === null, "results id leaked into a separate query parameter");

		const state = await page.evaluate(() => ({
			xss: !!window.__xss || !!window.__idXss,
			detailHtml: document.getElementById("details").innerHTML,
			detailText: document.getElementById("details").textContent,
			injectedImages: document.querySelectorAll("#details img, #details svg, #details script").length,
			graphLabelHtml: document.querySelector("#bitrate-graph").previousElementSibling.innerHTML
		}));

		assert(!state.xss, "malicious result markup executed");
		assert(state.injectedImages === 0, "malicious result markup created DOM nodes");
		assert(state.detailText.includes('Chromium<img src=x onerror="window.__xss = true">'), "browser result was not rendered as text");
		assert(state.detailHtml.includes("&lt;img"), "browser result was not HTML-escaped");
		assert(state.detailHtml.includes("&lt;script&gt;"), "CPU result was not HTML-escaped");
		assert(state.graphLabelHtml === "2500", "graph label should be written as text content");

		await context.close();
		console.log("Results page security verified.");
		console.log("Remote result fields are escaped and result ids are encoded.");
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
