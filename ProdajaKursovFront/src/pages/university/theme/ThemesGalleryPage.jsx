import React, { useMemo } from 'react'
import { Palette } from 'lucide-react'
import { useTheme } from '../../../context/useTheme'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'

export default function ThemesGalleryPage() {
  const { savedThemes, applyThemePreset, showCursorEffect, updateTheme } = useTheme()
  const { isAdmin } = useAuth()

  const themes = useMemo(() => {
    const list = Array.isArray(savedThemes) ? savedThemes : []
    return list.filter(t => t && typeof t === 'object' && (isAdmin || t.published))
  }, [savedThemes, isAdmin])

  return (
    <div className="min-h-screen px-4 pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Palette size={20} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--content-text)]">Внешний вид</h1>
        </div>

        <div className="admin-card rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-bold text-[var(--content-text)]">Анимация курсора</div>
              <div className="text-sm text-[var(--content-text-muted)] mt-1">Включает/выключает интерактивный эффект на фоне.</div>
            </div>
            <button
              type="button"
              onClick={() => updateTheme({ showCursorEffect: !showCursorEffect })}
              className={`h-11 px-4 rounded-xl border font-semibold flex items-center justify-center whitespace-nowrap shrink-0 ${showCursorEffect ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-[var(--content-text)]'}`}
            >
              {showCursorEffect ? 'Включено' : 'Выключено'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-lg font-bold text-[var(--content-text)]">Темы</div>
          {themes.length === 0 ? (
            <div className="admin-card rounded-3xl p-6">
              <div className="text-lg font-bold text-[var(--content-text)]">Нет доступных тем</div>
              <div className="text-sm text-[var(--content-text-muted)] mt-1">Администратор может включить “Отображать тему” у нужной темы.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themes.map(t => (
                <div key={t.id} className="admin-card rounded-3xl p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xl font-bold truncate text-[var(--content-text)]">{t.name || 'Тема'}</div>
                      {!isAdmin && t.published && <div className="text-sm text-[var(--content-text-muted)] mt-1">Отображается</div>}
                      {isAdmin && <div className="text-sm text-[var(--content-text-muted)] mt-1">{t.published ? 'Отображается' : 'Скрыта'}</div>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try { await api.users.updateMe({ appearance_theme: t.id }) } catch { void 0 }
                        const keepCursor = !!showCursorEffect
                        applyThemePreset(t.id)
                        updateTheme({ showCursorEffect: keepCursor })
                      }}
                      className="px-4 py-2 rounded-xl border"
                    >
                      Применить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
