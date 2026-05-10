import React, { useEffect, useRef, useState } from 'react'
import { useBackgrounds } from '../context/BackgroundContext'

export default function BackgroundRenderer() {
  const { blobs } = useBackgrounds()
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const raf = useRef(null)
  const latest = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      latest.current = { x: e.clientX, y: e.clientY }
      if (!raf.current) {
        raf.current = requestAnimationFrame(() => {
          raf.current = null
          setCursor(latest.current)
        })
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden">
      {blobs.map((b, i) => {
        const size = (b.size || 30) + 'vmin'
        const left = (b.x ?? 50) + '%'
        const top = (b.y ?? 50) + '%'
        
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              width: size,
              height: size,
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              filter: 'blur(60px)',
              opacity: b.opacity ?? 0.25,
              background: `radial-gradient(circle at 30% 30%, ${b.color || '#ff00aa'} 0%, rgba(255,255,255,0) 70%)`
            }}
          />
        )
      })}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(520px 520px at ${cursor.x}px ${cursor.y}px, rgba(214, 61, 107, 0.20), transparent 65%),
            radial-gradient(360px 360px at ${cursor.x + 180}px ${cursor.y + 120}px, rgba(242, 183, 73, 0.15), transparent 65%),
            radial-gradient(300px 300px at ${cursor.x - 160}px ${cursor.y + 160}px, rgba(38, 100, 121, 0.12), transparent 65%)
          `
        }}
      />
    </div>
  )
}
