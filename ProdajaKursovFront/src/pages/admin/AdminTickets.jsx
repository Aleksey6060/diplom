import React, { useEffect, useMemo, useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { Inbox, Clock, UserRound, CheckCircle2, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useParams } from 'react-router-dom'
import CustomSelect from '../../components/CustomSelect'
import { api } from '../../lib/api'

function normalizeStatus(status) {
  if (status === 'open') return 'submitted'
  if (status === 'closed') return 'done'
  if (status === 'submitted') return 'submitted'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'done') return 'done'
  return 'submitted'
}

function statusMeta(status) {
  const s = normalizeStatus(status)
  if (s === 'submitted') return { label: 'Принята', className: 'bg-amber-100 border-amber-300 text-[#0f2e3a]' }
  if (s === 'in_progress') return { label: 'В обработке', className: 'bg-sky-100 border-sky-300 text-[#0f2e3a]' }
  return { label: 'Выполнена', className: 'bg-emerald-100 border-emerald-300 text-[#0f2e3a]' }
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

const FIELD_KIND_OPTIONS = [
  { value: 'text', label: 'Текст' },
  { value: 'file', label: 'Файл' }
]

const TEXT_FORMAT_OPTIONS = [
  { value: 'text', label: 'Строка' },
  { value: 'textarea', label: 'Текст' }
]

const TEXT_ALLOWED_OPTIONS = [
  { value: 'any', label: 'Буквы/цифры' },
  { value: 'letters', label: 'Только буквы' },
  { value: 'digits', label: 'Только цифры' },
  { value: 'alnum', label: 'Буквы + цифры' }
]

export default function AdminTickets() {
  const { user, hasPermission, accessModules } = useAuth()
  const { universitySlug } = useParams()
  const canViewTickets = hasPermission('applications.all.view')
  const canTakeInWork = hasPermission('applications.take_in_work')
  const canViewTemplates = hasPermission(['applications.templates.view', 'applications.templates.manage'])
  const canManageTemplates = hasPermission('applications.templates.manage')
  const [items, setItems] = useState([])
  const [templates, setTemplates] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState({ id: null, title: '', description: '', fields: [] })
  const [templateError, setTemplateError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (accessModules === null) return
    let cancelled = false
    ;(async () => {
      try {
        const [tpls, openTickets, mineTickets, doneTickets] = await Promise.all([
          (canViewTemplates || canManageTemplates)
            ? api.tickets.templates.list({ universitySlug })
            : Promise.resolve([]),
          canViewTickets ? api.tickets.requests.open({ universitySlug }) : Promise.resolve([]),
          canViewTickets ? api.tickets.requests.mine({ universitySlug }) : Promise.resolve([]),
          canViewTickets ? api.tickets.requests.done({ universitySlug }) : Promise.resolve([]),
        ])
        if (cancelled) return
        const tplsList = Array.isArray(tpls) ? tpls : (Array.isArray(tpls?.results) ? tpls.results : [])
        const openList = Array.isArray(openTickets) ? openTickets : (Array.isArray(openTickets?.results) ? openTickets.results : [])
        const mineList = Array.isArray(mineTickets) ? mineTickets : (Array.isArray(mineTickets?.results) ? mineTickets.results : [])
        const doneList = Array.isArray(doneTickets) ? doneTickets : (Array.isArray(doneTickets?.results) ? doneTickets.results : [])
        setTemplates(tplsList)
        setItems([...(openList || []), ...(mineList || []), ...(doneList || [])])
      } catch { void 0 }
    })()
    return () => { cancelled = true }
  }, [universitySlug, accessModules, canViewTickets, canViewTemplates, canManageTemplates])

  const all = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    return list.slice().sort((a, b) => (new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
  }, [items])
  const mine = useMemo(() => {
    const email = (user?.email || '').toLowerCase()
    return all.filter(t => normalizeStatus(t.status) === 'in_progress' && (t.assignedTo || '').toLowerCase() === email)
  }, [all, user])
  const openList = useMemo(() => {
    return all.filter(t => normalizeStatus(t.status) === 'submitted')
  }, [all])
  const doneAll = useMemo(() => {
    return all.filter(t => normalizeStatus(t.status) === 'done')
  }, [all])
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  const doneList = useMemo(() => {
    if (doneAll.length === 0) return []
    if (isOwner) return doneAll
    const email = (user?.email || '').toLowerCase()
    return doneAll.filter(t => String(t.assignedTo || '').toLowerCase() === email)
  }, [doneAll, isOwner, user?.email])

  const displayAdminName = (email) => {
    return String(email || '').trim()
  }

  const activeTitle = useMemo(() => {
    if (activeTab === 'all') return 'Все заявки'
    if (activeTab === 'mine') return 'Принятые заявки'
    if (activeTab === 'done') return 'Выполненные заявки'
    if (activeTab === 'templates') return 'Шаблоны'
    return 'Принятие заявок'
  }, [activeTab])

  const reload = async () => {
    const [tpls, openTickets, mineTickets, doneTickets] = await Promise.all([
      (canViewTemplates || canManageTemplates)
        ? api.tickets.templates.list({ universitySlug })
        : Promise.resolve([]),
      canViewTickets ? api.tickets.requests.open({ universitySlug }) : Promise.resolve([]),
      canViewTickets ? api.tickets.requests.mine({ universitySlug }) : Promise.resolve([]),
      canViewTickets ? api.tickets.requests.done({ universitySlug }) : Promise.resolve([]),
    ])
    const tplsList = Array.isArray(tpls) ? tpls : (Array.isArray(tpls?.results) ? tpls.results : [])
    const openList = Array.isArray(openTickets) ? openTickets : (Array.isArray(openTickets?.results) ? openTickets.results : [])
    const mineList = Array.isArray(mineTickets) ? mineTickets : (Array.isArray(mineTickets?.results) ? mineTickets.results : [])
    const doneList = Array.isArray(doneTickets) ? doneTickets : (Array.isArray(doneTickets?.results) ? doneTickets.results : [])
    setTemplates(tplsList)
    setItems([...(openList || []), ...(mineList || []), ...(doneList || [])])
  }

  const assign = async (id) => {
    if (!canTakeInWork) return
    setNotice('')
    try {
      await api.tickets.requests.assign(id, { universitySlug })
      await reload()
      setOpenId(null)
    } catch (e) {
      if (e?.status === 409) {
        setNotice('заявка уже в обработке')
        setItems(prev => (Array.isArray(prev) ? prev : []).filter(t => String(t?.id) !== String(id)))
        setOpenId(null)
        return
      }
      setNotice('Не удалось принять заявку')
    }
  }

  const complete = async (id) => {
    if (!canTakeInWork) return
    setNotice('')
    try {
      await api.tickets.requests.complete(id, { universitySlug })
      await reload()
      setOpenId(null)
    } catch {
      setNotice('Не удалось завершить заявку')
    }
  }

  const list =
    activeTab === 'mine'
      ? mine
      : activeTab === 'all'
        ? openList
        : activeTab === 'done'
          ? doneList
          : openList
  const opened = ((activeTab === 'mine' || activeTab === 'all' || activeTab === 'done') ? list : all).find(t => t.id === openId)
  useEffect(() => {
    const tid = setTimeout(() => setOpenId(null), 0)
    return () => clearTimeout(tid)
  }, [activeTab])

  useEffect(() => {
    setNotice('')
  }, [activeTab])

  const templateList = useMemo(() => {
    const list = Array.isArray(templates) ? templates : []
    return list
      .map(t => ({
        id: t?.id,
        title: String(t?.title || t?.name || '').trim(),
        description: String(t?.description || '').trim(),
        fields: Array.isArray(t?.fields) ? t.fields : []
      }))
      .filter(t => t.id && t.title)
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [templates])

  const openCreateTemplate = () => {
    if (!canManageTemplates) return
    setTemplateError('')
    setTemplateForm({
      id: null,
      title: '',
      description: '',
      fields: [{ id: makeId('f'), key: 'field_1', label: 'Поле', kind: 'text', type: 'text', required: true, allowed: 'any', maxLength: '' }]
    })
    setTemplateEditorOpen(true)
  }

  const openEditTemplate = (t) => {
    if (!canManageTemplates) return
    setTemplateError('')
    setTemplateForm({
      id: t.id,
      title: t.title,
      description: t.description,
      fields: (Array.isArray(t.fields) ? t.fields : []).map(f => ({
        id: f?.id || makeId('f'),
        key: String(f?.key || ''),
        label: String(f?.label || ''),
        kind: String(f?.kind || (String(f?.type || 'text') === 'file' ? 'file' : 'text')),
        type: String(f?.type || 'text'),
        required: true,
        allowed: String(f?.allowed || 'any'),
        maxLength: typeof f?.maxLength === 'number' ? f.maxLength : (f?.maxLength || '')
      }))
    })
    setTemplateEditorOpen(true)
  }

  const deleteTemplate = async (id) => {
    if (!canManageTemplates) return
    setTemplateError('')
    try {
      await api.tickets.templates.remove(id, { universitySlug })
      await reload()
    } catch {
      setTemplateError('Не удалось удалить шаблон')
    }
  }

  const saveTemplate = async () => {
    if (!canManageTemplates) return
    setTemplateError('')
    const title = String(templateForm.title || '').trim()
    if (title.length < 3) {
      setTemplateError('Укажите название (минимум 3 символа)')
      return
    }
    const fields = (Array.isArray(templateForm.fields) ? templateForm.fields : [])
      .map(f => {
        const kind = String(f?.kind || 'text') === 'file' ? 'file' : 'text'
        const type = kind === 'file' ? 'file' : (String(f?.type || 'text') === 'textarea' ? 'textarea' : 'text')
        const maxLength = (() => {
          if (kind === 'file') return null
          if (f?.maxLength === '' || f?.maxLength === null || typeof f?.maxLength === 'undefined') return null
          const n = Number(f.maxLength)
          if (!Number.isFinite(n) || n <= 0) return null
          return Math.floor(n)
        })()
        return {
          id: f?.id || makeId('f'),
          key: String(f?.key || '').trim(),
          label: String(f?.label || '').trim(),
          kind,
          type,
          required: true,
          allowed: String(f?.allowed || 'any'),
          maxLength,
        }
      })
      .filter(f => f.key && f.label)
      .map(f => {
        if (f.kind === 'file') {
          return { ...f, type: 'file', allowed: 'any', maxLength: null }
        }
        const allowed = (f.allowed === 'letters' || f.allowed === 'digits' || f.allowed === 'alnum') ? f.allowed : 'any'
        return { ...f, allowed }
      })
    const keys = fields.map(f => f.key)
    if (keys.length !== new Set(keys).size) {
      setTemplateError('Поля должны быть уникальными')
      return
    }
    if (fields.length === 0) {
      setTemplateError('Добавьте хотя бы одно поле')
      return
    }
    const payload = {
      title,
      description: String(templateForm.description || '').trim(),
      fields,
      published: true,
    }
    try {
      if (templateForm.id) {
        await api.tickets.templates.update(templateForm.id, payload, { universitySlug })
      } else {
        await api.tickets.templates.create(payload, { universitySlug })
      }
      await reload()
      setTemplateEditorOpen(false)
    } catch {
      setTemplateError('Не удалось сохранить шаблон')
    }
  }

  return (
    <Motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="w-full max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-[var(--btn-primary-bg)]">{activeTitle}</h2>
          <div className="w-full lg:w-auto grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-2">
            {[
              ...(canViewTickets ? [
                { id: 'all', label: 'Все заявки' },
                { id: 'mine', label: 'Принятые заявки' },
                { id: 'done', label: 'Выполненные заявки' },
              ] : []),
              ...((canViewTemplates || canManageTemplates) ? [{ id: 'templates', label: 'Шаблоны' }] : [])
            ].map(tab => {
              const isActive = activeTab === tab.id
              return (
                <div
                  key={tab.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveTab(tab.id)
                    }
                  }}
                  style={{
                    background: isActive ? 'var(--btn-primary-bg)' : 'var(--surface-bg-strong)',
                    color: isActive ? 'var(--btn-primary-text)' : 'var(--content-text)',
                    borderColor: isActive ? 'var(--btn-primary-border)' : 'rgba(38, 100, 121, 0.18)'
                  }}
                  className="w-full px-3 lg:px-4 min-h-11 py-2 lg:py-0 lg:h-11 rounded-xl border flex items-center justify-center gap-2 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                >
                  <span className="text-xs sm:text-sm leading-tight text-center">{tab.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        {!!notice && (
          <div className="mb-4 rounded-xl p-3 bg-amber-100 border border-amber-300 text-[#0f2e3a] text-sm">
            {notice}
          </div>
        )}

        {activeTab === 'templates' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button
                onClick={openCreateTemplate}
                disabled={!canManageTemplates}
                className={`px-3 lg:px-4 h-11 rounded-xl text-white flex items-center gap-2 shrink-0 ${
                  canManageTemplates ? '!bg-emerald-600 !border-emerald-600/40' : 'bg-black/10 border border-black/10 cursor-not-allowed opacity-40'
                }`}
              >
                <Plus size={16} />
                <span className="btn-label-force">Создать шаблон</span>
              </button>
            </div>
            {templateList.length === 0 ? (
              <div className="rounded-xl p-4 bg-white border border-[#266479]/20 text-[#5a7280]">Пока нет шаблонов</div>
            ) : (
              <div className="space-y-3">
                {templateList.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl bg-white border border-[#266479]/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[#0f2e3a] font-semibold truncate">{t.title}</div>
                        <div className="text-xs text-[#5a7280] mt-1">{t.fields.length} пол{t.fields.length === 1 ? 'е' : t.fields.length < 5 ? 'я' : 'ей'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditTemplate(t)}
                          className="icon-btn p-2 rounded-lg bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105"
                          title="Редактировать"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="icon-btn p-2 rounded-lg !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {!!t.description && <div className="text-sm text-[#5a7280] mt-3 whitespace-pre-wrap">{t.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <div className="space-y-2 max-h-[60vh] md:max-h-[56vh] overflow-auto pr-1">
              {list.length === 0 && (
                <div className="rounded-xl p-4 bg-white border border-[#266479]/20 text-[#5a7280]">Нет заявок</div>
              )}
              {list.map(t => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className={`w-full text-left p-4 rounded-xl transition !text-[#0f2e3a] ${openId === t.id ? '!bg-white border border-[#266479]/40 shadow-md' : '!bg-white/90 border border-[#266479]/20 hover:!bg-white hover:shadow-sm'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{String(t.templateTitle || t.subject || 'Заявка')}</div>
                    {activeTab === 'mine' ? (
                      <span className={`px-2 py-1 rounded-lg border text-[11px] shrink-0 ${statusMeta(t.status).className}`}>{statusMeta(t.status).label}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[#5a7280] mt-1 flex items-center gap-1">
                    <Clock size={14} />
                    <span>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <div className="text-xs text-[#5a7280] mt-1 truncate">{t.student?.name} · {t.student?.email}</div>
                  {activeTab === 'done' && (
                    <div className="text-xs text-[#5a7280] mt-2">
                      Выполнил: {displayAdminName(t.assignedTo) || '—'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence>
          {!!opened && (
            <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
              <Motion.div
                className="absolute inset-0 modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpenId(null)}
              />
              <Motion.div
                initial={{ opacity: 0, scale: 0.98, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="relative w-[95vw] sm:w-[70vw] lg:w-[60vw] modal-panel rounded-3xl p-6 h-[70vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/80 border border-[#266479]/20 flex items-center justify-center shrink-0">
                      <Inbox size={18} className="text-[#0f2e3a]/80" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[#0f2e3a] font-semibold text-lg truncate">{String(opened.templateTitle || opened.subject || 'Заявка')}</div>
                      <div className="text-xs text-[#5a7280] flex items-center gap-2 mt-1">
                        <Clock size={14} /> <span className="truncate">{new Date(opened.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg border text-[11px] ${statusMeta(opened.status).className}`}>
                      {statusMeta(opened.status).label}
                    </span>
                    <button onClick={() => setOpenId(null)} className="p-2 rounded-lg bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-[#5a7280] text-xs">Обращающийся</div>
                    <div className="flex items-center gap-2 text-[#0f2e3a]">
                      <UserRound size={16} className="text-[#5a7280]" />
                      <span>{opened.student?.name || '—'}</span>
                    </div>
                    <div className="text-[#5a7280] text-sm">{opened.student?.email || '—'}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[#5a7280] text-xs mb-1">Данные</div>
                  <div className="p-4 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a]">
                    {(() => {
                      const tpl = opened.templateId ? templateList.find(t => String(t.id) === String(opened.templateId)) : null
                      const defs = Array.isArray(tpl?.fields) ? tpl.fields : []
                      const data = opened.data && typeof opened.data === 'object' ? opened.data : {}
                      if (defs.length > 0) {
                        return (
                          <div className="space-y-2">
                            {defs.map(f => {
                              const key = String(f?.key || '').trim()
                              if (!key) return null
                              const label = String(f?.label || key)
                              const v = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : ''
                              return (
                                <div key={key} className="flex items-start justify-between gap-4">
                                  <div className="text-xs text-[#5a7280]">{label}</div>
                                  <div className="text-sm text-[#0f2e3a] text-right whitespace-pre-wrap">
                                    {v && typeof v === 'object' && String(v.url || '') ? (
                                      <a
                                        href={String(v.url)}
                                        download={String(v.name || 'file')}
                                        className="text-[#0f2e3a] underline underline-offset-2"
                                      >
                                        {String(v.name || 'Файл')}
                                      </a>
                                    ) : (
                                      String(v || '—')
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      if (opened.message) return <div className="whitespace-pre-wrap">{opened.message}</div>
                      if (data && Object.keys(data).length > 0) {
                        return (
                          <div className="space-y-2">
                            {Object.entries(data).map(([k, v]) => (
                              <div key={k} className="flex items-start justify-between gap-4">
                                <div className="text-xs text-[#5a7280]">{k}</div>
                                <div className="text-sm text-[#0f2e3a] text-right whitespace-pre-wrap">
                                  {v && typeof v === 'object' && String(v.url || '') ? (
                                    <a
                                      href={String(v.url)}
                                      download={String(v.name || 'file')}
                                      className="text-[#0f2e3a] underline underline-offset-2"
                                    >
                                      {String(v.name || 'Файл')}
                                    </a>
                                  ) : (
                                    String(v || '—')
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return <div className="text-[#5a7280] text-sm">—</div>
                    })()}
                  </div>
                </div>
                {Array.isArray(opened.images) && opened.images.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[#5a7280] text-xs mb-2">Вложения</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {opened.images.map((src, i) => (
                        <img key={i} src={src} alt={`img_${i}`} className="w-full h-36 object-cover rounded-xl border border-[#266479]/20" />
                      ))}
                    </div>
                  </div>
                )}
                {normalizeStatus(opened.status) === 'submitted' && activeTab === 'all' && !opened.__demo && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
                    <button
                      onClick={() => assign(opened.id)}
                      disabled={!canTakeInWork}
                      className={`w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl text-white flex items-center gap-2 shrink-0 ${
                        canTakeInWork ? '!bg-emerald-600 !border-emerald-600/40' : 'bg-black/10 border border-black/10 cursor-not-allowed opacity-40'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                      <span className="btn-label-force">Принять в обработку</span>
                    </button>
                    <button onClick={() => setOpenId(null)} className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                      <X size={16} />
                      <span className="btn-label-force">Закрыть</span>
                    </button>
                  </div>
                )}
                {normalizeStatus(opened.status) === 'in_progress' && activeTab === 'mine' && !opened.__demo && (opened.assignedTo || '').toLowerCase() === (user?.email || '').toLowerCase() && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
                    <button
                      onClick={() => complete(opened.id)}
                      disabled={!canTakeInWork}
                      className={`w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl text-white flex items-center gap-2 shrink-0 ${
                        canTakeInWork ? '!bg-emerald-600 !border-emerald-600/40' : 'bg-black/10 border border-black/10 cursor-not-allowed opacity-40'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                      <span className="btn-label-force">Выполнено</span>
                    </button>
                    <button onClick={() => setOpenId(null)} className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                      <X size={16} />
                      <span className="btn-label-force">Закрыть</span>
                    </button>
                  </div>
                )}
                {normalizeStatus(opened.status) === 'in_progress' && opened.assignedTo && (
                  <div className="mt-6 text-sm text-[#5a7280]">Назначено: {displayAdminName(opened.assignedTo)}</div>
                )}
                {normalizeStatus(opened.status) === 'done' && (
                  <div className="mt-6 text-sm text-[#5a7280]">Выполнил: {displayAdminName(opened.assignedTo) || '—'}</div>
                )}
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {templateEditorOpen && (
            <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
              <Motion.div
                className="absolute inset-0 modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTemplateEditorOpen(false)}
              />
              <Motion.div
                initial={{ opacity: 0, scale: 0.98, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="relative w-[95vw] sm:w-[70vw] lg:w-[60vw] modal-panel rounded-3xl p-6 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[#0f2e3a] font-semibold text-lg">{templateForm.id ? 'Редактирование шаблона' : 'Создание шаблона'}</div>
                  <button onClick={() => setTemplateEditorOpen(false)} className="icon-btn p-2 rounded-lg bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5a7280] mb-1">Название</label>
                    <input
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-4 py-2.5 text-[#0f2e3a] focus:border-[#266479] focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5a7280] mb-1">Описание (необязательно)</label>
                    <textarea
                      rows={3}
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-4 py-2.5 text-[#0f2e3a] focus:border-[#266479] focus:outline-none transition-all custom-scrollbar resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-[#5a7280]">Поля</div>
                      <button
                        onClick={() => setTemplateForm(prev => ({
                          ...prev,
                          fields: [...(Array.isArray(prev.fields) ? prev.fields : []), { id: makeId('f'), key: `field_${(prev.fields?.length || 0) + 1}`, label: 'Поле', kind: 'text', type: 'text', required: true, allowed: 'any', maxLength: '' }]
                        }))}
                        className="px-3 h-9 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 flex items-center gap-2"
                      >
                        <Plus size={14} />
                        <span>Добавить</span>
                      </button>
                    </div>
                    {(Array.isArray(templateForm.fields) ? templateForm.fields : []).map((f, idx) => (
                      <div key={f.id || idx} className="p-3 rounded-2xl bg-white border border-[#266479]/20 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-6">
                          <label className="block text-[10px] text-[#5a7280] uppercase tracking-wide font-bold mb-1">Название</label>
                          <input
                            value={f.label}
                            onChange={(e) => setTemplateForm(prev => ({
                              ...prev,
                              fields: prev.fields.map(x => x.id === f.id ? { ...x, label: e.target.value } : x)
                            }))}
                            className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] focus:outline-none focus:border-[#266479]"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[10px] text-[#5a7280] uppercase tracking-wide font-bold mb-1">Тип</label>
                          <CustomSelect
                            value={String(f.kind) === 'file' ? 'file' : 'text'}
                            onChange={(v) => setTemplateForm(prev => ({
                              ...prev,
                              fields: prev.fields.map(x => {
                                if (x.id !== f.id) return x
                                if (v === 'file') return { ...x, kind: 'file', type: 'file', allowed: 'any', maxLength: '' }
                                return { ...x, kind: 'text', type: x.type === 'file' ? 'text' : x.type }
                              })
                            }))}
                            options={FIELD_KIND_OPTIONS}
                            variant="light"
                            noGlobalButtonStyles
                            className="w-full"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center justify-end">
                          <button
                            onClick={() => setTemplateForm(prev => ({ ...prev, fields: prev.fields.filter(x => x.id !== f.id) }))}
                            className="icon-btn p-2 rounded-lg !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700"
                            title="Удалить поле"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        </div>

                        {String(f.kind || (String(f.type) === 'file' ? 'file' : 'text')) === 'file' ? (
                          <div className="text-xs text-[#5a7280]">
                            Студент прикрепит один файл. Большие файлы не рекомендуются (хранятся в браузере).
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                            <div className="md:col-span-4">
                              <label className="block text-[10px] text-[#5a7280] uppercase tracking-wide font-bold mb-1">Формат</label>
                              <CustomSelect
                                value={String(f.type) === 'textarea' ? 'textarea' : 'text'}
                                onChange={(v) => setTemplateForm(prev => ({
                                  ...prev,
                                  fields: prev.fields.map(x => x.id === f.id ? { ...x, type: v } : x)
                                }))}
                                options={TEXT_FORMAT_OPTIONS}
                                variant="light"
                                noGlobalButtonStyles
                                className="w-full"
                              />
                            </div>
                            <div className="md:col-span-4">
                              <label className="block text-[10px] text-[#5a7280] uppercase tracking-wide font-bold mb-1">Разрешено</label>
                              <CustomSelect
                                value={String(f.allowed || 'any')}
                                onChange={(v) => setTemplateForm(prev => ({
                                  ...prev,
                                  fields: prev.fields.map(x => x.id === f.id ? { ...x, allowed: v } : x)
                                }))}
                                options={TEXT_ALLOWED_OPTIONS}
                                variant="light"
                                noGlobalButtonStyles
                                className="w-full"
                              />
                            </div>
                            <div className="md:col-span-4">
                              <label className="block text-[10px] text-[#5a7280] uppercase tracking-wide font-bold mb-1">Макс. символов</label>
                              <input
                                type="number"
                                min={1}
                                value={typeof f.maxLength === 'number' ? f.maxLength : (f.maxLength || '')}
                                onChange={(e) => setTemplateForm(prev => ({
                                  ...prev,
                                  fields: prev.fields.map(x => x.id === f.id ? { ...x, maxLength: e.target.value } : x)
                                }))}
                                className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a] focus:outline-none focus:border-[#266479]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {templateError && <div className="text-red-600 text-sm font-medium">{templateError}</div>}
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setTemplateEditorOpen(false)} className="px-4 py-2 rounded-xl !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700 transition-all font-medium shadow-md">
                      Отмена
                    </button>
                    <button onClick={saveTemplate} className="px-4 py-2 rounded-xl !bg-emerald-600 hover:!bg-emerald-700 text-white border border-emerald-600/40 flex items-center gap-2 transition-all font-medium shadow-md shadow-emerald-900/20">
                      <CheckCircle2 size={18} />
                      <span>Сохранить</span>
                    </button>
                  </div>
                </div>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </Motion.div>
  )
}
