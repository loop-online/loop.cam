#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expectedBefore = ["container-1", "container-2", "container-3"];
const expectedAfter = ["container-1", "container-2", "container-3", "container-5", "container-7"];
const advancedCards = ["container-15", "container-16", "container-17", "container-20"];

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

function assertExcludes(name, value, forbidden) {
	if (value.includes(forbidden)) {
		throw new Error(`${name} should not include ${forbidden}`);
	}
}

function resolveChromePath() {
	const candidates = [
		process.env.CHROME_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium"
	].filter(Boolean);

	return candidates.find(candidate => fs.existsSync(candidate));
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
		await page.waitForSelector("#dropButton", { timeout: 30000 });

		const visibleCards = () =>
			page.$$eval("div.column.card", elements =>
				elements
					.filter(element => !element.classList.contains("hidden") && getComputedStyle(element).display !== "none")
					.map(element => element.id)
					.filter(Boolean)
					.sort()
			);

			const before = await visibleCards();
			const dropButton = await page.$eval("#dropButton", element => ({
				ariaHidden: element.getAttribute("aria-hidden"),
				ariaLabel: element.getAttribute("aria-label") || "",
				role: element.getAttribute("role") || ""
			}));
			const createRoomHeading = await page.$eval("#container-1 [data-translate='add-group-chat']", element => element.textContent.replace(/\s+/g, " ").trim());
			await page.click("#dropButton");
			const after = await visibleCards();
			const advanced = await page.$$eval("#container-15, #container-16, #container-17, #container-20", elements =>
				elements.map(element => ({
					id: element.id,
					hidden: element.classList.contains("hidden"),
					display: getComputedStyle(element).display
				}))
			);
			const roomNotes = await page.$eval("#roomnotes", element => ({
				text: element.textContent.replace(/\s+/g, " ").trim(),
				links: Array.from(element.querySelectorAll("a")).map(link => link.href)
			}));
			const initialSurfaceText = await page.$eval("body", element => element.innerText.replace(/\s+/g, " ").trim());

			assertEqual("default visible cards", before, expectedBefore);
			assertEqual("post-more-options visible cards", after, expectedAfter);
			assertEqual("create room heading", createRoomHeading, "Create a Room");
			assertEqual("drop button role", dropButton.role, "button");
			assertEqual("drop button aria-label", dropButton.ariaLabel, "More options");
			if (dropButton.ariaHidden === "true") {
				throw new Error("drop button should not be aria-hidden");
			}
			assertExcludes("initial home surface", initialSurfaceText, "params.vdo.ninja");
			assertExcludes("room tips text", roomNotes.text, "Advanced URL parameters");
			assertExcludes("room tips links", roomNotes.links.join(" "), "params.vdo.ninja");

			const revealedAdvancedCards = advanced.filter(card => !card.hidden || card.display !== "none");
			if (revealedAdvancedCards.length) {
				throw new Error(`advanced cards should stay hidden: ${JSON.stringify(revealedAdvancedCards)}`);
			}
			if (errors.length) {
				throw new Error(`page errors: ${errors.join("\\n")}`);
			}

		console.log("Loop home surface verified.");
		console.log(`Visible before More Options: ${before.join(", ")}`);
		console.log(`Visible after More Options: ${after.join(", ")}`);
		console.log(`Advanced cards hidden: ${advancedCards.join(", ")}`);
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
