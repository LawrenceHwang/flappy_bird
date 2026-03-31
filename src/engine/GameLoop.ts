/** Maximum delta time (seconds) to prevent the "spiral of death". */
const MAX_DT = 1 / 20; // 0.05 s

type UpdateFn = (dt: number) => void;
type RenderFn = () => void;

/**
 * Fixed-timestep game loop driven by `requestAnimationFrame`.
 *
 * Caps delta time at {@link MAX_DT} and pauses dt accumulation
 * while the browser tab is hidden so returning from a background
 * tab does not cause a massive time jump.
 */
export class GameLoop {
  private rafId: number | null = null;
  private lastTime: number = 0;
  private running = false;

  private readonly updateFn: UpdateFn;
  private readonly renderFn: RenderFn;

  private readonly handleVisibilityChange: () => void;

  constructor(update: UpdateFn, render: RenderFn) {
    this.updateFn = update;
    this.renderFn = render;

    this.handleVisibilityChange = this.onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /** Whether the loop is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Start (or resume) the loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop the loop and cancel the pending animation frame. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Stop the loop and remove the visibility listener. */
  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  // ── Private ────────────────────────────────────────────────

  /** Bound RAF callback. Arrow function preserves `this`. */
  private tick = (now: number): void => {
    if (!this.running) return;

    const rawDt = (now - this.lastTime) / 1000; // ms → seconds
    this.lastTime = now;

    // Cap dt to prevent spiral-of-death after long frames
    const dt = Math.min(rawDt, MAX_DT);

    this.updateFn(dt);
    this.renderFn();

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * When the tab becomes hidden we don't stop the loop, but when it
   * becomes visible again we reset {@link lastTime} so that the elapsed
   * time while hidden is ignored.
   */
  private onVisibilityChange(): void {
    if (!document.hidden && this.running) {
      this.lastTime = performance.now();
    }
  }
}
