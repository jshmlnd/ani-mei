---
version: 1
slug: "src-pages-home-jsx"
primary_target: "src/pages/Home.jsx"
related_targets: ["src/App.jsx","src/pages/Watch.jsx","src/pages/Search.jsx","src/pages/Genres.jsx","src/pages/Landing.jsx","src/pages/ManhwaRead.jsx","src/components/Manhwa.jsx","src/components/Hentai.jsx"]
---

# Animei app shell (browse, watch, search, genres, manhwa, reader, 18+, landing)

Mode: Operate (landing `/` is the one Persuade-leaning page; it keeps the Jimei dedication).
Job: get Jimei from opening the site to playing an episode or reading a chapter in a few taps, on phone and big screen.
Constraints: pink accent #ffb6d5 / #f78fb8 kept; "Made for my, Jimei" and footer love notes kept verbatim; all player functions, keyboard shortcuts and the 18+ age gate unchanged.

## Direction contract

THESIS: Animei is made bead by bead for Jimei, like a fan's perler-bead sprite. It refuses the streaming-clone arrangement of a giant blurred hero banner and glowing glass cards: the shell is square, flat and plainly a streaming app, and the world enters through type, palette, density and one signature move.

OWN-WORLD: Dark plum pegboard ground snapped to one 8-step plum ramp (no free opacities); pink #ffb6d5 bead as the only accent, deep pink #f78fb8 for pressed, mint #8fe3c8 for "new/airing" state only. Pixelify Sans everywhere (600 headings, 400 text). Zero border radius except beads; 4px square borders in the darkest ramp step; buttons are flat blocks with a 4px bottom bead-edge. States read without colour: hollow at rest, filled on, crossed out when unavailable, ringed on focus. Hierarchy for score uses a fixed bead-size ramp.

STORY: Jimei sees what to watch next, knows how far she is in a show at a glance, and presses play.

FIRST VIEWPORT: 64px nav bar (logo, Home/New/Latest/Completed/Manhwa/Genres, square search at right). Below, spotlight panel: poster at left in a dotted pink bead frame, title, meta, synopsis, Play button (pink block) and Details, then the episode bead strip. Poster rows below in a square grid.

SIGNATURE MOVE: the bead strip. Episodes and chapters are beads on a peg row: watched filled pink, current lit with a pink ring, upcoming hollow. It is the episode selector on Watch, the progress mark on the spotlight, and the loading indicator (beads dropping in one by one).

FORM: Bead Board, candidate 6 of 7 on my ordered list (1 JRPG menu, 2 visual novel, 3 Game Boy Color palette, 4 arcade high score, 5 purikura sticker booth, 6 perler bead pegboard, 7 Tamagotchi LCD). seed:976dd517ad41f9e3

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
