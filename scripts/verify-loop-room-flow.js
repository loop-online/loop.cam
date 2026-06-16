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

function assertIncludes(name, actual, expected) {
	if (!actual.includes(expected)) {
		throw new Error(`${name} should include ${expected}\nactual: ${actual}`);
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

		const room = `loopsmoke${Date.now().toString(36)}`;
		await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
		await page.waitForSelector("#videoname1", { state: "attached", timeout: 30000 });
		await page.evaluate(roomName => {
			document.querySelector("#videoname1").value = roomName;
			createRoom();
		}, room);
		await page.waitForFunction(roomName => window.session && window.session.roomid === roomName, room, { timeout: 10000 });

		const actual = await page.evaluate(() => ({
			href: location.href,
			title: document.title,
			sessionRoom: window.session && window.session.roomid,
			dirRoomId: document.querySelector("#dirroomid")?.textContent.trim() || "",
			roomId: document.querySelector("#roomid")?.textContent.trim() || "",
			directorInvite: document.querySelector("#director_block_1")?.textContent.trim() || "",
			sceneLink: document.querySelector("#director_block_3")?.textContent.trim() || ""
		}));

		assertIncludes("location", actual.href, `?director=${room}`);
		assertEqual("document title", actual.title, "Control Room");
		assertEqual("session room", actual.sessionRoom, room);
		assertEqual("director room label", actual.dirRoomId, room);
		assertEqual("room label", actual.roomId, room);
		assertIncludes("director invite", actual.directorInvite, `?room=${room}`);
		assertIncludes("scene link", actual.sceneLink, `?scene&room=${room}`);

		if (errors.length) {
			throw new Error(`page errors: ${errors.join("\n")}`);
		}

		console.log("Loop room flow verified.");
		console.log(`Room: ${room}`);
		console.log(`Director URL: ${actual.href}`);
		console.log(`Guest invite: ${actual.directorInvite}`);
		console.log(`Scene link: ${actual.sceneLink}`);
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
