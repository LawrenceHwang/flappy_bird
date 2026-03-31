import type { InputAction } from '../utils/types';

type InputCallback = () => void;

const FLAP_DEBOUNCE_MS = 80;

/**
 * Manages keyboard and touch input, translating raw DOM events
 * into game-level {@link InputAction} callbacks.
 */
export class InputManager {
  private flapCallbacks: Set<InputCallback> = new Set();
  private pauseCallbacks: Set<InputCallback> = new Set();
  private confirmCallbacks: Set<InputCallback> = new Set();

  private lastFlapTime = 0;
  private readonly handleKeyDown: (e: KeyboardEvent) => void;
  private readonly handleTouchStart: (e: TouchEvent) => void;

  constructor() {
    this.handleKeyDown = this.onKeyDown.bind(this);
    this.handleTouchStart = this.onTouchStart.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
  }

  /**
   * Register a callback invoked when the player flaps (Space / touch).
   * @returns An unsubscribe function that removes this listener.
   */
  onFlap(cb: InputCallback): () => void {
    this.flapCallbacks.add(cb);
    return () => {
      this.flapCallbacks.delete(cb);
    };
  }

  /**
   * Register a callback invoked when pause is toggled (Escape / P).
   * @returns An unsubscribe function that removes this listener.
   */
  onPause(cb: InputCallback): () => void {
    this.pauseCallbacks.add(cb);
    return () => {
      this.pauseCallbacks.delete(cb);
    };
  }

  /**
   * Register a callback invoked on confirm (Enter / Space).
   * @returns An unsubscribe function that removes this listener.
   */
  onConfirm(cb: InputCallback): () => void {
    this.confirmCallbacks.add(cb);
    return () => {
      this.confirmCallbacks.delete(cb);
    };
  }

  /** Remove all DOM event listeners and clear registered callbacks. */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('touchstart', this.handleTouchStart);
    this.flapCallbacks.clear();
    this.pauseCallbacks.clear();
    this.confirmCallbacks.clear();
  }

  // ── Private ────────────────────────────────────────────────

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.emitFlap();
        this.emit(this.confirmCallbacks);
        break;
      case 'Enter':
        this.emit(this.confirmCallbacks);
        break;
      case 'Escape':
      case 'KeyP':
        this.emit(this.pauseCallbacks);
        break;
    }
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.defaultPrevented) return;

    e.preventDefault();
    this.emitFlap();
    this.emit(this.confirmCallbacks);
  }

  /** Emit flap only if enough time has elapsed since the last one. */
  private emitFlap(): void {
    const now = performance.now();
    if (now - this.lastFlapTime < FLAP_DEBOUNCE_MS) return;
    this.lastFlapTime = now;
    this.emit(this.flapCallbacks);
  }

  private emit(callbacks: Set<InputCallback>): void {
    callbacks.forEach((cb) => cb());
  }
}
