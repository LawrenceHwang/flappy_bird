import { AudioManager } from '../audio/AudioManager';
import { Background } from '../entities/Background';
import { Bird } from '../entities/Bird';
import { drawControlPill, drawGlassPanel, drawIconToggle } from '../graphics/ui-kit';
import { ScoreManager } from '../storage/ScoreManager';
import { COLORS } from '../utils/colors';
import {
  BIRD_HEIGHT,
  BIRD_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
} from '../utils/constants';
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

interface ControlHint extends ButtonRect {
  label: string;
  detail: string;
  accent: string;
}

interface MenuLayout {
  scoreChip: ButtonRect;
  eyebrowY: number;
  titleY: number;
  birdCenter: { x: number; y: number };
  bird: { x: number; y: number };
  skinButton: ButtonRect;
  skinHintY: number;
  actionPanel: ButtonRect;
  buttons: readonly ButtonRect[];
  controlPills: readonly ControlHint[];
  soundButton: ButtonRect;
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
const MENU_BIRD_SCALE = 1.95;

function createMenuLayout(): MenuLayout {
  /* Centered composition: bird on left, action panel on right */
  const panelW = 340;
  const panelH = 280;
  const birdAreaW = 160;
  const gap = 28;
  const totalW = birdAreaW + gap + panelW; // 528
  const startX = Math.round((GAME_WIDTH - totalW) / 2); // 136

  /* Vertical centering: content zone between header and ground */
  const contentTop = 88;
  const contentBottom = GAME_HEIGHT - GROUND_HEIGHT - 8; // 392
  const contentCenterY = Math.round((contentTop + contentBottom) / 2); // 240

  const birdCenter = {
    x: Math.round(startX + birdAreaW / 2),
    y: contentCenterY - 8, // slightly above center for visual weight
  };
  const actionPanel = {
    x: startX + birdAreaW + gap,
    y: Math.round(contentCenterY - panelH / 2),
    w: panelW,
    h: panelH,
  };
  const buttonInset = 18;
  const buttonWidth = actionPanel.w - buttonInset * 2;
  const buttonHeight = 56;
  const buttonTop = actionPanel.y + 76;
  const controlWidth = Math.floor((buttonWidth - 14) / 2);
  const controlY = actionPanel.y + panelH - 48;

  const skinButtonY = birdCenter.y + 62;

  return {
    scoreChip: { x: 36, y: 16, w: 216, h: 68 },
    eyebrowY: 0,
    titleY: 50,
    birdCenter,
    bird: {
      x: Math.round(birdCenter.x - BIRD_WIDTH / 2),
      y: Math.round(birdCenter.y - BIRD_HEIGHT / 2),
    },
    skinButton: {
      x: Math.round(birdCenter.x - 76),
      y: skinButtonY,
      w: 152,
      h: 40,
    },
    skinHintY: skinButtonY + 46,
    actionPanel,
    buttons: [
      { x: actionPanel.x + buttonInset, y: buttonTop, w: buttonWidth, h: buttonHeight },
      { x: actionPanel.x + buttonInset, y: buttonTop + buttonHeight + 14, w: buttonWidth, h: buttonHeight },
    ],
    controlPills: [
      {
        x: actionPanel.x + buttonInset,
        y: controlY,
        w: controlWidth,
        h: 32,
        label: 'Move',
        detail: 'Tab • Arrow Keys',
        accent: 'rgba(142, 184, 255, 0.42)',
      },
      {
        x: actionPanel.x + buttonInset + controlWidth + 14,
        y: controlY,
        w: buttonWidth - controlWidth - 14,
        h: 32,
        label: 'Select',
        detail: 'Space • Enter',
        accent: 'rgba(244, 207, 148, 0.42)',
      },
    ],
    soundButton: { x: 720, y: 20, w: 46, h: 46 },
  };
}

const MENU_LAYOUT = createMenuLayout();

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

    this.soundButton = { ...MENU_LAYOUT.soundButton };
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
        case 'ArrowLeft':
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex + this.buttons.length - 1) % this.buttons.length;
          break;
        case 'ArrowDown':
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
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

    this.renderAtmosphericLighting(ctx);

    // Bird spotlight glow (behind bird)
    this.renderBirdSpotlight(ctx);

    // Frosted action panel (right column)
    this.renderActionPanel(ctx);

    // Constellation bridge removed for subtitle text clarity.

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

    // Animated bird (hero scale)
    this.renderBird(ctx);

    // Skin quick-switch
    this.renderSkinButton(ctx);

    // High score
    this.renderHighScore(ctx);

    // Sound toggle
    this.renderSoundToggle(ctx);
  }

  /* -------- private rendering helpers -------- */

  private renderAtmosphericLighting(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const warm = ctx.createRadialGradient(
      MENU_LAYOUT.birdCenter.x - 26,
      MENU_LAYOUT.birdCenter.y - 10,
      12,
      MENU_LAYOUT.birdCenter.x - 26,
      MENU_LAYOUT.birdCenter.y - 10,
      190,
    );
    warm.addColorStop(0, 'rgba(255, 226, 170, 0.24)');
    warm.addColorStop(0.42, 'rgba(255, 188, 115, 0.13)');
    warm.addColorStop(1, 'rgba(255, 188, 115, 0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cool = ctx.createRadialGradient(
      MENU_LAYOUT.actionPanel.x + MENU_LAYOUT.actionPanel.w * 0.28,
      MENU_LAYOUT.actionPanel.y + 22,
      0,
      MENU_LAYOUT.actionPanel.x + MENU_LAYOUT.actionPanel.w * 0.28,
      MENU_LAYOUT.actionPanel.y + 22,
      240,
    );
    cool.addColorStop(0, 'rgba(196, 210, 255, 0.16)');
    cool.addColorStop(0.55, 'rgba(146, 162, 243, 0.08)');
    cool.addColorStop(1, 'rgba(146, 162, 243, 0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const vignette = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    vignette.addColorStop(0, 'rgba(19, 24, 52, 0.14)');
    vignette.addColorStop(0.28, 'rgba(19, 24, 52, 0)');
    vignette.addColorStop(0.82, 'rgba(74, 54, 86, 0)');
    vignette.addColorStop(1, 'rgba(74, 54, 86, 0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.restore();
  }

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    const cx = GAME_WIDTH / 2;
    const ty = MENU_LAYOUT.titleY;
    const text = 'Flappy Bird';

    ctx.save();

    ctx.font = 'bold 50px Georgia, Cambria, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(37, 25, 18, 0.36)';
    ctx.fillText(text, cx + 2, ty + 5);

    // Stroke outline
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(102, 58, 36, 0.9)';
    ctx.strokeText(text, cx, ty);

    // Gradient fill
    const grad = ctx.createLinearGradient(cx - 190, 28, cx + 190, 100);
    grad.addColorStop(0, '#FFF7DE');
    grad.addColorStop(0.38, '#F7D59F');
    grad.addColorStop(0.76, '#E29E65');
    grad.addColorStop(1, '#C56A47');
    ctx.shadowColor = 'rgba(255, 202, 130, 0.24)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, ty);

    // Specular highlight (top half clip)
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 206, ty - 30, 412, 24);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillText(text, cx, ty);
    ctx.restore();

    // Decorative hairline + diamond
    ctx.strokeStyle = 'rgba(255, 231, 192, 0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 74, ty + 25);
    ctx.lineTo(cx + 74, ty + 25);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 244, 220, 0.68)';
    ctx.beginPath();
    ctx.arc(cx, ty + 25, 2.1, 0, Math.PI * 2);
    ctx.fill();

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
    const bx = MENU_LAYOUT.birdCenter.x;
    const by = MENU_LAYOUT.birdCenter.y + this.birdBobOffset;

    ctx.save();

    const outer = ctx.createRadialGradient(bx - 12, by - 10, 16, bx - 12, by - 10, 136);
    outer.addColorStop(0, 'rgba(255, 217, 133, 0.26)');
    outer.addColorStop(0.42, 'rgba(255, 186, 92, 0.12)');
    outer.addColorStop(1, 'rgba(255, 186, 92, 0)');
    ctx.fillStyle = outer;
    ctx.fillRect(bx - 170, by - 170, 340, 340);

    const inner = ctx.createRadialGradient(bx - 6, by - 18, 0, bx - 6, by - 18, 68);
    inner.addColorStop(0, 'rgba(255, 251, 236, 0.34)');
    inner.addColorStop(0.48, 'rgba(255, 224, 165, 0.14)');
    inner.addColorStop(1, 'rgba(255, 224, 165, 0)');
    ctx.fillStyle = inner;
    ctx.fillRect(bx - 84, by - 88, 168, 168);

    ctx.strokeStyle = 'rgba(255, 228, 190, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bx - 2, by + 58, 56, 8, 0, 0, Math.PI);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(183, 203, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(bx - 8, by - 6, 46, 4.2, 6.02);
    ctx.stroke();

    ctx.restore();
  }

  private renderSkinButton(ctx: CanvasRenderingContext2D): void {
    const currentSkin = AudioManager.getInstance().birdSkin;
    const hovered = pointInRect(this.mouseX, this.mouseY, this.skinButton);
    const isBee = currentSkin === 'bee';
    const skinLabel = isBee ? 'Honey Bee' : 'Classic';
    const pillCx = this.skinButton.x + this.skinButton.w / 2;
    const pillCy = this.skinButton.y + this.skinButton.h / 2;

    ctx.save();

    if (hovered) {
      ctx.shadowColor = isBee ? 'rgba(247, 193, 80, 0.32)' : 'rgba(255, 188, 120, 0.32)';
      ctx.shadowBlur = 14;
    }

    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 238, 206, 0.6)';
    ctx.fillText('PLUMAGE', pillCx, this.skinButton.y - 12);

    roundedRectPath(ctx, this.skinButton.x, this.skinButton.y, this.skinButton.w, this.skinButton.h, 18);
    const fill = ctx.createLinearGradient(this.skinButton.x, this.skinButton.y, this.skinButton.x, this.skinButton.y + this.skinButton.h);
    fill.addColorStop(0, 'rgba(37, 31, 62, 0.78)');
    fill.addColorStop(1, 'rgba(22, 18, 41, 0.82)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = isBee
      ? `rgba(247, 200, 105, ${hovered ? 0.72 : 0.42})`
      : `rgba(255, 214, 167, ${hovered ? 0.72 : 0.42})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.shadowBlur = 0;

    const wingletRadius = 13;
    const leftWingletX = this.skinButton.x + 20;
    const rightWingletX = this.skinButton.x + this.skinButton.w - 20;
    [leftWingletX, rightWingletX].forEach((x) => {
      ctx.fillStyle = hovered ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.arc(x, pillCy, wingletRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 235, 205, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(255, 248, 232, 0.72)';
    ctx.lineWidth = 2;
    this.drawChevron(ctx, leftWingletX + 1, pillCy, 'left');
    this.drawChevron(ctx, rightWingletX - 1, pillCy, 'right');

    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 14px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(skinLabel, pillCx, pillCy - 1);

    ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255, 243, 223, 0.5)';
    ctx.fillText('Press S or tap to swap', pillCx, MENU_LAYOUT.skinHintY);

    ctx.restore();
  }

  private drawChevron(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: 'left' | 'right',
  ): void {
    const dir = direction === 'left' ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x - dir * 3, y - 5);
    ctx.lineTo(x + dir * 2, y);
    ctx.lineTo(x - dir * 3, y + 5);
    ctx.stroke();
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
    const subtitles = ['20 crafted stages with a clean ramp', 'Endless play with evolving rewards'];
    const palettes: { base: string; light: string; dark: string; sheen: string }[] = [
      { base: '#344EBA', light: '#7D90F1', dark: '#1E2D75', sheen: '#F3D7A8' },
      { base: '#107E72', light: '#42CCB7', dark: '#0B524D', sheen: '#CFFBF0' },
    ];

    this.buttons.forEach((btn, i) => {
      const hovered = pointInRect(this.mouseX, this.mouseY, btn);
      const highlight = hovered || this.selectedIndex === i;
      const pal = palettes[i];
      const lift = highlight ? -2.5 : 0;

      ctx.save();

      roundedRectPath(ctx, btn.x, btn.y + 4, btn.w, btn.h, 18);
      ctx.fillStyle = pal.dark;
      ctx.fill();

      ctx.shadowColor = highlight ? 'rgba(15, 18, 34, 0.34)' : 'rgba(15, 18, 34, 0.26)';
      ctx.shadowBlur = highlight ? 18 : 10;
      ctx.shadowOffsetY = 5;

      const grad = ctx.createLinearGradient(btn.x, btn.y + lift, btn.x + btn.w, btn.y + btn.h + lift);
      grad.addColorStop(0, highlight ? pal.light : pal.base);
      grad.addColorStop(0.58, pal.base);
      grad.addColorStop(1, highlight ? pal.base : pal.dark);
      roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 18);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.save();
      roundedRectPath(ctx, btn.x + 1.5, btn.y + 1 + lift, btn.w - 3, btn.h / 2.3, 17);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.fill();
      ctx.restore();

      roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 18);
      ctx.strokeStyle = highlight ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (this.selectedIndex === i) {
        ctx.strokeStyle = 'rgba(244, 226, 190, 0.68)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const icx = btn.x + 34;
      const icy = btn.y + btn.h / 2 + lift;
      const iconWell = ctx.createLinearGradient(btn.x + 10, btn.y + lift, btn.x + 54, btn.y + btn.h + lift);
      iconWell.addColorStop(0, 'rgba(15, 19, 38, 0.3)');
      iconWell.addColorStop(1, 'rgba(15, 19, 38, 0.18)');
      ctx.fillStyle = iconWell;
      ctx.beginPath();
      ctx.arc(icx, icy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (i === 0) {
        this.drawCompassIcon(ctx, icx, icy);
      } else {
        this.drawInfinityIcon(ctx, icx, icy);
      }

      ctx.fillStyle = COLORS.ui.text;
      ctx.font = 'bold 20px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], btn.x + 64, btn.y + lift + 20);

      ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 245, 226, 0.72)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(subtitles[i], btn.x + 64, btn.y + lift + 38);

      ctx.restore();
    });
  }

  /** Canvas-drawn compass star icon for story mode. */
  private drawCompassIcon(ctx: CanvasRenderingContext2D, icx: number, icy: number): void {
    ctx.save();
    ctx.translate(icx, icy);
    ctx.rotate(Math.sin(this.elapsed * 0.5) * 0.06);
    ctx.strokeStyle = 'rgba(255, 247, 226, 0.92)';
    ctx.fillStyle = 'rgba(255, 247, 226, 0.92)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(3.4, -3.4);
    ctx.lineTo(11, 0);
    ctx.lineTo(3.4, 3.4);
    ctx.lineTo(0, 11);
    ctx.lineTo(-3.4, 3.4);
    ctx.lineTo(-11, 0);
    ctx.lineTo(-3.4, -3.4);
    ctx.closePath();
    ctx.globalAlpha = 0.26;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.restore();
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 234, 206, 0.5)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('PLAY MODES', panel.x + panel.w / 2, panel.y + 22);
    ctx.fillStyle = 'rgba(255, 247, 230, 0.9)';
    ctx.font = 'bold 22px Georgia, Cambria, "Times New Roman", serif';
    ctx.fillText('Choose a Flight Path', panel.x + panel.w / 2, panel.y + 44);
    ctx.fillStyle = 'rgba(255, 242, 226, 0.58)';
    ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('Curated journey or endless score.', panel.x + panel.w / 2, panel.y + 62);
    ctx.restore();
  }

  private renderHighScore(ctx: CanvasRenderingContext2D): void {
    const storyBest = ScoreManager.getHighScore('story');
    const infiniteBest = ScoreManager.getHighScore('infinite');

    const chip = MENU_LAYOUT.scoreChip;

    ctx.save();
    roundedRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 18);
    const fill = ctx.createLinearGradient(chip.x, chip.y, chip.x, chip.y + chip.h);
    fill.addColorStop(0, 'rgba(30, 25, 52, 0.74)');
    fill.addColorStop(1, 'rgba(19, 16, 35, 0.82)');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 232, 202, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 233, 197, 0.68)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('HIGH SCORES', chip.x + 16, chip.y + 12);

    ctx.strokeStyle = 'rgba(255, 233, 197, 0.08)';
    ctx.beginPath();
    ctx.moveTo(chip.x + chip.w / 2, chip.y + 30);
    ctx.lineTo(chip.x + chip.w / 2, chip.y + chip.h - 10);
    ctx.stroke();

    const storyLabelX = chip.x + 18;
    const infiniteLabelX = chip.x + chip.w / 2 + 14;
    ctx.fillStyle = 'rgba(255, 239, 221, 0.56)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('Story', storyLabelX, chip.y + 30);
    ctx.fillText('Infinite', infiniteLabelX, chip.y + 30);

    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 17px Georgia, Cambria, "Times New Roman", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${storyBest}`, storyLabelX, chip.y + 54);
    ctx.fillText(`${infiniteBest}`, infiniteLabelX, chip.y + 54);

    const accentX = chip.x + chip.w - 18;
    ctx.fillStyle = 'rgba(245, 203, 124, 0.82)';
    this.drawStar(ctx, accentX, chip.y + 18, 6, 2.6);
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
    drawIconToggle(ctx, this.soundButton, {
      label: enabled ? 'SFX' : 'OFF',
      tone: enabled ? 'cyan' : 'slate',
      hovered,
      selected: hovered,
    });
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
    drawGlassPanel(ctx, MENU_LAYOUT.actionPanel, {
      accent: 'rgba(111, 150, 242, 0.14)',
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MENU_LAYOUT.actionPanel.x + 24, MENU_LAYOUT.actionPanel.y + MENU_LAYOUT.actionPanel.h - 62);
    ctx.lineTo(MENU_LAYOUT.actionPanel.x + MENU_LAYOUT.actionPanel.w - 24, MENU_LAYOUT.actionPanel.y + MENU_LAYOUT.actionPanel.h - 62);
    ctx.moveTo(MENU_LAYOUT.actionPanel.x + 24, MENU_LAYOUT.actionPanel.y + 38);
    ctx.lineTo(MENU_LAYOUT.actionPanel.x + MENU_LAYOUT.actionPanel.w - 24, MENU_LAYOUT.actionPanel.y + 38);
    ctx.stroke();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D): void {
    MENU_LAYOUT.controlPills.forEach((pill) => {
      const pulse = 0.1 + 0.18 * (0.55 + 0.45 * easeInOutSine((this.elapsed * 0.8) % 1));
      drawControlPill(
        ctx,
        pill,
        pill.label.toUpperCase(),
        pill.detail,
        pill.accent.replace('0.42', `${pulse}`),
      );
    });
  }

  private initSoilDecorations(): void {
    const kinds: SoilDecorationKind[] = ['pebble', 'crystal', 'coin', 'mushroom', 'flower'];
    const groundTop = GAME_HEIGHT - GROUND_HEIGHT + 10;
    const zones = [
      { minX: 28, maxX: 214, count: 5 },
      { minX: 566, maxX: 772, count: 5 },
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
