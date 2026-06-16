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
	const actualJson = JSON.stringify(actual);
	const expectedJson = JSON.stringify(expected);
	if (actualJson !== expectedJson) {
		throw new Error(`${name} mismatch\nexpected: ${expectedJson}\nactual:   ${actualJson}`);
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
		await page.waitForFunction(() => window.session && typeof window.manageSceneState === "function", null, { timeout: 30000 });

		const actual = await page.evaluate(() => {
			const uuid = "obs-uuid";
			window.applySceneState = function () {};
			window.session.disableOBS = false;
			window.session.obsControls = true;
			window.session.director = true;
			window.session.roomid = "room";
			window.session.optimizeBitrate = function () {};
			window.session.pcs = {
				[uuid]: {
					remote: "remote-pass",
					obsState: {}
				}
			};

			for (const id of ["obsControlButtons", "obsSceneNames", "obsControlHelp", "obscontrolbutton"]) {
				if (!document.getElementById(id)) {
					const element = document.createElement("div");
					element.id = id;
					document.body.appendChild(element);
				}
			}

			window.manageSceneState({
				obsState: {
					streaming: false,
					recording: false,
					virtualcam: false,
					details: {
						controlLevel: 5
					}
				}
			}, uuid);

			return Array.from(document.querySelectorAll("#obsControlButtons [data-system='obs-uuid'] button")).map(button => ({
				action: button.dataset.obsAction,
				hidden: button.classList.contains("hidden"),
				text: button.textContent.trim()
			}));
		});

		assertEqual("OBS start buttons", actual, [
			{ action: "startStreaming", hidden: false, text: "📡 start streaming" },
			{ action: "startRecording", hidden: false, text: "📽 start recording" },
			{ action: "startVirtualcam", hidden: false, text: "💻 start virtualcam" }
		]);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("OBS control buttons verified.");
		console.log("False OBS states expose start streaming, start recording, and start virtualcam actions.");
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
