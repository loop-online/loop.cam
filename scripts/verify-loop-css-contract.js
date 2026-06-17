#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.resolve(__dirname, "..", "main.css"), "utf8");

function assertDeclaration(selectorPattern, declaration) {
	const matcher = new RegExp(`(?:^|\\n)\\s*${selectorPattern}\\s*\\{([\\s\\S]*?)\\}`, "gm");
	const blocks = [...css.matchAll(matcher)].map(match => match[1].replace(/\s+/g, " "));
	if (!blocks.length) {
		throw new Error(`Missing CSS selector: ${selectorPattern}`);
	}
	if (!blocks.some(block => block.includes(declaration))) {
		throw new Error(`${selectorPattern} missing declaration: ${declaration}`);
	}
}

assertDeclaration("\\.inner:before,\\s*\\.inner:after", "width: 50px;");
assertDeclaration("\\.inner:before,\\s*\\.inner:after", "left: 50%;");
assertDeclaration("\\.inner:before,\\s*\\.inner:after", "margin-left: -25px;");
assertDeclaration("\\.inner:before", "transform: translateY(-50%) rotate(45deg);");
assertDeclaration("\\.inner:after", "top: 50%;");
assertDeclaration("\\.inner:after", "transform: translateY(-50%) rotate(-45deg);");
assertDeclaration("\\.outer:hover \\.inner:before,\\s*\\.outer:hover \\.inner:after", "transform: translateY(-50%) rotate(0);");
assertDeclaration("\\.outer:hover \\.inner:before", "top: 15%;");
assertDeclaration("\\.outer:hover \\.inner:after", "top: 85%;");
assertDeclaration(":root", "--background-color: #171717;");
assertDeclaration(":root", "--dark-background-color: #171717;");
assertDeclaration("#header,\\s*\\.darktheme #header", "background-color: #171717 !important;");
assertDeclaration("#header,\\s*\\.darktheme #header", "backdrop-filter: none !important;");
assertDeclaration("\\.column", "border-radius: 16px;");
assertDeclaration("\\.column", "background-color: var(--discord-grey-7);");
assertDeclaration("#container-1,\\s*#container-2,\\s*#container-3,\\s*#container-3a,\\s*#container-4,\\s*#container-5", "border-radius: 20px !important;");
assertDeclaration("\\.darktheme \\.card,\\s*\\.card", "border-radius: 16px;");

console.log("Loop CSS contract verified.");
