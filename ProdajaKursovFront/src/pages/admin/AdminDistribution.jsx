import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, UserPlus, CheckCircle2, Pencil, Trash2, UserRound, X, Upload, Download, BookOpen } from 'lucide-react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import ProfileModal from '../../components/ProfileModal'
import { api, formatApiError } from '../../lib/api'

function BulkUploadButton({ onUploaded }) {
  const inputRef = React.useRef(null)
  const [isLoading, setLoading] = useState(false)
  const [isTemplateLoading, setTemplateLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePick = () => {
    setError('')
    inputRef.current?.click()
  }
  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null
    e.target.value = ''
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
      if (!XLSX) {
        setError('Библиотека xlsx не установлена. Установите зависимость: npm i xlsx')
        return
      }
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })
      // Нормализация заголовков
      const normalized = rows.map((r) => {
        const map = {}
        for (const [k, v] of Object.entries(r)) {
          const key = String(k).trim().toLowerCase()
          map[key] = v
        }
        const rec = {
          email: String(map.email || '').trim(),
          first_name: String(map.first_name || map['имя'] || '').trim(),
          last_name: String(map.last_name || map['фамилия'] || '').trim(),
          middle_name: String(map.middle_name || map['отчество'] || '').trim(),
        }
        const groupRaw = String(map.group || map['группа'] || '').trim()
        if (groupRaw) rec.group = groupRaw
        const passRaw = String(map.password || map['пароль'] || '').trim()
        rec.password = passRaw
        const phoneRaw = String(map.phone || map['телефон'] || '').trim()
        rec.phone = phoneRaw ? phoneRaw : null
        return rec
      }).filter(r => r.email && r.first_name && r.last_name && r.password)

      if (normalized.length === 0) {
        setError('В файле не найдено валидных строк. Нужны столбцы (точно такими названиями): email, first_name, last_name, password. Дополнительно можно: middle_name, group, phone.')
        return
      }
      await api.users.students.manyCreate(normalized, { ignore_conflicts: true })
      onUploaded && onUploaded()
    } catch (err) {
      setError('Не удалось обработать файл. Проверь формат .xlsx')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = async () => {
    setError('')
    setTemplateLoading(true)
    try {
      const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
      if (!XLSX) {
        setError('Библиотека xlsx не установлена. Установите зависимость: npm i xlsx')
        return
      }
      const header = ['email', 'first_name', 'last_name', 'password', 'middle_name', 'group', 'phone']
      const example = ['student@example.com', 'Иван', 'Иванов', 'Temp12345!', 'Иванович', 'п50-8-22', '+79990000000']
      const ws = XLSX.utils.aoa_to_sheet([header, example])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'students')
      const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'students_template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Не удалось сформировать шаблон')
    } finally {
      setTemplateLoading(false)
    }
  }

  return (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={downloadTemplate}
        className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center justify-center gap-2 sm:shrink-0 hover:bg-white/10 transition-colors disabled:opacity-50"
        disabled={isTemplateLoading || isLoading}
        title="Скачать XLSX-шаблон"
      >
        <Download size={16} className="text-white/70" />
        <span className="whitespace-nowrap btn-label-force">{isTemplateLoading ? 'Подготовка…' : 'Шаблон Excel'}</span>
      </button>
      <button
        type="button"
        onClick={handlePick}
        className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center justify-center gap-2 sm:shrink-0 hover:bg-white/10 transition-colors disabled:opacity-50"
        disabled={isLoading}
        title="Загрузить XLSX со столбцами: email, first_name, last_name, password. Дополнительно: middle_name, group, phone(optional)"
      >
        <Upload size={16} className="text-white/70" />
        <span className="whitespace-nowrap btn-label-force">{isLoading ? 'Обработка…' : 'Загрузить учащихся'}</span>
      </button>
      {error && <span className="text-xs text-red-300 break-words">{error}</span>}
    </div>
  )
}

export default function AdminDistribution() {
  const NO_GROUP_ID = '__no_group__'
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const normalizeList = (value) => (Array.isArray(value) ? value : (Array.isArray(value?.results) ? value.results : []))
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.users.students.list()
        if (!cancelled) setStudents(normalizeList(list))
      } catch {
        if (!cancelled) setStudents([])
      }
    })()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.users.groups.list()
        if (!cancelled) setGroups(normalizeList(list))
      } catch {
        if (!cancelled) setGroups([])
      }
    })()
    return () => { cancelled = true }
  }, [])
  const groupsSorted = useMemo(() => {
    const arr = Array.isArray(groups) ? groups.slice() : []
    return arr
      .filter(g => g && g.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [groups])
  const [filterGroupId, setFilterGroupId] = useState('')
  const selectionMode = filterGroupId === NO_GROUP_ID
  const [attachGroupId, setAttachGroupId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const studentById = useMemo(() => {
    const map = new Map()
    ;(Array.isArray(students) ? students : []).forEach(s => map.set(String(s.id), s))
    return map
  }, [students])
  const isInAnyGroup = (uid) => {
    const s = studentById.get(String(uid))
    return !!(s && s.group)
  }
  const [groupActionError, setGroupActionError] = useState('')
  const toggleSelected = (id) => {
    if (isInAnyGroup(id)) return
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const reloadStudents = async () => {
    const list = await api.users.students.list()
    setStudents(normalizeList(list))
  }
  const reloadGroups = async () => {
    const list = await api.users.groups.list()
    setGroups(normalizeList(list))
  }
  const confirmAttach = async () => {
    if (!attachGroupId) return
    const attachables = selectedIds.filter(id => !isInAnyGroup(id))
    if (attachables.length === 0) return
    setGroupActionError('')
    try {
      await api.users.groups.addToGroup(attachGroupId, attachables)
      await Promise.all([reloadStudents(), reloadGroups()])
      setSelectedIds([])
    } catch (e) {
      const body = e?.body
      const participantsMsg = typeof body?.participants === 'string' ? body.participants : body?.participants?.[0]
      const msg = body?.detail || body?.students || participantsMsg || 'Не удалось присоединить учащихся к группе'
      if (Array.isArray(body?.ids) && body.ids.length) {
        const ids = body.ids.map(String)
        setSelectedIds(prev => prev.filter(x => !ids.includes(String(x))))
        await reloadStudents()
      }
      if (Number.isFinite(Number(body?.rest_count))) {
        setGroupActionError(`${String(msg)}. Доступно мест: ${Number(body.rest_count)}`)
      } else {
        setGroupActionError(String(msg))
      }
    }
  }

  useEffect(() => {
    setSelectedIds([])
    setAttachGroupId('')
    setGroupActionError('')
  }, [filterGroupId])

  const detachFromGroup = async (gid, uid) => {
    setGroupActionError('')
    try {
      await api.users.groups.removeFromGroup(gid, [uid])
      await Promise.all([reloadStudents(), reloadGroups()])
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.participants?.[0] || 'Не удалось удалить учащегося из группы'
      setGroupActionError(String(msg))
    }
  }

  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '' })
  const [createGroupError, setCreateGroupError] = useState('')
  const submitCreateGroup = async () => {
    if (!groupForm.name.trim()) return
    setCreateGroupError('')
    try {
      await api.users.groups.create({ name: groupForm.name.trim() })
      await reloadGroups()
      setGroupForm({ name: '' })
      setCreateGroupOpen(false)
    } catch (e) {
      const msg = e?.body?.name?.[0] || e?.body?.detail || 'Не удалось создать группу'
      setCreateGroupError(String(msg))
    }
  }

  const [renameGroupOpen, setRenameGroupOpen] = useState(false)
  const [renameGroupId, setRenameGroupId] = useState('')
  const [renameGroupName, setRenameGroupName] = useState('')
  const [renameGroupError, setRenameGroupError] = useState('')
  const [renameGroupSubmitting, setRenameGroupSubmitting] = useState(false)
  const openRenameGroup = (g) => {
    if (!g) return
    setRenameGroupId(String(g.id))
    setRenameGroupName(String(g.name || ''))
    setRenameGroupError('')
    setRenameGroupSubmitting(false)
    setRenameGroupOpen(true)
  }
  const submitRenameGroup = async () => {
    const name = String(renameGroupName || '').trim()
    if (!renameGroupId) return
    setRenameGroupError('')
    if (!name) {
      setRenameGroupError('Заполните название группы')
      return
    }
    try {
      setRenameGroupSubmitting(true)
      await api.users.groups.update(renameGroupId, { name })
      await reloadGroups()
      setRenameGroupOpen(false)
    } catch (e) {
      setRenameGroupError(formatApiError(e, 'Не удалось изменить название группы'))
    } finally {
      setRenameGroupSubmitting(false)
    }
  }

  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false)
  const [deleteGroupId, setDeleteGroupId] = useState('')
  const [deleteGroupName, setDeleteGroupName] = useState('')
  const [deleteGroupError, setDeleteGroupError] = useState('')
  const [deleteGroupSubmitting, setDeleteGroupSubmitting] = useState(false)
  const openDeleteGroup = (g) => {
    if (!g) return
    setDeleteGroupId(String(g.id))
    setDeleteGroupName(String(g.name || ''))
    setDeleteGroupError('')
    setDeleteGroupSubmitting(false)
    setDeleteGroupOpen(true)
  }
  const submitDeleteGroup = async () => {
    if (!deleteGroupId) return
    setDeleteGroupError('')
    try {
      setDeleteGroupSubmitting(true)
      await api.users.groups.remove(deleteGroupId)
      await Promise.all([reloadStudents(), reloadGroups()])
      if (String(filterGroupId || '') === String(deleteGroupId)) setFilterGroupId('')
      if (String(attachGroupId || '') === String(deleteGroupId)) setAttachGroupId('')
      if (String(groupCoursesGroupId || '') === String(deleteGroupId)) {
        setGroupCoursesOpen(false)
        setGroupCoursesGroupId('')
      }
      setDeleteGroupOpen(false)
    } catch (e) {
      setDeleteGroupError(formatApiError(e, 'Не удалось удалить группу'))
    } finally {
      setDeleteGroupSubmitting(false)
    }
  }

  const [groupCoursesOpen, setGroupCoursesOpen] = useState(false)
  const [groupCoursesGroupId, setGroupCoursesGroupId] = useState('')
  const [groupCoursesLoading, setGroupCoursesLoading] = useState(false)
  const [groupCoursesError, setGroupCoursesError] = useState('')
  const [groupCourses, setGroupCourses] = useState([])
  const [allCoursesLoading, setAllCoursesLoading] = useState(false)
  const [allCoursesError, setAllCoursesError] = useState('')
  const [allCourses, setAllCourses] = useState([])
  const [coursePickerQuery, setCoursePickerQuery] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState([])

  // State for simple courses attachment to student
  const [studentCoursesOpen, setStudentCoursesOpen] = useState(false)
  const [studentCoursesStudentId, setStudentCoursesStudentId] = useState('')
  const [studentCoursesLoading, setStudentCoursesLoading] = useState(false)
  const [studentCoursesError, setStudentCoursesError] = useState('')
  const [studentCourses, setStudentCourses] = useState([])
  const [allSimpleCourses, setAllSimpleCourses] = useState([])
  const [selectedSimpleCourseIds, setSelectedSimpleCourseIds] = useState([])

  const openStudentCourses = async (studentId) => {
    setStudentCoursesStudentId(String(studentId))
    setStudentCoursesOpen(true)
    setStudentCoursesError('')
    setAllCoursesError('')
    setCoursePickerQuery('')
    setSelectedSimpleCourseIds([])
  }

  const loadStudentSimpleCourses = async (studentId) => {
    setStudentCoursesError('')
    setStudentCoursesLoading(true)
    try {
      const list = await api.users.students.simpleCourses(studentId)
      const arr = normalizeList(list)
      setStudentCourses(arr)
      setSelectedSimpleCourseIds(arr.map(c => c.id))
    } catch (e) {
      setStudentCourses([])
      const msg = e?.body?.detail || 'Не удалось загрузить курсы ученика'
      setStudentCoursesError(String(msg))
    } finally {
      setStudentCoursesLoading(false)
    }
  }

  const loadAllSimpleCourses = async () => {
    setAllCoursesError('')
    setAllCoursesLoading(true)
    try {
      const list = await api.courses.list()
      // Filter only simple courses
      const simpleCoursesList = normalizeList(list).filter(c => c.course_type === 'simple')
      setAllSimpleCourses(simpleCoursesList)
    } catch (e) {
      setAllSimpleCourses([])
      const msg = e?.body?.detail || 'Не удалось загрузить список курсов'
      setAllCoursesError(String(msg))
    } finally {
      setAllCoursesLoading(false)
    }
  }

  useEffect(() => {
    if (!studentCoursesOpen || !studentCoursesStudentId) return
    loadStudentSimpleCourses(studentCoursesStudentId)
    loadAllSimpleCourses()
  }, [studentCoursesOpen, studentCoursesStudentId])

  const saveStudentCourses = async () => {
    if (!studentCoursesStudentId) return
    setStudentCoursesError('')
    setStudentCoursesLoading(true)
    try {
      await api.users.students.bindToSimpleCourses(studentCoursesStudentId, selectedSimpleCourseIds)
      await loadStudentSimpleCourses(studentCoursesStudentId)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.courses || e?.body?.courses?.[0] || 'Не удалось сохранить курсы ученика'
      setStudentCoursesError(String(msg))
      setStudentCoursesLoading(false)
    }
  }

  const detachSimpleCourse = async (courseId) => {
    if (!studentCoursesStudentId) return
    setStudentCoursesError('')
    try {
      const newIds = selectedSimpleCourseIds.filter(id => String(id) !== String(courseId))
      await api.users.students.bindToSimpleCourses(studentCoursesStudentId, newIds)
      setSelectedSimpleCourseIds(newIds)
      await loadStudentSimpleCourses(studentCoursesStudentId)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.course?.[0] || 'Не удалось открепить курс'
      setStudentCoursesError(String(msg))
    }
  }

  const openGroupCourses = async (groupId) => {
    setGroupCoursesGroupId(String(groupId))
    setGroupCoursesOpen(true)
    setGroupCoursesError('')
    setAllCoursesError('')
    setCoursePickerQuery('')
    setSelectedCourseIds([])
  }

  const loadGroupCourses = async (groupId) => {
    setGroupCoursesError('')
    setGroupCoursesLoading(true)
    try {
      const list = await api.users.groups.courses(groupId)
      const arr = normalizeList(list)
      setGroupCourses(arr)
      setSelectedCourseIds(arr.map(c => c.id))
    } catch (e) {
      setGroupCourses([])
      const msg = e?.body?.detail || 'Не удалось загрузить курсы группы'
      setGroupCoursesError(String(msg))
    } finally {
      setGroupCoursesLoading(false)
    }
  }

  const loadAllCourses = async () => {
    setAllCoursesError('')
    setAllCoursesLoading(true)
    try {
      const list = await api.courses.list()
      setAllCourses(normalizeList(list))
    } catch (e) {
      setAllCourses([])
      const msg = e?.body?.detail || 'Не удалось загрузить список курсов'
      setAllCoursesError(String(msg))
    } finally {
      setAllCoursesLoading(false)
    }
  }

  useEffect(() => {
    if (!groupCoursesOpen || !groupCoursesGroupId) return
    loadGroupCourses(groupCoursesGroupId)
    loadAllCourses()
  }, [groupCoursesOpen, groupCoursesGroupId])

  const saveGroupCourses = async () => {
    if (!groupCoursesGroupId) return
    setGroupCoursesError('')
    setGroupCoursesLoading(true)
    try {
      await api.users.groups.bindToCourses(groupCoursesGroupId, selectedCourseIds)
      await loadGroupCourses(groupCoursesGroupId)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.courses || e?.body?.courses?.[0] || 'Не удалось сохранить курсы группы'
      setGroupCoursesError(String(msg))
      setGroupCoursesLoading(false)
    }
  }

  const detachCourse = async (courseId) => {
    if (!groupCoursesGroupId) return
    setGroupCoursesError('')
    try {
      await api.users.groups.detachFromGroup(groupCoursesGroupId, courseId)
      setSelectedCourseIds(prev => prev.filter(id => String(id) !== String(courseId)))
      await loadGroupCourses(groupCoursesGroupId)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.course?.[0] || 'Не удалось открепить курс'
      setGroupCoursesError(String(msg))
    }
  }

  const [teacherAttachOpen, setTeacherAttachOpen] = useState(false)
  const [teacherAttachCourse, setTeacherAttachCourse] = useState(null)
  const [teacherAttachLoading, setTeacherAttachLoading] = useState(false)
  const [teacherAttachError, setTeacherAttachError] = useState('')
  const [teacherAttachments, setTeacherAttachments] = useState([])
  const [teachers, setTeachers] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [semesterMenuOpen, setSemesterMenuOpen] = useState(false)
  const [semesterQuery, setSemesterQuery] = useState('')
  const [subjects, setSubjects] = useState([])
  const [newAttachTeacherId, setNewAttachTeacherId] = useState('')
  const [newAttachSubjectId, setNewAttachSubjectId] = useState('')
  const [teacherMenuOpen, setTeacherMenuOpen] = useState(false)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false)
  const [subjectQuery, setSubjectQuery] = useState('')

  const openTeacherAttach = (course) => {
    setTeacherAttachCourse(course || null)
    setTeacherAttachError('')
    setTeacherAttachments([])
    setTeachers([])
    setSemesters([])
    setSelectedSemesterId('')
    setSemesterMenuOpen(false)
    setSemesterQuery('')
    setSubjects([])
    setNewAttachTeacherId('')
    setNewAttachSubjectId('')
    setTeacherAttachOpen(true)
  }

  const loadTeacherAttachData = async () => {
    if (!teacherAttachOpen) return
    if (!groupCoursesGroupId) return
    const courseId = teacherAttachCourse?.id
    if (!courseId) return
    setTeacherAttachError('')
    setTeacherAttachLoading(true)
    try {
      const [semestersRes, staffRes] = await Promise.all([
        api.users.groups.courseSemesters(groupCoursesGroupId, courseId),
        api.users.staff.list(),
      ])
      const semestersArr = normalizeList(semestersRes)
      const staffArr = normalizeList(staffRes)
      const teachersArr = staffArr.filter(u => String(u?.account_type || '') === 'teacher')
      setSemesters(semestersArr)
      setTeachers(teachersArr)

      if (!selectedSemesterId) {
        setTeacherAttachments([])
        setSubjects([])
        return
      }

      const [attachmentsRes, subjectsRes] = await Promise.all([
        api.users.groups.teacherAttachments.list(groupCoursesGroupId, courseId, { semesterId: selectedSemesterId }),
        api.users.groups.semesterSubjects(groupCoursesGroupId, courseId, selectedSemesterId),
      ])
      setTeacherAttachments(normalizeList(attachmentsRes))
      setSubjects(normalizeList(subjectsRes))
    } catch (e) {
      setTeacherAttachments([])
      setTeachers([])
      setSemesters([])
      setSelectedSemesterId('')
      setSemesterMenuOpen(false)
      setSemesterQuery('')
      setSubjects([])
      const msg = e?.body?.detail || 'Не удалось загрузить преподавателей/предметы'
      setTeacherAttachError(String(msg))
    } finally {
      setTeacherAttachLoading(false)
    }
  }

  useEffect(() => {
    loadTeacherAttachData()
  }, [teacherAttachOpen, teacherAttachCourse?.id, groupCoursesGroupId, selectedSemesterId])

  const addTeacherAttachment = async () => {
    if (!groupCoursesGroupId) return
    const courseId = teacherAttachCourse?.id
    if (!courseId) return
    if (!selectedSemesterId) return
    if (!newAttachTeacherId || !newAttachSubjectId) return
    setTeacherAttachError('')
    setTeacherAttachLoading(true)
    try {
      await api.users.groups.teacherAttachments.create(groupCoursesGroupId, courseId, {
        teacher: Number(newAttachTeacherId),
        subject: Number(newAttachSubjectId),
      })
      setNewAttachTeacherId('')
      setNewAttachSubjectId('')
      await loadTeacherAttachData()
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.teacher?.[0] || e?.body?.subject?.[0] || 'Не удалось прикрепить преподавателя'
      setTeacherAttachError(String(msg))
      setTeacherAttachLoading(false)
    }
  }

  const removeTeacherAttachment = async (attachmentId) => {
    if (!groupCoursesGroupId) return
    const courseId = teacherAttachCourse?.id
    if (!courseId) return
    setTeacherAttachError('')
    setTeacherAttachLoading(true)
    try {
      await api.users.groups.teacherAttachments.remove(groupCoursesGroupId, courseId, attachmentId)
      await loadTeacherAttachData()
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось удалить привязку'
      setTeacherAttachError(String(msg))
      setTeacherAttachLoading(false)
    }
  }

  const [showCreate, setShowCreate] = useState(false)
  const emptyStudentForm = useMemo(() => ({
    last_name: '',
    first_name: '',
    middle_name: '',
    email: '',
    password: '',
    phone: '',
    group: '',
  }), [])
  const [form, setForm] = useState(emptyStudentForm)
  const [createGroupSelectOpen, setCreateGroupSelectOpen] = useState(false)
  const [createGroupQuery, setCreateGroupQuery] = useState('')
  const createGroupSelectRef = useRef(null)
  const [createStudentError, setCreateStudentError] = useState('')
  const openCreateStudent = async () => {
    setForm(emptyStudentForm)
    setCreateGroupSelectOpen(false)
    setCreateGroupQuery('')
    setCreateStudentError('')
    await reloadGroups()
    setShowCreate(true)
  }
  const submitCreateStudent = async () => {
    setCreateStudentError('')
    if (!form.last_name.trim() || !form.first_name.trim() || !form.email.trim() || !form.password) {
      setCreateStudentError('Заполните обязательные поля')
      return
    }
    try {
      const payload = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: (form.middle_name && form.middle_name.trim()) ? form.middle_name.trim() : '',
        password: form.password,
        phone: (form.phone && form.phone.trim()) ? form.phone.trim() : null,
      }
      if (form.group) payload.group = String(form.group).trim()
      await api.users.students.create(payload)
      await Promise.all([reloadStudents(), reloadGroups()])
      setForm(emptyStudentForm)
      setShowCreate(false)
    } catch (e) {
      setCreateStudentError(formatApiError(e, 'Не удалось создать учащегося'))
    }
  }

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    id: '', last_name: '', first_name: '', middle_name: '', email: '', phone: '', group: ''
  })
  const [editStudentError, setEditStudentError] = useState('')
  const [editStudentSubmitting, setEditStudentSubmitting] = useState(false)
  const openEdit = (s) => {
    setEditForm({
      id: s.id,
      last_name: s.last_name || '',
      first_name: s.first_name || '',
      middle_name: s.middle_name || '',
      email: s.email || '',
      phone: s.phone || '',
      group: s?.group?.name || s?.group || '',
    })
    setEditStudentError('')
    setEditStudentSubmitting(false)
    setEditOpen(true)
  }
  const submitEdit = async () => {
    const id = editForm?.id
    if (!id) return
    setEditStudentError('')
    if (!String(editForm.last_name || '').trim() || !String(editForm.first_name || '').trim() || !String(editForm.email || '').trim()) {
      setEditStudentError('Заполните обязательные поля')
      return
    }
    const payload = {
      email: String(editForm.email || '').trim(),
      first_name: String(editForm.first_name || '').trim(),
      last_name: String(editForm.last_name || '').trim(),
      middle_name: (editForm.middle_name && String(editForm.middle_name).trim()) ? String(editForm.middle_name).trim() : '',
      phone: (editForm.phone && String(editForm.phone).trim()) ? String(editForm.phone).trim() : null,
    }
    const groupName = String(editForm.group || '').trim()
    if (groupName) payload.group = groupName
    else payload.group = null
    try {
      setEditStudentSubmitting(true)
      await api.users.students.update(id, payload)
      await Promise.all([reloadStudents(), reloadGroups()])
      setEditOpen(false)
    } catch (e) {
      setEditStudentError(formatApiError(e, 'Не удалось сохранить учащегося'))
    } finally {
      setEditStudentSubmitting(false)
    }
  }

  const [deleteStudentOpen, setDeleteStudentOpen] = useState(false)
  const [deleteStudentId, setDeleteStudentId] = useState('')
  const [deleteStudentLabel, setDeleteStudentLabel] = useState('')
  const [deleteStudentError, setDeleteStudentError] = useState('')
  const [deleteStudentSubmitting, setDeleteStudentSubmitting] = useState(false)
  const openDeleteStudent = (s) => {
    if (!s) return
    const label = [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(' ') || s.email || `ID ${s.id}`
    setDeleteStudentId(String(s.id))
    setDeleteStudentLabel(String(label))
    setDeleteStudentError('')
    setDeleteStudentSubmitting(false)
    setDeleteStudentOpen(true)
  }
  const submitDeleteStudent = async () => {
    if (!deleteStudentId) return
    setDeleteStudentError('')
    try {
      setDeleteStudentSubmitting(true)
      await api.users.students.remove(deleteStudentId)
      await Promise.all([reloadStudents(), reloadGroups()])
      setDeleteStudentOpen(false)
    } catch (e) {
      setDeleteStudentError(formatApiError(e, 'Не удалось удалить учащегося'))
    } finally {
      setDeleteStudentSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!filterGroupId) return students
    if (filterGroupId === NO_GROUP_ID) return (Array.isArray(students) ? students : []).filter(s => !s?.group)
    return (Array.isArray(students) ? students : []).filter(s => String(s?.group?.id || '') === String(filterGroupId))
  }, [students, filterGroupId, NO_GROUP_ID])

  const groupOptions = groups
  const groupFilterTitle = useMemo(() => {
    if (!filterGroupId) return 'Все участники'
    if (filterGroupId === NO_GROUP_ID) return 'Без группы'
    const g = groups.find(x => x.id === filterGroupId)
    return g ? `${g.name}` : 'Все участники'
  }, [filterGroupId, groups, NO_GROUP_ID])

  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const groupMenuRef = useRef(null)
  const [groupMenuPos, setGroupMenuPos] = useState({ top: 0, left: 0, width: 0 })
  const [groupSearch, setGroupSearch] = useState('')
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const attachMenuRef = useRef(null)
  const [attachMenuPos, setAttachMenuPos] = useState({ top: 0, left: 0, width: 0 })
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoStudentId, setInfoStudentId] = useState('')
  useEffect(() => {
    const handle = (e) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target)) setGroupMenuOpen(false)
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setAttachMenuOpen(false)
      if (createGroupSelectRef.current && !createGroupSelectRef.current.contains(e.target)) setCreateGroupSelectOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <Motion.div className="space-y-6 pt-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Распределение</h2>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-2">
          <button onClick={() => { setGroupForm({ name: '' }); setCreateGroupError(''); setCreateGroupOpen(true) }} className="w-full px-3 lg:px-4 h-11 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2">
            <UserPlus size={16} />
            <span className="whitespace-nowrap btn-label-force">Создать группу</span>
          </button>
          <button onClick={openCreateStudent} className="w-full px-3 lg:px-4 h-11 rounded-xl !bg-emerald-600 !border-emerald-600/40 text-white flex items-center gap-2">
            <UserPlus size={16} />
            <span className="whitespace-nowrap btn-label-force">Создать учащегося</span>
          </button>
          {false && (
            <button
              onClick={() => { setSelectionMode(v => !v); setSelectedIds([]) }}
              className={`w-full px-3 lg:px-4 h-11 rounded-xl border flex items-center gap-2 ${selectionMode ? 'bg-emerald-600 text-white border-white/10' : 'bg-white/5 text-white/80 border-white/10'}`}
            >
              <CheckCircle2 size={16} />
              <span className="whitespace-nowrap">Присоединение</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap lg:flex-nowrap lg:overflow-x-auto lg:whitespace-nowrap">
              <div className="relative" ref={groupMenuRef}>
              <button
                onClick={() => {
                  if (groupMenuRef.current) {
                    const rect = groupMenuRef.current.getBoundingClientRect()
                    setGroupMenuPos({ top: rect.bottom + 8, left: rect.left, width: 288 }) // 288px = w-72
                  }
                  setGroupMenuOpen(o => !o)
                }}
                className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center justify-center gap-2 sm:shrink-0 hover:bg-white/10 transition-colors"
              >
                <span className="whitespace-nowrap btn-label-force">{groupFilterTitle}</span>
                <ChevronDown size={16} className={`text-white/70 transition-transform ${groupMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {groupMenuOpen && createPortal(
                <div
                  className="fixed z-[11000] bg-white/10 backdrop-blur border border-white/20 rounded-xl shadow-xl p-2"
                  style={{ top: groupMenuPos.top, left: groupMenuPos.left, width: groupMenuPos.width }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="p-2">
                    <input
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/50 text-sm focus:outline-none focus:bg-white/15 transition-colors"
                      placeholder="Поиск группы..."
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      onMouseDown={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => { setFilterGroupId(''); setGroupSearch(''); setGroupMenuOpen(false) }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg ${!filterGroupId ? 'bg-black/20 text-white font-medium' : 'text-white/80 hover:bg-black/10 hover:text-white'}`}
                    >
                      Все участники
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFilterGroupId(NO_GROUP_ID); setGroupSearch(''); setGroupMenuOpen(false) }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors rounded-lg ${filterGroupId === NO_GROUP_ID ? 'bg-black/20 text-white font-medium' : 'text-white/80 hover:bg-black/10 hover:text-white'}`}
                    >
                      Без группы
                    </button>
                    {groupOptions
                      .filter(g => {
                        const q = (groupSearch || '').trim().toLowerCase()
                        if (!q) return true
                        return (g.name || '').toLowerCase().includes(q)
                      })
                      .map(g => (
                      <button
                        key={g.id}
                        onClick={() => { setFilterGroupId(g.id); setGroupMenuOpen(false) }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-colors rounded-lg ${filterGroupId === g.id ? 'bg-black/20 text-white font-medium' : 'text-white/80 hover:bg-black/10 hover:text-white'}`}
                      >
                        <span className="truncate mr-2">{g.name}</span>
                        <span className="text-xs text-white/50 shrink-0">{Number(g.count_participants || 0)} чел.</span>
                      </button>
                    ))}
                    {groupOptions.length === 0 && (
                      <div className="px-4 py-3 text-sm text-white/40 text-center">Нет групп</div>
                    )}
                  </div>
                </div>,
                document.body
              )}
              </div>
              <BulkUploadButton onUploaded={async () => {
                const list = await api.users.students.list()
                setStudents(Array.isArray(list) ? list : [])
              }} />
            </div>

            {selectionMode && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">
                <div className="relative" ref={attachMenuRef}>
                  <button
                    onClick={() => {
                      if (attachMenuRef.current) {
                        const rect = attachMenuRef.current.getBoundingClientRect()
                        setAttachMenuPos({ top: rect.bottom + 8, left: rect.left, width: 288 })
                      }
                      setAttachMenuOpen(o => !o)
                    }}
                    className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center gap-2 min-w-[220px] justify-between shrink-0 hover:bg-white/10 transition-colors"
                    title="Выбрать группу"
                  >
                    <span className="truncate">{attachGroupId ? `${(groups.find(g => g.id === attachGroupId)?.name) || 'Группа'}` : 'Выберите группу'}</span>
                    <ChevronDown size={16} className={`text-white/70 transition-transform ${attachMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {attachMenuOpen && createPortal(
                    <div
                      className="fixed z-[11000] bg-white/10 backdrop-blur border border-white/20 rounded-xl shadow-xl p-2"
                      style={{ top: attachMenuPos.top, left: attachMenuPos.left, width: attachMenuPos.width || 288 }}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <div className="max-h-64 overflow-auto custom-scrollbar flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => { setAttachGroupId(''); setAttachMenuOpen(false) }}
                          className="w-full text-left px-4 py-3 text-white/90 hover:bg-black/10 rounded-lg"
                        >
                          Не выбрано
                        </button>
                        {groups.map(g => {
                          const active = g.id === attachGroupId
                          const disabled = !!g.is_overflow
                          return (
                            <button
                              key={g.id}
                              onClick={() => {
                                if (disabled) return
                                setAttachGroupId(g.id)
                                setAttachMenuOpen(false)
                              }}
                              disabled={disabled}
                              className={`w-full text-left px-4 py-3 flex items-center justify-between rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : active ? 'bg-black/20 text-white' : 'text-white hover:bg-black/10'}`}
                            >
                              <span className="font-medium truncate mr-2">{g.name}</span>
                              <span className="text-xs text-[#266479] shrink-0">{g.is_overflow ? 'Переполнена' : `${Number(g.count_participants || 0)} чел.`}</span>
                            </button>
                          )
                        })}
                        {groups.length === 0 && (
                          <div className="px-4 py-3 text-sm text-white/40 text-center">Нет групп</div>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>

                <button
                  onClick={confirmAttach}
                  className="w-full sm:w-auto px-3 lg:px-4 h-11 rounded-xl !bg-emerald-600 !border-emerald-600/40 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  disabled={
                    !attachGroupId || selectedIds.filter(id => !isInAnyGroup(id)).length === 0
                  }
                  title={
                    selectedIds.some(id => isInAnyGroup(id))
                      ? 'Некоторые отмеченные уже состоят в группе'
                      : ''
                  }
                >
                  <CheckCircle2 size={16} />
                  <span className="whitespace-nowrap btn-label-force">Подтвердить</span>
                </button>
              </div>
            )}
          </div>

          {groupActionError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{groupActionError}</div>
          )}

          <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
            <AnimatePresence initial={false}>
              {filtered
                .filter(s => !selectionMode || !isInAnyGroup(s.id))
                .map(s => (
                  <Motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, borderWidth: 0 }}
                    className="admin-card rounded-2xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelected(s.id)}
                          disabled={isInAnyGroup(s.id)}
                          title={isInAnyGroup(s.id) ? 'Ученик уже состоит в группе' : ''}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-medium break-words">
                          {s.display_name || [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(' ')}
                        </div>
                        <div className="text-[#266479] text-sm truncate" title={s.email}>{s.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => { setInfoStudentId(s.id); setInfoOpen(true) }} className="px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center gap-2 shrink-0">
                        <UserRound size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Информация</span>
                      </button>
                      <button onClick={() => openStudentCourses(s.id)} className="px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center gap-2 shrink-0">
                        <BookOpen size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Курсы (доп. образование)</span>
                      </button>
                      <button onClick={() => openEdit(s)} className="px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center gap-2 shrink-0">
                        <Pencil size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Редактировать</span>
                      </button>
                      <button onClick={() => openDeleteStudent(s)} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                        <Trash2 size={16} />
                        <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить</span>
                      </button>
                      {filterGroupId && String(s?.group?.id || '') === String(filterGroupId) && (
                        <button onClick={() => detachFromGroup(filterGroupId, s.id)} className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 !border-red-600/40 text-white flex items-center gap-2 shrink-0">
                          <Trash2 size={16} />
                          <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить из группы</span>
                        </button>
                      )}
                    </div>
                  </Motion.div>
                ))}
            </AnimatePresence>
            {(() => {
              const shown = filtered.filter(s => !selectionMode || !isInAnyGroup(s.id)).length
              if (shown === 0) {
                return <div className="text-gray-400 text-sm">{selectionMode ? 'Нет доступных для присоединения' : 'Нет участников'}</div>
              }
              return null
            })()}
          </div>
        </div>
        <div className="space-y-3">
          <div className="modal-panel rounded-2xl p-4">
            <div className="text-[#0f2e3a] font-medium mb-2">Группы</div>
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {groups.map(g => (
                <div key={g.id} className="rounded-xl bg-white border border-[#266479]/20 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[#0f2e3a]">{g.name}</div>
                    <div className="text-xs text-[#5a7280]">{Number(g.count_participants || 0)} чел.</div>
                  </div>
                  {(() => {
                    const isOpen = filterGroupId === g.id
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRenameGroup(g)}
                          className="p-2 rounded-xl border bg-white border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 inline-flex items-center justify-center"
                          title="Изменить название"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteGroup(g)}
                          className="p-2 rounded-xl border bg-white border-[#266479]/20 text-red-700 hover:brightness-105 inline-flex items-center justify-center"
                          title="Удалить группу"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isOpen && (
                          <button
                            onClick={() => openGroupCourses(g.id)}
                            className="px-3 py-1 rounded-xl border text-xs bg-white border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 inline-flex items-center gap-1.5"
                          >
                            <BookOpen size={14} />
                            <span>Курсы</span>
                          </button>
                        )}
                        <button
                          onClick={() => setFilterGroupId(isOpen ? '' : g.id)}
                          className={`px-3 py-1 rounded-xl border text-xs ${isOpen ? 'bg-emerald-600 text-white border-[#266479]/20 hover:bg-emerald-600' : 'bg-white border-[#266479]/20 text-[#0f2e3a] hover:brightness-105'}`}
                        >
                          {isOpen ? 'Назад' : 'Открыть'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ))}
              {groups.length === 0 && (
                <div className="text-[#5a7280] text-sm">Группы ещё не созданы</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {createGroupOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setCreateGroupOpen(false); setCreateGroupError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-md p-6 relative">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Название группы</label>
                  <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                {createGroupError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createGroupError}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setCreateGroupOpen(false); setCreateGroupError('') }} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button onClick={submitCreateGroup} className="px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>Создать</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameGroupOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setRenameGroupOpen(false); setRenameGroupError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-md p-6 relative">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Название группы</label>
                  <input value={renameGroupName} onChange={e => setRenameGroupName(e.target.value)} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                {renameGroupError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{renameGroupError}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setRenameGroupOpen(false); setRenameGroupError('') }} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button disabled={renameGroupSubmitting} onClick={submitRenameGroup} className={`px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2 ${renameGroupSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <CheckCircle2 size={18} />
                  <span>Сохранить</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteGroupOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setDeleteGroupOpen(false); setDeleteGroupError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-md p-6 relative">
              <div className="text-lg font-semibold text-[#0f2e3a] mb-2">Удалить группу</div>
              <div className="text-sm text-[#5a7280]">
                Группа <span className="font-semibold text-[#0f2e3a]">{deleteGroupName || '—'}</span> будет удалена. Все учащиеся этой группы станут «без группы».
              </div>
              {deleteGroupError && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{deleteGroupError}</div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setDeleteGroupOpen(false); setDeleteGroupError('') }} className="px-5 py-2.5 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 transition-all shadow-sm flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button disabled={deleteGroupSubmitting} onClick={submitDeleteGroup} className={`px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2 ${deleteGroupSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Trash2 size={18} />
                  <span>Удалить</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupCoursesOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setGroupCoursesOpen(false)} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-6xl p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-lg font-semibold text-[#0f2e3a]">
                  Курсы группы: {(groups.find(g => String(g.id) === String(groupCoursesGroupId))?.name) || ''}
                </div>
                <button onClick={() => setGroupCoursesOpen(false)} className="p-2 rounded-xl !bg-red-600 !border-red-500/20 text-white flex items-center justify-center">
                  <X size={18} />
                </button>
              </div>

              {groupCoursesError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{groupCoursesError}</div>
              )}
              {allCoursesError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{allCoursesError}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[#266479]/20 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[#0f2e3a] font-medium">Прикрепленные курсы</div>
                  </div>
                  {groupCoursesLoading ? (
                    <div className="text-sm text-[#5a7280]">Загрузка…</div>
                  ) : (
                    (() => {
                      const visibleGroupCourses = groupCourses.filter(c => String(c?.course_type || '') !== 'simple')
                      return (
                        <div className="space-y-2">
                          {visibleGroupCourses.map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#266479]/20 bg-white">
                              <div className="min-w-0">
                                <div className="text-[#0f2e3a] font-medium truncate">{c.title || c.name || `Курс #${c.id}`}</div>
                                <div className="text-xs text-[#5a7280] truncate">{c.course_type_display || c.course_type || ''}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => openTeacherAttach(c)} className="px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 whitespace-nowrap">
                                  Преподаватели
                                </button>
                                <button onClick={() => detachCourse(c.id)} className="px-3 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white whitespace-nowrap">
                                  Открепить
                                </button>
                              </div>
                            </div>
                          ))}
                          {visibleGroupCourses.length === 0 && (
                            <div className="text-sm text-[#5a7280]">Курсы не прикреплены</div>
                          )}
                        </div>
                      )
                    })()
                  )}
                </div>

                <div className="rounded-2xl border border-[#266479]/20 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[#0f2e3a] font-medium">Прикрепить курсы</div>
                  </div>
                  <div className="mb-3">
                    <input
                      value={coursePickerQuery}
                      onChange={(e) => setCoursePickerQuery(e.target.value)}
                      className="w-full bg-white border border-[#266479]/20 rounded-xl px-3 py-2 text-sm text-[#0f2e3a]"
                      placeholder="Поиск курса..."
                    />
                  </div>
                  {allCoursesLoading ? (
                    <div className="text-sm text-[#5a7280]">Загрузка…</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-auto pr-1 custom-scrollbar">
                      {allCourses
                        .filter(c => String(c?.course_type || '') !== 'simple')
                        .filter(c => {
                          const q = (coursePickerQuery || '').trim().toLowerCase()
                          if (!q) return true
                          const title = String(c?.title || c?.name || '').toLowerCase()
                          const slug = String(c?.slug || '').toLowerCase()
                          return title.includes(q) || slug.includes(q)
                        })
                        .map(c => {
                          const checked = selectedCourseIds.some(id => String(id) === String(c.id))
                          return (
                            <label key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#266479]/20 hover:bg-black/5'}`}>
                              <div className="min-w-0">
                                <div className="text-[#0f2e3a] font-medium truncate">{c.title || c.name || `Курс #${c.id}`}</div>
                                <div className="text-xs text-[#5a7280] truncate">{c.course_type_display || c.course_type || ''}</div>
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const on = e.target.checked
                                  setSelectedCourseIds(prev => {
                                    const next = prev.map(String)
                                    const cid = String(c.id)
                                    if (on) return Array.from(new Set([...next, cid]))
                                    return next.filter(x => x !== cid)
                                  })
                                }}
                                className="w-4 h-4 rounded accent-emerald-600"
                              />
                            </label>
                          )
                        })}
                      {allCourses.filter(c => String(c?.course_type || '') !== 'simple').length === 0 && (
                        <div className="text-sm text-[#5a7280]">Курсы не найдены</div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button onClick={() => setGroupCoursesOpen(false)} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                      <span>Отмена</span>
                    </button>
                    <button onClick={saveGroupCourses} className="px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2">
                      <span>Сохранить</span>
                    </button>
                  </div>
                </div>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {studentCoursesOpen && (
          <Motion.div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setStudentCoursesOpen(false)} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-xl p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-lg font-semibold text-[#0f2e3a]">Курсы ученика (доп. образование)</div>
                <button onClick={() => setStudentCoursesOpen(false)} className="p-2 rounded-xl !bg-red-600 !border-red-500/20 text-white flex items-center justify-center">
                  <X size={18} />
                </button>
              </div>
              {studentCoursesError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{studentCoursesError}</div>
              )}
              {studentCoursesLoading && !studentCourses.length ? (
                <div className="text-[#5a7280]">Загрузка курсов…</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {studentCourses.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#266479]/20 bg-white">
                      <div className="font-medium text-[#0f2e3a] truncate">{c.title}</div>
                      <button onClick={() => detachSimpleCourse(c.id)} className="p-2 rounded-xl !bg-red-600 !border-red-500/20 text-white hover:!bg-red-700 flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {studentCourses.length === 0 && (
                    <div className="text-[#5a7280]">Нет прикрепленных курсов</div>
                  )}
                </div>
              )}
              <div className="mt-6 pt-4 border-t border-[#266479]/10">
                <div className="text-[#0f2e3a] font-medium mb-3">Прикрепить к доп. образованию</div>
                <div className="relative">
                  <input
                    value={coursePickerQuery}
                    onChange={e => setCoursePickerQuery(e.target.value)}
                    placeholder="Поиск по доп. образованию..."
                    className="w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-sm focus:outline-none mb-3 text-[#0f2e3a]"
                  />
                  {allCoursesLoading ? (
                    <div className="text-sm text-[#5a7280]">Загрузка…</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
                      {allSimpleCourses
                        .filter(c => c.title.toLowerCase().includes(coursePickerQuery.toLowerCase()))
                        .map(c => {
                          const checked = selectedSimpleCourseIds.includes(c.id)
                          return (
                            <label key={c.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-emerald-500/40 bg-emerald-50' : 'border-[#266479]/20 bg-white hover:bg-[#e6f1f6]'}`}>
                              <span className={`font-medium text-sm truncate mr-3 ${checked ? 'text-emerald-700' : 'text-[#0f2e3a]'}`}>{c.title}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const val = e.target.checked
                                  setSelectedSimpleCourseIds(prev => {
                                    const next = [...prev]
                                    if (val && !next.includes(c.id)) next.push(c.id)
                                    else if (!val) return next.filter(x => x !== c.id)
                                    return next
                                  })
                                }}
                                className="w-4 h-4 rounded accent-emerald-600"
                              />
                            </label>
                          )
                        })}
                      {allSimpleCourses.length === 0 && (
                        <div className="text-sm text-[#5a7280]">Курсы не найдены</div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button onClick={() => setStudentCoursesOpen(false)} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                      <span>Отмена</span>
                    </button>
                    <button onClick={saveStudentCourses} className="px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2">
                      <span>Сохранить</span>
                    </button>
                  </div>
                </div>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {teacherAttachOpen && (
          <Motion.div className="fixed inset-0 z-[10020] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setTeacherAttachOpen(false)} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-2xl p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="text-lg font-semibold text-[#0f2e3a]">
                  Преподаватели: {teacherAttachCourse?.title || teacherAttachCourse?.name || ''}
                </div>
                <button onClick={() => setTeacherAttachOpen(false)} className="p-2 rounded-xl !bg-red-600 !border-red-500/20 text-white flex items-center justify-center">
                  <X size={18} />
                </button>
              </div>

              {teacherAttachError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{teacherAttachError}</div>
              )}

              <div className="rounded-2xl border border-[#266479]/20 bg-white p-4 mb-4">
                <div className="text-[#0f2e3a] font-medium mb-3">Прикрепить преподавателя к предмету</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <label className="block text-xs text-[#5a7280] mb-1">Семестр</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (teacherAttachLoading || semesters.length === 0) return
                        setSemesterMenuOpen(o => !o)
                      }}
                      disabled={teacherAttachLoading || semesters.length === 0}
                      className={`w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-left text-[#0f2e3a] flex items-center justify-between ${
                        (teacherAttachLoading || semesters.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span className="truncate">
                        {(() => {
                          const s = semesters.find(x => String(x.id) === String(selectedSemesterId))
                          return s ? (s.title || `Семестр #${s.id}`) : (semesters.length ? 'Выберите семестр' : 'Семестры не найдены')
                        })()}
                      </span>
                      <ChevronDown size={16} className={`text-[#266479] transition-transform ${semesterMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {semesterMenuOpen && (
                        <Motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="absolute z-10 mt-2 w-full rounded-xl border border-[#266479]/20 bg-white shadow-xl"
                        >
                          <div className="p-2 border-b border-[#266479]/10">
                            <input
                              value={semesterQuery}
                              onChange={(e) => setSemesterQuery(e.target.value)}
                              placeholder="Поиск..."
                              className="w-full bg-white border border-[#266479]/20 rounded-lg px-3 py-2 text-sm text-[#0f2e3a]"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-60 overflow-auto p-1">
                            {semesters
                              .filter(s => {
                                const q = (semesterQuery || '').trim().toLowerCase()
                                if (!q) return true
                                const label = String(s.title || `Семестр #${s.id}`).toLowerCase()
                                return label.includes(q)
                              })
                              .map(s => {
                                const active = String(s.id) === String(selectedSemesterId)
                                const label = s.title || `Семестр #${s.id}`
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSemesterId(String(s.id))
                                      setSemesterMenuOpen(false)
                                      setSemesterQuery('')
                                      setNewAttachSubjectId('')
                                      setSubjectMenuOpen(false)
                                      setSubjectQuery('')
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg ${active ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-black/5 text-[#0f2e3a]'}`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                            {semesters.length === 0 && (
                              <div className="text-sm text-[#5a7280] px-3 py-2">Семестры не найдены</div>
                            )}
                          </div>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-[#5a7280] mb-1">Преподаватель</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSemesterId) return
                        setTeacherMenuOpen(o => !o)
                      }}
                      disabled={!selectedSemesterId}
                      className={`w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-left text-[#0f2e3a] flex items-center justify-between ${
                        !selectedSemesterId ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span className="truncate">
                        {(() => {
                          const t = teachers.find(x => String(x.id) === String(newAttachTeacherId))
                          return t ? (t.display_name || [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(' ') || t.email) : 'Выберите преподавателя'
                        })()}
                      </span>
                      <ChevronDown size={16} className="text-[#266479]" />
                    </button>
                    <AnimatePresence>
                      {teacherMenuOpen && (
                        <Motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="absolute z-10 mt-2 w-full rounded-xl border border-[#266479]/20 bg-white shadow-xl"
                        >
                          <div className="p-2 border-b border-[#266479]/10">
                            <input
                              value={teacherQuery}
                              onChange={(e) => setTeacherQuery(e.target.value)}
                              placeholder="Поиск..."
                              className="w-full bg-white border border-[#266479]/20 rounded-lg px-3 py-2 text-sm text-[#0f2e3a]"
                            />
                          </div>
                          <div className="max-h-60 overflow-auto p-1">
                            {teachers
                              .filter(t => {
                                const q = (teacherQuery || '').trim().toLowerCase()
                                if (!q) return true
                                const label = (t.display_name || [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(' ') || t.email || '').toLowerCase()
                                return label.includes(q)
                              })
                              .map(t => {
                                const active = String(t.id) === String(newAttachTeacherId)
                                const label = t.display_name || [t.last_name, t.first_name, t.middle_name].filter(Boolean).join(' ') || t.email
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => { setNewAttachTeacherId(String(t.id)); setTeacherMenuOpen(false) }}
                                    className={`w-full text-left px-3 py-2 rounded-lg ${active ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-black/5 text-[#0f2e3a]'}`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                          </div>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-[#5a7280] mb-1">Предмет</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedSemesterId) return
                        setSubjectMenuOpen(o => !o)
                      }}
                      disabled={!selectedSemesterId}
                      className={`w-full bg-white border border-[#266479]/20 rounded-xl px-4 py-3 text-left text-[#0f2e3a] flex items-center justify-between ${
                        !selectedSemesterId ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <span className="truncate">
                        {(() => {
                          const s = subjects.find(x => String(x.id) === String(newAttachSubjectId))
                          return s ? (s.title || `Предмет #${s.id}`) : 'Выберите предмет'
                        })()}
                      </span>
                      <ChevronDown size={16} className="text-[#266479]" />
                    </button>
                    <AnimatePresence>
                      {subjectMenuOpen && (
                        <Motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="absolute z-10 mt-2 w-full rounded-xl border border-[#266479]/20 bg-white shadow-xl"
                        >
                          <div className="p-2 border-b border-[#266479]/10">
                            <input
                              value={subjectQuery}
                              onChange={(e) => setSubjectQuery(e.target.value)}
                              placeholder="Поиск..."
                              className="w-full bg-white border border-[#266479]/20 rounded-lg px-3 py-2 text-sm text-[#0f2e3a]"
                            />
                          </div>
                          <div className="max-h-60 overflow-auto p-1">
                            {subjects
                              .filter(s => {
                                const q = (subjectQuery || '').trim().toLowerCase()
                                if (!q) return true
                                const label = String(s.title || `Предмет #${s.id}`).toLowerCase()
                                return label.includes(q)
                              })
                              .map(s => {
                                const active = String(s.id) === String(newAttachSubjectId)
                                const label = s.title || `Предмет #${s.id}`
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => { setNewAttachSubjectId(String(s.id)); setSubjectMenuOpen(false) }}
                                    className={`w-full text-left px-3 py-2 rounded-lg ${active ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-black/5 text-[#0f2e3a]'}`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                          </div>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    onClick={addTeacherAttachment}
                    disabled={!selectedSemesterId || !newAttachTeacherId || !newAttachSubjectId || teacherAttachLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
                  >
                    Прикрепить
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#266479]/20 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[#0f2e3a] font-medium">Текущие привязки</div>
                </div>
                {!selectedSemesterId ? (
                  <div className="text-sm text-[#5a7280]">Сначала выберите семестр.</div>
                ) : teacherAttachLoading ? (
                  <div className="text-sm text-[#5a7280]">Загрузка…</div>
                ) : (
                  <div className="space-y-2">
                    {teacherAttachments.map(a => {
                      const teacherObj = (a && typeof a.teacher === 'object') ? a.teacher : null
                      const subjectObj = (a && typeof a.subject === 'object') ? a.subject : null
                      const teacherLabel = teacherObj?.display_name || [teacherObj?.last_name, teacherObj?.first_name, teacherObj?.middle_name].filter(Boolean).join(' ') || teacherObj?.email || (a.teacher ? `ID: ${a.teacher}` : '—')
                      const subjectLabel = subjectObj?.title || (a.subject ? `ID: ${a.subject}` : '—')
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[#266479]/20 bg-white">
                          <div className="min-w-0">
                            <div className="text-[#0f2e3a] font-medium truncate">{teacherLabel}</div>
                            <div className="text-xs text-[#5a7280] truncate">{subjectLabel}</div>
                          </div>
                          <button onClick={() => removeTeacherAttachment(a.id)} className="px-3 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white whitespace-nowrap">
                            Удалить
                          </button>
                        </div>
                      )
                    })}
                    {teacherAttachments.length === 0 && (
                      <div className="text-sm text-[#5a7280]">Привязок пока нет</div>
                    )}
                  </div>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setShowCreate(false); setForm(emptyStudentForm); setCreateStudentError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-2xl relative mx-4 my-6 max-h-[calc(100vh-3rem)] overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Фамилия</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Имя</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Отчество (необязательно)</label>
                  <input value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Почта</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Пароль</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Телефон (необязательно)</label>
                  <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Группа (необязательно)</label>
                  <div className="relative" ref={createGroupSelectRef}>
                    <button
                      type="button"
                      onClick={() => setCreateGroupSelectOpen(o => !o)}
                      className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-left text-[#0f2e3a] flex items-center justify-between focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <span className="truncate">{form.group ? form.group : 'Не выбрано'}</span>
                      <ChevronDown size={16} className={`text-[#266479] transition-transform ${createGroupSelectOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {createGroupSelectOpen && (
                        <Motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="absolute z-10 mt-2 w-full rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden"
                        >
                          <div className="p-2 border-b border-black/10 bg-black/[0.02]">
                            <input
                              value={createGroupQuery}
                              onChange={(e) => setCreateGroupQuery(e.target.value)}
                              placeholder="Поиск группы..."
                              className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm text-[#0f2e3a] placeholder-[#5a7280]/70 focus:outline-none focus:border-emerald-500/50 transition-all"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-60 overflow-auto p-1 custom-scrollbar">
                            <button
                              type="button"
                              onClick={() => { setForm(f => ({ ...f, group: '' })); setCreateGroupSelectOpen(false) }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 ${!form.group ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                            >
                              <span className="truncate">Не выбрано</span>
                            </button>
                            {groupsSorted
                              .filter(g => {
                                const q = (createGroupQuery || '').trim().toLowerCase()
                                if (!q) return true
                                return String(g.name || '').toLowerCase().includes(q)
                              })
                              .map(g => {
                                const active = String(g.name) === String(form.group)
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => { setForm(f => ({ ...f, group: g.name })); setCreateGroupSelectOpen(false) }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 ${active ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-[#0f2e3a] hover:bg-black/5'}`}
                                  >
                                    <span className="truncate">{g.name}</span>
                                    <span className="text-xs text-[#5a7280] shrink-0">{Number(g.count_participants || 0)} чел.</span>
                                  </button>
                                )
                              })}
                            {groupsSorted.length === 0 && (
                              <div className="px-3 py-2 text-sm text-[#5a7280]">Группы не найдены</div>
                            )}
                          </div>
                        </Motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              {createStudentError && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{createStudentError}</div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setShowCreate(false); setForm(emptyStudentForm); setCreateStudentError('') }} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button
                  onClick={submitCreateStudent}
                  disabled={!form.last_name.trim() || !form.first_name.trim() || !form.email.trim() || !form.password}
                  className={`px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2 ${(!form.last_name.trim() || !form.first_name.trim() || !form.email.trim() || !form.password) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CheckCircle2 size={18} />
                  <span>Создать</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setEditOpen(false); setEditStudentError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-[95vw] sm:w-[80vw] lg:w-[60vw] modal-panel rounded-2xl border border-white/15 p-6 h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Фамилия</label>
                  <input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Имя</label>
                  <input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Отчество</label>
                  <input value={editForm.middle_name} onChange={e => setEditForm(f => ({ ...f, middle_name: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Почта</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Телефон (необязательно)</label>
                  <input type="text" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-[#266479] mb-1 font-semibold uppercase tracking-wider">Группа</label>
                  <select
                    value={editForm.group || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, group: e.target.value }))}
                    className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-[#0f2e3a] focus:outline-none focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Без группы</option>
                    {groupsSorted.map(g => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {editStudentError && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{editStudentError}</div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setEditOpen(false); setEditStudentError('') }} className="px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button disabled={editStudentSubmitting} onClick={submitEdit} className={`px-5 py-2.5 rounded-xl !bg-emerald-600 !border-emerald-500/20 text-white font-semibold hover:!bg-emerald-700 transition-all shadow-md flex items-center gap-2 ${editStudentSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <CheckCircle2 size={18} />
                  <span>Сохранить</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteStudentOpen && (
          <Motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setDeleteStudentOpen(false); setDeleteStudentError('') }} />
            <Motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-2xl border border-white/15 w-full max-w-md p-6 relative">
              <div className="text-lg font-semibold text-[#0f2e3a] mb-2">Удалить учащегося</div>
              <div className="text-sm text-[#5a7280]">
                Учащийся <span className="font-semibold text-[#0f2e3a]">{deleteStudentLabel || '—'}</span> будет удалён. Личные чаты преподавателей с этим учащимся также будут удалены.
              </div>
              {deleteStudentError && (
                <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{deleteStudentError}</div>
              )}
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => { setDeleteStudentOpen(false); setDeleteStudentError('') }} className="px-5 py-2.5 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:brightness-105 transition-all shadow-sm flex items-center gap-2">
                  <X size={18} />
                  <span>Отмена</span>
                </button>
                <button disabled={deleteStudentSubmitting} onClick={submitDeleteStudent} className={`px-5 py-2.5 rounded-xl !bg-red-600 !border-red-500/20 text-white font-semibold hover:!bg-red-700 transition-all shadow-md flex items-center gap-2 ${deleteStudentSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <Trash2 size={18} />
                  <span>Удалить</span>
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
      <ProfileModal open={infoOpen} onClose={() => { setInfoOpen(false); setInfoStudentId('') }} studentId={infoStudentId} readonly />
    </Motion.div>
  )
}
