import React, { useEffect, useRef } from 'react'
import initFluid from '../lib/fluidSim.js'
import { useTheme } from '../context/useTheme'

export default function FluidBackground({ zIndex = -25 }) {
  const { showCursorEffect } = useTheme()
  const canvasRef = useRef(null)
  const apiRef = useRef(null)
  const attemptsRef = useRef(0)
  const rafStartRef = useRef(0)

  useEffect(() => {
    if (!showCursorEffect) {
      apiRef.current?.dispose?.()
      apiRef.current = null
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
    }
    resize()
    window.addEventListener('resize', resize)

    const canStart = () => {
      const rect = canvas.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && document.visibilityState === 'visible'
    }
    const start = () => {
      if (!canStart()) {
        attemptsRef.current += 1
        const delay = Math.min(800, 100 * attemptsRef.current)
        setTimeout(start, delay)
        return
      }
      attemptsRef.current = 0
      try {
        apiRef.current?.dispose?.()
        apiRef.current = initFluid(canvas, {
          TRANSPARENT: true,
          BLOOM: true,
          BLOOM_INTENSITY: 0.16,
          BLOOM_THRESHOLD: 0.82,
          BLOOM_SOFT_KNEE: 0.55,
          BLOOM_RESOLUTION: 128,
          SUNRAYS: false,
          SPLAT_FORCE: 2400,
          SPLAT_RADIUS: 0.26,
          DENSITY_DISSIPATION: 0.990,
          VELOCITY_DISSIPATION: 0.38,
          PRESSURE: 0.35,
          PRESSURE_ITERATIONS: 10,
          CURL: 4,
        })
      } catch {
        attemptsRef.current += 1
        const delay = Math.min(1200, 200 * attemptsRef.current)
        setTimeout(start, delay)
      }
    }
    rafStartRef.current = requestAnimationFrame(start)

    return () => {
      window.removeEventListener('resize', resize)
      apiRef.current?.dispose?.()
      apiRef.current = null
      if (rafStartRef.current) cancelAnimationFrame(rafStartRef.current)
    }
  }, [showCursorEffect])

  return (
    <canvas 
      ref={canvasRef} 
      className="fluid" 
      aria-hidden 
      style={{ 
        zIndex, 
        pointerEvents: 'none',
        opacity: showCursorEffect ? 1 : 0,
        transition: 'opacity 0.5s ease-in-out'
      }} 
    />
  )
}
