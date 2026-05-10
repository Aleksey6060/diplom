import React from 'react'

export default function StudentBanner({ src, fit = 'cover', heightPx = 280 }) {
  if (!src) return null

  return (
    <div
      className="mx-4 rounded-3xl overflow-hidden border border-white/10 student-banner"
      style={{ height: heightPx }}
    >
      {fit === 'contain' ? (
        <div className="relative w-full h-full">
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-45" draggable={false} />
          <img src={src} alt="" className="relative w-full h-full object-contain" draggable={false} />
        </div>
      ) : (
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      )}
    </div>
  )
}
