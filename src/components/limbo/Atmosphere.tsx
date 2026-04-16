import type * as React from 'react'
import type { DirectionalLight } from 'three'

interface AtmosphereProps {
  dirLightRef?: React.RefObject<DirectionalLight | null>
}

/**
 * Limbo-style atmosphere:
 * - Bright washed-out sky background
 * - Dense close fog in the same colour so distant geometry hazes into white
 * - HemisphereLight (bright sky / dark ground) gives silhouette shading with no extra point lights
 */
export const Atmosphere: React.FC<AtmosphereProps> = ({ dirLightRef }) => (
  <>
    {/* Bright overcast sky — Limbo's signature look */}
    <color attach="background" args={['#c4cad3']} />

    {/* Fog matching background: starts at 8 u (just past mid-scene), hazes out quickly */}
    <fog attach="fog" args={['#c4cad3', 8, 26]} />

    {/* Main lighting: sky is bright, ground is very dark → top surfaces lit, undersides dark */}
    <hemisphereLight args={['#d2d8e4', '#1c2028', 1.15]} />

    {/* Kept only for the yellow debug helper in SceneDebugControls — very dim so it doesn't flatten the silhouettes */}
    <directionalLight
      ref={dirLightRef}
      position={[2, 8, 6]}
      intensity={0.12}
      color="#e8ecf4"
    />
  </>
)
