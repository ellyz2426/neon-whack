# Neon Whack VR 🔨

A neon-drenched holodeck whack-a-mole game built with [IWSDK](https://iwsdk.dev) (Immersive Web SDK). Play in VR or desktop browser.

**[▶ Play Now](https://ellyz2426.github.io/neon-whack/)**

## Features

### 9 Game Modes
- **Classic** — 60 seconds, maximize your score
- **Survival** — 3 lives, every miss costs one
- **Time Attack** — Hit 50 targets as fast as possible
- **Zen** — No timer, no pressure, just whack
- **Speed Rush** — 30 seconds, targets get faster
- **Pattern** — Simon-style memorize-and-repeat
- **Daily Challenge** — Deterministic seed, same challenge for everyone
- **Frenzy** — All holes active, nonstop spawning
- **Tournament** — 5 rounds of escalating difficulty

### 8 Target Types
Normal, Bonus (3x points), Speed (fast), Tank (2 hits), Bomb (avoid!), Ghost (flickering), King (rare, 1000 pts), Mystery (random rewards)

### Progression System
- 50 XP levels with scaling requirements
- 55 achievements across career, combo, score, mode-specific, target-type, and time milestones
- 8 unlockable mallet skins (level-gated)
- 5 holodeck arena themes
- Career stats tracking

### Audio & Visuals
- Procedural arpeggiator music (bass + synth + kick at 128 BPM)
- 12+ distinct SFX (whack, pop, bomb, combo, achievement, power-up, countdown, pattern notes)
- 3D mallet with swing animation and idle bob
- Particle effects on hits with floating score popups
- Camera shake on bomb explosions
- Target timeout warning flash
- Neon wireframe holodeck aesthetic

### VR & Browser
- Full XR controller support (trigger to whack, B to pause)
- Browser mouse raycasting with sphere intersection
- 17 PanelUI `.uikitml` spatial UI templates (zero HTML DOM overlays)
- Head-locked HUD for score, combo, time, lives

## Tech Stack

- **IWSDK 0.4.1** — WebXR/browser-first 3D framework
- **PanelUI** — Spatial UI via `.uikitml` templates compiled by `@iwsdk/vite-plugin-uikitml`
- **Vite 7** — Build tooling
- **TypeScript** — Strict typing, zero errors
- **localStorage** — Client-side persistence

## Development

```bash
pnpm install
pnpm dev        # Starts IWSDK dev server with hot reload
pnpm build      # Production build to dist/
```

## Stats

- 18 source files
- ~3,200 lines of code
- 17 `.uikitml` UI templates
- 55 achievements
- 9 game modes
- Zero HTML DOM UI — all spatial PanelUI

## License

MIT
