import './styles/main.css';
import { Game } from './engine/Game';
import { artAssets } from './graphics/assets';
import { drawLoadingSplash, drawStartupErrorSplash, type Rect } from './graphics/ui-kit';
import { GAME_HEIGHT, GAME_WIDTH } from './utils/constants';

type StartupState = 'loading' | 'error' | 'running';

const RETRY_KEY = 'KeyR';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

const game = new Game(canvas);

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Failed to get 2D rendering context');
}
const renderingContext = ctx;

let startupState: StartupState = 'loading';
let bootPromise: Promise<void> | null = null;
let gameStarted = false;
let retryHovered = false;
let retryButtonRect: Rect | null = null;
let lastStartupError = 'Unknown art preload error';

function redrawStartupSplash(): void {
  if (gameStarted || startupState === 'running') {
    return;
  }

  if (startupState === 'error') {
    retryButtonRect = drawStartupErrorSplash(renderingContext, {
      errorMessage: lastStartupError,
      retryHovered,
    });
    return;
  }

  retryButtonRect = null;
  drawLoadingSplash(renderingContext);
}

function getCanvasPoint(event: MouseEvent | PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * GAME_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * GAME_HEIGHT,
  };
}

function isPointInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function updateRetryHover(nextHovered: boolean): void {
  if (retryHovered === nextHovered) {
    return;
  }

  retryHovered = nextHovered;
  canvas.style.cursor = retryHovered ? 'pointer' : '';
  redrawStartupSplash();
}

function handleRetryPointerMove(event: PointerEvent): void {
  if (startupState !== 'error' || bootPromise || !retryButtonRect) {
    return;
  }

  updateRetryHover(isPointInRect(getCanvasPoint(event), retryButtonRect));
}

function handleRetryPointerLeave(): void {
  if (startupState !== 'error') {
    return;
  }

  updateRetryHover(false);
}

function handleRetryClick(event: MouseEvent): void {
  if (startupState !== 'error' || bootPromise || !retryButtonRect) {
    return;
  }

  if (!isPointInRect(getCanvasPoint(event), retryButtonRect)) {
    return;
  }

  event.preventDefault();
  void startBoot();
}

function handleRetryKeyDown(event: KeyboardEvent): void {
  if (startupState !== 'error' || bootPromise || event.repeat || event.code !== RETRY_KEY) {
    return;
  }

  event.preventDefault();
  void startBoot();
}

function handleStartupResize(): void {
  redrawStartupSplash();
}

async function startBoot(): Promise<void> {
  if (gameStarted) {
    return;
  }

  if (bootPromise) {
    return bootPromise;
  }

  startupState = 'loading';
  retryHovered = false;
  retryButtonRect = null;
  canvas.style.cursor = '';
  redrawStartupSplash();

  bootPromise = artAssets
    .preload()
    .then(() => {
      if (gameStarted) {
        return;
      }

      startupState = 'running';
      gameStarted = true;
      game.start();
    })
    .catch((error: unknown) => {
      const preloadError = error instanceof Error ? error : new Error('Unknown art preload error');
      console.error('Failed to preload premium art assets.', preloadError);
      startupState = 'error';
      lastStartupError = preloadError.message;
      redrawStartupSplash();
    })
    .finally(() => {
      bootPromise = null;
    });

  return bootPromise;
}

canvas.addEventListener('pointermove', handleRetryPointerMove);
canvas.addEventListener('pointerleave', handleRetryPointerLeave);
canvas.addEventListener('click', handleRetryClick);
window.addEventListener('keydown', handleRetryKeyDown);
window.addEventListener('resize', handleStartupResize);

void startBoot();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  canvas.removeEventListener('pointermove', handleRetryPointerMove);
  canvas.removeEventListener('pointerleave', handleRetryPointerLeave);
  canvas.removeEventListener('click', handleRetryClick);
  window.removeEventListener('keydown', handleRetryKeyDown);
  window.removeEventListener('resize', handleStartupResize);
  game.destroy();
});
