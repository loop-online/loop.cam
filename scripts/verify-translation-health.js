#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = ["translations/en.json", "translations/blank.json"];
const translatedMarkupFiles = ["index.html"];
const promotedInnerHTML = {
	"add-group-chat": "Create a Room",
	"add-your-camera": "Share Camera",
	"remote-screenshare-obs": "Share Screen"
};

function readJsonString(source, start) {
	let value = "";
	let index = start + 1;
	while (index < source.length) {
		const char = source[index];
		if (char === "\\") {
			value += source.slice(index, index + 2);
			index += 2;
			continue;
		}
		if (char === "\"") {
			return { value, end: index + 1 };
		}
		value += char;
		index += 1;
	}
	throw new Error("unterminated JSON string");
}

function skipWhitespace(source, index) {
	while (/\s/.test(source[index] || "")) {
		index += 1;
	}
	return index;
}

function findDuplicateKeys(source) {
	const duplicates = [];
	const stack = [];
	let index = 0;

	while (index < source.length) {
		const char = source[index];

		if (char === "\"") {
			const parsed = readJsonString(source, index);
			const context = stack[stack.length - 1];
			const next = skipWhitespace(source, parsed.end);

			if (context?.type === "object" && context.expectKey && source[next] === ":") {
				const previous = context.keys.get(parsed.value);
				const pathLabel = [...context.path, parsed.value].join(".");
				if (previous) {
					duplicates.push({ path: pathLabel, first: previous, second: index + 1 });
				} else {
					context.keys.set(parsed.value, index + 1);
				}
				context.pendingKey = parsed.value;
				context.expectKey = false;
				index = next + 1;
				continue;
			}

			index = parsed.end;
			continue;
		}

		if (char === "{") {
			const parent = stack[stack.length - 1];
			const path = parent?.type === "object" && parent.pendingKey
				? [...parent.path, parent.pendingKey]
				: [];
			if (parent?.type === "object") {
				parent.pendingKey = null;
			}
			stack.push({ type: "object", path, keys: new Map(), expectKey: true, pendingKey: null });
			index += 1;
			continue;
		}

		if (char === "}") {
			stack.pop();
			index += 1;
			continue;
		}

		if (char === "[") {
			stack.push({ type: "array" });
			index += 1;
			continue;
		}

		if (char === "]") {
			stack.pop();
			index += 1;
			continue;
		}

		if (char === "," && stack[stack.length - 1]?.type === "object") {
			stack[stack.length - 1].expectKey = true;
			index += 1;
			continue;
		}

		index += 1;
	}

	return duplicates;
}

function assertLoopHeader(file, data) {
	const header = data.innerHTML?.["logo-header"] || "";
	const text = header.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
	if (text !== "Loop Cam" || /VDO\.Ninja/i.test(header)) {
		throw new Error(`${file} innerHTML.logo-header should render as Loop Cam, got: ${header}`);
	}
}

function extractDataTranslateKeys(source) {
	return [...source.matchAll(/\bdata-translate\s*=\s*["']([^"']+)["']/g)]
		.map(match => match[1].trim())
		.filter(Boolean);
}

function getExpectedDataTranslateKeys() {
	const keys = new Set();
	for (const relativePath of translatedMarkupFiles) {
		const source = fs.readFileSync(path.join(root, relativePath), "utf8");
		for (const key of extractDataTranslateKeys(source)) {
			keys.add(key);
		}
	}
	return [...keys].sort();
}

function assertPromotedInnerHTML(file, data) {
	const translations = data.innerHTML && typeof data.innerHTML === "object" && !Array.isArray(data.innerHTML)
		? data.innerHTML
		: {};
	for (const [key, expected] of Object.entries(promotedInnerHTML)) {
		if (translations[key] !== expected) {
			throw new Error(`${file} innerHTML.${key} should be "${expected}", got: ${translations[key]}`);
		}
	}
}

function findCrossSectionCollisions(data, keysToCheck) {
	const innerHTML = data.innerHTML && typeof data.innerHTML === "object" && !Array.isArray(data.innerHTML)
		? data.innerHTML
		: {};
	const titles = data.titles && typeof data.titles === "object" && !Array.isArray(data.titles)
		? data.titles
		: {};
	const collisions = [];

	for (const key of keysToCheck) {
		if (!Object.prototype.hasOwnProperty.call(innerHTML, key)) {
			continue;
		}
		if (!Object.prototype.hasOwnProperty.call(titles, key)) {
			continue;
		}
		if (innerHTML[key] !== titles[key]) {
			collisions.push({
				key,
				innerHTML: innerHTML[key],
				titles: titles[key]
			});
		}
	}

	return collisions;
}

function assertNoCrossSectionCollisions(file, data) {
	const collisions = findCrossSectionCollisions(data, Object.keys(promotedInnerHTML));
	if (!collisions.length) {
		return;
	}
	const details = collisions
		.map(collision => `${collision.key}: innerHTML=${JSON.stringify(collision.innerHTML)} titles=${JSON.stringify(collision.titles)}`)
		.join("\n");
	throw new Error(`${file} has promoted home keys with conflicting innerHTML/titles values:\n${details}`);
}

function assertDataTranslateCoverage(file, data, expectedKeys) {
	const translations = data.innerHTML && typeof data.innerHTML === "object" && !Array.isArray(data.innerHTML)
		? data.innerHTML
		: {};
	const missing = expectedKeys.filter(key => !Object.prototype.hasOwnProperty.call(translations, key));
	if (missing.length) {
		throw new Error(`${file} is missing data-translate keys:\n${missing.map(key => `- ${key}`).join("\n")}`);
	}
}

function main() {
	const failures = [];
	const expectedKeys = getExpectedDataTranslateKeys();

	for (const relativePath of files) {
		const absolutePath = path.join(root, relativePath);
		const source = fs.readFileSync(absolutePath, "utf8");
		const duplicates = findDuplicateKeys(source);

		if (duplicates.length) {
			const details = duplicates
				.map(duplicate => `${duplicate.path} first=${duplicate.first} second=${duplicate.second}`)
				.join("\n");
			failures.push(`${relativePath} has duplicate keys:\n${details}`);
		}

		const data = JSON.parse(source);
		assertLoopHeader(relativePath, data);
		assertPromotedInnerHTML(relativePath, data);
		assertDataTranslateCoverage(relativePath, data, expectedKeys);
		assertNoCrossSectionCollisions(relativePath, data);
	}

	if (failures.length) {
		throw new Error(failures.join("\n\n"));
	}

	console.log(`Translation health verified for ${files.join(", ")}.`);
}

main();
