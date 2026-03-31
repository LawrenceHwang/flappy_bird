import type { Difficulty, DifficultyParams, LevelConfig } from '../utils/types';
import { LEVEL_SKY_COLORS } from '../utils/colors';
import { lerp } from '../utils/math';
import { STORY_LEVEL_DURATION } from '../utils/constants';

/**
 * Difficulty parameters for each infinite mode preset.
 * Tuned so that each step up meaningfully increases the challenge.
 */
export const INFINITE_DIFFICULTIES: Record<Difficulty, DifficultyParams> = {
  easy: {
    pipeGap: 220,
    scrollSpeed: 2,
    pipeSpacing: 420,
    gravityMultiplier: 0.88,
    movingPipes: false,
    pipeOscillationSpeed: 0,
    pipeOscillationRange: 0,
  },
  medium: {
    pipeGap: 185,
    scrollSpeed: 2.8,
    pipeSpacing: 340,
    gravityMultiplier: 0.95,
    movingPipes: false,
    pipeOscillationSpeed: 0,
    pipeOscillationRange: 0,
  },
  hard: {
    pipeGap: 145,
    scrollSpeed: 4.1,
    pipeSpacing: 280,
    gravityMultiplier: 1.05,
    movingPipes: true,
    pipeOscillationSpeed: 1.5,
    pipeOscillationRange: 30,
  },
  impossible: {
    pipeGap: 110,
    scrollSpeed: 5.5,
    pipeSpacing: 235,
    gravityMultiplier: 1.2,
    movingPipes: true,
    pipeOscillationSpeed: 2.5,
    pipeOscillationRange: 50,
  },
};

/**
 * Generate a story-mode level configuration for levels 1–20.
 * Difficulty ramps smoothly from beginner-friendly to near-impossible,
 * with moving pipes starting at level 8.
 */
export function getStoryLevelConfig(level: number): LevelConfig {
  const clamped = Math.max(1, Math.min(20, level));
  const progress = (clamped - 1) / 19;
  const colors = LEVEL_SKY_COLORS[clamped - 1] ?? LEVEL_SKY_COLORS[0];

  const movingPipesActive = clamped >= 8;
  const oscillationProgress = movingPipesActive ? (clamped - 8) / 12 : 0;

  return {
    level: clamped,
    difficulty: {
      pipeGap: lerp(210, 125, progress),
      scrollSpeed: lerp(1.8, 4.6, progress),
      pipeSpacing: lerp(410, 255, progress),
      gravityMultiplier: lerp(0.88, 1.15, progress),
      movingPipes: movingPipesActive,
      pipeOscillationSpeed: movingPipesActive ? lerp(0.8, 2.5, oscillationProgress) : 0,
      pipeOscillationRange: movingPipesActive ? lerp(15, 50, oscillationProgress) : 0,
    },
    skyTopColor: colors.top,
    skyBottomColor: colors.bottom,
    duration: STORY_LEVEL_DURATION,
  };
}
