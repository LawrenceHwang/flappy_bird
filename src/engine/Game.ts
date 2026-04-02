import { AudioManager } from '../audio/AudioManager';
import { INFINITE_DIFFICULTIES, getStoryLevelConfig } from '../modes/DifficultyConfig';
import { DifficultySelectScene } from '../scenes/DifficultySelectScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { GameScene } from '../scenes/GameScene';
import { LevelCompleteScene } from '../scenes/LevelCompleteScene';
import { MenuScene } from '../scenes/MenuScene';
import { SceneManager } from '../scenes/SceneManager';
import { ScoreManager } from '../storage/ScoreManager';
import { ASPECT_RATIO, GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import type { Difficulty, GameMode } from '../utils/types';
import { GameLoop } from './GameLoop';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';

/**
 * Main game orchestrator.
 * Owns the canvas, game loop, input, renderer, and scene manager.
 * Wires all scenes together via callbacks.
 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly loop: GameLoop;
  private readonly input: InputManager;
  private readonly scenes: SceneManager;
  private readonly audio: AudioManager;

  private currentMode: GameMode = 'story';
  private currentDifficulty: Difficulty = 'medium';
  private currentStoryLevel = 1;
  private audioInitialized = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.scenes = new SceneManager();
    this.audio = AudioManager.getInstance();
    this.input = new InputManager();

    this.loop = new GameLoop(
      (dt: number) => this.scenes.update(dt),
      () => {
        this.renderer.clear();
        this.scenes.render(this.renderer.ctx);
      },
    );

    this.setupInput();
    this.setupResize();
    this.resize();
  }

  /** Start the game — shows the main menu. */
  start(): void {
    this.showMenu();
    this.loop.start();
  }

  /** Clean up all resources. */
  destroy(): void {
    this.loop.destroy();
    this.input.destroy();
    window.removeEventListener('resize', this.resizeHandler);
  }

  // ── Input wiring ──────────────────────────────────────────────

  private setupInput(): void {
    this.input.onFlap(() => {
      this.ensureAudio();
      this.scenes.handleInput('flap');
    });
    this.input.onPause(() => {
      this.ensureAudio();
      this.scenes.handleInput('pause');
    });
    this.input.onConfirm(() => {
      this.ensureAudio();
      this.scenes.handleInput('confirm');
    });
  }

  /** Initialize audio on first user interaction (browser policy). */
  private ensureAudio(): void {
    if (!this.audioInitialized) {
      this.audioInitialized = true;
      this.audio.init();
    }
  }

  // ── Canvas resize ─────────────────────────────────────────────

  private readonly resizeHandler = () => this.resize();

  private setupResize(): void {
    window.addEventListener('resize', this.resizeHandler);
  }

  private resize(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const viewport = window.visualViewport;
    const maxW = Math.max(1, Math.floor(viewport?.width ?? container.clientWidth));
    const maxH = Math.max(1, Math.floor(viewport?.height ?? container.clientHeight));

    let w: number;
    let h: number;

    if (maxW / maxH > ASPECT_RATIO) {
      h = maxH;
      w = h * ASPECT_RATIO;
    } else {
      w = maxW;
      h = w / ASPECT_RATIO;
    }

    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(h)}px`;
    this.renderer.setupCanvas(GAME_WIDTH, GAME_HEIGHT);
  }

  // ── Scene navigation ─────────────────────────────────────────

  private showMenu(): void {
    const menu = new MenuScene(
      () => this.startStoryMode(),
      () => this.showDifficultySelect(),
    );
    this.scenes.switchTo(menu, 'fade');
  }

  private showDifficultySelect(): void {
    const select = new DifficultySelectScene(
      (difficulty) => this.startInfiniteMode(difficulty),
      () => this.showMenu(),
    );
    this.scenes.switchTo(select, 'fade');
  }

  private startStoryMode(): void {
    this.currentMode = 'story';
    this.currentStoryLevel = 1;
    this.playStoryLevel(this.currentStoryLevel);
  }

  private playStoryLevel(level: number): void {
    const config = getStoryLevelConfig(level);
    const scene = new GameScene(
      'story',
      config.difficulty,
      (score) => this.handleGameOver(score),
      (lvl, score) => this.handleLevelComplete(lvl, score),
      config,
      this.audio.birdSkin,
    );
    this.scenes.switchTo(scene, 'fade');
    // Await audio init before starting music so autoplay policy is respected
    void this.audio.init().then(() => this.audio.startMusic());
  }

  private startInfiniteMode(difficulty: Difficulty): void {
    this.currentMode = 'infinite';
    this.currentDifficulty = difficulty;
    const params = INFINITE_DIFFICULTIES[difficulty];
    const scene = new GameScene(
      'infinite',
      params,
      (score) => this.handleGameOver(score),
      undefined,
      undefined,
      this.audio.birdSkin,
    );
    this.scenes.switchTo(scene, 'fade');
    // Await audio init before starting music so autoplay policy is respected
    void this.audio.init().then(() => this.audio.startMusic());
  }

  private handleGameOver(score: number): void {
    this.audio.stopMusic();
    this.audio.playGameOver();

    const isHighScore = ScoreManager.saveScore(
      score,
      this.currentMode,
      this.currentMode === 'infinite' ? this.currentDifficulty : undefined,
      this.currentMode === 'story' ? this.currentStoryLevel : undefined,
    );

    const scene = new GameOverScene(
      score,
      isHighScore,
      this.currentMode,
      () => this.retry(),
      () => this.showMenu(),
      this.currentMode === 'infinite' ? this.currentDifficulty : undefined,
      this.currentMode === 'story' ? this.currentStoryLevel : undefined,
    );
    this.scenes.switchTo(scene, 'fade');
  }

  private handleLevelComplete(level: number, score: number): void {
    this.audio.playLevelComplete();

    ScoreManager.saveScore(score, 'story', undefined, level);

    const scene = new LevelCompleteScene(
      level,
      score,
      () => {
        this.currentStoryLevel = level + 1;
        if (this.currentStoryLevel <= 20) {
          this.playStoryLevel(this.currentStoryLevel);
        } else {
          this.showMenu();
        }
      },
      () => this.showMenu(),
    );
    this.scenes.switchTo(scene, 'fade');
  }

  private retry(): void {
    if (this.currentMode === 'story') {
      this.playStoryLevel(this.currentStoryLevel);
    } else {
      this.startInfiniteMode(this.currentDifficulty);
    }
  }
}
