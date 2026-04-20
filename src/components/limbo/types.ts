export interface KeyState {
  ArrowLeft: boolean
  ArrowRight: boolean
  ArrowUp: boolean
  ArrowDown: boolean
  w: boolean  // move up/forward (same as ArrowUp)
  a: boolean  // move left (same as ArrowLeft)
  s: boolean  // move down/backward (same as ArrowDown)
  d: boolean  // move right (same as ArrowRight)
}
