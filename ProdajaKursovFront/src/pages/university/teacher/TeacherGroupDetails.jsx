import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CustomSelect from '../../../components/CustomSelect'
import { api, apiRequest } from '../../../lib/api'

export default function TeacherGroupDetails() {
  const { id, universitySlug } = useParams()
  const navigate = useNavigate()
  const base = universitySlug ? `/${universitySlug}` : ''
  const [sortOrder, setSortOrder] = useState('desc')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [semestersData, setSemestersData] = useState([])
  const [group, setGroup] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.groups.teacher.semesters(id, { universitySlug: universitySlug || null })
        if (cancelled) return
        setSemestersData(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setSemestersData([])
      }
    })()
    return () => { cancelled = true }
  }, [id, universitySlug])

  const semesterOptions = useMemo(() => {
    const map = new Map()
    map.set('', { value: '', label: 'Все семестры' })

    const rows = Array.isArray(semestersData) ? semestersData : []
    for (const row of rows) {
      const courseTitle = row?.course?.title ? String(row.course.title) : ''
      const sems = Array.isArray(row?.semesters) ? row.semesters : []
      for (const s of sems) {
        const sid = s?.id
        if (sid == null) continue
        const semesterTitle = s?.title ? String(s.title) : `Семестр ${sid}`
        const label = [courseTitle, semesterTitle].filter(Boolean).join(' • ')
        map.set(String(sid), { value: String(sid), label })
      }
    }

    const list = Array.isArray(assignments) ? assignments : []
    for (const a of list) {
      const sem = a?.subject?.semester || null
      const sid = sem?.id
      if (sid == null) continue
      if (map.has(String(sid))) continue
      const courseTitle = a?.subject?.course?.title ? String(a.subject.course.title) : ''
      const semesterTitle = sem?.title ? String(sem.title) : `Семестр ${sid}`
      const label = [courseTitle, semesterTitle].filter(Boolean).join(' • ')
      map.set(String(sid), { value: String(sid), label })
    }

    const arr = Array.from(map.values())
    const head = arr.shift()
    arr.sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'))
    return head ? [head, ...arr] : arr
  }, [assignments, semestersData])

  useEffect(() => {
    try {
      const key = `teacher_assignments_semester_${universitySlug || 'root'}_${id}`
      const saved = localStorage.getItem(key)
      if (saved == null) return
      if (semesterOptions.some(o => o.value === saved)) setSemesterFilter(saved)
    } catch {}
  }, [id, universitySlug, semesterOptions])

  useEffect(() => {
    try {
      const key = `teacher_assignments_semester_${universitySlug || 'root'}_${id}`
      localStorage.setItem(key, semesterFilter)
    } catch {}
  }, [id, universitySlug, semesterFilter])

  const loadAssignments = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const semesterId = semesterFilter ? semesterFilter : null
      const loader = api?.groups?.teacher?.groupAssignments
        ? () => api.groups.teacher.groupAssignments(id, { semesterId, universitySlug: universitySlug || null })
        : () => apiRequest(`/api/u/${universitySlug}/groups/teacher/groups/${id}/assignments/`, { method: 'GET', signal })
      const data = await loader()
      setGroup(data?.group || null)
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : [])
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось загрузить задания группы'
      setError(String(msg))
      setGroup(null)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [id, universitySlug, semesterFilter])

  useEffect(() => {
    const controller = new AbortController()
    void loadAssignments(controller.signal)
    return () => controller.abort()
  }, [loadAssignments])

  const items = useMemo(() => {
    const baseList = (Array.isArray(assignments) ? assignments : []).filter(a => {
      if (!semesterFilter) return true
      return String(a?.subject?.semester?.id || '') === String(semesterFilter)
    })
    const sorted = [...baseList].sort((a, b) => {
      return sortOrder === 'desc'
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    })
    return sorted
  }, [assignments, semesterFilter, sortOrder])

  return (
    <div className="px-4 md:px-6">
      <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`${base}/teacher/groups`)}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition"
        >
          ← Назад
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[#0f2e3a] font-semibold">Группа: {group?.name || id}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
          <div className="space-y-1 min-w-[240px]">
            <label className="block text-xs text-[#5a7280]">Семестр</label>
            <CustomSelect
              value={semesterFilter}
              onChange={setSemesterFilter}
              options={semesterOptions}
              variant="light"
              noGlobalButtonStyles={true}
            />
          </div>
          <div className="space-y-1 min-w-[240px]">
            <label className="block text-xs text-[#5a7280]">Сортировка</label>
            <CustomSelect
              value={sortOrder}
              onChange={setSortOrder}
              options={[
                { value: 'desc', label: 'Сначала новые' },
                { value: 'asc', label: 'Сначала старые' },
              ]}
              variant="light"
              noGlobalButtonStyles={true}
            />
          </div>
        </div>
      </div>

      {loading && <div className="text-[#0f2e3a]">Загрузка…</div>}
      {!!error && <div className="text-[#0f2e3a]">{error}</div>}
      <div className="space-y-3">
        {items.map(it => (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`${base}/teacher/groups/${id}/assignments/${it.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`${base}/teacher/groups/${id}/assignments/${it.id}`) }}
            className="admin-card w-full rounded-2xl p-4 text-left flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-[#0f2e3a] font-semibold">{it.title}</div>
              <div className="text-[#5a7280] text-sm">
                {(() => {
                  const courseTitle = it?.subject?.course?.title || ''
                  const semesterTitle = it?.subject?.semester?.title || ''
                  const subjectTitle = it?.subject?.title || ''
                  const meta = [courseTitle, semesterTitle, subjectTitle].filter(Boolean).join(' • ')
                  return meta ? meta : '—'
                })()}
              </div>
              <div className="text-[#5a7280] text-sm">Дата: {new Date(it.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-[#5a7280] text-sm">Открыть</div>
          </div>
        ))}
        {!items.length && <div className="text-[#0f2e3a]">Пусто</div>}
      </div>
      </div>
    </div>
  )
}
