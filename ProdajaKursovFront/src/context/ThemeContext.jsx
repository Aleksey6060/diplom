import React, { createContext, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { getAuthTokens } from '../lib/api'

export const ThemeContext = createContext()

const DEFAULT_THEME = {
  header: { 
    type: 'gradient', 
    colors: ['#266479', '#f2b749', '#d63d6b', '#6da04b'], 
    angle: 100,
    softness: 0
  },
  searchBar: {
    type: 'gradient',
    colors: ['#266479', '#f2b749', '#d63d6b', '#6da04b'], 
    angle: 100,
    softness: 0
  },
  siteBg: { type: 'solid', colors: ['#e6f1f6'], angle: 100, softness: 0 },
  contentText: { primary: '#0f2e3a', muted: '#5a7280', scheduleConflictErrorText: 'Преподаватель занят в это время. Выберите другую пару.' },
  primaryButtons: { bg: '#0f2e3a', text: '#ffffff' },
  successButtons: { bg: '#059669', text: '#ffffff' },
  dangerButtons: { bg: '#dc2626', text: '#ffffff' },
  surfaces: { color: '#ffffff', alpha: 0.85 },
  eduFilter: { color: '#ffffff', alpha: 0.08 },
  bgImages: [],
  marquees: [],
  brandText: 'OSNOVA',
  logo: { src: '', size: 32, radius: 999, padding: 0, objectFit: 'cover', bgAlpha: 0.1, borderAlpha: 0.1 },
  welcomeTexts: [],
  showCursorEffect: true
}

const BG_DB_NAME = 'site_theme_db_v1'
const BG_DB_STORE = 'bg_images'

const openBgDb = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(BG_DB_NAME, 1)
      req.onupgradeneeded = () => {
        try {
          const db = req.result
          if (!db.objectStoreNames.contains(BG_DB_STORE)) {
            db.createObjectStore(BG_DB_STORE)
          }
        } catch {
          void 0
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

const withBgStore = async (mode, fn) => {
  const db = await openBgDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BG_DB_STORE, mode)
      const store = tx.objectStore(BG_DB_STORE)
      const res = fn(store)
      tx.oncomplete = () => resolve(res)
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

const putBgImage = async (id, src) => {
  if (!id || !src) return
  await withBgStore('readwrite', (store) => {
    try { store.put(src, id) } catch { void 0 }
    return null
  })
}

const getBgImage = async (id) => {
  if (!id) return ''
  const db = await openBgDb()
  if (!db) return ''
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BG_DB_STORE, 'readonly')
      const store = tx.objectStore(BG_DB_STORE)
      const req = store.get(id)
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : '')
      req.onerror = () => resolve('')
    } catch {
      resolve('')
    }
  })
}

const deleteBgImageFromDb = async (id) => {
  if (!id) return
  await withBgStore('readwrite', (store) => {
    try { store.delete(id) } catch { void 0 }
    return null
  })
}

const clearBgImagesDb = async () => {
  await withBgStore('readwrite', (store) => {
    try { store.clear() } catch { void 0 }
    return null
  })
}

const hexToRgba = (hex, alpha) => {
  const raw = String(hex || '').trim()
  const h = raw.startsWith('#') ? raw.slice(1) : raw
  let r = 0
  let g = 0
  let b = 0
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16)
    g = parseInt(h[1] + h[1], 16)
    b = parseInt(h[2] + h[2], 16)
  } else if (h.length >= 6) {
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else {
    return `rgba(15, 46, 58, ${alpha})`
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(15, 46, 58, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const ThemeProvider = ({ children }) => {
  const location = useLocation()
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [savedThemes, setSavedThemes] = useState([])

  const [bgImageEditMode, setBgImageEditMode] = useState(false)
  const [activeBgImageId, setActiveBgImageId] = useState(null)
  const storedBgIdsRef = useRef(new Set())
  const loadedBgIdsRef = useRef(new Set())
  const themeImagesRef = useRef(theme.bgImages)
  const bgLoadRetryTimerRef = useRef(null)
  const bgLoadRetryCountRef = useRef(new Map())
  const appearanceScopeRef = useRef({ universitySlug: null })
  const appearanceHydratedRef = useRef(false)
  const skipNextAppearanceSaveRef = useRef(false)
  const appearanceSaveTimerRef = useRef(null)
  const themeMetaPatchTimersRef = useRef(new Map())
  const canManageAppearanceRef = useRef(false)
  const lastAppliedUserThemeIdRef = useRef(null)

  const getUniversitySlugFromPathname = (pathname) => {
    const seg = String(pathname || '').split('/').filter(Boolean)[0] || ''
    if (!seg) return null
    const reserved = new Set([
      'admin',
      'teacher',
      'courses',
      'overview',
      'my-courses',
      'payments',
      'schedule',
      'archived',
      'recent',
      'settings',
      'chat',
      'theme',
      'appearance',
      'themes',
      'grades',
      'progress',
    ])
    if (reserved.has(seg)) return null
    return seg
  }

  const universitySlug = getUniversitySlugFromPathname(location?.pathname || '')

  useEffect(() => {
    appearanceScopeRef.current = { universitySlug }
    try {
      if (universitySlug) {
        localStorage.setItem('last_university_slug', universitySlug)
      }
    } catch { void 0 }
  }, [universitySlug])

  useEffect(() => {
    themeImagesRef.current = theme.bgImages
  }, [theme.bgImages])

  useEffect(() => {
    if (bgImageEditMode) {
      document.body.classList.add('bg-image-edit-mode')
    } else {
      document.body.classList.remove('bg-image-edit-mode')
    }
    return () => document.body.classList.remove('bg-image-edit-mode')
  }, [bgImageEditMode])

  

  useEffect(() => {
    let cancelled = false
    if (bgLoadRetryTimerRef.current) {
      clearTimeout(bgLoadRetryTimerRef.current)
      bgLoadRetryTimerRef.current = null
    }
    const run = async () => {
      const images = Array.isArray(theme.bgImages) ? theme.bgImages : []
      const toStore = images.filter(img => img?.id && typeof img.src === 'string' && img.src && !storedBgIdsRef.current.has(img.id))
      for (const img of toStore) {
        if (cancelled) return
        await putBgImage(img.id, img.src)
        storedBgIdsRef.current.add(img.id)
      }

      const missing = images.filter(img => img?.id && (!img.src || typeof img.src !== 'string') && !loadedBgIdsRef.current.has(img.id))
      if (missing.length === 0) return
      const entries = await Promise.all(missing.map(async (img) => [img.id, await getBgImage(img.id)]))
      if (cancelled) return
      const map = new Map(entries.filter(([, src]) => !!src))
      map.forEach((_, id) => loadedBgIdsRef.current.add(id))
      missing.forEach(m => {
        const id = m.id
        if (!id) return
        const prev = bgLoadRetryCountRef.current.get(id) || 0
        bgLoadRetryCountRef.current.set(id, prev + 1)
      })
      if (map.size === 0) return
      setTheme(prev => ({
        ...prev,
        bgImages: (Array.isArray(prev.bgImages) ? prev.bgImages : [])
          .map(img => (img?.id && map.has(img.id)) ? { ...img, src: map.get(img.id) } : img)
          .filter(img => img?.id && typeof img.src === 'string' && img.src)
      }))
    }
    run()
    const hasPending = (Array.isArray(theme.bgImages) ? theme.bgImages : []).some(img => img?.id && (!img.src || typeof img.src !== 'string') && !loadedBgIdsRef.current.has(img.id))
    if (hasPending) {
      const pendingIds = (Array.isArray(theme.bgImages) ? theme.bgImages : [])
        .filter(img => img?.id && (!img.src || typeof img.src !== 'string') && !loadedBgIdsRef.current.has(img.id))
        .map(img => img.id)
      const shouldRetry = pendingIds.some(id => (bgLoadRetryCountRef.current.get(id) || 0) < 10)
      if (shouldRetry) {
        bgLoadRetryTimerRef.current = setTimeout(() => {
          bgLoadRetryTimerRef.current = null
          if (cancelled) return
          run()
        }, 500)
      }
    }
    return () => { cancelled = true }
  }, [theme.bgImages])

  useEffect(() => {
    // Apply styles via CSS variables on :root
    const root = document.documentElement

    // Helper to generate background string
    const getBgString = (config) => {
      if (!config) return 'transparent'
      if (config.type === 'solid') return Array.isArray(config.colors) && config.colors[0] ? config.colors[0] : 'transparent'
      const colors = Array.isArray(config.colors) ? config.colors.filter(Boolean) : []
      if (colors.length === 0) return 'transparent'
      const angle = Number.isFinite(Number(config.angle)) ? Number(config.angle) : 0
      const rawStops = Array.isArray(config.stops) ? config.stops.map(v => Number(v)).filter(v => Number.isFinite(v)) : []
      const useStops = !!config.useStops
      if (useStops && colors.length >= 2 && rawStops.length === colors.length - 1) {
        const n = colors.length
        const base = Array.from({ length: n }, (_, i) => (i * 100) / (n - 1))
        const minGap = 1
        const softness = Number.isFinite(Number(config.softness)) ? Number(config.softness) : 0
        const softenK = Math.min(1, Math.max(0, softness / 100))
        const hints = rawStops.map((v, i) => {
          const min = base[i] + minGap
          const max = base[i + 1] - minGap
          const clamped = Math.min(max, Math.max(min, v))
          const mid = (base[i] + base[i + 1]) / 2
          const softened = clamped * (1 - softenK) + mid * softenK
          return Math.round(Math.min(max, Math.max(min, softened)) * 10) / 10
        })
        const parts = []
        parts.push(`${colors[0]} ${base[0]}%`)
        for (let i = 0; i < n - 1; i++) {
          parts.push(`${hints[i]}%`)
          parts.push(`${colors[i + 1]} ${base[i + 1]}%`)
        }
        return `linear-gradient(${angle}deg, ${parts.join(', ')})`
      }
      return `linear-gradient(${angle}deg, ${colors.join(', ')})`
    }

    const alpha01 = Math.min(1, Math.max(0, Number(theme.surfaces && theme.surfaces.alpha !== undefined ? theme.surfaces.alpha : 0.85)))
    const surfaceColor = (theme.surfaces && theme.surfaces.color) ? theme.surfaces.color : '#ffffff'
    const eduFilterAlpha = Math.min(1, Math.max(0, Number(theme.eduFilter && theme.eduFilter.alpha !== undefined ? theme.eduFilter.alpha : DEFAULT_THEME.eduFilter.alpha)))
    const eduFilterColor = (theme.eduFilter && theme.eduFilter.color) ? theme.eduFilter.color : DEFAULT_THEME.eduFilter.color

    root.style.setProperty('--site-bg', getBgString(theme.siteBg))
    root.style.setProperty('--header-bg', getBgString(theme.header))
    root.style.setProperty('--search-bg', getBgString(theme.searchBar))
    root.style.setProperty('--content-text', (theme.contentText && theme.contentText.primary) ? theme.contentText.primary : '#0f2e3a')
    root.style.setProperty('--content-text-muted', (theme.contentText && theme.contentText.muted) ? theme.contentText.muted : '#5a7280')
    root.style.setProperty('--btn-primary-bg', (theme.primaryButtons && theme.primaryButtons.bg) ? theme.primaryButtons.bg : '#0f2e3a')
    root.style.setProperty('--btn-primary-text', (theme.primaryButtons && theme.primaryButtons.text) ? theme.primaryButtons.text : '#ffffff')
    root.style.setProperty('--btn-primary-border', hexToRgba((theme.primaryButtons && theme.primaryButtons.bg) ? theme.primaryButtons.bg : '#0f2e3a', 0.3))
    root.style.setProperty('--btn-success-bg', (theme.successButtons && theme.successButtons.bg) ? theme.successButtons.bg : '#059669')
    root.style.setProperty('--btn-success-text', (theme.successButtons && theme.successButtons.text) ? theme.successButtons.text : '#ffffff')
    root.style.setProperty('--btn-success-border', hexToRgba((theme.successButtons && theme.successButtons.bg) ? theme.successButtons.bg : '#059669', 0.35))
    root.style.setProperty('--btn-danger-bg', (theme.dangerButtons && theme.dangerButtons.bg) ? theme.dangerButtons.bg : '#dc2626')
    root.style.setProperty('--btn-danger-text', (theme.dangerButtons && theme.dangerButtons.text) ? theme.dangerButtons.text : '#ffffff')
    root.style.setProperty('--btn-danger-border', hexToRgba((theme.dangerButtons && theme.dangerButtons.bg) ? theme.dangerButtons.bg : '#dc2626', 0.35))
    root.style.setProperty('--surface-bg', hexToRgba(surfaceColor, alpha01))
    root.style.setProperty('--surface-bg-strong', hexToRgba(surfaceColor, Math.min(1, alpha01 + 0.03)))
    root.style.setProperty('--edu-filter-bg', hexToRgba(eduFilterColor, eduFilterAlpha))
    root.style.setProperty('--edu-filter-border', hexToRgba(eduFilterColor, Math.min(1, eduFilterAlpha + 0.08)))
    
    // Also apply site background to body to be sure
    document.body.style.background = getBgString(theme.siteBg)
    if (theme.siteBg.type !== 'solid') {
      document.body.style.backgroundAttachment = 'fixed'
    }

    if (!appearanceHydratedRef.current) return
    if (!canManageAppearanceRef.current) return
    if (skipNextAppearanceSaveRef.current) {
      skipNextAppearanceSaveRef.current = false
      return
    }

    if (appearanceSaveTimerRef.current) {
      clearTimeout(appearanceSaveTimerRef.current)
      appearanceSaveTimerRef.current = null
    }

    const { universitySlug: scopeSlug } = appearanceScopeRef.current || { universitySlug: null }
    const payload = {
      header: theme.header,
      siteBg: theme.siteBg,
      searchBar: theme.searchBar,
      contentText: theme.contentText,
      primaryButtons: theme.primaryButtons,
      successButtons: theme.successButtons,
      dangerButtons: theme.dangerButtons,
      surfaces: theme.surfaces,
      eduFilter: theme.eduFilter,
      bgImages: (Array.isArray(theme.bgImages) ? theme.bgImages : []).map(({ id, src, x, y, scale, rotation, visibility }) => ({ id, src, x, y, scale, rotation, visibility })),
      marquees: Array.isArray(theme.marquees) ? theme.marquees : [],
      brandText: typeof theme.brandText === 'string' ? theme.brandText : DEFAULT_THEME.brandText,
      logo: theme.logo && typeof theme.logo === 'object' ? theme.logo : DEFAULT_THEME.logo,
      welcomeTexts: Array.isArray(theme.welcomeTexts) ? theme.welcomeTexts : [],
      showCursorEffect: !!theme.showCursorEffect
    }
    appearanceSaveTimerRef.current = setTimeout(() => {
      appearanceSaveTimerRef.current = null
      api.appearance.updateSettings(payload, { universitySlug: scopeSlug }).catch(() => {})
    }, 500)
  }, [theme])

  function exportThemeConfig(sourceTheme = theme) {
    const t = sourceTheme && typeof sourceTheme === 'object' ? sourceTheme : DEFAULT_THEME
    return {
      header: t.header,
      siteBg: t.siteBg,
      searchBar: t.searchBar,
      contentText: t.contentText,
      primaryButtons: t.primaryButtons,
      successButtons: t.successButtons,
      dangerButtons: t.dangerButtons,
      surfaces: t.surfaces,
      eduFilter: t.eduFilter,
      bgImages: (Array.isArray(t.bgImages) ? t.bgImages : []).map(({ id, src, x, y, scale, rotation, visibility }) => ({ id, src, x, y, scale, rotation, visibility })),
      marquees: Array.isArray(t.marquees) ? t.marquees : [],
      brandText: typeof t.brandText === 'string' ? t.brandText : DEFAULT_THEME.brandText,
      logo: t.logo && typeof t.logo === 'object' ? t.logo : DEFAULT_THEME.logo,
      welcomeTexts: Array.isArray(t.welcomeTexts) ? t.welcomeTexts : [],
      showCursorEffect: !!t.showCursorEffect
    }
  }

  const flushAppearanceSave = async (overrideTheme = null) => {
    if (!canManageAppearanceRef.current) return null
    if (appearanceSaveTimerRef.current) {
      clearTimeout(appearanceSaveTimerRef.current)
      appearanceSaveTimerRef.current = null
    }
    const { universitySlug: scopeSlug } = appearanceScopeRef.current || { universitySlug: null }
    const payload = exportThemeConfig(overrideTheme || theme)
    return api.appearance.updateSettings(payload, { universitySlug: scopeSlug })
  }

  const normalizeThemeConfig = (parsed) => {
    const merged = { ...DEFAULT_THEME, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
    const normalizeFill = (value, fallback) => {
      const base = value && typeof value === 'object' ? value : {}
      const fb = fallback && typeof fallback === 'object' ? fallback : { type: 'solid', colors: ['#ffffff'], angle: 0 }
      const type = base.type === 'solid' ? 'solid' : (base.type === 'gradient' ? 'gradient' : fb.type)
      const colors = Array.isArray(base.colors) && base.colors.length > 0
        ? base.colors.map(c => (typeof c === 'string' && c.trim() ? c.trim() : '#ffffff'))
        : (Array.isArray(fb.colors) ? fb.colors : ['#ffffff'])
      const angle = typeof base.angle === 'number' ? base.angle : (typeof fb.angle === 'number' ? fb.angle : 0)
      const useStops = typeof base.useStops === 'boolean' ? base.useStops : false
      const stops = Array.isArray(base.stops) ? base.stops.map(v => Number(v)).filter(v => Number.isFinite(v)) : []
      const softness = Number.isFinite(Number(base.softness)) ? Number(base.softness) : (Number.isFinite(Number(fb.softness)) ? Number(fb.softness) : 0)
      return { ...fb, ...base, type, colors, angle, useStops, stops, softness }
    }
    merged.header = normalizeFill(merged.header, DEFAULT_THEME.header)
    merged.searchBar = normalizeFill(merged.searchBar, DEFAULT_THEME.searchBar)
    merged.siteBg = normalizeFill(merged.siteBg, DEFAULT_THEME.siteBg)
    merged.contentText = { ...DEFAULT_THEME.contentText, ...(merged.contentText && typeof merged.contentText === 'object' ? merged.contentText : {}) }
    merged.primaryButtons = { ...DEFAULT_THEME.primaryButtons, ...(merged.primaryButtons && typeof merged.primaryButtons === 'object' ? merged.primaryButtons : {}) }
    merged.successButtons = { ...DEFAULT_THEME.successButtons, ...(merged.successButtons && typeof merged.successButtons === 'object' ? merged.successButtons : {}) }
    merged.dangerButtons = { ...DEFAULT_THEME.dangerButtons, ...(merged.dangerButtons && typeof merged.dangerButtons === 'object' ? merged.dangerButtons : {}) }
    merged.surfaces = { ...DEFAULT_THEME.surfaces, ...(merged.surfaces && typeof merged.surfaces === 'object' ? merged.surfaces : {}) }
    merged.eduFilter = { ...DEFAULT_THEME.eduFilter, ...(merged.eduFilter && typeof merged.eduFilter === 'object' ? merged.eduFilter : {}) }
    merged.brandText = typeof merged.brandText === 'string' ? merged.brandText : DEFAULT_THEME.brandText
    {
      const base = merged.logo && typeof merged.logo === 'object' ? merged.logo : {}
      const src = typeof base.src === 'string' ? base.src : ''
      const size = Number.isFinite(Number(base.size)) ? Number(base.size) : DEFAULT_THEME.logo.size
      const radius = Number.isFinite(Number(base.radius)) ? Number(base.radius) : DEFAULT_THEME.logo.radius
      const padding = Number.isFinite(Number(base.padding)) ? Number(base.padding) : DEFAULT_THEME.logo.padding
      const objectFit = base.objectFit === 'contain' ? 'contain' : 'cover'
      const bgAlpha = Math.min(1, Math.max(0, Number.isFinite(Number(base.bgAlpha)) ? Number(base.bgAlpha) : DEFAULT_THEME.logo.bgAlpha))
      const borderAlpha = Math.min(1, Math.max(0, Number.isFinite(Number(base.borderAlpha)) ? Number(base.borderAlpha) : DEFAULT_THEME.logo.borderAlpha))
      merged.logo = { src, size: Math.round(Math.min(96, Math.max(16, size))), radius: Math.min(999, Math.max(0, radius)), padding: Math.round(Math.min(24, Math.max(0, padding))), objectFit, bgAlpha, borderAlpha }
    }
    merged.welcomeTexts = Array.isArray(merged.welcomeTexts) ? merged.welcomeTexts : []

    const usedMarqueeIds = new Set()
    const nextMarquees = (Array.isArray(merged.marquees) ? merged.marquees : DEFAULT_THEME.marquees)
      .map((row, idx) => {
        const obj = row && typeof row === 'object' ? row : {}
        let id = typeof obj.id === 'string' ? obj.id : ''
        if (!id || usedMarqueeIds.has(id)) id = `mq_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`
        usedMarqueeIds.add(id)
        const text = typeof obj.text === 'string' ? obj.text : 'OSNOVA'
        const duration = typeof obj.duration === 'number' ? obj.duration : 30
        const direction = obj.direction === -1 ? -1 : 1
        const repeat = typeof obj.repeat === 'number' ? obj.repeat : 20
        const fontFamily = typeof obj.fontFamily === 'string' ? obj.fontFamily : 'system'
        const fontWeight = typeof obj.fontWeight === 'number' ? obj.fontWeight : 900
        const fontSize = typeof obj.fontSize === 'number' ? obj.fontSize : 140
        const letterSpacing = typeof obj.letterSpacing === 'number' ? obj.letterSpacing : -0.02
        const color = typeof obj.color === 'string' ? obj.color : '#0f2e3a'
        const opacity = typeof obj.opacity === 'number' ? obj.opacity : 1
        const stroke = typeof obj.stroke === 'boolean' ? obj.stroke : false
        const strokeWidth = typeof obj.strokeWidth === 'number' ? obj.strokeWidth : (stroke ? 2 : 0)
        const visObj = obj.visibility && typeof obj.visibility === 'object' ? obj.visibility : {}
        const visibility = {
          welcome: typeof visObj.welcome === 'boolean' ? visObj.welcome : true,
          auth: typeof visObj.auth === 'boolean' ? visObj.auth : false,
          user: typeof visObj.user === 'boolean' ? visObj.user : false,
          admin: typeof visObj.admin === 'boolean' ? visObj.admin : false
        }
        return { id, text, duration, direction, repeat, fontFamily, fontWeight, fontSize, letterSpacing, color, opacity, stroke, strokeWidth, visibility }
      })

    const used = new Set()
    const prevImages = Array.isArray(themeImagesRef.current) ? themeImagesRef.current : []
    const prevSrcById = new Map(prevImages.filter(x => x?.id && typeof x.src === 'string' && x.src).map(x => [x.id, x.src]))
    const nextImages = (Array.isArray(merged.bgImages) ? merged.bgImages : [])
      .map((img, idx) => {
        const obj = img && typeof img === 'object' ? img : {}
        let id = typeof obj.id === 'string' ? obj.id : ''
        if (!id || used.has(id)) id = `bgimg_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`
        used.add(id)
        const x = typeof obj.x === 'number' ? obj.x : 50
        const y = typeof obj.y === 'number' ? obj.y : 50
        const scale = typeof obj.scale === 'number' ? obj.scale : 1
        const rotation = typeof obj.rotation === 'number' ? obj.rotation : 0
        const src = typeof obj.src === 'string' ? obj.src : (prevSrcById.get(id) || '')
        const visObj = obj.visibility && typeof obj.visibility === 'object' ? obj.visibility : {}
        const visibility = {
          welcome: typeof visObj.welcome === 'boolean' ? visObj.welcome : false,
          auth: typeof visObj.auth === 'boolean' ? visObj.auth : false,
          user: typeof visObj.user === 'boolean' ? visObj.user : true,
          admin: typeof visObj.admin === 'boolean' ? visObj.admin : true
        }
        return { id, src, x, y, scale, rotation, visibility }
      })

    return { ...merged, marquees: nextMarquees, bgImages: nextImages }
  }

  const applyThemeConfig = (config) => {
    const next = normalizeThemeConfig(config)
    const prevImages = Array.isArray(themeImagesRef.current) ? themeImagesRef.current : []
    const keep = new Set((Array.isArray(next.bgImages) ? next.bgImages : []).map(x => x.id))
    prevImages.forEach(img => {
      if (img?.id && !keep.has(img.id)) {
        deleteBgImageFromDb(img.id)
        storedBgIdsRef.current.delete(img.id)
        loadedBgIdsRef.current.delete(img.id)
      }
    })
    setTheme(prev => ({ ...prev, ...next }))
  }

  const mapThemeFromApi = (row) => {
    const id = row?.id != null ? String(row.id) : ''
    return {
      id,
      name: String(row?.name || '').trim() || 'Тема',
      published: !!row?.published,
      createdAt: row?.created_at || new Date().toISOString(),
      updatedAt: row?.updated_at || row?.created_at || new Date().toISOString(),
      config: row?.settings && typeof row.settings === 'object' ? row.settings : {},
    }
  }

  useEffect(() => {
    let cancelled = false
    appearanceHydratedRef.current = false
    canManageAppearanceRef.current = false
    lastAppliedUserThemeIdRef.current = null
    try {
      const raw = localStorage.getItem('glassroom_user')
      const parsed = raw ? JSON.parse(raw) : null
      const cachedType = String(parsed?.account_type || '')
      const cachedSuper = !!parsed?.is_superuser
      canManageAppearanceRef.current = cachedSuper || cachedType === 'owner' || cachedType === 'university_owner' || cachedType === 'employee'
    } catch { void 0 }
    ;(async () => {
      try {
        const [settingsRes, themesRes] = await Promise.all([
          api.appearance.settings({ universitySlug }),
          api.appearance.themes.list({ universitySlug }),
        ])
        if (cancelled) return
        const settings = settingsRes && typeof settingsRes === 'object' ? (settingsRes.settings || {}) : {}
        skipNextAppearanceSaveRef.current = true
        applyThemeConfig(settings)
        const list = Array.isArray(themesRes) ? themesRes : (Array.isArray(themesRes?.results) ? themesRes.results : [])
        const mappedThemes = list.map(mapThemeFromApi).filter(t => t.id)
        setSavedThemes(mappedThemes)
        appearanceHydratedRef.current = true

        const tokens = getAuthTokens()
        if (!tokens) return
        if (canManageAppearanceRef.current) return
        try {
          const me = await api.users.me()
          if (cancelled) return
          const accountType = String(me?.account_type || '')
          canManageAppearanceRef.current = accountType === 'owner' || accountType === 'university_owner' || accountType === 'employee'

          if (accountType === 'student' || accountType === 'teacher') {
            const preferredId = me?.appearance_theme != null ? String(me.appearance_theme) : null
            if (!preferredId) return
            if (lastAppliedUserThemeIdRef.current === preferredId) return
            const found = mappedThemes.find(t => String(t?.id) === preferredId)
            if (!found || !found.config) return
            lastAppliedUserThemeIdRef.current = preferredId
            skipNextAppearanceSaveRef.current = true
            applyThemeConfig(found.config)
          }
        } catch { void 0 }
      } catch {
        if (cancelled) return
        appearanceHydratedRef.current = true
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  useEffect(() => {
    const onTokensUpdate = () => {
      if (!appearanceHydratedRef.current) return
      if (canManageAppearanceRef.current) return
      try {
        const raw = localStorage.getItem('glassroom_user')
        const parsed = raw ? JSON.parse(raw) : null
        const cachedType = String(parsed?.account_type || '')
        const cachedSuper = !!parsed?.is_superuser
        canManageAppearanceRef.current = cachedSuper || cachedType === 'owner' || cachedType === 'university_owner' || cachedType === 'employee'
        if (canManageAppearanceRef.current) return
      } catch { void 0 }
      const tokens = getAuthTokens()
      if (!tokens) return
      const currentThemes = Array.isArray(savedThemes) ? savedThemes : []
      if (currentThemes.length === 0) return
      ;(async () => {
        try {
          const me = await api.users.me()
          const accountType = String(me?.account_type || '')
          canManageAppearanceRef.current = accountType === 'owner' || accountType === 'university_owner' || accountType === 'employee'
          if (accountType !== 'student' && accountType !== 'teacher') return
          const preferredId = me?.appearance_theme != null ? String(me.appearance_theme) : null
          if (!preferredId) return
          if (lastAppliedUserThemeIdRef.current === preferredId) return
          const found = currentThemes.find(t => String(t?.id) === preferredId)
          if (!found || !found.config) return
          lastAppliedUserThemeIdRef.current = preferredId
          skipNextAppearanceSaveRef.current = true
          applyThemeConfig(found.config)
        } catch { void 0 }
      })()
    }
    window.addEventListener('auth_tokens_update', onTokensUpdate)
    return () => window.removeEventListener('auth_tokens_update', onTokensUpdate)
  }, [savedThemes])

  const saveThemePreset = async ({ name, published }) => {
    if (!canManageAppearanceRef.current) {
      throw new Error('Недостаточно прав.')
    }
    const { universitySlug: scopeSlug } = appearanceScopeRef.current || { universitySlug: null }
    const payload = {
      name: String(name || '').trim() || 'Тема',
      published: !!published,
      settings: exportThemeConfig(theme),
    }
    const created = await api.appearance.themes.create(payload, { universitySlug: scopeSlug })
    const mapped = mapThemeFromApi(created)
    setSavedThemes(prev => [mapped, ...(Array.isArray(prev) ? prev : []).filter(t => String(t?.id) !== String(mapped.id))])
    return mapped.id || null
  }

  const updateThemePreset = (id, updates) => {
    if (!canManageAppearanceRef.current) return
    if (!id) return
    setSavedThemes(prev => (Array.isArray(prev) ? prev : []).map(t => {
      if (String(t?.id) !== String(id)) return t
      const next = { ...t, ...updates, updatedAt: new Date().toISOString() }
      if (updates && Object.prototype.hasOwnProperty.call(updates, 'name')) {
        next.name = String(updates.name || '').trim() || 'Тема'
      }
      if (updates && Object.prototype.hasOwnProperty.call(updates, 'published')) {
        next.published = !!updates.published
      }
      if (updates && Object.prototype.hasOwnProperty.call(updates, 'config')) {
        next.config = (updates.config && typeof updates.config === 'object') ? updates.config : {}
      }
      return next
    }))

    const { universitySlug: scopeSlug } = appearanceScopeRef.current || { universitySlug: null }
    const payload = {}
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'name')) payload.name = String(updates.name || '').trim() || 'Тема'
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'published')) payload.published = !!updates.published
    if (updates && Object.prototype.hasOwnProperty.call(updates, 'config')) {
      payload.settings = (updates.config && typeof updates.config === 'object') ? updates.config : {}
      api.appearance.themes.update(id, payload, { universitySlug: scopeSlug })
        .then((row) => {
          const mapped = mapThemeFromApi(row)
          setSavedThemes(prev => (Array.isArray(prev) ? prev : []).map(t => String(t?.id) === String(id) ? { ...t, ...mapped } : t))
        })
        .catch(() => {})
      return
    }

    if (Object.keys(payload).length === 0) return
    const timers = themeMetaPatchTimersRef.current
    const existing = timers.get(id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      timers.delete(id)
      api.appearance.themes.update(id, payload, { universitySlug: scopeSlug })
        .then((row) => {
          const mapped = mapThemeFromApi(row)
          setSavedThemes(prev => (Array.isArray(prev) ? prev : []).map(t => String(t?.id) === String(id) ? { ...t, ...mapped } : t))
        })
        .catch(() => {})
    }, 500)
    timers.set(id, timer)
  }

  const deleteThemePreset = (id) => {
    if (!canManageAppearanceRef.current) return
    if (!id) return
    const { universitySlug: scopeSlug } = appearanceScopeRef.current || { universitySlug: null }
    setSavedThemes(prev => (Array.isArray(prev) ? prev : []).filter(t => String(t?.id) !== String(id)))
    api.appearance.themes.remove(id, { universitySlug: scopeSlug }).catch(() => {})
  }

  const applyThemePreset = (id) => {
    const list = Array.isArray(savedThemes) ? savedThemes : []
    const found = list.find(t => t?.id === id)
    if (!found || !found.config) return
    applyThemeConfig(found.config)
  }

  const updateTheme = (updates) => {
    setTheme(prev => ({ ...prev, ...updates }))
  }

  const resetTheme = () => {
    setTheme(DEFAULT_THEME)
    clearBgImagesDb()
    storedBgIdsRef.current = new Set()
    loadedBgIdsRef.current = new Set()
  }

  const addBgImage = (src) => {
    const id = `bgimg_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setTheme(prev => ({
      ...prev,
      bgImages: [
        ...(Array.isArray(prev.bgImages) ? prev.bgImages : []),
        { id, src, x: 50, y: 50, scale: 1, rotation: 0, visibility: { welcome: false, auth: false, user: true, admin: true } }
      ]
    }))
    putBgImage(id, src)
    storedBgIdsRef.current.add(id)
    setActiveBgImageId(id)
  }

  const addMarquee = (updates = {}) => {
    const id = `mq_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const next = {
      id,
      text: typeof updates.text === 'string' ? updates.text : 'OSNOVA',
      duration: typeof updates.duration === 'number' ? updates.duration : 30,
      direction: updates.direction === -1 ? -1 : 1,
      repeat: typeof updates.repeat === 'number' ? updates.repeat : 20,
      fontFamily: typeof updates.fontFamily === 'string' ? updates.fontFamily : 'system',
      fontWeight: typeof updates.fontWeight === 'number' ? updates.fontWeight : 900,
      fontSize: typeof updates.fontSize === 'number' ? updates.fontSize : 140,
      letterSpacing: typeof updates.letterSpacing === 'number' ? updates.letterSpacing : -0.02,
      color: typeof updates.color === 'string' ? updates.color : '#0f2e3a',
      opacity: typeof updates.opacity === 'number' ? updates.opacity : 1,
      stroke: typeof updates.stroke === 'boolean' ? updates.stroke : false,
      strokeWidth: typeof updates.strokeWidth === 'number' ? updates.strokeWidth : (updates.stroke ? 2 : 0),
      visibility: updates.visibility && typeof updates.visibility === 'object'
        ? {
          welcome: typeof updates.visibility.welcome === 'boolean' ? updates.visibility.welcome : false,
          auth: typeof updates.visibility.auth === 'boolean' ? updates.visibility.auth : false,
          user: typeof updates.visibility.user === 'boolean' ? updates.visibility.user : true,
          admin: typeof updates.visibility.admin === 'boolean' ? updates.visibility.admin : true
        }
        : { welcome: false, auth: false, user: true, admin: true }
    }
    setTheme(prev => ({ ...prev, marquees: [...(Array.isArray(prev.marquees) ? prev.marquees : []), next] }))
    return id
  }

  const updateMarquee = (id, updates) => {
    if (!id) return
    setTheme(prev => ({
      ...prev,
      marquees: (Array.isArray(prev.marquees) ? prev.marquees : []).map(m => m.id === id ? { ...m, ...updates } : m)
    }))
  }

  const deleteMarquee = (id) => {
    if (!id) return
    setTheme(prev => ({
      ...prev,
      marquees: (Array.isArray(prev.marquees) ? prev.marquees : []).filter(m => m.id !== id)
    }))
  }

  const reorderMarquees = (next) => {
    setTheme(prev => ({ ...prev, marquees: Array.isArray(next) ? next : (Array.isArray(prev.marquees) ? prev.marquees : []) }))
  }

  const updateBgImage = (id, updates) => {
    if (updates && typeof updates.src === 'string' && updates.src) {
      putBgImage(id, updates.src)
      storedBgIdsRef.current.add(id)
    }
    setTheme(prev => ({
      ...prev,
      bgImages: (Array.isArray(prev.bgImages) ? prev.bgImages : []).map(img =>
        img.id === id ? { ...img, ...updates } : img
      )
    }))
  }

  const deleteBgImage = (id) => {
    setTheme(prev => ({
      ...prev,
      bgImages: (Array.isArray(prev.bgImages) ? prev.bgImages : []).filter(img => img.id !== id)
    }))
    deleteBgImageFromDb(id)
    storedBgIdsRef.current.delete(id)
    loadedBgIdsRef.current.delete(id)
    setActiveBgImageId(prev => (prev === id ? null : prev))
  }

  const cloneBgImage = async (id) => {
    const cloneId = `bgimg_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const currentImages = Array.isArray(themeImagesRef.current) ? themeImagesRef.current : []
    const srcImg = currentImages.find(x => x?.id === id) || null
    let finalSrc = typeof srcImg?.src === 'string' ? srcImg.src : ''
    if (!finalSrc) finalSrc = await getBgImage(id)
    if (finalSrc) {
      await putBgImage(cloneId, finalSrc)
      storedBgIdsRef.current.add(cloneId)
      loadedBgIdsRef.current.delete(cloneId)
      bgLoadRetryCountRef.current.delete(cloneId)
    }

    setTheme(prev => {
      const images = Array.isArray(prev.bgImages) ? prev.bgImages : []
      const base = images.find(x => x.id === id) || { id, src: '', x: 50, y: 50, scale: 1, rotation: 0 }
      const next = {
        ...base,
        id: cloneId,
        src: finalSrc || '',
        x: (typeof base.x === 'number' ? base.x : 50) + 3,
        y: (typeof base.y === 'number' ? base.y : 50) + 3
      }
      return { ...prev, bgImages: [...images, next] }
    })
    setActiveBgImageId(cloneId)
  }

  return (
    <ThemeContext.Provider value={{
      ...theme,
      updateTheme,
      resetTheme,
      bgImageEditMode,
      setBgImageEditMode,
      activeBgImageId,
      setActiveBgImageId,
      addBgImage,
      updateBgImage,
      deleteBgImage,
      cloneBgImage,
      addMarquee,
      updateMarquee,
      deleteMarquee,
      reorderMarquees,
      savedThemes,
      exportThemeConfig,
      applyThemeConfig,
      flushAppearanceSave,
      saveThemePreset,
      updateThemePreset,
      deleteThemePreset,
      applyThemePreset,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
