import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, User, IdCard, Upload, Trash2, CreditCard, Image as ImageIcon, Settings, FileText, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { useParams } from 'react-router-dom'

const KEY_STUDENTS = 'admin_students_list'
const KEY_DOC_FIELDS = 'admin_doc_fields_config'

function readDocFields() {
  try {
    const raw = localStorage.getItem(KEY_DOC_FIELDS)
    if (raw) {
      // Migration or simple parse
      const parsed = JSON.parse(raw)
      // Check if old structure (without 'extensions' or 'hasFile' etc) and migrate
      return parsed.map(f => {
        if (f.hasFile !== undefined) return f
        // Migrate old 'type' to new structure
        return {
          id: f.id,
          label: f.label,
          hasFile: f.type === 'image' || f.type === 'file',
          hasText: f.type === 'text',
          extensions: f.type === 'image' ? ['jpg','png'] : f.type === 'file' ? ['pdf','doc','xls'] : []
        }
      })
    }
    return [
      { id: 'passport', label: 'Паспорт', hasFile: true, hasText: false, extensions: ['jpg','png'] },
      { id: 'snils', label: 'СНИЛС', hasFile: true, hasText: false, extensions: ['jpg','png'] },
      { id: 'edu_doc', label: 'Документ об образовании', hasFile: true, hasText: false, extensions: ['jpg','png','pdf'] },
      { id: 'contract', label: 'Договор', hasFile: true, hasText: false, extensions: ['pdf','doc'] }
    ]
  } catch {
    return [
      { id: 'passport', label: 'Паспорт', hasFile: true, hasText: false, extensions: ['jpg','png'] },
      { id: 'snils', label: 'СНИЛС', hasFile: true, hasText: false, extensions: ['jpg','png'] },
      { id: 'edu_doc', label: 'Документ об образовании', hasFile: true, hasText: false, extensions: ['jpg','png','pdf'] },
      { id: 'contract', label: 'Договор', hasFile: true, hasText: false, extensions: ['pdf','doc'] }
    ]
  }
}

function readStudents() {
  try {
    const raw = localStorage.getItem(KEY_STUDENTS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function readProfileStore(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeProfileStore(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {}
}

export default function ProfileModal({ open, onClose, studentId, studentEmail, readonly = false }) {
  const { user, getUserPayments, isAdmin } = useAuth()
  const [students, setStudents] = useState([])

  useEffect(() => {
    if (open) {
      setStudents(readStudents())
    }
  }, [open])
  const student = useMemo(() => {
    if (studentId) return students.find(s => s.id === studentId) || null
    if (studentEmail) return students.find(s => (s.email || '').toLowerCase() === (studentEmail || '').toLowerCase()) || null
    if (user?.email) return students.find(s => (s.email || '').toLowerCase() === user.email.toLowerCase()) || null
    return null
  }, [students, studentId, studentEmail, user])
  const profileKey = useMemo(() => {
    if (student?.id) return `student_profile_${student.id}`
    if (studentEmail) return `user_profile_${(studentEmail || '').toLowerCase()}`
    if (user?.email) return `user_profile_${user.email.toLowerCase()}`
    return null
  }, [student, studentEmail, user])
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ photo: '', docs: {} })
  const [docFields, setDocFields] = useState([])
  const [isConfiguringDocs, setIsConfiguringDocs] = useState(false)
  const [newField, setNewField] = useState({ label: '', hasFile: true, hasText: false, extensions: [] })

  useEffect(() => {
    if (open) {
      setDocFields(readDocFields())
    }
  }, [open])

  const email = useMemo(() => student?.email || studentEmail || user?.email || '', [student, studentEmail, user])
  const { universitySlug } = useParams()
  const [serverUser, setServerUser] = useState(null)
  const [serverCourses, setServerCourses] = useState([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [plans, setPlans] = useState([])
  const [previewReceipt, setPreviewReceipt] = useState('')
  const loadPlansForEmail = React.useCallback(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('payments_plans') || '[]')
      const normalized = raw.map(p => ({
        ...p,
        email: String(p.email || '').trim().toLowerCase()
      }))
      const rawChanged = JSON.stringify(raw) !== JSON.stringify(normalized)
      if (rawChanged) {
        try { localStorage.setItem('payments_plans', JSON.stringify(normalized)) } catch {}
      }
      const target = String(email || '').trim().toLowerCase()
      const byEmail = normalized.filter(p => p.email === target)
      if (byEmail.length > 0) {
        setPlans(byEmail)
      } else {
        const all = typeof getUserPayments === 'function' ? getUserPayments() : []
        setPlans(all)
      }
    } catch {
      setPlans([])
    }
  }, [email, getUserPayments])

  useEffect(() => {
    if (!open) return
    if (profileKey) {
      const saved = readProfileStore(profileKey)
      setProfile({ photo: saved.photo || '', docs: saved.docs || {} })
    }
    setAvatarPreview('')
    setAvatarError('')
    loadPlansForEmail()
  }, [open, profileKey, student, user, loadPlansForEmail])

  // Обновляем планы при открытии вкладки или изменении списка студентов (который влияет на student/email)
  useEffect(() => {
    if (!open) return
    loadPlansForEmail()
  }, [tab, open, students.length, loadPlansForEmail])
  const canEdit = !readonly
  const isStudentSelfDocs = !studentId && String(user?.account_type || '') === 'student' && Number.isFinite(Number(user?.id))
  const serverDocsStudentId = studentId || (isStudentSelfDocs ? Number(user.id) : null)
  const isServerDocs = !!((isAdmin && studentId) || isStudentSelfDocs)
  const canUploadServerDocs = !!((isAdmin && studentId) || isStudentSelfDocs)
  const [serverFiles, setServerFiles] = useState([])
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [serverFilesError, setServerFilesError] = useState('')
  const [serverFilesLoading, setServerFilesLoading] = useState(false)
  const normalizeList = (value) => (Array.isArray(value) ? value : (Array.isArray(value?.results) ? value.results : []))

  const loadServerFiles = useCallback(async () => {
    if (!isServerDocs) return
    setServerFilesError('')
    setServerFilesLoading(true)
    try {
      const list = await api.users.studentFiles.list(serverDocsStudentId, { universitySlug: universitySlug || null })
      setServerFiles(normalizeList(list))
    } catch (e) {
      setServerFiles([])
      const msg = e?.body?.detail || 'Не удалось загрузить документы'
      setServerFilesError(String(msg))
    } finally {
      setServerFilesLoading(false)
    }
  }, [isServerDocs, serverDocsStudentId, universitySlug])

  useEffect(() => {
    if (!open) return
    if (tab !== 'docs') return
    if (!isServerDocs) return
    loadServerFiles()
  }, [open, tab, isServerDocs, loadServerFiles])

  const loadServerProfile = useCallback(async () => {
    if (!open) return
    setProfileLoading(true)
    try {
      const u = studentId
        ? await api.users.students.retrieve(studentId, { universitySlug: universitySlug || null })
        : await api.users.me()
      setServerUser(u || null)
      const coursesList = studentId
        ? await api.users.students.courses(studentId, { universitySlug: universitySlug || null })
        : await api.courses.myCourses({ universitySlug: universitySlug || null })
      setServerCourses(Array.isArray(coursesList) ? coursesList : (Array.isArray(coursesList?.results) ? coursesList.results : []))
    } catch {
      setServerUser(null)
      setServerCourses([])
    } finally {
      setProfileLoading(false)
    }
  }, [open, studentId, universitySlug])

  useEffect(() => {
    if (!open) return
    if (tab !== 'profile') return
    loadServerProfile()
  }, [open, tab, loadServerProfile])

  const onChangePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    setAvatarUploading(true)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const updated = studentId
        ? await api.users.students.update(studentId, form)
        : await api.users.updateMe(form)
      setServerUser(updated || null)
    } catch (err) {
      const msg = err?.body?.detail || 'Не удалось загрузить аватар'
      setAvatarError(String(msg))
    } finally {
      setAvatarUploading(false)
    }
  }
  const onChangeDoc = async (fieldId, e) => {
    if (!canEdit) return
    const file = e.target.files?.[0]
    if (!file) return

    const dataUrl = await fileToDataUrl(file)
    setProfile(p => ({ ...p, docs: { ...p.docs, [fieldId]: { ...(p.docs[fieldId] || {}), file: dataUrl, fileName: file.name } } }))
  }

  const onChangeDocText = (fieldId, value) => {
    if (!canEdit) return
    setProfile(p => ({ ...p, docs: { ...p.docs, [fieldId]: { ...(p.docs[fieldId] || {}), text: value } } }))
  }

  const addField = () => {
    if (!newField.label.trim()) return
    const next = [...docFields, { ...newField, id: 'field_' + Date.now() }]
    setDocFields(next)
    localStorage.setItem(KEY_DOC_FIELDS, JSON.stringify(next))
    setNewField({ label: '', hasFile: true, hasText: false, extensions: [] })
  }

  const removeField = (id) => {
    const next = docFields.filter(f => f.id !== id)
    setDocFields(next)
    localStorage.setItem(KEY_DOC_FIELDS, JSON.stringify(next))
  }
  const saveAll = () => {
    if (profileKey) writeProfileStore(profileKey, profile)
    onClose && onClose()
  }
  const removeDoc = (fieldId, type) => {
    if (!canEdit) return
    setProfile(p => {
      const current = p.docs[fieldId] || {}
      if (type === 'file') return { ...p, docs: { ...p.docs, [fieldId]: { ...current, file: undefined, fileName: undefined } } }
      if (type === 'text') return { ...p, docs: { ...p.docs, [fieldId]: { ...current, text: undefined } } }
      return p
    })
  }
  const savePlans = (next) => {
    try {
      const raw = JSON.parse(localStorage.getItem('payments_plans') || '[]')
      const others = raw.filter(p => (p.email || '').toLowerCase() !== String(email || '').toLowerCase())
      localStorage.setItem('payments_plans', JSON.stringify([...others, ...next]))
      setPlans(next)
    } catch {
      setPlans(next)
    }
  }
  const payNow = (courseId) => {
    if (!email) return
    const next = plans.map(p => {
      if (p.courseId !== courseId) return p
      const amount = Number(p.monthlyAmount || 0) || 0
      const payments = Array.isArray(p.payments) ? [...p.payments] : []
      payments.push({ date: new Date().toISOString(), amount, receiptUrl: '' })
      return { ...p, payments }
    })
    savePlans(next)
  }
  const attachReceipt = async (courseId, idx, file) => {
    if (!file) return
    const url = await fileToDataUrl(file)
    const next = plans.map(p => {
      if (p.courseId !== courseId) return p
      const payments = Array.isArray(p.payments) ? p.payments.map((x, i) => i === idx ? { ...x, receiptUrl: url } : x) : []
      return { ...p, payments }
    })
    savePlans(next)
  }

  const generateDemoPlan = () => {
    if (!email) return
    const demo = {
      courseId: 'demo_course_' + Date.now(),
      email: email.trim().toLowerCase(),
      title: 'Демонстрационный курс (React Native)',
      total: 50000,
      monthlyAmount: 5000,
      planMonths: 10,
      startDate: new Date().toISOString(),
      payments: []
    }
    try {
      const raw = JSON.parse(localStorage.getItem('payments_plans') || '[]')
      const next = [...raw, demo]
      localStorage.setItem('payments_plans', JSON.stringify(next))
      loadPlansForEmail()
    } catch {}
  }

  if (!open) return null
  const onSubmitUpload = async () => {
    if (!canUploadServerDocs) return
    if (!uploadFile) return
    const name = (uploadName || uploadFile?.name || 'Документ').trim()
    setServerFilesError('')
    setServerFilesLoading(true)
    try {
      await api.users.studentFiles.upload(
        serverDocsStudentId,
        { name, file: uploadFile },
        { universitySlug: universitySlug || null }
      )
      setUploadName('')
      setUploadFile(null)
      await loadServerFiles()
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.file?.[0] || e?.body?.name?.[0] || 'Не удалось загрузить документ'
      setServerFilesError(String(msg))
      setServerFilesLoading(false)
    }
  }

  const onViewServerFile = async (fileId) => {
    if (!isServerDocs) return
    setServerFilesError('')
    try {
      const { blob, contentType } = await api.users.studentFiles.fetchFile(
        serverDocsStudentId,
        fileId,
        { universitySlug: universitySlug || null }
      )
      const url = URL.createObjectURL(contentType ? new Blob([blob], { type: contentType }) : blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось открыть документ'
      setServerFilesError(String(msg))
    }
  }

  const onRemoveServerFile = async (fileId) => {
    if (!canUploadServerDocs) return
    const ok = window.confirm('Удалить документ?')
    if (!ok) return
    setServerFilesError('')
    setServerFilesLoading(true)
    try {
      await api.users.studentFiles.remove(
        serverDocsStudentId,
        fileId,
        { universitySlug: universitySlug || null }
      )
      setServerFiles(prev => prev.filter(f => String(f.id) !== String(fileId)))
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось удалить документ'
      setServerFilesError(String(msg))
    } finally {
      setServerFilesLoading(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[10010] flex items-center justify-center">
        <div className="absolute inset-0 modal-overlay" onClick={onClose} />
        <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} className="modal-panel rounded-2xl w-[95vw] sm:max-w-3xl p-4 sm:p-6 h-[80vh] overflow-y-auto relative">
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-xl !bg-red-600 hover:!bg-red-700 text-white border border-red-600/40 transition-colors shadow-sm flex items-center justify-center leading-none">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-[#0f2e3a]/80" />
            <div className="text-[#0f2e3a] font-semibold">Профиль</div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setTab('profile')} className={`flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm border transition-colors ${tab === 'profile' ? '!bg-emerald-600 text-white border-emerald-600/40' : 'bg-white/80 border-[#266479]/20 text-[#0f2e3a]/80 hover:bg-white'}`}>
              <User size={16} />
              <span>Профиль</span>
            </button>
            <button onClick={() => setTab('docs')} className={`flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm border transition-colors ${tab === 'docs' ? '!bg-emerald-600 text-white border-emerald-600/40' : 'bg-white/80 border-[#266479]/20 text-[#0f2e3a]/80 hover:bg-white'}`}>
              <FileText size={16} />
              <span>Документы</span>
            </button>
            <button onClick={() => setTab('payments')} className={`flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm border transition-colors ${tab === 'payments' ? '!bg-emerald-600 text-white border-emerald-600/40' : 'bg-white/80 border-[#266479]/20 text-[#0f2e3a]/80 hover:bg-white'}`}>
              <CreditCard size={16} />
              <span>Оплата</span>
            </button>
          </div>
          {tab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="rounded-2xl border border-[#266479]/20 bg-white p-2 sm:p-3">
                  <div className="w-full flex justify-center">
                    <div className="rounded-xl overflow-hidden border border-[#266479]/20 w-36 h-48 sm:w-[180px] sm:h-[240px]">
                      {avatarPreview || serverUser?.avatar ? (
                        <img src={avatarPreview || serverUser.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#5a7280]">3:4</div>
                      )}
                    </div>
                  </div>
                  {(canEdit || isAdmin || isStudentSelfDocs) && (
                    <label className="mt-3 w-full flex items-center gap-2 justify-center px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] cursor-pointer">
                      <Upload size={16} />
                      <span className="text-sm">{avatarUploading ? 'Загрузка…' : 'Загрузить аватар'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={onChangePhoto} />
                    </label>
                  )}
                  {!!avatarError && (
                    <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{avatarError}</div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-3">
                {profileLoading && (
                  <div className="text-[#5a7280] text-sm">Загрузка…</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Фамилия</label>
                    <input value={serverUser?.last_name || ''} disabled className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-[#0f2e3a]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Имя</label>
                    <input value={serverUser?.first_name || ''} disabled className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-[#0f2e3a]" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Отчество</label>
                    <input value={serverUser?.middle_name || ''} disabled className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-[#0f2e3a]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-[#266479]/20 p-2 sm:p-3 bg-white">
                    <div className="text-[#0f2e3a] font-medium mb-2">Курсы</div>
                    <div className="space-y-1">
                      {serverCourses.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3">
                          <div className="text-sm text-[#0f2e3a] truncate">{c.title || 'Курс'}</div>
                          <div className="shrink-0 px-2 py-1 rounded-full border text-xs font-semibold"
                            style={{
                              background: 'rgba(38, 100, 121, 0.08)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: '#0f2e3a'
                            }}
                          >
                            {c.course_type_display || c.course_type || 'Курс'}
                          </div>
                        </div>
                      ))}
                      {serverCourses.length === 0 && (
                        <div className="text-xs text-[#5a7280]">Нет курсов</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === 'docs' && (
            <div className="space-y-4">
              {isServerDocs ? (
                <div className="space-y-4">
                  {canUploadServerDocs && (
                    <div className="rounded-2xl border border-[#266479]/20 bg-white p-4">
                      <div className="text-[#0f2e3a] font-medium mb-3">Загрузка документа</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-[#5a7280] mb-1">Название</label>
                          <input
                            value={uploadName}
                            onChange={(e) => setUploadName(e.target.value)}
                            className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-[#0f2e3a]"
                            placeholder="Например: Паспорт"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[#5a7280] mb-1">Файл</label>
                          <input
                            type="file"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-[#0f2e3a]"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={onSubmitUpload}
                          disabled={!uploadFile || serverFilesLoading}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                        >
                          Загрузить
                        </button>
                      </div>
                      {serverFilesError && (
                        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{serverFilesError}</div>
                      )}
                    </div>
                  )}

                  <div className="rounded-2xl border border-[#266479]/20 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[#0f2e3a] font-medium">Загруженные документы</div>
                      <button
                        onClick={loadServerFiles}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#266479]/20 text-xs text-[#0f2e3a] hover:brightness-105"
                      >
                        Обновить
                      </button>
                    </div>
                    {serverFilesLoading ? (
                      <div className="text-sm text-[#5a7280]">Загрузка…</div>
                    ) : (
                      <div className="space-y-2">
                        {serverFiles.map(f => (
                          <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#266479]/20 bg-white">
                            <div className="min-w-0">
                              <div className="text-[#0f2e3a] font-medium truncate">{f.name || 'Документ'}</div>
                              <div className="text-xs text-[#5a7280]">{f.created_at ? new Date(f.created_at).toLocaleString() : ''}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => onViewServerFile(f.id)}
                                className="px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 whitespace-nowrap"
                              >
                                Открыть
                              </button>
                              {canUploadServerDocs && (
                                <button
                                  onClick={() => onRemoveServerFile(f.id)}
                                  disabled={serverFilesLoading}
                                  className="px-3 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white whitespace-nowrap disabled:opacity-60"
                                  title="Удалить"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Trash2 size={16} />
                                    <span className="hidden sm:inline">Удалить</span>
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {serverFiles.length === 0 && (
                          <div className="text-sm text-[#5a7280]">Документы не загружены</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {!readonly && canEdit && isAdmin && (
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[#0f2e3a] font-medium">Мои документы</div>
                  <button onClick={() => setIsConfiguringDocs(!isConfiguringDocs)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#266479]/20 text-xs text-[#0f2e3a] hover:brightness-105">
                    <Settings size={14} />
                    <span>Настроить поля</span>
                  </button>
                </div>
              )}
              {!readonly && canEdit && !isAdmin && (
                 <div className="flex items-center justify-between mb-4">
                   <div className="text-[#0f2e3a] font-medium">Мои документы</div>
                   {/* Student cannot configure docs */}
                 </div>
              )}
              {isConfiguringDocs && (
                <div className="rounded-2xl border border-[#266479]/20 bg-white p-4 mb-4">
                  <div className="text-[#0f2e3a] font-medium mb-3">Настройка полей документов</div>
                  <div className="space-y-2 mb-4">
                    {docFields.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/90 border border-[#266479]/20">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#0f2e3a]">{f.label}</span>
                          <div className="flex gap-1">
                            {f.hasFile && <span className="text-[10px] text-[#5a7280] bg-white px-1.5 py-0.5 rounded uppercase border border-[#266479]/10">Файл ({(f.extensions || []).join(', ') || 'Все'})</span>}
                            {f.hasText && <span className="text-[10px] text-[#5a7280] bg-white px-1.5 py-0.5 rounded uppercase border border-[#266479]/10">Текст</span>}
                          </div>
                        </div>
                        <button onClick={() => removeField(f.id)} className="p-1.5 rounded-lg !bg-red-600 text-white border border-red-600/40 hover:brightness-110 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-[#5a7280] mb-1">Название поля</label>
                      <input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} className="w-full bg-white border border-[#266479]/20 rounded-lg px-3 py-2 text-sm text-[#0f2e3a]" placeholder="Например: Справка" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newField.hasFile} onChange={e => setNewField({ ...newField, hasFile: e.target.checked })} className="rounded bg-white border border-[#266479]/20" />
                          <span className="text-sm text-[#0f2e3a]">Файл</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newField.hasText} onChange={e => setNewField({ ...newField, hasText: e.target.checked })} className="rounded bg-white border border-[#266479]/20" />
                          <span className="text-sm text-[#0f2e3a]">Текст</span>
                        </label>
                      </div>
                      {newField.hasFile && (
                        <div className="flex flex-wrap gap-2">
                          {['jpg','png','pdf','doc','xls'].map(ext => (
                            <label key={ext} className={`px-2 py-1 rounded text-xs cursor-pointer border ${newField.extensions.includes(ext) ? 'bg-[#0f2e3a] border-[#0f2e3a] text-white' : 'bg-white border-[#266479]/20 text-[#5a7280]'}`}>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={newField.extensions.includes(ext)}
                                onChange={e => {
                                  const next = e.target.checked 
                                    ? [...newField.extensions, ext]
                                    : newField.extensions.filter(x => x !== ext)
                                  setNewField({ ...newField, extensions: next })
                                }}
                              />
                              {ext.toUpperCase()}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={addField} disabled={!newField.label.trim() || (!newField.hasFile && !newField.hasText)} className="h-[38px] px-3 rounded-lg !bg-emerald-600 text-white border border-emerald-600/40 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-colors">
                      <Plus size={16} />
                      Добавить
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {docFields.map(field => {
                  // Legacy support: convert string value to object structure if needed
                  const rawVal = profile.docs[field.id]
                  let val = typeof rawVal === 'string' 
                    ? (rawVal.startsWith('data:') ? { file: rawVal } : { text: rawVal })
                    : (rawVal || {})
                  
                  return (
                    <div key={field.id} className="rounded-2xl border border-[#266479]/20 bg-white p-2 sm:p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <IdCard size={16} className="text-[#0f2e3a]/80" />
                        <div className="text-[#0f2e3a] font-medium">{field.label}</div>
                      </div>
                      
                      {field.hasFile && (
                        <div className="mb-3">
                          <div className="rounded-xl overflow-hidden border border-[#266479]/20 bg-white w-full h-36 sm:h-48 flex items-center justify-center relative group">
                            {val.file ? (
                              field.extensions?.some(e => ['jpg','png','jpeg'].includes(e)) && val.file.startsWith('data:image') ? (
                                <img src={val.file} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center gap-2 text-[#0f2e3a]">
                                  <FileText size={32} />
                                  <span className="text-xs max-w-[90%] truncate px-2 text-center">{val.fileName || 'Файл загружен'}</span>
                                </div>
                              )
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-[#5a7280]">
                                <Upload size={24} />
                                <span className="text-xs">
                                  {(field.extensions || []).join(', ').toUpperCase() || 'Любой формат'}
                                </span>
                              </div>
                            )}
                            
                            {canEdit && (
                              <div className={`absolute inset-0 bg-white/70 flex items-center justify-center gap-2 transition-opacity ${val.file ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                                <label className="p-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] cursor-pointer hover:brightness-105 transition-colors" title="Загрузить">
                                  <Upload size={18} />
                                  <input 
                                    type="file" 
                                    accept={field.extensions?.length ? field.extensions.map(e => '.' + e).join(',') : "*/*"} 
                                    className="hidden" 
                                    onChange={e => onChangeDoc(field.id, e)} 
                                  />
                                </label>
                                {val.file && (
                                  <button onClick={() => removeDoc(field.id, 'file')} className="p-2 rounded-xl !bg-red-600 border border-red-600/40 text-white hover:brightness-110 transition-colors" title="Удалить файл">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {field.hasText && (
                        <div>
                          <textarea
                            value={val.text || ''}
                            onChange={e => onChangeDocText(field.id, e.target.value)}
                            disabled={!canEdit}
                            className="w-full h-24 bg-white border border-[#266479]/20 rounded-xl p-3 text-sm text-[#0f2e3a] resize-none focus:border-[#266479]/30 transition-colors placeholder:text-[#5a7280]"
                            placeholder="Введите текст или комментарий..."
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
                </>
              )}
            </div>
          )}
          {tab === 'payments' && (
            <div className="space-y-4">
              {plans.map((p, pi) => {
                const paidTotal = (p.payments || []).reduce((s, x) => s + Number(x.amount || 0), 0)
                const remaining = Math.max((p.total || 0) - paidTotal, 0)
                return (
                  <div key={`${p.courseId}_${pi}`} className="rounded-2xl border border-[#266479]/20 p-3 sm:p-4 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[#0f2e3a] font-medium truncate">{p.title}</div>
                        <div className="text-xs text-[#5a7280]">План: {p.planMonths} мес • Ежемесячно {Number(p.monthlyAmount || 0).toLocaleString('ru-RU')} ₽</div>
                      </div>
                      {!readonly && (
                        <button
                          onClick={() => payNow(p.courseId)}
                          className="px-3 py-2 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white border border-[#266479]/20 text-sm shrink-0"
                        >
                          Оплатить
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                        <div className="text-xs text-[#5a7280] mb-1">Оплачено</div>
                        <div className="text-sm text-[#0f2e3a]">{paidTotal.toLocaleString('ru-RU')} ₽ из {(p.total || 0).toLocaleString('ru-RU')} ₽</div>
                      </div>
                      <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                        <div className="text-xs text-[#5a7280] mb-1">Осталось</div>
                        <div className="text-sm text-[#0f2e3a]">{remaining.toLocaleString('ru-RU')} ₽</div>
                      </div>
                      <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                        <div className="text-xs text-[#5a7280] mb-1">Платежей</div>
                        <div className="text-sm text-[#0f2e3a]">{(p.payments || []).length} из {p.planMonths}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-[#0f2e3a] text-sm mb-2">История платежей</div>
                      <div className="space-y-2">
                        {(p.payments || []).map((x, idx) => {
                          const has = !!x.receiptUrl
                          return (
                            <div key={idx} className="flex items-center justify-between rounded-xl border border-[#266479]/20 bg-white/80 px-3 py-2">
                              <div className="text-xs sm:text-sm text-[#0f2e3a]">
                                Совершена оплата {Number(x.amount || 0).toLocaleString('ru-RU')} ₽ • {new Date(x.date).toLocaleString('ru-RU')}
                              </div>
                              <div className="flex items-center gap-2">
                                {has && (
                                  <button
                                    onClick={() => setPreviewReceipt(x.receiptUrl)}
                                    className="px-2 py-1.5 rounded-lg bg-[#0f2e3a] border border-[#0f2e3a] text-white text-xs flex items-center gap-1"
                                  >
                                    <ImageIcon size={14} />
                                    Просмотр
                                  </button>
                                )}
                                {!readonly && (
                                  <label className={`px-2 py-1.5 rounded-lg ${has ? 'bg-[#0f2e3a] border border-[#0f2e3a] text-white' : 'bg-white/90 border border-[#266479]/20 text-[#0f2e3a]'} text-xs flex items-center gap-1 cursor-pointer`}>
                                    <Upload size={14} />
                                    {has ? 'Заменить квитанцию' : 'Квитанция'}
                                    <input type="file" accept="image/*" className="hidden" onChange={e => attachReceipt(p.courseId, idx, e.target.files?.[0])} />
                                  </label>
                                )}
                                {readonly && !has && (
                                  <span className="px-2 py-1.5 rounded-lg bg-white/90 border border-[#266479]/20 text-[#5a7280] text-xs">Нет квитанции</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {(p.payments || []).length === 0 && (
                          <div className="text-xs text-[#5a7280]">Платежей пока нет</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {plans.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <div className="text-sm text-[#5a7280]">Планы оплаты не найдены</div>
                  {!readonly && (
                    <button onClick={generateDemoPlan} className="px-4 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] text-sm hover:bg-white">
                      Сгенерировать демо-план
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 mt-6">
            {canEdit && (
              <button onClick={saveAll} className="px-4 py-2 rounded-xl !bg-emerald-600 text-white border border-emerald-600/40">Сохранить</button>
            )}
          </div>
          <AnimatePresence>
            {!!previewReceipt && (
              <motion.div className="fixed inset-0 z-[10020] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewReceipt('')} />
                <motion.div initial={{ opacity: 0, scale: 0.98, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative w-full max-w-3xl p-4">
                  <img src={previewReceipt} alt="" className="w-full rounded-2xl border border-white/20" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
