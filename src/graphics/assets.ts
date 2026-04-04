import birdBeeDownUrl from '../assets/art/birds/bird-bee-down.svg';
import birdBeeMidUrl from '../assets/art/birds/bird-bee-mid.svg';
import birdBeeUpUrl from '../assets/art/birds/bird-bee-up.svg';
import birdClassicDownUrl from '../assets/art/birds/bird-classic-down.svg';
import birdClassicMidUrl from '../assets/art/birds/bird-classic-mid.svg';
import birdClassicUpUrl from '../assets/art/birds/bird-classic-up.svg';
import rewardMultiplierUrl from '../assets/art/rewards/reward-multiplier.svg';
import rewardShieldUrl from '../assets/art/rewards/reward-shield.svg';
import rewardShrinkUrl from '../assets/art/rewards/reward-shrink.svg';
import rewardSlowmoUrl from '../assets/art/rewards/reward-slowmo.svg';
import pipeBodyUrl from '../assets/art/world/pipe-body.svg';
import pipeCapUrl from '../assets/art/world/pipe-cap.svg';
import worldFarUrl from '../assets/art/world/world-far-cliffs.svg';
import worldFrontUrl from '../assets/art/world/world-front-garden.svg';
import worldGroundUrl from '../assets/art/world/world-ground-tile.svg';
import worldMidUrl from '../assets/art/world/world-mid-forest.svg';
import type { BirdSkin, RewardType } from '../utils/types';

const ASSET_URLS = {
  birdClassicUp: birdClassicUpUrl,
  birdClassicMid: birdClassicMidUrl,
  birdClassicDown: birdClassicDownUrl,
  birdBeeUp: birdBeeUpUrl,
  birdBeeMid: birdBeeMidUrl,
  birdBeeDown: birdBeeDownUrl,
  pipeBody: pipeBodyUrl,
  pipeCap: pipeCapUrl,
  rewardMultiplier: rewardMultiplierUrl,
  rewardShield: rewardShieldUrl,
  rewardSlowmo: rewardSlowmoUrl,
  rewardShrink: rewardShrinkUrl,
  worldFar: worldFarUrl,
  worldMid: worldMidUrl,
  worldFront: worldFrontUrl,
  worldGround: worldGroundUrl,
} as const;

export type AssetKey = keyof typeof ASSET_URLS;

const BIRD_FRAME_KEYS = {
  default: {
    up: 'birdClassicUp',
    mid: 'birdClassicMid',
    down: 'birdClassicDown',
  },
  bee: {
    up: 'birdBeeUp',
    mid: 'birdBeeMid',
    down: 'birdBeeDown',
  },
} as const satisfies Record<BirdSkin, Record<'up' | 'mid' | 'down', AssetKey>>;

const REWARD_KEYS = {
  multiplier: 'rewardMultiplier',
  shield: 'rewardShield',
  slowmo: 'rewardSlowmo',
  shrink: 'rewardShrink',
} as const satisfies Record<RewardType, AssetKey>;

export class ArtAssets {
  private readonly images = new Map<AssetKey, HTMLImageElement>();
  private preloadPromise: Promise<void> | null = null;

  preload(): Promise<void> {
    if (!this.preloadPromise) {
      const entries = Object.entries(ASSET_URLS) as Array<[AssetKey, string]>;
      const attempt = Promise.all(entries.map(([key, url]) => this.loadImage(key, url))).then(
        () => undefined,
      );
      this.preloadPromise = attempt;
      attempt.catch(() => {
        if (this.preloadPromise === attempt) {
          this.preloadPromise = null;
        }
      });
    }

    return this.preloadPromise;
  }

  get(key: AssetKey): HTMLImageElement {
    const image = this.images.get(key);
    if (!image) {
      throw new Error(`Art asset "${key}" was requested before preload completed`);
    }
    return image;
  }

  getBirdFrame(skin: BirdSkin, wingAngle: number): HTMLImageElement {
    const frame =
      wingAngle < -0.18 ? BIRD_FRAME_KEYS[skin].up
      : wingAngle > 0.18 ? BIRD_FRAME_KEYS[skin].down
      : BIRD_FRAME_KEYS[skin].mid;
    return this.get(frame);
  }

  getRewardIcon(type: RewardType): HTMLImageElement {
    return this.get(REWARD_KEYS[type]);
  }

  private loadImage(key: AssetKey, url: string): Promise<void> {
    if (this.images.has(key)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.images.set(key, image);
        resolve();
      };
      image.onerror = () => reject(new Error(`Failed to load art asset: ${key}`));
      image.src = url;
    });
  }
}

export const artAssets = new ArtAssets();
