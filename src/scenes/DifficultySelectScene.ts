import { Background } from '../entities/Background';
import { COLORS } from '../utils/colors';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
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

interface DifficultyLayout {
  eyebrowY: number;
  titleY: number;
  panel: ButtonRect;
  dividerX: number;
  diffButtons: readonly ButtonRect[];
  backButton: ButtonRect;
  controlPills: readonly ButtonRect[];
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
  kicker: string;
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

function createDifficultyLayout(): DifficultyLayout {
  const panel = { x: 44, y: 94, w: 712, h: 260 };
  const dividerX = panel.x + 204;
  const cardW = 226;
  const cardH = 88;
  const gapX = 16;
  const gapY = 14;
  const gridX = dividerX + 20;
  const gridY = panel.y + 48;

  return {
    eyebrowY: 48,
    titleY: 78,
    panel,
    dividerX,
    diffButtons: [
      { x: gridX, y: gridY, w: cardW, h: cardH },
      { x: gridX + cardW + gapX, y: gridY, w: cardW, h: cardH },
      { x: gridX, y: gridY + cardH + gapY, w: cardW, h: cardH },
      { x: gridX + cardW + gapX, y: gridY + cardH + gapY, w: cardW, h: cardH },
    ],
    backButton: { x: 310, y: 362, w: 180, h: 30 },
    controlPills: [
      { x: 233, y: 410, w: 156, h: 22 },
      { x: 401, y: 410, w: 156, h: 22 },
    ],
  };
}

const DIFFICULTY_LAYOUT = createDifficultyLayout();

const DIFFICULTY_META: DifficultyMeta[] = [
  {
    key: 'easy',
    kicker: 'ENTRY',
    label: 'Easy',
    description: 'Wide gates and slower scroll',
    colors: ['#0A6E60', '#5AECD4'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'medium',
    kicker: 'STANDARD',
    label: 'Medium',
    description: 'Balanced pace for repeat runs',
    colors: ['#7A5510', '#FFD06B'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'hard',
    kicker: 'ADVANCED',
    label: 'Hard',
    description: 'Moving pipes and tighter windows',
    colors: ['#8C2A22', '#FF8F6B'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'impossible',
    kicker: 'LEGEND',
    label: 'Impossible',
    description: 'Relentless speed and no mercy',
    colors: ['#7A1535', '#FF5C85'],
    textColor: COLORS.ui.text,
  },
];

const REWARD_LEGEND: RewardLegendItem[] = [
  {
    badge: 'x2',
    label: 'Multiplier',
    detail: 'Temporary 2x or 3x scoring',
    color: COLORS.reward.multiplier,
  },
  {
    badge: 'S',
    label: 'Shield',
    detail: 'Blocks the next pipe collision',
    color: COLORS.reward.shield,
  },
  {
    badge: '½',
    label: 'Slowmo',
    detail: 'Cuts the run speed in half',
    color: COLORS.reward.slowmo,
  },
  {
    badge: '↔',
    label: 'Shrink',
    detail: 'Tightens the bird hitbox',
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
  private lastGridIndex = 1;
  private elapsed = 0;

  private background: Background | null = null;

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
    this.diffButtons = [...DIFFICULTY_LAYOUT.diffButtons];
    this.backButton = { ...DIFFICULTY_LAYOUT.backButton };
  }

  /* -------- lifecycle -------- */

  /** Register mouse/keyboard listeners. */
  enter(): void {
    this.selectedIndex = 1;
    this.lastGridIndex = 1;
    this.elapsed = 0;
    this.mouseX = -1;
    this.mouseY = -1;
    this.background = new Background();

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
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          this.moveSelection('right');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.moveSelection('left');
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.moveSelection('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveSelection('up');
          break;
        case 'Tab':
          e.preventDefault();
          this.moveSelection('next');
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

  update(dt: number): void {
    this.elapsed += dt;
    this.background?.update(dt, 0.45);
  }

  /** Draw the difficulty selection screen. */
  render(ctx: CanvasRenderingContext2D): void {
    this.background?.render(ctx, COLORS.sky.topDefault, COLORS.sky.bottomDefault);
    this.renderAtmosphericLighting(ctx);
    this.renderTitle(ctx);
    this.renderPanel(ctx);
    this.renderBackButton(ctx);
    this.renderControlHints(ctx);
  }

  /* -------- private -------- */

  private updateHoverIndex(px: number, py: number): void {
    for (let i = 0; i < this.diffButtons.length; i++) {
      if (pointInRect(px, py, this.diffButtons[i])) {
        this.selectedIndex = i;
        this.lastGridIndex = i;
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
        this.lastGridIndex = i;
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
      this.lastGridIndex = this.selectedIndex;
      this.onSelect(DIFFICULTY_META[this.selectedIndex].key);
    } else {
      this.onBack();
    }
  }

  private moveSelection(direction: 'left' | 'right' | 'up' | 'down' | 'next'): void {
    if (direction === 'next') {
      this.selectedIndex = (this.selectedIndex + 1) % 5;
      if (this.selectedIndex < 4) this.lastGridIndex = this.selectedIndex;
      return;
    }

    if (this.selectedIndex === 4) {
      if (direction === 'up') {
        this.selectedIndex = this.lastGridIndex >= 2 ? this.lastGridIndex : 2;
      }
      return;
    }

    const row = Math.floor(this.selectedIndex / 2);
    const col = this.selectedIndex % 2;

    switch (direction) {
      case 'left':
        if (col > 0) {
          this.selectedIndex -= 1;
        }
        break;
      case 'right':
        if (col < 1) {
          this.selectedIndex += 1;
        }
        break;
      case 'up':
        if (row > 0) {
          this.selectedIndex -= 2;
        }
        break;
      case 'down':
        if (row < 1) {
          this.selectedIndex += 2;
        } else {
          this.selectedIndex = 4;
        }
        break;
    }

    if (this.selectedIndex < 4) {
      this.lastGridIndex = this.selectedIndex;
    }
  }

  /* -------- rendering -------- */

  private renderAtmosphericLighting(ctx: CanvasRenderingContext2D): void {
    const panel = DIFFICULTY_LAYOUT.panel;
    ctx.save();

    const leftGlow = ctx.createRadialGradient(
      panel.x + 100, panel.y + 60, 0,
      panel.x + 100, panel.y + 60, 200,
    );
    leftGlow.addColorStop(0, 'rgba(255, 224, 180, 0.12)');
    leftGlow.addColorStop(1, 'rgba(255, 224, 180, 0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const rightGlow = ctx.createRadialGradient(
      panel.x + panel.w * 0.65, panel.y + 40, 0,
      panel.x + panel.w * 0.65, panel.y + 40, 260,
    );
    rightGlow.addColorStop(0, 'rgba(185, 204, 255, 0.12)');
    rightGlow.addColorStop(1, 'rgba(185, 204, 255, 0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const haze = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    haze.addColorStop(0, 'rgba(18, 22, 48, 0.16)');
    haze.addColorStop(0.35, 'rgba(18, 22, 48, 0)');
    haze.addColorStop(1, 'rgba(55, 41, 70, 0.1)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.restore();
  }

  private renderTitle(ctx: CanvasRenderingContext2D): void {
    const cx = GAME_WIDTH / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Eyebrow
    ctx.fillStyle = 'rgba(255, 239, 205, 0.68)';
    ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('INFINITE MODE', cx, DIFFICULTY_LAYOUT.eyebrowY);

    const titleText = 'Choose a Challenge';
    const titleY = DIFFICULTY_LAYOUT.titleY;

    // Layer 1: Shadow
    ctx.font = 'bold 40px Georgia, Cambria, "Times New Roman", serif';
    ctx.fillStyle = 'rgba(36, 25, 18, 0.3)';
    ctx.fillText(titleText, cx + 2, titleY + 4);

    // Layer 2: Stroke
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(93, 59, 44, 0.84)';
    ctx.strokeText(titleText, cx, titleY);

    // Layer 3: Gradient fill
    const fill = ctx.createLinearGradient(210, 52, 590, 110);
    fill.addColorStop(0, '#FFF7DE');
    fill.addColorStop(0.44, '#F1D3A1');
    fill.addColorStop(1, '#D18561');
    ctx.fillStyle = fill;
    ctx.fillText(titleText, cx, titleY);

    // Layer 4: Specular highlight
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(titleText, cx, titleY - 1);
    ctx.globalAlpha = 1;

    // Hairline below title
    ctx.strokeStyle = 'rgba(255, 232, 196, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 160, titleY + 16);
    ctx.lineTo(cx + 160, titleY + 16);
    ctx.stroke();

    ctx.restore();
  }

  private renderPanel(ctx: CanvasRenderingContext2D): void {
    const panel = DIFFICULTY_LAYOUT.panel;
    this.drawPanelShell(ctx, panel);

    // Vertical divider
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 232, 196, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(DIFFICULTY_LAYOUT.dividerX, panel.y + 18);
    ctx.lineTo(DIFFICULTY_LAYOUT.dividerX, panel.y + panel.h - 18);
    ctx.stroke();
    ctx.restore();

    this.renderRewardLegend(ctx);
    this.renderDifficultyGrid(ctx);
  }

  private renderRewardLegend(ctx: CanvasRenderingContext2D): void {
    const panel = DIFFICULTY_LAYOUT.panel;
    const leftX = panel.x + 18;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Header
    ctx.fillStyle = 'rgba(255, 234, 202, 0.52)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText('REWARDS', leftX, panel.y + 18);

    // Reward rows
    REWARD_LEGEND.forEach((reward, index) => {
      const rowY = panel.y + 42 + index * 52;

      // Row background
      roundedRectPath(ctx, panel.x + 10, rowY - 4, DIFFICULTY_LAYOUT.dividerX - panel.x - 28, 44, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fill();

      // Icon circle
      ctx.fillStyle = reward.color;
      ctx.beginPath();
      ctx.arc(leftX + 16, rowY + 16, 14, 0, Math.PI * 2);
      ctx.fill();

      // Darker overlay for icon contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.arc(leftX + 16, rowY + 16, 14, 0, Math.PI * 2);
      ctx.fill();

      // Canvas-drawn icon
      this.drawRewardIcon(ctx, leftX + 16, rowY + 16, index);

      // Label
      ctx.fillStyle = 'rgba(255, 248, 238, 0.9)';
      ctx.font = 'bold 12px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(reward.label, leftX + 36, rowY + 4);

      // Detail
      ctx.fillStyle = 'rgba(255, 239, 221, 0.56)';
      ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(reward.detail, leftX + 36, rowY + 20);
    });

    ctx.restore();
  }

  private drawRewardIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    index: number,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (index) {
      case 0: // Multiplier ×2
        ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
        ctx.fillText('×2', cx, cy + 1);
        break;
      case 1: // Shield
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + 6, cy - 3);
        ctx.lineTo(cx + 5, cy + 4);
        ctx.quadraticCurveTo(cx, cy + 9, cx, cy + 9);
        ctx.quadraticCurveTo(cx, cy + 9, cx - 5, cy + 4);
        ctx.lineTo(cx - 6, cy - 3);
        ctx.closePath();
        ctx.stroke();
        break;
      case 2: // Clock
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + 3, cy + 2);
        ctx.stroke();
        break;
      case 3: // Shrink arrows (inward)
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy);
        ctx.lineTo(cx - 2, cy);
        ctx.moveTo(cx - 5, cy - 3);
        ctx.lineTo(cx - 2, cy);
        ctx.lineTo(cx - 5, cy + 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy);
        ctx.lineTo(cx + 2, cy);
        ctx.moveTo(cx + 5, cy - 3);
        ctx.lineTo(cx + 2, cy);
        ctx.lineTo(cx + 5, cy + 3);
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  private renderDifficultyGrid(ctx: CanvasRenderingContext2D): void {
    const panel = DIFFICULTY_LAYOUT.panel;
    const rightX = DIFFICULTY_LAYOUT.dividerX + 20;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 235, 205, 0.5)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SELECT DIFFICULTY', rightX, panel.y + 18);
    ctx.restore();

    this.diffButtons.forEach((btn, index) => {
      this.renderDifficultyCard(ctx, btn, DIFFICULTY_META[index], index);
    });
  }

  private renderDifficultyCard(
    ctx: CanvasRenderingContext2D,
    btn: ButtonRect,
    meta: DifficultyMeta,
    index: number,
  ): void {
    const hovered = pointInRect(this.mouseX, this.mouseY, btn);
    const highlight = hovered || this.selectedIndex === index;
    const lift = highlight ? -2 - Math.sin(this.elapsed * 4 + index) * 0.4 : 0;

    ctx.save();

    // Accent glow behind card when selected/hovered
    if (highlight) {
      const glow = ctx.createRadialGradient(
        btn.x + btn.w / 2, btn.y + btn.h / 2, 0,
        btn.x + btn.w / 2, btn.y + btn.h / 2, btn.w * 0.6,
      );
      glow.addColorStop(0, meta.colors[1] + '18');
      glow.addColorStop(1, meta.colors[1] + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(btn.x - 20, btn.y - 20, btn.w + 40, btn.h + 40);
    }

    // Bottom bevel (3D depth layer)
    roundedRectPath(ctx, btn.x, btn.y + 5 + lift, btn.w, btn.h, 16);
    ctx.fillStyle = meta.colors[0] + 'CC';
    ctx.fill();

    // Main card face
    ctx.shadowColor = highlight ? 'rgba(14, 19, 38, 0.34)' : 'rgba(14, 19, 38, 0.22)';
    ctx.shadowBlur = highlight ? 18 : 10;
    ctx.shadowOffsetY = 3;

    const cardGrad = ctx.createLinearGradient(
      btn.x, btn.y + lift, btn.x + btn.w, btn.y + btn.h + lift,
    );
    cardGrad.addColorStop(0, meta.colors[0]);
    cardGrad.addColorStop(0.6, meta.colors[0]);
    cardGrad.addColorStop(1, meta.colors[1] + '44');
    roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 16);
    ctx.fillStyle = cardGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Upper sheen
    ctx.save();
    roundedRectPath(ctx, btn.x + 1.5, btn.y + 1 + lift, btn.w - 3, btn.h * 0.42, 15);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.restore();

    // Border
    roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 16);
    ctx.strokeStyle = highlight ? 'rgba(255, 238, 210, 0.26)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Selection ring
    if (this.selectedIndex === index) {
      ctx.strokeStyle = 'rgba(244, 222, 186, 0.68)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Icon well
    roundedRectPath(ctx, btn.x + 8, btn.y + 12 + lift, 42, btn.h - 24, 14);
    ctx.fillStyle = 'rgba(13, 17, 34, 0.22)';
    ctx.fill();

    // Icon circle
    ctx.fillStyle = meta.colors[1];
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(btn.x + 29, btn.y + btn.h / 2 + lift, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Canvas-drawn difficulty icon
    this.drawDifficultyIcon(ctx, btn.x + 29, btn.y + btn.h / 2 + lift, index);

    // Kicker badge
    roundedRectPath(ctx, btn.x + btn.w - 78, btn.y + 10 + lift, 60, 18, 9);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 243, 224, 0.76)';
    ctx.font = '700 8px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.kicker, btn.x + btn.w - 48, btn.y + 19 + lift);

    // Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = meta.textColor;
    ctx.font = 'bold 18px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(meta.label, btn.x + 58, btn.y + 32 + lift);

    // Description
    ctx.fillStyle = 'rgba(255, 242, 224, 0.68)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(meta.description, btn.x + 58, btn.y + 54 + lift);

    ctx.restore();
  }

  private drawDifficultyIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    index: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (index < 3) {
      // Chevrons: 1 for easy, 2 for medium, 3 for hard
      const count = index + 1;
      const totalWidth = count * 6;
      const startX = cx - totalWidth / 2;
      for (let i = 0; i < count; i++) {
        const x = startX + i * 6;
        ctx.beginPath();
        ctx.moveTo(x - 2, cy - 5);
        ctx.lineTo(x + 3, cy);
        ctx.lineTo(x - 2, cy + 5);
        ctx.stroke();
      }
    } else {
      // Lightning bolt for impossible
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 8);
      ctx.lineTo(cx - 4, cy - 1);
      ctx.lineTo(cx, cy - 1);
      ctx.lineTo(cx - 1, cy + 8);
      ctx.lineTo(cx + 4, cy + 1);
      ctx.lineTo(cx, cy + 1);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderBackButton(ctx: CanvasRenderingContext2D): void {
    const btn = this.backButton;
    const hovered = pointInRect(this.mouseX, this.mouseY, btn);
    const highlight = hovered || this.selectedIndex === 4;
    const lift = highlight ? -2 : 0;

    ctx.save();

    // Bottom bevel
    roundedRectPath(ctx, btn.x, btn.y + 3, btn.w, btn.h, 14);
    ctx.fillStyle = 'rgba(38, 33, 48, 0.88)';
    ctx.fill();

    // Main face
    const fill = ctx.createLinearGradient(btn.x, btn.y + lift, btn.x, btn.y + btn.h + lift);
    fill.addColorStop(0, highlight ? 'rgba(145, 151, 171, 0.88)' : 'rgba(88, 93, 110, 0.84)');
    fill.addColorStop(1, highlight ? 'rgba(95, 101, 118, 0.92)' : 'rgba(62, 66, 82, 0.92)');
    roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 14);
    ctx.fillStyle = fill;
    ctx.fill();

    // Upper sheen
    roundedRectPath(ctx, btn.x + 1.5, btn.y + 1 + lift, btn.w - 3, btn.h * 0.42, 13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();

    // Border
    roundedRectPath(ctx, btn.x, btn.y + lift, btn.w, btn.h, 14);
    ctx.strokeStyle = highlight ? 'rgba(255, 243, 224, 0.32)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Selection ring
    if (this.selectedIndex === 4) {
      ctx.strokeStyle = 'rgba(244, 226, 190, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#FEFEFE';
    ctx.font = 'bold 13px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← Back To Menu', btn.x + btn.w / 2, btn.y + btn.h / 2 + lift);

    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D): void {
    const pills = DIFFICULTY_LAYOUT.controlPills;
    const labels = [
      { header: 'MOVE', detail: 'Tab · Arrows' },
      { header: 'SELECT', detail: 'Enter · Space' },
    ];

    ctx.save();
    pills.forEach((pill, i) => {
      roundedRectPath(ctx, pill.x, pill.y, pill.w, pill.h, 11);
      ctx.fillStyle = 'rgba(17, 19, 39, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 235, 210, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255, 239, 212, 0.5)';
      ctx.font = '600 8px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(labels[i].header, pill.x + 10, pill.y + 3);

      ctx.fillStyle = 'rgba(255, 250, 241, 0.72)';
      ctx.font = '600 9.5px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(labels[i].detail, pill.x + 10, pill.y + 12);
    });
    ctx.restore();
  }

  private drawPanelShell(ctx: CanvasRenderingContext2D, rect: ButtonRect): void {
    ctx.save();
    ctx.shadowColor = 'rgba(11, 14, 34, 0.32)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;

    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 22);
    const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    fill.addColorStop(0, 'rgba(28, 26, 50, 0.74)');
    fill.addColorStop(0.5, 'rgba(22, 21, 44, 0.82)');
    fill.addColorStop(1, 'rgba(16, 17, 34, 0.88)');
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Outer border
    ctx.strokeStyle = 'rgba(255, 239, 214, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner border
    roundedRectPath(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, 20);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Upper sheen
    ctx.save();
    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 22);
    ctx.clip();
    const sheen = ctx.createRadialGradient(
      rect.x + rect.w * 0.28, rect.y + 14, 0,
      rect.x + rect.w * 0.28, rect.y + 14, 220,
    );
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();

    // Footer glow
    ctx.save();
    roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 22);
    ctx.clip();
    const footerGlow = ctx.createLinearGradient(
      rect.x, rect.y + rect.h - 30, rect.x, rect.y + rect.h,
    );
    footerGlow.addColorStop(0, 'rgba(255, 224, 180, 0)');
    footerGlow.addColorStop(1, 'rgba(255, 224, 180, 0.04)');
    ctx.fillStyle = footerGlow;
    ctx.fillRect(rect.x, rect.y + rect.h - 30, rect.w, 30);
    ctx.restore();

    // Corner dots (decorative)
    const dotInset = 12;
    ctx.fillStyle = 'rgba(255, 232, 196, 0.12)';
    const corners: [number, number][] = [
      [rect.x + dotInset, rect.y + dotInset],
      [rect.x + rect.w - dotInset, rect.y + dotInset],
      [rect.x + dotInset, rect.y + rect.h - dotInset],
      [rect.x + rect.w - dotInset, rect.y + rect.h - dotInset],
    ];
    for (const [x, y] of corners) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
