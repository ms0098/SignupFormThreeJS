import { useFrame, useThree } from '@react-three/fiber'
import type * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DirectionalLight } from 'three'
import { Group, MathUtils, Vector3 } from 'three'
import { Atmosphere } from './Atmosphere'
import { DemonBoy } from './Demon_boy'
import type { SelectedSide } from './Room'
import { Room } from './Room'
import type { FormData } from './SideRoomForm'
import { SignInForm, SignUpForm, SubmitButton } from './SideRoomForm'
import {
  BOX_HALF_H,
  BOX_HALF_W,
  BOX_LEFT_X,
  BOX_RIGHT_X,
  BOX_SELECTED_FLOAT,
  BOX_Y,
  CHAR_FEET_TO_HEAD,
  DEBUG_R3F_ORBIT,
  FORM_GROUP_Y_SIGNIN,
  FORM_GROUP_Y_SIGNUP,
  FORM_SUBMIT_LOCAL_Y,
  gravity,
  HIT_DROP_VY,
  jump_force,
  STUN_FALL_GRAVITY_MULT,
  move_speed,
  ROOM_HALF_W,
  ROOM_HEIGHT,
  SIDE_ROOM_CENTER_X_LEFT,
  SIDE_ROOM_CENTER_X_RIGHT,
  SUBMIT_SLAB_HALF_H,
  SUBMIT_SLAB_HALF_W,
  world_bounds,
} from './constants'
import {
  charFeetAabb,
  resolveCharVsSolid,
  solidBoxFromCenter,
  type SolidBox,
} from './collisionHelpers'

import { SceneDebugControls } from './SceneDebugControls'
import { useKeyboardState } from './useKeyboardState'

// Must match the fov prop on <Canvas> in LimboScene.tsx.
const GAME_FOV_RAD = (65 * Math.PI) / 180

const FORM_ERROR_TOAST_ID = 'limbo-form-validation-toast'

/** Returns a user-facing message if Sign In is invalid, otherwise null. */
function validate_signin(form: FormData): string | null {
  if (!form.username.trim()) return 'Please enter your username.'
  if (!form.password) return 'Please enter your password.'
  return null
}

/** Returns a user-facing message if Sign Up is invalid, otherwise null. */
function validate_signup(form: FormData): string | null {
  if (!form.username.trim()) return 'Please enter your username.'
  if (!form.email?.trim()) return 'Please enter your email.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Please enter a valid email address.'
  }
  if (!form.password) return 'Please enter your password.'
  if (!form.confirmPassword) return 'Please confirm your password.'
  if (form.password !== form.confirmPassword) {
    return 'Password and confirm password do not match.'
  }
  return null
}

/**
 * Side-top error notification (fixed top-right). Auto-dismiss after a few seconds.
 * Does not freeze gameplay — only the success flow does.
 */
function show_form_validation_toast(message: string): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(FORM_ERROR_TOAST_ID)
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = FORM_ERROR_TOAST_ID
  toast.setAttribute('role', 'alert')
  toast.style.position = 'fixed'
  toast.style.top = '16px'
  toast.style.right = '16px'
  toast.style.left = 'auto'
  toast.style.maxWidth = 'min(400px, calc(100vw - 32px))'
  toast.style.padding = '14px 18px 14px 20px'
  toast.style.background = 'linear-gradient(145deg, #1e1e2a 0%, #2a1820 100%)'
  toast.style.color = '#ffc9c9'
  toast.style.border = '2px solid #c94c5c'
  toast.style.borderRadius = '12px'
  toast.style.fontFamily = '"Segoe UI", system-ui, sans-serif'
  toast.style.fontSize = '15px'
  toast.style.lineHeight = '1.45'
  toast.style.zIndex = '100000'
  toast.style.boxShadow = '0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px #0006'
  toast.style.display = 'flex'
  toast.style.alignItems = 'flex-start'
  toast.style.gap = '12px'

  const text = document.createElement('div')
  text.textContent = message
  text.style.flex = '1'

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '×'
  close.setAttribute('aria-label', 'Dismiss')
  close.style.flexShrink = '0'
  close.style.width = '28px'
  close.style.height = '28px'
  close.style.padding = '0'
  close.style.lineHeight = '26px'
  close.style.fontSize = '20px'
  close.style.cursor = 'pointer'
  close.style.border = '1px solid #c94c5c'
  close.style.borderRadius = '8px'
  close.style.background = '#13131c'
  close.style.color = '#ffc9c9'

  let timeout_id: ReturnType<typeof setTimeout> | undefined
  const remove = () => {
    if (timeout_id !== undefined) window.clearTimeout(timeout_id)
    toast.remove()
  }
  close.onclick = remove
  timeout_id = window.setTimeout(remove, 6500)

  toast.appendChild(text)
  toast.appendChild(close)
  document.body.appendChild(toast)
}

/* eslint-disable react-hooks/immutability */
export const Scene: React.FC = () => {
  const keys_ref            = useKeyboardState()
  const character_group_ref = useRef<Group>(null)
  const dir_light_ref       = useRef<DirectionalLight>(null)
  const velocity_ref        = useRef({ x: 0, y: 0 })
  const velocity_x_ref      = useRef(0)
  const character_position_ref = useRef(new Vector3(0, 0, 0))
  const is_crouching_ref    = useRef(false)  // no crouch in this level — always false
  /** After a selection/submit hit from below: no jump until feet touch floor again. */
  const jump_locked_until_floor_ref = useRef(false)
  /** While airborne after a box hit — freeze walk cycle / bob until feet hit the floor again. */
  const suppress_air_walk_ref = useRef(false)
  /** Latest vertical velocity for DemonBoy fall pose (same frame as physics). */
  const vertical_velocity_ref = useRef(0)
  /** After successful form submit — no movement until Ok reloads the page. */
  const gameplay_frozen_after_submit_ref = useRef(false)

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selected_side, set_selected_side] = useState<SelectedSide>(null)

  // ── Form state ───────────────────────────────────────────────────────────────
  const [signin_form, set_signin_form] = useState<FormData>({ username: '', password: '' })
  const [signup_form, set_signup_form] = useState<FormData>({ username: '', email: '', password: '', confirmPassword: '' })
  const [focused_field, set_focused_field] = useState<string | null>(null)
  /** Incremented on each underside hit on the SUBMIT slab — drives `SubmitButton` hit animation. */
  const [submit_hit_anim_key, set_submit_hit_anim_key] = useState(0)
  
  const handle_field_change = useCallback(
    (field: string, value: string) => {
      if (selected_side === 'left') set_signin_form((prev) => ({ ...prev, [field]: value }))
      else if (selected_side === 'right') set_signup_form((prev) => ({ ...prev, [field]: value }))
    },
    [selected_side],
  )

  const cycle_form_field = useCallback(() => {
    set_focused_field((prev) => {
      if (!selected_side) return prev
      const fields =
        selected_side === 'left'
          ? (['username', 'password'] as const)
          : (['username', 'email', 'password', 'confirmPassword'] as const)
      const cur = prev ?? fields[0]
      const idx = Math.max(0, fields.findIndex((f) => f === cur))
      return fields[(idx + 1) % fields.length]
    })
  }, [selected_side])

  const handle_form_submit = useCallback(() => {
    if (!selected_side) return
    if (gameplay_frozen_after_submit_ref.current) return

    const validation_error =
      selected_side === 'left' ? validate_signin(signin_form) : validate_signup(signup_form)
    if (validation_error) {
      show_form_validation_toast(validation_error)
      return
    }

    gameplay_frozen_after_submit_ref.current = true
    set_focused_field(null)
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    // Show a centered popup with a success message and an Ok button. Clicking "Ok" reloads the page.
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.padding = '24px 64px 40px 64px';
    popup.style.borderRadius = '20px';
    popup.style.background = 'linear-gradient(90deg,#e95420 0%,#fbdc47 50%,#43b047 100%)';
    popup.style.color = '#13121c';
    popup.style.fontSize = '2rem';
    popup.style.fontWeight = 'bold';
    popup.style.fontFamily = '"Press Start 2P", "VT323", "Consolas", monospace';
    popup.style.textShadow = '2px 2px 8px #0005';
    popup.style.boxShadow = '0 0 64px 16px #0008, 0 2px 16px #222b';
    popup.style.border = '5px solid #ffd700';
    popup.style.letterSpacing = '1.5px';
    popup.style.zIndex = '99999';
    popup.style.textAlign = 'center';
    popup.style.userSelect = 'none';

    const msg = document.createElement('div');
    msg.textContent = `Arcade done. You have successfully ${selected_side === 'left' ? 'signed in' : 'signed up'}!`;

    const btn = document.createElement('button');
    btn.textContent = 'Ok';
    btn.style.marginTop = '28px';
    btn.style.padding = '10px 34px';
    btn.style.fontFamily = '"Press Start 2P", "VT323", "Consolas", monospace';
    btn.style.fontSize = '1.2rem';
    btn.style.fontWeight = 'bold';
    btn.style.background = '#13121c';
    btn.style.color = '#ffd700';
    btn.style.border = '3px solid #ffd700';
    btn.style.borderRadius = '12px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 24px #0005';

    btn.onclick = () => {
      popup.remove();
      window.location.reload();
    };

    popup.appendChild(msg);
    popup.appendChild(btn);
    document.body.appendChild(popup);
  }, [selected_side, signin_form, signup_form, set_focused_field])

  /**
   * When side-room selection changes, clear the logical focused field.
   * Do **not** auto-focus the first `<input>` on open — that moves DOM focus to
   * an INPUT, so `typing_in_form` becomes true and WASD stops until blur (felt
   * like the game froze until a mouse click). User can Tab or click to type.
   */
  useEffect(() => {
    set_focused_field(null)
  }, [selected_side])

  /** Tab / Enter while **not** typing in an `<input>` — cycle fields or submit. */
  useEffect(() => {
    if (!selected_side) return

    const handle_key = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null
      const ae = typeof document !== 'undefined' ? document.activeElement : null
      const typing_in_dom_field =
        (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) ||
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement
      if (typing_in_dom_field) {
        // Enter in a field still submits (optional UX)
        if (event.key === 'Enter') {
          event.preventDefault()
          handle_form_submit()
        }
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        cycle_form_field()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        handle_form_submit()
      }
    }

    window.addEventListener('keydown', handle_key)
    return () => window.removeEventListener('keydown', handle_key)
  }, [selected_side, cycle_form_field, handle_form_submit])

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

  const last_submit_hit_ms_ref = useRef(0)
  const handle_form_submit_ref = useRef(handle_form_submit)
  useEffect(() => {
    handle_form_submit_ref.current = handle_form_submit
  }, [handle_form_submit])

  useFrame((state, delta) => {
    const char_pos = character_position_ref.current

    // Success popup is open — freeze the boy (no input, velocity, or physics).
    if (gameplay_frozen_after_submit_ref.current) {
      velocity_ref.current.x = 0
      velocity_ref.current.y = 0
      velocity_x_ref.current = 0
      vertical_velocity_ref.current = 0
      suppress_air_walk_ref.current = false
      if (character_group_ref.current) {
        character_group_ref.current.position.set(char_pos.x, char_pos.y, 0)
      }
      if (!DEBUG_R3F_ORBIT) {
        const in_lobby     = Math.abs(char_pos.x) <= ROOM_HALF_W
        const follow_pct   = in_lobby ? 0.22 : 0.80
        const max_cam_x    = ROOM_HALF_W * 3 - 2.5
        const target_cam_x = MathUtils.clamp(char_pos.x * follow_pct, -max_cam_x, max_cam_x)
        state.camera.position.x = MathUtils.damp(state.camera.position.x, target_cam_x, 5, delta)
        state.camera.position.y = camera_y_ref.current
        state.camera.position.z = camera_z_ref.current
        state.camera.up.set(0, 1, 0)
        state.camera.lookAt(state.camera.position.x, camera_y_ref.current, 0)
      }
      return
    }

    const typing_in_form =
      typeof document !== 'undefined' &&
      (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')

    const is_left  = keys_ref.current.ArrowLeft || keys_ref.current.a
    const is_right = keys_ref.current.ArrowRight || keys_ref.current.d
    const is_up    = keys_ref.current.ArrowUp || keys_ref.current.w

    // Game controls are disabled while a DOM input is focused so W/A/S/D don't move the boy.
    const gl = is_left && !typing_in_form
    const gr = is_right && !typing_in_form
    const gu = is_up && !typing_in_form

    // ── Horizontal movement ────────────────────────────────────────────────
    const target_vx = ((gr ? 1 : 0) - (gl ? 1 : 0)) * move_speed
    velocity_ref.current.x = MathUtils.damp(velocity_ref.current.x, target_vx, 10, delta)
    velocity_x_ref.current = velocity_ref.current.x

    const floor_top_y = 1.25  // Character lands on top of the floor platform
    const char_w = 0.3  // character half-width for collision (matches solid AABB X extent)
    const is_grounded = char_pos.y <= floor_top_y + 0.001

    const in_side_room = Math.abs(char_pos.x) > ROOM_HALF_W

    // ── Jump — disabled until feet touch floor after a selection/submit hit-drop ──
    if (gu && is_grounded && !jump_locked_until_floor_ref.current) velocity_ref.current.y = jump_force
    // Softer gravity while falling after a box hit — longer, smoother arc than a single hard snap.
    const grav =
      jump_locked_until_floor_ref.current && velocity_ref.current.y < 0
        ? gravity * STUN_FALL_GRAVITY_MULT
        : gravity
    velocity_ref.current.y -= grav * delta

    // Snapshot before integration — solid boxes use previous-frame AABB + velocity.
    const x_before = char_pos.x
    const y_before = char_pos.y

    // ── Apply velocities ───────────────────────────────────────────────────
    char_pos.x += velocity_ref.current.x * delta
    char_pos.y += velocity_ref.current.y * delta

    // Clamp X to dynamic bounds (opened side is unrestricted).
    char_pos.x = MathUtils.clamp(char_pos.x, effective_bounds.current.minX, effective_bounds.current.maxX)

    // Land on floor top — unlock jump after a hit-drop.
    if (char_pos.y < floor_top_y) {
      char_pos.y = floor_top_y
      velocity_ref.current.y = 0
      jump_locked_until_floor_ref.current = false
    }

    // ── Solid selection + submit slabs (cannot pass through; underside hit = drop + stun) ─────────
    const prevAabb = charFeetAabb(x_before, y_before, char_w, CHAR_FEET_TO_HEAD)
    const left_cy = (selected_side === 'left' ? BOX_Y + BOX_SELECTED_FLOAT : BOX_Y)
    const right_cy = (selected_side === 'right' ? BOX_Y + BOX_SELECTED_FLOAT : BOX_Y)
    const left_box = solidBoxFromCenter(BOX_LEFT_X, left_cy, BOX_HALF_W, BOX_HALF_H)
    const right_box = solidBoxFromCenter(BOX_RIGHT_X, right_cy, BOX_HALF_W, BOX_HALF_H)

    let submit_box: SolidBox | null = null
    if (in_side_room && selected_side) {
      const form_anchor_y =
        selected_side === 'left'
          ? room_height / 2 + FORM_GROUP_Y_SIGNIN
          : room_height / 2 + FORM_GROUP_Y_SIGNUP
      const submit_cx =
        selected_side === 'left' ? SIDE_ROOM_CENTER_X_LEFT : SIDE_ROOM_CENTER_X_RIGHT
      const submit_cy = form_anchor_y + FORM_SUBMIT_LOCAL_Y
      submit_box = solidBoxFromCenter(submit_cx, submit_cy, SUBMIT_SLAB_HALF_W, SUBMIT_SLAB_HALF_H)
    }

    const solid_eps = 0.035

    /** Apply AABB resolution; underside hits cancel horizontal air motion + jump until floor. */
    const apply_solid = (box: SolidBox, on_underside?: () => void) => {
      const r = resolveCharVsSolid(
        char_pos.x,
        char_pos.y,
        velocity_ref.current,
        prevAabb,
        box,
        char_w,
        CHAR_FEET_TO_HEAD,
        solid_eps,
      )
      if (r.kind === 'none') return
      char_pos.x = r.x
      char_pos.y = r.y
      if (r.kind === 'bottom_hit') {
        velocity_ref.current.y = HIT_DROP_VY
        velocity_ref.current.x = 0
        velocity_x_ref.current = 0
        jump_locked_until_floor_ref.current = true
        on_underside?.()
      } else if (r.kind === 'land_top') {
        velocity_ref.current.y = 0
      } else {
        velocity_ref.current.x = 0
        velocity_x_ref.current = 0
      }
    }

    apply_solid(left_box, () => set_selected_side('left'))
    apply_solid(right_box, () => set_selected_side('right'))
    if (submit_box) {
      apply_solid(submit_box, () => {
        set_submit_hit_anim_key((k) => k + 1)
        const now = performance.now()
        if (now - last_submit_hit_ms_ref.current > 1800) {
          last_submit_hit_ms_ref.current = now
          handle_form_submit_ref.current()
        }
      })
    }

    // Re-snap floor if a solid shoved us down (stay on top of platform).
    if (char_pos.y < floor_top_y) {
      char_pos.y = floor_top_y
      velocity_ref.current.y = 0
      jump_locked_until_floor_ref.current = false
    }

    // Freeze in-air walk animation until feet land on the floor after a box hit.
    suppress_air_walk_ref.current =
      jump_locked_until_floor_ref.current && char_pos.y > floor_top_y + 0.002

    vertical_velocity_ref.current = velocity_ref.current.y

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
      
      {/* ── Sign In Form — world X must match `Room` SideRoom centre (-15) ─── */}
      {selected_side === 'left' && (
        <group position={[SIDE_ROOM_CENTER_X_LEFT, room_height / 2 + FORM_GROUP_Y_SIGNIN, 0]}>
          <SignInForm
            formData={signin_form}
            focusedField={focused_field}
            onFocusField={set_focused_field}
            onFieldChange={handle_field_change}
          />
          <SubmitButton hitAnimKey={submit_hit_anim_key} />
        </group>
      )}

      {/* ── Sign Up Form — world X = +15 ───────────────────────────────────── */}
      {selected_side === 'right' && (
        <group position={[SIDE_ROOM_CENTER_X_RIGHT, room_height / 2 + FORM_GROUP_Y_SIGNUP, 0]}>
          <SignUpForm
            formData={signup_form}
            focusedField={focused_field}
            onFocusField={set_focused_field}
            onFieldChange={handle_field_change}
          />
          <SubmitButton hitAnimKey={submit_hit_anim_key} />
        </group>
      )}
      
      <SceneDebugControls enabled={DEBUG_R3F_ORBIT} dirLightRef={dir_light_ref} />
      <group ref={character_group_ref}>
        <DemonBoy
          position={new Vector3(0, 0, 0)}
          is_crouching_ref={is_crouching_ref}
          velocity_x_ref={velocity_x_ref}
          suppress_air_walk_ref={suppress_air_walk_ref}
          vertical_velocity_ref={vertical_velocity_ref}
          keys_ref={keys_ref}
          modelScale={1}
          groundOffsetY={-0.02}
          walkBobIntensity={0.025}
          crouchScaleY={0.78}
          silhouetteColor="#0d0e10"
        />
      </group>
    </>
  )
}
