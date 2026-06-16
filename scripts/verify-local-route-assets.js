#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const routes = [
	"/",
	"/speedtest.html",
	"/check.html",
	"/results.html?id=test",
	"/monitor.html?sid=test",
	"/iframe.html",
	"/?podcast",
	"/whip",
	"/comms.html",
	"/whiteboard.html",
	"/confirm.html?url=https%3A%2F%2Fexample.com"
];

const mimeTypes = {
	".css": "text/css",
	".gif": "image/gif",
	".html": "text/html",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript",
	".json": "application/json",
	".md": "text/markdown",
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

function resolveChromePath() {
	return [
		process.env.CHROME_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium"
	].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function mapRequestPath(urlPath) {
	const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
	if (!relative) {
		return "index.html";
	}
	if (!path.extname(relative)) {
		const htmlPath = `${relative}.html`;
		if (fs.existsSync(path.join(root, htmlPath))) {
			return htmlPath;
		}
	}
	return relative;
}

function createServer() {
	const server = http.createServer((request, response) => {
		const url = new URL(request.url, "http://localhost");
		const relativePath = mapRequestPath(url.pathname);
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
		const failures = [];

		for (const routePath of routes) {
			const missing = [];
			const onResponse = response => {
				const url = new URL(response.url());
				if (url.hostname === "127.0.0.1" && response.status() >= 400) {
					missing.push(`${response.status()} ${url.pathname}${url.search}`);
				}
			};

			page.on("response", onResponse);
			try {
				await page.goto(`http://127.0.0.1:${port}${routePath}`, {
					waitUntil: "domcontentloaded",
					timeout: 20000
				});
				await page.waitForTimeout(1500);
			} finally {
				page.off("response", onResponse);
			}

			if (missing.length) {
				failures.push(`${routePath}\n${[...new Set(missing)].join("\n")}`);
			}
		}

		if (failures.length) {
			throw new Error(`Local route assets missing:\n\n${failures.join("\n\n")}`);
		}

		console.log("Local route assets verified.");
		console.log(`Routes checked: ${routes.join(", ")}`);
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
