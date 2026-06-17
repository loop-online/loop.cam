#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const http = require("http");

const ROOT = path.join(__dirname, "..");

function loadScript(filename) {
	return fs.readFileSync(path.join(ROOT, filename), "utf8");
}

function createDom() {
	const icons = Array.from({ length: 20 }, (_, i) =>
		`<i class="las la-video toggleSize" id="icon-${i}"></i>`
	).join("");
	const html = `<!DOCTYPE html><html><body>${icons}<div id="container-1"></div><div id="container-2"></div><div id="container-3"></div></body></html>`;

	class Element {
		constructor(tag) {
			this.tagName = tag.toUpperCase();
			this.nodeType = 1;
			this.children = [];
			this.attributes = {};
			this.className = "";
			this.dataset = {};
			this.style = {};
			this.id = "";
		}
		get classList() {
			const self = this;
			const parts = () => self.className.split(/\s+/).filter(Boolean);
			return {
				add(c) {
					const set = new Set(parts());
					set.add(c);
					self.className = Array.from(set).join(" ");
				},
				contains(c) {
					return parts().includes(c);
				}
			};
		}
		appendChild(child) {
			this.children.push(child);
			child.parentElement = this;
			return child;
		}
		removeChild(child) {
			this.children = this.children.filter((c) => c !== child);
		}
		get firstChild() {
			return this.children[0] || null;
		}
		querySelector(sel) {
			if (sel === "svg.loop-icon-svg") {
				return this.children.find((c) => c.tagName === "SVG" && c.className === "loop-icon-svg") || null;
			}
			if (sel === ".loop-home-card-icon") {
				return this.children.find((c) => c.classList && c.classList.contains("loop-home-card-icon")) || null;
			}
			return null;
		}
		querySelectorAll(sel) {
			const all = [];
			const walk = (node) => {
				if (node.nodeType !== 1) return;
				if (sel === ICON_SELECTOR || sel === "i.las, i.lab, i.lar") {
					if (/^I$/i.test(node.tagName) && /\b(las|lab|lar)\b/.test(node.className)) all.push(node);
				} else if (sel === ".loop-icon-upgraded" && node.classList.contains("loop-icon-upgraded")) {
					all.push(node);
				}
				node.children.forEach(walk);
			};
			walk(this);
			return all;
		}
		matches(sel) {
			if (sel === ICON_SELECTOR) {
				return /^I$/i.test(this.tagName) && /\b(las|lab|lar)\b/.test(this.className);
			}
			return false;
		}
		setAttribute(name, value) {
			this.attributes[name] = value;
			if (name === "class") this.className = value;
			if (name === "id") this.id = value;
		}
		getAttribute(name) {
			return this.attributes[name] || null;
		}
		createElementNS(_ns, tag) {
			const el = new Element(tag);
			el.namespaceURI = _ns;
			return el;
		}
		createElement(tag) {
			return new Element(tag);
		}
	}

	const ICON_SELECTOR = "i.las, i.lab, i.lar";

	function walkAll(node, out) {
		if (!node || node.nodeType !== 1) {
			return;
		}
		out.push(node);
		node.children.forEach(function (child) {
			walkAll(child, out);
		});
	}

	function parse(htmlStr) {
		const bodyMatch = htmlStr.match(/<body>([\s\S]*)<\/body>/);
		const body = new Element("body");
		const tokens = (bodyMatch ? bodyMatch[1] : "").match(/<[^>]+>/g) || [];
		for (const token of tokens) {
			const idMatch = token.match(/id="([^"]+)"/);
			const classMatch = token.match(/class="([^"]+)"/);
			const tagMatch = token.match(/^<(\w+)/);
			const tag = tagMatch ? tagMatch[1] : "i";
			const el = new Element(tag);
			if (idMatch) el.id = idMatch[1];
			if (classMatch) el.className = classMatch[1];
			body.appendChild(el);
		}

		function querySelectorAll(sel) {
			const all = [];
			walkAll(body, all);
			if (sel === ICON_SELECTOR || sel === "i.las, i.lab, i.lar") {
				return all.filter(function (node) {
					return /^I$/i.test(node.tagName) && /\b(las|lab|lar)\b/.test(node.className);
				});
			}
			if (sel === ".loop-icon-upgraded") {
				return all.filter(function (node) {
					return node.classList.contains("loop-icon-upgraded");
				});
			}
			return [];
		}

		return {
			body,
			readyState: "complete",
			getElementById(id) {
				const all = [];
				walkAll(body, all);
				return all.find(function (n) {
					return n.id === id;
				}) || null;
			},
			querySelectorAll: querySelectorAll,
			createElementNS(ns, tag) {
				return new Element(tag);
			},
			createElement(tag) {
				return new Element(tag);
			}
		};
	}

	return { document: parse(html), ICON_SELECTOR };
}

function runSmoke() {
	const started = Date.now();
	const { document } = createDom();
	const context = {
		window: {},
		document,
		console,
		setTimeout,
		clearTimeout,
		fetch: function () {
			return Promise.resolve({ ok: true });
		},
		MutationObserver: undefined,
		globalThis: {}
	};
	context.window = context;
	context.globalThis = context;
	vm.createContext(context);

	vm.runInContext(loadScript("loop-icon-line-map.js"), context);
	vm.runInContext(loadScript("loop-icon-glyphs.js"), context);
	vm.runInContext(loadScript("loop-icons.js"), context);

	if (!context.LoopIcons || !context.LoopIcons.ready) {
		throw new Error("LoopIcons did not initialize");
	}

	const upgraded = document.querySelectorAll(".loop-icon-upgraded").length;
	const elapsed = Date.now() - started;
	console.log(`OK: upgraded ${upgraded} icons in ${elapsed}ms`);
}

function probeHttp() {
	return new Promise((resolve, reject) => {
		const req = http.get("http://127.0.0.1:8765/index.html", { timeout: 5000 }, (res) => {
			let size = 0;
			res.on("data", (chunk) => {
				size += chunk.length;
			});
			res.on("end", () => resolve({ status: res.statusCode, size }));
		});
		req.on("timeout", () => {
			req.destroy();
			reject(new Error("HTTP timeout"));
		});
		req.on("error", reject);
	});
}

(async () => {
	runSmoke();
	try {
		const httpResult = await probeHttp();
		console.log("HTTP:", httpResult);
	} catch (err) {
		console.warn("HTTP probe skipped:", err.message);
	}
})();
