import type { Scene, InputAction } from '../utils/types';
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
/*  LevelCompleteScene                                                 */
/* ------------------------------------------------------------------ */

const MAX_LEVEL = 20;

/**
 * Celebration screen shown after completing a story-mode level.
 *
 * Displays an animated star, score, particles, and navigation buttons.
 * Level 20 triggers a special victory message.
 */
export class LevelCompleteScene implements Scene {
  private readonly level: number;
  private readonly score: number;
  private readonly onNextLevel: () => void;
  private readonly onMenu: () => void;

  private selectedIndex = 0;
  private elapsed = 0;

  /** Animated score counter. */
  private displayScore = 0;
  private scoreAnimDone = false;

  private particles: ParticleEmitter | null = null;
  private readonly isVictory: boolean;

  private readonly primaryButton: ButtonRect;
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

    const btnW = 180;
    const btnH = 50;
    const gap = 20;
    const totalW = btnW * 2 + gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    const btnY = 310;

    this.primaryButton = { x: startX, y: btnY, w: btnW, h: btnH };
    this.menuButton = { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH };
  }

  /* -------- lifecycle -------- */

  /** Register listeners. */
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

  /** Flap / confirm → next level. */
  handleInput(action: InputAction): void {
    if (action === 'flap' || action === 'confirm') {
      this.activateSelected();
    }
  }

  /** Tick score animation and particles. */
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

    // Periodic celebration particles
    if (this.particles && this.elapsed % 0.3 < dt) {
      const px = GAME_WIDTH / 2 + (Math.random() - 0.5) * 300;
      const py = 80 + Math.random() * 60;
      this.particles.emit(px, py, 5, COLORS.particles.reward);
    }

    this.particles?.update(dt);
  }

  /** Draw the level-complete / victory panel. */
  render(ctx: CanvasRenderingContext2D): void {
    // Dim backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Panel
    const panelW = 440;
    const panelH = 310;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = GAME_HEIGHT / 2 - panelH / 2 - 10;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 24;
    roundedRectPath(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.fillStyle = COLORS.ui.background;
    ctx.fill();
    ctx.restore();

    // Animated star
    this.renderStar(ctx, GAME_WIDTH / 2, panelY - 10);

    if (this.isVictory) {
      this.renderVictory(ctx, panelY);
    } else {
      this.renderLevelComplete(ctx, panelY);
    }

    // Score
    ctx.save();
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.6;
    ctx.fillText('SCORE', GAME_WIDTH / 2, panelY + 120);
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ui.text;
    ctx.fillText(`${this.displayScore}`, GAME_WIDTH / 2, panelY + 155);
    ctx.restore();

    // Level indicator
    ctx.save();
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.5;
    ctx.fillText(`Level ${this.level} of ${MAX_LEVEL}`, GAME_WIDTH / 2, panelY + 195);
    ctx.restore();

    // Buttons
    const primaryLabel = this.isVictory ? '🏆 Play Again' : '▶ Next Level';
    const primaryColors: [string, string] = this.isVictory
      ? ['#FDCB6E', '#F8A500']
      : ['#00B894', '#55E6C1'];
    const primaryText = this.isVictory ? COLORS.ui.textDark : COLORS.ui.text;

    this.renderButton(ctx, this.primaryButton, primaryLabel, primaryColors, 0, primaryText);
    this.renderButton(ctx, this.menuButton, '🏠 Menu', ['#636E72', '#B2BEC3'], 1, COLORS.ui.text);

    // Particles
    this.particles?.render(ctx);
  }

  /* -------- private rendering -------- */

  private renderLevelComplete(ctx: CanvasRenderingContext2D, panelY: number): void {
    ctx.save();
    ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const grad = ctx.createLinearGradient(
      GAME_WIDTH / 2 - 120, panelY + 50,
      GAME_WIDTH / 2 + 120, panelY + 50,
    );
    grad.addColorStop(0, '#00B894');
    grad.addColorStop(1, '#55E6C1');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.fillText(`Level ${this.level} Complete!`, GAME_WIDTH / 2, panelY + 55);
    ctx.restore();
  }

  private renderVictory(ctx: CanvasRenderingContext2D, panelY: number): void {
    ctx.save();
    ctx.font = 'bold 32px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const grad = ctx.createLinearGradient(
      GAME_WIDTH / 2 - 150, panelY + 45,
      GAME_WIDTH / 2 + 150, panelY + 45,
    );
    grad.addColorStop(0, '#FDCB6E');
    grad.addColorStop(0.5, '#F8A500');
    grad.addColorStop(1, '#FDCB6E');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.fillText('🎉 Victory! 🎉', GAME_WIDTH / 2, panelY + 45);
    ctx.restore();

    ctx.save();
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.8;
    ctx.fillText("You've Mastered Flappy Bird!", GAME_WIDTH / 2, panelY + 80);
    ctx.restore();
  }

  /** Draw an animated rotating star above the panel. */
  private renderStar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const scale = 0.8 + 0.2 * Math.sin(this.elapsed * 3);
    const rotation = this.elapsed * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#FDCB6E';
    ctx.shadowColor = 'rgba(253, 203, 110, 0.6)';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](Math.cos(angle) * 22, Math.sin(angle) * 22);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderButton(
    ctx: CanvasRenderingContext2D,
    btn: ButtonRect,
    label: string,
    colors: [string, string],
    index: number,
    textColor: string,
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
    ctx.fillStyle = textColor;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.restore();
  }

  /* -------- actions -------- */

  private activatePrimary(): void {
    this.onNextLevel();
  }

  private activateSelected(): void {
    if (this.selectedIndex === 0) this.activatePrimary();
    else this.onMenu();
  }
}
