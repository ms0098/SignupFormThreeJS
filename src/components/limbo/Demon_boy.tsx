import { useFrame, useThree } from '@react-three/fiber'
import type * as React from 'react'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Group, MathUtils, MeshStandardMaterial, Quaternion } from 'three'
import type { Vector3 as Vector3Type } from 'three'
import { move_speed as move_speed_max } from './constants'
import type { KeyState } from './types'

/** True if any walk/jump movement key is down (same source as Scene physics). */
function is_movement_key_held(k: KeyState): boolean {
  return !!(
    k.ArrowLeft ||
    k.ArrowRight ||
    k.ArrowUp ||
    k.ArrowDown ||
    k.w ||
    k.a ||
    k.s ||
    k.d
  )
}

/** Head looks at camera for this long (seconds), with short blends in/out. */
const HEAD_LOOK_HOLD_SEC = 2
const HEAD_LOOK_BLEND_IN = 0.22
const HEAD_LOOK_BLEND_OUT = 0.22
/** Idle at neutral before the next look cycle. */
const HEAD_LOOK_NEUTRAL_GAP = 1.5
const HEAD_LOOK_CYCLE_SEC =
  HEAD_LOOK_BLEND_IN + HEAD_LOOK_HOLD_SEC + HEAD_LOOK_BLEND_OUT + HEAD_LOOK_NEUTRAL_GAP
/** No movement keys held for this long before head look-at loop begins. */
const HEAD_IDLE_SEC_BEFORE_LOOK = 3

/** Standing idle (no movement keys): half turn toward last facing — ~45°. */
const BODY_YAW_IDLE_HALF_RAD = Math.PI / 4
/** Walking (movement keys): full side-on toward travel direction — 90°. */
const BODY_YAW_WALK_FULL_RIGHT = Math.PI / 2
const BODY_YAW_WALK_FULL_LEFT = -Math.PI / 2

/** One full close+open eye blink (squash Y on the white discs). */
const BLINK_DURATION_SEC = 0.22
/** Random pause between blinks (seconds). */
const BLINK_WAIT_MIN_SEC = 2.2
const BLINK_WAIT_MAX_SEC = 5.2

const _neutral_head_quat = new Quaternion()

/** 0 = eyes open, 1 = fully shut — symmetric ease (close then open). */
function blink_shut_amount(t: number): number {
  if (t <= 0 || t >= BLINK_DURATION_SEC) return 0
  const u = t / BLINK_DURATION_SEC
  if (u < 0.5) return MathUtils.smoothstep(0, 0.5, u)
  return 1 - MathUtils.smoothstep(0.5, 1, u)
}

function head_look_blend(elapsed_sec: number): number {
  const t = elapsed_sec % HEAD_LOOK_CYCLE_SEC
  if (t < HEAD_LOOK_BLEND_IN) return t / HEAD_LOOK_BLEND_IN
  if (t < HEAD_LOOK_BLEND_IN + HEAD_LOOK_HOLD_SEC) return 1
  if (t < HEAD_LOOK_BLEND_IN + HEAD_LOOK_HOLD_SEC + HEAD_LOOK_BLEND_OUT) {
    const u = (t - HEAD_LOOK_BLEND_IN - HEAD_LOOK_HOLD_SEC) / HEAD_LOOK_BLEND_OUT
    return 1 - u
  }
  return 0
}

/**
 * Game-style yarn demon rig: hip/shoulder pivots, opposite arm/leg walk cycle,
 * damped walk blend, stride bob. Body Yaws toward ±X when moving (side camera on +Z).
 */

export interface DemonBoyProps {
  position: Vector3Type
  is_crouching_ref: React.MutableRefObject<boolean>
  velocity_x_ref: React.MutableRefObject<number>
  /** After a box underside hit — fall pose + no walk until feet land on the floor. */
  suppress_air_walk_ref?: React.MutableRefObject<boolean>
  /** World-space vertical velocity (Scene physics) — drives fall pose strength. */
  vertical_velocity_ref?: React.MutableRefObject<number>
  /** Shared with Scene — read in DemonBoy useFrame for idle head-look (no useFrame priority hacks). */
  keys_ref: React.MutableRefObject<KeyState>
  modelScale?: number
  groundOffsetY?: number
  walkBobIntensity?: number
  crouchScaleY?: number
  silhouetteColor?: string
}

function useDemonMaterials(body_red_hex: string) {
  const materials = useMemo(() => {
    // Limbo silhouette: near-black body, no emissive — colour is the silhouetteColor prop.
    const yarn = new MeshStandardMaterial({
      color: body_red_hex,
      roughness: 0.92,
      metalness: 0,
      flatShading: false,    // smooth silhouette reads cleaner against bright bg
      emissive: '#000000',
      emissiveIntensity: 0,
      side: DoubleSide,
    })
    const yarn_deep = new MeshStandardMaterial({
      color: '#080a0c',      // near-black regardless of body colour
      roughness: 0.98,
      metalness: 0,
      flatShading: false,
      emissive: '#000000',
      emissiveIntensity: 0,
      side: DoubleSide,
    })
    // Flat white patches (reference) + emissive so they never disappear in dark scenes.
    const eye_flat = new MeshStandardMaterial({
      color: '#fdfcf7',
      emissive: '#fffef5',
      emissiveIntensity: 1.15,
      roughness: 0.35,
      metalness: 0,
    })
    const eye_socket = new MeshStandardMaterial({
      color: '#1a0608',
      roughness: 1,
      metalness: 0,
      emissive: '#000000',
      emissiveIntensity: 0,
    })

    return { yarn, yarn_deep, eye_flat, eye_socket }
  }, [body_red_hex])

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose())
    }
  }, [materials])

  return materials
}

function YarnTorsoRings({ material, count = 7 }: { material: MeshStandardMaterial; count?: number }) {
  const rings = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        key: index,
        y: 0.58 + index * 0.095,
        radius: 0.19 + (index % 2) * 0.02,
        twist: index * 0.55,
      })),
    [count],
  )

  return (
    <>
      {rings.map((ring) => (
        <mesh key={ring.key} position={[0, ring.y, 0]} rotation={[Math.PI / 2, ring.twist, 0]} material={material} castShadow>
          <torusGeometry args={[ring.radius, 0.024, 8, 22]} />
        </mesh>
      ))}
    </>
  )
}

export const DemonBoy = forwardRef<Group, DemonBoyProps>(function DemonBoy(
  {
    position,
    is_crouching_ref,
    velocity_x_ref,
    suppress_air_walk_ref,
    vertical_velocity_ref,
    keys_ref,
    modelScale = 1,
    groundOffsetY = 0,
    walkBobIntensity = 0.035,
    crouchScaleY = 0.78,
    silhouetteColor = '#7a1a22',
    ...rest
  },
  forwarded_ref,
) {
  /** Y rotation: full side when moving with keys; half angle when standing (no keys). */
  const body_yaw_ref = useRef<Group>(null)
  const inner_group_ref = useRef<Group>(null)
  const leg_left_pivot_ref = useRef<Group>(null)
  const leg_right_pivot_ref = useRef<Group>(null)
  const arm_left_pivot_ref = useRef<Group>(null)
  const arm_right_pivot_ref = useRef<Group>(null)
  const walk_blend_ref = useRef(0)
  /** World yaw target (damped toward each frame). */
  const target_yaw_ref = useRef(BODY_YAW_IDLE_HALF_RAD)
  /** +1 = last faced right, -1 = last faced left — drives idle half-yaw when no keys. */
  const last_walk_dir_ref = useRef(1)
  /** Neck pivot: head + horns + eyes — rotated toward camera on a loop. */
  const head_pivot_ref = useRef<Group>(null)
  const look_at_quat_ref = useRef(new Quaternion())
  /** Seconds without movement keys — must reach HEAD_IDLE_SEC_BEFORE_LOOK before look starts. */
  const no_movement_accum_sec_ref = useRef(0)
  /** Local time for head look cycle (only advances after idle threshold, resets on movement). */
  const head_look_anim_time_ref = useRef(0)
  /** White eye discs — Y scale squashes toward 0 for a blink. */
  const eye_discs_ref = useRef<Group>(null)
  /** Accumulated wait time until the next blink starts. */
  const blink_wait_accum_sec_ref = useRef(0)
  /** Positive while a blink is in progress (time since blink start, seconds). */
  const blink_anim_t_ref = useRef(0)
  /** Seconds to wait after the previous blink ended (re-randomized each time). */
  const blink_next_wait_sec_ref = useRef(1.6)
  const mats = useDemonMaterials(silhouetteColor)
  const { camera } = useThree()

  /** Periodic glance at the camera (~1 s hold), then ease back to neutral. */
  const apply_head_look_at_camera = (elapsed_sec: number) => {
    const head = head_pivot_ref.current
    if (!head) return
    head.quaternion.identity()
    head.lookAt(camera.position)
    look_at_quat_ref.current.copy(head.quaternion)
    const blend = head_look_blend(elapsed_sec)
    head.quaternion.copy(_neutral_head_quat)
    head.quaternion.slerp(look_at_quat_ref.current, blend)
  }

  /** Head looks at camera only after idle; any movement key snaps head to neutral and resets timers. */
  const update_head_look_idle = (delta: number) => {
    const head = head_pivot_ref.current
    if (!head) return
    if (is_movement_key_held(keys_ref.current)) {
      no_movement_accum_sec_ref.current = 0
      head_look_anim_time_ref.current = 0
      head.quaternion.identity()
      return
    }
    no_movement_accum_sec_ref.current += delta
    if (no_movement_accum_sec_ref.current < HEAD_IDLE_SEC_BEFORE_LOOK) {
      head_look_anim_time_ref.current = 0
      head.quaternion.identity()
      return
    }
    head_look_anim_time_ref.current += delta
    apply_head_look_at_camera(head_look_anim_time_ref.current)
  }

  /** Periodic random blinks: squash both eye discs on Y (cylinders read as lids closing). */
  const update_eye_blink = (delta: number) => {
    const discs = eye_discs_ref.current
    if (!discs) return

    if (blink_anim_t_ref.current > 0) {
      blink_anim_t_ref.current += delta
      const shut = blink_shut_amount(blink_anim_t_ref.current)
      const y = Math.max(0.035, 1 - shut * 0.965)
      discs.scale.set(1, y, 1)
      if (blink_anim_t_ref.current >= BLINK_DURATION_SEC) {
        blink_anim_t_ref.current = 0
        discs.scale.set(1, 1, 1)
        blink_next_wait_sec_ref.current =
          BLINK_WAIT_MIN_SEC + Math.random() * (BLINK_WAIT_MAX_SEC - BLINK_WAIT_MIN_SEC)
        blink_wait_accum_sec_ref.current = 0
      }
      return
    }

    blink_wait_accum_sec_ref.current += delta
    if (blink_wait_accum_sec_ref.current >= blink_next_wait_sec_ref.current) {
      blink_anim_t_ref.current = 1e-4
      blink_wait_accum_sec_ref.current = 0
    }
  }

  useFrame((state, delta) => {
    const inner = inner_group_ref.current
    const body_yaw = body_yaw_ref.current
    if (!inner || !body_yaw) return

    const vx = velocity_x_ref.current
    const speed_norm = MathUtils.clamp(Math.abs(vx) / move_speed_max, 0, 1)
    const is_crouching = is_crouching_ref.current
    const freeze_air = suppress_air_walk_ref?.current === true
    const vy = vertical_velocity_ref?.current ?? 0

    const k = keys_ref.current
    const any_move_key = is_movement_key_held(k)

    if (!any_move_key) {
      // Standing: half turn (3/4 toward camera), keep last left/right.
      target_yaw_ref.current = last_walk_dir_ref.current * BODY_YAW_IDLE_HALF_RAD
    } else {
      // Walking / keys held: full side-on; direction from velocity or horizontal keys.
      if (vx > 0.02) {
        last_walk_dir_ref.current = 1
        target_yaw_ref.current = BODY_YAW_WALK_FULL_RIGHT
      } else if (vx < -0.02) {
        last_walk_dir_ref.current = -1
        target_yaw_ref.current = BODY_YAW_WALK_FULL_LEFT
      } else {
        const want_right = k.d || k.ArrowRight
        const want_left = k.a || k.ArrowLeft
        if (want_right && !want_left) {
          last_walk_dir_ref.current = 1
          target_yaw_ref.current = BODY_YAW_WALK_FULL_RIGHT
        } else if (want_left && !want_right) {
          last_walk_dir_ref.current = -1
          target_yaw_ref.current = BODY_YAW_WALK_FULL_LEFT
        } else {
          target_yaw_ref.current = last_walk_dir_ref.current * BODY_YAW_WALK_FULL_RIGHT
        }
      }
    }

    body_yaw.rotation.y = MathUtils.damp(body_yaw.rotation.y, target_yaw_ref.current, 9, delta)

    inner.scale.set(modelScale, modelScale * (is_crouching ? crouchScaleY : 1), modelScale)

    // Box underside stun: smooth falling pose (lean + light flail) until feet hit the floor.
    if (freeze_air) {
      walk_blend_ref.current = 0
      const t = state.clock.elapsedTime
      // Stronger pose as downward speed increases (caps around terminal fall).
      const fall_blend = MathUtils.clamp(-vy / 16, 0, 1)
      const wobble = Math.sin(t * 3.4) * 0.045 * fall_blend
      const flail = Math.sin(t * 5.1) * 0.18 * fall_blend
      // Forward lean + tiny roll so the drop reads clearly in side view.
      const target_lean_x = 0.11 * fall_blend + wobble * 0.35
      const target_lean_z = Math.sin(t * 2.2) * 0.06 * fall_blend
      inner.rotation.x = MathUtils.damp(inner.rotation.x, target_lean_x, 7, delta)
      inner.rotation.z = MathUtils.damp(inner.rotation.z, target_lean_z, 8, delta)
      inner.position.y = groundOffsetY

      const arm_base = -0.22
      const arm_spread = 0.28
      const leg_trail = 0.28 * fall_blend
      if (leg_left_pivot_ref.current) leg_left_pivot_ref.current.rotation.x = leg_trail + wobble
      if (leg_right_pivot_ref.current) leg_right_pivot_ref.current.rotation.x = leg_trail - wobble
      if (arm_left_pivot_ref.current) {
        arm_left_pivot_ref.current.rotation.x = arm_base + flail + wobble * 0.5
        arm_left_pivot_ref.current.rotation.z = arm_spread
      }
      if (arm_right_pivot_ref.current) {
        arm_right_pivot_ref.current.rotation.x = arm_base - flail - wobble * 0.5
        arm_right_pivot_ref.current.rotation.z = -arm_spread
      }
      update_head_look_idle(delta)
      update_eye_blink(delta)
      return
    }

    // Ease torso back to upright after a stun fall.
    inner.rotation.x = MathUtils.damp(inner.rotation.x, 0, 10, delta)
    inner.rotation.z = MathUtils.damp(inner.rotation.z, 0, 10, delta)

    // Smooth ramp in/out of walk pose (game-style transition).
    const walk_target = is_crouching ? 0 : speed_norm
    walk_blend_ref.current = MathUtils.damp(walk_blend_ref.current, walk_target, 7.5, delta)

    const blend = walk_blend_ref.current
    const stride_hz = 1.05 + speed_norm * 0.95
    const phase = state.clock.elapsedTime * Math.PI * 2 * stride_hz

    const leg_amp = 0.62
    const arm_amp = 0.52
    const s = Math.sin(phase)

    if (leg_left_pivot_ref.current) leg_left_pivot_ref.current.rotation.x = s * leg_amp * blend
    if (leg_right_pivot_ref.current) leg_right_pivot_ref.current.rotation.x = -s * leg_amp * blend

    // Arms: rest pose has a slight forward hang (-0.22 rad) and outward spread (±0.28 rad).
    // Walk cycle adds/subtracts on top so the pose blends naturally with movement.
    const arm_rest_x = -0.22
    const arm_rest_z = 0.28
    if (arm_left_pivot_ref.current) {
      arm_left_pivot_ref.current.rotation.x = arm_rest_x + -s * arm_amp * blend
      arm_left_pivot_ref.current.rotation.z = arm_rest_z
    }
    if (arm_right_pivot_ref.current) {
      arm_right_pivot_ref.current.rotation.x = arm_rest_x + s * arm_amp * blend
      arm_right_pivot_ref.current.rotation.z = -arm_rest_z
    }

    const bob = blend * Math.abs(Math.sin(phase * 2)) * walkBobIntensity
    inner.position.y = groundOffsetY + bob

    update_head_look_idle(delta)
    update_eye_blink(delta)
  })

  return (
    <group ref={forwarded_ref} position={position} {...rest} dispose={null}>
      <group ref={body_yaw_ref} rotation={[0, BODY_YAW_IDLE_HALF_RAD, 0]}>
        <group ref={inner_group_ref}>
        {/* Legs: pivots at hips so thighs swing — feet stay visually attached at capsule end */}
        <group position={[0.11, 0.76, 0]} ref={leg_left_pivot_ref}>
          <mesh position={[0, -0.28, 0]} material={mats.yarn} castShadow>
            <capsuleGeometry args={[0.042, 0.46, 6, 10]} />
          </mesh>
          <mesh position={[0, -0.52, 0.04]} material={mats.yarn} castShadow>
            <sphereGeometry args={[0.095, 10, 10]} />
          </mesh>
          <mesh position={[0, -0.28, 0]} material={mats.yarn_deep} castShadow>
            <capsuleGeometry args={[0.024, 0.42, 6, 8]} />
          </mesh>
        </group>

        <group position={[-0.11, 0.76, 0]} ref={leg_right_pivot_ref}>
          <mesh position={[0, -0.28, 0]} material={mats.yarn} castShadow>
            <capsuleGeometry args={[0.042, 0.46, 6, 10]} />
          </mesh>
          <mesh position={[0, -0.52, 0.04]} material={mats.yarn} castShadow>
            <sphereGeometry args={[0.095, 10, 10]} />
          </mesh>
          <mesh position={[0, -0.28, 0]} material={mats.yarn_deep} castShadow>
            <capsuleGeometry args={[0.024, 0.42, 6, 8]} />
          </mesh>
        </group>

        <mesh position={[0, 0.9, 0]} material={mats.yarn} castShadow>
          <cylinderGeometry args={[0.2, 0.22, 0.5, 10]} />
        </mesh>
        <YarnTorsoRings material={mats.yarn} />

        {/* Arms: shoulder pivots — swing opposes legs */}
        <group position={[0.15, 1.10, 0]} ref={arm_left_pivot_ref}>
          <mesh position={[0.08, -0.24, 0]} material={mats.yarn} castShadow>
            <capsuleGeometry args={[0.034, 0.5, 6, 8]} />
          </mesh>
        </group>
        <group position={[-0.15, 1.10, 0]} ref={arm_right_pivot_ref}>
          <mesh position={[-0.08, -0.24, 0]} material={mats.yarn} castShadow>
            <capsuleGeometry args={[0.034, 0.5, 6, 8]} />
          </mesh>
        </group>

        {/* Neck pivot: rotates toward camera on a timed loop (see `apply_head_look_at_camera`). */}
        <group ref={head_pivot_ref} position={[0, 1.42, 0]}>
          <mesh position={[0, 0.04, 0.02]} material={mats.yarn} castShadow>
            <sphereGeometry args={[0.36, 14, 14]} />
          </mesh>

          <mesh position={[0, 0.4, 0.16]} rotation={[-0.48, 0, 0]} material={mats.yarn} castShadow>
            <coneGeometry args={[0.1, 0.36, 7]} />
          </mesh>
          <mesh position={[0.2, 0.32, -0.04]} rotation={[-0.36, 0, 0.95]} material={mats.yarn} castShadow>
            <coneGeometry args={[0.085, 0.3, 7]} />
          </mesh>
          <mesh position={[-0.2, 0.32, -0.04]} rotation={[-0.36, 0, -0.95]} material={mats.yarn} castShadow>
            <coneGeometry args={[0.085, 0.3, 7]} />
          </mesh>

          {/* Eyes: sockets + flat discs in front of head */}
          <group position={[0, 0, 0.3]}>
            <mesh position={[-0.15, 0.02, 0]} material={mats.eye_socket} castShadow renderOrder={1}>
              <sphereGeometry args={[0.075, 10, 10]} />
            </mesh>
            <mesh position={[0.15, 0.02, 0]} material={mats.eye_socket} castShadow renderOrder={1}>
              <sphereGeometry args={[0.075, 10, 10]} />
            </mesh>
            {/* Y-scale on this group squashes both whites for a simple blink. */}
            <group ref={eye_discs_ref}>
              <mesh position={[-0.15, 0.02, 0.06]} rotation={[Math.PI / 2, 0, 10]} material={mats.eye_flat} castShadow renderOrder={2}>
                <cylinderGeometry args={[0.072, 0.072, 0.028, 20]} />
              </mesh>
              <mesh position={[0.15, 0.02, 0.06]} rotation={[Math.PI / 2, 0, -10]} material={mats.eye_flat} castShadow renderOrder={2}>
                <cylinderGeometry args={[0.072, 0.072, 0.028, 20]} />
              </mesh>
            </group>
          </group>
        </group>
        </group>
      </group>
    </group>
  )
})
