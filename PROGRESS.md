# Flappy Bird – Development Progress

## Original Prompt

The user asked to fix misaligned elements in the entire menu window of the Flappy Bird game, to plan carefully, and make it world-class quality.

## Current Status

Menu alignment overhaul in progress.

## Design Decisions

The menu uses a **two-column layout**: bird on the left, action panel on the right. The canvas is **800×450** with the ground occupying the bottom 50px. All UI elements are positioned using a centralized `createMenuLayout()` function.

### Key Alignment Issues (5)

1. **Bird not vertically centered with action panel** — bird center y=226 vs panel center y=242.
2. **Skin controls disconnected from bird** — 72px gap between bird and controls.
3. **Header elements at inconsistent vertical positions** — title, score chip, and sound toggle misaligned.
4. **Panel internal spacing cramped at bottom** — only 12px padding.
5. **Overall vertical distribution top-heavy.**

### Solution

Rebalance all positions using a **content-center-line approach** (y=240):

| Element | Before | After | Change |
|---|---|---|---|
| Panel height | 272px | 280px | +8px |
| Panel y | 106 | 100 | −6px |
| Bird center y | 226 | 232 | +6px (8px above panel center for visual weight) |
| Score chip y | 34 | 16 | −18px (more header breathing room) |
| Title y | 54 | 50 | −4px |
| Skin button y | 298 | 294 | −4px |
| Skin hint y | 350 | 340 | −10px |
| Control pills bottom offset | panelH−44 | panelH−48 | +4px padding |

## Implementation Notes

- All changes are in `src/scenes/MenuScene.ts` — specifically in `createMenuLayout()` and `renderHighScore()`.
- The layout is fully parametric — all positions derive from the layout object.
- No external dependencies or new files needed.

## What Works

- Two-column asymmetric layout with bird hero and frosted-glass action panel.
- Mouse, keyboard, and touch input for all menu interactions.
- Scene transitions with fade effects.
- Sound toggle and skin switching.
- High score display.

## TODOs / Suggestions

- [ ] Consider adding subtle entrance animations for menu elements.
- [ ] Could add hover micro-interactions on the bird.
- [ ] Difficulty select scene may benefit from similar alignment audit.
