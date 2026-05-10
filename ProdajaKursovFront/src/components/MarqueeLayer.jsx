import React, { useMemo } from 'react'
import { motion as Motion } from 'framer-motion'
import { useTheme } from '../context/useTheme'
import { useAuth } from '../context/AuthContext'

const toFontFamily = (key) => {
  if (key === 'serif') return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
  if (key === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  return 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
}

export default function MarqueeLayer({ mode = 'app' }) {
  const { marquees } = useTheme()
  const { isAdmin } = useAuth()

  const layout = useMemo(() => {
    if (mode === 'welcome') return { rotate: -12, scale: 1.25, opacity: 0.1 }
    if (mode === 'auth') return { rotate: -12, scale: 1.15, opacity: 0.08 }
    return { rotate: -6, scale: 1.1, opacity: 0.06 }
  }, [mode])

  const rows = useMemo(() => {
    const list = Array.isArray(marquees) ? marquees : []
    return list
      .filter(r => r && typeof r === 'object')
      .filter(r => {
        const v = r.visibility && typeof r.visibility === 'object' ? r.visibility : {}
        const welcome = typeof v.welcome === 'boolean' ? v.welcome : false
        const auth = typeof v.auth === 'boolean' ? v.auth : false
        const user = typeof v.user === 'boolean' ? v.user : false
        const admin = typeof v.admin === 'boolean' ? v.admin : false
        if (mode === 'welcome') return welcome
        if (mode === 'auth') return auth
        return isAdmin ? admin : user
      })
  }, [marquees, mode, isAdmin])

  if (rows.length === 0) return null

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{
        zIndex: -12
      }}
    >
      <div
        className="absolute inset-0 flex flex-col justify-center items-center gap-4 md:gap-8 select-none"
        style={{
          transform: `rotate(${layout.rotate}deg) scale(${layout.scale})`,
          opacity: layout.opacity
        }}
      >
        {rows.map((row) => {
          const direction = row.direction === -1 ? -1 : 1
          const duration = typeof row.duration === 'number' ? row.duration : 30
          const repeat = typeof row.repeat === 'number' ? row.repeat : 20
          const fontSize = typeof row.fontSize === 'number' ? row.fontSize : 140
          const fontWeight = typeof row.fontWeight === 'number' ? row.fontWeight : 900
          const letterSpacing = typeof row.letterSpacing === 'number' ? row.letterSpacing : -0.02
          const color = typeof row.color === 'string' ? row.color : '#0f2e3a'
          const opacity = typeof row.opacity === 'number' ? row.opacity : 1
          const stroke = !!row.stroke
          const strokeWidth = typeof row.strokeWidth === 'number' ? row.strokeWidth : (stroke ? 2 : 0)
          const fontFamily = toFontFamily(row.fontFamily)
          const text = typeof row.text === 'string' ? row.text : 'OSNOVA'

          return (
            <div key={row.id} className="flex overflow-hidden relative w-[200vw] -ml-[50vw]">
              <Motion.div
                className="flex gap-12 whitespace-nowrap"
                animate={{ x: direction > 0 ? ['-50%', '0%'] : ['0%', '-50%'] }}
                transition={{ duration, ease: 'linear', repeat: Infinity }}
                style={{
                  fontFamily,
                  fontWeight,
                  fontSize,
                  letterSpacing: `${letterSpacing}em`
                }}
              >
                {Array(repeat).fill(text).map((t, i) => (
                  <span
                    key={`${row.id}_${i}`}
                    className="inline-block uppercase tracking-tighter"
                    style={{
                      color: stroke ? 'transparent' : color,
                      opacity,
                      WebkitTextStroke: stroke && strokeWidth > 0 ? `${strokeWidth}px ${color}` : undefined
                    }}
                  >
                    {t}
                  </span>
                ))}
              </Motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
