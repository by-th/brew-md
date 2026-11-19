# brew.md — a garden to study in

A sunlit garden sanctuary for focus. Open it and you drop into a painterly
courtyard: a large serif clock, drifting petals, breathing light, an ambience
mixer, and a scene selector. No account, no friction — your garden saves itself
to the browser.

Built with **Vite + React + TypeScript** (pure CSS, no UI framework). No
backend, no auth. State lives in `localStorage`.

The visual design is implemented from a Claude Design handoff (the "garden study
sanctuary" direction) on top of a hand-built, production-quality React app.

> Media status: the seven scenes ship as still painted art. The background also
> supports looping **video** per scene (drop files in and fill the manifest —
> see below). Sound is **fully working and fully generative** — every ambience
> layer and the music bed are synthesized in the browser with the Web Audio API,
> so no audio files are bundled and it works offline.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build              # production build → dist/
npm run preview           # serve the production build
npm run typecheck         # tsc --noEmit
npm run optimize:scenes   # regenerate webp posters/thumbs from /Scenes
```

Requirements: Node 20+.

---

## What's in it

- **Scene** — a garden graded into four times of day (Afternoon, Golden Hour,
  Twilight, Morning Mist) plus three painterly worlds (Floating Isles, Old
  Harbour, Lantern Town). Soft crossfade, breathing zoom, sun bloom, drifting
  petals, and gentle pointer parallax.
- **Clock** — the centerpiece, draggable anywhere on desktop, with four faces:
  **Serif**, **Minimal**, **Analog** (botanical dial), **Poetic** (greeting +
  a line for the hour).
- **Ambience** — generative track with play/cycle, master volume + mute, and a
  six-layer sound mixer (Pond Water, Songbirds, Wind, Rain, Chimes, Crickets).
- **Preferences** — clock face, your name (for the greeting), 12/24-hour, panel
  finish (**Glass** / **Stone**), motion (**Still** / **Gentle** / **Lively**),
  sunlight accent colour, display font (Cormorant / Playfair), and layout reset.
- **Dock + floating panels** — Scenes / Sounds / Preferences open as draggable
  glass (or stone) panels; on mobile they become bottom sheets and the dock
  spans the bottom.

Everything persists under `brew-md:v2:preferences`. Reset from Preferences.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause ambience |
| `S` | Scenes |
| `T` | Sounds |
| `Esc` | Close panels |

---

## Media

### Where it lives

- **Empty `VITE_MEDIA_BASE_URL`** → served from `/public`
  (`public/scenes/<id>/poster.webp`).
- **Set `VITE_MEDIA_BASE_URL`** (e.g. `https://cdn.brew.md`) → the same paths
  are requested from a CDN, so large videos never bloat the repo.

### Optimizing scene art

Source art lives in `/Scenes` (the garden grades are in `/Scenes/garden`).
`scripts/optimize-scenes.mjs` (uses [`sharp`](https://sharp.pixelplumbing.com/),
prebuilt binaries — no `ffmpeg`/`cwebp` needed) emits web-ready webp:

```bash
npm run optimize:scenes
# → public/scenes/<id>/poster.webp  (≤2560w, q80)
# → public/scenes/<id>/thumb.webp   (480w,  q72)
```

### Adding a real video to a scene

The background renders a looping `<video>` when a scene has sources, and falls
back to the poster otherwise.

1. Place files at `public/scenes/<id>/720.mp4` and `1080.mp4` (or upload to your
   CDN under the same paths).
2. Fill `sources` for that scene in [`src/data/scenes.ts`](src/data/scenes.ts):
   ```ts
   sources: {
     mobileMp4:  mediaUrl('/scenes/<id>/720.mp4'),
     desktopMp4: mediaUrl('/scenes/<id>/1080.mp4'),
   },
   ```

The video autoplays muted/looped over the poster; reduced-motion users keep the
still.

### How the sound works

Audio is generated live by [`src/audio/engine.ts`](src/audio/engine.ts) — a
single Web Audio graph, no files:

- **Ambience layers** — Pond Water (filtered brown noise + droplets), Songbirds
  (scheduled chirp phrases), Wind (LFO-swept noise), Distant Rain (band-limited
  noise), Wind Chimes (pentatonic bells), Evening Crickets (trilled bursts).
- **Music bed** — a slow evolving pad; each of the five tracks picks a different
  root/scale/timbre, so cycling tracks changes the mood.
- Everything routes through a master bus (volume × mute) and a soft compressor.
  Play gates the whole soundscape; layer toggles/sliders adjust the mix live.

[`src/audio/SoundEngine.tsx`](src/audio/SoundEngine.tsx) mirrors the ambience
preferences into the engine and unlocks the `AudioContext` on first gesture
(autoplay policy). The state (`playing`, `master`, `muted`, `track`, `layers[]`)
lives in the preferences store. To use **recorded** loops instead, give each
layer a looping `<audio>`/buffer source at gain `layer.vol × master` and gate it
the same way.

### Adding a new scene

1. Drop the image in `/Scenes`, add an entry to `SCENES` in
   [`scripts/optimize-scenes.mjs`](scripts/optimize-scenes.mjs), run
   `npm run optimize:scenes`.
2. Add a `scene(...)` entry in [`src/data/scenes.ts`](src/data/scenes.ts).

---

## Deploying to Netlify

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** 20 (set in `netlify.toml`)

`netlify.toml` includes the SPA redirect and cache headers. Set the `VITE_*`
variables in the Netlify UI if you use a CDN. Recommended domains: `brew.md`
(frontend) + `cdn.brew.md` (media).

---

## Project layout

```
src/
  app/App.tsx              root: scene + clock + dock + panels
  components/
    scene/GardenScene      background, scrim, sun bloom, petals, parallax
    clock/                 four clock faces + draggable widget
    dock/Dock              now-playing + scenes/sounds/preferences
    panels/                FloatingPanel + Scenes / Ambience / Preferences
    icons.tsx, Brand, Hint
  data/      scenes.ts · tracks.ts (manifests)
  hooks/     usePreferences (store) · useUI · useDrag · useClock · media-query
  lib/       preferences schema · localStorage · time helpers · media
  styles/globals.css       the whole garden theme (tokens, panels, FX)
scripts/   optimize-scenes.mjs (sharp)
public/    favicon, manifest, scenes/<id>/{poster,thumb}.webp
```
