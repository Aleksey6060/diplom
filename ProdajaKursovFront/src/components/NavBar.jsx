import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { LogIn, LogOut, User, MessageCircleMore, Menu, X, ShoppingBag, BookOpen, Bell, Shield, MessageCircle, Settings, Users, GraduationCap, Inbox, FileText, Palette, Plus, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/useTheme'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import ProfileModal from './ProfileModal'
import ContactModal from './ContactModal'

export default function NavBar() {
  const { user, openAuthModal, logout, isAdmin, hasPermission } = useAuth()
  const { brandText, logo } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { universitySlug } = useParams()
  const base = universitySlug ? `/${universitySlug}` : ''
  const pathWithoutUniversity = universitySlug ? location.pathname.replace(new RegExp(`^/${universitySlug}`), '') || '/' : location.pathname
  const withBase = (to) => (base ? `${base}${to}` : to)
  const [openProfile, setOpenProfile] = useState(false)
  const [openContact, setOpenContact] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const isTeacher = user?.account_type === 'teacher'
  const isOwner = !!user && (user.is_superuser || user.account_type === 'owner')
  const isEmployee = user?.account_type === 'employee'
  const canOpenDesign = !isEmployee || hasPermission('design.access')
  const isTeacherRoute = pathWithoutUniversity.startsWith('/teacher')
  const isAdminRoute = pathWithoutUniversity.startsWith('/admin')
  const logoSizePx = Math.min(44, Math.max(16, Number.isFinite(Number(logo?.size)) ? Number(logo.size) : 32))
  const logoRadiusPx = Math.min(999, Math.max(0, Number.isFinite(Number(logo?.radius)) ? Number(logo.radius) : 999))
  const logoPaddingPx = Math.min(24, Math.max(0, Number.isFinite(Number(logo?.padding)) ? Number(logo.padding) : 0))
  const logoBgAlpha = Math.min(1, Math.max(0, Number.isFinite(Number(logo?.bgAlpha)) ? Number(logo.bgAlpha) : 0.1))
  const logoBorderAlpha = Math.min(1, Math.max(0, Number.isFinite(Number(logo?.borderAlpha)) ? Number(logo.borderAlpha) : 0.1))
  const logoFit = logo?.objectFit === 'contain' ? 'contain' : 'cover'

  return (
    <motion.header
      className="glass fixed top-4 left-4 right-4 z-[9990] rounded-full px-4 py-2.5 flex items-center justify-between shadow-glass"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-header="true"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 shadow-[0_0_18px_rgba(56,189,248,0.25)] overflow-hidden"
            style={{
              width: `${logoSizePx}px`,
              height: `${logoSizePx}px`,
              borderRadius: `${logoRadiusPx}px`,
              padding: `${logoPaddingPx}px`,
              background: `rgba(255,255,255,${logoBgAlpha})`,
              border: `1px solid rgba(255,255,255,${logoBorderAlpha})`
            }}
          >
            {logo?.src ? (
              <img
                src={logo.src}
                alt=""
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: logoFit,
                  display: 'block'
                }}
              />
            ) : null}
          </div>
          <span className="font-semibold text-sm md:text-base text-white/90 tracking-wide">{String(brandText || 'OSNOVA')}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!isAdmin && !isTeacher && (
          <button
            onClick={() => setOpenContact(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white rounded-xl text-sm font-medium transition-all border border-white/10 hover:bg-white/10"
            title="Связь"
          >
            <MessageCircleMore size={16} className="shrink-0" />
            <span className="hidden sm:inline">Связь</span>
          </button>
        )}
        {user ? (
          <div className="flex items-center gap-4">
            {isAdmin && !(isTeacher || isTeacherRoute) && (
              <button
                type="button"
                className={`${isAdminRoute ? 'admin-mobile-hide ' : ''}lg:hidden flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-white rounded-full text-sm border border-white/10`}
                onClick={() => setOpenMenu(o => !o)}
                title="Меню"
              >
                {openMenu ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            {isAdmin && (
              <div className={`flex items-center gap-3 ${isAdminRoute ? 'admin-mobile-hide' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                  {user.first_name?.[0]}
                </div>
                <span className="text-sm text-white hidden sm:block">
                  {user.first_name} {user.last_name}
                </span>
              </div>
            )}
            {isOwner && isAdminRoute && !universitySlug && (
              <button
                onClick={() => navigate(withBase('/admin/university'))}
                className="icon-btn p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                title="Создание университета"
              >
                <Plus size={18} />
              </button>
            )}
            {isAdmin && canOpenDesign && (
              <button
                onClick={() => {
                  try {
                    window.open(withBase('/theme'), '_blank', 'noopener,noreferrer')
                  } catch {
                    navigate(withBase('/theme'))
                  }
                }}
                className="icon-btn p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                title="Настройки темы"
              >
                <Palette size={18} />
              </button>
            )}
            {!isAdminRoute && (
              <button
                onClick={() => setOpenProfile(true)}
                className="icon-btn p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
                title="Профиль"
              >
                <User size={18} />
              </button>
            )}
            <button
              onClick={async () => { await logout() }}
              className="icon-btn p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors"
              title="Выйти"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={openAuthModal}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border hover:brightness-110 group"
            style={{
              backgroundColor: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              borderColor: 'var(--btn-primary-border)'
            }}
          >
            <LogIn size={18} className="group-hover:text-emerald-400 transition-colors" />
            <span>Войти</span>
          </button>
        )}
      </div>
      {!isAdminRoute && (
        <ProfileModal open={openProfile} onClose={() => setOpenProfile(false)} studentEmail={user?.email || ''} />
      )}
      <ContactModal open={openContact} onClose={() => setOpenContact(false)} />
      {openMenu && user && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            onClick={() => setOpenMenu(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            className="relative w-full max-w-sm mx-4 glass border border-white/10 rounded-2xl p-3 shadow-2xl"
          >
            <div className="grid grid-cols-1 gap-2">
              {(isAdmin && pathWithoutUniversity.startsWith('/admin')
                ? [
                    { to: withBase('/admin/store'), icon: <Settings size={16} />, label: 'Настройка магазина' },
                    { to: withBase('/admin/courses'), icon: <BookOpen size={16} />, label: 'Курсы' },
                    { to: withBase('/admin/staff'), icon: <Users size={16} />, label: 'Сотрудники' },
                    { to: withBase('/admin/distribution'), icon: <Users size={16} />, label: 'Распределение' },
                    { to: withBase('/admin/students'), icon: <GraduationCap size={16} />, label: 'Учащиеся' },
                    { to: withBase('/admin/documents'), icon: <FileText size={16} />, label: 'Документы' },
                    { to: withBase('/admin/chat'), icon: <MessageCircle size={16} />, label: 'Чаты' },
                    { to: withBase('/admin/tickets'), icon: <Inbox size={16} />, label: 'Принятие заявок' },
                  ]
                : (isTeacher || isTeacherRoute)
                  ? [
                      { to: withBase('/teacher/groups'), icon: <Users size={16} />, label: 'Мои группы' },
                      { to: withBase('/teacher/schedule'), icon: <CalendarDays size={16} />, label: 'Расписание' },
                      { to: withBase('/teacher/chat'), icon: <MessageCircle size={16} />, label: 'Чат' },
                      { to: withBase('/teacher/recent'), icon: <Bell size={16} />, label: 'Уведомления' },
                      { to: withBase('/teacher/appearance'), icon: <Palette size={16} />, label: 'Внешний вид' },
                      ...(isAdmin ? [{ to: withBase('/admin'), icon: <Shield size={16} />, label: 'Админ-панель' }] : [])
                    ]
                  : [
                      { to: withBase('/my-courses'), icon: <BookOpen size={16} />, label: 'Мои курсы' },
                      { to: withBase('/schedule'), icon: <CalendarDays size={16} />, label: 'Расписание' },
                      { to: withBase('/chat'), icon: <MessageCircle size={16} />, label: 'Чат' },
                      { to: withBase('/courses'), icon: <ShoppingBag size={16} />, label: 'Доп. образование' },
                      { to: withBase('/recent'), icon: <Bell size={16} />, label: 'Уведомления' },
                      { to: withBase('/appearance'), icon: <Palette size={16} />, label: 'Внешний вид' },
                      ...(isAdmin ? [{ to: withBase('/admin'), icon: <Shield size={16} />, label: 'Админ-панель' }] : [])
                    ])
              .map(i => (
                <button
                  key={i.to}
                  onClick={() => { navigate(i.to); setOpenMenu(false) }}
                  className="w-full text-left px-4 py-3 rounded-md border bg-white/5 border-white/10 text-white/80 hover:bg-white/10 flex items-center gap-2"
                >
                  {i.icon}
                  <span>{i.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </motion.header>
  )
}
