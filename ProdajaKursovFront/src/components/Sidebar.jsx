import React from 'react'
import { NavLink } from 'react-router-dom'
import { ShoppingBag, BookOpen, Bell, Shield, MessageCircle, Palette } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Item = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      rounded-2xl px-5 py-4 flex items-center gap-4 transition-colors duration-200 group
      border
      ${isActive 
        ? 'bg-osnova-pink/10 border-osnova-pink/20' 
        : 'bg-transparent border-transparent hover:bg-osnova-pink/5 hover:border-osnova-pink/10'
      }
    `}
  >
    {({ isActive }) => (
      <>
        <Icon size={24} className={`transition-colors ${isActive ? 'text-osnova-pink' : 'text-[#266479]/70 group-hover:text-white'}`} />
        <span className={`text-lg font-medium transition-colors ${isActive ? 'text-white' : 'text-[#266479]/70 group-hover:text-white'}`}>{label}</span>
      </>
    )}
  </NavLink>
)

export default function Sidebar() {
  const { isAdmin, user } = useAuth()
  const slug = user?.university_slug ? String(user.university_slug) : ''
  const base = slug ? `/${slug}` : ''
  const withBase = (to) => (base ? `${base}${to}` : to)
  return (
    <aside className="hidden lg:flex fixed left-8 top-1/2 -translate-y-1/2 flex-col gap-6 w-80 p-4 z-40">
      <div className="space-y-6">
        <Item to={withBase('/my-courses')} icon={BookOpen} label="Мои курсы" />
        <Item to={withBase('/chat')} icon={MessageCircle} label="Чат" />
        <Item to={withBase('/courses')} icon={ShoppingBag} label="Доп. образование" />
        <Item to={withBase('/recent')} icon={Bell} label="Уведомления" />
        <Item to={withBase('/appearance')} icon={Palette} label="Внешний вид" />
        {isAdmin && <Item to={withBase('/admin')} icon={Shield} label="Админ-панель" />}
      </div>
    </aside>
  )
}
