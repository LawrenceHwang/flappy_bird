import { artAssets } from '../graphics/assets';
import {
  GAME_HEIGHT,
  GROUND_HEIGHT,
  PIPE_CAP_HEIGHT,
  PIPE_CAP_OVERHANG,
  PIPE_WIDTH,
} from '../utils/constants';
import type { AABB } from '../utils/types';

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

  update(dt: number, scrollSpeed: number, time: number): void {
    this.x -= scrollSpeed * dt * 60;

    if (this.moving) {
      this.gapY =
        this.baseGapY +
        Math.sin(time * this.oscillationSpeed + this.oscillationOffset) *
          this.oscillationRange;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const topHeight = this.gapY - this.gapSize / 2;
    const bottomY = this.gapY + this.gapSize / 2;
    const bottomHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomY;

    this.renderSection(ctx, this.x, 0, this.width, topHeight, 'top');
    this.renderSection(ctx, this.x, bottomY, this.width, bottomHeight, 'bottom');
  }

  getTopHitbox(): AABB {
    const topHeight = this.gapY - this.gapSize / 2;
    return { x: this.x, y: 0, width: this.width, height: topHeight };
  }

  getBottomHitbox(): AABB {
    const bottomY = this.gapY + this.gapSize / 2;
    return {
      x: this.x,
      y: bottomY,
      width: this.width,
      height: GAME_HEIGHT - GROUND_HEIGHT - bottomY,
    };
  }

  isOffScreen(): boolean {
    return this.x + this.width < 0;
  }

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
    (this as { gapSize: number }).gapSize = gapSize;
  }

  private renderSection(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    position: 'top' | 'bottom',
  ): void {
    if (h <= 0) return;

    const body = artAssets.get('pipeBody');
    const cap = artAssets.get('pipeCap');
    const capHeight = PIPE_CAP_HEIGHT + 14;
    const capX = x - PIPE_CAP_OVERHANG - 8;
    const capW = w + (PIPE_CAP_OVERHANG + 8) * 2;
    const capY = position === 'top' ? y + h - capHeight : y;
    const bodyY = position === 'top' ? y : y + capHeight - 6;
    const bodyHeight = Math.max(0, h - capHeight + 6);

    ctx.save();
    ctx.shadowColor = 'rgba(11, 18, 28, 0.36)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    if (bodyHeight > 0) {
      ctx.drawImage(body, x - 4, bodyY, w + 8, bodyHeight);
    }
    ctx.shadowBlur = 8;
    ctx.drawImage(cap, capX, capY, capW, capHeight);
    ctx.restore();

    const glowY = position === 'top' ? y + h : y;
    const glowHeight = position === 'top' ? 14 : -14;
    const glow = ctx.createLinearGradient(0, glowY, 0, glowY + glowHeight);
    glow.addColorStop(0, 'rgba(163, 236, 255, 0.16)');
    glow.addColorStop(1, 'rgba(163, 236, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(capX, glowY, capW, glowHeight);
  }
}
