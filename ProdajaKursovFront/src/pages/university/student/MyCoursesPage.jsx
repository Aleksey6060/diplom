import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSearch } from '../../../context/SearchContext'
import { motion, AnimatePresence } from 'framer-motion'
import { api, formatApiError } from '../../../lib/api'
import { BookOpen, ChevronRight } from 'lucide-react'

export default function MyCoursesPage() {
  const navigate = useNavigate()
  const { universitySlug } = useParams()
  const base = universitySlug ? `/${universitySlug}` : ''
  const { searchQuery } = useSearch()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('full')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const list = await api.courses.myCourses({ universitySlug: universitySlug || null })
        if (cancelled) return
        setCourses(Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : []))
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, 'Не удалось загрузить курсы'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  const filtered = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    const baseList = Array.isArray(courses) ? courses : []
    if (!q) return baseList
    return baseList.filter(c => String(c.title || '').toLowerCase().includes(q))
  }, [courses, searchQuery])

  const fullCourses = useMemo(() => filtered.filter(c => String(c.course_type) === 'full'), [filtered])
  const simpleCourses = useMemo(() => filtered.filter(c => String(c.course_type) === 'simple'), [filtered])
  const activeList = tab === 'simple' ? simpleCourses : fullCourses

  return (
    <div className="space-y-8 pb-20">
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-400 font-semibold whitespace-pre-line">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-white/80">Загрузка…</div>
      )}
      <div className="border border-white/10 rounded-2xl p-1 inline-flex gap-1 bg-white/5 backdrop-blur-md">
        <button
          onClick={() => setTab('full')}
          className={`px-4 h-10 rounded-xl text-sm font-semibold transition bg-transparent backdrop-blur-md ${tab === 'full' ? 'border border-white/20 text-white' : 'text-white/70 hover:text-white border border-transparent hover:border-white/10'}`}
        >
          Высшее образование ({fullCourses.length})
        </button>
        <button
          onClick={() => setTab('simple')}
          className={`px-4 h-10 rounded-xl text-sm font-semibold transition bg-transparent backdrop-blur-md ${tab === 'simple' ? 'border border-white/20 text-white' : 'text-white/70 hover:text-white border border-transparent hover:border-white/10'}`}
        >
          Дополнительное образование ({simpleCourses.length})
        </button>
      </div>

      {tab === 'full' ? (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {activeList.map(course => (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => navigate(`${base}/my-courses/${course.id}`)}
                  className="w-full text-left p-5 flex items-center justify-between rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 modal-item"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                      style={{ background: 'var(--surface-bg-strong)', borderColor: 'rgba(38, 100, 121, 0.18)' }}
                    >
                      <BookOpen size={18} style={{ color: 'var(--content-text)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-lg truncate">
                        {course.title || 'Без названия'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--content-text-muted)' }} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {!loading && activeList.length === 0 && (
            <div className="py-14 text-center text-gray-500">
              Пусто
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {activeList.map(course => (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`${base}/my-courses/${course.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`${base}/my-courses/${course.id}`)
                    }
                  }}
                  className="rounded-3xl overflow-hidden border transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 hover:brightness-105"
                  style={{
                    background: 'var(--surface-bg)',
                    borderColor: 'rgba(38, 100, 121, 0.18)',
                    color: 'var(--content-text)',
                  }}
                >
                  <div className="relative h-44 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent z-10" />
                    <img
                      src={course.store_card_image || `https://picsum.photos/seed/my-course-${course.id}/2000/1200`}
                      alt={course.title || 'Курс'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5" style={{ background: 'var(--surface-bg)' }}>
                    <div className="font-semibold text-lg leading-snug" style={{ color: 'var(--content-text)' }}>
                      {course.title || 'Без названия'}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && activeList.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500">
              Пусто
            </div>
          )}
        </div>
      )}
    </div>
  )
}
