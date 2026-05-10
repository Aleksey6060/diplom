import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, apiRequest } from '../../../lib/api'

export default function TeacherGroups() {
  const navigate = useNavigate()
  const { universitySlug } = useParams()
  const base = universitySlug ? `/${universitySlug}` : ''
  const [groups, setGroups] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadGroups = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const loader = api?.groups?.teacher?.myGroups
        ? api.groups.teacher.myGroups
        : () => apiRequest('/api/groups/teacher/my-groups/', { method: 'GET', signal })
      const list = await loader()
      setGroups(Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : []))
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось загрузить группы'
      setError(String(msg))
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadGroups(controller.signal)
    return () => controller.abort()
  }, [loadGroups])

  const isEmpty = !loading && !error && (!Array.isArray(groups) || groups.length === 0)

  return (
    <div className="px-4 md:px-6">
      <div className="w-full space-y-4">
        <div className="flex items-center">
          <div className="text-[#0f2e3a] font-semibold">Мои группы</div>
        </div>
        {loading && <div className="text-[#0f2e3a]">Загрузка…</div>}
        {!!error && <div className="text-[#0f2e3a]">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(g => (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`${base}/teacher/groups/${g.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`${base}/teacher/groups/${g.id}`) }}
            className="admin-card rounded-2xl text-left flex items-center justify-between h-36 px-6 py-6 cursor-pointer"
          >
            <div>
              <div className="text-[#0f2e3a] font-semibold text-xl">{g.name}</div>
              <div className="text-[#5a7280] text-base">Учащихся: {g.studentsCount}</div>
            </div>
          </div>
        ))}
        </div>
        {isEmpty && <div className="text-[#0f2e3a]">Группы не найдены</div>}
      </div>
    </div>
  )
}
