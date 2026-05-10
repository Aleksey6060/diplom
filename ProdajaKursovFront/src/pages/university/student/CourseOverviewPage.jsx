import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, BookOpen, Folder, FileText, Layers, Boxes } from 'lucide-react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'
import TestAttemptModal from '../../../components/TestAttemptModal'
import AssignmentModal from '../../../components/AssignmentModal'

export default function CourseOverviewPage() {
  const { id, universitySlug } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const base = universitySlug ? `/${universitySlug}` : ''

  const node = searchParams.get('node') || 'course'
  const nodeId = searchParams.get('id')

  const [contents, setContents] = useState(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createKind, setCreateKind] = useState('')
  const [form, setForm] = useState({ title: '', description: '', material_type: 'lecture', is_published: true, free_preview: false })
  const [createError, setCreateError] = useState('')
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [activeTestId, setActiveTestId] = useState(null)
  const [testAttempts, setTestAttempts] = useState({ loading: false, used: 0, limit: null, remaining: null, last: null })
  const [testAttemptsVersion, setTestAttemptsVersion] = useState(0)
  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [assignmentsError, setAssignmentsError] = useState('')
  const [activeAssignment, setActiveAssignment] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError('')
        setLoading(true)
        let data
        if (node === 'semester' && nodeId) data = await api.courses.semesterContents(nodeId)
        else if (node === 'subject' && nodeId) data = await api.courses.subjectContents(nodeId)
        else if (node === 'topic' && nodeId) data = await api.courses.topicContents(nodeId)
        else if (node === 'material' && nodeId) data = await api.courses.materialContents(nodeId)
        else if (node === 'folder' && nodeId) data = await api.courses.folderContents(nodeId)
        else data = await api.courses.courseContents(id)

        if (!cancelled) setContents(data)
      } catch {
        if (!cancelled) setError('Не удалось загрузить данные курса')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, node, nodeId])

  const courseTitle = useMemo(() => {
    const crumbs = contents?.breadcrumbs
    if (!Array.isArray(crumbs)) return ''
    const course = crumbs.find(c => c?.type === 'course')
    return course?.title || ''
  }, [contents])

  const nodeTitle = useMemo(() => {
    if (!contents?.current) return ''
    return contents.current.title || ''
  }, [contents])

  const currentNodeType = contents?.node_type
  const currentCourseType = contents?.current?.course_type
  const currentMaterialType = contents?.current?.material_type
  const currentTestId = contents?.current?.test_data?.id || contents?.current?.test_id || null
  const currentTestAttemptsLimit = contents?.current?.test_data?.attempts_limit ?? null

  useEffect(() => {
    if (currentNodeType !== 'material' || currentMaterialType !== 'test' || !currentTestId) {
      setTestAttempts({ loading: false, used: 0, limit: null, remaining: null, last: null })
      return
    }
    let cancelled = false
    ;(async () => {
      setTestAttempts(prev => ({ ...prev, loading: true, limit: currentTestAttemptsLimit }))
      try {
        const list = await api.courses.tests.results(Number(currentTestId), { universitySlug })
        if (cancelled) return
        const attempts = Array.isArray(list) ? list : []
        const used = attempts.filter(a => a?.status === 'completed' || a?.status === 'timed_out').length
        const remaining = currentTestAttemptsLimit == null ? null : Math.max(0, Number(currentTestAttemptsLimit) - used)
        const last = attempts.find(a => a?.status === 'completed' || a?.status === 'timed_out') || null
        setTestAttempts({ loading: false, used, limit: currentTestAttemptsLimit == null ? null : Number(currentTestAttemptsLimit), remaining, last })
      } catch {
        if (!cancelled) setTestAttempts({ loading: false, used: 0, limit: currentTestAttemptsLimit == null ? null : Number(currentTestAttemptsLimit), remaining: null, last: null })
      }
    })()
    return () => { cancelled = true }
  }, [currentMaterialType, currentNodeType, currentTestAttemptsLimit, currentTestId, universitySlug, testAttemptsVersion])

  useEffect(() => {
    if (isLoading) return
    if (currentNodeType !== 'topic' || !nodeId) {
      setAssignments([])
      setAssignmentsError('')
      setAssignmentsLoading(false)
      setActiveAssignment(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setAssignmentsLoading(true)
      setAssignmentsError('')
      try {
        const list = await api.courses.assignments.myByTopic(nodeId, { universitySlug: universitySlug || null })
        if (cancelled) return
        const normalized = Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : [])
        setAssignments(normalized)
      } catch {
        if (!cancelled) setAssignmentsError('Не удалось загрузить задания')
      } finally {
        if (!cancelled) setAssignmentsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentNodeType, isLoading, nodeId, universitySlug])

  const items = useMemo(() => {
    const ch = contents?.children || {}
    const result = []

    const semesters = Array.isArray(ch.semesters) ? ch.semesters : []
    const subjects = Array.isArray(ch.subjects) ? ch.subjects : []
    const topics = Array.isArray(ch.topics) ? ch.topics : []
    const materials = Array.isArray(ch.materials) ? ch.materials : []
    const folders = Array.isArray(ch.folders) ? ch.folders : []
    const files = Array.isArray(ch.files) ? ch.files : []

    semesters.forEach(s => result.push({ kind: 'semester', id: s.id, title: s.title, subtitle: 'Семестр' }))
    subjects.forEach(s => result.push({ kind: 'subject', id: s.id, title: s.title, subtitle: 'Предмет' }))
    topics.forEach(t => result.push({ kind: 'topic', id: t.id, title: t.title, subtitle: 'Тема' }))
    materials.forEach(m => result.push({ kind: 'material', id: m.id, title: m.title, subtitle: m.material_type_display || 'Материал' }))
    folders.forEach(f => result.push({ kind: 'folder', id: f.id, title: f.title, subtitle: 'Папка' }))
    files.forEach(f => result.push({ kind: 'file', id: f.id, title: f.title || 'Файл', subtitle: f.file_role_display || 'Файл', file: f.file }))

    return result
  }, [contents])

  const openNode = (kind, nextId) => {
    if (kind === 'file') return
    setSearchParams({ node: kind, id: String(nextId) })
  }

  const openBreadcrumb = (crumb) => {
    if (!crumb) return
    if (crumb.type === 'root') {
      navigate(`${base}/my-courses`)
      return
    }
    if (crumb.type === 'course') {
      navigate(`${base}/my-courses/${crumb.id}`)
      return
    }
    if (crumb.type === 'semester') setSearchParams({ node: 'semester', id: String(crumb.id) })
    else if (crumb.type === 'subject') setSearchParams({ node: 'subject', id: String(crumb.id) })
    else if (crumb.type === 'topic') setSearchParams({ node: 'topic', id: String(crumb.id) })
    else if (crumb.type === 'material') setSearchParams({ node: 'material', id: String(crumb.id) })
    else if (crumb.type === 'folder') setSearchParams({ node: 'folder', id: String(crumb.id) })
  }

  const iconFor = (kind) => {
    const style = { color: 'var(--content-text)' }
    if (kind === 'semester') return <Layers style={style} size={18} />
    if (kind === 'subject') return <Boxes style={style} size={18} />
    if (kind === 'topic') return <BookOpen style={style} size={18} />
    if (kind === 'material') return <BookOpen style={style} size={18} />
    if (kind === 'folder') return <Folder style={style} size={18} />
    if (kind === 'file') return <FileText style={style} size={18} />
    return <BookOpen style={style} size={18} />
  }

  const availableCreates = useMemo(() => {
    if (!currentNodeType) return []
    if (currentNodeType === 'course') {
      if (currentCourseType === 'full') return ['semester']
      return ['topic', 'material']
    }
    if (currentNodeType === 'semester') return ['subject']
    if (currentNodeType === 'subject') return ['topic']
    if (currentNodeType === 'topic') return ['material']
    return []
  }, [currentNodeType, currentCourseType])

  const resetForm = () => {
    setForm({ title: '', description: '', material_type: 'lecture', is_published: true, free_preview: false })
    setCreateError('')
  }

  const submitCreate = async () => {
    try {
      setCreateError('')
      if (!createKind) {
        setCreateError('Выберите тип объекта')
        return
      }
      if (!form.title.trim()) {
        setCreateError('Заполните поле «Название»')
        return
      }
      const cur = contents?.current
      if (!cur) {
        setCreateError('Нет активного узла для создания')
        return
      }
      if (createKind === 'semester') {
        await api.courses.createSemester({ course: cur.id, title: form.title })
      } else if (createKind === 'subject') {
        await api.courses.createSubject({ semester: cur.id, title: form.title, description: form.description || '' })
      } else if (createKind === 'topic') {
        if (currentNodeType === 'course') {
          await api.courses.createTopic({ course: cur.id, subject: null, title: form.title, description: form.description || '' })
        } else if (currentNodeType === 'subject') {
          await api.courses.createTopic({ course: null, subject: cur.id, title: form.title, description: form.description || '' })
        } else {
          setCreateError('Тему можно создать только внутри курса или предмета')
          return
        }
      } else if (createKind === 'material') {
        const common = { title: form.title, material_type: form.material_type, description: form.description || '', is_published: !!form.is_published, free_preview: !!form.free_preview }
        if (currentNodeType === 'course') {
          await api.courses.createMaterial({ course: cur.id, ...common })
        } else if (currentNodeType === 'subject') {
          await api.courses.createMaterial({ subject: cur.id, ...common })
        } else if (currentNodeType === 'topic') {
          await api.courses.createMaterial({ topic: cur.id, ...common })
        } else {
          setCreateError('Материал можно создать у курса, предмета или темы')
          return
        }
      }
      setCreating(false)
      resetForm()
      setLoading(true)
      const next = searchParams.get('node')
      const nextId = searchParams.get('id')
      let updated
      if (next === 'semester' && nextId) updated = await api.courses.semesterContents(nextId)
      else if (next === 'subject' && nextId) updated = await api.courses.subjectContents(nextId)
      else if (next === 'topic' && nextId) updated = await api.courses.topicContents(nextId)
      else if (next === 'material' && nextId) updated = await api.courses.materialContents(nextId)
      else if (next === 'folder' && nextId) updated = await api.courses.folderContents(nextId)
      else updated = await api.courses.courseContents(id)
      setContents(updated)
      setLoading(false)
    } catch (e) {
      const body = e?.body
      let msg = 'Не удалось создать объект'
      if (body && typeof body === 'object') {
        if (body.non_field_errors?.[0]) msg = body.non_field_errors[0]
        else if (body.title?.[0]) msg = body.title[0]
        else if (body.course?.[0]) msg = body.course[0]
        else if (body.subject?.[0]) msg = body.subject[0]
      }
      setCreateError(msg)
    }
  }
  return (
    <div className="pb-20 space-y-4">
      <div className="w-full max-w-7xl mx-auto px-4 space-y-3">
        <div
          className="rounded-2xl border p-4 flex items-center justify-between gap-3"
          style={{
            background: 'var(--surface-bg)',
            borderColor: 'rgba(38, 100, 121, 0.18)',
            color: 'var(--content-text)'
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`${base}/my-courses`)}
              className="px-4 h-10 rounded-xl border font-bold"
              style={{
                background: 'var(--surface-bg-strong)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
            >
              ←
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">{courseTitle ? `Курс: ${courseTitle}` : 'Курс'}</h1>
              <p className="text-xs truncate" style={{ color: 'var(--content-text-muted)' }}>{nodeTitle || ''}</p>
            </div>
          </div>
          <div
            className="px-3 h-10 rounded-full border text-sm font-semibold flex items-center"
            style={{
              background: 'var(--surface-bg-strong)',
              borderColor: 'rgba(38, 100, 121, 0.18)',
              color: 'var(--content-text)'
            }}
          >
            {items.length} элементов
          </div>
        </div>

        {Array.isArray(contents?.breadcrumbs) && (
          <div
            className="rounded-2xl border p-3 flex items-center gap-2 text-sm overflow-x-auto whitespace-nowrap pr-2"
            style={{
              background: 'var(--surface-bg)',
              borderColor: 'rgba(38, 100, 121, 0.18)'
            }}
          >
            <button
              onClick={() => navigate(`${base}/my-courses`)}
              className="px-3 py-1 rounded-lg border shrink-0"
              style={{
                background: 'var(--surface-bg-strong)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
              title="Курсы"
            >
              <span className="whitespace-nowrap">Курсы</span>
            </button>
            {contents.breadcrumbs
              .filter(b => b?.type !== 'root')
              .map((b, idx) => (
                <React.Fragment key={`${b.type}-${b.id ?? 'root'}-${idx}`}>
                  <span className="shrink-0" style={{ color: 'var(--content-text-muted)' }}>/</span>
                  <button
                    onClick={() => openBreadcrumb(b)}
                    className="px-3 py-1 rounded-lg border shrink-0 max-w-[220px]"
                    style={{
                      background: 'var(--surface-bg-strong)',
                      borderColor: 'rgba(38, 100, 121, 0.18)',
                      color: 'var(--content-text)'
                    }}
                    title={b?.title}
                  >
                    <span className="truncate block">{b?.title}</span>
                  </button>
                </React.Fragment>
              ))}
          </div>
        )}
          {isAdmin && availableCreates.length > 0 && (
            <div
              className="p-4 rounded-2xl border flex items-center gap-3"
              style={{
                background: 'var(--surface-bg)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--content-text-muted)' }}>Создать:</span>
              {availableCreates.map(k => (
                <button
                  key={k}
                  onClick={() => { setCreateKind(k); setCreating(true); resetForm() }}
                  className="px-3 py-1.5 rounded-xl border text-sm font-semibold"
                  style={{
                    background: 'var(--surface-bg-strong)',
                    borderColor: 'rgba(38, 100, 121, 0.18)',
                    color: 'var(--content-text)'
                  }}
                >
                  {k === 'semester' ? 'Семестр' : k === 'subject' ? 'Предмет' : k === 'topic' ? 'Тема' : 'Материал'}
                </button>
              ))}
            </div>
          )}

          {currentNodeType === 'material' && currentMaterialType === 'test' && currentTestId && (
            <div
              className="p-4 rounded-2xl border flex items-center justify-between gap-3"
              style={{
                background: 'var(--surface-bg)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)'
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">Тест</div>
                {testAttempts.limit != null && (
                  <div className="text-xs mt-1" style={{ color: 'var(--content-text-muted)' }}>
                    Попыток осталось: {testAttempts.remaining == null ? '—' : testAttempts.remaining} / {testAttempts.limit}
                  </div>
                )}
                {!!testAttempts.last && (
                  <div className="text-xs mt-1" style={{ color: 'var(--content-text-muted)' }}>
                    Последний результат: {Number(testAttempts.last.score || 0)} / {Number(testAttempts.last.max_score || 0)} · {Number(testAttempts.last.percentage || 0)}%
                  </div>
                )}
              </div>
              <button
                onClick={() => { setActiveTestId(Number(currentTestId)); setTestModalOpen(true) }}
                disabled={testAttempts.limit != null && testAttempts.remaining === 0}
                className="px-4 py-2 rounded-xl text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--btn-primary-bg)' }}
              >
                Пройти
              </button>
            </div>
          )}
      </div>

        {error && (
          <div className="w-full max-w-7xl mx-auto px-4">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100">
              {error}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="w-full max-w-7xl mx-auto px-4" style={{ color: 'var(--content-text-muted)' }}>Загрузка…</div>
        ) : (
          <div className="space-y-4">
          {currentNodeType === 'topic' && (
              <div className="w-full max-w-7xl mx-auto px-4">
                <div className="font-bold text-lg mb-3" style={{ color: 'var(--content-text)' }}>Задания</div>
                {assignmentsError && (
                  <div
                    className="rounded-xl p-3 border text-sm"
                    style={{
                      background: 'rgba(220, 38, 38, 0.08)',
                      borderColor: 'rgba(220, 38, 38, 0.18)',
                      color: '#b91c1c'
                    }}
                  >
                    {assignmentsError}
                  </div>
                )}
                {assignmentsLoading ? (
                  <div style={{ color: 'var(--content-text-muted)' }}>Загрузка…</div>
                ) : assignments.length === 0 ? (
                  <div style={{ color: 'var(--content-text-muted)' }}>Нет заданий</div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a, idx) => {
                      const hasGrade = !!a.grade
                      const submitted = !!a.submission?.submitted_at
                      const status = hasGrade ? 'Оценено' : submitted ? 'Сдано' : 'Не сдано'
                      return (
                        <button
                          key={a.id}
                          onClick={() => setActiveAssignment(a)}
                          className="w-full text-left p-4 rounded-2xl border transition hover:brightness-105 modal-item"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-start gap-3">
                              <div
                                className="w-8 h-8 rounded-xl border flex items-center justify-center text-sm font-bold shrink-0"
                                style={{ background: 'var(--surface-bg-strong)', borderColor: 'rgba(38, 100, 121, 0.18)', color: 'var(--content-text)' }}
                              >
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{a.title}</div>
                                <div className="text-sm mt-1" style={{ color: 'var(--content-text-muted)' }}>{status}</div>
                              </div>
                            </div>
                            {hasGrade && (
                              <div
                                className="shrink-0 px-3 py-1 rounded-full border text-sm font-semibold"
                                style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  borderColor: 'rgba(16, 185, 129, 0.25)',
                                  color: '#059669'
                                }}
                              >
                                {a.grade.value}/{a.max_grade}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {currentNodeType === 'subject' && Array.isArray(items) && items.length > 0 && (
              <div className="w-full max-w-7xl mx-auto px-4">
              <div className="font-bold text-lg" style={{ color: 'var(--content-text)' }}>Темы</div>
              </div>
            )}

          {currentNodeType === 'topic' && Array.isArray(items) && items.length > 0 && (
            <div className="w-full max-w-7xl mx-auto px-4">
              <div className="font-bold text-lg" style={{ color: 'var(--content-text)' }}>Материалы</div>
            </div>
          )}
            {items.map(it => (
              <motion.div
                key={`${it.kind}-${it.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-7xl mx-auto px-4"
                onClick={() => openNode(it.kind, it.id)}
              >
                <div
                  className={`p-5 flex items-center justify-between rounded-2xl border ${it.kind === 'file' ? '' : 'cursor-pointer'}`}
                  style={{
                    background: 'var(--surface-bg)',
                    borderColor: 'rgba(38, 100, 121, 0.18)',
                    color: 'var(--content-text)'
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                      style={{ background: 'var(--surface-bg-strong)', borderColor: 'rgba(38, 100, 121, 0.18)' }}
                    >
                      {iconFor(it.kind)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-lg truncate">{it.title}</div>
                      <div className="text-sm truncate" style={{ color: 'var(--content-text-muted)' }}>{it.subtitle}</div>
                    </div>
                  </div>

                  {it.kind === 'file' ? (
                    <a
                      href={it.file}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 shrink-0"
                      style={{
                        background: 'var(--surface-bg-strong)',
                        borderColor: 'rgba(38, 100, 121, 0.18)',
                        color: 'var(--content-text)'
                      }}
                    >
                      <span>Открыть</span>
                      <ChevronRight size={18} style={{ color: 'var(--content-text-muted)' }} />
                    </a>
                  ) : (
                    <ChevronRight size={18} style={{ color: 'var(--content-text-muted)' }} />
                  )}
                </div>
              </motion.div>
            ))}

            {!items.length && !error && (
              <div className="w-full max-w-7xl mx-auto px-4 text-gray-300">Пусто</div>
            )}
          </div>
        )}
      {creating && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setCreating(false)} />
          <div className="relative w-full max-w-xl p-6 rounded-2xl bg-white/90">
            <div className="text-[#0f2e3a] font-bold text-lg mb-4">
              {createKind === 'semester' ? 'Новый семестр' : createKind === 'subject' ? 'Новый предмет' : createKind === 'topic' ? 'Новая тема' : 'Новый материал'}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#5a7280] mb-1">Название</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-white border border-[#266479]/20 rounded-xl px-3 py-2"
                />
              </div>
              {(createKind === 'subject' || createKind === 'topic' || createKind === 'material') && (
                <div>
                  <label className="block text-xs text-[#5a7280] mb-1">Описание</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-white border border-[#266479]/20 rounded-xl px-3 py-2"
                  />
                </div>
              )}
              {createKind === 'material' && (
                <>
                  <div>
                    <label className="block text-xs text-[#5a7280] mb-1">Тип материала</label>
                    <select
                      value={form.material_type}
                      onChange={(e) => setForm({ ...form, material_type: e.target.value })}
                      className="w-full bg-white border border-[#266479]/20 rounded-xl px-3 py-2"
                    >
                      <option value="lecture">Лекция</option>
                      <option value="presentation">Презентация</option>
                      <option value="document">Документ</option>
                      <option value="test">Тест</option>
                      <option value="other">Другое</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-[#0f2e3a]">
                      <input
                        type="checkbox"
                        checked={form.is_published}
                        onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                      />
                      Опубликовано
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-[#0f2e3a]">
                      <input
                        type="checkbox"
                        checked={form.free_preview}
                        onChange={(e) => setForm({ ...form, free_preview: e.target.checked })}
                      />
                      Превью бесплатно
                    </label>
                  </div>
                </>
              )}
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createError}</div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-xl border border-[#266479]/20 text-[#0f2e3a]" onClick={() => setCreating(false)}>Отмена</button>
              <button className="px-4 py-2 rounded-xl bg-osnova-pink text-white" onClick={submitCreate}>Создать</button>
            </div>
          </div>
        </div>
      )}

      <TestAttemptModal
        open={testModalOpen}
        testId={activeTestId}
        universitySlug={universitySlug || null}
        attemptsLimit={currentTestAttemptsLimit}
        onClose={() => { setTestModalOpen(false); setActiveTestId(null) }}
        onCompleted={() => setTestAttemptsVersion(v => v + 1)}
      />

      <AssignmentModal
        open={!!activeAssignment}
        assignment={activeAssignment}
        universitySlug={universitySlug || null}
        onClose={() => setActiveAssignment(null)}
        onSaved={(assignmentId, data) => {
          setAssignments(prev => (Array.isArray(prev) ? prev : []).map(a => String(a.id) === String(assignmentId) ? { ...a, submission: data?.submission || a.submission, grade: data?.grade ?? a.grade } : a))
        }}
      />
    </div>
  )
}
