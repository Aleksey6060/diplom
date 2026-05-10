import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CustomSelect from '../../components/CustomSelect'
import { api } from '../../lib/api'

export default function TeacherSchedulePage() {
  const navigate = useNavigate()
  const { universitySlug } = useParams()
  const base = universitySlug ? `/${universitySlug}` : ''

  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleData, setScheduleData] = useState(null)
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setScheduleLoading(true)
      setScheduleError('')
      setScheduleData(null)
      try {
        const data = await api.courses.mySchedule({ universitySlug: universitySlug || null })
        if (cancelled) return
        if (Array.isArray(data?.entries)) {
          setScheduleData(data || null)
          return
        }
        throw new Error('Резервный режим загрузки')
      } catch {
        try {
          const groupsList = await api.groups.teacher.myGroups({ universitySlug: universitySlug || null })
          const groups = Array.isArray(groupsList) ? groupsList : (Array.isArray(groupsList?.results) ? groupsList.results : [])
          const batchSize = 4
          const allEntries = []
          let baseConfig = null

          const fetchOne = async (g) => {
            const semData = await api.groups.teacher.semesters(g.id, { universitySlug: universitySlug || null })
            const firstCourseId = semData?.[0]?.course?.id ?? null
            const firstSemesterId = semData?.[0]?.semesters?.[0]?.id ?? null
            if (!firstCourseId || !firstSemesterId) return { config: null, entries: [] }
            const sched = await api.groups.teacher.schedule(g.id, firstCourseId, firstSemesterId, { universitySlug: universitySlug || null })
            const entries = Array.isArray(sched?.entries) ? sched.entries : []
            const patched = entries.map(e => ({ ...e, group: e?.group || { id: g.id, name: g.name } }))
            return { config: sched?.config || null, entries: patched }
          }

          for (let i = 0; i < groups.length; i += batchSize) {
            if (cancelled) return
            const slice = groups.slice(i, i + batchSize)
            const settled = await Promise.allSettled(slice.map(fetchOne))
            for (const r of settled) {
              if (r.status !== 'fulfilled') continue
              if (!baseConfig && r.value?.config) baseConfig = r.value.config
              for (const e of (Array.isArray(r.value?.entries) ? r.value.entries : [])) allEntries.push(e)
            }
          }

          if (cancelled) return
          setScheduleData({ config: baseConfig, entries: allEntries })
        } catch {
          if (!cancelled) setScheduleError('Не удалось загрузить расписание')
        }
      } finally {
        if (!cancelled) setScheduleLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  const config = scheduleData?.config || { start_time: '09:00', lessons_per_day: 4, lesson_duration_minutes: 90, break_minutes: 10 }

  const semesterOptions = useMemo(() => {
    const entries = Array.isArray(scheduleData?.entries) ? scheduleData.entries : []
    const map = new Map()
    for (const e of entries) {
      const sid = e?.semester?.id ?? e?.semester_id ?? null
      if (sid == null) continue
      const title = e?.semester?.title ?? e?.semester_title ?? `Семестр #${sid}`
      map.set(Number(sid), String(title || `Семестр #${sid}`))
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'))
  }, [scheduleData])

  useEffect(() => {
    if (!semesterOptions.length) {
      if (semesterId != null) setSemesterId(null)
      return
    }
    if (semesterId == null || !semesterOptions.some(s => Number(s.id) === Number(semesterId))) {
      setSemesterId(semesterOptions[0].id)
    }
  }, [semesterOptions, semesterId])

  const entryMap = useMemo(() => {
    const m = new Map()
    for (const e of (Array.isArray(scheduleData?.entries) ? scheduleData.entries : [])) {
      if (semesterId != null) {
        const sid = e?.semester?.id ?? e?.semester_id ?? null
        if (sid == null || Number(sid) !== Number(semesterId)) continue
      }
      const w = e?.weekday
      const l = e?.lesson
      if (w == null || l == null) continue
      const key = `${Number(w)}-${Number(l)}`
      const prev = m.get(key)
      if (Array.isArray(prev)) prev.push(e)
      else m.set(key, [e])
    }
    return m
  }, [scheduleData, semesterId])

  const stepMobileWeekday = (dir) => {
    setMobileWeekday(prev => {
      const idx = weekdays.indexOf(prev)
      const nextIdx = idx === -1 ? 0 : (idx + dir + weekdays.length) % weekdays.length
      return weekdays[nextIdx]
    })
  }

  return (
    <div className="px-4 md:px-6">
      <div className="w-full space-y-4 pb-20">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="text-[#0f2e3a] font-semibold">Расписание</div>
          {semesterOptions.length > 0 && (
            <div className="space-y-1 w-full sm:w-[340px]">
              <div className="text-white/70 text-sm">Семестр</div>
              <CustomSelect
                value={semesterId ?? semesterOptions[0].id}
                onChange={(v) => setSemesterId(Number(v))}
                options={semesterOptions.map(s => ({ value: s.id, label: s.title }))}
                variant="glass"
              />
            </div>
          )}
        </div>

        {!!scheduleError && <div className="text-[#0f2e3a]">{scheduleError}</div>}
        {scheduleLoading && <div className="text-[#0f2e3a]">Загрузка…</div>}

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
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-[#266479]/15 text-[#0f2e3a] hover:bg-[#266479]/5'
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
                  const list = entryMap.get(`${mobileWeekday}-${lesson}`) || []
                  return (
                    <div key={`${mobileWeekday}-${lesson}`} className="rounded-2xl border border-[#266479]/15 bg-[#f7fbfd] p-4">
                      <div className="text-[#5a7280] text-xs">{lessonTimeLabel(lesson, config)}</div>
                      {Array.isArray(list) && list.length ? (
                        <div className="mt-2 space-y-2">
                          {list.map((e, idx2) => {
                            const g = e?.group || null
                            const groupName = g?.name || g?.title || e?.group_name || ''
                            const groupId = g?.id ?? e?.group_id ?? null
                            const subj = e?.subject || null
                            const aud = e?.auditorium || e?.room || ''
                            return (
                              <div key={`${mobileWeekday}-${lesson}-${idx2}`} className="rounded-xl border border-[#266479]/10 bg-white p-3 space-y-1">
                                <div className="flex items-center gap-2">
                                  {groupName ? (
                                    <button
                                      className="max-w-full inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#0f2e3a] text-white text-xs font-semibold leading-none hover:underline"
                                      onClick={() => { if (groupId) navigate(`${base}/teacher/groups/${groupId}`) }}
                                      type="button"
                                    >
                                      <span className="truncate">{groupName}</span>
                                    </button>
                                  ) : (
                                    <div className="max-w-full inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#0f2e3a] text-white text-xs font-semibold leading-none">
                                      <span className="truncate">Группа</span>
                                    </div>
                                  )}
                                </div>
                                {!!subj?.title && <div className="text-[#0f2e3a] text-sm font-semibold">{subj.title}</div>}
                                {!!aud && <div className="text-[#5a7280] text-xs">{aud}</div>}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-[#5a7280] text-sm">—</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="hidden md:block admin-card rounded-2xl p-4 overflow-auto custom-scrollbar">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-white">
                    <th className="text-left px-3 py-2 text-[#0f2e3a] font-semibold whitespace-nowrap w-40">Пара</th>
                    {[0, 1, 2, 3, 4, 5].map(w => (
                      <th key={w} className="text-left px-3 py-2 text-[#0f2e3a] font-semibold whitespace-nowrap">{weekdayLabels[w]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#266479]/10">
                  {Array.from({ length: Number(config?.lessons_per_day || 0) }).map((_, idx) => {
                    const lesson = idx + 1
                    return (
                      <tr key={lesson}>
                        <td className="px-3 py-2 text-[#0f2e3a] whitespace-nowrap">
                          {lessonTimeLabel(lesson, config)}
                        </td>
                        {[0, 1, 2, 3, 4, 5].map(w => {
                          const list = entryMap.get(`${w}-${lesson}`) || []
                          return (
                            <td key={`${w}-${lesson}`} className="px-3 py-2 align-top">
                              <div className="min-h-[52px] rounded-xl border border-[#266479]/15 bg-[#f7fbfd] p-2 space-y-1">
                                {Array.isArray(list) && list.length ? list.map((e, idx2) => {
                                  const g = e?.group || null
                                  const groupName = g?.name || g?.title || e?.group_name || ''
                                  const groupId = g?.id ?? e?.group_id ?? null
                                  const subj = e?.subject || null
                                  const aud = e?.auditorium || e?.room || ''
                                  return (
                                    <div key={`${w}-${lesson}-${idx2}`} className="rounded-lg border border-[#266479]/10 bg-white px-2 py-1.5">
                                      {groupName ? (
                                        <div className="flex items-center justify-center">
                                          <button
                                            className="max-w-full inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#0f2e3a] text-white text-xs font-semibold leading-none hover:underline"
                                            onClick={() => { if (groupId) navigate(`${base}/teacher/groups/${groupId}`) }}
                                            type="button"
                                          >
                                            <span className="truncate">{groupName}</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center">
                                          <div className="max-w-full inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#0f2e3a] text-white text-xs font-semibold leading-none">
                                            <span className="truncate">Группа</span>
                                          </div>
                                        </div>
                                      )}
                                      {!!subj?.title && <div className="text-[#5a7280] text-xs">{subj.title}</div>}
                                      {!!aud && <div className="text-[#5a7280] text-xs">{aud}</div>}
                                    </div>
                                  )
                                }) : (
                                  <div className="text-[#5a7280] text-xs">—</div>
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
    </div>
  )
}
