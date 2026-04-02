import { AudioManager } from '../audio/AudioManager';
import { Background } from '../entities/Background';
import { Bird } from '../entities/Bird';
import { ScoreManager } from '../storage/ScoreManager';
import { COLORS } from '../utils/colors';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT } from '../utils/constants';
import { easeInOutSine } from '../utils/math';
import type { BirdSkin, InputAction, Scene } from '../utils/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SoilDecorationKind = 'pebble' | 'crystal' | 'coin' | 'mushroom' | 'flower';

interface SoilDecoration {
  kind: SoilDecorationKind;
  x: number;
  baseY: number;
  scale: number;
  phase: number;
  tilt: number;
}

function pointInRect(px: number, py: number, r: ButtonRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function toCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (GAME_WIDTH / rect.width),
    y: (clientY - rect.top) * (GAME_HEIGHT / rect.height),
  };
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const AVAILABLE_SKINS: readonly BirdSkin[] = ['default', 'bee'];

/** Bird rendered at this scale on the menu for prominence. */
const MENU_BIRD_SCALE = 1.8;

const MENU_LAYOUT = {
  scoreChip: { x: 20, y: 14, w: 160, h: 38 },
  titleY: 64,
  bird: { x: 194, y: 182 },
  skinButton: { x: 144, y: 270, w: 100, h: 28 },
  skinHintY: 304,
  actionPanel: { x: 356, y: 104, w: 404, h: 278 },
  panelHeaderY: 128,
  buttons: [
    { x: 382, y: 156, w: 352, h: 58 },
    { x: 382, y: 230, w: 352, h: 58 },
  ],
  controlPills: [
    { x: 382, y: 316, w: 168, h: 26, label: 'Move: Tab / \u2190\u2192' },
    { x: 558, y: 316, w: 176, h: 26, label: 'Select: Space / Enter' },
  ],
} as const;

/* ------------------------------------------------------------------ */
/*  MenuScene                                                          */
/* ------------------------------------------------------------------ */

/**
 * Main menu rendered entirely on Canvas.
 *
 * Displays an animated bird, title, two mode buttons, high-score info,
 * a pulsing hint, and a sound toggle.
 */
export class MenuScene implements Scene {
  private readonly onStartStory: () => void;
  private readonly onStartInfinite: () => void;

  private selectedIndex = 0;
  private elapsed = 0;
  private birdBobOffset = 0;

  private bird: Bird | null = null;
  private background: Background | null = null;
  private soilDecorations: SoilDecoration[] = [];

  private readonly buttons: ButtonRect[];
  private readonly soundButton: ButtonRect;
  private readonly skinButton: ButtonRect;

  // Mouse state
  private mouseX = -1;
  private mouseY = -1;
  private canvas: HTMLCanvasElement | null = null;

  // Bound listeners for cleanup
  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onMouseClick: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;

  constructor(onStartStory: () => void, onStartInfinite: () => void) {
    this.onStartStory = onStartStory;
    this.onStartInfinite = onStartInfinite;

    this.buttons = [...MENU_LAYOUT.buttons];

    this.soundButton = { x: 742, y: 14, w: 42, h: 42 };
    this.skinButton = { ...MENU_LAYOUT.skinButton };
  }

  /* -------- lifecycle -------- */

  /** Set up entities and register input listeners. */
  enter(): void {
    this.elapsed = 0;
    this.selectedIndex = 0;
    this.mouseX = -1;
    this.mouseY = -1;

    this.bird = new Bird(AudioManager.getInstance().birdSkin);
    this.bird.x = MENU_LAYOUT.bird.x;
    this.bird.y = MENU_LAYOUT.bird.y;
    this.background = new Background();
    this.initSoilDecorations();

    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) return;

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      for (let i = 0; i < this.buttons.length; i++) {
        if (pointInRect(pos.x, pos.y, this.buttons[i])) {
          this.selectedIndex = i;
          break;
        }
      }
    };

    this.onMouseClick = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      if (pointInRect(pos.x, pos.y, this.skinButton)) {
        this.cycleSkin();
        return;
      }
      for (let i = 0; i < this.buttons.length; i++) {
        if (pointInRect(pos.x, pos.y, this.buttons[i])) {
          this.selectButton(i);
          return;
        }
      }
      if (pointInRect(pos.x, pos.y, this.soundButton)) {
        AudioManager.getInstance().muted = !AudioManager.getInstance().muted;
      }
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          break;
        case 'ArrowDown':
        case 'Tab':
          e.preventDefault();
          this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
          break;
        case 'Enter':
          e.preventDefault();
          this.selectButton(this.selectedIndex);
          break;
        case 's':
        case 'S':
          e.preventDefault();
          this.cycleSkin();
          break;
      }
    };

    this.onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const pos = toCanvasCoords(this.canvas, touch.clientX, touch.clientY);
      if (pointInRect(pos.x, pos.y, this.skinButton)) {
        this.cycleSkin();
        return;
      }
      for (let i = 0; i < this.buttons.length; i++) {
        if (pointInRect(pos.x, pos.y, this.buttons[i])) {
          this.selectButton(i);
          return;
        }
      }
      if (pointInRect(pos.x, pos.y, this.soundButton)) {
        AudioManager.getInstance().muted = !AudioManager.getInstance().muted;
      }
    };

    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('click', this.onMouseClick);
    document.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  /** Remove all input listeners. */
  exit(): void {
    if (this.canvas && this.onMouseMove) this.canvas.removeEventListener('mousemove', this.onMouseMove);
    if (this.canvas && this.onMouseClick) this.canvas.removeEventListener('click', this.onMouseClick);
    if (this.onKeyDown) document.removeEventListener('keydown', this.onKeyDown);
    if (this.canvas && this.onTouchStart) this.canvas.removeEventListener('touchstart', this.onTouchStart);

    this.onMouseMove = null;
    this.onMouseClick = null;
    this.onKeyDown = null;
    this.onTouchStart = null;
  }

  /** Respond to abstract input actions (space / tap). */
  handleInput(action: InputAction): void {
    if (action === 'flap' || action === 'confirm') {
      this.selectButton(this.selectedIndex);
    }
  }

  /* -------- update / render -------- */

  /** Animate the idle bird and background scroll. */
  update(dt: number): void {
    this.elapsed += dt;
    this.birdBobOffset = Math.sin(this.elapsed * 2.5) * 12;
    this.background?.update(dt, 0.5);
  }

  /** Draw the full menu frame. */
  render(ctx: CanvasRenderingContext2D): void {
    // Sky & background
    this.background?.render(ctx, COLORS.sky.topDefault, COLORS.sky.bottomDefault);

    // Bird spotlight glow (behind bird)
    this.renderBirdSpotlight(ctx);

    // Frosted action panel (right column)
    this.renderActionPanel(ctx);

    // Soil decorations in ground band
    this.renderSoilDecorations(ctx);

    // Title
    this.renderTitle(ctx);

    // Panel header
    this.renderPanelHeader(ctx);

    // Mode buttons
    this.renderButtons(ctx);

    // Control hints
    this.renderControlHints(ctx);

    // Animated bird (at 1.8× scale)
    this.renderBird(ctx);

    // Skin quick-switch
    this.renderSkinButton(ctx);

    // High score
    this.renderHighScore(ctx);

    // Sound toggle
    this.renderSoundToggle(ctx);
  }

  /* -------- private rendering helpers -------- */

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    const cx = GAME_WIDTH / 2;
    const ty = MENU_LAYOUT.titleY;
    const text = 'Flappy Bird';

    ctx.save();
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Layer 1 — Far drop shadow
    ctx.fillStyle = 'rgba(40, 15, 0, 0.45)';
    ctx.fillText(text, cx + 3, ty + 5);

    // Layer 2 — Dark text stroke for crisp outline
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#5A2D00';
    ctx.strokeText(text, cx, ty);

    // Layer 3 — Main golden gradient fill with outer glow
    const grad = ctx.createLinearGradient(220, 30, 580, 90);
    grad.addColorStop(0, '#FFF1C1');
    grad.addColorStop(0.35, '#FFB347');
    grad.addColorStop(0.7, '#FF8C00');
    grad.addColorStop(1, '#D45B00');
    ctx.shadowColor = 'rgba(255, 180, 60, 0.35)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, ty);

    // Layer 4 — Specular top highlight (clip to upper portion)
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 200, ty - 30, 400, 28);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillText(text, cx, ty);
    ctx.restore();

    // Subtle tagline
    ctx.font = 'italic 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 244, 214, 0.5)';
    ctx.shadowBlur = 0;
    ctx.fillText('A Magical Sky Adventure', cx, ty + 32);

    ctx.restore();
  }

  private renderBird(ctx: CanvasRenderingContext2D): void {
    const displayY = MENU_LAYOUT.bird.y + this.birdBobOffset;

    if (this.bird) {
      this.bird.skin = AudioManager.getInstance().birdSkin;
      this.bird.x = MENU_LAYOUT.bird.x;
      this.bird.y = displayY;
      this.bird.render(ctx, MENU_BIRD_SCALE);
    } else {
      this.renderFallbackBird(ctx, MENU_LAYOUT.bird.x, displayY);
    }
  }

  /** Warm spotlight glow rendered behind the bird. */
  private renderBirdSpotlight(ctx: CanvasRenderingContext2D): void {
    // Bird entity renders from top-left; visual center is offset by half width/height
    const bx = MENU_LAYOUT.bird.x + 20;
    const by = MENU_LAYOUT.bird.y + 15 + this.birdBobOffset;

    ctx.save();

    // Outer warm glow
    const outer = ctx.createRadialGradient(bx, by, 12, bx, by, 110);
    outer.addColorStop(0, 'rgba(255, 200, 80, 0.22)');
    outer.addColorStop(0.5, 'rgba(255, 170, 50, 0.08)');
    outer.addColorStop(1, 'rgba(255, 170, 50, 0)');
    ctx.fillStyle = outer;
    ctx.fillRect(bx - 130, by - 130, 260, 260);

    // Inner bright core
    const inner = ctx.createRadialGradient(bx, by - 10, 4, bx, by - 10, 50);
    inner.addColorStop(0, 'rgba(255, 255, 240, 0.30)');
    inner.addColorStop(0.6, 'rgba(255, 220, 140, 0.10)');
    inner.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = inner;
    ctx.fillRect(bx - 55, by - 55, 110, 110);

    // Floating platform arc below bird
    ctx.strokeStyle = 'rgba(255, 215, 130, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bx, by + 55, 52, 8, 0, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  private renderSkinButton(ctx: CanvasRenderingContext2D): void {
    const currentSkin = AudioManager.getInstance().birdSkin;
    const hovered = pointInRect(this.mouseX, this.mouseY, this.skinButton);
    const isBee = currentSkin === 'bee';
    const skinLabel = isBee ? 'Bee' : 'Default';
    const pillCx = this.skinButton.x + this.skinButton.w / 2;
    const pillCy = this.skinButton.y + this.skinButton.h / 2;

    ctx.save();

    // Hover glow
    if (hovered) {
      ctx.shadowColor = isBee ? 'rgba(247, 181, 0, 0.4)' : 'rgba(255, 179, 71, 0.4)';
      ctx.shadowBlur = 8;
    }

    // Base pill
    roundedRectPath(ctx, this.skinButton.x, this.skinButton.y, this.skinButton.w, this.skinButton.h, 14);
    ctx.fillStyle = 'rgba(20, 12, 45, 0.45)';
    ctx.fill();
    ctx.strokeStyle = isBee
      ? `rgba(247, 181, 0, ${hovered ? 0.65 : 0.4})`
      : `rgba(255, 179, 71, ${hovered ? 0.65 : 0.4})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Left arrow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(pillCx - 40, pillCy);
    ctx.lineTo(pillCx - 35, pillCy - 4);
    ctx.lineTo(pillCx - 35, pillCy + 4);
    ctx.closePath();
    ctx.fill();

    // Right arrow
    ctx.beginPath();
    ctx.moveTo(pillCx + 40, pillCy);
    ctx.lineTo(pillCx + 35, pillCy - 4);
    ctx.lineTo(pillCx + 35, pillCy + 4);
    ctx.closePath();
    ctx.fill();

    // Skin name
    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skinLabel, pillCx, pillCy);

    // "S to switch" hint below
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 244, 214, 0.4)';
    ctx.fillText('S to switch', pillCx, MENU_LAYOUT.skinHintY);

    ctx.restore();
  }

  /** Fallback when the Bird entity module has not been implemented yet. */
  private renderFallbackBird(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();

    // Body
    ctx.fillStyle = COLORS.bird.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = COLORS.bird.eye;
    ctx.beginPath();
    ctx.arc(x + 10, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.bird.eyeHighlight;
    ctx.beginPath();
    ctx.arc(x + 11, y - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = COLORS.bird.beak;
    ctx.beginPath();
    ctx.moveTo(x + 18, y - 2);
    ctx.lineTo(x + 28, y + 2);
    ctx.lineTo(x + 18, y + 5);
    ctx.closePath();
    ctx.fill();

    // Wing (animated)
    const wingAngle = Math.sin(this.elapsed * 8) * 0.3;
    ctx.fillStyle = COLORS.bird.wing;
    ctx.save();
    ctx.translate(x - 5, y + 2);
    ctx.rotate(wingAngle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const labels = ['Story Mode', 'Infinite Mode'];
    const subtitles = ['20 quick stages', 'Endless challenge'];
    const palettes: { base: string; light: string; dark: string }[] = [
      { base: '#7C3AED', light: '#9B6DFA', dark: '#5B21B6' },
      { base: '#059669', light: '#34D399', dark: '#047857' },
    ];

    this.buttons.forEach((btn, i) => {
      const hovered = pointInRect(this.mouseX, this.mouseY, btn);
      const highlight = hovered || this.selectedIndex === i;
      const pal = palettes[i];

      ctx.save();

      // Layer 1 — Bottom bevel (3D thickness)
      roundedRectPath(ctx, btn.x, btn.y + 3, btn.w, btn.h, 14);
      ctx.fillStyle = pal.dark;
      ctx.fill();

      // Layer 2 — Main body with shadow
      if (highlight) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
      }

      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      grad.addColorStop(0, highlight ? pal.light : pal.base);
      grad.addColorStop(1, highlight ? pal.base : pal.light);
      roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 14);
      ctx.fillStyle = grad;
      ctx.fill();

      // Layer 3 — Inner top highlight shine
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.save();
      roundedRectPath(ctx, btn.x + 1, btn.y + 1, btn.w - 2, btn.h / 2, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.restore();

      // Layer 4 — Border
      roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 14);
      ctx.strokeStyle = highlight ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Layer 5 — Selected ring
      if (this.selectedIndex === i) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Icon background circle
      const icx = btn.x + 32;
      const icy = btn.y + btn.h / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(icx, icy, 16, 0, Math.PI * 2);
      ctx.fill();

      // Canvas-drawn icons
      if (i === 0) {
        this.drawFlagIcon(ctx, icx, icy);
      } else {
        this.drawInfinityIcon(ctx, icx, icy);
      }

      // Button text
      ctx.fillStyle = COLORS.ui.text;
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], btn.x + 60, btn.y + 22);

      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.fillText(subtitles[i], btn.x + 60, btn.y + 40);

      ctx.restore();
    });
  }

  /** Canvas-drawn pennant flag icon. */
  private drawFlagIcon(ctx: CanvasRenderingContext2D, icx: number, icy: number): void {
    // Flag pole
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(icx - 4, icy - 10);
    ctx.lineTo(icx - 4, icy + 10);
    ctx.stroke();

    // Flag triangle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(icx - 3, icy - 10);
    ctx.lineTo(icx + 10, icy - 5);
    ctx.lineTo(icx - 3, icy);
    ctx.closePath();
    ctx.fill();
  }

  /** Canvas-drawn lemniscate (infinity symbol) icon. */
  private drawInfinityIcon(ctx: CanvasRenderingContext2D, icx: number, icy: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(icx, icy);
    ctx.bezierCurveTo(icx + 6, icy - 9, icx + 14, icy - 9, icx + 14, icy);
    ctx.bezierCurveTo(icx + 14, icy + 9, icx + 6, icy + 9, icx, icy);
    ctx.bezierCurveTo(icx - 6, icy - 9, icx - 14, icy - 9, icx - 14, icy);
    ctx.bezierCurveTo(icx - 14, icy + 9, icx - 6, icy + 9, icx, icy);
    ctx.stroke();
  }

  /** "Choose Your Adventure" header inside the action panel. */
  private renderPanelHeader(ctx: CanvasRenderingContext2D): void {
    const panel = MENU_LAYOUT.actionPanel;
    ctx.save();
    ctx.font = '15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 244, 230, 0.6)';
    ctx.fillText('Choose Your Adventure', panel.x + panel.w / 2, MENU_LAYOUT.panelHeaderY);
    ctx.restore();
  }

  private renderHighScore(ctx: CanvasRenderingContext2D): void {
    const storyBest = ScoreManager.getHighScore('story');
    const infiniteBest = ScoreManager.getHighScore('infinite');
    const best = storyBest >= infiniteBest ? storyBest : infiniteBest;
    const bestMode = storyBest >= infiniteBest ? 'story' : 'infinite';
    if (best <= 0) return;

    const chip = MENU_LAYOUT.scoreChip;

    ctx.save();
    // Base pill
    roundedRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 12);
    ctx.fillStyle = 'rgba(15, 10, 40, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Star icon
    ctx.fillStyle = COLORS.ui.gold;
    this.drawStar(ctx, chip.x + 18, chip.y + chip.h / 2, 7, 3);

    // "BEST" label
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.ui.gold;
    ctx.globalAlpha = 0.88;
    ctx.fillText('BEST', chip.x + 30, chip.y + 8);

    // Score + mode
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(254, 254, 254, 0.78)';
    ctx.fillText(`${best} \u2022 ${bestMode}`, chip.x + 30, chip.y + 22);
    ctx.restore();
  }

  /** Draw a 5-pointed star centered at (cx, cy). */
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number): void {
    const points = 5;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private renderSoundToggle(ctx: CanvasRenderingContext2D): void {
    const enabled = !AudioManager.getInstance().muted;
    const hovered = pointInRect(this.mouseX, this.mouseY, this.soundButton);
    const cx = this.soundButton.x + this.soundButton.w / 2;
    const cy = this.soundButton.y + this.soundButton.h / 2;

    ctx.save();
    if (hovered) {
      ctx.shadowColor = COLORS.ui.accent;
      ctx.shadowBlur = 10;
    }

    roundedRectPath(ctx, this.soundButton.x, this.soundButton.y, this.soundButton.w, this.soundButton.h, 12);
    ctx.fillStyle = enabled ? 'rgba(124, 58, 237, 0.55)' : 'rgba(80, 80, 90, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Canvas-drawn speaker icon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.rect(cx - 6, cy - 4, 6, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx + 6, cy - 9);
    ctx.lineTo(cx + 6, cy + 9);
    ctx.lineTo(cx, cy + 4);
    ctx.closePath();
    ctx.fill();

    if (enabled) {
      // Sound wave arcs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + 7, cy, 5, -0.8, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 7, cy, 9, -0.6, 0.6);
      ctx.stroke();
    } else {
      // Strike-through line
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 8);
      ctx.lineTo(cx + 10, cy + 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* -------- helpers -------- */

  private selectButton(index: number): void {
    if (index === 0) this.onStartStory();
    else if (index === 1) this.onStartInfinite();
  }

  private cycleSkin(): void {
    const audio = AudioManager.getInstance();
    const currentIndex = AVAILABLE_SKINS.indexOf(audio.birdSkin);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % AVAILABLE_SKINS.length : 0;
    audio.birdSkin = AVAILABLE_SKINS[nextIndex];
    audio.playClick();

    if (this.bird) {
      this.bird.skin = audio.birdSkin;
    }
  }

  private renderActionPanel(ctx: CanvasRenderingContext2D): void {
    const panel = MENU_LAYOUT.actionPanel;

    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(10, 5, 30, 0.35)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;

    // Base fill — frosted dark glass
    roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 20);
    const fill = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
    fill.addColorStop(0, 'rgba(18, 12, 48, 0.52)');
    fill.addColorStop(0.5, 'rgba(22, 15, 55, 0.58)');
    fill.addColorStop(1, 'rgba(28, 18, 62, 0.62)');
    ctx.fillStyle = fill;
    ctx.fill();

    // Clear shadow for subsequent layers
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Outer border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner double-border illusion
    roundedRectPath(ctx, panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2, 19);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top sheen radial highlight
    ctx.save();
    roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 20);
    ctx.clip();
    const sheen = ctx.createRadialGradient(
      panel.x + panel.w / 2, panel.y + 8, 0,
      panel.x + panel.w / 2, panel.y + 8, 180,
    );
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h / 2);
    ctx.restore();

    // Subtle inner divider separating buttons from control hints
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panel.x + 26, 298);
    ctx.lineTo(panel.x + panel.w - 26, 298);
    ctx.stroke();

    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.55 + 0.45 * easeInOutSine((this.elapsed * 0.8) % 1);

    MENU_LAYOUT.controlPills.forEach((pill, index) => {
      ctx.save();
      roundedRectPath(ctx, pill.x, pill.y, pill.w, pill.h, 13);
      ctx.fillStyle = 'rgba(15, 10, 35, 0.30)';
      ctx.fill();
      ctx.strokeStyle = index === 0
        ? `rgba(160, 190, 255, ${0.15 + pulse * 0.12})`
        : `rgba(255, 215, 140, ${0.15 + pulse * 0.12})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(254, 254, 254, 0.72)';
      ctx.fillText(pill.label, pill.x + pill.w / 2, pill.y + pill.h / 2 + 0.5);
      ctx.restore();
    });
  }

  private initSoilDecorations(): void {
    const kinds: SoilDecorationKind[] = ['pebble', 'crystal', 'coin', 'mushroom', 'flower'];
    const groundTop = GAME_HEIGHT - GROUND_HEIGHT + 10;
    const zones = [
      { minX: 30, maxX: 190, count: 5 },
      { minX: 610, maxX: 770, count: 5 },
    ];

    this.soilDecorations = zones.flatMap((zone) => Array.from({ length: zone.count }, () => ({
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      x: zone.minX + Math.random() * (zone.maxX - zone.minX),
      baseY: groundTop + 8 + Math.random() * 22,
      scale: 0.72 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
      tilt: -0.28 + Math.random() * 0.56,
    })));
  }

  private renderSoilDecorations(ctx: CanvasRenderingContext2D): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, groundY + 8, GAME_WIDTH, GROUND_HEIGHT - 8);
    ctx.clip();

    ctx.fillStyle = 'rgba(74, 48, 24, 0.12)';
    ctx.fillRect(0, groundY + 8, GAME_WIDTH, 10);

    this.soilDecorations.forEach((decoration) => {
      const bob = Math.sin(this.elapsed * 1.2 + decoration.phase) * 1.2;

      ctx.save();
      ctx.translate(decoration.x, decoration.baseY + bob);
      ctx.scale(decoration.scale, decoration.scale);
      ctx.rotate(decoration.tilt * 0.25);

      switch (decoration.kind) {
        case 'pebble':
          this.renderPebbleDecoration(ctx);
          break;
        case 'crystal':
          this.renderCrystalDecoration(ctx, decoration.phase);
          break;
        case 'coin':
          this.renderCoinDecoration(ctx, decoration.phase);
          break;
        case 'mushroom':
          this.renderMushroomDecoration(ctx);
          break;
        case 'flower':
          this.renderFlowerDecoration(ctx);
          break;
      }

      ctx.restore();
    });

    ctx.restore();
  }

  private renderPebbleDecoration(ctx: CanvasRenderingContext2D): void {
    // Large pebble
    ctx.fillStyle = 'rgba(85, 65, 42, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-5, 2, 7, 4.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Highlight on large pebble
    ctx.fillStyle = 'rgba(180, 155, 120, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-6, 0.5, 3, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Medium pebble
    ctx.fillStyle = 'rgba(95, 72, 48, 0.7)';
    ctx.beginPath();
    ctx.ellipse(4, 0, 5, 3.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Small pebble
    ctx.fillStyle = 'rgba(75, 58, 38, 0.65)';
    ctx.beginPath();
    ctx.ellipse(10, 2.5, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCrystalDecoration(ctx: CanvasRenderingContext2D, phase: number): void {
    // Main crystal body
    ctx.fillStyle = 'rgba(100, 180, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(5, -3);
    ctx.lineTo(2, 7);
    ctx.lineTo(-4, -1);
    ctx.closePath();
    ctx.fill();
    // Left facet (darker)
    ctx.fillStyle = 'rgba(70, 140, 220, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(-4, -1);
    ctx.lineTo(2, 7);
    ctx.closePath();
    ctx.fill();
    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.lineTo(2, -4);
    ctx.lineTo(-1, 0);
    ctx.closePath();
    ctx.fill();
    // Animated sparkle at tip
    const sparkAlpha = 0.3 + 0.3 * Math.sin(this.elapsed * 3 + phase);
    ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha})`;
    ctx.beginPath();
    ctx.arc(0, -12, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCoinDecoration(ctx: CanvasRenderingContext2D, phase: number): void {
    // Coin body
    ctx.fillStyle = COLORS.ui.gold;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rim
    ctx.strokeStyle = '#C5A200';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner circle detail
    ctx.strokeStyle = 'rgba(200, 160, 0, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Tiny 4-point star in center
    ctx.fillStyle = 'rgba(180, 140, 0, 0.6)';
    this.drawStar(ctx, 0, 0, 2.5, 1);
    // Animated glint
    const glintAlpha = 0.2 + 0.3 * Math.sin(this.elapsed * 2.2 + phase);
    ctx.strokeStyle = `rgba(255, 255, 255, ${glintAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 4, -0.7, 0.4);
    ctx.stroke();
  }

  private renderMushroomDecoration(ctx: CanvasRenderingContext2D): void {
    // Stem with taper
    ctx.fillStyle = '#F0E0D0';
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.lineTo(-1.5, 9);
    ctx.lineTo(1.5, 9);
    ctx.lineTo(2, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 130, 100, 0.4)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Cap with radial gradient
    const capGrad = ctx.createRadialGradient(0, -5, 1, 0, -2, 9);
    capGrad.addColorStop(0, '#FF6B4A');
    capGrad.addColorStop(0.7, '#E05535');
    capGrad.addColorStop(1, '#C04020');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Cap outline
    ctx.strokeStyle = 'rgba(120, 40, 20, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.stroke();

    // Spots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(-4, -5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -7, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -4, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Gill lines under cap
    ctx.strokeStyle = 'rgba(160, 120, 90, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (const angle of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const x1 = Math.sin(angle) * 2;
      const x2 = Math.sin(angle) * 7;
      ctx.moveTo(x1, -1);
      ctx.lineTo(x2, -1);
    }
    ctx.stroke();
  }

  private renderFlowerDecoration(ctx: CanvasRenderingContext2D): void {
    // Stem
    ctx.strokeStyle = 'rgba(60, 160, 60, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(0, 10);
    ctx.stroke();

    // 5 petals
    ctx.fillStyle = 'rgba(255, 180, 210, 0.7)';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = Math.cos(angle) * 4;
      const py = Math.sin(angle) * 4;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Yellow center
    ctx.fillStyle = 'rgba(255, 220, 80, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
