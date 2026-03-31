import { COLORS } from '../utils/colors';
import {
  BIRD_X,
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_HITBOX_INSET,
  FLAP_VELOCITY,
  GRAVITY,
  TERMINAL_VELOCITY,
  GAME_HEIGHT,
  GROUND_HEIGHT,
  WING_FLAP_SPEED,
  MAX_BIRD_UP_ROTATION,
  MAX_BIRD_DOWN_ROTATION,
  BIRD_ROTATION_SPEED,
} from '../utils/constants';
import { clamp } from '../utils/math';
import type { AABB } from '../utils/types';

/**
 * The player-controlled bird entity.
 *
 * Renders as a cute geometric bird with gradient body, animated wing,
 * eye with highlight, beak, and cheek blush. Physics use simple
 * gravity + impulse model with clamped terminal velocity.
 */
export class Bird {
  public x: number = BIRD_X;
  public y: number = (GAME_HEIGHT - GROUND_HEIGHT) / 2;
  public velocity: number = 0;
  public rotation: number = 0;
  public readonly width: number = BIRD_WIDTH;
  public readonly height: number = BIRD_HEIGHT;
  public isAlive: boolean = true;
  public wingAngle: number = 0;

  private wingTime: number = 0;

  /**
   * Step physics, wing animation, and rotation.
   * @param dt - Frame delta in seconds.
   * @param gravityMultiplier - Difficulty-driven gravity scale (1.0 = normal).
   */
  update(dt: number, gravityMultiplier: number): void {
    if (!this.isAlive) return;

    // Gravity & position
    this.velocity += GRAVITY * gravityMultiplier * dt * 60;
    this.velocity = clamp(this.velocity, FLAP_VELOCITY, TERMINAL_VELOCITY);
    this.y += this.velocity * dt * 60;

    // Wing animation (continuous sine wave)
    this.wingTime += dt * 60;
    this.wingAngle = Math.sin(this.wingTime * WING_FLAP_SPEED) * 0.6;

    // Rotation smoothly follows velocity direction
    const targetRotation =
      this.velocity < 0
        ? MAX_BIRD_UP_ROTATION * clamp(-this.velocity / -FLAP_VELOCITY, 0, 1)
        : MAX_BIRD_DOWN_ROTATION * clamp(this.velocity / TERMINAL_VELOCITY, 0, 1);

    this.rotation += (targetRotation - this.rotation) * BIRD_ROTATION_SPEED * dt * 60;
    this.rotation = clamp(this.rotation, MAX_BIRD_UP_ROTATION, MAX_BIRD_DOWN_ROTATION);

    // The ceiling is safe: clamp the bird to the top edge instead of failing.
    if (this.y < 0) {
      this.y = 0;
      this.velocity = Math.max(0, this.velocity);
      this.rotation = Math.max(this.rotation, -0.15);
    }
  }

  /** Apply an upward impulse and snap the wing to the "up" pose. */
  flap(): void {
    if (!this.isAlive) return;
    this.velocity = FLAP_VELOCITY;
    this.wingTime = 0;
    this.wingAngle = -0.6;
  }

  /**
   * Draw the bird programmatically on the canvas.
   * Chubby magical-kingdom style: round body, soft gradient, sparkle eye,
   * animated wing with gold sheen, tiny crown on top, elegant beak.
   * @param ctx - Canvas 2D rendering context.
   * @param scaleFactor - Visual scale (< 1 when shrink power-up active).
   */
  render(ctx: CanvasRenderingContext2D, scaleFactor: number = 1.0): void {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.scale(scaleFactor, scaleFactor);

    // Chubby body is slightly wider and more spherical
    const hw = this.width / 2 + 2;
    const hh = this.height / 2 + 3;

    // --- Soft drop shadow ---
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#400';
    ctx.beginPath();
    ctx.ellipse(2, hh * 0.7, hw * 0.8, hh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Wing (drawn behind body) ---
    ctx.save();
    ctx.translate(-hw * 0.1, hh * 0.05);
    ctx.rotate(this.wingAngle - 0.15);
    const wingGrad = ctx.createRadialGradient(0, 0, 1, 0, hh * 0.2, hw * 0.6);
    wingGrad.addColorStop(0, COLORS.bird.wingLight);
    wingGrad.addColorStop(0.5, COLORS.bird.wing);
    wingGrad.addColorStop(1, COLORS.bird.wingDark);
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.ellipse(-2, hh * 0.15, hw * 0.52, hh * 0.62, -0.25, 0, Math.PI * 2);
    ctx.fill();
    // Wing highlight edge
    ctx.strokeStyle = COLORS.bird.wingLight;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(-2, hh * 0.15, hw * 0.52, hh * 0.62, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // --- Main body (chubby radial gradient for roundness/depth) ---
    const bodyGrad = ctx.createRadialGradient(-hw * 0.2, -hh * 0.25, hw * 0.08, 0, 0, hw * 1.1);
    bodyGrad.addColorStop(0, COLORS.bird.body);
    bodyGrad.addColorStop(0.45, COLORS.bird.bodyMid);
    bodyGrad.addColorStop(1, COLORS.bird.bodyDark);

    // Outer glow makes the bird pop against any sky
    ctx.save();
    ctx.shadowColor = 'rgba(255, 160, 30, 0.55)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dark outline for crisp visibility on all backgrounds
    ctx.save();
    ctx.strokeStyle = 'rgba(110, 45, 0, 0.45)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // --- Belly highlight (soft inner glow) ---
    const bellyGrad = ctx.createRadialGradient(hw * 0.1, hh * 0.3, 0, hw * 0.05, hh * 0.35, hw * 0.62);
    bellyGrad.addColorStop(0, COLORS.bird.bellyInner);
    bellyGrad.addColorStop(0.6, COLORS.bird.belly);
    bellyGrad.addColorStop(1, 'rgba(255,240,192,0)');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(hw * 0.08, hh * 0.3, hw * 0.58, hh * 0.5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // --- Top-of-head specular shine ---
    ctx.save();
    ctx.globalAlpha = 0.28;
    const shineGrad = ctx.createRadialGradient(-hw * 0.22, -hh * 0.6, 0, -hw * 0.22, -hh * 0.55, hw * 0.45);
    shineGrad.addColorStop(0, '#FFFFFF');
    shineGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.ellipse(-hw * 0.18, -hh * 0.52, hw * 0.42, hh * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Tiny crown on top of head ---
    this.renderCrown(ctx, hw, hh);

    // --- Beak (elegant rounded triangle) ---
    const beakGrad = ctx.createLinearGradient(hw * 0.55, -hh * 0.12, hw + 9, hh * 0.18);
    beakGrad.addColorStop(0, COLORS.bird.beak);
    beakGrad.addColorStop(1, COLORS.bird.beakDark);
    ctx.fillStyle = beakGrad;
    ctx.beginPath();
    ctx.moveTo(hw * 0.65, -hh * 0.1);
    ctx.quadraticCurveTo(hw + 10, hh * 0.04, hw + 9, hh * 0.16);
    ctx.quadraticCurveTo(hw + 4, hh * 0.28, hw * 0.65, hh * 0.22);
    ctx.closePath();
    ctx.fill();

    // --- Eye ring (gives depth) ---
    const eyeX = hw * 0.32;
    const eyeY = -hh * 0.22;
    ctx.fillStyle = COLORS.bird.eyeRing;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // --- Eye (dark iris) ---
    ctx.fillStyle = COLORS.bird.eye;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Eye highlight sparkle ---
    ctx.fillStyle = COLORS.bird.eyeHighlight;
    ctx.beginPath();
    ctx.arc(eyeX + 2, eyeY - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Tiny secondary sparkle dot
    ctx.fillStyle = COLORS.bird.eyeShine;
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, eyeY + 1.8, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // --- Cheek blush (soft pink glow) ---
    const cheekGrad = ctx.createRadialGradient(hw * 0.42, hh * 0.2, 0, hw * 0.42, hh * 0.2, 6);
    cheekGrad.addColorStop(0, 'rgba(255,150,150,0.65)');
    cheekGrad.addColorStop(1, 'rgba(255,150,150,0)');
    ctx.fillStyle = cheekGrad;
    ctx.beginPath();
    ctx.ellipse(hw * 0.42, hh * 0.2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Draw a tiny golden crown on top of the bird's head. */
  private renderCrown(ctx: CanvasRenderingContext2D, hw: number, hh: number): void {
    ctx.save();
    ctx.translate(-hw * 0.1, -hh * 0.92);

    // Crown base
    const cw = hw * 0.72;
    const ch = hh * 0.26;
    const crownGrad = ctx.createLinearGradient(-cw / 2, -ch, cw / 2, 0);
    crownGrad.addColorStop(0, COLORS.bird.crown);
    crownGrad.addColorStop(0.5, '#FFEC6E');
    crownGrad.addColorStop(1, '#CC9900');
    ctx.fillStyle = crownGrad;

    // 3-point crown silhouette
    ctx.beginPath();
    ctx.moveTo(-cw / 2, 0);
    ctx.lineTo(-cw / 2, -ch * 0.5);
    ctx.lineTo(-cw * 0.28, -ch);       // left spike
    ctx.lineTo(-cw * 0.08, -ch * 0.52);
    ctx.lineTo(0, -ch);                 // center spike (tallest)
    ctx.lineTo(cw * 0.08, -ch * 0.52);
    ctx.lineTo(cw * 0.28, -ch);         // right spike
    ctx.lineTo(cw / 2, -ch * 0.5);
    ctx.lineTo(cw / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Crown outline
    ctx.strokeStyle = 'rgba(150, 90, 0, 0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Crown gem centered on the tallest (center) spike
    ctx.fillStyle = COLORS.bird.crownGem;
    ctx.beginPath();
    ctx.arc(0, -ch * 0.85, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(0.6, -ch * 0.92, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Collision AABB, slightly inset from the visual bounds for forgiving hits.
   */
  getHitbox(): AABB {
    return {
      x: this.x + BIRD_HITBOX_INSET,
      y: this.y + BIRD_HITBOX_INSET,
      width: this.width - BIRD_HITBOX_INSET * 2,
      height: this.height - BIRD_HITBOX_INSET * 2,
    };
  }

  /** Reset to initial state for a new game. */
  reset(): void {
    this.x = BIRD_X;
    this.y = (GAME_HEIGHT - GROUND_HEIGHT) / 2;
    this.velocity = 0;
    this.rotation = 0;
    this.isAlive = true;
    this.wingAngle = 0;
    this.wingTime = 0;
  }

  /** Mark the bird as dead. */
  die(): void {
    this.isAlive = false;
  }
}
