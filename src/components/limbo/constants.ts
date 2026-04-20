// ─── World ────────────────────────────────────────────────────────────────────
export const world_bounds = { minX: -7.5, maxX: 7.5 }
export const move_speed   = 5.5
export const jump_force   = 8.2   // raised so character can reach boxes at y≈3
export const gravity      = 14
/** After hitting a selection / submit block from below — initial downward speed (softer = longer, smoother fall). */
export const HIT_DROP_VY  = -5
/** Gravity multiplier while `jump_locked` and falling — slightly extends the drop for a smoother arc. */
export const STUN_FALL_GRAVITY_MULT = 0.82

// ─── Gates ────────────────────────────────────────────────────────────────────
export const GATE_H       = 2.6   // opening height (floor top → top of gate, slightly > char ~1.9)
export const GATE_H_BASE  = 1.25  // gate base Y (top of floor platform)
export const GATE_HALF_W  = 0.72  // half-width of gate opening

// ─── Room ─────────────────────────────────────────────────────────────────────
export const ROOM_HALF_W  = 7.5   // half-width (matches world_bounds)
export const ROOM_HEIGHT  = 6.45  // ceiling height (shifted up by 1.25 + original 5.2)
export const WALL_T       = 0.38  // visual wall thickness in X

// ─── Selection boxes ──────────────────────────────────────────────────────────
// Boxes float in the centre; character must jump to hit them from below.
// Max jump head-height = (8.2² / (2×14)) + 1.88 + 1.25 ≈ 5.55 units — easily reaches BOX_Y bottom.
export const BOX_Y         = 4.25    // box centre Y (shifted up by 1.25 from floor platform top)
export const BOX_HALF_W    = 0.82   // half-width
export const BOX_HALF_H    = 0.28   // half-height
export const BOX_LEFT_X    = -1.2   // "Sign In"  — opens left gate
export const BOX_RIGHT_X   =  1.2   // "Sign Up"  — opens right gate
/** Depth (Z) of the main selection slab mesh — must match `Room.tsx`. */
export const BOX_D = 0.3
/** When a selection box is chosen, its group Y animates to `BOX_Y +` this (must match `Room.tsx`). */
export const BOX_SELECTED_FLOAT = 0.9

/** Feet → top of head for collision / underside hits (matches `Scene.tsx` head test). */
export const CHAR_FEET_TO_HEAD = 1.78

/** `SubmitButton` mesh `boxGeometry` size — single source for visuals + `Scene.tsx` underside hit. */
export const SUBMIT_SLAB_W = 1.8
export const SUBMIT_SLAB_H = 0.4
export const SUBMIT_SLAB_HALF_W = SUBMIT_SLAB_W / 2
export const SUBMIT_SLAB_HALF_H = SUBMIT_SLAB_H / 2

/** World X of side room centres — must match `Room.tsx` SideRoom `center_x`. */
export const SIDE_ROOM_CENTER_X_LEFT  = -ROOM_HALF_W * 2  // -15
export const SIDE_ROOM_CENTER_X_RIGHT =  ROOM_HALF_W * 2  // +15

/** Local Y offset of the form group root (matches Scene.tsx). */
export const FORM_GROUP_Y_SIGNIN = -0.8
export const FORM_GROUP_Y_SIGNUP = -1.2
/** Submit block is child at local [0, -0.8, 0] — mesh centre at local y=0 inside that child. */
export const FORM_SUBMIT_LOCAL_Y = -0.8

/**
 * When true: Drei OrbitControls + light helper + grid.
 * Set to false for the fixed side-view game camera.
 */
export const DEBUG_R3F_ORBIT = false
