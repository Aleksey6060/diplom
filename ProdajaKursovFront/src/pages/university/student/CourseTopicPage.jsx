import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, User, BookOpen, CheckCircle } from 'lucide-react'
import TestModal from '../../../components/TestModal'
import { api } from '../../../lib/api'

export default function CourseTopicPage() {
  const { id, topicId } = useParams()
  const navigate = useNavigate()
  const [topic, setTopic] = useState(null)
  const [materials, setMaterials] = useState([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const questions = useMemo(() => ([
    { id: 1, text: 'Что такое PRIMARY KEY в MySQL?', options: ['Ключ, гарантирующий уникальность и отсутствие NULL', 'Ключ для ускорения запросов, допускает дубли', 'Ключ для связи с внешними таблицами'], correctIndex: 0 },
    { id: 2, text: 'Какой тип данных лучше подойдёт для денежных значений?', options: ['INT', 'VARCHAR(255)', 'DECIMAL(10, 2)'], correctIndex: 2 },
    { id: 3, text: 'Какой оператор используется для объединения таблиц?', options: ['UNION ALL', 'JOIN', 'GROUP BY'], correctIndex: 1 },
    { id: 4, text: 'Что делает индекс?', options: ['Удаляет дубликаты', 'Ускоряет выборку данных', 'Шифрует данные'], correctIndex: 1 },
    { id: 5, text: 'Как выбрать все столбцы из таблицы users?', options: ['SELECT * FROM users', 'GET users', 'FETCH users'], correctIndex: 0 },
    { id: 6, text: 'Какое выражение добавляет новую строку?', options: ['INSERT INTO', 'UPDATE SET', 'ALTER TABLE'], correctIndex: 0 },
    { id: 7, text: 'Как удалить таблицу?', options: ['DROP TABLE', 'DELETE TABLE', 'REMOVE TABLE'], correctIndex: 0 },
    { id: 8, text: 'Как получить уникальные значения из столбца?', options: ['SELECT DISTINCT', 'SELECT UNIQUE', 'SELECT GROUP'], correctIndex: 0 },
    { id: 9, text: 'Как выбрать строки с условием?', options: ['WHERE', 'HAVING', 'ON'], correctIndex: 0 },
    { id: 10, text: 'Что такое FOREIGN KEY?', options: ['Ключ для связи между таблицами', 'Ключ для шифрования', 'Ключ для сортировки'], correctIndex: 0 }
  ]), [])
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [openModal, setOpenModal] = useState(false)
  const completedKey = `topic_test_completed_${id}_${topicId}`
  const storedCompleted = typeof window !== 'undefined' ? localStorage.getItem(completedKey) === 'true' : false
  const [completed, setCompleted] = useState(storedCompleted)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError('')
        setLoading(true)
        const data = await api.courses.topicContents(topicId)
        if (cancelled) return
        setTopic(data?.current || null)
        setMaterials(Array.isArray(data?.children?.materials) ? data.children.materials : [])
      } catch {
        if (!cancelled) setError('Не удалось загрузить тему')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [topicId])

  const progressValue = result ? Math.round((result.correct / result.total) * 100) : completed ? 100 : 0

  if (!topic && !isLoading) {
    return (
      <div className="pt-32 px-4 text-center text-gray-400">
        {error || 'Тема не найдена'}
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-7xl z-[9980] px-4">
        <div
          className="p-4 flex items-center justify-between relative"
          style={{
            background: `
              radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
              radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
              radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
              rgba(0, 0, 0, 0.4)
            `,
            backdropFilter: 'blur(24px) saturate(200%)',
            WebkitBackdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 8px 40px rgba(0,0,0,.35),
              inset 0 1px 0 rgba(255,255,255,.06),
              0 0 0 1px rgba(255,255,255,0.02)
            `,
            borderRadius: '20px',
            padding: '1rem 1.5rem'
          }}
          data-header="true"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/my-courses/${id}`)}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition flex items-center gap-2"
              >
                <span>←</span>
              </button>
            </div>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <h1 className="text-white font-bold text-lg">{topic?.title || (isLoading ? 'Загрузка…' : 'Тема')}</h1>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white">
              {progressValue}%
            </div>
          </div>
        </div>
      </div>

      <div className="pt-36 px-4 lg:pl-32">
        <div className="space-y-6 max-w-7xl max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div
                className="p-5 flex items-center justify-between"
                style={{
                  background: `
                    radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
                    radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
                    radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
                    rgba(0, 0, 0, 0.4)
                  `,
                  backdropFilter: 'blur(24px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: `
                    0 8px 40px rgba(0,0,0,.35),
                    inset 0 1px 0 rgba(255,255,255,.06),
                    0 0 0 1px rgba(255,255,255,0.02)
                  `,
                  borderRadius: '20px',
                }}
              >
                <div className="text-white">
                  <span className="font-medium">Итог теста:</span> правильно {result.correct} из {result.total}.
                  Ошибок {result.total - result.correct}.
                  Оценка {Math.round((result.correct / result.total) * 100)}%.
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 transition text-sm"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 space-y-6"
            >
              <div
                className="p-6 space-y-6"
                style={{
                  background: `
                    radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
                    radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
                    radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
                    rgba(0, 0, 0, 0.4)
                  `,
                  backdropFilter: 'blur(24px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: `
                    0 8px 40px rgba(0,0,0,.35),
                    inset 0 1px 0 rgba(255,255,255,.06),
                    0 0 0 1px rgba(255,255,255,0.02)
                  `,
                  borderRadius: '20px',
                }}
              >
                <div>
                  <h3 className="text-white font-semibold text-xl mb-2 text-center">Описание задания</h3>
                  <p className="text-gray-300 text-base md:text-lg">
                    Пройдите тест по теме. Вопросы будут показаны по одному, можно листать вперёд/назад.
                    Для успешного прохождения необходимо ответить правильно на все вопросы.
                  </p>
                </div>

                {!!materials.length && (
                  <div className="space-y-2">
                    <h4 className="text-white font-semibold text-lg">Материалы</h4>
                    <div className="space-y-2">
                      {materials.slice(0, 6).map(m => (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                          <div className="text-white/90">{m.title}</div>
                          <div className="text-gray-300 text-xs">{m.material_type_display || 'Материал'}</div>
                        </div>
                      ))}
                      {materials.length > 6 && (
                        <div className="text-gray-300 text-sm">Ещё {materials.length - 6}</div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  {completed ? (
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-300">
                      <CheckCircle size={18} />
                      <span className="font-medium">
                        Тестирование пройдено. Оценка {progressValue}%
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenModal(true)}
                      className="px-5 py-3 rounded-xl bg-osnova-pink hover:bg-osnova-pink/90 text-white font-medium transition-all"
                    >
                      Пройти тестирование
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <div
                  className="p-5 space-y-4"
                  style={{
                    background: `
                      radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
                      radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
                      radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
                      rgba(0, 0, 0, 0.4)
                    `,
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: `
                      0 8px 40px rgba(0,0,0,.35),
                      inset 0 1px 0 rgba(255,255,255,.06),
                      0 0 0 1px rgba(255,255,255,0.02)
                    `,
                    borderRadius: '20px',
                  }}
                >
                  <h3 className="text-white font-semibold text-lg mb-3">Информация</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-300">
                      <CalendarDays size={16} className="text-gray-400" />
                      <span className="text-sm">Срок сдачи: 12 февраля 2026</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm">Иванов И.И.</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <BookOpen size={16} className="text-gray-400" />
                      <span className="text-sm">Курс: База данных</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <div
                  className="p-5 space-y-4"
                  style={{
                    background: `
                      radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
                      radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
                      radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
                      rgba(0, 0, 0, 0.4)
                    `,
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: `
                      0 8px 40px rgba(0,0,0,.35),
                      inset 0 1px 0 rgba(255,255,255,.06),
                      0 0 0 1px rgba(255,255,255,0.02)
                    `,
                    borderRadius: '20px',
                  }}
                >
                  <h3 className="text-white font-semibold text-lg mb-3">Прогресс</h3>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-osnova-pink rounded-full transition-all duration-500"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <div className="text-gray-300 text-sm">{completed ? 'Завершено' : 'Работа в процессе'}</div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
              >
                <div
                  className="p-5 space-y-3"
                  style={{
                    background: `
                      radial-gradient(1200px 600px at 10% -10%, rgba(0, 128, 255, 0.15), transparent 60%),
                      radial-gradient(800px 400px at 90% 10%, rgba(255, 0, 200, 0.12), transparent 60%),
                      radial-gradient(1000px 500px at 50% 120%, rgba(217, 70, 239, 0.15), transparent 60%),
                      rgba(0, 0, 0, 0.4)
                    `,
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: `
                      0 8px 40px rgba(0,0,0,.35),
                      inset 0 1px 0 rgba(255,255,255,.06),
                      0 0 0 1px rgba(255,255,255,0.02)
                    `,
                    borderRadius: '20px',
                  }}
                >
                  <h3 className="text-white font-semibold text-lg mb-3">Оценка</h3>
                  <div className="flex items-center gap-2 text-[#266479]">
                    <CheckCircle size={16} />
                    <span className="text-sm">
                      {completed
                        ? `Оценка: ${progressValue}%`
                        : 'Оценки ещё нет'
                      }
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <TestModal
        open={openModal}
        questions={questions}
        onClose={() => setOpenModal(false)}
        onComplete={(r) => {
          try {
            const snapshot = {
              correct: r.correct,
              total: r.total,
              ts: Date.now(),
              answers: r.answers,
              questions: questions.map(q => ({
                id: q.id,
                text: q.text,
                options: q.options,
                correctIndex: q.correctIndex
              }))
            }
            localStorage.setItem(`topic_result_${id}_${topicId}`, JSON.stringify(snapshot))
            localStorage.setItem(completedKey, 'true')
          } catch {}
          setResult(r)
          setCompleted(true)
        }}
      />
    </div>
  )
}
