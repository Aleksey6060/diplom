import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'

export default function TestModal({ open, questions, onClose, onComplete }) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [skipped, setSkipped] = useState({})
  const [checking, setChecking] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)

  const total = questions.length
  const correctness = useMemo(() => {
    if (!submitted) return {}
    const map = {}
    for (const q of questions) {
      map[q.id] = answers[q.id] === q.correctIndex
    }
    return map
  }, [submitted, answers, questions])

  const goNext = () => {
    const qid = questions[current].id
    if (answers[qid] === undefined) {
      setSkipped(s => ({ ...s, [qid]: true }))
    }
    setCurrent(i => Math.min(total - 1, i + 1))
  }
  const goPrev = () => setCurrent(i => Math.max(0, i - 1))
  const pick = (qid, idx) => {
    setAnswers(a => ({ ...a, [qid]: idx }))
    setSkipped(s => {
      const next = { ...s }
      delete next[qid]
      return next
    })
  }
  const submit = () => {
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      setSubmitted(true)
      const correct = questions.reduce((acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0), 0)
      const r = { correct, total, errors: total - correct, answers }
      setResult(r)
      onComplete?.(r)
    }, 1200)
  }

  const chipClass = (i, qid) => {
    const base = 'h-12 rounded-xl border text-base font-semibold transition select-none cursor-pointer flex items-center justify-center backdrop-blur-md'
    
    if (submitted) {
      const ok = correctness[qid]
      return `${base} ${i === current ? 'ring-1 ring-white/30' : ''} ${
        ok 
          ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-emerald-500/40 text-emerald-300' 
          : 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/40 text-red-300'
      }`
    }
    
    if (i === current) return `${base} bg-osnova-pink/30 border-white/30 text-white transform scale-105 h-14 text-lg`
    if (answers[qid] !== undefined) return `${base} bg-white/10 border-white/20 text-white/90`
    if (skipped[qid]) return `${base} bg-gradient-to-r from-amber-500/20 to-amber-600/20 border-amber-500/40 text-[#266479]`
    return `${base} bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20`
  }

  // Стиль для основного контейнера
  const modalStyle = {}

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (submitted) onClose?.() }}
            className="absolute inset-0 bg-black/70 backdrop-blur-3xl"
          />
          
          {/* Modal Content */}
          <motion.div
            className="relative w-full max-w-5xl glass border border-white/10 rounded-2xl"
            data-panel="true"
            style={modalStyle}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25 }}
          >
            {/* Кнопка закрытия (только после сдачи) */}
            {submitted && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white/70 hover:text-white transition-colors backdrop-blur-md"
              >
                <X size={20} />
              </button>
            )}

            <div className="p-8 space-y-6">
              {/* Панель с номерами вопросов */}
              <div
                className="w-full"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: '0.5rem' }}
              >
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    onClick={() => setCurrent(i)}
                    className={chipClass(i, q.id)}
                    style={{
                      background: i === current 
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)'
                        : answers[q.id] !== undefined
                        ? 'rgba(255, 255, 255, 0.1)'
                        : skipped[q.id]
                        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.2) 100%)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: i === current 
                        ? '1px solid rgba(255, 255, 255, 0.3)'
                        : answers[q.id] !== undefined
                        ? '1px solid rgba(255, 255, 255, 0.2)'
                        : skipped[q.id]
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {!submitted ? (
                <div className="space-y-6">
                  {/* Заголовок вопроса */}
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold text-lg md:text-xl">
                      Вопрос {current + 1} из {total}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {answers[questions[current].id] !== undefined ? '✓ Отвечено' : 'Не отвечено'}
                    </div>
                  </div>

                  {/* Вопрос и варианты ответов */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={current}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* Текст вопроса */}
                      <div 
                        className="p-6 rounded-xl"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="text-white font-medium text-lg md:text-xl leading-relaxed">
                          {questions[current].text}
                        </div>
                      </div>

                      {/* Варианты ответов */}
                      <div className="space-y-3">
                        {questions[current].options.map((opt, idx) => {
                          const selected = answers[questions[current].id] === idx
                          return (
                            <button
                              key={idx}
                              onClick={() => pick(questions[current].id, idx)}
                              className={`w-full text-left px-6 py-4 rounded-xl border text-base transition-all duration-200 ${
                                selected 
                                  ? 'bg-osnova-pink/30 border-osnova-pink/50 text-white' 
                                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                              }`}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Кнопки навигации */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <button
                      onClick={goPrev}
                      className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={current === 0}
                      style={{ backdropFilter: 'blur(10px)' }}
                    >
                      Назад
                    </button>
                    {current < total - 1 ? (
                      <button
                        onClick={goNext}
                        className="px-5 py-3 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white font-medium transition-all"
                      >
                        Далее
                      </button>
                    ) : (
                      <button
                        onClick={submit}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition-all shadow-lg"
                      >
                        Завершить тестирование
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Результаты теста */
                <div className="space-y-6">
                  {checking ? (
                    <div className="flex items-center justify-center gap-3 text-white py-10">
                      <Loader2 className="animate-spin" size={20} />
                      <span>Проверка…</span>
                    </div>
                  ) : (
                    <>
                      {/* Баннер с результатами */}
                      <motion.div 
                        initial={{ opacity: 0, y: 6 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-xl text-center space-y-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="text-white font-semibold text-xl">Проверка завершена</div>
                        <div className="text-gray-300 text-lg">
                          Ваш результат: правильно <span className="text-emerald-300 font-bold">{result.correct}</span> из <span className="text-white font-bold">{result.total}</span>.
                          Ошибок <span className="text-red-300 font-bold">{result.errors}</span>.
                        </div>
                        <div className="text-white font-bold text-2xl">
                          Оценка: {Math.round((result.correct / result.total) * 100)}%
                        </div>
                      </motion.div>

                      {/* Текущий вопрос с правильными ответами */}
                      <div 
                        className="p-6 rounded-xl space-y-4"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="text-white font-medium text-lg md:text-xl">
                          {questions[current].text}
                        </div>
                        <div className="space-y-2">
                          {questions[current].options.map((opt, idx) => {
                            const isCorrect = idx === questions[current].correctIndex
                            const isChosen = answers[questions[current].id] === idx
                            
                            let bgClass = 'bg-white/5 border-white/10 text-gray-300'
                            if (isCorrect) {
                              bgClass = 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border-emerald-500/40 text-emerald-300'
                            } else if (isChosen) {
                              bgClass = 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/40 text-red-300'
                            }
                            
                            return (
                              <div 
                                key={idx} 
                                className={`w-full text-left px-4 py-3 rounded-lg border text-base ${bgClass}`}
                              >
                                {opt}
                                {isCorrect && (
                                  <span className="ml-2 text-xs px-2 py-1 rounded bg-emerald-500/30">
                                    Правильный ответ
                                  </span>
                                )}
                                {isChosen && !isCorrect && (
                                  <span className="ml-2 text-xs px-2 py-1 rounded bg-red-500/30">
                                    Ваш ответ
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Кнопки навигации по вопросам */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={goPrev}
                          className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition disabled:opacity-40"
                          disabled={current === 0}
                          style={{ backdropFilter: 'blur(10px)' }}
                        >
                          Предыдущий вопрос
                        </button>
                        <button
                          onClick={() => onClose?.()}
                          className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all shadow-lg"
                        >
                          Закрыть результаты
                        </button>
                        <button
                          onClick={goNext}
                          className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition disabled:opacity-40"
                          disabled={current === total - 1}
                          style={{ backdropFilter: 'blur(10px)' }}
                        >
                          Следующий вопрос
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
