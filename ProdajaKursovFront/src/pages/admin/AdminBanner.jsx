import React, { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

export default function AdminBanner() {
  const [ratioInfo, setRatioInfo] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setLoading] = useState(false)
  const [banner, setBanner] = useState(null)
  const [previewFit, setPreviewFit] = useState('cover')

  const enabled = !!banner?.is_active
  const src = banner?.image || ''
  const fit = previewFit === 'contain' ? 'contain' : 'cover'

  const ratioOk = useMemo(() => {
    if (!ratioInfo) return true
    return !ratioInfo.toLowerCase().includes('не')
  }, [ratioInfo])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await api.banner.manage()
        if (!cancelled) setBanner(data && typeof data === 'object' ? data : null)
      } catch {
        if (!cancelled) setBanner(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const onPick = async (file) => {
    setError('')
    setRatioInfo('')
    if (!file) return
    if (!file.type || !file.type.startsWith('image/')) {
      setError('Выбери изображение')
      return
    }

    const dims = await new Promise((resolve) => {
      try {
        const objectUrl = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 })
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          resolve({ w: 0, h: 0 })
        }
        img.src = objectUrl
      } catch {
        resolve({ w: 0, h: 0 })
      }
    })

    const w = Number(dims.w || 0)
    const h = Number(dims.h || 0)
    let nextFit = 'cover'
    if (w > 0 && h > 0) {
      const ratio = w / h
      const target = 16 / 3
      const diff = Math.abs(ratio - target) / target
      if (diff > 0.12) {
        setRatioInfo(`Соотношение сторон ${w}×${h} (≈ ${ratio.toFixed(2)}). Рекомендуется 16:3 (≈ ${(target).toFixed(2)}).`)
        nextFit = 'contain'
      } else {
        setRatioInfo(`Соотношение сторон ${w}×${h} подходит для 16:3.`)
        nextFit = 'cover'
      }
    }
    setPreviewFit(nextFit)

    setLoading(true)
    try {
      const saved = await api.banner.upload(file, { is_active: true })
      setBanner(saved && typeof saved === 'object' ? saved : null)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.image?.[0] || 'Не удалось загрузить изображение'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="admin-card rounded-3xl p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <ImageIcon size={20} />
          </div>
          <div>
            <div className="text-xl font-bold">Управление баннером</div>
            <div className="text-sm text-[#5a7280] mt-1">Баннер показывается студентам между верхним хедером и пользовательским хедером.</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-[#5a7280]">Рекомендуемый формат: 16:3 (например 1600×300 или 1920×360).</div>
          <button
            type="button"
            onClick={async () => {
              setError('')
              if (!src) return
              setLoading(true)
              try {
                const saved = await api.banner.toggle(!enabled)
                setBanner(saved && typeof saved === 'object' ? saved : null)
              } catch (e) {
                const msg = e?.body?.detail || 'Не удалось изменить видимость'
                setError(String(msg))
              } finally {
                setLoading(false)
              }
            }}
            className={`w-full sm:w-auto px-4 h-11 rounded-xl border font-semibold transition disabled:opacity-60 ${enabled ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-[var(--content-text)] hover:bg-white/10'}`}
            disabled={!src || isLoading}
          >
            {enabled ? 'Включено' : 'Выключено'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm font-bold">Загрузка</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPick(e.target.files && e.target.files[0])}
              className="block w-full text-sm text-white/80 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-white/20 file:bg-white/10 file:text-white/90 file:cursor-pointer hover:file:bg-white/15"
            />
            {error && <div className="text-sm text-rose-300">{error}</div>}
            {ratioInfo && <div className={`text-sm ${ratioOk ? 'text-emerald-200' : 'text-amber-200'}`}>{ratioInfo}</div>}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={async () => {
                  setError('')
                  if (!src) return
                  setLoading(true)
                  try {
                    await api.banner.remove()
                    setBanner(null)
                  } catch (e) {
                    const msg = e?.body?.detail || 'Не удалось удалить баннер'
                    setError(String(msg))
                  } finally {
                    setLoading(false)
                  }
                }}
                className="w-full sm:w-auto px-4 h-11 rounded-xl bg-rose-600 border border-rose-600/40 text-white hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-60"
                disabled={!src || isLoading}
              >
                <Trash2 size={16} />
                Удалить
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="text-sm font-bold">Превью</div>
            <div className="rounded-3xl overflow-hidden border border-white/10" style={{ aspectRatio: '16 / 3', background: 'var(--surface-bg)' }}>
              {src ? (
                fit === 'contain' ? (
                  <div className="relative w-full h-full">
                    <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-40" draggable={false} />
                    <img src={src} alt="" className="relative w-full h-full object-contain" draggable={false} />
                  </div>
                ) : (
                  <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[var(--content-text-muted)]">
                  {isLoading ? 'Загрузка…' : 'Баннер не загружен'}
                </div>
              )}
            </div>
            <div className="text-xs text-[var(--content-text-muted)]">Высота в интерфейсе: примерно как 5 хедеров.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
