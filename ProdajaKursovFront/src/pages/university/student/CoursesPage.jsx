import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ArrowUpDown, ChevronDown, X, Check } from 'lucide-react'
import CourseCard from '../../../components/CourseCard'
import CourseDetailsModal from '../../../components/CourseDetailsModal'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useSearch } from '../../../context/SearchContext'
import { api } from '../../../lib/api'

export default function CoursesPage() {
  const { universitySlug } = useParams()
  const { user, isCoursePurchased } = useAuth()
  const { searchQuery } = useSearch()
  const [selectedCategory, setSelectedCategory] = useState('Все')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [sortOrder, setSortOrder] = useState('none')
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [storeCards, setStoreCards] = useState([])
  const [enrolledSimpleCourseIds, setEnrolledSimpleCourseIds] = useState(() => new Set())
  const [savingFilter, setSavingFilter] = useState(false)
  const [filterToken, setFilterToken] = useState('')

  useEffect(() => {
    const handleToggle = () => setShowFilters(prev => !prev)
    window.addEventListener('toggle-course-filters', handleToggle)
    return () => window.removeEventListener('toggle-course-filters', handleToggle)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.courses.storeCards.list({ universitySlug })
        const normalized = Array.isArray(list) ? list.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description || '',
          detailedDescription: c.description || '',
          techStack: null,
          price: Number(c.price || 0),
          image: c.image || `https://picsum.photos/seed/store-card-${c.id}/2000/1200`,
          category: c.category || 'Обучение',
          level: c.level || 'Начинающий',
          duration: c.duration || '—',
          rating: Number(c.rating || 0),
          contentFolderId: c.content_folder_id || '',
          courseId: c.course ?? null,
          _source: 'store_card',
        })) : []
        if (!cancelled) setStoreCards(normalized)
      } catch {
        if (!cancelled) setStoreCards([])
      }
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams(window.location.search || '')
        const ft = params.get('ft')
        if (!ft) return
        const list = await api.courses.filters.apply(ft, { universitySlug })
        if (!cancelled) setStoreCards(Array.isArray(list) ? list : [])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [universitySlug])

  useEffect(() => {
    let cancelled = false
    const studentId = user?.id
    if (!studentId) {
      setEnrolledSimpleCourseIds(new Set())
      return () => {}
    }
    ;(async () => {
      try {
        const list = await api.users.students.simpleCourses(studentId, { universitySlug })
        if (cancelled) return
        const ids = new Set((Array.isArray(list) ? list : []).map(c => c.id))
        setEnrolledSimpleCourseIds(ids)
      } catch {
        if (!cancelled) setEnrolledSimpleCourseIds(new Set())
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, universitySlug])

  const buildFilterSchema = () => {
    const children = []
    if (selectedCategory && selectedCategory !== 'Все') {
      children.push({ category: selectedCategory })
    }
    if (searchQuery && searchQuery.trim()) {
      children.push({
        logic: 'OR',
        children: [
          { title__icontains: searchQuery.trim() },
          { description__icontains: searchQuery.trim() },
        ],
      })
    }
    if (Number.isFinite(priceRange?.min) || Number.isFinite(priceRange?.max)) {
      const priceChildren = []
      if (Number.isFinite(priceRange.min)) priceChildren.push({ price__gte: Number(priceRange.min) })
      if (Number.isFinite(priceRange.max)) priceChildren.push({ price__lte: Number(priceRange.max) })
      if (priceChildren.length > 0) {
        children.push({ logic: 'AND', children: priceChildren })
      }
    }
    return { logic: 'AND', children }
  }

  const saveCurrentFilter = async () => {
    setSavingFilter(true)
    setFilterToken('')
    try {
      const schema = buildFilterSchema()
      const res = await api.courses.filters.serialize(schema, { universitySlug })
      const token = res?.filter_token || ''
      if (token) {
        setFilterToken(token)
        try {
          const url = new URL(window.location.href)
          url.searchParams.set('ft', token)
          window.history.replaceState({}, '', url.toString())
        } catch {}
      }
    } catch {} finally {
      setSavingFilter(false)
    }
  }

  const copyFilterLink = async () => {
    try {
      const url = new URL(window.location.href)
      if (filterToken) url.searchParams.set('ft', filterToken)
      await navigator.clipboard.writeText(url.toString())
    } catch {}
  }

  const categories = useMemo(() => {
    const set = new Set((storeCards || []).map(c => c.category).filter(Boolean))
    return ['Все', ...Array.from(set)]
  }, [storeCards])

  const filteredCourses = useMemo(() => {
    let result = [...storeCards]

    if (selectedCategory !== 'Все') {
      result = result.filter(course => course.category === selectedCategory)
    }

    if (searchQuery) {
      result = result.filter(course =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    result = result.filter(course =>
      course.price >= priceRange.min && course.price <= priceRange.max
    )

    result = result.filter(course => !isCoursePurchased(course.id))
    result = result.filter(course => !(course.courseId && enrolledSimpleCourseIds.has(course.courseId)))

    if (sortOrder === 'asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortOrder === 'desc') {
      result.sort((a, b) => b.price - a.price)
    }

    return result
  }, [selectedCategory, sortOrder, priceRange, searchQuery, isCoursePurchased, storeCards, enrolledSimpleCourseIds])

  return (
    <div className="space-y-8 pb-20 store-courses">
      <div className="w-full max-w-7xl mx-auto px-4 mt-0">
        <AnimatePresence>
          {selectedCourse && (
            <CourseDetailsModal
              course={selectedCourse}
              onClose={() => setSelectedCourse(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -6 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -6 }}
              className="overflow-hidden rounded-3xl mb-8"
            >
              <div
                className="glass border border-white/10 p-6 grid grid-cols-1 md:grid-cols-3 gap-8 rounded-3xl"
                data-panel="true"
                data-edu-filter="true"
                style={{ background: 'var(--edu-filter-bg)', borderColor: 'var(--edu-filter-border)' }}
              >
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white/70 uppercase tracking-wider">Цена</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-white/60 mb-1 block">От</label>
                      <input
                        type="number"
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-fuchsia-500/50 outline-none"
                      />
                    </div>
                    <div className="w-4 h-[1px] bg-white/20 mt-5" />
                    <div className="flex-1">
                      <label className="text-xs text-white/60 mb-1 block">До</label>
                      <input
                        type="number"
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-fuchsia-500/50 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white/70 uppercase tracking-wider">Направление</h4>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${selectedCategory === cat
                          ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white/70 uppercase tracking-wider">Сортировка</h4>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSortOrder('none')}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${sortOrder === 'none'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      Без сортировки
                    </button>
                    <button
                      onClick={() => setSortOrder('asc')}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${sortOrder === 'asc'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      По цене ↑
                    </button>
                    <button
                      onClick={() => setSortOrder('desc')}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${sortOrder === 'desc'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      По цене ↓
                    </button>
                  </div>
                </div>
                <div className="flex items-end md:justify-end">
                  <div className="space-y-2 w-full md:w-auto">
                    <button
                      onClick={saveCurrentFilter}
                      disabled={savingFilter}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
                    >
                      {savingFilter ? 'Сохраняю…' : 'Сохранить фильтр'}
                    </button>
                    {filterToken && (
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={(() => {
                            try {
                              const url = new URL(window.location.href)
                              url.searchParams.set('ft', filterToken)
                              return url.toString()
                            } catch { return filterToken }
                          })()}
                          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-xs"
                        />
                        <button onClick={copyFilterLink} className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-xs hover:bg-white/20">
                          Копировать
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div id="courses-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        <AnimatePresence mode='popLayout'>
          {filteredCourses.map((course, idx) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.05 }}
              onClick={() => setSelectedCourse(course)}
              className="h-full"
            >
              <CourseCard {...course} purchased={isCoursePurchased(course.id)} />
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredCourses.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-gray-500 text-lg">Курсы не найдены. Попробуйте изменить параметры фильтрации.</p>
          </div>
        )}
      </div>
    </div>
  )
}
