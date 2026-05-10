import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, Paperclip, Trash2, Download } from 'lucide-react'
import { api } from '../lib/api'

export default function AssignmentModal({ open, assignment, universitySlug = null, onClose, onSaved }) {
  const assignmentId = assignment?.id || null
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(null)
  const [pickedFiles, setPickedFiles] = useState([])

  const statusLabel = useMemo(() => {
    const gr = details?.grade || assignment?.grade
    const sub = details?.submission || assignment?.submission
    if (gr) return 'Оценено'
    if (sub?.submitted_at) return 'Сдано'
    return 'Не сдано'
  }, [assignment, details])

  useEffect(() => {
    if (!open || !assignmentId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      setDetails(null)
      setPickedFiles([])
      try {
        const data = await api.courses.assignments.mySubmission(assignmentId, { universitySlug })
        if (cancelled) return
        setDetails(data || null)
      } catch (e) {
        if (cancelled) return
        const msg = e?.body?.detail || 'Не удалось загрузить задание'
        setError(String(msg))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, assignmentId, universitySlug])

  const submit = async () => {
    if (!assignmentId || saving) return
    setSaving(true)
    setError('')
    try {
      const data = await api.courses.assignments.saveMySubmission(assignmentId, { submit: true }, { universitySlug })
      setDetails(data || null)
      onSaved?.(assignmentId, data)
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось сдать задание'
      setError(String(msg))
    } finally {
      setSaving(false)
    }
  }

  const submissionFiles = Array.isArray(details?.submission?.files) ? details.submission.files : []
  const attachedCount = submissionFiles.length
  const canAttachMore = attachedCount < 10

  const uploadPicked = async () => {
    if (!assignmentId || uploading) return
    if (!pickedFiles.length) return
    if (!canAttachMore) return
    setUploading(true)
    setError('')
    try {
      const limit = Math.max(0, 10 - attachedCount)
      const batch = pickedFiles.slice(0, limit)
      for (const f of batch) {
        await api.courses.assignments.uploadMyFile(assignmentId, { name: f.name, file: f }, { universitySlug })
      }
      const refreshed = await api.courses.assignments.mySubmission(assignmentId, { universitySlug })
      setDetails(refreshed || null)
      setPickedFiles([])
      onSaved?.(assignmentId, refreshed)
    } catch (e) {
      const msg = e?.body?.detail || e?.body?.file?.[0] || 'Не удалось загрузить файл'
      setError(String(msg))
    } finally {
      setUploading(false)
    }
  }

  const removeFile = async (fileId) => {
    if (!assignmentId || uploading) return
    setUploading(true)
    setError('')
    try {
      await api.courses.assignments.removeMyFile(assignmentId, fileId, { universitySlug })
      const refreshed = await api.courses.assignments.mySubmission(assignmentId, { universitySlug })
      setDetails(refreshed || null)
      onSaved?.(assignmentId, refreshed)
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось удалить файл'
      setError(String(msg))
    } finally {
      setUploading(false)
    }
  }

  const openFile = async (fileId) => {
    if (!assignmentId) return
    setError('')
    try {
      const { blob, filename, contentType } = await api.courses.assignments.fetchMyFile(assignmentId, fileId, { universitySlug })
      const url = URL.createObjectURL(contentType ? new Blob([blob], { type: contentType }) : blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      void filename
    } catch (e) {
      const msg = e?.body?.detail || 'Не удалось открыть файл'
      setError(String(msg))
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-3xl rounded-3xl p-6 border"
            style={{
              background: 'var(--surface-bg)',
              borderColor: 'rgba(38, 100, 121, 0.18)',
              color: 'var(--content-text)'
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/60 border border-black/10 hover:bg-white transition"
            >
              <X size={18} />
            </button>

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-10" style={{ color: 'var(--content-text)' }}>
                <Loader2 className="animate-spin" size={20} />
                <span>Загрузка…</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-4 pr-14">
                  <div className="min-w-0">
                    <div className="text-xl font-bold truncate">{assignment?.title || 'Задание'}</div>
                    <div className="mt-2 flex items-center gap-3 text-sm" style={{ color: 'var(--content-text-muted)' }}>
                      <span>Статус: {statusLabel}</span>
                      {!!(details?.grade || assignment?.grade) && (
                        <span className="px-2.5 py-0.5 rounded-full border font-semibold"
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            borderColor: 'rgba(16, 185, 129, 0.25)',
                            color: '#059669'
                          }}
                        >
                          Оценка: {(details?.grade || assignment?.grade)?.value}/{assignment?.max_grade}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {assignment?.description && (
                  <div className="rounded-2xl p-4 border"
                    style={{
                      background: 'var(--surface-bg-strong)',
                      borderColor: 'rgba(38, 100, 121, 0.12)'
                    }}
                  >
                    <div className="text-sm whitespace-pre-wrap">{assignment.description}</div>
                  </div>
                )}

                {(details?.grade || assignment?.grade)?.comment && (
                  <div className="rounded-2xl p-4 border"
                    style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderColor: 'rgba(16, 185, 129, 0.18)'
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: '#059669' }}>Комментарий преподавателя</div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{(details?.grade || assignment?.grade)?.comment}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--content-text-muted)' }}>
                      Файлы
                    </div>
                    <div className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                      {attachedCount}/10
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4 space-y-3"
                    style={{
                      background: 'var(--surface-bg-strong)',
                      borderColor: 'rgba(38, 100, 121, 0.12)',
                    }}
                  >
                    {submissionFiles.length === 0 ? (
                      <div className="text-sm" style={{ color: 'var(--content-text-muted)' }}>Файлы не прикреплены</div>
                    ) : (
                      <div className="space-y-2">
                        {submissionFiles.map(f => (
                          <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                            style={{
                              background: 'var(--surface-bg)',
                              borderColor: 'rgba(38, 100, 121, 0.12)',
                              color: 'var(--content-text)'
                            }}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <Paperclip size={16} style={{ color: 'var(--content-text-muted)' }} />
                              <div className="truncate text-sm font-medium">{f.name || `Файл ${f.id}`}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => openFile(f.id)}
                                className="px-3 h-9 rounded-xl border text-sm font-semibold"
                                style={{
                                  background: 'var(--surface-bg-strong)',
                                  borderColor: 'rgba(38, 100, 121, 0.18)',
                                  color: 'var(--content-text)'
                                }}
                              >
                                <span className="inline-flex items-center gap-2"><Download size={16} />Открыть</span>
                              </button>
                              <button
                                onClick={() => removeFile(f.id)}
                                disabled={uploading}
                                className="px-3 h-9 rounded-xl border text-sm font-semibold disabled:opacity-50"
                                style={{
                                  background: 'rgba(220, 38, 38, 0.08)',
                                  borderColor: 'rgba(220, 38, 38, 0.18)',
                                  color: '#b91c1c'
                                }}
                              >
                                <span className="inline-flex items-center gap-2"><Trash2 size={16} />Удалить</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="file"
                        multiple
                        disabled={!canAttachMore || uploading}
                        onChange={(e) => setPickedFiles(Array.from(e.target.files || []).slice(0, Math.max(0, 10 - attachedCount)))}
                        className="w-full rounded-xl border px-3 py-2"
                        style={{
                          background: 'var(--surface-bg)',
                          borderColor: 'rgba(38, 100, 121, 0.18)',
                          color: 'var(--content-text)'
                        }}
                      />
                      <button
                        onClick={uploadPicked}
                        disabled={!pickedFiles.length || uploading || !canAttachMore}
                        className="px-4 h-11 rounded-xl text-white font-bold transition disabled:opacity-50"
                        style={{ background: 'var(--btn-primary-bg)' }}
                      >
                        {uploading ? 'Загрузка…' : 'Прикрепить'}
                      </button>
                    </div>
                    {!!pickedFiles.length && (
                      <div className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                        Выбрано: {pickedFiles.length}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs" style={{ color: 'var(--content-text-muted)' }}>
                      {details?.submission?.submitted_at ? `Отправлено: ${new Date(details.submission.submitted_at).toLocaleString()}` : 'Не сдано'}
                    </div>
                    <button
                      onClick={submit}
                      disabled={saving || uploading || attachedCount === 0}
                      className="px-5 h-11 rounded-xl text-white font-bold transition disabled:opacity-50"
                      style={{ background: 'var(--btn-primary-bg)' }}
                    >
                      {saving ? 'Сдача…' : 'Сдать'}
                    </button>
                  </div>
                </div>

                {!!error && (
                  <div className="rounded-xl p-3 border text-sm"
                    style={{
                      background: 'rgba(220, 38, 38, 0.08)',
                      borderColor: 'rgba(220, 38, 38, 0.18)',
                      color: '#b91c1c'
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
