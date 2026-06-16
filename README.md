## What is **Loop Cam?**
Loop Cam is Loop's branded production-source tool for bringing remote cameras, microphones, and screen shares into OBS or other studio software.

It is a focused fork of VDO.Ninja. The runtime should stay close to upstream for WebRTC, browser, OBS, and device compatibility, while the default Loop surface stays intentionally simpler.

In most cases, media is transferred peer to peer without a video server. In some network conditions, encrypted TURN relay may be used to complete the connection.

See `FORK.md` for the fork-maintenance contract, supported surfaces, upgrade strategy, and verification checklist.
