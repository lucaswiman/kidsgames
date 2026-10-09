// Shared sizes and tuning numbers. All distances are in pixels, times in seconds.

export const TILE = 48;

// Logical game size (4:3 like an iPad held sideways). Phaser scales it to fit.
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

// Radius of each end of the slime.
export const END_RADIUS = 14;

// How far one end of the slime can stretch away from the other end.
export const MAX_STRETCH = 210;

// The stretchy body may wrap around a corner, as long as no more than this
// much of the straight line between the ends goes through a wall.
export const CORNER_WRAP = 40;

// When you let go, the end looks this far for a wall to stick to.
export const STICK_SEARCH = 34;

// How quickly the held end chases your finger (bigger = snappier).
export const FOLLOW_RATE = 22;

// How fast a missed stretch boings back to the stuck end.
export const SNAP_SPEED = 1400;

export const GRAVITY = 1500;
export const MAX_FALL_SPEED = 1100;

// Radius used to pick up tokens, power cores and bombs.
export const ITEM_RADIUS = 16;

// A quick finger flick faster than this throws a held bomb.
export const FLICK_SPEED = 550;
export const MAX_THROW_SPEED = 1300;
