import { Canvas } from '@react-three/fiber'
import type * as React from 'react'
import { Suspense } from 'react'
import { Scene } from './Scene'

interface LimboSceneProps {
  className?: string
}

export const LimboScene: React.FC<LimboSceneProps> = ({ className = '' }) => {
  const scene_class_name = ['scene-root', className].filter(Boolean).join(' ')

  return (
    <main className={scene_class_name}>
      {/* z=12, fov=65 frames the full 15-unit wide room with a little headroom. */}
      <Canvas
        camera={{ position: [0, 2.2, 12], fov: 65 }}
        // style={{ maxWidth: 1200, minWidth: 945, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
      >
        {/* Suspense catches async Text font loads from @react-three/drei. */}
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div className="hint">
        Lobby: ← → or A/D · ↑/W jump. Side room: type in fields (WASD paused while typing) · Enter submits · or jump on SUBMIT
      </div>
    </main>
  )
}
