# Loop Cam Icon System

Loop Cam renders **[Lucide](https://lucide.dev)** icons (ISC) while keeping upstream **Line Awesome class hooks** (`las la-*`) for merge compatibility.

## Architecture

| Layer | Role |
|-------|------|
| `scripts/loop-icon-line-map.json` | Maps `la-*` tokens → Lucide export names |
| `loop-icon-line-map.js` | Browser bundle of the map (generated) |
| `loop-icon-glyphs.js` | Lucide SVG path data + optical balance metadata (generated) |
| `loop-icons.js` | Runtime upgrader: replaces font glyphs with inline Lucide SVG |
| `loop-icons.css` | Sizing, contrast, suppresses Line Awesome `::before` on upgraded nodes |

Upstream HTML/JS still says `<i class="las la-microphone">` and `className = "las la-microphone-slash toggleSize"`. At load (and on DOM/class mutations), `loop-icons.js` injects Lucide SVG, applies optical centering/scaling, and adds `loop-icon-upgraded`.

### Optical balance

`npm run build:icons` computes per-glyph `scale`, `pairScale`, and centering offsets from Lucide path bounds. Home cards use individual `scale`; toggle buttons (`.toggleSize`) use unified `pairScale` so mute/video/volume state swaps do not jump in size.

## Regenerating glyphs

After editing the map or upgrading Lucide:

```sh
npm install lucide   # dev only; node_modules is gitignored
npm run build:icons
node scripts/extract-line-icon-usage.js
node scripts/verify-loop-icon-system.js
```

## Taxonomy (Lucide names)

| Role | Line Awesome hook | Lucide |
|------|-------------------|--------|
| Camera | `la-video` / `la-video-slash` | `Video` / `VideoOff` |
| Microphone | `la-microphone` / `la-microphone-slash` | `Mic` / `MicOff` |
| Speaker | `la-volume-up` / `la-volume-mute` | `Volume2` / `VolumeX` |
| Screen share | `la-desktop`, `la-tv` | `Monitor`, `Tv` |
| Room | `la-users`, `la-users-cog` | `Users`, `UserRoundCog` |
| Settings | `la-cog`, `la-sliders-h` | `Settings`, `SlidersHorizontal` |
| Stream / broadcast | `la-stream`, `la-broadcast-tower` | `Cast`, `RadioTower` |
| Alert | `la-info-circle`, `la-exclamation-triangle` | `Info`, `AlertTriangle` |
| Close / nav | `la-times`, `la-chevron-left` | `X`, `ChevronLeft` |

Full mapping: `scripts/loop-icon-line-map.json`.

## Upstream merge checklist

1. If upstream adds new `la-*` classes, add a mapping entry and run `npm run build:icons`.
2. Re-run `node scripts/extract-line-icon-usage.js` and `node scripts/verify-loop-icon-system.js`.
3. Keep visual/a11y rules in `loop-icons.css` / `loop-icons.js` — not scattered in `lib.js`.
4. Line Awesome font subset in `main.css` may remain for un-upgraded edge pages; promoted surfaces use Lucide via the upgrader.
5. Lucide license: ISC (see [Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)).

## Pages wired

- `index.html`, `room.html` (main app)
- Auxiliary: `whip.html`, `speedtest.html`, `electron.html`, `devices.html`, `check.html`, `results.html`, `supports.html`

Other HTML routes still reference Line Awesome only if they do not load `loop-icons.js`.

## Accessibility

- Icons inside labeled controls → `aria-hidden="true"` on the upgraded node.
- Icon-only controls → `role="button"` + `aria-label` from `title` when needed.
- `MutationObserver` re-applies after `lib.js` toggles `className`.
