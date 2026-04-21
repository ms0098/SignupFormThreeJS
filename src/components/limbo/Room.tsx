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
  BOX_SELECTED_FLOAT,
  BOX_D,
  BOX_Y,
  GATE_H,
  GATE_H_BASE,
  ROOM_HALF_W,
  WALL_T,
} from './constants'

// ─── Shared constants ─────────────────────────────────────────────────────────
// Thin Z so the room looks like a flat 2D side-scroller stage; roughly matches
// the demon boy character's depth (~0.4 u) so they appear on the same plane.
const WALL_Z  = 0.45
/**
 * Lamp bulb + point light sit slightly toward the camera (+Z). If the light stayed at z=0 with
 * the character, front-facing normals (≈ +Z) would be perpendicular to the light vector (in the
 * XY plane only) and MeshStandard diffuse would be ~0 on the demon.
 */
const LAMP_LIGHT_Z = WALL_Z * 0

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
    const target_y = open ? room_height + GATE_H + 2 : GATE_H_BASE
    ref.current.position.y = MathUtils.damp(ref.current.position.y, target_y, 3.5, delta)
  })

  return (
    <group ref={ref}>
      {/* Main door panel — extends from gate base upward */}
      <mesh position={[x, GATE_H / 2, 0]}>
        <boxGeometry args={[WALL_T, GATE_H, WALL_Z]} />
        <meshStandardMaterial color={GATE_D} roughness={1} />
      </mesh>
      {/* Portcullis horizontal bars — shifted up by GATE_H_BASE */}
      {[0.55 + GATE_H_BASE, 1.25 + GATE_H_BASE, 1.95 + GATE_H_BASE].map((bar_y) => (
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

/**
 * Ceiling-mounted lamp that swings like a pendulum (rotation around Z) and casts a warm point light.
 * Placed at top centre of a room segment; `phaseOffset` de-syncs multiple lamps.
 */
const PendulumLamp: React.FC<{
  /** World X of room centre (lobby = 0, side rooms = ±2×ROOM_HALF_W). */
  x: number
  room_height: number
  /** Radians — different per room so swings are not identical. */
  phaseOffset?: number
}> = ({ x, room_height, phaseOffset = 0 }) => {
  const swing_ref = useRef<Group>(null)
  /** Pivot just under the ceiling slab (ceiling mesh centre is room_height + 0.1, half-height 0.1). */
  const pivot_y = room_height - 0.02
  const chain_len = 0.85
  const swing_rad = 0.38
  const swing_hz = 0.55

  useFrame(({ clock }) => {
    if (!swing_ref.current) return
    const t = clock.elapsedTime * swing_hz * Math.PI * 2 + phaseOffset
    swing_ref.current.rotation.z = Math.sin(t) * swing_rad
  })

  return (
    <group position={[x, pivot_y, 0]}>
      {/* Fixed ceiling mount */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 10]} />
        <meshStandardMaterial color={STONE_D} roughness={0.75} metalness={0.2} />
      </mesh>
      <group ref={swing_ref}>
        {/* Chain / rod */}
        <mesh position={[0, -chain_len * 0.42, 0]}>
          <cylinderGeometry args={[0.014, 0.014, chain_len * 0.78, 6]} />
          <meshStandardMaterial color="#2a2d36" roughness={0.88} metalness={0.35} />
        </mesh>
        {/* Shade */}
        <mesh position={[0, -chain_len + 0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.2, 0.32, 12, 1]} />
          <meshStandardMaterial
            color="#4a4555"
            roughness={0.65}
            emissive="#c87830"
            emissiveIntensity={0.12}
          />
        </mesh>
        {/* Bulb — nudged +Z with the light so the source reads in front of the stage plane */}
        <mesh position={[0, -chain_len - 0.02, LAMP_LIGHT_Z]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial
            color="#ffe8c8"
            emissive="#ffcc88"
            emissiveIntensity={0.85}
            roughness={0.4}
          />
        </mesh>
        {/* Same +Z as bulb: lights front-facing billboard meshes (demon) and still reaches the floor. */}
        <pointLight
          position={[0, -chain_len - 0.12, LAMP_LIGHT_Z]}
          intensity={9}
          distance={0}
          decay={2}
          color="#ffc070"
        />
      </group>
    </group>
  )
}

/** Pulsing arrow near an open gate, pointing toward the exit. */
const ExitArrow: React.FC<{ x: number; dir: 'left' | 'right' }> = ({ x, dir }) => {
  const ref = useRef<Group>(null)
  const rot_z = dir === 'right' ? -Math.PI / 2 : Math.PI / 2

  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 0.88 + Math.abs(Math.sin(clock.elapsedTime * 2.8)) * 0.14
      ref.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={ref} position={[x, 2.45, 0.3]}>
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
    const target_y = selected ? BOX_Y + BOX_SELECTED_FLOAT : BOX_Y
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

      {/* Floor — same thick platform as the lobby floor (2.5 u tall), centred at y=0 */}
      <mesh position={[center_x, 0, 0]}>
        <boxGeometry args={[room_w, 2.5, WALL_Z]} />
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
        position={[center_x, room_height - 3.4, 0.22]}
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

      <PendulumLamp
        x={center_x}
        room_height={room_height}
        phaseOffset={side === 'left' ? 1.15 : 3.6}
      />
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
        <meshStandardMaterial color={BACK} roughness={0.8} metalness={0.1} />
      </mesh>

      {/* ── Floor — thick platform base (2.5 u tall), centred at y=0 ─────────────── */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[total_w + WALL_T * 2, 2.5, WALL_Z]} />
        <meshStandardMaterial color={FLOOR} roughness={1} />
      </mesh>

      {/* ── Ceiling ─────────────────────────────────────────────────────────── */}
      {/* Positioned at the dynamic room_height so tall screens get more headroom */}
      <mesh position={[0, room_height + 0.1, 0]}>
        <boxGeometry args={[total_w + WALL_T * 2, 0.2, WALL_Z]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>

      {/* Top-centre pendulum lamp — lobby */}
      <PendulumLamp x={0} room_height={room_height} phaseOffset={0} />

      {/* ── Left wall — upper section (above gate, permanent) ───────────────── */}
      <mesh position={[-ROOM_HALF_W, GATE_H_BASE + GATE_H + (room_height - GATE_H_BASE - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, room_height - GATE_H_BASE - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      {/* Lintel beam at gate top */}
      <mesh position={[-ROOM_HALF_W, GATE_H_BASE + GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.08]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      {/* "← EXIT" label above the left gate */}
      {/* <Text
        position={[-ROOM_HALF_W + WALL_T / 2 + 0.05, GATE_H_BASE + GATE_H + 0.7, 0.12]}
        fontSize={0.18}
        color="#8090a4"
        anchorX="center"
        anchorY="middle"
      >
        ← EXIT
      </Text> */}
      {/* Gate door (slides up when open, using dynamic room_height) */}
      <Gate x={-ROOM_HALF_W} open={is_left} room_height={room_height} />

      {/* ── Right wall — upper section ─────────────────────────────────────── */}
      <mesh position={[ROOM_HALF_W, GATE_H_BASE + GATE_H + (room_height - GATE_H_BASE - GATE_H) / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_T, room_height - GATE_H_BASE - GATE_H, WALL_Z]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      <mesh position={[ROOM_HALF_W, GATE_H_BASE + GATE_H + 0.14, 0]}>
        <boxGeometry args={[WALL_T + 0.14, 0.28, WALL_Z + 0.08]} />
        <meshStandardMaterial color={STONE_D} roughness={1} />
      </mesh>
      {/* <Text
        position={[ROOM_HALF_W - WALL_T / 2 - 0.05, GATE_H_BASE + GATE_H + 0.7, 0.12]}
        fontSize={0.18}
        color="#8090a4"
        anchorX="center"
        anchorY="middle"
      >
        EXIT →
      </Text> */}
      <Gate x={ROOM_HALF_W} open={is_right} room_height={room_height} />

      <Text
        position={[0, room_height - 3.4, 0.22]}
        fontSize={0.55}
        color="#1a1a1a"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.012}
        outlineColor="red"
      >
        ARCADE
      </Text>
      <Text
        position={[0, room_height - 4.4, 0.22]}
        fontSize={0.30}
        color="#5a6878"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        Jump up and hit the SIGN IN or SIGN UP box
      </Text>
      <Text
        position={[0, room_height - 4.8, 0.22]}
        fontSize={0.30}
        color="#5a6878"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        from below to start your journey!
      </Text>
 

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
