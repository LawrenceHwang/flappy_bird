import { COLORS } from '../utils/colors';
import type { AABB, RewardType } from '../utils/types';

/** Visual / collision size of every reward pickup. */
const REWARD_SIZE = 30;
/** Vertical float amplitude in pixels. */
const FLOAT_AMPLITUDE = 4;
/** Vertical float frequency. */
const FLOAT_SPEED = 3;
/** Glow pulse frequency. */
const GLOW_SPEED = 4;

/**
 * A collectible power-up that floats inside a pipe gap.
 *
 * Each type has a distinct geometric icon drawn programmatically with a
 * pulsing glow halo.
 */
export class Reward {
  public x: number;
  public y: number;
  public readonly type: RewardType;
  public collected: boolean = false;
  public readonly width: number = REWARD_SIZE;
  public readonly height: number = REWARD_SIZE;

  private baseY: number;
  private time: number = 0;
  private rotationAngle: number = 0;

  /**
   * @param x - Initial horizontal position (usually inside a pipe gap).
   * @param y - Vertical centre of the gap.
   * @param type - Which power-up this represents.
   */
  constructor(x: number, y: number, type: RewardType) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.type = type;
  }

  /**
   * Scroll left, bob gently, and spin.
   * @param dt - Frame delta in seconds.
   * @param scrollSpeed - Horizontal speed px/frame-at-60fps.
   */
  update(dt: number, scrollSpeed: number): void {
    this.x -= scrollSpeed * dt * 60;
    this.time += dt;
    this.y = this.baseY + Math.sin(this.time * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    this.rotationAngle += dt * 1.2;
  }

  /** Draw the reward icon with a pulsing glow behind it. */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const r = this.width / 2;
    const glowAlpha = 0.25 + Math.sin(this.time * GLOW_SPEED) * 0.15;

    // Glow halo — use per-type glow color
    const glowColorMap: Record<string, string> = {
      multiplier: COLORS.reward.multiplierGlow,
      shield: COLORS.reward.shieldGlow,
      slowmo: COLORS.reward.slowmoGlow,
      shrink: COLORS.reward.shrinkGlow,
    };
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = glowColorMap[this.type] ?? 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotationAngle);

    switch (this.type) {
      case 'multiplier':
        this.drawStar(ctx, r);
        break;
      case 'shield':
        this.drawShield(ctx, r);
        break;
      case 'slowmo':
        this.drawClock(ctx, r);
        break;
      case 'shrink':
        this.drawShrinkArrow(ctx, r);
        break;
    }

    ctx.restore();
  }

  /** Collision bounding box. */
  getHitbox(): AABB {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  /** True once the reward has scrolled past the left edge. */
  isOffScreen(): boolean {
    return this.x + this.width < 0;
  }

  // ---- icon renderers --------------------------------------------------

  /** Five-pointed golden star. */
  private drawStar(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = COLORS.reward.multiplier;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      const outerR = r * 0.9;
      const innerR = r * 0.4;
      if (i === 0) {
        ctx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
      } else {
        ctx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
      }
      ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
    }
    ctx.closePath();
    ctx.fill();
  }

  /** Blue circle with a simple shield chevron. */
  private drawShield(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = COLORS.reward.shield;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Shield chevron
    ctx.fillStyle = '#FEFEFE';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.45);
    ctx.lineTo(r * 0.35, -r * 0.1);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.35, -r * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  /** Purple circle with clock hands. */
  private drawClock(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = COLORS.reward.slowmo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FEFEFE';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Hour hand
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.35);
    ctx.stroke();

    // Minute hand
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.3, -r * 0.1);
    ctx.stroke();

    // Centre dot
    ctx.fillStyle = '#FEFEFE';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Green circle with a downward arrow. */
  private drawShrinkArrow(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = COLORS.reward.shrink;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FEFEFE';
    ctx.beginPath();
    // Arrow shaft
    ctx.rect(-r * 0.1, -r * 0.4, r * 0.2, r * 0.5);
    ctx.fill();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, r * 0.1);
    ctx.lineTo(r * 0.3, r * 0.1);
    ctx.lineTo(0, r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}
