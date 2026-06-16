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

async function main() {
	let chromium;
	try {
		({ chromium } = require("playwright"));
	} catch (error) {
		throw new Error("Playwright is required. Install it or run with a Codex runtime that provides it.");
	}

	const server = await createServer();
	const port = server.address().port;
	const origin = `http://127.0.0.1:${port}`;
	const executablePath = resolveChromePath();
	const launchOptions = {
		headless: true,
		args: [
			"--autoplay-policy=no-user-gesture-required",
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream"
		]
	};
	if (executablePath) {
		launchOptions.executablePath = executablePath;
	}

	let browser;
	try {
		browser = await chromium.launch(launchOptions);
		const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		await context.grantPermissions(["camera", "microphone"], { origin });
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", error => errors.push(error.message));

		await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30000 });
		await page.waitForSelector("#gowebcam", { state: "attached", timeout: 30000 });
		await page.click("#container-3");
		await page.waitForFunction(() => {
			const button = document.querySelector("#gowebcam");
			const preview = document.querySelector("#previewWebcam");
			const stream = window.session && window.session.streamSrc;
			return button &&
				button.dataset.ready === "true" &&
				button.dataset.audioready === "true" &&
				button.disabled === false &&
				preview &&
				preview.srcObject &&
				stream &&
				stream.getVideoTracks().some(track => track.readyState === "live") &&
				stream.getAudioTracks().some(track => track.readyState === "live");
		}, null, { timeout: 30000 });

		const previewState = await page.evaluate(() => {
			const stream = window.session.streamSrc;
			return {
				buttonText: document.querySelector("#gowebcam")?.textContent.replace(/\s+/g, " ").trim() || "",
				videoTracks: stream.getVideoTracks().map(track => track.readyState),
				audioTracks: stream.getAudioTracks().map(track => track.readyState),
				previewHasStream: !!document.querySelector("#previewWebcam").srcObject
			};
		});

		await page.evaluate(() => {
			window.__loopPostPublishCalled = false;
			window.__loopOriginalPostPublish = window.session.postPublish;
			window.session.postPublish = function () {
				window.__loopPostPublishCalled = true;
			};
		});

		await page.evaluate(() => publishWebcam(document.querySelector("#gowebcam")));
		await page.waitForFunction(() => {
			return window.__loopPostPublishCalled === true &&
				window.session.videoElement &&
				window.session.videoElement.id === "videosource";
		}, null, { timeout: 10000 });

		const publishedState = await page.evaluate(() => {
			const stream = window.session.streamSrc;
			const video = window.session.videoElement;
			const videoStream = video && video.srcObject;
			const result = {
				postPublishCalled: window.__loopPostPublishCalled,
				videoElementId: video && video.id,
				videoHasStream: !!videoStream,
				videoElementTracks: videoStream ? videoStream.getTracks().map(track => `${track.kind}:${track.readyState}`) : [],
				videoTracks: stream.getVideoTracks().map(track => track.readyState),
				audioTracks: stream.getAudioTracks().map(track => track.readyState),
				controlButtonsVisible: !document.querySelector("#controlButtons")?.classList.contains("hidden")
			};
			stream.getTracks().forEach(track => track.stop());
			return result;
		});

		assertEqual("preview button", previewState.buttonText, "START");
		assertEqual("preview stream attached", previewState.previewHasStream, true);
		assertEqual("preview video tracks", previewState.videoTracks.join(","), "live");
		assertEqual("preview audio tracks", previewState.audioTracks.join(","), "live");
		assertEqual("postPublish called", publishedState.postPublishCalled, true);
		assertEqual("published video id", publishedState.videoElementId, "videosource");
		assertEqual("published output stream attached", publishedState.videoHasStream, true);
		assertEqual("published video tracks", publishedState.videoTracks.join(","), "live");
		assertEqual("published audio tracks", publishedState.audioTracks.join(","), "live");
		assertEqual("control buttons visible", publishedState.controlButtonsVisible, true);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Loop camera publish flow verified.");
		console.log(`Preview tracks: video=${previewState.videoTracks.length} audio=${previewState.audioTracks.length}`);
		console.log(`Published element: ${publishedState.videoElementId}`);
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
