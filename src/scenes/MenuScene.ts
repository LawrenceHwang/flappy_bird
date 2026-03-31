import type { Scene, InputAction } from '../utils/types';
import { COLORS } from '../utils/colors';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT } from '../utils/constants';
import { easeInOutSine } from '../utils/math';
import { ScoreManager } from '../storage/ScoreManager';
import { AudioManager } from '../audio/AudioManager';
import { Bird } from '../entities/Bird';
import { Background } from '../entities/Background';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
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

  private readonly buttons: ButtonRect[];
  private readonly soundButton: ButtonRect;

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

    const btnW = 220;
    const btnH = 55;
    const cx = GAME_WIDTH / 2 - btnW / 2;
    const startY = 230;
    const gap = 15;

    this.buttons = [
      { x: cx, y: startY, w: btnW, h: btnH },
      { x: cx, y: startY + btnH + gap, w: btnW, h: btnH },
    ];

    this.soundButton = { x: GAME_WIDTH - 60, y: 15, w: 45, h: 45 };
  }

  /* -------- lifecycle -------- */

  /** Set up entities and register input listeners. */
  enter(): void {
    this.elapsed = 0;
    this.selectedIndex = 0;
    this.mouseX = -1;
    this.mouseY = -1;

    this.bird = new Bird();
    this.bird.x = GAME_WIDTH / 2 + 120;
    this.bird.y = 140;
    this.background = new Background();

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
      }
    };

    this.onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const pos = toCanvasCoords(this.canvas, touch.clientX, touch.clientY);
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

    // Title
    this.renderTitle(ctx);

    // Animated bird
    this.renderBird(ctx);

    // Subtitle
    ctx.save();
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.7;
    ctx.fillText('Choose your adventure', GAME_WIDTH / 2, 200);
    ctx.restore();

    // Mode buttons
    this.renderButtons(ctx);

    // Pulsing hint
    const pulse = 0.4 + 0.6 * easeInOutSine((this.elapsed * 1.5) % 1);
    ctx.save();
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press Space or Tap to Start', GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT - 50);
    ctx.restore();

    // High score
    this.renderHighScore(ctx);

    // Sound toggle
    this.renderSoundToggle(ctx);

    // Ground
    this.renderGround(ctx);
  }

  /* -------- private rendering helpers -------- */

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText('Flappy Bird', GAME_WIDTH / 2 + 3, 73);

    // Gradient text
    const grad = ctx.createLinearGradient(
      GAME_WIDTH / 2 - 150, 40,
      GAME_WIDTH / 2 + 150, 100,
    );
    grad.addColorStop(0, '#FDCB6E');
    grad.addColorStop(0.5, '#FF9F43');
    grad.addColorStop(1, '#E17055');
    ctx.fillStyle = grad;
    ctx.fillText('Flappy Bird', GAME_WIDTH / 2, 70);
    ctx.restore();
  }

  private renderBird(ctx: CanvasRenderingContext2D): void {
    const displayY = 140 + this.birdBobOffset;

    if (this.bird) {
      this.bird.y = displayY;
      this.bird.render(ctx);
    } else {
      this.renderFallbackBird(ctx, GAME_WIDTH / 2 + 120, displayY);
    }
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
    const labels = ['🎮  Story Mode', '♾️  Infinite Mode'];
    const palettes: [string, string][] = [
      [COLORS.ui.accent, COLORS.ui.accentLight],
      ['#00B894', '#55E6C1'],
    ];

    this.buttons.forEach((btn, i) => {
      const hovered = pointInRect(this.mouseX, this.mouseY, btn);
      const highlight = hovered || this.selectedIndex === i;

      ctx.save();

      // Button shadow / glow
      if (highlight) {
        ctx.shadowColor = palettes[i][0];
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
      }

      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x + btn.w, btn.y + btn.h);
      grad.addColorStop(0, palettes[i][highlight ? 1 : 0]);
      grad.addColorStop(1, palettes[i][highlight ? 0 : 1]);

      roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 14);
      ctx.fillStyle = grad;
      ctx.fill();

      // Selected border
      if (this.selectedIndex === i) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = COLORS.ui.text;
      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], btn.x + btn.w / 2, btn.y + btn.h / 2);

      ctx.restore();
    });
  }

  private renderHighScore(ctx: CanvasRenderingContext2D): void {
    const storyBest = ScoreManager.getHighScore('story');
    const infiniteBest = ScoreManager.getHighScore('infinite');
    const best = storyBest >= infiniteBest ? storyBest : infiniteBest;
    const bestMode = storyBest >= infiniteBest ? 'story' : 'infinite';
    if (best <= 0) return;

    ctx.save();
    ctx.font = '15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.6;
    ctx.fillText(
      `Best: ${best} (${bestMode})`,
      GAME_WIDTH / 2,
      GAME_HEIGHT - GROUND_HEIGHT - 25,
    );
    ctx.restore();
  }

  private renderSoundToggle(ctx: CanvasRenderingContext2D): void {
    const enabled = !AudioManager.getInstance().muted;
    const hovered = pointInRect(this.mouseX, this.mouseY, this.soundButton);

    ctx.save();
    if (hovered) {
      ctx.shadowColor = COLORS.ui.accent;
      ctx.shadowBlur = 10;
    }

    roundedRectPath(
      ctx,
      this.soundButton.x,
      this.soundButton.y,
      this.soundButton.w,
      this.soundButton.h,
      10,
    );
    ctx.fillStyle = enabled ? 'rgba(108, 92, 231, 0.8)' : 'rgba(99, 110, 114, 0.8)';
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.ui.text;
    ctx.font = '22px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      enabled ? '🔊' : '🔇',
      this.soundButton.x + this.soundButton.w / 2,
      this.soundButton.y + this.soundButton.h / 2,
    );
    ctx.restore();
  }

  /* -------- helpers -------- */

  private selectButton(index: number): void {
    if (index === 0) this.onStartStory();
    else if (index === 1) this.onStartInfinite();
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const y = GAME_HEIGHT - GROUND_HEIGHT;
    ctx.fillStyle = COLORS.ground.grass;
    ctx.fillRect(0, y, GAME_WIDTH, 8);
    ctx.fillStyle = COLORS.ground.surface;
    ctx.fillRect(0, y + 8, GAME_WIDTH, GROUND_HEIGHT - 8);
  }
}
