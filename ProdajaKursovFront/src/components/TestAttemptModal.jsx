import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

export default function TestAttemptModal({ open, testId, attemptsLimit = null, universitySlug = null, onClose, onCompleted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(null)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [lastAttemptSummary, setLastAttemptSummary] = useState(null)

  const loadAttemptsMeta = useCallback(async (signal) => {
    const list = await api.courses.tests.results(testId, { universitySlug, signal })
    const attempts = Array.isArray(list) ? list : []
    const completed = attempts.filter(a => a?.status === 'completed' || a?.status === 'timed_out')
    const used = completed.length
    const remaining = attemptsLimit == null ? null : Math.max(0, Number(attemptsLimit) - used)
    const lastCompleted = completed.length ? completed[0] : null
    return { attempts, used, remaining, lastCompleted }
  }, [attemptsLimit, testId, universitySlug])

  const loadAttemptResult = useCallback(async (attemptId, signal) => {
    const data = await api.courses.tests.attempt(attemptId, { universitySlug, signal })
    return data || null
  }, [universitySlug])

  const startAttempt = useCallback(async (signal) => {
    const data = await api.courses.tests.start(testId, { universitySlug, signal })
    const list = Array.isArray(data?.questions) ? data.questions : []
    setAttempt(data || null)
    setQuestions(list)
  }, [testId, universitySlug])

  useEffect(() => {
    if (!open || !testId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      setAttempt(null)
      setQuestions([])
      setCurrent(0)
      setAnswers({})
      setResult(null)
      setLastAttemptSummary(null)
      try {
        const controller = new AbortController()
        const { remaining, lastCompleted } = await loadAttemptsMeta(controller.signal)
        if (cancelled) return

        if (lastCompleted) setLastAttemptSummary(lastCompleted)

        if (attemptsLimit != null && remaining === 0 && lastCompleted) {
          const full = await loadAttemptResult(lastCompleted.id, controller.signal)
          if (cancelled) return
          setResult(full)
          return
        }

        await startAttempt(controller.signal)
        if (cancelled) return
      } catch (e) {
        if (cancelled) return
        const msg = e?.body?.detail || 'Не удалось начать тест'
        setError(String(msg))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [attemptsLimit, loadAttemptResult, loadAttemptsMeta, open, startAttempt, testId, universitySlug])

  const total = questions.length
  const currentQuestion = questions[current] || null

  const canSubmit = useMemo(() => {
    if (!total) return false
    const keys = Object.keys(answers || {})
    return keys.length > 0 && keys.length <= total
  }, [answers, total])

  const pick = (questionId, optionId) => {
    setAnswers(prev => ({ ...(prev || {}), [String(questionId)]: optionId }))
  }

  const submit = async () => {
    if (!testId || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        answers: Object.entries(answers || {}).map(([qid, oid]) => ({
          question_id: Number(qid),
          option_id: Number(oid),
        }))
      }
      const data = await api.courses.tests.submit(testId, payload, { universitySlug })
      setResult(data || null)
      onCompleted?.(data || null)
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось отправить ответы'
      setError(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const backdrop = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => { if (result) onClose?.() }}
      className="absolute inset-0 modal-overlay"
    />
  )

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
          {backdrop}
          <motion.div
            className="relative w-full max-w-5xl rounded-3xl modal-panel max-h-[calc(100vh-1.5rem)] overflow-y-auto"
            data-panel="true"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25 }}
          >
            <button
              onClick={onClose}
              data-theme-preview="true"
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-3 sm:p-2 rounded-xl border transition"
              style={{
                background: 'var(--surface-bg-strong)',
                borderColor: 'rgba(38, 100, 121, 0.18)',
                color: 'var(--content-text)',
              }}
            >
              <X size={20} />
            </button>

            <div className="p-4 sm:p-8 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-10" style={{ color: 'var(--content-text)' }}>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Загрузка…</span>
                </div>
              ) : error ? (
                <div
                  className="rounded-2xl border px-5 py-4"
                  style={{
                    background: 'rgba(220, 38, 38, 0.08)',
                    borderColor: 'rgba(220, 38, 38, 0.18)',
                    color: 'rgb(153, 27, 27)',
                  }}
                >
                  {error}
                </div>
              ) : result ? (
                <div className="space-y-6">
                  <div
                    className="p-4 sm:p-6 rounded-xl text-center space-y-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <div className="text-white font-semibold text-xl">Результат</div>
                    <div className="text-gray-300 text-lg">
                      {Number(result.score || 0)} / {Number(result.max_score || 0)} · {Number(result.percentage || 0)}%
                    </div>
                    <div className="text-white font-bold text-2xl">
                      {result.is_passed ? 'Тест пройден' : 'Тест не пройден'}
                    </div>
                  </div>

                  {Array.isArray(result.answers) && result.answers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-white/90 font-semibold">Ответы</div>
                      <div className="space-y-2">
                        {result.answers.map((a, idx) => (
                          <div
                            key={`${a.question}-${idx}`}
                            className="p-4 rounded-xl border"
                            style={{
                              background: 'var(--surface-bg-strong)',
                              borderColor: 'rgba(38, 100, 121, 0.12)',
                            }}
                          >
                            <div className="text-white font-medium">{a.question_text || `Вопрос ${idx + 1}`}</div>
                            <div className="text-gray-300 text-sm mt-1">{a.selected_option_text || ''}</div>
                            <div className={`text-sm mt-2 ${a.is_correct ? 'text-emerald-300' : 'text-red-300'}`}>
                              {a.is_correct ? 'Верно' : 'Неверно'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {lastAttemptSummary && (
                    <div
                      className="rounded-xl border px-4 py-3"
                      style={{
                        background: 'var(--surface-bg-strong)',
                        borderColor: 'rgba(38, 100, 121, 0.12)',
                      }}
                    >
                      <div className="text-white/90 font-semibold">Последний результат</div>
                      <div className="text-gray-300 text-sm mt-1">
                        {Number(lastAttemptSummary.score || 0)} / {Number(lastAttemptSummary.max_score || 0)} · {Number(lastAttemptSummary.percentage || 0)}%
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-lg md:text-xl" style={{ color: 'var(--content-text)' }}>
                      Вопрос {Math.min(current + 1, total)} из {total}
                    </div>
                    {!!attempt?.time_limit_minutes && (
                      <div className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Лимит: {attempt.time_limit_minutes} мин</div>
                    )}
                  </div>

                  <div className="flex gap-2 overflow-x-auto pr-1 custom-scrollbar">
                    {questions.map((q, i) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrent(i)}
                        data-theme-preview="true"
                        className="w-12 h-12 shrink-0 rounded-xl border text-base font-semibold transition select-none flex items-center justify-center hover:brightness-105"
                        style={{
                          background: i === current ? 'var(--btn-primary-bg)' : (answers[String(q.id)] ? 'var(--surface-bg-strong)' : 'var(--surface-bg)'),
                          borderColor: i === current ? 'var(--btn-primary-border)' : (answers[String(q.id)] ? 'rgba(38, 100, 121, 0.18)' : 'rgba(38, 100, 121, 0.12)'),
                          color: i === current ? 'var(--btn-primary-text)' : (answers[String(q.id)] ? 'var(--content-text)' : 'var(--content-text-muted)'),
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {currentQuestion && (
                    <div className="space-y-4">
                      <div
                        className="p-4 sm:p-6 rounded-xl border"
                        style={{
                          background: 'var(--surface-bg-strong)',
                          borderColor: 'rgba(38, 100, 121, 0.12)',
                          color: 'var(--content-text)',
                        }}
                      >
                        <div className="font-medium text-lg md:text-xl leading-relaxed">
                          {currentQuestion.text}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map(opt => {
                          const selected = Number(answers[String(currentQuestion.id)]) === Number(opt.id)
                          return (
                            <button
                              key={opt.id}
                              onClick={() => pick(currentQuestion.id, opt.id)}
                              data-theme-preview="true"
                              className="w-full text-left px-4 py-3 sm:px-6 sm:py-4 rounded-xl border text-base transition-all duration-200 hover:brightness-105"
                              style={{
                                background: selected ? 'var(--btn-primary-bg)' : 'var(--surface-bg)',
                                borderColor: selected ? 'var(--btn-primary-border)' : 'rgba(38, 100, 121, 0.12)',
                                color: selected ? 'var(--btn-primary-text)' : 'var(--content-text)',
                              }}
                            >
                              {opt.text}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-4 border-t" style={{ borderColor: 'rgba(38, 100, 121, 0.12)' }}>
                    <button
                      onClick={() => setCurrent(i => Math.max(0, i - 1))}
                      className="w-full sm:w-auto rounded-2xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed border"
                      style={{
                        padding: '0.85rem 1.25rem',
                        fontSize: '1.05rem',
                        background: 'var(--surface-bg-strong)',
                        borderColor: 'rgba(38, 100, 121, 0.18)',
                        color: 'var(--content-text)',
                      }}
                      disabled={current === 0}
                    >
                      Назад
                    </button>
                    {current < total - 1 ? (
                      <button
                        onClick={() => setCurrent(i => Math.min(total - 1, i + 1))}
                        className="w-full sm:w-auto rounded-2xl font-semibold transition-all border"
                        style={{
                          padding: '0.85rem 1.25rem',
                          fontSize: '1.05rem',
                          background: 'var(--btn-primary-bg)',
                          borderColor: 'var(--btn-primary-border)',
                          color: 'var(--btn-primary-text)',
                        }}
                      >
                        Далее
                      </button>
                    ) : (
                      <button
                        onClick={submit}
                        disabled={!canSubmit || submitting}
                        className="w-full sm:w-auto rounded-2xl font-semibold transition-all disabled:opacity-50 border"
                        style={{
                          padding: '0.85rem 1.25rem',
                          fontSize: '1.05rem',
                          background: 'var(--btn-primary-bg)',
                          borderColor: 'var(--btn-primary-border)',
                          color: 'var(--btn-primary-text)',
                        }}
                      >
                        {submitting ? 'Отправка…' : 'Завершить тестирование'}
                      </button>
                    )}
                  </div>
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
