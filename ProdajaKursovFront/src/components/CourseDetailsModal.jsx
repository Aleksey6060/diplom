import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Lock, CreditCard, Calendar, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import PurchaseNotice from './PurchaseNotice'

export default function CourseDetailsModal({ course, onClose }) {
  const { user, openAuthModal, purchaseCourse, purchaseCourseWithPlan, isCoursePurchased } = useAuth()
  const navigate = useNavigate()
  const isAuthed = !!user
  const purchased = isCoursePurchased(course.id)
  const [email, setEmail] = useState(user?.email || '')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [showNotice, setShowNotice] = useState(false)
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [months, setMonths] = useState(6)

  // Use createPortal to render the modal at the document body level
  return createPortal(
    <AnimatePresence>
      {course && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-6xl modal-panel rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 rounded-xl bg-white/80 hover:bg-white text-[#0f2e3a] transition-all shadow-sm backdrop-blur-sm"
            >
              <X size={20} />
            </button>

            {/* Left Column: Image & Description */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-white/40">
              {/* Hero Image */}
              <div className="relative h-64 md:h-80 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent z-10" />
                <img
                  src={course.image}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-6 left-8 z-20 pr-8">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-[#266479] shadow-sm uppercase tracking-wide border border-[#266479]/10">
                      {course.category}
                    </span>
                    <span className="px-3 py-1 bg-emerald-50/90 backdrop-blur-sm rounded-lg text-xs font-bold text-emerald-700 shadow-sm border border-emerald-200/50">
                      {course.level}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f2e3a] mb-2 drop-shadow-sm leading-tight">{course.title}</h2>
                  <div className="flex items-center gap-4 text-sm font-medium text-[#5a7280]">
                    <span className="flex items-center gap-1.5"><Calendar size={14} /> {course.duration}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Description */}
              <div className="p-8 space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-[#0f2e3a] mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#266479] to-[#d63d6b] rounded-full"></span>
                    О курсе
                  </h3>
                  <p className="text-[#0f2e3a]/80 leading-relaxed whitespace-pre-line text-base">
                    {course.detailedDescription || course.description}
                  </p>
                </div>
                
                {/* Tech Stack */}
                <div className="pt-4">
                  <h3 className="text-xl font-bold text-[#0f2e3a] mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#f2b749] to-[#6da04b] rounded-full"></span>
                    Стек технологий
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {course.techStack ? (
                      course.techStack.map((tech, index) => (
                        <span 
                          key={index}
                          className="px-3 py-1.5 bg-white border border-[#266479]/10 rounded-xl text-sm font-medium text-[#5a7280] shadow-sm"
                        >
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">Информация отсутствует</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Payment */}
            <div className="w-full md:w-[420px] bg-white/60 border-l border-[#266479]/10 flex flex-col overflow-y-auto custom-scrollbar backdrop-blur-xl">
              <div className="flex-1 p-6 flex flex-col">
                <h3 className="text-lg font-bold text-[#0f2e3a] mb-6 flex items-center gap-2">
                  <CreditCard className="text-[#d63d6b]" size={20} />
                  Оформление заказа
                </h3>
            
            {isAuthed ? (
              <div className="space-y-5 flex-1">
                <div className="bg-white rounded-2xl p-5 border border-[#266479]/10 shadow-lg space-y-5">
                  <div className="flex justify-between items-end pb-4 border-b border-dashed border-[#266479]/20">
                    <span className="text-[#5a7280] text-sm font-medium">Стоимость курса</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-[#0f2e3a] tracking-tight">{course.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Имя</label>
                        <input 
                          type="text" 
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Иван" 
                          className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Фамилия</label>
                        <input 
                          type="text" 
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Иванов" 
                          className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>
                    
                    <div className="bg-[#f0f9ff] rounded-xl p-3 border border-[#bae6fd]">
                      <label className="text-xs font-bold text-[#0284c7] uppercase tracking-wide mb-2 block flex items-center gap-1">
                        <Calendar size={12} />
                        Рассрочка (0%)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[6,8,12].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMonths(m)}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${months === m ? 'bg-[#0284c7] text-white shadow-md transform scale-105' : 'bg-white border border-[#bae6fd] text-[#0284c7] hover:bg-[#e0f2fe]'}`}
                          >
                            {m} мес
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between items-center text-xs">
                        <span className="text-[#0f2e3a]/70">Ежемесячный платеж:</span>
                        <span className="font-bold text-[#0284c7] text-sm">{(Math.ceil((course.price || 0) / months)).toLocaleString('ru-RU')} ₽</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Номер карты</label>
                      <input 
                        type="text" 
                        placeholder="0000 0000 0000 0000" 
                        className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner font-mono"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Срок</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY" 
                          className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner text-center font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">CVC</label>
                        <input 
                          type="text" 
                          placeholder="123" 
                          className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Email для чека</label>
                      <input 
                        type="email" 
                        defaultValue={user?.email}
                        placeholder="you@example.com"
                        className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>

                {purchased ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl py-4 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check size={18} />
                    </div>
                    <span className="font-bold">Курс уже приобретен</span>
                  </div>
                ) : (
                  <button
                    onClick={() => { purchaseCourseWithPlan(course, { firstName, lastName, months }); setShowNotice(true) }}
                    className="w-full py-3.5 bg-gradient-to-r from-[#d63d6b] to-[#f2b749] hover:brightness-110 text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#d63d6b]/30 mt-auto transform active:scale-[0.98]"
                  >
                    Оплатить курс
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5 flex-1">
                <div className="bg-white rounded-2xl p-5 border border-[#266479]/10 shadow-lg space-y-5">
                  <div className="flex justify-between items-end pb-4 border-b border-dashed border-[#266479]/20">
                    <span className="text-[#5a7280] text-sm font-medium">Стоимость курса</span>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-[#0f2e3a] tracking-tight">{course.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm">
                    <p className="flex gap-2">
                      <Lock size={16} className="shrink-0 mt-0.5" />
                      <span>Для покупки курса необходимо войти или зарегистрироваться. Введите email, чтобы продолжить.</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-[#5a7280] uppercase tracking-wide mb-1.5 block ml-1">Email</label>
                      <input 
                        type="email" 
                        value={email}
                        placeholder="you@example.com"
                        className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-3 px-4 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner"
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    
                    <div className="pt-2 border-t border-[#266479]/10">
                      <p className="text-xs text-[#5a7280] mb-3 text-center">Демо-режим оплаты карты</p>
                      <div>
                        <input 
                          type="text" 
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="0000 0000 0000 0000" 
                          className="w-full bg-[#f8fafc] border border-[#266479]/10 rounded-xl py-2.5 px-3 text-[#0f2e3a] placeholder-gray-400 text-sm focus:border-[#266479] focus:bg-white outline-none transition-all shadow-inner font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    openAuthModal()
                    onClose?.()
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-[#266479] to-[#2a788e] hover:brightness-110 text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#266479]/30 mt-auto transform active:scale-[0.98]"
                >
                  Войти
                </button>
              </div>
            )}
            <PurchaseNotice
              open={showNotice}
              email={email || user?.email}
              onClose={() => setShowNotice(false)}
              onGoToMy={() => { setShowNotice(false); onClose(); navigate('/my-courses') }}
            />
          </div>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
