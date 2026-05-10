import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import CustomSelect from '../../components/CustomSelect'
import { api } from '../../lib/api'

export default function SchedulePage() {
  const { universitySlug } = useParams()
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleData, setScheduleData] = useState(null)
  const [courseId, setCourseId] = useState(null)
  const [semesterId, setSemesterId] = useState(null)
  const [mobileWeekday, setMobileWeekday] = useState(() => {
    const d = new Date()
    const js = d.getDay()
    return js === 0 ? 0 : js - 1
  })
  const touchXRef = useRef(null)

  const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const weekdays = [0, 1, 2, 3, 4, 5]

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

  const lessonTimeLabel = (lessonNumber, config) => {
    const startMins = toMinutes(config?.start_time)
    const dur = Number(config?.lesson_duration_minutes || 0)
    const br = Number(config?.break_minutes || 0)
    if (startMins == null || !Number.isFinite(dur) || !Number.isFinite(br)) return `Пара ${lessonNumber}`
    const breaks = Array.isArray(config?.breaks_minutes) ? config.breaks_minutes : []
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

  const available = useMemo(() => {
    const raw = scheduleData?.available
    return Array.isArray(raw) ? raw : []
  }, [scheduleData])

  const courseOptions = useMemo(() => {
    return available
      .map(row => ({
        id: row?.course?.id ?? null,
        title: row?.course?.title ?? '',
        semesters: Array.isArray(row?.semesters) ? row.semesters : [],
      }))
      .filter(r => r.id != null)
  }, [available])

  const selectedCourse = useMemo(() => {
    if (!courseOptions.length) return null
    if (courseId == null) return courseOptions[0]
    return courseOptions.find(c => Number(c.id) === Number(courseId)) || courseOptions[0]
  }, [courseId, courseOptions])

  const config = scheduleData?.config || { start_time: '09:00', lessons_per_day: 4, lesson_duration_minutes: 90, break_minutes: 10 }

  const entryMap = useMemo(() => {
    const m = new Map()
    for (const e of (Array.isArray(scheduleData?.entries) ? scheduleData.entries : [])) {
      const w = e?.weekday
      const l = e?.lesson
      if (w == null || l == null) continue
      m.set(`${Number(w)}-${Number(l)}`, e)
    }
    return m
  }, [scheduleData])

  const stepMobileWeekday = (dir) => {
    setMobileWeekday(prev => {
      const idx = weekdays.indexOf(prev)
      const nextIdx = idx === -1 ? 0 : (idx + dir + weekdays.length) % weekdays.length
      return weekdays[nextIdx]
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const data = await api.courses.mySchedule({ semesterId, universitySlug: universitySlug || null })
        if (cancelled) return
        setScheduleData(data || null)
        const nextCourseId = data?.course?.id ?? null
        const nextSemesterId = data?.semester?.id ?? null
        if (courseId == null && nextCourseId != null) setCourseId(nextCourseId)
        if (semesterId == null && nextSemesterId != null) setSemesterId(nextSemesterId)
        if (courseId == null && nextCourseId == null && Array.isArray(data?.available) && data.available[0]?.course?.id != null) {
          setCourseId(data.available[0].course.id)
          setSemesterId(data.available[0]?.semesters?.[0]?.id ?? null)
        }
      } catch {
        if (!cancelled) setScheduleError('Не удалось загрузить расписание')
      } finally {
        if (!cancelled) setScheduleLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [semesterId, universitySlug])

  return (
    <div className="space-y-4 pb-20">
      {scheduleError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-100">
          {scheduleError}
        </div>
      )}
      {scheduleLoading && <div className="text-white/80">Загрузка…</div>}

      {courseOptions.length > 0 && (
        <div className="admin-card rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-white/70 text-sm">Курс</div>
              <CustomSelect
                value={selectedCourse?.id ?? courseOptions[0].id}
                onChange={(v) => {
                  const nextCourseId = v != null ? Number(v) : null
                  setCourseId(nextCourseId)
                  const course = courseOptions.find(c => Number(c.id) === Number(nextCourseId)) || null
                  const firstSem = course?.semesters?.[0]?.id ?? null
                  setSemesterId(firstSem)
                }}
                options={courseOptions.map(c => ({ value: c.id, label: c.title || `Курс #${c.id}` }))}
                variant="glass"
              />
            </div>
            <div className="space-y-1">
              <div className="text-white/70 text-sm">Семестр</div>
              <CustomSelect
                value={semesterId ?? (selectedCourse?.semesters?.[0]?.id ?? '')}
                onChange={(v) => setSemesterId(Number(v))}
                options={(Array.isArray(selectedCourse?.semesters) ? selectedCourse.semesters : []).map(s => ({
                  value: s.id,
                  label: s.title || `Семестр #${s.id}`,
                }))}
                variant="glass"
              />
            </div>
          </div>
        </div>
      )}

      {!!scheduleData && (
        <>
          <div className="md:hidden admin-card rounded-2xl p-4">
            <div className="grid grid-cols-6 gap-2">
              {weekdays.map(w => {
                const isActive = Number(mobileWeekday) === Number(w)
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setMobileWeekday(w)}
                    className={`w-full px-2 py-2 rounded-xl border text-sm transition ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-white'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {weekdayLabels[w]}
                  </button>
                )
              })}
            </div>

            <div
              className="mt-4 space-y-3"
              onTouchStart={(e) => { touchXRef.current = e?.touches?.[0]?.clientX ?? null }}
              onTouchEnd={(e) => {
                const startX = touchXRef.current
                touchXRef.current = null
                const endX = e?.changedTouches?.[0]?.clientX ?? null
                if (startX == null || endX == null) return
                const dx = endX - startX
                if (Math.abs(dx) < 40) return
                if (dx < 0) stepMobileWeekday(1)
                else stepMobileWeekday(-1)
              }}
            >
              {Array.from({ length: Number(config?.lessons_per_day || 0) }).map((_, idx) => {
                const lesson = idx + 1
                const e = entryMap.get(`${mobileWeekday}-${lesson}`)
                const subj = e?.subject || null
                const t = e?.teacher || null
                return (
                  <div key={`${mobileWeekday}-${lesson}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-white/70 text-xs">{lessonTimeLabel(lesson, config)}</div>
                    {subj ? (
                      <div className="mt-2 space-y-1">
                        <div className="text-white text-sm font-semibold">{subj.title}</div>
                        {!!t?.display_name && <div className="text-[#266479] text-xs">{t.display_name}</div>}
                      </div>
                    ) : (
                      <div className="mt-2 text-white/30 text-sm">—</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="hidden md:block admin-card rounded-2xl p-4 overflow-auto custom-scrollbar">
            <table className="min-w-[980px] text-sm">
              <thead className="sticky top-0">
                <tr className="bg-black/30">
                  <th className="text-left px-3 py-2 text-white font-semibold whitespace-nowrap">Пара</th>
                  {[0, 1, 2, 3, 4, 5].map(w => (
                    <th key={w} className="text-left px-3 py-2 text-white font-semibold whitespace-nowrap">{weekdayLabels[w]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {Array.from({ length: Number(config?.lessons_per_day || 0) }).map((_, idx) => {
                  const lesson = idx + 1
                  return (
                    <tr key={lesson}>
                      <td className="px-3 py-2 text-white/80 whitespace-nowrap">
                        {lessonTimeLabel(lesson, config)}
                      </td>
                      {[0, 1, 2, 3, 4, 5].map(w => {
                        const e = entryMap.get(`${w}-${lesson}`)
                        const subj = e?.subject || null
                        const t = e?.teacher || null
                        return (
                          <td key={`${w}-${lesson}`} className="px-3 py-2 align-top">
                            <div className="min-h-[52px] rounded-xl border border-white/10 bg-white/5 p-2">
                              {subj ? (
                                <>
                                  <div className="text-white text-sm font-medium">{subj.title}</div>
                                  {!!t?.display_name && (
                                    <div className="text-[#266479] text-xs">{t.display_name}</div>
                                  )}
                                </>
                              ) : (
                                <div className="text-white/30 text-xs">—</div>
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
        </>
      )}
    </div>
  )
}
