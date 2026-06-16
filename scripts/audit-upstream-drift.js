#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const upstreamRef = process.argv[2] || "upstream/develop";
const localRef = process.argv[3] || "HEAD";

const highRiskPaths = new Set([
	"index.html",
	"main.js",
	"lib.js",
	"webrtc.js",
	"main.css",
	"iframe.html",
	"iframe-examples.js",
	"thirdparty/CodecsHandler.js"
]);

const runtimeSupportPaths = new Set([
	"thirdparty/StreamSaver.js",
	"thirdparty/StreamSaver_legacy.js",
	"thirdparty/mitm.html"
]);

const knownOptionalRoots = new Set([
	"chat-lite",
	"notifications",
	"obs",
	"podcast",
	"screenrecorder",
	"core",
	"examples",
	"media",
	"images",
	"translations"
]);

function git(args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"]
	}).trim();
}

function gitRaw(args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"]
	}).replace(/\n$/, "");
}

function lines(output) {
	return output ? output.split("\n").filter(Boolean) : [];
}

function statusShortLines() {
	return lines(gitRaw(["status", "--short"]));
}

function tree(ref) {
	return new Set(lines(git(["ls-tree", "-r", "--name-only", ref])));
}

function worktreeFiles() {
	const files = new Set(lines(git(["ls-files", "--cached", "--others", "--exclude-standard"])));
	for (const row of statusShortLines()) {
		const status = row.slice(0, 2);
		const file = row.slice(3).replace(/^"|"$/g, "");
		if (status.includes("D")) {
			files.delete(file);
		}
	}
	return files;
}

function top(pathname) {
	return pathname.split("/")[0];
}

function groupByTop(files) {
	const groups = new Map();
	for (const file of files) {
		const key = top(file);
		groups.set(key, (groups.get(key) || 0) + 1);
	}
	return [...groups.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function statusRows() {
	return lines(git(["diff", "--name-status", `${localRef}..${upstreamRef}`])).map(line => {
		const [status, ...rest] = line.split(/\s+/);
		return { status, file: rest[rest.length - 1] };
	});
}

function worktreeDiffersFromUpstream(file, options = {}) {
	const args = ["diff", "--quiet"];
	if (options.ignoreWhitespace) {
		args.push("--ignore-all-space");
	}
	args.push(upstreamRef, "--", file);
	try {
		execFileSync("git", args, {
			cwd: repoRoot,
			stdio: "ignore"
		});
		return false;
	} catch (error) {
		return true;
	}
}

function printSection(title, rows, formatter = row => row) {
	console.log(`\n## ${title}`);
	if (!rows.length) {
		console.log("- none");
		return;
	}
	for (const row of rows) {
		console.log(`- ${formatter(row)}`);
	}
}

function main() {
	const localSha = git(["rev-parse", localRef]);
	const upstreamSha = git(["rev-parse", upstreamRef]);
	const mergeBase = git(["merge-base", localRef, upstreamRef]);
	const aheadBehind = git(["rev-list", "--left-right", "--count", `${localRef}...${upstreamRef}`]);
	const dirty = statusShortLines();

	const localTree = tree(localRef);
	const upstreamTree = tree(upstreamRef);
	const localFiles = worktreeFiles();
	const upstreamOnly = [...upstreamTree].filter(file => !localFiles.has(file)).sort();
	const localOnly = [...localFiles].filter(file => !upstreamTree.has(file)).sort();
	const upstreamAddedInWorktree = [...upstreamTree]
		.filter(file => !localTree.has(file) && localFiles.has(file))
		.sort();
	const rows = statusRows();
	const modified = rows.filter(row => row.status === "M").map(row => row.file).sort();
	const highRiskModified = modified.filter(file => highRiskPaths.has(file));
	const highRiskWorktreeAligned = [...highRiskPaths].filter(file => !worktreeDiffersFromUpstream(file)).sort();
	const highRiskWorktreeDrift = [...highRiskPaths].filter(file => worktreeDiffersFromUpstream(file)).sort();
	const runtimeSupportAligned = [...runtimeSupportPaths]
		.filter(file => !worktreeDiffersFromUpstream(file, { ignoreWhitespace: true }))
		.sort();
	const runtimeSupportDrift = [...runtimeSupportPaths]
		.filter(file => worktreeDiffersFromUpstream(file, { ignoreWhitespace: true }))
		.sort();
	const optionalUpstreamOnly = upstreamOnly.filter(file => knownOptionalRoots.has(top(file)));
	const otherUpstreamOnly = upstreamOnly.filter(file => !knownOptionalRoots.has(top(file)));

	console.log("# Loop Cam Upstream Drift Audit");
	console.log(`Local ref: ${localRef} ${localSha}`);
	console.log(`Upstream ref: ${upstreamRef} ${upstreamSha}`);
	console.log(`Merge base: ${mergeBase}`);
	console.log(`Ahead/behind: ${aheadBehind} (local/upstream)`);
	console.log(`Working tree: ${dirty.length ? `${dirty.length} dirty entries` : "clean"}`);
	console.log(`Local ref files: ${localTree.size}`);
	console.log(`Working-tree files: ${localFiles.size}`);
	console.log(`Upstream files: ${upstreamTree.size}`);
	console.log(`Upstream-only files: ${upstreamOnly.length}`);
	console.log(`Local-only files: ${localOnly.length}`);
	console.log(`Modified overlap files: ${modified.length}`);

	printSection("High-Risk Modified Runtime Files", highRiskModified);
	printSection("High-Risk Runtime Files Aligned In Worktree", highRiskWorktreeAligned);
	printSection("High-Risk Runtime Files Still Different In Worktree", highRiskWorktreeDrift);
	printSection("Runtime Support Files Substantively Aligned In Worktree", runtimeSupportAligned);
	printSection("Runtime Support Files Still Substantively Different In Worktree", runtimeSupportDrift);
	printSection("Upstream Files Added In Worktree", upstreamAddedInWorktree);
	printSection("Upstream-Only Optional Roots", groupByTop(optionalUpstreamOnly), ([root, count]) => `${root}: ${count}`);
	printSection("Other Upstream-Only Files", otherUpstreamOnly.slice(0, 80));
	if (otherUpstreamOnly.length > 80) {
		console.log(`- ... ${otherUpstreamOnly.length - 80} more`);
	}
	printSection("Local-Only Files", localOnly);
	printSection("Dirty Working Tree", dirty);

	console.log("\n## Notes");
	console.log("- Run `git fetch upstream --prune` before trusting this report for an upgrade.");
	console.log("- Treat high-risk runtime files as patch-review targets, not automatic overwrite targets.");
	console.log("- Treat upstream-only optional roots as product-surface decisions before importing them.");
}

main();
