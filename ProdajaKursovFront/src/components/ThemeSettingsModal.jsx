import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { createPortal } from 'react-dom'
import { X, RotateCcw, Save, Palette, MousePointer2, Plus, Minus, MoveHorizontal, Image as ImageIcon, Move, Copy, Trash2, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../context/useTheme'

const nowTs = () => Date.now()
const randHex = () => Math.random().toString(16).slice(2)

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
    return `rgba(255, 255, 255, ${alpha})`
  }
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(255, 255, 255, ${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function ThemeSettingsModal({ open, onClose, variant = 'modal' }) {
  const isModal = variant === 'modal'
  const isOpen = isModal ? open : true

  const { 
    header, 
    siteBg,
    searchBar,
    contentText,
    surfaces,
    eduFilter,
    primaryButtons,
    successButtons,
    dangerButtons,
    bgImages,
    marquees,
    brandText: themeBrandText,
    logo,
    welcomeTexts: themeWelcomeTexts,
    savedThemes,
    saveThemePreset,
    updateThemePreset,
    deleteThemePreset,
    applyThemePreset,
    exportThemeConfig,
    flushAppearanceSave,
    showCursorEffect, 
    updateTheme, 
    resetTheme,
    bgImageEditMode,
    setBgImageEditMode,
    activeBgImageId,
    setActiveBgImageId,
    addBgImage,
    updateBgImage,
    deleteBgImage,
    cloneBgImage
  } = useTheme()

  // Targets: 'header' (includes admin header), 'siteBg', 'searchBar', 'contentText', 'surfaces', 'marquees', 'welcomeText', 'themes', 'primaryButtons', 'successButtons', 'dangerButtons'
  const [activeTarget, setActiveTarget] = useState('header')
  const [activeMarqueeId, setActiveMarqueeId] = useState(null)
  const [presetName, setPresetName] = useState('')
  const [presetPublished, setPresetPublished] = useState(false)
  const [editingPresetId, setEditingPresetId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const [welcomeTexts, setWelcomeTexts] = useState([])
  const [welcomeSelectedId, setWelcomeSelectedId] = useState(null)
  const welcomeCanvasRef = useRef(null)
  const welcomeDragRef = useRef(null)
  const welcomePreviewOuterRef = useRef(null)
  const [welcomePreviewRatio, setWelcomePreviewRatio] = useState({ w: 16, h: 9 })
  const [welcomePreviewScale, setWelcomePreviewScale] = useState(1)
  const [welcomeShowAll, setWelcomeShowAll] = useState(true)
  const [brandText, setBrandText] = useState('OSNOVA')
  const [welcomeDirty, setWelcomeDirty] = useState(false)
  const [welcomeSavedAt, setWelcomeSavedAt] = useState(null)
  const welcomeLastSavedRef = useRef('')

  useEffect(() => {
    if (!isOpen) return
    if (welcomeDirty) return
    const items = Array.isArray(themeWelcomeTexts) ? themeWelcomeTexts : []
    const bt = String(themeBrandText || 'OSNOVA')
    let sig = ''
    try { sig = JSON.stringify({ items, brandText: bt }) } catch { sig = '' }
    if (sig && welcomeLastSavedRef.current === sig) return
    setWelcomeTexts(items)
    setBrandText(bt)
    setWelcomeSelectedId(null)
    setWelcomeShowAll(true)
    welcomeLastSavedRef.current = sig
    setWelcomeDirty(false)
    setWelcomeSavedAt(nowTs())
  }, [isOpen, themeWelcomeTexts, themeBrandText, welcomeDirty])

  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      const w = Math.max(1, Number(window.innerWidth) || 1)
      const h = Math.max(1, Number(window.innerHeight) || 1)
      setWelcomePreviewRatio({ w, h })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen) return
    if (activeTarget !== 'welcomeText') return
    const el = welcomePreviewOuterRef.current
    if (!el) return
    let raf1 = 0
    let raf2 = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      const vw = Math.max(1, Number(welcomePreviewRatio.w) || 1)
      const vh = Math.max(1, Number(welcomePreviewRatio.h) || 1)
      const next = Math.min(w / vw, h / vh)
      setWelcomePreviewScale(Number.isFinite(next) && next > 0 ? next : 1)
    }
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(update)
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
    }
  }, [isOpen, activeTarget, welcomePreviewRatio.w, welcomePreviewRatio.h])

  useEffect(() => {
    if (!isOpen) return
    if (activeTarget !== 'welcomeText') return
    const el = welcomePreviewOuterRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      const vw = Math.max(1, Number(welcomePreviewRatio.w) || 1)
      const vh = Math.max(1, Number(welcomePreviewRatio.h) || 1)
      const next = Math.min(w / vw, h / vh)
      setWelcomePreviewScale(Number.isFinite(next) && next > 0 ? next : 1)
    }
    update()
    let ro
    try {
      ro = new ResizeObserver(() => update())
      ro.observe(el)
    } catch { void 0 }
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      try { ro && ro.disconnect() } catch { void 0 }
    }
  }, [isOpen, activeTarget, welcomePreviewRatio.w, welcomePreviewRatio.h])

  useEffect(() => {
    if (!isOpen) return
    try {
      const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
      const bt = String(brandText || 'OSNOVA')
      const cur = JSON.stringify({ items, brandText: bt })
      setWelcomeDirty(cur !== welcomeLastSavedRef.current)
    } catch {
      setWelcomeDirty(true)
    }
  }, [isOpen, welcomeTexts, brandText])

  const saveWelcomeTexts = async () => {
    const override = {
      header: form.header,
      siteBg: form.siteBg,
      searchBar: form.searchBar,
      contentText: form.contentText,
      surfaces: form.surfaces,
      eduFilter: form.eduFilter,
      primaryButtons: form.primaryButtons,
      successButtons: form.successButtons,
      dangerButtons: form.dangerButtons,
      bgImages,
      marquees: form.marquees,
      brandText: String(brandText || 'OSNOVA'),
      logo: form.logo,
      welcomeTexts: Array.isArray(welcomeTexts) ? welcomeTexts : [],
      showCursorEffect: !!form.showCursorEffect,
    }
    try {
      const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
      const bt = String(brandText || 'OSNOVA')
      updateTheme({ welcomeTexts: items, brandText: bt })
      try { welcomeLastSavedRef.current = JSON.stringify({ items, brandText: bt }) } catch { welcomeLastSavedRef.current = '' }
    } catch { void 0 }
    if (typeof flushAppearanceSave === 'function') {
      try {
        await flushAppearanceSave(override)
        setWelcomeDirty(false)
        setWelcomeSavedAt(nowTs())
      } catch { void 0 }
    } else {
      setWelcomeDirty(false)
      setWelcomeSavedAt(nowTs())
    }
  }
  
  // Local state for the form, initialized from context
  const [form, setForm] = useState({
    header,
    siteBg,
    searchBar,
    contentText,
    surfaces,
    eduFilter,
    marquees,
    primaryButtons,
    successButtons,
    dangerButtons,
    logo,
    showCursorEffect
  })

  // Synchronize local form with context changes
  useEffect(() => {
    if (isOpen) {
      setForm({ header, siteBg, searchBar, contentText, surfaces, eduFilter, marquees, primaryButtons, successButtons, dangerButtons, logo, showCursorEffect })
    }
  }, [header, siteBg, searchBar, contentText, surfaces, eduFilter, marquees, primaryButtons, successButtons, dangerButtons, logo, showCursorEffect, isOpen])

  // Focus effect: blur everything except headers when open
  useEffect(() => {
    if (!isModal) return
    if (isOpen) {
      document.body.classList.add('theme-editor-open')
      return () => document.body.classList.remove('theme-editor-open')
    }
    document.body.classList.remove('theme-editor-open')
    setBgImageEditMode(false)
    return () => document.body.classList.remove('theme-editor-open')
  }, [isModal, isOpen, setBgImageEditMode])

  const handleClose = () => {
    setBgImageEditMode(false)
    onClose()
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const override = {
        header: form.header,
        siteBg: form.siteBg,
        searchBar: form.searchBar,
        contentText: form.contentText,
        surfaces: form.surfaces,
        eduFilter: form.eduFilter,
        primaryButtons: form.primaryButtons,
        successButtons: form.successButtons,
        dangerButtons: form.dangerButtons,
        bgImages,
        marquees: form.marquees,
        brandText: String(brandText || 'OSNOVA'),
        logo: form.logo,
        welcomeTexts: Array.isArray(welcomeTexts) ? welcomeTexts : [],
        showCursorEffect: !!form.showCursorEffect,
      }
      try {
        const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
        const bt = String(brandText || 'OSNOVA')
        updateTheme({ welcomeTexts: items, brandText: bt })
        try { welcomeLastSavedRef.current = JSON.stringify({ items, brandText: bt }) } catch { welcomeLastSavedRef.current = '' }
        setWelcomeDirty(false)
        setWelcomeSavedAt(nowTs())
      } catch { void 0 }
      if (typeof flushAppearanceSave === 'function') {
        await flushAppearanceSave(override)
      }
      handleClose()
    } catch {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    resetTheme()
    handleClose()
  }

  const isTextTarget = activeTarget === 'contentText'
  const isSurfacesTarget = activeTarget === 'surfaces'
  const isMarqueesTarget = activeTarget === 'marquees'
  const isLogoTarget = activeTarget === 'logo'
  const isWelcomeTextTarget = activeTarget === 'welcomeText'
  const isThemesTarget = activeTarget === 'themes'
  const isPrimaryButtonsTarget = activeTarget === 'primaryButtons'
  const isSuccessButtonsTarget = activeTarget === 'successButtons'
  const isDangerButtonsTarget = activeTarget === 'dangerButtons'
  const isSpecialTarget = isTextTarget || isSurfacesTarget || isMarqueesTarget || isLogoTarget || isWelcomeTextTarget || isThemesTarget || isPrimaryButtonsTarget || isSuccessButtonsTarget || isDangerButtonsTarget
  const currentConfig = isSpecialTarget ? null : form[activeTarget]

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

  const updateWelcomeText = (id, updates) => {
    setWelcomeTexts(prev => (Array.isArray(prev) ? prev : []).map(t => String(t?.id) === String(id) ? { ...t, ...updates } : t))
  }

  const addWelcomeText = () => {
    const id = `wt_${nowTs()}_${randHex()}`
    const next = {
      id,
      text: 'Новый текст',
      x: 50,
      y: 30,
      width: 70,
      rotate: 0,
      align: 'left',
      fontSizeVw: 6,
      color: '',
      weight: 800
    }
    setWelcomeTexts(prev => [next, ...(Array.isArray(prev) ? prev : [])])
    setWelcomeSelectedId(id)
    setWelcomeShowAll(false)
  }

  const deleteWelcomeText = (id) => {
    const current = Array.isArray(welcomeTexts) ? welcomeTexts : []
    const next = current.filter(t => String(t?.id) !== String(id))
    setWelcomeTexts(next)
    if (String(welcomeSelectedId) === String(id)) {
      setWelcomeSelectedId(next.length > 0 ? String(next[0]?.id) : null)
    }
  }

  const selectedWelcomeText = useMemo(() => {
    return (Array.isArray(welcomeTexts) ? welcomeTexts : []).find(t => String(t?.id) === String(welcomeSelectedId)) || null
  }, [welcomeTexts, welcomeSelectedId])

  const startWelcomeTransform = (e, id, mode) => {
    const canvas = welcomeCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect) return
    const item = (Array.isArray(welcomeTexts) ? welcomeTexts : []).find(t => String(t?.id) === String(id))
    if (!item) return
    e.preventDefault()
    e.stopPropagation()
    setWelcomeSelectedId(id)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { void 0 }

    const getAngle = (clientX, clientY, cx, cy) => {
      return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
    }

    let center = { x: rect.left + (Number(item.x || 50) / 100) * rect.width, y: rect.top + (Number(item.y || 30) / 100) * rect.height }
    if (mode === 'rotate') {
      const node = e.currentTarget.closest('[data-welcome-item="true"]')
      const r = node?.getBoundingClientRect?.()
      if (r) center = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }

    const startAngle = getAngle(e.clientX, e.clientY, center.x, center.y)
    const start = {
      pointerId: e.pointerId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      item: { ...item },
      rect: { width: rect.width, height: rect.height },
      rotateOffset: startAngle - (Number(item.rotate) || 0),
      center
    }
    welcomeDragRef.current = start

    const onMove = (ev) => {
      const st = welcomeDragRef.current
      if (!st || st.pointerId !== e.pointerId) return
      const dx = ev.clientX - st.startClientX
      const dy = ev.clientY - st.startClientY
      if (st.mode === 'drag') {
        const nx = clamp((Number(st.item.x) || 50) + (dx / Math.max(1, st.rect.width)) * 100, 0, 100)
        const ny = clamp((Number(st.item.y) || 30) + (dy / Math.max(1, st.rect.height)) * 100, 0, 100)
        updateWelcomeText(id, { x: nx, y: ny })
      } else if (st.mode === 'resize') {
        const nw = clamp((Number(st.item.width) || 70) + (dx / Math.max(1, st.rect.width)) * 100, 10, 95)
        const nfs = clamp((Number(st.item.fontSizeVw) || 6) + (dy / Math.max(1, st.rect.height)) * 20, 1.5, 60)
        updateWelcomeText(id, { width: nw, fontSizeVw: nfs })
      } else if (st.mode === 'rotate') {
        const ang = getAngle(ev.clientX, ev.clientY, st.center.x, st.center.y)
        const nr = clamp(ang - st.rotateOffset, -180, 180)
        updateWelcomeText(id, { rotate: nr })
      }
    }

    const onUp = () => {
      welcomeDragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const normalizeStops = (colors, stops) => {
    const list = Array.isArray(colors) ? colors : []
    const wanted = Math.max(0, list.length - 1)
    const raw = Array.isArray(stops) ? stops.map(v => Number(v)).filter(v => Number.isFinite(v)) : []
    const n = list.length
    if (n < 2) return []
    const base = Array.from({ length: n }, (_, i) => (i * 100) / (n - 1))
    const minGap = 1
    const defaults = Array.from({ length: wanted }, (_, i) => (base[i] + base[i + 1]) / 2)
    const source = raw.length === wanted ? raw.slice(0, wanted) : defaults
    return source.map((v, i) => {
      const min = base[i] + minGap
      const max = base[i + 1] - minGap
      return Math.round(Math.min(max, Math.max(min, v)) * 10) / 10
    })
  }

  const buildSegmentsCss = (angle, colors, stops) => {
    const list = Array.isArray(colors) ? colors : []
    const s = normalizeStops(list, stops)
    if (list.length < 2 || s.length !== list.length - 1) return `linear-gradient(${Number(angle) || 0}deg, ${(list || []).join(', ')})`
    const n = list.length
    const base = Array.from({ length: n }, (_, i) => (i * 100) / (n - 1))
    const softness = Number.isFinite(Number(currentConfig?.softness)) ? Number(currentConfig.softness) : 0
    const softenK = Math.min(1, Math.max(0, softness / 100))
    const hints = s.map((v, i) => {
      const min = base[i] + 1
      const max = base[i + 1] - 1
      const mid = (base[i] + base[i + 1]) / 2
      const softened = v * (1 - softenK) + mid * softenK
      return Math.round(Math.min(max, Math.max(min, softened)) * 10) / 10
    })
    const parts = []
    parts.push(`${list[0]} ${base[0]}%`)
    for (let i = 0; i < n - 1; i++) {
      parts.push(`${hints[i]}%`)
      parts.push(`${list[i + 1]} ${base[i + 1]}%`)
    }
    return `linear-gradient(${Number(angle) || 0}deg, ${parts.join(', ')})`
  }

  const setConfig = (updates) => {
    if (isSpecialTarget) return
    let finalUpdates = { ...updates }
    
    // If switching to solid, keep only the first color
    if (updates.type === 'solid') {
      finalUpdates.colors = [form[activeTarget].colors[0]]
    } 
    // If switching back to gradient from solid, ensure at least 2 colors
    else if (updates.type === 'gradient' && form[activeTarget].colors.length < 2) {
      finalUpdates.colors = [form[activeTarget].colors[0], '#ffffff']
    }

    const nextCfgRaw = { ...form[activeTarget], ...finalUpdates }
    const nextCfg = nextCfgRaw.type === 'gradient'
      ? { ...nextCfgRaw, useStops: typeof nextCfgRaw.useStops === 'boolean' ? nextCfgRaw.useStops : false, stops: normalizeStops(nextCfgRaw.colors, nextCfgRaw.stops) }
      : nextCfgRaw
    const newForm = { ...form, [activeTarget]: nextCfg }
    setForm(newForm)
    // Dynamic preview
    updateTheme(newForm)
  }

  const toggleCursor = () => {
    const newForm = { ...form, showCursorEffect: !form.showCursorEffect }
    setForm(newForm)
    updateTheme(newForm)
  }

  const setContentText = (updates) => {
    const next = {
      ...form,
      contentText: { ...(form.contentText || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const setSurfaces = (updates) => {
    const next = {
      ...form,
      surfaces: { ...(form.surfaces || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const setEduFilter = (updates) => {
    const next = {
      ...form,
      eduFilter: { ...(form.eduFilter || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const setLogo = (updates) => {
    const next = {
      ...form,
      logo: { ...(form.logo || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const marqueeList = Array.isArray(form.marquees) ? form.marquees : []
  const activeMarquee = marqueeList.find(m => m.id === activeMarqueeId) || null

  useEffect(() => {
    if (!isOpen) return
    if (!isMarqueesTarget) return
    if (activeMarqueeId) return
    if (marqueeList.length === 0) return
    setActiveMarqueeId(marqueeList[0].id)
  }, [isOpen, isMarqueesTarget, activeMarqueeId, marqueeList])

  const setMarquees = (nextList) => {
    const next = Array.isArray(nextList) ? nextList : []
    setForm(prev => ({ ...prev, marquees: next }))
    updateTheme({ marquees: next })
  }

  const updateOneMarquee = (id, updates) => {
    setMarquees(marqueeList.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  const addOneMarquee = () => {
    const id = `mq_${nowTs()}_${randHex()}`
    const next = {
      id,
      text: 'OSNOVA',
      duration: 30,
      direction: 1,
      repeat: 20,
      fontFamily: 'system',
      fontWeight: 900,
      fontSize: 120,
      letterSpacing: -0.02,
      color: '#0f2e3a',
      opacity: 1,
      stroke: false,
      strokeWidth: 0,
      visibility: { welcome: false, auth: false, user: true, admin: true }
    }
    setMarquees([...marqueeList, next])
    setActiveMarqueeId(id)
  }

  const deleteOneMarquee = (id) => {
    const next = marqueeList.filter(m => m.id !== id)
    setMarquees(next)
    if (activeMarqueeId === id) {
      setActiveMarqueeId(next[0]?.id || null)
    }
  }

  const setPrimaryButtons = (updates) => {
    const next = {
      ...form,
      primaryButtons: { ...(form.primaryButtons || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const setSuccessButtons = (updates) => {
    const next = {
      ...form,
      successButtons: { ...(form.successButtons || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const setDangerButtons = (updates) => {
    const next = {
      ...form,
      dangerButtons: { ...(form.dangerButtons || {}), ...updates }
    }
    setForm(next)
    updateTheme(next)
  }

  const addColor = () => {
    if (isSpecialTarget) return
    if (currentConfig.colors.length < 5) {
      setConfig({ colors: [...currentConfig.colors, '#ffffff'] })
    }
  }

  const removeColor = (index) => {
    if (isSpecialTarget) return
    if (currentConfig.colors.length > 1) {
      const newColors = [...currentConfig.colors]
      newColors.splice(index, 1)
      setConfig({ colors: newColors })
    }
  }

  const updateColor = (index, color) => {
    if (isSpecialTarget) return
    const newColors = [...currentConfig.colors]
    newColors[index] = color
    setConfig({ colors: newColors })
  }

  const fileInputRef = useRef(null)
  const fileActionRef = useRef('add')

  const activeBgImage = useMemo(() => {
    const list = Array.isArray(bgImages) ? bgImages : []
    return list.find(x => x.id === activeBgImageId) || null
  }, [bgImages, activeBgImageId])

  useEffect(() => {
    if (!isOpen) return
    if (activeTarget !== 'siteBg') return
    if (activeBgImageId) return
    const list = Array.isArray(bgImages) ? bgImages : []
    if (list.length === 0) return
    setActiveBgImageId(list[0].id)
  }, [isOpen, activeTarget, bgImages, activeBgImageId, setActiveBgImageId])

  const readAsDataUrl = (file) => {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error('read_error'))
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(file)
    })
  }

  const applyPickedImage = async (file) => {
    if (!file) return
    if (!String(file.type || '').startsWith('image/')) return
    const src = await readAsDataUrl(file).catch(() => '')
    if (!src) return
    const action = fileActionRef.current || 'add'
    if (action === 'replace' && activeBgImageId) {
      updateBgImage(activeBgImageId, { src })
    } else {
      addBgImage(src)
    }
    setBgImageEditMode(true)
  }

  const pickFile = (action = 'add') => {
    fileActionRef.current = action
    fileInputRef.current?.click?.()
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    await applyPickedImage(file)
  }

  useEffect(() => {
    if (!isOpen) return
    if (activeTarget !== 'siteBg') return
    const onPaste = (e) => {
      const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : []
      const imgItem = items.find(i => String(i.type || '').startsWith('image/')) || null
      const file = imgItem?.getAsFile?.() || null
      if (!file) return
      fileActionRef.current = 'add'
      applyPickedImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [isOpen, activeTarget])

  if (!isOpen) return null

  const gradientStops = (!isSpecialTarget && currentConfig && currentConfig.type === 'gradient')
    ? normalizeStops(currentConfig.colors, currentConfig.stops)
    : []

  const segmentPercents = (!isSpecialTarget && currentConfig && currentConfig.type === 'gradient')
    ? (() => {
        const list = Array.isArray(currentConfig.colors) ? currentConfig.colors : []
        if (list.length < 2) return []
        const s = gradientStops
        const res = []
        let prev = 0
        for (let i = 0; i < list.length; i++) {
          const end = i === list.length - 1 ? 100 : s[i]
          res.push(Math.max(0, Math.round(end - prev)))
          prev = end
        }
        return res
      })()
    : []

  const styles = (
    <style dangerouslySetInnerHTML={{ __html: `
      .theme-editor-open #root > *:not(.fixed):not([data-header="true"]),
      .theme-editor-open main {
        filter: blur(12px) brightness(0.8);
        transition: filter 0.4s ease, brightness 0.4s ease;
        pointer-events: none;
      }
      .theme-editor-open .fluid {
        filter: none !important;
        opacity: 1 !important;
        pointer-events: none !important;
      }
      .theme-editor-open [data-header="true"] {
        z-index: 20000 !important;
        position: relative;
        filter: none !important;
      }
      .bg-image-edit-mode #root > *:not(.fixed):not([data-header="true"]),
      .bg-image-edit-mode main {
        opacity: 0;
        filter: none !important;
        pointer-events: none;
      }
      .bg-image-edit-mode .fluid {
        filter: none !important;
      }
      .glass-dark {
        background: rgba(15, 46, 58, 0.9);
        backdrop-filter: blur(40px);
        -webkit-backdrop-filter: blur(40px);
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }
    `}} />
  )

  const panel = (
    <motion.div
      initial={isModal ? { opacity: 0, y: 12, scale: 0.98 } : undefined}
      animate={isModal ? { opacity: 1, y: 0, scale: 1 } : undefined}
      exit={isModal ? { opacity: 0, y: 12, scale: 0.98 } : undefined}
      transition={isModal ? { type: 'spring', damping: 25, stiffness: 220 } : undefined}
      className={`relative z-[200] w-full max-w-6xl glass-dark border border-white/10 p-4 sm:p-6 shadow-2xl flex flex-col min-h-0 rounded-3xl ${isModal ? 'pointer-events-auto' : ''}`}
      style={{ maxHeight: isModal ? '90vh' : 'calc(100vh - 120px)' }}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Palette size={20} />
          </div>
          <h2 className="text-xl font-bold">Оформление</h2>
        </div>
        <button 
          onClick={handleClose} 
          className="p-2 rounded-xl hover:bg-white/10 text-white/70 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 lg:items-start">
          <div className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/10 lg:sticky lg:top-0 lg:self-start">
            {/* Target Selection */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Логотип</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[{ id: 'logo', label: 'Логотип' }].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTarget(t.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTarget === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5 border border-white/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Шапка и фон</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { id: 'header', label: 'Хедеры' },
                    { id: 'siteBg', label: 'Фон сайта' },
                    { id: 'searchBar', label: 'Поиск' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTarget(t.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTarget === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5 border border-white/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Контент</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { id: 'contentText', label: 'Текст' },
                    { id: 'marquees', label: 'Бегущие строки' },
                    { id: 'surfaces', label: 'Боксы/Модалки' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTarget(t.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTarget === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5 border border-white/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Кнопки</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { id: 'primaryButtons', label: 'Основные кнопки' },
                    { id: 'successButtons', label: 'Создать/Сохранить' },
                    { id: 'dangerButtons', label: 'Удалить/Отмена' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTarget(t.id)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTarget === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5 border border-white/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Отдельно</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'welcomeText', label: 'Приветственный экран' },
                    { id: 'themes', label: 'Темы' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTarget(t.id)}
                      className={`w-full h-11 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center whitespace-nowrap ${activeTarget === t.id ? 'bg-emerald-600 text-white shadow-lg border border-emerald-600/40' : 'text-white/60 hover:text-white hover:bg-white/5 border border-white/10'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          <div className="space-y-8 min-w-0">
            {isWelcomeTextTarget && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-white min-w-0">
                    <div className="text-sm font-semibold">Текст на приветственном экране</div>
                    <div className="text-xs text-white/50">Добавляй, перемещай, меняй размер и поворот. Сохраняется в оформлении.</div>
                  </div>
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={saveWelcomeTexts}
                      disabled={!welcomeDirty}
                      className={`w-full sm:w-auto h-11 flex items-center justify-center gap-2 px-3 lg:px-4 rounded-xl border transition-colors text-sm font-bold ${welcomeDirty ? 'bg-emerald-600 border-emerald-600/40 text-white hover:brightness-110' : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'}`}
                    >
                      <CheckCircle2 size={16} />
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={addWelcomeText}
                      className="w-full sm:w-auto h-11 flex items-center justify-center gap-2 px-3 lg:px-4 rounded-xl bg-emerald-600 border border-emerald-600/40 text-white hover:brightness-110 transition-colors text-sm font-bold"
                    >
                      <Plus size={16} />
                      Добавить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedWelcomeText) return
                        deleteWelcomeText(selectedWelcomeText.id)
                      }}
                      className={`w-full sm:w-auto h-11 flex items-center justify-center gap-2 px-3 lg:px-4 rounded-xl border transition-colors text-sm font-bold ${selectedWelcomeText ? 'bg-rose-600 border-rose-600/40 text-white hover:brightness-110' : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'}`}
                      disabled={!selectedWelcomeText}
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-white/50">
                  {welcomeDirty ? 'Есть несохранённые изменения' : (welcomeSavedAt ? `Сохранено: ${new Date(welcomeSavedAt).toLocaleString()}` : 'Не сохранено')}
                </div>

                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Текст в шапке</div>
                  <input
                    value={brandText}
                    onChange={(e) => setBrandText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40"
                    placeholder="Например: OSNOVA"
                  />
                  <div className="text-[11px] text-white/50">Отображается в верхней шапке и в окне авторизации.</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <div
                      ref={welcomePreviewOuterRef}
                      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-white/10"
                      style={{ aspectRatio: `${welcomePreviewRatio.w} / ${welcomePreviewRatio.h}` }}
                      onPointerDown={() => { setWelcomeSelectedId(null) }}
                    >
                      <div
                        className="absolute top-0 left-0"
                        style={{
                          width: `${welcomePreviewRatio.w}px`,
                          height: `${welcomePreviewRatio.h}px`,
                          transform: `scale(${welcomePreviewScale})`,
                          transformOrigin: 'top left'
                        }}
                      >
                        <div className="absolute inset-0 px-4 flex flex-col justify-center">
                          <div ref={welcomeCanvasRef} className="relative w-full h-full">
                            {(Array.isArray(welcomeTexts) ? welcomeTexts : [])
                              .filter(t => welcomeShowAll || !welcomeSelectedId || String(t?.id) === String(welcomeSelectedId))
                              .map(t => {
                                const id = String(t?.id || '')
                                if (!id) return null
                                const isSel = String(welcomeSelectedId) === id
                                const x = Number.isFinite(Number(t?.x)) ? Number(t.x) : 50
                                const y = Number.isFinite(Number(t?.y)) ? Number(t.y) : 30
                                const w = Number.isFinite(Number(t?.width)) ? Number(t.width) : 70
                                const r = Number.isFinite(Number(t?.rotate)) ? Number(t.rotate) : 0
                                const fs = Number.isFinite(Number(t?.fontSizeVw)) ? Number(t.fontSizeVw) : 6
                                const align = (t?.align === 'center' || t?.align === 'right') ? t.align : 'left'
                                const tx = align === 'right' ? -100 : align === 'center' ? -50 : 0
                                const color = String(t?.color || '').trim()
                                const weight = Number.isFinite(Number(t?.weight)) ? Number(t.weight) : 800
                                return (
                                  <div
                                    key={id}
                                    data-welcome-item="true"
                                    className={`absolute ${isSel ? 'ring-2 ring-emerald-400' : ''}`}
                                    style={{
                                      left: `${x}%`,
                                      top: `${y}%`,
                                      width: `${clamp(w, 10, 95)}%`,
                                      transform: `translate(${tx}%, -50%) rotate(${r}deg)`,
                                      transformOrigin: 'center',
                                      textAlign: align,
                                      color: color || 'var(--content-text)',
                                      fontWeight: weight,
                                      fontSize: `clamp(18px, ${fs}vw, 320px)`,
                                      lineHeight: 1.05,
                                      whiteSpace: 'pre-wrap',
                                      cursor: 'grab',
                                      userSelect: 'none',
                                      padding: 8,
                                      borderRadius: 12,
                                      background: isSel ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)',
                                      border: '1px solid rgba(38, 100, 121, 0.18)'
                                    }}
                                    onPointerDown={(e) => { setWelcomeSelectedId(id); startWelcomeTransform(e, id, 'drag') }}
                                  >
                                    <div className="pointer-events-none">{String(t?.text || '')}</div>

                                    {isSel && (
                                      <>
                                        <div
                                          className="absolute -top-5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border border-[#266479]/20 shadow cursor-alias"
                                          title="Повернуть"
                                          onPointerDown={(e) => startWelcomeTransform(e, id, 'rotate')}
                                        />
                                        <div
                                          className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white border border-[#266479]/20 shadow cursor-nwse-resize"
                                          title="Размер"
                                          onPointerDown={(e) => startWelcomeTransform(e, id, 'resize')}
                                        />
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-white/50 mt-2">
                      Перетаскивай текст мышью. Кружок сверху — поворот. Кружок снизу справа — размер.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                    {!selectedWelcomeText ? (
                      <div className="text-sm text-white/60">Выбери текст на превью, чтобы редактировать</div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Слои</div>
                            <button
                              type="button"
                              onClick={() => {
                                setWelcomeShowAll(v => {
                                  const next = !v
                                  if (!next) {
                                    const list = Array.isArray(welcomeTexts) ? welcomeTexts : []
                                    if (!welcomeSelectedId && list.length > 0) setWelcomeSelectedId(String(list[0]?.id))
                                  }
                                  return next
                                })
                              }}
                              className="px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors bg-white/10 border-white/10 text-white hover:bg-white/15"
                            >
                              {welcomeShowAll ? 'Только выбранный' : 'Показать все'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(Array.isArray(welcomeTexts) ? welcomeTexts : []).map((t, idx) => {
                              const id = String(t?.id || '')
                              if (!id) return null
                              const isSel = String(welcomeSelectedId) === id
                              const title = String(t?.text || '').split('\n')[0].trim() || `Текст ${idx + 1}`
                              return (
                                <div
                                  key={id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => { setWelcomeSelectedId(id); setWelcomeShowAll(false) }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      setWelcomeSelectedId(id)
                                      setWelcomeShowAll(false)
                                    }
                                  }}
                                  className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer select-none ${isSel ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                                >
                                  {title}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Текст</div>
                          <textarea
                            rows={4}
                            value={String(selectedWelcomeText.text || '')}
                            onChange={(e) => updateWelcomeText(selectedWelcomeText.id, { text: e.target.value })}
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 transition-all custom-scrollbar resize-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Цвет</div>
                            <button
                              type="button"
                              onClick={() => updateWelcomeText(selectedWelcomeText.id, { color: '' })}
                              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors text-xs font-bold"
                            >
                              По теме
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={String(selectedWelcomeText.color || '#0f2e3a') || '#0f2e3a'}
                              onChange={(e) => updateWelcomeText(selectedWelcomeText.id, { color: e.target.value })}
                              className="w-12 h-12 rounded-xl border border-white/10 bg-transparent"
                            />
                            <div className="text-xs text-white/60 font-mono">
                              {String(selectedWelcomeText.color || '').trim() ? String(selectedWelcomeText.color) : 'Тема'}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'left', label: 'Слева' },
                            { id: 'center', label: 'Центр' },
                            { id: 'right', label: 'Справа' }
                          ].map(a => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => updateWelcomeText(selectedWelcomeText.id, { align: a.id })}
                              className={`py-2 rounded-xl border text-sm font-bold transition-colors ${selectedWelcomeText.align === a.id ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] text-white/40 uppercase">
                            <span>Размер</span>
                            <span>{Math.round(Number(selectedWelcomeText.fontSizeVw || 0) * 10) / 10}vw</span>
                          </div>
                          <input
                            type="range"
                            min="1.5"
                            max="60"
                            step="0.1"
                            value={Number.isFinite(Number(selectedWelcomeText.fontSizeVw)) ? Number(selectedWelcomeText.fontSizeVw) : 6}
                            onChange={(e) => updateWelcomeText(selectedWelcomeText.id, { fontSizeVw: Number(e.target.value) })}
                            className="w-full accent-emerald-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] text-white/40 uppercase">
                            <span>Поворот</span>
                            <span>{Math.round(Number(selectedWelcomeText.rotate || 0))}°</span>
                          </div>
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            step="1"
                            value={Number.isFinite(Number(selectedWelcomeText.rotate)) ? Number(selectedWelcomeText.rotate) : 0}
                            onChange={(e) => updateWelcomeText(selectedWelcomeText.id, { rotate: Number(e.target.value) })}
                            className="w-full accent-emerald-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] text-white/40 uppercase">
                            <span>Толщина</span>
                            <span>{Number.isFinite(Number(selectedWelcomeText.weight)) ? Number(selectedWelcomeText.weight) : 800}</span>
                          </div>
                          <input
                            type="range"
                            min="300"
                            max="900"
                            step="100"
                            value={Number.isFinite(Number(selectedWelcomeText.weight)) ? Number(selectedWelcomeText.weight) : 800}
                            onChange={(e) => updateWelcomeText(selectedWelcomeText.id, { weight: Number(e.target.value) })}
                            className="w-full accent-emerald-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isSpecialTarget && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Тип заливки</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfig({ type: 'solid' })}
                    className={`flex-1 py-3 rounded-xl border transition-all ${currentConfig.type === 'solid' ? 'bg-white/10 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                  >
                    Сплошной
                  </button>
                  <button
                    onClick={() => setConfig({ type: 'gradient' })}
                    className={`flex-1 py-3 rounded-xl border transition-all ${currentConfig.type === 'gradient' ? 'bg-white/10 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                  >
                    Градиент
                  </button>
                </div>
              </div>
            )}

            {isTextTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Цвет текста</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Основной</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.contentText && form.contentText.primary) || '#0f2e3a'}</div>
                      <input
                        type="color"
                        value={(form.contentText && form.contentText.primary) || '#0f2e3a'}
                        onChange={(e) => setContentText({ primary: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/80 font-semibold">Вторичный</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.contentText && form.contentText.muted) || '#5a7280'}</div>
                      <input
                        type="color"
                        value={(form.contentText && form.contentText.muted) || '#5a7280'}
                        onChange={(e) => setContentText({ muted: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                    <div style={{ color: (form.contentText && form.contentText.primary) || '#0f2e3a' }} className="text-base font-semibold">
                      Пример основного текста
                    </div>
                    <div style={{ color: (form.contentText && form.contentText.muted) || '#5a7280' }} className="text-sm mt-1">
                      Пример вторичного текста (описание, подписи)
                    </div>
                  </div>
                </div>

                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Текст ошибки</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="text-sm text-white font-semibold">Занятость преподавателя в расписании</div>
                  <textarea
                    rows={3}
                    value={String((form.contentText && form.contentText.scheduleConflictErrorText) || '')}
                    onChange={(e) => setContentText({ scheduleConflictErrorText: e.target.value })}
                    placeholder="Например: Преподаватель занят в это время. Выберите другую пару."
                    className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/40 resize-none custom-scrollbar"
                  />
                  <div className="text-xs text-white/50">Показывается при конфликте занятости преподавателя, и подсвечивает проблемную пару.</div>
                </div>
              </div>
            )}

            {isLogoTarget && (
              <div className="space-y-4">
                <div className="text-white">
                  <div className="text-sm font-semibold">Логотип</div>
                  <div className="text-xs text-white/50">Загрузи и настрой отображение логотипа в шапке. Сохраняется в оформлении.</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="shrink-0 shadow-[0_0_18px_rgba(56,189,248,0.25)] overflow-hidden"
                        style={{
                          width: `${Number.isFinite(Number(form.logo?.size)) ? Number(form.logo.size) : 32}px`,
                          height: `${Number.isFinite(Number(form.logo?.size)) ? Number(form.logo.size) : 32}px`,
                          borderRadius: `${Number.isFinite(Number(form.logo?.radius)) ? Number(form.logo.radius) : 999}px`,
                          padding: `${Number.isFinite(Number(form.logo?.padding)) ? Number(form.logo.padding) : 0}px`,
                          background: `rgba(255,255,255,${Math.min(1, Math.max(0, Number.isFinite(Number(form.logo?.bgAlpha)) ? Number(form.logo.bgAlpha) : 0.1))})`,
                          border: `1px solid rgba(255,255,255,${Math.min(1, Math.max(0, Number.isFinite(Number(form.logo?.borderAlpha)) ? Number(form.logo.borderAlpha) : 0.1))})`
                        }}
                      >
                        {form.logo?.src ? (
                          <img
                            src={form.logo.src}
                            alt=""
                            draggable={false}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: form.logo?.objectFit === 'contain' ? 'contain' : 'cover',
                              display: 'block'
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="text-xs text-white/60">
                        {form.logo?.src ? 'Загружено' : 'Не выбрано'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition cursor-pointer text-sm font-semibold">
                        <ImageIcon size={16} />
                        Загрузить
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files && e.target.files[0]
                            e.target.value = ''
                            if (!file) return
                            const r = new FileReader()
                            r.onload = () => {
                              const src = typeof r.result === 'string' ? r.result : ''
                              if (!src) return
                              setLogo({ src })
                            }
                            r.readAsDataURL(file)
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!form.logo?.src}
                        onClick={() => setLogo({ src: '' })}
                        className={`px-3 py-2 rounded-xl border transition text-sm font-semibold ${form.logo?.src ? 'bg-rose-600 border-rose-600/40 text-white hover:brightness-110' : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'}`}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Размер</div>
                        <div className="text-xs text-white/60 font-mono">{Math.round(Number.isFinite(Number(form.logo?.size)) ? Number(form.logo.size) : 32)}px</div>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="96"
                        value={Math.round(Number.isFinite(Number(form.logo?.size)) ? Number(form.logo.size) : 32)}
                        onChange={(e) => setLogo({ size: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Скругление</div>
                        <div className="text-xs text-white/60 font-mono">{Math.round(Number.isFinite(Number(form.logo?.radius)) ? Number(form.logo.radius) : 999)}px</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="999"
                        value={Math.round(Number.isFinite(Number(form.logo?.radius)) ? Number(form.logo.radius) : 999)}
                        onChange={(e) => setLogo({ radius: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLogo({ radius: 999 })}
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/15 transition text-sm font-semibold"
                        >
                          Круг
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogo({ radius: 12 })}
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/15 transition text-sm font-semibold"
                        >
                          Скруглённый
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogo({ radius: 0 })}
                          className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/15 transition text-sm font-semibold"
                        >
                          Квадрат
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Внутренний отступ</div>
                        <div className="text-xs text-white/60 font-mono">{Math.round(Number.isFinite(Number(form.logo?.padding)) ? Number(form.logo.padding) : 0)}px</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={Math.round(Number.isFinite(Number(form.logo?.padding)) ? Number(form.logo.padding) : 0)}
                        onChange={(e) => setLogo({ padding: Number(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Режим</div>
                      </div>
                      <select
                        value={form.logo?.objectFit === 'contain' ? 'contain' : 'cover'}
                        onChange={(e) => setLogo({ objectFit: e.target.value === 'contain' ? 'contain' : 'cover' })}
                        className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white"
                      >
                        <option value="cover">Заполнить</option>
                        <option value="contain">Уместить</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Фон</div>
                        <div className="text-xs text-white/60 font-mono">{Math.round((Number.isFinite(Number(form.logo?.bgAlpha)) ? Number(form.logo.bgAlpha) : 0.1) * 100)}%</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={Math.round((Number.isFinite(Number(form.logo?.bgAlpha)) ? Number(form.logo.bgAlpha) : 0.1) * 100)}
                        onChange={(e) => setLogo({ bgAlpha: Number(e.target.value) / 100 })}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/80 font-semibold">Обводка</div>
                        <div className="text-xs text-white/60 font-mono">{Math.round((Number.isFinite(Number(form.logo?.borderAlpha)) ? Number(form.logo.borderAlpha) : 0.1) * 100)}%</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        value={Math.round((Number.isFinite(Number(form.logo?.borderAlpha)) ? Number(form.logo.borderAlpha) : 0.1) * 100)}
                        onChange={(e) => setLogo({ borderAlpha: Number(e.target.value) / 100 })}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSurfacesTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Боксы и модальные окна</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Цвет</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.surfaces && form.surfaces.color) || '#ffffff'}</div>
                      <input
                        type="color"
                        value={(form.surfaces && form.surfaces.color) || '#ffffff'}
                        onChange={(e) => setSurfaces({ color: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white/80 font-semibold">Прозрачность</div>
                      <div className="text-xs text-white/60 font-mono">
                        {Math.round(Math.min(1, Math.max(0, Number((form.surfaces && form.surfaces.alpha !== undefined) ? form.surfaces.alpha : 0.85))) * 100)}%
                      </div>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={Math.round(Math.min(1, Math.max(0, Number((form.surfaces && form.surfaces.alpha !== undefined) ? form.surfaces.alpha : 0.85))) * 100)}
                      onChange={(e) => setSurfaces({ alpha: Number(e.target.value) / 100 })}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div className="rounded-2xl bg-black/20 border border-white/10 p-4 space-y-3">
                    <div
                      className="rounded-2xl p-4 border border-white/10"
                      style={{
                        background: hexToRgba((form.surfaces && form.surfaces.color) || '#ffffff', Math.min(1, Math.max(0, Number((form.surfaces && form.surfaces.alpha !== undefined) ? form.surfaces.alpha : 0.85)))),
                        color: (form.contentText && form.contentText.primary) || '#0f2e3a'
                      }}
                    >
                      <div className="text-base font-bold">Пример модального окна</div>
                      <div className="text-sm mt-1" style={{ color: (form.contentText && form.contentText.muted) || '#5a7280' }}>Подпись и описание</div>
                    </div>
                    <div
                      className="rounded-2xl p-4 border border-white/10"
                      style={{
                        background: hexToRgba((form.surfaces && form.surfaces.color) || '#ffffff', Math.min(1, Math.max(0, Number((form.surfaces && form.surfaces.alpha !== undefined) ? form.surfaces.alpha : 0.85)))),
                        color: (form.contentText && form.contentText.primary) || '#0f2e3a'
                      }}
                    >
                      <div className="text-sm font-semibold">Пример бокса/карточки</div>
                      <div className="text-xs mt-1" style={{ color: (form.contentText && form.contentText.muted) || '#5a7280' }}>Имя сотрудника / название курса</div>
                    </div>
                  </div>
                </div>

                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Фильтр (Доп. образование)</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Цвет</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.eduFilter && form.eduFilter.color) || '#ffffff'}</div>
                      <input
                        type="color"
                        value={(form.eduFilter && form.eduFilter.color) || '#ffffff'}
                        onChange={(e) => setEduFilter({ color: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white/80 font-semibold">Прозрачность</div>
                      <div className="text-xs text-white/60 font-mono">
                        {Math.round(Math.min(1, Math.max(0, Number((form.eduFilter && form.eduFilter.alpha !== undefined) ? form.eduFilter.alpha : 0.08))) * 100)}%
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(Math.min(1, Math.max(0, Number((form.eduFilter && form.eduFilter.alpha !== undefined) ? form.eduFilter.alpha : 0.08))) * 100)}
                      onChange={(e) => setEduFilter({ alpha: Number(e.target.value) / 100 })}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                    <div
                      className="rounded-2xl p-4 border"
                      style={{
                        background: hexToRgba((form.eduFilter && form.eduFilter.color) || '#ffffff', Math.min(1, Math.max(0, Number((form.eduFilter && form.eduFilter.alpha !== undefined) ? form.eduFilter.alpha : 0.08)))),
                        borderColor: hexToRgba((form.eduFilter && form.eduFilter.color) || '#ffffff', Math.min(1, Math.max(0, Number((form.eduFilter && form.eduFilter.alpha !== undefined) ? form.eduFilter.alpha : 0.08)) + 0.08)),
                        color: (form.contentText && form.contentText.primary) || '#0f2e3a'
                      }}
                    >
                      <div className="text-sm font-semibold">Пример фона фильтра</div>
                      <div className="text-xs mt-1" style={{ color: (form.contentText && form.contentText.muted) || '#5a7280' }}>Используется в “Доп. образование”</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isMarqueesTarget && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Бегущие строки</label>
                  <button
                    type="button"
                    onClick={addOneMarquee}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    Добавить
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
                    <div className="flex justify-between text-[10px] text-white/40 uppercase">
                      <span>Слои</span>
                      <span>{marqueeList.length}</span>
                    </div>
                    {marqueeList.length === 0 ? (
                      <div className="text-sm text-white/50">Нет строк</div>
                    ) : (
                      <Reorder.Group axis="y" values={marqueeList} onReorder={setMarquees} className="space-y-2">
                        {marqueeList.map((m) => {
                          const isActive = activeMarqueeId === m.id
                          return (
                            <Reorder.Item
                              key={m.id}
                              value={m}
                              className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${isActive ? 'bg-emerald-600/15 border-emerald-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                              onClick={() => setActiveMarqueeId(m.id)}
                            >
                              <div className="min-w-0">
                                <div className="text-sm text-white font-semibold truncate">{(m.text || 'Строка')}</div>
                                <div className="text-[11px] text-white/50">
                                  {m.direction === -1 ? '←' : '→'} {Math.round((Number(m.duration || 0) || 0) * 10) / 10}s · {m.stroke ? 'обводка' : 'заливка'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); deleteOneMarquee(m.id) }}
                                className="p-2 rounded-lg bg-rose-600 border border-rose-600/40 text-white hover:brightness-110"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </Reorder.Item>
                          )
                        })}
                      </Reorder.Group>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
                    {!activeMarquee ? (
                      <div className="text-sm text-white/50">Выбери строку слева</div>
                    ) : (
                      <>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Текст</div>
                          <input
                            value={activeMarquee.text || ''}
                            onChange={(e) => updateOneMarquee(activeMarquee.id, { text: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40"
                            placeholder="Например: OSNOVA"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Размер</span>
                              <span>{Math.round(activeMarquee.fontSize || 0)}px</span>
                            </div>
                            <input
                              type="range"
                              min="24"
                              max="200"
                              value={Math.round(activeMarquee.fontSize || 120)}
                              onChange={(e) => updateOneMarquee(activeMarquee.id, { fontSize: Number(e.target.value) })}
                              className="w-full accent-emerald-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Непрозрачность</span>
                              <span>{Math.round((Number(activeMarquee.opacity ?? 1) * 100))}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round((Number(activeMarquee.opacity ?? 1) * 100))}
                              onChange={(e) => updateOneMarquee(activeMarquee.id, { opacity: Number(e.target.value) / 100 })}
                              className="w-full accent-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Скорость</span>
                              <span>{Math.round((Number(activeMarquee.duration || 0) || 0) * 10) / 10}s</span>
                            </div>
                            <input
                              type="range"
                              min="6"
                              max="80"
                              value={Math.round(Number(activeMarquee.duration || 30))}
                              onChange={(e) => updateOneMarquee(activeMarquee.id, { duration: Number(e.target.value) })}
                              className="w-full accent-emerald-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Направление</span>
                              <span>{activeMarquee.direction === -1 ? '←' : '→'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => updateOneMarquee(activeMarquee.id, { direction: -1 })}
                                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${activeMarquee.direction === -1 ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                              >
                                Влево
                              </button>
                              <button
                                type="button"
                                onClick={() => updateOneMarquee(activeMarquee.id, { direction: 1 })}
                                className={`px-3 py-2 rounded-xl border text-sm font-semibold ${activeMarquee.direction !== -1 ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
                              >
                                Вправо
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Шрифт</div>
                            <select
                              value={activeMarquee.fontFamily || 'system'}
                              onChange={(e) => updateOneMarquee(activeMarquee.id, { fontFamily: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white"
                            >
                              <option value="system">System</option>
                              <option value="serif">Serif</option>
                              <option value="mono">Mono</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Цвет</div>
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={activeMarquee.color || '#0f2e3a'}
                                onChange={(e) => updateOneMarquee(activeMarquee.id, { color: e.target.value })}
                                className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                              />
                              <div className="text-xs text-white/60 font-mono">{activeMarquee.color || '#0f2e3a'}</div>
                              <label className="ml-auto flex items-center gap-2">
                                <span className="text-sm text-white/70">Обводка</span>
                                <input
                                  type="checkbox"
                                  checked={!!activeMarquee.stroke}
                                  onChange={(e) => updateOneMarquee(activeMarquee.id, { stroke: e.target.checked, strokeWidth: e.target.checked ? (activeMarquee.strokeWidth || 2) : 0 })}
                                  className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                />
                              </label>
                            </div>
                            {activeMarquee.stroke && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-[10px] text-white/40 uppercase">
                                  <span>Толщина обводки</span>
                                  <span>{Math.round(activeMarquee.strokeWidth || 2)}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="6"
                                  value={Math.round(activeMarquee.strokeWidth || 2)}
                                  onChange={(e) => updateOneMarquee(activeMarquee.id, { strokeWidth: Number(e.target.value) })}
                                  className="w-full accent-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                          <div className="flex justify-between text-[10px] text-white/40 uppercase">
                            <span>Где показывать</span>
                            <span>видимость</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm text-white/80">Приветственный экран</span>
                              <input
                                type="checkbox"
                                checked={!!(activeMarquee.visibility && activeMarquee.visibility.welcome)}
                                onChange={(e) => updateOneMarquee(activeMarquee.id, { visibility: { ...(activeMarquee.visibility || {}), welcome: e.target.checked } })}
                                className="w-5 h-5 rounded bg-white/10 border border-white/20"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm text-white/80">Экран авторизации</span>
                              <input
                                type="checkbox"
                                checked={!!(activeMarquee.visibility && activeMarquee.visibility.auth)}
                                onChange={(e) => updateOneMarquee(activeMarquee.id, { visibility: { ...(activeMarquee.visibility || {}), auth: e.target.checked } })}
                                className="w-5 h-5 rounded bg-white/10 border border-white/20"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm text-white/80">Основной фон (пользователь)</span>
                              <input
                                type="checkbox"
                                checked={activeMarquee.visibility ? activeMarquee.visibility.user !== false : true}
                                onChange={(e) => updateOneMarquee(activeMarquee.id, { visibility: { ...(activeMarquee.visibility || {}), user: e.target.checked } })}
                                className="w-5 h-5 rounded bg-white/10 border border-white/20"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-3">
                              <span className="text-sm text-white/80">Основной фон (админ)</span>
                              <input
                                type="checkbox"
                                checked={activeMarquee.visibility ? activeMarquee.visibility.admin !== false : true}
                                onChange={(e) => updateOneMarquee(activeMarquee.id, { visibility: { ...(activeMarquee.visibility || {}), admin: e.target.checked } })}
                                className="w-5 h-5 rounded bg-white/10 border border-white/20"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                          <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Превью</div>
                          <div
                            className="rounded-2xl border border-white/10 overflow-hidden"
                            style={{
                              background: 'rgba(0,0,0,0.12)'
                            }}
                          >
                            <div className="flex overflow-hidden relative w-[200%]">
                              <div
                                className="flex gap-12 whitespace-nowrap py-6 px-4"
                                style={{
                                  fontFamily: activeMarquee.fontFamily === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' : activeMarquee.fontFamily === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
                                  fontWeight: activeMarquee.fontWeight || 900,
                                  fontSize: Math.max(24, Math.min(90, Number(activeMarquee.fontSize || 120) * 0.5)),
                                  letterSpacing: `${Number(activeMarquee.letterSpacing ?? -0.02)}em`
                                }}
                              >
                                {Array(10).fill(activeMarquee.text || '').map((t, i) => (
                                  <span
                                    key={`pv_${i}`}
                                    className="inline-block uppercase tracking-tighter"
                                    style={{
                                      color: activeMarquee.stroke ? 'transparent' : (activeMarquee.color || '#0f2e3a'),
                                      opacity: Number(activeMarquee.opacity ?? 1),
                                      WebkitTextStroke: activeMarquee.stroke ? `${Math.round(activeMarquee.strokeWidth || 2)}px ${(activeMarquee.color || '#0f2e3a')}` : undefined
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isThemesTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Темы</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="space-y-3">
                    <div className="text-sm text-white font-semibold">Дефолтная тема</div>
                    <div className="text-sm text-white/60">
                      Применяется, если у пользователя не выбрана иная тема.
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const override = {
                            header: form.header,
                            siteBg: form.siteBg,
                            searchBar: form.searchBar,
                            contentText: form.contentText,
                            surfaces: form.surfaces,
                            eduFilter: form.eduFilter,
                            primaryButtons: form.primaryButtons,
                            successButtons: form.successButtons,
                            dangerButtons: form.dangerButtons,
                            bgImages,
                            marquees: form.marquees,
                            brandText: String(brandText || 'OSNOVA'),
                            logo: form.logo,
                            welcomeTexts: Array.isArray(welcomeTexts) ? welcomeTexts : [],
                            showCursorEffect: !!form.showCursorEffect,
                          }
                          try {
                            const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
                            const bt = String(brandText || 'OSNOVA')
                            updateTheme({ welcomeTexts: items, brandText: bt })
                            try { welcomeLastSavedRef.current = JSON.stringify({ items, brandText: bt }) } catch { welcomeLastSavedRef.current = '' }
                            setWelcomeDirty(false)
                            setWelcomeSavedAt(nowTs())
                          } catch { void 0 }
                          if (typeof flushAppearanceSave === 'function') {
                            await flushAppearanceSave(override)
                          }
                        } catch { void 0 }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border bg-white/10 border-white/10 text-white hover:bg-white/15 transition-colors font-semibold"
                    >
                      <Save size={16} />
                      Сохранить как дефолтную
                    </button>
                  </div>

                  <div className="h-px bg-white/10" />

                  <div className="space-y-3">
                    <div className="text-sm text-white font-semibold">Сохранить текущую конфигурацию</div>
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40"
                      placeholder="Название темы"
                    />
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/80">Отображать тему</span>
                      <input
                        type="checkbox"
                        checked={presetPublished}
                        onChange={(e) => setPresetPublished(e.target.checked)}
                        className="w-5 h-5 rounded bg-white/10 border border-white/20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          try {
                            const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
                            const bt = String(brandText || 'OSNOVA')
                            updateTheme({ welcomeTexts: items, brandText: bt })
                            try { welcomeLastSavedRef.current = JSON.stringify({ items, brandText: bt }) } catch { welcomeLastSavedRef.current = '' }
                            setWelcomeDirty(false)
                            setWelcomeSavedAt(nowTs())
                          } catch { void 0 }
                          const id = await saveThemePreset({ name: presetName, published: presetPublished })
                          setPresetName('')
                          setPresetPublished(false)
                          if (id) setEditingPresetId(id)
                        } catch { void 0 }
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border bg-white/10 border-white/10 text-white hover:bg-white/15 transition-colors font-semibold"
                    >
                      <Save size={16} />
                      Сохранить
                    </button>
                  </div>

                  <div className="h-px bg-white/10" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white font-semibold">Список тем</div>
                      <div className="text-xs text-white/50">{(Array.isArray(savedThemes) ? savedThemes.length : 0)} шт.</div>
                    </div>

                    {(Array.isArray(savedThemes) ? savedThemes : []).length === 0 ? (
                      <div className="text-sm text-white/50">Пока нет сохранённых тем</div>
                    ) : (
                      <div className="space-y-2">
                        {(Array.isArray(savedThemes) ? savedThemes : []).map((t) => (
                          <div key={t.id} className={`rounded-2xl border p-3 bg-white/5 ${editingPresetId === t.id ? 'border-emerald-500/30' : 'border-white/10'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-2">
                                <input
                                  value={t.name || ''}
                                  onChange={(e) => updateThemePreset(t.id, { name: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white"
                                />
                                <label className="flex items-center justify-between gap-3">
                                  <span className="text-sm text-white/80">Отображать тему</span>
                                  <input
                                    type="checkbox"
                                    checked={!!t.published}
                                    onChange={(e) => updateThemePreset(t.id, { published: e.target.checked })}
                                    className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                  />
                                </label>
                              </div>

                              <button
                                type="button"
                                onClick={() => deleteThemePreset(t.id)}
                                className="p-2 rounded-xl bg-rose-600 border border-rose-600/40 text-white hover:brightness-110"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  applyThemePreset(t.id)
                                  setEditingPresetId(null)
                                }}
                                className="px-3 py-2 rounded-xl border bg-white/10 border-white/10 text-white hover:bg-white/15 transition-colors font-semibold"
                              >
                                Применить
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  applyThemePreset(t.id)
                                  setEditingPresetId(t.id)
                                }}
                                className="px-3 py-2 rounded-xl border bg-white/5 border-white/10 text-white/80 hover:bg-white/10 transition-colors font-semibold"
                              >
                                Редактировать
                              </button>
                              <button
                                type="button"
                                disabled={editingPresetId !== t.id}
                                onClick={() => {
                                  try {
                                    const items = Array.isArray(welcomeTexts) ? welcomeTexts : []
                                    const bt = String(brandText || 'OSNOVA')
                                    updateTheme({ welcomeTexts: items, brandText: bt })
                                    try { welcomeLastSavedRef.current = JSON.stringify({ items, brandText: bt }) } catch { welcomeLastSavedRef.current = '' }
                                    setWelcomeDirty(false)
                                    setWelcomeSavedAt(nowTs())
                                  } catch { void 0 }
                                  updateThemePreset(t.id, { config: exportThemeConfig() })
                                  setEditingPresetId(null)
                                }}
                                className={`px-3 py-2 rounded-xl border transition-colors font-semibold ${editingPresetId === t.id ? 'bg-emerald-600 border-emerald-600/40 text-white hover:brightness-110' : 'bg-white/5 border-white/10 text-white/30'}`}
                              >
                                Сохранить изменения
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isPrimaryButtonsTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Основные кнопки</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Фон</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.primaryButtons && form.primaryButtons.bg) || '#0f2e3a'}</div>
                      <input
                        type="color"
                        value={(form.primaryButtons && form.primaryButtons.bg) || '#0f2e3a'}
                        onChange={(e) => setPrimaryButtons({ bg: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/80 font-semibold">Текст</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.primaryButtons && form.primaryButtons.text) || '#ffffff'}</div>
                      <input
                        type="color"
                        value={(form.primaryButtons && form.primaryButtons.text) || '#ffffff'}
                        onChange={(e) => setPrimaryButtons({ text: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4 flex justify-center">
                    <button
                      data-theme-preview="true"
                      type="button"
                      style={{
                        backgroundColor: (form.primaryButtons && form.primaryButtons.bg) || '#0f2e3a',
                        color: (form.primaryButtons && form.primaryButtons.text) || '#ffffff',
                        borderColor: 'rgba(255,255,255,0.18)'
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold"
                    >
                      Пример кнопки
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isSuccessButtonsTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Создать / Сохранить</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Фон</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.successButtons && form.successButtons.bg) || '#059669'}</div>
                      <input
                        type="color"
                        value={(form.successButtons && form.successButtons.bg) || '#059669'}
                        onChange={(e) => setSuccessButtons({ bg: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/80 font-semibold">Текст</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.successButtons && form.successButtons.text) || '#ffffff'}</div>
                      <input
                        type="color"
                        value={(form.successButtons && form.successButtons.text) || '#ffffff'}
                        onChange={(e) => setSuccessButtons({ text: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4 flex justify-center">
                    <button
                      data-theme-preview="true"
                      type="button"
                      style={{
                        backgroundColor: (form.successButtons && form.successButtons.bg) || '#059669',
                        color: (form.successButtons && form.successButtons.text) || '#ffffff',
                        borderColor: 'rgba(255,255,255,0.18)'
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isDangerButtonsTarget && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Удалить / Отмена</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white font-semibold">Фон</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.dangerButtons && form.dangerButtons.bg) || '#dc2626'}</div>
                      <input
                        type="color"
                        value={(form.dangerButtons && form.dangerButtons.bg) || '#dc2626'}
                        onChange={(e) => setDangerButtons({ bg: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-white/80 font-semibold">Текст</div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-white/60 font-mono">{(form.dangerButtons && form.dangerButtons.text) || '#ffffff'}</div>
                      <input
                        type="color"
                        value={(form.dangerButtons && form.dangerButtons.text) || '#ffffff'}
                        onChange={(e) => setDangerButtons({ text: e.target.value })}
                        className="w-10 h-10 rounded-xl border border-white/10 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 p-4 flex justify-center">
                    <button
                      data-theme-preview="true"
                      type="button"
                      style={{
                        backgroundColor: (form.dangerButtons && form.dangerButtons.bg) || '#dc2626',
                        color: (form.dangerButtons && form.dangerButtons.text) || '#ffffff',
                        borderColor: 'rgba(255,255,255,0.18)'
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isSpecialTarget && (
              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                  {currentConfig.type === 'gradient' ? 'Цвета градиента' : 'Цвет'}
                </label>
                {currentConfig.type === 'gradient' && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => removeColor(currentConfig.colors.length - 1)}
                      disabled={currentConfig.colors.length <= 2}
                      className="p-1 rounded-lg bg-white/5 text-white/40 hover:text-white disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-xs text-white font-medium w-4 text-center">{currentConfig.colors.length}</span>
                    <button 
                      onClick={addColor}
                      disabled={currentConfig.colors.length >= 5}
                      className="p-1 rounded-lg bg-white/5 text-white/40 hover:text-white disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 pb-12 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-10">
                <div className="relative w-full h-12 flex items-center justify-center">
                  <Reorder.Group 
                    axis="x" 
                    values={currentConfig.colors} 
                    onReorder={(newColors) => setConfig({ colors: newColors })}
                    className="flex gap-4"
                  >
                    {currentConfig.colors.map((color, idx) => (
                      <Reorder.Item 
                        key={`${activeTarget}-${idx}-${color}`} 
                        value={color}
                        className="relative group cursor-grab active:cursor-grabbing"
                      >
                        <div className="relative">
                          <input 
                            type="color"
                            value={color}
                            onChange={(e) => updateColor(idx, e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <motion.div 
                            className="w-10 h-10 rounded-full border-2 border-white/20 shadow-xl"
                            style={{ backgroundColor: color }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          />
                        </div>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-mono text-white/80 uppercase tracking-tighter bg-black/40 px-1.5 py-0.5 rounded-md border border-white/5 whitespace-nowrap">
                            {color}
                          </span>
                          <MoveHorizontal size={10} className="text-white/40" />
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
                
                {currentConfig.type === 'gradient' && (
                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-[10px] text-white/40 uppercase">
                      <span>Угол</span>
                      <span>{currentConfig.angle}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="360" 
                      value={currentConfig.angle}
                      onChange={(e) => setConfig({ angle: parseInt(e.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                )}

                {currentConfig.type === 'gradient' && currentConfig.colors.length >= 2 && (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Пропорции</div>
                      <div className="text-xs text-white/50">{currentConfig.useStops ? 'Включено' : 'Не применено'}</div>
                    </div>
                    <div
                      className="relative w-full h-10 rounded-xl border border-white/10 overflow-hidden"
                      style={{ background: buildSegmentsCss(currentConfig.angle, currentConfig.colors, gradientStops) }}
                    >
                      {gradientStops.map((p, idx) => (
                        <div
                          key={`${activeTarget}-stop-${idx}`}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const rect = e.currentTarget.parentElement?.getBoundingClientRect?.()
                            if (!rect) return
                            const list = Array.isArray(currentConfig.colors) ? currentConfig.colors : []
                            const nextStops = normalizeStops(list, gradientStops)
                            try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
                            const move = (ev) => {
                              const p = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100
                              const min = idx === 0 ? 1 : nextStops[idx - 1] + 1
                              const max = idx === nextStops.length - 1 ? 99 : nextStops[idx + 1] - 1
                              nextStops[idx] = Math.round(Math.min(max, Math.max(min, p)))
                              setConfig({ stops: [...nextStops], useStops: true })
                            }
                            const up = () => {
                              window.removeEventListener('pointermove', move)
                              window.removeEventListener('pointerup', up)
                            }
                            window.addEventListener('pointermove', move)
                            window.addEventListener('pointerup', up)
                          }}
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-8 -ml-2 rounded-lg bg-white/90 border border-white/40 shadow cursor-ew-resize"
                          style={{ left: `${p}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentConfig.colors.map((c, idx) => (
                        <div key={`${activeTarget}-seg-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                          <div className="text-xs text-white/70">{segmentPercents[idx] || 0}%</div>
                        </div>
                      ))}
                    </div>
                    <div className="w-full space-y-2 pt-1">
                      <div className="flex justify-between text-[10px] text-white/40 uppercase">
                        <span>Мягкость</span>
                        <span>{Math.round(Number(currentConfig.softness || 0))}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Number.isFinite(Number(currentConfig.softness)) ? Number(currentConfig.softness) : 0}
                        onChange={(e) => setConfig({ softness: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {activeTarget === 'siteBg' && (
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Картинка на фон</label>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    className="hidden"
                  />
                  <div
                    className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'copy'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      fileActionRef.current = 'add'
                      applyPickedImage(file)
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-white">
                        <div className="text-sm font-semibold">Добавь картинку</div>
                        <div className="text-xs text-white/50">
                          Перетащи сюда файл, нажми «Загрузить» или вставь из буфера (Ctrl+V)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => pickFile('add')}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors text-sm font-medium"
                      >
                        <ImageIcon size={16} />
                        Загрузить
                      </button>
                    </div>

                    {activeBgImage && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                          <div
                            className="w-full"
                            style={{
                              aspectRatio: '16 / 10',
                              backgroundImage: `url(${activeBgImage.src})`,
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: 'cover'
                            }}
                          />
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                          <button
                            type="button"
                            onClick={() => setBgImageEditMode(v => !v)}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-colors text-sm font-bold ${bgImageEditMode ? 'bg-emerald-600 border-emerald-600/40 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                          >
                            <Move size={16} />
                            {bgImageEditMode ? 'Режим перемещения: ВКЛ' : 'Режим перемещения: ВЫКЛ'}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                fileActionRef.current = 'replace'
                                pickFile('replace')
                              }}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                              <ImageIcon size={16} />
                              Заменить
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBgImage(activeBgImage.id, { x: 50, y: 50, scale: 1, rotation: 0 })}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                              <RotateCcw size={16} />
                              Сброс
                            </button>
                            <button
                              type="button"
                              onClick={() => cloneBgImage(activeBgImage.id)}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                              <Copy size={16} />
                              Клон
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBgImage(activeBgImage.id)}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-600 border border-rose-600/40 text-white hover:brightness-110 transition-colors text-sm font-bold"
                            >
                              <Trash2 size={16} />
                              Удалить
                            </button>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Где показывать</span>
                              <span>видимость</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-sm text-white/80">Приветственный экран</span>
                                <input
                                  type="checkbox"
                                  checked={!!(activeBgImage.visibility && activeBgImage.visibility.welcome)}
                                  onChange={(e) => updateBgImage(activeBgImage.id, { visibility: { ...(activeBgImage.visibility || {}), welcome: e.target.checked } })}
                                  className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-sm text-white/80">Экран авторизации</span>
                                <input
                                  type="checkbox"
                                  checked={!!(activeBgImage.visibility && activeBgImage.visibility.auth)}
                                  onChange={(e) => updateBgImage(activeBgImage.id, { visibility: { ...(activeBgImage.visibility || {}), auth: e.target.checked } })}
                                  className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-sm text-white/80">Основной фон (пользователь)</span>
                                <input
                                  type="checkbox"
                                  checked={activeBgImage.visibility ? activeBgImage.visibility.user !== false : true}
                                  onChange={(e) => updateBgImage(activeBgImage.id, { visibility: { ...(activeBgImage.visibility || {}), user: e.target.checked } })}
                                  className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3">
                                <span className="text-sm text-white/80">Основной фон (админ)</span>
                                <input
                                  type="checkbox"
                                  checked={activeBgImage.visibility ? activeBgImage.visibility.admin !== false : true}
                                  onChange={(e) => updateBgImage(activeBgImage.id, { visibility: { ...(activeBgImage.visibility || {}), admin: e.target.checked } })}
                                  className="w-5 h-5 rounded bg-white/10 border border-white/20"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Масштаб</span>
                              <span>{Math.round((activeBgImage.scale || 1) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="500"
                              value={Math.round((activeBgImage.scale || 1) * 100)}
                              onChange={(e) => updateBgImage(activeBgImage.id, { scale: Number(e.target.value) / 100 })}
                              className="w-full accent-emerald-500"
                            />
                            <div className="text-[11px] text-white/50">
                              В режиме перемещения: drag — позиция, колёсико — масштаб.
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-white/40 uppercase">
                              <span>Поворот</span>
                              <span>{Math.round(activeBgImage.rotation || 0)}°</span>
                            </div>
                            <input
                              type="range"
                              min="-180"
                              max="180"
                              value={Math.round(activeBgImage.rotation || 0)}
                              onChange={(e) => updateBgImage(activeBgImage.id, { rotation: Number(e.target.value) })}
                              className="w-full accent-emerald-500"
                            />
                            <div className="text-[11px] text-white/50">
                              Можно крутить и мышью: зажми кнопку вращения на картинке и двигай мышью.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {Array.isArray(bgImages) && bgImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-white/40 uppercase">
                        <span>Слои</span>
                        <span>{bgImages.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bgImages.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setActiveBgImageId(img.id)}
                            className={`w-12 h-12 rounded-xl border overflow-hidden transition-colors ${activeBgImageId === img.id ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]' : 'border-white/10 hover:border-white/20'}`}
                            style={{
                              backgroundImage: `url(${img.src})`,
                              backgroundPosition: 'center',
                              backgroundSize: 'cover'
                            }}
                            title="Выбрать"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => pickFile('add')}
                          className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 flex items-center justify-center"
                          title="Добавить"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Settings */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Дополнительно</label>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 text-white">
                  <MousePointer2 size={18} className="text-emerald-400" />
                  <span className="text-sm">Эффект курсора</span>
                </div>
                <button
                  onClick={toggleCursor}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.showCursorEffect ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.showCursorEffect ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 pt-6 border-t border-white/10">
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
        >
          <RotateCcw size={16} />
          Сброс
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl !bg-emerald-600 text-white border border-emerald-600/40 transition-all text-sm font-bold shadow-lg shadow-emerald-900/20 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-110'}`}
        >
          <Save size={16} />
          Готово
        </button>
      </div>
    </motion.div>
  )

  const editSaveOverlay = bgImageEditMode
    ? createPortal(
        <div className="fixed inset-x-0 bottom-6 z-[40000] pointer-events-none">
          <div className="flex justify-center px-4 pointer-events-none">
            <button
              type="button"
              onClick={() => setBgImageEditMode(false)}
              className="pointer-events-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-emerald-600 text-white border border-emerald-600/40 hover:brightness-110 transition-all text-sm font-bold shadow-2xl shadow-emerald-900/20"
            >
              <Save size={16} />
              Сохранить
            </button>
          </div>
        </div>,
        document.body
      )
    : null

  if (!isModal) {
    return (
      <div className="min-h-screen pt-16 pb-6 px-4">
        <div className="flex justify-center">
          {panel}
        </div>
        {styles}
        {editSaveOverlay}
      </div>
    )
  }

  const modalContent = (
    <AnimatePresence>
      <div key="theme-settings-root" className="fixed inset-0 z-[30000] flex items-center justify-center p-4 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={bgImageEditMode ? undefined : handleClose}
          className={`absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity ${bgImageEditMode ? 'opacity-0 pointer-events-none' : 'pointer-events-auto'}`} 
        />
        {panel}
        {styles}
        {editSaveOverlay}
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
