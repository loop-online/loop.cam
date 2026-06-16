#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "thirdparty/CodecsHandler.js"), "utf8");
const context = { console };

vm.createContext(context);
vm.runInContext(source, context, { filename: "thirdparty/CodecsHandler.js" });

if (!context.CodecsHandler) {
	throw new Error("CodecsHandler was not defined");
}

function mediaLine(sdp, kind) {
	return sdp.split(/\r?\n/).find(line => line.startsWith(`m=${kind} `));
}

function assertEqual(name, actual, expected) {
	if (actual !== expected) {
		throw new Error(`${name} mismatch\nexpected: ${expected}\nactual:   ${actual}`);
	}
}

const audioSdp = [
	"v=0",
	"m=audio 9 UDP/TLS/RTP/SAVPF 0 63 111",
	"a=rtpmap:0 PCMU/8000",
	"a=rtpmap:63 red/48000/2",
	"a=rtpmap:111 opus/48000/2",
	""
].join("\r\n");

const preferredOpus = context.CodecsHandler.preferAudioCodec(audioSdp, "opus", true, false);
assertEqual(
	"preferred audio codec with RED",
	mediaLine(preferredOpus, "audio"),
	"m=audio 9 UDP/TLS/RTP/SAVPF 111 63 0"
);

const videoSdp = [
	"v=0",
	"m=video 9 UDP/TLS/RTP/SAVPF 98 96 97",
	"a=rtpmap:96 VP8/90000",
	"a=rtpmap:97 red/90000",
	"a=rtpmap:98 H264/90000",
	""
].join("\r\n");

const preferredVp8 = context.CodecsHandler.preferCodec(videoSdp, "vp8", true, false);
assertEqual(
	"preferred video codec with RED",
	mediaLine(preferredVp8, "video"),
	"m=video 9 UDP/TLS/RTP/SAVPF 96 97 98"
);

console.log("CodecsHandler SDP ordering verified.");
