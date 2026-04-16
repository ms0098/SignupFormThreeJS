import { GizmoHelper, GizmoViewport, Grid, OrbitControls, useHelper } from '@react-three/drei'
import type * as React from 'react'
import type { DirectionalLight, Object3D } from 'three'
import { DirectionalLightHelper } from 'three'

interface SceneDebugControlsProps {
  /** When true, OrbitControls owns the camera and helpers are shown. */
  enabled: boolean
  /** Same ref as the scene directional light so you can see its direction. */
  dirLightRef: React.RefObject<DirectionalLight | null>
}

/**
 * Drei helpers for inspecting lighting and camera orientation while tuning the scene.
 * Toggle via `DEBUG_R3F_ORBIT` in `constants.ts` (or wire to UI later).
 */
export const SceneDebugControls: React.FC<SceneDebugControlsProps> = ({ enabled, dirLightRef }) => {
  // Yellow helper line shows where the directional light points from its origin.
  useHelper(
    (enabled ? dirLightRef : false) as React.RefObject<Object3D> | false,
    DirectionalLightHelper,
    1.25,
    '#ffb020',
  )

  if (!enabled) return null

  return (
    <>
      {/* Mouse: drag orbit, wheel zoom, right-drag pan (default three.js controls). */}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />

      {/* Ground-aligned grid at the same height as the silhouette ground plane. */}
      <Grid
        position={[0, -1.19, 0]}
        infiniteGrid
        fadeDistance={55}
        fadeStrength={1}
        sectionSize={3}
        sectionColor="#6a6d74"
        cellSize={0.5}
        cellColor="#2c2e33"
      />

      {/* Corner gizmo: world X/Y/Z so you can read camera/light direction vs axes. */}
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport axisColors={['#ff3653', '#0adb50', '#2d8eff']} labelColor="white" />
      </GizmoHelper>
    </>
  )
}
