import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Plus, Trash2, Upload, X } from 'lucide-react'
import { api } from '../lib/api'

function normalizeQuestions(rawQuestions) {
  const qs = Array.isArray(rawQuestions) ? rawQuestions : []
  return qs
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .map((q) => {
      const optionsRaw = Array.isArray(q?.options) ? q.options : []
      const options = optionsRaw
        .slice()
        .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
        .map(o => ({ text: String(o?.text || '') }))
      while (options.length < 4) options.push({ text: '' })
      const correctIdx = optionsRaw.findIndex(o => !!o?.is_correct)
      return {
        _key: `${q?.id || 'q'}_${Math.random().toString(16).slice(2)}`,
        text: String(q?.text || ''),
        options: options.slice(0, 4),
        correctIndex: correctIdx >= 0 ? correctIdx : 0,
      }
    })
}

function buildPayload(questions) {
  const qs = Array.isArray(questions) ? questions : []
  const normalized = qs.map((q, idx) => ({
    text: String(q?.text || '').trim(),
    correctIndex: Number.isFinite(Number(q?.correctIndex)) ? Number(q.correctIndex) : 0,
    options: (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map(o => String(o?.text || '').trim()),
    order: idx + 1,
  }))

  for (let i = 0; i < normalized.length; i++) {
    const q = normalized[i]
    if (!q.text) {
      throw new Error(`Вопрос ${i + 1}: заполните текст вопроса`)
    }
    if (q.options.length !== 4 || q.options.some(t => !t)) {
      throw new Error(`Вопрос ${i + 1}: заполните все 4 варианта ответа`)
    }
    if (!(q.correctIndex >= 0 && q.correctIndex <= 3)) {
      throw new Error(`Вопрос ${i + 1}: выберите правильный вариант`)
    }
  }

  return normalized.map(q => ({
    text: q.text,
    question_type: 'single',
    explanation: '',
    points: 1,
    order: q.order,
    options: q.options.map((text, idx) => ({
      text,
      is_correct: idx === q.correctIndex,
      order: idx + 1,
    })),
  }))
}

async function exportToExcel({ materialTitle, questions }) {
  const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
  if (!XLSX) throw new Error('Не удалось загрузить модуль для Excel')
  const header = ['Вопрос', 'Ответ 1', 'Ответ 2', 'Ответ 3', 'Ответ 4', 'Правильный ответ']
  const rows = [header]
  const qs = Array.isArray(questions) ? questions : []
  for (const q of qs) {
    const text = String(q?.text || '').trim()
    const opts = (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map(o => String(o?.text || '').trim())
    while (opts.length < 4) opts.push('')
    const correct = Number(q?.correctIndex)
    rows.push([text, opts[0], opts[1], opts[2], opts[3], Number.isFinite(correct) ? correct + 1 : 1])
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Тест')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = String(materialTitle || 'test').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
  a.download = `test_${safe}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function importFromExcel(file) {
  const XLSX = await import('xlsx').then(m => m.default || m).catch(() => null)
  if (!XLSX) throw new Error('Не удалось загрузить модуль для Excel')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const name = wb.SheetNames?.[0]
  const ws = name ? wb.Sheets[name] : null
  const rows = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : []
  const normalized = (Array.isArray(rows) ? rows : []).slice(1).filter(r => Array.isArray(r) && r.some(v => String(v || '').trim()))
  const questions = []
  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i]
    const rowNumber = i + 2
    const text = String(row?.[0] || '').trim()
    const answers = [row?.[1], row?.[2], row?.[3], row?.[4]].map(v => String(v || '').trim())
    const correctRaw = row?.[5]
    const correctNum = Number(String(correctRaw || '').trim())
    if (!text) throw new Error(`Строка ${rowNumber}: пустой текст вопроса`)
    if (answers.some(a => !a)) throw new Error(`Строка ${rowNumber}: все 4 варианта ответа должны быть заполнены`)
    if (!Number.isInteger(correctNum) || correctNum < 1 || correctNum > 4) throw new Error(`Строка ${rowNumber}: "Правильный ответ" должен быть числом от 1 до 4`)
    questions.push({
      _key: `q_${Math.random().toString(16).slice(2)}`,
      text,
      options: answers.map(a => ({ text: a })),
      correctIndex: correctNum - 1,
    })
  }
  return questions
}

export default function TestEditorModal({ open, materialId, testId, materialTitle, universitySlug = null, onClose, onSaved }) {
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open || !testId) return
    let cancelled = false
    ;(async () => {
      setError('')
      setLoading(true)
      try {
        const data = await api.courses.tests.detail(testId, { universitySlug })
        if (cancelled) return
        setQuestions(normalizeQuestions(data?.questions))
      } catch {
        if (!cancelled) setError('Не удалось загрузить вопросы теста')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, testId, universitySlug])

  const canSave = useMemo(() => !!materialId && !!testId && !isLoading && !isSaving, [materialId, testId, isLoading, isSaving])

  const addQuestion = () => {
    setQuestions(prev => [
      ...(Array.isArray(prev) ? prev : []),
      { _key: `q_${Math.random().toString(16).slice(2)}`, text: '', options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correctIndex: 0 },
    ])
  }

  const removeQuestion = (key) => {
    setQuestions(prev => (Array.isArray(prev) ? prev : []).filter(q => q?._key !== key))
  }

  const updateQuestion = (key, patch) => {
    setQuestions(prev => (Array.isArray(prev) ? prev : []).map(q => q?._key === key ? { ...q, ...patch } : q))
  }

  const updateOption = (key, idx, text) => {
    setQuestions(prev => (Array.isArray(prev) ? prev : []).map(q => {
      if (q?._key !== key) return q
      const options = (Array.isArray(q.options) ? q.options : []).slice(0, 4)
      while (options.length < 4) options.push({ text: '' })
      options[idx] = { text }
      return { ...q, options }
    }))
  }

  const save = async () => {
    if (!canSave) return
    setError('')
    try {
      const payloadQuestions = buildPayload(questions)
      setSaving(true)
      await api.courses.updateMaterial(materialId, { test_data: { questions: payloadQuestions } }, { universitySlug })
      onSaved?.()
      onClose?.()
    } catch (e) {
      const msg = e?.message || e?.body?.detail || 'Не удалось сохранить тест'
      setError(String(msg))
    } finally {
      setSaving(false)
    }
  }

  const downloadExcel = async () => {
    setError('')
    try {
      await exportToExcel({ materialTitle, questions })
    } catch (e) {
      setError(String(e?.message || 'Не удалось выгрузить Excel'))
    }
  }

  const onPickFile = async (file) => {
    if (!file) return
    setError('')
    try {
      const next = await importFromExcel(file)
      setQuestions(next)
    } catch (e) {
      setError(String(e?.message || 'Не удалось импортировать Excel'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => onClose?.()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-5xl modal-panel rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-bold truncate" style={{ color: 'var(--content-text)' }}>Редактирование теста</div>
                <div className="text-sm truncate" style={{ color: 'var(--content-text-muted)' }}>{materialTitle || 'Тест'}</div>
              </div>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]"
                title="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addQuestion}
                className="px-3 h-10 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a] inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Добавить вопрос
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 h-10 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a] inline-flex items-center gap-2"
              >
                <Upload size={16} />
                Импорт из Excel
              </button>
              <button
                type="button"
                onClick={downloadExcel}
                className="px-3 h-10 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a] inline-flex items-center gap-2"
              >
                <Download size={16} />
                Выгрузить в Excel
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              />
            </div>

            {error && (
              <div className="mt-3 rounded-xl p-3 border text-sm" style={{ background: 'rgba(220, 38, 38, 0.08)', borderColor: 'rgba(220, 38, 38, 0.18)', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <div className="mt-4 max-h-[65vh] overflow-auto pr-1 space-y-3">
              {isLoading ? (
                <div style={{ color: 'var(--content-text-muted)' }}>Загрузка…</div>
              ) : questions.length === 0 ? (
                <div style={{ color: 'var(--content-text-muted)' }}>Вопросов пока нет</div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q._key} className="rounded-2xl border border-white/10 p-4" style={{ background: 'var(--surface-bg-strong)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold" style={{ color: 'var(--content-text)' }}>Вопрос {idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(q._key)}
                        className="p-2 rounded-xl bg-white/10 border border-white/20 text-[#0f2e3a]"
                        title="Удалить вопрос"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs mb-1" style={{ color: 'var(--content-text-muted)' }}>Текст вопроса</label>
                      <input
                        value={q.text}
                        onChange={(e) => updateQuestion(q._key, { text: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-10 focus:outline-none"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(Array.isArray(q.options) ? q.options : []).slice(0, 4).map((o, oIdx) => (
                        <div key={`${q._key}_${oIdx}`} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct_${q._key}`}
                            checked={Number(q.correctIndex) === oIdx}
                            onChange={() => updateQuestion(q._key, { correctIndex: oIdx })}
                          />
                          <input
                            value={o?.text || ''}
                            onChange={(e) => updateOption(q._key, oIdx, e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 h-10 focus:outline-none"
                            placeholder={`Вариант ${oIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onClose?.()}
                className="px-4 h-10 rounded-xl border border-[#266479]/20 text-[#0f2e3a]"
                disabled={isSaving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="px-4 h-10 rounded-xl btn-success-like disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
