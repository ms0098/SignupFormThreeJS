import { useEffect, useRef } from 'react'
import type * as React from 'react'
import type { KeyState } from './types'

/** True when the user is typing in a field — game must not call preventDefault on letter keys. */
function is_editable_focused(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el) return false
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  return false
}

function clear_game_keys(k: KeyState): void {
  k.ArrowLeft = false
  k.ArrowRight = false
  k.ArrowUp = false
  k.ArrowDown = false
  k.w = false
  k.a = false
  k.s = false
  k.d = false
}

export function useKeyboardState(): React.MutableRefObject<KeyState> {
  const keys_ref = useRef<KeyState>({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    w: false,
    a: false,
    s: false,
    d: false,
  })

  useEffect(() => {
    const handle_key = (is_down: boolean) => (event: KeyboardEvent): void => {
      // Let W/A/S/D and arrows type into focused inputs — never preventDefault there.
      if (is_editable_focused()) {
        clear_game_keys(keys_ref.current)
        return
      }

      let key_name = event.key
      if (key_name.length === 1) key_name = key_name.toLowerCase()
      if (!(key_name in keys_ref.current)) return

      event.preventDefault()
      const k = keys_ref.current
      switch (key_name) {
        case 'ArrowLeft':
          k.ArrowLeft = is_down
          break
        case 'ArrowRight':
          k.ArrowRight = is_down
          break
        case 'ArrowUp':
          k.ArrowUp = is_down
          break
        case 'ArrowDown':
          k.ArrowDown = is_down
          break
        case 'w':
          k.w = is_down
          break
        case 'a':
          k.a = is_down
          break
        case 's':
          k.s = is_down
          break
        case 'd':
          k.d = is_down
          break
        default:
          break
      }
    }

    const handle_key_down = handle_key(true)
    const handle_key_up = handle_key(false)

    window.addEventListener('keydown', handle_key_down)
    window.addEventListener('keyup', handle_key_up)

    return () => {
      window.removeEventListener('keydown', handle_key_down)
      window.removeEventListener('keyup', handle_key_up)
    }
  }, [])

  return keys_ref
}
