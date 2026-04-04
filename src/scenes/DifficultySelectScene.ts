import { Background } from '../entities/Background';
import { drawButton, drawGlassPanel, drawSceneTitle, roundedRectPath } from '../graphics/ui-kit';
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
  titleY: number;
  panel: ButtonRect;
  dividerX: number;
  diffButtons: readonly ButtonRect[];
  footer: ButtonRect;
  backButton: ButtonRect;
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
  label: string;
  color: string;
}

function createDifficultyLayout(): DifficultyLayout {
  const panel = { x: 44, y: 120, w: 712, h: 236 };
  const dividerX = panel.x + 190;
  const cardW = 234;
  const cardH = 82;
  const gapX = 16;
  const gapY = 14;
  const gridX = dividerX + 20;
  const gridY = panel.y + 34;
  const footer = { x: 44, y: 368, w: 712, h: 48 };

  return {
    titleY: 82,
    panel,
    dividerX,
    diffButtons: [
      { x: gridX, y: gridY, w: cardW, h: cardH },
      { x: gridX + cardW + gapX, y: gridY, w: cardW, h: cardH },
      { x: gridX, y: gridY + cardH + gapY, w: cardW, h: cardH },
      { x: gridX + cardW + gapX, y: gridY + cardH + gapY, w: cardW, h: cardH },
    ],
    footer,
    backButton: { x: footer.x + 14, y: footer.y + 4, w: 196, h: 40 },
  };
}

const DIFFICULTY_LAYOUT = createDifficultyLayout();

const DIFFICULTY_META: DifficultyMeta[] = [
  {
    key: 'easy',
    label: 'Easy',
    description: 'Wide gates, slower scroll',
    colors: ['#0A6E60', '#5AECD4'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'medium',
    label: 'Medium',
    description: 'Balanced pace',
    colors: ['#7A5510', '#FFD06B'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'hard',
    label: 'Hard',
    description: 'Moving pipes, tighter gaps',
    colors: ['#8C2A22', '#FF8F6B'],
    textColor: COLORS.ui.text,
  },
  {
    key: 'impossible',
    label: 'Impossible',
    description: 'Max speed, no mercy',
    colors: ['#7A1535', '#FF5C85'],
    textColor: COLORS.ui.text,
  },
];

const REWARD_LEGEND: RewardLegendItem[] = [
  {
    label: '2x Score',
    color: COLORS.reward.multiplier,
  },
  {
    label: 'Shield',
    color: COLORS.reward.shield,
  },
  {
    label: 'Slowmo',
    color: COLORS.reward.slowmo,
  },
  {
    label: 'Shrink',
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
    this.renderFooter(ctx);
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
    drawSceneTitle(ctx, {
      x: GAME_WIDTH / 2,
      y: DIFFICULTY_LAYOUT.titleY,
      eyebrow: 'INFINITE MODE',
      title: 'Choose a Challenge',
      width: 360,
    });
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
    const leftX = panel.x + 20;
    const startY = panel.y + 36;
    const chipW = 74;
    const chipH = 72;
    const gap = 10;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    REWARD_LEGEND.forEach((reward, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const chipX = leftX + col * (chipW + gap);
      const chipY = startY + row * (chipH + gap);

      roundedRectPath(ctx, chipX, chipY, chipW, chipH, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 241, 222, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = reward.color;
      ctx.beginPath();
      ctx.arc(chipX + chipW / 2, chipY + 24, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.arc(chipX + chipW / 2, chipY + 24, 16, 0, Math.PI * 2);
      ctx.fill();

      this.drawRewardIcon(ctx, chipX + chipW / 2, chipY + 24, index);

      ctx.fillStyle = 'rgba(255, 248, 238, 0.9)';
      ctx.font = '700 10px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.fillText(reward.label, chipX + chipW / 2, chipY + 52);
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

    // Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = meta.textColor;
    ctx.font = 'bold 18px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(meta.label, btn.x + 58, btn.y + 30 + lift);

    // Description
    ctx.fillStyle = 'rgba(255, 242, 224, 0.68)';
    ctx.font = '600 10px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillText(meta.description, btn.x + 58, btn.y + 50 + lift);

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

  private renderFooter(ctx: CanvasRenderingContext2D): void {
    drawGlassPanel(ctx, DIFFICULTY_LAYOUT.footer, {
      radius: 20,
      accent: 'rgba(255, 224, 180, 0.08)',
    });

    drawButton(ctx, this.backButton, {
      label: 'Back to Menu',
      leadingIcon: '←',
      tone: 'slate',
      hovered: pointInRect(this.mouseX, this.mouseY, this.backButton),
      selected: this.selectedIndex === 4,
      compact: true,
      radius: 16,
    });

    ctx.save();
    ctx.fillStyle = 'rgba(255, 239, 221, 0.62)';
    ctx.font = '600 11px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Arrows or Tab to browse • Enter or Space to start',
      DIFFICULTY_LAYOUT.footer.x + 232,
      DIFFICULTY_LAYOUT.footer.y + DIFFICULTY_LAYOUT.footer.h / 2,
    );
    ctx.restore();
  }

  private drawPanelShell(ctx: CanvasRenderingContext2D, rect: ButtonRect): void {
    drawGlassPanel(ctx, rect, {
      accent: 'rgba(255, 224, 180, 0.06)',
    });
  }
}
