import {
  GRAVITY,
  FLAP_VELOCITY,
  TERMINAL_VELOCITY,
  MAX_BIRD_UP_ROTATION,
  MAX_BIRD_DOWN_ROTATION,
} from '../utils/constants';

/**
 * Apply gravitational acceleration to a vertical velocity.
 * @param velocity Current vertical velocity (px/frame-unit).
 * @param gravity  Gravitational constant (defaults to {@link GRAVITY}).
 * @param dt       Delta time multiplier.
 * @returns Updated velocity after gravity is applied.
 */
export function applyGravity(
  velocity: number,
  gravity: number = GRAVITY,
  dt: number = 1,
): number {
  return velocity + gravity * dt;
}

/**
 * Return the impulse velocity used when the bird flaps.
 * @param flapVelocity Override for the flap constant (defaults to {@link FLAP_VELOCITY}).
 * @returns The (negative) flap velocity.
 */
export function applyFlap(flapVelocity: number = FLAP_VELOCITY): number {
  return flapVelocity;
}

/**
 * Clamp a velocity so it stays within [-terminal, +terminal].
 * @param velocity Current velocity.
 * @param terminal Maximum absolute speed (defaults to {@link TERMINAL_VELOCITY}).
 * @returns Clamped velocity.
 */
export function clampVelocity(
  velocity: number,
  terminal: number = TERMINAL_VELOCITY,
): number {
  return Math.max(-terminal, Math.min(terminal, velocity));
}

/**
 * Move a position by the given velocity scaled by delta time.
 * @param position Current position.
 * @param velocity Current velocity.
 * @param dt       Delta time multiplier.
 * @returns New position.
 */
export function updatePosition(
  position: number,
  velocity: number,
  dt: number = 1,
): number {
  return position + velocity * dt;
}

/**
 * Axis-Aligned Bounding Box overlap test.
 * @returns `true` when the two rectangles overlap.
 */
export function checkAABBCollision(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Map a vertical velocity to a bird rotation angle (radians).
 *
 * Negative velocity (going up) maps towards {@link maxUp},
 * positive velocity (falling) maps towards {@link maxDown}.
 *
 * @param velocity Current vertical velocity.
 * @param maxUp    Maximum upward rotation in radians (defaults to {@link MAX_BIRD_UP_ROTATION}).
 * @param maxDown  Maximum downward rotation in radians (defaults to {@link MAX_BIRD_DOWN_ROTATION}).
 * @returns Rotation angle in radians.
 */
export function getBirdRotation(
  velocity: number,
  maxUp: number = MAX_BIRD_UP_ROTATION,
  maxDown: number = MAX_BIRD_DOWN_ROTATION,
): number {
  if (velocity <= 0) {
    // Going up – interpolate between 0 and maxUp based on how fast we rise
    const t = Math.min(Math.abs(velocity) / TERMINAL_VELOCITY, 1);
    return maxUp * t;
  }
  // Falling – interpolate between 0 and maxDown
  const t = Math.min(velocity / TERMINAL_VELOCITY, 1);
  return maxDown * t;
}
