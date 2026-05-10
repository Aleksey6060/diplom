import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, BarChart3, Download, X, Loader2, Filter, ArrowLeft, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useTheme } from '../../context/useTheme'
import { useAuth } from '../../context/AuthContext'

export default function AdminStudents() {
  const { contentText } = useTheme()
  const { hasPermission } = useAuth()
  const canViewSingleProgress = hasPermission('students.progress.single.view')
  const canViewGroupProgress = hasPermission('students.progress.group.view')
  const [groups, setGroups] = useState([])
  const [groupCourses, setGroupCourses] = useState([])
  const [semesters, setSemesters] = useState([])
  const [participants, setParticipants] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [progress, setProgress] = useState(null)
  const [perfOpen, setPerfOpen] = useState(false)
  const [bulkPerfOpen, setBulkPerfOpen] = useState(false)
  const [bulkPerfLoading, setBulkPerfLoading] = useState(false)
  const [bulkPerfError, setBulkPerfError] = useState('')
  const [bulkPerfSubjects, setBulkPerfSubjects] = useState([])
  const [bulkPerfRows, setBulkPerfRows] = useState([])
  const [bulkExportLoading, setBulkExportLoading] = useState(false)
  const [bulkViewSubjectId, setBulkViewSubjectId] = useState('all')
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false)
  const subjectFilterRef = useRef(null)
  const [subjectPerfLoading, setSubjectPerfLoading] = useState(false)
  const [subjectPerfError, setSubjectPerfError] = useState('')
  const [subjectPerf, setSubjectPerf] = useState({ subject: null, assignments: [], students: [] })
  const [gradeEdits, setGradeEdits] = useState({})
  const [gradeSaving, setGradeSaving] = useState({})
  const [subjectDetail, setSubjectDetail] = useState({ id: null, title: '', assignments: [], tests: [], loading: false })
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleConflictCell, setScheduleConflictCell] = useState('')
  const [scheduleSemester, setScheduleSemester] = useState(null)
  const [scheduleBindings, setScheduleBindings] = useState([])
  const [scheduleConfig, setScheduleConfig] = useState({ start_time: '09:00', lessons_per_day: 4, lesson_duration_minutes: 90, break_minutes: 10, breaks_minutes: [] })
  const [scheduleCells, setScheduleCells] = useState({})
  const [scheduleMobileWeekday, setScheduleMobileWeekday] = useState(0)
  const [scheduleMobileBindingId, setScheduleMobileBindingId] = useState('')
  const [scheduleMobileTab, setScheduleMobileTab] = useState('grid')
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!scheduleOpen) return
    setScheduleMobileWeekday(0)
    setScheduleMobileBindingId('')
    setScheduleMobileTab('grid')
  }, [scheduleOpen])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const list = await api.users.groups.list()
        if (!cancelled) setGroups(Array.isArray(list) ? list : [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить группы')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!subjectFilterOpen) return
    const onDocClick = (e) => {
      if (subjectFilterOpen && subjectFilterRef.current && !subjectFilterRef.current.contains(e.target)) {
        setSubjectFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [subjectFilterOpen])

  const openGroup = async (g) => {
    setSelectedGroup(g)
    setSelectedCourse(null)
    setSelectedSemester(null)
    setSelectedStudent(null)
    setProgress(null)
    setGroupCourses([])
    setSemesters([])
    setParticipants([])
    setError('')
    setLoading(true)
    try {
      const list = await api.users.groups.courses(g.id)
      setGroupCourses(Array.isArray(list) ? list : [])
    } catch {
      setError('Не удалось загрузить курсы группы')
    } finally {
      setLoading(false)
    }
  }

  const openCourse = async (c) => {
    setSelectedCourse(c)
    setSelectedSemester(null)
    setSelectedStudent(null)
    setProgress(null)
    setSemesters([])
    setParticipants([])
    setError('')
    setLoading(true)
    try {
      const contents = await api.courses.contents(c.id)
      const sems = (contents && contents.children && Array.isArray(contents.children.semesters)) ? contents.children.semesters : []
      setSemesters(sems)
    } catch {
      setError('Не удалось загрузить семестры курса')
    } finally {
      setLoading(false)
    }
  }

  const openSemester = async (s) => {
    setSelectedSemester(s)
    setSelectedStudent(null)
    setProgress(null)
    setParticipants([])
    setBulkPerfOpen(false)
    setBulkPerfLoading(false)
    setBulkPerfError('')
    setBulkPerfSubjects([])
    setBulkPerfRows([])
    setBulkViewSubjectId('all')
    setSubjectFilterOpen(false)
    setSubjectPerfLoading(false)
    setSubjectPerfError('')
    setSubjectPerf({ subject: null, assignments: [], students: [] })
    setGradeEdits({})
    setGradeSaving({})
    setError('')
    setLoading(true)
    try {
      const list = await api.users.groups.participants(selectedGroup.id)
      setParticipants(Array.isArray(list) ? list : [])
    } catch {
      setError('Не удалось загрузить участников группы')
    } finally {
      setLoading(false)
    }
  }

  const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const bindingMap = useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(scheduleBindings) ? scheduleBindings : [])) {
      if (!b || b.id == null) continue
      m.set(Number(b.id), b)
    }
    return m
  }, [scheduleBindings])

  const subjectTitleById = useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(scheduleBindings) ? scheduleBindings : [])) {
      const sid = b?.subject?.id
      const title = b?.subject?.title
      if (sid == null) continue
      if (!m.has(Number(sid))) m.set(Number(sid), String(title || ''))
    }
    return m
  }, [scheduleBindings])

  const teacherNameById = useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(scheduleBindings) ? scheduleBindings : [])) {
      const tid = b?.teacher?.id
      const name = b?.teacher?.display_name
      if (tid == null) continue
      if (!m.has(Number(tid))) m.set(Number(tid), String(name || ''))
    }
    return m
  }, [scheduleBindings])

  const bindingIdByPair = useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(scheduleBindings) ? scheduleBindings : [])) {
      const sid = b?.subject?.id
      const tid = b?.teacher?.id
      const bid = b?.id
      if (sid == null || tid == null || bid == null) continue
      m.set(`${Number(sid)}-${Number(tid)}`, Number(bid))
    }
    return m
  }, [scheduleBindings])

  const toMinutes = (hhmm) => {
    const raw = String(hhmm || '')
    const m = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const h = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null
    if (h < 0 || h > 23) return null
    if (mm < 0 || mm > 59) return null
    return h * 60 + mm
  }

  const formatMinutes = (mins) => {
    const m = Number(mins)
    if (!Number.isFinite(m)) return '—'
    const h = Math.floor(((m % 1440) + 1440) % 1440 / 60)
    const mm = Math.floor(((m % 60) + 60) % 60)
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  const lessonTimeLabel = (lessonNumber) => {
    const startMins = toMinutes(scheduleConfig?.start_time)
    const dur = Number(scheduleConfig?.lesson_duration_minutes || 0)
    const br = Number(scheduleConfig?.break_minutes || 0)
    if (startMins == null || !Number.isFinite(dur) || !Number.isFinite(br)) return `Пара ${lessonNumber}`
    const breaks = Array.isArray(scheduleConfig?.breaks_minutes) ? scheduleConfig.breaks_minutes : []
    let breaksSum = 0
    for (let i = 0; i < lessonNumber - 1; i += 1) {
      const val = breaks?.[i]
      breaksSum += Number.isFinite(Number(val)) ? Number(val) : br
    }
    const offset = (lessonNumber - 1) * dur + breaksSum
    const a = startMins + offset
    const b = a + dur
    return `${lessonNumber}. ${formatMinutes(a)}–${formatMinutes(b)}`
  }

  const useCustomBreaks = Array.isArray(scheduleConfig?.breaks_minutes) && scheduleConfig.breaks_minutes.length > 0

  const openScheduleBuilder = async (s) => {
    if (!selectedGroup || !selectedCourse || !s) return
    setScheduleSemester(s)
    setScheduleOpen(true)
    setScheduleLoading(true)
    setScheduleError('')
    setScheduleConflictCell('')
    setScheduleBindings([])
    setScheduleConfig({ start_time: '09:00', lessons_per_day: 4, lesson_duration_minutes: 90, break_minutes: 10, breaks_minutes: [] })
    setScheduleCells({})
    try {
      const data = await api.users.groups.schedule.get(selectedGroup.id, selectedCourse.id, s.id)
      const conf = data?.config || {}
      setScheduleConfig({
        start_time: conf?.start_time || '09:00',
        lessons_per_day: Number(conf?.lessons_per_day || 4),
        lesson_duration_minutes: Number(conf?.lesson_duration_minutes || 90),
        break_minutes: Number(conf?.break_minutes || 10),
        breaks_minutes: Array.isArray(conf?.breaks_minutes) ? conf.breaks_minutes.map(n => Number(n || 0)) : [],
      })
      const bindings = Array.isArray(data?.bindings) ? data.bindings : []
      const bindingIdByPairLocal = new Map()
      for (const b of bindings) {
        const sid = b?.subject?.id
        const tid = b?.teacher?.id
        const bid = b?.id
        if (sid == null || tid == null || bid == null) continue
        bindingIdByPairLocal.set(`${Number(sid)}-${Number(tid)}`, Number(bid))
      }
      setScheduleBindings(bindings)
      const cells = {}
      for (const e of (Array.isArray(data?.entries) ? data.entries : [])) {
        const w = e?.weekday
        const l = e?.lesson
        const sid = e?.subject?.id
        const tid = e?.teacher?.id
        if (w == null || l == null || sid == null) continue
        const subjectId = Number(sid)
        const teacherId = tid == null ? null : Number(tid)
        const bindingId = teacherId == null ? null : (bindingIdByPairLocal.get(`${subjectId}-${teacherId}`) ?? null)
        cells[`${Number(w)}-${Number(l)}`] = { subjectId, teacherId, bindingId }
      }
      setScheduleCells(cells)
    } catch (e) {
      setScheduleError('Не удалось загрузить расписание')
    } finally {
      setScheduleLoading(false)
    }
  }

  const setConfigField = (key, value) => {
    setScheduleConfig(prev => {
      const next = { ...(prev || {}) }
      next[key] = value
      if (key === 'lessons_per_day') {
        const maxLessons = Number(value)
        const maxLen = Math.max(0, (Number.isFinite(maxLessons) ? maxLessons : 0) - 1)
        const prevBreaks = Array.isArray(next.breaks_minutes) ? next.breaks_minutes : []
        if (prevBreaks.length > 0) {
          const base = Number(next.break_minutes || 0)
          const arr = prevBreaks.slice(0, maxLen)
          while (arr.length < maxLen) arr.push(base)
          next.breaks_minutes = arr
        } else {
          next.breaks_minutes = []
        }
      }
      return next
    })
    if (key === 'lessons_per_day') {
      const max = Number(value)
      if (Number.isFinite(max)) {
        setScheduleCells(prev => {
          const next = { ...(prev || {}) }
          for (const k of Object.keys(next)) {
            const parts = k.split('-')
            const lesson = Number(parts[1])
            if (lesson > max) delete next[k]
          }
          return next
        })
      }
    }
  }

  const onDragStartBinding = (e, binding) => {
    try {
      e.dataTransfer.setData('application/osnova-binding', String(binding?.id ?? ''))
      e.dataTransfer.setData('application/osnova-subject', String(binding?.subject?.id ?? ''))
      e.dataTransfer.setData('application/osnova-teacher', String(binding?.teacher?.id ?? ''))
      e.dataTransfer.setData('application/osnova-from', 'subject')
    } catch {}
  }

  const onDragStartCell = (e, cellKey) => {
    try {
      const cell = (scheduleCells || {})[cellKey]
      e.dataTransfer.setData('application/osnova-binding', String(cell?.bindingId ?? ''))
      e.dataTransfer.setData('application/osnova-subject', String(cell?.subjectId ?? ''))
      e.dataTransfer.setData('application/osnova-teacher', String(cell?.teacherId ?? ''))
      e.dataTransfer.setData('application/osnova-from', 'cell')
      e.dataTransfer.setData('application/osnova-cell', String(cellKey))
    } catch {}
  }

  const putToCell = ({ cellKey, subjectId, teacherId, bindingId, fromCell = null }) => {
    const sid = subjectId == null ? null : Number(subjectId)
    const tid = teacherId == null ? null : Number(teacherId)
    const bid = bindingId == null ? null : Number(bindingId)
    if (!Number.isFinite(sid)) return
    setScheduleCells(prev => {
      const next = { ...(prev || {}) }
      if (fromCell && fromCell !== cellKey) delete next[fromCell]
      const resolvedTeacherId = Number.isFinite(tid) ? tid : null
      const resolvedBindingId = Number.isFinite(bid)
        ? bid
        : (resolvedTeacherId == null ? null : (bindingIdByPair.get(`${sid}-${resolvedTeacherId}`) ?? null))
      next[cellKey] = { subjectId: sid, teacherId: resolvedTeacherId, bindingId: resolvedBindingId }
      return next
    })
    setScheduleConflictCell('')
  }

  const onDropToCell = (e, cellKey) => {
    e.preventDefault()
    let sid = null
    let tid = null
    let bid = null
    let from = null
    let fromCell = null
    try {
      bid = e.dataTransfer.getData('application/osnova-binding')
      sid = e.dataTransfer.getData('application/osnova-subject')
      tid = e.dataTransfer.getData('application/osnova-teacher')
      from = e.dataTransfer.getData('application/osnova-from')
      fromCell = e.dataTransfer.getData('application/osnova-cell')
    } catch {}
    const subjectId = sid == null || sid === '' ? null : Number(sid)
    const teacherId = tid == null || tid === '' ? null : Number(tid)
    const bindingId = bid == null || bid === '' ? null : Number(bid)
    if (!Number.isFinite(subjectId)) return
    putToCell({
      cellKey,
      subjectId,
      teacherId,
      bindingId,
      fromCell: (from === 'cell' ? fromCell : null),
    })
  }

  const clearCell = (cellKey) => {
    setScheduleCells(prev => {
      const next = { ...(prev || {}) }
      delete next[cellKey]
      return next
    })
    setScheduleConflictCell('')
  }

  const removeScheduleBinding = async (bindingId) => {
    if (!selectedGroup || !selectedCourse) return
    const ok = window.confirm('Удалить связку преподаватель + предмет? Запись также будет удалена из расписания.')
    if (!ok) return
    setScheduleLoading(true)
    setScheduleError('')
    try {
      await api.users.groups.teacherAttachments.remove(selectedGroup.id, selectedCourse.id, bindingId)
      setScheduleBindings(prev => (Array.isArray(prev) ? prev.filter(b => String(b.id) !== String(bindingId)) : []))
      setScheduleCells(prev => {
        const next = { ...(prev || {}) }
        for (const [key, cell] of Object.entries(next)) {
          if (String(cell?.bindingId ?? '') === String(bindingId)) delete next[key]
        }
        return next
      })
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось удалить привязку'
      setScheduleError(String(msg))
    } finally {
      setScheduleLoading(false)
    }
  }

  const saveSchedule = async () => {
    if (!selectedGroup || !selectedCourse || !scheduleSemester) return
    setScheduleLoading(true)
    setScheduleError('')
    try {
      const entries = []
      for (const [cellKey, cell] of Object.entries(scheduleCells || {})) {
        const [w, l] = String(cellKey).split('-')
        const weekday = Number(w)
        const lesson = Number(l)
        const subjectId = cell?.subjectId
        const teacherId = cell?.teacherId
        if (!Number.isFinite(weekday) || !Number.isFinite(lesson) || !Number.isFinite(Number(subjectId))) continue
        entries.push({ weekday, lesson, subject: Number(subjectId), teacher: (Number.isFinite(Number(teacherId)) ? Number(teacherId) : null) })
      }
      const payload = {
        start_time: scheduleConfig?.start_time || '09:00',
        lessons_per_day: Number(scheduleConfig?.lessons_per_day || 4),
        lesson_duration_minutes: Number(scheduleConfig?.lesson_duration_minutes || 90),
        break_minutes: Number(scheduleConfig?.break_minutes || 10),
        breaks_minutes: useCustomBreaks ? (Array.isArray(scheduleConfig?.breaks_minutes) ? scheduleConfig.breaks_minutes : []) : [],
        entries,
      }
      await api.users.groups.schedule.save(selectedGroup.id, selectedCourse.id, scheduleSemester.id, payload)
      setScheduleOpen(false)
    } catch (e) {
      const conflict = e?.body?.conflict
      const weekday = conflict && conflict.weekday != null ? Number(conflict.weekday) : null
      const lesson = conflict && conflict.lesson != null ? Number(conflict.lesson) : null
      if (Number.isFinite(weekday) && Number.isFinite(lesson)) {
        setScheduleConflictCell(`${weekday}-${lesson}`)
        const t = String(contentText?.scheduleConflictErrorText || '').trim()
        setScheduleError(t || String(e?.body?.detail || 'Преподаватель занят в это время.'))
      } else {
        const msg = e?.body?.detail || e?.body?.entries || 'Не удалось сохранить расписание'
        setScheduleError(Array.isArray(msg) ? String(msg[0]) : String(msg))
      }
    } finally {
      setScheduleLoading(false)
    }
  }

  const openStudent = async (s) => {
    if (!canViewSingleProgress) return
    setSelectedStudent(s)
    setProgress(null)
    setError('')
    setLoading(true)
    try {
      const data = await api.courses.progress.studentCourse({
        groupId: selectedGroup.id,
        courseId: selectedCourse.id,
        studentId: s.id,
        semesterId: selectedSemester?.id || null,
      })
      setProgress(data)
      setPerfOpen(true)
    } catch {
      setError('Не удалось загрузить статистику')
    } finally {
      setLoading(false)
    }
  }

  const openBulkPerformance = async () => {
    if (!canViewGroupProgress) return
    if (!selectedGroup || !selectedCourse || !selectedSemester) return
    setBulkPerfOpen(true)
    setBulkPerfLoading(true)
    setBulkPerfError('')
    setBulkPerfSubjects([])
    setBulkPerfRows([])
    setBulkViewSubjectId('all')
    setSubjectFilterOpen(false)
    setSubjectPerfLoading(false)
    setSubjectPerfError('')
    setSubjectPerf({ subject: null, assignments: [], students: [] })
    setGradeEdits({})
    setGradeSaving({})
    try {
      const list = Array.isArray(participants) ? participants : []
      if (list.length === 0) {
        setBulkPerfLoading(false)
        return
      }

      const results = await Promise.all(
        list.map(async (s) => {
          try {
            const data = await api.courses.progress.studentCourse({
              groupId: selectedGroup.id,
              courseId: selectedCourse.id,
              studentId: s.id,
              semesterId: selectedSemester.id,
            })
            return { student: s, data }
          } catch {
            return { student: s, data: null }
          }
        })
      )

      const subjectOrder = []
      const subjectMap = new Map()
      const rows = results.map(({ student, data }) => {
        const subjects = Array.isArray(data?.subjects) ? data.subjects : []
        for (const sub of subjects) {
          if (!sub || sub.id == null) continue
          if (!subjectMap.has(sub.id)) {
            subjectMap.set(sub.id, { id: sub.id, title: sub.title || String(sub.id) })
            subjectOrder.push(sub.id)
          }
        }
        const subjectGrades = {}
        for (const sub of subjects) {
          if (!sub || sub.id == null) continue
          subjectGrades[String(sub.id)] = sub.avg_grade == null ? null : Number(sub.avg_grade)
        }
        return {
          student,
          overallAvg: data?.overall?.avg_grade == null ? null : Number(data.overall.avg_grade),
          subjectGrades,
        }
      })

      setBulkPerfSubjects(subjectOrder.map(id => subjectMap.get(id)).filter(Boolean))
      setBulkPerfRows(rows)
    } catch {
      setBulkPerfError('Не удалось загрузить успеваемость')
    } finally {
      setBulkPerfLoading(false)
    }
  }

  const loadSubjectPerformance = async (subjectId) => {
    if (!selectedGroup || !selectedSemester) return
    const sid = String(subjectId)
    if (!sid || sid === 'all') return
    setSubjectPerfLoading(true)
    setSubjectPerfError('')
    setSubjectPerf({ subject: null, assignments: [], students: [] })
    setGradeEdits({})
    setGradeSaving({})
    try {
      const data = await api.courses.grades.groupSubject({
        groupId: selectedGroup.id,
        subjectId: sid,
      })
      setSubjectPerf({
        subject: data?.subject || null,
        assignments: Array.isArray(data?.assignments) ? data.assignments : [],
        students: Array.isArray(data?.students) ? data.students : [],
      })
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось загрузить оценки по предмету'
      setSubjectPerfError(String(msg))
    } finally {
      setSubjectPerfLoading(false)
    }
  }

  const commitGrade = async ({ studentId, assignmentId, valueRaw, currentValue = null }) => {
    const key = `${studentId}-${assignmentId}`
    if (gradeSaving[key]) return
    const trimmed = String(valueRaw ?? '').trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && !Number.isFinite(value)) return
    const normalizedCurrent = currentValue == null ? null : Number(currentValue)
    if ((value == null && normalizedCurrent == null) || (value != null && normalizedCurrent != null && value === normalizedCurrent)) {
      setGradeEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    setGradeSaving(prev => ({ ...prev, [key]: true }))
    try {
      if (normalizedCurrent == null) {
        await api.courses.grades.set({ assignment: Number(assignmentId), student: Number(studentId), value, comment: '' })
      } else {
        await api.courses.grades.update({ assignment: Number(assignmentId), student: Number(studentId), value, comment: '' })
      }
      setSubjectPerf(prev => {
        const students = Array.isArray(prev.students) ? prev.students : []
        const nextStudents = students.map(s => {
          if (String(s.student_id) !== String(studentId)) return s
          const grades = (s && typeof s.grades === 'object' && s.grades) ? { ...s.grades } : {}
          grades[String(assignmentId)] = value == null ? null : { value, comment: '' }
          return { ...s, grades }
        })
        return { ...prev, students: nextStudents }
      })
      setGradeEdits(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })

      const sid = Number(studentId)
      if ((bulkPerfOpen || perfOpen) && selectedGroup?.id && selectedCourse?.id) {
        void (async () => {
          try {
            const data = await api.courses.progress.studentCourse({
              groupId: selectedGroup.id,
              courseId: selectedCourse.id,
              studentId: sid,
              semesterId: selectedSemester?.id || null,
            })
            const subjects = Array.isArray(data?.subjects) ? data.subjects : []
            const subjectGrades = {}
            for (const sub of subjects) {
              if (!sub || sub.id == null) continue
              subjectGrades[String(sub.id)] = sub.avg_grade == null ? null : Number(sub.avg_grade)
            }
            const overallAvg = data?.overall?.avg_grade == null ? null : Number(data.overall.avg_grade)

            if (bulkPerfOpen) {
              setBulkPerfRows(prev => {
                const rows = Array.isArray(prev) ? prev : []
                return rows.map(r => {
                  if (String(r?.student?.id) !== String(sid)) return r
                  return { ...r, overallAvg, subjectGrades }
                })
              })
            }
            if (perfOpen && String(selectedStudent?.id) === String(sid)) {
              setProgress(data)
            }
          } catch {
          }
        })()
      }
    } catch (e) {
      const msg = e?.body?.value || e?.body?.detail || 'Не удалось сохранить оценку'
      setSubjectPerfError(Array.isArray(msg) ? msg[0] : String(msg))
    } finally {
      setGradeSaving(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const exportBulkPerformance = async () => {
    if (bulkExportLoading) return
    setBulkExportLoading(true)
    try {
      if (bulkViewSubjectId !== 'all') {
        const { blob, filename } = await api.courses.grades.exportGroupSubject({
          groupId: selectedGroup.id,
          subjectId: bulkViewSubjectId,
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `оценки_${selectedGroup?.name || 'group'}_${bulkViewSubjectId}.xlsx`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        return
      }
      const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
      if (!XLSX) return
      const subjects = Array.isArray(bulkPerfSubjects) ? bulkPerfSubjects : []
      const header = ['Ученик', 'Email', 'Средний балл', ...subjects.map(s => s.title)]
      const data = (Array.isArray(bulkPerfRows) ? bulkPerfRows : []).map(r => {
        const name = r?.student?.display_name || `${r?.student?.last_name || ''} ${r?.student?.first_name || ''}`.trim() || r?.student?.email || String(r?.student?.id || '')
        const email = r?.student?.email || ''
        const overall = r?.overallAvg == null ? '' : Number(r.overallAvg).toFixed(2)
        const cells = subjects.map(s => {
          const v = r?.subjectGrades?.[String(s.id)]
          return v == null ? '' : Number(v).toFixed(2)
        })
        return [name, email, overall, ...cells]
      })
      const ws = XLSX.utils.aoa_to_sheet([header, ...data])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Успеваемость')
      const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const groupName = selectedGroup?.name ? String(selectedGroup.name) : 'group'
      const courseTitle = selectedCourse?.title ? String(selectedCourse.title) : 'course'
      const semTitle = selectedSemester?.title ? String(selectedSemester.title) : 'semester'
      a.download = `успеваемость_${groupName}_${courseTitle}_${semTitle}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBulkExportLoading(false)
    }
  }

  const breadcrumb = useMemo(() => {
    const parts = ['Группы']
    if (selectedGroup) parts.push(selectedGroup.name)
    if (selectedCourse) parts.push(selectedCourse.title)
    if (selectedSemester) parts.push(selectedSemester.title)
    if (selectedStudent) parts.push(selectedStudent.display_name || selectedStudent.email || String(selectedStudent.id))
    return parts.join(' / ')
  }, [selectedGroup, selectedCourse, selectedSemester, selectedStudent])

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#0f2e3a]">Учащиеся</h2>
          <div className="text-sm text-[#5a7280]">{breadcrumb}</div>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {!selectedStudent && selectedGroup && selectedCourse && selectedSemester && canViewGroupProgress && (
            <button
              onClick={openBulkPerformance}
              className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              <BarChart3 size={16} />
              <span className="whitespace-nowrap">Успеваемость</span>
            </button>
          )}
          {selectedStudent && (
            <button
              onClick={() => { setSelectedStudent(null); setProgress(null) }}
              className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span className="whitespace-nowrap">Назад к участникам</span>
            </button>
          )}
          {!selectedStudent && selectedCourse && (
            <button
              onClick={() => {
                setSelectedCourse(null)
                setSelectedSemester(null)
                setSelectedStudent(null)
                setProgress(null)
                setSemesters([])
                setParticipants([])
                setBulkPerfOpen(false)
                setBulkPerfLoading(false)
                setBulkPerfError('')
                setBulkPerfSubjects([])
                setBulkPerfRows([])
                setBulkViewSubjectId('all')
                setSubjectFilterOpen(false)
                setSubjectPerfLoading(false)
                setSubjectPerfError('')
                setSubjectPerf({ subject: null, assignments: [], students: [] })
                setGradeEdits({})
                setGradeSaving({})
              }}
              className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span className="whitespace-nowrap">Назад к курсам</span>
            </button>
          )}
          {!selectedStudent && !selectedCourse && selectedGroup && (
            <button
              onClick={() => {
                setSelectedGroup(null)
                setSelectedCourse(null)
                setSelectedSemester(null)
                setSelectedStudent(null)
                setProgress(null)
                setGroupCourses([])
                setSemesters([])
                setParticipants([])
                setBulkPerfOpen(false)
                setBulkPerfLoading(false)
                setBulkPerfError('')
                setBulkPerfSubjects([])
                setBulkPerfRows([])
                setBulkViewSubjectId('all')
                setSubjectFilterOpen(false)
                setSubjectPerfLoading(false)
                setSubjectPerfError('')
                setSubjectPerf({ subject: null, assignments: [], students: [] })
                setGradeEdits({})
                setGradeSaving({})
              }}
              className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span className="whitespace-nowrap">Назад к группам</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-white/80">Загрузка…</div>
      )}

      {!isLoading && !selectedGroup && (
        <div className="grid grid-cols-1 gap-3">
          {groups.map(g => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="admin-card rounded-2xl p-4 flex items-center justify-between cursor-pointer"
              onClick={() => openGroup(g)}
            >
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{g.name}</div>
                <div className="text-[#266479] text-sm">{Number(g.count_participants || 0)} чел.</div>
              </div>
              <ChevronDown className="text-[#5a7280] -rotate-90 shrink-0" size={18} />
            </motion.div>
          ))}
          {groups.length === 0 && (
            <div className="text-gray-400 text-sm">Группы не найдены</div>
          )}
        </div>
      )}

      {!isLoading && selectedGroup && !selectedCourse && (
        <div className="grid grid-cols-1 gap-3">
          {groupCourses.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="admin-card rounded-2xl p-4 flex items-center justify-between cursor-pointer"
              onClick={() => openCourse(c)}
            >
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{c.title}</div>
                <div className="text-[#266479] text-sm">{c.course_type_display || c.course_type}</div>
              </div>
              <ChevronDown className="text-[#5a7280] -rotate-90 shrink-0" size={18} />
            </motion.div>
          ))}
          {groupCourses.length === 0 && (
            <div className="text-gray-400 text-sm">Курсы к группе не привязаны</div>
          )}
        </div>
      )}

      {!isLoading && selectedGroup && selectedCourse && !selectedSemester && (
        <div className="grid grid-cols-1 gap-3">
          {semesters.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="admin-card rounded-2xl p-4 flex items-center justify-between cursor-pointer"
              onClick={() => openSemester(s)}
            >
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{s.title}</div>
                <div className="text-[#266479] text-sm">Семестр</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openScheduleBuilder(s) }}
                  className="px-3 h-9 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/20 transition text-sm"
                >
                  Создать расписание
                </button>
                <ChevronDown className="text-[#5a7280] -rotate-90" size={18} />
              </div>
            </motion.div>
          ))}
          {semesters.length === 0 && (
            <div className="text-gray-400 text-sm">В курсе нет семестров</div>
          )}
        </div>
      )}

      {!isLoading && selectedGroup && selectedCourse && selectedSemester && !selectedStudent && (
        <div className="grid grid-cols-1 gap-3">
          {participants.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`admin-card rounded-2xl p-4 flex items-center justify-between ${canViewSingleProgress ? 'cursor-pointer' : ''}`}
              onClick={canViewSingleProgress ? () => openStudent(p) : undefined}
            >
              <div className="min-w-0">
                <div className="text-white font-medium truncate">{p.display_name || `${p.last_name || ''} ${p.first_name || ''}`.trim() || p.email}</div>
                <div className="text-[#266479] text-sm truncate">{p.email || ''}</div>
              </div>
              {canViewSingleProgress && <ChevronDown className="text-[#5a7280] -rotate-90 shrink-0" size={18} />}
            </motion.div>
          ))}
          {participants.length === 0 && (
            <div className="text-gray-400 text-sm">Участников нет</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {perfOpen && selectedStudent && progress && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setPerfOpen(false); setSelectedStudent(null); setProgress(null) }}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              className="relative w-full max-w-3xl modal-panel rounded-3xl p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="font-semibold mb-2 text-white">
                {selectedStudent.display_name || selectedStudent.email || String(selectedStudent.id)}
              </div>
              <div className="text-sm text-[#5a7280] mb-4">
                Курс: {selectedCourse?.title} • Семестр: {selectedSemester?.title}
              </div>
              <div className="admin-card rounded-2xl p-4 mb-4">
                <div className="text-[#266479] text-sm">
                  Средний балл: {progress?.overall?.avg_grade == null ? '—' : Number(progress.overall.avg_grade).toFixed(2)} • Оценок: {progress?.overall?.graded_count || 0}/{progress?.overall?.assignments_total || 0}
                </div>
              </div>
              <div className="admin-card rounded-2xl overflow-hidden">
                <div className="p-4 text-white font-medium">Успеваемость по предметам</div>
                <div className="divide-y divide-white/10 max-h-[60vh] overflow-auto">
                  {(Array.isArray(progress.subjects) ? progress.subjects : []).map(s => (
                    <button
                      key={s.id}
                      onClick={async () => {
                        setSubjectDetail({ id: s.id, title: s.title, assignments: [], tests: [], loading: true })
                        setSubjectModalOpen(true)
                        try {
                          const [asgs, tests] = await Promise.all([
                            api.courses.assignments.list(s.id),
                            api.courses.tests.bySubject(s.id),
                          ])
                          setSubjectDetail({ id: s.id, title: s.title, assignments: Array.isArray(asgs) ? asgs : [], tests: Array.isArray(tests) ? tests : [], loading: false })
                        } catch {
                          setSubjectDetail({ id: s.id, title: s.title, assignments: [], tests: [], loading: false })
                        }
                      }}
                      className="modal-item w-full text-left p-4 flex items-center justify-between rounded-lg"
                    >
                      <div className="text-white">{s.title}</div>
                      <div className="text-[#266479] text-sm">
                        {s.avg_grade == null ? '—' : Number(s.avg_grade).toFixed(2)} • {s.graded_count}/{s.assignments_total}
                      </div>
                    </button>
                  ))}
                  {(!progress.subjects || progress.subjects.length === 0) && (
                    <div className="p-4 text-gray-400 text-sm">В курсе нет предметов</div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => { setPerfOpen(false); setSelectedStudent(null); setProgress(null) }}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkPerfOpen && selectedSemester && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setBulkPerfOpen(false) }}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              className="relative w-[96vw] max-w-7xl modal-panel rounded-3xl p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setBulkPerfOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-xl border transition flex items-center justify-center leading-none"
                style={{
                  background: 'var(--surface-bg-strong)',
                  borderColor: 'rgba(38, 100, 121, 0.18)',
                  color: 'var(--content-text)',
                }}
              >
                <X size={18} />
              </button>
              <div className="font-semibold text-white mb-1">Успеваемость</div>
              <div className="text-sm text-[#5a7280] mb-4">
                Группа: {selectedGroup?.name} • Курс: {selectedCourse?.title} • Семестр: {selectedSemester?.title}
              </div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="relative" ref={subjectFilterRef}>
                  <button
                    type="button"
                    onClick={() => setSubjectFilterOpen(o => !o)}
                    className="px-3 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center gap-2"
                  >
                    <Filter size={16} className="text-white/70" />
                    <span className="text-sm">
                      {bulkViewSubjectId === 'all'
                        ? 'Все предметы'
                        : (bulkPerfSubjects.find(s => String(s.id) === String(bulkViewSubjectId))?.title || 'Выбрать предмет')}
                    </span>
                  </button>
                  {subjectFilterOpen && (
                    <div className="absolute mt-2 w-72 rounded-xl border border-white/20 bg-white/10 backdrop-blur shadow-xl p-2 flex flex-col gap-1 z-10">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkViewSubjectId('all')
                          setSubjectPerfError('')
                          setSubjectPerf({ subject: null, assignments: [], students: [] })
                          setGradeEdits({})
                          setGradeSaving({})
                          setSubjectFilterOpen(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-sm rounded-lg ${bulkViewSubjectId === 'all' ? 'bg-black/20 text-white' : 'text-white hover:bg-black/10'}`}
                      >
                        Все предметы
                      </button>
                      {(Array.isArray(bulkPerfSubjects) ? bulkPerfSubjects : []).map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const v = String(s.id)
                            setBulkViewSubjectId(v)
                            setSubjectPerfError('')
                            setSubjectFilterOpen(false)
                            loadSubjectPerformance(v)
                          }}
                          className={`w-full text-left px-4 py-3 text-sm rounded-lg ${String(bulkViewSubjectId) === String(s.id) ? 'bg-black/20 text-white' : 'text-white hover:bg-black/10'}`}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={exportBulkPerformance}
                  disabled={(bulkViewSubjectId === 'all' ? bulkPerfLoading : subjectPerfLoading) || bulkExportLoading || (bulkViewSubjectId === 'all' ? (bulkPerfRows || []).length === 0 : (subjectPerf?.students || []).length === 0)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 flex items-center gap-2 disabled:opacity-50"
                >
                  {bulkExportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  <span>Импортировать оценки</span>
                </button>
              </div>

              {(bulkViewSubjectId === 'all' ? bulkPerfError : subjectPerfError) && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100 mb-4">
                  {bulkViewSubjectId === 'all' ? bulkPerfError : subjectPerfError}
                </div>
              )}

              {(bulkViewSubjectId === 'all' ? bulkPerfLoading : subjectPerfLoading) ? (
                <div className="flex items-center gap-3 text-white/80 py-10 justify-center">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Загрузка…</span>
                </div>
              ) : (
                <div className="admin-card rounded-2xl overflow-hidden">
                  <div className="overflow-auto max-h-[70vh]">
                    {bulkViewSubjectId === 'all' ? (
                      <>
                        <div className="sm:hidden p-4 space-y-3">
                          {(Array.isArray(bulkPerfRows) ? bulkPerfRows : []).map(r => {
                            const name = r?.student?.display_name || `${r?.student?.last_name || ''} ${r?.student?.first_name || ''}`.trim() || r?.student?.email || String(r?.student?.id || '')
                            const overall = r?.overallAvg == null ? '—' : Number(r.overallAvg).toFixed(2)
                            return (
                              <div key={r?.student?.id || name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="text-white font-semibold break-words">{name}</div>
                                <div className="mt-1 text-sm text-white/70">
                                  Средний балл: <span className="text-[#266479] font-semibold">{overall}</span>
                                </div>
                                <div className="mt-3 flex gap-2 overflow-auto -mx-1 px-1 pb-1">
                                  {(Array.isArray(bulkPerfSubjects) ? bulkPerfSubjects : []).map(s => {
                                    const v = r?.subjectGrades?.[String(s.id)]
                                    return (
                                      <div key={`${r?.student?.id}-${s.id}`} className="min-w-[160px] rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                                        <div className="text-white/70 text-xs break-words">{s.title}</div>
                                        <div className="mt-0.5 text-[#266479] font-semibold">{v == null ? '—' : Number(v).toFixed(2)}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                          {(!bulkPerfRows || bulkPerfRows.length === 0) && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                              Нет данных
                            </div>
                          )}
                        </div>

                        <div className="hidden sm:block">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0">
                              <tr className="bg-black/30">
                                <th className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">Ученик</th>
                                <th className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">Средний балл</th>
                                {(Array.isArray(bulkPerfSubjects) ? bulkPerfSubjects : []).map(s => (
                                  <th key={s.id} className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">{s.title}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {(Array.isArray(bulkPerfRows) ? bulkPerfRows : []).map(r => {
                                const name = r?.student?.display_name || `${r?.student?.last_name || ''} ${r?.student?.first_name || ''}`.trim() || r?.student?.email || String(r?.student?.id || '')
                                return (
                                  <tr key={r?.student?.id || name}>
                                    <td className="px-4 py-3 text-white whitespace-nowrap">{name}</td>
                                    <td className="px-4 py-3 text-[#266479] whitespace-nowrap">{r?.overallAvg == null ? '—' : Number(r.overallAvg).toFixed(2)}</td>
                                    {(Array.isArray(bulkPerfSubjects) ? bulkPerfSubjects : []).map(s => {
                                      const v = r?.subjectGrades?.[String(s.id)]
                                      return (
                                        <td key={`${r?.student?.id}-${s.id}`} className="px-4 py-3 text-[#266479] whitespace-nowrap">
                                          {v == null ? '—' : Number(v).toFixed(2)}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                              {(!bulkPerfRows || bulkPerfRows.length === 0) && (
                                <tr>
                                  <td className="px-4 py-6 text-gray-400" colSpan={2 + (bulkPerfSubjects?.length || 0)}>Нет данных</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="sm:hidden p-4 space-y-4">
                          {(Array.isArray(subjectPerf?.students) ? subjectPerf.students : []).map(s => {
                            const grades = (s && typeof s.grades === 'object' && s.grades) ? s.grades : {}
                            const values = (Array.isArray(subjectPerf?.assignments) ? subjectPerf.assignments : [])
                              .map(a => grades?.[String(a.id)]?.value)
                              .filter(v => v != null)
                              .map(v => Number(v))
                              .filter(v => Number.isFinite(v))
                            const avg = values.length ? (values.reduce((acc, v) => acc + v, 0) / values.length) : null
                            return (
                              <div key={s.student_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="text-white font-semibold break-words">{s.student_display_name || String(s.student_id)}</div>
                                <div className="mt-1 text-sm text-white/70">
                                  Средний балл: <span className="text-[#266479] font-semibold">{avg == null ? '—' : avg.toFixed(2)}</span>
                                </div>
                                <div className="mt-4 space-y-3">
                                  {(Array.isArray(subjectPerf?.assignments) ? subjectPerf.assignments : []).map(a => {
                                    const key = `${s.student_id}-${a.id}`
                                    const draft = gradeEdits[key]
                                    const current = grades?.[String(a.id)]?.value
                                    const val = draft != null ? draft : (current == null ? '' : String(current))
                                    return (
                                      <div key={key} className="flex flex-col gap-2">
                                        <div className="text-white/80 text-sm break-words">{a.title}</div>
                                        <div className="flex items-center gap-2 justify-end">
                                          <input
                                            type="number"
                                            min={0}
                                            max={a.max_grade != null ? Number(a.max_grade) : undefined}
                                            step={1}
                                            value={val}
                                            onChange={(e) => setGradeEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault()
                                                commitGrade({ studentId: s.student_id, assignmentId: a.id, valueRaw: e.currentTarget.value, currentValue: current })
                                              }
                                            }}
                                            onBlur={(e) => commitGrade({ studentId: s.student_id, assignmentId: a.id, valueRaw: e.currentTarget.value, currentValue: current })}
                                            className="w-28 px-2 py-2 rounded-xl border text-sm"
                                            style={{
                                              background: 'var(--surface-bg-strong)',
                                              borderColor: 'rgba(38, 100, 121, 0.18)',
                                              color: 'var(--content-text)',
                                            }}
                                          />
                                          {gradeSaving[key] && <Loader2 size={14} className="animate-spin text-white/70" />}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                          {(!subjectPerf?.students || subjectPerf.students.length === 0) && (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                              Нет данных
                            </div>
                          )}
                        </div>

                        <div className="hidden sm:block">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0">
                              <tr className="bg-black/30">
                                <th className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">Ученик</th>
                                <th className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">Средний балл</th>
                                {(Array.isArray(subjectPerf?.assignments) ? subjectPerf.assignments : []).map(a => (
                                  <th key={a.id} className="text-left px-4 py-3 text-white font-semibold whitespace-nowrap">{a.title}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {(Array.isArray(subjectPerf?.students) ? subjectPerf.students : []).map(s => {
                                const grades = (s && typeof s.grades === 'object' && s.grades) ? s.grades : {}
                                const values = (Array.isArray(subjectPerf?.assignments) ? subjectPerf.assignments : [])
                                  .map(a => grades?.[String(a.id)]?.value)
                                  .filter(v => v != null)
                                  .map(v => Number(v))
                                  .filter(v => Number.isFinite(v))
                                const avg = values.length ? (values.reduce((acc, v) => acc + v, 0) / values.length) : null
                                return (
                                  <tr key={s.student_id}>
                                    <td className="px-4 py-3 text-white whitespace-nowrap">{s.student_display_name || String(s.student_id)}</td>
                                    <td className="px-4 py-3 text-[#266479] whitespace-nowrap">{avg == null ? '—' : avg.toFixed(2)}</td>
                                    {(Array.isArray(subjectPerf?.assignments) ? subjectPerf.assignments : []).map(a => {
                                      const key = `${s.student_id}-${a.id}`
                                      const draft = gradeEdits[key]
                                      const current = grades?.[String(a.id)]?.value
                                      const val = draft != null ? draft : (current == null ? '' : String(current))
                                      return (
                                        <td key={key} className="px-4 py-2 whitespace-nowrap">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="number"
                                              min={0}
                                              max={a.max_grade != null ? Number(a.max_grade) : undefined}
                                              step={1}
                                              value={val}
                                              onChange={(e) => setGradeEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  commitGrade({ studentId: s.student_id, assignmentId: a.id, valueRaw: e.currentTarget.value, currentValue: current })
                                                }
                                              }}
                                              onBlur={(e) => commitGrade({ studentId: s.student_id, assignmentId: a.id, valueRaw: e.currentTarget.value, currentValue: current })}
                                              className="w-20 px-2 py-1 rounded-lg border text-sm"
                                              style={{
                                                background: 'var(--surface-bg-strong)',
                                                borderColor: 'rgba(38, 100, 121, 0.18)',
                                                color: 'var(--content-text)',
                                              }}
                                            />
                                            {gradeSaving[key] && <Loader2 size={14} className="animate-spin text-white/70" />}
                                          </div>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                              {(!subjectPerf?.students || subjectPerf.students.length === 0) && (
                                <tr>
                                  <td className="px-4 py-6 text-gray-400" colSpan={2 + ((subjectPerf?.assignments || []).length)}>Нет данных</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {subjectModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSubjectModalOpen(false); setSubjectDetail({ id: null, title: '', assignments: [], tests: [], loading: false }) }}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              className="relative w-full max-w-3xl modal-panel rounded-3xl p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="font-semibold mb-2 text-white">
                Детали предмета: {subjectDetail.title || '…'}
              </div>
              {subjectDetail.loading ? (
                <div className="text-[#266479]">Загрузка…</div>
              ) : (
                <div className="space-y-4">
                  <div className="admin-card rounded-2xl p-4">
                    <div className="text-white font-medium mb-2">Задания</div>
                    <div className="space-y-2">
                      {(subjectDetail.assignments || []).map(a => (
                        <div key={a.id} className="modal-item flex items-center justify-between px-3 py-2 rounded-lg">
                          <div className="text-white truncate">{a.title}</div>
                          <div className="text-[#266479] text-sm">макс. {a.max_grade}</div>
                        </div>
                      ))}
                      {(!subjectDetail.assignments || subjectDetail.assignments.length === 0) && (
                        <div className="text-[#266479] text-sm">Нет заданий</div>
                      )}
                    </div>
                  </div>
                  <div className="admin-card rounded-2xl p-4">
                    <div className="text-white font-medium mb-2">Тесты</div>
                    <div className="space-y-2">
                      {(subjectDetail.tests || []).map(t => (
                        <div key={t.id} className="modal-item flex items-center justify-between px-3 py-2 rounded-lg">
                          <div className="text-white truncate">{t.title}</div>
                          <div className="text-[#266479] text-sm">{t.test_data?.questions_count ?? (Array.isArray(t.test_data?.questions) ? t.test_data.questions.length : '')} вопросов</div>
                        </div>
                      ))}
                      {(!subjectDetail.tests || subjectDetail.tests.length === 0) && (
                        <div className="text-[#266479] text-sm">Нет тестов</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => { setSubjectModalOpen(false); setSubjectDetail({ id: null, title: '', assignments: [], tests: [], loading: false }) }}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scheduleOpen && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!scheduleLoading) setScheduleOpen(false) }}
              className="absolute inset-0 modal-overlay"
            />
            <motion.div
              className="relative w-[98vw] max-w-none h-[90vh] sm:h-[82vh] modal-panel rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col min-h-0 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { if (!scheduleLoading) setScheduleOpen(false) }}
                className="absolute top-4 right-4 w-10 h-10 rounded-xl border transition flex items-center justify-center leading-none icon-btn"
                style={{
                  background: 'var(--surface-bg-strong)',
                  borderColor: 'rgba(38, 100, 121, 0.18)',
                  color: 'var(--content-text)',
                }}
              >
                <X size={18} />
              </button>

              <div className="font-semibold text-white mb-1">
                Расписание • {selectedGroup?.name} • {selectedCourse?.title} • {scheduleSemester?.title}
              </div>

              {scheduleError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-400 font-semibold mb-4">
                  {scheduleError}
                </div>
              )}

              <div className="sm:hidden flex flex-col flex-1 min-h-0">
                <div className="shrink-0 -mx-1 px-1 pb-2">
                  <div className="flex items-center gap-2 overflow-auto">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setScheduleMobileTab('settings')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScheduleMobileTab('settings') }}
                    className={`h-7 px-2 rounded-md border whitespace-nowrap text-xs flex items-center justify-center leading-none select-none ${scheduleMobileTab === 'settings' ? '!bg-emerald-600 !border-emerald-500/20 text-white' : '!bg-white/5 !border-white/10'}`}
                    style={scheduleMobileTab === 'settings' ? undefined : { color: contentText }}
                  >
                    Настройки
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setScheduleMobileTab('subjects')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScheduleMobileTab('subjects') }}
                    className={`h-7 px-2 rounded-md border whitespace-nowrap text-xs flex items-center justify-center leading-none select-none ${scheduleMobileTab === 'subjects' ? '!bg-emerald-600 !border-emerald-500/20 text-white' : '!bg-white/5 !border-white/10'}`}
                    style={scheduleMobileTab === 'subjects' ? undefined : { color: contentText }}
                  >
                    Предметы
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setScheduleMobileTab('grid')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScheduleMobileTab('grid') }}
                    className={`h-7 px-2 rounded-md border whitespace-nowrap text-xs flex items-center justify-center leading-none select-none ${scheduleMobileTab === 'grid' ? '!bg-emerald-600 !border-emerald-500/20 text-white' : '!bg-white/5 !border-white/10'}`}
                    style={scheduleMobileTab === 'grid' ? undefined : { color: contentText }}
                  >
                    Сетка
                  </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">

                {scheduleMobileTab === 'settings' && (
                  <div className="admin-card rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden">
                    <div className="text-white font-medium mb-2">Настройки</div>
                    <div className="space-y-3 overflow-auto custom-scrollbar pr-1 flex-1 min-h-0">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1">
                          <div className="text-white/70 text-xs">Начало</div>
                          <input
                            type="time"
                            value={scheduleConfig?.start_time || '09:00'}
                            onChange={(e) => setConfigField('start_time', e.target.value)}
                            className="w-full px-2 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-xs">Пар в день</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={scheduleConfig?.lessons_per_day ?? 4}
                            onChange={(e) => setConfigField('lessons_per_day', Number(e.target.value || 1))}
                            className="w-full px-2 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-xs">Длительность</div>
                          <input
                            type="number"
                            min={10}
                            max={600}
                            value={scheduleConfig?.lesson_duration_minutes ?? 90}
                            onChange={(e) => setConfigField('lesson_duration_minutes', Number(e.target.value || 10))}
                            className="w-full px-2 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-xs">Перерыв</div>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            value={scheduleConfig?.break_minutes ?? 10}
                            onChange={(e) => setConfigField('break_minutes', Number(e.target.value || 0))}
                            className="w-full px-2 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-white/80 select-none">
                          <input
                            type="checkbox"
                            checked={useCustomBreaks}
                            onChange={(e) => {
                              const checked = !!e.target.checked
                              setScheduleConfig(prev => {
                                const next = { ...(prev || {}) }
                                const lessons = Number(next.lessons_per_day || 0)
                                const maxLen = Math.max(0, lessons - 1)
                                if (!checked || maxLen <= 0) {
                                  next.breaks_minutes = []
                                  return next
                                }
                                const base = Number(next.break_minutes || 0)
                                next.breaks_minutes = Array.from({ length: maxLen }).map(() => base)
                                return next
                              })
                            }}
                          />
                          Разные перерывы
                        </label>

                        {useCustomBreaks && (
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: Math.max(0, Number(scheduleConfig?.lessons_per_day || 0) - 1) }).map((_, idx) => (
                              <label key={idx} className="space-y-1">
                                <div className="text-white/70 text-xs">После {idx + 1} пары</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={600}
                                  value={Number((Array.isArray(scheduleConfig?.breaks_minutes) ? scheduleConfig.breaks_minutes : [])?.[idx] ?? scheduleConfig?.break_minutes ?? 0)}
                                  onChange={(e) => {
                                    const v = Number(e.target.value || 0)
                                    setScheduleConfig(prev => {
                                      const next = { ...(prev || {}) }
                                      const lessons = Number(next.lessons_per_day || 0)
                                      const maxLen = Math.max(0, lessons - 1)
                                      const base = Number(next.break_minutes || 0)
                                      const arr = Array.isArray(next.breaks_minutes) ? [...next.breaks_minutes] : []
                                      while (arr.length < maxLen) arr.push(base)
                                      arr[idx] = v
                                      next.breaks_minutes = arr.slice(0, maxLen)
                                      return next
                                    })
                                  }}
                                  className="w-full px-2 py-2 rounded-xl border text-sm"
                                  style={{
                                    background: 'var(--surface-bg-strong)',
                                    borderColor: 'rgba(38, 100, 121, 0.18)',
                                    color: 'var(--content-text)',
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {scheduleMobileTab === 'subjects' && (
                  <div className="admin-card rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden">
                    <div className="text-white font-medium mb-2 flex items-center justify-between gap-2">
                      <span>Предметы</span>
                      {scheduleMobileBindingId ? (
                        <button
                          type="button"
                          onClick={() => setScheduleMobileBindingId('')}
                          className="px-3 py-2 rounded-xl border !bg-white/5 !border-white/10 text-white/80"
                        >
                          Снять выбор
                        </button>
                      ) : null}
                    </div>
                    <div className="text-white/60 text-xs mb-2">Выберите предмет, затем в «Сетка» нажмите на ячейку.</div>
                    <div className="space-y-2 flex-1 min-h-0 overflow-auto pr-1 custom-scrollbar">
                      {(Array.isArray(scheduleBindings) ? scheduleBindings : []).map(b => (
                        <div
                          key={b.id}
                          onClick={() => {
                            const id = String(b?.id ?? '')
                            setScheduleMobileBindingId(prev => (String(prev) === id ? '' : id))
                          }}
                          className={`rounded-xl border bg-white/5 px-3 py-2 flex items-start justify-between gap-3 ${String(scheduleMobileBindingId) === String(b?.id ?? '') ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10'}`}
                        >
                          <div className="min-w-0">
                            <div className="text-white text-sm font-medium break-words">{b?.subject?.title || ''}</div>
                            <div className="text-[#266479] text-xs break-words">{b?.teacher?.display_name || ''}</div>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeScheduleBinding(b.id) }}
                            disabled={scheduleLoading}
                            className="p-2 rounded-xl !bg-red-600 !border-red-600/40 text-white hover:!bg-red-700 disabled:opacity-60 shrink-0 flex items-center justify-center"
                            title="Удалить связку"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {(!scheduleBindings || scheduleBindings.length === 0) && (
                        <div className="text-white/70 text-sm">В семестре нет связок преподаватель + предмет</div>
                      )}
                    </div>
                  </div>
                )}

                {scheduleMobileTab === 'grid' && (
                  <div className="admin-card rounded-2xl p-3 flex flex-col min-h-0 overflow-hidden">
                    <div className="text-white font-medium mb-2">Сетка</div>
                    <div className="flex items-center gap-2 overflow-auto pb-2 -mx-1 px-1">
                      {[0, 1, 2, 3, 4, 5].map(w => (
                        <div
                          key={w}
                          role="button"
                          tabIndex={0}
                          onClick={() => setScheduleMobileWeekday(w)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setScheduleMobileWeekday(w) }}
                          className={`h-7 px-2 rounded-md border whitespace-nowrap text-xs flex items-center justify-center leading-none select-none ${scheduleMobileWeekday === w ? '!bg-emerald-600 !border-emerald-500/20' : '!bg-white/5 !border-white/10'}`}
                          style={{ color: contentText }}
                        >
                          {weekdayLabels[w]}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 flex-1 min-h-0 overflow-auto pr-1 custom-scrollbar">
                      {Array.from({ length: Number(scheduleConfig?.lessons_per_day || 0) }).map((_, idx) => {
                        const lesson = idx + 1
                        const cellKey = `${scheduleMobileWeekday}-${lesson}`
                        const cell = scheduleCells?.[cellKey]
                        const binding = cell?.bindingId == null ? null : bindingMap.get(Number(cell.bindingId))
                        const subjectTitle = binding?.subject?.title || (cell?.subjectId == null ? '' : (subjectTitleById.get(Number(cell.subjectId)) || ''))
                        const teacherName = binding?.teacher?.display_name || (cell?.teacherId == null ? '' : (teacherNameById.get(Number(cell.teacherId)) || ''))
                        const isConflict = String(scheduleConflictCell || '') === String(cellKey)
                        const picked = (Array.isArray(scheduleBindings) ? scheduleBindings : []).find(x => String(x?.id ?? '') === String(scheduleMobileBindingId))
                        return (
                          <div key={cellKey} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="text-white/80 text-sm font-medium">{lessonTimeLabel(lesson)}</div>
                              {cell?.subjectId != null && (
                                <button
                                  type="button"
                                  onClick={() => clearCell(cellKey)}
                                  className="px-3 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center justify-center"
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                            <div
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => onDropToCell(e, cellKey)}
                              onDoubleClick={() => clearCell(cellKey)}
                              onClick={() => {
                                if (!picked) return
                                putToCell({
                                  cellKey,
                                  subjectId: picked?.subject?.id,
                                  teacherId: picked?.teacher?.id,
                                  bindingId: picked?.id,
                                })
                              }}
                              className={`min-h-[68px] rounded-2xl border p-3 ${isConflict ? 'border-red-500 bg-red-500/15' : 'border-white/10 bg-black/10'}`}
                            >
                              {cell?.subjectId != null ? (
                                <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                                  <div className="text-white text-sm font-semibold break-words">{subjectTitle}</div>
                                  <div className="text-[#266479] text-xs mt-1 break-words">{teacherName}</div>
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearCell(cellKey) }}
                                      className="w-full px-3 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white"
                                    >
                                      Очистить ячейку
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-white/40 text-sm">{picked ? 'Нажмите, чтобы поставить выбранный предмет' : 'Выберите предмет (вкладка «Предметы»)'}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                </div>
              </div>

              <div className="hidden sm:grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0 overflow-hidden">
                <div className="lg:col-span-3 flex flex-col min-h-0 gap-4">
                  <div className="admin-card rounded-2xl p-4 flex flex-col min-h-0 lg:basis-[40%] max-h-[42vh] sm:max-h-none overflow-hidden">
                    <div className="text-white font-medium mb-3">Настройки</div>
                    <div className="space-y-3 overflow-auto custom-scrollbar pr-1 flex-1 min-h-0">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <div className="text-white/70 text-sm">Начало</div>
                          <input
                            type="time"
                            value={scheduleConfig?.start_time || '09:00'}
                            onChange={(e) => setConfigField('start_time', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-sm">Пар в день</div>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={scheduleConfig?.lessons_per_day ?? 4}
                            onChange={(e) => setConfigField('lessons_per_day', Number(e.target.value || 1))}
                            className="w-full px-3 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-sm">Длительность (мин)</div>
                          <input
                            type="number"
                            min={10}
                            max={600}
                            value={scheduleConfig?.lesson_duration_minutes ?? 90}
                            onChange={(e) => setConfigField('lesson_duration_minutes', Number(e.target.value || 10))}
                            className="w-full px-3 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                        <label className="space-y-1">
                          <div className="text-white/70 text-sm">Перерыв (мин)</div>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            value={scheduleConfig?.break_minutes ?? 10}
                            onChange={(e) => setConfigField('break_minutes', Number(e.target.value || 0))}
                            className="w-full px-3 py-2 rounded-xl border text-sm"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.18)',
                              color: 'var(--content-text)',
                            }}
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm text-white/80 select-none">
                          <input
                            type="checkbox"
                            checked={useCustomBreaks}
                            onChange={(e) => {
                              const checked = !!e.target.checked
                              setScheduleConfig(prev => {
                                const next = { ...(prev || {}) }
                                const lessons = Number(next.lessons_per_day || 0)
                                const maxLen = Math.max(0, lessons - 1)
                                if (!checked || maxLen <= 0) {
                                  next.breaks_minutes = []
                                  return next
                                }
                                const base = Number(next.break_minutes || 0)
                                next.breaks_minutes = Array.from({ length: maxLen }).map(() => base)
                                return next
                              })
                            }}
                          />
                          Разные перерывы
                        </label>

                        {useCustomBreaks && (
                          <div className="grid grid-cols-2 gap-3">
                            {Array.from({ length: Math.max(0, Number(scheduleConfig?.lessons_per_day || 0) - 1) }).map((_, idx) => (
                              <label key={idx} className="space-y-1">
                                <div className="text-white/70 text-sm">Перерыв после {idx + 1} пары (мин)</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={600}
                                  value={Number((Array.isArray(scheduleConfig?.breaks_minutes) ? scheduleConfig.breaks_minutes : [])?.[idx] ?? scheduleConfig?.break_minutes ?? 0)}
                                  onChange={(e) => {
                                    const v = Number(e.target.value || 0)
                                    setScheduleConfig(prev => {
                                      const next = { ...(prev || {}) }
                                      const lessons = Number(next.lessons_per_day || 0)
                                      const maxLen = Math.max(0, lessons - 1)
                                      const base = Number(next.break_minutes || 0)
                                      const arr = Array.isArray(next.breaks_minutes) ? [...next.breaks_minutes] : []
                                      while (arr.length < maxLen) arr.push(base)
                                      arr[idx] = v
                                      next.breaks_minutes = arr.slice(0, maxLen)
                                      return next
                                    })
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border text-sm"
                                  style={{
                                    background: 'var(--surface-bg-strong)',
                                    borderColor: 'rgba(38, 100, 121, 0.18)',
                                    color: 'var(--content-text)',
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="admin-card rounded-2xl p-4 flex-1 flex flex-col min-h-0 min-h-[220px] sm:min-h-0">
                    <div className="text-white font-medium mb-3">Предметы</div>
                    <div className="space-y-2 flex-1 min-h-0 overflow-auto pr-1 custom-scrollbar">
                      {(Array.isArray(scheduleBindings) ? scheduleBindings : []).map(b => (
                        <div
                          key={b.id}
                          draggable
                          onDragStart={(e) => onDragStartBinding(e, b)}
                          className="rounded-xl border border-emerald-500/40 bg-white/5 px-3 py-2 cursor-grab active:cursor-grabbing flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-white text-sm font-medium truncate">{b?.subject?.title || ''}</div>
                            <div className="text-[#266479] text-xs truncate">{b?.teacher?.display_name || ''}</div>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeScheduleBinding(b.id) }}
                            disabled={scheduleLoading}
                            className="p-2 rounded-xl !bg-red-600 !border-red-600/40 text-white hover:!bg-red-700 disabled:opacity-60 shrink-0 flex items-center justify-center"
                            title="Удалить связку"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {(!scheduleBindings || scheduleBindings.length === 0) && (
                        <div className="text-white/70 text-sm">В семестре нет связок преподаватель + предмет</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-9 flex flex-col min-h-0">
                  <div className="admin-card rounded-2xl p-4 flex flex-col min-h-0">
                    <div className="text-white font-medium mb-3 shrink-0">Сетка</div>
                    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                      <table className="min-w-[980px] text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-black/30">
                            <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: contentText }}>Пара</th>
                            {[0, 1, 2, 3, 4, 5].map(w => (
                              <th key={w} className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: contentText }}>
                                {weekdayLabels[w]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {Array.from({ length: Number(scheduleConfig?.lessons_per_day || 0) }).map((_, idx) => {
                            const lesson = idx + 1
                            return (
                              <tr key={lesson}>
                                <td className="px-3 py-2 text-white/80 whitespace-nowrap">
                                  {lessonTimeLabel(lesson)}
                                </td>
                                {[0, 1, 2, 3, 4, 5].map(w => {
                                  const cellKey = `${w}-${lesson}`
                                  const cell = scheduleCells?.[cellKey]
                                  const binding = cell?.bindingId == null ? null : bindingMap.get(Number(cell.bindingId))
                                  const subjectTitle = binding?.subject?.title || (cell?.subjectId == null ? '' : (subjectTitleById.get(Number(cell.subjectId)) || ''))
                                  const teacherName = binding?.teacher?.display_name || (cell?.teacherId == null ? '' : (teacherNameById.get(Number(cell.teacherId)) || ''))
                                  const isConflict = String(scheduleConflictCell || '') === String(cellKey)
                                  return (
                                    <td key={cellKey} className="px-3 py-2 align-top">
                                      <div
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => onDropToCell(e, cellKey)}
                                        onDoubleClick={() => clearCell(cellKey)}
                                        className={`min-h-[52px] rounded-xl border p-2 ${isConflict ? 'border-red-500 bg-red-500/15' : 'border-white/10 bg-white/5'}`}
                                      >
                                        {cell?.subjectId != null ? (
                                          <div
                                            draggable
                                            onDragStart={(e) => onDragStartCell(e, cellKey)}
                                            className="rounded-lg bg-white/10 border border-white/10 px-2 py-1 cursor-grab active:cursor-grabbing"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-white text-sm font-medium truncate">{subjectTitle}</div>
                                                <div className="text-[#266479] text-xs truncate">{teacherName}</div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => clearCell(cellKey)}
                                                className="w-7 h-7 rounded-lg !bg-white/10 !border-white/10 border text-white/80 flex items-center justify-center shrink-0"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-white/30 text-xs">Перетащите предмет</div>
                                        )}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={scheduleLoading}
                  onClick={() => { if (!scheduleLoading) setScheduleOpen(false) }}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition disabled:opacity-60"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  disabled={scheduleLoading}
                  onClick={saveSchedule}
                  className="px-4 py-2 rounded-xl border bg-emerald-600 text-white hover:brightness-105 transition disabled:opacity-60"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
