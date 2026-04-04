import type { Scene, InputAction } from '../utils/types';
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

const MAX_LEVEL = 20;

export class LevelCompleteScene implements Scene {
  private readonly level: number;
  private readonly score: number;
  private readonly onNextLevel: () => void;
  private readonly onMenu: () => void;

  private selectedIndex = 0;
  private elapsed = 0;
  private displayScore = 0;
  private scoreAnimDone = false;

  private particles: ParticleEmitter | null = null;
  private readonly isVictory: boolean;

  private readonly primaryButton: ButtonRect;
  private readonly menuButton: ButtonRect;

  private mouseX = -1;
  private mouseY = -1;
  private canvas: HTMLCanvasElement | null = null;

  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onMouseClick: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;

  constructor(
    level: number,
    score: number,
    onNextLevel: () => void,
    onMenu: () => void,
  ) {
    this.level = level;
    this.score = score;
    this.onNextLevel = onNextLevel;
    this.onMenu = onMenu;
    this.isVictory = level >= MAX_LEVEL;

    const btnW = 198;
    const btnH = 52;
    const gap = 20;
    const totalW = btnW * 2 + gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    const btnY = 318;

    this.primaryButton = { x: startX, y: btnY, w: btnW, h: btnH };
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
      if (pointInRect(pos.x, pos.y, this.primaryButton)) this.selectedIndex = 0;
      else if (pointInRect(pos.x, pos.y, this.menuButton)) this.selectedIndex = 1;
    };

    this.onMouseClick = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      if (pointInRect(pos.x, pos.y, this.primaryButton)) this.activatePrimary();
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
      if (pointInRect(pos.x, pos.y, this.primaryButton)) this.activatePrimary();
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
      const t = clamp(this.elapsed / 1.0, 0, 1);
      this.displayScore = Math.round(easeOutCubic(t) * this.score);
      if (t >= 1) {
        this.displayScore = this.score;
        this.scoreAnimDone = true;
      }
    }

    if (this.particles && this.elapsed % 0.3 < dt) {
      const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 300;
      const py = 80 + Math.random() * 60;
      this.particles.emit(px, py, 5, COLORS.particles.reward);
    }

    this.particles?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const panel = { x: GAME_WIDTH / 2 - 228, y: GAME_HEIGHT / 2 - 162, w: 456, h: 324 };

    ctx.fillStyle = 'rgba(6, 9, 22, 0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawGlassPanel(ctx, panel, {
      accent: this.isVictory ? 'rgba(245, 206, 117, 0.18)' : 'rgba(74, 223, 186, 0.14)',
    });

    drawSceneTitle(ctx, {
      x: GAME_WIDTH / 2,
      y: panel.y + 54,
      title: this.isVictory ? 'Victory!' : `Level ${this.level} Complete`,
      width: this.isVictory ? 250 : 340,
    });

    this.renderScoreCard(ctx, panel.y + 112);
    this.renderInfoChip(ctx, panel.y + 228);

    drawButton(ctx, this.primaryButton, {
      label: this.isVictory ? 'Play Again' : 'Next Level',
      leadingIcon: this.isVictory ? '★' : '➜',
      tone: this.isVictory ? 'gold' : 'emerald',
      hovered: pointInRect(this.mouseX, this.mouseY, this.primaryButton),
      selected: this.selectedIndex === 0,
    });
    drawButton(ctx, this.menuButton, {
      label: 'Back to Menu',
      leadingIcon: '⌂',
      tone: 'slate',
      hovered: pointInRect(this.mouseX, this.mouseY, this.menuButton),
      selected: this.selectedIndex === 1,
    });

    this.particles?.render(ctx);
  }

  private renderScoreCard(ctx: CanvasRenderingContext2D, topY: number): void {
    const x = GAME_WIDTH / 2 - 96;
    const y = topY;
    const w = 192;
    const h = 96;

    ctx.save();
    roundedRectPath(ctx, x, y, w, h, 22);
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

    const grad = ctx.createLinearGradient(x + 16, y + 30, x + w - 16, y + h);
    grad.addColorStop(0, '#fffef4');
    grad.addColorStop(0.4, '#fff0cb');
    grad.addColorStop(1, '#ffe39f');
    ctx.fillStyle = grad;
    ctx.font = '700 44px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.displayScore}`, GAME_WIDTH / 2, y + 58);
    ctx.restore();
  }

  private renderInfoChip(ctx: CanvasRenderingContext2D, y: number): void {
    const text = this.isVictory ? `Story Complete • ${MAX_LEVEL}/${MAX_LEVEL}` : `Story • Level ${this.level} of ${MAX_LEVEL}`;

    ctx.save();
    ctx.font = '600 12px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    const width = Math.max(206, Math.min(320, ctx.measureText(text).width + 34));
    const rect = { x: GAME_WIDTH / 2 - width / 2, y, w: width, h: 30 };

    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 15);
    ctx.fillStyle = this.isVictory ? 'rgba(245, 206, 117, 0.16)' : 'rgba(74, 223, 186, 0.12)';
    ctx.fill();
    ctx.strokeStyle = this.isVictory ? 'rgba(245, 206, 117, 0.28)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = GRAPHICS_THEME.text.secondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, GAME_WIDTH / 2, rect.y + rect.h / 2);
    ctx.restore();
  }

  private activatePrimary(): void {
    this.onNextLevel();
  }

  private activateSelected(): void {
    if (this.selectedIndex === 0) this.activatePrimary();
    else this.onMenu();
  }
}
