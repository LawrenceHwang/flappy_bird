import { Reward } from './Reward';
import { REWARD_SPAWN_CHANCE } from '../utils/constants';
import { aabbOverlap, randomPick } from '../utils/math';
import type { AABB, RewardType } from '../utils/types';

/** All possible reward types for random selection. */
const REWARD_TYPES: readonly RewardType[] = [
  'multiplier',
  'shield',
  'slowmo',
  'shrink',
] as const;

/**
 * Spawns, updates, and collision-checks reward pickups.
 *
 * At most one reward is active at a time to keep gameplay clear.
 */
export class RewardManager {
  private rewards: Reward[] = [];

  /**
   * Possibly spawn a reward in a pipe gap.
   *
   * Called once per newly scored pipe. Rolls against
   * {@link REWARD_SPAWN_CHANCE} and enforces the single-active constraint.
   *
   * @param pipeX - Horizontal centre of the pipe gap.
   * @param gapY - Vertical centre of the gap.
   * @param gapSize - Height of the gap (used to centre the pickup).
   */
  trySpawn(pipeX: number, gapY: number, _gapSize: number): void {
    if (this.rewards.length > 0) return;
    if (Math.random() > REWARD_SPAWN_CHANCE) return;

    const type = randomPick(REWARD_TYPES);
    const reward = new Reward(pipeX, gapY - 15, type);
    this.rewards.push(reward);
  }

  /**
   * Move all active rewards and cull off-screen ones.
   * @param dt - Frame delta in seconds.
   * @param scrollSpeed - Horizontal scroll px/frame-at-60fps.
   */
  update(dt: number, scrollSpeed: number): void {
    for (let i = this.rewards.length - 1; i >= 0; i--) {
      const reward = this.rewards[i];
      reward.update(dt, scrollSpeed);

      if (reward.isOffScreen() || reward.collected) {
        this.rewards.splice(i, 1);
      }
    }
  }

  /** Render every visible reward. */
  render(ctx: CanvasRenderingContext2D): void {
    for (const reward of this.rewards) {
      reward.render(ctx);
    }
  }

  /**
   * Test whether the bird overlaps any uncollected reward.
   *
   * @param birdHitbox - The bird's current AABB.
   * @returns The collected {@link RewardType}, or `null` if nothing was hit.
   */
  checkCollision(birdHitbox: AABB): RewardType | null {
    for (const reward of this.rewards) {
      if (reward.collected) continue;

      const rbox = reward.getHitbox();
      if (
        aabbOverlap(
          birdHitbox.x, birdHitbox.y, birdHitbox.width, birdHitbox.height,
          rbox.x, rbox.y, rbox.width, rbox.height,
        )
      ) {
        reward.collected = true;
        return reward.type;
      }
    }
    return null;
  }

  /** Remove all rewards. */
  reset(): void {
    this.rewards.length = 0;
  }
}
