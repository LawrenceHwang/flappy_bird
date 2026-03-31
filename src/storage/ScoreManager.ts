import type { Difficulty, GameMode, HighScore } from '../utils/types';
import { STORAGE_HIGH_SCORES_KEY } from '../utils/constants';

/** Default limit when fetching top scores. */
const DEFAULT_TOP_LIMIT = 10;

/**
 * Manages high-score persistence via localStorage.
 *
 * All methods are static — no instance is required.
 * Scores are stored as a JSON array under the key defined by
 * `STORAGE_HIGH_SCORES_KEY`.
 */
export class ScoreManager {
  /* Prevent instantiation. */
  private constructor() {}

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Get the highest score recorded for a given mode (and optional difficulty).
   *
   * @param mode       Game mode to query.
   * @param difficulty Optional difficulty filter (infinite mode).
   * @returns The highest score, or `0` if none exists.
   */
  static getHighScore(mode: GameMode, difficulty?: Difficulty): number {
    const scores = ScoreManager.loadScores();
    const matching = scores.filter(
      (s) => s.mode === mode && (difficulty === undefined || s.difficulty === difficulty),
    );
    if (matching.length === 0) return 0;
    return Math.max(...matching.map((s) => s.score));
  }

  /**
   * Persist a score if it qualifies as a new high score for its mode.
   *
   * @param score      The score achieved.
   * @param mode       Game mode.
   * @param difficulty Optional difficulty (infinite mode).
   * @param level      Optional level reached (story mode).
   * @returns `true` when the score is a new record for its mode/difficulty.
   */
  static saveScore(
    score: number,
    mode: GameMode,
    difficulty?: Difficulty,
    level?: number,
  ): boolean {
    const scores = ScoreManager.loadScores();
    const previousBest = ScoreManager.getHighScore(mode, difficulty);
    const isNewRecord = score > previousBest;

    const entry: HighScore = {
      score,
      date: new Date().toISOString(),
      mode,
      ...(difficulty !== undefined && { difficulty }),
      ...(level !== undefined && { level }),
    };

    scores.push(entry);

    // Keep only the most recent entries to avoid unbounded growth.
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, 100);

    ScoreManager.persistScores(trimmed);
    return isNewRecord;
  }

  /**
   * Retrieve the top-N scores for a given mode, sorted descending.
   *
   * @param mode  Game mode to query.
   * @param limit Maximum number of results (default 10).
   * @returns Array of high-score entries.
   */
  static getTopScores(mode: GameMode, limit: number = DEFAULT_TOP_LIMIT): HighScore[] {
    const scores = ScoreManager.loadScores();
    return scores
      .filter((s) => s.mode === mode)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Remove all stored scores. */
  static clearScores(): void {
    try {
      localStorage.removeItem(STORAGE_HIGH_SCORES_KEY);
    } catch {
      // localStorage unavailable — nothing to clear.
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Safely load and parse the stored score array. */
  private static loadScores(): HighScore[] {
    try {
      const raw = localStorage.getItem(STORAGE_HIGH_SCORES_KEY);
      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      // Validate each entry has the required shape.
      return parsed.filter(
        (item): item is HighScore =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>)['score'] === 'number' &&
          typeof (item as Record<string, unknown>)['date'] === 'string' &&
          typeof (item as Record<string, unknown>)['mode'] === 'string',
      );
    } catch {
      return [];
    }
  }

  /** Write the score array to localStorage. */
  private static persistScores(scores: HighScore[]): void {
    try {
      localStorage.setItem(STORAGE_HIGH_SCORES_KEY, JSON.stringify(scores));
    } catch {
      // localStorage may be full or unavailable — silently ignore.
    }
  }
}
