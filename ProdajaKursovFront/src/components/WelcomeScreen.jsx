import React from 'react'
import { motion as Motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../context/useTheme'

export default function WelcomeScreen({ onDismiss }) {
  const { welcomeTexts } = useTheme()
  const handleViewCourses = () => {
    if (onDismiss) onDismiss()
  }
  const items = Array.isArray(welcomeTexts) && welcomeTexts.length > 0 ? welcomeTexts : null
  return (
    <Motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ y: '-100%', transition: { duration: 0.9, ease: 'easeInOut' } }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-transparent"
    >
      <div className="absolute inset-0 z-10 px-4 flex flex-col justify-center">
        {items ? (
          <div className="relative w-full h-full" style={{ containerType: 'inline-size' }}>
            {items.map(it => {
              const id = String(it?.id || '')
              const text = String(it?.text || '')
              const x = Number.isFinite(Number(it?.x)) ? Number(it.x) : 50
              const y = Number.isFinite(Number(it?.y)) ? Number(it.y) : 35
              const w = Number.isFinite(Number(it?.width)) ? Number(it.width) : 60
              const r = Number.isFinite(Number(it?.rotate)) ? Number(it.rotate) : 0
              const align = (it?.align === 'center' || it?.align === 'right') ? it.align : 'left'
              const fs = Number.isFinite(Number(it?.fontSizeVw)) ? Number(it.fontSizeVw) : 6
              const tx = align === 'right' ? -100 : align === 'center' ? -50 : 0
              const color = String(it?.color || '').trim()
              const weight = Number.isFinite(Number(it?.weight)) ? Number(it.weight) : 800
              if (!id) return null
              return (
                <div
                  key={id}
                  className="absolute"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${Math.max(5, Math.min(95, w))}%`,
                    transform: `translate(${tx}%, -50%) rotate(${r}deg)`,
                    transformOrigin: 'center',
                    textAlign: align,
                    color: color || 'var(--content-text)',
                    fontWeight: weight,
                    fontSize: `clamp(18px, ${fs}vw, 320px)`,
                    lineHeight: 1.05,
                    whiteSpace: 'pre-wrap',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                >
                  {text}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={handleViewCourses}
          className="inline-flex items-center gap-2 px-6 py-3 border rounded-full transition hover:brightness-110"
          style={{
            backgroundColor: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            borderColor: 'var(--btn-primary-border)'
          }}
        >
          <span>Войти</span>
          <ChevronDown size={18} className="opacity-80" />
        </button>
      </div>

    </Motion.div>
  )
}
