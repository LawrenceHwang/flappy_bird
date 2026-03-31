import type { ActiveReward, GameMode, RewardType } from '../utils/types';
import { COLORS } from '../utils/colors';
import { GAME_WIDTH } from '../utils/constants';

/** State passed to the HUD each frame. */
export interface HUDState {
  score: number;
  mode: GameMode;
  /** Remaining seconds (story mode). */
  timer?: number;
  /** Current level (story mode). */
  level?: number;
  /** Active power-ups with remaining time. */
  activeRewards: ActiveReward[];
  paused: boolean;
}

/** Mapping from RewardType to display abbreviation. */
const REWARD_LABELS: Record<RewardType, string> = {
  multiplier: '×2',
  shield: '🛡',
  slowmo: '⏰',
  shrink: '↓',
};

/** Mapping from RewardType to badge color. */
const REWARD_BADGE_COLORS: Record<RewardType, string> = {
  multiplier: COLORS.reward.multiplier,
  shield: COLORS.reward.shield,
  slowmo: COLORS.reward.slowmo,
  shrink: COLORS.reward.shrink,
};

/** Total story-mode levels. */
const TOTAL_LEVELS = 20;

/** Score pop animation duration in seconds. */
const SCORE_POP_DURATION = 0.15;

/**
 * In-game heads-up display rendered onto a Canvas 2D context.
 *
 * Displays score, timer, level indicator, and active power-ups.
 * The score briefly scales up when it changes to provide visual feedback.
 */
export class HUD {
  /** Last score value — used to detect increments and trigger pop. */
  private lastScore = 0;

  /** Remaining seconds in the score-pop animation. */
  private scorePopTimer = 0;

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Render all HUD elements for the current frame.
   *
   * @param ctx   Canvas 2D rendering context.
   * @param state Current HUD state.
   */
  render(ctx: CanvasRenderingContext2D, state: HUDState): void {
    // Detect score change → trigger pop animation.
    if (state.score !== this.lastScore) {
      this.scorePopTimer = SCORE_POP_DURATION;
      this.lastScore = state.score;
    }

    // Decay pop timer (approximate 60 fps for dt).
    if (this.scorePopTimer > 0) {
      this.scorePopTimer = Math.max(0, this.scorePopTimer - 1 / 60);
    }

    this.renderScore(ctx, state.score);

    if (state.mode === 'story') {
      if (state.level !== undefined) {
        this.renderLevel(ctx, state.level);
      }
      if (state.timer !== undefined) {
        this.renderTimer(ctx, state.timer);
      }
    }

    if (state.activeRewards.length > 0) {
      this.renderRewards(ctx, state.activeRewards, state.mode);
    }

    if (state.paused) {
      this.renderPauseOverlay(ctx);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private renderers                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Large score number, top-center with a Flappy-Bird-style white fill
   * and dark outline. Briefly scales up on increment.
   */
  private renderScore(ctx: CanvasRenderingContext2D, score: number): void {
    const popProgress = this.scorePopTimer / SCORE_POP_DURATION;
    const scale = 1 + popProgress * 0.3;

    ctx.save();
    ctx.translate(GAME_WIDTH / 2, 50);
    ctx.scale(scale, scale);

    const text = String(score);
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline / shadow
    ctx.strokeStyle = COLORS.ui.textDark;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);

    // White fill
    ctx.fillStyle = COLORS.ui.text;
    ctx.shadowColor = COLORS.ui.shadow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  /** "Level X/20" indicator in the top-left corner. */
  private renderLevel(ctx: CanvasRenderingContext2D, level: number): void {
    const text = `Level ${level}/${TOTAL_LEVELS}`;

    ctx.save();
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = COLORS.ui.shadow;
    ctx.fillText(text, 17, 17);

    ctx.fillStyle = COLORS.ui.text;
    ctx.shadowColor = COLORS.ui.shadow;
    ctx.shadowBlur = 4;
    ctx.fillText(text, 16, 16);
    ctx.restore();
  }

  /**
   * Remaining time in "M:SS" format, top-right.
   * Pulses red when less than 10 seconds remain.
   */
  private renderTimer(ctx: CanvasRenderingContext2D, seconds: number): void {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const text = `${mins}:${String(secs).padStart(2, '0')}`;

    const urgent = seconds < 10;
    // Pulsing alpha when urgent (sine wave between 0.5 and 1).
    const alpha = urgent ? 0.75 + 0.25 * Math.sin(Date.now() / 150) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    ctx.fillStyle = COLORS.ui.shadow;
    ctx.fillText(text, GAME_WIDTH - 15, 17);

    ctx.fillStyle = urgent ? '#FF7675' : COLORS.ui.text;
    ctx.shadowColor = COLORS.ui.shadow;
    ctx.shadowBlur = 4;
    ctx.fillText(text, GAME_WIDTH - 16, 16);
    ctx.restore();
  }

  /**
   * Active power-up badges in the top-left area (below level indicator).
   * Each badge is a small coloured circle with an abbreviation and a
   * countdown arc showing remaining fraction.
   */
  private renderRewards(
    ctx: CanvasRenderingContext2D,
    rewards: ActiveReward[],
    mode: GameMode,
  ): void {
    const startY = mode === 'story' ? 44 : 16;
    const startX = 16;
    const badgeSize = 18;
    const spacing = 44;

    rewards.forEach((reward, i) => {
      const cx = startX + badgeSize + i * spacing;
      const cy = startY + badgeSize;
      const fraction = reward.duration > 0 ? reward.remaining / reward.duration : 0;

      // Background circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, badgeSize, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ui.background;
      ctx.fill();

      // Progress arc
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        badgeSize,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * fraction,
      );
      ctx.closePath();
      ctx.fillStyle = REWARD_BADGE_COLORS[reward.type];
      ctx.globalAlpha = 0.7;
      ctx.fill();

      // Label
      ctx.globalAlpha = 1;
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.ui.text;
      ctx.fillText(REWARD_LABELS[reward.type], cx, cy);

      // Remaining seconds below badge
      if (isFinite(reward.remaining)) {
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = COLORS.ui.text;
        ctx.shadowColor = COLORS.ui.shadow;
        ctx.shadowBlur = 2;
        ctx.fillText(`${Math.ceil(reward.remaining)}s`, cx, cy + badgeSize + 10);
      }

      ctx.restore();
    });
  }

  /** Semi-transparent overlay with "PAUSED" text. */
  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = COLORS.ui.background;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ui.text;
    ctx.shadowColor = COLORS.ui.shadow;
    ctx.shadowBlur = 10;
    ctx.fillText('PAUSED', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  }
}
