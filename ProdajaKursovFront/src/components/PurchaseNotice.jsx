import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

export default function PurchaseNotice({ open, email, onClose, onGoToMy }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-2xl"
          />
          <motion.div
            className="relative w-full max-w-md bg-[#0F1115] rounded-2xl border border-white/10 shadow-2xl p-6 text-center"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">
              <Check size={22} />
            </div>
            <h3 className="text-white font-semibold mb-2">Покупка оформлена</h3>
            <p className="text-gray-400 text-sm mb-6">
              На почту {email} отправлены данные для авторизации.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-colors"
              >
                Закрыть
              </button>
              <button
                onClick={onGoToMy}
                className="px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-colors"
              >
                Перейти в Мои курсы
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
