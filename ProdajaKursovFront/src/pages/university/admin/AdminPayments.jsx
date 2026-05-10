import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, SendHorizonal, X, Image as ImageIcon } from 'lucide-react'
import { createPortal } from 'react-dom'
import CustomSelect from '../../../components/CustomSelect'

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export default function AdminPayments() {
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const [plans, setPlans] = useState([])
  
  useEffect(() => {
    setStudents(loadJSON('admin_students_list', []))
    setGroups(loadJSON('admin_groups', []))
    setPlans(loadJSON('payments_plans', []))
  }, [])
  const [query, setQuery] = useState('')
  const [groupId, setGroupId] = useState('')
  const [dueFilter, setDueFilter] = useState('all') // all|next7|overdue
  const [detailEmail, setDetailEmail] = useState(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [mailExcludes, setMailExcludes] = useState(new Set())
  const [receiptPreview, setReceiptPreview] = useState('')

  const studentsWithPlans = useMemo(() => {
    const byEmail = new Map()
    for (const p of plans) {
      const email = (p.email || '').trim().toLowerCase()
      const arr = byEmail.get(email) || []
      arr.push(p)
      byEmail.set(email, arr)
    }
    const base = students.map(s => {
      const email = (s.email || '').trim().toLowerCase()
      const ps = byEmail.get(email) || []
      if (ps.length === 0) {
        return {
          student: s,
          plans: [],
          paidTotal: 0,
          total: 0,
          remaining: 0,
          nextDueDate: new Date(),
          overdueDays: 0,
          nextDueDays: 0
        }
      }
      const aggregates = aggregatePlans(ps)
      return { student: s, plans: ps, ...aggregates }
    })
    return base
  }, [students, plans])

  const inGroup = useCallback((s) => {
    if (!groupId) return true
    const g = groups.find(x => x.id === groupId)
    if (!g) return false
    return Array.isArray(g.memberIds) && g.memberIds.includes(s.id)
  }, [groupId, groups])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    const result = studentsWithPlans.filter(row => {
      if (!inGroup(row.student)) return false
      if (q) {
        const fio = [row.student.lastName, row.student.firstName, row.student.patronymic].filter(Boolean).join(' ').toLowerCase()
        const email = (row.student.email || '').toLowerCase()
        if (!fio.includes(q) && !email.includes(q)) return false
      }
      if (dueFilter === 'next7') {
        if (row.plans.length === 0) return false
        if (!(row.nextDueDays >= 0 && row.nextDueDays <= 7)) return false
      }
      if (dueFilter === 'overdue') {
        if (row.plans.length === 0) return false
        if (!(row.overdueDays > 0)) return false
      }
      return true
    })
    return result
  }, [studentsWithPlans, query, dueFilter, inGroup])

  const currentDetail = useMemo(() => {
    if (!detailEmail) return null
    return filtered.find(r => (r.student.email || '').toLowerCase() === (detailEmail || '').toLowerCase()) || null
  }, [detailEmail, filtered])

  const beginMailing = () => {
    setMailExcludes(new Set())
    setMailOpen(true)
  }
  const toggleExclude = (email) => {
    setMailExcludes(prev => {
      const next = new Set(Array.from(prev))
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }
  const performMailing = () => {
    // Имитация отправки сообщений
    setTimeout(() => {
      setMailOpen(false)
      alert('Рассылка выполнена для выбранных получателей')
    }, 300)
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#0f2e3a]">Оплата</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
          <CustomSelect
            value={groupId}
            onChange={setGroupId}
            options={[
              { value: '', label: 'Все группы' },
              ...groups.map(g => ({ value: g.id, label: `${g.name} (${(g.memberIds || []).length})` })),
            ]}
            placeholder="Все группы"
            variant="glass"
          />
          <CustomSelect
            value={dueFilter}
            onChange={setDueFilter}
            options={[
              { value: 'all', label: 'Все сроки' },
              { value: 'next7', label: 'До 7 дней' },
              { value: 'overdue', label: 'Просрочено' },
            ]}
            placeholder="Все сроки"
            variant="glass"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ФИО или email"
            className="w-full px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:bg-white/10 transition"
          />
          <button
            onClick={beginMailing}
            className="w-full px-3 lg:px-4 h-11 rounded-xl border border-white/10 flex items-center justify-center gap-2 bg-white/5 text-white/90 hover:bg-white/10 transition"
          >
            <SendHorizonal size={16} />
            <span>Рассылка</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(row => (
          <button
            key={row.student.id}
            onClick={() => setDetailEmail(row.student.email)}
            className="btn-plain rounded-2xl p-4 text-left transition w-full border border-[#266479]/20 hover:shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[#0f2e3a] font-medium truncate">
                      {[row.student.lastName, row.student.firstName, row.student.patronymic].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-[#5a7280] text-xs truncate">{row.student.email}</div>
                  </div>
                  <div className="hidden sm:block text-xs text-[#0f2e3a] px-2 py-1 rounded-lg bg-white border border-[#266479]/20 shrink-0">
                    {row.plans.length > 0 ? `${row.plans.length} план(ов)` : 'нет планов'}
                  </div>
                </div>
                <div className="sm:hidden mt-2 inline-flex items-center gap-2 text-xs text-[#0f2e3a]">
                  <span className="px-2 py-1 rounded-lg bg-white border border-[#266479]/20">
                    {row.plans.length > 0 ? `${row.plans.length} план(ов)` : 'нет планов'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="rounded-xl bg-white border border-[#266479]/20 p-3">
                  <div className="text-[11px] text-[#5a7280]">Следующий платёж</div>
                  <div className={`mt-0.5 text-sm ${row.plans.length === 0 ? 'text-[#5a7280]' : (row.overdueDays > 0 ? 'text-[#266479]' : 'text-[#0f2e3a]')}`}>
                    {row.plans.length === 0 ? '—' : row.nextDueDate.toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-[#266479]/20 p-3">
                  <div className="text-[11px] text-[#5a7280]">Остаток</div>
                  <div className="mt-0.5 text-sm text-[#0f2e3a]">{row.plans.length === 0 ? '—' : `${row.remaining.toLocaleString('ru-RU')} ₽`}</div>
                </div>
                <div className="col-span-2 sm:col-auto rounded-xl bg-white border border-[#266479]/20 p-3">
                  <div className="text-[11px] text-[#5a7280]">Статус</div>
                  <div className={`mt-0.5 text-sm ${row.plans.length === 0 ? 'text-[#5a7280]' : (row.overdueDays > 0 ? 'text-[#266479]' : 'text-emerald-700')}`}>
                    {row.plans.length === 0 ? 'Нет данных' : (row.overdueDays > 0 ? `Просрочка ${row.overdueDays} дн.` : 'В графике')}
                  </div>
                </div>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-gray-400 text-sm">Нет учеников, соответствующих фильтрам</div>
        )}
      </div>

      <AnimatePresence>
        {currentDetail && (
          <motion.div className="fixed inset-0 z-[9992] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setDetailEmail(null)} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-3xl w-[92vw] max-w-3xl p-4 sm:p-6 relative shadow-2xl max-h-[82dvh] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="text-[#0f2e3a] font-semibold text-lg">
                  {[currentDetail.student.lastName, currentDetail.student.firstName, currentDetail.student.patronymic].filter(Boolean).join(' ')}
                </div>
                <button onClick={() => setDetailEmail(null)} className="p-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a] hover:bg-black/5">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {currentDetail.plans.length === 0 && (
                  <div className="rounded-xl bg-white/80 border border-[#266479]/20 p-4 text-[#5a7280] text-sm">
                    Нет данных по планам оплаты для этого ученика
                  </div>
                )}
                {currentDetail.plans.map((p, i) => {
                  const a = aggregatePlans([p])
                  return (
                    <div key={i} className="rounded-xl bg-white/80 border border-[#266479]/20 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[#0f2e3a] font-medium">{p.title}</div>
                        <div className="text-xs text-[#5a7280]">Старт: {new Date(p.startDate).toLocaleDateString('ru-RU')}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">План</div>
                          <div className="text-[#0f2e3a] text-sm">{p.planMonths} мес</div>
                        </div>
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">Оплачено</div>
                          <div className="text-[#0f2e3a] text-sm">{a.paidTotal.toLocaleString('ru-RU')} ₽ из {p.total.toLocaleString('ru-RU')} ₽</div>
                        </div>
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">Платежей</div>
                          <div className="text-[#0f2e3a] text-sm">{(p.payments || []).length} из {p.planMonths}</div>
                        </div>
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">Следующий платёж до</div>
                          <div className={`text-sm ${a.overdueDays > 0 ? 'text-red-600' : 'text-[#0f2e3a]'}`}>{a.nextDueDate?.toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">Осталось оплатить</div>
                          <div className="text-[#0f2e3a] text-sm">{a.remaining.toLocaleString('ru-RU')} ₽</div>
                        </div>
                        <div className="rounded-xl bg-white/90 border border-[#266479]/20 p-3">
                          <div className="text-[#5a7280] text-xs mb-1">Статус</div>
                          <div className={`text-sm ${a.overdueDays > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {a.overdueDays > 0 ? `Просрочка ${a.overdueDays} дн.` : 'В графике'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-[#0f2e3a] text-sm mb-1">История платежей</div>
                        <div className="space-y-1">
                          {(p.payments || []).map((x, idx) => {
                            const has = !!x.receiptUrl
                            return (
                              <div key={idx} className="flex items-center justify-between text-xs text-[#5a7280]">
                                <span>{new Date(x.date).toLocaleDateString('ru-RU')}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#0f2e3a]">{(x.amount || 0).toLocaleString('ru-RU')} ₽</span>
                                  <button
                                    onClick={() => { if (x.receiptUrl) setReceiptPreview(x.receiptUrl) }}
                                    className={`px-2 py-1 rounded-lg border text-[11px] ${has ? 'bg-emerald-100 border-emerald-300 text-[#0f2e3a]' : 'bg-white/80 border-[#266479]/20 text-[#5a7280]'}`}
                                    title={has ? 'Показать квитанцию' : 'Квитанция отсутствует'}
                                  >
                                    <span className="inline-flex items-center gap-1"><ImageIcon size={12} /> Квитанция</span>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button onClick={() => setDetailEmail(null)} className="px-4 py-2 rounded-xl !bg-red-600 !border-red-600/40 text-white">Закрыть</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {mailOpen && (
            <div className="fixed inset-0 z-[9993] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
              <div className="absolute inset-0 modal-overlay" onClick={() => setMailOpen(false)} />
              <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal-panel rounded-3xl w-[92vw] max-w-3xl p-4 sm:p-6 relative max-h-[82dvh] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                      <SendHorizonal size={18} className="text-white/80" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-lg">Рассылка уведомлений об оплате</div>
                      <div className="text-gray-400 text-xs">Адресаты из текущей выборки, исключения учитываются</div>
                    </div>
                  </div>
                  <button onClick={() => setMailOpen(false)} className="p-2 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {filtered.map(row => {
                    const email = row.student.email
                    const excluded = mailExcludes.has(email)
                    return (
                      <label key={email} className={`flex items-center justify-between px-3 py-2 rounded-xl ${excluded ? 'bg-white/80 border border-[#266479]/20 opacity-60' : 'bg-white border border-[#266479]/20'}`}>
                        <div className="min-w-0">
                          <div className="text-[#0f2e3a] text-sm font-medium truncate">{[row.student.lastName, row.student.firstName, row.student.patronymic].filter(Boolean).join(' ')}</div>
                          <div className="text-xs text-[#5a7280] truncate">{email}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-1 rounded-lg border text-[11px] ${row.overdueDays > 0 ? 'bg-amber-100 border-amber-300 text-[#0f2e3a]' : 'bg-emerald-100 border-emerald-300 text-[#0f2e3a]'}`}>{row.overdueDays > 0 ? 'Просрочка' : 'В графике'}</span>
                          <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(email)} className="w-4 h-4 rounded-md bg-white/10 border border-white/20" />
                        </div>
                      </label>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div className="text-gray-400 text-sm">Нет адресатов для рассылки</div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button onClick={() => setMailOpen(false)} className="px-4 py-2 rounded-xl bg-white border border-[#266479]/20 text-[#0f2e3a]">Отмена</button>
                  <button onClick={performMailing} disabled={filtered.length === 0} className="px-4 py-2 rounded-xl border border-[#266479]/20 disabled:opacity-50">Отправить</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <AnimatePresence>
        {!!receiptPreview && (
          <motion.div className="fixed inset-0 z-[9994] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setReceiptPreview('')} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="relative w-[92vw] max-w-4xl p-3 sm:p-4 max-h-[85dvh] overflow-y-auto custom-scrollbar">
              <img src={receiptPreview} alt="" className="w-full rounded-2xl border border-white/20" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function aggregatePlans(plans) {
  const paidTotal = plans.reduce((sum, p) => sum + (p.payments || []).reduce((s, x) => s + (x.amount || 0), 0), 0)
  const total = plans.reduce((s, p) => s + (p.total || 0), 0)
  const nextDueDate = getNextDueDate(plans)
  const today = new Date()
  const overdueDays = today > nextDueDate ? Math.floor((today - nextDueDate) / (1000*60*60*24)) : 0
  const nextDueDays = Math.max(Math.ceil((nextDueDate - today) / (1000*60*60*24)), 0)
  const remaining = Math.max(total - paidTotal, 0)
  return { paidTotal, total, remaining, nextDueDate, overdueDays, nextDueDays }
}

function getNextDueDate(plans) {
  let next = null
  for (const p of plans) {
    const paidTotal = (p.payments || []).reduce((sum, x) => sum + (x.amount || 0), 0)
    const installmentsPaid = Math.floor(paidTotal / Math.max(p.monthlyAmount || 1, 1))
    const startDate = new Date(p.startDate)
    const d = new Date(startDate.getTime()); d.setMonth(startDate.getMonth() + installmentsPaid + 1)
    if (!next || d < next) next = d
  }
  return next || new Date()
}
