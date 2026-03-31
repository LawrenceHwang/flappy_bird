import { randomRange, randomPick } from '../utils/math';

/** Single particle state. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  alpha: number;
}

/** Optional overrides when emitting a burst. */
export interface EmitConfig {
  speedMin?: number;
  speedMax?: number;
  lifeMin?: number;
  lifeMax?: number;
  radiusMin?: number;
  radiusMax?: number;
  /** Radians – if set particles spread in a cone around this angle. */
  direction?: number;
}

/** Slight downward pull applied to every particle. */
const PARTICLE_GRAVITY = 0.12;
/** Hard upper bound on live particles to avoid GC pressure. */
const MAX_PARTICLES = 100;

/**
 * Pre-allocated particle pool with burst emission.
 *
 * Particles fade out and shrink over their lifetime, with a gentle
 * gravity pull. Dead particles are recycled in-place so no allocations
 * occur during gameplay.
 */
export class ParticleEmitter {
  private particles: Particle[] = [];
  private activeCount: number = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push(this.deadParticle());
    }
  }

  /**
   * Spawn a burst of particles at a position.
   * @param x - Centre X of the burst.
   * @param y - Centre Y of the burst.
   * @param count - Number of particles to emit.
   * @param colors - Pool of colours to pick from randomly.
   * @param config - Optional speed / life / radius overrides.
   */
  emit(
    x: number,
    y: number,
    count: number,
    colors: readonly string[],
    config?: EmitConfig,
  ): void {
    const speedMin = config?.speedMin ?? 1;
    const speedMax = config?.speedMax ?? 4;
    const lifeMin = config?.lifeMin ?? 0.3;
    const lifeMax = config?.lifeMax ?? 0.8;
    const radiusMin = config?.radiusMin ?? 2;
    const radiusMax = config?.radiusMax ?? 5;

    for (let i = 0; i < count; i++) {
      if (this.activeCount >= MAX_PARTICLES) break;

      const p = this.findDead();
      if (!p) break;

      const angle =
        config?.direction !== undefined
          ? config.direction + randomRange(-0.6, 0.6)
          : randomRange(0, Math.PI * 2);
      const speed = randomRange(speedMin, speedMax);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = randomRange(lifeMin, lifeMax);
      p.maxLife = p.life;
      p.radius = randomRange(radiusMin, radiusMax);
      p.color = randomPick(colors);
      p.alpha = 1;

      this.activeCount++;
    }
  }

  /**
   * Advance all live particles.
   * @param dt - Frame delta in seconds.
   */
  update(dt: number): void {
    const step = dt * 60;

    for (const p of this.particles) {
      if (p.life <= 0) continue;

      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += PARTICLE_GRAVITY * step;
      p.life -= dt;

      const progress = 1 - p.life / p.maxLife;
      p.alpha = 1 - progress;
      p.radius = Math.max(0, p.radius - 0.03 * step);

      if (p.life <= 0) {
        p.life = 0;
        this.activeCount--;
      }
    }
  }

  /** Render all live particles as filled circles. */
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (p.life <= 0 || p.radius <= 0) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  /** Immediately kill every particle. */
  clear(): void {
    for (const p of this.particles) {
      p.life = 0;
    }
    this.activeCount = 0;
  }

  // ---- internals -------------------------------------------------------

  private findDead(): Particle | null {
    for (const p of this.particles) {
      if (p.life <= 0) return p;
    }
    return null;
  }

  private deadParticle(): Particle {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      radius: 0,
      color: '#000',
      alpha: 0,
    };
  }
}
