---
name: Animei
description: A personal anime and manhwa streaming app, built bead by bead like a perler-bead sprite.
colors:
  ramp-0-ink: "#0e0814"
  ramp-1-pegboard: "#170e1f"
  ramp-2-panel: "#22152d"
  ramp-3-raised: "#2f1f3d"
  ramp-4-peg-line: "#463357"
  ramp-5-muted: "#9883ab"
  ramp-6-soft: "#c9b9d6"
  ramp-7-paper: "#fbf3ff"
  bead-pink: "#ffb6d5"
  bead-pink-deep: "#f78fb8"
  airing-mint: "#8fe3c8"
  warn-amber: "#ffd27a"
  error-red: "#ff8a8a"
typography:
  display:
    fontFamily: "DotGothic16, MS Gothic, ui-monospace, monospace"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1.15
  headline:
    fontFamily: "DotGothic16, MS Gothic, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "DotGothic16, MS Gothic, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "DotGothic16, MS Gothic, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DotGothic16, MS Gothic, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: "0px"
  bead: "50%"
spacing:
  bead-gap: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bead-pink}"
    textColor: "{colors.ramp-0-ink}"
    rounded: "{rounded.none}"
    padding: "4px 24px 6px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.bead-pink-deep}"
    textColor: "{colors.ramp-0-ink}"
  button-secondary:
    backgroundColor: "{colors.ramp-3-raised}"
    textColor: "{colors.ramp-7-paper}"
    rounded: "{rounded.none}"
    padding: "4px 24px 6px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.ramp-4-peg-line}"
  button-disabled:
    backgroundColor: "{colors.ramp-1-pegboard}"
    textColor: "{colors.ramp-5-muted}"
  panel:
    backgroundColor: "{colors.ramp-2-panel}"
    textColor: "{colors.ramp-6-soft}"
    rounded: "{rounded.none}"
    padding: "32px"
  poster-card:
    backgroundColor: "{colors.ramp-2-panel}"
    textColor: "{colors.ramp-7-paper}"
    rounded: "{rounded.none}"
    padding: "6px"
  nav-bar:
    backgroundColor: "{colors.ramp-2-panel}"
    textColor: "{colors.ramp-6-soft}"
    height: "64px"
  input-search:
    backgroundColor: "{colors.ramp-1-pegboard}"
    textColor: "{colors.ramp-7-paper}"
    rounded: "{rounded.none}"
    padding: "10px 40px"
  bead:
    backgroundColor: "{colors.bead-pink}"
    rounded: "{rounded.bead}"
    size: "14px"
  bead-hollow:
    backgroundColor: "{colors.ramp-4-peg-line}"
    rounded: "{rounded.bead}"
    size: "14px"
---

# Design System: Animei

## Overview

**Creative North Star: "The Bead Board"**

Animei is drawn the way a fan builds a perler-bead sprite for someone: one bead at a time, on a dark plum pegboard. The shell stays plainly a streaming app (top nav, a spotlight, poster grids, a player) and is square, flat and solid. The world enters through four things only: one 8-step plum ramp, one pink bead accent, pixel type everywhere, and the bead itself as the single round object, used as a state marker.

Density is moderate and grid-snapped. Posters are third-party artwork and carry the colour; the UI frames them in square plum mats and never competes. Motion is stepped, like sprite frames, never eased glides. The deliberate rejection is the streaming-clone look: no giant blurred hero banner, no glowing glass cards, no gradient type.

The signature is the bead strip: episodes and chapters as beads on a peg row. It is the episode selector on Watch, the progress mark on the spotlight, the carousel pager, and the loading indicator.

**Key Characteristics:**
- One plum ramp (r0 to r7) for every neutral; no free opacities.
- Pink bead as the only accent; deep pink for hover and pressed.
- DotGothic16 at weight 400 for all text, smoothing off.
- Zero radius everywhere except beads.
- States read without colour: hollow, filled, lit ring, struck through.
- Stepped motion (`steps()` timing) for every keyframe.

## Colors

A dark, low-chroma plum ramp with one warm pink bead and a few narrowly scoped state colours.

### Primary
- **Bead Pink** (`bead-pink`): the only accent. Filled beads, the primary button, the active nav item and its underline bar, the "mei" in the wordmark, the dotted poster frame on hover, focus outlines, selection, caret, and range/checkbox accents.
- **Deep Bead Pink** (`bead-pink-deep`): pressed and hover state of pink surfaces, and the 4px bead edge under the primary button.

### Secondary
- **Airing Mint** (`airing-mint`): "airing now" state only (the next-episode badge and its mint bead on poster cards). Never decorative.

### Neutral
- **Ink** (`ramp-0-ink`): 4px borders on panels, cards, buttons and the nav; text on pink; the only scrim colour over artwork.
- **Pegboard** (`ramp-1-pegboard`): page background, input background, the bead's centre hole, disabled button ground.
- **Panel** (`ramp-2-panel`): nav bar, panels, poster mats, dropdowns.
- **Raised** (`ramp-3-raised`): secondary buttons, active nav ground, row hover, inner panel hairline.
- **Peg Line** (`ramp-4-peg-line`): hollow beads, passed beads, input and outline-button borders, scrollbar thumb.
- **Muted** (`ramp-5-muted`): meta text, placeholders, episode numbers at rest, disabled label.
- **Soft** (`ramp-6-soft`): secondary text, synopses, panel body text.
- **Paper** (`ramp-7-paper`): primary text and titles.

### State text
- **Warn Amber** (`warn-amber`) and **Error Red** (`error-red`): text, icon and 1px border colour on messages that carry warning or failure meaning (stream unavailable, server error, manhwa source notices). Never fills, never decoration.

### Named Rules
**The One Ramp Rule.** Every neutral is one of the eight ramp steps. Tailwind's neutral, stone and indigo scales are remapped onto the ramp and the pink so third-party components land in-world; do not introduce new greys or alpha tints.

**The Scrim Rule.** Smooth gradients exist only as an ink (`ramp-0-ink`) to transparent scrim where text or controls sit on artwork: the player control bar and title bar, and poster hover overlays. Beads (radial fill) and the loading stripe are hard-stop gradients and do not count.

## Typography

**Display Font:** DotGothic16 (with MS Gothic, ui-monospace, monospace)
**Body Font:** DotGothic16, same stack

**Character:** a single Japanese dot-matrix face at one weight. Hierarchy comes from size and ramp colour, never weight, gradient or italics. Font smoothing is off so the dots stay crisp; the font loads with `display=block` to avoid a fallback flash.

### Hierarchy
- **Display** (400, 1.5rem to 2.75rem responsive, 1.15): spotlight show title.
- **Headline** (400, 1.25rem to 1.5rem, 1.25): section headings, preceded by a 12px lit bead marker.
- **Title** (400, 1.125rem / 0.875rem on cards, snug): panel titles, poster card titles (2-line clamp).
- **Body** (400, 1rem / 0.875rem, 1.6): synopses capped at 65ch and clamped to 3 lines.
- **Label** (400, 0.75rem, tabular numerals): episode numbers, meta, counts, scores.

### Named Rules
**The One Weight Rule.** Everything is weight 400. Emphasis is size or colour (paper, or pink for a single accent line such as the romaji title).

**The Tabular Count Rule.** Episode numbers, scores, times and counts use tabular numerals so bead rows and meta lines do not jitter.

## Layout

Content sits in a centred 80rem (`max-w-7xl`) column with 16px gutters on phones and 24px from 640px. A fixed 64px nav bar sits on top; pages pad 64px below it.

The home spotlight is a boxed panel: a 3:4 poster (180px at 640px, 220px from 768px) at left and title, meta, synopsis, bead strip and buttons at right. From 1024px a 320px side column ("Continue for Jimei", "Also trending") sits beside it. Poster rows are square grids of 2, 3, 4 and 6 columns with 12px to 16px gaps, or horizontal scroll rows of 140px to 170px cards.

Spacing follows an 8px rhythm (8, 16, 24, 32), with 6px between beads in a strip.

**Phone (<640px):** the spotlight stacks the poster (128px wide) above the text and hides the synopsis; carousel arrows hide, leaving the bead pager; the player hides 10-second skip, the volume slider and the top title bar; nav links move into a menu panel below 768px.

## Elevation & Depth

Flat. There are no drop shadows. Depth is tonal layering on the ramp (pegboard, then panel, then raised) separated by 4px ink borders, with a 2px raised-tone hairline inside panels. The only `box-shadow` uses are structural: the inset 4px bead edge at the bottom of buttons, and the 2px gap plus 2px pink ring of a lit bead.

### Named Rules
**The Ink Frame Rule.** Separation comes from a 4px ink border, never a shadow or blur.

## Shapes

Square everywhere (0px radius, enforced globally on buttons and inputs). The bead (50%) is the only round shape in the world, which is why it can carry state. Beads are drawn as radial gradients: a filled bead is a pink disc with an ink centre hole; a hollow bead is a peg-line ring; a passed bead is a peg-line disc. Bead size is a fixed ramp: 14px in selectors and pagers, 12px in read-only strips and heading markers, 8px in badges.

Poster frames are 4px solid ink at rest and switch to 4px dotted pink on hover and focus, reading as a ring of beads.

## Components

### Buttons
Flat blocks with a bead edge.
- **Shape:** square (0px), 2px ink outline.
- **Primary:** bead pink with ink label and a 4px inset deep-pink bottom edge; heights 36, 44 and 48px.
- **Hover / Active:** hover fills deep pink; press sinks 2px and the edge shrinks to 2px.
- **Secondary:** raised plum with paper label, 4px panel-tone bottom edge, hover to peg line. **Minimal** is panel tone with soft label.
- **Disabled:** hollow pegboard block, peg-line border, muted label struck through with a 2px line. Never just dimmed.
- **Focus:** 2px pink outline, 2px offset.

### Chips / Badges
- **Format badge:** raised plum, pink text, 1px peg-line border.
- **Score:** a bead sized by score (12px at 85 and above, 9px at 75 and above, 6px below) beside the number.
- **Airing:** ink ground, mint text, 8px mint bead.
- **Range tabs:** square 2px ink-bordered tabs; selected is pink with ink text.

### Cards / Containers
- **Panel (TextureCard):** panel tone, 4px ink border, 2px raised hairline inside, soft text.
- **Poster card (MinimalCard in a frame):** 6px panel mat around a 3:4 poster; the frame lights as a dotted pink border on hover and focus; title turns pink on hover. Loading shows a stepped two-tone stripe shimmer; failed artwork shows an icon and the title on raised plum.

### Inputs / Fields
- **Style:** square, 1px raised-tone (nav) or 2px peg-line border, pegboard ground, pink caret, muted placeholder.
- **Focus:** border to pink, ground to raised.

### Navigation
- 64px panel bar with a 4px ink bottom border. Wordmark at left ("ani" paper, "mei" pink), links at 0.875rem soft text, square search at right with a `/` key hint.
- **Active:** pink text on raised ground with a 20x4px pink bar under it.
- **Mobile:** links move into a stacked panel under a menu button.

### Bead Strip (signature)
Episodes and chapters are beads on a peg row.
- **States:** hollow at rest (not yet opened), filled pink (opened on this device), lit (filled with a pink ring) for the current one. "Opened" comes from per-device local progress, not confirmed viewing, so labels say "opened", never "watched".
- **Selector (Watch):** a scrollable grid of 8, 10 or 14 columns, each bead over its number; ranges of 100 split into tabs; hovering a hollow bead fills it.
- **Read-only strip (spotlight):** up to 28 beads at 12px; long shows fold several episodes into one bead.
- **Pager:** carousel slides as hollow beads, current lit.
- **Loading:** five beads drop onto the row one after another in stepped frames.

### Icons
Pixel icons (pixelarticons) only, at 16 to 20px, matching the dot type.

## Do's and Don'ts

### Do:
- **Do** take every neutral from the r0 to r7 ramp and every accent from the pink pair.
- **Do** use the bead as the only round shape, and give each bead a state meaning.
- **Do** make states readable without colour: hollow, filled, lit ring, struck through.
- **Do** frame panels and cards with a 4px ink border and keep corners square.
- **Do** use `steps()` timing for keyframe motion and respect reduced motion.
- **Do** keep mint for airing state and amber/red for warning and error text only.

### Don't:
- **Don't** use drop shadows, blur, glass or glow; depth is tone plus ink borders.
- **Don't** set type in any face but DotGothic16 or in any weight but 400.
- **Don't** use smooth decorative gradients; the only gradients are the ink scrim under text on artwork, the bead's own radial fill, and the hard two-tone loading stripe.
- **Don't** round a corner on anything that is not a bead.
- **Don't** show a disabled control only by dimming it.
- **Don't** call opened episodes "watched".
