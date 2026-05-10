import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { api, apiRequest, apiRequestResponse } from '../../../lib/api'

export default function TeacherAssignment() {
  const { id, aid, universitySlug } = useParams()
  void universitySlug
  const [students, setStudents] = useState([])
  const [assignment, setAssignment] = useState(null)
  const [group, setGroup] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [work, setWork] = useState(null)
  const [workLoading, setWorkLoading] = useState(false)
  const [gradeValue, setGradeValue] = useState('')
  const [saving, setSaving] = useState(false)

  const current = useMemo(() => students.find(s => String(s.id) === String(selectedId)) || null, [students, selectedId])

  const loadAssignment = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const loader = api?.groups?.teacher?.assignmentDetail
        ? () => api.groups.teacher.assignmentDetail(id, aid)
        : () => apiRequest(`/api/groups/teacher/groups/${id}/assignments/${aid}/`, { method: 'GET', signal })
      const data = await loader()
      setGroup(data?.group || null)
      setAssignment(data?.assignment || null)
      const list = Array.isArray(data?.students) ? data.students : []
      setStudents(list)
      setSelectedId(prev => (prev ? prev : (list.length ? list[0].id : null)))
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось загрузить задание'
      setError(String(msg))
      setGroup(null)
      setAssignment(null)
      setStudents([])
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }, [aid, id])

  useEffect(() => {
    const controller = new AbortController()
    void loadAssignment(controller.signal)
    return () => controller.abort()
  }, [loadAssignment])

  const loadStudentWork = useCallback(async (studentId, signal) => {
    if (!studentId) return
    setWorkLoading(true)
    setError('')
    try {
      const loader = api?.groups?.teacher?.studentWork
        ? () => api.groups.teacher.studentWork(id, aid, studentId)
        : () => apiRequest(`/api/groups/teacher/groups/${id}/assignments/${aid}/students/${studentId}/`, { method: 'GET', signal })
      const data = await loader()
      setWork(data || null)
      const g = data?.grade
      setGradeValue(g?.value ?? '')
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось загрузить работу студента'
      setError(String(msg))
      setWork(null)
    } finally {
      setWorkLoading(false)
    }
  }, [aid, id])

  useEffect(() => {
    if (!selectedId) return
    const controller = new AbortController()
    void loadStudentWork(selectedId, controller.signal)
    return () => controller.abort()
  }, [loadStudentWork, selectedId])

  const saveGrade = async () => {
    if (!current) return
    const v = Number(gradeValue)
    if (!Number.isFinite(v)) return
    setSaving(true)
    setError('')
    try {
      const loader = api?.groups?.teacher?.setGrade
        ? () => api.groups.teacher.setGrade(id, aid, current.id, { value: v, comment: '' })
        : () => apiRequest(`/api/groups/teacher/groups/${id}/assignments/${aid}/students/${current.id}/grade/`, { method: 'PUT', body: { value: v, comment: '' } })
      const data = await loader()
      setWork(prev => ({ ...(prev || {}), grade: data }))
      setStudents(prev => (Array.isArray(prev) ? prev : []).map(s => String(s.id) === String(current.id) ? { ...s, grade: data } : s))
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось сохранить оценку'
      setError(String(msg))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 md:px-6">
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-3 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition"
        >
          ← Назад
        </button>
        <button
          onClick={() => loadAssignment()}
          className="px-4 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a]"
        >
          Обновить
        </button>
      </div>
      <div className="lg:col-span-2 admin-card rounded-2xl p-4">
        {loading && <div className="text-[#0f2e3a]">Загрузка…</div>}
        <div className="text-[#0f2e3a] font-bold text-2xl mb-2">
          {assignment?.title || 'Задание'}
        </div>
        <div className="text-[#0f2e3a] text-lg whitespace-pre-wrap">{assignment?.description || 'Описание отсутствует'}</div>
        {!!group?.name && (
          <div className="mt-3 text-[#5a7280] text-sm">Группа: {group.name}</div>
        )}
        {!!error && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
        )}
      </div>
      <div className="space-y-4">
        {/* Блок 1: Студенты */}
        <div className="admin-card rounded-2xl p-4">
          <div className="text-[#0f2e3a] font-semibold mb-2">Студенты</div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {students.map(s => {
              const active = s.id === selectedId
              const done = !!s.submitted_at
              const grade = s.grade
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedId(s.id)
                  }}
                  role="button"
                  tabIndex={0}
                  className={`admin-card w-full text-left px-3 py-3 rounded-xl flex items-center justify-between hover:brightness-[1.02] transition ${
                    active ? 'border-[#266479]/30' : ''
                  } cursor-pointer select-none`}
                >
                  <div>
                    <div className="font-medium text-[#0f2e3a]">{s.display_name}</div>
                    <div className="text-xs text-[#5a7280]">{s.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {Number.isFinite(Number(grade?.value)) && (
                      <div className="px-2 py-1 rounded-full bg-white border border-[#266479]/20 text-xs text-[#0f2e3a] whitespace-nowrap">
                        Оценка: {grade.value}/{assignment?.max_grade}
                      </div>
                    )}
                    <div className="text-sm text-[#5a7280] whitespace-nowrap">
                      {done ? 'Сдано' : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Блок 2: Работа + Оценка */}
        <div className="admin-card rounded-2xl p-4">
          <div className="text-[#0f2e3a] font-semibold">Работа</div>
          {!current ? (
            <div className="mt-2 text-[#5a7280] text-sm">Выберите студента</div>
          ) : workLoading ? (
            <div className="mt-2 text-[#5a7280] text-sm">Загрузка…</div>
          ) : !work?.submission || !Array.isArray(work?.submission?.files) || work.submission.files.length === 0 ? (
            <div className="mt-2 text-[#5a7280] text-sm">Файлы не прикреплены</div>
          ) : (
            <div className="mt-3 space-y-2">
              {work.submission.files.map(f => (
                <button
                  key={f.id}
                  onClick={async () => {
                    const fetcher = api?.groups?.teacher?.fetchStudentFile
                      ? () => api.groups.teacher.fetchStudentFile(id, aid, current.id, f.id)
                      : async () => {
                        const res = await apiRequestResponse(`/api/groups/teacher/groups/${id}/assignments/${aid}/students/${current.id}/files/${f.id}/`, { method: 'GET' })
                        const blob = await res.blob()
                        const cd = res.headers.get('content-disposition') || ''
                        const match = cd.match(/filename="([^"]+)"/i)
                        const filename = match?.[1] || null
                        return { blob, filename, contentType: res.headers.get('content-type') || null }
                      }
                    const { blob, contentType, filename } = await fetcher()
                    const finalName = filename || f.name || `file-${f.id}`
                    const url = URL.createObjectURL(contentType ? new Blob([blob], { type: contentType }) : blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = finalName
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    setTimeout(() => URL.revokeObjectURL(url), 30_000)
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] flex items-center justify-between"
                >
                  <span className="truncate">{f.name}</span>
                  <Download size={16} className="shrink-0" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-4">
            <label className="block text-xs text-[#5a7280] mb-1">Оценка</label>
            <input value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} className="w-full bg-white border border-[#266479]/20 rounded-xl px-3 py-2 text-[#0f2e3a]" />
            <div className="mt-3 flex items-center justify-end">
              <button onClick={saveGrade} disabled={saving || !current} className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50">
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
