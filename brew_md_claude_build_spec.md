# brew.md — Claude Code Build Specification

## 0. Executive Summary

Build `brew.md` as an instantly accessible, cinematic study environment.

The product is a browser-based lofi/focus site with AI-generated animated scenery, AI-generated music, a beautiful clock, draggable/configurable widgets, and local preference persistence. It should feel premium, fast, calm, and visually insane without requiring login, payment, or onboarding.

Hosting target:

- **Frontend:** Netlify
- **Media:** External media CDN/storage, not bundled into the Netlify repo
- **Persistence:** Browser `localStorage`
- **Backend:** None for V1
- **Auth:** None for V1

Core V1 promise:

> Open brew.md and within one second see a beautiful animated study world, a clean clock, and one obvious play button. The user can change the scene, change the music, adjust volume, move/hide widgets, and their setup persists in the same browser.

---

## 1. Product Vision

### 1.1 What brew.md is

`brew.md` is a super minimal, visually premium, AI-generated study room. It should feel like a high-end cinematic lofi page, but faster, cleaner, more configurable, and more instantly usable.

It combines:

- Full-screen looping AI scenery videos
- AI-generated ambient/lofi/focus music
- Clean clock and study widgets
- Draggable desktop layout
- Mobile-friendly compact controls
- Local preference saving
- No account requirement
- Fast load and low-friction usage

### 1.2 Desired feeling

The site should feel:

- Cinematic
- Calm
- Fast
- Clean
- Expensive
- Minimal
- Customizable but not cluttered
- More like an interactive ambient operating system than a normal webpage

This is not a content-heavy site. It is an atmosphere-first product.

### 1.3 The main user flow

1. User opens `brew.md`.
2. Poster image appears instantly.
3. Background video starts muted and looping.
4. Beautiful clock appears centered or subtly positioned.
5. User clicks one large play button to start music.
6. User can open controls to change scene/music/volume/widgets.
7. User can move widgets on desktop.
8. Site saves preferences locally.
9. User returns later and their setup is restored.

---

## 2. V1 Scope

### 2.1 Must-have features

V1 must include:

1. Full-screen video background
2. Responsive source selection for desktop/mobile
3. Poster image fallback while video loads
4. Music player with play/pause
5. Volume slider
6. Mute/unmute
7. Scene selector
8. Music selector
9. Beautiful live clock
10. Optional Pomodoro/focus timer widget
11. Simple draggable widgets on desktop
12. Mobile-safe layout with bottom-sheet controls
13. Browser preference persistence through `localStorage`
14. Reset preferences button
15. Netlify deployment config
16. Clean, production-level responsive design

### 2.2 Nice-to-have V1 features

Include if easy, but do not compromise the core:

1. Crossfade between audio tracks
2. Crossfade between video scenes
3. Ambient effects mixer: rain, wind, fireplace, city hum
4. Quote widget
5. Session timer
6. Todo widget
7. Keyboard shortcuts
8. Reduced-motion mode
9. Data-saver mode
10. PWA install metadata

### 2.3 Explicit non-goals for V1

Do not build these in V1:

- User accounts
- Cloud sync
- Payments
- Public profiles
- Upload-your-own video
- Social features
- Complex playlists
- Backend database
- Admin dashboard
- AI generation inside the app
- User-generated content moderation

V1 should be static, fast, and focused.

---

## 3. Recommended Technical Stack

### 3.1 Framework

Use:

- **Vite + React + TypeScript**

Reason:

- Fast local development
- Excellent Netlify compatibility
- Static output to `dist`
- Lower complexity than Next.js for this V1
- No backend/SSR required

### 3.2 Styling

Use:

- **Tailwind CSS**
- CSS variables for theme tokens
- Minimal custom CSS for glassmorphism, blur, gradients, and transitions

### 3.3 State management

Use simple local React state plus small hooks.

Optionally use:

- `zustand` for global app preferences

Recommended:

- Use `zustand` only if it makes implementation cleaner.
- Keep state simple and explicit.

### 3.4 Dragging

Use:

- `@dnd-kit/core`

Desktop only. On mobile, disable free dragging and use a controlled layout.

### 3.5 Icons

Use:

- `lucide-react`

### 3.6 Animation

Use:

- CSS transitions for most UI
- Optional `framer-motion` for panels/crossfades

Do not overanimate. The background is already visually rich.

### 3.7 Package target

Use:

- Node 20+
- npm or pnpm

Recommended commands:

```bash
npm create vite@latest brew-md -- --template react-ts
cd brew-md
npm install
npm install tailwindcss @tailwindcss/vite lucide-react @dnd-kit/core zustand clsx
```

If using Tailwind v4, use the current Vite plugin setup. If using Tailwind v3, use the standard `tailwind.config.js` flow. Claude Code should inspect package versions and use the correct configuration.

---

## 4. Hosting Architecture

### 4.1 Netlify responsibility

Netlify should host:

- HTML
- CSS
- JavaScript bundle
- Small static assets
- Favicons
- App manifest
- Small UI sounds if any
- Maybe small preview thumbnails

Netlify should not be the primary home for large video/audio files.

### 4.2 Media CDN responsibility

External media storage/CDN should host:

- `.mp4` background videos
- `.webm` background videos
- `.webp` posters
- `.mp3`, `.aac`, or `.ogg/.opus` audio loops
- Scene thumbnail images

Recommended media options:

1. **Cloudflare R2 + custom CDN domain** — best simple option
2. **Bunny CDN / Bunny Stream** — simple media delivery
3. **Mux** — best polished video infrastructure, more expensive/abstracted
4. **Cloudflare Stream** — good if adaptive streaming is wanted later

Recommended V1:

- Use Cloudflare R2 or Bunny CDN.
- Create `cdn.brew.md` later.
- For local development, use placeholder public URLs or local sample media.

### 4.3 Domain structure

Recommended:

```txt
brew.md          -> Netlify frontend
cdn.brew.md      -> media CDN
```

### 4.4 Netlify build config

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

### 4.5 Environment variables

Use `.env.example`:

```env
VITE_MEDIA_BASE_URL=https://cdn.brew.md
VITE_DEFAULT_SCENE_ID=midnight-library
VITE_DEFAULT_TRACK_ID=deep-focus-01
```

The app should work even if these are missing by falling back to static placeholder assets or manifest values.

---

## 5. Media Pipeline

The entire quality of this product depends on media discipline. Bad compression, bad loops, or slow first load will ruin the experience.

### 5.1 Source generation recommendation

Generate AI videos as high-quality masters.

Recommended AI master settings:

- Resolution: 4K if available, otherwise 1080p minimum
- FPS: 24 or 30
- Length: 10–20 seconds
- Camera movement: slow, subtle, seamless
- Loop: should visually loop with minimal jump
- Motion: ambient, not distracting
- Avoid text in the background video
- Avoid faces/characters as main focus unless intentionally part of scene
- Avoid flickering artifacts
- Avoid fast cuts

Best background categories:

1. Rainy Tokyo apartment at night
2. Floating library in clouds
3. Snow cabin with firelight
4. Deep ocean observatory
5. Cyberpunk cafe window
6. Ancient temple study room
7. Space station overlooking Earth
8. Train window through mountains
9. Cozy greenhouse in rain
10. Neon Seoul alley study desk

### 5.2 Export targets

For each scene, export:

```txt
scene-id/
  poster.webp
  thumb.webp
  720.mp4
  1080.mp4
  1080.webm        optional
  1440.mp4         optional high-quality mode
```

V1 required:

- `poster.webp`
- `720.mp4`
- `1080.mp4`

Optional:

- `1080.webm`
- `1440.mp4`

### 5.3 Video quality targets

Use these as practical targets:

| Variant | Resolution | FPS | Video bitrate target | Target file size for 15s loop |
|---|---:|---:|---:|---:|
| Mobile | 1280x720 | 24/30 | 1.5–3 Mbps | 3–7 MB |
| Desktop | 1920x1080 | 24/30 | 4–8 Mbps | 8–16 MB |
| High | 2560x1440 | 24/30 | 8–14 Mbps | 15–28 MB |
| Ultra | 3840x2160 | 24/30 | 18–35 Mbps | 35–70 MB |

Default should be:

- Mobile: 720p
- Desktop: 1080p

Do not default to 4K. Add a high-quality toggle later.

### 5.4 FFmpeg commands

Create a `scripts/encode-scene.sh` script eventually. For now, document commands.

Extract poster:

```bash
ffmpeg -i master.mov -ss 00:00:01.000 -frames:v 1 -vf "scale=1920:-1" poster.png
cwebp -q 82 poster.png -o poster.webp
```

Encode 1080p MP4:

```bash
ffmpeg -i master.mov \
  -vf "scale=1920:-2,fps=30" \
  -c:v libx264 \
  -preset slow \
  -crf 22 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  1080.mp4
```

Encode 720p MP4:

```bash
ffmpeg -i master.mov \
  -vf "scale=1280:-2,fps=30" \
  -c:v libx264 \
  -preset slow \
  -crf 23 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  720.mp4
```

Optional 1080p WebM:

```bash
ffmpeg -i master.mov \
  -vf "scale=1920:-2,fps=30" \
  -c:v libvpx-vp9 \
  -b:v 0 \
  -crf 32 \
  -an \
  1080.webm
```

Notes:

- `-an` removes audio from the background video.
- Audio should be separate.
- `+faststart` improves MP4 startup behavior.
- Use CRF tuning based on visual output.
- Always manually check loops.

### 5.5 Loop quality rules

Every video must pass these checks:

- No obvious hard cut at loop point
- No sudden lighting shift
- No deformed objects popping
- No text artifacts
- No faces morphing in distracting ways
- No fast movement that distracts from studying
- No generated UI/text in background
- No heavy flicker
- Looks good under slight blur/dim overlay

### 5.6 Audio generation/export

AI music should be calm and loopable.

Recommended track categories:

1. Deep focus
2. Rainy night lofi
3. Warm piano
4. Ambient synth
5. Library hum
6. Cyber cafe
7. Snow cabin
8. Soft jazz study

Recommended export:

```txt
track-id/
  preview.mp3       optional short preview
  full.mp3          required
  full.opus         optional
```

Audio specs:

- MP3: 128–192 kbps
- Opus: 96–160 kbps optional
- Length: 2–10 minutes preferred
- Loopable or crossfade-safe
- Normalize to consistent loudness
- Avoid vocals in default tracks
- Avoid sharp percussion/transients

Optional ambient SFX loops:

```txt
sfx/
  rain.mp3
  fireplace.mp3
  wind.mp3
  cafe-hum.mp3
  ocean.mp3
```

SFX mixer can be V1.5 if not trivial.

---

## 6. UX and Visual Design

### 6.1 First impression

The first screen must be extremely clean.

Default composition:

- Full viewport cinematic background
- Dark/soft gradient overlay for legibility
- Large elegant clock
- Small date/day line
- One clear music play button
- Minimal controls tucked in bottom/right corner

The user should not see a complicated settings panel on first load.

### 6.2 Visual language

Use:

- Glass panels
- Soft borders
- High blur
- Low opacity panels
- Subtle shadows
- White/cream text
- Minimal icons
- Smooth transitions
- No loud colors unless scene-specific

Avoid:

- Heavy dashboards
- Bright buttons
- Clutter
- Too many cards
- Default web app look
- Corporate SaaS feeling

### 6.3 Main screen layout

Desktop default:

```txt
┌─────────────────────────────────────────────┐
│                                             │
│                Background video             │
│                                             │
│                   10:42                     │
│              Sunday, June 7                 │
│                                             │
│                                             │
│  [Pomodoro]                         [Music] │
│                                             │
│        bottom controls / scene switcher     │
└─────────────────────────────────────────────┘
```

Mobile default:

```txt
┌───────────────────────┐
│                       │
│   Background video    │
│                       │
│        10:42          │
│    Sunday, June 7     │
│                       │
│                       │
│      [Play Button]    │
│                       │
│  bottom control pill  │
└───────────────────────┘
```

### 6.4 Controls

Primary controls:

- Play/pause
- Volume slider
- Mute
- Scene selector
- Track selector
- Settings button

Secondary controls:

- Show/hide clock
- Clock format: 12h/24h
- Show/hide Pomodoro
- Show/hide Todo
- Background dim amount
- Background blur amount
- Quality: auto/mobile/desktop/high
- Reset preferences

### 6.5 Scene selector UX

Scene selector should show:

- Thumbnail
- Scene name
- Mood tag
- Optional “new” badge

Example scenes:

```txt
Midnight Library       calm / rain
Snow Cabin             warm / fire
Tokyo Window           neon / city
Ocean Observatory      deep / blue
Cloud Monastery        ethereal / quiet
```

### 6.6 Music selector UX

Music selector should show:

- Track title
- Mood
- Duration if known
- Optional active state

Example tracks:

```txt
Deep Focus 01          ambient
Rainy Notes            lofi
Snowfall Piano         piano
Neon Study             synth
Library Air            minimal
```

---

## 7. Responsive Behavior

### 7.1 Desktop

Desktop should support:

- Draggable widgets
- Larger clock
- Floating glass panels
- Hover states
- Keyboard shortcuts
- Scene thumbnails in a panel

Screen width breakpoint:

- Enable dragging at `min-width: 768px`
- Disable dragging below `768px`

### 7.2 Mobile

Mobile should prioritize simplicity:

- No arbitrary dragging
- Clock centered
- Bottom control pill
- Full settings as bottom sheet
- Scene selector scrolls horizontally
- Volume slider in bottom sheet
- Large touch targets

Touch target minimum:

- 44px height/width

### 7.3 Orientation

Landscape mobile should avoid breaking. Use safe-area insets.

CSS:

```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

### 7.4 Reduced motion

Respect `prefers-reduced-motion`:

- Disable non-essential UI animations
- Optionally use poster-only mode instead of video autoplay
- Keep audio controls available

---

## 8. Data Models

### 8.1 Scene manifest

Create `src/data/scenes.ts`:

```ts
export type SceneMood = 'calm' | 'rain' | 'night' | 'warm' | 'cyber' | 'nature' | 'space' | 'ocean' | 'fantasy';

export type Scene = {
  id: string;
  title: string;
  subtitle: string;
  mood: SceneMood[];
  poster: string;
  thumb: string;
  sources: {
    mobileMp4: string;
    desktopMp4: string;
    desktopWebm?: string;
    highMp4?: string;
  };
  overlay?: {
    defaultDim: number;
    defaultBlur: number;
  };
};

export const scenes: Scene[] = [
  {
    id: 'midnight-library',
    title: 'Midnight Library',
    subtitle: 'Rain against old glass, warm lamps, endless books.',
    mood: ['calm', 'rain', 'night'],
    poster: `${MEDIA_BASE_URL}/scenes/midnight-library/poster.webp`,
    thumb: `${MEDIA_BASE_URL}/scenes/midnight-library/thumb.webp`,
    sources: {
      mobileMp4: `${MEDIA_BASE_URL}/scenes/midnight-library/720.mp4`,
      desktopMp4: `${MEDIA_BASE_URL}/scenes/midnight-library/1080.mp4`,
      desktopWebm: `${MEDIA_BASE_URL}/scenes/midnight-library/1080.webm`,
      highMp4: `${MEDIA_BASE_URL}/scenes/midnight-library/1440.mp4`,
    },
    overlay: {
      defaultDim: 0.32,
      defaultBlur: 0,
    },
  },
];
```

Create a `MEDIA_BASE_URL` helper:

```ts
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || '';
```

If media URLs are empty in local dev, use `/sample-media/...` fallback assets.

### 8.2 Track manifest

Create `src/data/tracks.ts`:

```ts
export type TrackMood = 'lofi' | 'ambient' | 'piano' | 'rain' | 'synth' | 'jazz' | 'minimal';

export type Track = {
  id: string;
  title: string;
  artist?: string;
  mood: TrackMood[];
  src: string;
  durationLabel?: string;
};

export const tracks: Track[] = [
  {
    id: 'deep-focus-01',
    title: 'Deep Focus 01',
    mood: ['ambient', 'minimal'],
    src: `${MEDIA_BASE_URL}/music/deep-focus-01/full.mp3`,
    durationLabel: '∞',
  },
];
```

### 8.3 Widget model

Create:

```ts
export type WidgetId = 'clock' | 'pomodoro' | 'todo' | 'quote' | 'session';

export type WidgetConfig = {
  id: WidgetId;
  visible: boolean;
  x: number;
  y: number;
  locked?: boolean;
};
```

Coordinate system:

- Store positions as percentages, not pixels.
- Example: `{ x: 50, y: 42 }` means center-ish.
- Convert to CSS transform/absolute positioning.
- Clamp values so widgets cannot be permanently dragged off-screen.

---

## 9. Local Storage Persistence

### 9.1 Storage key

Use one key:

```ts
const STORAGE_KEY = 'brew-md:v1:preferences';
```

### 9.2 Preference schema

```ts
export type BrewPreferences = {
  version: 1;
  selectedSceneId: string;
  selectedTrackId: string;
  audio: {
    volume: number;       // 0 to 1
    muted: boolean;
    hasInteracted: boolean;
  };
  display: {
    clockFormat: '12h' | '24h';
    backgroundDim: number;   // 0 to 0.8
    backgroundBlur: number;  // 0 to 20
    quality: 'auto' | 'mobile' | 'desktop' | 'high';
  };
  widgets: Record<WidgetId, WidgetConfig>;
  pomodoro: {
    focusMinutes: number;
    breakMinutes: number;
    longBreakMinutes: number;
    soundEnabled: boolean;
  };
};
```

### 9.3 Defaults

```ts
export const defaultPreferences: BrewPreferences = {
  version: 1,
  selectedSceneId: import.meta.env.VITE_DEFAULT_SCENE_ID || 'midnight-library',
  selectedTrackId: import.meta.env.VITE_DEFAULT_TRACK_ID || 'deep-focus-01',
  audio: {
    volume: 0.65,
    muted: false,
    hasInteracted: false,
  },
  display: {
    clockFormat: '12h',
    backgroundDim: 0.32,
    backgroundBlur: 0,
    quality: 'auto',
  },
  widgets: {
    clock: { id: 'clock', visible: true, x: 50, y: 38 },
    pomodoro: { id: 'pomodoro', visible: true, x: 50, y: 62 },
    todo: { id: 'todo', visible: false, x: 78, y: 56 },
    quote: { id: 'quote', visible: false, x: 50, y: 76 },
    session: { id: 'session', visible: false, x: 20, y: 72 },
  },
  pomodoro: {
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    soundEnabled: true,
  },
};
```

### 9.4 Validation and migration

Do not blindly trust localStorage.

Implement:

- Safe JSON parse
- Schema fallback
- Version check
- Merge with defaults
- Ignore unknown fields
- Reset button

Pseudo:

```ts
export function loadPreferences(): BrewPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return defaultPreferences;
    return mergeWithDefaults(parsed);
  } catch {
    return defaultPreferences;
  }
}
```

### 9.5 Save behavior

- Debounce saves by 200–500ms.
- Save after scene change, track change, volume change, widget movement, visibility change, and settings change.
- Do not save constantly every animation frame while dragging; save on drag end.

---

## 10. Component Architecture

### 10.1 File structure

Recommended structure:

```txt
brew-md/
  public/
    favicon.svg
    manifest.webmanifest
    sample-media/
      scenes/
        midnight-library/
          poster.webp
          thumb.webp
          720.mp4
          1080.mp4
      music/
        deep-focus-01/
          full.mp3
  src/
    app/
      App.tsx
      Providers.tsx
    components/
      background/
        BackgroundVideo.tsx
        SceneSelector.tsx
        SceneCard.tsx
      audio/
        AudioPlayer.tsx
        VolumeControl.tsx
        TrackSelector.tsx
      controls/
        ControlDock.tsx
        SettingsPanel.tsx
        MobileBottomSheet.tsx
      widgets/
        ClockWidget.tsx
        PomodoroWidget.tsx
        TodoWidget.tsx
        QuoteWidget.tsx
        SessionWidget.tsx
        DraggableWidget.tsx
      ui/
        Button.tsx
        Slider.tsx
        GlassPanel.tsx
        IconButton.tsx
        Toggle.tsx
    data/
      scenes.ts
      tracks.ts
      quotes.ts
    hooks/
      useAudio.ts
      useClock.ts
      useMediaQuery.ts
      usePreferences.ts
      useReducedMotion.ts
      useResponsiveVideoSource.ts
    lib/
      constants.ts
      localStorage.ts
      preferences.ts
      clamp.ts
      cn.ts
    styles/
      globals.css
    main.tsx
    vite-env.d.ts
  netlify.toml
  package.json
  tsconfig.json
  README.md
```

### 10.2 `App.tsx` responsibility

`App.tsx` should orchestrate:

- Preferences loading
- Active scene
- Active track
- Background video
- Audio player
- Widget layer
- Controls layer
- Mobile/desktop behavior

High-level component tree:

```tsx
<App>
  <BackgroundVideo />
  <ScreenOverlay />
  <WidgetLayer>
    <ClockWidget />
    <PomodoroWidget />
    <TodoWidget />
    <QuoteWidget />
  </WidgetLayer>
  <ControlDock />
  <MobileBottomSheet />
  <AudioPlayer />
</App>
```

### 10.3 `BackgroundVideo.tsx`

Requirements:

- Full-screen fixed/absolute video
- Uses poster
- Muted autoplay loop playsInline
- Chooses source based on preferences and screen size
- Handles loading state
- Fades in video once ready
- Keeps previous scene visible briefly during scene transition if practical
- Does not include audio

Implementation details:

```tsx
<video
  key={scene.id + selectedQuality}
  className="absolute inset-0 h-full w-full object-cover"
  autoPlay
  muted
  loop
  playsInline
  poster={scene.poster}
  preload="auto"
  onCanPlay={() => setReady(true)}
>
  {scene.sources.desktopWebm && <source src={scene.sources.desktopWebm} type="video/webm" />}
  <source src={resolvedMp4Source} type="video/mp4" />
</video>
```

Quality resolution logic:

```ts
if quality === 'mobile' -> mobileMp4
if quality === 'desktop' -> desktopMp4
if quality === 'high' and highMp4 exists -> highMp4
if quality === 'auto':
  if width < 768 -> mobileMp4
  else -> desktopMp4
```

Data saver consideration:

- If `navigator.connection?.saveData` is true, prefer 720p or poster-only mode.

### 10.4 `AudioPlayer.tsx`

Requirements:

- Do not autoplay audible audio before user interaction.
- Start audio only after click/tap.
- Remember volume/mute preferences.
- If user previously interacted, still handle browser restrictions gracefully.
- Loop track.
- Show errors if audio fails.
- Use one `<audio>` element for V1.

Pseudo:

```tsx
<audio
  ref={audioRef}
  src={activeTrack.src}
  loop
  preload="metadata"
/>
```

Play behavior:

```ts
async function togglePlay() {
  if (!audioRef.current) return;
  try {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      await audioRef.current.play();
      setHasInteracted(true);
    }
  } catch (error) {
    setPlaybackBlocked(true);
  }
}
```

Track switching:

- Pause current track or crossfade if implemented.
- Set new `src`.
- If previously playing, attempt to play new track.

### 10.5 `ClockWidget.tsx`

Requirements:

- Beautiful large typography
- Updates every second or minute
- Displays date line
- Supports 12h/24h
- Optional seconds toggle later

Style:

- Large font size: responsive clamp
- Use tabular numbers
- Soft text-shadow
- No heavy panel by default

Example CSS:

```css
.clock-time {
  font-size: clamp(4rem, 14vw, 12rem);
  line-height: 0.9;
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
}
```

### 10.6 `PomodoroWidget.tsx`

V1 behavior:

- Focus duration default 25 min
- Break duration default 5 min
- Start/pause/reset
- Shows current phase
- Emits soft notification sound if enabled
- Does not require browser notification permission in V1

Display:

```txt
Focus
24:32
[Start] [Reset]
```

### 10.7 `TodoWidget.tsx`

Optional V1 / V1.1.

If included:

- Stored in localStorage
- Max 10 lightweight tasks
- Add/remove/complete
- No backend

Storage key can remain inside main preferences or separate:

```ts
brew-md:v1:todos
```

### 10.8 `ControlDock.tsx`

Desktop control dock:

- Bottom center or bottom right
- Glass pill
- Contains play/pause, volume, scene, music, settings
- Compact by default
- Expands on click

### 10.9 `MobileBottomSheet.tsx`

Mobile controls:

- Bottom pill always visible
- Tap opens sheet
- Sheet contains tabs or sections:
  - Sound
  - Scene
  - Widgets
  - Settings

Must use large touch targets.

---

## 11. Styling Requirements

### 11.1 Global CSS

Use:

```css
html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #050505;
}

body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}
```

### 11.2 Glass panel style

```css
.glass {
  background: rgba(10, 10, 12, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}
```

### 11.3 Overlay style

Use overlay to keep text readable:

```tsx
<div
  className="pointer-events-none absolute inset-0"
  style={{
    background: `linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,${backgroundDim}))`,
    backdropFilter: `blur(${backgroundBlur}px)`,
  }}
/>
```

### 11.4 Typography

Use system font first for performance.

Optional: load one premium display font later.

V1 should avoid large external font dependency unless it is cached/local and not blocking.

---

## 12. Interaction Rules

### 12.1 Autoplay

Background video:

- Can autoplay because it is muted.
- Must include `muted`, `playsInline`, `loop`, `autoPlay`.

Music:

- Must not assume autoplay works.
- User clicks/taps play.
- If browser blocks playback, show: “Tap to start audio.”

### 12.2 Keyboard shortcuts

Optional but recommended:

- Space: play/pause music, unless input focused
- M: mute/unmute
- S: open scene selector
- T: open track selector
- F: toggle focus mode
- Escape: close open panels

### 12.3 Focus mode

Focus mode should:

- Hide extra controls
- Keep clock/timer visible
- Allow mouse movement or tap to show controls again
- Not trap user

### 12.4 Widget dragging

Desktop only:

- Drag widgets by handle or whole panel
- Save position on drag end
- Clamp to viewport
- Add “lock layout” toggle
- Add reset layout button

Mobile:

- No free dragging
- Use fixed positions and visibility toggles

---

## 13. Performance Requirements

### 13.1 Performance budget

Target:

- Initial HTML/CSS/JS under 300 KB gzipped if reasonable
- First poster visible under 1 second on good connection
- First background video starts as soon as practical
- No layout shift from media loading
- No blocking third-party scripts
- No analytics in V1 unless extremely lightweight

### 13.2 Video loading strategy

On initial load:

- Load only selected scene
- Use poster instantly
- Do not preload all scenes
- Lazy-load thumbnails only when scene panel opens if needed
- Never auto-load 4K

### 13.3 Audio loading strategy

- Preload active track metadata
- Load full audio when user plays
- Do not preload all tracks

### 13.4 Memory management

When switching scenes:

- Ensure old video is unloaded after transition.
- Avoid keeping multiple videos alive.

When switching tracks:

- Avoid multiple playing audio elements unless crossfade is implemented deliberately.

### 13.5 Data saver

If browser data saver is detected:

- Prefer 720p
- Optionally show toggle: “Use animated background”
- Always keep poster usable

---

## 14. Accessibility Requirements

Even though this is visual-first, basic accessibility must be correct.

Requirements:

- Buttons have accessible labels
- Sliders have labels
- Keyboard navigation works for controls
- Escape closes modals/sheets
- Contrast is sufficient over background via overlay
- Reduced motion is respected
- Audio is user-controlled
- No auto-playing audible media
- Focus states visible

Example:

```tsx
<button aria-label={isPlaying ? 'Pause music' : 'Play music'}>
  {isPlaying ? <Pause /> : <Play />}
</button>
```

---

## 15. Error and Fallback States

### 15.1 Video fails

If video fails:

- Show poster image
- Show subtle message in settings only, not as intrusive error
- Allow user to select another scene

### 15.2 Audio fails

If audio fails:

- Keep UI usable
- Show small message: “Audio could not load. Try another track.”

### 15.3 localStorage unavailable

If localStorage fails:

- App still works
- Preferences just do not persist
- Do not crash

### 15.4 CDN missing

If CDN env var is missing:

- Use sample local media
- App should still build and run

---

## 16. Security and Privacy

V1 privacy story:

- No login
- No backend
- No personal data collection
- Preferences stored only in browser
- No cross-device sync

Security basics:

- Do not inject arbitrary HTML
- Do not allow remote config execution
- Keep media manifest static
- Avoid third-party scripts
- If analytics are added later, disclose it and keep minimal

---

## 17. Netlify Deployment Details

### 17.1 Build settings

Netlify settings:

```txt
Build command: npm run build
Publish directory: dist
Node version: 20
```

### 17.2 Environment variables in Netlify

Set:

```txt
VITE_MEDIA_BASE_URL=https://cdn.brew.md
VITE_DEFAULT_SCENE_ID=midnight-library
VITE_DEFAULT_TRACK_ID=deep-focus-01
```

### 17.3 Redirects

Single-page app fallback required:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 17.4 Cache headers

Use long cache for hashed assets. Do not aggressively cache `index.html`.

If media is hosted on CDN, configure media CDN separately:

Recommended media headers:

```txt
Cache-Control: public, max-age=31536000, immutable
Accept-Ranges: bytes
```

Important:

- Version media filenames when replacing assets.
- Example: `1080.v2.mp4` instead of overwriting `1080.mp4` if caching is long.

---

## 18. Claude Code Implementation Instructions

Claude Code should implement this project as a production-quality V1.

### 18.1 Build goal

Create a complete Vite React TypeScript app for `brew.md` that can be deployed to Netlify and used immediately.

### 18.2 Implementation order

Follow this exact order:

1. Initialize/check Vite React TypeScript project.
2. Install dependencies.
3. Configure Tailwind.
4. Create base app shell.
5. Add data manifests for scenes and tracks.
6. Add localStorage preference system.
7. Add full-screen background video component.
8. Add audio player hook/component.
9. Add clock widget.
10. Add Pomodoro widget.
11. Add control dock.
12. Add mobile bottom sheet.
13. Add scene selector.
14. Add track selector.
15. Add draggable desktop widget layer.
16. Add settings panel.
17. Add responsive styling.
18. Add reduced motion/data saver handling.
19. Add Netlify config.
20. Add README with setup/deploy instructions.
21. Run typecheck/build and fix all errors.

### 18.3 Implementation constraints

Do:

- Use TypeScript throughout.
- Keep components small and readable.
- Use semantic buttons and labels.
- Make the app work with placeholder media.
- Keep the experience clean and cinematic.
- Use localStorage safely.
- Make mobile feel first-class.
- Make the app production-build successfully.

Do not:

- Add backend code.
- Add auth.
- Add database.
- Put huge media files in repo.
- Add analytics unless explicitly requested.
- Add unnecessary package complexity.
- Create a generic dashboard look.

### 18.4 Placeholder media

Because real AI videos may not be present during build, include a fallback system.

Use either:

1. Small local placeholder assets in `public/sample-media`, or
2. CSS gradient fallback if no video is available.

The app must not crash if media URLs are missing.

### 18.5 README requirements

README must include:

- What brew.md is
- Local dev instructions
- Environment variables
- Media CDN structure
- Netlify deploy instructions
- How to add a new scene
- How to add a new music track
- Encoding recommendations

---

## 19. Acceptance Criteria

The build is complete when all of these are true:

### 19.1 Core product

- User can open the site and immediately see a full-screen background.
- Poster appears before video is ready.
- Background video loops and covers the viewport.
- Music does not autoplay with sound before user action.
- User can play/pause music.
- User can adjust volume.
- User can mute/unmute.
- User can switch scene.
- User can switch track.
- Clock displays correctly.
- Pomodoro works.
- Preferences persist after refresh.
- Reset preferences works.

### 19.2 Desktop

- Widgets are draggable on desktop.
- Widget positions save after refresh.
- Controls are clean and not intrusive.
- Scene/music selectors are usable.

### 19.3 Mobile

- Layout does not overflow.
- Controls are reachable.
- Bottom sheet works.
- Video uses mobile source by default.
- Touch targets are large enough.
- No dragging issues.

### 19.4 Performance

- App builds successfully.
- No console errors on normal use.
- Only selected background video loads initially.
- No all-scenes preload.
- No all-tracks preload.

### 19.5 Deployment

- `npm run build` succeeds.
- Netlify can deploy with publish directory `dist`.
- `netlify.toml` is present.
- SPA redirect works.

---

## 20. Suggested Initial Scene Set

Launch with 5 elite scenes.

### 20.1 Midnight Library

Prompt direction:

> A cinematic old library at midnight, towering shelves, rain streaking down tall gothic windows, warm desk lamp glow, soft dust particles, subtle candle flicker, deep shadows, slow ambient camera drift, no people, no text, seamless loop, elegant, quiet, extremely detailed, 4K.

Mood:

- Rain
- Warm
- Night
- Deep focus

### 20.2 Snow Cabin

Prompt direction:

> A cozy wooden cabin study room in a snowstorm, fireplace glow, large window looking into falling snow, desk with books and tea, warm amber light, soft shadows, slow fire movement, subtle snowfall outside, seamless loop, no people, no text, cinematic 4K.

Mood:

- Warm
- Snow
- Calm

### 20.3 Tokyo Window

Prompt direction:

> A high-rise Tokyo apartment study desk at night, neon city lights through rainy glass, distant traffic bokeh, clean modern desk, soft monitor glow, subtle rain movement, cinematic anime-realism, slow atmospheric camera movement, seamless loop, no people, no text, 4K.

Mood:

- Neon
- Rain
- City

### 20.4 Ocean Observatory

Prompt direction:

> A futuristic underwater observatory study room, huge curved glass window looking into deep ocean, slow drifting fish silhouettes, blue ambient light, minimal desk, calm particles in water, cinematic, peaceful, seamless loop, no people, no text, 4K.

Mood:

- Ocean
- Blue
- Ambient

### 20.5 Cloud Monastery

Prompt direction:

> A floating monastery library above the clouds at sunrise, stone arches, soft golden light, drifting clouds outside, ancient desk, quiet fantasy atmosphere, subtle cloth and dust movement, seamless loop, no people, no text, cinematic 4K.

Mood:

- Fantasy
- Ethereal
- Morning

---

## 21. Suggested Initial Music Set

Launch with 5 tracks.

### 21.1 Deep Focus 01

- Ambient synth
- No vocals
- Slow evolving pads
- Minimal percussion or none
- 60–75 BPM if rhythmic

### 21.2 Rainy Notes

- Lofi piano
- Rain texture
- Soft vinyl optional
- No sharp snare

### 21.3 Snowfall Piano

- Warm piano
- Sparse notes
- Soft room tone
- Fireplace optional

### 21.4 Neon Study

- Subtle synthwave
- Low tempo
- No aggressive drums
- Night-drive feeling

### 21.5 Library Air

- Almost silent ambient
- Brown noise / room tone
- Soft texture
- Best for actual studying

---

## 22. Future Roadmap

### 22.1 V1.1

- SFX mixer: rain/fire/wind/cafe/ocean
- More scenes
- More music
- Keyboard shortcuts
- Better crossfades
- Study streak stored locally
- Shareable scene links: `?scene=tokyo-window&track=neon-study`

### 22.2 V1.2

- PWA install
- Offline poster/last scene support
- Import/export preferences JSON
- Better Pomodoro stats
- Theme packs

### 22.3 V2

- Optional account
- Cross-device sync
- User-created rooms
- Public room links
- Paid premium scene packs
- AI-personalized scenes/music

Do not build V2 before V1 is excellent.

---

## 23. Exact Claude Code Prompt

Use this prompt inside Claude Code if starting from an empty repo:

```txt
Build the V1 of brew.md as specified in BREW_MD_BUILD_SPEC.md.

Use Vite + React + TypeScript + Tailwind. Deploy target is Netlify with publish directory dist. The app has no backend and no auth. It is a cinematic study environment with full-screen video backgrounds, music controls, beautiful clock, Pomodoro widget, scene selector, track selector, desktop draggable widgets, mobile bottom-sheet controls, and localStorage preference persistence.

Prioritize a clean, premium, minimal, fast feel. Do not create a generic SaaS dashboard. Use placeholder media fallbacks so the app works even before real AI videos/music are uploaded. Add netlify.toml, README, data manifests, and all required components/hooks. Run build/typecheck and fix errors.
```

---

## 24. Final Product Principle

The product should feel like this:

> A user opens brew.md, gets dropped into a beautiful animated world, clicks play, and starts studying. No account. No friction. No clutter. Just atmosphere, time, and focus.

Everything else is secondary.
