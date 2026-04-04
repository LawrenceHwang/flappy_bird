import { artAssets } from '../graphics/assets';
import { GRAPHICS_THEME } from '../graphics/theme';
import { roundedRectPath } from '../graphics/ui-kit';
import type { ActiveReward, GameMode } from '../utils/types';
import { GAME_WIDTH } from '../utils/constants';

export interface HUDState {
  score: number;
  mode: GameMode;
  timer?: number;
  level?: number;
  activeRewards: ActiveReward[];
  paused: boolean;
  scoreMultiplier: number;
}

const TOTAL_LEVELS = 20;
const SCORE_POP_DURATION = 0.15;

export class HUD {
  private lastScore = 0;
  private scorePopTimer = 0;

  render(ctx: CanvasRenderingContext2D, state: HUDState): void {
    if (state.score !== this.lastScore) {
      this.scorePopTimer = SCORE_POP_DURATION;
      this.lastScore = state.score;
    }

    if (this.scorePopTimer > 0) {
      this.scorePopTimer = Math.max(0, this.scorePopTimer - 1 / 60);
    }

    this.renderScore(ctx, state.score);

    if (state.scoreMultiplier > 1) {
      this.renderMultiplier(ctx, state.scoreMultiplier);
    }

    if (state.mode === 'story') {
      if (state.level !== undefined) {
        this.renderInfoChip(ctx, 16, 16, 128, 42, 'LEVEL', `${state.level}/${TOTAL_LEVELS}`);
      }
      if (state.timer !== undefined) {
        const mins = Math.floor(state.timer / 60);
        const secs = Math.floor(state.timer % 60);
        const text = `${mins}:${String(secs).padStart(2, '0')}`;
        this.renderInfoChip(
          ctx,
          GAME_WIDTH - 144,
          16,
          128,
          42,
          'TIME',
          text,
          state.timer < 10 ? '#ffb18c' : GRAPHICS_THEME.text.primary,
        );
      }
    }

    if (state.activeRewards.length > 0) {
      this.renderRewards(ctx, state.activeRewards, state.mode === 'story');
    }

    if (state.paused) {
      this.renderPauseOverlay(ctx);
    }
  }

  private renderScore(ctx: CanvasRenderingContext2D, score: number): void {
    const popProgress = this.scorePopTimer / SCORE_POP_DURATION;
    const scale = 1 + popProgress * 0.24;
    const text = String(score);

    ctx.save();
    ctx.translate(GAME_WIDTH / 2, 52);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = GRAPHICS_THEME.fonts.hud;

    ctx.strokeStyle = GRAPHICS_THEME.hud.scoreStroke;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);

    const fill = ctx.createLinearGradient(-40, -28, 40, 28);
    fill.addColorStop(0, '#fffef5');
    fill.addColorStop(0.4, '#fff0d8');
    fill.addColorStop(1, '#f7d29b');
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(255, 214, 129, 0.36)';
    ctx.shadowBlur = 14;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  private renderMultiplier(ctx: CanvasRenderingContext2D, multiplier: number): void {
    this.renderInfoChip(
      ctx,
      GAME_WIDTH / 2 - 48,
      76,
      96,
      28,
      'BOOST',
      `x${multiplier}`,
      '#2a1b14',
      'gold',
    );
  }

  private renderInfoChip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string,
    valueColor: string = GRAPHICS_THEME.text.primary,
    tone: 'slate' | 'gold' = 'slate',
  ): void {
    const background =
      tone === 'gold'
        ? ['rgba(244, 214, 140, 0.92)', 'rgba(197, 143, 52, 0.92)']
        : [GRAPHICS_THEME.surface.chipTop, GRAPHICS_THEME.surface.chipBottom];

    ctx.save();
    roundedRectPath(ctx, x, y, w, h, 16);
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, background[0]);
    fill.addColorStop(1, background[1]);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = tone === 'gold' ? 'rgba(102, 67, 17, 0.24)' : GRAPHICS_THEME.hud.badgeStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = tone === 'gold' ? 'rgba(59, 32, 11, 0.72)' : GRAPHICS_THEME.text.muted;
    ctx.font = GRAPHICS_THEME.fonts.label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + 12, y + 7);

    ctx.fillStyle = valueColor;
    ctx.font = '700 15px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x + 12, y + h - 13);
    ctx.restore();
  }

  private renderRewards(
    ctx: CanvasRenderingContext2D,
    rewards: ActiveReward[],
    storyMode: boolean,
  ): void {
    const startY = storyMode ? 66 : 16;
    const startX = 16;
    const pillW = 56;
    const pillH = 56;
    const gap = 10;

    rewards.forEach((reward, index) => {
      const x = startX + index * (pillW + gap);
      const y = startY;
      const durationText =
        reward.remaining === Infinity ? 'ON' : `${Math.ceil(reward.remaining)}s`;

      ctx.save();
      roundedRectPath(ctx, x, y, pillW, pillH, 18);
      const fill = ctx.createLinearGradient(x, y, x, y + pillH);
      fill.addColorStop(0, GRAPHICS_THEME.surface.chipTop);
      fill.addColorStop(1, GRAPHICS_THEME.surface.chipBottom);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = GRAPHICS_THEME.hud.badgeStroke;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const image = artAssets.getRewardIcon(reward.type);
      ctx.drawImage(image, x + 12, y + 8, 32, 32);

      ctx.fillStyle = GRAPHICS_THEME.text.secondary;
      ctx.font = '700 9px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(durationText, x + pillW / 2, y + pillH - 10);
      ctx.restore();
    });
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 12, 24, 0.56)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = GRAPHICS_THEME.fonts.display;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GRAPHICS_THEME.text.primary;
    ctx.fillText('Paused', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.restore();
  }
}
