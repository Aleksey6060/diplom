import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import CustomSelect from '../../components/CustomSelect'

export default function ProgressPage() {
  const { universitySlug } = useParams()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [scheduleData, setScheduleData] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [gradesRes, scheduleRes] = await Promise.allSettled([
          api.courses.grades.my({ universitySlug: universitySlug || null }),
          api.courses.mySchedule({ universitySlug: universitySlug || null }),
        ])
        if (cancelled) return

        if (gradesRes.status === 'fulfilled') {
          setData(gradesRes.value || [])
        } else {
          setData([])
        }

        if (scheduleRes.status === 'fulfilled') {
          setScheduleData(scheduleRes.value || null)
        } else {
          setScheduleData(null)
        }

        if (gradesRes.status !== 'fulfilled') {
          setError('Не удалось загрузить успеваемость')
        }
      } catch {
        if (!cancelled) setError('Не удалось загрузить успеваемость')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  const subjects = useMemo(() => {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.subjects)) return data.subjects
    if (Array.isArray(data?.results)) return data.results
    return []
  }, [data])

  const scheduleAvailable = useMemo(() => {
    const raw = scheduleData?.available
    return Array.isArray(raw) ? raw : []
  }, [scheduleData])

  const semesters = useMemo(() => {
    if (Array.isArray(data?.semesters)) return data.semesters
    return []
  }, [data])
  const semesterOptions = useMemo(() => {
    const map = new Map()

    for (const sem of (Array.isArray(semesters) ? semesters : [])) {
      const sid = sem?.id
      if (!sid) continue
      const courseTitle = sem?.course?.title ? String(sem.course.title) : ''
      const semesterTitle = sem?.title ? String(sem.title) : `Семестр ${sid}`
      map.set(String(sid), { value: String(sid), label: [courseTitle, semesterTitle].filter(Boolean).join(' • ') })
    }

    for (const c of (Array.isArray(scheduleAvailable) ? scheduleAvailable : [])) {
      const courseTitle = c?.course?.title ? String(c.course.title) : ''
      const sems = Array.isArray(c?.semesters) ? c.semesters : []
      for (const sem of sems) {
        const sid = sem?.id
        if (!sid) continue
        if (map.has(String(sid))) continue
        const semesterTitle = sem?.title ? String(sem.title) : `Семестр ${sid}`
        map.set(String(sid), { value: String(sid), label: [courseTitle, semesterTitle].filter(Boolean).join(' • ') })
      }
    }

    for (const block of subjects) {
      const s = block?.subject || {}
      const sem = s?.semester || {}
      const sid = sem?.id
      if (!sid) continue
      if (map.has(String(sid))) continue
      const courseTitle = s?.course?.title ? String(s.course.title) : ''
      const semesterTitle = sem?.title ? String(sem.title) : `Семестр ${sid}`
      map.set(String(sid), { value: String(sid), label: [courseTitle, semesterTitle].filter(Boolean).join(' • ') })
    }
    const arr = Array.from(map.values())
    arr.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    return arr
  }, [subjects, semesters, scheduleAvailable])

  useEffect(() => {
    try {
      const key = `grades_semester_filter_${universitySlug || 'root'}`
      const saved = localStorage.getItem(key)
      if (!saved) return
      if (semesterOptions.some(o => o.value === saved)) {
        setSemesterFilter(saved)
      }
    } catch {
      return
    }
  }, [universitySlug, semesterOptions])

  useEffect(() => {
    try {
      const key = `grades_semester_filter_${universitySlug || 'root'}`
      localStorage.setItem(key, semesterFilter)
    } catch {
      return
    }
  }, [universitySlug, semesterFilter])

  useEffect(() => {
    if (semesterOptions.length === 0) return
    if (semesterFilter && semesterOptions.some(o => o.value === semesterFilter)) return
    const fallback = scheduleData?.semester?.id != null ? String(scheduleData.semester.id) : null
    if (fallback && semesterOptions.some(o => o.value === fallback)) {
      setSemesterFilter(fallback)
      return
    }
    setSemesterFilter(semesterOptions[0].value)
  }, [semesterFilter, semesterOptions, scheduleData])

  const filteredSubjects = useMemo(() => {
    if (!semesterFilter) return subjects
    return subjects.filter(b => String(b?.subject?.semester?.id || '') === String(semesterFilter))
  }, [subjects, semesterFilter])

  return (
    <div className="space-y-6 pb-20">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-white/80">Загрузка…</div>
      )}

      {!loading && semesterOptions.length > 0 && (
        <div className="admin-card rounded-2xl p-4">
          <div className="space-y-1">
            <div className="text-white/70 text-sm">Семестр</div>
            <CustomSelect
              value={semesterFilter}
              onChange={setSemesterFilter}
              placeholder="Выберите семестр"
              options={semesterOptions}
              variant="glass"
            />
          </div>
        </div>
      )}

      {!loading && semesterOptions.length > 0 && filteredSubjects.length === 0 && (
        <div className="rounded-2xl modal-panel p-6" style={{ color: 'var(--content-text-muted)' }}>
          Информации пока нет
        </div>
      )}

      {!loading && semesterOptions.length === 0 && subjects.length === 0 && (
        <div className="rounded-2xl modal-panel p-6" style={{ color: 'var(--content-text-muted)' }}>
          Информации пока нет
        </div>
      )}

      {filteredSubjects.map((block) => {
        const s = block?.subject || {}
        const rows = Array.isArray(block?.items) ? block.items : (Array.isArray(block?.grades) ? block.grades : [])
        const subjectTitle = s?.title || 'Предмет'
        const courseTitle = s?.course?.title || ''
        const semesterTitle = s?.semester?.title || ''
        return (
          <div key={s?.id || subjectTitle} className="rounded-2xl modal-panel p-6">
            <div className="flex flex-col gap-1">
              <div className="text-xl font-bold" style={{ color: 'var(--content-text)' }}>{subjectTitle}</div>
              <div className="text-sm" style={{ color: 'var(--content-text-muted)' }}>
                {[courseTitle, semesterTitle].filter(Boolean).join(' • ')}
              </div>
            </div>

            <div className="mt-4 sm:hidden space-y-3">
              {rows.map((row, idx) => {
                const a = row?.assignment || {}
                const g = row?.grade || null
                const value = g?.value
                const max = a?.max_grade
                const kind = a?.kind === 'test' ? 'Тест' : 'Задание'
                const rowTitle = a?.title || '—'
                const rowKey = `${s?.id || 'subject'}-${a?.id || 'assignment'}-${g?.id || 'grade'}-${idx}`
                return (
                  <div
                    key={rowKey}
                    className="rounded-xl border p-4"
                    style={{ borderColor: 'rgba(38, 100, 121, 0.18)', background: 'var(--surface-bg-strong)' }}
                  >
                    <div className="font-semibold" style={{ color: 'var(--content-text)' }}>{rowTitle}</div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--content-text-muted)' }}>{kind}</div>
                    <div className="mt-2 text-sm" style={{ color: 'var(--content-text)' }}>
                      {value == null ? '—' : (max ? `${value}/${max}` : String(value))}
                    </div>
                  </div>
                )
              })}
              {rows.length === 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(38, 100, 121, 0.18)', color: 'var(--content-text-muted)', background: 'var(--surface-bg-strong)' }}>
                  Заданий пока нет
                </div>
              )}
            </div>

            <div className="mt-4 hidden sm:block overflow-x-auto">
              <table className="min-w-[45rem] w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold px-3 py-2 border-b" style={{ color: 'var(--content-text-muted)', borderColor: 'rgba(38, 100, 121, 0.18)' }}>Задание</th>
                    <th className="text-left text-xs font-semibold px-3 py-2 border-b" style={{ color: 'var(--content-text-muted)', borderColor: 'rgba(38, 100, 121, 0.18)' }}>Тип</th>
                    <th className="text-left text-xs font-semibold px-3 py-2 border-b" style={{ color: 'var(--content-text-muted)', borderColor: 'rgba(38, 100, 121, 0.18)' }}>Оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const a = row?.assignment || {}
                    const g = row?.grade || null
                    const value = g?.value
                    const max = a?.max_grade
                    const kind = a?.kind === 'test' ? 'Тест' : 'Задание'
                    const rowTitle = a?.title || '—'
                    const rowKey = `${s?.id || 'subject'}-${a?.id || 'assignment'}-${g?.id || 'grade'}-${idx}`
                    return (
                      <tr key={rowKey}>
                        <td className="px-3 py-3 border-b" style={{ borderColor: 'rgba(38, 100, 121, 0.12)', color: 'var(--content-text)' }}>
                          {rowTitle}
                        </td>
                        <td className="px-3 py-3 border-b" style={{ borderColor: 'rgba(38, 100, 121, 0.12)', color: 'var(--content-text-muted)' }}>
                          {kind}
                        </td>
                        <td className="px-3 py-3 border-b" style={{ borderColor: 'rgba(38, 100, 121, 0.12)', color: 'var(--content-text)' }}>
                          {value == null ? '—' : (max ? `${value}/${max}` : String(value))}
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4" style={{ color: 'var(--content-text-muted)' }}>
                        Заданий пока нет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
