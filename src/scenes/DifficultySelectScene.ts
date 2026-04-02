import { COLORS } from '../utils/colors';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT } from '../utils/constants';
import type { Difficulty, InputAction, Scene } from '../utils/types';

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
/*  Difficulty metadata                                                */
/* ------------------------------------------------------------------ */

interface DifficultyMeta {
  key: Difficulty;
  label: string;
  description: string;
  colors: [string, string];
  textColor: string;
}

interface RewardLegendItem {
  badge: string;
  label: string;
  detail: string;
  color: string;
}

const DIFFICULTY_META: DifficultyMeta[] = [
  {
    key: 'easy',
    label: 'Easy',
    description: 'Wide gaps, slow pace',
    colors: ['#00B894', '#55E6C1'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'medium',
    label: 'Medium',
    description: 'Standard challenge',
    colors: ['#FDCB6E', '#F8A500'],
    textColor: COLORS.ui.textDark,
  },
  {
    key: 'hard',
    label: 'Hard',
    description: 'Moving pipes, fast pace',
    colors: ['#E17055', '#FF7675'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'impossible',
    label: 'Impossible',
    description: 'Pure chaos, good luck!',
    colors: ['#D63031', '#FF6B6B'],
    textColor: COLORS.ui.text,
  },
];

const REWARD_LEGEND: RewardLegendItem[] = [
  {
    badge: 'x2',
    label: 'Multiplier',
    detail: '2x or 3x score',
    color: COLORS.reward.multiplier,
  },
  {
    badge: 'S',
    label: 'Shield',
    detail: 'Blocks one hit',
    color: COLORS.reward.shield,
  },
  {
    badge: '1/2',
    label: 'Slowmo',
    detail: 'Half-speed run',
    color: COLORS.reward.slowmo,
  },
  {
    badge: '<>',
    label: 'Shrink',
    detail: 'Smaller hitbox',
    color: COLORS.reward.shrink,
  },
];

/* ------------------------------------------------------------------ */
/*  DifficultySelectScene                                              */
/* ------------------------------------------------------------------ */

/**
 * A 2×2 grid of difficulty buttons plus a Back button.
 * Rendered entirely on Canvas with keyboard + mouse navigation.
 */
export class DifficultySelectScene implements Scene {
  private readonly onSelect: (difficulty: Difficulty) => void;
  private readonly onBack: () => void;

  /** 0–3 = difficulty buttons, 4 = back button */
  private selectedIndex = 1;

  private readonly diffButtons: ButtonRect[];
  private readonly backButton: ButtonRect;

  // Mouse state
  private mouseX = -1;
  private mouseY = -1;
  private canvas: HTMLCanvasElement | null = null;

  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onMouseClick: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;

  constructor(onSelect: (difficulty: Difficulty) => void, onBack: () => void) {
    this.onSelect = onSelect;
    this.onBack = onBack;

    // 2×2 grid layout
    const btnW = 180;
    const btnH = 90;
    const gapX = 20;
    const gapY = 16;
    const gridW = btnW * 2 + gapX;
    const startX = GAME_WIDTH / 2 - gridW / 2;
    const startY = 120;

    this.diffButtons = [
      { x: startX, y: startY, w: btnW, h: btnH },
      { x: startX + btnW + gapX, y: startY, w: btnW, h: btnH },
      { x: startX, y: startY + btnH + gapY, w: btnW, h: btnH },
      { x: startX + btnW + gapX, y: startY + btnH + gapY, w: btnW, h: btnH },
    ];

    const backW = 140;
    const backH = 44;
    this.backButton = {
      x: GAME_WIDTH / 2 - backW / 2,
      y: startY + (btnH + gapY) * 2 + 20,
      w: backW,
      h: backH,
    };
  }

  /* -------- lifecycle -------- */

  /** Register mouse/keyboard listeners. */
  enter(): void {
    this.selectedIndex = 1; // default to medium
    this.mouseX = -1;
    this.mouseY = -1;

    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!this.canvas) return;

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      this.updateHoverIndex(pos.x, pos.y);
    };

    this.onMouseClick = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      this.handleClick(pos.x, pos.y);
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      const total = this.diffButtons.length + 1; // +1 for back
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (this.selectedIndex < 4) {
            this.selectedIndex = Math.min(total - 1, this.selectedIndex + 1);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          break;
        case 'ArrowDown':
        case 'Tab':
          e.preventDefault();
          this.selectedIndex = Math.min(total - 1, this.selectedIndex + 2);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectedIndex = Math.max(0, this.selectedIndex - 2);
          break;
        case 'Enter':
          e.preventDefault();
          this.activateSelected();
          break;
        case 'Escape':
          e.preventDefault();
          this.onBack();
          break;
      }
    };

    this.onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const pos = toCanvasCoords(this.canvas, touch.clientX, touch.clientY);
      this.handleClick(pos.x, pos.y);
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

  /** Abstract input forwarding. */
  handleInput(action: InputAction): void {
    if (action === 'flap' || action === 'confirm') {
      this.activateSelected();
    }
  }

  update(_dt: number): void {
    // No animation needed
  }

  /** Draw the difficulty selection screen. */
  render(ctx: CanvasRenderingContext2D): void {
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    bg.addColorStop(0, COLORS.sky.topDefault);
    bg.addColorStop(1, COLORS.sky.bottomDefault);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Ground bar
    ctx.fillStyle = COLORS.ground.surface;
    ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

    // Title
    ctx.save();
    ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillText('Select Difficulty', GAME_WIDTH / 2 + 2, 62);
    ctx.fillStyle = COLORS.ui.text;
    ctx.fillText('Select Difficulty', GAME_WIDTH / 2, 60);
    ctx.restore();

    this.renderRewardLegend(ctx);

    // Difficulty buttons
    this.diffButtons.forEach((btn, i) => {
      const meta = DIFFICULTY_META[i];
      const hovered = pointInRect(this.mouseX, this.mouseY, btn);
      const highlight = hovered || this.selectedIndex === i;

      ctx.save();

      if (highlight) {
        ctx.shadowColor = meta.colors[0];
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 3;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
      }

      const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x + btn.w, btn.y + btn.h);
      grad.addColorStop(0, meta.colors[highlight ? 1 : 0]);
      grad.addColorStop(1, meta.colors[highlight ? 0 : 1]);

      roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, 14);
      ctx.fillStyle = grad;
      ctx.fill();

      if (this.selectedIndex === i) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = meta.textColor;
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.label, btn.x + btn.w / 2, btn.y + btn.h / 2 - 12);

      // Description
      ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText(meta.description, btn.x + btn.w / 2, btn.y + btn.h / 2 + 16);

      ctx.restore();
    });

    // Back button
    const backHovered = pointInRect(this.mouseX, this.mouseY, this.backButton);
    const backHighlight = backHovered || this.selectedIndex === 4;

    ctx.save();
    if (backHighlight) {
      ctx.shadowColor = '#636E72';
      ctx.shadowBlur = 12;
    }

    const backGrad = ctx.createLinearGradient(
      this.backButton.x, this.backButton.y,
      this.backButton.x + this.backButton.w, this.backButton.y + this.backButton.h,
    );
    backGrad.addColorStop(0, backHighlight ? '#B2BEC3' : '#636E72');
    backGrad.addColorStop(1, backHighlight ? '#636E72' : '#B2BEC3');

    roundedRectPath(ctx, this.backButton.x, this.backButton.y, this.backButton.w, this.backButton.h, 10);
    ctx.fillStyle = backGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← Back', this.backButton.x + this.backButton.w / 2, this.backButton.y + this.backButton.h / 2);
    ctx.restore();
  }

  /* -------- private -------- */

  private updateHoverIndex(px: number, py: number): void {
    for (let i = 0; i < this.diffButtons.length; i++) {
      if (pointInRect(px, py, this.diffButtons[i])) {
        this.selectedIndex = i;
        return;
      }
    }
    if (pointInRect(px, py, this.backButton)) {
      this.selectedIndex = 4;
    }
  }

  private handleClick(px: number, py: number): void {
    for (let i = 0; i < this.diffButtons.length; i++) {
      if (pointInRect(px, py, this.diffButtons[i])) {
        this.onSelect(DIFFICULTY_META[i].key);
        return;
      }
    }
    if (pointInRect(px, py, this.backButton)) {
      this.onBack();
    }
  }

  private activateSelected(): void {
    if (this.selectedIndex < 4) {
      this.onSelect(DIFFICULTY_META[this.selectedIndex].key);
    } else {
      this.onBack();
    }
  }

  private renderRewardLegend(ctx: CanvasRenderingContext2D): void {
    const panel = { x: 18, y: 114, w: 172, h: 200 };

    ctx.save();
    ctx.fillStyle = 'rgba(30, 20, 60, 0.7)';
    roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Infinite Rewards', panel.x + 14, panel.y + 14);

    ctx.globalAlpha = 0.72;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Available only in Infinite mode', panel.x + 14, panel.y + 36);
    ctx.globalAlpha = 1;

    REWARD_LEGEND.forEach((reward, index) => {
      const rowY = panel.y + 60 + index * 34;

      ctx.fillStyle = reward.color;
      ctx.beginPath();
      ctx.arc(panel.x + 22, rowY + 10, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.ui.textDark;
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(reward.badge, panel.x + 22, rowY + 10);

      ctx.fillStyle = COLORS.ui.text;
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(reward.label, panel.x + 40, rowY);

      ctx.globalAlpha = 0.8;
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(reward.detail, panel.x + 40, rowY + 14);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }
}
