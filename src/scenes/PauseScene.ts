import { AudioManager } from '../audio/AudioManager';
import { drawButton, drawGlassPanel, drawSceneTitle } from '../graphics/ui-kit';
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

const PAUSE_PANEL = { x: GAME_WIDTH / 2 - 170, y: GAME_HEIGHT / 2 - 136, w: 340, h: 276 };

function pointInRect(px: number, py: number, r: ButtonRect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function getPauseButtons(): PauseButtons {
  const btnW = 212;
  const btnH = 52;
  const cx = GAME_WIDTH / 2 - btnW / 2;

  return {
    resume: { x: cx, y: PAUSE_PANEL.y + 82, w: btnW, h: btnH },
    quit: { x: cx, y: PAUSE_PANEL.y + 148, w: btnW, h: btnH },
    sound: { x: GAME_WIDTH / 2 - 78, y: PAUSE_PANEL.y + 214, w: 156, h: 42 },
  };
}

export function renderPauseOverlay(
  ctx: CanvasRenderingContext2D,
  selectedIndex: number,
  mousePos: { x: number; y: number },
): void {
  const buttons = getPauseButtons();
  const soundEnabled = !AudioManager.getInstance().muted;

  ctx.fillStyle = 'rgba(5, 8, 20, 0.66)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawGlassPanel(ctx, PAUSE_PANEL, {
    accent: soundEnabled ? 'rgba(106, 208, 255, 0.14)' : 'rgba(199, 208, 224, 0.1)',
  });
  drawSceneTitle(ctx, {
    x: GAME_WIDTH / 2,
    y: PAUSE_PANEL.y + 48,
    title: 'Paused',
    width: 220,
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

  drawButton(ctx, buttons.sound, {
    label: soundEnabled ? 'Sound On' : 'Sound Off',
    tone: soundEnabled ? 'cyan' : 'slate',
    hovered: pointInRect(mousePos.x, mousePos.y, buttons.sound),
    selected: selectedIndex === 2,
    compact: true,
    radius: 16,
  });
}
