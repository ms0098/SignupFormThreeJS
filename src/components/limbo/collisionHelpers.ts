/**
 * Axis-aligned character vs solid box (2.5D side view — character at z ≈ 0).
 * Feet at `pos.y`; collision height extends to head (`headY` above feet).
 */

export interface Aabb2D {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface SolidBox extends Aabb2D {
  centerX: number
  centerY: number
}

export interface VelocityXY {
  x: number
  y: number
}

export function solidBoxFromCenter(cx: number, cy: number, halfW: number, halfH: number): SolidBox {
  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: cy - halfH,
    maxY: cy + halfH,
    centerX: cx,
    centerY: cy,
  }
}

export function charFeetAabb(posX: number, posY: number, halfW: number, headY: number): Aabb2D {
  return {
    minX: posX - halfW,
    maxX: posX + halfW,
    minY: posY,
    maxY: posY + headY,
  }
}

export function aabbOverlap2D(a: Aabb2D, b: Aabb2D): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
}

export type SolidResolveKind = 'none' | 'bottom_hit' | 'land_top' | 'side' | 'push'

/**
 * Push `char` out of `box` when overlapping. Uses previous-frame AABB + velocity
 * to choose bottom / top / side so the boy cannot tunnel through.
 */
export function resolveCharVsSolid(
  charX: number,
  charY: number,
  vel: VelocityXY,
  prev: Aabb2D,
  box: SolidBox,
  halfW: number,
  headY: number,
  eps: number,
): { kind: SolidResolveKind; x: number; y: number } {
  const cur = charFeetAabb(charX, charY, halfW, headY)
  if (!aabbOverlap2D(cur, box)) return { kind: 'none', x: charX, y: charY }

  let x = charX
  let y = charY

  // 1) Underside hit — was entirely below bottom face, moving up into the box.
  if (prev.maxY <= box.minY + eps && vel.y > 0) {
    y = box.minY - headY - eps
    return { kind: 'bottom_hit', x, y }
  }

  // 2) Land on top — feet were above the slab, falling through the top face.
  if (prev.minY >= box.maxY - eps && vel.y <= 0) {
    y = box.maxY
    return { kind: 'land_top', x, y }
  }

  // 3) Side — approach from left / right before overlap.
  if (prev.maxX <= box.minX + eps && cur.maxX > box.minX) {
    x = box.minX - halfW - eps
    return { kind: 'side', x, y }
  }
  if (prev.minX >= box.maxX - eps && cur.minX < box.maxX) {
    x = box.maxX + halfW + eps
    return { kind: 'side', x, y }
  }

  // 4) Still overlapping (corner / tunnel): shove out by smallest axis penetration.
  const penX = Math.min(cur.maxX - box.minX, box.maxX - cur.minX)
  const penY = Math.min(cur.maxY - box.minY, box.maxY - cur.minY)

  if (penX < penY) {
    if (x < box.centerX) x = box.minX - halfW - eps
    else x = box.maxX + halfW + eps
    return { kind: 'side', x, y }
  }

  const midY = y + headY * 0.5
  if (midY < box.centerY) {
    y = box.minY - headY - eps
    return { kind: 'bottom_hit', x, y }
  }
  y = box.maxY
  return { kind: 'land_top', x, y }
}
