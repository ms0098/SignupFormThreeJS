import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type * as React from 'react'
import { useRef } from 'react'
import { MathUtils } from 'three'
import type { Group } from 'three'
import {
  BOX_HALF_H,
  BOX_HALF_W,
  BOX_LEFT_X,
  BOX_RIGHT_X,
  BOX_Y,
  GATE_H,
  ROOM_HALF_W,
  ROOM_HEIGHT,
  WALL_T,
} from './constants'

// ─── Shared constants ─────────────────────────────────────────────────────────
const WALL_Z  = 5.0   // how deep (in Z) walls extend so they fill the camera view
const BOX_D   = 0.3   // selection box depth
// Near-pure black so geometry reads as a silhouette against the bright Limbo sky
const STONE   = '#090a0c' as const
const STONE_D = '#060709' as const
const GATE_D  = '#0c0d10' as const

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Portcullis gate for one wall side.
 * When `open` becomes true the door slides up above the ceiling.
 */
const Gate: React.FC<{ x: number; open: boolean }> = ({ x, open }) => {
  const ref = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    // Slide to well above ceiling when open, back to floor when closed.
    const target_y = open ? ROOM_HEIGHT + GATE_H + 2 : 0
    ref.current.position.y = MathUtils.damp(ref.current.position.y, target_y, 3.5, delta)
  })

  return (
    <group ref={ref}>
      {/* Main door panel */}
      <mesh position={[x, GATE_H / 2, 0]}>
        <boxGeometry args={[WALL_T, GATE_H, WALL_Z]} />
        <meshStandardMaterial color={GATE_D} roughness={1} />
      </mesh>
      {/* Portcullis horizontal bars — darker strips across the door */}
      {[0.55, 1.25, 1.95].map((bar_y) => (
        <mesh key={bar_y} position={[x, bar_y, 0]}>
          <boxGeometry args={[WALL_T + 0.06, 0.09, WALL_Z + 0.08]} />
          <meshStandardMaterial color={STONE_D} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Small arrow that bounces vertically above a box to hint "jump here". */
const HintArrow: React.FC<{ x: number }> = ({ x }) => {
  const ref = useRef<Group>(null)
  const base_y = BOX_Y + BOX_HALF_H + 0.55

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = base_y + Math.sin(clock.elapsedTime * 3) * 0.1
    }
  })

  return (
    <group ref={ref} position={[x, base_y, 0]}>
      {/* Down-pointing cone */}
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.1, 0.2, 8]} />
        {/* Dark silhouette arrow — reads against the bright Limbo background */}
        <meshStandardMaterial color="#202530" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Pulsing arrow near an open gate, pointing toward the exit. */
const ExitArrow: React.FC<{ x: number; dir: 'left' | 'right' }> = ({ x, dir }) => {
  const ref = useRef<Group>(null)
  const rot_z = dir === 'left' ? -Math.PI / 2 : Math.PI / 2

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 0.88 + Math.abs(Math.sin(clock.elapsedTime * 2.8)) * 0.14
      ref.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={ref} position={[x, 1.2, 0]}>
      <mesh rotation={[0, 0, rot_z]}>
        <coneGeometry args={[0.18, 0.38, 8]} />
        <meshStandardMaterial color="#e85060" roughness={0.6} emissive="#9a0a18" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

interface SelectionBoxProps {
  x: number
  label: string
  selected: boolean
}

/**
 * Stone slab with a glowing label.
 * Floats up when selected (character hit it while jumping).
 */
const SelectionBox: React.FC<SelectionBoxProps> = ({ x, label, selected }) => {
  const ref = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    const target_y = selected ? BOX_Y + 0.9 : BOX_Y
    ref.current.position.y = MathUtils.damp(ref.current.position.y, target_y, 6, delta)
  })

  return (
    <group ref={ref} position={[x, BOX_Y, 0]}>
      {/* Outer border frame (slightly larger, behind the face) */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[BOX_HALF_W * 2 + 0.08, BOX_HALF_H * 2 + 0.08, BOX_D * 0.55]} />
        <meshStandardMaterial
          color={selected ? '#5a1525' : '#151a1f'}
          roughness={1}
          emissive={selected ? '#3a0a12' : '#000000'}
          emissiveIntensity={selected ? 0.7 : 0}
        />
      </mesh>

      {/* Main slab face */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[BOX_HALF_W * 2, BOX_HALF_H * 2, BOX_D]} />
        <meshStandardMaterial
          color={selected ? '#2e1420' : '#1c2028'}
          roughness={0.88}
          emissive={selected ? '#6a1228' : '#060a0e'}
          emissiveIntensity={selected ? 1.1 : 0.25}
        />
      </mesh>

      {/* Text label — emissive so it reads in dark lighting */}
      <Text
        position={[0, 0, BOX_D / 2 + 0.04]}
        fontSize={0.22}
        color={selected ? '#ffb8c6' : '#b8c2cf'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#000000"
        letterSpacing={0.07}
      >
        {label}
      </Text>
    </group>
  )
}

// ─── Room component ───────────────────────────────────────────────────────────
export type SelectedSide = null | 'left' | 'right'

interface RoomProps {
  selected_side: SelectedSide
}

/**
 * Full side-scroller room:
 * - Floor, ceiling, back wall
 * - Left wall with "Sign In" gate  →  opens when SIGN IN box is hit
 * - Right wall with "Sign Up" gate →  opens when SIGN UP box is hit
 * - Two floating selection slabs in the centre
 */
export const Room: React.FC<RoomProps> = ({ selected_side }) => {
  const is_left  = selected_side === 'left'
  const is_right = selected_side === 'right'
  const total_w  = ROOM_HALF_W * 2

  return (
    <>
      {/* ── Floor ──────────────────────────────────────────────────────────── */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[total_w + WALL_T * 2, 0.16, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={1} />
      </mesh>
      {/* Floor edge strips — darker so they add a little depth texture */}
      {[-1.5, -0.5, 0.5, 1.5].map((bz) => (
        <mesh key={bz} position={[0, -0.04, bz]}>
          <boxGeometry args={[total_w + WALL_T, 0.03, 0.08]} />
          <meshStandardMaterial color={STONE_D} roughness={1} />
        </mesh>
      ))}

      {/* ── Ceiling ─────────────────────────────────────────────────────────── */}
      <mesh position={[0, ROOM_HEIGHT + 0.1, 0]}>
        <boxGeometry args={[total_w + WALL_T * 2, 0.22, WALL_Z]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>

      {/* Back wall intentionally removed — bright fog/sky colour shows through,
          creating the Limbo depth-haze silhouette effect */}

      {/* ── Left wall — upper section (above gate, permanent) ───────────────── */}
      <mesh position={[-ROOM_HALF_W, GATE_H + (ROOM_HEIGHT - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, ROOM_HEIGHT - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={1} />
      </mesh>
      {/* Lintel beam at gate top */}
      <mesh position={[-ROOM_HALF_W, GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.1]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      {/* "SIGN IN" label above the gate */}
      <Text
        position={[-ROOM_HALF_W + WALL_T / 2 + 0.05, GATE_H + 0.7, 0.1]}
        fontSize={0.18}
        color="#5a6878"
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, 0]}
      >
        ← EXIT
      </Text>
      {/* Gate door (slides up) */}
      <Gate x={-ROOM_HALF_W} open={is_left} />

      {/* ── Right wall — upper section ─────────────────────────────────────── */}
      <mesh position={[ROOM_HALF_W, GATE_H + (ROOM_HEIGHT - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, ROOM_HEIGHT - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={1} />
      </mesh>
      <mesh position={[ROOM_HALF_W, GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.1]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      <Text
        position={[ROOM_HALF_W - WALL_T / 2 - 0.05, GATE_H + 0.7, 0.1]}
        fontSize={0.18}
        color="#5a6878"
        anchorX="center"
        anchorY="middle"
      >
        EXIT →
      </Text>
      <Gate x={ROOM_HALF_W} open={is_right} />

      {/* ── Selection boxes ────────────────────────────────────────────────── */}
      <SelectionBox x={BOX_LEFT_X}  label="SIGN IN"  selected={is_left}  />
      <SelectionBox x={BOX_RIGHT_X} label="SIGN UP"  selected={is_right} />

      {/* Jump-hint arrows — disappear once any box is activated */}
      {!selected_side && (
        <>
          <HintArrow x={BOX_LEFT_X}  />
          <HintArrow x={BOX_RIGHT_X} />
        </>
      )}

      {/* Exit arrows near open gate */}
      {is_left  && <ExitArrow x={-ROOM_HALF_W + 1.8} dir="left"  />}
      {is_right && <ExitArrow x={ ROOM_HALF_W - 1.8} dir="right" />}
    </>
  )
}
