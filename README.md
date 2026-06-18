## What is **Loop Cam?**
Loop Cam is Loop's branded production-source tool for bringing remote cameras, microphones, and screen shares into OBS or other studio software.

It is a focused fork of VDO.Ninja. The runtime stays close to upstream for WebRTC, browser, OBS, and device compatibility, while the default Loop surface stays intentionally simpler.

**This repo is Loop's own fork** ([loop-online/loop.cam](https://github.com/loop-online/loop.cam)). We do not contribute changes back to upstream VDO.Ninja — we only fetch and merge upstream updates when we want them. See `FORK.md` for the full fork contract.

In most cases, media is transferred peer to peer without a video server. In some network conditions, encrypted TURN relay may be used to complete the connection.

See `FORK.md` for supported surfaces, upgrade strategy, and verification checklist.
