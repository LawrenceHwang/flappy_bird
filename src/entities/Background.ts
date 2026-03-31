import { COLORS } from '../utils/colors';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT } from '../utils/constants';

// ---- Cloud shape definition -------------------------------------------

interface CloudShape {
  x: number;
  y: number;
  /** Radii for the clustered circles that form the cloud. */
  circles: Array<{ dx: number; dy: number; r: number }>;
  speed: number;
  width: number;
  glowStrength: number;
}

// ---- Hill shape definition --------------------------------------------

interface HillShape {
  x: number;
  height: number;
  width: number;
  colorIndex: number;
}

// ---- Sparkle definition -----------------------------------------------

interface Sparkle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  phase: number;
  speed: number;
  vx: number;
  vy: number;
}

// ---- Light mote definition -----------------------------------------------

interface Mote {
  x: number;
  y: number;
  size: number;
  opacity: number;
  vy: number;
  colorIndex: number;
}

/** Number of clouds that loop across the sky. */
const CLOUD_COUNT = 6;
/** Number of rolling hills in the midground. */
const HILL_COUNT = 7;

/** Grass line thickness in pixels. */
const GRASS_HEIGHT = 8;
/** Floating magic sparkles in the sky. */
const SPARKLE_COUNT = 14;
/** Tiny floating light particles. */
const MOTE_COUNT = 20;
/** Number of grass blades across the ground. */
const GRASS_BLADE_COUNT = 35;

/** Number of bezier control points per aurora ribbon. */
const AURORA_SEGMENTS = 40;
/** Minimum grass blade height in pixels. */
const BLADE_MIN_HEIGHT = 3;
/** Range of grass blade height variation in pixels. */
const BLADE_HEIGHT_RANGE = 6;
/** Vertical margin above the ground for sparkle wrapping. */
const SKY_BOTTOM_MARGIN = 20;

/**
 * Parallax scrolling background — magical kingdom style.
 *
 * Layers from back to front:
 * 1. Rich sky gradient
 * 2. Glowing aurora bands
 * 3. Soft luminous clouds with glow halos
 * 4. Floating magic sparkles
 * 5. Rounded enchanted hills
 * 6. Ground with cobblestone texture and bright grass
 */
export class Background {
  private clouds: CloudShape[] = [];
  private hills: HillShape[] = [];
  private sparkles: Sparkle[] = [];
  private motes: Mote[] = [];
  private cloudOffset: number = 0;
  private hillOffset: number = 0;
  private groundOffset: number = 0;
  private time: number = 0;

  constructor() {
    this.initClouds();
    this.initHills();
    this.initSparkles();
    this.initMotes();
  }

  /**
   * Scroll each layer at a different rate for parallax.
   * @param dt - Frame delta in seconds.
   * @param scrollSpeed - Base scroll speed (px / frame-at-60fps).
   */
  update(dt: number, scrollSpeed: number): void {
    const baseShift = scrollSpeed * dt * 60;
    this.cloudOffset += baseShift * 0.15;
    this.hillOffset += baseShift * 0.4;
    this.groundOffset += baseShift;
    this.time += dt;

    // Drift sparkles
    const skyMaxY = GAME_HEIGHT - GROUND_HEIGHT - SKY_BOTTOM_MARGIN;
    for (const sp of this.sparkles) {
      sp.x += sp.vx * dt * 60;
      sp.y += sp.vy * dt * 60;
      if (sp.x < 0) sp.x += GAME_WIDTH;
      if (sp.x > GAME_WIDTH) sp.x -= GAME_WIDTH;
      if (sp.y < 10) sp.y = skyMaxY;
      if (sp.y > skyMaxY) sp.y = 10;
    }

    // Drift motes upward
    for (const m of this.motes) {
      m.y += m.vy * dt * 60;
      if (m.y < -5) {
        m.y = GAME_HEIGHT - GROUND_HEIGHT;
        m.x = Math.random() * GAME_WIDTH;
      }
    }
  }

  /**
   * Paint the full background onto the canvas.
   * @param ctx - Canvas 2D rendering context.
   * @param skyTopColor - Gradient start colour for the sky.
   * @param skyBottomColor - Gradient end colour for the sky.
   */
  render(
    ctx: CanvasRenderingContext2D,
    skyTopColor: string,
    skyBottomColor: string,
  ): void {
    this.renderSky(ctx, skyTopColor, skyBottomColor);
    this.renderAurora(ctx);
    this.renderClouds(ctx);
    this.renderSparkles(ctx);
    this.renderMotes(ctx);
    this.renderHills(ctx);
    this.renderGround(ctx);
  }

  /** Reset all scroll offsets to zero. */
  reset(): void {
    this.cloudOffset = 0;
    this.hillOffset = 0;
    this.groundOffset = 0;
    this.time = 0;
  }

  // ---- Sky ------------------------------------------------------------

  private renderSky(
    ctx: CanvasRenderingContext2D,
    top: string,
    bottom: string,
  ): void {
    // 3-stop gradient for richer sky depth
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, bottom);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle pulsing radial shimmer — gives the sky a breathing quality
    const shimmerAlpha = 0.05 + Math.sin(this.time * 0.6) * 0.03;
    const cx = GAME_WIDTH * 0.4;
    const cy = GAME_HEIGHT * 0.3;
    const shimmer = ctx.createRadialGradient(cx, cy, 0, cx, cy, GAME_WIDTH * 0.55);
    shimmer.addColorStop(0, `rgba(255, 230, 200, ${shimmerAlpha})`);
    shimmer.addColorStop(0.6, `rgba(200, 180, 255, ${shimmerAlpha * 0.5})`);
    shimmer.addColorStop(1, 'rgba(200, 180, 255, 0)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  // ---- Aurora bands ---------------------------------------------------

  private renderAurora(ctx: CanvasRenderingContext2D): void {
    const t = this.time * 0.28;
    const ribbons: Array<{
      baseY: number;
      color: string;
      alpha: number;
      width: number;
      freqs: number[];
      amps: number[];
    }> = [
      {
        baseY: GAME_HEIGHT * 0.18,
        color: COLORS.magic.aurora1,
        alpha: 0.28,
        width: 18,
        freqs: [0.9, 1.6, 2.8],
        amps: [22, 10, 5],
      },
      {
        baseY: GAME_HEIGHT * 0.34,
        color: COLORS.magic.aurora2,
        alpha: 0.24,
        width: 14,
        freqs: [1.3, 2.1, 3.2],
        amps: [16, 8, 4],
      },
      {
        baseY: GAME_HEIGHT * 0.48,
        color: COLORS.magic.aurora3,
        alpha: 0.22,
        width: 12,
        freqs: [1.7, 2.6, 3.9],
        amps: [12, 7, 3],
      },
    ];

    const steps = AURORA_SEGMENTS;
    const segW = GAME_WIDTH / steps;

    for (const ribbon of ribbons) {
      // Compute y-offsets at each control point along the width
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        let yOff = 0;
        for (let f = 0; f < ribbon.freqs.length; f++) {
          yOff += Math.sin(t * ribbon.freqs[f] + frac * Math.PI * 2 * (f + 1) * 0.6) * ribbon.amps[f];
        }
        points.push({ x: i * segW, y: ribbon.baseY + yOff });
      }

      ctx.save();
      ctx.globalAlpha = ribbon.alpha;

      // Draw filled ribbon shape: top edge then bottom edge in reverse
      const grad = ctx.createLinearGradient(0, ribbon.baseY - 30, 0, ribbon.baseY + 30);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, ribbon.color);
      grad.addColorStop(0.7, ribbon.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;

      ctx.beginPath();
      // Top edge — smooth bezier through points offset upward
      ctx.moveTo(points[0].x, points[0].y - ribbon.width / 2);
      for (let i = 0; i < points.length - 1; i++) {
        const cpx = (points[i].x + points[i + 1].x) / 2;
        const cpy = (points[i].y + points[i + 1].y) / 2 - ribbon.width / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y - ribbon.width / 2, cpx, cpy);
      }
      // Bottom edge — reverse, offset downward
      for (let i = points.length - 1; i > 0; i--) {
        const cpx = (points[i].x + points[i - 1].x) / 2;
        const cpy = (points[i].y + points[i - 1].y) / 2 + ribbon.width / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y + ribbon.width / 2, cpx, cpy);
      }
      ctx.closePath();
      ctx.fill();

      // Bright center line for extra glow
      ctx.globalAlpha = ribbon.alpha * 0.6;
      ctx.strokeStyle = ribbon.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const cpx = (points[i].x + points[i + 1].x) / 2;
        const cpy = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, cpx, cpy);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  // ---- Clouds ---------------------------------------------------------

  private initClouds(): void {
    this.clouds = [];
    const spacing = (GAME_WIDTH + 200) / CLOUD_COUNT;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const baseR = 20 + Math.random() * 16;
      this.clouds.push({
        x: i * spacing + Math.random() * 60,
        y: 25 + Math.random() * 90,
        speed: 0.10 + Math.random() * 0.09,
        width: baseR * 4,
        glowStrength: 0.15 + Math.random() * 0.15,
        circles: [
          { dx: 0, dy: 0, r: baseR },
          { dx: -baseR * 0.85, dy: baseR * 0.18, r: baseR * 0.72 },
          { dx: baseR * 0.95, dy: baseR * 0.12, r: baseR * 0.78 },
          { dx: baseR * 0.3, dy: -baseR * 0.4, r: baseR * 0.58 },
          { dx: -baseR * 0.4, dy: -baseR * 0.28, r: baseR * 0.48 },
        ],
      });
    }
  }

  private renderClouds(ctx: CanvasRenderingContext2D): void {
    const totalWidth = GAME_WIDTH + 200;

    for (const cloud of this.clouds) {
      const drawX = ((cloud.x - this.cloudOffset * cloud.speed) % totalWidth + totalWidth) % totalWidth - 100;

      // Outer colour glow halo
      ctx.save();
      ctx.globalAlpha = cloud.glowStrength;
      ctx.fillStyle = COLORS.cloudGlow;
      for (const c of cloud.circles) {
        ctx.beginPath();
        ctx.arc(drawX + c.dx, cloud.y + c.dy, c.r * 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Drop shadow
      ctx.fillStyle = COLORS.cloudShadow;
      for (const c of cloud.circles) {
        ctx.beginPath();
        ctx.arc(drawX + c.dx, cloud.y + c.dy + 5, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // White body
      ctx.fillStyle = COLORS.cloud;
      for (const c of cloud.circles) {
        ctx.beginPath();
        ctx.arc(drawX + c.dx, cloud.y + c.dy, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Inner highlight
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const mainC = cloud.circles[0];
      ctx.beginPath();
      ctx.arc(drawX + mainC.dx - mainC.r * 0.22, cloud.y + mainC.dy - mainC.r * 0.3, mainC.r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- Magic sparkles ------------------------------------------------

  private initSparkles(): void {
    this.sparkles = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      this.sparkles.push({
        x: Math.random() * GAME_WIDTH,
        y: 20 + Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - 60),
        size: 2 + Math.random() * 3.5,
        opacity: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  private initMotes(): void {
    this.motes = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.motes.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * (GAME_HEIGHT - GROUND_HEIGHT),
        size: 1 + Math.random(),
        opacity: 0.15 + Math.random() * 0.35,
        vy: -(0.15 + Math.random() * 0.35),
        colorIndex: Math.floor(Math.random() * COLORS.particles.magic.length),
      });
    }
  }

  private renderSparkles(ctx: CanvasRenderingContext2D): void {
    const t = this.time;
    for (const sp of this.sparkles) {
      const alpha = (Math.sin(t * sp.speed + sp.phase) * 0.5 + 0.5) * sp.opacity;
      if (alpha < 0.05) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sp.x, sp.y);

      // 4-pointed star sparkle
      const s = sp.size;
      ctx.fillStyle = COLORS.magic.star;
      ctx.beginPath();
      for (let p = 0; p < 4; p++) {
        const angle = (p / 4) * Math.PI * 2 - Math.PI / 4;
        const outerX = Math.cos(angle) * s;
        const outerY = Math.sin(angle) * s;
        const innerX = Math.cos(angle + Math.PI / 4) * s * 0.35;
        const innerY = Math.sin(angle + Math.PI / 4) * s * 0.35;
        if (p === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fill();

      // Tiny glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2);
      glow.addColorStop(0, COLORS.magic.starGlow);
      glow.addColorStop(1, 'rgba(253,230,138,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, s * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ---- Light motes ----------------------------------------------------

  private renderMotes(ctx: CanvasRenderingContext2D): void {
    const t = this.time;
    for (const m of this.motes) {
      const pulse = (Math.sin(t * 1.5 + m.x * 0.02) * 0.5 + 0.5) * m.opacity;
      if (pulse < 0.03) continue;

      ctx.save();
      ctx.globalAlpha = pulse;

      // Tiny glow halo
      const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 3);
      glow.addColorStop(0, COLORS.particles.magic[m.colorIndex]);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = COLORS.particles.magic[m.colorIndex];
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ---- Hills ----------------------------------------------------------

  private readonly HILL_COLORS = [
    'rgba(74, 222, 128, 0.52)',
    'rgba(52, 211, 153, 0.45)',
    'rgba(134, 239, 172, 0.38)',
    'rgba(110, 231, 183, 0.42)',
    'rgba(167, 243, 208, 0.35)',
    'rgba(50, 200, 140, 0.48)',
    'rgba(90, 230, 160, 0.42)',
  ];

  private initHills(): void {
    this.hills = [];
    const spacing = (GAME_WIDTH + 300) / HILL_COUNT;

    for (let i = 0; i < HILL_COUNT; i++) {
      this.hills.push({
        x: i * spacing,
        height: 45 + Math.random() * 60,
        width: 150 + Math.random() * 110,
        colorIndex: i % this.HILL_COLORS.length,
      });
    }
  }

  private renderHills(ctx: CanvasRenderingContext2D): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;
    const totalWidth = GAME_WIDTH + 300;

    // Back hill pass (slightly darker, smaller)
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const hill of this.hills) {
      const hx = ((hill.x - this.hillOffset * 0.7 + 80) % totalWidth + totalWidth) % totalWidth - 150;
      const peakY = groundY - hill.height * 0.65;
      ctx.fillStyle = this.HILL_COLORS[(hill.colorIndex + 2) % this.HILL_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(hx, groundY);
      ctx.quadraticCurveTo(hx + hill.width * 0.6, peakY, hx + hill.width * 1.15, groundY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Front hills (brighter)
    for (const hill of this.hills) {
      const hx = ((hill.x - this.hillOffset) % totalWidth + totalWidth) % totalWidth - 150;
      const peakY = groundY - hill.height;

      ctx.fillStyle = this.HILL_COLORS[hill.colorIndex];
      ctx.beginPath();
      ctx.moveTo(hx, groundY);
      ctx.quadraticCurveTo(hx + hill.width / 2, peakY, hx + hill.width, groundY);
      ctx.closePath();
      ctx.fill();

      // Subtle highlight on top of hill
      ctx.save();
      ctx.globalAlpha = 0.3;
      const hiGrad = ctx.createRadialGradient(
        hx + hill.width / 2, peakY, 0,
        hx + hill.width / 2, peakY, hill.width * 0.35,
      );
      hiGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
      hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hiGrad;
      ctx.beginPath();
      ctx.arc(hx + hill.width / 2, peakY + 6, hill.width * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- Ground ---------------------------------------------------------

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;

    // Main earthy surface with 3-stop gradient
    const surfGrad = ctx.createLinearGradient(0, groundY, 0, GAME_HEIGHT);
    surfGrad.addColorStop(0, COLORS.ground.surface);
    surfGrad.addColorStop(0.4, COLORS.ground.surfaceMid);
    surfGrad.addColorStop(1, COLORS.ground.surfaceDark);
    ctx.fillStyle = surfGrad;
    ctx.fillRect(0, groundY, GAME_WIDTH, GROUND_HEIGHT);

    // Cobblestone texture (subtle ellipses)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = COLORS.ground.surfaceDark;
    const cobbleW = 28;
    const cobbleH = 12;
    const cobbleSpacing = cobbleW + 5;
    const rows = 2;
    for (let row = 0; row < rows; row++) {
      const ry = groundY + GRASS_HEIGHT + 6 + row * (cobbleH + 5);
      const offsetX = row % 2 === 0 ? 0 : cobbleW / 2;
      const count = Math.ceil(GAME_WIDTH / cobbleSpacing) + 2;
      for (let i = -1; i < count; i++) {
        const cx = ((i * cobbleSpacing + offsetX - (this.groundOffset % cobbleSpacing)) + cobbleSpacing * 10) % (GAME_WIDTH + cobbleSpacing) - cobbleSpacing;
        ctx.beginPath();
        ctx.ellipse(cx + cobbleW / 2, ry + cobbleH / 2, cobbleW / 2 - 1, cobbleH / 2 - 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Bright grass strip with light highlight on top
    const grassGrad = ctx.createLinearGradient(0, groundY, 0, groundY + GRASS_HEIGHT);
    grassGrad.addColorStop(0, COLORS.ground.grassLight);
    grassGrad.addColorStop(0.4, COLORS.ground.grass);
    grassGrad.addColorStop(1, COLORS.ground.grassDark);
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, groundY, GAME_WIDTH, GRASS_HEIGHT);

    // Grass top shimmer
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, groundY, GAME_WIDTH, 2);
    ctx.restore();

    // Animated grass blades swaying in the wind
    const bladeSpacing = GAME_WIDTH / GRASS_BLADE_COUNT;
    const bladeColors = [COLORS.ground.grass, COLORS.ground.grassLight, COLORS.ground.grassDark];
    for (let i = 0; i < GRASS_BLADE_COUNT; i++) {
      const bx = i * bladeSpacing + bladeSpacing * 0.5;
      // Deterministic height variation using modular arithmetic
      const bladeH = BLADE_MIN_HEIGHT + (i * 7 + 11) % BLADE_HEIGHT_RANGE;
      const sway = Math.sin(this.time * 2.0 + bx * 0.05) * 2.5;
      const colorIdx = i % bladeColors.length;

      ctx.save();
      ctx.fillStyle = bladeColors[colorIdx];
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(bx - 1.5, groundY);
      ctx.lineTo(bx + sway, groundY - bladeH);
      ctx.lineTo(bx + 1.5, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
