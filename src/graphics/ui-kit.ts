import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import { GRAPHICS_THEME, type ButtonTone } from './theme';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ButtonRenderOptions {
  label: string;
  tone: ButtonTone;
  hovered?: boolean;
  selected?: boolean;
  subtitle?: string;
  leadingIcon?: string;
  textColor?: string;
  radius?: number;
  compact?: boolean;
}

export interface TitleRenderOptions {
  x: number;
  y: number;
  title: string;
  eyebrow?: string;
  width?: number;
  align?: CanvasTextAlign;
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: { radius?: number; accent?: string } = {},
): void {
  const radius = options.radius ?? 24;

  ctx.save();
  ctx.shadowColor = GRAPHICS_THEME.surface.panelShadow;
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;

  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  const fill = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  fill.addColorStop(0, GRAPHICS_THEME.surface.panelTop);
  fill.addColorStop(0.48, GRAPHICS_THEME.surface.panelMid);
  fill.addColorStop(1, GRAPHICS_THEME.surface.panelBottom);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = GRAPHICS_THEME.surface.panelBorder;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  roundedRectPath(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4, radius - 2);
  ctx.strokeStyle = GRAPHICS_THEME.surface.panelInnerBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.clip();

  const sheen = ctx.createRadialGradient(
    rect.x + rect.w * 0.26,
    rect.y + 16,
    0,
    rect.x + rect.w * 0.26,
    rect.y + 16,
    Math.max(rect.w, rect.h),
  );
  sheen.addColorStop(0, GRAPHICS_THEME.surface.highlight);
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  const footerGlow = ctx.createLinearGradient(
    rect.x,
    rect.y + rect.h - 72,
    rect.x,
    rect.y + rect.h,
  );
  footerGlow.addColorStop(0, 'rgba(111, 150, 242, 0)');
  footerGlow.addColorStop(1, GRAPHICS_THEME.surface.footerGlow);
  ctx.fillStyle = footerGlow;
  ctx.fillRect(rect.x, rect.y + rect.h - 72, rect.w, 72);

  if (options.accent) {
    const accent = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
    accent.addColorStop(0, 'rgba(255,255,255,0)');
    accent.addColorStop(0.5, options.accent);
    accent.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = accent;
    ctx.fillRect(rect.x + 16, rect.y + rect.h - 6, rect.w - 32, 6);
  }

  ctx.restore();
  ctx.restore();
}

export function drawSceneTitle(
  ctx: CanvasRenderingContext2D,
  options: TitleRenderOptions,
): void {
  const width = options.width ?? 420;
  const align = options.align ?? 'center';

  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  if (options.eyebrow) {
    ctx.font = GRAPHICS_THEME.fonts.eyebrow;
    ctx.fillStyle = GRAPHICS_THEME.text.muted;
    ctx.fillText(options.eyebrow, options.x, options.y - 28);
  }

  ctx.font = GRAPHICS_THEME.fonts.title;
  ctx.fillStyle = GRAPHICS_THEME.text.shadow;
  ctx.fillText(options.title, options.x + 2, options.y + 4);

  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(98, 62, 47, 0.86)';
  ctx.strokeText(options.title, options.x, options.y);

  const grad = ctx.createLinearGradient(options.x - width / 2, options.y - 22, options.x + width / 2, options.y + 22);
  grad.addColorStop(0, '#FFF8E2');
  grad.addColorStop(0.45, '#F5D39C');
  grad.addColorStop(1, '#D28460');
  ctx.fillStyle = grad;
  ctx.fillText(options.title, options.x, options.y);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(options.title, options.x, options.y - 1);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255, 233, 196, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(options.x - width * 0.38, options.y + 18);
  ctx.lineTo(options.x + width * 0.38, options.y + 18);
  ctx.stroke();
  ctx.restore();
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: ButtonRenderOptions,
): void {
  const tone = GRAPHICS_THEME.buttons[options.tone];
  const hovered = options.hovered ?? false;
  const selected = options.selected ?? false;
  const highlight = hovered || selected;
  const radius = options.radius ?? 18;
  const lift = highlight ? -2 : 0;
  const compact = options.compact ?? false;
  const textColor = options.textColor ?? tone.text;

  ctx.save();

  roundedRectPath(ctx, rect.x, rect.y + 5, rect.w, rect.h, radius);
  ctx.fillStyle = tone.dark;
  ctx.fill();

  ctx.shadowColor = highlight ? tone.glow : GRAPHICS_THEME.surface.panelShadow;
  ctx.shadowBlur = highlight ? 18 : 10;
  ctx.shadowOffsetY = 5;

  const fill = ctx.createLinearGradient(rect.x, rect.y + lift, rect.x + rect.w, rect.y + rect.h + lift);
  fill.addColorStop(0, highlight ? tone.light : tone.base);
  fill.addColorStop(0.56, tone.base);
  fill.addColorStop(1, highlight ? tone.base : tone.dark);

  roundedRectPath(ctx, rect.x, rect.y + lift, rect.w, rect.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  roundedRectPath(ctx, rect.x + 1.5, rect.y + 1 + lift, rect.w - 3, rect.h * 0.44, radius - 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();

  roundedRectPath(ctx, rect.x, rect.y + lift, rect.w, rect.h, radius);
  ctx.strokeStyle = highlight ? 'rgba(255, 245, 220, 0.3)' : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = selected ? 1.8 : 1.2;
  ctx.stroke();

  const labelX = options.leadingIcon ? rect.x + 60 : rect.x + rect.w / 2;
  const labelAlign: CanvasTextAlign = options.leadingIcon ? 'left' : 'center';

  if (options.leadingIcon) {
    ctx.fillStyle = 'rgba(13, 17, 34, 0.22)';
    ctx.beginPath();
    ctx.arc(rect.x + 30, rect.y + rect.h / 2 + lift, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '700 16px "Segoe UI Emoji","Apple Color Emoji","Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.leadingIcon, rect.x + 30, rect.y + rect.h / 2 + lift + 1);
  }

  ctx.fillStyle = textColor;
  ctx.font = compact ? '700 14px "Trebuchet MS", "Segoe UI", system-ui, sans-serif' : GRAPHICS_THEME.fonts.button;
  ctx.textAlign = labelAlign;
  ctx.textBaseline = options.subtitle ? 'alphabetic' : 'middle';
  ctx.fillText(options.label, labelX, options.subtitle ? rect.y + 26 + lift : rect.y + rect.h / 2 + lift);

  if (options.subtitle) {
    ctx.font = GRAPHICS_THEME.fonts.buttonSub;
    ctx.fillStyle = GRAPHICS_THEME.text.secondary;
    ctx.textBaseline = 'middle';
    ctx.fillText(options.subtitle, labelX, rect.y + rect.h - 18 + lift);
  }

  ctx.restore();
}

export function drawControlPill(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  header: string,
  detail: string,
  accent: string,
): void {
  ctx.save();
  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 13);
  ctx.fillStyle = 'rgba(15, 18, 34, 0.42)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GRAPHICS_THEME.text.muted;
  ctx.font = '600 8px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  ctx.fillText(header, rect.x + 10, rect.y + 4);
  ctx.fillStyle = GRAPHICS_THEME.text.secondary;
  ctx.font = '600 10px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  ctx.fillText(detail, rect.x + 10, rect.y + 14);
  ctx.restore();
}

export function drawIconToggle(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: { label: string; tone: ButtonTone; hovered?: boolean; selected?: boolean },
): void {
  drawButton(ctx, rect, {
    label: options.label,
    tone: options.tone,
    hovered: options.hovered,
    selected: options.selected,
    compact: true,
    radius: Math.floor(rect.h / 2),
  });
}

export interface StartupErrorSplashOptions {
  errorMessage: string;
  retryHovered?: boolean;
}

function drawStartupBackdrop(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  sky.addColorStop(0, '#10234D');
  sky.addColorStop(0.56, '#274A7A');
  sky.addColorStop(1, '#EEB180');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const glow = ctx.createRadialGradient(230, 140, 0, 230, 140, 180);
  glow.addColorStop(0, GRAPHICS_THEME.world.warmGlow);
  glow.addColorStop(1, 'rgba(255, 208, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

export function drawLoadingSplash(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawStartupBackdrop(ctx);

  drawSceneTitle(ctx, {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2 - 30,
    title: 'Flappy Bird',
    eyebrow: 'LOADING PREMIUM ART',
    width: 360,
  });

  const panel = { x: GAME_WIDTH / 2 - 140, y: GAME_HEIGHT / 2 + 12, w: 280, h: 54 };
  drawGlassPanel(ctx, panel, { radius: 22, accent: 'rgba(111, 150, 242, 0.18)' });
  ctx.fillStyle = GRAPHICS_THEME.text.secondary;
  ctx.font = GRAPHICS_THEME.fonts.body;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Preparing world layers, character art, and scene chrome...', GAME_WIDTH / 2, panel.y + panel.h / 2);
  ctx.restore();
}

export function drawStartupErrorSplash(
  ctx: CanvasRenderingContext2D,
  options: StartupErrorSplashOptions,
): Rect {
  const panel = { x: GAME_WIDTH / 2 - 220, y: GAME_HEIGHT / 2 + 4, w: 440, h: 140 };
  const retryButton = { x: GAME_WIDTH / 2 - 122, y: panel.y + 80, w: 244, h: 48 };

  ctx.save();
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawStartupBackdrop(ctx);

  drawSceneTitle(ctx, {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2 - 34,
    title: 'Flappy Bird',
    eyebrow: 'ASSET PRELOAD FAILED',
    width: 360,
  });

  drawGlassPanel(ctx, panel, { radius: 24, accent: 'rgba(200, 94, 114, 0.26)' });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GRAPHICS_THEME.text.primary;
  ctx.font = GRAPHICS_THEME.fonts.body;
  ctx.fillText("We couldn't finish loading the premium art package.", GAME_WIDTH / 2, panel.y + 34);
  ctx.fillStyle = GRAPHICS_THEME.text.secondary;
  ctx.fillText(`Error: ${options.errorMessage}`, GAME_WIDTH / 2, panel.y + 60);

  drawButton(ctx, retryButton, {
    label: 'Retry startup',
    subtitle: 'Click or press R',
    tone: 'rose',
    hovered: options.retryHovered,
  });

  ctx.restore();
  return retryButton;
}
