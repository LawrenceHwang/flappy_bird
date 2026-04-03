import { AudioManager } from '../audio/AudioManager';
import { drawButton, drawGlassPanel, drawIconToggle, drawSceneTitle } from '../graphics/ui-kit';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PauseButtons {
  resume: ButtonRect;
  quit: ButtonRect;
  sound: ButtonRect;
}

function pointInRect(px: number, py: number, r: ButtonRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function getPauseButtons(): PauseButtons {
  const btnW = 212;
  const btnH = 52;
  const cx = GAME_WIDTH / 2 - btnW / 2;
  const cy = GAME_HEIGHT / 2 - 6;

  return {
    resume: { x: cx, y: cy - 10, w: btnW, h: btnH },
    quit: { x: cx, y: cy + 56, w: btnW, h: btnH },
    sound: { x: GAME_WIDTH / 2 - 34, y: cy + 130, w: 68, h: 40 },
  };
}

export function renderPauseOverlay(
  ctx: CanvasRenderingContext2D,
  selectedIndex: number,
  mousePos: { x: number; y: number },
): void {
  const buttons = getPauseButtons();
  const soundEnabled = !AudioManager.getInstance().muted;
  const panel = { x: GAME_WIDTH / 2 - 170, y: GAME_HEIGHT / 2 - 138, w: 340, h: 288 };

  ctx.fillStyle = 'rgba(5, 8, 20, 0.66)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawGlassPanel(ctx, panel, {
    accent: soundEnabled ? 'rgba(106, 208, 255, 0.14)' : 'rgba(199, 208, 224, 0.1)',
  });
  drawSceneTitle(ctx, {
    x: GAME_WIDTH / 2,
    y: panel.y + 58,
    eyebrow: 'RUN HALTED',
    title: 'Paused',
    width: 240,
  });

  drawButton(ctx, buttons.resume, {
    label: 'Resume',
    tone: 'emerald',
    hovered: pointInRect(mousePos.x, mousePos.y, buttons.resume),
    selected: selectedIndex === 0,
  });

  drawButton(ctx, buttons.quit, {
    label: 'Quit to Menu',
    tone: 'slate',
    hovered: pointInRect(mousePos.x, mousePos.y, buttons.quit),
    selected: selectedIndex === 1,
  });

  drawIconToggle(ctx, buttons.sound, {
    label: soundEnabled ? 'SFX' : 'OFF',
    tone: soundEnabled ? 'cyan' : 'slate',
    hovered: pointInRect(mousePos.x, mousePos.y, buttons.sound),
    selected: selectedIndex === 2,
  });

  ctx.fillStyle = 'rgba(255, 239, 214, 0.58)';
  ctx.font = '600 10px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Toggle sound', GAME_WIDTH / 2, buttons.sound.y + buttons.sound.h + 18);
}
