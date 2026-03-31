import { COLORS } from '../utils/colors';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants';
import { AudioManager } from '../audio/AudioManager';

/** Simple axis-aligned rectangle for hit-testing. */
interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Button rectangles returned by the pause overlay for hit-testing. */
export interface PauseButtons {
  resume: ButtonRect;
  quit: ButtonRect;
  sound: ButtonRect;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function roundedRectPath(
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

function pointInRect(px: number, py: number, r: ButtonRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Get the button rectangles used by the pause overlay. */
export function getPauseButtons(): PauseButtons {
  const btnW = 200;
  const btnH = 50;
  const cx = GAME_WIDTH / 2 - btnW / 2;
  const cy = GAME_HEIGHT / 2;

  return {
    resume: { x: cx, y: cy - 10, w: btnW, h: btnH },
    quit: { x: cx, y: cy + 55, w: btnW, h: btnH },
    sound: { x: GAME_WIDTH / 2 - 25, y: cy + 125, w: 50, h: 50 },
  };
}

/**
 * Draw the pause overlay on top of the current game frame.
 *
 * @param ctx           - Canvas 2D context.
 * @param selectedIndex - Keyboard-selected button index (0 = resume, 1 = quit, 2 = sound).
 * @param mousePos      - Current mouse position in canvas coordinates.
 */
export function renderPauseOverlay(
  ctx: CanvasRenderingContext2D,
  selectedIndex: number,
  mousePos: { x: number; y: number },
): void {
  const buttons = getPauseButtons();
  const soundEnabled = !AudioManager.getInstance().muted;

  // Semi-transparent backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Title
  ctx.save();
  ctx.fillStyle = COLORS.ui.text;
  ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillText('Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);
  ctx.restore();

  // Action buttons
  const btnDefs: Array<{
    rect: ButtonRect;
    label: string;
    colors: [string, string];
  }> = [
    { rect: buttons.resume, label: 'Resume', colors: ['#6C5CE7', '#A29BFE'] },
    { rect: buttons.quit, label: 'Quit to Menu', colors: ['#636E72', '#B2BEC3'] },
  ];

  btnDefs.forEach((btn, i) => {
    const hovered = pointInRect(mousePos.x, mousePos.y, btn.rect);
    const highlight = hovered || selectedIndex === i;

    ctx.save();
    if (highlight) {
      ctx.shadowColor = btn.colors[0];
      ctx.shadowBlur = 15;
    }

    const grad = ctx.createLinearGradient(
      btn.rect.x,
      btn.rect.y,
      btn.rect.x + btn.rect.w,
      btn.rect.y + btn.rect.h,
    );
    grad.addColorStop(0, highlight ? btn.colors[1] : btn.colors[0]);
    grad.addColorStop(1, highlight ? btn.colors[0] : btn.colors[1]);

    roundedRectPath(ctx, btn.rect.x, btn.rect.y, btn.rect.w, btn.rect.h, 12);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.ui.text;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.rect.x + btn.rect.w / 2, btn.rect.y + btn.rect.h / 2);
    ctx.restore();
  });

  // Sound toggle
  const sBtn = buttons.sound;
  const soundHovered = pointInRect(mousePos.x, mousePos.y, sBtn);
  const soundSelected = soundHovered || selectedIndex === 2;

  ctx.save();
  if (soundSelected) {
    ctx.shadowColor = COLORS.ui.accent;
    ctx.shadowBlur = 10;
  }

  roundedRectPath(ctx, sBtn.x, sBtn.y, sBtn.w, sBtn.h, 25);
  ctx.fillStyle = soundEnabled ? COLORS.ui.accent : '#636E72';
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.ui.text;
  ctx.font = '24px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    soundEnabled ? '🔊' : '🔇',
    sBtn.x + sBtn.w / 2,
    sBtn.y + sBtn.h / 2,
  );
  ctx.restore();
}
