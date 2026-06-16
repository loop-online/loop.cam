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

function assertClose(name, actual, expected, tolerance = 0.003) {
	if (Math.abs(actual - expected) > tolerance) {
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
		await page.waitForFunction(() => window.session && typeof window.handleVideoAspectRatioResize === "function", null, { timeout: 30000 });

		const state = await page.evaluate(async () => {
			const calls = [];
			window.pokeIframeAPI = function (action, value, uuid, sid) {
				calls.push({ action, value, uuid, sid });
			};
			window.updateMixer = function () {
				calls.push({ action: "updateMixer" });
			};
			window.session.screenShareState = false;
			window.session.screenShareElement = null;
			window.session.viewChroma = false;
			window.session.director = false;

			const video = document.createElement("video");
			video.id = "screensharesource";
			video.dataset.UUID = "guest_screen";
			video.dataset.sid = "guest:s";
			document.body.appendChild(video);

			function setDimensions(width, height) {
				Object.defineProperty(video, "videoWidth", { configurable: true, value: width });
				Object.defineProperty(video, "videoHeight", { configurable: true, value: height });
			}

			setDimensions(1920, 1080);
			window.handleVideoAspectRatioResize(video, "guest_screen", false);
			const firstAspectRatio = parseFloat(video.dataset.aspectRatio);
			const firstStable = window.getStableScreenShareVideoDimensions(video);

			setDimensions(1280, 960);
			window.handleVideoAspectRatioResize(video, "guest_screen", false);
			const pendingAspectRatio = parseFloat(video.dataset.aspectRatio);
			const pendingStable = window.getStableScreenShareVideoDimensions(video);
			const pending = video.screenShareResizePending === true;

			await new Promise(resolve => setTimeout(resolve, window.screenShareResizeStabilizeDelay + 60));
			const settledAspectRatio = parseFloat(video.dataset.aspectRatio);
			const settledStable = window.getStableScreenShareVideoDimensions(video);
			const settled = video.screenShareResizePending === false;

			video.remove();
			return {
				firstAspectRatio,
				firstStable,
				pendingAspectRatio,
				pendingStable,
				pending,
				settledAspectRatio,
				settledStable,
				settled,
				aspectRatioMessages: calls.filter(call => call.action === "aspect-ratio").map(call => parseFloat(call.value))
			};
		});

		assertClose("first aspect ratio", state.firstAspectRatio, 16 / 9);
		assertEqual("first stable dimensions", state.firstStable, null);
		assertClose("pending aspect ratio remains stable", state.pendingAspectRatio, 16 / 9);
		assertEqual("pending state", state.pending, true);
		assertClose("pending stable width", state.pendingStable.width, 16 / 9);
		assertEqual("pending stable height", state.pendingStable.height, 1);
		assertClose("settled aspect ratio", state.settledAspectRatio, 4 / 3);
		assertEqual("settled state", state.settled, true);
		assertEqual("settled stable dimensions", state.settledStable, null);
		assertEqual("aspect-ratio message count", state.aspectRatioMessages.length, 2);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Screen-share aspect-ratio stabilization verified.");
		console.log(`Aspect ratios: ${state.aspectRatioMessages.join(", ")}`);
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
