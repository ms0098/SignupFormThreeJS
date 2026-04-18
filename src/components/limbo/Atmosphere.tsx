import type * as React from 'react'
import type { DirectionalLight } from 'three'

interface AtmosphereProps {
  dirLightRef?: React.RefObject<DirectionalLight | null>
}

/**
 * Atmosphere — dark room aesthetic:
 * - Background matches room interior so no white ever shows outside the geometry
 * - Fog matches background so any distant geometry fades to dark, not white
 * - Lighting keeps walls visible while preserving the moody dark-room feel
 */
export const Atmosphere: React.FC<AtmosphereProps> = ({ dirLightRef }) => (
  <>
    {/* Dark background — matches room interior; any gap outside the room is invisible */}
    <color attach="background" args={['#1a1c24']} />

    {/* Dark fog so distant/outside geometry fades to the same dark background, not white */}
    <fog attach="fog" args={['#1a1c24', 18, 42]} />

    {/* Hemisphere: dim but present ambient — sky slightly cool, ground near-black */}
    <hemisphereLight args={['#4a5060', '#0e1016', 1.4]} />

    {/* Main key light from above/front — lights wall and floor faces from the camera side */}
    <directionalLight
      ref={dirLightRef}
      position={[0, 7, 10]}
      intensity={1.2}
      color="#e0e8f4"
    />

    {/* Soft fill from the left so the right wall face gets some light too */}
    <directionalLight
      position={[-5, 3, 5]}
      intensity={0.5}
      color="#b0bcd0"
    />
  </>
)
