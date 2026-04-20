import { Html, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type * as React from 'react'
import { useEffect, useId, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils } from 'three'
import { SUBMIT_SLAB_H, SUBMIT_SLAB_W } from './constants'

/**
 * Form data types for Sign In and Sign Up.
 */
export interface FormData {
  username: string
  password: string
  email?: string
  confirmPassword?: string
}

interface FormFieldProps {
  id: string
  fieldKey: string
  label: string
  y: number
  value: string
  isFocused: boolean
  /** Called when this field gains focus (Tab / click). */
  onFocusField: (fieldKey: string) => void
  onChange: (value: string) => void
  tabIndex: number
}

/**
 * One row: label + 3D frame + Html `<input>`.
 *
 * Typing uses the **native input only** — no duplicate `window` key listeners (those
 * conflict with the DOM and double characters). Tab order follows `tabIndex`.
 */
const FormField: React.FC<FormFieldProps> = ({
  id,
  fieldKey,
  label,
  y,
  value,
  isFocused,
  onFocusField,
  onChange,
  tabIndex,
}) => {
  const input_ref = useRef<HTMLInputElement>(null)

  // Keep DOM focus in sync with game "focused field" (Tab from Scene / clicks).
  useEffect(() => {
    if (!input_ref.current) return
    if (isFocused && document.activeElement !== input_ref.current) {
      input_ref.current.focus({ preventScroll: true })
    }
    // Blur when game moves focus away so WASD is not blocked by a hidden focused input.
    if (!isFocused && document.activeElement === input_ref.current) {
      input_ref.current.blur()
    }
  }, [isFocused, fieldKey])

  const fillColor = value.length > 0 ? '#4a7c59' : '#2c3040'
  const textColor = isFocused ? '#ffeb3b' : '#c0c8d8'

  return (
    <group position={[0, y, 0]}>
      <Text
        position={[-2.2, 0, 0.31]} // put above the frame mesh (which is at z = 0.05, size z = 0.3)
        fontSize={0.24}
        color={textColor}
        anchorX="right"
        anchorY="middle"
        renderOrder={1000} // ensure renders above other 3D objects
      >
        {label}
      </Text>
      {/* Use rounded corners — replace boxGeometry with roundedBoxGeometry */}
      <mesh position={[0.2, 0, 0.05]}>
        <RoundedBox args={[4.2, 0.55, 0.3]} radius={0.10} smoothness={6}>
          <meshStandardMaterial
            color={fillColor}
            roughness={0.9}
            emissive={isFocused ? '#4a7c59' : '#000000'}
            emissiveIntensity={isFocused ? 0.6 : 0}
          />
        </RoundedBox>
      </mesh>

      <Html position={[0.1, 0.03, 0.05]} center transform occlude={false}>
        <input
          id={id}
          ref={input_ref}
          tabIndex={tabIndex}
          type={label === 'Password' || label === 'Confirm' ? 'password' : 'text'}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => onFocusField(fieldKey)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '160px',
            padding: '6px 8px',
            zIndex: 1000,
            background: 'transparent',
            color: '#e8eef8',
            border: 'none',
            // border: isFocused ? '1px solid rgba(255,235,59,0.5)' : '1px solid rgba(120,130,150,0.35)',
            borderRadius: '4px',
            outline: 'none'
          }}
        />
      </Html>
    </group>
  )
}

interface SignInFormProps {
  formData: FormData
  focusedField: string | null
  onFocusField: (fieldKey: string) => void
  onFieldChange: (field: string, value: string) => void
}

/** Same as Sign Up — aligns label + RoundedBox + Html with the panel centre. */
const FIELD_ROW_OFFSET_X = 0.55

/** Sign In: two rows — shorter panel than Sign Up, same width + wall styling. */
const SIGNIN_PANEL_CENTRE_Y = 1.05
const SIGNIN_OUTER_H = 2.55
const SIGNIN_INNER_H = 2.45

export const SignInForm: React.FC<SignInFormProps> = ({ formData, focusedField, onFocusField, onFieldChange }) => {
  const form_id = useId()

  return (
    <group>
      {/* --- Wall outline + inner fill (matches Sign Up) --- */}
      <mesh position={[0, SIGNIN_PANEL_CENTRE_Y, 0]}>
        <boxGeometry args={[6.65, SIGNIN_OUTER_H, 0.35]} />
        <meshStandardMaterial
          color="#373d46"
          roughness={0.95}
          emissive="#616880"
          emissiveIntensity={0.17}
        />
      </mesh>
      <mesh position={[0, SIGNIN_PANEL_CENTRE_Y, 0.03]}>
        <boxGeometry args={[6.5, SIGNIN_INNER_H, 0.32]} />
        <meshStandardMaterial
          color="#1a1f28"
          roughness={0.95}
          emissive="#0a0f14"
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* <Text
        position={[0, SIGNIN_PANEL_CENTRE_Y + SIGNIN_INNER_H * 0.5 - 0.38, 0.22]}
        fontSize={0.35}
        color="#d0d8e8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
      >
        SIGN IN
      </Text> */}

      <group position={[FIELD_ROW_OFFSET_X, 0, 0]}>
        <FormField
          id={`${form_id}-username`}
          fieldKey="username"
          label="Username"
          y={1.35}
          value={formData.username}
          isFocused={focusedField === 'username'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('username', val)}
          tabIndex={1}
        />
        <FormField
          id={`${form_id}-password`}
          fieldKey="password"
          label="Password"
          y={0.65}
          value={formData.password}
          isFocused={focusedField === 'password'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('password', val)}
          tabIndex={2}
        />
      </group>
    </group>
  )
}

interface SignUpFormProps {
  formData: FormData
  focusedField: string | null
  onFocusField: (fieldKey: string) => void
  onFieldChange: (field: string, value: string) => void
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ formData, focusedField, onFocusField, onFieldChange }) => {
  const form_id = useId()

  return (
    <group>
      {/* --- Form background with wall outline (centred on x=0) — same system as Sign In --- */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[6.65, 3.75, 0.35]} />
        <meshStandardMaterial
          color="#373d46"
          roughness={0.95}
          emissive="#616880"
          emissiveIntensity={0.17}
        />
      </mesh>
      <mesh position={[0, 2, 0.03]}>
        <boxGeometry args={[6.5, 3.65, 0.32]} />
        <meshStandardMaterial
          color="#1a1f28"
          roughness={0.95}
          emissive="#0a0f14"
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* Rows + Html inputs share this offset so they align with the panel centre */}
      <group position={[FIELD_ROW_OFFSET_X, 0, 0]}>
        <FormField
          id={`${form_id}-username`}
          fieldKey="username"
          label="Username"
          y={3.0}
          value={formData.username}
          isFocused={focusedField === 'username'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('username', val)}
          tabIndex={1}
        />
        <FormField
          id={`${form_id}-email`}
          fieldKey="email"
          label="Email"
          y={2.35}
          value={formData.email || ''}
          isFocused={focusedField === 'email'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('email', val)}
          tabIndex={2}
        />
        <FormField
          id={`${form_id}-password`}
          fieldKey="password"
          label="Password"
          y={1.7}
          value={formData.password}
          isFocused={focusedField === 'password'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('password', val)}
          tabIndex={3}
        />
        <FormField
          id={`${form_id}-confirm`}
          fieldKey="confirmPassword"
          label="Confirm"
          y={1.05}
          value={formData.confirmPassword || ''}
          isFocused={focusedField === 'confirmPassword'}
          onFocusField={onFocusField}
          onChange={(val) => onFieldChange('confirmPassword', val)}
          tabIndex={4}
        />
      </group>
    </group>
  )
}

interface SubmitButtonProps {
  /** Scene increments this on each underside collision — triggers squash / glow. */
  hitAnimKey?: number
}

const SUBMIT_BASE_EMISSIVE = 0.4
const SUBMIT_HIT_EMISSIVE_BOOST = 0.35
/** Local Y of the submit slab group root (matches layout below). */
const SUBMIT_GROUP_BASE_Y = -0.8

/** Visual SUBMIT slab; hit detection lives in `Scene.tsx` using world AABB. */
export const SubmitButton: React.FC<SubmitButtonProps> = ({ hitAnimKey = 0 }) => {
  const group_ref = useRef<Group>(null)
  const mesh_ref = useRef<Mesh>(null)
  /** 0 = idle, 1 = just hit — decays each frame for vertical shake + glow. */
  const hit_strength_ref = useRef(0)
  const last_hit_key_ref = useRef(-1)

  // Start a hit reaction when Scene bumps `hitAnimKey` (each jump into the slab).
  useEffect(() => {
    if (hitAnimKey === last_hit_key_ref.current) return
    last_hit_key_ref.current = hitAnimKey
    if (hitAnimKey > 0) hit_strength_ref.current = 1
  }, [hitAnimKey])

  useFrame((_, delta) => {
    const g = group_ref.current
    const mesh = mesh_ref.current
    if (!g || !mesh) return

    const h = hit_strength_ref.current
    if (h <= 0) {
      g.position.y = SUBMIT_GROUP_BASE_Y
      const mat = mesh.material
      if (mat && 'emissiveIntensity' in mat) {
        ;(mat as { emissiveIntensity: number }).emissiveIntensity = SUBMIT_BASE_EMISSIVE
      }
      return
    }

    // Up–down shake only (no tilt / rotation / scale). Emissive flash on impact.
    hit_strength_ref.current = Math.max(0, h - delta * 3.2)
    const t = hit_strength_ref.current
    const punch = Math.sin((1 - t) * Math.PI) * (0.92 + 0.08 * t)
    // Several quick vertical wobbles; amplitude follows `t` so it settles smoothly.
    const shake_y = 0.07 * t * Math.sin((1 - t) * Math.PI * 14)
    g.position.y = SUBMIT_GROUP_BASE_Y + shake_y
    const mat = mesh.material
    if (mat && 'emissiveIntensity' in mat) {
      ;(mat as { emissiveIntensity: number }).emissiveIntensity = MathUtils.lerp(
        SUBMIT_BASE_EMISSIVE,
        SUBMIT_BASE_EMISSIVE + SUBMIT_HIT_EMISSIVE_BOOST,
        punch,
      )
    }
  })

  return (
    <group ref={group_ref} position={[0, SUBMIT_GROUP_BASE_Y, 0]}>
      <mesh ref={mesh_ref} position={[0, 0, 0.15]}>
        <boxGeometry args={[SUBMIT_SLAB_W, SUBMIT_SLAB_H, 0.25]} />
        <meshStandardMaterial color="#3d5a42" roughness={0.85} emissive="#2a6a3e" emissiveIntensity={SUBMIT_BASE_EMISSIVE} />
      </mesh>
      <Text
        position={[0, 0, 0.31]}
        fontSize={0.22}
        color="#a8d5ba"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        renderOrder={1000}
      >
        SUBMIT
      </Text>
    </group>
  )
}
