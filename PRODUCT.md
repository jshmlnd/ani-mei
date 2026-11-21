# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Jimei, for whom the site was built as a personal gift, and possibly a few friends. They come to watch anime and read manhwa/manga for fun, on a phone and on a laptop or TV browser about equally.

## Product Purpose
Animei is a personal place to find and watch anime episodes and read manhwa, with no sign-up. It works when Jimei can open it, find something, and press play (or start reading) in a few taps, on any device.

## Positioning
It is made for one person. The dedication to Jimei is the reason the site exists, not a marketing line, so no public streaming site can copy that.

## Operating Context
- Routes: landing (`/`), browse home (`/browse`), watch (`/anime/:id`), search (`/search`, with anime and manhwa tabs), genres (`/genres`, `/genres/:genre`), manhwa (`/manhwa`, reader at `/manhwa/read/:hid/:chapterId`), 18+ section (`/hentai`).
- Watch page: HLS video player with server/track selection, subtitles, playback speed, quality, picture-in-picture, keyboard shortcuts, intro/outro data, and episode navigation.
- Content and images come from third-party APIs and CDNs (AniList, MangaDex, a stream worker), so artwork varies in quality and sometimes fails to load.

## Capabilities and Constraints
- React 19 + Vite + Tailwind v4. UI primitives come from the cult-ui shadcn registry in `src/components/ui/`.
- Deployed via Vercel, Heroku (`server.js`) or Cloudflare Pages.
- The 18+ section is behind an age gate and kept apart from the main browse flow.

## Brand Commitments
- Name: Animei.
- The landing dedication "Made for my, Jimei" and the footer love notes stay as written.
- Pink accent (#ffb6d5, deep #f78fb8) stays.

## Evidence on Hand
- Logo files in `src/assets/` (animei.png, animeiV2.png, animei-ico.svg); the user did not make these binding.
- No testimonials, user counts or claims exist; none may be invented.

## Product Principles
1. Getting from opening the site to playing an episode is the job; everything else serves it.
2. It should feel personal and made with care, not like a generic streaming clone.
3. Works the same on phone and big screen.
4. Third-party artwork is the content; the UI frames it and never fights it.
