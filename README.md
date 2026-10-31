# Fruit Frenzy 🍉🍊🍋

A lightweight, responsive, production-ready HTML5 fruit-slicing arcade game built with vanilla HTML, CSS, and modern JavaScript.

Zero build steps, zero external runtime libraries, zero API keys, zero backend services, and no heavy media assets required. All sound effects are generated in real time with the Web Audio API, and all fruit graphics use native system emoji rendered onto high-DPI HTML5 Canvas.

---

## Features

- **Fluid Ballistic Physics:** Fruit arcs rise naturally up to the upper playfield area with realistic gravity and momentum.
- **Dynamic Slicing:** Responsive pointer-based blade slicing for desktop mouse, stylus, and mobile touch. Supports rapid swiping as well as direct tap-slicing.
- **Fruit Halves & Particle Splatters:** Sliced fruits split into two rotating halves that fly apart perpendicular to the cut angle, accompanied by juicy particle splatters and floating score popups.
- **Combo System:** Rapid consecutive hits within 950ms trigger combo multipliers, awarding increasing bonus points and ascending musical tones.
- **Web Audio Sound Effects:** Real-time synthesized audio effects including slice swooshes, combo chimes, miss thuds, fanfare, and pause/start signals with full mute toggle and persistent preference.
- **Session & Record Tracking:** Personal best score is saved locally via `localStorage`. Distinct celebrations for new records.
- **Accessible & Touch-Friendly:** Meets WCAG touch-target sizing (min 44px hit areas) on mobile buttons. Slicing inside the playfield suppresses page scrolling (`touch-action: none`), while standard scrolling outside the playfield remains smooth.
- **Safe Lifecycle:** Guarded animation loop prevents duplicate RAF cycles. Resizing and orientation changes update the canvas with automatic pixel-ratio scaling without clearing paused game states.

---

## Local Development & Testing

### Option 1 — Built-in Development Server
```bash
npm run dev
# or: node server.js
```
Then open [http://127.0.0.1:8080](http://127.0.0.1:8080) in your browser.

### Option 2 — Automated QA Test Suite
Runs the headless browser QA test suite against real Chromium/Edge CDP:
```bash
npm test
# or: node test-suite.mjs
```

### Option 3 — Production Audit & Validation
Validates syntax, file integrity, relative asset paths, and distribution sync:
```bash
npm run build
# or: node build.js
```

### Option 4 — Python HTTP Server
```bash
python -m http.server 8000
```

### Option 5 — Direct Browser
Open `index.html` directly in Google Chrome, Microsoft Edge, Safari, or Firefox.

---

## How to Play

- **Mouse / Trackpad:** Click and drag across fruit to slice. Single-clicking directly on a fruit also slices it.
- **Touch / Mobile:** Swipe your finger across flying fruit. Tap directly on fruit to quick-slice.
- **Keyboard:** Press `Space` to pause or resume at any time.
- **HUD Controls:**
  - `PAUSE / RESUME`: Pause gameplay and timer.
  - `RESTART`: Reset the round immediately.
  - `🔊 / 🔇`: Toggle audio effects on or off (persists across visits).
- **Rules:**
  - Round duration: 60 seconds.
  - Miss 3 un-sliced fruits and the round ends.
  - Build combos by slicing multiple fruits quickly to score bonus points.

---

## Deployment to Vercel

This repository is 100% static and requires zero build steps or plugins.

### Method A — Vercel Dashboard (GitHub / GitLab / Bitbucket)
1. Push this folder to a GitHub repository.
2. Go to your [Vercel Dashboard](https://vercel.com/) and click **Add New → Project**.
3. Select your repository.
4. Set Framework Preset to **Other**.
5. Leave **Build Command** and **Output Directory** empty (default root `.`).
6. Click **Deploy**. Your game will be live in seconds.

### Method B — Vercel CLI
From this project directory:
```bash
npm i -g vercel
vercel
```
Follow the interactive CLI prompts:
- Link to existing project? `No`
- What's your project's name? `fruit-frenzy`
- In which directory is your code located? `./`
- Want to modify these settings? `No`

To deploy directly to production:
```bash
vercel --prod
```

---

## Technical Architecture

| Component | Implementation |
| :--- | :--- |
| **Renderer** | HTML5 Canvas 2D with dynamic DPR scaling (up to 2x for Retina displays) |
| **Styling** | Modern CSS custom properties, CSS Grid, Flexbox, responsive clamp() scales |
| **Audio** | Real-time Web Audio API synthesis (GainNodes, Oscillators, frequency ramps) |
| **Input** | Unified Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `lostpointercapture`) |
| **Persistence** | Browser `localStorage` (`fruitFrenzyBest`, `fruitFrenzySound`) |
