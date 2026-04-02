# Flappy Bird Design Document

## Overview

This project is a single-page Flappy Bird game built with `Vite`, `TypeScript`, and `HTML5 Canvas`.

The game supports two modes:

- **Story mode** with 20 levels
- **Infinite mode** with four fixed difficulty presets
- **Cosmetic bird skins** with a default bird and a bee option

The design goal is a game that feels cute, festive, smooth, approachable, and easy to deploy as a static site.

## Gameplay

### Core loop

- The world scrolls left to simulate forward movement.
- The player starts each run with `Space`, `Enter`, click, or tap, then sees a `3-2-1` countdown before motion begins.
- The player presses `Space` or taps to flap upward during gameplay.
- Gravity pulls the bird down when not flapping.
- Passing a pipe increases score.
- Hitting a pipe or the ground causes failure.
- Hitting the top of the screen does **not** fail the run; the bird is clamped to the top border.
- The first pipe is intentionally brought in sooner than later obstacles so the opening seconds feel less empty.

### Story mode

- 20 levels
- 30 seconds per level
- Difficulty ramps over time by tightening gaps, increasing speed, reducing spacing, and enabling moving pipes later in the campaign

### Infinite mode

- Difficulties: Easy, Medium, Hard, Impossible
- Endless play
- Random rewards can spawn in pipe gaps:
  - **Multiplier**: temporary `2x` or `3x` score
  - **Shield**: blocks one pipe collision
  - **Slow motion**: halves the run speed temporarily
  - **Shrink**: reduces both the bird's visual size and hitbox temporarily

### Cosmetics

- The start screen exposes a quick skin switch.
- Players can cycle between the default bird and a bee skin without leaving the main menu.
- The selected skin is cosmetic only and persists in `localStorage`.

## Physics Design

The physics are intentionally readable but less floaty than before.

- Gravity is tuned to make descent more responsive.
- Flap strength remains strong enough to recover without making the bird feel twitchy.
- Terminal velocity is capped to avoid harsh drops even after the tighter tuning pass.
- Bird hitboxes are slightly inset from visuals to reduce frustrating near-miss collisions.
- Difficulty presets increase forward pace while preserving the overall ladder from Easy to Impossible.
- The top border clamps position instead of failing the player.

## Rendering Design

### Resolution model

- Internal logical resolution: `800 x 450`
- Display scaling preserves the aspect ratio
- The canvas fills the browser's visible area as much as possible without distortion
- HiDPI displays are supported through device pixel ratio scaling

### Visual style

- Programmatic shapes only; no sprite dependency
- Rounded, soft geometry with a chubby-bird silhouette
- Bright but accessible palette with stronger highlights, outlines, and glow accents
- Magical-kingdom parallax background with aurora bands, clouds, sparkles, hills, and ground
- Menu scenes use a golden-ratio composition, asymmetrical focal art, and frosted-glass UI panels so the navigation flow reads as a deliberate visual hierarchy instead of a flat grid of widgets
- Enchanted pipe styling with rune marks, ornate caps, and subtle gap glow
- Particle effects for flap, reward pickup, and death

## Audio Design

Audio uses the Web Audio API only.

- Sound effects are synthesized procedurally
- Background music is generated from soft pads, bass pulses, and a light arpeggio
- The goal is a loop that feels relaxing, rhythmic, and memorable without overpowering gameplay

## Architecture

### Engine

- `Game.ts` orchestrates the application
- `GameLoop.ts` runs the render/update loop
- `Renderer.ts` manages logical and physical canvas sizing
- `InputManager.ts` normalizes keyboard and touch input

### Play Systems

- `Bird.ts`, `Pipe.ts`, `PipeManager.ts`, `Reward.ts`, `RewardManager.ts`, and `Background.ts` handle simulation and rendering
- `GameScene.ts` owns active gameplay state
- `SceneManager.ts` manages transitions between menu, gameplay, completion, and game over states

### Persistence

- `ScoreManager.ts` stores scores in `localStorage`
- `AudioManager.ts` stores player sound preferences and the selected bird skin in `localStorage`

## Performance Strategy

- `requestAnimationFrame` loop
- Delta-time based updates
- Object pooling for particles and pipes
- No runtime asset loading required for core art and sound

## Deployment

- Static build output from Vite
- Relative asset paths for local hosting and GitHub Pages
- GitHub Actions workflow provided for Pages deployment
