import { useEffect, useRef } from 'react'
import type * as React from 'react'
import type { KeyState } from './types'

export function useKeyboardState(): React.MutableRefObject<KeyState> {
  const keys_ref = useRef<KeyState>({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
  })

  useEffect(() => {
    // Keep keyboard handling in one place so scene logic stays clean.
    const handle_key = (is_down: boolean) => (event: KeyboardEvent): void => {
      const key_name = event.key as keyof KeyState
      if (!(key_name in keys_ref.current)) return

      event.preventDefault()
      keys_ref.current[key_name] = is_down
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
