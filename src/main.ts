import './styles/main.css';
import { Game } from './engine/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

const game = new Game(canvas);
game.start();

// Clean up on page unload
window.addEventListener('beforeunload', () => game.destroy());

