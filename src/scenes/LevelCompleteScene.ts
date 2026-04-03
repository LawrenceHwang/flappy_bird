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

    const btnW = 186;
    const btnH = 52;
    const gap = 20;
    const totalW = btnW * 2 + gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    const btnY = 308;

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
    const panel = { x: GAME_WIDTH / 2 - 228, y: GAME_HEIGHT / 2 - 170, w: 456, h: 336 };

    ctx.fillStyle = 'rgba(6, 9, 22, 0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawGlassPanel(ctx, panel, {
      accent: this.isVictory ? 'rgba(245, 206, 117, 0.18)' : 'rgba(74, 223, 186, 0.14)',
    });
    this.renderStar(ctx, GAME_WIDTH / 2, panel.y - 8);

    if (this.isVictory) {
      drawSceneTitle(ctx, {
        x: GAME_WIDTH / 2,
        y: panel.y + 48,
        eyebrow: 'GRAND FINALE',
        title: 'Victory!',
        width: 250,
      });

      ctx.fillStyle = GRAPHICS_THEME.text.secondary;
      ctx.font = '600 16px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText("You've mastered the full story run.", GAME_WIDTH / 2, panel.y + 84);
    } else {
      drawSceneTitle(ctx, {
        x: GAME_WIDTH / 2,
        y: panel.y + 52,
        eyebrow: 'STORY MODE',
        title: `Level ${this.level} Complete`,
        width: 340,
      });
    }

    this.renderScoreCard(ctx, panel.y + 110);

    ctx.fillStyle = GRAPHICS_THEME.text.muted;
    ctx.font = GRAPHICS_THEME.fonts.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Level ${this.level} of ${MAX_LEVEL}`, GAME_WIDTH / 2, panel.y + 234);

    drawButton(ctx, this.primaryButton, {
      label: this.isVictory ? 'Play Again' : 'Next Level',
      leadingIcon: this.isVictory ? '★' : '➜',
      tone: this.isVictory ? 'gold' : 'emerald',
      hovered: pointInRect(this.mouseX, this.mouseY, this.primaryButton),
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

  private renderStar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const scale = 0.84 + 0.18 * Math.sin(this.elapsed * 3);
    const rotation = this.elapsed * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f5cf7b';
    ctx.shadowColor = 'rgba(245, 207, 123, 0.62)';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
      else ctx.lineTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
    }
    ctx.closePath();
    ctx.fill();
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
