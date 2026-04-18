import { useFrame, useThree } from '@react-three/fiber'
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
  ROOM_HEIGHT,
  world_bounds,
} from './constants'

import { SceneDebugControls } from './SceneDebugControls'
import { useKeyboardState } from './useKeyboardState'

// Must match the fov prop on <Canvas> in LimboScene.tsx.
const GAME_FOV_RAD = (65 * Math.PI) / 180

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

  // Debounce ref: tracks the last Y velocity when a box was hit to prevent
  // multiple hits during the same jump arc (while velocity is still positive).
  const last_hit_velocity_y = useRef(0)

  // Dynamic X-bounds: when a side is selected, allow access to that side room.
  // Always reset both bounds initially, then open the selected side.
  const effective_bounds = useRef({ ...world_bounds })
  useEffect(() => {
    // Reset to lobby bounds first
    effective_bounds.current = { ...world_bounds }
    
    // Then open the selected side to include the side room
    if (selected_side === 'left') {
      effective_bounds.current.minX = -(ROOM_HALF_W * 3 - 0.4)  // Left side room
    } else if (selected_side === 'right') {
      effective_bounds.current.maxX = (ROOM_HALF_W * 3 - 0.4)   // Right side room
    }
  }, [selected_side])

  // ── Responsive camera Z + room height ───────────────────────────────────────
  // Camera Z is solved so the full room width fits the horizontal frustum.
  // Room height equals the FULL visible vertical frustum height at that Z so
  // floor sits at the screen bottom and ceiling at the top — no sky visible.
  // Camera is centered on the room midpoint so the view matches exactly.
  const { size, camera } = useThree()
  const camera_z_ref   = useRef(12)
  const camera_y_ref   = useRef(ROOM_HEIGHT / 2)   // updated on every resize
  const [room_height, set_room_height] = useState(ROOM_HEIGHT)

  useEffect(() => {
    const aspect       = size.width / size.height
    const half_tan     = Math.tan(GAME_FOV_RAD / 2)

    // Z needed to show full room width (+ 1 u padding per side).
    const target_width = ROOM_HALF_W * 2 + 2
    const needed_z     = target_width / (2 * half_tan * aspect)
    camera_z_ref.current = MathUtils.clamp(needed_z, 7, 28)

    // Room height = exact visible height at this Z → fills screen top to bottom.
    const visible_h    = 2 * camera_z_ref.current * half_tan - 0.2
    const new_height   = Math.max(visible_h, ROOM_HEIGHT)
    camera_y_ref.current = new_height / 2   // camera centred on room mid-point

    camera.position.z = camera_z_ref.current
    camera.position.y = camera_y_ref.current

    set_room_height(new_height)
  }, [size, camera])

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
    // Allow switching between bricks any time. Debounce by velocity to prevent
    // multiple hits during the same jump arc.
    const curr_vy = velocity_ref.current.y
    if (curr_vy > 0.5 && curr_vy !== last_hit_velocity_y.current) {
      const head_y = char_pos.y + 1.88   // approximate top of character
      const in_y   = head_y >= BOX_Y - BOX_HALF_H - 0.05 && head_y <= BOX_Y + BOX_HALF_H + 0.65

      if (in_y) {
        let new_selection: SelectedSide = null
        
        if (Math.abs(char_pos.x - BOX_LEFT_X) < BOX_HALF_W + 0.32) {
          new_selection = 'left'
        } else if (Math.abs(char_pos.x - BOX_RIGHT_X) < BOX_HALF_W + 0.32) {
          new_selection = 'right'
        }
        
        if (new_selection) {
          last_hit_velocity_y.current = curr_vy  // Record this velocity to prevent repeat hits
          set_selected_side(new_selection)
        }
      }
    }

    // Reset velocity debounce when character lands (new jump possible)
    if (char_pos.y <= 0.001) {
      last_hit_velocity_y.current = 0
    }

    if (character_group_ref.current) {
      character_group_ref.current.position.set(char_pos.x, char_pos.y, 0)
    }

    // ── Camera ─────────────────────────────────────────────────────────────
    // X follow: gentle 22 % drift in the lobby so both walls stay on-screen.
    //           Once the character enters a side room (|x| > ROOM_HALF_W) switch
    //           to 80 % follow so the camera properly tracks into the new room.
    // Y / Z: from resize effect — perfectly centred and sized to the viewport.
    if (!DEBUG_R3F_ORBIT) {
      const in_lobby     = Math.abs(char_pos.x) <= ROOM_HALF_W
      const follow_pct   = in_lobby ? 0.22 : 0.80
      // Never pan past the outer side-room walls (3×RHW) minus a small margin.
      const max_cam_x    = ROOM_HALF_W * 3 - 2.5
      const target_cam_x = MathUtils.clamp(char_pos.x * follow_pct, -max_cam_x, max_cam_x)
      state.camera.position.x = MathUtils.damp(state.camera.position.x, target_cam_x, 5, delta)
      state.camera.position.y = camera_y_ref.current
      state.camera.position.z = camera_z_ref.current
      state.camera.up.set(0, 1, 0)
      state.camera.lookAt(state.camera.position.x, camera_y_ref.current, 0)
    }
  })

  return (
    <>
      <Atmosphere dirLightRef={dir_light_ref} />
      <Room selected_side={selected_side} room_height={room_height} />
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
