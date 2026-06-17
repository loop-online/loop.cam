/* Loop Cam icon system — upgrades Line Awesome classes to Lucide SVG at runtime. */
(function (global) {
	"use strict";

	var LINE_MAP = global.LoopIconLineMap || {};
	var GLYPHS = global.LoopIconGlyphs || {};
	var OPTICAL = global.LoopIconOptical || {};
	var ICON_SELECTOR = "i.las, i.lab, i.lar";
	var HOME_CARD_IDS = ["container-1", "container-2", "container-3", "container-3a"];
	var HOME_CARD_ICONS = {
		"container-1": "LayoutGrid",
		"container-2": "Monitor",
		"container-3": "Webcam",
		"container-3a": "Mic"
	};
	var HOME_CARD_SCALE = {
		Mic: 1.05
	};

	var observerStarted = false;
	var upgrading = false;

	function laTokenFromClassName(className) {
		if (!className) {
			return null;
		}
		var parts = className.split(/\s+/);
		for (var i = 0; i < parts.length; i += 1) {
			var part = parts[i];
			if (part.indexOf("la-") === 0 && part !== "las" && part !== "lab" && part !== "lar") {
				return part.slice(3);
			}
		}
		return null;
	}

	function lucideNameForElement(element) {
		var token = laTokenFromClassName(element.className);
		return token ? LINE_MAP[token] || null : null;
	}

	function isAffordanceHost(host) {
		if (!host || !host.closest) {
			return false;
		}
		return !!host.closest(
			".loop-settings-gear, .loop-affordance-close, .loop-affordance-expand, .loop-affordance-dropdown"
		);
	}

	function opticalTransform(lucideName, useNormalizedScale, host) {
		var data = OPTICAL[lucideName];
		if (!data) {
			return "";
		}
		var scale = useNormalizedScale ? (data.toggleScale || data.pairScale || data.scale) : data.scale;
		if (useNormalizedScale) {
			scale = Math.min(global.LoopIcons && global.LoopIcons.toggleMaxScale || 1.35, scale);
		}
		if (host && host.classList && host.classList.contains("loop-home-card-icon") && HOME_CARD_SCALE[lucideName]) {
			scale *= HOME_CARD_SCALE[lucideName];
		}
		scale = Math.min(1.75, scale);
		return "translate(12 12) scale(" + scale.toFixed(3) + ") translate(" + (-data.cx) + " " + (-data.cy) + ")";
	}

	function shouldUsePairScale(host) {
		if (!host || !host.classList) {
			return true;
		}
		if (host.classList.contains("loop-home-card-icon")) {
			return false;
		}
		if (host.classList.contains("toggleSize") || isAffordanceHost(host)) {
			return true;
		}
		return false;
	}

	function renderLucideSvg(host, lucideName) {
		var nodes = GLYPHS[lucideName];
		if (!nodes) {
			return false;
		}

		var svg = host.querySelector("svg.loop-icon-svg");
		if (!svg) {
			svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "loop-icon-svg");
			svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("stroke-width", "2");
			svg.setAttribute("stroke-linecap", "round");
			svg.setAttribute("stroke-linejoin", "round");
			svg.setAttribute("focusable", "false");
			host.appendChild(svg);
		}

		while (svg.firstChild) {
			svg.removeChild(svg.firstChild);
		}

		var opticalGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		opticalGroup.setAttribute("class", "loop-icon-optical");
		var transform = opticalTransform(lucideName, shouldUsePairScale(host), host);
		if (transform) {
			opticalGroup.setAttribute("transform", transform);
		}
		svg.appendChild(opticalGroup);

		for (var i = 0; i < nodes.length; i += 1) {
			var node = nodes[i];
			var tag = node[0];
			var attrs = node[1] || {};
			var child = document.createElementNS("http://www.w3.org/2000/svg", tag);
			Object.keys(attrs).forEach(function (key) {
				child.setAttribute(key, attrs[key]);
			});
			opticalGroup.appendChild(child);
		}

		host.dataset.loopLucide = lucideName;
		host.classList.add("loop-icon-upgraded");
		return true;
	}

	function homeCardLucideName(card) {
		if (!card || !card.id) {
			return null;
		}
		if (card.id === "container-3" && card.classList.contains("microphoneBackground")) {
			return "Mic";
		}
		return HOME_CARD_ICONS[card.id] || null;
	}

	function upgradeIconElement(element) {
		if (!element || !element.matches || !element.matches(ICON_SELECTOR)) {
			return;
		}

		var lucideName = lucideNameForElement(element);
		if (!lucideName) {
			return;
		}

		if (element.dataset.loopLucide === lucideName && element.querySelector("svg.loop-icon-svg")) {
			return;
		}

		renderLucideSvg(element, lucideName);
	}

	function upgradeHomeCards(root) {
		HOME_CARD_IDS.forEach(function (cardId) {
			var card = root.getElementById(cardId);
			if (!card || card.classList.contains("in-animation") || card.classList.contains("skip-animation")) {
				return;
			}

			var lucideName = homeCardLucideName(card);
			if (!lucideName) {
				return;
			}

			var host = card.querySelector(".loop-home-card-icon");
			if (!host) {
				host = document.createElement("span");
				host.className = "loop-home-card-icon las";
				host.setAttribute("aria-hidden", "true");
				card.appendChild(host);
			}

			if (host.dataset.loopLucide !== lucideName) {
				delete host.dataset.loopLucide;
			}

			renderLucideSvg(host, lucideName);
		});
	}

	function upgradeAll(root) {
		root = root || document;
		root.querySelectorAll(ICON_SELECTOR).forEach(upgradeIconElement);
		upgradeHomeCards(root);
	}

	function collectIconTargetsFromNode(node, targets) {
		if (!node || node.nodeType !== 1) {
			return;
		}
		if (node.matches && node.matches(ICON_SELECTOR)) {
			targets.add(node);
			return;
		}
		if (node.querySelectorAll) {
			node.querySelectorAll(ICON_SELECTOR).forEach(function (icon) {
				targets.add(icon);
			});
		}
	}

	function isHomeCardId(id) {
		return HOME_CARD_IDS.indexOf(id) !== -1;
	}

	function toggleAccordionChevron(id) {
		var el = typeof id === "string" ? document.getElementById(id) : id;
		if (!el) {
			return;
		}
		var expanded = !el.classList.contains("bottom");
		el.className =
			"chevron las loop-affordance-expand " +
			(expanded ? "bottom la-chevron-down" : "right la-chevron-right");
		if (typeof id === "string") {
			el.id = id;
		}
		el.setAttribute("aria-hidden", "true");
		upgradeIconElement(el);
	}

	function startObserver(root) {
		if (observerStarted || typeof MutationObserver === "undefined" || !root.body) {
			return;
		}
		observerStarted = true;

		var observer = new MutationObserver(function (mutations) {
			if (upgrading) {
				return;
			}

			var targets = new Set();
			var refreshHomeCards = false;

			for (var i = 0; i < mutations.length; i += 1) {
				var mutation = mutations[i];

				if (mutation.type === "childList") {
					for (var c = 0; c < mutation.addedNodes.length; c += 1) {
						collectIconTargetsFromNode(mutation.addedNodes[c], targets);
					}
					continue;
				}

				if (mutation.type !== "attributes" || mutation.attributeName !== "class") {
					continue;
				}

				var target = mutation.target;
				if (target && target.matches && target.matches(ICON_SELECTOR)) {
					targets.add(target);
					continue;
				}

				if (target && target.id && isHomeCardId(target.id)) {
					refreshHomeCards = true;
				}
			}

			if (!targets.size && !refreshHomeCards) {
				return;
			}

			upgrading = true;
			try {
				targets.forEach(upgradeIconElement);
				if (refreshHomeCards) {
					upgradeHomeCards(root);
				}
			} finally {
				upgrading = false;
			}
		});

		observer.observe(root.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["class"]
		});
	}

	function init(root) {
		root = root || document;
		if (!global.LoopIconGlyphs || !global.LoopIconLineMap) {
			console.warn("LoopIcons: glyph or line map bundle missing");
			return;
		}
		if (global.LoopIcons && global.LoopIcons.ready) {
			return;
		}

		upgrading = true;
		try {
			upgradeAll(root);
		} finally {
			upgrading = false;
		}

		startObserver(root);
		global.LoopIcons.ready = true;
	}

	global.LoopIcons = {
		engine: "lucide",
		toggleMaxScale: 1.35,
		upgradeAll: upgradeAll,
		toggleAccordionChevron: toggleAccordionChevron,
		init: init,
		ready: false
	};

	global.loopToggleAccordionChevron = toggleAccordionChevron;

	if (typeof document !== "undefined") {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", function () {
				init(document);
			});
		} else {
			init(document);
		}
	}
})(typeof window !== "undefined" ? window : globalThis);
