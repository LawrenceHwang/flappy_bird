import { artAssets } from '../graphics/assets';
import {
  BIRD_HEIGHT,
  BIRD_HITBOX_INSET,
  BIRD_ROTATION_SPEED,
  BIRD_WIDTH,
  BIRD_X,
  FLAP_VELOCITY,
  GAME_HEIGHT,
  GRAVITY,
  GROUND_HEIGHT,
  MAX_BIRD_DOWN_ROTATION,
  MAX_BIRD_UP_ROTATION,
  TERMINAL_VELOCITY,
  WING_FLAP_SPEED,
} from '../utils/constants';
import { clamp } from '../utils/math';
import type { AABB, BirdSkin } from '../utils/types';

export class Bird {
  public x: number = BIRD_X;
  public y: number = (GAME_HEIGHT - GROUND_HEIGHT) / 2;
  public velocity: number = 0;
  public rotation: number = 0;
  public readonly width: number = BIRD_WIDTH;
  public readonly height: number = BIRD_HEIGHT;
  public isAlive: boolean = true;
  public wingAngle: number = 0;
  public skin: BirdSkin;

  private wingTime = 0;

  constructor(skin: BirdSkin = 'default') {
    this.skin = skin;
  }

  update(dt: number, gravityMultiplier: number): void {
    if (!this.isAlive) return;

    this.velocity += GRAVITY * gravityMultiplier * dt * 60;
    this.velocity = clamp(this.velocity, FLAP_VELOCITY, TERMINAL_VELOCITY);
    this.y += this.velocity * dt * 60;

    this.wingTime += dt * 60;
    this.wingAngle = Math.sin(this.wingTime * WING_FLAP_SPEED) * 0.6;

    const targetRotation =
      this.velocity < 0
        ? MAX_BIRD_UP_ROTATION * clamp(-this.velocity / -FLAP_VELOCITY, 0, 1)
        : MAX_BIRD_DOWN_ROTATION * clamp(this.velocity / TERMINAL_VELOCITY, 0, 1);

    this.rotation += (targetRotation - this.rotation) * BIRD_ROTATION_SPEED * dt * 60;
    this.rotation = clamp(this.rotation, MAX_BIRD_UP_ROTATION, MAX_BIRD_DOWN_ROTATION);

    if (this.y < 0) {
      this.y = 0;
      this.velocity = Math.max(0, this.velocity);
      this.rotation = Math.max(this.rotation, -0.15);
    }
  }

  flap(): void {
    if (!this.isAlive) return;
    this.velocity = FLAP_VELOCITY;
    this.wingTime = 0;
    this.wingAngle = -0.6;
  }

  render(ctx: CanvasRenderingContext2D, scaleFactor: number = 1.0): void {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const asset = artAssets.getBirdFrame(this.skin, this.wingAngle);
    const drawWidth = this.width * 1.54;
    const drawHeight = this.height * 1.54;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.scale(scaleFactor, scaleFactor);

    ctx.fillStyle = 'rgba(20, 13, 14, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, this.height * 0.78, this.width * 0.42, this.height * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor =
      this.skin === 'bee'
        ? 'rgba(255, 204, 102, 0.34)'
        : 'rgba(255, 154, 72, 0.36)';
    ctx.shadowBlur = 16;
    ctx.drawImage(asset, -drawWidth / 2, -drawHeight / 2 - 2, drawWidth, drawHeight);
    ctx.restore();

    const shine = ctx.createRadialGradient(-4, -10, 0, -4, -10, this.width * 0.75);
    shine.addColorStop(0, 'rgba(255,255,255,0.16)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(-2, -8, this.width * 0.5, this.height * 0.35, -0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  getHitbox(scaleFactor: number = 1.0): AABB {
    const clampedScale = Math.max(0.45, scaleFactor);
    const scaledWidth = this.width * clampedScale;
    const scaledHeight = this.height * clampedScale;
    const offsetX = (this.width - scaledWidth) / 2;
    const offsetY = (this.height - scaledHeight) / 2;
    const inset = BIRD_HITBOX_INSET * clampedScale;

    return {
      x: this.x + offsetX + inset,
      y: this.y + offsetY + inset,
      width: scaledWidth - inset * 2,
      height: scaledHeight - inset * 2,
    };
  }

  reset(): void {
    this.x = BIRD_X;
    this.y = (GAME_HEIGHT - GROUND_HEIGHT) / 2;
    this.velocity = 0;
    this.rotation = 0;
    this.isAlive = true;
    this.wingAngle = 0;
    this.wingTime = 0;
  }

  die(): void {
    this.isAlive = false;
  }
}
