import { artAssets } from '../graphics/assets';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT } from '../utils/constants';

interface Wisp {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  alpha: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  vx: number;
}

interface Mote {
  x: number;
  y: number;
  size: number;
  vy: number;
  alpha: number;
  color: string;
}

const FAR_LAYER_WIDTH = 640;
const FAR_LAYER_HEIGHT = 220;
const MID_LAYER_WIDTH = 640;
const MID_LAYER_HEIGHT = 220;
const FRONT_LAYER_WIDTH = 512;
const FRONT_LAYER_HEIGHT = 140;
const GROUND_TILE_WIDTH = 256;
const GROUND_TILE_HEIGHT = 64;

export class Background {
  private wisps: Wisp[] = [];
  private sparkles: Sparkle[] = [];
  private motes: Mote[] = [];

  private farOffset = 0;
  private midOffset = 0;
  private frontOffset = 0;
  private groundOffset = 0;
  private time = 0;

  constructor() {
    this.initWisps();
    this.initSparkles();
    this.initMotes();
  }

  update(dt: number, scrollSpeed: number): void {
    const shift = scrollSpeed * dt * 60;
    this.farOffset += shift * 0.14;
    this.midOffset += shift * 0.28;
    this.frontOffset += shift * 0.5;
    this.groundOffset += shift;
    this.time += dt;

    for (const sparkle of this.sparkles) {
      sparkle.x += sparkle.vx * dt * 60;
      if (sparkle.x < -10) sparkle.x += GAME_WIDTH + 20;
      if (sparkle.x > GAME_WIDTH + 10) sparkle.x -= GAME_WIDTH + 20;
    }

    for (const mote of this.motes) {
      mote.y += mote.vy * dt * 60;
      if (mote.y < -8) {
        mote.y = GAME_HEIGHT - GROUND_HEIGHT - 8;
        mote.x = Math.random() * GAME_WIDTH;
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    skyTopColor: string,
    skyBottomColor: string,
  ): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT;

    this.renderSky(ctx, skyTopColor, skyBottomColor);
    this.renderLayer(
      ctx,
      artAssets.get('worldFar'),
      this.farOffset,
      groundY - 176,
      FAR_LAYER_WIDTH,
      FAR_LAYER_HEIGHT,
      0.88,
    );
    this.renderWisps(ctx);
    this.renderSparkles(ctx);
    this.renderLayer(
      ctx,
      artAssets.get('worldMid'),
      this.midOffset,
      groundY - 158,
      MID_LAYER_WIDTH,
      MID_LAYER_HEIGHT,
      0.9,
    );
    this.renderMotes(ctx);
    this.renderLayer(
      ctx,
      artAssets.get('worldFront'),
      this.frontOffset,
      groundY - 78,
      FRONT_LAYER_WIDTH,
      FRONT_LAYER_HEIGHT,
      0.96,
    );
    this.renderGround(ctx);
  }

  reset(): void {
    this.farOffset = 0;
    this.midOffset = 0;
    this.frontOffset = 0;
    this.groundOffset = 0;
    this.time = 0;
  }

  private renderSky(
    ctx: CanvasRenderingContext2D,
    top: string,
    bottom: string,
  ): void {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    sky.addColorStop(0, top);
    sky.addColorStop(0.55, bottom);
    sky.addColorStop(1, '#f4b384');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const warmGlow = ctx.createRadialGradient(210, 118, 0, 210, 118, 190);
    warmGlow.addColorStop(0, 'rgba(255, 214, 140, 0.18)');
    warmGlow.addColorStop(1, 'rgba(255, 214, 140, 0)');
    ctx.fillStyle = warmGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const coolGlow = ctx.createRadialGradient(592, 92, 0, 592, 92, 220);
    coolGlow.addColorStop(0, 'rgba(150, 190, 255, 0.14)');
    coolGlow.addColorStop(1, 'rgba(150, 190, 255, 0)');
    ctx.fillStyle = coolGlow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const vignette = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    vignette.addColorStop(0, 'rgba(10, 18, 42, 0.16)');
    vignette.addColorStop(0.32, 'rgba(10, 18, 42, 0)');
    vignette.addColorStop(1, 'rgba(73, 39, 48, 0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private renderLayer(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    offset: number,
    y: number,
    tileWidth: number,
    tileHeight: number,
    alpha: number,
  ): void {
    const normalized = ((offset % tileWidth) + tileWidth) % tileWidth;
    const startX = -normalized - tileWidth;

    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = startX; x < GAME_WIDTH + tileWidth; x += tileWidth) {
      ctx.drawImage(image, x, y, tileWidth, tileHeight);
    }
    ctx.restore();
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT - 4;
    const image = artAssets.get('worldGround');
    const normalized = ((this.groundOffset % GROUND_TILE_WIDTH) + GROUND_TILE_WIDTH) % GROUND_TILE_WIDTH;
    const startX = -normalized - GROUND_TILE_WIDTH;

    for (let x = startX; x < GAME_WIDTH + GROUND_TILE_WIDTH; x += GROUND_TILE_WIDTH) {
      ctx.drawImage(image, x, groundY, GROUND_TILE_WIDTH, GROUND_TILE_HEIGHT);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, groundY + 2, GAME_WIDTH, 2);
  }

  private renderWisps(ctx: CanvasRenderingContext2D): void {
    for (const wisp of this.wisps) {
      const x = ((wisp.x - this.farOffset * wisp.speed) % (GAME_WIDTH + 240) + GAME_WIDTH + 240) % (GAME_WIDTH + 240) - 120;
      ctx.save();
      ctx.globalAlpha = wisp.alpha;
      const glow = ctx.createRadialGradient(
        x,
        wisp.y,
        0,
        x,
        wisp.y,
        Math.max(wisp.width, wisp.height),
      );
      glow.addColorStop(0, 'rgba(255,255,255,0.55)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(x, wisp.y, wisp.width, wisp.height, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderSparkles(ctx: CanvasRenderingContext2D): void {
    for (const sparkle of this.sparkles) {
      const alpha = 0.18 + (Math.sin(this.time * sparkle.speed + sparkle.phase) * 0.5 + 0.5) * 0.48;
      ctx.save();
      ctx.translate(sparkle.x, sparkle.y);
      ctx.rotate(this.time * sparkle.speed * 0.2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff1be';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const inner = angle + Math.PI / 4;
        const outerR = sparkle.size;
        const innerR = sparkle.size * 0.35;
        if (i === 0) {
          ctx.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        } else {
          ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        }
        ctx.lineTo(Math.cos(inner) * innerR, Math.sin(inner) * innerR);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderMotes(ctx: CanvasRenderingContext2D): void {
    for (const mote of this.motes) {
      const pulse = 0.22 + (Math.sin(this.time * 1.4 + mote.x * 0.015) * 0.5 + 0.5) * mote.alpha;
      ctx.save();
      ctx.globalAlpha = pulse;
      const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, mote.size * 4);
      glow.addColorStop(0, mote.color);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private initWisps(): void {
    this.wisps = Array.from({ length: 6 }, (_, index) => ({
      x: index * 150 + Math.random() * 40,
      y: 42 + Math.random() * 86,
      width: 36 + Math.random() * 18,
      height: 16 + Math.random() * 8,
      speed: 0.18 + Math.random() * 0.12,
      alpha: 0.08 + Math.random() * 0.07,
    }));
  }

  private initSparkles(): void {
    this.sparkles = Array.from({ length: 16 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: 18 + Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - 120),
      size: 2 + Math.random() * 3.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.2,
      vx: (Math.random() - 0.5) * 0.3,
    }));
  }

  private initMotes(): void {
    const colors = ['rgba(123, 220, 194, 0.52)', 'rgba(255, 228, 158, 0.46)', 'rgba(191, 200, 255, 0.42)'];
    this.motes = Array.from({ length: 20 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * (GAME_HEIGHT - GROUND_HEIGHT),
      size: 1 + Math.random() * 1.4,
      vy: -(0.1 + Math.random() * 0.28),
      alpha: 0.12 + Math.random() * 0.22,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }
}
