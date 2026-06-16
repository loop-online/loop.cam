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
		await page.waitForFunction(() => window.session && typeof window.targetGuest === "function" && typeof window.processMessage === "function", null, { timeout: 30000 });

		const result = await page.evaluate(async () => {
			window.session.remote = "remote-pass";
			window.session.rpcs = {
				"guest-uuid": {
					streamID: "guest-stream",
					stats: {
						info: {
							directorMirror: false
						}
					}
				}
			};

			const sent = [];
			const apiCalls = [];
			window.session.encodeRemote = async msg => ({ ...msg, encoded: true });
			window.session.sendRequest = (msg, uuid) => {
				sent.push({ msg, uuid });
				return true;
			};
			window.session.requestResolution = (uuid, width, height) => {
				apiCalls.push({ type: "requestResolution", uuid, width, height });
			};
			window.directIsolateChannel = (uuid, channel) => {
				apiCalls.push({ type: "directIsolateChannel", uuid, channel });
				return true;
			};
			window.changeOrder = (value, uuid) => {
				apiCalls.push({ type: "changeOrder", value, uuid });
			};
			window.requestVideoHack = (keyname, value, uuid) => {
				apiCalls.push({ type: "requestVideoHack", keyname, value, uuid });
			};

			for (const actionType of ["solo-video", "isolate-channel", "order-down"]) {
				const button = document.createElement("button");
				button.dataset.sid = "guest-stream";
				button.dataset.actionType = actionType;
				button.dataset.UUID = "guest-uuid";
				document.body.appendChild(button);
			}

			const autofocus = await window.targetGuest("guest-stream", "ptzAutofocus", "off");
			await window.targetGuest("guest-stream", "ptzZoom", 0.25, "abs");
			await window.targetGuest("guest-stream", "ptzPan", -0.5, "absolute");
			await window.targetGuest("guest-uuid", "ptzTilt", 0.75, true);
			await window.targetGuest("guest-stream", "ptzFocus", -0.1, "1");
			await window.targetGuest("guest-stream", "remoteMirror", "toggle");
			await window.targetGuest("guest-stream", "remoteRotate", 180);
			await window.targetGuest("guest-stream", "refreshVideo");
			await window.processMessage({ target: "guest-stream", action: "ptzPan", value: "0.5", value2: "absolute" });
			await window.targetGuest("guest-stream", "pgm", "2");
			await window.targetGuest("guest-stream", "mixorder", true);
			await window.targetGuest("guest-stream", "requestResolution", "1280x720");
			await window.targetGuest("guest-stream", "setWidth", "1920");
			await window.targetGuest("guest-stream", "setHeight", "1080");
			await window.targetGuest("guest-stream", "setAspectRatio", "1.5");
			await window.targetGuest("guest-stream", "requestAspectRatio", "4:3", "1200");

			return { apiCalls, autofocus, sent };
		});

		assertEqual("autofocus return", result.autofocus, { UUID: "guest-uuid", autofocus: false });
		assertEqual("sent requests", result.sent, [
			{ msg: { autofocus: false, remote: "remote-pass", encoded: true }, uuid: "guest-uuid" },
			{ msg: { zoom: 0.25, abs: true, remote: "remote-pass", encoded: true }, uuid: "guest-uuid" },
			{ msg: { pan: -0.5, remote: "remote-pass", abs: true, encoded: true }, uuid: "guest-uuid" },
			{ msg: { tilt: 0.75, remote: "remote-pass", abs: true, encoded: true }, uuid: "guest-uuid" },
			{ msg: { focus: -0.1, abs: true, remote: "remote-pass", encoded: true }, uuid: "guest-uuid" },
			{ msg: { mirrorGuestState: true, mirrorGuestTarget: true, info: { directorMirror: true }, remote: "remote-pass", encoded: true }, uuid: "guest-uuid" },
			{ msg: { rotate: 180, remote: "remote-pass", encoded: true }, uuid: "guest-uuid" },
			{ msg: { refreshVideo: true, UUID: "guest-uuid", remote: "remote-pass" }, uuid: "guest-uuid" },
			{ msg: { pan: 0.5, remote: "remote-pass", abs: true, encoded: true }, uuid: "guest-uuid" }
		]);
		assertEqual("local API calls", result.apiCalls, [
			{ type: "directIsolateChannel", uuid: "guest-uuid", channel: 2 },
			{ type: "changeOrder", value: 1, uuid: "guest-uuid" },
			{ type: "requestResolution", uuid: "guest-uuid", width: 1280, height: 720 },
			{ type: "requestVideoHack", keyname: "width", value: 1920, uuid: "guest-uuid" },
			{ type: "requestVideoHack", keyname: "height", value: 1080, uuid: "guest-uuid" },
			{ type: "requestVideoHack", keyname: "aspectRatio", value: 1.5, uuid: "guest-uuid" },
			{ type: "requestResolution", uuid: "guest-uuid", width: 1200, height: 900 }
		]);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Target guest remote controls verified.");
		console.log("Actions: PTZ, mirror, rotate, refresh, channel, mix order, resolution, and video constraints.");
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
