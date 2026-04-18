// ─── World ────────────────────────────────────────────────────────────────────
export const world_bounds = { minX: -7.5, maxX: 7.5 }
export const move_speed   = 5.5
export const jump_force   = 8.2   // raised so character can reach boxes at y≈3
export const gravity      = 14

// ─── Room ─────────────────────────────────────────────────────────────────────
export const ROOM_HALF_W  = 7.5   // half-width (matches world_bounds)
export const ROOM_HEIGHT  = 5.2   // ceiling height
export const WALL_T       = 0.38  // visual wall thickness in X

// ─── Gates ────────────────────────────────────────────────────────────────────
export const GATE_H       = 2.6   // opening height (floor → top of gate, slightly > char ~1.9)
export const GATE_HALF_W  = 0.72  // half-width of gate opening

// ─── Selection boxes ──────────────────────────────────────────────────────────
// Boxes float in the centre; character must jump to hit them from below.
// Max jump head-height = (8.2² / (2×14)) + 1.88 ≈ 4.3 units — easily reaches BOX_Y bottom.
export const BOX_Y         = 3.0    // box centre Y
export const BOX_HALF_W    = 0.82   // half-width
export const BOX_HALF_H    = 0.28   // half-height
export const BOX_LEFT_X    = -1.2   // "Sign In"  — opens left gate
export const BOX_RIGHT_X   =  1.2   // "Sign Up"  — opens right gate

/**
 * When true: Drei OrbitControls + light helper + grid.
 * Set to false for the fixed side-view game camera.
 */
export const DEBUG_R3F_ORBIT = false
