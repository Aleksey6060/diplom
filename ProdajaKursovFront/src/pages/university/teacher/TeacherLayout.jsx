import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'

export default function TeacherLayout() {
  const linkClass = (isActive) => `px-3 py-1.5 rounded-xl border ${isActive ? 'bg-emerald-600 text-white border-emerald-600/40' : 'bg-white text-[#0f2e3a] border-[#266479]/20 hover:brightness-105'}`
  return (
    <div className="space-y-4 sm:space-y-6 pt-2 sm:pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Личный кабинет</h2>
      </div>
      <Outlet />
    </div>
  )
}
