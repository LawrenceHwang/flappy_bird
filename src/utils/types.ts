/** 2D vector / point */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned bounding box */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Scene lifecycle interface */
export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  handleInput?(action: InputAction): void;
}

/** Input actions the game understands */
export type InputAction = 'flap' | 'pause' | 'confirm';

/** Game mode types */
export type GameMode = 'story' | 'infinite';

/** Difficulty presets for infinite mode */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

/** Power-up / reward types */
export type RewardType = 'multiplier' | 'shield' | 'slowmo' | 'shrink';

/** Active power-up state */
export interface ActiveReward {
  type: RewardType;
  remaining: number;
  duration: number;
}

/** All tunable difficulty parameters */
export interface DifficultyParams {
  pipeGap: number;
  scrollSpeed: number;
  pipeSpacing: number;
  gravityMultiplier: number;
  movingPipes: boolean;
  pipeOscillationSpeed: number;
  pipeOscillationRange: number;
}

/** Story level configuration */
export interface LevelConfig {
  level: number;
  difficulty: DifficultyParams;
  skyTopColor: string;
  skyBottomColor: string;
  duration: number;
}

/** High score entry */
export interface HighScore {
  score: number;
  date: string;
  mode: GameMode;
  difficulty?: Difficulty;
  level?: number;
}
