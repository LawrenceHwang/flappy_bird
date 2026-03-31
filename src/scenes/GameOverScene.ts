import type { Scene, InputAction, GameMode, Difficulty } from '../utils/types';
import { COLORS } from '../utils/colors';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import { clamp, easeOutCubic } from '../utils/math';
import { ParticleEmitter } from '../entities/Particles';

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
/*  GameOverScene                                                      */
/* ------------------------------------------------------------------ */

/**
 * Shown after the player dies.
 *
 * Features an animated score count-up, optional "NEW HIGH SCORE!"
 * celebration with particles, and Retry / Menu buttons.
 */
export class GameOverScene implements Scene {
  private readonly score: number;
  private readonly isHighScore: boolean;
  private readonly mode: GameMode;
  private readonly onRetry: () => void;
  private readonly onMenu: () => void;
  private readonly difficulty?: Difficulty;
  private readonly level?: number;

  private selectedIndex = 0;
  private elapsed = 0;

  /** Animated counter that ramps up to the real score. */
  private displayScore = 0;
  private scoreAnimDone = false;

  private particles: ParticleEmitter | null = null;

  private readonly retryButton: ButtonRect;
  private readonly menuButton: ButtonRect;

  // Mouse state
  private mouseX = -1;
  private mouseY = -1;
  private canvas: HTMLCanvasElement | null = null;

  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onMouseClick: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;

  constructor(
    score: number,
    isHighScore: boolean,
    mode: GameMode,
    onRetry: () => void,
    onMenu: () => void,
    difficulty?: Difficulty,
    level?: number,
  ) {
    this.score = score;
    this.isHighScore = isHighScore;
    this.mode = mode;
    this.onRetry = onRetry;
    this.onMenu = onMenu;
    this.difficulty = difficulty;
    this.level = level;

    const btnW = 180;
    const btnH = 50;
    const gap = 20;
    const totalW = btnW * 2 + gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    const btnY = 310;

    this.retryButton = { x: startX, y: btnY, w: btnW, h: btnH };
    this.menuButton = { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH };
  }

  /* -------- lifecycle -------- */

  /** Register listeners and prepare particles. */
  enter(): void {
    this.elapsed = 0;
    this.displayScore = 0;
    this.scoreAnimDone = false;
    this.selectedIndex = 0;
    this.mouseX = -1;
    this.mouseY = -1;

    this.particles = new ParticleEmitter();

    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) return;

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      if (pointInRect(pos.x, pos.y, this.retryButton)) this.selectedIndex = 0;
      else if (pointInRect(pos.x, pos.y, this.menuButton)) this.selectedIndex = 1;
    };

    this.onMouseClick = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      if (pointInRect(pos.x, pos.y, this.retryButton)) this.onRetry();
      else if (pointInRect(pos.x, pos.y, this.menuButton)) this.onMenu();
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault();
          this.selectedIndex = this.selectedIndex === 0 ? 1 : 0;
          break;
        case 'Enter':
          e.preventDefault();
          this.activateSelected();
          break;
        case 'Escape':
          e.preventDefault();
          this.onMenu();
          break;
      }
    };

    this.onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const pos = toCanvasCoords(this.canvas, touch.clientX, touch.clientY);
      if (pointInRect(pos.x, pos.y, this.retryButton)) this.onRetry();
      else if (pointInRect(pos.x, pos.y, this.menuButton)) this.onMenu();
    };

    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('click', this.onMouseClick);
    document.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  /** Remove listeners. */
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

  /** Retry on flap / confirm. */
  handleInput(action: InputAction): void {
    if (action === 'flap' || action === 'confirm') {
      this.activateSelected();
    }
  }

  /** Animate score counter and celebration particles. */
  update(dt: number): void {
    this.elapsed += dt;

    // Score count-up over ~1.2 s
    if (!this.scoreAnimDone) {
      const t = clamp(this.elapsed / 1.2, 0, 1);
      this.displayScore = Math.round(easeOutCubic(t) * this.score);
      if (t >= 1) {
        this.displayScore = this.score;
        this.scoreAnimDone = true;
      }
    }

    // Celebration particles once count-up finishes
    if (this.isHighScore && this.scoreAnimDone && this.particles) {
      if (this.elapsed % 0.4 < dt) {
        const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
        const py = 160 + (Math.random() - 0.5) * 40;
        this.particles.emit(px, py, 6, COLORS.particles.reward);
      }
    }

    this.particles?.update(dt);
  }

  /** Render the game-over panel. */
  render(ctx: CanvasRenderingContext2D): void {
    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel
    const panelW = 420;
    const panelH = 300;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = GAME_HEIGHT / 2 - panelH / 2 - 10;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24;
    roundedRectPath(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.fillStyle = COLORS.ui.background;
    ctx.fill();
    ctx.restore();

    // Title
    const title =
      this.mode === 'story' && this.level !== undefined
        ? `Level ${this.level} Failed`
        : 'Game Over';

    ctx.save();
    ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E17055';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.fillText(title, GAME_WIDTH / 2, panelY + 55);
    ctx.restore();

    // Score
    ctx.save();
    ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ui.text;
    ctx.fillText(`${this.displayScore}`, GAME_WIDTH / 2, panelY + 130);

    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.globalAlpha = 0.6;
    ctx.fillText('SCORE', GAME_WIDTH / 2, panelY + 100);
    ctx.restore();

    // High score badge
    if (this.isHighScore && this.scoreAnimDone) {
      ctx.save();
      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const badgeGrad = ctx.createLinearGradient(
        GAME_WIDTH / 2 - 100, panelY + 170,
        GAME_WIDTH / 2 + 100, panelY + 170,
      );
      badgeGrad.addColorStop(0, '#FDCB6E');
      badgeGrad.addColorStop(1, '#F8A500');
      ctx.fillStyle = badgeGrad;
      ctx.fillText('⭐ NEW HIGH SCORE! ⭐', GAME_WIDTH / 2, panelY + 180);
      ctx.restore();
    }

    // Mode / difficulty info
    ctx.save();
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.5;
    const info =
      this.mode === 'infinite' && this.difficulty
        ? `Infinite • ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}`
        : this.mode === 'story' && this.level !== undefined
          ? `Story • Level ${this.level}`
          : this.mode;
    ctx.fillText(info, GAME_WIDTH / 2, panelY + 210);
    ctx.restore();

    // Buttons
    this.renderButton(ctx, this.retryButton, '🔄 Retry', ['#6C5CE7', '#A29BFE'], 0);
    this.renderButton(ctx, this.menuButton, '🏠 Menu', ['#636E72', '#B2BEC3'], 1);

    // Particles (celebration)
    this.particles?.render(ctx);
  }

  /* -------- private -------- */

  private renderButton(
    ctx: CanvasRenderingContext2D,
    btn: ButtonRect,
    label: string,
    colors: [string, string],
    index: number,
  ): void {
    const hovered = pointInRect(this.mouseX, this.mouseY, btn);
    const highlight = hovered || this.selectedIndex === index;

    ctx.save();
    if (highlight) {
      ctx.shadowColor = colors[0];
      ctx.shadowBlur = 16;
    }

    const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x + btn.w, btn.y + btn.h);
    grad.addColorStop(0, colors[highlight ? 1 : 0]);
    grad.addColorStop(1, colors[highlight ? 0 : 1]);

    roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fillStyle = grad;
    ctx.fill();

    if (this.selectedIndex === index) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.restore();
  }

  private activateSelected(): void {
    if (this.selectedIndex === 0) this.onRetry();
    else this.onMenu();
  }
}
