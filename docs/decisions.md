# Flappy Bird Decision Log

## Decision 1: Use HTML5 Canvas instead of DOM rendering

**Decision**

Use a canvas-driven renderer for gameplay and canvas-drawn menus.

**Why**

- Better control over frame timing
- Lower layout overhead than DOM-heavy animation
- Easier to keep motion smooth on lower-powered devices

## Decision 2: Use Vanilla TypeScript with Vite

**Decision**

Use Vanilla TypeScript rather than a UI framework for gameplay.

**Why**

- Minimal runtime overhead
- Clearer game-loop ownership
- Easier static deployment

## Decision 3: Keep the app static-host friendly

**Decision**

Design everything to work on GitHub Pages and local hosting.

**Why**

- No backend is required
- Build output can be served from any static host
- `localStorage` is enough for scores and settings

## Decision 4: Programmatic graphics instead of sprite assets

**Decision**

Draw the bird, pipes, rewards, and background using Canvas APIs.

**Why**

- Zero external asset dependency
- Fast iteration on visual style
- Small deploy footprint

## Decision 5: Procedural audio instead of sound files

**Decision**

Use the Web Audio API for both sound effects and background music.

**Why**

- Avoids audio asset management
- Keeps the build lightweight
- Allows music and effects to be tuned directly in code

## Decision 6: Favor forgiving physics over strict imitation

**Decision**

Tune gravity, flap strength, pipe spacing, and gap sizes to reduce frustration.

**Why**

- The goal is approachable gameplay, not punishing precision
- Players should feel capable of recovering from mistakes
- Top-edge contact is treated as a clamp, not a fail state

## Decision 7: Preserve aspect ratio while maximizing viewport usage

**Decision**

Use a fixed logical resolution with responsive CSS scaling.

**Why**

- Keeps gameplay geometry predictable
- Lets the canvas grow to the visible browser area
- Avoids distortion across desktop and mobile devices
