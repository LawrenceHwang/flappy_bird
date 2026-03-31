import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';

/** Options accepted by {@link Renderer.drawText}. */
export interface DrawTextOptions {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

/**
 * Thin wrapper around a `<canvas>` 2D rendering context.
 *
 * Handles DPI scaling so all drawing code can work in logical
 * (CSS) pixels while the underlying canvas is crisp on HiDPI screens.
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private logicalWidth: number = GAME_WIDTH;
  private logicalHeight: number = GAME_HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to obtain 2D rendering context');
    }
    this.context = context;
    this.setupCanvas(GAME_WIDTH, GAME_HEIGHT);
  }

  /** The underlying 2D context for direct draw calls. */
  get ctx(): CanvasRenderingContext2D {
    return this.context;
  }

  /** Logical width in CSS pixels. */
  get width(): number {
    return this.logicalWidth;
  }

  /** Logical height in CSS pixels. */
  get height(): number {
    return this.logicalHeight;
  }

  /**
   * Configure the canvas to the given logical size, accounting for
   * `devicePixelRatio` so drawing stays sharp on HiDPI displays.
   */
  setupCanvas(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Clear the entire canvas. */
  clear(): void {
    this.context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
  }

  /**
   * Resize the canvas to a new logical resolution.
   * @param width  New logical width.
   * @param height New logical height.
   */
  resize(width: number, height: number): void {
    this.setupCanvas(width, height);
  }

  /**
   * Draw a rectangle with optional rounded corners.
   * @param x           Left edge.
   * @param y           Top edge.
   * @param w           Width.
   * @param h           Height.
   * @param radius      Corner radius (0 = sharp corners).
   * @param fillColor   Fill CSS color.
   * @param strokeColor Optional stroke CSS color.
   */
  drawRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    fillColor: string,
    strokeColor?: string,
  ): void {
    const ctx = this.context;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  }

  /**
   * Draw a filled circle.
   * @param x         Centre X.
   * @param y         Centre Y.
   * @param radius    Radius.
   * @param fillColor Fill CSS color.
   */
  drawCircle(x: number, y: number, radius: number, fillColor: string): void {
    const ctx = this.context;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  /**
   * Draw text with configurable styling.
   * @param text    The string to render.
   * @param x       X position.
   * @param y       Y position.
   * @param options Styling options (font, color, alignment, etc.).
   */
  drawText(text: string, x: number, y: number, options: DrawTextOptions = {}): void {
    const ctx = this.context;
    ctx.font = options.font ?? '16px sans-serif';
    ctx.fillStyle = options.color ?? '#000';
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'alphabetic';

    if (options.maxWidth !== undefined) {
      ctx.fillText(text, x, y, options.maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }
  }
}
