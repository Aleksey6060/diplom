import React, { useEffect, useRef } from 'react'
import { Copy, Trash2, RotateCw } from 'lucide-react'
import { useTheme } from '../context/useTheme'
import { useAuth } from '../context/AuthContext'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function BackgroundImagesLayer({ mode = 'app' }) {
  const {
    bgImages,
    bgImageEditMode,
    activeBgImageId,
    setActiveBgImageId,
    updateBgImage,
    deleteBgImage,
    cloneBgImage
  } = useTheme()
  const { isAdmin } = useAuth()

  const dragRef = useRef(null)
  const rotateRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      dragRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!bgImageEditMode) {
      dragRef.current = null
      rotateRef.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [bgImageEditMode])

  const startDrag = (e, img) => {
    if (!bgImageEditMode) return
    if (e.button !== undefined && e.button !== 0) return

    if (e.target instanceof Element) {
      if (e.target.closest('button')) return
      if (e.target.closest('[data-bgimg-control="true"]')) return
    }

    e.preventDefault()
    setActiveBgImageId(img.id)

    const startX = e.clientX
    const startY = e.clientY
    const startXPct = typeof img.x === 'number' ? img.x : 50
    const startYPct = typeof img.y === 'number' ? img.y : 50

    dragRef.current = {
      id: img.id,
      pointerId: e.pointerId,
      startX,
      startY,
      startXPct,
      startYPct,
      latestX: startX,
      latestY: startY
    }

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      void 0
    }
  }

  const onPointerMove = (e) => {
    const r = rotateRef.current
    if (r) {
      if (r.pointerId !== undefined && e.pointerId !== r.pointerId) return
      r.latestX = e.clientX
      r.latestY = e.clientY

      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const cur = rotateRef.current
        if (!cur) return
        const angle = Math.atan2(cur.latestY - cur.centerY, cur.latestX - cur.centerX)
        const delta = angle - cur.startAngle
        const nextRotation = cur.startRotation + (delta * 180) / Math.PI
        updateBgImage(cur.id, { rotation: nextRotation })
      })
      return
    }

    const d = dragRef.current
    if (!d) return
    if (d.pointerId !== undefined && e.pointerId !== d.pointerId) return
    d.latestX = e.clientX
    d.latestY = e.clientY

    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const cur = dragRef.current
      if (!cur) return
      const dx = cur.latestX - cur.startX
      const dy = cur.latestY - cur.startY
      const w = Math.max(1, window.innerWidth || 1)
      const h = Math.max(1, window.innerHeight || 1)
      const nextX = cur.startXPct + (dx / w) * 100
      const nextY = cur.startYPct + (dy / h) * 100
      updateBgImage(cur.id, {
        x: clamp(nextX, -20, 120),
        y: clamp(nextY, -20, 120)
      })
    })
  }

  const onPointerUp = (e) => {
    const r = rotateRef.current
    if (r) {
      if (r.pointerId !== undefined && e.pointerId !== r.pointerId) return
      rotateRef.current = null
      return
    }

    const d = dragRef.current
    if (!d) return
    if (d.pointerId !== undefined && e.pointerId !== d.pointerId) return
    dragRef.current = null
  }

  const handleWheel = (e, img) => {
    if (!bgImageEditMode) return
    if (activeBgImageId !== img.id) return
    e.preventDefault()
    const currentScale = typeof img.scale === 'number' ? img.scale : 1
    const delta = -e.deltaY * 0.0015
    const next = clamp(currentScale + delta, 0.1, 5)
    updateBgImage(img.id, { scale: next })
  }

  const images = (Array.isArray(bgImages) ? bgImages : [])
    .filter(img => typeof img?.src === 'string' && img.src)
    .filter(img => {
      if (bgImageEditMode) return true
      const v = img && typeof img === 'object' && img.visibility && typeof img.visibility === 'object' ? img.visibility : {}
      const welcome = typeof v.welcome === 'boolean' ? v.welcome : false
      const auth = typeof v.auth === 'boolean' ? v.auth : false
      const user = typeof v.user === 'boolean' ? v.user : true
      const admin = typeof v.admin === 'boolean' ? v.admin : true

      if (mode === 'welcome') return welcome
      if (mode === 'auth') return auth
      return isAdmin ? admin : user
    })

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: bgImageEditMode ? 100 : -15,
        pointerEvents: bgImageEditMode ? 'auto' : 'none'
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {images.map(img => {
        const isActive = activeBgImageId === img.id
        const x = typeof img.x === 'number' ? img.x : 50
        const y = typeof img.y === 'number' ? img.y : 50
        const scale = typeof img.scale === 'number' ? img.scale : 1
        const rotation = typeof img.rotation === 'number' ? img.rotation : 0

        return (
          <div
            key={img.id}
            data-bgimg-root="true"
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
              transformOrigin: 'center center',
              userSelect: 'none',
              touchAction: 'none',
              outline: bgImageEditMode && isActive ? '2px solid rgba(16, 185, 129, 0.8)' : 'none',
              outlineOffset: 6
            }}
            onPointerDown={(e) => startDrag(e, img)}
            onClick={(e) => {
              e.stopPropagation()
              if (bgImageEditMode) setActiveBgImageId(img.id)
            }}
            onWheel={(e) => handleWheel(e, img)}
          >
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                display: 'block',
                maxWidth: '60vmin',
                maxHeight: '60vmin',
                borderRadius: 16,
                boxShadow: bgImageEditMode ? '0 18px 60px rgba(0,0,0,0.25)' : 'none'
              }}
            />

            {bgImageEditMode && isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: -16,
                  right: -16,
                  display: 'flex',
                  gap: 8,
                  pointerEvents: 'auto'
                }}
              >
                <button
                  data-bgimg-control="true"
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    const root = e.currentTarget.closest('[data-bgimg-root="true"]')
                    if (!(root instanceof HTMLElement)) return
                    const rect = root.getBoundingClientRect()
                    const centerX = rect.left + rect.width / 2
                    const centerY = rect.top + rect.height / 2
                    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
                    const startRotation = typeof img.rotation === 'number' ? img.rotation : 0
                    rotateRef.current = {
                      id: img.id,
                      pointerId: e.pointerId,
                      centerX,
                      centerY,
                      startAngle,
                      startRotation,
                      latestX: e.clientX,
                      latestY: e.clientY
                    }
                    try {
                      e.currentTarget.setPointerCapture?.(e.pointerId)
                    } catch {
                      void 0
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-white/90 border border-white/60 shadow-lg flex items-center justify-center text-[#0f2e3a] hover:bg-white"
                  title="Повернуть (зажми и крути)"
                >
                  <RotateCw size={18} />
                </button>
                <button
                  data-bgimg-control="true"
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    cloneBgImage(img.id)
                  }}
                  className="w-10 h-10 rounded-full bg-white/90 border border-white/60 shadow-lg flex items-center justify-center text-[#0f2e3a] hover:bg-white"
                  title="Клонировать"
                >
                  <Copy size={18} />
                </button>
                <button
                  data-bgimg-control="true"
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteBgImage(img.id)
                  }}
                  className="w-10 h-10 rounded-full bg-rose-600 border border-rose-600/40 shadow-lg flex items-center justify-center text-white hover:brightness-110"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
