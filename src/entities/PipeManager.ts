import { Pipe } from './Pipe';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_HEIGHT,
  MIN_PIPE_HEIGHT,
} from '../utils/constants';
import { randomRange } from '../utils/math';

/** Margin beyond the right edge where new pipes spawn. */
const SPAWN_MARGIN = 20;

/**
 * Manages creation, recycling, and rendering of pipe obstacles.
 *
 * Uses a simple object pool so no Pipe instances are garbage-collected
 * during gameplay.
 */
export class PipeManager {
  private activePipes: Pipe[] = [];
  private pool: Pipe[] = [];
  private spawnTimer: number = 0;
  private pipeSpacing: number = 200;

  /**
   * Tick all active pipes forward and handle spawning / recycling.
   * @param dt - Frame delta in seconds.
   * @param scrollSpeed - Horizontal scroll px/frame-at-60fps.
   * @param time - Elapsed game time in seconds.
   * @param gapSize - Current pipe gap height.
   * @param moving - Whether new pipes should oscillate.
   * @param oscillationSpeed - Oscillation frequency for new pipes.
   * @param oscillationRange - Oscillation amplitude for new pipes.
   */
  update(
    dt: number,
    scrollSpeed: number,
    time: number,
    gapSize: number,
    moving: boolean,
    oscillationSpeed: number,
    oscillationRange: number,
  ): void {
    // Update existing pipes
    for (let i = this.activePipes.length - 1; i >= 0; i--) {
      const pipe = this.activePipes[i];
      pipe.update(dt, scrollSpeed, time);

      if (pipe.isOffScreen()) {
        this.recycle(i);
      }
    }

    // Spawn logic
    this.spawnTimer += scrollSpeed * dt * 60;
    if (this.spawnTimer >= this.pipeSpacing) {
      this.spawnTimer -= this.pipeSpacing;
      this.spawnPipe(gapSize, moving, oscillationSpeed, oscillationRange);
    }
  }

  /**
   * Place a new pipe (from pool or freshly constructed) at the right edge.
   * @param gapSize - Height of the gap opening.
   * @param moving - Whether the pipe should oscillate.
   * @param oscillationSpeed - Sine frequency.
   * @param oscillationRange - Sine amplitude (px).
   */
  spawnPipe(
    gapSize: number,
    moving: boolean,
    oscillationSpeed: number,
    oscillationRange: number,
  ): void {
    const playableHeight = GAME_HEIGHT - GROUND_HEIGHT;
    const minGapY = MIN_PIPE_HEIGHT + gapSize / 2;
    const maxGapY = playableHeight - MIN_PIPE_HEIGHT - gapSize / 2;
    const gapY = randomRange(minGapY, maxGapY);
    const spawnX = GAME_WIDTH + SPAWN_MARGIN;

    const pipe = this.pool.pop();
    if (pipe) {
      pipe.reinit(spawnX, gapY, gapSize, moving, oscillationSpeed, oscillationRange);
      this.activePipes.push(pipe);
    } else {
      this.activePipes.push(
        new Pipe(spawnX, gapY, gapSize, moving, oscillationSpeed, oscillationRange),
      );
    }
  }

  /** Draw every active pipe. */
  render(ctx: CanvasRenderingContext2D): void {
    for (const pipe of this.activePipes) {
      pipe.render(ctx);
    }
  }

  /** Read-only access to currently visible pipes. */
  getActivePipes(): readonly Pipe[] {
    return this.activePipes;
  }

  /** Change the horizontal distance between consecutive pipes. */
  setPipeSpacing(spacing: number): void {
    this.pipeSpacing = spacing;
  }

  /** Return all active pipes to the pool and reset the spawn timer. */
  reset(): void {
    for (const pipe of this.activePipes) {
      this.pool.push(pipe);
    }
    this.activePipes.length = 0;
    this.spawnTimer = 0;
  }

  // ---- internals -------------------------------------------------------

  private recycle(index: number): void {
    const pipe = this.activePipes[index];
    this.activePipes.splice(index, 1);
    this.pool.push(pipe);
  }
}
