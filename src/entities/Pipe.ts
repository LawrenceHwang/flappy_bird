import { COLORS } from '../utils/colors';
import {
  PIPE_WIDTH,
  PIPE_CAP_HEIGHT,
  PIPE_CAP_OVERHANG,
  GAME_HEIGHT,
  GROUND_HEIGHT,
} from '../utils/constants';
import type { AABB } from '../utils/types';

/**
 * A single pipe obstacle made of a top and bottom section with a gap.
 *
 * The gap center can optionally oscillate vertically for harder difficulty.
 * Rendering uses rounded body gradients with a wider cap and a highlight
 * stripe for a soft 3-D look.
 */
export class Pipe {
  public x: number;
  public gapY: number;
  public readonly gapSize: number;
  public readonly width: number = PIPE_WIDTH;
  public passed: boolean = false;
  public moving: boolean;
  public oscillationSpeed: number;
  public oscillationRange: number;
  public oscillationOffset: number;
  public baseGapY: number;

  /**
   * @param x - Initial horizontal position (right edge of screen or beyond).
   * @param gapY - Vertical centre of the opening.
   * @param gapSize - Height of the opening.
   * @param moving - Whether the gap oscillates.
   * @param oscillationSpeed - Sine-wave frequency of movement.
   * @param oscillationRange - Amplitude (pixels) of movement.
   */
  constructor(
    x: number,
    gapY: number,
    gapSize: number,
    moving: boolean = false,
    oscillationSpeed: number = 0,
    oscillationRange: number = 0,
  ) {
    this.x = x;
    this.gapY = gapY;
    this.baseGapY = gapY;
    this.gapSize = gapSize;
    this.moving = moving;
    this.oscillationSpeed = oscillationSpeed;
    this.oscillationRange = oscillationRange;
    this.oscillationOffset = Math.random() * Math.PI * 2;
  }

  /**
   * Advance the pipe leftwards and apply optional vertical oscillation.
   * @param dt - Frame delta in seconds.
   * @param scrollSpeed - Horizontal speed in px / frame-at-60fps.
   * @param time - Elapsed game time in seconds (drives oscillation).
   */
  update(dt: number, scrollSpeed: number, time: number): void {
    this.x -= scrollSpeed * dt * 60;

    if (this.moving) {
      this.gapY =
        this.baseGapY +
        Math.sin(time * this.oscillationSpeed + this.oscillationOffset) *
          this.oscillationRange;
    }
  }

  /** Draw both pipe sections onto the canvas. */
  render(ctx: CanvasRenderingContext2D): void {
    const topHeight = this.gapY - this.gapSize / 2;
    const bottomY = this.gapY + this.gapSize / 2;
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomY;

    this.renderSection(ctx, this.x, 0, this.width, topHeight, 'top');
    this.renderSection(ctx, this.x, bottomY, this.width, bottomHeight, 'bottom');
  }

  /** AABB for the top pipe section (body + cap). */
  getTopHitbox(): AABB {
    const topHeight = this.gapY - this.gapSize / 2;
    return { x: this.x, y: 0, width: this.width, height: topHeight };
  }

  /** AABB for the bottom pipe section (body + cap). */
  getBottomHitbox(): AABB {
    const bottomY = this.gapY + this.gapSize / 2;
    return {
      x: this.x,
      y: bottomY,
      width: this.width,
      height: GAME_HEIGHT - GROUND_HEIGHT - bottomY,
    };
  }

  /** True once the pipe has scrolled completely off the left edge. */
  isOffScreen(): boolean {
    return this.x + this.width < 0;
  }

  /**
   * Re-initialize this pipe for object-pool reuse.
   * @param x - New horizontal position.
   * @param gapY - New gap centre.
   * @param gapSize - New gap height.
   * @param moving - Oscillation toggle.
   * @param oscillationSpeed - Oscillation frequency.
   * @param oscillationRange - Oscillation amplitude.
   */
  reinit(
    x: number,
    gapY: number,
    gapSize: number,
    moving: boolean,
    oscillationSpeed: number,
    oscillationRange: number,
  ): void {
    this.x = x;
    this.gapY = gapY;
    this.baseGapY = gapY;
    this.passed = false;
    this.moving = moving;
    this.oscillationSpeed = oscillationSpeed;
    this.oscillationRange = oscillationRange;
    this.oscillationOffset = Math.random() * Math.PI * 2;
    // gapSize is readonly, so we cast for reuse — the pool always recreates at correct size
    (this as { gapSize: number }).gapSize = gapSize;
  }

  // ---- private helpers ------------------------------------------------

  private renderSection(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    position: 'top' | 'bottom',
  ): void {
    if (h <= 0) return;

    // ── Outer body shadow for depth ──────────────────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(0,40,20,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // ── Stone-column body with rich 3-stop gradient ───────────────
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, COLORS.pipe.bodyShadow);
    grad.addColorStop(0.2, COLORS.pipe.bodyDark);
    grad.addColorStop(0.5, COLORS.pipe.bodyLight);
    grad.addColorStop(0.8, COLORS.pipe.body);
    grad.addColorStop(1, COLORS.pipe.bodyShadow);

    ctx.fillStyle = grad;
    this.roundedRect(ctx, x, y, w, h, 3);
    ctx.fill();
    ctx.restore();

    // ── Bright left highlight stripe ─────────────────────────────
    ctx.save();
    const hiGrad = ctx.createLinearGradient(x + 4, y, x + 11, y);
    hiGrad.addColorStop(0, 'rgba(168,255,212,0.55)');
    hiGrad.addColorStop(1, 'rgba(168,255,212,0)');
    ctx.fillStyle = hiGrad;
    ctx.fillRect(x + 4, y + 2, 7, h - 4);
    ctx.restore();

    // ── Subtle rune markings (decorative horizontal lines) ────────
    ctx.save();
    ctx.strokeStyle = COLORS.pipe.rune;
    ctx.lineWidth = 1;
    const runeSpacing = 22;
    const runeStart = y + 14;
    const runeCount = Math.floor((h - 20) / runeSpacing);
    for (let i = 0; i < runeCount; i++) {
      const ry = runeStart + i * runeSpacing;
      // Short centered dash rune
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, ry);
      ctx.lineTo(x + w * 0.72, ry);
      ctx.stroke();
      // Diamond dot in center
      ctx.save();
      ctx.translate(x + w * 0.5, ry);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.pipe.rune;
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
    ctx.restore();

    // ── Cap (wider ornate band with beveled edge) ─────────────────
    const capX = x - PIPE_CAP_OVERHANG - 2;
    const capW = w + (PIPE_CAP_OVERHANG + 2) * 2;
    const capH = PIPE_CAP_HEIGHT + 4;
    const capY = position === 'top' ? y + h - capH : y;

    ctx.save();
    ctx.shadowColor = 'rgba(0,40,20,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = position === 'top' ? 3 : -3;

    const capGrad = ctx.createLinearGradient(capX, capY, capX + capW, capY);
    capGrad.addColorStop(0, COLORS.pipe.capDark);
    capGrad.addColorStop(0.25, COLORS.pipe.cap);
    capGrad.addColorStop(0.5, COLORS.pipe.capLight);
    capGrad.addColorStop(0.75, COLORS.pipe.cap);
    capGrad.addColorStop(1, COLORS.pipe.capDark);

    ctx.fillStyle = capGrad;
    this.roundedRect(ctx, capX, capY, capW, capH, 5);
    ctx.fill();
    ctx.restore();

    // Cap glow outline (subtle inner border)
    ctx.save();
    ctx.strokeStyle = 'rgba(168,255,212,0.35)';
    ctx.lineWidth = 1.5;
    this.roundedRect(ctx, capX + 1, capY + 1, capW - 2, capH - 2, 4);
    ctx.stroke();

    // Cap top highlight band
    const hiCapGrad = ctx.createLinearGradient(capX, capY, capX + capW, capY);
    hiCapGrad.addColorStop(0, 'rgba(255,255,255,0)');
    hiCapGrad.addColorStop(0.3, 'rgba(255,255,255,0.22)');
    hiCapGrad.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    hiCapGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hiCapGrad;
    ctx.fillRect(capX + 2, capY + 2, capW - 4, 4);
    ctx.restore();

    // ── Magical glow at the gap edge ──────────────────────────────
    const glowY = position === 'top' ? y + h : capY;
    const glowH = position === 'top' ? 10 : -10;
    const glowGrad = ctx.createLinearGradient(0, glowY, 0, glowY + glowH);
    glowGrad.addColorStop(0, 'rgba(100,255,180,0.18)');
    glowGrad.addColorStop(1, 'rgba(100,255,180,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(capX, glowY, capW, glowH);
  }

  private roundedRect(
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
}
