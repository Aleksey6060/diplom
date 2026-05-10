import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Upload, Trash2, SendHorizonal, Inbox, Clock, CheckCircle2, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'

function normalizeStatus(status) {
  if (status === 'open') return 'submitted'
  if (status === 'closed') return 'done'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'submitted') return 'submitted'
  if (status === 'done') return 'done'
  return 'submitted'
}

function statusMeta(status) {
  const s = normalizeStatus(status)
  if (s === 'submitted') return { label: 'Принята', className: 'bg-amber-100 border-amber-300 text-[#0f2e3a]' }
  if (s === 'in_progress') return { label: 'В обработке', className: 'bg-sky-100 border-sky-300 text-[#0f2e3a]' }
  return { label: 'Выполнена', className: 'bg-emerald-100 border-emerald-300 text-[#0f2e3a]' }
}

function clampText(value, maxLength) {
  if (!Number.isFinite(maxLength) || maxLength <= 0) return value
  return String(value || '').slice(0, maxLength)
}

function sanitizeByAllowed(value, allowed) {
  const v = String(value || '')
  if (allowed === 'digits') return v.replace(/[^\d]/g, '')
  if (allowed === 'letters') return v.replace(/[^A-Za-zА-Яа-яЁё\s-]/g, '')
  if (allowed === 'alnum') return v.replace(/[^0-9A-Za-zА-Яа-яЁё\s-]/g, '')
  return v
}

function normalizeFieldKind(field) {
  const kind = String(field?.kind || '').trim()
  if (kind === 'file') return 'file'
  if (String(field?.type || '').trim() === 'file') return 'file'
  return 'text'
}

function normalizeAllowed(field) {
  const a = String(field?.allowed || '').trim()
  if (a === 'letters' || a === 'digits' || a === 'alnum' || a === 'any') return a
  return 'any'
}

function normalizeMaxLength(field) {
  const raw = field?.maxLength
  if (raw === null || typeof raw === 'undefined' || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export default function ContactModal({ open, onClose }) {
  const { user } = useAuth()
  const { universitySlug } = useParams()

  const [activeTab, setActiveTab] = useState('requests')
  const [templates, setTemplates] = useState([])
  const [tickets, setTickets] = useState([])
  const [templateQuery, setTemplateQuery] = useState('')
  const [demoMyTickets, setDemoMyTickets] = useState([])

  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [values, setValues] = useState({})
  const [images, setImages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [openedTicketId, setOpenedTicketId] = useState(null)

  useEffect(() => {
    if (!open) {
      setActiveTab('requests')
      setTemplateQuery('')
      setSelectedTemplateId(null)
      setValues({})
      setImages([])
      setIsSending(false)
      setError('')
      setSuccess(false)
      setOpenedTicketId(null)
      setDemoMyTickets([])
    }
  }, [open])

  const studentInfo = useMemo(() => {
    const fullName = [user?.last_name, user?.first_name, user?.patronymic].filter(Boolean).join(' ').trim()
    return {
      fullName: fullName || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      email: user?.email || ''
    }
  }, [user])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const [tpls, my] = await Promise.all([
          api.tickets.templates.list({ universitySlug }),
          api.tickets.requests.my({ universitySlug }),
        ])
        if (cancelled) return
        const tplsList = Array.isArray(tpls) ? tpls : (Array.isArray(tpls?.results) ? tpls.results : [])
        const myList = Array.isArray(my) ? my : (Array.isArray(my?.results) ? my.results : [])
        setTemplates(tplsList)
        setTickets(myList)
      } catch { void 0 }
    })()
    return () => { cancelled = true }
  }, [open, universitySlug])

  const normalizedTemplates = useMemo(() => {
    const list = Array.isArray(templates) ? templates : []
    return list
      .filter(t => t && (t.title || t.name))
      .map(t => ({
        id: t.id,
        title: String(t.title || t.name || '').trim(),
        description: String(t.description || '').trim(),
        fields: Array.isArray(t.fields) ? t.fields : []
      }))
      .filter(t => t.title.length > 0)
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const q = String(templateQuery || '').trim().toLowerCase()
    if (!q) return normalizedTemplates
    return normalizedTemplates.filter(t => String(t.title || '').toLowerCase().includes(q))
  }, [normalizedTemplates, templateQuery])

  const selectedTemplate = useMemo(() => {
    return normalizedTemplates.find(t => String(t.id) === String(selectedTemplateId)) || null
  }, [normalizedTemplates, selectedTemplateId])

  const myTickets = useMemo(() => {
    const email = String(user?.email || '').toLowerCase()
    const list = Array.isArray(tickets) ? tickets : []
    return list
      .filter(t => String(t?.student?.email || '').toLowerCase() === email)
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [tickets, user?.email])

  useEffect(() => {
    if (!open) return
    if (myTickets.length > 0) {
      setDemoMyTickets([])
      return
    }
    if (demoMyTickets.length > 0) return
    const templatesForDemo = Array.isArray(normalizedTemplates) ? normalizedTemplates : []
    const pickTemplate = (index) => templatesForDemo[index % (templatesForDemo.length || 1)] || null
    const demoDataFromTemplate = (tpl) => {
      if (!tpl) return { 'Комментарий': 'Нужна помощь по услуге' }
      const fields = Array.isArray(tpl.fields) ? tpl.fields : []
      const data = {}
      fields.forEach((f, i) => {
        const key = String(f?.key || '').trim()
        const label = String(f?.label || key || `Поле ${i + 1}`)
        if (!key) return
        if (normalizeFieldKind(f) === 'file') {
          data[label] = { name: 'document.pdf', url: 'data:application/pdf;base64,' }
          return
        }
        const allowed = normalizeAllowed(f)
        if (allowed === 'digits') data[label] = '123456'
        else if (allowed === 'letters') data[label] = 'Иван Иванов'
        else data[label] = 'Пример заполнения'
      })
      return Object.keys(data).length > 0 ? data : { 'Комментарий': 'Нужна помощь по услуге' }
    }
    const now = Date.now()
    const makeDemo = (i, status) => {
      const tpl = templatesForDemo.length ? pickTemplate(i) : null
      const title = String(tpl?.title || ['Справка', 'Консультация', 'Запрос'][i % 3])
      const description = String(tpl?.description || '')
      return {
        id: `demo_my_${now}_${i}`,
        templateId: tpl?.id || null,
        templateTitle: title,
        subject: title,
        message: '',
        data: demoDataFromTemplate(tpl),
        images: [],
        createdAt: new Date(now - (i + 1) * 36 * 60 * 1000).toISOString(),
        updatedAt: new Date(now - (i + 1) * 36 * 60 * 1000).toISOString(),
        student: { name: studentInfo.fullName, email: studentInfo.email },
        status,
        assignedTo: status === 'in_progress' ? 'moderator@example.com' : null,
        __demoDescription: description
      }
    }
    setDemoMyTickets([makeDemo(0, 'submitted'), makeDemo(1, 'in_progress'), makeDemo(2, 'done')])
  }, [open, myTickets.length, demoMyTickets.length, normalizedTemplates, studentInfo.fullName, studentInfo.email])

  const myTicketsEffective = useMemo(() => {
    return myTickets.length > 0 ? myTickets : demoMyTickets
  }, [myTickets, demoMyTickets])

  const openedTicket = useMemo(() => {
    return myTicketsEffective.find(t => String(t.id) === String(openedTicketId)) || null
  }, [myTicketsEffective, openedTicketId])

  const onFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const maxCount = 6
    const maxSize = 1024 * 1024 * 1.2 // ~1.2MB
    const next = [...images]
    for (let i = 0; i < fileList.length && next.length < maxCount; i++) {
      const f = fileList[i]
      if (!f.type.startsWith('image/')) continue
      if (f.size > maxSize) continue
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(f)
      })
      next.push({ name: f.name, url: dataUrl })
    }
    setImages(next)
  }

  const submit = async () => {
    setError('')
    setSuccess(false)
    if (!selectedTemplate) {
      setError('Выберите заявку')
      return
    }
    const fields = Array.isArray(selectedTemplate.fields) ? selectedTemplate.fields : []
    for (const f of fields) {
      const key = String(f?.key || '').trim()
      const label = String(f?.label || '').trim()
      const required = !!f?.required
      if (!key) continue
      const kind = normalizeFieldKind(f)
      const allowed = normalizeAllowed(f)
      const maxLength = normalizeMaxLength(f)
      const v = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''
      if (kind === 'file') {
        const ok = v && typeof v === 'object' && String(v.url || '').trim()
        if (required && !ok) {
          setError(`Прикрепите файл: ${label || key}`)
          return
        }
        continue
      }
      const text = clampText(sanitizeByAllowed(v, allowed), maxLength)
      if (required && !String(text || '').trim()) {
        setError(`Заполните поле: ${label || key}`)
        return
      }
    }
    setIsSending(true)
    try {
      const payload = {}
      fields.forEach(f => {
        const key = String(f?.key || '').trim()
        if (!key) return
        payload[key] = values?.[key] ?? ''
      })
      const created = await api.tickets.requests.create({
        templateId: selectedTemplate.id,
        data: payload,
        images: images.map(i => i.url),
      }, { universitySlug })
      setTickets(prev => [created, ...(Array.isArray(prev) ? prev : [])])
      setSuccess(true)
      setSelectedTemplateId(null)
      setValues({})
      setImages([])
      setTimeout(() => onClose && onClose(), 800)
    } catch {
      setError('Не удалось отправить заявку')
    } finally {
      setIsSending(false)
    }
  }

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-5 sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        <motion.div
          className="relative w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-5xl modal-panel rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[calc(100vh-3rem)] overflow-y-auto"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#0f2e3a]">Связь</h2>
              <p className="text-sm text-[#5a7280]">Выберите заявку и заполните поля</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700 transition-all shadow-md"
            >
              <X size={20} />
            </button>
          </div>

          {!selectedTemplate && (
            <div className="flex items-center gap-2 mb-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setActiveTab('requests'); setOpenedTicketId(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveTab('requests')
                    setOpenedTicketId(null)
                  }
                }}
                style={{
                  background: activeTab === 'requests' ? 'var(--btn-primary-bg)' : 'var(--surface-bg-strong)',
                  color: activeTab === 'requests' ? 'var(--btn-primary-text)' : 'var(--content-text)',
                  borderColor: activeTab === 'requests' ? 'var(--btn-primary-border)' : 'rgba(38, 100, 121, 0.18)'
                }}
                className="px-3 h-10 rounded-xl border font-medium transition cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 flex items-center justify-center leading-none"
              >
                Заявки
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setActiveTab('mine'); setSelectedTemplateId(null); setValues({}); setImages([]) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveTab('mine')
                    setSelectedTemplateId(null)
                    setValues({})
                    setImages([])
                  }
                }}
                style={{
                  background: activeTab === 'mine' ? 'var(--btn-primary-bg)' : 'var(--surface-bg-strong)',
                  color: activeTab === 'mine' ? 'var(--btn-primary-text)' : 'var(--content-text)',
                  borderColor: activeTab === 'mine' ? 'var(--btn-primary-border)' : 'rgba(38, 100, 121, 0.18)'
                }}
                className="px-3 h-10 rounded-xl border font-medium transition cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10 flex items-center justify-center leading-none"
              >
                Мои обращения
              </div>
            </div>
          )}

          {activeTab === 'mine' ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[340px]">
              <div className="lg:col-span-2 space-y-2 max-h-[52vh] overflow-auto pr-1">
                {myTicketsEffective.length === 0 && (
                  <div className="rounded-xl p-4 bg-white border border-[#266479]/20 text-[#5a7280]">Пока нет обращений</div>
                )}
                {myTicketsEffective.map(t => {
                  const meta = statusMeta(t.status)
                  const title = String(t.templateTitle || t.subject || 'Заявка')
                  const dt = t.createdAt ? new Date(t.createdAt).toLocaleString() : ''
                  return (
                    <button
                      key={t.id}
                      onClick={() => setOpenedTicketId(t.id)}
                      className={`w-full text-left p-4 rounded-xl transition !text-[#0f2e3a] ${openedTicketId === t.id ? '!bg-white border border-[#266479]/40 shadow-md' : '!bg-white/90 border border-[#266479]/20 hover:!bg-white hover:shadow-sm'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{title}</div>
                        <span className={`px-2 py-1 rounded-lg border text-[11px] shrink-0 ${meta.className}`}>{meta.label}</span>
                      </div>
                      <div className="text-xs text-[#5a7280] mt-1 flex items-center gap-1">
                        <Clock size={14} />
                        <span>{dt}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="lg:col-span-3">
                {!openedTicket ? (
                  <div className="rounded-xl p-4 bg-white/80 border border-[#266479]/20 text-[#5a7280]">Выберите обращение</div>
                ) : (
                  <div className="rounded-2xl p-5 bg-white border border-[#266479]/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[#0f2e3a] font-semibold text-lg truncate">{String(openedTicket.templateTitle || openedTicket.subject || 'Заявка')}</div>
                        <div className="text-xs text-[#5a7280] flex items-center gap-2 mt-1">
                          <Clock size={14} /> <span className="truncate">{openedTicket.createdAt ? new Date(openedTicket.createdAt).toLocaleString() : ''}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg border text-[11px] shrink-0 ${statusMeta(openedTicket.status).className}`}>{statusMeta(openedTicket.status).label}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {openedTicket.data && typeof openedTicket.data === 'object' && Object.keys(openedTicket.data).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(openedTicket.data).map(([k, v]) => (
                            <div key={k} className="flex items-start justify-between gap-3">
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
                      ) : (
                        <div className="text-sm text-[#0f2e3a] whitespace-pre-wrap">{String(openedTicket.message || '—')}</div>
                      )}
                      {Array.isArray(openedTicket.images) && openedTicket.images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {openedTicket.images.map((src, i) => (
                            <img key={i} src={src} alt={`img_${i}`} className="w-full h-24 sm:h-28 object-cover rounded-xl border border-[#266479]/10 shadow-sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : !selectedTemplate ? (
            <div className="space-y-3 min-h-[340px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a7280]" />
                <input
                  value={templateQuery}
                  onChange={(e) => setTemplateQuery(e.target.value)}
                  placeholder="Поиск заявки по названию..."
                  className="w-full bg-white/70 border border-[#266479]/20 rounded-xl pl-10 pr-4 py-2.5 text-[#0f2e3a] placeholder-[#5a7280]/70 focus:border-[#266479] focus:outline-none transition-all"
                />
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="rounded-xl p-4 bg-white border border-[#266479]/20 text-[#5a7280]">Пока нет доступных заявок</div>
              ) : (
                <div className="space-y-3">
                  {filteredTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setValues({}); setImages([]); setError(''); setSuccess(false) }}
                      className="w-full text-left p-4 rounded-2xl modal-panel border border-[#266479]/20 hover:border-[#266479]/40 hover:shadow-sm transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-white/80 border border-[#266479]/20 flex items-center justify-center shrink-0">
                          <Inbox size={18} className="text-[#0f2e3a]/80" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[#0f2e3a] font-semibold truncate">{t.title}</div>
                          <div className="text-xs text-[#5a7280] mt-0.5">{t.fields.length} пол{t.fields.length === 1 ? 'е' : t.fields.length < 5 ? 'я' : 'ей'}</div>
                        </div>
                      </div>
                      {!!t.description && <div className="text-sm text-[#5a7280] mt-3 line-clamp-2">{t.description}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 min-h-[340px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setSelectedTemplateId(null); setValues({}); setImages([]); setError(''); setSuccess(false) }}
                    className="px-3 h-10 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 transition flex items-center gap-2"
                  >
                    <span>←</span>
                    <span className="hidden sm:inline">Назад</span>
                  </button>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl text-[#0f2e3a] font-bold leading-tight">
                    {selectedTemplate.title}
                  </div>
                  {!!selectedTemplate.description && (
                    <div className="text-base text-[#5a7280] mt-1 line-clamp-3">
                      {selectedTemplate.description}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {(() => {
                  const fields = Array.isArray(selectedTemplate.fields) ? selectedTemplate.fields : []
                  const hasFileField = fields.some(f => normalizeFieldKind(f) === 'file')
                  return (
                    <>
                      {fields.map((f, idx) => {
                  const key = String(f?.key || '').trim() || `field_${idx + 1}`
                  const label = String(f?.label || '').trim() || key
                  const required = !!f?.required
                  const kind = normalizeFieldKind(f)
                  const type = String(f?.type || 'text')
                  const allowed = normalizeAllowed(f)
                  const maxLength = normalizeMaxLength(f)
                  const value = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''
                  return (
                    <div key={key}>
                      <label className="block text-xs font-medium text-[#5a7280] mb-1">
                        {label}
                      </label>
                      {kind === 'file' ? (
                        <div className="space-y-2">
                          <label className="px-4 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-[#266479]/5 flex items-center gap-2 cursor-pointer transition-all shadow-sm w-fit">
                            <Upload size={16} className="text-[#266479]" />
                            <span className="font-medium">Прикрепить файл</span>
                            <input
                              type="file"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const maxSize = 1024 * 1024 * 1.5
                                if (file.size > maxSize) {
                                  setError('Файл слишком большой (до ~1.5 МБ)')
                                  return
                                }
                                try {
                                  const url = await fileToDataUrl(file)
                                  setValues(prev => ({
                                    ...(prev || {}),
                                    [key]: { name: file.name, type: file.type, size: file.size, url }
                                  }))
                                  setError('')
                                } catch {
                                  setError('Не удалось прочитать файл')
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {value && typeof value === 'object' && String(value.url || '') && (
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/70 border border-[#266479]/20">
                              <div className="min-w-0">
                                <div className="text-sm text-[#0f2e3a] font-medium truncate">{String(value.name || 'Файл')}</div>
                                <div className="text-xs text-[#5a7280]">{value.size ? `${Math.round(value.size / 1024)} KB` : ''}</div>
                              </div>
                              <button
                                onClick={() => setValues(prev => {
                                  const next = { ...(prev || {}) }
                                  delete next[key]
                                  return next
                                })}
                                className="p-2 rounded-lg !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700 transition-colors"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : type === 'textarea' ? (
                        <textarea
                          rows={4}
                          value={String(value || '')}
                          maxLength={maxLength || undefined}
                          onChange={e => {
                            const next = clampText(sanitizeByAllowed(e.target.value, allowed), maxLength)
                            setValues(prev => ({ ...(prev || {}), [key]: next }))
                          }}
                          className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-4 py-2.5 text-[#0f2e3a] placeholder-[#5a7280]/70 focus:border-[#266479] focus:outline-none transition-all custom-scrollbar resize-none"
                        />
                      ) : (
                        <input
                          value={String(value || '')}
                          maxLength={maxLength || undefined}
                          onChange={e => {
                            const next = clampText(sanitizeByAllowed(e.target.value, allowed), maxLength)
                            setValues(prev => ({ ...(prev || {}), [key]: next }))
                          }}
                          className="w-full bg-white/50 border border-[#266479]/20 rounded-xl px-4 py-2.5 text-[#0f2e3a] placeholder-[#5a7280]/70 focus:border-[#266479] focus:outline-none transition-all"
                        />
                      )}
                    </div>
                  )
                      })}

                      {!hasFileField && (
                        <div>
                          <label className="block text-xs font-medium text-[#5a7280] mb-2">Прикрепить изображения (необязательно)</label>
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="px-4 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-[#266479]/5 flex items-center gap-2 cursor-pointer transition-all shadow-sm">
                              <Upload size={16} className="text-[#266479]" />
                              <span className="font-medium">Выбрать файлы</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => onFiles(e.target.files)}
                                className="hidden"
                              />
                            </label>
                            <div className="text-xs text-[#5a7280]">до 6 файлов, до ~1.2MB</div>
                          </div>
                          {images.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {images.map((img, i) => (
                                <div key={i} className="relative group">
                                  <img src={img.url} alt={img.name} className="w-full h-24 sm:h-28 object-cover rounded-xl border border-[#266479]/10 shadow-sm" />
                                  <button
                                    onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute top-1 right-1 p-1 rounded-md !bg-red-600 text-white shadow-md hover:!bg-red-700 transition-colors"
                                    title="Удалить"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
          {error && <div className="text-red-500 text-sm mt-3 font-medium">{error}</div>}
          {success && (
            <div className="text-emerald-700 text-sm mt-3 font-medium flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Заявка отправлена</span>
            </div>
          )}
          
          <div className="flex items-center justify-end gap-3 mt-6">
            <button 
              onClick={onClose} 
              className="px-4 py-2 rounded-xl !bg-red-600 border border-red-600/40 text-white hover:!bg-red-700 transition-all font-medium shadow-md"
            >
              Отмена
            </button>
            {activeTab === 'requests' && !!selectedTemplate && (
              <button
                onClick={submit}
                disabled={isSending}
                className="px-4 py-2 rounded-xl !bg-emerald-600 hover:!bg-emerald-700 text-white border border-emerald-600/40 flex items-center gap-2 disabled:opacity-60 transition-all font-medium shadow-md shadow-emerald-900/20"
              >
                <SendHorizonal size={18} />
                <span>Отправить</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
