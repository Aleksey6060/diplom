import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import CourseCard from '../../../components/CourseCard'
import { Plus, ChevronDown, Folder, FileText, Trash2, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { api } from '../../../lib/api'

export default function AdminStore() {
  const { universitySlug } = useParams()
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [simpleCourses, setSimpleCourses] = useState([])
  const [form, setForm] = useState({
    title: '',
    category: '',
    price: '',
    imageUrl: '',
    description: '',
    level: 'Начинающий',
    duration: '—',
    rating: '',
    contentFolderId: ''
  })
  const [imageFile, setImageFile] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderQuery, setFolderQuery] = useState('')
  const folderButtonRef = useRef(null)
  const [folderMenuPos, setFolderMenuPos] = useState({ left: 0, top: 0, width: 0 })
  const [adminQuery, setAdminQuery] = useState(() => {
    try { return localStorage.getItem('admin_search_query') || '' } catch { return '' }
  })
  useEffect(() => {
    const onAdminSearch = (e) => { setAdminQuery((e.detail && e.detail.query) || '') }
    window.addEventListener('admin_search_update', onAdminSearch)
    return () => window.removeEventListener('admin_search_update', onAdminSearch)
  }, [])
  const filteredItems = useMemo(() => {
    const q = (adminQuery || '').trim().toLowerCase()
    if (!q) return items
    return items.filter(c => {
      const byTitle = (c.title || '').toLowerCase().includes(q)
      const byPriceStr = String(c.price || '').toLowerCase().includes(q)
      const byPriceEq = Number.isFinite(Number(q)) && (c.price || 0) === Number(q)
      return byTitle || byPriceStr || byPriceEq
    })
  }, [items, adminQuery])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.courses.storeCards.list({ universitySlug })
        const normalized = Array.isArray(list) ? list.map(c => ({
          id: c.id,
          title: c.title || '',
          category: c.category || '',
          price: Number(c.price || 0),
          image: c.image || '',
          description: c.description || '',
          level: c.level || 'Начинающий',
          duration: c.duration || '—',
          rating: Number(c.rating || 0),
          contentFolderId: c.course ? String(c.course) : (c.content_folder_id || ''),
        })) : []
        if (!cancelled) setItems(normalized)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.courses.listSimple({ universitySlug })
        const normalized = Array.isArray(list) ? list.map(c => ({
          id: String(c.id),
          title: c.title || '',
          slug: c.slug || '',
        })) : []
        if (!cancelled) setSimpleCourses(normalized)
      } catch {
        if (!cancelled) setSimpleCourses([])
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  const resetForm = () => {
    setForm({ title: '', category: '', price: '', imageUrl: '', description: '', level: 'Начинающий', duration: '—', rating: '', contentFolderId: '' })
    setImageFile(null)
    setEditingId(null)
    setShowForm(false)
  }

  const pickForEdit = (id) => {
    const c = items.find(x => x.id === id)
    if (!c) return
    setEditingId(id)
    setForm({
      title: c.title || '',
      category: c.category || '',
      price: String(c.price ?? ''),
      imageUrl: c.image || '',
      description: c.description || '',
      level: c.level || 'Начинающий',
      duration: c.duration || '—',
      rating: String(c.rating ?? ''),
      contentFolderId: c.contentFolderId || ''
    })
    setImageFile(null)
    setShowForm(true)
  }

  const handleFile = async (file) => {
    if (!file) return null
    const reader = new FileReader()
    return new Promise((resolve) => {
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    const dataUrl = imageFile ? await handleFile(imageFile) : null
    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || 'Обучение',
      price: Number(form.price || 0),
      image: dataUrl || form.imageUrl || 'https://picsum.photos/seed/course/1200/800',
      description: form.description.trim(),
      level: form.level || 'Начинающий',
      duration: form.duration || '—',
      rating: Number(form.rating || 0),
      course: form.contentFolderId ? Number(form.contentFolderId) : null,
      content_folder_id: form.contentFolderId || '',
      is_active: true,
    }
    const saved = editingId
      ? await api.courses.storeCards.update(editingId, payload, { universitySlug })
      : await api.courses.storeCards.create(payload, { universitySlug })
    const normalized = {
      id: saved.id,
      title: saved.title || '',
      category: saved.category || '',
      price: Number(saved.price || 0),
      image: saved.image || '',
      description: saved.description || '',
      level: saved.level || 'Начинающий',
      duration: saved.duration || '—',
      rating: Number(saved.rating || 0),
      contentFolderId: saved.course ? String(saved.course) : (saved.content_folder_id || ''),
    }
    setItems(prev => {
      const exists = prev.some(x => x.id === normalized.id)
      if (exists) return prev.map(x => x.id === normalized.id ? normalized : x)
      return [normalized, ...prev]
    })
    resetForm()
  }

  const remove = async (id) => {
    await api.courses.storeCards.remove(id, { universitySlug })
    setItems(prev => prev.filter(x => x.id !== id))
  }

  const canSubmit = useMemo(() => {
    return form.title.trim().length > 0
  }, [form.title])

  return (
    <div className="space-y-6 pt-4 store-settings">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Настройка магазина</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-3 lg:px-4 h-11 rounded-xl !bg-emerald-600 !border-emerald-600/40 flex items-center gap-2 shrink-0"
          >
            <Plus size={16} />
            <span className="whitespace-nowrap">Создать карточку</span>
          </button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6 sm:p-6 overflow-y-auto overscroll-contain">
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowForm(false)}
                className="absolute inset-0 modal-overlay"
              />
              <Motion.form
                onSubmit={submit}
                className="relative w-[92vw] max-w-md sm:max-w-lg modal-panel rounded-3xl p-4 sm:p-6 space-y-3 max-h-[82dvh] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain"
                data-panel="true"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: folderOpen ? 0.85 : 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-[#0f2e3a] font-medium text-sm">{editingId ? 'Редактирование курса' : 'Создание карточки'}</div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Название курса</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none"
                    placeholder="React Native Masterclass"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Категория</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none"
                    placeholder="Frontend"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Описание</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none h-20 resize-none text-sm"
                    placeholder="Краткое описание курса"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Цена (₽)</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Рейтинг</label>
                    <input
                      type="number"
                      step="0.1"
                      max="5"
                      value={form.rating}
                      onChange={(e) => setForm(f => ({ ...f, rating: e.target.value }))}
                      className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none text-sm"
                      placeholder="5.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Длительность</label>
                    <input
                      value={form.duration}
                      onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))}
                      className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none text-sm"
                      placeholder="20 ч"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#266479] mb-1">Уровень</label>
                    <input
                      value={form.level}
                      onChange={(e) => setForm(f => ({ ...f, level: e.target.value }))}
                      className="w-full bg-white/70 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none text-sm"
                      placeholder="Новичок"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="relative md:col-span-2">
                    <label className="block text-xs text-[#266479] mb-1">Папка контента из проводника</label>
                    <button
                      type="button"
                      ref={folderButtonRef}
                      onClick={() => {
                        const el = folderButtonRef.current
                        if (el) {
                          const r = el.getBoundingClientRect()
                          setFolderMenuPos({ left: r.left, top: r.bottom + 8, width: r.width })
                        }
                        setFolderOpen(o => !o)
                      }}
                      className="w-full bg-white/80 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] flex items-center justify-between hover:brightness-110 hover:border-[#266479]/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 transition text-sm"
                    >
                      <span className="truncate">
                        {(() => {
                          const sel = (simpleCourses || []).find(x => String(x.id) === String(form.contentFolderId))
                          return sel ? sel.title : 'Не выбрано'
                        })()}
                      </span>
                      <ChevronDown size={16} className="text-[#0f2e3a]/70 shrink-0" />
                    </button>
                    {folderOpen && createPortal(
                      <div
                        className="fixed z-[11000] bg-white/90 backdrop-blur-xl border border-[#266479]/20 rounded-xl shadow-2xl"
                        style={{ left: folderMenuPos.left, top: folderMenuPos.top, width: folderMenuPos.width }}
                      >
                        <div className="p-3 border-b border-white/10">
                          <input
                            value={folderQuery}
                            onChange={(e) => setFolderQuery(e.target.value)}
                            placeholder="Поиск курса…"
                            className="w-full bg-white/70 border border-[#266479]/20 rounded-lg px-3 py-2 text-[#0f2e3a] placeholder-[#5a7280] focus:outline-none focus:ring-1 focus:ring-fuchsia-500/30"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto p-2 text-sm">
                          <button
                            onClick={() => { setForm(f => ({ ...f, contentFolderId: '' })); setFolderOpen(false) }}
                            className={`w-full text-left px-3 py-2 rounded-lg border ${form.contentFolderId === '' ? 'bg-white/80 border-[#266479]/20 text-[#0f2e3a]' : 'bg-transparent border-[#266479]/10 text-[#0f2e3a]/80 hover:bg-white/70'}`}
                          >
                            Не выбрано
                          </button>
                          {(simpleCourses || [])
                            .filter(f => {
                              const q = folderQuery.trim().toLowerCase()
                              if (!q) return true
                              const t = (f.title || '').toLowerCase()
                              const n = (f.slug || '').toLowerCase()
                              return t.includes(q) || n.includes(q)
                            })
                            .map(f => (
                              <button
                                key={f.id}
                                onClick={() => { setForm(prev => ({ ...prev, contentFolderId: f.id })); setFolderOpen(false) }}
                                className={`w-full text-left px-3 py-2 rounded-lg border flex items-center gap-2 ${form.contentFolderId === f.id ? 'bg-white/80 border-[#266479]/20 text-[#0f2e3a]' : 'bg-white/70 border-[#266479]/10 text-[#0f2e3a]/80 hover:bg-white/80'}`}
                              >
                                <div className="w-6 h-6 rounded-md bg-white/80 border border-[#266479]/20 flex items-center justify-center shrink-0">
                                  <Folder size={14} className="text-[#0f2e3a]/80" />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate">{f.title || f.name}</div>
                                  <div className="text-xs text-[#5a7280] truncate">{f.slug}</div>
                                </div>
                              </button>
                            ))}
                          {((simpleCourses || []).length === 0) && (
                            <div className="px-3 py-2 text-sm text-[#266479]">Нет доступных курсов</div>
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                    <p className="text-xs text-[#266479] mt-1">Этот курс используется как источник материалов для карточки</p>
                  </div>
                </div>
                <div className="md:col-span-2 mt-3">
                  <div className="w-full bg-white/80 border border-[#266479]/20 rounded-xl p-3 text-[#0f2e3a]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#266479] mb-1">Ссылка на изображение</label>
                        <input
                          value={form.imageUrl}
                          onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-[#266479]/70 focus:outline-none text-sm"
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#266479] mb-1">Или загрузите файл</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-[#266479] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#266479]/20 file:text-xs file:font-medium file:bg-white/80 file:text-[#0f2e3a] hover:file:bg-white/90"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="px-3 lg:px-3.5 h-9 rounded-lg !bg-emerald-600 !border-emerald-600/40 disabled:opacity-50 flex items-center gap-2 shrink-0 text-sm"
                    >
                      <FileText size={16} />
                      <span className="hidden sm:inline whitespace-nowrap btn-label">{editingId ? 'Сохранить изменения' : 'Добавить курс'}</span>
                    </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => { remove(editingId); resetForm() }}
                      className="px-3 lg:px-3.5 h-9 rounded-lg !bg-red-600 !border-red-600/40 flex items-center gap-2 shrink-0 text-sm"
                    >
                      <Trash2 size={16} />
                      <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить курс</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 lg:px-3.5 h-9 rounded-lg !bg-red-600 !border-red-600/40 flex items-center gap-2 shrink-0 text-sm"
                  >
                    <X size={16} />
                    <span className="hidden sm:inline whitespace-nowrap btn-label">Отмена</span>
                  </button>
                </div>
              </Motion.form>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((course, idx) => (
            <Motion.div
              key={course.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut', delay: idx * 0.03 }}
              onClick={() => pickForEdit(course.id)}
              className="cursor-pointer w-full"
            >
              <CourseCard
                title={course.title}
                description={course.description}
                price={course.price}
                image={course.image}
                category={course.category}
                level={course.level}
                duration={course.duration}
                purchased={false}
              />
            </Motion.div>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full text-[#266479] text-sm">
              Пока нет добавленных курсов — нажмите «Создать карточку»
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
