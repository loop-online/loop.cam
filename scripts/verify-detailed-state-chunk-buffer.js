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
		await page.waitForFunction(() => window.session && typeof window.getDetailedState === "function", null, { timeout: 30000 });

		const states = await page.evaluate(() => {
			function getState(options) {
				const streamID = "guest-stream";
				window.session.streamID = "local-stream";
				window.session.rpcs = {
					guest: {
						streamID,
						label: "Guest",
						group: "main",
						layout: false,
						iframeSrc: false,
						remoteMuteState: false,
						videoMuted: false,
						activelySpeaking: false,
						defaultSpeaker: false,
						videoElement: false,
						iframeVisible: false,
						buffer: options.remoteBuffer,
						stats: {}
					}
				};
				window.session.director = false;
				window.session.directorList = [];
				window.session.infocus = false;
				window.session.defaultChunkedBuffer = options.defaultChunkedBuffer;
				window.session.buffer = options.buffer;
				window.session.chunkbuffer = options.chunkbuffer;
				window.session.chunkbufferceil = options.chunkbufferceil;
				window.session.chunkbufferadaptive = options.chunkbufferadaptive;
				return window.getDetailedState(streamID)[streamID];
			}

			return {
				defaultOnly: getState({
					defaultChunkedBuffer: 700,
					buffer: false,
					chunkbuffer: false,
					chunkbufferceil: false,
					chunkbufferadaptive: false,
					remoteBuffer: false
				}),
				sessionBuffer: getState({
					defaultChunkedBuffer: 700,
					buffer: 1200,
					chunkbuffer: 500,
					chunkbufferceil: 2500,
					chunkbufferadaptive: true,
					remoteBuffer: false
				}),
				remoteOverride: getState({
					defaultChunkedBuffer: 700,
					buffer: false,
					chunkbuffer: 500,
					chunkbufferceil: 2500,
					chunkbufferadaptive: true,
					remoteBuffer: 90
				})
			};
		});

		assertEqual("defaultOnly default", states.defaultOnly.chunkedBufferDefault, 700);
		assertEqual("defaultOnly requested", states.defaultOnly.chunkedBufferRequested, 700);
		assertEqual("defaultOnly override", states.defaultOnly.chunkedBufferOverride, false);
		assertEqual("defaultOnly ceil", states.defaultOnly.chunkedBufferCeil, false);
		assertEqual("defaultOnly adaptive", states.defaultOnly.chunkedBufferAdaptive, false);
		assertEqual("sessionBuffer default", states.sessionBuffer.chunkedBufferDefault, 1200);
		assertEqual("sessionBuffer requested", states.sessionBuffer.chunkedBufferRequested, 1200);
		assertEqual("sessionBuffer ceil", states.sessionBuffer.chunkedBufferCeil, 2500);
		assertEqual("sessionBuffer adaptive", states.sessionBuffer.chunkedBufferAdaptive, true);
		assertEqual("remoteOverride default", states.remoteOverride.chunkedBufferDefault, 500);
		assertEqual("remoteOverride override", states.remoteOverride.chunkedBufferOverride, 90);
		assertEqual("remoteOverride requested", states.remoteOverride.chunkedBufferRequested, 90);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Detailed state chunk buffer fields verified.");
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
