'use client'

import createGlobe from 'cobe'
import { MapPinIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useSpring } from 'react-spring'

function LocationCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)
  const fadeMask = 'radial-gradient(circle at 50% 50%, rgb(0, 0, 0) 50%, rgb(0, 0, 0, 0) 70%)'

  const [{ r }, api] = useSpring(() => ({
    r: 0,
    config: {
      mass: 1,
      tension: 280,
      friction: 40,
      precision: 0.001,
    },
  }))

  useEffect(() => {
    if (!canvasRef.current)
      return

    const width = canvasRef.current.offsetWidth
    if (!width)
      return

    let globe: ReturnType<typeof createGlobe> | null = null
    let animFrameId: number | null = null

    globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.5,
      mapSamples: 12_000,
      mapBrightness: 12,
      baseColor: [0.4, 0.4, 0.4],
      markerColor: [1, 1, 1],
      glowColor: [0.3, 0.6, 1],
      markers: [{ location: [22.535449017108995, 114.07374367580996], size: 0.1 }],
      scale: 1.05,
    })

    // cobe v2 has no internal animation loop — we must drive rendering manually.
    // This also ensures the globe re-renders after the internal texture (world map)
    // finishes loading asynchronously.
    const animate = () => {
      globe?.update({
        phi: 2.75 + r.get(),
        width: width * 2,
        height: width * 2,
      })
      animFrameId = requestAnimationFrame(animate)
    }
    animFrameId = requestAnimationFrame(animate)

    return () => {
      if (animFrameId !== null)
        cancelAnimationFrame(animFrameId)
      globe?.destroy()
    }
  }, [])

  return (
    <div className="shadow-feature-card dark:shadow-feature-card-dark relative flex h-60 flex-col gap-6 overflow-hidden rounded-xl p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <MapPinIcon className="size-[18px]" />
        <h2 className="text-sm font-light">北京</h2>
      </div>
      <div className="absolute inset-x-0 bottom-[-190px] mx-auto aspect-square h-[388px] [@media(max-width:420px)]:bottom-[-140px] [@media(max-width:420px)]:h-[320px] [@media(min-width:768px)_and_(max-width:858px)]:h-[350px]">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            placeItems: 'center',
            placeContent: 'center',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '1/1',
              maxWidth: 800,
              WebkitMaskImage: fadeMask,
              maskImage: fadeMask,
            }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                pointerInteracting.current = e.clientX - pointerInteractionMovement.current
                canvasRef.current && (canvasRef.current.style.cursor = 'grabbing')
              }}
              onPointerUp={() => {
                pointerInteracting.current = null
                canvasRef.current && (canvasRef.current.style.cursor = 'grab')
              }}
              onPointerOut={() => {
                pointerInteracting.current = null
                canvasRef.current && (canvasRef.current.style.cursor = 'grab')
              }}
              onMouseMove={(e) => {
                if (pointerInteracting.current !== null) {
                  const delta = e.clientX - pointerInteracting.current
                  pointerInteractionMovement.current = delta
                  void api.start({
                    r: delta / 200,
                  })
                }
              }}
              onTouchMove={(e) => {
                if (pointerInteracting.current !== null && e.touches[0]) {
                  const delta = e.touches[0].clientX - pointerInteracting.current
                  pointerInteractionMovement.current = delta
                  void api.start({
                    r: delta / 100,
                  })
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                contain: 'layout paint size',
                cursor: 'auto',
                userSelect: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationCard
