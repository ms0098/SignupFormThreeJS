import { useFrame } from '@react-three/fiber'
import type * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { DirectionalLight } from 'three'
import { Group, MathUtils, Vector3 } from 'three'
import { Atmosphere } from './Atmosphere'
import { DemonBoy } from './Demon_boy'
import type { SelectedSide } from './Room'
import { Room } from './Room'
import {
  BOX_HALF_H,
  BOX_HALF_W,
  BOX_LEFT_X,
  BOX_RIGHT_X,
  BOX_Y,
  DEBUG_R3F_ORBIT,
  gravity,
  jump_force,
  move_speed,
  ROOM_HALF_W,
  world_bounds,
} from './constants'
import { SceneDebugControls } from './SceneDebugControls'
import { useKeyboardState } from './useKeyboardState'

export const Scene: React.FC = () => {
  const keys_ref            = useKeyboardState()
  const character_group_ref = useRef<Group>(null)
  const dir_light_ref       = useRef<DirectionalLight>(null)
  const velocity_ref        = useRef({ x: 0, y: 0 })
  const velocity_x_ref      = useRef(0)
  const character_position_ref = useRef(new Vector3(0, 0, 0))
  const is_crouching_ref    = useRef(false)  // no crouch in this level — always false

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selected_side, set_selected_side] = useState<SelectedSide>(null)

  // Guard ref: set to true on first box hit so useFrame never fires twice.
  // Using a plain ref avoids writing to ref during render.
  const has_selected_ref = useRef(false)

  // Dynamic X-bounds: extend the open side so the character can exit.
  const effective_bounds = useRef({ ...world_bounds })
  useEffect(() => {
    if (selected_side === 'left')  effective_bounds.current.minX = -120
    if (selected_side === 'right') effective_bounds.current.maxX =  120
  }, [selected_side])

  useFrame((state, delta) => {
    const is_left  = keys_ref.current.ArrowLeft
    const is_right = keys_ref.current.ArrowRight
    const is_up    = keys_ref.current.ArrowUp

    // ── Horizontal movement ────────────────────────────────────────────────
    const target_vx = ((is_right ? 1 : 0) - (is_left ? 1 : 0)) * move_speed
    velocity_ref.current.x = MathUtils.damp(velocity_ref.current.x, target_vx, 10, delta)
    velocity_x_ref.current = velocity_ref.current.x

    const char_pos  = character_position_ref.current
    const is_grounded = char_pos.y <= 0.001

    // ── Jump ──────────────────────────────────────────────────────────────
    if (is_up && is_grounded) velocity_ref.current.y = jump_force
    velocity_ref.current.y -= gravity * delta

    // ── Apply velocities ───────────────────────────────────────────────────
    char_pos.x += velocity_ref.current.x * delta
    char_pos.y += velocity_ref.current.y * delta

    // Clamp X to dynamic bounds (opened side is unrestricted).
    char_pos.x = MathUtils.clamp(char_pos.x, effective_bounds.current.minX, effective_bounds.current.maxX)

    // Land on floor.
    if (char_pos.y < 0) {
      char_pos.y = 0
      velocity_ref.current.y = 0
    }

    // ── Selection-box hit detection ────────────────────────────────────────
    // Trigger once when the character's head clips the box while rising.
    if (!has_selected_ref.current && velocity_ref.current.y > 0.5) {
      const head_y = char_pos.y + 1.88   // approximate top of character
      const in_y   = head_y >= BOX_Y - BOX_HALF_H - 0.05 && head_y <= BOX_Y + BOX_HALF_H + 0.65

      if (in_y) {
        if (Math.abs(char_pos.x - BOX_LEFT_X) < BOX_HALF_W + 0.32) {
          has_selected_ref.current = true
          set_selected_side('left')
        } else if (Math.abs(char_pos.x - BOX_RIGHT_X) < BOX_HALF_W + 0.32) {
          has_selected_ref.current = true
          set_selected_side('right')
        }
      }
    }

    if (character_group_ref.current) {
      character_group_ref.current.position.set(char_pos.x, char_pos.y, 0)
    }

    // ── Camera ─────────────────────────────────────────────────────────────
    // Subtle follow: camera drifts at 20 % of character X so walls stay visible,
    // clamped so camera never gets closer than 2.5 u from the wall.
    if (!DEBUG_R3F_ORBIT) {
      const max_drift   = ROOM_HALF_W - 2.5
      const target_cam_x = MathUtils.clamp(char_pos.x * 0.22, -max_drift, max_drift)
      state.camera.position.x = MathUtils.damp(state.camera.position.x, target_cam_x, 5, delta)
      state.camera.position.y = 2.2
      state.camera.position.z = 12
      state.camera.up.set(0, 1, 0)
      state.camera.lookAt(state.camera.position.x, 1.8, 0)
    }
  })

  return (
    <>
      <Atmosphere dirLightRef={dir_light_ref} />
      <Room selected_side={selected_side} />
      <SceneDebugControls enabled={DEBUG_R3F_ORBIT} dirLightRef={dir_light_ref} />
      <group ref={character_group_ref}>
        <DemonBoy
          position={new Vector3(0, 0, 0)}
          is_crouching_ref={is_crouching_ref}
          velocity_x_ref={velocity_x_ref}
          modelScale={1}
          groundOffsetY={0}
          walkBobIntensity={0.025}
          crouchScaleY={0.78}
          silhouetteColor="#0d0e10"
        />
      </group>
    </>
  )
}
