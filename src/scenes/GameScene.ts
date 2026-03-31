import type {
  Scene,
  InputAction,
  GameMode,
  DifficultyParams,
  LevelConfig,
  ActiveReward,
  RewardType,
} from '../utils/types';
import { COLORS } from '../utils/colors';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  BIRD_X,
  GROUND_HEIGHT,
  GRAVITY,
  MULTIPLIER_DURATION,
  SHIELD_DURATION,
  SLOWMO_DURATION,
  SHRINK_DURATION,
  SLOWMO_FACTOR,
  SHRINK_FACTOR,
  SCORE_MULTIPLIER_2X,
  SCORE_MULTIPLIER_3X,
  FLAP_PARTICLE_COUNT,
  DEATH_PARTICLE_COUNT,
  REWARD_PARTICLE_COUNT,
} from '../utils/constants';
import { Bird } from '../entities/Bird';
import { PipeManager } from '../entities/PipeManager';
import { Background } from '../entities/Background';
import { ParticleEmitter } from '../entities/Particles';
import { RewardManager } from '../entities/RewardManager';
import { AudioManager } from '../audio/AudioManager';
import { aabbOverlap } from '../utils/math';
import { renderPauseOverlay, getPauseButtons } from './PauseScene';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type GameState = 'ready' | 'playing' | 'dying' | 'dead';

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
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

function rewardDuration(type: RewardType): number {
  switch (type) {
    case 'multiplier': return MULTIPLIER_DURATION;
    case 'shield': return SHIELD_DURATION;
    case 'slowmo': return SLOWMO_DURATION;
    case 'shrink': return SHRINK_DURATION;
  }
}

const REWARD_ICONS: Record<RewardType, string> = {
  multiplier: '×2',
  shield: '🛡️',
  slowmo: '⏳',
  shrink: '🔽',
};

const REWARD_COLORS: Record<RewardType, string> = {
  multiplier: COLORS.reward.multiplier,
  shield: COLORS.reward.shield,
  slowmo: COLORS.reward.slowmo,
  shrink: COLORS.reward.shrink,
};

/* ------------------------------------------------------------------ */
/*  GameScene                                                          */
/* ------------------------------------------------------------------ */

/**
 * Core gameplay scene — manages the bird, pipes, rewards, particles,
 * collision detection, scoring, and the HUD overlay.
 *
 * Works in both Story and Infinite modes, configured via constructor
 * parameters.
 */
export class GameScene implements Scene {
  private readonly mode: GameMode;
  private readonly difficulty: DifficultyParams;
  private readonly onGameOver: (score: number) => void;
  private readonly onLevelComplete?: (level: number, score: number) => void;
  private readonly levelConfig?: LevelConfig;

  // Entities
  private bird!: Bird;
  private pipeManager!: PipeManager;
  private background!: Background;
  private particles!: ParticleEmitter;
  private rewardManager: RewardManager | null = null;

  // State
  private state: GameState = 'ready';
  private paused = false;
  private score = 0;
  private timer = 0;
  private deathTimer = 0;
  private gameTime = 0;

  // Rewards
  private activeRewards: ActiveReward[] = [];
  private scoreMultiplier = 1;
  private scaleFactor = 1;

  // Sky colours (may differ per level)
  private skyTop: string;
  private skyBottom: string;

  // Pause menu navigation
  private pauseSelectedIndex = 0;

  // Mouse tracking
  private mouseX = -1;
  private mouseY = -1;
  private canvas: HTMLCanvasElement | null = null;

  // Bound listeners
  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onMouseClick: ((e: MouseEvent) => void) | null = null;
  private onTouchStart: ((e: TouchEvent) => void) | null = null;

  constructor(
    mode: GameMode,
    difficulty: DifficultyParams,
    onGameOver: (score: number) => void,
    onLevelComplete?: (level: number, score: number) => void,
    levelConfig?: LevelConfig,
  ) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.onGameOver = onGameOver;
    this.onLevelComplete = onLevelComplete;
    this.levelConfig = levelConfig;

    this.skyTop = levelConfig?.skyTopColor ?? COLORS.sky.topDefault;
    this.skyBottom = levelConfig?.skyBottomColor ?? COLORS.sky.bottomDefault;
  }

  /* ================================================================ */
  /*  Lifecycle                                                        */
  /* ================================================================ */

  /** Initialise entities and register input listeners. */
  enter(): void {
    this.bird = new Bird();
    this.bird.x = BIRD_X;
    this.bird.y = GAME_HEIGHT / 2;
    this.pipeManager = new PipeManager();
    this.pipeManager.setPipeSpacing(this.difficulty.pipeSpacing);
    this.background = new Background();
    this.particles = new ParticleEmitter();

    if (this.mode === 'infinite') {
      this.rewardManager = new RewardManager();
    }

    this.state = 'ready';
    this.paused = false;
    this.score = 0;
    this.timer = this.levelConfig?.duration ?? 0;
    this.activeRewards = [];
    this.scoreMultiplier = 1;
    this.scaleFactor = 1;
    this.deathTimer = 0;
    this.gameTime = 0;
    this.pauseSelectedIndex = 0;

    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    this.registerListeners();
  }

  /** Clean up input listeners. */
  exit(): void {
    this.unregisterListeners();
  }

  /* ================================================================ */
  /*  Input                                                            */
  /* ================================================================ */

  /** Handle abstract game input actions. */
  handleInput(action: InputAction): void {
    // Pause menu input
    if (this.paused) {
      this.handlePauseInput(action);
      return;
    }

    switch (action) {
      case 'flap':
        this.handleFlap();
        break;
      case 'pause':
        if (this.state === 'playing') {
          this.paused = true;
          this.pauseSelectedIndex = 0;
        }
        break;
      case 'confirm':
        if (this.state === 'dead') {
          this.onGameOver(this.score);
        }
        break;
    }
  }

  /* ================================================================ */
  /*  Update                                                           */
  /* ================================================================ */

  /** Advance one simulation frame. */
  update(dt: number): void {
    if (this.paused || this.state === 'ready') return;

    // Dying animation
    if (this.state === 'dying') {
      this.deathTimer += dt;
      this.bird.update(dt, GRAVITY * this.difficulty.gravityMultiplier);
      this.particles.update(dt);
      if (this.deathTimer > 1.5) {
        this.state = 'dead';
      }
      return;
    }

    if (this.state === 'dead') return;

    this.gameTime += dt;

    // Active speed multiplier (slow-mo)
    const speedMult = this.hasReward('slowmo') ? SLOWMO_FACTOR : 1;
    const effectiveSpeed = this.difficulty.scrollSpeed * speedMult;

    // Bird scale (shrink)
    this.scaleFactor = this.hasReward('shrink') ? SHRINK_FACTOR : 1;

    // Update entities
    this.bird.update(dt, GRAVITY * this.difficulty.gravityMultiplier);

    // Track pipe count to detect new spawns for reward placement
    const pipeCountBefore = this.pipeManager.getActivePipes().length;

    this.pipeManager.update(
      dt,
      effectiveSpeed,
      this.gameTime,
      this.difficulty.pipeGap,
      this.difficulty.movingPipes,
      this.difficulty.pipeOscillationSpeed,
      this.difficulty.pipeOscillationRange,
    );

    // Spawn reward when a new pipe appears
    const pipes = this.pipeManager.getActivePipes();
    if (this.rewardManager && pipes.length > pipeCountBefore) {
      const newest = pipes[pipes.length - 1];
      this.rewardManager.trySpawn(newest.x, newest.gapY, newest.gapSize);
    }

    this.background.update(dt, effectiveSpeed);
    this.particles.update(dt);

    // Collision detection (manual — iterate pipe hitboxes)
    const birdBox = this.bird.getHitbox();
    for (const pipe of pipes) {
      const top = pipe.getTopHitbox();
      const bot = pipe.getBottomHitbox();
      const hitTop = aabbOverlap(
        birdBox.x, birdBox.y, birdBox.width, birdBox.height,
        top.x, top.y, top.width, top.height,
      );
      const hitBot = aabbOverlap(
        birdBox.x, birdBox.y, birdBox.width, birdBox.height,
        bot.x, bot.y, bot.width, bot.height,
      );
      if (hitTop || hitBot) {
        if (this.hasReward('shield')) {
          this.removeReward('shield');
          this.particles.emit(
            this.bird.x,
            this.bird.y,
            REWARD_PARTICLE_COUNT,
            COLORS.particles.reward,
          );
          AudioManager.getInstance().playReward();
        } else {
          this.die();
          return;
        }
        break;
      }
    }

    // Score from passed pipes
    let passedCount = 0;
    for (const pipe of pipes) {
      if (!pipe.passed && pipe.x + pipe.width < BIRD_X) {
        pipe.passed = true;
        passedCount++;
      }
    }
    if (passedCount > 0) {
      this.score += passedCount * this.scoreMultiplier;
      AudioManager.getInstance().playScore();
    }

    // Bottom edge still fails, but the top edge is intentionally safe.
    if (this.bird.y + this.bird.height >= GAME_HEIGHT - GROUND_HEIGHT) {
      this.die();
      return;
    }

    // Story-mode timer
    if (this.mode === 'story' && this.levelConfig) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.onLevelComplete?.(this.levelConfig.level, this.score);
        return;
      }
    }

    // Reward collection (infinite mode)
    if (this.rewardManager) {
      this.rewardManager.update(dt, effectiveSpeed);
      const collected = this.rewardManager.checkCollision(birdBox);
      if (collected) {
        this.activateReward(collected);
        AudioManager.getInstance().playReward();
        this.particles.emit(
          this.bird.x,
          this.bird.y,
          REWARD_PARTICLE_COUNT,
          COLORS.particles.reward,
        );
      }
    }

    // Decay active reward timers
    this.tickRewardTimers(dt);
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  /** Draw the entire game frame. */
  render(ctx: CanvasRenderingContext2D): void {
    // Background sky
    this.background.render(ctx, this.skyTop, this.skyBottom);

    // Pipes
    this.pipeManager.render(ctx);

    // Rewards
    this.rewardManager?.render(ctx);

    // Bird (with shield glow if active)
    if (this.hasReward('shield')) {
      this.renderShieldGlow(ctx);
    }
    this.bird.render(ctx, this.scaleFactor);

    // Particles
    this.particles.render(ctx);

    // Ground
    this.renderGround(ctx);

    // HUD
    this.renderHUD(ctx);

    // Overlay states
    if (this.state === 'ready') {
      this.renderReadyOverlay(ctx);
    } else if (this.state === 'dead') {
      this.renderDeadOverlay(ctx);
    }

    // Pause overlay (drawn last so it sits on top)
    if (this.paused) {
      renderPauseOverlay(ctx, this.pauseSelectedIndex, {
        x: this.mouseX,
        y: this.mouseY,
      });
    }
  }

  /* ================================================================ */
  /*  Private — input                                                  */
  /* ================================================================ */

  private handleFlap(): void {
    switch (this.state) {
      case 'ready':
        this.state = 'playing';
        this.bird.flap();
        AudioManager.getInstance().playFlap();
        break;
      case 'playing':
        this.bird.flap();
        this.particles.emit(
          this.bird.x,
          this.bird.y,
          FLAP_PARTICLE_COUNT,
          COLORS.particles.flap,
        );
        AudioManager.getInstance().playFlap();
        break;
      case 'dead':
        this.onGameOver(this.score);
        break;
    }
  }

  private handlePauseInput(action: InputAction): void {
    if (action === 'pause' || action === 'flap') {
      // Resume when pressing pause or flap while paused
      if (this.pauseSelectedIndex === 0) {
        this.resume();
      } else if (this.pauseSelectedIndex === 1) {
        this.onGameOver(this.score);
      }
    }
  }

  private resume(): void {
    this.paused = false;
  }

  /* ================================================================ */
  /*  Private — game logic                                             */
  /* ================================================================ */

  private die(): void {
    if (this.state === 'dying' || this.state === 'dead') return;
    this.state = 'dying';
    this.deathTimer = 0;
    this.bird.die();
    AudioManager.getInstance().playCollision();
    this.particles.emit(
      this.bird.x,
      this.bird.y,
      DEATH_PARTICLE_COUNT,
      COLORS.particles.death,
    );
  }

  /* -------- rewards -------- */

  private activateReward(type: RewardType): void {
    // Refresh if already active
    this.activeRewards = this.activeRewards.filter((r) => r.type !== type);

    const duration = rewardDuration(type);
    this.activeRewards.push({ type, remaining: duration, duration });

    if (type === 'multiplier') {
      this.scoreMultiplier = Math.random() < 0.3 ? SCORE_MULTIPLIER_3X : SCORE_MULTIPLIER_2X;
    }
  }

  private tickRewardTimers(dt: number): void {
    for (let i = this.activeRewards.length - 1; i >= 0; i--) {
      const reward = this.activeRewards[i];
      if (reward.remaining !== Infinity) {
        reward.remaining -= dt;
        if (reward.remaining <= 0) {
          if (reward.type === 'multiplier') {
            this.scoreMultiplier = 1;
          }
          this.activeRewards.splice(i, 1);
        }
      }
    }
  }

  private hasReward(type: RewardType): boolean {
    return this.activeRewards.some((r) => r.type === type);
  }

  private removeReward(type: RewardType): void {
    this.activeRewards = this.activeRewards.filter((r) => r.type !== type);
  }

  /* ================================================================ */
  /*  Private — rendering                                              */
  /* ================================================================ */

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Score (top-centre)
    ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText(`${this.score}`, GAME_WIDTH / 2 + 2, 17);
    ctx.fillStyle = COLORS.ui.text;
    ctx.fillText(`${this.score}`, GAME_WIDTH / 2, 15);

    // Story-mode timer
    if (this.mode === 'story' && this.state === 'playing') {
      const secs = Math.max(0, Math.ceil(this.timer));
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      const timerText = `${mins}:${rem.toString().padStart(2, '0')}`;
      const timerColor = this.timer < 10 ? '#E17055' : COLORS.ui.text;

      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = timerColor;
      ctx.fillText(timerText, GAME_WIDTH - 20, 18);

      // Level indicator
      if (this.levelConfig) {
        ctx.font = '14px "Segoe UI", system-ui, sans-serif';
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = COLORS.ui.text;
        ctx.fillText(`Level ${this.levelConfig.level}`, GAME_WIDTH - 20, 46);
        ctx.globalAlpha = 1;
      }
    }

    // Active power-up indicators
    if (this.activeRewards.length > 0) {
      this.renderRewardIndicators(ctx);
    }

    // Multiplier badge
    if (this.scoreMultiplier > 1) {
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.reward.multiplier;
      ctx.fillText(`×${this.scoreMultiplier}`, GAME_WIDTH / 2, 55);
    }

    ctx.restore();
  }

  private renderRewardIndicators(ctx: CanvasRenderingContext2D): void {
    const startX = 15;
    const y = 18;
    const size = 30;
    const gap = 6;

    this.activeRewards.forEach((reward, i) => {
      const x = startX + i * (size + gap);

      // Background pill
      ctx.fillStyle = REWARD_COLORS[reward.type];
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Icon
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = REWARD_COLORS[reward.type];
      ctx.fillText(REWARD_ICONS[reward.type], x + size / 2, y + size / 2);

      // Remaining time (skip for infinite duration shields)
      if (reward.remaining !== Infinity) {
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = COLORS.ui.text;
        ctx.fillText(
          `${Math.ceil(reward.remaining)}s`,
          x + size / 2,
          y + size + 6,
        );
      }
    });
  }

  private renderShieldGlow(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COLORS.reward.shield;
    ctx.beginPath();
    ctx.arc(this.bird.x, this.bird.y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.reward.shield;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private renderReadyOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillText('Tap to Start', GAME_WIDTH / 2 + 2, GAME_HEIGHT / 2 + 2);
    ctx.fillStyle = COLORS.ui.text;
    ctx.fillText('Tap to Start', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    ctx.restore();
  }

  private renderDeadOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ui.text;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 400);
    ctx.fillText('Tap to continue', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
    ctx.restore();
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const y = GAME_HEIGHT - GROUND_HEIGHT;
    ctx.fillStyle = COLORS.ground.grass;
    ctx.fillRect(0, y, GAME_WIDTH, 8);
    ctx.fillStyle = COLORS.ground.surface;
    ctx.fillRect(0, y + 8, GAME_WIDTH, GROUND_HEIGHT - 8);
  }

  /* ================================================================ */
  /*  Private — input listeners                                        */
  /* ================================================================ */

  private registerListeners(): void {
    if (!this.canvas) return;

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);
      this.mouseX = pos.x;
      this.mouseY = pos.y;

      // Update pause menu hover
      if (this.paused) {
        const btns = getPauseButtons();
        if (pointInRect(pos.x, pos.y, btns.resume)) this.pauseSelectedIndex = 0;
        else if (pointInRect(pos.x, pos.y, btns.quit)) this.pauseSelectedIndex = 1;
        else if (pointInRect(pos.x, pos.y, btns.sound)) this.pauseSelectedIndex = 2;
      }
    };

    this.onMouseClick = (e: MouseEvent) => {
      if (!this.canvas) return;
      const pos = toCanvasCoords(this.canvas, e.clientX, e.clientY);

      if (this.paused) {
        const btns = getPauseButtons();
        if (pointInRect(pos.x, pos.y, btns.resume)) {
          this.resume();
        } else if (pointInRect(pos.x, pos.y, btns.quit)) {
          this.onGameOver(this.score);
        } else if (pointInRect(pos.x, pos.y, btns.sound)) {
          AudioManager.getInstance().muted = !AudioManager.getInstance().muted;
        }
        return;
      }

      // Normal gameplay clicks = flap
      this.handleFlap();
    };

    this.onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const pos = toCanvasCoords(this.canvas, touch.clientX, touch.clientY);

      if (this.paused) {
        const btns = getPauseButtons();
        if (pointInRect(pos.x, pos.y, btns.resume)) this.resume();
        else if (pointInRect(pos.x, pos.y, btns.quit)) this.onGameOver(this.score);
        else if (pointInRect(pos.x, pos.y, btns.sound)) AudioManager.getInstance().muted = !AudioManager.getInstance().muted;
        return;
      }

      this.handleFlap();
    };

    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('click', this.onMouseClick);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  private unregisterListeners(): void {
    if (this.canvas && this.onMouseMove) this.canvas.removeEventListener('mousemove', this.onMouseMove);
    if (this.canvas && this.onMouseClick) this.canvas.removeEventListener('click', this.onMouseClick);
    if (this.canvas && this.onTouchStart) this.canvas.removeEventListener('touchstart', this.onTouchStart);

    this.onMouseMove = null;
    this.onMouseClick = null;
    this.onTouchStart = null;
  }
}
