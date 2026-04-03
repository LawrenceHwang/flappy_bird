import { artAssets } from '../graphics/assets';
import { COLORS } from '../utils/colors';
import type { AABB, RewardType } from '../utils/types';

const REWARD_SIZE = 30;
const FLOAT_AMPLITUDE = 4;
const FLOAT_SPEED = 3;
const GLOW_SPEED = 4;

export class Reward {
  public x: number;
  public y: number;
  public readonly type: RewardType;
  public collected: boolean = false;
  public readonly width: number = REWARD_SIZE;
  public readonly height: number = REWARD_SIZE;

  private baseY: number;
  private time = 0;
  private rotationAngle = 0;

  constructor(x: number, y: number, type: RewardType) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.type = type;
  }

  update(dt: number, scrollSpeed: number): void {
    this.x -= scrollSpeed * dt * 60;
    this.time += dt;
    this.y = this.baseY + Math.sin(this.time * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    this.rotationAngle += dt * 0.7;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const glowAlpha = 0.22 + (Math.sin(this.time * GLOW_SPEED) * 0.5 + 0.5) * 0.22;
    const glowColorMap: Record<RewardType, string> = {
      multiplier: COLORS.reward.multiplierGlow,
      shield: COLORS.reward.shieldGlow,
      slowmo: COLORS.reward.slowmoGlow,
      shrink: COLORS.reward.shrinkGlow,
    };

    ctx.save();
    ctx.globalAlpha = glowAlpha;
    ctx.fillStyle = glowColorMap[this.type];
    ctx.beginPath();
    ctx.arc(cx, cy, this.width * 0.86, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, this.width * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotationAngle);
    ctx.drawImage(
      artAssets.getRewardIcon(this.type),
      -this.width * 0.62,
      -this.height * 0.62,
      this.width * 1.24,
      this.height * 1.24,
    );
    ctx.restore();
  }

  getHitbox(): AABB {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  isOffScreen(): boolean {
    return this.x + this.width < 0;
  }
}
