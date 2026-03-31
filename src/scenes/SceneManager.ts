import type { Scene, InputAction } from '../utils/types';
import { GAME_WIDTH, GAME_HEIGHT, FADE_DURATION } from '../utils/constants';

type TransitionPhase = 'fade-out' | 'fade-in';

/**
 * Manages scene lifecycle and transitions.
 *
 * During a fade transition the outgoing scene dims to black, the scenes swap,
 * then the incoming scene brightens from black — each half taking FADE_DURATION.
 * Input is blocked while a transition is in progress.
 */
export class SceneManager {
  private currentScene: Scene | null = null;
  private outgoingScene: Scene | null = null;
  private incomingScene: Scene | null = null;
  private transitionPhase: TransitionPhase | null = null;
  private transitionProgress = 0;

  /** Switch to a new scene, optionally through a fade-to-black transition. */
  switchTo(scene: Scene, transition: 'fade' | 'none' = 'none'): void {
    if (transition === 'none' || !this.currentScene) {
      this.currentScene?.exit();
      this.currentScene = scene;
      this.currentScene.enter();
      this.transitionPhase = null;
      return;
    }

    this.outgoingScene = this.currentScene;
    this.incomingScene = scene;
    this.transitionProgress = 0;
    this.transitionPhase = 'fade-out';
  }

  /** Advance transition timers and delegate update to the active scene. */
  update(dt: number): void {
    if (this.transitionPhase) {
      this.transitionProgress += dt / FADE_DURATION;

      if (this.transitionProgress >= 1) {
        if (this.transitionPhase === 'fade-out') {
          this.outgoingScene?.exit();
          this.currentScene = this.incomingScene;
          this.currentScene?.enter();
          this.outgoingScene = null;
          this.incomingScene = null;
          this.transitionPhase = 'fade-in';
          this.transitionProgress = 0;
        } else {
          this.transitionPhase = null;
          this.transitionProgress = 0;
        }
      }
      return;
    }

    this.currentScene?.update(dt);
  }

  /** Render the active scene with any transition overlay. */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.transitionPhase === 'fade-out' && this.outgoingScene) {
      this.outgoingScene.render(ctx);
      const alpha = Math.min(1, this.transitionProgress);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else if (this.transitionPhase === 'fade-in' && this.currentScene) {
      this.currentScene.render(ctx);
      const alpha = Math.max(0, 1 - this.transitionProgress);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.currentScene?.render(ctx);
    }
  }

  /** Forward input to the current scene (blocked during transitions). */
  handleInput(action: InputAction): void {
    if (!this.transitionPhase) {
      this.currentScene?.handleInput?.(action);
    }
  }

  /** Return the currently active scene. */
  getCurrentScene(): Scene | null {
    return this.currentScene;
  }
}
