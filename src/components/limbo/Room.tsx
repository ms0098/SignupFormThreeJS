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
  WALL_T,
} from './constants'

// ─── Shared constants ─────────────────────────────────────────────────────────
// Thin Z so the room looks like a flat 2D side-scroller stage; roughly matches
// the demon boy character's depth (~0.4 u) so they appear on the same plane.
const WALL_Z  = 0.45
const BOX_D   = 0.3   // selection box depth

// Stone colours — readable against the dark background.
const STONE   = '#3e4352' as const   // main stone wall / ceiling
const STONE_D = '#2c3040' as const   // darker accent / lintel
const GATE_D  = '#363c4c' as const   // gate door panel
// Floor is distinctly darker than walls to read like a ground shadow.
const FLOOR   = '#14161c' as const
// Back-wall fill — matches the app background so no background peeks through.
const BACK    = '#fefefe' as const

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Portcullis gate for one wall side.
 * When `open` becomes true the door slides up well above the (dynamic) ceiling.
 */
const Gate: React.FC<{ x: number; open: boolean; room_height: number }> = ({ x, open, room_height }) => {
  const ref = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    // Slide above the ceiling when open; use the live room_height so the gate
    // always clears the ceiling regardless of current screen size.
    const target_y = open ? room_height + GATE_H + 2 : 0
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

// ─── Side room (destination) ──────────────────────────────────────────────────

/**
 * One of the two destination rooms attached outside the lobby gates.
 *
 * Layout (same width as the lobby — ROOM_HALF_W * 2):
 *   Left room  spans x: -3×RHW  to  -1×RHW  (i.e. -22.5 to -7.5)
 *   Right room spans x: +1×RHW  to  +3×RHW  (i.e. +7.5  to +22.5)
 *
 * The SHARED WALL with the lobby (at x = ±ROOM_HALF_W) is NOT re-rendered here —
 * it is already rendered by the Room component above (left/right lobby wall + gate).
 * This component only adds: floor, ceiling, back wall, and the far outer wall.
 */
const SideRoom: React.FC<{ side: 'left' | 'right'; room_height: number }> = ({ side, room_height }) => {
  const dir      = side === 'left' ? -1 : 1
  // Centre of the side room in world X.
  const center_x = dir * ROOM_HALF_W * 2   // -15 or +15
  // Position of the outer (far) wall.
  const outer_x  = dir * ROOM_HALF_W * 3   // -22.5 or +22.5
  const room_w   = ROOM_HALF_W * 2          // 15 u — identical to lobby width
  const label    = side === 'left' ? 'SIGN IN' : 'SIGN UP'

  return (
    <>
      {/* Back wall — same dark fill as the lobby; seals out the background */}
      <mesh position={[center_x, room_height / 2, -WALL_Z / 2 - 0.05]}>
        <boxGeometry args={[room_w + WALL_T * 2, room_height + 1, 0.06]} />
        <meshStandardMaterial color={BACK} roughness={1} />
      </mesh>

      {/* Floor — same dark shadow tone as the lobby floor */}
      <mesh position={[center_x, -0.03, 0]}>
        <boxGeometry args={[room_w, 0.06, WALL_Z]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[center_x, room_height + 0.1, 0]}>
        <boxGeometry args={[room_w + WALL_T * 2, 0.2, WALL_Z]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>

      {/* Outer (far) wall — solid stone, no gate; this is the back wall the
          character walks toward after entering the room */}
      <mesh position={[outer_x, room_height / 2, 0]}>
        <boxGeometry args={[WALL_T, room_height, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>

      {/* Room identity label — centred at mid-height, visible from the lobby
          through the gate opening once the gate slides open */}
      <Text
        position={[center_x, room_height * 0.42, 0.22]}
        fontSize={0.30}
        color="#5a6878"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </>
  )
}

// ─── Room component ───────────────────────────────────────────────────────────
export type SelectedSide = null | 'left' | 'right'

interface RoomProps {
  selected_side: SelectedSide
  /** Dynamic ceiling height — computed from viewport size in Scene.tsx */
  room_height: number
}

/**
 * Full side-scroller room:
 * - Flat shadow floor + stone walls and ceiling
 * - Thin Z (WALL_Z) so everything reads as a flat 2D stage matching the character silhouette
 * - Left wall with "Sign In" gate  →  opens when SIGN IN box is hit
 * - Right wall with "Sign Up" gate →  opens when SIGN UP box is hit
 * - Two floating selection slabs in the centre
 */
export const Room: React.FC<RoomProps> = ({ selected_side, room_height }) => {
  const is_left  = selected_side === 'left'
  const is_right = selected_side === 'right'
  const total_w  = ROOM_HALF_W * 2

  return (
    <>
      {/* ── Back wall — seals the room so the dark background never shows ──── */}
      {/* Positioned just behind the room (negative Z); spans full width + height.
          This prevents the bright sky / background from peeking through the open
          interior when the camera looks toward Z=0. */}
      <mesh position={[0, room_height / 2, -WALL_Z / 2 - 0.05]}>
        <boxGeometry args={[total_w + WALL_T * 2 + 2, room_height + 1, 0.06]} />
        <meshStandardMaterial color={BACK} roughness={1} />
      </mesh>

      {/* ── Floor — flat dark plane reads like a ground shadow ─────────────── */}
      {/* Very thin box (0.06 u high) to keep a clean 2D silhouette edge */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[total_w + WALL_T * 2, 0.06, WALL_Z]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>

      {/* ── Ceiling ─────────────────────────────────────────────────────────── */}
      {/* Positioned at the dynamic room_height so tall screens get more headroom */}
      <mesh position={[0, room_height + 0.1, 0]}>
        <boxGeometry args={[total_w + WALL_T * 2, 0.2, WALL_Z]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>

      {/* ── Left wall — upper section (above gate, permanent) ───────────────── */}
      <mesh position={[-ROOM_HALF_W, GATE_H + (room_height - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, room_height - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      {/* Lintel beam at gate top */}
      <mesh position={[-ROOM_HALF_W, GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.08]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      {/* "← EXIT" label above the left gate */}
      <Text
        position={[-ROOM_HALF_W + WALL_T / 2 + 0.05, GATE_H + 0.7, 0.12]}
        fontSize={0.18}
        color="#8090a4"
        anchorX="center"
        anchorY="middle"
      >
        ← EXIT
      </Text>
      {/* Gate door (slides up when open, using dynamic room_height) */}
      <Gate x={-ROOM_HALF_W} open={is_left} room_height={room_height} />

      {/* ── Right wall — upper section ─────────────────────────────────────── */}
      <mesh position={[ROOM_HALF_W, GATE_H + (room_height - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, room_height - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      <mesh position={[ROOM_HALF_W, GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.08]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      <Text
        position={[ROOM_HALF_W - WALL_T / 2 - 0.05, GATE_H + 0.7, 0.12]}
        fontSize={0.18}
        color="#8090a4"
        anchorX="center"
        anchorY="middle"
      >
        EXIT →
      </Text>
      <Gate x={ROOM_HALF_W} open={is_right} room_height={room_height} />

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

      {/* ── Attached side rooms — always present; the closed gate hides them ── */}
      {/* The shared wall (lobby left/right wall + gate) is already rendered above.
          Each SideRoom only adds its own floor, ceiling, back wall, and outer wall. */}
      <SideRoom side="left"  room_height={room_height} />
      <SideRoom side="right" room_height={room_height} />
    </>
  )
}
