#!/usr/bin/env node

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const options = {
	base: null,
	upstream: "upstream/develop",
	local: "WORKTREE",
	limit: 80
};

const requestedPaths = [];

for (const arg of process.argv.slice(2)) {
	if (arg.startsWith("--base=")) {
		options.base = arg.slice("--base=".length);
	} else if (arg.startsWith("--upstream=")) {
		options.upstream = arg.slice("--upstream=".length);
	} else if (arg.startsWith("--local=")) {
		options.local = arg.slice("--local=".length);
	} else if (arg.startsWith("--limit=")) {
		options.limit = Number(arg.slice("--limit=".length));
	} else {
		requestedPaths.push(arg);
	}
}

function git(args, input = null) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		input,
		stdio: input == null ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"]
	}).trim();
}

function gitRaw(args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"]
	});
}

function maybeGit(args) {
	const result = spawnSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"]
	});
	return result.status === 0 ? result.stdout.trim() : null;
}

function splitNul(output) {
	return output.split("\0").filter(Boolean);
}

function treeFiles(ref) {
	return new Set(splitNul(gitRaw(["ls-tree", "-r", "-z", "--name-only", ref])));
}

function worktreeFiles() {
	const files = new Set(splitNul(gitRaw(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])));
	for (const row of splitNul(gitRaw(["status", "--porcelain=v1", "-z"]))) {
		const status = row.slice(0, 2);
		const file = row.slice(3);
		if (status.includes("D")) {
			files.delete(file);
		}
	}
	return files;
}

function blobId(ref, file) {
	if (ref === "WORKTREE") {
		const absolute = path.join(repoRoot, file);
		if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
			return null;
		}
		return git(["hash-object", "--", file]);
	}
	return maybeGit(["rev-parse", `${ref}:${file}`]);
}

function existsAt(ref, file) {
	return blobId(ref, file) != null;
}

function changeStatus(baseHash, localHash, upstreamHash) {
	if (localHash === upstreamHash && localHash !== null) {
		return "aligned-with-upstream";
	}
	if (baseHash === localHash && baseHash !== upstreamHash) {
		return "stale-native-vdo";
	}
	if (baseHash === upstreamHash && baseHash !== localHash) {
		return "loop-only-change";
	}
	if (baseHash !== localHash && baseHash !== upstreamHash && localHash !== upstreamHash) {
		return "both-changed";
	}
	if (baseHash == null && localHash != null && upstreamHash == null) {
		return "loop-only-file";
	}
	if (baseHash == null && localHash == null && upstreamHash != null) {
		return "upstream-new-file";
	}
	if (baseHash != null && localHash == null && upstreamHash === baseHash) {
		return "loop-deleted-native-file";
	}
	if (baseHash != null && localHash === baseHash && upstreamHash == null) {
		return "upstream-deleted-native-file";
	}
	if (baseHash == null && localHash != null && upstreamHash != null) {
		return localHash === upstreamHash ? "new-file-aligned" : "new-file-conflict";
	}
	return "ambiguous";
}

function diffSummary(fromRef, toRef, file) {
	const left = fromRef === "WORKTREE" ? null : fromRef;
	const right = toRef === "WORKTREE" ? null : toRef;
	if (left && right) {
		return maybeGit(["diff", "--shortstat", `${left}..${right}`, "--", file]) || "no diff";
	}
	if (left && toRef === "WORKTREE") {
		return maybeGit(["diff", "--shortstat", left, "--", file]) || "no diff";
	}
	if (fromRef === "WORKTREE" && right) {
		return maybeGit(["diff", "--shortstat", right, "--", file]) || "no diff";
	}
	return "no diff";
}

function printSection(title, rows) {
	console.log(`\n## ${title}`);
	if (!rows.length) {
		console.log("- none");
		return;
	}
	for (const row of rows.slice(0, options.limit)) {
		const parts = [
			row.file,
			`base->loop: ${row.loopSummary}`,
			`base->upstream: ${row.upstreamSummary}`,
			`loop->upstream: ${row.loopToUpstreamSummary}`
		];
		console.log(`- ${parts.join(" | ")}`);
	}
	if (rows.length > options.limit) {
		console.log(`- ... ${rows.length - options.limit} more`);
	}
}

function main() {
	const upstreamSha = git(["rev-parse", options.upstream]);
	const localSha = options.local === "WORKTREE" ? git(["rev-parse", "HEAD"]) : git(["rev-parse", options.local]);
	const baseRef = options.base || git(["merge-base", options.local === "WORKTREE" ? "HEAD" : options.local, options.upstream]);
	const baseSha = git(["rev-parse", baseRef]);

	const baseFiles = treeFiles(baseRef);
	const upstreamFiles = treeFiles(options.upstream);
	const localFiles = options.local === "WORKTREE" ? worktreeFiles() : treeFiles(options.local);
	const files = requestedPaths.length
		? requestedPaths
		: [...new Set([...baseFiles, ...localFiles, ...upstreamFiles])].sort();

	const rows = files.map(file => {
		const baseHash = blobId(baseRef, file);
		const localHash = blobId(options.local, file);
		const upstreamHash = blobId(options.upstream, file);
		return {
			file,
			status: changeStatus(baseHash, localHash, upstreamHash),
			baseHash,
			localHash,
			upstreamHash,
			baseExists: existsAt(baseRef, file),
			localExists: existsAt(options.local, file),
			upstreamExists: existsAt(options.upstream, file),
			loopSummary: diffSummary(baseRef, options.local, file),
			upstreamSummary: diffSummary(baseRef, options.upstream, file),
			loopToUpstreamSummary: diffSummary(options.local, options.upstream, file)
		};
	}).sort((a, b) => a.file.localeCompare(b.file));

	const groups = new Map();
	for (const row of rows) {
		if (!groups.has(row.status)) {
			groups.set(row.status, []);
		}
		groups.get(row.status).push(row);
	}

	console.log("# Loop Cam Fork Drift Classifier");
	console.log(`Base ref: ${baseRef} ${baseSha}`);
	console.log(`Loop ref: ${options.local}${options.local === "WORKTREE" ? ` (HEAD ${localSha} plus working tree)` : ` ${localSha}`}`);
	console.log(`Upstream ref: ${options.upstream} ${upstreamSha}`);
	console.log(`Paths: ${requestedPaths.length ? requestedPaths.join(", ") : "all tracked/worktree/upstream files"}`);

	console.log("\n## Classification Rules");
	console.log("- stale-native-vdo: Loop still matches the fork base while upstream changed; normally take upstream.");
	console.log("- loop-only-change: Loop changed while upstream stayed like the fork base; preserve or intentionally clean up.");
	console.log("- both-changed: Loop and upstream both changed; inspect hunk-by-hunk.");
	console.log("- aligned-with-upstream: Loop already matches latest upstream.");
	console.log("- ambiguous/new/deleted: inspect before deciding.");

	for (const [status, groupedRows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		printSection(`${status} (${groupedRows.length})`, groupedRows);
	}
}

main();
