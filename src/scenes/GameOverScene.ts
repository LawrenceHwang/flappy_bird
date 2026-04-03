import type { Scene, InputAction, GameMode, Difficulty } from '../utils/types';
import { COLORS } from '../utils/colors';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import { clamp, easeOutCubic } from '../utils/math';
import { ParticleEmitter } from '../entities/Particles';
import { GRAPHICS_THEME } from '../graphics/theme';
import {
  drawButton,
  drawGlassPanel,
  drawSceneTitle,
  roundedRectPath,
} from '../graphics/ui-kit';

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
  private displayScore = 0;
  private scoreAnimDone = false;

  private particles: ParticleEmitter | null = null;
  private readonly retryButton: ButtonRect;
  private readonly menuButton: ButtonRect;

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

    const btnW = 186;
    const btnH = 52;
    const gap = 20;
    const totalW = btnW * 2 + gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    const btnY = 308;

    this.retryButton = { x: startX, y: btnY, w: btnW, h: btnH };
    this.menuButton = { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH };
  }

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

  handleInput(action: InputAction): void {
    if (action === 'flap' || action === 'confirm') {
      this.activateSelected();
    }
  }

  update(dt: number): void {
    this.elapsed += dt;

    if (!this.scoreAnimDone) {
      const t = clamp(this.elapsed / 1.2, 0, 1);
      this.displayScore = Math.round(easeOutCubic(t) * this.score);
      if (t >= 1) {
        this.displayScore = this.score;
        this.scoreAnimDone = true;
      }
    }

    if (this.isHighScore && this.scoreAnimDone && this.particles && this.elapsed % 0.4 < dt) {
      const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
      const py = 160 + (Math.random() - 0.5) * 40;
      this.particles.emit(px, py, 6, COLORS.particles.reward);
    }

    this.particles?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const panel = { x: GAME_WIDTH / 2 - 220, y: GAME_HEIGHT / 2 - 165, w: 440, h: 330 };
    const title =
      this.mode === 'story' && this.level !== undefined
        ? `Level ${this.level} Failed`
        : 'Game Over';

    ctx.fillStyle = 'rgba(6, 9, 22, 0.72)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawGlassPanel(ctx, panel, {
      accent: this.isHighScore ? 'rgba(245, 206, 117, 0.16)' : 'rgba(96, 116, 255, 0.14)',
    });
    drawSceneTitle(ctx, {
      x: GAME_WIDTH / 2,
      y: panel.y + 56,
      eyebrow: this.isHighScore ? 'NEW RECORD' : 'RUN ENDED',
      title,
      width: 320,
    });

    this.renderScoreCard(ctx, panel.y + 104);

    if (this.isHighScore && this.scoreAnimDone) {
      ctx.fillStyle = '#f7d28d';
      ctx.font = '700 18px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STAR SCORE ACHIEVED', GAME_WIDTH / 2, panel.y + 214);
    }

    const info =
      this.mode === 'infinite' && this.difficulty
        ? `Infinite • ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}`
        : this.mode === 'story' && this.level !== undefined
          ? `Story • Level ${this.level}`
          : this.mode;
    ctx.fillStyle = GRAPHICS_THEME.text.muted;
    ctx.font = GRAPHICS_THEME.fonts.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info, GAME_WIDTH / 2, panel.y + 244);

    drawButton(ctx, this.retryButton, {
      label: 'Retry',
      leadingIcon: '↻',
      tone: 'violet',
      hovered: pointInRect(this.mouseX, this.mouseY, this.retryButton),
      selected: this.selectedIndex === 0,
    });
    drawButton(ctx, this.menuButton, {
      label: 'Menu',
      leadingIcon: '⌂',
      tone: 'slate',
      hovered: pointInRect(this.mouseX, this.mouseY, this.menuButton),
      selected: this.selectedIndex === 1,
    });

    this.particles?.render(ctx);
  }

  private renderScoreCard(ctx: CanvasRenderingContext2D, topY: number): void {
    const x = GAME_WIDTH / 2 - 86;
    const y = topY;
    const w = 172;
    const h = 92;

    ctx.save();
    roundedRectPath(ctx, x, y, w, h, 20);
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, GRAPHICS_THEME.surface.chipTop);
    fill.addColorStop(1, GRAPHICS_THEME.surface.chipBottom);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = GRAPHICS_THEME.hud.badgeStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = GRAPHICS_THEME.text.muted;
    ctx.font = GRAPHICS_THEME.fonts.label;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SCORE', GAME_WIDTH / 2, y + 14);

    ctx.font = '700 46px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(x + 12, y + 26, x + w - 12, y + h);
    grad.addColorStop(0, '#fffef4');
    grad.addColorStop(0.4, '#ffe6be');
    grad.addColorStop(1, '#f7b58b');
    ctx.fillStyle = grad;
    ctx.fillText(`${this.displayScore}`, GAME_WIDTH / 2, y + 56);
    ctx.restore();
  }

  private activateSelected(): void {
    if (this.selectedIndex === 0) this.onRetry();
    else this.onMenu();
  }
}
