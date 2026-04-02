/** Reference resolution the game is designed for */
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;
export const ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

/** Physics tuned for a responsive but forgiving flight arc. */
export const GRAVITY = 0.26;
export const FLAP_VELOCITY = -4.2;
export const TERMINAL_VELOCITY = 8.0;
export const BIRD_X = 150;

/** Bird dimensions */
export const BIRD_WIDTH = 40;
export const BIRD_HEIGHT = 30;
export const BIRD_HITBOX_INSET = 4;

/** Pipe dimensions */
export const PIPE_WIDTH = 60;
export const PIPE_CAP_HEIGHT = 20;
export const PIPE_CAP_OVERHANG = 6;
export const MIN_PIPE_HEIGHT = 50;

/** Ground */
export const GROUND_HEIGHT = 50;

/** Timing */
export const STORY_LEVEL_DURATION = 30;
export const REWARD_SPAWN_CHANCE = 0.08;
export const START_COUNTDOWN_DURATION = 3;

/** Reward durations (seconds) */
export const MULTIPLIER_DURATION = 10;
export const SHIELD_DURATION = Infinity;
export const SLOWMO_DURATION = 5;
export const SHRINK_DURATION = 8;
export const SLOWMO_FACTOR = 0.5;
export const SHRINK_FACTOR = 0.5;

/** Particle counts */
export const FLAP_PARTICLE_COUNT = 4;
export const DEATH_PARTICLE_COUNT = 12;
export const REWARD_PARTICLE_COUNT = 8;

/** Score */
export const SCORE_MULTIPLIER_2X = 2;
export const SCORE_MULTIPLIER_3X = 3;

/** Animation */
export const WING_FLAP_SPEED = 0.15;
export const BIRD_ROTATION_SPEED = 0.08;
export const MAX_BIRD_UP_ROTATION = -0.5;
export const MAX_BIRD_DOWN_ROTATION = 1.2;

/** Scene transitions */
export const FADE_DURATION = 0.3;

/** Storage keys */
export const STORAGE_HIGH_SCORES_KEY = 'flappy_bird_high_scores';
export const STORAGE_SETTINGS_KEY = 'flappy_bird_settings';
