import React from 'react'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import { ShoppingBag, BookOpen, Shield, MessageCircle, Settings, Users, GraduationCap, Inbox, FileText, SlidersHorizontal, Palette, CalendarDays } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../context/SearchContext'

export default function UserHeader() {
  const { isAdmin, user } = useAuth()
  const { triggerEvent } = useSearch()
  const location = useLocation()
  const { universitySlug: rawUniversitySlug } = useParams()
  const universitySlug = (() => {
    const slug = rawUniversitySlug ? String(rawUniversitySlug) : ''
    if (!slug) return null
    if (['admin', 'teacher', 'courses', 'overview', 'my-courses', 'payments', 'archived', 'recent', 'settings', 'theme', 'appearance', 'themes', 'chat', 'grades', 'schedule'].includes(slug)) {
      return null
    }
    return slug
  })()
  const base = universitySlug ? `/${universitySlug}` : ''
  const pathWithoutUniversity = universitySlug ? location.pathname.replace(new RegExp(`^/${universitySlug}`), '') || '/' : location.pathname
  const withBase = (to) => (base ? `${base}${to}` : to)
  const isCoursesPage = pathWithoutUniversity === '/courses'
  const isTeacher = (user?.account_type === 'teacher') || pathWithoutUniversity.startsWith('/teacher')

  return (
    <div className="px-4 md:px-6 flex justify-center">
      <motion.div
        className="p-4 glass rounded-xl w-full sm:w-[80%] max-w-[1600px] mx-auto shadow-xl"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        data-student-header="true"
      >
        <div className="w-full mx-auto">
          <div className="flex items-center gap-3">
            {/* Logo or Icon */}
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center admin-mobile-hide">
              <BookOpen size={18} className="text-white/80" />
            </div>
            
            {/* Title */}
            <div>
              <h1 className="text-white keep-white font-bold text-lg">Личный кабинет</h1>
              <p className="text-white/80 keep-white text-xs admin-mobile-hide">Учебный процесс</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <AnimatePresence>
                {isCoursesPage && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -10 }}
                    onClick={() => triggerEvent('toggle-course-filters')}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                    title="Фильтры"
                  >
                    <SlidersHorizontal size={18} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-3 w-full flex flex-col lg:flex-row items-stretch lg:items-center gap-2 sm:gap-3">
            <div className="grid grid-flow-col auto-cols-fr gap-2 text-sm w-full mx-auto">
              {(isTeacher
                ? [
                    { to: withBase('/teacher/groups'), icon: <Users size={16} />, short: 'Группы', full: 'Мои группы' },
                    { to: withBase('/teacher/schedule'), icon: <CalendarDays size={16} />, short: 'Распр.', full: 'Расписание' },
                    { to: withBase('/teacher/chat'), icon: <MessageCircle size={16} />, short: 'Чат', full: 'Чат' },
                    { to: withBase('/teacher/appearance'), icon: <Palette size={16} />, short: 'Вид', full: 'Внешний вид' },
                  ]
                : [
                    { to: withBase('/my-courses'), icon: <BookOpen size={16} />, short: 'Курсы', full: 'Мои курсы' },
                    { to: withBase('/schedule'), icon: <CalendarDays size={16} />, short: 'Распр.', full: 'Расписание' },
                    { to: withBase('/grades'), icon: <GraduationCap size={16} />, short: 'Оценки', full: 'Успеваемость' },
                    { to: withBase('/chat'), icon: <MessageCircle size={16} />, short: 'Чат', full: 'Чат' },
                    { to: withBase('/courses'), icon: <ShoppingBag size={16} />, short: 'Магазин', full: 'Доп. образование' },
                    { to: withBase('/appearance'), icon: <Palette size={16} />, short: 'Вид', full: 'Внешний вид' },
                  ]).map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  {l.icon}
                  <span className="hidden sm:inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">{l.short}</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">{l.full}</span>
                </NavLink>
              ))}

              {isAdmin && (
                <NavLink
                  to={withBase('/admin')}
                  className={({ isActive }) =>
                    `px-2 h-11 rounded-md border flex items-center justify-center gap-2 transition w-full
                    ${isActive ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`
                  }
                >
                  <Shield size={16} className="shrink-0" />
                  <span className="hidden sm:inline xl:hidden whitespace-nowrap overflow-hidden text-ellipsis">Админ</span>
                  <span className="hidden xl:inline whitespace-nowrap overflow-hidden text-ellipsis">Админ-панель</span>
                </NavLink>
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  )
}
