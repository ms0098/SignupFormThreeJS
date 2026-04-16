import { useFrame } from '@react-three/fiber'
import type * as React from 'react'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Group, MathUtils, MeshStandardMaterial } from 'three'
import type { Vector3 as Vector3Type } from 'three'
import { move_speed as move_speed_max } from './constants'

/**
 * Game-style yarn demon rig: hip/shoulder pivots, opposite arm/leg walk cycle,
 * damped walk blend, stride bob. Body Yaws toward ±X when moving (side camera on +Z).
 */

export interface DemonBoyProps {
  position: Vector3Type
  is_crouching_ref: React.MutableRefObject<boolean>
  velocity_x_ref: React.MutableRefObject<number>
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
    modelScale = 1,
    groundOffsetY = 0,
    walkBobIntensity = 0.035,
    crouchScaleY = 0.78,
    silhouetteColor = '#7a1a22',
    ...rest
  },
  forwarded_ref,
) {
  /** Y rotation only: rig faces +X when moving right, -X when moving left (side camera stays on +Z). */
  const body_yaw_ref = useRef<Group>(null)
  const inner_group_ref = useRef<Group>(null)
  const leg_left_pivot_ref = useRef<Group>(null)
  const leg_right_pivot_ref = useRef<Group>(null)
  const arm_left_pivot_ref = useRef<Group>(null)
  const arm_right_pivot_ref = useRef<Group>(null)
  const walk_blend_ref = useRef(0)
  /** World yaw (rad) so local +Z (face) aligns with walk direction on the X axis. */
  const target_yaw_ref = useRef(Math.PI / 2)
  const mats = useDemonMaterials(silhouetteColor)

  useFrame((state, delta) => {
    const inner = inner_group_ref.current
    const body_yaw = body_yaw_ref.current
    if (!inner || !body_yaw) return

    const vx = velocity_x_ref.current
    const speed_norm = MathUtils.clamp(Math.abs(vx) / move_speed_max, 0, 1)
    const is_crouching = is_crouching_ref.current

    // Move right (+vx) → face +X; move left → face -X. Idle keeps last facing.
    if (vx > 0.02) target_yaw_ref.current = Math.PI / 2
    else if (vx < -0.02) target_yaw_ref.current = -Math.PI / 2

    body_yaw.rotation.y = MathUtils.damp(body_yaw.rotation.y, target_yaw_ref.current, 9, delta)

    inner.scale.set(modelScale, modelScale * (is_crouching ? crouchScaleY : 1), modelScale)

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
  })

  return (
    <group ref={forwarded_ref} position={position} {...rest} dispose={null}>
      <group ref={body_yaw_ref}>
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

        <mesh position={[0, 1.46, 0.02]} material={mats.yarn} castShadow>
          <sphereGeometry args={[0.36, 14, 14]} />
        </mesh>

        <mesh position={[0, 1.82, 0.16]} rotation={[-0.48, 0, 0]} material={mats.yarn} castShadow>
          <coneGeometry args={[0.1, 0.36, 7]} />
        </mesh>
        <mesh position={[0.2, 1.74, -0.04]} rotation={[-0.36, 0, 0.95]} material={mats.yarn} castShadow>
          <coneGeometry args={[0.085, 0.3, 7]} />
        </mesh>
        <mesh position={[-0.2, 1.74, -0.04]} rotation={[-0.36, 0, -0.95]} material={mats.yarn} castShadow>
          <coneGeometry args={[0.085, 0.3, 7]} />
        </mesh>

        {/* Eyes: sockets + flat discs in front of head, high renderOrder so they always read */}
        <group position={[0, 1.42, 0.3]}>
          <mesh position={[-0.15, 0.02, 0]} material={mats.eye_socket} castShadow renderOrder={1}>
            <sphereGeometry args={[0.075, 10, 10]} />
          </mesh>
          <mesh position={[0.15, 0.02, 0]} material={mats.eye_socket} castShadow renderOrder={1}>
            <sphereGeometry args={[0.075, 10, 10]} />
          </mesh>
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
  )
})
