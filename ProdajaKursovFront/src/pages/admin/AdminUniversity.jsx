import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { Plus, X, Trash2, CheckCircle2, Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BASE_URL = (() => {
  try {
    const raw = import.meta?.env?.VITE_API_BASE_URL
    return typeof raw === 'string' ? raw.replace(/\/+$/, '') : ''
  } catch { return '' }
})()

function logoUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

export default function AdminUniversity() {
  const { user } = useAuth()
  const { universitySlug } = useParams()
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  if (!isOwner) {
    return <Navigate to={universitySlug ? `/${universitySlug}/admin/courses` : '/admin/courses'} replace />
  }

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const emptyForm = useMemo(() => ({
    name: '',
    description: '',
    slug: '',
    expires_at: '',
    owner_email: '',
    owner_password: '',
    owner_first_name: '',
    owner_last_name: '',
  }), [])

  const [form, setForm] = useState(emptyForm)
  const [logoFile, setLogoFile] = useState(null)
  const [error, setError] = useState('')
  const [editingSlug, setEditingSlug] = useState(null)
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalForm, setModalForm] = useState(emptyForm)
  const [modalLogoFile, setModalLogoFile] = useState(null)
  const [modalError, setModalError] = useState('')
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const fetchUniversities = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError('')
      const data = await api.universities.list()
      const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setItems(list)
    } catch (e) {
      console.error('Не удалось загрузить университеты', e, e?.status, e?.body)
      let msg
      if (e?.status === 403) {
        msg = 'Нет прав для просмотра списка университетов (universities.view)'
      } else if (e?.body?.detail) {
        msg = String(e.body.detail)
      } else {
        msg = e?.message || 'Не удалось загрузить список'
      }
      if (e?.status) msg += ` (HTTP ${e.status})`
      setLoadError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUniversities() }, [fetchUniversities])

  const sorted = useMemo(() => {
    const arr = Array.isArray(items) ? items.slice() : []
    return arr.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
  }, [items])

  const resetCreate = () => {
    setForm(emptyForm)
    setLogoFile(null)
    setError('')
    setEditingSlug(null)
  }

  const formatError = (e) => {
    if (e?.body && typeof e.body === 'object') {
      const messages = []
      for (const [key, val] of Object.entries(e.body)) {
        const msg = Array.isArray(val) ? val.join(', ') : String(val)
        messages.push(`${key}: ${msg}`)
      }
      if (messages.length) return messages.join('; ')
    }
    return e?.message || 'Произошла ошибка'
  }

  const formatDatetimeForInput = (val) => {
    if (!val) return ''
    try {
      const d = new Date(val)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().slice(0, 16)
    } catch { return '' }
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    setError('')

    const name = String(form.name || '').trim()
    if (!name) { setError('Заполните название'); return }

    if (editingSlug) {
      try {
        setSubmitting(true)
        const payload = {
          name,
          description: String(form.description || '').trim(),
          is_active: true,
        }
        const slug = String(form.slug || '').trim()
        if (slug) payload.slug = slug
        const exp = String(form.expires_at || '').trim()
        if (exp) payload.expires_at = new Date(exp).toISOString()
        if (logoFile) payload.logo = logoFile
        await api.universities.update(editingSlug, payload)
        await fetchUniversities()
        resetCreate()
      } catch (err) {
        setError(formatError(err))
      } finally {
        setSubmitting(false)
      }
    } else {
      const ownerEmail = String(form.owner_email || '').trim()
      const ownerPassword = String(form.owner_password || '').trim()
      if (!ownerEmail) { setError('Укажите электронную почту владельца'); return }
      if (!ownerPassword) { setError('Укажите пароль владельца'); return }

      try {
        setSubmitting(true)
        const payload = {
          name,
          description: String(form.description || '').trim(),
          owner_email: ownerEmail,
          owner_password: ownerPassword,
          owner_first_name: String(form.owner_first_name || '').trim(),
          owner_last_name: String(form.owner_last_name || '').trim(),
        }
        const slug = String(form.slug || '').trim()
        if (slug) payload.slug = slug
        const exp = String(form.expires_at || '').trim()
        if (exp) payload.expires_at = new Date(exp).toISOString()
        if (logoFile) payload.logo = logoFile
        await api.universities.create(payload)
        await fetchUniversities()
        resetCreate()
      } catch (err) {
        setError(formatError(err))
      } finally {
        setSubmitting(false)
      }
    }
  }

  const startEdit = (slug) => {
    const uni = sorted.find(x => x.slug === slug)
    if (!uni) return
    setEditingSlug(uni.slug)
    setError('')
    setLogoFile(null)
    setForm({
      name: uni.name || '',
      description: uni.description || '',
      slug: uni.slug || '',
      expires_at: formatDatetimeForInput(uni.expires_at),
      owner_email: '',
      owner_password: '',
      owner_first_name: '',
      owner_last_name: '',
    })
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { void 0 }
  }

  const openModal = (slug) => {
    const uni = sorted.find(x => x.slug === slug)
    if (!uni) return
    setSelectedSlug(uni.slug)
    setModalForm({
      name: uni.name || '',
      description: uni.description || '',
      slug: uni.slug || '',
      expires_at: formatDatetimeForInput(uni.expires_at),
      owner_email: '',
      owner_password: '',
      owner_first_name: '',
      owner_last_name: '',
      _logo: uni.logo || '',
      _owner_display_name: uni.owner_display_name || '',
      _is_active: uni.is_active,
      _users_count: uni.users_count,
      _courses_count: uni.courses_count,
    })
    setModalLogoFile(null)
    setModalError('')
    setModalOpen(true)
  }

  const saveModal = async () => {
    if (!selectedSlug) return
    setModalError('')
    const name = String(modalForm.name || '').trim()
    if (!name) { setModalError('Заполните название'); return }

    try {
      setModalSubmitting(true)
      const payload = {
        name,
        description: String(modalForm.description || '').trim(),
      }
      const slug = String(modalForm.slug || '').trim()
      if (slug && slug !== selectedSlug) payload.slug = slug
      const exp = String(modalForm.expires_at || '').trim()
      if (exp) payload.expires_at = new Date(exp).toISOString()
      else payload.expires_at = null
      if (modalLogoFile) payload.logo = modalLogoFile
      await api.universities.update(selectedSlug, payload)
      await fetchUniversities()
      setModalOpen(false)
    } catch (err) {
      setModalError(formatError(err))
    } finally {
      setModalSubmitting(false)
    }
  }

  const deleteModal = async () => {
    if (!selectedSlug) return
    if (!window.confirm('Деактивировать университет? Он перестанет быть доступен, но данные сохранятся.')) return
    try {
      setModalSubmitting(true)
      await api.universities.remove(selectedSlug)
      await fetchUniversities()
      setModalOpen(false)
    } catch (err) {
      setModalError(formatError(err))
    } finally {
      setModalSubmitting(false)
    }
  }

  const selectedUni = useMemo(() => sorted.find(x => x.slug === selectedSlug), [sorted, selectedSlug])

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Создание университета</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="admin-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-white font-semibold text-lg">{editingSlug ? 'Редактирование университета' : 'Новый университет'}</div>
            {editingSlug ? (
              <button onClick={resetCreate} className="px-3 py-1.5 rounded-xl !bg-red-600 !border-red-500/20 text-white hover:brightness-105">
                Отмена
              </button>
            ) : (
              <button onClick={resetCreate} className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15">
                Очистить
              </button>
            )}
          </div>

          <form onSubmit={submitCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-[#266479] mb-1">Название</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[#266479] mb-1">Описание</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[#266479] mb-1">Логотип</label>
              <div className="flex items-center gap-3">
                <label className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
                  <ImageIcon size={16} />
                  <span>Выбрать файл</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </label>
                {logoFile && (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                    <img src={URL.createObjectURL(logoFile)} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[#266479] mb-1">Slug (URL-путь, авто если пусто)</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto-from-name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs text-[#266479] mb-1">Действует до</label>
              <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>

            {!editingSlug && (
              <>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Email владельца</label>
                  <input type="email" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Пароль владельца</label>
                  <input type="password" value={form.owner_password} onChange={e => setForm(f => ({ ...f, owner_password: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Имя владельца (опц.)</label>
                  <input value={form.owner_first_name} onChange={e => setForm(f => ({ ...f, owner_first_name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Фамилия владельца (опц.)</label>
                  <input value={form.owner_last_name} onChange={e => setForm(f => ({ ...f, owner_last_name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
              </>
            )}

            {error && (
              <div className="md:col-span-2 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{editingSlug ? 'Сохранить' : 'Создать'}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="admin-card rounded-2xl p-6">
          <div className="text-white font-semibold text-lg mb-4">Университеты</div>
          {loading ? (
            <div className="flex items-center gap-2 text-white/70 text-sm py-4">
              <Loader2 size={16} className="animate-spin" />
              <span>Загрузка...</span>
            </div>
          ) : loadError ? (
            <div className="space-y-3">
              <div className="text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                {loadError}
              </div>
              <button onClick={fetchUniversities} className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 text-sm">
                Повторить
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[68vh] overflow-auto pr-1 custom-scrollbar">
              {sorted.map(u => (
                <div
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openModal(u.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openModal(u.slug)
                  }}
                  className="w-full text-left rounded-2xl border border-[#266479]/20 bg-white hover:bg-black/5 transition p-4 cursor-pointer select-none outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#266479]/20 bg-white shrink-0">
                        {u.logo ? <img src={logoUrl(u.logo)} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[#0f2e3a] font-semibold text-base truncate">{u.name}</div>
                        <div className="text-[#5a7280] text-xs truncate">/{u.slug}</div>
                        <div className="text-[#5a7280] text-sm truncate">{u.owner_display_name || ''}</div>
                        <div className="text-[#5a7280] text-xs truncate">{u.expires_at ? `до ${new Date(u.expires_at).toLocaleDateString()}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/${u.slug}/admin/courses`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-black/5 flex items-center gap-1"
                        title="Перейти в университет"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          startEdit(u.slug)
                        }}
                        className="px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-black/5 shrink-0"
                      >
                        Редактировать
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {sorted.length === 0 && (
                <div className="text-white/70 text-sm">Университетов пока нет</div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && selectedUni && createPortal(
          <Motion.div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setModalOpen(false)} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="admin-card rounded-2xl w-full max-w-3xl p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-white font-semibold text-lg">Университет</div>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl !bg-red-600 !border-red-500/20 text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <div className="text-[#266479] text-xs">Владелец</div>
                  <div className="text-white">{modalForm._owner_display_name || '—'}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <div className="text-[#266479] text-xs">Статус</div>
                  <div className="text-white">{modalForm._is_active ? 'Активен' : 'Деактивирован'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs text-[#266479] mb-1">Название</label>
                  <input value={modalForm.name} onChange={e => setModalForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-[#266479] mb-1">Описание</label>
                  <textarea value={modalForm.description} onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-[#266479] mb-1">Логотип</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 cursor-pointer flex items-center gap-2">
                      <ImageIcon size={16} />
                      <span>Заменить файл</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setModalLogoFile(e.target.files?.[0] || null)} />
                    </label>
                    {(modalLogoFile || modalForm._logo) && (
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                        <img
                          src={modalLogoFile ? URL.createObjectURL(modalLogoFile) : logoUrl(modalForm._logo)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-[#266479] mb-1">Slug (URL-путь)</label>
                  <input value={modalForm.slug} onChange={e => setModalForm(f => ({ ...f, slug: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1">Действует до</label>
                  <input type="datetime-local" value={modalForm.expires_at} onChange={e => setModalForm(f => ({ ...f, expires_at: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
              </div>

              {modalError && (
                <div className="mt-4 text-sm text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mt-6">
                <button onClick={deleteModal} disabled={modalSubmitting} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0 disabled:opacity-60">
                  <Trash2 size={16} />
                  <span className="hidden sm:inline whitespace-nowrap btn-label">Деактивировать</span>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setModalOpen(false)} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                    <X size={16} />
                    <span className="hidden sm:inline whitespace-nowrap btn-label">Отмена</span>
                  </button>
                  <button onClick={saveModal} disabled={modalSubmitting} className="px-3 lg:px-4 h-11 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2 shrink-0 disabled:opacity-60">
                    {modalSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span className="hidden sm:inline whitespace-nowrap btn-label">Сохранить</span>
                  </button>
                </div>
              </div>
            </Motion.div>
          </Motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  )
}
