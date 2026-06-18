---
name: Loop Cam
description: Dark, task-first broadcast UI for camera, screen, and room flows
colors:
  canvas: "#171717"
  surface: "#404249"
  surface-raised: "#313338"
  border: "#4a4d55"
  text-primary: "#e8eaed"
  text-muted: "#a8b0bd"
  accent: "#64c04d"
  accent-blue: "#498dc2"
  link-dark: "#9ec7ee"
typography:
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  home-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "24px 20px 28px"
  panel-row:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  primary-action:
    backgroundColor: "{colors.accent}"
    textColor: "#111111"
    rounded: "{rounded.sm}"
    padding: "16px 20px"
---

# Design System: Loop Cam

## Overview

**Creative North Star: "The Control Room"**

Loop Cam is a broadcast tool, not a marketing site. The interface stays dark, quiet, and predictable so directors and performers can complete camera, screen, and room tasks without visual noise. Lucide icons render inside upstream Line Awesome hooks; layout and spacing live in `loop-ui.css`, icon sizing in `loop-icons.css`, and upstream chrome in `main.css`.

**Key characteristics:**

- Dark canvas with raised grey surfaces and a single green primary action
- Full-width expanded flows with a centered content column (~480–560px)
- Setting rows as bordered panels, not nested shadow boxes
- 44px touch targets on footer utilities and close controls
- Restrained motion (160ms ease-out); respects `prefers-reduced-motion`

## Colors

### Primary

- **Loop Green** (#64c04d): Start buttons, live URL accent, mic meter glow. Used for primary actions only.

### Neutral

- **Canvas** (#171717): Page background, expanded flow backdrop, header during live sessions.
- **Surface** (#404249): Home cards, modal shell (`--discord-grey-7`).
- **Surface Raised** (#313338): Device/settings rows, inputs (`--discord-grey-5`).
- **Border** (#4a4d55): Panel outlines, footer pill border, modal border.
- **Text Primary** (#e8eaed): Headings, labels, body on dark (`--discord-text`).
- **Text Muted** (#a8b0bd): Secondary copy, placeholders, footer icons at rest.

### Secondary

- **Link Blue** (#9ec7ee): Inline links in dark UI (`--a-dark-link`).
- **Accent Blue** (#498dc2): Sliders, focus accents in dark theme (`--accent-color`).

### Named Rules

**The One Green Rule.** Green is for go/live actions and active stream URLs. Do not use it for decorative icons or inactive chrome.

**The Flat Panel Rule.** Setting rows use one border and one background. No nested box-shadow cards inside expanded flows.

## Typography

**Body Font:** system-ui stack  
**Character:** Neutral sans, medium weight for titles, regular for body. No display-serif pairing.

### Hierarchy

- **Flow title** (600, 1.35rem, -0.02em letter-spacing): Sticky title on expanded home cards.
- **Home card title** (600, 1.05rem): Card labels on the landing grid.
- **Panel label** (600, 0.9375rem): Video Source, Audio Source(s), etc.
- **Body** (400, 1rem, 1.45 line-height): Form copy, modal text, info lists.
- **Caption** (400, 0.875rem): Footer links, permission help, “Things to Note”.

**The 65ch Rule.** Long prose blocks (room description, tips) should not exceed ~65–75 characters per line when possible.

## Elevation

Loop Cam uses tonal layering, not decorative shadows. Depth comes from surface color steps (canvas → surface → raised) and 1px borders. Modals and the control bar may use a single soft shadow; home cards and setting rows do not stack shadows.

### Shadow Vocabulary

- **Control bar** (`0 4px 16px rgb(0 0 0 / 0.45)`): Floating toolbar over video.
- **Modal** (`0 12px 40px rgb(0 0 0 / 0.45)`): Permission and alert dialogs only.

**The Flat-By-Default Rule.** Surfaces at rest are flat. Shadow appears only on floating chrome (toolbar, modal).

## Components

### Home cards

- **Layout:** 2-up grid (Room + Camera) with Screen centered below; 3-up row at ≥960px. Order: Room → Camera → Screen.
- **Shape:** 16–20px radius, Lucide icon centered below title via `.loop-home-card-icon`.
- **Background:** `{colors.surface}` on `{colors.canvas}`.

### Expanded flow overlay

- Full viewport, sticky centered title, max-width column 560px.
- Circular close control top-right (44px), `.outer.close`.

### Setting panels

- Icon + label header; controls in flex rows (select + gear, multiselect + chevron).
- Width: `min(480px, calc(100vw - 32px))`.

### Control bar

- Lucide toggles in `--loop-toolbar-cell` (45px) cells; white icon stroke; mic glow via `--mic-level` on `.mic-meter`.

### Footer utility cluster

- Fixed bottom-right pill (`.loop-footer-bar`) with 44px icon buttons: language, calendar, help, report.

### Buttons

- **Primary (`.gowebcam`, `.gobutton`)**: Green fill, dark text, full-width in expanded flows up to panel width.
- **Ghost/icon**: Footer and gear affordances use muted icon color, raised background on hover.

## Do's and Don'ts

### Do:

- **Do** use tokens from `loop-ui.css`, `loop-icons.css`, and `main.css` overrides — not one-off hex in HTML.
- **Do** keep upstream `las la-*` class hooks in markup; upgrade to Lucide at runtime.
- **Do** align gears, chevrons, and selects on one flex row in setting panels.
- **Do** use the Loop permission modal copy (`loopCamPermissionDeniedHtml`) instead of upstream screenshots.

### Don't:

- **Don't** show vdo.ninja-branded permission screenshots or site-specific exception paths in Loop UI copy.
- **Don't** nest bordered/shadow cards inside expanded flow panels.
- **Don't** use side-stripe accent borders on tips (use full border + tinted background).
- **Don't** float oversized gear icons outside their panel row.
- **Don't** use green for non-action decorative elements.
