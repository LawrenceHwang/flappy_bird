import { LEVEL_SKY_COLORS } from '../utils/colors';
import { STORY_LEVEL_DURATION } from '../utils/constants';
import { lerp } from '../utils/math';
import type { Difficulty, DifficultyParams, LevelConfig } from '../utils/types';

/**
 * Difficulty parameters for each infinite mode preset.
 * Tuned so that each step up meaningfully increases the challenge.
 */
export const INFINITE_DIFFICULTIES: Record<Difficulty, DifficultyParams> = {
  easy: {
    pipeGap: 220,
    scrollSpeed: 2.2,
    pipeSpacing: 420,
    initialSpawnProgress: 310,
    gravityMultiplier: 0.94,
    movingPipes: false,
    pipeOscillationSpeed: 0,
    pipeOscillationRange: 0,
  },
  medium: {
    pipeGap: 185,
    scrollSpeed: 3.05,
    pipeSpacing: 340,
    initialSpawnProgress: 175,
    gravityMultiplier: 1,
    movingPipes: false,
    pipeOscillationSpeed: 0,
    pipeOscillationRange: 0,
  },
  hard: {
    pipeGap: 145,
    scrollSpeed: 4.45,
    pipeSpacing: 280,
    initialSpawnProgress: 110,
    gravityMultiplier: 1.08,
    movingPipes: true,
    pipeOscillationSpeed: 1.5,
    pipeOscillationRange: 30,
  },
  impossible: {
    pipeGap: 110,
    scrollSpeed: 5.85,
    pipeSpacing: 235,
    initialSpawnProgress: 92,
    gravityMultiplier: 1.16,
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
      scrollSpeed: lerp(1.95, 5.05, progress),
      pipeSpacing: lerp(410, 255, progress),
      initialSpawnProgress: lerp(310, 95, progress),
      gravityMultiplier: lerp(0.94, 1.16, progress),
      movingPipes: movingPipesActive,
      pipeOscillationSpeed: movingPipesActive ? lerp(0.8, 2.5, oscillationProgress) : 0,
      pipeOscillationRange: movingPipesActive ? lerp(15, 50, oscillationProgress) : 0,
    },
    skyTopColor: colors.top,
    skyBottomColor: colors.bottom,
    duration: STORY_LEVEL_DURATION,
  };
}
