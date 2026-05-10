import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function PaymentsPage() {
  const { paymentPlans, payForCourse } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState(null)

  const plans = useMemo(() => {
    const list = Array.isArray(paymentPlans) ? paymentPlans : []
    return list.slice().sort((a, b) => (a.price || 0) - (b.price || 0))
  }, [paymentPlans])

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
          <CreditCard size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Тарифы</h2>
          <div className="text-sm text-white/60 mt-1">Выберите подходящий вариант оплаты</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map(p => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="admin-card rounded-3xl p-6">
            <div className="text-white font-bold text-xl">{p.title}</div>
            <div className="text-white/70 text-sm mt-1">{p.description}</div>
            <div className="text-white font-bold text-2xl mt-4">{p.price}₽</div>
            <button
              type="button"
              onClick={() => setSelectedPlan(p)}
              className="mt-4 w-full px-4 py-3 rounded-xl border bg-emerald-600 text-white font-semibold"
            >
              Выбрать
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedPlan && (
          <motion.div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedPlan(null)} />
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="admin-card rounded-3xl p-6 w-full max-w-lg relative">
              <div className="text-white font-bold text-xl">{selectedPlan.title}</div>
              <div className="text-white/70 text-sm mt-1">{selectedPlan.description}</div>
              <div className="text-white font-bold text-2xl mt-4">{selectedPlan.price}₽</div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => setSelectedPlan(null)} className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white">Отмена</button>
                <button
                  onClick={() => { payForCourse(selectedPlan.courseId); setSelectedPlan(null) }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 border border-emerald-600/40 text-white font-semibold"
                >
                  Оплатить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

