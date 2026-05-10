import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Paperclip, UploadCloud, Trash2, Clock, Filter, Download } from 'lucide-react'
import { api } from '../../lib/api'

const MAX_SIZE = 2 * 1024 * 1024
const TYPE_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'image', label: 'Изображения' },
  { value: 'text', label: 'Текст' },
  { value: 'archive', label: 'Архивы' },
  { value: 'other', label: 'Другое' },
]

export default function AdminDocuments() {
  const [items, setItems] = useState([])
  const [isLoading, setLoading] = useState(false)
  const [sortDir, setSortDir] = useState('desc')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  const getCategory = ({ name = '', type = '' }) => {
    const ext = String(name).split('.').pop()?.toLowerCase() || ''
    const mime = String(type || '').toLowerCase()
    if (mime.includes('pdf') || ext === 'pdf') return 'pdf'
    if (mime.includes('word') || mime.includes('officedocument.wordprocessingml') || ['doc', 'docx', 'rtf'].includes(ext)) return 'word'
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image'
    if (mime.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return 'text'
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
    return 'other'
  }

  const normalize = (d) => {
    const name = d?.original_name || ''
    const type = d?.content_type || ''
    return {
      id: d?.id,
      name,
      size: Number(d?.size || 0),
      type,
      category: getCategory({ name, type }),
      uploadedAt: d?.created_at || d?.updated_at || new Date().toISOString(),
      url: d?.file || '',
      uploading: false,
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const list = await api.documents.listAll()
        const arr = Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : [])
        if (!cancelled) setItems(arr.map(normalize).filter(x => x.id))
      } catch {
        if (!cancelled) setError('Не удалось загрузить документы')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [filterOpen])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    const byQ = q
      ? items.filter(d => (d.name || '').toLowerCase().includes(q) || (d.type || '').toLowerCase().includes(q))
      : items
    const byType = typeFilter === 'all' ? byQ : byQ.filter(d => d.category === typeFilter)
    const sorted = [...byType].sort((a, b) => {
      const ta = new Date(a.uploadedAt).getTime()
      const tb = new Date(b.uploadedAt).getTime()
      return sortDir === 'asc' ? ta - tb : tb - ta
    })
    return sorted
  }, [items, query, typeFilter, sortDir])

  const onPickFiles = async (e) => {
    setError('')
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setLoading(true)
    try {
      for (const f of files) {
        if (f.size > MAX_SIZE) {
          setError(`Файл "${f.name}" превышает лимит 2MB и не был загружен`)
          continue
        }
        const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
        const tmp = {
          id: tempId,
          name: f.name,
          size: Number(f.size || 0),
          type: f.type || '',
          category: getCategory({ name: f.name, type: f.type || '' }),
          uploadedAt: new Date().toISOString(),
          url: '',
          uploading: true,
        }
        setItems(prev => [tmp, ...prev])

        try {
          const saved = await api.documents.upload(f)
          const doc = normalize(saved)
          if (doc.id) {
            setItems(prev => prev.map(i => (i.id === tempId ? doc : i)))
          } else {
            setItems(prev => prev.map(i => (i.id === tempId ? { ...i, uploading: true } : i)))
          }
        } catch {
          setItems(prev => prev.filter(i => i.id !== tempId))
          setError(`Не удалось загрузить файл "${f.name}"`)
        }
      }
      try {
        const list = await api.documents.listAll()
        const arr = Array.isArray(list) ? list : (Array.isArray(list?.results) ? list.results : [])
        const fresh = arr.map(normalize).filter(x => x.id)
        setItems(prev => {
          const temps = (Array.isArray(prev) ? prev : []).filter(i => String(i?.id || '').startsWith('tmp_'))
          const remainingTemps = temps.filter(t => !fresh.some(d => d.name === t.name && d.size === t.size))
          return [...fresh, ...remainingTemps]
        })
      } catch { void 0 }
    } catch {
      setError('Не удалось загрузить файл')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (id) => {
    setError('')
    setLoading(true)
    try {
      await api.documents.remove(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch {
      setError('Не удалось удалить документ')
    } finally {
      setLoading(false)
    }
  }

  const prettySize = (n) => {
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
    if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${n} B`
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="w-full max-w-screen-2xl mx-auto px-2 sm:px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap justify-center lg:flex-nowrap lg:overflow-x-auto lg:whitespace-nowrap">
            <h2 className="text-2xl font-bold text-[#0f2e3a]">Документы</h2>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full">
              <div className="relative">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Поиск по имени/типу"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white w-full md:w-64 placeholder-[#266479]/70"
                />
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen(o => !o)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center gap-2"
                >
                  <Filter size={16} className="text-white/70" />
                  <span className="text-sm">{TYPE_OPTIONS.find(o => o.value === typeFilter)?.label || 'Все типы'}</span>
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-[min(14rem,calc(100vw-1.5rem))] sm:w-56 rounded-xl border border-white/20 bg-white/10 backdrop-blur shadow-xl p-2 flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar z-[12000]">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setTypeFilter(opt.value); setFilterOpen(false) }}
                        className={`w-full text-left px-4 py-3 text-sm rounded-lg ${typeFilter === opt.value ? 'bg-black/20 text-white' : 'text-white hover:bg-black/10'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <label className="w-full md:w-auto px-3 lg:px-4 h-11 rounded-xl btn-success-like flex items-center justify-center md:justify-start gap-2 cursor-pointer shrink-0">
              <UploadCloud size={16} />
              <span className="hidden sm:inline whitespace-nowrap btn-label">{isLoading ? 'Загрузка…' : 'Загрузить'}</span>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                accept="*/*"
                onChange={onPickFiles}
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
          <div className="text-xs text-[#266479]">
            {filtered.length} документ(ов)
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              className="px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center gap-2 shrink-0"
              title="Сортировать по дате"
            >
              <Clock size={16} className="text-white/70" />
              <span className="hidden sm:inline whitespace-nowrap btn-label">{sortDir === 'desc' ? 'Сначала новые' : 'Сначала старые'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 max-h-[65vh] md:max-h-[60vh] overflow-auto pr-1">
          {!isLoading && filtered.length === 0 && (
            <div className="admin-card rounded-xl p-4 text-[#266479]">Нет документов</div>
          )}
          {filtered.map(doc => {
            const ext = (doc.name || '').split('.').pop()?.toLowerCase() || ''
            const typeGroup =
              doc.category === 'pdf' ? 'PDF' :
              doc.category === 'word' ? 'Word' :
              doc.category === 'excel' ? 'Excel' :
              doc.category === 'image' ? 'Image' :
              doc.category === 'text' ? 'Text' :
              doc.category === 'archive' ? 'Archive' :
              'File'
            return (
              <div key={doc.id} className="admin-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                    <Paperclip size={18} className="text-white/80" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">{doc.name}</div>
                    <div className="text-xs text-[#266479]">
                      {typeGroup} · {prettySize(doc.size)} · {doc.uploading ? 'Загрузка…' : new Date(doc.uploadedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.url && !doc.uploading && (
                    <a
                      href={doc.url}
                      download={doc.name || undefined}
                      className="px-3 lg:px-4 h-11 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 text-sm flex items-center gap-2 shrink-0"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline whitespace-nowrap btn-label">Скачать</span>
                    </a>
                  )}
                  <button
                    onClick={() => remove(doc.id)}
                    className="px-3 lg:px-4 h-11 rounded-xl !bg-red-600 hover:!bg-red-700 border border-red-600/40 text-white text-sm flex items-center gap-2 shrink-0"
                    title="Удалить"
                    disabled={isLoading || doc.uploading}
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline whitespace-nowrap btn-label">Удалить</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
